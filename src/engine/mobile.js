/* =========================================================
   ekoo — MOBILE renderer (native iOS-style)
   window.MobileView = { mount(el,{framed}), unmount(), jump(key) }
   Navigation stack per tab, interactive edge swipe, sheets with detents,
   Dynamic Island notifications, context menu, pull to refresh.
   ========================================================= */
(function(){
"use strict";
const EK=window.EK;
const {ic,S,A,esc,OPPS,REQS,GROUPS,POSTS,HISTORY,USER,TIPS,CAUSES}=EK;
const t=k=>EK.t(k);

/* ---------- local strings (EN / HI) ---------- */
const LS={
  nearYou:{en:"Near you",hi:"आपके पास"},
  area:{en:"Jayanagar · 3 km",hi:"जयनगर · 3 किमी"},
  closest:{en:"Closest first",hi:"सबसे पास पहले"},
  acts:{en:"activities near you",hi:"गतिविधियाँ पास में"},
  reqs:{en:"Requests near you",hi:"आपके पास के अनुरोध"},
  back:{en:"Back",hi:"वापस"},
  seeDetails:{en:"See details",hi:"विवरण देखें"},
  upNext:{en:"Up next",hi:"आगे"},
  groupsNear:{en:"Groups near you",hi:"आपके पास के समूह"},
  fromGroups:{en:"From your groups",hi:"आपके समूहों से"},
  firstSub:{en:"Write thank-you cards for hospital staff. No travel, no sign-up forms.",hi:"अस्पताल कर्मचारियों के लिए धन्यवाद कार्ड लिखें। न यात्रा, न फ़ॉर्म।"},
  mins20:{en:"20 minutes · from home",hi:"20 मिनट · घर से"}
};
const L=k=>(LS[k]&&(LS[k][S.lang]||LS[k].en))||t(k);

/* ---------- filled tab icons ---------- */
const FI={
  home:'<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/>',
  users:'<circle cx="9" cy="7.8" r="3.5" fill="currentColor"/><path d="M2.6 20.6c0-3.7 2.9-6.6 6.4-6.6s6.4 2.9 6.4 6.6z" fill="currentColor"/><circle cx="17.3" cy="8.7" r="2.7" fill="currentColor"/><path d="M16.4 13.7c3.2-.2 5.6 2.4 5.6 5.4v1.5h-4.6c0-2.8-.4-4.9-1-6.9z" fill="currentColor"/>',
  cal:'<path stroke="none" fill="currentColor" fill-rule="evenodd" d="M6 4.6h12a2.6 2.6 0 0 1 2.6 2.6v12.2A2.6 2.6 0 0 1 18 22H6a2.6 2.6 0 0 1-2.6-2.6V7.2A2.6 2.6 0 0 1 6 4.6zM6.6 11v2.6h2.6V11zm4.1 0v2.6h2.6V11zm4.1 0v2.6h2.6V11zm-8.2 4.2v2.6h2.6v-2.6zm4.1 0v2.6h2.6v-2.6z"/><path d="M8 2.6v3.6M16 2.6v3.6"/>',
  user:'<circle cx="12" cy="7.8" r="4.3" fill="currentColor"/><path d="M3.8 21c0-4.5 3.7-7.3 8.2-7.3s8.2 2.8 8.2 7.3z" fill="currentColor"/>'
};
const tico=(n,on)=>on?'<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+FI[n]+'</svg>':ic(n);
const heartIc=on=>'<svg class="i'+(on?' fill':'')+'" viewBox="0 0 24 24" aria-hidden="true">'+EK.P.heart+'</svg>';

/* ---------- helpers ---------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const RM=()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}};
const D=ms=>RM()?0:ms;
const rubber=(x,d)=>(x*0.55*d)/(d+0.55*x);
const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],DAYF=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function rel(slot){
  const m=/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*,\s*(.+)$/.exec(slot||"");
  if(!m)return {any:true,line:"This week, any time",short:"This week",dow:"WEEK",time:"Any",diff:3,inN:"this week"};
  const d=DAYS.indexOf(m[1]),now=new Date(),diff=(d-now.getDay()+7)%7;
  const day=diff===0?"Today":diff===1?"Tomorrow":DAYF[d];
  return {line:day+", "+m[2],short:day,dow:m[1].toUpperCase(),time:m[2],diff,inN:diff===0?"today":diff===1?"tomorrow":"in "+diff+" days"};
}
const causeName=c=>(CAUSES.find(x=>x[0]===c)||[0,"Community"])[1];
const kindCause={"Neighbourhood":"hand","Food":"bowl","Trees and parks":"leaf","Animals":"paw","Education":"book"};

/* ---------- module state ---------- */
let root=null,W=null,tabbarEl=null,shadeEl=null,overlayEl=null,ctxEl=null,islandEl=null,bannerEl=null,liveEl=null,probeEl=null,welEl=null;
let framed=false,V=null,timers=new Set(),offs=[],suppressClick=false,G=null;
function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn()},ms);timers.add(id);return id}
function on(tg,ev,fn,opt){tg.addEventListener(ev,fn,opt);offs.push(()=>tg.removeEventListener(ev,fn,opt))}
function freshV(){return {tab:"home",stacks:{home:[{r:"home"}],community:[{r:"community"}],activity:[{r:"activity"}],me:[{r:"me"}]},modal:null,sheet:null,ctx:null,actSeg:"up",fbTmp:"",slot:0,busy:false,welcome:!S.onboarded,welDir:0,typing:{},seen:{},draft:{},lastKey:null,isl:null}}
const stack=()=>V.stacks[V.tab];
const topRoute=()=>{const s=stack();return s[s.length-1]};
const reflow=el=>el&&el.offsetWidth;
function topInset(){return framed?54:Math.max(12,probeEl?probeEl.offsetHeight:12)}

/* =========================================================
   Components
   ========================================================= */
function largeTitle(text,extra){return '<div class="m-lt"><h1 class="m-lt-h">'+esc(text)+'</h1>'+(extra||'')+'</div>'}
function navRoot(title){return '<header class="m-nav m-nav-root"><div class="m-nav-title">'+esc(title)+'</div></header>'}
function backLabel(){const s=stack();const prev=s[s.length-2];if(!prev)return L("back");const tt=titleOf(prev);return tt.length>11?L("back"):tt}
function navPush(title,right,cls){
  return '<header class="m-nav m-nav-push '+(cls||'')+'"><button class="m-back" data-act="back" aria-label="Back">'+ic("back")+'<span>'+esc(backLabel())+'</span></button><div class="m-nav-title">'+(title||'')+'</div><div class="m-nav-r">'+(right||'')+'</div></header>';
}
function titleOf(r){
  switch(r.r){case"home":return L("nearYou");case"community":return t("tComm");case"activity":return t("tAct");case"me":return t("tMe");
  case"detail":return "Activity";case"request":return "Request";case"chat":return (EK.req(r.id)||{}).who||"Chat"}
  return "";
}
function seg(key,items,idx,cls){
  return '<div class="m-seg '+(cls||'')+'" role="tablist" data-k="'+key+'" data-s="'+idx+'" style="--n:'+items.length+'"><span class="m-seg-thumb" aria-hidden="true"></span>'+
    items.map((it,i)=>'<button role="tab" aria-selected="'+(i===idx)+'" data-act="'+it[0]+'" data-id="'+it[1]+'">'+it[2]+'</button>').join("")+'</div>';
}
function toggle(key,onv,label){return '<button class="m-sw" role="switch" aria-checked="'+onv+'" aria-label="'+esc(label)+'" data-act="toggle" data-id="'+key+'" data-k="sw-'+key+'" data-s="'+(onv?1:0)+'"><i></i></button>'}
function chipRow(act,k,vals,cur,keep,cls){
  return '<div class="m-chips '+(cls||'')+'" data-keep="'+keep+'" role="radiogroup">'+vals.map(v=>{const val=Array.isArray(v)?v[0]:v,lab=Array.isArray(v)?v[1]:v;
    return '<button class="m-chip" role="radio" aria-checked="'+(cur===val)+'" data-act="'+act+'" data-k="'+k+'" data-id="'+esc(val)+'">'+esc(lab)+'</button>'}).join("")+'</div>';
}
function avatar(ini,cls){return '<span class="m-av '+(cls||'')+'" aria-hidden="true">'+esc(ini)+'</span>'}
function ring(frac,size){const r=(size-4)/2,c=2*Math.PI*r;return '<svg class="m-ring" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" aria-hidden="true"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" stroke-width="3.5" class="m-ring-bg"/><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" stroke-width="3.5" class="m-ring-fg" stroke-dasharray="'+c+'" stroke-dashoffset="'+(c*(1-frac))+'" transform="rotate(-90 '+size/2+' '+size/2+')"/></svg>'}

function oppCard(o,i){
  const joined=S.joined[o.id],left=o.cap-o.taken,pct=Math.round(o.taken/o.cap*100),saved=!!S.saved[o.id];
  const where=o.dist?o.dist+" km":o.where==="Online"?"Online":"From home";
  const badge=joined?ic("check","sm")+esc(t("youreIn")):(left<=4?ic("bolt","sm")+left+" spots left":esc(o.when));
  return '<div class="m-opp m-press" role="link" tabindex="0" data-act="open" data-id="'+o.id+'" data-lp="'+o.id+'" aria-label="'+esc(o.title)+'" style="--i:'+i+'">'+
   '<div class="m-opp-art">'+EK.cover(o)+'<span class="m-gtag'+(joined?' m-gtag-in':'')+'">'+badge+'</span>'+
   '<button class="m-save" data-act="save" data-id="'+o.id+'" data-k="save-'+o.id+'" data-s="'+(saved?1:0)+'" aria-pressed="'+saved+'" aria-label="'+(saved?"Remove from saved":"Save")+'">'+heartIc(saved)+'</button></div>'+
   '<div class="m-opp-b"><div class="m-opp-top"><h3>'+esc(o.title)+'</h3><span class="m-rate">'+ic("star","sm fill")+o.rating+'</span></div>'+
   '<div class="m-host">'+esc(o.host)+ic("shield","sm")+'</div>'+
   '<div class="m-meta"><span>'+ic("clock","sm")+esc(o.len)+'</span><span>'+ic(o.dist?"pin":"globe","sm")+where+'</span></div>'+
   '<div class="m-spots"><span class="m-bar"><i style="width:'+pct+'%"></i></span><span>'+left+' of '+o.cap+' spots left</span></div>'+
   '<div class="m-tags">'+(joined?'<span class="m-tag m-tag-in">'+ic("check","sm")+esc(t("youreIn"))+' · '+esc(joined)+'</span>':o.tags.map((x,j)=>'<span class="m-tag'+(/covered|provided|sent|no experience/i.test(x)?' m-tag-ok':'')+'">'+esc(x)+'</span>').join(""))+'</div></div></div>';
}
function reqCard(r,i){
  const onv=S.helping[r.id];
  return '<div class="m-req m-press" data-act="req" data-id="'+r.id+'" style="--i:'+i+'">'+
   '<div class="m-req-h">'+avatar(r.ini,r.today?"m-av-coral":"")+'<div class="m-req-who"><b>'+esc(r.who)+'</b><span>'+ic("shield","sm")+esc(r.ver)+'</span></div>'+(r.today?'<span class="m-today">Today</span>':'')+'</div>'+
   '<h3>'+esc(r.task)+'</h3>'+
   '<div class="m-meta"><span>'+ic("clock","sm")+r.mins+' min</span><span>'+ic("cal","sm")+esc(r.when)+'</span><span>'+ic(r.x?"pin":"globe","sm")+esc(r.dist)+'</span></div>'+
   '<div class="m-duo"><button class="m-pbtn m-tide" data-act="'+(onv?"chatfor":"req")+'" data-id="'+r.id+'">'+(onv?ic("chat","sm")+"Open chat":esc(t("canHelp")))+'</button><button class="m-pbtn m-ghost" data-act="req" data-id="'+r.id+'">'+esc(t("details"))+'</button></div></div>';
}
function liveCard(){
  const ids=Object.keys(S.joined);if(!ids.length)return "";
  const o=EK.opp(ids[ids.length-1]),slot=S.joined[o.id],rr=rel(slot);
  return '<button class="m-live m-press" data-act="open" data-id="'+o.id+'" aria-label="Up next: '+esc(o.title)+', '+esc(rr.line)+'">'+
   '<span class="m-live-art">'+EK.causeTile(o.cause,46)+'</span><span class="m-live-b"><span class="m-live-k"><i></i>'+esc(L("upNext"))+'</span><b>'+esc(o.title)+'</b><span class="m-live-t">'+esc(rr.line)+'</span></span>'+
   '<span class="m-live-r">'+(rr.any?'<span class="m-live-n m-live-ic">'+ic("clock","md")+'</span><span>this week</span>':rr.diff<=1?'<span class="m-live-n m-live-w">'+esc(rr.short)+'</span><span>'+esc(rr.time)+'</span>':'<span class="m-live-n">'+rr.diff+'</span><span>days</span>')+'</span>'+
   '<span class="m-live-dots" aria-hidden="true"><span class="on"><i></i>Joined</span><span class="on"><i></i>Reminder on</span><span><i></i>'+esc(rr.inN==="today"?"Today":"Go "+rr.inN)+'</span></span></button>';
}
function featureCard(){
  return '<button class="m-feature m-press" data-act="open" data-id="quick"><span class="m-f-orbs" aria-hidden="true"><i></i><i></i><i></i></span>'+
   '<span class="m-f-badge">'+ic("clock","sm")+esc(L("mins20"))+'</span><span class="m-f-h">'+esc(t("firstStep"))+'</span><span class="m-f-p">'+esc(L("firstSub"))+'</span>'+
   '<span class="m-f-go">'+esc(L("seeDetails"))+ic("arrowr","sm")+'</span></button>';
}
function emptyState(icn,title,text,btn){return '<div class="m-empty"><span class="m-empty-ic">'+icn+'</span><b>'+esc(title)+'</b><p>'+esc(text)+'</p>'+(btn||'')+'</div>'}

