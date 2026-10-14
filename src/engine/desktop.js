/* =========================================================
   ekoo — Desktop web app renderer
   window.DesktopView = { mount(el, opts), unmount(), jump(key) }
   Layout: left rail + header + split list/map. Layers (drawer, modal, popover, toasts) live inside .d-app.
   ========================================================= */
(function(){
"use strict";
const EK=window.EK;
const {ic,t,OPPS,REQS,GROUPS,POSTS,HISTORY,USER,TIPS,CAUSES,S,A,opp,req,filteredOpps,cover,causeTile,mapBase,esc}=EK;

/* ---------- local UI state ---------- */
const D={
  screen:"home",view:"split",rail:false,autoMin:false,narrow:false,
  hot:null,callout:null,map:{z:1,cx:520,cy:335},mapSize:{w:600,h:640},
  drawer:null,modal:null,pop:null,actTab:"up",hf:"all",
  notifRead:false,typing:false,enter:false,lastKey:null
};
const MAPC={cx:520,cy:335};
const mapDefault=()=>S.mode==="help"?{z:1.45,cx:535,cy:390}:{z:1,cx:MAPC.cx,cy:MAPC.cy};
let root=null,timers=[],ros=[],raf=0,lastFocus=null,tileN=0,drag=null;
const isMac=/Mac|iPhone|iPad/i.test((navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||navigator.userAgent);
const reduced=()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}};
const $=(s,r)=>(r||root).querySelector(s);
const $$=(s,r)=>Array.from((r||root).querySelectorAll(s));
const later=(fn,ms)=>{const id=setTimeout(()=>{timers=timers.filter(x=>x!==id);if(root)fn()},ms);timers.push(id);return id};
const tile=(c,size)=>causeTile(c,size,"d"+(tileN++));
const CL={book:"Education",laptop:"Online learning",bowl:"Food",leaf:"Green",elder:"Elders",heart:"Care",paw:"Animals",hand:"Neighbourly help",phone:"Tech help"};
const distLabel=o=>o.dist?o.dist+" km":(o.where==="Online"?"Online":"From home");
const leftOf=o=>o.cap-o.taken;
const plural=(n,a,b)=>n+" "+(n===1?a:b);

/* prototype calendar: today is Wed 14 Oct */
const DAYS=[["Next Sat",["Sat",24]],["Next Sun",["Sun",25]],["This weekend",["Sat",17]],["Today",["Wed",14]],["Tomorrow",["Thu",15]],["Thu",["Thu",15]],["Fri",["Fri",16]],["Sat",["Sat",17]],["Sun",["Sun",18]],["Mon",["Mon",19]],["Tue",["Tue",20]],["Wed",["Wed",21]],["Whenever",["Week",13]]];
function dateOf(label){label=String(label||"");for(const d of DAYS)if(label.indexOf(d[0])===0)return d[1];return ["Week",13]}
const LONGDAY={"Sat":"Saturday 17 Oct","Sun":"Sunday 18 Oct","Next Sat":"Saturday 24 Oct","Next Sun":"Sunday 25 Oct"};
const KIND_CAUSE={"Neighbourhood":"hand","Food":"bowl","Trees and parks":"leaf","Animals":"paw","Education":"book"};

/* ---------- data helpers ---------- */
function filteredReqs(){
  const q=S.query.trim().toLowerCase();
  return REQS.filter(r=>(D.hf==="all"||(D.hf==="today"&&r.today)||(D.hf==="short"&&r.mins<=30)||(D.hf==="online"&&r.x==null))&&(!q||(r.task+" "+r.who+" "+r.note).toLowerCase().includes(q)));
}
function upcoming(){
  const out=[];
  OPPS.forEach(o=>{if(S.joined[o.id]){const d=dateOf(S.joined[o.id]);out.push({k:"opp",id:o.id,d,title:o.title,sub:o.host+" · "+o.where,when:S.joined[o.id],len:o.len,cause:o.cause})}});
  REQS.forEach(r=>{if(S.helping[r.id]){const d=dateOf(r.when);out.push({k:"help",id:r.id,d,title:r.task,sub:"Helping "+r.who+" · "+r.dist,when:r.when,len:r.mins+" min",cause:r.cause})}});
  S.drives.forEach(dr=>{const d=dateOf(dr.when);out.push({k:"drive",id:dr.id,d,title:dr.title,sub:"Your drive · 0 of "+dr.helpers+" joined",when:(LONGDAY[dr.when]||dr.when).split(" ")[0]+", "+dr.slot,len:dr.place,cause:KIND_CAUSE[dr.cause]||"hand"})});
  S.asks.forEach(a=>{const d=dateOf(a.when);out.push({k:"ask",id:a.id,d,title:a.what,sub:"Your request · visible to verified neighbours",when:a.when,len:a.len,cause:"hand"})});
  return out.sort((a,b)=>a.d[1]-b.d[1]);
}
function itemById(id){return opp(id)||req(id)}

/* ---------- brand mark ---------- */
const mark=()=>'<svg class="d-mark" viewBox="0 0 34 24" aria-hidden="true"><circle cx="10" cy="12" r="9" fill="var(--sun)"/><circle cx="24.5" cy="14.5" r="6.5" fill="var(--tide)"/><circle cx="24.5" cy="14.5" r="6.5" fill="none" stroke="var(--surface)" stroke-width="2"/></svg>';

/* ---------- screen key ---------- */
function screenKey(){
  if(!S.onboarded)return "welcome";
  if(D.modal)return {success:"success",drive:"drive",ask:"ask",feedback:"feedback"}[D.modal.kind]||D.screen;
  if(D.drawer)return D.drawer.kind==="opp"?"detail":D.drawer.kind==="req"?"request":"chat";
  if(D.screen==="home")return S.mode==="help"?"help":"home";
  return D.screen;
}
function notify(){const k=screenKey();if(k!==D.lastKey){D.lastKey=k;try{EK.onScreen&&EK.onScreen(k)}catch(e){}}}

/* =========================================================
   RAIL
   ========================================================= */
function renderRail(){
  const nav=[["home","home",t("tHome")],["help","hand",t("help")],["community","users",t("tComm")],["activity","cal",t("tAct")],["me","user",t("tMe")]];
  const active=D.screen==="home"?(S.mode==="help"?"help":"home"):D.screen;
  const up=upcoming().length;
  $(".d-rail").innerHTML=
  '<div class="d-rail-head"><button class="d-brand" data-a="nav" data-k="home" aria-label="ekoo, go to home">'+mark()+'<span class="d-word">ekoo</span></button>'+
  '<button class="d-icbtn d-collapse" data-a="rail" aria-label="'+(railMin()?"Expand":"Collapse")+' sidebar" title="'+(railMin()?"Expand":"Collapse")+' sidebar">'+ic(railMin()?"fwd":"back","sm")+'</button></div>'+
  '<nav class="d-nav" aria-label="Main">'+nav.map(n=>'<button class="d-nav-i'+(active===n[0]?' is-on':'')+'" data-a="nav" data-k="'+n[0]+'"'+(active===n[0]?' aria-current="page"':'')+' title="'+esc(n[2])+'">'+ic(n[1],"md")+'<span class="d-nav-l">'+esc(n[2])+'</span>'+(n[0]==="activity"&&up?'<span class="d-badge num" aria-label="'+up+' upcoming">'+up+'</span>':'')+'</button>').join("")+'</nav>'+
  '<button class="d-create" data-a="pop" data-k="create" aria-haspopup="menu" aria-expanded="'+(D.pop==="create")+'" title="'+esc(t("tCreate"))+'">'+ic("plus","md")+'<span>'+esc(t("tCreate"))+'</span></button>'+
  '<div class="d-grow"></div>'+
  '<div class="d-rail-card"><span class="d-rc-k">This month</span><span class="d-rc-v"><b class="num">'+(S.settings.showHours?USER.hours:"–")+'</b> hours given</span><span class="d-rc-bar" aria-hidden="true"><i style="width:'+Math.min(100,USER.hours/12*100)+'%"></i></span><span class="d-rc-s">3 more to reach your 12-hour goal</span></div>'+
  '<button class="d-user" data-a="nav" data-k="me" aria-label="Simran, your profile"><span class="d-av">'+USER.ini+'</span><span class="d-user-t"><b>'+esc(USER.name)+'</b><small>'+ic("shield","sm")+esc(USER.verified)+'</small></span>'+ic("fwd","sm")+'</button>'+
  '<div class="d-lang" role="group" aria-label="Language"><button data-a="lang" data-k="en" aria-pressed="'+(S.lang==="en")+'">EN</button><button data-a="lang" data-k="hi" aria-pressed="'+(S.lang==="hi")+'" lang="hi">हिन्दी</button></div>';
}
function railMin(){return D.rail||D.autoMin}

/* =========================================================
   HEADER
   ========================================================= */
function renderTop(){
  const unread=!D.notifRead;
  $(".d-top").innerHTML=
  '<label class="d-search">'+ic("search","md")+'<input type="search" class="d-search-in" placeholder="'+esc(t("search"))+'" value="'+esc(S.query)+'" aria-label="Search" autocomplete="off" spellcheck="false"><kbd>'+(isMac?"⌘K":"Ctrl K")+'</kbd></label>'+
  '<button class="d-loc" data-a="loc" title="Change location">'+ic("pin","sm")+'<span>Jayanagar<span class="d-loc-c">, Bengaluru</span></span><em>· 3 km</em></button>'+
  '<div class="d-grow"></div>'+
  '<button class="d-icbtn d-bell'+(unread?' has-dot':'')+'" data-a="pop" data-k="notif" aria-haspopup="dialog" aria-expanded="'+(D.pop==="notif")+'" aria-label="Notifications'+(unread?", 3 new":"")+'">'+ic("bell")+'<i class="d-dot" aria-hidden="true"></i></button>'+
  '<button class="d-icbtn" data-a="theme" aria-label="Switch to '+(EK.isDark&&EK.isDark()?"light":"dark")+' theme" title="Switch theme">'+ic(EK.isDark&&EK.isDark()?"sun":"moon")+'</button>'+
  '<button class="d-av d-av-top" data-a="nav" data-k="me" aria-label="Your profile">'+USER.ini+'</button>';
}

/* =========================================================
   HOME
   ========================================================= */
function heroCopy(){
  const join=S.mode==="join";
  const n=OPPS.length,nr=REQS.length,today=REQS.filter(r=>r.today).length;
  return '<div class="d-hero-copy">'+
   '<p class="d-eyebrow"><span class="d-eb-dot"></span>'+esc(t("hello"))+', '+esc(USER.name)+' · '+esc(t("near"))+'</p>'+
   (join?'<h1 class="d-h1">Find <span class="d-mark-sun">one thing</span> to do this week.</h1><p class="d-lede">'+n+' ways to help within 3 km. Most take under two hours.</p>'
        :'<h1 class="d-h1">A neighbour needs <span class="d-mark-tide">a hand.</span></h1><p class="d-lede">'+nr+' neighbours asked for help within 3 km. '+today+' of them need it today.</p>')+
   '<ul class="d-proof">'+(join?'<li>'+ic("shield","sm")+'Every host verified</li><li>'+ic("star","sm")+'4.8 average rating</li><li>'+ic("clock","sm")+'Starts at 20 minutes</li>'
        :'<li>'+ic("shield","sm")+'Every neighbour verified</li><li>'+ic("lock","sm")+'Address shared after you accept</li><li>'+ic("chat","sm")+'Chat stays in the app</li>')+'</ul>'+
  '</div>';
}
function pathCard(k){
  const on=S.mode===k,join=k==="join";
  const today=REQS.filter(r=>r.today).length;
  return '<button class="d-path d-path-'+k+'" data-a="mode" data-k="'+k+'" aria-pressed="'+on+'">'+
   '<span class="d-path-top"><span class="d-press">'+tile(join?"book":"hand",54)+'</span><span class="d-path-n"><b class="num">'+(join?OPPS.length:REQS.length)+'</b><small>'+(join?"activities":"requests, "+today+" today")+'</small></span></span>'+
   '<span class="d-path-t">'+esc(t(join?"join":"help"))+'</span>'+
   '<span class="d-path-s">'+esc(t(join?"joinSub":"helpSub"))+'. '+(join?"Verified NGOs and resident groups, with a plan for the day.":"Everyday favours from verified people close to home.")+'</span>'+
   '<span class="d-path-go">'+(on?'<span>Showing now</span>'+ic("check","sm"):'<span>Switch to this</span>'+ic("arrowr","sm"))+'</span>'+
  '</button>';
}
function homeHTML(){
  return '<div class="d-page d-home'+(D.enter?' d-enter':'')+'">'+
  '<section class="d-hero" aria-label="Choose how to help"><span class="d-orb d-orb-a" aria-hidden="true"></span><span class="d-orb d-orb-b" aria-hidden="true"></span>'+
   '<div class="d-hero-l">'+heroCopy()+'</div>'+
   '<div class="d-paths" role="group" aria-label="Two ways to help">'+pathCard("join")+pathCard("help")+'</div></section>'+
  '<div class="d-filters" role="toolbar" aria-label="Filters"></div>'+
  '<div class="d-split"></div></div>';
}
function filtersHTML(){
  const view=effView();
  let h="";
  if(S.mode==="join"){
    const fl=[["any","f_any"],["30","f_30"],["2h","f_2h"],["weekend","f_weekend"],["home","f_home"]];
    h+='<div class="d-chips" role="group" aria-label="Time you have">'+fl.map(f=>'<button class="d-chip" data-a="time" data-k="'+f[0]+'" aria-pressed="'+(S.time===f[0])+'">'+(f[0]==="any"?ic("clock","sm"):'')+esc(t(f[1]))+'</button>').join("")+'</div>';
    h+='<span class="d-vsep" aria-hidden="true"></span>';
    h+='<div class="d-chips" role="group" aria-label="Cause">'+CAUSES.map(c=>'<button class="d-chip d-chip-c" data-a="cause" data-k="'+c[0]+'" aria-pressed="'+(S.cause===c[0])+'">'+(c[0]==="all"?'<span class="d-chip-ic">'+ic("sparkle","sm")+'</span>':'<span class="d-press">'+tile(c[0],24)+'</span>')+esc(c[1])+'</button>').join("")+'</div>';
  }else{
    const fl=[["all","All requests"],["today","Today"],["short","30 min or less"],["online","Online"]];
    h+='<div class="d-chips" role="group" aria-label="Filter requests">'+fl.map(f=>'<button class="d-chip d-chip-t" data-a="hf" data-k="'+f[0]+'" aria-pressed="'+(D.hf===f[0])+'">'+(f[0]==="today"?'<i class="d-live" aria-hidden="true"></i>':'')+esc(f[1])+'</button>').join("")+'</div>';
  }
  const n=S.mode==="join"?filteredOpps().length:filteredReqs().length;
  h+='<div class="d-fright"><span class="d-count" aria-live="polite"><b class="num">'+n+'</b> '+(S.mode==="join"?(n===1?"activity":"activities"):(n===1?"request":"requests"))+(S.query.trim()?' for “'+esc(S.query.trim())+'”':'')+'</span>'+
   '<div class="d-seg" role="group" aria-label="Layout">'+[["list","list","List"],["split","sliders","Split"],["map","map","Map"]].filter(v=>!(D.narrow&&v[0]==="split")).map(v=>'<button data-a="view" data-k="'+v[0]+'" aria-pressed="'+(view===v[0])+'">'+ic(v[1],"sm")+'<span>'+v[2]+'</span></button>').join("")+'</div></div>';
  return h;
}
function effView(){return D.narrow&&D.view==="split"?"list":D.view}

function oppCard(o,i){
  const left=leftOf(o),joined=S.joined[o.id],saved=!!S.saved[o.id],pct=Math.round(o.taken/o.cap*100);
  return '<article class="d-card'+(D.hot===o.id?' is-hot':'')+'" data-card="'+o.id+'" style="--i:'+i+'">'+
   '<div class="d-card-art">'+cover(o)+
    (joined?'<span class="d-art-in">'+ic("check","sm")+esc(t("youreIn"))+'</span>':'')+
    '<span class="d-art-when">'+ic("clock","sm")+esc(o.when)+'</span>'+
    '<span class="d-art-left'+(left<=4?' is-low':'')+'"><b class="num">'+left+'</b> left</span></div>'+
   '<button class="d-card-hit" data-a="open" data-k="'+o.id+'" aria-label="'+esc(o.title)+', '+esc(o.len)+', '+esc(distLabel(o))+', '+left+' spots left"></button>'+
   saveBtn(o.id,saved)+
   '<div class="d-card-b">'+
    '<h3 class="d-card-t">'+esc(o.title)+'</h3>'+
    '<div class="d-host">'+ic("shield","sm")+'<span>'+esc(o.host)+'</span></div>'+
    '<div class="d-meta"><span>'+ic("clock","sm")+esc(o.len)+'</span><span>'+ic(o.home?"globe":"pin","sm")+esc(distLabel(o))+'</span><span>'+ic("star","sm")+o.rating+'</span></div>'+
    '<div class="d-spots" title="'+o.taken+' of '+o.cap+' spots taken"><span class="d-spots-bar"><i style="width:'+pct+'%"></i></span><span class="d-spots-l'+(left<=4?' is-low':'')+'">'+(left<=4?'Only '+left+' spots left':left+' of '+o.cap+' spots left')+'</span></div>'+
    '<div class="d-tags">'+o.tags.slice(0,2).map(x=>'<span class="d-tag'+(/covered|provided|sent|training/i.test(x)?' is-ok':'')+'">'+esc(x)+'</span>').join("")+'</div>'+
   '</div></article>';
}
function saveBtn(id,saved){return '<button class="d-save'+(saved?' is-on':'')+'" data-a="save" data-k="'+id+'" aria-pressed="'+saved+'" aria-label="'+(saved?"Saved. Remove from saved":"Save for later")+'">'+ic("heart",saved?"md fill":"md")+'</button>'}

function featHTML(q){
  return '<button class="d-feat" data-a="open" data-k="quick" data-card="quick" style="--i:0">'+
   '<span class="d-feat-c"><span class="d-feat-badge">'+ic("clock","sm")+'20 min, from home</span>'+
   '<span class="d-feat-k">'+esc(t("firstStep"))+'</span>'+
   '<span class="d-feat-t">'+esc(q.title)+'</span>'+
   '<span class="d-feat-p">No travel, no sign-up forms. '+q.taken+' neighbours did it this week.</span>'+
   '<span class="d-feat-go">See details'+ic("arrowr","sm")+'</span></span>'+
   '<span class="d-feat-art" aria-hidden="true">'+cover(q,{glyphX:150,glyphY:80})+'</span></button>';
}
function reqCard(r,i){
  const on=S.helping[r.id];
  return '<article class="d-req'+(r.today?' is-today':'')+(D.hot===r.id?' is-hot':'')+'" data-card="'+r.id+'" style="--i:'+i+'">'+
   '<header class="d-req-h"><span class="d-av d-av-tide'+(r.today?' is-today':'')+'">'+esc(r.ini)+'</span><span class="d-req-who"><b>'+esc(r.who)+'</b><small>'+ic("shield","sm")+esc(r.ver)+'</small></span>'+
   '<span class="d-when-pill'+(r.today?' is-today':'')+'">'+(r.today?'<i class="d-live" aria-hidden="true"></i>':ic("cal","sm"))+esc(r.when)+'</span></header>'+
   '<h3 class="d-req-t">'+esc(r.task)+'</h3>'+
   '<p class="d-req-n">“'+esc(r.note)+'”</p>'+
   '<div class="d-req-f"><div class="d-meta"><span>'+ic("clock","sm")+r.mins+' min</span><span>'+ic(r.x==null?"globe":"pin","sm")+esc(r.dist)+'</span><span>'+ic("users","sm")+plural(r.helped,"helper so far","helpers so far")+'</span></div>'+
   '<div class="d-req-b"><button class="d-btn d-btn-ghost d-btn-sm" data-a="openreq" data-k="'+r.id+'">'+esc(t("details"))+'</button>'+
   (on?'<button class="d-btn d-btn-tide d-btn-sm" data-a="chat" data-k="'+r.id+'">'+ic("chat","sm")+'Open chat</button>':'<button class="d-btn d-btn-tide d-btn-sm" data-a="openreq" data-k="'+r.id+'" data-go="1">'+ic("hand","sm")+esc(t("canHelp"))+'</button>')+
   '</div></div></article>';
}
function listHTML(){
  if(S.mode==="join"){
    const list=filteredOpps();
    if(!list.length)return '<div class="d-empty">'+emptyArt()+'<h3>Nothing matches that yet</h3><p>Try another time or cause, or start a drive and invite your neighbours.</p><div class="d-empty-b"><button class="d-btn d-btn-ghost" data-a="reset">Clear filters</button><button class="d-btn d-btn-ink" data-a="drive">'+esc(t("startDrive"))+'</button></div></div>';
    const q=list.find(o=>o.id==="quick"),feat=q&&!S.joined.quick;
    const rest=list.filter(o=>!(feat&&o.id==="quick"));
    return '<div class="d-grid">'+(feat?featHTML(q):'')+rest.map((o,i)=>oppCard(o,i+1)).join("")+'</div>';
  }
  const rs=filteredReqs();
  let h='<div class="d-actions"><button class="d-action d-action-tide" data-a="drive"><span class="d-press">'+tile("users",48)+'</span><span><b>'+esc(t("startDrive"))+'</b><small>Gather neighbours for a clean-up, feeding or tutoring</small></span>'+ic("arrowr","sm")+'</button>'+
   '<button class="d-action d-action-sun" data-a="ask"><span class="d-press">'+tile("heart",48)+'</span><span><b>'+esc(t("askHelp"))+'</b><small>Two fields. Verified neighbours within 3 km see it</small></span>'+ic("arrowr","sm")+'</button></div>';
  if(S.asks.length)h+=S.asks.slice().reverse().map(a=>'<div class="d-mine"><span class="d-mine-k">Your request</span><b>'+esc(a.what)+'</b><span class="d-mine-s">'+ic("clock","sm")+esc(a.len)+' · '+esc(a.when)+' · Waiting for a neighbour to offer</span></div>').join("");
  h+='<h2 class="d-sec-t">Requests near you <small>Closest first</small></h2>';
  if(!rs.length)h+='<div class="d-empty d-empty-sm"><h3>No requests match</h3><p>Try another filter. New requests show up here as neighbours post them.</p><button class="d-btn d-btn-ghost" data-a="hfall">Show all requests</button></div>';
  h+='<div class="d-reqs">'+rs.map(reqCard).join("")+'</div>';
  return h;
}
function emptyArt(){return '<svg class="d-empty-art" viewBox="0 0 160 100" aria-hidden="true"><circle cx="62" cy="50" r="40" fill="var(--sun)"/><circle cx="112" cy="62" r="26" fill="var(--tide)"/><circle cx="128" cy="24" r="9" fill="var(--mint)"/></svg>'}

/* ---------- map ---------- */
function worldExt(){
  let g='<rect x="-1400" y="-1000" width="3800" height="2640" fill="var(--map-land)"/>';
  for(let x=20-118*12;x<1000+118*12;x+=118)for(let y=20-104*10;y<640+104*10;y+=104){if(x>=20&&x<1000&&y>=20&&y<640)continue;g+='<rect x="'+x+'" y="'+y+'" width="100" height="86" rx="10" fill="var(--map-block)"/>'}
  g+='<g stroke="var(--map-road)" fill="none" stroke-linecap="round">';
  for(let x=128-118*12;x<1000+118*12;x+=118)g+='<path d="M'+x+' -1000V1640" stroke-width="4" opacity=".8"/>';
  for(let y=114-104*10;y<640+104*10;y+=104)g+='<path d="M-1400 '+y+'H2400" stroke-width="4" opacity=".8"/>';
  g+='<path d="M-1400 330H2400M505 -1000V1640" stroke-width="16"/>';
  g+='<path d="M-1400 -6L2400 336M-161 -1000L578 1640M988 -1000L540 1640" stroke-width="10"/></g>';
  return g;
}
function mapItems(){return S.mode==="help"?filteredReqs().filter(r=>r.x!=null):filteredOpps().filter(o=>o.x!=null)}
function pinSVG(it,help,i){
  const today=help&&it.today,fill=help?(today?"var(--coral)":"var(--tide)"):"var(--sun)";
  const inner=help?'<text x="0" y="-24" text-anchor="middle" class="d-pin-ini">'+esc(it.ini)+'</text>':'<g transform="translate(-10 -40) scale(.84)" fill="none" stroke="#141414" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'+EK.P[it.cause]+'</g>';
  const joined=!help&&S.joined[it.id];
  return '<g class="d-pin'+(today?' is-today':'')+(D.callout===it.id?' is-sel':'')+(D.hot===it.id?' is-hot':'')+'" data-pin="'+it.id+'" tabindex="0" role="button" aria-label="'+esc(help?it.who+", "+it.task+", "+it.when:it.title+", "+it.when)+'">'+
   '<ellipse class="d-pin-sh" cx="0" cy="0" rx="9" ry="3.5"/>'+
   '<g class="d-pin-b" style="--i:'+(i||0)+'">'+(today?'<circle class="d-pin-pulse" cx="0" cy="-30" r="19"/><circle class="d-pin-pulse d-p2" cx="0" cy="-30" r="19"/>':'')+
   '<path class="d-pin-shape" d="M0 -2C-5 -9 -19 -15 -19 -30A19 19 0 1 1 19 -30C19 -15 5 -9 0 -2Z" fill="'+fill+'"/>'+inner+
   (joined?'<circle cx="14" cy="-44" r="8" fill="var(--mint-ink)" stroke="var(--surface)" stroke-width="2"/><path d="M10.5 -44l2.5 2.5 4.5-5" stroke="var(--surface)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>':'')+
   '</g></g>';
}
function mapHTML(){
  const help=S.mode==="help",items=mapItems();
  const remote=help?filteredReqs().filter(r=>r.x==null):filteredOpps().filter(o=>o.x==null);
  const today=items.filter(r=>r.today).length;
  return '<div class="d-map" data-mode="'+S.mode+'">'+
   '<svg class="d-map-svg" viewBox="0 0 '+D.mapSize.w+' '+D.mapSize.h+'" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Map of Jayanagar showing '+items.length+(help?' requests':' activities')+' within 3 km">'+
    '<g class="d-map-base">'+worldExt()+mapBase()+'</g>'+
    '<g class="d-pins">'+items.map((it,i)=>pinSVG(it,help,i)).join("")+'</g></svg>'+
   '<div class="d-map-legend">'+(help?'<span><i class="d-lg d-lg-coral"></i>Today <b class="num">'+today+'</b></span><span><i class="d-lg d-lg-tide"></i>Later <b class="num">'+(items.length-today)+'</b></span>':'<span><i class="d-lg d-lg-sun"></i><b class="num">'+items.length+'</b> near you</span><span><i class="d-lg d-lg-me"></i>You</span>')+'</div>'+
   '<div class="d-map-ctl" role="group" aria-label="Map controls"><button data-a="zin" aria-label="Zoom in">'+ic("plus","sm")+'</button><button data-a="zout" aria-label="Zoom out"><svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><button data-a="recenter" aria-label="Recenter on you">'+ic("locate","sm")+'</button></div>'+
   (remote.length?'<div class="d-fromhome"><span class="d-fh-k">'+ic(help?"globe":"home","sm")+(help?"Online":"From home")+' <b class="num">'+remote.length+'</b></span>'+remote.map(r=>'<button class="d-fh-i" data-a="'+(help?"openreq":"open")+'" data-k="'+r.id+'">'+tile(r.cause,30)+'<span><b>'+esc(help?r.task:r.title)+'</b><small>'+esc(help?r.who+" · "+r.mins+" min":r.len+" · "+r.when)+'</small></span></button>').join("")+'</div>':'')+
   '<div class="d-callout-host"></div></div>';
}
function positionMap(anim){
  const m=$(".d-map");if(!m)return;
  const w=m.clientWidth,h=m.clientHeight;if(!w||!h)return;
  D.mapSize={w,h};
  const svg=m.querySelector("svg");svg.setAttribute("viewBox","0 0 "+w+" "+h);
  if(!anim)m.classList.add("d-noanim");
  const base=Math.min(w/760,h/470),k=base*D.map.z;
  const tx=w/2-D.map.cx*k,ty=h/2-D.map.cy*k;
  m.querySelector(".d-map-base").style.transform="translate("+tx.toFixed(1)+"px,"+ty.toFixed(1)+"px) scale("+k.toFixed(4)+")";
  m.querySelectorAll("[data-pin]").forEach(p=>{const it=itemById(p.dataset.pin);if(it)p.style.transform="translate("+(it.x*k+tx).toFixed(1)+"px,"+(it.y*k+ty).toFixed(1)+"px)"});
  const co=m.querySelector(".d-callout");
  if(co&&D.callout){const it=itemById(D.callout);const sx=it.x*k+tx,sy=it.y*k+ty;const cw=co.offsetWidth||280;
    const left=Math.max(cw/2+12,Math.min(w-cw/2-12,sx));const below=sy-62<(co.offsetHeight||200)+12;
    co.style.left=left+"px";co.style.top=(below?sy+14:sy-58)+"px";co.classList.toggle("is-below",below);co.style.setProperty("--ax",(sx-left)+"px")}
  if(!anim){void m.offsetWidth;requestAnimationFrame(()=>m&&m.classList.remove("d-noanim"))}
}
function calloutHTML(){
  if(!D.callout)return "";
  const help=S.mode==="help",it=itemById(D.callout);if(!it)return "";
  if(help)return '<div class="d-callout d-callout-req" role="dialog" aria-label="'+esc(it.who)+'"><button class="d-co-x" data-a="cox" aria-label="Close">'+ic("x","sm")+'</button>'+
    '<div class="d-co-p"><span class="d-av d-av-tide'+(it.today?' is-today':'')+'">'+esc(it.ini)+'</span><span><b>'+esc(it.who)+'</b><small>'+esc(it.ver)+'</small></span></div>'+
    '<p class="d-co-t">'+esc(it.task)+'</p><div class="d-meta"><span>'+ic("clock","sm")+it.mins+' min</span><span>'+ic("cal","sm")+esc(it.when)+'</span></div>'+
    '<button class="d-btn d-btn-tide d-btn-sm d-btn-block" data-a="openreq" data-k="'+it.id+'">'+esc(t("canHelp"))+'</button><span class="d-co-arrow"></span></div>';
  return '<div class="d-callout" role="dialog" aria-label="'+esc(it.title)+'"><button class="d-co-x" data-a="cox" aria-label="Close">'+ic("x","sm")+'</button>'+
   '<div class="d-co-art">'+cover(it)+'</div><div class="d-co-b"><small class="d-co-when">'+ic("clock","sm")+esc(it.when)+'</small><b class="d-co-t">'+esc(it.title)+'</b>'+
   '<div class="d-meta"><span>'+esc(it.len)+'</span><span>'+esc(distLabel(it))+'</span><span>'+leftOf(it)+' spots left</span></div>'+
   '<button class="d-btn d-btn-sun d-btn-sm d-btn-block" data-a="open" data-k="'+it.id+'">View details'+ic("arrowr","sm")+'</button></div><span class="d-co-arrow"></span></div>';
}
function setCallout(id){
  D.callout=id;setHot(id);
  $$(".d-pin").forEach(p=>p.classList.toggle("is-sel",p.dataset.pin===id));
  const host=$(".d-callout-host");if(host){host.innerHTML=calloutHTML();positionMap(true)}
  if(id){const p=$('.d-pin[data-pin="'+id+'"]');if(p)p.parentNode.appendChild(p);
    const c=$('[data-card="'+id+'"]');if(c&&effView()!=="map"){c.scrollIntoView({block:"nearest",behavior:reduced()?"auto":"smooth"})}}
}
function setHot(id){
  if(D.hot===id)return;D.hot=id;
  $$("[data-card]").forEach(c=>c.classList.toggle("is-hot",c.dataset.card===id));
  $$(".d-pin").forEach(p=>p.classList.toggle("is-hot",p.dataset.pin===id));
  if(id){const p=$('.d-pin[data-pin="'+id+'"]');if(p&&!$(".d-pin.is-sel"))p.parentNode.appendChild(p)}
}

function renderResults(){
  const f=$(".d-filters"),sp=$(".d-split");if(!f||!sp)return;
  f.innerHTML=filtersHTML();
  const v=effView();
  if(D.callout&&!mapItems().some(i=>i.id===D.callout))D.callout=null;
  sp.className="d-split is-"+v;
  sp.innerHTML='<div class="d-list">'+listHTML()+'</div>'+(v!=="list"?'<aside class="d-mapcol" aria-label="Map">'+mapHTML()+'</aside>':'');
  const host=$(".d-callout-host");if(host)host.innerHTML=calloutHTML();
  observeMap();measureFilters();
}
function measureFilters(){const f=$(".d-filters"),h=$(".d-home");if(f&&h)h.style.setProperty("--d-fh",f.offsetHeight+"px")}
let mapRO=null;
function observeMap(){
  if(mapRO){mapRO.disconnect();mapRO=null}
  const m=$(".d-map");if(!m)return;
  positionMap(false);
  if(window.ResizeObserver){mapRO=new ResizeObserver(()=>positionMap(false));mapRO.observe(m)}
}
function switchMode(k){
  if(S.mode===k)return;
  S.mode=k;D.callout=null;D.hot=null;D.map=mapDefault();
  const app=root;app.dataset.mode=k;
  $$(".d-path").forEach(b=>{const on=b.dataset.k===k;b.setAttribute("aria-pressed",on);b.querySelector(".d-path-go").innerHTML=on?'<span>Showing now</span>'+ic("check","sm"):'<span>Switch to this</span>'+ic("arrowr","sm")});
  const l=$(".d-hero-l");if(l){l.innerHTML=heroCopy();l.firstChild.classList.add("d-swap")}
  renderResults();renderRail();notify();
}

/* =========================================================
   COMMUNITY
   ========================================================= */
const WEEK=[["Mon",22],["Tue",18],["Wed",26],["Thu",20],["Fri",31],["Sat",52],["Sun",43]];
function postHTML(p){
  const liked=!!S.liked[p.id],n=p.likes+(liked?1:0);
  let cta="";
  if(p.req)cta='<button class="d-btn d-btn-tide d-btn-sm" data-a="openreq" data-k="'+p.req+'">'+ic("hand","sm")+esc(t("canHelp"))+'</button>';
  if(p.opp)cta='<button class="d-btn d-btn-sun d-btn-sm" data-a="open" data-k="'+p.opp+'">See activity'+ic("arrowr","sm")+'</button>';
  return '<article class="d-post">'+
   '<header class="d-post-h"><span class="d-press">'+tile(p.cause,44)+'</span><span><b>'+esc(p.group)+'</b><small>'+esc(p.ago)+' ago · Group update</small></span>'+
   '<button class="d-icbtn d-icbtn-sm" data-a="toast" data-k="Muted for this session" aria-label="More options">'+ic("more","sm")+'</button></header>'+
   '<p class="d-post-p">'+esc(p.text)+'</p>'+
   (p.cover?'<div class="d-post-art">'+cover(opp(p.cover))+'<span class="d-post-cap">'+ic("pin","sm")+'Canal park, gate 2 · Sunday</span></div>':'')+
   '<footer class="d-post-f"><button class="d-like'+(liked?' is-on':'')+'" data-a="like" data-k="'+p.id+'" aria-pressed="'+liked+'" aria-label="Thank, '+n+' thanks">'+ic("heart",liked?"fill":"")+'<b class="num">'+n+'</b><span>thanks</span></button>'+
   '<button class="d-ghostlink" data-a="share">'+ic("share","sm")+'Share</button><span class="d-grow"></span>'+cta+'</footer></article>';
}
function groupRow(g){
  const on=!!S.groups[g.id];
  return '<li class="d-grp"><span class="d-press">'+tile(g.cause,40)+'</span><span class="d-grp-t"><b>'+esc(g.name)+'</b><small>'+g.members+' members · '+esc(g.about)+'</small></span>'+
   '<button class="d-btn d-btn-sm '+(on?'d-btn-ghost is-joined':'d-btn-tide')+'" data-a="group" data-k="'+g.id+'" aria-pressed="'+on+'">'+(on?ic("check","sm")+"Joined":"Join")+'</button></li>';
}
function communityHTML(){
  const mx=Math.max(...WEEK.map(w=>w[1])),tot=WEEK.reduce((a,b)=>a+b[1],0);
  const mine=GROUPS.filter(g=>S.groups[g.id]);
  return '<div class="d-page d-comm">'+
  '<header class="d-phead"><div><p class="d-eyebrow"><span class="d-eb-dot"></span>Jayanagar · 4th Block and around</p><h1 class="d-h2">What your neighbours did this week</h1></div>'+
   '<button class="d-btn d-btn-ink" data-a="drive">'+ic("plus","sm")+esc(t("startDrive"))+'</button></header>'+
  '<div class="d-comm-g">'+
   '<aside class="d-comm-l"><section class="d-panel"><h2 class="d-panel-t">Your groups</h2>'+
     (mine.length?'<ul class="d-mini-list">'+mine.map(g=>'<li>'+tile(g.cause,32)+'<span><b>'+esc(g.name)+'</b><small>'+g.members+' members</small></span></li>').join("")+'</ul>':'<p class="d-muted">Join a group to see its updates first.</p>')+
    '</section>'+
    '<section class="d-inkcard"><span class="d-ink-orb" aria-hidden="true"></span><h2>Got a cause on your street?</h2><p>81% of activities in India are self-organised. Start one in three steps.</p><button class="d-btn d-btn-sun d-btn-sm" data-a="drive">'+esc(t("startDrive"))+ic("arrowr","sm")+'</button></section>'+
    '<p class="d-fine">'+ic("shield","sm")+'Posts come from verified groups. Report anything that feels off.</p></aside>'+
   '<section class="d-feed" aria-label="Updates from groups">'+POSTS.map(postHTML).join("")+'</section>'+
   '<aside class="d-comm-r">'+
    '<section class="d-panel"><h2 class="d-panel-t">Groups near you</h2><ul class="d-grps">'+GROUPS.map(groupRow).join("")+'</ul></section>'+
    '<section class="d-panel d-stats"><h2 class="d-panel-t">This week near you</h2>'+
     '<div class="d-stat2"><div><b class="num">46</b><span>neighbours helped</span></div><div><b class="num">'+tot+'</b><span>hours given</span></div></div>'+
     '<div class="d-wbars" role="img" aria-label="Hours given each day this week: '+WEEK.map(w=>w[0]+" "+w[1]).join(", ")+'">'+WEEK.map(w=>'<div class="d-wb'+(w[0]==="Sat"?' is-max':'')+'"><span class="d-wb-v num">'+w[1]+'</span><span class="d-wb-col"><i style="height:'+(w[1]/mx*100).toFixed(1)+'%"></i></span><span class="d-wb-l">'+w[0]+'</span></div>').join("")+'</div>'+
     '<p class="d-fine">Hours given per day, all groups within 3 km.</p></section>'+
   '</aside></div></div>';
}

/* =========================================================
   ACTIVITY
   ========================================================= */
function activityHTML(){
  const up=D.actTab==="up",n=upcoming().length;
  return '<div class="d-page d-act">'+
  '<header class="d-phead"><div><p class="d-eyebrow"><span class="d-eb-dot"></span>Your plans and your story so far</p><h1 class="d-h2">'+esc(t("tAct"))+'</h1></div>'+
  '<div class="d-seg2" role="tablist" aria-label="Activity" data-on="'+D.actTab+'"><span class="d-seg2-thumb" aria-hidden="true"></span>'+
   '<button role="tab" data-a="atab" data-k="up" aria-selected="'+up+'">'+esc(t("upcoming"))+(n?' <span class="d-seg2-n num">'+n+'</span>':'')+'</button>'+
   '<button role="tab" data-a="atab" data-k="past" aria-selected="'+!up+'">'+esc(t("past"))+' <span class="d-seg2-n num">'+HISTORY.length+'</span></button></div></header>'+
  '<div class="d-act-g"><div class="d-act-body">'+(up?upHTML():pastHTML())+'</div>'+actAside()+'</div></div>';
}
function actAside(){
  const saved=OPPS.filter(o=>S.saved[o.id]),next=upcoming()[0];
  return '<aside class="d-act-r">'+
   (next?'<section class="d-inkcard d-next"><span class="d-ink-orb" aria-hidden="true"></span><span class="d-next-k">'+ic("bell","sm")+'Next up</span><h2>'+esc(next.title)+'</h2><p>'+esc(next.when)+'. '+(S.settings.reminders?'We will remind you 1 hour before.':'Reminders are off in Settings.')+'</p></section>':
     '<section class="d-inkcard d-next"><span class="d-ink-orb" aria-hidden="true"></span><span class="d-next-k">'+ic("sparkle","sm")+'Start small</span><h2>20 minutes counts</h2><p>Most people begin with one short task from home.</p><button class="d-btn d-btn-sun d-btn-sm" data-a="open" data-k="quick">See the first step'+ic("arrowr","sm")+'</button></section>')+
   '<section class="d-panel"><h2 class="d-panel-t">Saved for later <small class="num">'+saved.length+'</small></h2>'+
    (saved.length?'<ul class="d-saved">'+saved.map(o=>'<li><button data-a="open" data-k="'+o.id+'"><span class="d-saved-art">'+cover(o)+'</span><span><b>'+esc(o.title)+'</b><small>'+esc(o.when)+' · '+esc(o.len)+'</small></span></button></li>').join("")+'</ul>'
     :'<p class="d-muted d-saved-empty">'+ic("heart","sm")+'Tap the heart on any activity to keep it here.</p>')+'</section>'+
   '<section class="d-panel d-rhythm"><h2 class="d-panel-t">Your rhythm</h2><div class="d-stat2"><div><b class="num">'+USER.activities+'</b><span>activities</span></div><div><b class="num">'+USER.hours+'</b><span>hours</span></div></div><p class="d-fine">'+ic("trend","sm")+'You give most on weekends. Saturday mornings have the most openings near you.</p></section>'+
  '</aside>';
}
function upHTML(){
  const items=upcoming();
  if(!items.length)return '<div class="d-empty d-empty-lg">'+emptyArt()+'<h3>No plans yet</h3><p>Pick a 20-minute task to get started. Most people begin with something small.</p><div class="d-empty-b"><button class="d-btn d-btn-sun" data-a="open" data-k="quick">Try the 20-minute first step</button><button class="d-btn d-btn-ghost" data-a="nav" data-k="home">Browse everything near you</button></div></div>';
  const groups=[];items.forEach(it=>{const key=it.d[0]+it.d[1];let g=groups.find(x=>x.key===key);if(!g){g={key,d:it.d,items:[]};groups.push(g)}g.items.push(it)});
  return '<ol class="d-tl">'+groups.map(g=>'<li class="d-tl-g"><div class="d-date'+(g.d[1]===14?' is-today':'')+'"><span>'+(g.d[1]===14?"Today":g.d[0]==="Week"?"This":g.d[0])+'</span><b class="num">'+(g.d[0]==="Week"?"Wk":g.d[1])+'</b><small>'+(g.d[0]==="Week"?"week":"Oct")+'</small></div><div class="d-tl-items">'+g.items.map(tlItem).join("")+'</div></li>').join("")+'</ol>';
}
function tlItem(it){
  const kind={opp:["d-k-sun","Joined"],help:["d-k-tide","Helping"],drive:["d-k-ink","Your drive"],ask:["d-k-mint","Your request"]}[it.k];
  let actions="";
  if(it.k==="opp")actions='<button class="d-btn d-btn-ghost d-btn-sm" data-a="cal">'+ic("cal","sm")+'Add to calendar</button><button class="d-btn d-btn-ghost d-btn-sm" data-a="open" data-k="'+it.id+'">'+esc(t("details"))+'</button>';
  if(it.k==="help")actions='<button class="d-btn d-btn-tide d-btn-sm" data-a="chat" data-k="'+it.id+'">'+ic("chat","sm")+'Open chat</button>';
  if(it.k==="drive")actions='<button class="d-btn d-btn-tide d-btn-sm" data-a="share">'+ic("whatsapp","sm")+'Invite on WhatsApp</button><button class="d-btn d-btn-ghost d-btn-sm" data-a="copy">'+ic("copy","sm")+'Copy link</button>';
  if(it.k==="ask")actions='<button class="d-btn d-btn-ghost d-btn-sm" data-a="toast" data-k="Request withdrawn. No one will be notified">Withdraw</button>';
  return '<article class="d-tl-i"><span class="d-tl-art">'+cover({id:it.id+"tl",cause:it.cause})+'</span><div class="d-tl-b"><span class="d-kind '+kind[0]+'">'+kind[1]+'</span><h3>'+esc(it.title)+'</h3><p>'+esc(it.sub)+'</p>'+
   '<div class="d-meta"><span>'+ic("clock","sm")+esc(it.when)+'</span><span>'+ic(it.k==="drive"?"pin":"bolt","sm")+esc(it.len)+'</span>'+(it.k==="opp"&&S.settings.reminders?'<span class="d-ok">'+ic("bell","sm")+'Reminder on</span>':'')+'</div></div>'+
   '<div class="d-tl-a">'+actions+'</div></article>';
}
function pastHTML(){
  return '<div class="d-past">'+HISTORY.map(h=>{
    const fb=S.feedback[h.id];
    let right="";
    if(h.needsFeedback)right=fb?'<span class="d-tag is-ok">'+ic("check","sm")+'Thanks for your feedback</span>':'<button class="d-btn d-btn-sun d-btn-sm" data-a="fb" data-k="'+h.id+'">'+ic("smile","sm")+'How was it?</button>';
    if(h.cert)right='<span class="d-tag is-ok">'+ic("award","sm")+'Certificate ready</span><button class="d-btn d-btn-ghost d-btn-sm" data-a="cert">'+ic("down","sm")+'Download</button>';
    if(h.informal)right='<span class="d-tag d-tag-tide">'+ic("hand","sm")+'Informal help</span>';
    return '<article class="d-past-i"><span class="d-press">'+tile(h.cause,52)+'</span><div class="d-past-b"><h3>'+esc(h.title)+'</h3><p>'+esc(h.host)+' · '+esc(h.when)+' · '+esc(h.len)+'</p></div><div class="d-past-a">'+right+'</div></article>';
  }).join("")+'<p class="d-fine d-center">'+ic("shield","sm")+'Hours from registered hosts count toward certificates. Informal help stays private unless you share it.</p></div>';
}

/* =========================================================
   ME
   ========================================================= */
function meHTML(){
  const w=USER.weekly,mx=3,labels=["6w","5w","4w","3w","2w","Now"];
  const sw=(k,l,s)=>'<li class="d-set"><span><b>'+l+'</b><small>'+s+'</small></span><button class="d-switch" role="switch" aria-checked="'+!!S.settings[k]+'" data-a="set" data-k="'+k+'" aria-label="'+l+'"><i></i></button></li>';
  const dark=EK.isDark&&EK.isDark();
  return '<div class="d-page d-me">'+
  '<header class="d-phead"><div><p class="d-eyebrow"><span class="d-eb-dot"></span>Volunteering since '+esc(USER.since)+'</p><h1 class="d-h2">Your hours, your way</h1></div></header>'+
  '<div class="d-me-g">'+
   '<section class="d-panel d-prof"><span class="d-av d-av-xl">'+USER.ini+'</span><div><h2>'+esc(USER.name)+'</h2><p>'+ic("pin","sm")+esc(USER.area)+'</p><span class="d-tag is-ok">'+ic("shield","sm")+esc(USER.verified)+'</span></div>'+
    '<div class="d-prof-c"><span class="d-k">Causes</span><span class="d-prof-t">'+["book","bowl","leaf"].map(c=>'<span class="d-press">'+tile(c,34)+'</span>').join("")+'</span></div></section>'+
   '<section class="d-stat"><b class="num">'+(S.settings.showHours?USER.hours:"–")+'</b><span>hours so far</span><small>'+(S.settings.showHours?"1.5 h this week":"Hidden from your profile")+'</small></section>'+
   '<section class="d-stat"><b class="num">'+USER.activities+'</b><span>activities</span><small>With 3 organisations</small></section>'+
   '<section class="d-stat d-stat-tide"><b class="num">'+USER.neighbours+'</b><span>neighbours helped</span><small>Informal help counts too</small></section>'+
   '<section class="d-panel d-chart-p"><div class="d-panel-h"><h2 class="d-panel-t">Your hours by week</h2><span class="d-legend"><i class="d-lg d-lg-sun"></i>Past weeks<i class="d-lg d-lg-tide"></i>This week</span></div>'+
    '<div class="d-chart" role="img" aria-label="Hours volunteered in the last six weeks: '+w.map((v,i)=>labels[i]+" "+v+" hours").join(", ")+'">'+
     '<div class="d-plot">'+[1,2,3].map(g=>'<span class="d-gl" style="bottom:'+(g/mx*100)+'%"><em>'+g+' h</em></span>').join("")+
      w.map((v,i)=>'<div class="d-bcol" title="'+labels[i]+': '+v+' h"><span class="d-bar'+(i===w.length-1?' is-cur':'')+'" style="height:'+(v/mx*100)+'%;--i:'+i+'"><b class="num">'+v+'</b></span><span class="d-tip">'+(i===w.length-1?"This week":labels[i].replace("w"," weeks ago"))+' · '+v+' h</span></div>').join("")+'</div>'+
     '<div class="d-xl">'+labels.map(l=>'<span>'+l+'</span>').join("")+'</div></div></section>'+
   '<section class="d-panel d-certs"><h2 class="d-panel-t">Certificates</h2><ul>'+
    '<li><span class="d-cert-ic">'+ic("award")+'</span><span><b>Disha Learning Trust</b><small>6 hours of reading with children</small></span><button class="d-btn d-btn-ghost d-btn-sm" data-a="cert">'+ic("down","sm")+'Download</button></li>'+
    '<li class="is-pending"><span class="d-cert-ic">'+ic("award")+'</span><span><b>Roti Bank Collective</b><small>2 of 6 hours toward a certificate</small><span class="d-prog"><i style="width:33%"></i></span></span></li></ul><p class="d-fine">'+ic("shield","sm")+'Hosts issue certificates. ekoo checks the hours against each session before they count.</p></section>'+
   '<section class="d-panel d-settings"><h2 class="d-panel-t">Settings</h2><ul>'+
    sw("reminders","Reminders","One hour before each activity")+sw("showHours","Show my hours","On your profile and certificates")+sw("whatsapp","WhatsApp sharing","Invite friends with one tap")+sw("large","Larger text","Makes everything about 12% bigger")+'</ul>'+
    '<div class="d-set-row"><span><b>Language</b><small>Hindi changes menus and buttons</small></span><div class="d-segx" role="group" aria-label="Language"><button data-a="lang" data-k="en" aria-pressed="'+(S.lang==="en")+'">English</button><button data-a="lang" data-k="hi" aria-pressed="'+(S.lang==="hi")+'" lang="hi">हिन्दी</button></div></div>'+
    '<div class="d-set-row"><span><b>Appearance</b><small>Light or dark</small></span><div class="d-segx" role="group" aria-label="Appearance"><button data-a="appear" data-k="light" aria-pressed="'+!dark+'">'+ic("sun","sm")+'Light</button><button data-a="appear" data-k="dark" aria-pressed="'+dark+'">'+ic("moon","sm")+'Dark</button></div></div></section>'+
   '<section class="d-panel d-trust-p"><h2 class="d-panel-t">Trust and safety</h2><ul class="d-checks"><li>'+ic("check","sm")+'<span>Phone number verified</span></li><li class="is-todo">'+ic("info","sm")+'<span>Add an ID to host drives of more than 15 people</span></li><li>'+ic("lock","sm")+'<span>Your number stays private in chats</span></li></ul>'+
    '<button class="d-btn d-btn-ghost d-btn-sm" data-a="toast" data-k="ID check opens with DigiLocker">Add an ID</button></section>'+
   '<button class="d-about" data-a="research"><span class="d-about-art" aria-hidden="true">'+mark()+'</span><span><b>About this prototype</b><small>Design research · ten award-winning references</small></span>'+ic("arrowur","sm")+'</button>'+
  '</div></div>';
}

/* =========================================================
   MAIN render
   ========================================================= */
function renderMain(keepScroll){
  const m=$(".d-main"),st=keepScroll?m.scrollTop:0;
  tileN=0;
  root.dataset.mode=S.mode;root.dataset.screen=D.screen;
  if(D.screen==="home"){m.innerHTML=homeHTML();renderResults()}
  else if(D.screen==="community")m.innerHTML=communityHTML();
  else if(D.screen==="activity")m.innerHTML=activityHTML();
  else if(D.screen==="me")m.innerHTML=meHTML();
  m.scrollTop=st;
  if(!keepScroll&&!D.enter)m.firstChild&&m.firstChild.classList.add("d-in");
  if(D.enter){D.enter=false;later(()=>{const p=$(".d-enter");p&&p.classList.remove("d-enter")},1600)}
  root.classList.toggle("d-large",!!S.settings.large);
  onMainScroll();
}
function go(screen,opts){
  closePop();D.callout=null;D.hot=null;D.map=mapDefault();
  D.screen=screen;Object.assign(D,opts||{});
  renderRail();renderMain();notify();
  $(".d-main").focus({preventScroll:true});
}
function renderAll(){renderRail();renderTop();if(S.onboarded)renderMain(true);renderWelcome();if(D.drawer)renderDrawer();if(D.modal)renderModal();notify()}

/* =========================================================
   DRAWER (detail, request, chat)
   ========================================================= */
function openDrawer(spec){
  closePop();
  const was=!!D.drawer;D.drawer=spec;
  if(!was)lastFocus=document.activeElement;
  renderDrawer(true);notify();
}
function closeDrawer(){
  if(!D.drawer)return;D.drawer=null;D.typing=false;
  const w=$(".d-drawer-wrap");
  if(w){w.classList.add("is-out");later(()=>{if(!D.drawer)$(".d-drawer-host").innerHTML=""},reduced()?0:360)}
  notify();restoreFocus();
}
function restoreFocus(){if(lastFocus&&document.contains(lastFocus)){try{lastFocus.focus({preventScroll:true})}catch(e){}}lastFocus=null}
function renderDrawer(swap){
  const host=$(".d-drawer-host");
  if(!D.drawer){host.innerHTML="";return}
  let w=host.querySelector(".d-drawer-wrap:not(.is-out)"),fresh=false;
  if(!w){host.innerHTML='<div class="d-drawer-wrap"><div class="d-scrim" data-a="close"></div><section class="d-drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle" tabindex="-1"></section></div>';w=host.firstChild;fresh=true}
  const p=w.querySelector(".d-drawer"),d=D.drawer;
  p.dataset.kind=d.kind;
  const html=d.kind==="opp"?(d.step==="slots"?slotsHTML(opp(d.id)):detailHTML(opp(d.id))):d.kind==="req"?requestHTML(req(d.id)):chatHTML(req(d.id));
  p.innerHTML='<div class="d-dr-in'+(swap&&!fresh?' d-swap':'')+'">'+html+'</div>';
  if(d.kind==="chat")scrollMsgs();
  later(()=>{const f=p.querySelector("[data-autofocus]")||p;if(f)f.focus({preventScroll:true})},fresh?60:20);
}
function factsHTML(f){return '<div class="d-facts">'+f.map(x=>'<div class="d-fact"><span class="d-fact-ic">'+ic(x[0],"sm")+'</span><span class="d-fact-k">'+x[1]+'</span><b>'+x[2]+'</b>'+(x[3]||'')+'</div>').join("")+'</div>'}
function ring(frac){const r=15,c=2*Math.PI*r;return '<svg class="d-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="'+r+'" class="d-ring-bg"/><circle cx="20" cy="20" r="'+r+'" class="d-ring-fg" stroke-dasharray="'+(c*frac).toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 20 20)"/></svg>'}
function detailHTML(o){
  const joined=S.joined[o.id],left=leftOf(o),saved=!!S.saved[o.id];
  return '<div class="d-dr-scroll"><div class="d-dr-hero">'+cover(o)+'<div class="d-dr-tools"><button class="d-icbtn d-glassbtn d-dr-x" data-a="close" aria-label="Close">'+ic("x","md")+'</button><span class="d-grow"></span>'+
   '<button class="d-icbtn d-glassbtn" data-a="share" aria-label="Share on WhatsApp">'+ic("share","md")+'</button>'+
   '<button class="d-icbtn d-glassbtn d-save-dr'+(saved?' is-on':'')+'" data-a="save" data-k="'+o.id+'" aria-pressed="'+saved+'" aria-label="'+(saved?"Saved":"Save")+'">'+ic("heart",saved?"md fill":"md")+'</button></div>'+
   '<span class="d-dr-cause">'+tile(o.cause,30)+esc(CL[o.cause])+'</span></div>'+
  '<div class="d-dr-body">'+
   '<h2 class="d-dr-title" id="dTitle">'+esc(o.title)+'</h2>'+
   '<div class="d-rating"><span class="d-stars" aria-label="Rated '+o.rating+' out of 5">'+ic("star","sm fill")+'<b class="num">'+o.rating+'</b></span><span>'+o.reviews+' reviews</span><span>'+esc(distLabel(o))+'</span><span>'+esc(o.kind)+'</span></div>'+
   '<div class="d-trust"><span class="d-trust-ic">'+ic("shield")+'</span><div><b>'+esc(o.host)+'</b><span>'+esc(o.verified)+'. '+esc(o.fin)+'.</span><button class="d-link" data-a="fin">View published finances'+ic("arrowur","sm")+'</button></div></div>'+
   factsHTML([["cal","When",esc(joined||o.when)],["clock","Time needed",esc(o.len)],[o.home?"globe":"pin","Where",esc(o.where)],["users","Spots left",'<span class="num">'+left+'</span> of '+o.cap,ring(left/o.cap)]])+
   '<h3 class="d-h3">What you will do</h3><p class="d-p">'+esc(o.about)+'</p>'+
   '<h3 class="d-h3">Good to know</h3><ul class="d-checks">'+o.tags.map(x=>'<li>'+ic("check","sm")+'<span>'+esc(x)+'</span></li>').join("")+'<li>'+ic("check","sm")+'<span>Bring: '+esc(o.bring)+'</span></li></ul>'+
   '<h3 class="d-h3">What volunteers say <small>'+ic("star","sm fill")+o.rating+' · '+o.reviews+'</small></h3><div class="d-revs">'+o.rev.map(r=>'<figure class="d-rev"><blockquote>“'+esc(r[2])+'”</blockquote><figcaption><span class="d-av d-av-s">'+esc(r[0][0])+'</span><b>'+esc(r[0])+'</b><small>'+esc(r[1])+' · Volunteered here</small></figcaption></figure>').join("")+'</div>'+
   '<div class="d-sharebar"><button class="d-btn d-btn-ghost d-btn-sm" data-a="share">'+ic("whatsapp","sm")+'Share on WhatsApp</button><button class="d-btn d-btn-ghost d-btn-sm" data-a="copy">'+ic("copy","sm")+'Copy link</button><button class="d-btn d-btn-ghost d-btn-sm" data-a="save" data-k="'+o.id+'" aria-pressed="'+saved+'">'+ic("heart",saved?"sm fill":"sm")+(saved?"Saved":"Save")+'</button></div>'+
   '<button class="d-report" data-a="report">'+ic("flag","sm")+'Report this activity</button>'+
  '</div></div>'+
  '<footer class="d-dr-foot">'+(joined?'<div class="d-foot-in"><span class="d-ok-dot">'+ic("check","sm")+'</span><span><b>'+esc(t("youreIn"))+'</b><small>'+esc(joined)+' · Reminder on</small></span></div><button class="d-btn d-btn-ink" data-a="toact">View in Activity'+ic("arrowr","sm")+'</button>'
    :'<div class="d-foot-sum"><b>'+esc(o.len)+'</b><small>'+left+' spots left · Free</small></div><button class="d-btn d-btn-sun d-btn-lg" data-a="slots">'+esc(t("joinCta"))+ic("arrowr","sm")+'</button>')+'</footer>';
}
function slotsHTML(o){
  const sel=D.drawer.slot||0,left=leftOf(o);
  return '<div class="d-dr-scroll"><div class="d-dr-bar"><button class="d-icbtn" data-a="slotsback" aria-label="Back to details">'+ic("back","md")+'</button><span class="d-dr-step">Step 2 of 2 · Pick a time</span><button class="d-icbtn d-dr-x" data-a="close" aria-label="Close">'+ic("x","md")+'</button></div>'+
  '<div class="d-dr-body"><div class="d-mini"><span class="d-mini-art">'+cover(o)+'</span><span><b>'+esc(o.title)+'</b><small>'+esc(o.host)+' · '+esc(o.where)+'</small></span></div>'+
  '<h2 class="d-dr-title" id="dTitle">When can you come?</h2><p class="d-p d-muted">Pick one session. You can change or cancel it any time from Activity.</p>'+
  '<div class="d-slots" role="radiogroup" aria-label="Sessions">'+o.slots.map((s,i)=>'<button class="d-slot" role="radio" aria-checked="'+(sel===i)+'" data-a="slot" data-k="'+i+'"><span class="d-radio"><i></i></span><span class="d-slot-t"><b>'+esc(s)+'</b><small>'+esc(o.len)+' · '+esc(o.where)+'</small></span><span class="d-slot-l"><b class="num">'+Math.max(1,left-i*2)+'</b> left</span></button>').join("")+'</div>'+
  '<div class="d-note">'+ic("bell","sm")+'<span>We will remind you 1 hour before. '+esc(o.host)+' will see your first name and verified badge.</span></div></div></div>'+
  '<footer class="d-dr-foot"><button class="d-btn d-btn-ghost" data-a="slotsback">Back</button><button class="d-btn d-btn-sun d-btn-lg" data-a="confirm">'+ic("check","sm")+'Confirm and join</button></footer>';
}
function requestHTML(r){
  const on=S.helping[r.id];
  return '<div class="d-dr-scroll"><div class="d-dr-bar d-dr-bar-tide"><span class="d-dr-step">'+ic("hand","sm")+'Neighbour request</span><span class="d-grow"></span><button class="d-icbtn" data-a="report" aria-label="Report or block">'+ic("flag","sm")+'</button><button class="d-icbtn d-dr-x" data-a="close" aria-label="Close">'+ic("x","md")+'</button></div>'+
  '<div class="d-dr-body"><div class="d-person"><span class="d-av d-av-tide d-av-lg'+(r.today?' is-today':'')+'">'+esc(r.ini)+'</span><span><b>'+esc(r.who)+'</b><small>'+ic("pin","sm")+esc(r.dist)+(r.today?' · <em class="d-today">Needs help today</em>':'')+'</small></span></div>'+
  '<div class="d-trust d-trust-tide"><span class="d-trust-ic">'+ic("shield")+'</span><div><b>'+esc(r.ver)+'</b><span>Joined '+esc(r.joined)+'. '+plural(r.helped,"neighbour has","neighbours have")+' helped before.</span></div></div>'+
  '<h2 class="d-dr-title d-dr-title-xl" id="dTitle">'+esc(r.task)+'</h2>'+
  '<blockquote class="d-quote">'+esc(r.note)+'<cite>'+esc(r.who)+'</cite></blockquote>'+
  factsHTML([["cal","When",esc(r.when)],["clock","Time needed",r.mins+" minutes"],[r.x==null?"globe":"pin","Distance",esc(r.dist)],["users","Helped before",plural(r.helped,"time","times")]])+
  '<div class="d-note d-note-lock">'+ic("lock","sm")+'<span>Exact address is shared after you accept. Until then you both see only the street.</span></div>'+
  '<h3 class="d-h3">Stay safe</h3><ul class="d-checks d-checks-tide">'+TIPS.map(x=>'<li>'+ic("check","sm")+'<span>'+esc(x)+'</span></li>').join("")+'</ul>'+
  '<button class="d-report" data-a="report">'+ic("flag","sm")+'Report or block</button></div></div>'+
  '<footer class="d-dr-foot"><button class="d-btn d-btn-ghost d-btn-icon" data-a="chat" data-k="'+r.id+'" aria-label="Message first">'+ic("chat","md")+'</button>'+
  (on?'<button class="d-btn d-btn-tide d-btn-lg" data-a="chat" data-k="'+r.id+'">'+ic("chat","sm")+'Open chat</button>':'<button class="d-btn d-btn-tide d-btn-lg" data-a="offer" data-k="'+r.id+'">'+ic("hand","sm")+esc(t("canHelp"))+'</button>')+'</footer>';
}
function msgsHTML(r){
  const m=S.chats[r.id]||[];
  return '<div class="d-day">Today</div>'+m.map((x,i)=>x.k==="sys"?'<div class="d-sys">'+ic("info","sm")+esc(x.t)+'</div>':'<div class="d-msg d-msg-'+x.k+'" style="--i:'+i+'">'+esc(x.t)+'<span class="d-msg-t">'+(x.k==="me"?"now":"5:02 pm")+(x.k==="me"?ic("check","sm"):"")+'</span></div>').join("")+
   (D.typing?'<div class="d-msg d-msg-them d-typing" aria-label="'+esc(r.who)+' is typing"><i></i><i></i><i></i></div>':'');
}
function chatHTML(r){
  const replies=["I will be there on time","Can you share more details?","Running 10 minutes late"];
  return '<div class="d-chat"><header class="d-chat-h"><button class="d-icbtn" data-a="openreq" data-k="'+r.id+'" aria-label="Back to request">'+ic("back","md")+'</button><span class="d-av d-av-tide'+(r.today?' is-today':'')+'">'+esc(r.ini)+'</span><span class="d-chat-who"><b id="dTitle">'+esc(r.who)+'</b><small><i class="d-online"></i>'+esc(r.ver)+' · '+esc(r.dist)+'</small></span><span class="d-grow"></span><button class="d-icbtn" data-a="report" aria-label="Report or block">'+ic("flag","sm")+'</button><button class="d-icbtn d-dr-x" data-a="close" aria-label="Close">'+ic("x","md")+'</button></header>'+
  '<div class="d-chat-ctx">'+tile(r.cause,32)+'<span><b>'+esc(r.task)+'</b><small>'+esc(r.when)+' · '+r.mins+' min'+(S.helping[r.id]?' · You offered to help':'')+'</small></span></div>'+
  '<div class="d-msgs" aria-live="polite" aria-label="Messages">'+msgsHTML(r)+'</div>'+
  '<footer class="d-chat-f"><div class="d-qr" role="group" aria-label="Quick replies">'+replies.map(x=>'<button class="d-chip d-chip-sm" data-a="say" data-k="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div>'+
  '<form class="d-compose" data-form="chat"><input class="d-compose-in" type="text" placeholder="Write a message" aria-label="Message '+esc(r.who)+'" autocomplete="off" data-autofocus><button type="submit" class="d-send" aria-label="Send">'+ic("send","md")+'</button></form>'+
  '<p class="d-fine">'+ic("lock","sm")+'Your number stays private in this chat.</p></footer></div>';
}
function scrollMsgs(){const m=$(".d-msgs");if(m)m.scrollTop=m.scrollHeight}
function renderMsgs(){const d=D.drawer;if(!d||d.kind!=="chat")return;const m=$(".d-msgs");if(m){m.innerHTML=msgsHTML(req(d.id));scrollMsgs()}}
function sendMsg(text){
  const d=D.drawer;if(!d||d.kind!=="chat"||!text.trim())return;
  const rid=d.id;
  A.say(rid,text.trim(),()=>{if(!root)return;D.typing=false;renderMsgs()});
  renderMsgs();
  later(()=>{if(D.drawer&&D.drawer.id===rid){D.typing=true;renderMsgs()}},260);
}

/* =========================================================
   MODALS (success, drive, ask, feedback)
   ========================================================= */
function openModal(spec){
  closePop();
  if(!D.modal)lastFocus=document.activeElement;
  D.modal=spec;renderModal(true);notify();
}
function closeModal(){
  if(!D.modal)return;D.modal=null;
  const w=$(".d-modal-wrap");if(w){w.classList.add("is-out");later(()=>{if(!D.modal)$(".d-modal-host").innerHTML=""},reduced()?0:260)}
  notify();restoreFocus();
}
function renderModal(fresh){
  const host=$(".d-modal-host");
  if(!D.modal){host.innerHTML="";return}
  const m=D.modal,k=m.kind;
  const inner=k==="success"?successHTML():k==="drive"?driveHTML():k==="ask"?askHTML():feedbackHTML();
  host.innerHTML='<div class="d-modal-wrap d-mw-'+k+'"><div class="d-scrim" data-a="close"></div><section class="d-modal d-m-'+k+'" role="dialog" aria-modal="true" aria-labelledby="mTitle" tabindex="-1">'+inner+'</section></div>';
  if(k==="success"&&fresh)later(confetti,180);
  later(()=>{const f=host.querySelector("[data-autofocus]")||host.querySelector(".d-modal");if(f)f.focus({preventScroll:true})},40);
}
function successHTML(){
  const o=opp(D.modal.id),slot=S.joined[o.id]||o.slots[0];
  return '<button class="d-icbtn d-m-x" data-a="close" aria-label="Close">'+ic("x","md")+'</button>'+
  '<div class="d-okmark" aria-hidden="true"><svg viewBox="0 0 96 96"><circle class="d-ok-c" cx="48" cy="48" r="44"/><path class="d-ok-k" d="M28 50l14 14 27-30"/></svg></div>'+
  '<h2 class="d-m-title" id="mTitle">'+esc(t("youreIn"))+'</h2><p class="d-m-sub">See you on '+esc(slot)+'. '+esc(o.host)+' has your name.</p>'+
  '<div class="d-sum"><span class="d-sum-art">'+cover(o)+'</span><span><b>'+esc(o.title)+'</b><small>'+ic("cal","sm")+esc(slot)+'</small><small>'+ic(o.home?"globe":"pin","sm")+esc(o.where)+'</small></span></div>'+
  '<ul class="d-checks"><li>'+ic("bell","sm")+'<span>Reminder set for 1 hour before</span></li><li>'+ic("chat","sm")+'<span>The host will message you the details</span></li></ul>'+
  '<div class="d-m-actions"><button class="d-btn d-btn-ghost" data-a="cal">'+ic("cal","sm")+'Add to calendar</button><button class="d-btn d-btn-tide" data-a="share">'+ic("whatsapp","sm")+'Bring a friend</button></div>'+
  '<button class="d-btn d-btn-ink d-btn-block" data-a="backhome">Back to home</button>';
}
function driveHTML(){
  const d=S.draftDrive,st=d.step;
  const pick=(k,vals)=>'<div class="d-chips d-chips-wrap" role="group">'+vals.map(v=>'<button class="d-chip" data-a="dset" data-f="'+k+'" data-k="'+esc(v)+'" aria-pressed="'+(d[k]===v)+'">'+(k==="cause"?'<span class="d-press">'+tile(KIND_CAUSE[v],22)+'</span>':'')+esc(v)+'</button>').join("")+'</div>';
  const steps=["What","When and where","Invite"];
  let body="";
  if(st===1)body='<h2 class="d-m-title" id="mTitle">What do you want to do?</h2><p class="d-m-sub">Keep it short. Neighbours decide in seconds.</p>'+
   '<label class="d-field"><span>Name your drive</span><input class="d-input" data-bind="title" value="'+esc(d.title)+'" maxlength="60" data-autofocus><small class="d-cnt num">'+d.title.length+'/60</small></label>'+
   '<div class="d-field"><span>Kind of help</span>'+pick("cause",["Neighbourhood","Food","Trees and parks","Animals","Education"])+'</div>'+
   '<div class="d-field"><span>How many helpers do you need?</span><div class="d-stepper"><button data-a="hstep" data-k="-1" aria-label="Fewer helpers">−</button><output class="num" aria-live="polite">'+d.helpers+'</output><button data-a="hstep" data-k="1" aria-label="More helpers">+</button><small>'+(d.helpers>15?"Over 15 needs an ID check":"Up to 15 with a verified phone")+'</small></div></div>';
  if(st===2)body='<h2 class="d-m-title" id="mTitle">When and where?</h2><p class="d-m-sub">Weekend mornings get the most replies.</p>'+
   '<div class="d-field"><span>Day</span>'+pick("when",["Sat","Sun","Next Sat","Next Sun"])+'</div>'+
   '<div class="d-field"><span>Start time</span>'+pick("slot",["7 am","9 am","11 am","5 pm"])+'</div>'+
   '<label class="d-field"><span>Meeting place</span><input class="d-input" data-bind="place" value="'+esc(d.place)+'" maxlength="60" data-autofocus></label>'+
   '<p class="d-fine">'+ic("lock","sm")+'The exact spot is shown to people only after they join.</p>';
  if(st===3)body='<h2 class="d-m-title" id="mTitle">Review and invite</h2><p class="d-m-sub">Check the details. You can edit them later.</p>'+
   '<dl class="d-review">'+[["Drive",d.title,1],["Kind",d.cause,1],["Helpers",d.helpers+" people",1],["When",(LONGDAY[d.when]||d.when)+", "+d.slot,2],["Meeting place",d.place,2]].map(r=>'<div><dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd><button class="d-link" data-a="dgo" data-k="'+r[2]+'">Edit</button></div>').join("")+'</dl>'+
   '<div class="d-sharebar d-sharebar-flat"><button class="d-btn d-btn-ghost d-btn-sm" data-a="share">'+ic("whatsapp","sm")+'Share on WhatsApp</button><button class="d-btn d-btn-ghost d-btn-sm" data-a="copy">'+ic("copy","sm")+'Copy invite link</button></div>'+
   '<div class="d-note">'+ic("shield","sm")+'<span>Your phone number is verified, so people know who is hosting. ID verification unlocks drives of more than 15 people.</span></div>';
  return '<div class="d-drive-form"><header class="d-m-head"><span class="d-eyebrow"><span class="d-eb-dot"></span>'+esc(t("startDrive"))+'</span><button class="d-icbtn d-m-x" data-a="close" aria-label="Close">'+ic("x","md")+'</button></header>'+
   '<ol class="d-steps" aria-label="Step '+st+' of 3">'+steps.map((s,i)=>'<li class="'+(i+1<st?'is-done':i+1===st?'is-on':'')+'"><span class="num">'+(i+1<st?ic("check","sm"):i+1)+'</span>'+s+'</li>').join("")+'</ol>'+
   '<div class="d-drive-body d-swap">'+body+'</div>'+
   '<footer class="d-m-foot">'+(st>1?'<button class="d-btn d-btn-ghost" data-a="dback">'+ic("back","sm")+'Back</button>':'<button class="d-btn d-btn-ghost" data-a="close">Cancel</button>')+'<span class="d-grow"></span>'+
   (st<3?'<button class="d-btn d-btn-tide" data-a="dnext">Next'+ic("arrowr","sm")+'</button>':'<button class="d-btn d-btn-tide" data-a="dcreate">'+ic("check","sm")+'Create drive</button>')+'</footer></div>'+
   '<aside class="d-drive-prev" aria-label="Invite preview">'+previewHTML()+'</aside>';
}
function previewHTML(){
  const d=S.draftDrive,c=KIND_CAUSE[d.cause]||"hand",day=LONGDAY[d.when]||d.when;
  return '<div class="d-prev-k"><i class="d-live" aria-hidden="true"></i>Live preview<span>Updates as you type</span></div>'+
  '<div class="d-wa"><div class="d-wa-h"><span class="d-wa-av">'+tile("paw",34)+'</span><span><b>Green Lane neighbours</b><small>128 members</small></span>'+ic("more","sm")+'</div>'+
  '<div class="d-wa-body"><span class="d-wa-day">Today</span>'+
   '<div class="d-wa-bub"><div class="d-wa-card"><span class="d-wa-art">'+cover({id:"drive-"+c+d.title.length%4,cause:c})+'</span><span class="d-wa-meta"><b>'+esc(d.title||"Untitled drive")+'</b><small>'+esc(day)+', '+esc(d.slot)+' · '+esc(d.place||"Meeting place")+'</small><em>ekoo.in/d/green-lane</em></span></div>'+
   '<p>Hi neighbours! I am organising <b>'+esc(d.title||"a drive")+'</b> on '+esc(day)+' at '+esc(d.slot)+', meeting at '+esc(d.place||"a spot nearby")+'. We need '+d.helpers+' helpers. Tap the link to join.</p>'+
   '<span class="d-wa-time">7:42 pm<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8.5l4 4L13 3.5M9 12.5L17 3.5M11 10l2.5 2.5L22 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>'+
   '<div class="d-wa-react"><span class="d-wa-them">Count me in! '+esc(day.split(" ")[0])+' works for me.<small>Meena · 7:44 pm</small></span></div>'+
  '</div></div>'+
  '<div class="d-prev-stats"><span><b class="num">'+d.helpers+'</b>helpers needed</span><span><b class="num">128</b>neighbours will see it</span></div>';
}
function askHTML(){
  const a=S.draftAsk;
  const pick=(k,vals)=>'<div class="d-chips d-chips-wrap" role="group">'+vals.map(v=>'<button class="d-chip" data-a="aset" data-f="'+k+'" data-k="'+v+'" aria-pressed="'+(a[k]===v)+'">'+v+'</button>').join("")+'</div>';
  return '<header class="d-m-head"><span class="d-press">'+tile("heart",44)+'</span><span class="d-grow"></span><button class="d-icbtn d-m-x" data-a="close" aria-label="Close">'+ic("x","md")+'</button></header>'+
  '<h2 class="d-m-title" id="mTitle">'+esc(t("askHelp"))+'</h2><p class="d-m-sub">Two quick fields. Verified neighbours within 3 km will see it.</p>'+
  '<label class="d-field"><span>What do you need?</span><textarea class="d-input" rows="3" data-bind="what" maxlength="140" placeholder="For example: carry two bags upstairs" data-autofocus>'+esc(a.what)+'</textarea><small class="d-cnt num">'+a.what.length+'/140</small></label>'+
  '<div class="d-field"><span>How long will it take?</span>'+pick("len",["15 min","30 min","1 hour"])+'</div>'+
  '<div class="d-field"><span>When?</span>'+pick("when",["Today","Tomorrow","This weekend"])+'</div>'+
  '<div class="d-note d-note-lock">'+ic("lock","sm")+'<span>Only verified neighbours within 3 km will see this. Your exact address stays private until you accept someone.</span></div>'+
  '<footer class="d-m-foot"><button class="d-btn d-btn-ghost" data-a="close">Cancel</button><span class="d-grow"></span><button class="d-btn d-btn-tide" data-a="post">'+ic("send","sm")+'Post request</button></footer>';
}
function feedbackHTML(){
  const h=HISTORY.find(x=>x.id===D.modal.id)||HISTORY[0],v=D.modal.fb||"";
  const face=(k,i,l)=>'<button class="d-face d-face-'+k+'" data-a="face" data-k="'+k+'" aria-pressed="'+(v===k)+'">'+ic(i)+'<span>'+l+'</span></button>';
  let after="";
  if(v==="good")after='<div class="d-trust d-trust-tide d-swap"><span class="d-trust-ic">'+ic("heart")+'</span><div><b>Glad to hear it</b><span>The next meal drive is Saturday, 9 am. 6 spots left.</span></div></div><div class="d-m-actions"><button class="d-btn d-btn-ghost" data-a="fbdone" data-k="skip">Not now</button><button class="d-btn d-btn-sun" data-a="fbdone" data-k="again">Join next Saturday'+ic("arrowr","sm")+'</button></div>';
  else if(v)after='<p class="d-m-sub d-swap">Thanks. We will tell the host what to improve. Your name is not shared.</p><button class="d-btn d-btn-ink d-btn-block" data-a="fbdone" data-k="skip">Send feedback</button>';
  return '<button class="d-icbtn d-m-x" data-a="close" aria-label="Close">'+ic("x","md")+'</button>'+
  '<span class="d-press d-fb-tile">'+tile(h.cause,56)+'</span><h2 class="d-m-title" id="mTitle">How was it?</h2><p class="d-m-sub">'+esc(h.title)+' · '+esc(h.when)+'</p>'+
  '<div class="d-faces" role="group" aria-label="Rate your experience">'+face("good","smile","Great")+face("ok","meh","Okay")+face("bad","frown","Not good")+'</div>'+after;
}
function updatePreview(){const p=$(".d-drive-prev");if(p)p.innerHTML=previewHTML()}

/* ---------- confetti ---------- */
function confetti(){
  if(reduced()||!root)return;
  const cv=$(".d-confetti");if(!cv)return;
  const W=root.clientWidth,H=root.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=W*dpr;cv.height=H*dpr;const ctx=cv.getContext("2d");ctx.scale(dpr,dpr);
  const cs=getComputedStyle(root);const cols=["--sun","--tide","--coral","--mint","--leaf","--sky"].map(v=>cs.getPropertyValue(v).trim()||"#FBE33B");
  const card=$(".d-m-success");const r=card?card.getBoundingClientRect():null,rr=root.getBoundingClientRect();
  const ox=r?r.left-rr.left+r.width/2:W/2,oy=r?r.top-rr.top+110:H/3;
  const P=[];for(let i=0;i<150;i++){const a=-Math.PI/2+(Math.random()-.5)*Math.PI*1.25,sp=6+Math.random()*10;
    P.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,w:6+Math.random()*7,h:4+Math.random()*5,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[i%cols.length],s:Math.random()<.35})}
  const t0=performance.now();
  cancelAnimationFrame(raf);
  const step=now=>{if(!root)return;const el=(now-t0)/1400;ctx.clearRect(0,0,W,H);
    if(el>=1){ctx.clearRect(0,0,W,H);return}
    P.forEach(p=>{p.vy+=.32;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.globalAlpha=el<.7?1:1-(el-.7)/.3;ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;
      if(p.s){ctx.beginPath();ctx.arc(0,0,p.h*.7,0,Math.PI*2);ctx.fill()}else ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h*Math.abs(Math.cos(p.r*2))+1);ctx.restore()});
    raf=requestAnimationFrame(step)};
  raf=requestAnimationFrame(step);
}

