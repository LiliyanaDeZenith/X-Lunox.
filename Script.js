const $=s=>document.querySelector(s);
let ME=null, USERS={}, FOLLOWING=[], FEED=[], pendingMedia=null;

function bufToB64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)))}
function hex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}

async function genKeys(){
  const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pub=await crypto.subtle.exportKey('jwk',kp.publicKey);
  const priv=await crypto.subtle.exportKey('jwk',kp.privateKey);
  return {pub:{kty:'EC',crv:'P-256',x:pub.x,y:pub.y},priv};
}
async function importPriv(priv){
  return crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:priv.x,y:priv.y,d:priv.d}, {name:'ECDSA',namedCurve:'P-256'}, false, ['sign']);
}
async function signPayload(priv, payload){
  const key=await importPriv(priv);
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'}, key, new TextEncoder().encode(payload));
  return bufToB64(sig);
}
function getPriv(){return JSON.parse(localStorage.getItem('lx_priv'))}

async function apiPost(p, obj, isUpload=false, fileBuf=null, fileType=null){
  const handle=localStorage.getItem('lx_h');
  const priv=getPriv();
  let t=Date.now(), s;
  if(isUpload){
    const hash=hex(await crypto.subtle.digest('SHA-256', fileBuf));
    const payload=`upload|${t}|${hash}|${fileType}`;
    s=await signPayload(priv, payload);
    const res=await fetch('/api/upload',{method:'POST',headers:{'X-H':handle,'X-T':t,'X-S':s,'Content-Type':fileType},body:fileBuf});
    return res.json();
  }else{
    const raw=JSON.stringify(obj);
    s=await signPayload(priv, `${p}|${t}|${raw}`);
    const res=await fetch('/api/'+p,{method:'POST',headers:{'Content-Type':'application/json','X-H':handle,'X-T':t,'X-S':s},body:raw});
    return res.json();
  }
}

function renderPost(p){
  const u=USERS[p.a]||{name:p.a};
  const liked=p.l.includes(ME);
  const div=document.createElement('div');div.className='post';div.dataset.id=p.id;
  div.innerHTML=`
    <img src="${u.av?'/media/'+u.av.f:'https://i.pravatar.cc/100?u='+p.a}" class="avatar">
    <div style="flex:1">
      <div class="post-head"><b>${u.name}</b><span>@${p.a} · ${new Date(p.t).toLocaleString()}</span>
      ${p.a===ME?'<span style="margin-left:auto;cursor:pointer" class="del">⋯</span>':''}</div>
      <p>${p.x||''}</p>
      ${p.m?`<img src="/media/${p.m.f}" class="post-media">`:''}
      <div class="post-actions">
        <span class="reply"><i class="fa-regular fa-comment"></i> ${p.r.length}</span>
        <span class="like" style="color:${liked?'var(--pink)':''}"><i class="${liked?'fa-solid':'fa-regular'} fa-heart"></i> ${p.l.length}</span>
        <span class="share"><i class="fa-solid fa-share"></i></span>
      </div>
    </div>`;
  div.querySelector('.like').onclick=async()=>{
    const res=await apiPost('like',{id:p.id});
    if(res.post) updatePost(res.post);
  };
  div.querySelector('.reply').onclick=async()=>{
    const x=prompt('Reply:');if(!x)return;
    const res=await apiPost('post',{x,re:p.id});
    if(res.post) loadFeed();
  };
  const del=div.querySelector('.del');
  if(del) del.onclick=async()=>{if(confirm('Hapus?')) await apiPost('delete',{id:p.id})};
  return div;
}
function updatePost(newPost){
  const el=document.querySelector(`.post[data-id="${newPost.id}"]`);
  if(el){const fresh=renderPost(newPost);el.replaceWith(fresh);}
  else loadFeed();
}
async function loadFeed(){
  const res=await fetch('/api/feed');FEED=await res.json();
  const list=$('#feedList');list.innerHTML='';
  FEED.forEach(p=>list.appendChild(renderPost(p)));
}
async function loadUsers(){
  const res=await fetch('/api/users');const arr=await res.json();
  USERS={};arr.forEach(u=>USERS[u.handle]=u);
  renderWho();
}
function renderWho(){
  const w=$('#whoList');w.innerHTML='';
  Object.values(USERS).filter(u=>u.handle!==ME && !FOLLOWING.includes(u.handle)).slice(0,5).forEach(u=>{
    const d=document.createElement('div');d.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
    d.innerHTML=`<div><b>${u.name}</b><div style="color:#71767b">@${u.handle}</div></div>`;
    const b=document.createElement('button');b.className='btn-primary';b.textContent='Follow';
    b.onclick=async()=>{await apiPost('follow',{to:u.handle,on:true});FOLLOWING.push(u.handle);renderWho();};
    d.appendChild(b);w.appendChild(d);
  });
}
async function loadGraph(){
  const res=await fetch('/api/graph?h='+ME);const g=await res.json();FOLLOWING=g.following;
}
function connectStream(){
  (async()=>{
    const handle=ME, priv=getPriv(), t=Date.now();
    const s=await signPayload(priv,`stream|${t}|`);
    const es=new EventSource(`/api/stream?h=${handle}&t=${t}&s=${encodeURIComponent(s)}`);
    es.addEventListener('upd',e=>{const d=JSON.parse(e.data);if(d.post)updatePost(d.post);if(d.del){document.querySelector(`.post[data-id="${d.del}"]`)?.remove()}});
    es.addEventListener('user',e=>loadUsers());
    es.addEventListener('notif',()=>{const b=$('#notifCount');b.textContent=+b.textContent+1;b.classList.remove('hidden')});
    es.addEventListener('global',e=>console.log('global',JSON.parse(e.data)));
  })();
}
async function askAI(msg){
  const chat=$('#aiChat');const panel=$('#aiPanelChat');
  [chat,panel].forEach(c=>{if(c){c.insertAdjacentHTML('beforeend',`<div class="me-msg">${msg}</div>`)}});
  const res=await apiPost('nexus',{message:msg});
  const reply=res.reply||res.text||JSON.stringify(res);
  [chat,panel].forEach(c=>{if(c){c.insertAdjacentHTML('beforeend',`<div class="ai-msg">${reply}</div>`);c.scrollTop=c.scrollHeight}});
}

