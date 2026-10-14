import catalog from "@/data/catalog.json";
/* =========================================================
   ekoo core — shared by the Mobile and Desktop renderers
   Exposes: window.EK = { ic, t, OPPS, REQS, GROUPS, POSTS, HISTORY, USER, TIPS, NOTES, REFS, JUMPS,
                          S, A, opp, req, filteredOpps, cover, causeTile, mapBase, MAP, haptic, esc, fmtMins }
   ========================================================= */
(function(){
"use strict";

/* ---------- icons (24px grid, stroke) ---------- */
const P={
home:'<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.5 0 4.5 2 4.5 4.5"/>',
cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
user:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
pin:'<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
shield:'<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
share:'<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
chat:'<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
back:'<path d="M15 5l-7 7 7 7"/>',
fwd:'<path d="M9 5l7 7-7 7"/>',
check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
heart:'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
x:'<path d="M6 6l12 12M18 6L6 18"/>',
book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V5.5M8 7.5h8"/>',
leaf:'<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
bowl:'<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1.5 1-1.5 1-3M13 7c0-1.5 1-1.5 1-3"/>',
laptop:'<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>',
paw:'<circle cx="7" cy="10" r="1.8"/><circle cx="12" cy="7" r="1.8"/><circle cx="17" cy="10" r="1.8"/><path d="M12 12c-3 0-5 2.5-5 4.5 0 1.6 1.4 2 2.7 1.6 1-.3 1.6-.5 2.3-.5s1.3.2 2.3.5c1.3.4 2.7 0 2.7-1.6 0-2-2-4.5-5-4.5z"/>',
elder:'<circle cx="11" cy="5" r="2.2"/><path d="M11 8v6l-3 7M11 14l3 7M8 10.5l6-1M17 10v11"/>',
hand:'<path d="M3 13h3l3.5 2.5H14a1.5 1.5 0 0 1 0 3H10"/><path d="M6 13v7h9l5.5-4.2a1.6 1.6 0 0 0-2-2.4L15 16"/><path d="M14.5 4.5a2.3 2.3 0 0 1 3.5 0 2.3 2.3 0 0 1 3.5 3c-1 1.4-3.5 3.5-3.5 3.5s-2.5-2.1-3.5-3.5a2.3 2.3 0 0 1 0-3z"/>',
mail:'<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
down:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
send:'<path d="M5 12l15-8-5 16-3-6.5z"/><path d="M12 13.5L20 4"/>',
smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4M9 9.5h.01M15 9.5h.01"/>',
meh:'<circle cx="12" cy="12" r="9"/><path d="M8.5 15.5h7M9 9.5h.01M15 9.5h.01"/>',
frown:'<circle cx="12" cy="12" r="9"/><path d="M8 16.5c1-1.6 2.4-2.4 4-2.4s3 .8 4 2.4M9 9.5h.01M15 9.5h.01"/>',
flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
map:'<path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13M15 6.5v13"/>',
list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
star:'<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>',
bolt:'<path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
phone:'<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
desktop:'<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
bookmark:'<path d="M6 3.5h12V21l-6-4-6 4z"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
award:'<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 21.5l5-2.5 5 2.5-1.5-7.5"/>',
arrowur:'<path d="M7 17L17 7M8 7h9v9"/>',
arrowr:'<path d="M4 12h15M13 6l6 6-6 6"/>',
sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
locate:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>',
camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
copy:'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
whatsapp:'<path d="M20 11.6a8.1 8.1 0 0 1-12 7.1L4 20l1.3-3.8A8.1 8.1 0 1 1 20 11.6z"/><path d="M9 8.5c0 3.5 2.6 6.4 6 6.6l1.3-1.4-2-1-.9.8a4.2 4.2 0 0 1-2.4-2.4l.8-.9-1-2z"/>',
filter:'<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
logout:'<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
image:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'
};
const ic=(n,c)=>'<svg class="i '+(c||'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(P[n]||P.info)+'</svg>';

/* ---------- language ---------- */
const T={
hello:{en:"Good evening",hi:"शुभ संध्या"},
near:{en:"Near you, within 3 km",hi:"आपके पास, 3 किमी में"},
join:{en:"Join an activity",hi:"गतिविधि से जुड़ें"},
help:{en:"Help nearby",hi:"पास में मदद"},
joinSub:{en:"With an organisation",hi:"संस्था के साथ"},
helpSub:{en:"For a neighbour",hi:"पड़ोसी के लिए"},
tHome:{en:"Home",hi:"होम"},tComm:{en:"Community",hi:"समुदाय"},tAct:{en:"Activity",hi:"गतिविधि"},tMe:{en:"Me",hi:"मैं"},tCreate:{en:"Create",hi:"बनाएँ"},
f_any:{en:"Any time",hi:"कभी भी"},f_30:{en:"30 min",hi:"30 मिनट"},f_2h:{en:"1–2 hours",hi:"1–2 घंटे"},f_weekend:{en:"This weekend",hi:"इस सप्ताहांत"},f_home:{en:"From home",hi:"घर से"},
joinCta:{en:"Join this activity",hi:"इस गतिविधि से जुड़ें"},
canHelp:{en:"I can help",hi:"मैं मदद कर सकता/सकती हूँ"},
startDrive:{en:"Start a drive",hi:"अभियान शुरू करें"},
askHelp:{en:"Ask for help",hi:"मदद माँगें"},
firstStep:{en:"Your first step",hi:"आपका पहला कदम"},
details:{en:"Details",hi:"विवरण"},
search:{en:"Search activities, groups, causes",hi:"गतिविधियाँ, समूह, कारण खोजें"},
upcoming:{en:"Upcoming",hi:"आने वाले"},past:{en:"Past",hi:"पिछले"},
youreIn:{en:"You are in",hi:"आप शामिल हैं"}
};

/* ---------- data ---------- */
/* Map space is 1000 x 640. The viewer stands at MAP.me. Items done from home have no x/y. */
const MAP={w:1000,h:640,me:{x:505,y:330}};
const {OPPS,REQS,GROUPS,POSTS,HISTORY,USER,TIPS,REFS,NOTES}=JSON.parse(JSON.stringify(catalog));
const JUMPS=[["welcome","Welcome"],["home","Home"],["detail","Activity detail"],["success","Joined"],["help","Help nearby"],["request","Request"],["chat","Chat"],["drive","Start a drive"],["ask","Ask for help"],["community","Community"],["activity","Activity tab"],["feedback","Feedback"],["me","Me"]];

/* ---------- state (shared by both views; switching view keeps it) ---------- */
const S={
  onboarded:false, step:0, prefs:{causes:[],time:"",way:""},
  mode:"join", time:"any", cause:"all", lang:"en", query:"",
  joined:{}, saved:{}, helping:{}, chats:{},
  drives:[], asks:[],
  draftDrive:{step:1,title:"Saturday clean-up for our lane",cause:"Neighbourhood",helpers:6,when:"Sat",slot:"9 am",place:"Green Lane park"},
  draftAsk:{what:"",len:"15 min",when:"Today"},
  groups:{g1:false,g2:true,g3:false}, liked:{}, feedback:{},
  settings:{reminders:true,showHours:true,whatsapp:true,large:false}
};

/* ---------- guest persistence (no login) ---------- */
const STORE_KEY="ekoo:state:v1";
const PERSIST=["onboarded","prefs","mode","time","cause","lang","joined","saved","helping","chats","drives","asks","draftDrive","draftAsk","groups","liked","feedback","settings"];
try{const raw=localStorage.getItem(STORE_KEY);if(raw){const o=JSON.parse(raw);PERSIST.forEach(k=>{if(o[k]!==undefined)S[k]=o[k]})}}catch(e){}
let saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{const o={};PERSIST.forEach(k=>o[k]=S[k]);localStorage.setItem(STORE_KEY,JSON.stringify(o))}catch(e){}},120)}
["click","input","change","keyup","pointerup"].forEach(ev=>document.addEventListener(ev,save,true));
window.addEventListener("pagehide",()=>{clearTimeout(saveT);try{const o={};PERSIST.forEach(k=>o[k]=S[k]);localStorage.setItem(STORE_KEY,JSON.stringify(o))}catch(e){}});
function guestId(){try{let g=localStorage.getItem("ekoo:guest");if(!g){g="guest_"+Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem("ekoo:guest",g)}return g}catch(e){return "guest_anon"}}
/* Fire-and-forget event log to the API. Guests need no account, OTP or email. */
function track(type,payload){try{fetch("/api/activity",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type,payload,guest:guestId(),at:new Date().toISOString()}),keepalive:true}).catch(()=>{})}catch(e){}}