/* =========================================================
   POPOVERS (create menu, notifications)
   ========================================================= */
const NOTIFS=[
  {c:"hand",k:"openreq",id:"r1",t:"Mrs Kaur needs help today at 5 pm",s:"400 m away · Read out pharmacy bills",ago:"12 min"},
  {c:"leaf",k:"nav",id:"community",t:"Green Ward Society posted an update",s:"14 saplings planted at the canal park",ago:"2 h"},
  {c:"book",k:"nav",id:"me",t:"Your certificate is ready",s:"Disha Learning Trust · 6 hours of reading",ago:"1 d"}
];
function openPop(kind,anchor){
  if(D.pop===kind){closePop();return}
  closePop();D.pop=kind;
  const host=$(".d-pop-host"),rr=root.getBoundingClientRect(),ar=anchor.getBoundingClientRect();
  let html="";
  if(kind==="create")html='<div class="d-pop d-pop-create" role="menu" aria-label="Create"><p class="d-pop-k">Create</p>'+
    '<button class="d-pop-i" role="menuitem" data-a="drive">'+tile("users",44)+'<span><b>'+esc(t("startDrive"))+'</b><small>Gather neighbours for a clean-up, feeding or tutoring</small></span></button>'+
    '<button class="d-pop-i" role="menuitem" data-a="ask">'+tile("heart",44)+'<span><b>'+esc(t("askHelp"))+'</b><small>Ask verified neighbours nearby. Two fields</small></span></button></div>';
  else html='<div class="d-pop d-pop-notif" role="dialog" aria-label="Notifications"><div class="d-pop-head"><b>Notifications</b><button class="d-link" data-a="readall">Mark all as read</button></div>'+
    NOTIFS.map(n=>'<button class="d-notif'+(D.notifRead?'':' is-new')+'" data-a="'+n.k+'" data-k="'+n.id+'">'+tile(n.c,40)+'<span><b>'+esc(n.t)+'</b><small>'+esc(n.s)+'</small></span><em>'+n.ago+'</em></button>').join("")+
    '<p class="d-pop-foot">'+ic("bell","sm")+'Reminders arrive 1 hour before each plan</p></div>';
  host.innerHTML=html;const p=host.firstChild;
  if(kind==="create"){p.style.left=(ar.right-rr.left+12)+"px";p.style.top=(ar.top-rr.top-8)+"px"}else{p.style.right=(rr.right-ar.right)+"px";p.style.top=(ar.bottom-rr.top+10)+"px"}
  anchor.setAttribute("aria-expanded","true");
  const f=p.querySelector("button");f&&f.focus({preventScroll:true});
}
function closePop(){
  if(!D.pop||!root)return;D.pop=null;
  $$('[aria-expanded="true"][data-a="pop"]').forEach(b=>b.setAttribute("aria-expanded","false"));
  const p=$(".d-pop");if(p){p.classList.add("is-out");later(()=>{if(!D.pop)$(".d-pop-host").innerHTML=""},160)}
}