/* =========================================================
   Screens (tab roots + pushed)
   ========================================================= */
const R={};
R.home=function(){
  const join=S.mode==="join";
  let h='<div class="m-ptr" aria-hidden="true">'+sunSpinner()+'</div><div class="m-scroll" data-keep="main"><div class="m-content m-pad-root">';
  h+='<div class="m-hrow"><button class="m-loc m-press" data-act="loc">'+ic("pin","sm")+'<span>'+esc(L("area"))+'</span>'+ic("fwd","sm")+'</button><span class="m-grow"></span>'+
     '<button class="m-langp m-press" data-act="lang" aria-label="Change language">'+ic("globe","sm")+'<span>'+(S.lang==="en"?"EN":"हिं")+'</span></button>'+
     '<button class="m-icbtn m-press" data-act="bell" aria-label="Notifications">'+ic("bell","md")+'<i class="m-dot"></i></button></div>';
  h+='<div class="m-greet">'+esc(t("hello"))+', '+esc(USER.name)+'</div>'+largeTitle(L("nearYou"));
  h+='<div class="m-switch" role="tablist" aria-label="Choose a path" data-k="mode" data-s="'+(join?0:1)+'"><span class="m-switch-thumb" aria-hidden="true"></span>'+
     '<button role="tab" aria-selected="'+join+'" data-act="mode" data-id="join"><span class="m-sw-ic">'+ic("sparkle","md")+'</span><span class="m-sw-t"><b>'+esc(t("join"))+'</b><small>'+esc(t("joinSub"))+'</small></span></button>'+
     '<button role="tab" aria-selected="'+!join+'" data-act="mode" data-id="help"><span class="m-sw-ic">'+ic("hand","md")+'</span><span class="m-sw-t"><b>'+esc(t("help"))+'</b><small>'+esc(t("helpSub"))+'</small></span></button></div>';
  if(join){
    const list=EK.filteredOpps();
    h+='<div class="m-stagger">'+liveCard();
    if(!S.joined.quick&&S.time!=="weekend")h+=featureCard();
    h+='</div>';
    h+=chipRow("time","time",[["any",t("f_any")],["30",t("f_30")],["2h",t("f_2h")],["weekend",t("f_weekend")],["home",t("f_home")]],S.time,"time","m-chips-bleed");
    h+='<div class="m-causes" data-keep="causes" role="radiogroup" aria-label="Causes">'+CAUSES.map(c=>'<button class="m-cause m-press" role="radio" aria-checked="'+(S.cause===c[0])+'" data-act="cause" data-id="'+c[0]+'"><span class="m-cause-t">'+(c[0]==="all"?allTile(50):EK.causeTile(c[0],50,"m"))+'</span><span>'+esc(c[1])+'</span></button>').join("")+'</div>';
    h+='<div class="m-sech"><h2>'+list.length+' '+esc(L("acts"))+'</h2><span>'+esc(L("closest"))+'</span></div>';
    const sorted=list.slice().sort((a,b)=>(a.dist||0)-(b.dist||0));
    h+='<div class="m-list m-stagger">'+sorted.map(oppCard).join("")+'</div>';
    if(!list.length)h+=emptyState(ic("search","lg"),"Nothing matches that yet","Try another time or cause, or start a drive and invite neighbours.",'<button class="m-pbtn m-ink" data-act="clearf">Show everything</button><button class="m-pbtn m-ghost" data-act="drive">'+esc(t("startDrive"))+'</button>');
  }else{
    const pins=REQS.filter(r=>r.x);
    h+='<div class="m-stagger"><div class="m-map m-press-soft" style="--i:0"><svg viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+EK.mapBase()+'</svg>'+
       pins.map(r=>'<button class="m-pin'+(r.today?' m-pin-today':'')+'" style="left:'+(r.x/10)+'%;top:'+(r.y/6.4)+'%" data-act="req" data-id="'+r.id+'" aria-label="'+esc(r.who+": "+r.task)+'">'+esc(r.ini)+'</button>').join("")+
       '<span class="m-map-chip">'+ic("pin","sm")+REQS.length+' requests within 3 km</span><span class="m-map-leg"><i></i>Today</span></div>';
    h+='<div class="m-duo m-duo-big" style="--i:1"><button class="m-btn m-tide" data-act="drive">'+ic("users","md")+esc(t("startDrive"))+'</button><button class="m-btn m-ghost" data-act="ask">'+ic("hand","md")+esc(t("askHelp"))+'</button></div></div>';
    if(S.asks.length)h+='<div class="m-sech"><h2>Your requests</h2></div>'+S.asks.map(a=>'<div class="m-mine"><span class="m-mine-ic">'+ic("hand","md")+'</span><div><b>'+esc(a.what)+'</b><span>'+esc(a.when)+' · '+esc(a.len)+' · Waiting for a neighbour</span></div></div>').join("");
    h+='<div class="m-sech"><h2>'+esc(L("reqs"))+'</h2><span>'+esc(L("closest"))+'</span></div><div class="m-list m-stagger">'+REQS.map((r,i)=>reqCard(r,i+2)).join("")+'</div>';
  }
  h+='</div></div>'+navRoot(L("nearYou"))+'<div class="m-toast" aria-live="polite"></div>';
  return h;
};
function allTile(size){return '<svg class="ctile" width="'+size+'" height="'+size+'" viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="6" width="42" height="40" rx="14" fill="#000" opacity=".14"/><rect x="3" y="3" width="42" height="40" rx="14" fill="#1C2120"/><rect x="7" y="5" width="34" height="14" rx="8" fill="#fff" opacity=".1"/><g transform="translate(12 11)" fill="none" stroke="#FBE33B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+EK.P.sparkle+'</g></svg>'}
function sunSpinner(){
  let rays="";for(let i=0;i<10;i++){const a=i*36;rays+='<line x1="20" y1="4.5" x2="20" y2="10" transform="rotate('+a+' 20 20)" style="--r:'+i+'"/>'}
  return '<svg class="m-sun-spin" viewBox="0 0 40 40" width="34" height="34"><g class="m-rays">'+rays+'</g><circle cx="20" cy="20" r="5.5"/></svg>';
}

R.detail=function(rt){
  const o=EK.opp(rt.id),joined=S.joined[o.id],left=o.cap-o.taken,saved=!!S.saved[o.id];
  let h='<div class="m-scroll" data-keep="main"><div class="m-content">';
  h+='<div class="m-hero"><div class="m-hero-art">'+EK.cover(o)+'</div></div>';
  h+='<div class="m-dsheet"><div class="m-kicker"><span class="m-kick-t">'+EK.causeTile(o.cause,26,"k")+esc(causeName(o.cause))+'</span><span>'+esc(o.kind)+'</span></div>';
  h+='<h1 class="m-dtitle">'+esc(o.title)+'</h1>';
  h+='<div class="m-rating">'+ic("star","sm fill")+'<b>'+o.rating+'</b><span>·</span><u>'+o.reviews+' reviews</u><span>·</span>'+esc(o.dist?o.dist+" km away":o.where)+'</div>';
  h+='<div class="m-trust"><span class="m-trust-ic">'+ic("shield","md")+'</span><div><b>'+esc(o.host)+'</b><span>'+esc(o.verified)+'. Verified profile.</span><button class="m-link" data-act="fin">'+esc(o.fin.startsWith("Accounts")?"View published finances":o.fin)+ic("fwd","sm")+'</button></div></div>';
  h+='<div class="m-facts">'+
     fact("cal","When",o.when)+fact("clock","Time needed",o.len)+fact(o.dist?"pin":"globe","Where",o.where)+
     '<div class="m-fact"><span class="m-fact-k">Spots left</span><span class="m-fact-ring">'+ring(left/o.cap,34)+'<b class="m-num">'+left+'</b></span><span class="m-fact-v">of '+o.cap+' spots</span></div></div>';
  h+='<h2 class="m-h2">What you will do</h2><p class="m-p">'+esc(o.about)+'</p>';
  h+='<h2 class="m-h2">Good to know</h2><ul class="m-checks">'+o.tags.map(x=>'<li>'+ic("check","sm")+'<span>'+esc(x)+'</span></li>').join("")+'<li>'+ic("check","sm")+'<span>Bring: '+esc(o.bring)+'</span></li></ul>';
  h+='<h2 class="m-h2">What volunteers say</h2><div class="m-revs" data-keep="revs">'+o.rev.map(r=>'<div class="m-rev"><div class="m-rev-h">'+avatar(r[0][0])+'<div><b>'+esc(r[0])+', '+esc(r[1])+'</b><span class="m-stars">'+ic("star","sm fill").repeat(5)+'</span></div></div><p>“'+esc(r[2])+'”</p></div>').join("")+'</div>';
  h+='<button class="m-report" data-act="report">'+ic("flag","sm")+'Report this activity</button>';
  h+='</div><div class="m-foot-space"></div></div></div>';
  h+='<header class="m-nav m-nav-hero"><button class="m-circ" data-act="back" aria-label="Back">'+ic("back","md")+'</button><div class="m-nav-title">'+esc(o.title)+'</div>'+
     '<button class="m-circ" data-act="share" aria-label="Share on WhatsApp">'+ic("share","md")+'</button><button class="m-circ m-save-c" data-act="save" data-id="'+o.id+'" data-k="dsave" data-s="'+(saved?1:0)+'" aria-pressed="'+saved+'" aria-label="Save">'+heartIc(saved)+'</button></header>';
  h+='<div class="m-foot"><div class="m-foot-info"><b>'+esc(joined?rel(joined).line:o.when)+'</b><span>'+(joined?"Reminder on":left+" spots left · free")+'</span></div>'+
     (joined?'<button class="m-btn m-ink m-btn-auto" data-act="toact">'+ic("check","sm")+'View in Activity</button>':'<button class="m-btn m-sun m-btn-auto" data-act="joinsheet">'+esc(t("joinCta"))+'</button>')+'</div>';
  return h;
};
function fact(icn,k,v){return '<div class="m-fact"><span class="m-fact-k">'+esc(k)+'</span><span class="m-fact-i">'+ic(icn,"md")+'</span><span class="m-fact-v">'+esc(v)+'</span></div>'}

R.request=function(rt){
  const r=EK.req(rt.id),onv=S.helping[r.id];
  let h='<div class="m-scroll" data-keep="main"><div class="m-content m-pad-push">';
  h+='<div class="m-person">'+avatar(r.ini,"m-av-xl"+(r.today?" m-av-coral":""))+'<div><h2>'+esc(r.who)+'</h2><span>'+ic(r.x?"pin":"globe","sm")+esc(r.dist)+(r.x?" away":"")+' · '+esc(r.when)+'</span></div></div>';
  h+='<div class="m-trust m-trust-tide"><span class="m-trust-ic">'+ic("shield","md")+'</span><div><b>'+esc(r.ver)+'</b><span>Joined '+esc(r.joined)+' · '+r.helped+(r.helped===1?" neighbour has":" neighbours have")+' helped before</span></div></div>';
  h+='<h1 class="m-rtitle">'+esc(r.task)+'</h1><blockquote class="m-quote"><span aria-hidden="true">“</span>'+esc(r.note)+'</blockquote>';
  h+='<div class="m-facts m-facts-3">'+fact("cal","When",r.when)+fact("clock","Time needed",r.mins+" minutes")+fact(r.x?"pin":"globe","Distance",r.dist)+'</div>';
  h+='<div class="m-note">'+ic("lock","sm")+'<span>Exact address is shared after you accept</span></div>';
  h+='<h2 class="m-h2">Stay safe</h2><ul class="m-safe">'+TIPS.map((x,i)=>'<li><span>'+ic(["users","chat","home","flag"][i],"md")+'</span>'+esc(x)+'</li>').join("")+'</ul>';
  h+='<button class="m-report" data-act="report">'+ic("flag","sm")+'Report or block</button>';
  h+='<div class="m-foot-space"></div></div></div>';
  h+=navPush('Request');
  h+='<div class="m-foot m-foot-row"><button class="m-btn m-tide" data-act="'+(onv?"chatfor":"accept")+'" data-id="'+r.id+'">'+(onv?ic("chat","md")+"Open chat":esc(t("canHelp")))+'</button><button class="m-sqbtn m-press" data-act="msg" data-id="'+r.id+'" aria-label="Message first">'+ic("chat","md")+'</button></div>';
  return h;
};

R.chat=function(rt){
  const r=EK.req(rt.id),msgs=S.chats[r.id]||[],seen=V.seen[r.id]||0;
  const replies=["I will be there on time","Can you share more details?","Running 10 minutes late"];
  let h='<div class="m-scroll m-chat-scroll" data-keep="main"><div class="m-content m-pad-push m-msgs" aria-live="polite"><div class="m-day">Today 9:41</div>';
  msgs.forEach((m,i)=>{
    const nx=msgs[i+1],last=!nx||nx.k!==m.k,isNew=i>=seen?' m-new':'';
    if(m.k==="sys")h+='<div class="m-sys'+isNew+'">'+ic("lock","sm")+esc(m.t)+'</div>';
    else h+='<div class="m-bub m-'+m.k+(last?' m-tail':'')+isNew+'">'+esc(m.t)+'</div>';
    if(m.k==="me"&&!nx)h+='<div class="m-deliv">Delivered</div>';
  });
  if(V.typing[r.id])h+='<div class="m-bub m-them m-tail m-typing m-new" aria-label="Typing"><i></i><i></i><i></i></div>';
  V.seen[r.id]=msgs.length;
  h+='<div class="m-foot-space"></div></div></div>';
  h+='<header class="m-nav m-nav-push m-nav-chat"><button class="m-back" data-act="back" aria-label="Back">'+ic("back")+'</button><div class="m-chat-who">'+avatar(r.ini,"m-av-sm"+(r.today?" m-av-coral":""))+'<div><b>'+esc(r.who)+'</b><span>Usually replies in 10 min</span></div></div><button class="m-icbtn" data-act="req" data-id="'+r.id+'" aria-label="Request details">'+ic("info","md")+'</button></header>';
  h+='<div class="m-foot m-chat-foot"><div class="m-qr" data-keep="qr">'+replies.map(x=>'<button class="m-qchip m-press" data-act="say" data-t="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div>'+
     '<div class="m-inbar"><button class="m-plus" data-act="attach" aria-label="Add a photo">'+ic("plus","md")+'</button><label class="m-field"><span class="sr">Message</span><input data-bind="chat" data-focus="chat" placeholder="Message" value="'+esc(V.draft[r.id]||"")+'" enterkeyhint="send" autocomplete="off"></label>'+
     '<button class="m-send'+((V.draft[r.id]||"").trim()?" m-on":"")+'" data-act="send" aria-label="Send">'+ic("arrowr","md")+'</button></div></div>';
  return h;
};

R.community=function(){
  let h='<div class="m-scroll" data-keep="main"><div class="m-content m-pad-root">'+largeTitle(t("tComm"));
  h+='<div class="m-sech"><h2>'+esc(L("groupsNear"))+'</h2><span>'+GROUPS.length+' groups</span></div>';
  h+='<div class="m-groups" data-keep="groups">'+GROUPS.map((g,i)=>{const j=!!S.groups[g.id];return '<div class="m-group" style="--i:'+i+'"><div class="m-group-top">'+EK.causeTile(g.cause,52,"g")+'<span class="m-group-n m-num">'+(g.members+(j?1:0))+'<small>members</small></span></div><b>'+esc(g.name)+'</b><span>'+esc(g.about)+'</span>'+
    '<button class="m-pbtn '+(j?'m-ghost':'m-ink')+'" data-act="group" data-id="'+g.id+'" data-k="grp-'+g.id+'" data-s="'+(j?1:0)+'" aria-pressed="'+j+'">'+(j?ic("check","sm")+"Joined":ic("plus","sm")+"Join")+'</button></div>'}).join("")+'</div>';
  h+='<div class="m-sech"><h2>'+esc(L("fromGroups"))+'</h2></div><div class="m-list m-stagger">';
  h+=POSTS.map((p,i)=>{const lk=!!S.liked[p.id];return '<article class="m-post" style="--i:'+i+'"><div class="m-post-h">'+EK.causeTile(p.cause,40,"p")+'<div><b>'+esc(p.group)+'</b><span>'+esc(p.ago)+' ago</span></div><button class="m-icbtn m-icbtn-sm" data-act="postmore" aria-label="More">'+ic("more","md")+'</button></div>'+
    '<p>'+esc(p.text)+'</p>'+(p.cover?'<div class="m-post-art">'+EK.cover(EK.opp(p.cover))+'</div>':'')+
    '<div class="m-post-a"><button class="m-like" data-act="like" data-id="'+p.id+'" data-k="like-'+p.id+'" data-s="'+(lk?1:0)+'" aria-pressed="'+lk+'" aria-label="Like">'+heartIc(lk)+'<span class="m-num">'+(p.likes+(lk?1:0))+'</span></button>'+
    '<button class="m-like" data-act="share" aria-label="Share">'+ic("share","md")+'</button><span class="m-grow"></span>'+
    (p.req?'<button class="m-pbtn m-tide" data-act="req" data-id="'+p.req+'">'+esc(t("canHelp"))+'</button>':'')+(p.opp?'<button class="m-pbtn m-ghost" data-act="open" data-id="'+p.opp+'">See activity'+ic("fwd","sm")+'</button>':'')+'</div></article>'}).join("");
  h+='</div></div></div>'+navRoot(t("tComm"));
  return h;
};

R.activity=function(){
  const up=V.actSeg==="up";
  let h='<div class="m-scroll" data-keep="main"><div class="m-content m-pad-root">'+largeTitle(t("tAct"));
  h+=seg("actseg",[["atab","up",esc(t("upcoming"))],["atab","past",esc(t("past"))]],up?0:1,"m-seg-wide");
  h+='<div class="m-list m-stagger m-tl">';
  if(up){
    let c="",i=0;
    EK.OPPS.filter(o=>S.joined[o.id]).forEach(o=>{const rr=rel(S.joined[o.id]);c+='<button class="m-tlc m-press" data-act="open" data-id="'+o.id+'" style="--i:'+(i++)+'"><span class="m-date m-date-sun"><small>'+esc(rr.dow)+'</small><b>'+esc(rr.time)+'</b></span><span class="m-tlc-b"><b>'+esc(o.title)+'</b><span>'+esc(o.host)+' · '+esc(o.len)+'</span><span class="m-tags"><span class="m-tag m-tag-ok">'+ic("bell","sm")+'Reminder on</span><span class="m-tag">'+esc(rr.line)+'</span></span></span>'+ic("fwd","sm")+'</button>'});
    S.drives.forEach(d=>{c+='<div class="m-tlc" style="--i:'+(i++)+'"><span class="m-date m-date-tide"><small>'+esc(d.when.toUpperCase())+'</small><b>'+esc(d.slot)+'</b></span><span class="m-tlc-b"><b>'+esc(d.title)+'</b><span>'+esc(d.place)+'</span><span class="m-tags"><span class="m-tag m-tag-tide">Your drive</span><span class="m-tag">'+ic("users","sm")+d.joined+' of '+d.helpers+' joined</span></span></span><button class="m-icbtn m-icbtn-sm" data-act="share" aria-label="Share invite">'+ic("share","md")+'</button></div>'});
    S.asks.forEach(a=>{c+='<div class="m-tlc" style="--i:'+(i++)+'"><span class="m-date m-date-coral"><small>ASK</small><b>'+esc(a.when)+'</b></span><span class="m-tlc-b"><b>'+esc(a.what)+'</b><span>'+esc(a.len)+' · Verified neighbours within 3 km</span><span class="m-tags"><span class="m-tag m-tag-coral">Your request</span><span class="m-tag">Waiting for a reply</span></span></span></div>'});
    h+=c||emptyState(EK.causeTile("heart",64,"e"),"No plans yet","Pick a 20-minute task to get started. It counts.",'<button class="m-pbtn m-ink" data-act="tohome">Find something to do</button>');
  }else{
    HISTORY.forEach((x,i)=>{
      const fb=S.feedback[x.id];
      let act="";
      if(x.needsFeedback)act=fb?'<span class="m-tag m-tag-ok">'+ic("check","sm")+'Thanks for your feedback</span>':'<button class="m-pbtn m-tide" data-act="fbsheet" data-id="'+x.id+'">'+ic("smile","sm")+'How was it?</button>';
      if(x.cert)act='<span class="m-tag m-tag-ok">'+ic("award","sm")+'Certificate ready</span><button class="m-pbtn m-ghost" data-act="cert">'+ic("down","sm")+'Download</button>';
      if(x.informal)act='<span class="m-tag m-tag-tide">'+ic("hand","sm")+'Informal help</span>';
      h+='<div class="m-past" style="--i:'+i+'"><div class="m-past-h">'+EK.causeTile(x.cause,46,"h")+'<div><b>'+esc(x.title)+'</b><span>'+esc(x.host)+' · '+esc(x.when)+' · '+esc(x.len)+'</span></div></div><div class="m-past-a">'+act+'</div></div>';
    });
  }
  h+='</div></div></div>'+navRoot(t("tAct"));
  return h;
};

R.me=function(){
  const st=S.settings,mx=3,wk=USER.weekly,lbl=["6w","5w","4w","3w","2w","Now"],total=wk.reduce((a,b)=>a+b,0);
  let h='<div class="m-scroll" data-keep="main"><div class="m-content m-pad-root">'+largeTitle(t("tMe"));
  h+='<div class="m-prof"><span class="m-prof-av" aria-hidden="true">'+esc(USER.ini)+'</span><div><h2>'+esc(USER.name)+'</h2><span class="m-ok">'+ic("shield","sm")+esc(USER.verified)+'</span><span>'+esc(USER.area)+' · Since '+esc(USER.since)+'</span></div></div>';
  h+='<div class="m-stats"><div><b class="m-num">'+USER.hours+'</b><span>hours so far</span></div><div><b class="m-num">'+USER.activities+'</b><span>activities</span></div><div><b class="m-num">'+USER.neighbours+'</b><span>neighbours helped</span></div></div>';
  h+='<div class="m-card m-chart"><div class="m-chart-h"><div><b>Your hours by week</b><span>'+total+' hours in the last 6 weeks</span></div><span class="m-chart-tag">'+ic("trend","sm")+'+1.5 h</span></div>'+
     '<div class="m-bars" role="img" aria-label="Hours volunteered in the last six weeks: '+wk.join(", ")+'. This week: '+wk[5]+' hours.">'+
     '<div class="m-grid" aria-hidden="true"><i data-v="3"></i><i data-v="2"></i><i data-v="1"></i><i data-v="0"></i></div>'+
     wk.map((v,i)=>'<div class="m-bcol'+(i===5?' m-cur':'')+'" style="--i:'+i+'"><span class="m-bval m-num" style="bottom:'+(v/mx*100)+'%">'+v+'</span><span class="m-b" style="height:'+(v/mx*100)+'%"></span><span class="m-blbl">'+lbl[i]+'</span></div>').join("")+'</div></div>';
  h+='<div class="m-gh">Certificates</div><div class="m-group-list"><button class="m-lrow" data-act="cert"><span class="m-sq m-sq-sun">'+ic("award","sm")+'</span><span class="m-lrow-b"><b>Disha Learning Trust</b><span>6 hours of reading with children</span></span>'+ic("down","md")+'</button></div>';
  h+='<div class="m-gh">Settings</div><div class="m-group-list">'+
     setRow("coral","bell","Reminders",toggle("reminders",st.reminders,"Reminders"))+
     setRow("tide","eye","Show my hours on my profile",toggle("showHours",st.showHours,"Show my hours on my profile"))+
     setRow("leaf","whatsapp","Share to WhatsApp",toggle("whatsapp",st.whatsapp,"Share to WhatsApp"))+
     setRow("sky","search","Larger text",toggle("large",st.large,"Larger text"))+
     '<div class="m-lrow m-lrow-col"><span class="m-lrow-top"><span class="m-sq m-sq-sun">'+ic("globe","sm")+'</span><span class="m-lrow-b"><b>Language</b></span></span>'+seg("langseg",[["setlang","en","English"],["setlang","hi","हिन्दी"]],S.lang==="en"?0:1,"m-seg-sm")+'</div>'+
     '<div class="m-lrow m-lrow-col"><span class="m-lrow-top"><span class="m-sq m-sq-ink">'+ic(EK.isDark()?"moon":"sun","sm")+'</span><span class="m-lrow-b"><b>Appearance</b></span></span>'+seg("themeseg",[["theme","light",ic("sun","sm")+"Light"],["theme","dark",ic("moon","sm")+"Dark"]],EK.isDark()?1:0,"m-seg-sm")+'</div></div>';
  h+='<div class="m-gh">Trust and safety</div><div class="m-group-list">'+
     '<div class="m-lrow"><span class="m-sq m-sq-tide">'+ic("phone","sm")+'</span><span class="m-lrow-b"><b>Phone verified</b><span>+91 98••• ••210</span></span><span class="m-okc">'+ic("check","sm")+'</span></div>'+
     '<button class="m-lrow" data-act="idcheck"><span class="m-sq m-sq-sky">'+ic("shield","sm")+'</span><span class="m-lrow-b"><b>Add an ID</b><span>Add an ID to host drives of more than 15 people</span></span>'+ic("fwd","sm")+'</button></div>';
  h+='<div class="m-group-list m-mt"><button class="m-lrow" data-act="research"><span class="m-sq m-sq-ink">'+ic("info","sm")+'</span><span class="m-lrow-b"><b>About this prototype</b><span>Design research and references</span></span>'+ic("fwd","sm")+'</button></div>';
  h+='<p class="m-fine">ekoo prototype · Made for India</p></div></div>'+navRoot(t("tMe"));
  return h;
};
function setRow(tone,icn,label,ctl){return '<div class="m-lrow"><span class="m-sq m-sq-'+tone+'">'+ic(icn,"sm")+'</span><span class="m-lrow-b"><b>'+esc(label)+'</b></span>'+ctl+'</div>'}

/* =========================================================
   Modals (full-screen covers): success, drive
   ========================================================= */
const M={};
M.success=function(m){
  const o=EK.opp(m.id),slot=S.joined[o.id]||m.slot||o.slots[0],rr=rel(slot);
  return '<div class="m-scroll"><div class="m-content m-succ">'+
   '<div class="m-succ-badge" aria-hidden="true"><svg viewBox="0 0 120 120"><circle class="m-sb-c" cx="60" cy="60" r="54"/><path class="m-sb-k" d="M36 62l16 16 34-36"/></svg></div>'+
   '<h1>'+esc(t("youreIn"))+'</h1><p class="m-succ-sub">'+esc(o.title)+'<br><b>'+esc(slot)+'</b> · '+esc(o.host)+'</p>'+
   '<div class="m-la"><div class="m-la-h">'+EK.causeTile(o.cause,40,"s")+'<div><span class="m-la-k">Reminder set</span><b>'+esc(rr.line)+'</b></div><span class="m-la-c">'+(rr.any?ic("clock","md")+'<small>this week</small>':'<b class="m-num">'+Math.max(rr.diff,0)+'</b><small>'+(rr.diff===1?"day":"days")+'</small>')+'</span></div>'+
   '<div class="m-la-bar"><i></i></div><div class="m-la-steps"><span class="on">Joined</span><span>1 hour before</span><span>'+esc(o.where==="From home"?"Done at home":"Arrive")+'</span></div></div>'+
   '<ul class="m-checks m-checks-c"><li>'+ic("check","sm")+'<span>We will remind you 1 hour before</span></li><li>'+ic("check","sm")+'<span>The host has your name and will message you details</span></li></ul>'+
   '<div class="m-duo"><button class="m-btn m-ghost" data-act="cal">'+ic("cal","md")+'Add to calendar</button><button class="m-btn m-tide" data-act="share">'+ic("whatsapp","md")+'Bring a friend</button></div>'+
   '<button class="m-btn m-ink m-mt" data-act="succdone">Done</button></div></div>'+
   '<button class="m-circ m-modal-x" data-act="succdone" aria-label="Close">'+ic("x","md")+'</button><canvas class="m-confetti" aria-hidden="true"></canvas>';
};
M.drive=function(){
  const d=S.draftDrive,st=d.step;
  const pick=(k,vals)=>chipRow("dset",k,vals,d[k],"d-"+k,"m-chips-tide m-chips-wrap");
  let body="",cta="Next";
  if(st===1)body='<h1 class="m-mh">What do you want to do?</h1><p class="m-msub">Give it a short, clear name. Neighbours see this first.</p>'+
    '<label class="m-fld"><span>Name your drive</span><input data-bind="draftDrive.title" value="'+esc(d.title)+'" maxlength="60"></label>'+
    '<div class="m-fld"><span>Kind of help</span>'+pick("cause",["Neighbourhood","Food","Trees and parks","Animals","Education"])+'</div>'+
    '<div class="m-fld"><span>How many helpers do you need?</span><div class="m-stepper"><button class="m-press" data-act="hminus" aria-label="Fewer helpers"'+(d.helpers<=1?' disabled':'')+'>'+'<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button><output class="m-num" aria-live="polite" data-k="helpers" data-s="'+d.helpers+'">'+d.helpers+'</output><button class="m-press" data-act="hplus" aria-label="More helpers"'+(d.helpers>=40?' disabled':'')+'>'+ic("plus")+'</button></div>'+
    (d.helpers>15?'<p class="m-hint">'+ic("info","sm")+'Drives of more than 15 people need an ID check.</p>':'')+'</div>';
  if(st===2)body='<h1 class="m-mh">When and where?</h1><p class="m-msub">Pick a time most neighbours are free. Weekend mornings work best.</p>'+
    '<div class="m-fld"><span>Day</span>'+pick("when",["Sat","Sun","Next Sat","Next Sun"])+'</div>'+
    '<div class="m-fld"><span>Start time</span>'+pick("slot",["7 am","9 am","11 am","5 pm"])+'</div>'+
    '<label class="m-fld"><span>Meeting place</span><span class="m-inp-ic">'+ic("pin","md")+'<input data-bind="draftDrive.place" value="'+esc(d.place)+'" maxlength="60"></span></label>'+
    '<p class="m-hint">'+ic("lock","sm")+'The exact spot is shown to people only after they join.</p>';
  if(st===3){cta="Create drive";const cv=kindCause[d.cause]||"hand";
    body='<h1 class="m-mh">Invite your neighbours</h1><p class="m-msub">This is how your invite looks on WhatsApp.</p>'+
    '<div class="m-wa"><div class="m-wa-b"><div class="m-wa-prev"><div class="m-wa-art">'+EK.cover({id:"drive-"+d.title,cause:cv})+'</div><div class="m-wa-t"><b>'+esc(d.title)+'</b><span>'+esc(d.when)+', '+esc(d.slot)+' at '+esc(d.place)+'. '+d.helpers+' helpers needed.</span><small>ekoo.app</small></div></div>'+
    '<p>Join my drive on ekoo. It takes one tap. ekoo.app/d/'+(S.drives.length+101)+'</p><span class="m-wa-time">9:41 '+'<svg viewBox="0 0 18 12" width="16" height="11" aria-hidden="true"><path d="M1 6.5l3 3L10.5 2M7 9.5l1 1L16.5 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div></div>'+
    '<div class="m-duo"><button class="m-btn m-ghost" data-act="share">'+ic("whatsapp","md")+'Share on WhatsApp</button><button class="m-btn m-ghost" data-act="copy">'+ic("copy","md")+'Copy invite link</button></div>'+
    '<p class="m-hint">'+ic("shield","sm")+'Your phone number is verified, so people know who is hosting.</p>'}
  return '<header class="m-mnav"><button class="m-circ m-circ-solid" data-act="'+(st>1?"dback":"dclose")+'" aria-label="'+(st>1?"Back":"Close")+'">'+ic(st>1?"back":"x","md")+'</button><div class="m-mnav-t"><b>'+esc(t("startDrive"))+'</b><span>Step '+st+' of 3</span></div><span class="m-circ-sp"></span></header>'+
   '<div class="m-prog" aria-hidden="true">'+[1,2,3].map(i=>'<i class="'+(i<=st?'on':'')+'"></i>').join("")+'</div>'+
   '<div class="m-scroll m-mscroll" data-keep="dscroll"><div class="m-content m-dstep'+(V.dDir?(V.dDir>0?' m-in-r':' m-in-l'):'')+'">'+body+'<div class="m-foot-space"></div></div></div>'+
   '<div class="m-foot"><button class="m-btn m-tide" data-act="dnext">'+cta+(st<3?ic("arrowr","md"):ic("check","md"))+'</button></div>';
};

/* =========================================================
   Sheets
   ========================================================= */
const SH={};
SH.join=function(){
  const o=EK.opp(V.sheet.id);
  return sheetHead("Pick a time",o.title)+'<div class="m-sheet-body"><div class="m-sheet-in"><div class="m-slots" role="radiogroup">'+o.slots.map((s,i)=>'<button class="m-slot m-press" role="radio" aria-checked="'+(V.slot===i)+'" data-act="slot" data-id="'+i+'"><span class="m-slot-ic">'+ic("cal","md")+'</span><span class="m-slot-b"><b>'+esc(s)+'</b><span>'+esc(rel(s).line)+' · '+(o.cap-o.taken)+' spots left</span></span><span class="m-radio"></span></button>').join("")+'</div>'+
   '<p class="m-hint">'+ic("bell","sm")+'We will remind you 1 hour before. You can leave any time.</p><button class="m-btn m-sun" data-act="confirm">Confirm and join</button></div></div>';
};
SH.create=function(){
  return sheetHead("What would you like to do?","Both take under a minute.")+'<div class="m-sheet-body"><div class="m-sheet-in">'+
   '<button class="m-opt m-press" data-act="drive"><span class="m-opt-t m-opt-tide">'+ic("users","lg")+'</span><span class="m-opt-b"><b>'+esc(t("startDrive"))+'</b><span>Organise neighbours for a clean-up, feeding or tutoring</span></span>'+ic("fwd","sm")+'</button>'+
   '<button class="m-opt m-press" data-act="ask"><span class="m-opt-t m-opt-sun">'+ic("hand","lg")+'</span><span class="m-opt-b"><b>'+esc(t("askHelp"))+'</b><span>Ask verified neighbours nearby for a small favour</span></span>'+ic("fwd","sm")+'</button></div></div>';
};
SH.ask=function(){
  const a=S.draftAsk;
  return '<div class="m-sheet-drag m-sheet-navh"><div class="m-grabber"></div><div class="m-snav"><button class="m-snav-b" data-act="closeSheet">Cancel</button><b>'+esc(t("askHelp"))+'</b><button class="m-snav-b m-snav-p" data-act="post">Post</button></div></div>'+
   '<div class="m-sheet-body"><div class="m-sheet-in"><h2 class="m-mh">What do you need?</h2>'+
   '<label class="m-fld"><span>Describe the help</span><textarea rows="3" data-bind="draftAsk.what" data-focus="ask" placeholder="For example: carry two bags upstairs" maxlength="140">'+esc(a.what)+'</textarea></label>'+
   '<div class="m-fld"><span>How long will it take?</span>'+chipRow("aset","len",["15 min","30 min","1 hour"],a.len,"a-len","m-chips-tide m-chips-wrap")+'</div>'+
   '<div class="m-fld"><span>When?</span>'+chipRow("aset","when",["Today","Tomorrow","This weekend"],a.when,"a-when","m-chips-tide m-chips-wrap")+'</div>'+
   '<div class="m-priv">'+ic("lock","md")+'<span>Only verified neighbours within 3 km will see this. Your exact address stays private until you accept someone.</span></div>'+
   '<button class="m-btn m-tide" data-act="post">Post request</button></div></div>';
};
SH.feedback=function(){
  const h=HISTORY.find(x=>x.id===V.sheet.id)||HISTORY[0],f=V.fbTmp;
  const face=(id,icn,lab)=>'<button class="m-face m-face-'+id+'" role="radio" aria-checked="'+(f===id)+'" data-act="face" data-id="'+id+'" data-k="face-'+id+'" data-s="'+(f===id?1:0)+'"><span>'+ic(icn,"lg")+'</span>'+lab+'</button>';
  let c="";
  if(f==="good")c='<div class="m-glad"><span class="m-glad-ic">'+ic("heart","md")+'</span><div><b>Glad to hear it</b><span>The next meal drive is Saturday, 9 am. 6 spots left.</span></div></div><button class="m-btn m-sun" data-act="fbagain">Join next Saturday</button><button class="m-btn m-plain" data-act="fbdone">Not now</button>';
  else if(f)c='<p class="m-hint">'+ic("info","sm")+'Thanks. We will tell the host what to improve.</p><button class="m-btn m-ink" data-act="fbdone">Send feedback</button>';
  return sheetHead("How was it?",h.title+" · "+h.when)+'<div class="m-sheet-body"><div class="m-sheet-in"><div class="m-faces" role="radiogroup" aria-label="Rate it">'+face("good","smile","Great")+face("ok","meh","Okay")+face("bad","frown","Not good")+'</div><div class="m-fbc'+(f?' m-in':'')+'">'+c+'</div></div></div>';
};
function sheetHead(title,sub){return '<div class="m-sheet-drag"><div class="m-grabber"></div><div class="m-sheet-h"><div><h2>'+esc(title)+'</h2>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div><button class="m-circ m-circ-solid m-circ-sm" data-act="closeSheet" aria-label="Close">'+ic("x","sm")+'</button></div></div>'}

/* =========================================================
   Welcome
   ========================================================= */
const WC=[["education","Children and education","book"],["food","Food and hunger","bowl"],["green","Trees and parks","leaf"],["elders","Elders and health","elder"],["animals","Animals","paw"],["neighbour","Neighbourhood help","hand"]];
function renderWelcome(){
  const st=S.step,p=S.prefs;
  let title,sub,body,cta="Continue",ok=true;
  const opt=(k,v,l,s,tile)=>'<button class="m-wopt m-press" role="radio" aria-checked="'+(p[k]===v)+'" data-act="wpref" data-k="'+k+'" data-id="'+v+'">'+(tile||'')+'<span class="m-wopt-b"><b>'+esc(l)+'</b><span>'+esc(s)+'</span></span><span class="m-radio"></span></button>';
  if(st===0){title="Find one thing to do this week";sub="Pick what you care about. You can change this later.";
    body='<div class="m-wcauses">'+WC.map(c=>'<button class="m-wc m-press" role="checkbox" aria-checked="'+p.causes.includes(c[0])+'" data-act="wcause" data-id="'+c[0]+'">'+EK.causeTile(c[2],36,"w")+'<span>'+esc(c[1])+'</span><i class="m-wc-k">'+ic("check","sm")+'</i></button>').join("")+'</div>';
    ok=p.causes.length>0}
  if(st===1){title="How much time do you have?";sub="Most people start with under five hours a month. Starting small works.";
    body='<div role="radiogroup" class="m-wopts">'+opt("time","short","15 to 30 minutes","Quick tasks, some from home",'<span class="m-wt">15<small>min</small></span>')+opt("time","hour","1 to 2 hours","A single session",'<span class="m-wt">1–2<small>hrs</small></span>')+opt("time","weekend","A weekend morning","Bigger group activities",'<span class="m-wt">'+ic("sun","md")+'</span>')+opt("time","regular","Every week","A regular slot",'<span class="m-wt">'+ic("cal","md")+'</span>')+'</div>';ok=!!p.time}
  if(st===2){title="How would you like to help?";sub="Both are welcome. Many people do both.";cta="See what is near you";
    body='<div role="radiogroup" class="m-wopts">'+opt("way","org","With an organisation","Verified NGOs and groups, with a plan for the day",'<span class="m-wt m-wt-sun">'+ic("shield","md")+'</span>')+opt("way","direct","For neighbours","Everyday help, close to home",'<span class="m-wt m-wt-tide">'+ic("hand","md")+'</span>')+opt("way","both","Both","See the two side by side",'<span class="m-wt m-wt-both">'+ic("users","md")+'</span>')+'</div>';ok=!!p.way}
  const dir=V.welDir>0?" m-in-r":V.welDir<0?" m-in-l":"";
  return '<div class="m-wel-top"><span class="m-wel-l">'+(st>0?'<button class="m-wel-back" data-act="wback" aria-label="Back">'+ic("back")+'</button>':'<span class="m-wel-logo"><i></i>ekoo</span>')+'</span>'+
    '<div class="m-wel-prog" role="progressbar" aria-label="Step '+(st+1)+' of 3" aria-valuemin="1" aria-valuemax="3" aria-valuenow="'+(st+1)+'">'+[0,1,2].map(i=>'<i class="'+(i<st?'m-done':i===st?'m-cur':'')+'"></i>').join("")+'</div>'+
    '<span class="m-wel-r"><button class="m-wel-skip" data-act="skip">Skip</button></span></div>'+
    '<div class="m-wel-hero" data-k="whero" data-s="'+st+'" aria-hidden="true"><span class="m-orb m-orb-sun"><i>'+'<svg viewBox="0 0 24 24" class="i">'+EK.P.hand+'</svg></i></span><span class="m-orb m-orb-tide"><i></i></span><span class="m-orb m-orb-mint"><i></i></span><span class="m-orb m-orb-coral"><i></i></span></div>'+
    '<div class="m-wel-head'+dir+'"><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div>'+
    '<div class="m-wel-panel"><div class="m-wel-scroll" data-keep="wel"><div class="m-wel-body'+dir+'">'+body+'</div></div><div class="m-wel-foot"><button class="m-btn m-ink" data-act="wnext"'+(ok?'':' disabled')+'>'+esc(cta)+ic("arrowr","md")+'</button></div></div>';
}

/* =========================================================
   Patch / render plumbing
   ========================================================= */
function patch(el,html){
  const prev={},keep={};let focus=null;
  el.querySelectorAll("[data-k]").forEach(n=>prev[n.dataset.k]=n.getAttribute("data-s"));
  el.querySelectorAll("[data-keep]").forEach(n=>keep[n.dataset.keep]=[n.scrollLeft,n.scrollTop]);
  const ae=document.activeElement;
  if(ae&&el.contains(ae)&&ae.dataset&&ae.dataset.focus)focus={k:ae.dataset.focus,s:ae.selectionStart,e:ae.selectionEnd};
  el.innerHTML=html;
  el.querySelectorAll("[data-keep]").forEach(n=>{const k=keep[n.dataset.keep];if(k){n.scrollLeft=k[0];n.scrollTop=k[1]}});
  const ch=[];
  el.querySelectorAll("[data-k]").forEach(n=>{const k=n.dataset.k;if(k in prev&&prev[k]!==n.getAttribute("data-s")){ch.push([n,n.getAttribute("data-s")]);n.setAttribute("data-s",prev[k]);n.classList.add("m-snap")}});
  if(ch.length){reflow(el);ch.forEach(([n,s])=>{n.classList.remove("m-snap");n.setAttribute("data-s",s);n.classList.add("m-chg")})}
  if(focus){const f=el.querySelector('[data-focus="'+focus.k+'"]');if(f){try{f.focus({preventScroll:true});f.setSelectionRange(focus.s,focus.e)}catch(e){}}}
}
function renderRoute(rt){
  if(!rt.el)return;
  patch(rt.el,R[rt.r](rt));
  rt.el.classList.toggle("m-help",rt.r==="home"&&S.mode==="help");
  afterRender(rt.el);
}
function afterRender(el){
  const foot=el.querySelector(":scope > .m-foot");
  if(foot)el.style.setProperty("--fh",foot.offsetHeight+"px");
  const sc=el.querySelector(":scope > .m-scroll");if(sc)onScroll(sc);
}
function mkPage(rt){
  const el=document.createElement("section");el.className="m-page m-pg-"+rt.r+" m-fresh";el.dataset.r=rt.r;
  W.insertBefore(el,shadeEl);rt.el=el;later(()=>el.classList.remove("m-fresh"),900);return el;
}
function renderTabbar(){
  const cnt=Object.keys(S.joined).length+S.drives.length+S.asks.length;
  const tb=(k,icn,l)=>'<button class="m-tab'+(V.tab===k?' m-on':'')+'" data-act="tab" data-id="'+k+'"'+(V.tab===k?' aria-current="page"':'')+'><span class="m-tab-i">'+tico(icn,V.tab===k)+(k==="activity"&&cnt?'<i class="m-badge">'+cnt+'</i>':'')+'</span><span class="m-tab-l">'+esc(t(l))+'</span></button>';
  tabbarEl.innerHTML='<div class="m-tabs">'+tb("home","home","tHome")+tb("community","users","tComm")+'<span class="m-tab m-tab-c"><button class="m-create" data-act="create" aria-label="'+esc(t("tCreate"))+'">'+ic("plus")+'</button></span>'+tb("activity","cal","tAct")+tb("me","user","tMe")+'</div>';
}
function renderModal(){if(V.modal&&V.modal.el){patch(V.modal.el,M[V.modal.r](V.modal));afterRender(V.modal.el)}}
function renderSheet(){
  if(!V.sheet||!V.sheet.el)return;
  patch(V.sheet.inner,SH[V.sheet.type]());
}
function renderWel(){if(welEl)patch(welEl,renderWelcome())}
function refresh(){
  root.classList.toggle("m-lg",!!S.settings.large);
  Object.keys(V.stacks).forEach(k=>V.stacks[k].forEach(rt=>{if(!rt.el)mkPage(rt);renderRoute(rt)}));
  renderTabbar();renderModal();renderSheet();renderWel();emit();
}
function emit(){
  let k;
  if(V.welcome)k="welcome";
  else if(V.sheet&&(V.sheet.type==="ask"||V.sheet.type==="feedback"))k=V.sheet.type;
  else if(V.modal)k=V.modal.r;
  else{const tp=topRoute();k=tp.r==="home"?(S.mode==="help"?"help":"home"):tp.r}
  chrome();
  if(k!==V.lastKey){V.lastKey=k;try{EK.onScreen&&EK.onScreen(k)}catch(e){}}
}

/* =========================================================
   Layout + push / pop / swipe
   ========================================================= */
const shadeMax=()=>EK.isDark&&EK.isDark()?.42:.14;
function layout(){
  const w=W.clientWidth;
  Object.keys(V.stacks).forEach(k=>{const s=V.stacks[k];s.forEach((rt,i)=>{
    const vis=k===V.tab&&i===s.length-1;
    rt.el.style.transition="none";rt.el.style.visibility=vis?"":"hidden";rt.el.inert=!vis;
    rt.el.style.zIndex=i===0?1:10+i*2;
    rt.el.style.transform=(k===V.tab&&i<s.length-1)?"translate3d("+(-0.28*w)+"px,0,0)":"";
    rt.el.classList.remove("m-xfade");
  })});
  const depth=stack().length;
  tabbarEl.style.transition="none";tabbarEl.style.transform=depth>1?"translate3d("+(-0.28*w)+"px,0,0)":"";tabbarEl.style.visibility=depth>1?"hidden":"";
  shadeEl.style.transition="none";shadeEl.style.opacity=0;
}
function setP(top,under,p,isRootUnder){
  const w=W.clientWidth;
  top.el.style.transform="translate3d("+(p*w)+"px,0,0)";
  if(under){const x="translate3d("+(-0.28*w*(1-p))+"px,0,0)";under.el.style.transform=x;if(isRootUnder)tabbarEl.style.transform=x}
  shadeEl.style.opacity=((1-p)*shadeMax()).toFixed(3);
}
function trans(els,ms){els.forEach(e=>{if(e)e.style.transition=ms?"transform "+ms+"ms var(--spring),opacity "+ms+"ms var(--spring)":"none"})}
function push(rt){
  if(V.busy)return;closeCtx(true);
  const s=stack(),under=s[s.length-1];
  s.push(rt);mkPage(rt);renderRoute(rt);
  const z=10+(s.length-1)*2,isRoot=s.length===2;
  rt.el.style.zIndex=z;shadeEl.style.zIndex=z-1;under.el.style.visibility="";
  if(isRoot)tabbarEl.style.visibility="";
  rt.el.classList.add("m-pushing");
  trans([rt.el,under.el,shadeEl,isRoot&&tabbarEl],0);setP(rt,under,1,isRoot);reflow(rt.el);
  const ms=D(500);trans([rt.el,under.el,shadeEl,isRoot&&tabbarEl],ms);setP(rt,under,0,isRoot);
  V.busy=true;later(()=>{V.busy=false;rt.el.classList.remove("m-pushing");layout();emit()},ms+30);
  EK.haptic(4);emit();
}
function pop(cb){
  const s=stack();if(s.length<2||V.busy)return;closeCtx(true);
  const top=s[s.length-1],under=s[s.length-2],isRoot=s.length===2;
  renderRoute(under);under.el.style.visibility="";under.el.inert=false;if(isRoot)tabbarEl.style.visibility="";
  shadeEl.style.zIndex=parseInt(top.el.style.zIndex,10)-1;
  trans([top.el,under.el,shadeEl,isRoot&&tabbarEl],0);setP(top,under,0,isRoot);reflow(top.el);top.el.classList.add("m-pushing");
  const ms=D(460);trans([top.el,under.el,shadeEl,isRoot&&tabbarEl],ms);setP(top,under,1,isRoot);
  V.busy=true;later(()=>{s.pop();top.el.remove();V.busy=false;layout();emit();cb&&cb()},ms+30);
}
function popToRoot(cb){
  const s=stack();if(s.length<2){cb&&cb();return}
  while(s.length>2){const x=s.splice(1,1)[0];x.el.remove()}
  layout();pop(cb);
}
function resetStacks(){
  Object.keys(V.stacks).forEach(k=>{V.stacks[k].forEach((rt,i)=>{if(i>0&&rt.el)rt.el.remove()});V.stacks[k]=[V.stacks[k][0]]});
}
function switchTab(tab){
  if(V.busy)return;closeCtx(true);
  bounceTab(tab);EK.haptic(4);
  if(tab===V.tab){const s=stack();if(s.length>1)popToRoot();else{const sc=s[0].el.querySelector(".m-scroll");sc&&sc.scrollTo({top:0,behavior:RM()?"auto":"smooth"})}return}
  const oldTop=topRoute();V.tab=tab;refresh();layout();
  const nt=topRoute();
  if(!RM()){oldTop.el.style.visibility="";oldTop.el.style.zIndex=0;nt.el.classList.remove("m-xfade");reflow(nt.el);nt.el.classList.add("m-xfade");
    later(()=>{if(oldTop.el&&!(V.tab===tabOf(oldTop)&&topRoute()===oldTop)){oldTop.el.style.visibility="hidden"}},230)}
  emit();
}
function tabOf(rt){return Object.keys(V.stacks).find(k=>V.stacks[k].includes(rt))}
function bounceTab(tab){later(()=>{const b=tabbarEl.querySelector('[data-id="'+tab+'"] .m-tab-i');if(b){b.classList.remove("m-bounce");reflow(b);b.classList.add("m-bounce")}},0)}

/* swipe back */
function canSwipe(){return !V.busy&&!V.sheet&&!V.modal&&!V.welcome&&!V.ctx&&stack().length>1}
let SW=null;
function swipeStart(){const s=stack();SW={top:s[s.length-1],under:s[s.length-2],isRoot:s.length===2};
  renderRoute(SW.under);SW.under.el.style.visibility="";if(SW.isRoot)tabbarEl.style.visibility="";
  shadeEl.style.zIndex=parseInt(SW.top.el.style.zIndex,10)-1;SW.top.el.classList.add("m-pushing");
  trans([SW.top.el,SW.under.el,shadeEl,SW.isRoot&&tabbarEl],0);setP(SW.top,SW.under,0,SW.isRoot)}
function swipeMove(dx){if(SW)setP(SW.top,SW.under,clamp(dx/W.clientWidth,0,1),SW.isRoot)}
function swipeEnd(dx,vx){
  if(!SW)return;const p=clamp(dx/W.clientWidth,0,1),go=p>.35||vx>.45;const sw=SW;SW=null;
  const ms=D(go?Math.max(220,380*(1-p)):360);
  trans([sw.top.el,sw.under.el,shadeEl,sw.isRoot&&tabbarEl],ms);setP(sw.top,sw.under,go?1:0,sw.isRoot);V.busy=true;
  later(()=>{V.busy=false;if(go){const s=stack();s.pop();sw.top.el.remove();EK.haptic(4)}sw.top.el.classList.remove("m-pushing");layout();emit()},ms+30);
}

/* =========================================================
   Modals
   ========================================================= */
function presentModal(m){
  if(V.modal)return;V.modal=m;
  const el=document.createElement("section");el.className="m-modal m-modal-"+m.r;el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");
  W.appendChild(el);m.el=el;renderModal();
  el.style.transition="none";el.style.transform="translate3d(0,100%,0)";reflow(el);
  el.style.transition="transform "+D(560)+"ms var(--spring)";el.style.transform="translate3d(0,0,0)";
  if(m.r==="success")later(()=>{if(V.modal===m)confetti(el)},D(280));
  emit();
}
function dismissModal(cb){
  const m=V.modal;if(!m)return;
  m.el.style.transition="transform "+D(460)+"ms var(--spring)";m.el.style.transform="translate3d(0,100%,0)";
  V.modal=null;later(()=>{m.el.remove();cb&&cb();emit()},D(460)+20);
  refresh();
}

/* =========================================================
   Sheets with detents + page-sheet effect
   ========================================================= */
function openSheet(type,opts){
  opts=opts||{};if(V.sheet){closeSheet(()=>openSheet(type,opts));return}
  closeCtx(true);
  const sh=Object.assign({type,detents:type==="ask"?["large"]:["medium","large"],y:0},opts);V.sheet=sh;
  overlayEl.innerHTML='<div class="m-scrim" data-act="closeSheet"></div><div class="m-sheet m-sheet-'+type+'" role="dialog" aria-modal="true"><div class="m-sheet-wrap"></div></div>';
  sh.el=overlayEl.querySelector(".m-sheet");sh.inner=sh.el.firstChild;sh.scrim=overlayEl.firstChild;overlayEl.classList.add("m-on");
  renderSheet();measureSheet();
  const start=opts.detent==="large"||sh.detents[0]==="large"?0:sh.large-sh.mid;
  applySheet(sh.large,0);reflow(sh.el);applySheet(start,D(520));
  emit();
}
function measureSheet(){
  const sh=V.sheet;if(!sh)return;const H=root.clientHeight;
  sh.large=H-topInset()-10;sh.el.style.height=sh.large+"px";
  const drag=sh.el.querySelector(".m-sheet-drag"),inn=sh.el.querySelector(".m-sheet-in");
  const need=(drag?drag.offsetHeight:0)+(inn?inn.offsetHeight:0)+bottomInset()+20;
  sh.mid=sh.detents.includes("medium")?clamp(Math.max(Math.round(H*.52),need),0,sh.large):sh.large;
}
function bottomInset(){return framed?34:Math.max(0,(probeEl&&probeEl.dataset.sb)?+probeEl.dataset.sb:0)}
function applySheet(y,ms){
  const sh=V.sheet;if(!sh)return;sh.y=y;
  const vis=sh.large-y,span=sh.large-sh.mid,s=span<8?(vis>=sh.large-4?1:0):clamp((vis-sh.mid)/span,0,1);
  const tr=ms?"transform "+ms+"ms var(--spring),opacity "+ms+"ms var(--spring),border-radius "+ms+"ms var(--spring)":"none";
  sh.el.style.transition=tr;sh.scrim.style.transition=tr;W.style.transition=tr;
  sh.el.style.transform="translate3d(0,"+y+"px,0)";
  sh.scrim.style.opacity=clamp(vis/Math.max(1,Math.min(sh.mid,sh.large)),0,1).toFixed(3);
  sh.s=s;
  if(s>0){const st=topInset();W.style.transform="translate3d(0,"+(s*(st-6))+"px,0) scale("+(1-.07*s)+")";W.style.borderRadius=(framed?47-33*s:12*s)+"px"}
  else{W.style.transform="";W.style.borderRadius=""}
  chrome();
}
function closeSheet(cb){
  const sh=V.sheet;if(!sh)return;
  applySheet(sh.large+20,D(420));V.sheet=null;
  sh.scrim.style.opacity=0;W.style.transform="";W.style.borderRadius="";chrome();
  later(()=>{if(!V.sheet){overlayEl.innerHTML="";overlayEl.classList.remove("m-on")}W.style.transition="";cb&&cb();emit()},D(420)+20);
  emit();
}
function setDetent(d){const sh=V.sheet;if(!sh)return;measureSheet();applySheet(d==="large"?0:sh.large-sh.mid,D(480))}
function sheetDragEnd(y,vy){
  const sh=V.sheet;if(!sh)return;
  const proj=y+vy*180,pts=[];if(sh.detents.includes("large"))pts.push(0);if(sh.detents.includes("medium"))pts.push(sh.large-sh.mid);pts.push(sh.large);
  let best=pts[0];pts.forEach(p=>{if(Math.abs(p-proj)<Math.abs(best-proj))best=p});
  if(vy>1.1&&y>(sh.detents.includes("medium")?sh.large-sh.mid-40:60))best=sh.large;
  if(best>=sh.large)closeSheet();else applySheet(best,D(480));
}
function chrome(){
  const white=V.welcome||(V.sheet&&V.sheet.s>.45);
  root.classList.toggle("m-sb-white",!!white);
  const tp=!white&&!V.welcome&&!V.modal&&!V.ctx&&topRoute();
  const ink=tp&&tp.r==="detail"&&tp.el&&!tp.el.classList.contains("m-scrolled")&&(EK.opp(tp.id)||{}).cause!=="laptop";
  root.classList.toggle("m-sb-ink",!!ink);
}

/* =========================================================
   Notifications: Dynamic Island (framed) or banner
   ========================================================= */
const TONES={sun:"var(--sun)",tide:"var(--tide)",coral:"var(--coral)",mint:"#C9F2E5",leaf:"var(--leaf)",sky:"var(--sky)"};
function notify(text,sub,icn,tone){
  EK.haptic(10);
  liveEl.textContent=text+(sub?". "+sub:"");
  const html='<span class="m-n-ic" style="background:'+(TONES[tone||"sun"]||TONES.sun)+'">'+ic(icn||"check","sm")+'</span><span class="m-n-t"><b>'+esc(text)+'</b>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</span>';
  if(framed){
    const c=islandEl.querySelector(".m-isl-c");
    const show=()=>{c.innerHTML=html;islandEl.classList.add("m-isl-open");clearTimeout(V.isl);V.isl=later(()=>islandEl.classList.remove("m-isl-open"),D(2400)+400)};
    if(islandEl.classList.contains("m-isl-open")){islandEl.classList.remove("m-isl-open");later(show,D(260))}else show();
  }else{
    bannerEl.innerHTML=html;bannerEl.classList.remove("m-ban-on");reflow(bannerEl);bannerEl.classList.add("m-ban-on");
    clearTimeout(V.isl);V.isl=later(()=>bannerEl.classList.remove("m-ban-on"),2600);
  }
}

/* =========================================================
   Context menu (long press on an opportunity card)
   ========================================================= */
function openCtx(card){
  if(V.ctx||V.busy)return;EK.haptic(14);
  const id=card.dataset.lp,o=EK.opp(id),rr=root.getBoundingClientRect(),cr=card.getBoundingClientRect();
  const H=rr.height,menuH=3*48+8,gap=12,st=topInset()+6,sb=bottomInset()+16;
  let top=cr.top-rr.top;const want=top+cr.height*1.03+gap+menuH;
  if(want>H-sb)top=Math.max(st,H-sb-menuH-gap-cr.height*1.03);
  const clone=card.cloneNode(true);clone.removeAttribute("data-act");clone.classList.add("m-ctx-card");clone.classList.remove("m-press");
  clone.style.cssText="left:"+(cr.left-rr.left)+"px;top:"+(cr.top-rr.top)+"px;width:"+cr.width+"px;height:"+cr.height+"px";
  if(S.settings.large)clone.style.zoom=1.12;
  const saved=!!S.saved[id];
  ctxEl.innerHTML='<div class="m-ctx-bg" data-act="ctxclose"></div>';ctxEl.appendChild(clone);
  const menu=document.createElement("div");menu.className="m-ctx-menu";menu.setAttribute("role","menu");
  menu.innerHTML='<button role="menuitem" data-act="ctxsave" data-id="'+id+'"><span>'+(saved?"Remove from saved":"Save")+'</span>'+heartIc(saved)+'</button><button role="menuitem" data-act="ctxshare" data-id="'+id+'"><span>Share on WhatsApp</span>'+ic("whatsapp","md")+'</button><button role="menuitem" class="m-danger" data-act="ctxreport" data-id="'+id+'"><span>Report</span>'+ic("flag","md")+'</button>';
  ctxEl.appendChild(menu);
  const mTop=top+cr.height*1.03+gap;menu.style.top=mTop+"px";menu.style.left=Math.max(16,Math.min(cr.left-rr.left,rr.width-16-250))+"px";
  card.style.visibility="hidden";ctxEl.classList.add("m-on");
  V.ctx={card,clone,menu,from:cr.top-rr.top};
  reflow(clone);clone.style.transform="translate3d(0,"+(top-(cr.top-rr.top))+"px,0) scale(1.03)";clone.classList.add("m-lift");menu.classList.add("m-on");
}
function closeCtx(instant){
  const c=V.ctx;if(!c)return;V.ctx=null;
  if(instant||RM()){ctxEl.innerHTML="";ctxEl.classList.remove("m-on");c.card.style.visibility="";return}
  c.clone.style.transform="";c.clone.classList.remove("m-lift");c.menu.classList.remove("m-on");ctxEl.classList.add("m-out");
  later(()=>{ctxEl.innerHTML="";ctxEl.classList.remove("m-on","m-out");c.card.style.visibility=""},320);
}

/* =========================================================
   Scroll-driven chrome: large title -> compact bar, detail hero
   ========================================================= */
function onScroll(sc){
  const pg=sc.parentElement;if(!pg||!pg.classList)return;
  const y=sc.scrollTop;
  if(pg.classList.contains("m-page")||pg.classList.contains("m-modal")){
    const r=pg.dataset.r;
    let th=r==="detail"?(sc.querySelector(".m-hero")?sc.querySelector(".m-hero").offsetHeight-topInset()-50:260):["home","community","activity","me"].includes(r)?44:4;
    const was=pg.classList.contains("m-scrolled");pg.classList.toggle("m-scrolled",y>th);if(was!==(y>th)&&r==="detail")chrome();
    if(r==="detail")pg.style.setProperty("--sy",Math.max(0,y).toFixed(1));
  }
}

/* =========================================================
   Gestures: edge swipe, sheet drag, pull to refresh / stretch, long press
   ========================================================= */
function begin(x,y,target,kind){
  if(G)return;
  const rr=root.getBoundingClientRect(),lx=x-rr.left;
  G={kind,x0:x,y0:y,samples:[[performance.now(),x,y]],mode:null,c:{}};
  if(V.ctx)return;
  if(V.sheet&&target.closest(".m-sheet-drag")&&!target.closest("button")){G.c.sheet=true;G.mode="sheet";G.sy=V.sheet.y;V.sheet.el.style.transition="none";return}
  if(lx<24&&canSwipe())G.c.edge=true;
  const card=target.closest("[data-lp]");
  if(card&&!V.busy&&!target.closest(".m-save")){G.c.lp=card;G.lpT=later(()=>{if(G&&G.c.lp===card&&!G.mode){G.mode="lp";suppressClick=true;openCtx(card)}},450)}
  const sc=target.closest(".m-scroll");
  if(sc&&sc.scrollTop<=0&&!V.busy){const pg=sc.parentElement;if(pg&&(pg.dataset.r==="home"||pg.dataset.r==="detail")&&stackTopEl()===pg){G.c.pull=sc;G.pg=pg}}
}
function stackTopEl(){return topRoute().el}
function move(x,y,ev){
  if(!G)return;
  const dx=x-G.x0,dy=y-G.y0,now=performance.now();G.samples.push([now,x,y]);while(G.samples.length>2&&now-G.samples[0][0]>100)G.samples.shift();
  if(!G.mode){
    const d=Math.hypot(dx,dy);
    if(d>8&&G.lpT){clearTimeout(G.lpT);timers.delete(G.lpT);G.lpT=null}
    if(G.c.edge&&dx>6&&Math.abs(dx)>Math.abs(dy)){G.mode="edge";swipeStart()}
    else if(G.c.pull&&dy>6&&dy>Math.abs(dx)){G.mode="pull";G.c.pull.style.transition="none";G.c.pull.classList.add("m-pulling")}
    else if(d>10)G.mode="none";
  }
  if(G.mode&&G.mode!=="none"&&G.mode!=="lp"){suppressClick=true;if(ev&&ev.cancelable)ev.preventDefault()}
  if(G.mode==="edge")swipeMove(Math.max(0,dx));
  else if(G.mode==="sheet"){const sh=V.sheet;if(!sh)return;let ny=G.sy+dy;if(ny<0)ny=-rubber(-ny,300);applySheet(ny,0)}
  else if(G.mode==="pull")pullMove(Math.max(0,dy));
}
function vel(){const s=G.samples;if(s.length<2)return [0,0];const a=s[0],b=s[s.length-1],dt=Math.max(1,b[0]-a[0]);return [(b[1]-a[1])/dt,(b[2]-a[2])/dt]}
function end(x,y){
  if(!G)return;const g=G,dx=x-g.x0,dy=y-g.y0,[vx,vy]=vel();G=null;
  if(g.lpT){clearTimeout(g.lpT);timers.delete(g.lpT)}
  if(g.mode==="edge")swipeEnd(dx,vx);
  else if(g.mode==="sheet"){if(Math.abs(dy)<4&&Math.abs(dx)<4){applySheet(V.sheet.y,0)}else sheetDragEnd(V.sheet?V.sheet.y:0,vy)}
  else if(g.mode==="pull")pullEnd(g);
  if(g.mode&&g.mode!=="none")later(()=>{suppressClick=false},60);
}
function pullMove(dy){
  if(!G)return;const sc=G.c.pull,pg=G.pg,off=rubber(dy,320);G.off=off;
  sc.style.transform="translate3d(0,"+off+"px,0)";
  if(pg.dataset.r==="home"){const p=clamp(off/64,0,1);pg.style.setProperty("--pp",p.toFixed(3));pg.style.setProperty("--po",off.toFixed(1))}
  else{const hero=sc.querySelector(".m-hero");const hh=hero?hero.offsetHeight:320;pg.style.setProperty("--hs",((hh+off)/hh).toFixed(4))}
}
function pullEnd(g){
  const sc=g.c.pull,pg=g.pg,off=g.off||0,ms=D(520);
  sc.classList.remove("m-pulling");
  if(pg.dataset.r==="home"&&off>=64){
    sc.style.transition="transform "+D(320)+"ms var(--spring)";sc.style.transform="translate3d(0,58px,0)";pg.style.setProperty("--po","58");pg.classList.add("m-refreshing");EK.haptic(12);
    later(()=>{sc.style.transition="transform "+ms+"ms var(--spring)";sc.style.transform="";pg.classList.remove("m-refreshing");pg.style.setProperty("--pp","0");pg.style.setProperty("--po","0");toast(pg,"Updated just now")},D(1150));
    return;
  }
  sc.style.transition="transform "+ms+"ms var(--spring)";sc.style.transform="";
  pg.classList.add("m-relax");pg.style.setProperty("--hs","1");pg.style.setProperty("--pp","0");pg.style.setProperty("--po","0");
  later(()=>{pg.classList.remove("m-relax");sc.style.transition=""},ms);
}
function toast(pg,text){const tEl=pg.querySelector(".m-toast");if(!tEl)return;tEl.innerHTML=ic("check","sm")+esc(text);tEl.classList.remove("m-on");reflow(tEl);tEl.classList.add("m-on");later(()=>tEl.classList.remove("m-on"),1900)}

/* =========================================================
   Confetti
   ========================================================= */
function confetti(host){
  if(RM())return;const cv=host.querySelector(".m-confetti");if(!cv)return;
  const ctx=cv.getContext("2d"),dpr=Math.min(2,window.devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;
  cv.width=w*dpr;cv.height=h*dpr;ctx.scale(dpr,dpr);
  const badge=host.querySelector(".m-succ-badge"),hr=host.getBoundingClientRect(),br=badge?badge.getBoundingClientRect():{left:hr.left+w/2,top:hr.top+160,width:0,height:0};
  const ox=br.left-hr.left+br.width/2,oy=br.top-hr.top+br.height/2;
  const cols=["#FBE33B","#2FC4AE","#FF7452","#C9F2E5","#F2CF1A","#141414"],N=120,ps=[];
  for(let i=0;i<N;i++){const a=-Math.PI/2+(Math.random()-.5)*Math.PI*1.25,sp=5+Math.random()*9;ps.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,s:5+Math.random()*7,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[i%cols.length],k:i%3})}
  const t0=performance.now(),dur=1400;
  (function fr(now){
    const e=now-t0;if(e>dur||!cv.isConnected){ctx.clearRect(0,0,w,h);return}
    ctx.clearRect(0,0,w,h);const fade=e>dur-450?(dur-e)/450:1;
    ps.forEach(p=>{p.vy+=.3;p.vx*=.985;p.vy*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;
      ctx.save();ctx.globalAlpha=fade;ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;
      if(p.k===0){ctx.beginPath();ctx.arc(0,0,p.s/2,0,7);ctx.fill()}else if(p.k===1)ctx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);else{ctx.beginPath();ctx.moveTo(0,-p.s/2);ctx.lineTo(p.s/2,p.s/2);ctx.lineTo(-p.s/2,p.s/2);ctx.fill()}
      ctx.restore()});
    requestAnimationFrame(fr);
  })(t0);
}

