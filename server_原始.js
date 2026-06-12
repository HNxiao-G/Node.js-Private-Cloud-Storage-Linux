#!/usr/bin/env node
const http=require('http'),fs=require('fs'),path=require('path'),url=require('url'),crypto=require('crypto');
const PORT=8080,ROOT=process.env.CLOUD_ROOT||'/media/hn/64dcc80a-24ff-4c2a-9c8a-a4168130a266/clouddrive',ADMIN='zh208522';
const USERS={zh208522:(process.env.CLOUD_PASS||'123456'),wcz:'12345678',wq:'12345678',cgh:'12345678',lzx:'12345678',xsr:'12345678',lyz:'12345678',bb:'12345678'};
const SESS={},TTL=864e5;
setInterval(()=>{let n=Date.now();for(let k in SESS)if(n-SESS[k].t>TTL)delete SESS[k]},9e4);

function mime(e){let m={'jpg':'image/jpeg','png':'image/png','gif':'image/gif','webp':'image/webp','mp4':'video/mp4','mp3':'audio/mpeg','pdf':'application/pdf','txt':'text/plain','zip':'application/zip'}[e];return m||'application/octet-stream'}
function F(s){if(!s)return'0B';let u=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(s)/Math.log(1024));return(s/Math.pow(1024,i)).toFixed(i?1:0)+u[i]}
function I(n,d){if(d)return'📁';let e=path.extname(n).toLowerCase(),m={'jpg':'🖼️','png':'🖼️','gif':'🖼️','mp4':'🎬','mp3':'🎵','pdf':'📄','txt':'📝','zip':'📦','js':'⚡','py':'🐍','html':'🌐','css':'🎨'};return m[e]||'📄'}
function rootFor(u){return u===ADMIN?ROOT:path.join(ROOT,u)}
function sp(p,u){let r=path.normalize('/'+(p||'/')).replace(/^(\.\.(\/|$))+/g,'/');if(r==='/公共文件夹'||r.startsWith('/公共文件夹/')){let sub=r==='/公共文件夹'?'':r.slice(6);return path.join(ROOT,'公共文件夹',sub)}if(!r.startsWith('/'))r='/'+r;let b=rootFor(u||ADMIN),a=path.join(b,r);if(!a.startsWith(b))return null;if(!fs.existsSync(b))fs.mkdirSync(b,{recursive:true});return a}
function sr(p){let r=path.normalize('/'+(p||'/')).replace(/^(\.\.(\/|$))+/g,'/');if(!r.startsWith('/'))r='/'+r;return r}

function auth(req){let c=(req.headers.cookie||'').split(';').map(s=>s.trim());for(let s of c){if(s.startsWith('session=')){let t=s.slice(8);if(SESS[t]){SESS[t].t=Date.now();return SESS[t].u}}}return null}

// Streaming multipart parser — writes file data directly to disk, no memory buffering
const TMPDIR=process.env.TMPDIR||'/tmp';
function parseMultipart(req,cb){
  let ct=req.headers['content-type']||'',m=ct.match(/boundary=([^;]+)/);if(!m)return cb(Error('no boundary'));
  let b=m[1],buf=Buffer.alloc(0),state=0,parts=[],cur=null;
  let BS=Buffer.from('--'+b),BP=Buffer.from('\r\n--'+b),BE=Buffer.from('\r\n--'+b+'--'),HE=Buffer.from('\r\n\r\n');
  let BUFSIZE=65536; // 64KB buffer limit — triggers flush beyond this
  function flushCur(){
    // Close temp file for current file part and record path
    if(cur&&cur.fd!=null){try{fs.closeSync(cur.fd)}catch(e){};cur.fd=null}
    if(cur&&cur.tmpPath)cur.tmpWritten=true;
  }
  function step(){
    for(let i=0;i<500&&state!==3;i++){
      if(state===0){let j=buf.indexOf(BS);if(j<0)break;buf=buf.subarray(j+BS.length);
        if(buf[0]===13&&buf[1]===10)buf=buf.subarray(2);state=1}
      if(state===1){let j=buf.indexOf(HE);if(j<0)break;let h=buf.subarray(0,j).toString();buf=buf.subarray(j+4);
        let cd=h.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/);
        let fn=cd?cd[2]||'':'';
        cur={name:cd?cd[1]:'',filename:fn,chunks:[],fd:null,tmpPath:null,tmpWritten:false};parts.push(cur);
        // If it's a file, open a temp file for streaming writes
        if(fn){cur.tmpPath=path.join(TMPDIR,'cloud_'+Date.now()+'_'+Math.random().toString(36).slice(2)+'.tmp');
          try{cur.fd=fs.openSync(cur.tmpPath,'w')}catch(e){cur.fd=null}}state=2}
      if(state===2){let j=buf.indexOf(BP),k=buf.indexOf(BE),e=-1,f=false;
        if(k>=0){e=k;f=true}else if(j>=0){e=j}
        if(e<0){
          // No boundary found — flush to disk if file, or keep small buffer for fields
          if(cur&&cur.fd!=null){try{fs.writeSync(cur.fd,buf)}catch(e){};buf=Buffer.alloc(0)}
          else if(cur&&cur.chunks){cur.chunks.push(Buffer.from(buf));buf=Buffer.alloc(0)}
          else{buf=Buffer.alloc(0)}
          break}
        // Write data before boundary
        if(e>0&&cur){
          if(cur.fd!=null)try{fs.writeSync(cur.fd,buf.subarray(0,e))}catch(e){}
          else if(cur.chunks)cur.chunks.push(Buffer.from(buf.subarray(0,e)))}
        buf=buf.subarray(e);if(f){flushCur();state=3;break}
        if(buf.length>=BP.length&&buf.subarray(0,BP.length).equals(BP))buf=buf.subarray(BP.length);
        if(buf[0]===13&&buf[1]===10)buf=buf.subarray(2);
        flushCur();state=1}
    }
    // Limit buffer growth — trim consumed data
    if(buf.length>BUFSIZE*4)buf=buf.subarray(buf.length-BUFSIZE)
  }
  req.on('data',c=>{buf=Buffer.concat([buf,c]);step()});
  req.on('end',()=>{
    if(state===2&&cur&&buf.length>0){if(cur.fd!=null){try{fs.writeSync(cur.fd,buf)}catch(e){}}else if(cur.chunks)cur.chunks.push(Buffer.from(buf))}
    buf=Buffer.alloc(0);flushCur();
    // For file parts: read temp file; for field parts: concat chunks
    for(let p of parts){
      if(p.tmpPath&&p.tmpWritten){p.data=fs.readFileSync(p.tmpPath);p.chunks=null;try{fs.unlinkSync(p.tmpPath)}catch(e){}}
      else if(p.chunks&&p.chunks.length>0){p.data=Buffer.concat(p.chunks);p.chunks=null}
      else if(p.chunks)p.data=Buffer.alloc(0)}
    cb(null,parts)});
  req.on('error',e=>{flushCur();for(let p of parts)if(p.tmpPath)try{fs.unlinkSync(p.tmpPath)}catch(e2){};cb(e)})
}