/* =========================================================
   TOASTS
   ========================================================= */
function toast(msg,icon){
  const host=$(".d-toasts");if(!host)return;
  const el=document.createElement("div");el.className="d-toast";
  el.innerHTML='<span class="d-toast-ic">'+ic(icon||"check","sm")+'</span><span>'+esc(msg)+'</span>';
  host.appendChild(el);
  while(host.children.length>3)host.firstChild.remove();
  later(()=>{el.classList.add("is-out");later(()=>el.remove(),300)},2800);
}

/* =========================================================
   WELCOME (onboarding)
   ========================================================= */
const W_CAUSES=[["education","Children and education","book"],["food","Food and hunger","bowl"],["green","Trees and parks","leaf"],["elders","Elders and health","elder"],["animals","Animals","paw"],["neighbour","Neighbourhood help","hand"]];
function renderWelcome(){
  const host=$(".d-welcome-host");
  if(S.onboarded){if(host.firstChild&&!host.firstChild.classList.contains("is-out")){host.firstChild.classList.add("is-out");later(()=>{if(S.onboarded)host.innerHTML=""},600)}return}
  const st=S.step||0,p=S.prefs;
  const opt=(k,v,l,s,c)=>'<button class="d-opt" role="radio" aria-checked="'+(p[k]===v)+'" data-a="pref" data-f="'+k+'" data-k="'+v+'">'+(c?'<span class="d-press">'+tile(c,44)+'</span>':'')+'<span class="d-opt-t"><b>'+l+'</b><small>'+s+'</small></span><span class="d-radio"><i></i></span></button>';
  let body="",cta="Continue",ok=true;
  if(st===0)body='<p class="d-eyebrow">Step 1 of 3</p><h1 class="d-wl-h" id="wTitle">What do you care about?</h1><p class="d-wl-p">Pick any. This only orders what you see first, and you can change it later.</p>'+
    '<div class="d-wl-causes" role="group" aria-label="Causes">'+W_CAUSES.map(c=>{const on=p.causes.includes(c[0]);return '<button class="d-wc" data-a="wcause" data-k="'+c[0]+'" aria-pressed="'+on+'"><span class="d-press">'+tile(c[2],44)+'</span><span>'+c[1]+'</span><span class="d-wc-ck">'+ic("check","sm")+'</span></button>'}).join("")+'</div>';
  if(st===1){body='<p class="d-eyebrow">Step 2 of 3</p><h1 class="d-wl-h" id="wTitle">How much time do you have?</h1><p class="d-wl-p">Most people start with under five hours a month. Starting small works.</p><div class="d-opts" role="radiogroup" aria-label="Time">'+
    opt("time","short","15 to 30 minutes","Quick tasks, some from home","heart")+opt("time","hour","1 to 2 hours","A single session nearby","book")+opt("time","weekend","A weekend morning","Bigger group activities","leaf")+opt("time","regular","Every week","A regular slot you keep","elder")+'</div>';ok=!!p.time}
  if(st===2){body='<p class="d-eyebrow">Step 3 of 3</p><h1 class="d-wl-h" id="wTitle">How would you like to help?</h1><p class="d-wl-p">Both are welcome. Many people do both.</p><div class="d-opts" role="radiogroup" aria-label="Way to help">'+
    opt("way","org","With an organisation","Verified NGOs and groups, with a plan for the day","book")+opt("way","direct","For neighbours","Everyday help, close to home","hand")+opt("way","both","Both","See the two side by side","users")+'</div>';cta="See what is near you";ok=!!p.way}
  const fresh=!host.querySelector(".d-welcome:not(.is-out)");
  if(fresh)host.innerHTML='<div class="d-welcome" role="dialog" aria-modal="true" aria-labelledby="wTitle"><aside class="d-wl-art">'+
    '<div class="d-wl-brand">'+mark()+'<span>ekoo</span></div><div class="d-wl-orbs" aria-hidden="true"><span class="d-wo d-wo-sun"></span><span class="d-wo d-wo-tide"></span><span class="d-wo d-wo-mint"></span></div>'+
    '<div class="d-wl-copy"><p class="d-wl-big">Help is closer than you think.</p><p class="d-wl-stat"><b class="num">88%</b><span>of volunteering in India happens between neighbours, not through organisations.</span></p></div>'+
    '<p class="d-wl-src">Sources: UNV/ILO 2026, CRY × Grant Thornton Bharat. Two paths, one app: join an organised activity, or help someone nearby.</p></aside>'+
    '<section class="d-wl-flow"><header class="d-wl-top"><div class="d-wl-prog" aria-hidden="true"><i></i><i></i><i></i></div><button class="d-btn d-btn-ghost d-btn-sm" data-a="wskip">Skip</button></header><div class="d-wl-step"></div><footer class="d-wl-foot"></footer></section></div>';
  const w=host.querySelector(".d-welcome");
  $$(".d-wl-prog i",w).forEach((el,i)=>el.classList.toggle("is-on",i<=st));
  const s=w.querySelector(".d-wl-step");s.innerHTML='<div class="d-swap">'+body+'</div>';
  w.querySelector(".d-wl-foot").innerHTML=(st>0?'<button class="d-btn d-btn-ghost" data-a="wback">'+ic("back","sm")+'Back</button>':'<span class="d-fine">'+ic("lock","sm")+'No sign-up needed to look around</span>')+'<span class="d-grow"></span><button class="d-btn d-btn-sun d-btn-lg" data-a="wnext"'+(ok?'':' disabled')+'>'+cta+ic("arrowr","sm")+'</button>';
}
function finishWelcome(skip){
  A.finishOnboarding(!!skip);
  D.screen="home";D.enter=true;
  renderRail();renderTop();renderMain();renderWelcome();notify();
}

