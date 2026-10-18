// My Liliyana server. Jalankan: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,F=path.join(__dirname,'data.json'),UP=path.join(__dirname,'uploads');
const NEXUS_URL="https://nexus-sealyn-ai-deve-m9l5.bolt.host/";
fs.mkdirSync(UP,{recursive:true});
let D={users:{},follow:{},q:{},g:[],posts:[],m:{}};
try{D={...D,...JSON.parse(fs.readFileSync(F,'utf8'))}}catch{}
for(const h in D.users)if(!D.users[h].spub)delete D.users[h];
let st;const save=()=>{clearTimeout(st);st=setTimeout(()=>fs.writeFile(F,JSON.stringify(D),()=>{}),300)};
process.on('SIGINT',()=>{fs.writeFileSync(F,JSON.stringify(D));process.exit()});
const conns={},rid=()=>crypto.randomBytes(12).toString('hex');
const push=(r,ev,d)=>r.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);
const all=(ev,d)=>Object.values(conns).flat().forEach(r=>push(r,ev,d));
const to=(h,ev,d)=>{const c=conns[h]||[];if(c.length)c.forEach(r=>push(r,ev,d));else{const q=D.q[h]=D.q[h]||[];q.push({ev,d});if(q.length>500)q.shift();save()}};
const find=(a,id)=>{for(const p of a){if(p.id===id)return p;const f=find(p.r,id);if(f)return f}};
const parentOf=(a,n)=>{for(const x of a){if(x.r.includes(n))return x;const y=parentOf(x.r,n);if(y)return y}};
const root=id=>D.posts.find(p=>p.id===id||find(p.r,id));
const mutual=(a,b)=>(D.follow[a]||[]).includes(b)&&(D.follow[b]||[]).includes(a);
const pubU=u=>({handle:u.handle,name:u.name,bio:u.bio||'',av:u.av||null,bn:u.bn||null,pub:u.pub});
const okJ=j=>j&&j.kty==='EC'&&j.crv==='P-256'&&typeof j.x==='string'&&typeof j.y==='string'&&j.x.length<100&&j.y.length<100;
const pickJ=j=>({kty:'EC',crv:'P-256',x:j.x,y:j.y});
const hits={};const rl=(k,n,ms)=>{const t=Date.now(),a=(hits[k]||[]).filter(x=>t-x<ms);a.push(t);hits[k]=a;return a.length<=n};
setInterval(()=>{const n=Date.now();for(const k in hits)if(!hits[k].some(x=>n-x<36e5))delete hits[k]},6e5);
const seen=new Map();
function verify(t,s,payload,jwk){try{t=+t;if(!(Math.abs(Date.now()-t)<3e5)||!s||seen.has(s))return false;const ok=crypto.verify('sha256',Buffer.from(payload),{key:crypto.createPublicKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64'));if(ok){seen.set(s,t);if(seen.size>5000)for(const[k,v]of seen)if(Date.now()-v>6e5)seen.delete(k)}return ok}catch{return false}}
const authAs=(h,t,s,p,raw)=>{const u=D.users[h];return u&&u.spub&&verify(t,s,`${p}|${t}|${raw}`,u.spub)?u:null};
const MIME=/^(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm|quicktime|ogg|x-m4v)|application\/octet-stream)$/;
const isMed=(f,h)=>f&&D.m[f]&&D.m[f].o===h&&/^(image|video)\//.test(D.m[f].t);
const medObj=(m,h)=>m&&isMed(m.f,h)?{t:D.m[m.f].t.startsWith('video')?'video':'image',f:m.f}:null;
const readBody=(req,max)=>new Promise((ok,no)=>{const c=[];let n=0;req.on('data',d=>{n+=d.length;if(n>max){no(new Error('big'));req.destroy()}else c.push(d)});req.on('end',()=>ok(Buffer.concat(c)));req.on('error',no)});
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://x'),P=u.pathname,ip=req.socket.remoteAddress;
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-H,X-T,X-S');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method==='OPTIONS')return res.end();
 const json=(o,c=200)=>{res.statusCode=c;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o))};
 if(P.startsWith('/media/')){const id=P.slice(7),meta=/^[a-f0-9]{24}$/.test(id)&&D.m[id];if(!meta)return json({error:'404'},404);
  const fp=path.join(UP,id),sz=fs.statSync(fp).size,r=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');
  res.setHeader('Content-Type',meta.t);res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','public,max-age=31536000,immutable');
  if(r){const a=r[1]===''?Math.max(0,sz-+r[2]):+r[1],b=r[1]===''||r[2]===''?sz-1:Math.min(+r[2],sz-1);if(a>b){res.statusCode=416;return res.end()}res.writeHead(206,{'Content-Range':`bytes ${a}-${b}/${sz}`,'Content-Length':b-a+1});return fs.createReadStream(fp,{start:a,end:b}).pipe(res)}
  res.setHeader('Content-Length',sz);return fs.createReadStream(fp).pipe(res)}
 if(P.startsWith('/api/')){const p=P.slice(5),q=u.searchParams;
  if(req.method==='GET'){
   if(p==='time')return json({t:Date.now()});
   if(p==='users')return json(Object.values(D.users).map(pubU));
   if(p==='graph'){const h=q.get('h');return json({following:D.follow[h]||[],followers:Object.keys(D.follow).filter(k=>(D.follow[k]||[]).includes(h))})}
   if(p==='feed'){const id=q.get('id'),by=q.get('by');if(id){const r=root(id);return json(r?[r]:[])}let l=D.posts;if(by){const s=new Set(by.split(',').slice(0,500));l=l.filter(x=>s.has(x.a))}return json(l.slice(-100).reverse())}
   if(p==='stream'){const h=q.get('h');if(!authAs(h,q.get('t'),q.get('s'),'stream',''))return json({error:'auth'},401);
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive','X-Accel-Buffering':'no'});
    (conns[h]=conns[h]||[]).push(res);push(res,'hist',D.g);const qu=D.q[h]||[];D.q[h]=[];qu.forEach(m=>push(res,m.ev,m.d));save();
    const k=setInterval(()=>res.write(':\n\n'),25000);return req.on('close',()=>{clearInterval(k);conns[h]=(conns[h]||[]).filter(x=>x!==res)})}
   return json({error:'404'},404)}
  if(req.method!=='POST')return json({error:'405'},405);
  const h=req.headers['x-h'],ts=req.headers['x-t'],sg=req.headers['x-s'];
  if(!rl('ip'+ip,300,6e4))return json({error:'rate'},429);
  if(p==='upload'){const us=D.users[h];if(!us||!us.spub||!rl('up'+h,20,6e4)||+req.headers['content-length']>40e6)return json({error:'auth'},401);
   const buf=await readBody(req,40e6),mt=req.headers['content-type']||'';
   if(!MIME.test(mt)||!verify(ts,sg,`upload|${ts}|${crypto.createHash('sha256').update(buf).digest('hex')}|${mt}`,us.spub))return json({error:'auth'},401);
   const id=rid();await fs.promises.writeFile(path.join(UP,id),buf);D.m[id]={t:mt,o:h};save();return json({id})}
  const raw=(await readBody(req,2e5)).toString();let b;try{b=JSON.parse(raw||'{}')}catch{return json({error:'bad'},400)}
  if(p==='register'){const hh=b.handle;if(!/^[a-z0-9_]{3,15}$/.test(hh||'')||/^(__proto__|constructor|prototype)$/.test(hh)||hh!==h||!okJ(b.spub)||!okJ(b.pub)||!rl('reg'+ip,30,36e5))return json({error:'invalid'},400);
   if(!verify(ts,sg,`register|${ts}|${raw}`,pickJ(b.spub)))return json({error:'auth'},401);
   const old=D.users[hh];if(old&&(old.spub.x!==b.spub.x||old.spub.y!==b.spub.y))return json({error:'taken'},409);
   const nu=old||(D.users[hh]={handle:hh,name:String(b.name||hh).trim().slice(0,30)||hh,bio:''});nu.pub=pickJ(b.pub);nu.spub=pickJ(b.spub);save();if(!old)all('user',pubU(nu));return json({ok:1,u:pubU(nu)})}
  const us=authAs(h,ts,sg,p,raw);if(!us)return json({error:'auth'},401);
  if(!rl('w'+h,60,6e4))return json({error:'rate'},429);
  if(p==='profile'){if(typeof b.name==='string'&&b.name.trim())us.name=b.name.trim().slice(0,30);if(typeof b.bio==='string')us.bio=b.bio.slice(0,160);
   if(b.av&&isMed(b.av.f,h)&&/^image\//.test(D.m[b.av.f].t))us.av={f:b.av.f};if(b.bn&&isMed(b.bn.f,h))us.bn=medObj(b.bn,h);
   save();all('user',pubU(us));return json({u:pubU(us)})}
  if(p==='post'){const x=String(b.x||'').trim().slice(0,500),m=medObj(b.m,h);if(!x&&!m)return json({error:'empty'},400);
   const o={id:rid(),a:h,x,m,t:Date.now(),l:[],r:[]};
   if(b.re){const par=find(D.posts,b.re);if(!par)return json({error:'404'},404);par.r.push(o);if(par.a!==h)to(par.a,'notif',{ty:'reply',from:h,p:root(b.re).id})}
   else{D.posts.push(o);if(D.posts.length>2000)D.posts.shift()}
   save();const r=root(o.id);all('upd',{post:r});return json({post:r})}
  if(p==='like'){const n=find(D.posts,b.id);if(!n)return json({error:'404'},404);const i=n.l.indexOf(h);if(i<0){n.l.push(h);if(n.a!==h)to(n.a,'notif',{ty:'like',from:h,p:root(b.id).id})}else n.l.splice(i,1);save();const r=root(b.id);all('upd',{post:r});return json({post:r})}
  if(p==='delete'){const n=find(D.posts,b.id);if(!n||n.a!==h)return json({error:'403'},403);const r=root(b.id);
   if(r.id===b.id){D.posts=D.posts.filter(x=>x!==r);all('upd',{del:b.id})}else{const par=parentOf(D.posts,n);par.r.splice(par.r.indexOf(n),1);all('upd',{post:r})}save();return json({ok:1})}
  if(p==='follow'){const t=b.to;if(!D.users[t]||t===h)return json({error:'404'},404);const l=D.follow[h]=D.follow[h]||[],i=l.indexOf(t);if(b.on&&i<0)l.push(t);if(!b.on&&i>=0)l.splice(i,1);save();to(t,'follow',{from:h,on:!!b.on});return json({ok:1})}
  if(p==='send'){if(!D.users[b.to]||!mutual(h,b.to))return json({error:'403'},403);if(typeof b.iv!=='string'||typeof b.ct!=='string'||b.ct.length>20000)return json({error:'bad'},400);to(b.to,'msg',{from:h,iv:b.iv,ct:b.ct,t:Date.now()});return json({ok:1})}
  if(p==='global'){const text=String(b.text||'').slice(0,1000),m=medObj(b.m,h);if(!text.trim()&&!m)return json({error:'empty'},400);const o={from:h,name:us.name,text,m,t:Date.now()};D.g.push(o);D.g=D.g.slice(-50);save();all('global',o);return json({ok:1})}
  if(p==='deact'){delete D.users[h];delete D.follow[h];for(const k in D.follow)D.follow[k]=D.follow[k].filter(x=>x!==h);D.posts=D.posts.filter(x=>x.a!==h);delete D.q[h];save();all('user',{handle:h,gone:1});return json({ok:1})}
  if(p==='nexus'){
   const msg=String(b.message||b.text||'').slice(0,2000);
   if(!msg.trim())return json({error:'empty'},400);
   try{
    const r=await fetch(NEXUS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    const j=await r.json().catch(()=>({reply:r.statusText}));
    return json(j);
   }catch(e){return json({reply:'Nexus offline'},500);}
  }
  return json({error:'404'},404)}
 const n=P==='/'?'index.html':P.slice(1);
 if(!['index.html','style.css','app.js'].includes(n)){res.statusCode=404;return res.end('404')}
 res.setHeader('Content-Type',{'.html':'text/html;charset=utf-8','.css':'text/css','.js':'text/javascript'}[path.extname(n)]);
 res.end(fs.readFileSync(path.join(__dirname,n)));
}catch(e){if(!res.headersSent){res.statusCode=400;res.end('{"error":"bad"}')}}}).listen(PORT,()=>console.log('My Liliyana jalan di http://localhost:'+PORT));