document.addEventListener('DOMContentLoaded',async()=>{
  ME=localStorage.getItem('lx_h');
  if(!ME){$('#registerModal').classList.remove('hidden');}
  else{initApp();}

  $('#btnRegister').onclick=async()=>{
    const handle=$('#regHandle').value.trim().toLowerCase();
    const name=$('#regName').value.trim()||handle;
    if(!/^[a-z0-9_]{3,15}$/.test(handle))return alert('Handle 3-15, a-z0-9_');
    const {pub,priv}=await genKeys();
    const raw=JSON.stringify({handle,name,pub,spub:pub});
    const t=Date.now();
    const s=await signPayload(priv,`register|${t}|${raw}`);
    const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json','X-H':handle,'X-T':t,'X-S':s},body:raw});
    const j=await res.json();
    if(j.ok){localStorage.setItem('lx_h',handle);localStorage.setItem('lx_priv',JSON.stringify(priv));localStorage.setItem('lx_pub',JSON.stringify(pub));$('#registerModal').classList.add('hidden');ME=handle;initApp();}
    else alert(j.error);
  };

  $('#btnPost').onclick=async()=>{
    const x=$('#compText').value.trim();
    let m=null;
    if(pendingMedia){
      const up=await apiPost('upload',null,true,pendingMedia.buf,pendingMedia.type);
      if(up.id) m={f:up.id};
    }
    if(!x && !m) return;
    await apiPost('post',{x,m});
    $('#compText').value='';pendingMedia=null;$('#fileName').textContent='';
    loadFeed();
  };
  $('#compFile').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=async()=>{pendingMedia={buf:r.result,type:f.type};$('#fileName').textContent=f.name};r.readAsArrayBuffer(f);
  };
  $('#aiSend').onclick=()=>{const v=$('#aiText').value.trim();if(v){askAI(v);$('#aiText').value=''}};
  $('#aiPanelSend').onclick=()=>{const v=$('#aiPanelText').value.trim();if(v){askAI(v);$('#aiPanelText').value=''}};
  $('#navAI').onclick=()=>$('#aiPanel').classList.toggle('hidden');
  $('#aiClose').onclick=()=>$('#aiPanel').classList.add('hidden');
  $('#navNotif').onclick=()=>{$('#notifCount').textContent=0;$('#notifCount').classList.add('hidden')};
  $('#searchInput').oninput=e=>{
    const q=e.target.value.toLowerCase();
    Object.values(USERS).forEach(u=>{});
    renderWho();
  };
});

async function initApp(){
  await loadUsers();await loadGraph();await loadFeed();connectStream();
  const u=USERS[ME];
  $('#meBox').innerHTML=`<img src="${u?.av?'/media/'+u.av.f:'https://i.pravatar.cc/100?u='+ME}" class="avatar"><div><b>${u?.name||ME}</b><div style="color:#71767b">@${ME}</div></div>`;
  $('#compAv').src=u?.av?'/media/'+u.av.f:'https://i.pravatar.cc/100?u='+ME;
                                        }