/* =========================================================
   EVENTS
   ========================================================= */
function onClick(e){
  const el=e.target.closest("[data-a]");
  if(D.pop&&!e.target.closest(".d-pop")&&!(el&&el.dataset.a==="pop"))closePop();
  if(D.callout&&!e.target.closest(".d-callout")&&!e.target.closest(".d-pin")&&e.target.closest(".d-map-svg"))setCallout(null);
  if(!el||el.disabled)return;
  const a=el.dataset.a,k=el.dataset.k;
  switch(a){
    case"nav":
      if(k==="help"){S.mode="help";go("home")}
      else if(k==="home"){if(D.screen==="home"&&S.mode==="help"){switchMode("join");closePop();return}S.mode="join";go("home")}
      else go(k);
      closeLayers();break;
    case"rail":D.rail=!railMin();if(!D.rail)D.autoMin=false;applyRail();renderRail();break;
    case"pop":openPop(k,el);break;
    case"lang":A.setLang(k);renderRail();renderTop();renderMain(true);if(D.drawer)renderDrawer();if(D.modal&&D.modal.kind!=="success")renderModal();break;
    case"theme":EK.toggleTheme();break;
    case"appear":if((k==="dark")!==!!EK.isDark())EK.toggleTheme();break;
    case"loc":toast("Showing places within 3 km of Jayanagar","pin");break;
    case"mode":switchMode(k);break;
    case"time":S.time=k;renderResults();break;
    case"cause":S.cause=k;renderResults();break;
    case"hf":D.hf=k;renderResults();break;
    case"hfall":D.hf="all";renderResults();break;
    case"reset":S.time="any";S.cause="all";S.query="";const si=$(".d-search-in");if(si)si.value="";renderResults();break;
    case"view":D.view=k;D.callout=null;renderResults();break;
    case"open":closePop();if(D.modal)closeModal();setCallout(null);openDrawer({kind:"opp",id:k,step:"info",slot:0});break;
    /* "I can help" on a card opens the request first, so safety tips come before commitment */
    case"openreq":closePop();if(D.modal)closeModal();openDrawer({kind:"req",id:k});break;
    case"chat":closePop();A.openChat(k);openDrawer({kind:"chat",id:k});break;
    case"offer":A.offer(k);toast("Offer sent. "+req(k).who+" has been told","hand");openDrawer({kind:"chat",id:k});renderRail();if(D.screen==="home")renderResults();break;
    case"say":sendMsg(k);break;
    case"save":{const on=A.save(k);$$('[data-a="save"][data-k="'+k+'"]').forEach(b=>{b.setAttribute("aria-pressed",on);b.classList.toggle("is-on",on);
        if(b.classList.contains("d-btn"))b.innerHTML=ic("heart",on?"sm fill":"sm")+(on?"Saved":"Save");else b.innerHTML=ic("heart",on?"md fill":"md");b.classList.remove("d-popanim");void b.offsetWidth;if(on)b.classList.add("d-popanim")});
      toast(on?"Saved. Find it again in Activity":"Removed from saved","heart");if(D.screen==="activity"){const r=$(".d-act-r");if(r)r.outerHTML=actAside()}break}
    case"slots":D.drawer.step="slots";D.drawer.slot=0;renderDrawer(true);break;
    case"slotsback":D.drawer.step="info";renderDrawer(true);break;
    case"slot":D.drawer.slot=+k;$$(".d-slot").forEach((b,i)=>b.setAttribute("aria-checked",String(i===+k)));el.focus({preventScroll:true});break;
    case"confirm":{const id=D.drawer.id;A.join(id,D.drawer.slot||0);closeDrawer();openModal({kind:"success",id});renderRail();if(D.screen==="home")renderResults();else renderMain(true);break}
    case"toact":closeDrawer();closeModal();go("activity",{actTab:"up"});break;
    case"backhome":closeModal();S.mode="join";go("home");break;
    case"close":if(D.modal)closeModal();else if(D.drawer)closeDrawer();break;
    case"share":toast("Opening WhatsApp with an invite link","whatsapp");break;
    case"copy":toast("Invite link copied","copy");break;
    case"cal":toast("Added to your calendar","cal");break;
    case"fin":toast("Opening the published accounts","arrowur");break;
    case"report":toast("Thanks. Our team will review this within a day","flag");break;
    case"cert":toast("Certificate saved","award");break;
    case"toast":toast(k,"info");break;
    case"research":EK.openResearch&&EK.openResearch();break;
    case"zin":D.map.z=Math.min(3.4,D.map.z*1.5);positionMap(true);break;
    case"zout":D.map.z=Math.max(.6,D.map.z/1.5);positionMap(true);break;
    case"recenter":D.map=mapDefault();positionMap(true);break;
    case"cox":setCallout(null);break;
    case"drive":closePop();if(D.drawer)closeDrawer();S.draftDrive.step=1;openModal({kind:"drive"});break;
    case"ask":closePop();if(D.drawer)closeDrawer();openModal({kind:"ask"});break;
    case"dset":S.draftDrive[el.dataset.f]=k;rerenderDriveBody(el);break;
    case"hstep":S.draftDrive.helpers=Math.max(1,Math.min(40,S.draftDrive.helpers+(+k)));{const o=$(".d-stepper output");if(o)o.textContent=S.draftDrive.helpers;const sm=$(".d-stepper small");if(sm)sm.textContent=S.draftDrive.helpers>15?"Over 15 needs an ID check":"Up to 15 with a verified phone"}updatePreview();break;
    case"dnext":S.draftDrive.step=Math.min(3,S.draftDrive.step+1);renderModal();break;
    case"dback":S.draftDrive.step=Math.max(1,S.draftDrive.step-1);renderModal();break;
    case"dgo":S.draftDrive.step=+k;renderModal();break;
    case"dcreate":A.createDrive();closeModal();go("activity",{actTab:"up"});toast("Drive created. Neighbours can now join","users");break;
    case"aset":S.draftAsk[el.dataset.f]=k;$$('[data-a="aset"][data-f="'+el.dataset.f+'"]').forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.k===k)));break;
    case"post":A.postAsk();closeModal();S.mode="help";D.hf="all";go("home");toast("Request posted to verified neighbours nearby","send");break;
    case"group":{const on=A.group(k);const li=el.closest(".d-grp");if(li)li.outerHTML=groupRow(GROUPS.find(g=>g.id===k));toast(on?"You joined "+GROUPS.find(g=>g.id===k).name:"You left the group","users");
      if(D.screen==="community"){const l=$(".d-comm-l .d-panel");if(l){const mine=GROUPS.filter(g=>S.groups[g.id]);l.innerHTML='<h2 class="d-panel-t">Your groups</h2>'+(mine.length?'<ul class="d-mini-list">'+mine.map(g=>'<li>'+tile(g.cause,32)+'<span><b>'+esc(g.name)+'</b><small>'+g.members+' members</small></span></li>').join("")+'</ul>':'<p class="d-muted">Join a group to see its updates first.</p>')}}break}
    case"like":{A.like(k);const p=POSTS.find(x=>x.id===k),on=!!S.liked[k],n=p.likes+(on?1:0);el.classList.toggle("is-on",on);el.setAttribute("aria-pressed",on);el.setAttribute("aria-label","Thank, "+n+" thanks");
      el.innerHTML=ic("heart",on?"fill":"")+'<b class="num">'+n+'</b><span>thanks</span>';el.classList.remove("d-popanim");void el.offsetWidth;if(on){el.classList.add("d-popanim");burst(el)}break}
    case"atab":if(D.actTab===k)return;D.actTab=k;{const s=$(".d-seg2");if(s){s.dataset.on=k;$$(".d-seg2 [role=tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.k===k)))}const b=$(".d-act-body");if(b){b.innerHTML=k==="up"?upHTML():pastHTML();b.classList.remove("d-swap");void b.offsetWidth;b.classList.add("d-swap")}}break;
    case"fb":openModal({kind:"feedback",id:k,fb:""});break;
    case"face":D.modal.fb=k;renderModal();{const b=$('.d-face[data-k="'+k+'"]');b&&b.focus({preventScroll:true})}break;
    case"fbdone":{const v=D.modal.fb||"good";A.feedback(D.modal.id,v);closeModal();
      if(k==="again"){A.join("meals");toast("You are in for Saturday, 9 am","check")}else toast("Thanks for the feedback","heart");
      renderRail();renderMain(true);break}
    case"set":S.settings[k]=!S.settings[k];el.setAttribute("aria-checked",String(S.settings[k]));if(k==="large")root.classList.toggle("d-large",S.settings.large);if(k==="showHours"){renderRail();renderMain(true)}break;
    case"readall":D.notifRead=true;$$(".d-notif").forEach(n=>n.classList.remove("is-new"));$(".d-bell")&&$(".d-bell").classList.remove("has-dot");break;
    case"wcause":{const c=S.prefs.causes,i=c.indexOf(k);if(i>-1)c.splice(i,1);else c.push(k);el.setAttribute("aria-pressed",String(i<0));break}
    case"pref":S.prefs[el.dataset.f]=k;$$('.d-opt[data-f="'+el.dataset.f+'"]').forEach(b=>b.setAttribute("aria-checked",String(b.dataset.k===k)));{const n=$('[data-a="wnext"]');if(n)n.disabled=false}break;
    case"wnext":if((S.step||0)<2){S.step=(S.step||0)+1;renderWelcome();focusWelcome()}else finishWelcome(false);break;
    case"wback":S.step=Math.max(0,(S.step||0)-1);renderWelcome();focusWelcome();break;
    case"wskip":finishWelcome(true);break;
  }
}
function focusWelcome(){later(()=>{const h=$(".d-wl-h");if(h){h.setAttribute("tabindex","-1");h.focus({preventScroll:true})}},30)}
function rerenderDriveBody(el){
  const f=el.dataset.f,k=el.dataset.k;
  $$('[data-a="dset"][data-f="'+f+'"]').forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.k===k)));
  updatePreview();
}
function closeLayers(){if(D.modal)closeModal();if(D.drawer)closeDrawer()}
function burst(el){
  if(reduced())return;
  const b=document.createElement("span");b.className="d-burst";b.setAttribute("aria-hidden","true");
  for(let i=0;i<8;i++){const s=document.createElement("i");s.style.setProperty("--a",(i*45)+"deg");b.appendChild(s)}
  el.appendChild(b);later(()=>b.remove(),700);
}
function onInput(e){
  const el=e.target;
  if(el.classList.contains("d-search-in")){
    S.query=el.value;
    if(D.screen!=="home"){D.screen="home";renderRail();renderMain();notify()}else renderResults();
    return;
  }
  const b=el.dataset&&el.dataset.bind;if(!b)return;
  if(D.modal&&D.modal.kind==="drive"){S.draftDrive[b]=el.value;updatePreview();const c=el.parentNode.querySelector(".d-cnt");if(c)c.textContent=el.value.length+"/60"}
  if(D.modal&&D.modal.kind==="ask"){S.draftAsk[b]=el.value;const c=el.parentNode.querySelector(".d-cnt");if(c)c.textContent=el.value.length+"/140"}
}
function onSubmit(e){
  const f=e.target.closest("[data-form]");if(!f)return;e.preventDefault();
  if(f.dataset.form==="chat"){const i=f.querySelector("input");const v=i.value;i.value="";sendMsg(v)}
}
function topLayer(){
  if(!S.onboarded)return $(".d-welcome");
  if(D.pop)return $(".d-pop");
  if(D.modal)return $(".d-modal");
  if(D.drawer)return $(".d-drawer");
  return null;
}
function onKey(e){
  if(!root)return;
  if((e.metaKey||e.ctrlKey)&&(e.key==="k"||e.key==="K")){
    if(!S.onboarded)return;e.preventDefault();closeLayers();closePop();const s=$(".d-search-in");if(s){s.focus();s.select()}return}
  if(e.key==="Escape"){
    if(D.pop){closePop();e.preventDefault();return}
    if(D.modal){closeModal();e.preventDefault();return}
    if(D.drawer){if(D.drawer.kind==="opp"&&D.drawer.step==="slots"){D.drawer.step="info";renderDrawer(true)}else closeDrawer();e.preventDefault();return}
    if(D.callout){setCallout(null);return}
    const s=$(".d-search-in");if(s&&(document.activeElement===s||S.query)){if(S.query){S.query="";s.value="";renderResults()}else s.blur()}
    return;
  }
  if(e.key==="Tab"){
    const L=topLayer();if(!L)return;
    const f=$$('button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])',L).filter(x=>x.offsetParent!==null||x.getClientRects().length);
    if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(!L.contains(document.activeElement)){e.preventDefault();first.focus();return}
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    return;
  }
  if((e.key==="Enter"||e.key===" ")&&e.target.closest&&e.target.closest(".d-pin")){e.preventDefault();pinActivate(e.target.closest(".d-pin").dataset.pin)}
  if((e.key==="ArrowDown"||e.key==="ArrowUp")&&e.target.closest&&e.target.closest('[role="radiogroup"]')){
    const g=e.target.closest('[role="radiogroup"]'),items=$$('[role="radio"]',g),i=items.indexOf(e.target.closest('[role="radio"]'));
    if(i>-1){e.preventDefault();const n=items[(i+(e.key==="ArrowDown"?1:items.length-1))%items.length];n.focus();n.click()}
  }
}
function pinActivate(id){if(D.callout===id){setCallout(null)}else setCallout(id)}
function onOver(e){
  if(drag)return;
  const c=e.target.closest&&(e.target.closest("[data-card]")||e.target.closest("[data-pin]"));
  const id=c?(c.dataset.card||c.dataset.pin):null;
  if(c&&c.closest(".d-drawer"))return;
  setHot(id);
}
function onPointerDown(e){
  const svg=e.target.closest&&e.target.closest(".d-map-svg");
  if(!svg)return;
  const pin=e.target.closest(".d-pin");
  if(pin){e.preventDefault();pinActivate(pin.dataset.pin);return}
  drag={x:e.clientX,y:e.clientY,cx:D.map.cx,cy:D.map.cy,moved:false,id:e.pointerId};
  try{svg.setPointerCapture(e.pointerId)}catch(err){}
}
function onPointerMove(e){
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<4)return;
  if(!drag.moved){drag.moved=true;const m=$(".d-map");m&&m.classList.add("is-drag")}
  const s=D.mapSize,k=Math.min(s.w/760,s.h/470)*D.map.z;
  D.map.cx=Math.max(150,Math.min(900,drag.cx-dx/k));D.map.cy=Math.max(120,Math.min(560,drag.cy-dy/k));
  positionMap(false);
}
function onPointerUp(){if(!drag)return;const m=$(".d-map");m&&m.classList.remove("is-drag");drag=null}
function onMainScroll(){const m=$(".d-main"),tp=$(".d-top");if(m&&tp)tp.classList.toggle("is-scrolled",m.scrollTop>4)}
function onTheme(){if(!root)return;renderTop();renderRail();renderMain(true);if(D.modal&&D.modal.kind!=="success")renderModal()}

