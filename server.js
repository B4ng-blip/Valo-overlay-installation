/* VALORANT overlay relay server — pure Node, no dependencies.
   Run as 'node server.js' OR as the packaged ValorantOverlay.exe.       */

const http = require("http");
const fs   = require("fs");
const path = require("path");
const { exec } = require("child_process");

const IS_APP = !!process.pkg;            // true when running as the bundled .exe
const PORT = process.env.PORT || 8080;
const PUBLIC = path.join(__dirname, "public");

// --- startup sanity check (skipped in the packaged app: assets are embedded) ---
if (!IS_APP){
  const NEEDED = ["overlay.html","control.html","control.js","overlay.js","shared.js","overlay.css"];
  const missing = NEEDED.filter(f => !fs.existsSync(path.join(PUBLIC, f)));
  if (missing.length){
    console.error("\n  ✗ [실행 위치 오류] public 폴더에서 다음 파일을 찾지 못했습니다:");
    console.error("    " + missing.join(", "));
    console.error("  → 압축을 푼 'valorant-overlay' 폴더(= server.js 가 있는 폴더) 안에서 실행하세요.");
    console.error("    현재 위치: " + __dirname + "\n");
    process.exit(1);
  }
}

// open a URL in the default browser (Windows / macOS / Linux)
function openBrowser(url){
  const cmd = process.platform==="win32" ? `start "" "${url}"`
            : process.platform==="darwin" ? `open "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd, ()=>{});
}

// authoritative state lives here; control panel overwrites it, overlays read it
let DEFAULT_STATE;
try { DEFAULT_STATE = require("./public/shared.js").DEFAULT_STATE; }
catch(e){ console.error("\n  ✗ shared.js 를 불러오지 못했습니다:", e.message, "\n"); process.exit(1); }
let STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));

const clients = new Set(); // SSE connections (overlays + panels)

const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",
              ".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"};

function broadcast(obj){
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for(const res of clients){ try{ res.write(data); }catch(e){ clients.delete(res); } }
}

function serveFile(res, file){
  fs.readFile(file,(err,buf)=>{
    if(err){ res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"application/octet-stream"});
    res.end(buf);
  });
}

const server = http.createServer((req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // ---- SSE stream ----
  if(p==="/events"){
    res.writeHead(200,{
      "Content-Type":"text/event-stream","Cache-Control":"no-cache",
      "Connection":"keep-alive","Access-Control-Allow-Origin":"*"});
    res.write(`data: ${JSON.stringify({type:"full",state:STATE})}\n\n`);
    clients.add(res);
    const ka=setInterval(()=>{try{res.write(": keep-alive\n\n");}catch(e){}},20000);
    req.on("close",()=>{clearInterval(ka);clients.delete(res);});
    return;
  }

  // ---- current state snapshot ----
  if(p==="/state"){
    res.writeHead(200,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"});
    return res.end(JSON.stringify(STATE));
  }

  // ---- receive update from control panel ----
  if(p==="/update" && req.method==="POST"){
    let body="";
    req.on("data",d=>{body+=d; if(body.length>1e6) req.destroy();});
    req.on("end",()=>{
      try{
        const msg=JSON.parse(body);
        if(msg.type==="full" && msg.state) STATE=msg.state;
        broadcast({type:"full",state:STATE});
        res.writeHead(200,{"Content-Type":"application/json"});res.end(`{"ok":true}`);
      }catch(e){res.writeHead(400);res.end(`{"ok":false}`);}
    });
    return;
  }

  // ---- static files ----
  let rel = p==="/" ? "/overlay.html" : p;
  if(p==="/control") rel="/control.html";
  if(p==="/overlay") rel="/overlay.html";
  const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/,""));
  if(!file.startsWith(PUBLIC)){res.writeHead(403);return res.end("Forbidden");}
  serveFile(res,file);
});

server.on("error",err=>{
  if(err.code==="EADDRINUSE"){
    console.error(`\n  ✗ [포트 사용 중] ${PORT} 번 포트를 이미 다른 프로그램이 쓰고 있습니다.`);
    console.error(`  → 이미 켜놓은 서버 창이 있는지 먼저 확인하세요.`);
    console.error(`  → 또는 다른 포트로 실행:`);
    console.error(`      Mac/Linux :  PORT=8090 node server.js`);
    console.error(`      Windows   :  set PORT=8090 && node server.js`);
    console.error(`    (그 경우 URL도 http://localhost:8090/control 으로 바뀝니다)\n`);
  } else {
    console.error("\n  ✗ 서버 오류:", err.message, "\n");
  }
  process.exit(1);
});

server.listen(PORT,()=>{
  const nets=require("os").networkInterfaces();
  let lan="localhost";
  for(const k in nets) for(const n of nets[k]) if(n.family==="IPv4"&&!n.internal) lan=n.address;
  console.log("\n  ┌─ VALORANT Overlay Server ─────────────────────────────");
  console.log("  │  서버 실행 성공! (Node " + process.version + ")");
  console.log("  │");
  console.log(`  │  OBS 브라우저 소스 URL :  http://localhost:${PORT}/overlay`);
  console.log(`  │  컨트롤 패널 (운영자)  :  http://localhost:${PORT}/control`);
  console.log(`  │  다른 기기(폰)에서 조작 :  http://${lan}:${PORT}/control`);
  console.log("  │");
  console.log("  │  ❶ 컨트롤 패널은 잠시 후 자동으로 브라우저에 열립니다.");
  console.log("  │  ❷ OBS: 브라우저 소스 추가 → 위 'OBS 브라우저 소스 URL' 입력");
  console.log("  │     (너비 1920 · 높이 1080 · 배경 자동 투명)");
  console.log("  │");
  console.log("  │  ⚠ 이 검은 창을 닫지 마세요. 닫으면 오버레이가 멈춥니다.");
  console.log("  └───────────────────────────────────────────────────────\n");

  // app feel: pop the control panel open automatically
  if (IS_APP || process.env.OPEN==="1") setTimeout(()=>openBrowser(`http://localhost:${PORT}/control`), 600);
});