function dirSize(dir){let s=0;try{let e=require('fs').readdirSync(dir,{withFileTypes:true});for(let d of e){let p=require('path').join(dir,d.name);if(d.isDirectory())s+=dirSize(p);else try{s+=require('fs').statSync(p).size}catch(e){}}}catch(e){}return s}
function listDir(abs,rel,sort,order){
  let e=fs.readdirSync(abs,{withFileTypes:true});
  let f=e.map(d=>{let n=d.name,a=path.join(abs,n),D=d.isDirectory(),sz=0,mt='';
    try{let s=fs.statSync(a);sz=s.size;mt=s.mtime.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){}
    return{name:n,isDir:D,size:D?'-':F(sz),mtime:mt,ico:I(n,D),mime:D?'':mime(path.extname(n).toLowerCase().slice(1)),sSize:sz,sTime:(()=>{try{return fs.statSync(a).mtimeMs}catch(e){return 0}})()}});
  f.sort((a,b)=>{if(a.isDir!==b.isDir)return a.isDir?-1:1;let c=0;if(sort==='size')c=a.sSize-b.sSize;else if(sort==='time')c=a.sTime-b.sTime;else c=a.name.localeCompare(b.name,'zh');return order==='desc'?-c:c});
  return{files:f,path:rel}
}

// HTML PAGE — all JS uses '+x+' string concat, NO template literals in script
function loginPage(err){return'<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;justify-content:center;align-items:center}.card{background:rgba(255,255,255,.95);padding:40px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);width:340px;animation:fIn .4s}@keyframes fIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}h1{font-size:22px;margin-bottom:4px;color:#1a1a2e;text-align:center}.sub{color:#888;font-size:13px;text-align:center;margin-bottom:24px}label{display:block;font-size:13px;color:#555;margin-bottom:4px}input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:10px;font-size:15px;margin-bottom:14px;outline:none}input:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.15)}button{width:100%;padding:11px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:10px;font-size:15px;cursor:pointer}button:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(102,126,234,.35)}.err{color:#e63946;font-size:13px;text-align:center;margin-top:12px}</style></head><body><div class="card"><h1>☁️ 私有云盘</h1><p class="sub">输入账号密码登录</p><form method="post" action="/login"><label>用户名</label><input name="user" autofocus><label>密码</label><input type="password" name="password"><button type="submit">登 录</button><div class="err">'+(err||'')+'</div></form></div></body></html>'}