function applyRail(){root.classList.toggle("is-rail-min",railMin())}
function onResize(){
  if(!root)return;
  const w=root.clientWidth;
  const narrow=w<1100,autoMin=w<1060;
  const changed=narrow!==D.narrow;
  D.narrow=narrow;if(autoMin!==D.autoMin){D.autoMin=autoMin;applyRail();renderRail()}
  if(changed&&S.onboarded&&D.screen==="home")renderResults();
  measureFilters();
}

/* =========================================================
   PUBLIC API
   ========================================================= */
function mount(el){
  if(root)unmount();
  root=document.createElement("div");root.className="d-app";
  root.innerHTML='<aside class="d-rail" aria-label="Sidebar"></aside><div class="d-content"><header class="d-top"></header><main class="d-main" tabindex="-1"></main></div>'+
   '<div class="d-drawer-host"></div><div class="d-modal-host"></div><div class="d-pop-host"></div><div class="d-welcome-host"></div>'+
   '<div class="d-toasts" role="status" aria-live="polite"></div><canvas class="d-confetti" aria-hidden="true"></canvas>';
  el.appendChild(root);
  root.addEventListener("click",onClick);
  root.addEventListener("input",onInput);
  root.addEventListener("submit",onSubmit);
  root.addEventListener("mouseover",onOver);
  root.addEventListener("pointerdown",onPointerDown);
  root.addEventListener("pointermove",onPointerMove);
  root.addEventListener("pointerup",onPointerUp);
  root.addEventListener("pointercancel",onPointerUp);
  root.addEventListener("mouseleave",()=>setHot(null));
  document.addEventListener("keydown",onKey);
  document.addEventListener("ek-theme",onTheme);
  root.querySelector(".d-main").addEventListener("scroll",onMainScroll,{passive:true});
  D.narrow=root.clientWidth<1100;D.autoMin=root.clientWidth<1060;applyRail();
  if(window.ResizeObserver){const ro=new ResizeObserver(onResize);ro.observe(root);ros.push(ro)}
  if(!S.onboarded)S.step=S.step||0;
  D.lastKey=null;D.map=mapDefault();
  renderAll();
}
function unmount(){
  if(!root)return;
  document.removeEventListener("keydown",onKey);
  document.removeEventListener("ek-theme",onTheme);
  ros.forEach(r=>r.disconnect());ros=[];if(mapRO){mapRO.disconnect();mapRO=null}
  timers.forEach(clearTimeout);timers=[];cancelAnimationFrame(raf);
  root.remove();root=null;D.drawer=null;D.modal=null;D.pop=null;D.callout=null;D.typing=false;drag=null;
}
function jump(key){
  if(!root)return;
  closePop();
  const hostD=$(".d-drawer-host"),hostM=$(".d-modal-host");
  D.drawer=null;D.modal=null;D.typing=false;hostD.innerHTML="";hostM.innerHTML="";D.callout=null;
  if(key==="welcome"){S.onboarded=false;S.step=0;$(".d-welcome-host").innerHTML="";renderWelcome();notify();return}
  const wasOn=S.onboarded;S.onboarded=true;
  if(!wasOn)$(".d-welcome-host").innerHTML="";
  const home=(mode)=>{S.mode=mode;D.screen="home"};
  switch(key){
    case"home":home("join");S.time="any";S.cause="all";S.query="";break;
    case"help":home("help");D.hf="all";break;
    case"detail":home("join");break;
    case"success":home("join");S.joined.reading="Tue, 6 pm";break;
    case"request":home("help");break;
    case"chat":home("help");A.offer("r1");break;
    case"drive":S.draftDrive.step=1;if(D.screen!=="home"&&D.screen!=="community")home("join");break;
    case"ask":home("help");break;
    case"community":D.screen="community";break;
    case"activity":D.screen="activity";D.actTab="up";break;
    case"feedback":D.screen="activity";D.actTab="past";break;
    case"me":D.screen="me";break;
  }
  D.map=mapDefault();
  renderRail();renderTop();renderMain();
  if(key==="detail")openDrawer({kind:"opp",id:"reading",step:"info",slot:0});
  if(key==="success")openModal({kind:"success",id:"reading"});
  if(key==="request")openDrawer({kind:"req",id:"r1"});
  if(key==="chat")openDrawer({kind:"chat",id:"r1"});
  if(key==="drive")openModal({kind:"drive"});
  if(key==="ask")openModal({kind:"ask"});
  if(key==="feedback")openModal({kind:"feedback",id:"h1",fb:"good"});
  notify();
}
window.DesktopView={mount,unmount,jump};
})();
