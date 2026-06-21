/* Control panel: edits a local STATE copy and POSTs it to the server,
   which broadcasts to every connected overlay over SSE.
   Optimized for SOLO operation: big quick-control buttons + keyboard shortcuts. */

(function(){
  let STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const $ = s=>document.querySelector(s);
  const $$ = s=>document.querySelectorAll(s);
  const el=(t,c,h)=>{const n=document.createElement(t);if(c)n.className=c;if(h!=null)n.innerHTML=h;return n;};

  let pushTimer=null;
  function push(){
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>{
      fetch("/update",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({type:"full",state:STATE})}).catch(()=>{});
    },50);
  }
  function opt(list,val){return list.map(x=>`<option ${x===val?"selected":""}>${x}</option>`).join("");}

  /* ---------- centralized timer (shared by quick + match buttons) ---------- */
  let timerInt=null;
  function syncTimerUI(){
    $$("[data-timerbtn]").forEach(b=>{b.textContent=timerInt?"⏸ 정지":"▶ 시작";b.classList.toggle("on",!!timerInt);});
    const f=$("#timerField"); if(f) f.value=STATE.match.timer;
  }
  function toggleTimer(){
    if(timerInt){clearInterval(timerInt);timerInt=null;}
    else{
      timerInt=setInterval(()=>{
        STATE.match.timer=Math.max(0,STATE.match.timer-1);push();syncTimerUI();
        if(STATE.match.timer<=0){clearInterval(timerInt);timerInt=null;syncTimerUI();}
      },1000);
    }
    syncTimerUI();
  }
  function setTimer(v){STATE.match.timer=v;syncTimerUI();push();}

  /* ---------- shared actions (used by buttons AND keyboard) ---------- */
  function roundWin(team){STATE.teams[team].score++;STATE.match.round++;rebuildScores();push();}
  function swapSides(){STATE.match.attackingSide=STATE.match.attackingSide==="A"?"B":"A";rebuildScores();push();}
  function toggleSpike(){STATE.match.spike=!STATE.match.spike;STATE.match.phase=STATE.match.spike?"PLANTED":"LIVE";rebuildScores();push();}
  function mapWin(team){const max=Math.ceil(STATE.match.bestOf/2);STATE.teams[team].mapsWon=Math.min(max,(STATE.teams[team].mapsWon||0)+1);rebuildScores();push();}
  function newMap(){STATE.teams.A.score=0;STATE.teams.B.score=0;STATE.match.round=1;STATE.match.phase="BUY";STATE.match.spike=false;setTimer(30);rebuildScores();push();}

  // re-render only the live read-outs without rebuilding inputs being edited
  function rebuildScores(){
    const q=$("#quickReadout"); if(q) q.replaceWith(quickReadout()); 
    const sa=$("#scoreA"); if(sa) sa.textContent=STATE.teams.A.score;
    const sb=$("#scoreB"); if(sb) sb.textContent=STATE.teams.B.score;
    const ma=$("#mapsA"); if(ma) ma.textContent=STATE.teams.A.mapsWon;
    const mb=$("#mapsB"); if(mb) mb.textContent=STATE.teams.B.mapsWon;
  }

  /* ======================= QUICK CONTROL (solo) ======================= */
  function quickReadout(){
    const m=STATE.match,A=STATE.teams.A,B=STATE.teams.B;
    const atk=m.attackingSide;
    const r=el("div","quick-readout");r.id="quickReadout";
    r.innerHTML=`<span style="color:${A.color}">${A.tricode} ${A.score}</span>
      <span class="vs">${A.mapsWon}–${B.mapsWon} 맵</span>
      <span style="color:${B.color}">${B.score} ${B.tricode}</span>
      <span class="r">R${m.round} · ${m.map} · 공격:${atk==="A"?A.tricode:B.tricode}</span>`;
    return r;
  }
  function quickCard(){
    const c=el("div","card quick");c.innerHTML=`<h2>퀵 컨트롤 · 솔로 운영용</h2>`;
    c.appendChild(quickReadout());

    const big=el("div","bigrow");
    const wA=el("button","big a",`◀ ${STATE.teams.A.tricode} 라운드 승`);wA.onclick=()=>roundWin("A");
    const swap=el("button","big mid","⇄ 공수 교체");swap.onclick=swapSides;
    const wB=el("button","big b",`${STATE.teams.B.tricode} 라운드 승 ▶`);wB.onclick=()=>roundWin("B");
    big.append(wA,swap,wB);
    c.appendChild(big);

    const row2=el("div","qrow");
    const tbtn=el("button",timerInt?"on":"","▶ 시작");tbtn.dataset.timerbtn="1";tbtn.onclick=toggleTimer;
    const buy=el("button",null,"0:30 구매");buy.onclick=()=>setTimer(30);
    const live=el("button",null,"1:40 라운드");live.onclick=()=>setTimer(100);
    const spike=el("button",STATE.match.spike?"red":"","💣 스파이크");spike.onclick=e=>{toggleSpike();e.currentTarget.classList.toggle("red",STATE.match.spike);};
    row2.append(tbtn,buy,live,spike);
    c.appendChild(row2);

    const row3=el("div","qrow");
    row3.append(
      el("span","lbl","맵 획득"),
      Object.assign(el("button",null,`+ ${STATE.teams.A.tricode}`),{onclick:()=>mapWin("A")}),
      Object.assign(el("button",null,`+ ${STATE.teams.B.tricode}`),{onclick:()=>mapWin("B")}),
      Object.assign(el("button","ghost","↻ 새 맵 시작(0-0)"),{onclick:newMap})
    );
    c.appendChild(row3);

    c.appendChild(el("div","keys",
      `단축키 — <b>Q</b> ${STATE.teams.A.tricode} 라운드 승 · <b>P</b> ${STATE.teams.B.tricode} 라운드 승 · <b>S</b> 공수 교체 · <b>Space</b> 타이머 · <b>X</b> 스파이크 · <b>R</b> 1:40 · <b>B</b> 0:30`));
    return c;
  }

  /* ========================= OVERLAY DISPLAY ========================= */
  function uiCard(){
    const c=el("div","card");c.innerHTML=`<h2>오버레이 표시</h2>`;
    const row=el("div","row");
    const rails=el("button",STATE.ui.showRails?"on":"",STATE.ui.showRails?"선수 레일 표시 ON":"선수 레일 표시 OFF");
    rails.onclick=()=>{STATE.ui.showRails=!STATE.ui.showRails;rails.textContent=STATE.ui.showRails?"선수 레일 표시 ON":"선수 레일 표시 OFF";rails.classList.toggle("on",STATE.ui.showRails);push();};
    row.append(rails);
    c.append(row);
    c.append(el("div",null,`<div style="color:#8696a5;font-size:11px;margin-top:6px">혼자 운영해서 10명 정보를 못 채울 땐 레일을 끄면 스코어바만 깔끔하게 나갑니다.</div>`));
    return c;
  }

  /* ---------------------------- MATCH ---------------------------- */
  function matchCard(){
    const c=el("div","card");c.innerHTML=`<h2>경기 상태</h2>`;
    const m=STATE.match;
    const row=(a)=>{const r=el("div","row");r.append(...a);return r;};

    const map=el("select",null,opt(MAPS,m.map));map.onchange=e=>{m.map=e.target.value;rebuildScores();push();};
    const bo=el("select",null,opt(["Bo1","Bo3","Bo5"],"Bo"+m.bestOf));
    bo.onchange=e=>{m.bestOf=+e.target.value.replace("Bo","");push();};
    c.append(row([el("label",null,"맵"),map,el("label",null,"형식"),bo]));

    const round=el("input");round.type="number";round.min=1;round.value=m.round;
    round.oninput=e=>{m.round=+e.target.value;rebuildScores();push();};
    const phase=el("select",null,opt(["BUY","LIVE","PLANTED","POST"],m.phase));
    phase.onchange=e=>{m.phase=e.target.value;push();};
    c.append(row([el("label",null,"라운드"),round,el("label",null,"국면"),phase]));

    const timer=el("input");timer.id="timerField";timer.type="number";timer.min=0;timer.value=m.timer;
    timer.oninput=e=>{m.timer=+e.target.value;push();};
    const run=el("button",timerInt?"on":"","▶ 시작");run.dataset.timerbtn="1";run.onclick=toggleTimer;
    c.append(row([el("label",null,"타이머(초)"),timer,run]));
    return c;
  }

  /* ---------------------------- TEAM ---------------------------- */
  function teamCard(k){
    const t=STATE.teams[k];
    const c=el("div","card");c.innerHTML=`<h2>팀 ${k} ${k==="A"?"(좌)":"(우)"}</h2>`;
    const row=(a)=>{const r=el("div","row");r.append(...a);return r;};

    const name=el("input");name.type="text";name.value=t.name;name.style.width="160px";
    name.oninput=e=>{t.name=e.target.value;push();};
    c.append(row([el("label",null,"팀명"),name]));

    const tri=el("input");tri.type="text";tri.value=t.tricode;tri.style.width="80px";tri.maxLength=4;
    tri.oninput=e=>{t.tricode=e.target.value.toUpperCase();push();};
    const color=el("input");color.type="color";color.value=t.color;
    color.oninput=e=>{t.color=e.target.value;push();};
    c.append(row([el("label",null,"약칭"),tri,el("label",null,"컬러"),color]));

    const logo=el("input");logo.type="text";logo.value=t.logo;logo.placeholder="로고 이미지 URL (선택)";logo.style.width="220px";
    logo.oninput=e=>{t.logo=e.target.value;push();};
    c.append(row([el("label",null,"로고"),logo]));

    // round score
    const val=el("b");val.id="score"+k;val.textContent=t.score;
    const minus=el("button",null,"−");minus.onclick=()=>{t.score=Math.max(0,t.score-1);val.textContent=t.score;push();};
    const plus=el("button","primary","+");plus.onclick=()=>{t.score++;val.textContent=t.score;push();};
    const step=el("div","step");step.append(minus,val,plus);
    c.append(row([el("label",null,"스코어"),step]));

    // maps won (series)
    const mval=el("b");mval.id="maps"+k;mval.textContent=t.mapsWon||0;
    const mmax=Math.ceil(STATE.match.bestOf/2);
    const mminus=el("button",null,"−");mminus.onclick=()=>{t.mapsWon=Math.max(0,(t.mapsWon||0)-1);mval.textContent=t.mapsWon;push();};
    const mplus=el("button","primary","+");mplus.onclick=()=>{t.mapsWon=Math.min(mmax,(t.mapsWon||0)+1);mval.textContent=t.mapsWon;push();};
    const mstep=el("div","step");mstep.append(mminus,mval,mplus);
    c.append(row([el("label",null,"맵 획득"),mstep]));
    return c;
  }

  /* ---------------------------- PLAYERS ---------------------------- */
  function playerRow(k,i){
    const p=STATE.players[k][i];
    const wrap=el("div","pl");
    const head=el("div","head");
    const det=el("div","detail");

    const name=el("input");name.type="text";name.value=p.name;name.style.width="110px";
    name.oninput=e=>{p.name=e.target.value;push();};
    const agent=el("select",null,opt(AGENTS,p.agent));agent.onchange=e=>{p.agent=e.target.value;push();};
    const alive=el("button",p.alive?"on":"",p.alive?"생존":"사망");
    alive.onclick=()=>{p.alive=!p.alive;alive.textContent=p.alive?"생존":"사망";alive.classList.toggle("on",p.alive);push();};
    head.append(name,agent,alive);

    const weapon=el("select",null,opt(WEAPONS,p.weapon));weapon.onchange=e=>{p.weapon=e.target.value;push();};
    const hp=el("input");hp.type="number";hp.min=0;hp.max=100;hp.value=p.hp;hp.title="체력";hp.style.width="58px";
    hp.oninput=e=>{p.hp=+e.target.value;push();};
    const shield=el("select",null,opt(["0","1","2"],String(p.shield)));shield.title="방어구";
    shield.onchange=e=>{p.shield=+e.target.value;push();};
    const cred=el("input");cred.type="number";cred.min=0;cred.value=p.credits;cred.title="크레딧";cred.style.width="72px";
    cred.oninput=e=>{p.credits=+e.target.value;push();};

    const ucur=el("input");ucur.type="number";ucur.min=0;ucur.value=p.ultCur;ucur.style.width="48px";ucur.title="궁극기 현재";
    const umax=el("input");umax.type="number";umax.min=1;umax.value=p.ultMax;umax.style.width="48px";umax.title="궁극기 필요";
    ucur.oninput=e=>{p.ultCur=+e.target.value;push();};
    umax.oninput=e=>{p.ultMax=+e.target.value;push();};

    const ab=el("div","pip-ctl");
    ["c","q","e"].forEach(key=>{
      const b=el("button",p.abilities[key]?"on":"",key.toUpperCase());b.style.padding="4px 8px";
      b.onclick=()=>{p.abilities[key]=!p.abilities[key];b.classList.toggle("on",p.abilities[key]);push();};
      ab.append(b);
    });

    det.append(
      el("label",null,"무기"),weapon,
      el("label",null,"HP"),hp,
      el("label",null,"방어"),shield,
      el("label",null,"$"),cred,
      el("label",null,"궁"),ucur,el("span",null,"/"),umax,
      el("label",null,"스킬"),ab
    );
    wrap.append(head,det);
    return wrap;
  }
  function playersCard(){
    const c=el("div","card players");c.innerHTML=`<h2>선수 명단 <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#8696a5">— 옵저버가 있을 때 사용 (솔로면 생략 가능)</span></h2>`;
    ["A","B"].forEach(k=>{
      const d=el("details");if(k==="A")d.open=true;
      d.append(el("summary",null,`팀 ${k} — ${STATE.teams[k].tricode} 선수 5명`));
      const t=el("div","pteam");
      for(let i=0;i<5;i++) t.append(playerRow(k,i));
      d.append(t);c.append(d);
    });
    return c;
  }

  /* ---------------------------- CAM ---------------------------- */
  function camCard(){
    const cam=STATE.cam;const c=el("div","card");c.innerHTML=`<h2>선수/캐스터 캠</h2>`;
    const row=(a)=>{const r=el("div","row");r.append(...a);return r;};
    const onBtn=el("button",cam.on?"on":"",cam.on?"캠 ON":"캠 OFF");
    onBtn.onclick=()=>{cam.on=!cam.on;onBtn.textContent=cam.on?"캠 ON":"캠 OFF";onBtn.classList.toggle("on",cam.on);push();};
    const sideBtn=el("button",null,`위치: ${cam.team==="A"?"좌하단":"우하단"}`);
    sideBtn.onclick=()=>{cam.team=cam.team==="A"?"B":"A";sideBtn.textContent=`위치: ${cam.team==="A"?"좌하단":"우하단"}`;push();};
    const label=el("input");label.type="text";label.value=cam.label;label.style.width="160px";
    label.oninput=e=>{cam.label=e.target.value;push();};
    c.append(row([onBtn,sideBtn]));
    c.append(row([el("label",null,"라벨"),label]));
    c.append(el("div",null,`<div style="color:#8696a5;font-size:11px;margin-top:6px">캠을 켜면 오버레이에 빈 프레임이 생깁니다. OBS에서 실제 웹캠/캡처 소스를 그 위치에 겹쳐 배치하세요.</div>`));
    return c;
  }

  /* ---------------------------- KEYBOARD ---------------------------- */
  function onKey(e){
    const tag=(e.target.tagName||"").toLowerCase();
    if(tag==="input"||tag==="select"||tag==="textarea") return;  // don't hijack typing
    const k=e.key.toLowerCase();
    const map={ "q":()=>roundWin("A"), "p":()=>roundWin("B"), "s":swapSides,
      " ":toggleTimer, "x":()=>{toggleSpike();syncSpikeBtn();}, "r":()=>setTimer(100), "b":()=>setTimer(30) };
    if(map[k]){ e.preventDefault(); map[k](); }
  }
  function syncSpikeBtn(){ $$(".qrow button").forEach(b=>{ if(b.textContent.includes("스파이크")) b.classList.toggle("red",STATE.match.spike); }); }

  /* ---------------------------- BUILD ---------------------------- */
  function build(){
    const root=$("#root");root.innerHTML="";
    root.append(quickCard(),uiCard(),matchCard(),camCard(),teamCard("A"),teamCard("B"),playersCard());
    syncTimerUI();
  }

  function markConn(ok){const c=$("#conn");c.className="conn "+(ok?"ok":"off");c.textContent=ok?"● 연결됨":"● 연결 안 됨 (server.js 실행 필요)";}
  function init(){
    fetch("/state").then(r=>r.json()).then(s=>{STATE=Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)),s);if(!STATE.ui)STATE.ui={showRails:true};build();markConn(true);})
      .catch(()=>{build();markConn(false);});
  }
  try{const es=new EventSource("/events");es.onopen=()=>markConn(true);es.onerror=()=>markConn(false);}catch(e){}
  document.addEventListener("keydown",onKey);
  init();
})();
