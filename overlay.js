/* Renders match state into the overlay DOM and stays in sync via SSE (/events).
   Used as the OBS browser source. */

(function(){
  let STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));

  // ---- helpers ----
  const $ = (sel,root=document)=>root.querySelector(sel);
  const el = (tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n;};
  const fmtTime = s=>{s=Math.max(0,Math.round(s));return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;};
  const initials = name=>name.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"–";

  // ---- ult orbs ----
  function ultPips(p){
    const wrap = el("div","ult"+(p.ultCur>=p.ultMax?" ready":""));
    for(let i=0;i<p.ultMax;i++){
      const pip=el("div","pip"+(i<p.ultCur?" full":""));
      wrap.appendChild(pip);
    }
    return wrap;
  }

  function abilityRow(p){
    const wrap=el("div","abilities");
    [["C",p.abilities.c],["Q",p.abilities.q],["E",p.abilities.e]].forEach(([k,on])=>{
      wrap.appendChild(el("div","ab"+(on?" on":""),k));
    });
    return wrap;
  }

  function shieldRow(n){
    const wrap=el("div","shield");
    for(let i=0;i<2;i++) wrap.appendChild(el("div","s"+(i<n?" on":"")));
    return wrap;
  }

  function playerCard(p,sideColor){
    const card=el("div","pcard"+(p.alive?"":" dead"));
    card.style.setProperty("--side",sideColor);

    const agent=el("div","agent");
    if(p.agent) agent.appendChild(el("span",null,initials(p.agent)));
    card.appendChild(agent);

    const body=el("div","pbody");
    const r1=el("div","prow1");
    r1.appendChild(el("div","pname",p.name));
    r1.appendChild(ultPips(p));
    body.appendChild(r1);

    const r2=el("div","prow2");
    const wpn=el("div","weapon");
    wpn.appendChild(el("span","wico","▮"));
    wpn.appendChild(el("span",null,p.weapon));
    r2.appendChild(wpn);
    const right=el("div","abilities-wrap");right.style.display="flex";right.style.gap="8px";right.style.alignItems="center";
    right.appendChild(abilityRow(p));
    right.appendChild(el("div","credits",String(p.credits)));
    r2.appendChild(right);
    body.appendChild(r2);

    const r3=el("div","prow3");
    const hp=el("div","hpbar");const fill=el("i");fill.style.width=p.hp+"%";hp.appendChild(fill);
    r3.appendChild(hp);
    r3.appendChild(shieldRow(p.shield));
    body.appendChild(r3);

    card.appendChild(body);
    return card;
  }

  // ---- main render ----
  function render(){
    const s=STATE;
    const stage=$("#stage");
    stage.innerHTML="";

    // expose team colors
    document.documentElement.style.setProperty("--team-a",s.teams.A.color);
    document.documentElement.style.setProperty("--team-b",s.teams.B.color);

    // attacking side coloring for the side tags
    const aSide = s.match.attackingSide==="A" ? "atk":"def";
    const bSide = s.match.attackingSide==="B" ? "atk":"def";

    // ===== scorebar =====
    const bar=el("div","scorebar");

    const teamBlock=(t,k)=>{
      const b=el("div","team "+(k==="A"?"left":"right"));
      const wrap=el("div","logowrap");
      const logo=el("div","logo");
      if(t.logo) logo.appendChild(Object.assign(new Image(),{src:t.logo}));
      else logo.textContent=t.tricode.slice(0,3);
      wrap.appendChild(logo);

      const need=mapsToWin(s.match.bestOf);
      if(need>1){                       // series score only matters for Bo3/Bo5
        const mp=el("div","mappips");
        for(let i=0;i<need;i++){
          const d=el("div","mp"+(i<(t.mapsWon||0)?" won":""));
          if(i<(t.mapsWon||0)){d.style.background=t.color;d.style.borderColor=t.color;d.style.color=t.color;}
          mp.appendChild(d);
        }
        wrap.appendChild(mp);
      }

      const meta=el("div","meta");
      meta.appendChild(el("div","tricode",t.tricode));
      meta.appendChild(el("div","team-name",t.name));
      b.appendChild(wrap);b.appendChild(meta);
      return b;
    };

    const sideTag=(mode,active)=>{
      const t=el("div","side-tag "+mode);
      t.appendChild(el("div","ico",mode==="atk"?"⚔":"🛡"));
      t.appendChild(document.createTextNode(mode==="atk"?"ATK":"DEF"));
      return t;
    };

    const center=el("div","center");
    center.appendChild(el("div","phase-tag",s.match.phase));
    const danger = !s.match.spike && s.match.timer<=10 && s.match.phase!=="POST";
    const t=el("div","timer"+(s.match.spike?" spike":(danger?" danger":"")));
    t.textContent = s.match.spike ? fmtTime(s.match.timer) : fmtTime(s.match.timer);
    center.appendChild(t);
    const rl=el("div","round-line");
    rl.appendChild(el("span",null,"RND "+s.match.round));
    rl.appendChild(el("span","map",s.match.map));
    center.appendChild(rl);

    bar.appendChild(teamBlock(s.teams.A,"A"));
    bar.appendChild(el("div","score a",String(s.teams.A.score)));
    bar.appendChild(sideTag(aSide));
    bar.appendChild(center);
    bar.appendChild(sideTag(bSide));
    bar.appendChild(el("div","score b",String(s.teams.B.score)));
    bar.appendChild(teamBlock(s.teams.B,"B"));
    stage.appendChild(bar);

    // ===== player rails (optional — can be hidden for solo operation) =====
    if(!s.ui || s.ui.showRails!==false){
      const railA=el("div","rail left");
      s.players.A.forEach(p=>railA.appendChild(playerCard(p,s.teams.A.color)));
      stage.appendChild(railA);

      const railB=el("div","rail right");
      s.players.B.forEach(p=>railB.appendChild(playerCard(p,s.teams.B.color)));
      stage.appendChild(railB);
    }

    // ===== cam slot =====
    const cam=el("div","camslot"+(s.cam.on?" on":""));
    cam.style.setProperty("--side-cam", s.cam.team==="A"?s.teams.A.color:s.teams.B.color);
    if(s.cam.team==="B"){cam.style.left="auto";cam.style.right="28px";
      cam.style.clipPath="polygon(0 0,100% 0,calc(100% - 18px) 100%,0 100%)";}
    cam.appendChild(el("div","camfill","WEBCAM SOURCE"));
    cam.appendChild(el("div","camlabel",s.cam.label||"CAM"));
    stage.appendChild(cam);
  }

  // ---- state merge ----
  function deepMerge(target,patch){
    for(const k in patch){
      if(patch[k]&&typeof patch[k]==="object"&&!Array.isArray(patch[k])){
        target[k]=target[k]||{};deepMerge(target[k],patch[k]);
      } else target[k]=patch[k];
    }
    return target;
  }

  // ---- live connection (SSE) ----
  function connect(){
    try{
      const es=new EventSource("/events");
      es.onmessage=e=>{
        try{const msg=JSON.parse(e.data);
          if(msg.type==="full") STATE=msg.state;
          else if(msg.type==="patch") deepMerge(STATE,msg.patch);
          render();
        }catch(err){console.error(err);}
      };
      es.onerror=()=>{ /* auto-reconnect by EventSource */ };
    }catch(err){ /* no server (standalone) -> just render defaults */ }
  }

  // query param preview backdrop
  if(new URLSearchParams(location.search).get("bg")==="1") document.body.classList.add("show-bg");

  window.__setState = st=>{STATE=st;render();};  // used by standalone demo
  window.__getState = ()=>STATE;

  render();
  if(location.protocol!=="file:") connect();
})();