// Main page — all browser JS uses string concatenation to avoid \${} escaping issues
function mainPage(uname,rel,files,sort,order,users){
  let ulist=users||[];
  let utotal=ROOT,ufree='-',uused='-',uperc=0,utotals='-';
  try{let s=fs.statfsSync(ROOT);let t=s.bsize*s.blocks;ufree=F(s.bsize*s.bfree);uused=F(t-s.bsize*s.bfree);utotals=F(t);uperc=Math.round((1-s.bfree/s.blocks)*100)}catch(e){}
  let uhtml=ulist.map(function(u){
    let sz='-';try{sz=F(dirSize(rootFor(u)))}catch(e){}
    return'<div class="us-item'+(u===uname?' cur':'')+'"><span>👤</span><span>'+u+'</span><span style="margin-left:auto;font-size:10px;color:var(--c3)">'+sz+'</span></div>';
  }).join('')
  let t=rel==='/'?'首页':path.basename(rel);
  let b=rel.split('/').filter(Boolean);
  let bcHtml=[];
  for(let i=0;i<b.length;i++){let fp='/'+b.slice(0,i+1).join('/');bcHtml.push('<span class="sep">›</span><a href="/?path='+encodeURIComponent(fp)+'">'+b[i]+'</a>')}
  bcHtml=bcHtml.join('');
  let fJSON=JSON.stringify(files);
  
  let rows='';
  files.forEach(f=>{
    let fp=rel==='/'?'/'+f.name:rel+'/'+f.name;
    let lk=f.isDir?'/?path='+encodeURIComponent(fp):'/dl?path='+encodeURIComponent(fp);
    let pv=!f.isDir&&f.mime&&f.mime.startsWith('image/')?' onclick="preview(\''+encodeURIComponent(fp)+'\',\''+f.name+'\')"':'';
    rows+='<tr class="row" data-n="'+f.name+'"><td><input type="checkbox" class="cb" onchange="ts(\''+f.name+'\',this)"></td><td><span class="fi">'+f.ico+'</span><a href="'+lk+'"'+pv+' class="lk" data-t="'+(f.isDir?'dir':'file')+'" data-p="'+fp+'">'+f.name+'</a></td><td class="sz">'+f.size+'</td><td class="tm">'+(f.mtime||'')+'</td><td class="ac"><button onclick="rn(\''+f.name+'\')" title="重命名">✏️</button><button onclick="dl(\''+f.name+'\','+f.isDir+')" title="删除">🗑️</button></td></tr>'
  });
  if(!rows)rows='<tr><td colspan="6" class="no"><div style="font-size:48px;opacity:.3">📂</div>暂无文件</td></tr>';
  
  let sa=k=>{if(sort!==k)return'↕';return order==='asc'?'↑':'↓'};
  let sc1=sort==='name'?' ac':'',sc2=sort==='size'?' ac':'',sc3=sort==='time'?' ac':'';
  
  return'<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+t+' - 云盘</title><style>*{margin:0;padding:0;box-sizing:border-box}:root{--bg:#f0f4f8;--c:#1a1a2e;--c2:#555;--c3:#999;--pri:#4361ee;--brd:#e2e8f0;--r:8px}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--c)}a{color:var(--pri);text-decoration:none}button{cursor:pointer;font-family:inherit}input{outline:none}.hd{background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);color:#fff;padding:0 20px;display:flex;align-items:center;gap:12px;height:52px;position:sticky;top:0;z-index:100}.hd h1{font-size:16px}.hd .sp{flex:1}.hd .lo{color:rgba(255,255,255,.5);font-size:13px}.mn{max-width:1100px;margin:0 auto;padding:16px;margin-left:200px}.tb{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;position:relative;z-index:1}.tb .bc{flex:1;min-width:0;font-size:14px}.tb .bc a{color:var(--c2)}.tb .bc .sep{color:#ccc;font-size:12px;margin:0 2px}.up{background:#fff;border-radius:var(--r);padding:14px;margin-bottom:12px;border:2px dashed var(--brd);box-shadow:0 1px 3px rgba(0,0,0,.04);position:relative;z-index:1}.up .ur{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.up input[type=file]{flex:1;min-width:180px;font-size:13px}.bar{display:none;align-items:center;gap:10px;padding:8px 14px;background:var(--pri);color:#fff;border-radius:var(--r);margin-bottom:10px;font-size:13px;position:relative;z-index:10}.bar.show{display:flex}.bar .sp{flex:1}.bar button{background:rgba(255,255,255,.15);border:none;color:#fff;padding:4px 12px;border-radius:4px;font-size:12px}.fp{display:flex;gap:6px;margin-bottom:10px;align-items:center;position:relative;z-index:1}.fp input{padding:6px 10px;border:1px solid var(--brd);border-radius:4px;font-size:13px;width:160px}.fp button{padding:6px 12px;background:#fff;border:1px solid var(--brd);border-radius:4px;font-size:13px;color:var(--c2)}.tbl{background:#fff;border-radius:var(--r);box-shadow:0 1px 3px rgba(0,0,0,.04);overflow:auto}table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:9px 14px;text-align:left;font-size:12px;color:var(--c3);font-weight:600;position:relative;border-bottom:2px solid var(--brd)}th.sb{cursor:pointer}th.sb:hover{color:var(--pri)}th .ar{font-size:10px;opacity:.4}th.sb:hover .ar,th .ar.ac{opacity:1}td{padding:8px 14px;border-top:1px solid #f0f0f0;font-size:14px}.row:hover{background:#f8f9ff}.cb{width:15px;height:15px;accent-color:var(--pri)}.fi{font-size:16px;margin-right:6px}.lk{color:var(--c);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;max-width:100%;vertical-align:middle}.lk:hover{color:var(--pri)}.sz{color:var(--c3);font-size:13px}.tm{color:var(--c3);font-size:12px}.ac{white-space:nowrap;text-align:right}.ac button{background:none;border:none;font-size:15px;padding:2px 6px;border-radius:4px;opacity:0}.row:hover .ac button{opacity:1}.ac button:hover{background:#eee}.no{text-align:center;padding:50px;color:var(--c3)}.mk{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);display:none;justify-content:center;align-items:center;z-index:200}.mk.show{display:flex}.mk .mc{background:#fff;border-radius:var(--r);padding:24px;min-width:300px;max-width:90%;box-shadow:0 8px 30px rgba(0,0,0,.15);animation:scIn .2s}.mk h2{font-size:16px;margin-bottom:10px}.mk input{width:100%;padding:8px 12px;border:1px solid var(--brd);border-radius:4px;font-size:14px;margin-bottom:14px}.mk .mb{display:flex;gap:8px;justify-content:flex-end}.mk .mb button{padding:7px 16px;border:none;border-radius:4px;font-size:13px}.mk .mb .bt1{background:var(--pri);color:#fff}.mk .mb .bt2{background:#eee;color:var(--c2)}.lb{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);display:none;justify-content:center;align-items:center;z-index:300}.lb.show{display:flex}.lb img{max-width:90%;max-height:90%;border-radius:6px;animation:scIn .2s}.lb .lc{position:absolute;top:16px;right:20px;color:#fff;font-size:30px;cursor:pointer;opacity:.7;border:none;background:none}.toast{position:fixed;bottom:20px;right:20px;z-index:400;display:flex;flex-direction:column;gap:6px}.toast .t{background:#1a1a2e;color:#fff;padding:10px 16px;border-radius:4px;font-size:13px;animation:tIn .3s}.toast .t.out{animation:tOut .25s forwards}@keyframes tIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}@keyframes tOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(20px)}}@keyframes scIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}.pb{display:none;margin-top:8px}.pb.show{display:block}.pb .pw{background:#e2e8f0;border-radius:10px;height:4px}.pb .pbi{height:100%;width:0;background:linear-gradient(90deg,var(--pri),#7c3aed);border-radius:10px}.pb .ps{font-size:11px;color:var(--c3);margin-top:2px}.sr{display:none;align-items:center;gap:8px;margin-bottom:10px}.sr.show{display:flex}.sr input{flex:1;max-width:300px;padding:7px 12px;border:1px solid var(--brd);border-radius:20px;font-size:13px}.wrap{display:flex;max-width:1300px;margin:0 auto}.sbar{position:fixed;left:0;top:52px;bottom:0;width:190px;min-width:190px;overflow-y:auto;background:#fff;margin:16px 0 16px 16px;border-radius:var(--r);padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.04);height:fit-content;position:sticky;top:68px}.sbar-t{margin-bottom:8px;font-size:10px;text-transform:uppercase;color:#999;letter-spacing:.5px}.sbar .us-item{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:4px;font-size:13px;margin-bottom:2px}.sbar .us-item.cur{background:#eef2ff;font-weight:600;color:var(--pri)}.sbar .us-item .adm{font-size:10px;color:#fff;background:var(--pri);padding:1px 5px;border-radius:3px;margin-left:auto}.sbar-st{margin-top:16px;padding-top:12px;border-top:1px solid var(--brd)}@media(max-width:640px){.mn{padding:8px}td,th{padding:6px 8px}.sz,.ac button{display:none}.row:hover .ac button{display:inline;opacity:1}.wrap{flex-direction:column!important}.sbar{width:100%!important;min-width:0!important;padding:10px!important}}</style></head><body><div class="hd"><h1>☁️ 云盘 v3</h1><span style="color:rgba(255,255,255,.4);font-size:13px">👤 '+uname+'</span><div class="sp"></div><a href="/logout" class="lo">退出</a></div><div class="wrap"><div class="sbar"><div class="sbar-t">👥 用户账号</div><div class="sbar-list">'+uhtml+'<div class="sbar-item pub"><span>\ud83d\udcc2</span><a href="/?path=/\u516c\u5171\u6587\u4ef6\u5939" style="color:var(--c);font-weight:500;text-decoration:none">公共文件夹</a></div></div><div class="sbar-st"><div class="sb-st-t">💾 存储信息</div><div class="sb-st-v" style="font-size:12px;color:var(--c3);line-height:1.8"><div>已用 '+uused+' / '+utotals+'</div><div style="margin-top:2px"><div style="background:var(--brd);border-radius:4px;height:4px"><div style="height:100%;width:'+uperc+'%;background:linear-gradient(90deg,var(--pri),#7c3aed);border-radius:4px"></div></div><span style="font-size:10px">'+uperc+'%</span></div><div style="margin-top:4px;font-size:10px">可用 '+ufree+'</div></div></div></div><div class="mn" id="app" data-p="'+rel+'" data-s="'+sort+'" data-o="'+order+'"><div class="sr" id="sr"><input placeholder="搜索 (/)..." oninput="fs(this.value)"><button style="background:#fff;border:1px solid var(--brd);border-radius:4px;padding:5px 10px;font-size:12px;color:var(--c2)" onclick="cs()">取消</button></div><div class="tb"><div class="bc" id="bc"><a href="/">☁️ 根目录</a>'+bcHtml+'<span class="cur" style="color:var(--c)">'+(rel==='/'?'首页':path.basename(rel))+'</span></div><button onclick="os()" style="background:none;border:none;font-size:16px;cursor:pointer">🔍</button></div><div class="bar" id="bar"><span>已选 <span id="bcnt">0</span> 项</span><div class="sp"></div><button onclick="clr()">取消</button><button onclick="bdl()">批量删除</button></div><div class="up" id="uz"><div class="ur"><input type="file" multiple onchange="upl(this)"><button onclick="this.parentElement.querySelector(\'input\').click()" style="padding:6px 16px;background:var(--pri);color:#fff;border:none;border-radius:4px;font-size:13px">📤 上传</button><span style="color:var(--c3);font-size:12px">或拖拽文件</span></div><div class="pb" id="pb"><div class="pw"><div class="pbi" id="pbr"></div></div><div class="ps" id="pbs"></div></div></div><div class="fp"><input placeholder="新建文件夹" onkeydown="if(event.key===\'Enter\')mkd(this)"><button onclick="mkd(this.parentElement.querySelector(\'input\'))">📁 创建</button></div><div class="tbl"><table><thead><tr><th style="width:30px"><input type="checkbox" onchange="sa(this.checked)"></th><th class="sb" onclick="so(\'name\')">名称 <span class="ar'+sc1+'">'+sa('name')+'</span></th><th class="sb" onclick="so(\'size\')" style="width:80px">大小 <span class="ar'+sc2+'">'+sa('size')+'</span></th><th class="sb" onclick="so(\'time\')" style="width:120px">日期 <span class="ar'+sc3+'">'+sa('time')+'</span></th><th style="width:70px">操作</th></tr></thead>'+rows+'</table></div></div></div><div class="mk" id="mk"><div class="mc" id="mkc"></div></div><div class="lb" id="lb" onclick="clb()"><button class="lc" onclick="clb()">×</button><img id="lbi"></div><div class="toast" id="toast"></div><script>'+
'var path='+JSON.stringify(rel)+',sort='+JSON.stringify(sort)+',order='+JSON.stringify(order)+',sel={};'+
'function tm(m){var c=document.getElementById("toast"),t=document.createElement("div");t.className="t";t.textContent=m;c.appendChild(t);setTimeout(function(){t.classList.add("out");setTimeout(function(){t.remove()},300)},2500)}'+
'function os(){document.getElementById("sr").classList.add("show");var i=document.getElementById("sr").querySelector("input");i.focus();i.value=""}'+
'function cs(){document.getElementById("sr").classList.remove("show");fs("")}'+
'function fs(q){var ql=(q||"").toLowerCase();document.querySelectorAll(".row").forEach(function(r){r.style.display=(!ql||(r.getAttribute("data-n")||"").toLowerCase().includes(ql))?"":"none"})}'+
'function sa(v){sel={};if(v)document.querySelectorAll(".row").forEach(function(r){if(r.style.display!=="none")sel[r.getAttribute("data-n")]=1});ub()}'+
'function ts(n,c){if(c.checked)sel[n]=1;else delete sel[n];ub()}'+
'function ub(){var b=document.getElementById("bar"),k=Object.keys(sel);document.getElementById("bcnt").textContent=k.length;b.classList.toggle("show",k.length>0)}'+
'function clr(){sel={};document.querySelectorAll(".cb").forEach(function(c){c.checked=false});ub()}'+
'function bdl(){var k=Object.keys(sel);if(!k.length)return;mod("<h2>确认删除</h2><p>删除选中的"+k.length+"项？</p><div class=\'mb\'><button class=\'bt2\' onclick=\'clm()\'>取消</button><button class=\'bt1\' onclick=\'doBdl()\'>删除</button></div>")}'+
'function doBdl(){var k=Object.keys(sel);clm();fetch("/api/bdel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:path,names:k})}).then(function(r){return r.json()}).then(function(d){if(d.ok){tm("已删除 "+d.count+" 项");sel={};ld()}else tm(d.err||"失败")}).catch(function(){tm("失败")})}'+
'function rn(o){mod("<h2>重命名</h2><input id=\'rni\' value=\'"+o+"\'><div class=\'mb\'><button class=\'bt2\' onclick=\'clm()\'>取消</button><button class=\'bt1\' onclick=\'doRn(\"+JSON.stringify(o)+\")\'>确定</button></div>");setTimeout(function(){var e=document.getElementById("rni");if(e)e.select()},50)}'+
'function doRn(o){var n=document.getElementById("rni").value.trim();if(!n||n===o){clm();return}clm();fetch("/api/rename",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:path,old:o,new:n})}).then(function(r){return r.json()}).then(function(d){if(d.ok){tm("已重命名");ld()}else tm(d.err||"失败")}).catch(function(){tm("失败")})}'+
'function dl(n,D){mod("<h2>确认删除</h2><p>删除"+(D?"文件夹":"文件")+" "+n+"？</p><div class=\'mb\'><button class=\'bt2\' onclick=\'clm()\'>取消</button><button class=\'bt1\' onclick=\'doDl(\"+JSON.stringify(n)+\")\'>删除</button></div>")}'+
'function doDl(n){clm();fetch("/api/del",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:path+"/"+n})}).then(function(r){return r.json()}).then(function(d){if(d.ok){tm("已删除");ld()}else tm(d.err||"失败")}).catch(function(){tm("失败")})}'+
'function mkd(i){var n=i.value.trim();if(!n)return;fetch("/api/mkdir",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:path,name:n})}).then(function(r){return r.json()}).then(function(d){if(d.ok){i.value="";tm("已创建");ld()}else tm(d.err||"失败")})}'+
'function so(k){if(sort===k)order=order==="asc"?"desc":"asc";else{sort=k;order="asc"}ld()}'+
'function ld(){fetch("/api/ls?path="+encodeURIComponent(path)+"&sort="+sort+"&order="+order).then(function(r){return r.json()}).then(function(d){if(!d.ok)return tm(d.err);'+
  'var h="";d.files.forEach(function(f){var fp=d.path==="/"?"/"+f.name:d.path+"/"+f.name;var lk=f.isDir?"/?path="+encodeURIComponent(fp):"/dl?path="+encodeURIComponent(fp);var pv=!f.isDir&&f.mime&&f.mime.startsWith("image/")?" onclick=\\"preview(\'"+encodeURIComponent(fp)+"\',\'"+f.name+"\')\\"" :"";'+
  'h+="<tr class=\\\"row\\\" data-n=\\\""+f.name+"\\\"><td><input type=\\\"checkbox\\\" class=\\\"cb\\\" onchange=\\\"ts(\'"+f.name+"\',this)\\\" "+(sel[f.name]?"checked":"")+"></td><td><span class=\\\"fi\\\">"+f.ico+"</span><a href=\\\""+lk+"\\\""+pv+" class=\\\"lk\\\" data-t=\\\""+(f.isDir?"dir":"file")+"\\\" data-p=\\\""+fp+"\\\">"+f.name+"</a></td><td class=\\\"sz\\\">"+f.size+"</td><td class=\\\"tm\\\">"+(f.mtime||"")+"</td><td class=\\\"ac\\\"><button onclick=\\\"rn(\'"+f.name+"\')\\\">✏️</button><button onclick=\\\"dl(\'"+f.name+"\',"+f.isDir+")\\\">🗑️</button></td></tr>"});'+
  'if(!h)h="<tr><td colspan=\\"6\\" class=\\"no\\"><div style=\\"font-size:48px;opacity:.3;margin-bottom:8px\\">📂</div>暂无文件</td></tr>";'+
  'document.querySelector(".tbl table").innerHTML="<thead><tr><th style=\\"width:30px\\"><input type=\\"checkbox\\" onchange=\\"sa(this.checked)\\"></th><th class=\\"sb\\" onclick=\\"so(\'name\')\\">名称 <span class=\\"ar"+(sort==="name"?" ac":"")+"\\">"+("'+(sort==='name'?(order==='asc'?'↑':'↓'):'↕')+'")+"</span></th><th class=\\"sb\\" onclick=\\"so(\'size\')\\">大小 <span class=\\"ar"+(sort==="size"?" ac":"")+"\\">"+("'+(sort==='size'?(order==='asc'?'↑':'↓'):'↕')+'")+"</span></th><th class=\\"sb\\" onclick=\\"so(\'time\')\\">日期 <span class=\\"ar"+(sort==="time"?" ac":"")+"\\">"+("'+(sort==='time'?(order==='asc'?'↑':'↓'):'↕')+'")+"</span></th><th style=\\"width:70px\\">操作</th></tr></thead>"+h;'+
  'var bc=document.getElementById("bc");var parts=d.path.split("/").filter(Boolean);var bhtml="<a href=\\"/\\">☁️ 根目录</a>";for(var i=0;i<parts.length;i++){var fp="/"+parts.slice(0,i+1).join("/");bhtml+="<span class=\\"sep\\">›</span><a href=\\"#\\" onclick=\\"event.preventDefault();nav(\'"+fp+"\')\\">"+parts[i]+"</a>"}bhtml+="<span class=\\"cur\\" style=\\"color:var(--c)\\">"+(d.path==="/"?"首页":parts[parts.length-1]||"首页")+"</span>";bc.innerHTML=bhtml;'+
  'path=d.path;var sr=document.getElementById("sr").querySelector("input");if(sr)fs(sr.value)})};'+
'function nav(p){path=p;ld()}'+
'function preview(p,n){document.getElementById("lbi").src="/preview?path="+p;document.getElementById("lb").classList.add("show")}'+
'function clb(){document.getElementById("lb").classList.remove("show")}'+
'function mod(h){document.getElementById("mkc").innerHTML=h;document.getElementById("mk").classList.add("show")}'+
'function clm(){document.getElementById("mk").classList.remove("show")}'+
'function upl(i){var f=i.files;if(!f.length)return;var fm=new FormData();fm.set("path",path);for(var j=0;j<f.length;j++)fm.append("files",f[j],f[j].webkitRelativePath||f[j].name);document.getElementById("pb").classList.add("show");var x=new XMLHttpRequest();x.open("POST","/upload");x.upload.onprogress=function(e){if(e.lengthComputable){document.getElementById("pbr").style.width=(e.loaded/e.total*100)+"%";document.getElementById("pbs").textContent="上传中 "+(e.loaded/1e6).toFixed(1)+"/"+(e.total/1e6).toFixed(1)+" MB"}};x.onload=function(){document.getElementById("pb").classList.remove("show");document.getElementById("pbr").style.width="0";var d=JSON.parse(x.responseText);if(d.ok){tm("上传完成 "+d.count+" 个文件");ld()}else tm(d.err||"失败");i.value=""};x.onerror=function(){document.getElementById("pb").classList.remove("show");tm("上传失败");i.value=""};x.send(fm)}'+
'document.getElementById("uz").addEventListener("dragover",function(e){e.preventDefault();e.currentTarget.classList.add("drag")});document.getElementById("uz").addEventListener("dragleave",function(e){e.currentTarget.classList.remove("drag")});document.getElementById("uz").addEventListener("drop",function(e){e.preventDefault();e.currentTarget.classList.remove("drag");var i=e.currentTarget.querySelector("input");if(e.dataTransfer.files.length){i.files=e.dataTransfer.files;upl(i)}});'+
'document.addEventListener("keydown",function(e){if(e.key==="Escape"){clm();clb();cs()}if(e.key==="/"&&["INPUT","TEXTAREA"].indexOf(e.target.tagName)<0){e.preventDefault();os()}});document.getElementById("mk").addEventListener("click",function(e){if(e.target===e.currentTarget)clm()});'+
'</script></body></html>'
}

const server=http.createServer((req,res)=>{
  let pn=url.parse(req.url,true).pathname,q=url.parse(req.url,true).query,uname=auth(req);
    // Basic Auth fallback for WebDAV/non-browser clients
  if(!uname && req.headers['authorization']){
    let m = req.headers['authorization'].match(/Basic\s+(.+)/);
    if(m){
      let dec = Buffer.from(m[1],'base64').toString();
      let [user,pass] = dec.split(':');
      if(USERS[user] && pass === USERS[user]) uname = user;
    }
  }
  if(pn!=='/login'&&!uname){
    if(pn.startsWith('/api/')||pn==='/upload'){res.writeHead(401,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'未登录'}))}
    if(pn.startsWith('/dl')||pn.startsWith('/preview')){res.writeHead(302,{Location:'/login'});return res.end()}
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});return res.end(loginPage())
  }
  try{
  if(pn==='/login'){
    if(req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});return res.end(loginPage())}
    let b='';req.on('data',c=>{b+=c;if(b.length>1e4)req.destroy()});req.on('end',()=>{let p=new URLSearchParams(b),u=p.get('user'),pw=p.get('password');if(USERS[u]&&pw===USERS[u]){let t=crypto.randomBytes(24).toString('hex');SESS[t]={u:u,t:Date.now()};res.writeHead(302,{Location:'/',"Set-Cookie":"session="+t+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+(TTL/1000)});res.end()}else{res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(loginPage('用户名或密码错误'))}});return
  }
  if(pn==='/logout'){let c=(req.headers.cookie||'').split(';').map(s=>s.trim());for(let s of c)if(s.startsWith('session=')){delete SESS[s.slice(8)];break};res.writeHead(302,{Location:'/login'});return res.end()}

  // ── WebDAV support (for Windows network drive mapping) ──
  if (pn.startsWith('/dav/') || pn === '/dav') {
    let davPath = pn === '/dav' ? '/' : pn.slice(4); // /dav/path → /path
    let abs = sp(decodeURIComponent(davPath), uname);
    if (!abs) { res.writeHead(400); return res.end() }
    
    // Ensure parent dir exists for PUT/MKCOL
    let parentDir = path.dirname(abs);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    
    if (req.method === 'PROPFIND') {
      // Directory listing in XML format
      let depth = req.headers['depth'] || '1';
      let result = '<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">';
      try {
        if (!fs.existsSync(abs)) { res.writeHead(404); return res.end() }
        let stat = fs.statSync(abs);
        let href = encodeURI('/dav' + davPath);
        result += '<D:response><D:href>' + href + '</D:href><D:propstat><D:prop>';
        if (stat.isDirectory()) {
          result += '<D:resourcetype><D:collection/></D:resourcetype>';
          result += '</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>';
          if (depth !== '0') {
            let entries = fs.readdirSync(abs, { withFileTypes: true });
            for (let e of entries) {
              let ep = encodeURI('/dav' + (davPath === '/' ? '' : davPath) + '/' + e.name);
              let es = fs.statSync(path.join(abs, e.name));
              result += '<D:response><D:href>' + ep + '</D:href><D:propstat><D:prop>';
              if (e.isDirectory()) result += '<D:resourcetype><D:collection/></D:resourcetype>';
              result += '<D:getcontentlength>' + (es.size || 0) + '</D:getcontentlength>';
              result += '<D:getlastmodified>' + es.mtime.toUTCString() + '</D:getlastmodified>';
              result += '</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>';
            }
          }
        } else {
          result += '<D:resourcetype></D:resourcetype>';
          result += '<D:getcontentlength>' + stat.size + '</D:getcontentlength>';
          result += '<D:getlastmodified>' + stat.mtime.toUTCString() + '</D:getlastmodified>';
          result += '</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>';
        }
      } catch(e) {}
      result += '</D:multistatus>';
      res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
      return res.end(result);
    }
    
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end() }
      let stat = fs.statSync(abs);
      let headers = {
        'Content-Type': mime(path.extname(abs).toLowerCase().slice(1)),
        'Content-Length': stat.size,
        'Last-Modified': stat.mtime.toUTCString(),
        'Cache-Control': 'no-cache'
      };
      if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end() }
      res.writeHead(200, headers);
      return fs.createReadStream(abs).pipe(res);
    }
    
    if (req.method === 'PUT') {
      // Stream large file uploads directly to disk
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      let tmpPath = abs + '.tmp_' + Date.now();
      let fd = fs.openSync(tmpPath, 'w');
      let bytes = 0;
      req.on('data', c => {
        try { bytes += fs.writeSync(fd, c); } catch(e) {}
      });
      req.on('end', () => {
        try { fs.closeSync(fd); } catch(e) {}
        try { fs.renameSync(tmpPath, abs); } catch(e) {
          // If rename fails (e.g. cross-device), copy
          fs.copyFileSync(tmpPath, abs);
          fs.unlinkSync(tmpPath);
        }
        res.writeHead(201);
        res.end();
      });
      req.on('error', () => {
        try { fs.closeSync(fd); } catch(e) {}
        try { fs.unlinkSync(tmpPath); } catch(e) {}
      });
      return;
    }
    
    if (req.method === 'DELETE') {
      if (!fs.existsSync(abs)) { res.writeHead(404); return res.end() }
      let s = fs.statSync(abs);
      if (s.isDirectory()) fs.rmSync(abs, { recursive: true });
      else fs.unlinkSync(abs);
      res.writeHead(204);
      return res.end();
    }
    
    if (req.method === 'MKCOL') {
      if (fs.existsSync(abs)) { res.writeHead(405); return res.end() }
      fs.mkdirSync(abs, { recursive: true });
      res.writeHead(201);
      return res.end();
    }
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Allow': 'OPTIONS,PROPFIND,GET,HEAD,PUT,DELETE,MKCOL',
        'DAV': '1,2',
        'MS-Author-Via': 'DAV'
      });
      return res.end();
    }
    
    res.writeHead(405);
    return res.end();
  }

    if(pn==='/api/ls'){let r=sr(q.path||'/'),a=sp(r,uname);if(!a||!fs.existsSync(a)){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'不存在'}))}let d=listDir(a,r,q.sort||'name',q.order||'asc');res.writeHead(200,{'Content-Type':'application/json'});if(r==='/'&&uname!=='zh208522')d.files.unshift({name:'公共文件夹',isDir:true,size:'-',mtime:'',ico:'📂',mime:'',sSize:0,sTime:0});return res.end(JSON.stringify({ok:true,...d}))}
  if(pn==='/api/rename'){let b='';req.on('data',c=>{b+=c});req.on('end',()=>{try{let o=JSON.parse(b),a=sp(o.path||'/',uname);if(!a){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'无效路径'}))}let old=path.join(a,path.basename(o.old||'')),nw=path.join(a,path.basename(o.new||''));if(!old.startsWith(rootFor(uname))){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'越权'}))}if(!fs.existsSync(old)){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'不存在'}))}if(fs.existsSync(nw)){res.writeHead(409,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'已存在'}))}fs.renameSync(old,nw);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}))}catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({err:e.message}))}});return}
  if(pn==='/api/mkdir'){let b='';req.on('data',c=>{b+=c});req.on('end',()=>{try{let o=JSON.parse(b),a=sp(o.path||'/',uname);if(!a){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'无效路径'}))}let nd=path.join(a,path.basename(o.name||''));if(!nd.startsWith(rootFor(uname))){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'越权'}))}if(fs.existsSync(nd)){res.writeHead(409,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'已存在'}))}fs.mkdirSync(nd,{recursive:true});res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}))}catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({err:e.message}))}});return}
  if(pn==='/api/del'){let b='';req.on('data',c=>{b+=c});req.on('end',()=>{try{let o=JSON.parse(b),a=sp(o.path,uname);if(!a||!fs.existsSync(a)){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'不存在'}))}let s=fs.statSync(a);if(s.isDirectory())fs.rmSync(a,{recursive:true});else fs.unlinkSync(a);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}))}catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({err:e.message}))}});return}
  if(pn==='/api/bdel'){let b='';req.on('data',c=>{b+=c});req.on('end',()=>{try{let o=JSON.parse(b),a=sp(o.path||'/',uname);if(!a){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'无效路径'}))}let cnt=0;for(let n of o.names||[]){let f=path.join(a,path.basename(n));if(f.startsWith(rootFor(uname))&&fs.existsSync(f)){try{let s=fs.statSync(f);if(s.isDirectory())fs.rmSync(f,{recursive:true});else fs.unlinkSync(f);cnt++}catch(e){}}}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,count:cnt}))}catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({err:e.message}))}});return}
  if(pn==='/upload'&&req.method==='POST'){parseMultipart(req,(err,parts)=>{if(err){res.writeHead(500,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:err.message}))}let base='/';for(let p of parts)if(p.name==='path'&&p.data)base=p.data.toString().trim()||'/';let safe=sp(base,uname);if(!safe){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({err:'无效路径'}))}let cnt=0;for(let p of parts){if(p.name==='files'&&p.filename&&p.data&&p.data.length>0){let d=path.dirname(p.filename),n=path.basename(p.filename),destD=safe;if(d&&d!=='.'){destD=path.join(safe,d);if(!fs.existsSync(destD))fs.mkdirSync(destD,{recursive:true})}let dest=path.join(destD,n);if(dest.startsWith(rootFor(uname))){fs.writeFileSync(dest,p.data);cnt++}}}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,count:cnt,path:base}))});return}
  if(pn==='/preview'){let r=sr(q.path||'/'),a=sp(r,uname);if(!a||!fs.existsSync(a)){res.writeHead(404);return res.end()}let s=fs.statSync(a);if(s.isDirectory()){res.writeHead(302,{Location:'/?path='+encodeURIComponent(r)});return res.end()}res.writeHead(200,{'Content-Type':mime(path.extname(a).toLowerCase().slice(1)),'Cache-Control':'private,max-age=3600','Content-Length':s.size});return fs.createReadStream(a).pipe(res)}
  if(pn==='/dl'){let r=sr(q.path||'/'),a=sp(r,uname);if(!a||!fs.existsSync(a)){res.writeHead(404);return res.end()}let s=fs.statSync(a);if(s.isDirectory()){res.writeHead(302,{Location:'/?path='+encodeURIComponent(r)});return res.end()}res.writeHead(200,{'Content-Type':mime(path.extname(a).toLowerCase().slice(1)),'Content-Disposition':'attachment; filename="'+encodeURIComponent(path.basename(a))+'"','Content-Length':s.size,'Cache-Control':'private,max-age=3600'});return fs.createReadStream(a).pipe(res)}
  if(pn==='/'||pn===''){
    let r=sr(q.path||'/'),a=sp(r,uname);if(!a){res.writeHead(400,{'Content-Type':'text/html;charset=utf-8'});return res.end('<h1>无效路径</h1>')}if(!fs.existsSync(a)){res.writeHead(404,{'Content-Type':'text/html;charset=utf-8'});return res.end('<h1>不存在</h1>')}
    let sk=q.sort||'name',so=q.order||'asc',d=listDir(a,r,sk,so);
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});return res.end(mainPage(uname,r,d.files,sk,so,Object.keys(USERS)))
  }
  res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({err:'Not Found'}))
  }catch(e){console.error(e);try{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({err:'Server Error'}))}catch(e2){}}
});
server.timeout=0;server.headersTimeout=0;server.requestTimeout=0;
server.listen(PORT,'0.0.0.0',()=>{console.log('☁️ 云盘 v3 已启动,端口:'+PORT+',管理员:'+ADMIN+',账号:'+Object.keys(USERS).join(','))})