/* =========================================================
   Actions
   ========================================================= */
function goTabRoot(tab,cb){
  if(V.tab!==tab){const s=V.stacks[tab];while(s.length>1){const x=s.pop();if(x.el)x.el.remove()}V.busy=false;switchTab(tab);cb&&cb();return}
  const s=stack();if(s.length>1)popToRoot(cb);else{cb&&cb()}
}
function onClick(e){
  if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;return}
  const el=e.target.closest("[data-act]");if(!el||!root.contains(el))return;
  if(el.disabled)return;
  const a=el.dataset.act,id=el.dataset.id,k=el.dataset.k;
  if(el.tagName==="A")e.preventDefault();
  switch(a){
    case"tab":if(!V.welcome)switchTab(id);break;
    case"create":EK.haptic(8);el.classList.remove("m-spin");reflow(el);el.classList.add("m-spin");openSheet("create");break;
    case"back":pop();break;
    case"open":if(V.sheet)closeSheet();if(V.modal)return;push({r:"detail",id});break;
    case"req":if(V.sheet)closeSheet();if(topRoute().r==="chat"){pop();break}push({r:"request",id});break;
    case"chatfor":{const r=EK.req(id);A.openChat(r.id);push({r:"chat",id:r.id});break}
    case"save":{const now=A.save(id);refresh();if(now)notify("Saved","Find it in your saved list","heart","coral");break}
    case"mode":if(S.mode!==id){S.mode=id;EK.haptic(6);const pg=stack()[0].el;pg.classList.add("m-fresh");later(()=>pg.classList.remove("m-fresh"),900);refresh()}break;
    case"time":S.time=id;EK.haptic(4);refresh();break;
    case"cause":S.cause=id;EK.haptic(4);refresh();break;
    case"clearf":S.time="any";S.cause="all";refresh();break;
    case"lang":A.setLang(S.lang==="en"?"hi":"en");EK.haptic(6);refresh();break;
    case"setlang":A.setLang(id);refresh();break;
    case"bell":notify("You are all caught up","No new alerts","bell","mint");break;
    case"loc":notify("Showing places near you","Jayanagar, within 3 km","pin","tide");break;
    case"joinsheet":V.slot=0;openSheet("join",{id:topRoute().id});break;
    case"slot":V.slot=+id;EK.haptic(4);renderSheet();break;
    case"confirm":{const oid=V.sheet.id,s=A.join(oid,V.slot);closeSheet(()=>{});later(()=>{presentModal({r:"success",id:oid,slot:s});notify(t("youreIn"),s,"check","sun")},D(260));refresh();break}
    case"succdone":dismissModal();break;
    case"toact":V.actSeg="up";goTabRoot("activity");break;
    case"tohome":goTabRoot("home");break;
    case"share":notify("Opening WhatsApp","Invite link ready to send","whatsapp","leaf");break;
    case"copy":notify("Invite link copied","Paste it in any chat","copy","sky");break;
    case"cal":notify("Added to your calendar","With a reminder 1 hour before","cal","sun");break;
    case"fin":notify("Opening published accounts","FY 2025–26","book","mint");break;
    case"report":notify("Thanks for telling us","Our team reviews reports within a day","flag","coral");break;
    case"cert":notify("Certificate saved","Saved to your phone","award","sun");break;
    case"idcheck":notify("ID check","We will guide you step by step","shield","sky");break;
    case"attach":notify("Photos","Share a photo of the place or task","image","sky");break;
    case"postmore":notify("Post options","Mute or report this group","more","mint");break;
    case"accept":{A.offer(id);V.seen[id]=0;refresh();push({r:"chat",id});later(()=>notify("Offer sent",EK.req(id).who+" has been told","hand","tide"),D(300));break}
    case"msg":A.openChat(id);push({r:"chat",id});break;
    case"say":sendMsg(el.dataset.t);break;
    case"send":{const rid=topRoute().id;sendMsg((V.draft[rid]||"").trim());break}
    case"drive":{const go=()=>{S.draftDrive.step=1;V.dDir=0;presentModal({r:"drive"})};if(V.sheet)closeSheet(()=>later(go,40));else go();break}
    case"ask":if(V.sheet&&V.sheet.type==="create")closeSheet(()=>openSheet("ask",{detent:"large"}));else openSheet("ask",{detent:"large"});break;
    case"dset":S.draftDrive[k]=id;EK.haptic(4);V.dDir=0;renderModal();break;
    case"hminus":S.draftDrive.helpers=Math.max(1,S.draftDrive.helpers-1);EK.haptic(4);V.dDir=0;renderModal();break;
    case"hplus":S.draftDrive.helpers=Math.min(40,S.draftDrive.helpers+1);EK.haptic(4);V.dDir=0;renderModal();break;
    case"dnext":if(S.draftDrive.step<3){S.draftDrive.step++;V.dDir=1;renderModal();V.dDir=0;scrollModalTop()}else{const d=A.createDrive();dismissModal();V.actSeg="up";later(()=>{goTabRoot("activity");notify("Drive created","Neighbours can now join","users","tide")},D(200));void d}break;
    case"dback":S.draftDrive.step=Math.max(1,S.draftDrive.step-1);V.dDir=-1;renderModal();V.dDir=0;scrollModalTop();break;
    case"dclose":dismissModal();break;
    case"aset":S.draftAsk[k]=id;EK.haptic(4);renderSheet();break;
    case"post":{A.postAsk();S.mode="help";closeSheet();later(()=>{goTabRoot("home",()=>refresh());refresh();notify("Request posted","Verified neighbours nearby can see it","hand","tide")},D(200));break}
    case"closeSheet":closeSheet();break;
    case"group":{const j=A.group(id);refresh();if(j)notify("You joined",GROUPS.find(g=>g.id===id).name,"users","tide");break}
    case"like":A.like(id);refresh();break;
    case"atab":if(V.actSeg!==id){V.actSeg=id;EK.haptic(4);refresh()}break;
    case"fbsheet":V.fbTmp="";openSheet("feedback",{id});break;
    case"face":{V.fbTmp=id;EK.haptic(8);renderSheet();const sh=V.sheet;if(sh){const atL=sh.y<=4;measureSheet();applySheet(atL?0:sh.large-sh.mid,D(480))}break}
    case"fbagain":{A.feedback(V.sheet.id,V.fbTmp||"good");const s=A.join("meals");closeSheet();refresh();notify(t("youreIn"),s,"check","sun");break}
    case"fbdone":A.feedback(V.sheet.id,V.fbTmp);closeSheet();refresh();notify("Thanks for the feedback","It helps hosts do better","heart","mint");break;
    case"toggle":S.settings[id]=!S.settings[id];EK.haptic(6);refresh();break;
    case"theme":if((id==="dark")!==EK.isDark())EK.toggleTheme();break;
    case"research":EK.openResearch&&EK.openResearch();break;
    case"ctxclose":closeCtx();break;
    case"ctxsave":{const now=A.save(id);closeCtx();refresh();notify(now?"Saved":"Removed from saved",EK.opp(id).title,"heart","coral");break}
    case"ctxshare":closeCtx();notify("Opening WhatsApp","Invite link ready to send","whatsapp","leaf");break;
    case"ctxreport":closeCtx();notify("Thanks for telling us","Our team reviews reports within a day","flag","coral");break;
    case"wcause":{const c=S.prefs.causes,i=c.indexOf(id);if(i>-1)c.splice(i,1);else c.push(id);EK.haptic(4);V.welDir=0;renderWel();break}
    case"wpref":S.prefs[k]=id;EK.haptic(4);V.welDir=0;renderWel();break;
    case"wnext":if(S.step<2){S.step++;V.welDir=1;renderWel();V.welDir=0}else finishWelcome(false);break;
    case"wback":S.step=Math.max(0,S.step-1);V.welDir=-1;renderWel();V.welDir=0;break;
    case"skip":finishWelcome(true);break;
  }
}
function scrollModalTop(){const sc=V.modal&&V.modal.el.querySelector(".m-mscroll");if(sc)sc.scrollTop=0}
function sendMsg(text){
  const rt=topRoute();if(rt.r!=="chat"||!text)return;const rid=rt.id;
  V.draft[rid]="";EK.haptic(6);
  A.say(rid,text,()=>{V.typing[rid]=false;refresh();scrollChat(true)});
  refresh();scrollChat(true);
  later(()=>{if(S.chats[rid]&&S.chats[rid][S.chats[rid].length-1].k==="me"){V.typing[rid]=true;refresh();scrollChat(true)}},D(320));
}
function scrollChat(smooth){const rt=topRoute();if(rt.r!=="chat")return;const sc=rt.el.querySelector(".m-scroll");if(sc)sc.scrollTo({top:sc.scrollHeight,behavior:smooth&&!RM()?"smooth":"auto"})}
function onInput(e){
  const el=e.target,b=el.dataset&&el.dataset.bind;if(!b)return;
  if(b==="chat"){const rt=topRoute();V.draft[rt.id]=el.value;const s=rt.el.querySelector(".m-send");if(s)s.classList.toggle("m-on",!!el.value.trim());return}
  const p=b.split(".");S[p[0]][p[1]]=el.value;
}
function onKey(e){
  if(e.key==="Enter"&&e.target.dataset&&e.target.dataset.bind==="chat"){e.preventDefault();const rt=topRoute();sendMsg((V.draft[rt.id]||"").trim());return}
  if(e.key==="Enter"&&e.target.getAttribute&&e.target.getAttribute("role")==="link"){e.target.click();return}
  if(e.key==="Escape"){if(V.ctx)closeCtx();else if(V.sheet)closeSheet();}
}
function finishWelcome(skip){
  A.finishOnboarding(skip);V.welcome=false;resetStacks();V.tab="home";refresh();layout();
  const home=stack()[0].el,w=welEl;welEl=null;chrome();
  home.classList.add("m-fresh");later(()=>home.classList.remove("m-fresh"),900);
  if(w){home.style.transition="none";home.style.transform="scale(.94)";home.style.opacity="0";reflow(home);
    const ms=D(560);home.style.transition="transform "+ms+"ms var(--spring),opacity "+ms+"ms var(--ease)";home.style.transform="";home.style.opacity="";
    w.style.transition="transform "+ms+"ms var(--spring),opacity "+D(380)+"ms var(--ease)";w.style.transform="scale(1.06)";w.style.opacity="0";w.style.pointerEvents="none";
    later(()=>{w.remove();home.style.transition=""},ms+40)}
  EK.haptic(12);emit();
}
function showWelcome(){
  V.welcome=true;if(!welEl){welEl=document.createElement("section");welEl.className="m-wel";W.appendChild(welEl)}
  renderWel();chrome();emit();
}