/* ---------- helpers ---------- */
const t=k=>(T[k]&&(T[k][S.lang]||T[k].en))||k;
const opp=id=>OPPS.find(o=>o.id===id);
const req=id=>REQS.find(o=>o.id===id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtMins=m=>m<60?m+" min":(m%60?(m/60).toFixed(1).replace(".0","")+" h":(m/60)+(m===60?" hour":" hours"));
function filteredOpps(){
  const q=S.query.trim().toLowerCase();
  return OPPS.filter(o=>
    (S.time==="any"||(S.time==="30"&&o.mins<=30)||(S.time==="2h"&&o.mins<=120)||(S.time==="weekend"&&o.weekend)||(S.time==="home"&&o.home)) &&
    (S.cause==="all"||o.cause===S.cause||(S.cause==="book"&&o.cause==="laptop")) &&
    (!q||(o.title+" "+o.host+" "+o.tags.join(" ")).toLowerCase().includes(q)));
}
function haptic(ms){try{navigator.vibrate&&navigator.vibrate(ms||8)}catch(e){}}
const CAUSES=[["all","All causes","sparkle"],["book","Education","book"],["bowl","Food","bowl"],["leaf","Green","leaf"],["elder","Elders","elder"],["heart","Care","heart"],["paw","Animals","paw"]];

/* ---------- brand art: cause palettes, cover posters, dimensional tiles ---------- */
const PAL={
  heart:{bg:"#FFD8CB",a:"#FBE33B",b:"#FF7452",ink:"#141414"},
  book:{bg:"#C9F2E5",a:"#FBE33B",b:"#2FC4AE",ink:"#141414"},
  elder:{bg:"#FBE33B",a:"#FFFFFF",b:"#2FC4AE",ink:"#141414"},
  bowl:{bg:"#FBE33B",a:"#FF7452",b:"#141414",ink:"#141414"},
  leaf:{bg:"#CFE9C0",a:"#2FC4AE",b:"#FBE33B",ink:"#141414"},
  laptop:{bg:"#141414",a:"#FBE33B",b:"#2FC4AE",ink:"#F1F3F0"},
  paw:{bg:"#C9F2E5",a:"#FF7452",b:"#FBE33B",ink:"#141414"},
  hand:{bg:"#2FC4AE",a:"#C9F2E5",b:"#FBE33B",ink:"#141414"},
  phone:{bg:"#9CC9FF",a:"#FBE33B",b:"#FFFFFF",ink:"#141414"}
};
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
/* Poster-style cover art in the language of the research deck (big overlapping circles + a bold glyph). */
function cover(o,opts){
  opts=opts||{};const id=o.id||"x",c=o.cause||"heart",p=PAL[c]||PAL.heart,h=hash(id);
  const r1=110+(h%50),r2=60+((h>>5)%40),x1=250+((h>>9)%120),y1=40+((h>>13)%70),x2=60+((h>>17)%110),y2=170+((h>>21)%50);
  const gx=opts.glyphX||(c==="laptop"?150:110),gy=opts.glyphY||70;
  const glyph=(P[c]||P.heart).replace(/<(path|circle|rect)/g,'<$1 fill="none"');
  return '<svg class="cover" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+
   '<rect width="400" height="240" fill="'+p.bg+'"/>'+
   '<circle cx="'+x1+'" cy="'+y1+'" r="'+r1+'" fill="'+p.a+'"/>'+
   '<circle cx="'+x2+'" cy="'+y2+'" r="'+r2+'" fill="'+p.b+'"/>'+
   '<circle cx="'+(x1-r1*.55)+'" cy="'+(y1+r1*.85)+'" r="'+(18+(h%14))+'" fill="'+p.ink+'" opacity=".9"/>'+
   '<g transform="translate('+gx+' '+gy+') scale(4.4)" stroke="'+p.ink+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+glyph+'</g>'+
   '</svg>';
}
/* Dimensional "clay" tile: soft gradient body, top highlight, cast shadow, ink glyph. size in px. */
function causeTile(c,size,extra){
  size=size||48;const p=PAL[c]||PAL.heart,id="g"+c+size+(extra||"");
  const fg=c==="laptop"?"#F1F3F0":"#141414";
  return '<svg class="ctile" width="'+size+'" height="'+size+'" viewBox="0 0 48 48" aria-hidden="true"><defs>'+
   '<linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+p.bg+'" stop-opacity="1"/><stop offset="1" stop-color="'+(c==="laptop"?"#000":p.b)+'" stop-opacity="'+(c==="laptop"?"1":".55")+'"/></linearGradient>'+
   '<linearGradient id="'+id+'h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'+
   '<rect x="3" y="6" width="42" height="40" rx="14" fill="#000" opacity=".12"/>'+
   '<rect x="3" y="3" width="42" height="40" rx="14" fill="url(#'+id+')"/>'+
   '<rect x="3" y="3" width="42" height="40" rx="14" fill="'+p.bg+'" opacity=".55"/>'+
   '<rect x="7" y="5" width="34" height="14" rx="8" fill="url(#'+id+'h)"/>'+
   '<g transform="translate(12 11)" fill="none" stroke="'+fg+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(P[c]||P.heart)+'</g></svg>';
}
/* Stylised neighbourhood map (Jayanagar-like grid, a lake, a canal park). Returns inner SVG markup in MAP space. */
function mapBase(){
  let g='<rect width="1000" height="640" fill="var(--map-land)"/>';
  // blocks
  for(let x=20;x<1000;x+=118)for(let y=20;y<640;y+=104){g+='<rect x="'+x+'" y="'+y+'" width="100" height="86" rx="10" fill="var(--map-block)"/>'}
  // water + parks
  g+='<path d="M760 120c60-40 170-30 200 30s-10 140-90 150-140-20-150-80 0-80 40-100z" fill="var(--map-water)"/>';
  g+='<path d="M-20 520C120 470 220 560 360 520s240-30 320 10" stroke="var(--map-water)" stroke-width="26" fill="none" stroke-linecap="round"/>';
  g+='<rect x="140" y="420" width="190" height="80" rx="18" fill="var(--map-park)"/>';
  g+='<rect x="470" y="138" width="90" height="70" rx="14" fill="var(--map-park)"/>';
  g+='<circle cx="660" cy="300" r="36" fill="var(--map-park)"/>';
  // roads
  g+='<g stroke="var(--map-road)" fill="none" stroke-linecap="round">';
  g+='<path d="M0 330H1000M505 0V640" stroke-width="16"/>';
  g+='<path d="M0 120L1000 210M120 0L300 640M820 0L700 640" stroke-width="10"/>';
  for(let x=128;x<1000;x+=118)g+='<path d="M'+x+' 0V640" stroke-width="4" opacity=".8"/>';
  for(let y=114;y<640;y+=104)g+='<path d="M0 '+y+'H1000" stroke-width="4" opacity=".8"/>';
  g+='</g>';
  // 3 km radius ring around the viewer
  g+='<circle cx="'+MAP.me.x+'" cy="'+MAP.me.y+'" r="300" fill="none" stroke="var(--tide)" stroke-width="2" stroke-dasharray="6 8" opacity=".55"/>';
  g+='<text x="'+(MAP.me.x+214)+'" y="'+(MAP.me.y-222)+'" font-size="15" font-family="var(--body)" font-weight="600" fill="var(--ink-2)">3 km</text>';
  // labels
  g+='<g font-family="var(--body)" font-size="14" font-weight="600" fill="var(--ink-3)" letter-spacing=".04em"><text x="790" y="215">LAKE</text><text x="170" y="465">CANAL PARK</text><text x="30" y="318">30TH CROSS</text><text x="515" y="625">STATION ROAD</text></g>';
  // me
  g+='<g class="me"><circle cx="'+MAP.me.x+'" cy="'+MAP.me.y+'" r="26" fill="var(--tide)" opacity=".18"><animate attributeName="r" values="14;34;14" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".35;0;.35" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="'+MAP.me.x+'" cy="'+MAP.me.y+'" r="10" fill="var(--tide)" stroke="#fff" stroke-width="4"/></g>';
  return g;
}

/* ---------- actions (state only; views re-render and notify) ---------- */
const A={
  join(id,slotIdx){const o=opp(id);const s=o.slots[slotIdx||0];S.joined[id]=s;haptic(12);track("join",{id,slot:s});return s},
  leave(id){delete S.joined[id]},
  save(id){S.saved[id]=!S.saved[id];haptic();return S.saved[id]},
  offer(rid){const r=req(rid);S.helping[rid]=true;const tm=(r.when.split(", ")[1]||"then");
    S.chats[rid]=[{k:"sys",t:"You offered to help. "+r.who+" has been told."},{k:"them",t:"Thank you! Could you come around "+tm+"? I will share the address here."}];track("offer",{id:rid});haptic(12)},
  openChat(rid){if(!S.chats[rid])S.chats[rid]=[{k:"sys",t:"Your number stays private in this chat."}]},
  say(rid,text,onReply){(S.chats[rid]=S.chats[rid]||[]).push({k:"me",t:text});
    setTimeout(()=>{S.chats[rid].push({k:"them",t:/late/i.test(text)?"No problem, take your time.":/details/i.test(text)?"Sure. It is the blue gate, second floor. I will be waiting.":"Perfect, see you then."});onReply&&onReply()},900)},
  createDrive(){const d=Object.assign({},S.draftDrive,{id:"d"+(S.drives.length+1),joined:0});S.drives.push(d);S.draftDrive.step=1;haptic(12);track("drive",d);return d},
  postAsk(){const a=Object.assign({},S.draftAsk,{id:"a"+(S.asks.length+1)});if(!a.what.trim())a.what="Carry two bags upstairs";S.asks.push(a);S.draftAsk={what:"",len:"15 min",when:"Today"};haptic(12);track("ask",a);return a},
  group(id){S.groups[id]=!S.groups[id];haptic();return S.groups[id]},
  like(id){S.liked[id]=!S.liked[id];haptic(6)},
  feedback(hid,v){S.feedback[hid]=v;track("feedback",{id:hid,value:v});haptic(10)},
  finishOnboarding(skip){if(!skip){const p=S.prefs;S.time=p.time==="short"?"30":p.time==="weekend"?"weekend":p.time==="hour"?"2h":"any";S.mode=p.way==="direct"?"help":"join"}S.onboarded=true},
  setLang(l){S.lang=l}
};

window.EK={track,save,guestId,STORE_KEY,ic,P,t,T,OPPS,REQS,GROUPS,POSTS,HISTORY,USER,TIPS,NOTES,REFS,JUMPS,CAUSES,PAL,S,A,opp,req,filteredOpps,cover,causeTile,mapBase,MAP,haptic,esc,fmtMins};
})();