/* =========================================================
   Mount / unmount / jump
   ========================================================= */
const SB='<div class="m-status" aria-hidden="true"><span class="m-st-time">9:41</span><span class="m-st-r">'+
  '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>'+
  '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 1 10.2 10.2 0 0 0 .9 3.8L2 5c1.6-1.5 3.7-2.4 6-2.4zm0 3.3c1.4 0 2.6.5 3.6 1.4l1.1-1.2A6.8 6.8 0 0 0 8 4.3a6.8 6.8 0 0 0-4.7 1.8l1.1 1.2c1-.9 2.2-1.4 3.6-1.4zm0 3.3c.5 0 1 .2 1.3.5L8 11.1 6.7 9.7c.3-.3.8-.5 1.3-.5z"/></svg>'+
  '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.4"/><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" opacity=".45"/></svg></span></div>';
function mount(el,opts){
  framed=!!(opts&&opts.framed);V=freshV();
  root=document.createElement("div");root.className="m-app"+(framed?" m-framed":" m-bleed");
  root.innerHTML='<div class="m-world"><div class="m-shade"></div><nav class="m-tabbar" aria-label="Main"></nav></div><div class="m-overlay"></div><div class="m-ctx"></div>'+
    (framed?SB+'<div class="m-island" aria-hidden="true"><div class="m-isl-c"></div></div><div class="m-hi" aria-hidden="true"></div>':'<div class="m-banner" aria-hidden="true"></div>')+
    '<div class="sr" role="status" aria-live="polite"></div><div class="m-probe" aria-hidden="true"></div><div class="m-probe-b" aria-hidden="true"></div>';
  el.appendChild(root);
  W=root.querySelector(".m-world");shadeEl=root.querySelector(".m-shade");tabbarEl=root.querySelector(".m-tabbar");overlayEl=root.querySelector(".m-overlay");ctxEl=root.querySelector(".m-ctx");
  islandEl=root.querySelector(".m-island");bannerEl=root.querySelector(".m-banner");liveEl=root.querySelector('[role="status"]');probeEl=root.querySelector(".m-probe");
  const pb=root.querySelector(".m-probe-b");probeEl.dataset.sb=pb.offsetHeight;
  refresh();layout();
  if(V.welcome)showWelcome();
  on(root,"click",onClick,true);
  on(root,"input",onInput);on(root,"keydown",onKey);
  on(root,"scroll",e=>{const t=e.target;if(t&&t.classList&&t.classList.contains("m-scroll"))onScroll(t)},true);
  on(root,"pointerdown",e=>{if(e.pointerType==="touch"||e.button!==0)return;begin(e.clientX,e.clientY,e.target,"mouse")});
  on(window,"pointermove",e=>{if(G&&G.kind==="mouse")move(e.clientX,e.clientY,e)});
  on(window,"pointerup",e=>{if(G&&G.kind==="mouse")end(e.clientX,e.clientY)});
  on(root,"touchstart",e=>{if(e.touches.length!==1)return;const p=e.touches[0];begin(p.clientX,p.clientY,e.target,"touch")},{passive:true});
  on(root,"touchmove",e=>{if(G&&G.kind==="touch"){const p=e.touches[0];move(p.clientX,p.clientY,e)}},{passive:false});
  on(root,"touchend",e=>{if(G&&G.kind==="touch"){const p=e.changedTouches[0];end(p.clientX,p.clientY)}});
  on(root,"touchcancel",()=>{if(G&&G.kind==="touch"){const g=G;end(g.x0,g.y0)}});
  on(root,"contextmenu",e=>{if(e.target.closest("[data-lp]"))e.preventDefault()});
  on(document,"ek-theme",()=>{refresh();layout()});
  if(!framed&&window.visualViewport){const vv=window.visualViewport;const f=()=>{const kb=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);root.style.setProperty("--m-kb",kb+"px");root.classList.toggle("m-kbopen",kb>80)};on(vv,"resize",f);on(vv,"scroll",f)}
  on(window,"resize",()=>{if(V.sheet){measureSheet();applySheet(V.sheet.y<=4?0:V.sheet.large-V.sheet.mid,0)}layout()});
  emit();
}
function unmount(){
  timers.forEach(clearTimeout);timers.clear();offs.forEach(f=>f());offs=[];G=null;SW=null;
  if(root&&root.parentNode)root.parentNode.removeChild(root);root=null;welEl=null;
}
function jump(key){
  if(!root)return;
  closeCtx(true);
  if(V.sheet){const sh=V.sheet;V.sheet=null;overlayEl.innerHTML="";overlayEl.classList.remove("m-on");W.style.transform="";W.style.borderRadius="";W.style.transition="";void sh}
  if(V.modal){V.modal.el.remove();V.modal=null}
  V.busy=false;resetStacks();V.tab="home";
  if(welEl){welEl.remove();welEl=null}V.welcome=false;
  if(key!=="welcome")S.onboarded=true;
  const H=V.stacks.home;
  switch(key){
    case"welcome":S.step=0;break;
    case"home":S.mode="join";S.time="any";S.cause="all";break;
    case"help":S.mode="help";break;
    case"detail":S.mode="join";H.push({r:"detail",id:"reading"});break;
    case"success":S.mode="join";S.joined.reading="Tue, 6 pm";H.push({r:"detail",id:"reading"});break;
    case"request":S.mode="help";H.push({r:"request",id:"r1"});break;
    case"chat":S.mode="help";A.offer("r1");V.seen.r1=0;V.typing.r1=false;H.push({r:"request",id:"r1"},{r:"chat",id:"r1"});break;
    case"drive":S.mode="help";break;
    case"ask":S.mode="help";break;
    case"community":V.tab="community";break;
    case"activity":V.tab="activity";V.actSeg="up";break;
    case"feedback":V.tab="activity";V.actSeg="past";break;
    case"me":V.tab="me";break;
  }
  Object.keys(V.stacks).forEach(k=>V.stacks[k].forEach(rt=>{const sc=rt.el&&rt.el.querySelector(".m-scroll");if(sc)sc.scrollTop=0;if(rt.el)rt.el.classList.remove("m-scrolled")}));
  refresh();layout();chrome();
  if(key==="welcome"){showWelcome();return}
  if(key==="chat")scrollChat(false);
  if(key==="success")later(()=>presentModal({r:"success",id:"reading",slot:"Tue, 6 pm"}),60);
  if(key==="drive"){S.draftDrive.step=1;V.dDir=0;later(()=>presentModal({r:"drive"}),60)}
  if(key==="ask")later(()=>openSheet("ask",{detent:"large"}),60);
  if(key==="feedback"){V.fbTmp="good";later(()=>openSheet("feedback",{id:"h1"}),60)}
  emit();
}
window.MobileView={mount,unmount,jump};
})();
