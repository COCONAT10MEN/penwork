/* ================= presenter UI: dock · ink · overview ================= */
var UI=false,ox=0,oy=0;
var dock=document.getElementById('dock'),ov=document.getElementById('ov'),toastEl=document.getElementById('toast'),inkwrap=document.getElementById('inkwrap');
var IC={
 prev:'<path d="M15 5l-7 7 7 7"/>',next:'<path d="M9 5l7 7-7 7"/>',
 grid:'<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
 full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
 exitfull:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
 ink:'<path d="M4 20l1.1-4.2L16.6 4.3a2.2 2.2 0 013.1 3.1L8.2 18.9z"/><path d="M14.6 6.3l3.1 3.1"/>',
 pen:'<path d="M4 20l1.1-4.2L16.6 4.3a2.2 2.2 0 013.1 3.1L8.2 18.9z"/><path d="M14.6 6.3l3.1 3.1"/>',
 hl:'<path d="M9 13.5l6.8-6.8 3.5 3.5-6.8 6.8z"/><path d="M9 13.5l-2.2 5.4 5.4-2.2"/><path d="M4 21h8" opacity=".5"/>',
 laser:'<rect x="1.5" y="14" width="14" height="5.4" rx="2.7" transform="rotate(-45 8.5 16.7)"/><path d="M6.6 17.6l2 2" opacity=".55"/><circle cx="17.6" cy="6.4" r="1.6" fill="currentColor" stroke="none"/><path d="M17.6 1.6v2M22.4 6.4h-2M21 3l-1.4 1.4M14.2 3l1.4 1.4M21 9.8l-1.4-1.4"/>',
 eraser:'<path d="M9 20h11"/><path d="M5.2 15l8.4-8.4a2 2 0 012.8 0l3 3a2 2 0 010 2.8L11.6 20H8.2L5.2 17.8a1.3 1.3 0 010-2.8z"/><path d="M9.6 10.6l5.2 5.2"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
 trash:'<path d="M4.5 7h15M9.5 7V4h5v3M6.5 7l1 13h9l1-13"/>',
 eye:'<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0112 6c6.3 0 10 6 10 6a17 17 0 01-3 3.7M6.3 7.6A17 17 0 002 12s3.7 7 10 7a9.6 9.6 0 004-.9"/>',
 close:'<path d="M6 6l12 12M18 6L6 18"/>',
 orient:'<path d="M20 12a8 8 0 01-14.2 5"/><path d="M4 12a8 8 0 0114.2-5"/><path d="M18.5 3v4h-4M5.5 21v-4h4"/>',
 board:'<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M7 20l2-3.5M17 20l-2-3.5M7.5 12l3-3 2.5 2.5L17 7.5"/>',
 slides:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M9 9.5l2.2 2 3.3-3.7"/>',
 bgk:'<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" opacity=".6"/>',
 p_blank:'<rect x="4" y="4" width="16" height="16" rx="3"/>',
 p_dots:'<g fill="currentColor" stroke="none"><circle cx="6.5" cy="6.5" r="1.5"/><circle cx="12" cy="6.5" r="1.5"/><circle cx="17.5" cy="6.5" r="1.5"/><circle cx="6.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="17.5" cy="12" r="1.5"/><circle cx="6.5" cy="17.5" r="1.5"/><circle cx="12" cy="17.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></g>',
 p_grid:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
 p_lines:'<path d="M4 6.5h16M4 11h16M4 15.5h16M4 20h16"/>',
 p_graph:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16" opacity=".5"/><path d="M4 12h16M12 4v16" stroke-width="2.2"/>',
 ptr:'<path d="M5.5 4.7l13 7.2-5.6 1.8-1.8 5.7z"/>',
 pick:'<path d="M4.3 19.7l.9-3.6 8.2-8.2 2.7 2.7-8.2 8.2z"/><path d="M12.2 9.1l2.7-2.7a2.2 2.2 0 013.1 0 2.2 2.2 0 010 3.1l-2.7 2.7"/><path d="M13.8 5.5l4.7 4.7"/>',
 redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
 up:'<path d="M6 15l6-6 6 6"/>',dn:'<path d="M6 9l6 6 6-6"/>',
 gear:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="9" cy="17" r="2.3"/>',
 grip:'<circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/>'
};
function ic(n){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+IC[n]+'</svg>';}
var TOOLS=[['pen','Pen (P)'],['hl','Highlighter (H)'],['laser','Laser pointer (L)'],['eraser','Eraser (E)']];
/* four ready-made colours per tool (the last one is the cyan of the Life of Physics logo) */
var COL={pen:['#e5352b','#1f6fe5','#10222b','#35aac5'],hl:['#ffe14a','#7df09a','#ff8fc8','#7fdcf0'],laser:['#ff2b2b','#2bff6a','#3d8bff','#e9ece0']};
var SZ={pen:[4,8,15],hl:[26,38,54],laser:[12,18,28],eraser:[30,50,80]};
var RNG={pen:[1,40,1],hl:[10,90,1],laser:[6,50,1],eraser:[10,160,2]};
/* every tool owns its own settings object — nothing is shared between tools */
function defCfg(){return {pen:{c:COL.pen[0],w:8,press:true,cust:[]},hl:{c:COL.hl[0],w:38,op:.42,cust:[]},laser:{c:COL.laser[0],w:18,life:1500,cust:[]},eraser:{w:50}};}
/* toolbar items: g = group (a separator is drawn between groups), i = icon, l = label, t = tooltip */
var ITEMS={
 ptr:{g:'t',i:'ptr',l:'Pointer',t:'Pointer — click to navigate (Esc)'},
 pen:{g:'t',i:'pen',l:'Pen',t:'Pen (P) — tap again for settings',tool:1},
 hl:{g:'t',i:'hl',l:'Highlighter',t:'Highlighter (H) — tap again for settings',tool:1},
 laser:{g:'t',i:'laser',l:'Laser pointer',t:'Laser pointer (L) — tap again for settings',tool:1},
 eraser:{g:'t',i:'eraser',l:'Eraser',t:'Eraser (E) — tap again for settings',tool:1},
 undo:{g:'e',i:'undo',l:'Undo',t:'Undo (Ctrl+Z)'},
 redo:{g:'e',i:'redo',l:'Redo',t:'Redo (Ctrl+Y)'},
 clear:{g:'e',i:'trash',l:'Clear this slide',t:'Clear this slide (C)'},
 hide:{g:'e',i:'eye',l:'Show / hide ink',t:'Show / hide ink'},
 wb:{g:'v',i:'board',l:'Whiteboard',t:'Whiteboard (W)'},
 grid:{g:'v',i:'grid',l:'All slides',t:'All slides (G)'},
 full:{g:'v',i:'full',l:'Full screen',t:'Full screen (F)'}
};
var ORDER_DEF=['ptr','pen','hl','laser','eraser','undo','redo','clear','hide','wb','grid','full'];
var POS=['br','bc','bl','tr','tc','tl'];
function defUI(){return {order:ORDER_DEF.slice(),hidden:[],tool:'pen',open:false,sink:true,sinkDelay:4,tablet:'on',vert:false,pos:'bc',tapAgain:true,dbl:true,rclick:true};}
var CFG=defCfg(),UIS=defUI(),STORE='lop-settings1';
function assign(d,s){if(s&&typeof s==='object')for(var k in s)d[k]=s[k];return d;}
function fixAll(){
  var seen={},o=[],t,k;
  (UIS.order||[]).forEach(function(id){if(ITEMS[id]&&!seen[id]){seen[id]=1;o.push(id);}});
  ORDER_DEF.forEach(function(id){if(!seen[id])o.push(id);});UIS.order=o;
  UIS.hidden=(UIS.hidden||[]).filter(function(id){return ITEMS[id];});
  if(!ITEMS[UIS.tool]||!ITEMS[UIS.tool].tool)UIS.tool='pen';
  if(['auto','on','off'].indexOf(UIS.tablet)<0)UIS.tablet='on';
  UIS.sinkDelay=+UIS.sinkDelay||4;UIS.vert=!!UIS.vert;UIS.open=!!UIS.open;UIS.sink=UIS.sink!==false;UIS.tapAgain=UIS.tapAgain!==false;UIS.dbl=UIS.dbl!==false;UIS.rclick=UIS.rclick!==false;
  if(POS.indexOf(UIS.pos)<0)UIS.pos='bc';
  if(UIS.vert&&UIS.pos.charAt(1)==='c')UIS.pos=UIS.pos.charAt(0)+'r';
  var D=defCfg();
  for(t in D){
    for(k in D[t]){
      var v=CFG[t][k],dv=D[t][k];
      if(Array.isArray(dv)){v=Array.isArray(v)?v.filter(function(z){return /^#[0-9a-f]{6}$/i.test(String(z));}).map(function(z){return String(z).toLowerCase();}).slice(0,3):[];}
      else if(typeof dv==='number'){v=+v;if(!isFinite(v))v=dv;if(k==='w')v=Math.max(RNG[t][0],Math.min(RNG[t][1],v));if(k==='op')v=Math.max(.15,Math.min(.85,v));if(k==='life')v=Math.max(300,Math.min(4000,v));}
      else if(typeof dv==='boolean')v=v!==false;
      else if(k==='c'&&!/^#[0-9a-f]{6}$/i.test(String(v)))v=dv;
      else if(k==='c')v=String(v).toLowerCase();
      CFG[t][k]=v;
    }
  }
}
function loadSettings(){
  var d=window.LOP_DEFAULTS||{},s=null;
  try{s=JSON.parse(localStorage.getItem(STORE)||'null');}catch(x){}
  [d,s].forEach(function(src){if(!src)return;assign(UIS,src.ui);if(src.tools)for(var t in CFG)assign(CFG[t],src.tools[t]);});
  fixAll();
}
var saveT=0;
function saveSettings(){clearTimeout(saveT);saveT=setTimeout(function(){try{localStorage.setItem(STORE,JSON.stringify({v:1,ui:UIS,tools:CFG}));}catch(x){}},120);}
loadSettings();

var wbOn=false,wy=0,prevAnnot=false,hidSave=false;
function ikey(){return wbOn?'wb':cur;}
function inkMode(){return annot||wbOn;}
var tool=UIS.tool,annot=false,inkHidden=false;
function colorOf(t){t=t||tool;return CFG[t]&&CFG[t].c||'#fff';}
function sizeOf(t){t=t||tool;return CFG[t].w;}

var vert=UIS.vert,sideR=UIS.pos.charAt(1)==='r',sideT=UIS.pos.charAt(0)==='t',dockOpen=UIS.open;
/* tablet mode: bigger touch targets. 'on' by default; 'auto' follows the primary pointer (coarse = touch) */
var mqC=window.matchMedia?matchMedia('(pointer: coarse)'):null;
function tabletOn(){return UIS.tablet==='on'||(UIS.tablet==='auto'&&!!(mqC&&mqC.matches));}
function applyTablet(){document.documentElement.classList.toggle('tab',tabletOn());if(typeof anyPop==='function'&&anyPop())setTimeout(repopPlace,30);}
if(mqC&&mqC.addEventListener)mqC.addEventListener('change',applyTablet);

var LOGO_SVG='@@LOGO@@';
function SEPk(k){return '<span class="sep" data-k="'+k+'"></span>';}
function btnHTML(id){
  var it=ITEMS[id];
  return '<button id="b'+id+'" data-k="'+id+'" data-a="'+(it.tool?'tool':id)+'"'+(it.tool?' data-v="'+id+'" class="tl"':'')+' title="'+it.t+'" aria-label="'+it.l+'">'+ic(it.i)+'</button>';
}
var BGB='<button id="bbg" data-k="bbg" data-a="wbbg" title="Board background (B)" aria-label="Board background">';
/* the toolbar as an ordered list of keyed parts (buttons, separators, board-background button) */
function mainList(){
  var L=[],pg=null,bg=false,n={},vis=UIS.order.filter(function(id){return UIS.hidden.indexOf(id)<0;});
  vis.forEach(function(id){
    var g=ITEMS[id].g;
    if(pg&&g!==pg){n[g]=(n[g]||0)+1;L.push({k:'sep'+g+n[g],h:SEPk('sep'+g+n[g])});}
    pg=g;
    if(id==='wb'){L.push({k:'bbg',h:BGB+ic('bgk')+'</button>'});bg=true;}
    L.push({k:id,h:btnHTML(id)});
  });
  if(!bg){L.push({k:'sepbg',h:SEPk('sepbg')});L.push({k:'bbg',h:BGB+ic('bgk')+'</button>'});}
  return L;
}
function mainHTML(){return mainList().map(function(o){return o.h;}).join('');}
/* reconcile #main with the settings; buttons that appear / disappear grow / shrink in place (ani) */
function fillMain(ani){
  var m=document.getElementById('main');if(!m)return;
  var L=mainList(),ax=vert?'h':'w',go=!!ani&&dockOpen&&!REDUCED&&!!m.animate,have={},want={},prev=null;
  [].slice.call(m.children).forEach(function(c){var k=c.getAttribute('data-k');if(k)have[k]=c;else m.removeChild(c);});
  L.forEach(function(o){want[o.k]=1;});
  for(var k0 in have)if(!want[k0]&&!have[k0]._exit)have[k0]._exit=2;
  L.forEach(function(o){
    var el=have[o.k],isNew=!el;
    if(isNew){var t=document.createElement('div');t.innerHTML=o.h;el=t.firstChild;}
    var nx=prev?prev.nextSibling:m.firstChild;
    while(nx&&nx!==el&&nx._exit)nx=nx.nextSibling;
    if(nx!==el)m.insertBefore(el,nx);
    if(isNew){
      var offWb=((o.k==='ptr'||o.k==='hide'||o.k==='grid')&&wbOn)||(o.k==='bbg'&&!wbOn);
      if(go&&!offWb){el.classList.add('gone');el._hid=true;collapse(el,false,true,ax);}
    }else if(el._exit){el._exit=false;el.style.pointerEvents='';collapse(el,false,go,ax);}
    prev=el;
  });
  for(var k in have){
    if(want[k])continue;
    var el=have[k];if(el._exit===true)continue;
    if(!go||el.classList.contains('gone')){m.removeChild(el);continue;}
    el._exit=true;el.style.pointerEvents='none';
    if(el._hid===undefined)el._hid=false;
    var a=collapse(el,true,true,ax);
    if(!a){m.removeChild(el);continue;}
    (function(el,a){var f=a.onfinish;a.onfinish=function(){if(f)f();if(el._exit&&el.parentNode)el.parentNode.removeChild(el);};})(el,a);
  }
}
function buildDock(){
  dock.innerHTML='<div id="shell"><button id="logo" data-a="logo" aria-label="Toolbar" aria-expanded="false" title="Tap: toolbar · Drag: move · Right-click / long-press: settings"><span class="lg">'+LOGO_SVG+'</span><i class="dot"></i></button><div class="dk" id="main"></div></div>';
  fillMain();
}
/* collapsible dock parts shrink / grow in place (never re-animate when nothing changes) */
function snap_(el,P){var cs=getComputedStyle(el),o={};P.forEach(function(p){o[p]=parseFloat(cs[p])||0;});return o;}
function px_(o){var r={};for(var k in o)r[k]=o[k]+'px';return r;}
function collapse(el,hide,ani,axis){
  if(!el)return null;
  if(el._hid===hide)return el._an?el._an[0]:null;
  var init=el._hid===undefined;el._hid=hide;
  var P=axis==='h'?['height','paddingTop','paddingBottom','borderTopWidth','borderBottomWidth','marginTop','marginBottom']:['width','paddingLeft','paddingRight','borderLeftWidth','borderRightWidth','marginLeft','marginRight'];
  var live=el._an&&el._an.length,cur=null;
  if(live){cur=snap_(el,P);el._an.forEach(function(x){try{x.cancel();}catch(e){}});el._an=null;el.style.overflow='';}
  if(init||!ani||REDUCED||!el.animate){el.classList.toggle('gone',hide);return null;}
  el.classList.remove('gone');
  var full=snap_(el,P),zero={},gap=parseFloat(getComputedStyle(el.parentNode).gap)||0,k;
  for(k in full)zero[k]=(k.indexOf('margin')===0)?-gap/2:0;
  var A=hide?(cur||full):(cur||zero),B=hide?zero:full;
  el.style.overflow='hidden';
  var ea=hide?'cubic-bezier(.5,0,.2,1)':'cubic-bezier(.2,.8,.2,1)';
  var a1=el.animate([px_(A),px_(B)],{duration:hide?420:560,easing:ea,fill:'forwards'});
  var a2;
  if(el.id==='main'){
    /* the pill's glass / rim / sheen are scaled by --wf, which follows the width: the closing toolbar is just the logo's own capsule getting shorter */
    var w0=cur?parseFloat(getComputedStyle(el).getPropertyValue('--wf')):(hide?1:0);if(isNaN(w0))w0=hide?1:0;
    a2=el.animate([{'--wf':w0},{'--wf':hide?0:1}],{duration:hide?420:560,easing:ea,fill:'both'});
  }else a2=el.animate(hide?[{opacity:cur?getComputedStyle(el).opacity:1},{opacity:0}]:[{opacity:0},{opacity:1}],{duration:hide?240:340,delay:hide?0:110,easing:'ease',fill:'both'});
  el._an=a2?[a1,a2]:[a1];
  a1.onfinish=function(){
    if(el._hid!==hide)return;
    el._an.forEach(function(x){try{x.cancel();}catch(e){}});el._an=null;el.style.overflow='';
    el.classList.toggle('gone',hide);
  };
  return a1;
}
function syncDock(ani){
  var q=function(s){var e=dock.querySelector(s);return e&&e._exit?null:e;},ax=vert?'h':'w';
  collapse(q('#bptr'),wbOn,ani,ax);collapse(q('#bhide'),wbOn,ani,ax);collapse(q('#bgrid'),wbOn,ani,ax);collapse(q('#bbg'),!wbOn,ani,ax);
  var seps=dock.querySelectorAll('#main .sep');
}
function setIc(b,n,ani){
  if(!b||b._ic===n)return;var had=b._ic!==undefined;b._ic=n;b.innerHTML=ic(n);
  if(had&&ani&&b.firstChild.animate&&!REDUCED)b.firstChild.animate([{transform:'rotate(-70deg) scale(.3)',opacity:0},{transform:'none',opacity:1}],{duration:420,easing:'cubic-bezier(.3,1.5,.5,1)'});
}
function updActs(){
  var k=ikey(),h=hist[k],r=redoS[k],u=document.getElementById('bundo'),d=document.getElementById('bredo'),c=document.getElementById('bclear');
  if(u)u.classList.toggle('dis',!(h&&h.length));if(d)d.classList.toggle('dis',!(r&&r.length));if(c)c.classList.toggle('dis',!hasInk());
}
function renderDock(ani){
  if(!document.getElementById('shell'))buildDock();
  var tb=dock.querySelectorAll('[data-a=tool]'),i,sh=document.getElementById('shell'),lg=document.getElementById('logo');
  for(i=0;i<tb.length;i++){var v=tb[i].getAttribute('data-v');tb[i].classList.toggle('act',annot&&v===tool);tb[i].classList.toggle('cur',!annot&&v===tool);if(CFG[v].c)tb[i].style.setProperty('--tc',CFG[v].c);}
  var pt=document.getElementById('bptr');if(pt)pt.classList.toggle('act',!annot);
  dock.classList.toggle('vert',vert);dock.classList.toggle('wb',wbOn);dock.classList.toggle('open',dockOpen);
  sh.className=vert?(sideT?'cv':'cr'):(sideR?'rr':'rw');
  dock.setAttribute('data-sk',vert?(sideR?'r':'l'):(sideT?'t':'b'));
  lg.setAttribute('aria-expanded',dockOpen?'true':'false');
  lg.classList.toggle('armed',annot);lg.style.setProperty('--tc',CFG[tool].c||'#fff');
  var wbb=document.getElementById('bwb');if(wbb){setIc(wbb,wbOn?'slides':'board',ani);wbb.classList.toggle('act',wbOn);wbb.title=wbOn?'Back to slides (W)':'Whiteboard (W)';}
  var hb=document.getElementById('bhide');if(hb)setIc(hb,inkHidden?'eyeoff':'eye',true);
  collapse(document.getElementById('main'),!dockOpen,ani,vert?'h':'w');
  fsIcon();updActs();syncDock(!!ani);
}
function fsIcon(){setIc(document.getElementById('bfull'),document.fullscreenElement?'exitfull':'full',true);}
function hasInk(){var a=ink[ikey()];return !!(a&&a.length);}
document.addEventListener('fullscreenchange',fsIcon);
function toggleFS(){try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();}catch(e){}}

var tt=0;
function toast(h,ms){toastEl.innerHTML=h;toastEl.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){toastEl.classList.remove('on');},ms||2200);}
var dimT=0,sinkT=0;
function poke(){dock.classList.remove('dim');clearTimeout(dimT);dimT=setTimeout(function(){dock.classList.add('dim');},3500);}
/* the closed logo sinks half-way off its screen edge when left alone, and rises again on hover / touch */
function armSink(){
  clearTimeout(sinkT);dock.classList.remove('sink');
  if(dockOpen||!UIS.sink)return;
  sinkT=setTimeout(function(){if(!dockOpen&&UIS.sink&&!anyPop()&&!lgG&&!grip&&!G)dock.classList.add('sink');else armSink();},UIS.sinkDelay*1000);
}
function toggleDock(on,ani){
  on=!!on;if(on===dockOpen)return;dockOpen=on;
  if(!on)closePops();
  renderDock(ani!==false);poke();armSink();
}
var busyT=0;
function busy_(on){clearTimeout(busyT);if(on)dock.classList.add('busy');else busyT=setTimeout(function(){dock.classList.remove('busy');},450);}

function setTool(t,quiet){
  tool=t;trail=[];headOn=false;renderDock();updRing();
  if(!quiet)toast('<b>'+TOOLS.filter(function(x){return x[0]===t;})[0][1].replace(/ \(.\)/,'')+'</b>',1100);
}
function setAnnot(on){
  if(!on&&wbOn)on=true;
  annot=!!on;if(!annot){trail=[];headOn=false;hideRing();closePops();}
  renderDock(true);poke();
}

/* ---------- ink data ---------- */
var ink={},hist={},redoS={};
var cv={},cx={},dpr=1;
function mkCanvas(id,opts){var c=document.createElement('canvas');c.id=id;inkwrap.appendChild(c);cv[id]=c;cx[id]=c.getContext('2d',opts||{});}
mkCanvas('cHL');mkCanvas('cHLv');mkCanvas('cPen',{desynchronized:true});mkCanvas('cLive');
var hlT=document.createElement('canvas'),hlX=hlT.getContext('2d');
function sizeCanvases(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  for(var id in cv){var c=cv[id],x=cx[id];c.width=Math.round(innerWidth*dpr);c.height=Math.round(innerHeight*dpr);
    x.setTransform(dpr*scaleF,0,0,dpr*scaleF,dpr*ox,dpr*oy);
    if(!wbOn){x.beginPath();x.rect(0,0,1920,1080);x.clip();}}
  hlT.width=cv.cHL.width;hlT.height=cv.cHL.height;
  if(!wbOn){hlX.setTransform(dpr*scaleF,0,0,dpr*scaleF,dpr*ox,dpr*oy);hlX.beginPath();hlX.rect(0,0,1920,1080);hlX.clip();}
  applyTx();
}
function applyTx(){var ty=dpr*(oy-scaleF*(wbOn?wy:0));for(var id in cx)cx[id].setTransform(dpr*scaleF,0,0,dpr*scaleF,dpr*ox,ty);}
function clearAll(){for(var id in cx){var x=cx[id];x.save();x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cv[id].width,cv[id].height);x.restore();}}
function bbox(st){
  if(st.bb&&st.bbn===st.pts.length)return st.bb;
  var P=st.pts,x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,i,m=st.w+2;
  for(i=0;i<P.length;i++){if(P[i][0]<x0)x0=P[i][0];if(P[i][0]>x1)x1=P[i][0];if(P[i][1]<y0)y0=P[i][1];if(P[i][1]>y1)y1=P[i][1];}
  st.bb=[x0-m,y0-m,x1+m,y1+m];st.bbn=P.length;return st.bb;
}
function onFit(){if(bgOpen)setTimeout(bgPlace,0);ox=(innerWidth-1920*scaleF)/2;oy=(innerHeight-1080*scaleF)/2;if(!UI)return;sizeCanvases();inkRedraw();if(wbOn)layoutWb();if(ovOpen)layoutOv();}
function pw(st,p){return (st.k==='h'||st.np)?st.w:Math.max(.9,st.w*(.4+1.2*p));}
function drawStep(c,st,n,fin){
  var P=st.pts,x0,y0,x1,y1;
  c.strokeStyle=st.c;c.lineCap='round';c.lineJoin='round';c.lineWidth=pw(st,P[n][2]);c.beginPath();
  if(n===1){x0=P[0][0];y0=P[0][1];x1=(P[0][0]+P[1][0])/2;y1=(P[0][1]+P[1][1])/2;c.moveTo(x0,y0);c.lineTo(x1,y1);}
  else{x0=(P[n-2][0]+P[n-1][0])/2;y0=(P[n-2][1]+P[n-1][1])/2;x1=(P[n-1][0]+P[n][0])/2;y1=(P[n-1][1]+P[n][1])/2;c.moveTo(x0,y0);c.quadraticCurveTo(P[n-1][0],P[n-1][1],x1,y1);}
  c.stroke();
  if(fin){c.beginPath();c.moveTo(x1,y1);c.lineTo(P[n][0],P[n][1]);c.stroke();}
}
function strokeTo(c,st){
  var P=st.pts;
  if(P.length===1){c.fillStyle=st.c;c.beginPath();c.arc(P[0][0],P[0][1],pw(st,P[0][2])/2,0,6.2832);c.fill();return;}
  for(var n=1;n<P.length;n++)drawStep(c,st,n,n===P.length-1);
}
/* a highlighter stroke is painted opaque (so its own overlaps never darken), then laid onto the highlight
   layer with ITS OWN strength — every stroke keeps the strength it was drawn with */
function drawHL(st,c,T,X){
  c=c||cx.cHL;T=T||hlT;X=X||hlX;
  var m=c.getTransform(),bb=bbox(st),W=T.width,H=T.height,pad=2;
  var x0=Math.max(0,Math.floor(m.a*bb[0]+m.e)-pad),y0=Math.max(0,Math.floor(m.d*bb[1]+m.f)-pad),x1=Math.min(W,Math.ceil(m.a*bb[2]+m.e)+pad),y1=Math.min(H,Math.ceil(m.d*bb[3]+m.f)+pad);
  if(x1<=x0||y1<=y0)return;
  X.save();X.setTransform(1,0,0,1,0,0);X.clearRect(x0,y0,x1-x0,y1-y0);X.restore();
  X.setTransform(m);strokeTo(X,st);
  c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=st.op||.42;c.globalCompositeOperation='multiply';
  c.drawImage(T,x0,y0,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0);c.restore();
}
function drawStroke(st){if(st.k==='h')drawHL(st);else strokeTo(cx.cPen,st);}
function inkRedraw(){
  if(!UI)return;
  clearAll();
  var a=ink[ikey()]||[],top=0,bot=0;
  if(wbOn){top=wy-oy/scaleF-80;bot=wy+(innerHeight-oy)/scaleF+80;}
  for(var i=0;i<a.length;i++){if(G&&G.st===a[i]&&a[i].k==='h'&&!G.committed)continue;if(inkSkip&&inkSkip.indexOf(a[i])>=0)continue;if(wbOn){var bb=bbox(a[i]);if(bb[3]<top||bb[1]>bot)continue;}drawStroke(a[i]);}
  trail=[];if(ovVis)ovVis[cur]=1;
  document.body.classList.toggle('onhero',!!(slides[cur]&&slides[cur].classList.contains('hero')));
  updActs();
}
function pushHist(i,snap){(hist[i]=hist[i]||[]).push(snap);if(hist[i].length>60)hist[i].shift();redoS[i]=[];updActs();}
/* ---- ink effects: strokes that appear / vanish are painted on a throw-away layer that is animated ---- */
var inkSkip=null,fxEls=[];
function fxCancel(){
  fxEls.forEach(function(e){try{e.getAnimations().forEach(function(a){a.cancel();});}catch(x){}if(e.parentNode)e.parentNode.removeChild(e);});
  fxEls=[];if(inkSkip){inkSkip=null;inkRedraw();}
}
function fxLayer(cls,before){
  var c=document.createElement('canvas');c.className='fx '+cls;c.width=cv.cPen.width;c.height=cv.cPen.height;
  inkwrap.insertBefore(c,before||null);fxEls.push(c);
  var x=c.getContext('2d');x.setTransform(dpr*scaleF,0,0,dpr*scaleF,dpr*ox,dpr*(oy-scaleF*(wbOn?wy:0)));
  if(!wbOn){x.beginPath();x.rect(0,0,1920,1080);x.clip();}
  return x;
}
function inkFx(list,mode,done){
  if(REDUCED||!list.length||!UI){if(done)done();return;}
  var pens=[],hls=[],x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,els=[],i,b;
  list.forEach(function(s){(s.k==='h'?hls:pens).push(s);b=bbox(s);if(b[0]<x0)x0=b[0];if(b[1]<y0)y0=b[1];if(b[2]>x1)x1=b[2];if(b[3]>y1)y1=b[3];});
  var px=ox+scaleF*((x0+x1)/2),py=oy+scaleF*((y0+y1)/2-(wbOn?wy:0));
  if(hls.length){var h=fxLayer('fxh',cv.cPen);hls.forEach(function(s){drawHL(s,h);});els.push(h.canvas);}
  if(pens.length){var p=fxLayer('fxp');pens.forEach(function(s){strokeTo(p,s);});els.push(p.canvas);}
  var kf,opt;
  if(mode==='in'){
    kf=[{opacity:0,filter:'blur(7px)',transform:'scale(1.09)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}];
    opt={duration:440,easing:'cubic-bezier(.2,.8,.25,1)',fill:'both'};
  }else if(mode==='clear'){
    var m='linear-gradient(100deg,transparent 28%,#000 72%)';
    kf=[{opacity:1,filter:'blur(0px)',transform:'translateY(0)',maskPosition:'100% 0',webkitMaskPosition:'100% 0'},
        {opacity:1,filter:'blur(2px)',transform:'translateY(-4px)',maskPosition:'38% 0',webkitMaskPosition:'38% 0',offset:.7},
        {opacity:0,filter:'blur(7px)',transform:'translateY(-16px)',maskPosition:'0% 0',webkitMaskPosition:'0% 0'}];
    opt={duration:680,easing:'cubic-bezier(.45,.05,.4,1)',fill:'both'};
    els.forEach(function(e){e.style.webkitMaskImage=e.style.maskImage=m;e.style.webkitMaskSize=e.style.maskSize='300% 100%';e.style.webkitMaskRepeat=e.style.maskRepeat='no-repeat';});
  }else{
    kf=[{opacity:1,filter:'blur(0px)',transform:'scale(1)'},{opacity:0,filter:'blur(6px)',transform:'scale(1.1)'}];
    opt={duration:380,easing:'cubic-bezier(.3,.6,.3,1)',fill:'both'};
  }
  var n=els.length;
  els.forEach(function(e){
    e.style.transformOrigin=px+'px '+py+'px';
    var an=e.animate(kf,opt);
    an.onfinish=function(){
      if(e.parentNode)e.parentNode.removeChild(e);var j=fxEls.indexOf(e);if(j>=0)fxEls.splice(j,1);
      if(--n===0&&done)done();
    };
  });
}
function swapInk(k,nw,kind){
  fxCancel();var old=ink[k]||[];ink[k]=nw;
  var rem=old.filter(function(s){return nw.indexOf(s)<0;}),add=nw.filter(function(s){return old.indexOf(s)<0;});
  inkSkip=(add.length&&!REDUCED)?add:null;
  inkRedraw();
  if(rem.length)inkFx(rem,kind==='clear'?'clear':'out');
  if(add.length)inkFx(add,'in',function(){inkSkip=null;inkRedraw();});
  if(wbOn)wbBar();
}
function undo(){var k=ikey(),h=hist[k];if(h&&h.length){(redoS[k]=redoS[k]||[]).push((ink[k]||[]).slice());swapInk(k,h.pop(),'undo');}else toast('Nothing to undo',900);}
function redo(){var k=ikey(),r=redoS[k];if(r&&r.length){(hist[k]=hist[k]||[]).push((ink[k]||[]).slice());swapInk(k,r.pop(),'redo');}else toast('Nothing to redo',900);}
function clearInk(){var k=ikey();if(hasInk()){pushHist(k,ink[k].slice());swapInk(k,[],'clear');}}

/* ---------- eraser ---------- */
function segDist(px,py,ax,ay,bx,by){var dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=t<0?0:t>1?1:t;var qx=ax+t*dx-px,qy=ay+t*dy-py;return Math.sqrt(qx*qx+qy*qy);}
function strokeHit(st,x,y,r){
  var P=st.pts,rr=r+(st.k==='h'?st.w*.45:st.w*.5);
  if(P.length===1)return Math.hypot(P[0][0]-x,P[0][1]-y)<rr;
  for(var n=1;n<P.length;n++)if(segDist(x,y,P[n-1][0],P[n-1][1],P[n][0],P[n][1])<rr)return true;
  return false;
}
function eraseAt(x,y,g){
  var a=ink[g.slide];if(!a||!a.length)return;
  var r=CFG.eraser.w/2,keep=[];
  for(var i=0;i<a.length;i++)if(!strokeHit(a[i],x,y,r))keep.push(a[i]);
  if(keep.length!==a.length){if(!g.snap)g.snap=a.slice();ink[g.slide]=keep;g.erased=true;if(g.slide===ikey())inkRedraw();}
}
function eraseTo(x,y,g){
  var r=CFG.eraser.w/2,dx=x-g.lx,dy=y-g.ly,d=Math.hypot(dx,dy),n=Math.max(1,Math.ceil(d/(r*.6)));
  for(var i=1;i<=n;i++)eraseAt(g.lx+dx*i/n,g.ly+dy*i/n,g);
  g.lx=x;g.ly=y;
}

/* ---------- laser ---------- */
var trail=[],headOn=false,lx=0,ly=0,lraf=0;
function laserKick(){if(!lraf)lraf=requestAnimationFrame(laserTick);}
function laserTick(){
  lraf=0;var c=cx.cLive,now=performance.now();
  c.clearRect(0,0,1920,1080);
  var LIFE=CFG.laser.life;
  while(trail.length&&now-trail[0][2]>LIFE)trail.shift();
  var col=colorOf('laser'),w=sizeOf('laser');
  c.lineCap='round';c.lineJoin='round';c.strokeStyle=col;
  for(var i=1;i<trail.length;i++){
    var a=trail[i-1],b=trail[i],k=1-(now-b[2])/LIFE;if(k<=0)continue;
    if(b[3])continue; // pen-up break
    c.globalAlpha=Math.max(0,k*.75);c.lineWidth=Math.max(1.5,w*.8*k);
    c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();
  }
  c.globalAlpha=1;
  if(headOn){
    var g=c.createRadialGradient(lx,ly,0,lx,ly,w*1.9);
    g.addColorStop(0,col);g.addColorStop(.28,col);g.addColorStop(.3,hexA(col,.5));g.addColorStop(1,hexA(col,0));
    c.fillStyle=g;c.beginPath();c.arc(lx,ly,w*1.9,0,6.2832);c.fill();
    c.fillStyle='rgba(255,255,255,.9)';c.beginPath();c.arc(lx,ly,w*.2,0,6.2832);c.fill();
  }
  if(trail.length||headOn)lraf=requestAnimationFrame(laserTick);
}
function hexA(h,a){var n=parseInt(h.slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';}
function laserPt(x,y,brk){lx=x;ly=y;headOn=false;trail.push([x,y,performance.now(),brk?1:0]);if(trail.length>400)trail.shift();laserKick();}

/* ---------- tool cursor: the real OS cursor (zero lag), swapped to a tool-shaped image ---------- */
var cKey='',cVal='',curApplied='',lastType='';
function toolCursor(er){
  var t=er?'eraser':tool,col=colorOf(t),sc=scaleF,key=t+col+sizeOf(t)+'|'+Math.round(sc*100);
  if(key===cKey)return cVal;cKey=key;
  var d,S,h,svg,H='<svg xmlns="http://www.w3.org/2000/svg" ';
  if(t==='eraser'){d=Math.min(110,Math.round(CFG.eraser.w*sc));S=d+8;h=S/2;
    svg=H+'width="'+S+'" height="'+S+'"><circle cx="'+h+'" cy="'+h+'" r="'+(d/2)+'" fill="#fff" fill-opacity=".16" stroke="#fff" stroke-width="2"/><circle cx="'+h+'" cy="'+h+'" r="'+(d/2+1.5)+'" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1"/></svg>';}
  else if(t==='hl'){d=Math.min(110,Math.round(sizeOf('hl')*sc));S=d+8;h=S/2;
    svg=H+'width="'+S+'" height="'+S+'"><rect x="4" y="4" width="'+d+'" height="'+d+'" rx="6" fill="'+col+'" fill-opacity=".4" stroke="'+col+'" stroke-width="2"/><rect x="3" y="3" width="'+(d+2)+'" height="'+(d+2)+'" rx="7" fill="none" stroke="#000" stroke-opacity=".3"/></svg>';}
  else if(t==='laser'){S=60;h=30;
    svg=H+'width="60" height="60"><defs><radialGradient id="g"><stop offset="0" stop-color="'+col+'"/><stop offset=".3" stop-color="'+col+'"/><stop offset=".34" stop-color="'+col+'" stop-opacity=".55"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></radialGradient></defs><circle cx="30" cy="30" r="29" fill="url(#g)"/><circle cx="30" cy="30" r="3" fill="#fff" fill-opacity=".92"/></svg>';}
  else{d=Math.max(8,Math.round(sizeOf('pen')*sc));S=d+8;h=S/2;
    svg=H+'width="'+S+'" height="'+S+'"><circle cx="'+h+'" cy="'+h+'" r="'+(d/2)+'" fill="'+col+'" stroke="#fff" stroke-width="1.5"/><circle cx="'+h+'" cy="'+h+'" r="'+(d/2+1)+'" fill="none" stroke="#000" stroke-opacity=".4" stroke-width=".8"/></svg>';}
  cVal='url("data:image/svg+xml,'+encodeURIComponent(svg)+'") '+h+' '+h+', crosshair';
  return cVal;
}
function applyCursor(type,er){
  var want='';
  if(type==='pen'||(type==='mouse'&&inkMode()))want=toolCursor(er);
  if(want!==curApplied){curApplied=want;document.body.style.cursor=want;document.documentElement.style.cursor=want;}
}
function hideRing(){curApplied='';document.body.style.cursor='';document.documentElement.style.cursor='';}
function updRing(){cKey='';if(lastType)applyCursor(lastType,false);}
function moveRing(e,er){lastType=e.pointerType;applyCursor(e.pointerType,er);}

/* ---------- input routing (pen draws · finger navigates · mouse clicks) ---------- */
var INTER='input,button,select,textarea,a,.op,.btn,.wsel,[data-r],[data-a]';
function inUI(t){return !!(t&&t.closest&&t.closest('#dock,#ov,#bgpop,#cfgpop,#cpop,#setpop'));}
function isInter(t){return !!(t&&t.closest&&t.closest(INTER));}
function isEraserBtn(e){return e.pointerType==='pen'?!!((e.buttons&32)||e.button===5||(e.buttons&2)):(e.pointerType==='mouse'&&!!(e.buttons&2));}
function stPt(e){return [(e.clientX-ox)/scaleF,(e.clientY-oy)/scaleF+(wbOn?wy:0),e.pointerType==='pen'&&e.pressure>0?e.pressure:.5];}
var G=null,penSeen=0,swallowUntil=0,tG=null;
function capture(e){try{document.documentElement.setPointerCapture(e.pointerId);}catch(x){}}
function startGesture(e,er){
  var p=stPt(e),mode=er||tool==='eraser'?'erase':(tool==='laser'?'laser':'draw');
  busy_(true);
  G={id:e.pointerId,type:e.pointerType,mode:mode,slide:ikey(),x0:e.clientX,y0:e.clientY,lx:p[0],ly:p[1],snap:null,st:null,all:null};
  if(mode==='draw'){
    var a=ink[G.slide]=ink[G.slide]||[];G.snap=a.slice();
    G.st={k:tool==='hl'?'h':'p',c:colorOf(),w:sizeOf(),op:CFG.hl.op,np:tool==='pen'&&!CFG.pen.press,pts:[p]};G.all=[p];a.push(G.st);
    var c=G.st.k==='h'?cx.cHLv:cx.cPen;
    if(G.st.k==='h')cv.cHLv.style.opacity=G.st.op;
    c.fillStyle=G.st.c;c.beginPath();c.arc(p[0],p[1],pw(G.st,p[2])/2,0,6.2832);c.fill();
    updActs();
  }else if(mode==='erase'){eraseAt(p[0],p[1],G);}
  else{laserPt(p[0],p[1],true);}
}
function endGesture(){
  var g=G;G=null;if(!g)return;
  if(g.mode==='draw'&&g.st){
    var P=g.st.pts;
    if(g.st.k==='h'){
      if(!g.committed){if(P.length>1)drawStep(cx.cHLv,g.st,P.length-1,true);var lv=cx.cHLv;lv.save();lv.setTransform(1,0,0,1,0,0);lv.clearRect(0,0,cv.cHLv.width,cv.cHLv.height);lv.restore();drawHL(g.st);}
    }else if(P.length>1)drawStep(cx.cPen,g.st,P.length-1,true);
    pushHist(g.slide,g.snap);
  }else if(g.mode==='erase'&&g.erased)pushHist(g.slide,g.snap);
  else if(g.mode==='laser'){trail.push([lx,ly,performance.now(),1]);laserKick();}
  swallowUntil=performance.now()+350;busy_(false);
}
function moveGesture(e){
  var g=G,er=isEraserBtn(e);
  if(g.type!=='touch'){
    var wasE=g.mode==='erase'&&g.byBtn;
    if(er&&g.mode!=='erase'){endGesture();startGesture(e,true);G.byBtn=true;return;}
    if(!er&&wasE&&tool!=='eraser'){endGesture();startGesture(e,false);return;}
  }
  var evs=(e.getCoalescedEvents&&e.getCoalescedEvents())||[];if(!evs.length)evs=[e];
  for(var i=0;i<evs.length;i++){
    var p=stPt(evs[i]);
    if(g.mode==='draw'){
      var st=g.st;
      if(e.shiftKey){st.pts=[g.all[0],p];g.committed=true;inkRedraw();continue;}
      var L=g.all[g.all.length-1];if(Math.abs(p[0]-L[0])+Math.abs(p[1]-L[1])<.6&&Math.abs(p[2]-L[2])<.02)continue;
      g.all.push(p);if(st.pts.length<2||st.pts[st.pts.length-1]===g.all[g.all.length-2])st.pts.push(p);else st.pts=g.all.slice();
      drawStep(st.k==='h'?cx.cHLv:cx.cPen,st,st.pts.length-1,false);
    }else if(g.mode==='erase')eraseTo(p[0],p[1],g);
    else laserPt(p[0],p[1],false);
  }
}
document.addEventListener('pointerdown',function(e){
  poke();
  if(ovOpen||inUI(e.target))return;
  var ty=e.pointerType;
  if(ty==='touch'){
    if(performance.now()-penSeen<1200||e.width>90&&e.height>90)return; // palm rejection
    if(tG){tG.cancel=true;return;}
    cancelAnimationFrame(inr);
    tG={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp,inter:isInter(e.target),cancel:false,pan:wbOn,ly:e.clientY,vs:[]};return;
  }
  if(ty==='pen')penSeen=performance.now();
  if(G)return;
  var er=isEraserBtn(e),drawing=(ty==='pen')||(ty==='mouse'&&inkMode()&&(e.button===0||e.button===2));
  if(ty==='mouse'&&e.button===2&&!inkMode())return;
  if(drawing){
    var t=e.target;
    if(ty==='pen'&&!inkMode()&&!er&&isInter(t)){ // pen on a control while tools are closed: tap = click, drag = draw
      if(t.closest('input[type=range]'))return;
      G={id:e.pointerId,type:'pen',mode:'pending',x0:e.clientX,y0:e.clientY,first:e};return;
    }
    e.preventDefault();capture(e);startGesture(e,er);if(er)G.byBtn=true;
    if(ty==='pen')moveRing(e,er||tool==='eraser');
    return;
  }
  if(ty==='mouse'&&e.button===0){tG={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp,inter:isInter(e.target),cancel:false,mouse:true};}
},true);
function onMove(e){
  var ty=e.pointerType;
  if(ty==='pen')penSeen=performance.now();
  if(ty==='mouse')poke();
  if(ovOpen)return;
  if(tG&&tG.pan&&tG.id===e.pointerId){
    var pdy=e.clientY-tG.ly;tG.ly=e.clientY;tG.vs.push([e.timeStamp,pdy]);if(tG.vs.length>6)tG.vs.shift();
    setWy(wy-pdy/scaleF);return;
  }
  if(inUI(e.target)&&!G){hideRing();headOn=false;poke();return;}
  if(G&&G.id===e.pointerId){
    if(G.mode==='pending'){
      if(Math.hypot(e.clientX-G.x0,e.clientY-G.y0)>9){
        var f=G.first;G=null;capture(e);startGesture(f,false);moveGesture(e);swallowUntil=performance.now()+1e4;
      }
      return;
    }
    e.preventDefault();if(!G.raw)moveGesture(e);
    if(ty==='pen'||inkMode())moveRing(e,G.mode==='erase');
    return;
  }
  if(ty==='pen'||(ty==='mouse'&&inkMode())){
    moveRing(e,isEraserBtn(e)||tool==='eraser');
    if(headOn){headOn=false;laserKick();}
  }
  if(tG&&tG.id===e.pointerId&&Math.hypot(e.clientX-tG.x,e.clientY-tG.y)>14&&tG.mouse)tG.cancel=true;
}
document.addEventListener('pointermove',onMove,true);
if('onpointerrawupdate' in window)document.addEventListener('pointerrawupdate',function(e){
  if(G&&G.id===e.pointerId&&G.mode!=='pending'&&!ovOpen){G.raw=true;moveGesture(e);}
},true);
function pend(e){
  var ty=e.pointerType;
  if(G&&G.id===e.pointerId){
    var pend=G.mode==='pending';endGesture();if(pend)return;
    if(ty==='pen'&&tool==='laser'){}
    return;
  }
  if(tG&&tG.id===e.pointerId){
    var g=tG;tG=null;
    if(g.pan){
      var vs=g.vs,sd=0,t1=vs.length?vs[vs.length-1][0]:0,t0=t1;
      for(var q=vs.length-1;q>=0&&t1-vs[q][0]<90;q--){sd+=vs[q][1];t0=vs[q][0];}
      var dtv=Math.max(16,t1-t0+16);
      if(e.type!=='pointercancel'&&Math.abs(sd)>4)inertia(-(sd/scaleF)/dtv);
      return;
    }
    if(g.cancel||e.type==='pointercancel')return;
    var dx=e.clientX-g.x,dy=e.clientY-g.y,dt=e.timeStamp-g.t;
    if(!g.mouse&&Math.abs(dx)>46&&Math.abs(dx)>Math.abs(dy)*1.3&&dt<1000){swallowUntil=performance.now()+400;dx<0?next():prev();return;}
    if(!g.mouse&&dy<-90&&Math.abs(dy)>Math.abs(dx)*1.5&&dt<1000){swallowUntil=performance.now()+400;openOv();return;}
    if(Math.abs(dx)<14&&Math.abs(dy)<14&&dt<800&&!g.inter&&!inUI(e.target)){
      var rx=(e.clientX-ox)/scaleF;if(rx<1920*.12)prev();else next();
    }
  }
}
document.addEventListener('pointerup',pend,true);
document.addEventListener('pointercancel',pend,true);
document.addEventListener('lostpointercapture',function(e){if(G&&G.id===e.pointerId&&G.mode!=='pending')endGesture();},true);
document.addEventListener('pointerout',function(e){if(!e.relatedTarget&&e.pointerType!=='touch'){hideRing();if(!G){headOn=false;laserKick();}}},true);
document.addEventListener('click',function(e){if(performance.now()<swallowUntil&&!inUI(e.target)){e.stopPropagation();e.preventDefault();}},true);
document.addEventListener('contextmenu',function(e){e.preventDefault();},true);

/* ---------- dock actions ---------- */
var inkTT=0;
function btnFx(b,d){var s=b.querySelector('svg');if(!s||REDUCED||!s.animate)return;
  s.animate(d?[{transform:'rotate(0)'},{transform:'rotate('+(-d*34)+'deg) scale(.88)',offset:.35},{transform:'rotate(0)'}]:[{transform:'rotate(0) scale(1)'},{transform:'rotate(-14deg) scale(1.12)',offset:.25},{transform:'rotate(12deg) scale(1.12)',offset:.55},{transform:'rotate(0) scale(1)'}],{duration:d?360:420,easing:'cubic-bezier(.3,.8,.3,1)'});}
var lgSup=0,lgG=null,grip=null,tapT={v:'',t:0};
function openToolCfg(v,b){
  if(!annot||tool!==v){closePops();setTool(v,true);setAnnot(true);}
  cfgPop(true,v,dock.querySelector('[data-a=tool][data-v='+v+']')||b);
}
dock.addEventListener('click',function(e){
  var b=e.target.closest('button[data-a]');if(!b||b.disabled)return;
  var a=b.getAttribute('data-a'),v=b.getAttribute('data-v');
  if(a==='logo'){if(performance.now()<lgSup)return;toggleDock(!dockOpen);b.blur();return;}
  if(b.classList.contains('dis'))return;
  if(a!=='tool'&&a!=='wbbg')closePops();
  if(a==='grid')openOv();else if(a==='full')toggleFS();
  else if(a==='ptr')setAnnot(false);
  else if(a==='wb')setWB(!wbOn);
  else if(a==='tool'){
    var now=performance.now(),dbl=tapT.v===v&&now-tapT.t<420;tapT={v:v,t:now};
    if(annot&&tool===v){
      if(dbl&&UIS.dbl)openToolCfg(v,b);                                   /* double-tap: always opens */
      else if(UIS.tapAgain)cfgPop(!(cfgOpen&&cfgTool===v),v,b);          /* tap the selected tool again */
    }else{closePops();setTool(v,true);setAnnot(true);}
  }
  else if(a==='undo'){btnFx(b,-1);undo();}
  else if(a==='redo'){btnFx(b,1);redo();}
  else if(a==='clear'){btnFx(b,0);clearInk();}
  else if(a==='hide'){var B=document.body;B.classList.add('inkt');clearTimeout(inkTT);inkTT=setTimeout(function(){B.classList.remove('inkt');},520);inkHidden=!inkHidden;B.classList.toggle('inkhide',inkHidden);renderDock();}
  else if(a==='wbbg'){closeCfg();bgPop(!bgOpen);}
  b.blur();poke();
});
dock.addEventListener('pointerenter',function(){armSink();});
dock.addEventListener('pointermove',function(){if(dock.classList.contains('sink'))armSink();});
/* right-click: the logo opens the toolbar settings, a tool opens its own settings, everything else is left alone */
dock.addEventListener('contextmenu',function(e){
  e.preventDefault();e.stopPropagation();
  var b=e.target.closest('button[data-a]');if(!b)return;
  var a=b.getAttribute('data-a');
  if(a==='logo'){if(setOpen&&performance.now()-setAt<1000)return;setPop(!setOpen);}   /* a long-press already opened it */
  else if(a==='tool'&&UIS.rclick&&!b.classList.contains('dis')){closeOther();openToolCfg(b.getAttribute('data-v'),b);poke();}
});
function closeOther(){if(setOpen)setPop(false);if(bgOpen)bgPop(false);}

/* ---------- overview (real slides, fully revealed, with the annotations) ---------- */
var ovOpen=false,ovBusy=false,cells=[],ovSel=0,ovBuilt=0,ovVis={},strokeSeq=0;
var tkP=document.createElement('canvas'),tkX=tkP.getContext('2d');tkP.width=1280;tkP.height=720;
function snapHTML(i){
  var s=slides[i],m=meta[i],keep=m.step,was=s.classList.contains('show');
  if(!was){s.style.visibility='hidden';s.classList.add('show');}
  if(!m.init){m.init=true;initWidgets(s);}
  applyStep(i,m.max);
  /* typed / dragged values live in properties, not attributes: copy them so the picture matches */
  var f=s.querySelectorAll('input,select,textarea'),q,o;
  for(q=0;q<f.length;q++){var el=f[q];
    if(el.tagName==='SELECT'){for(o=0;o<el.options.length;o++){if(el.options[o].selected)el.options[o].setAttribute('selected','');else el.options[o].removeAttribute('selected');}}
    else if(el.tagName==='TEXTAREA')el.textContent=el.value;
    else if(el.type==='checkbox'||el.type==='radio'){if(el.checked)el.setAttribute('checked','');else el.removeAttribute('checked');}
    else el.setAttribute('value',el.value);
  }
  var h=s.outerHTML.replace(/^(<section[^>]*?) style="[^"]*"/,'$1');
  applyStep(i,keep);
  if(!was){s.classList.remove('show');s.style.visibility='';}
  return h.replace(/\sid="([^"]+)"/g,' id="$1_t'+i+'"').replace(/url\(#([^)"']+)\)/g,'url(#$1_t'+i+')').replace(/href="#([^"]+)"/g,'href="#$1_t'+i+'"');
}
function buildOvShell(){
  ov.innerHTML='<div class="bk"></div><div class="bar"><h3>All slides<span>Tap a slide to open it</span></h3><button data-ov="x" aria-label="Close">'+ic('close')+'</button></div><div class="grid"></div>';
  var g=ov.querySelector('.grid');
  slides.forEach(function(s,i){
    var cell=document.createElement('div');cell.className='cell';cell.tabIndex=0;cell.setAttribute('data-i',i);
    cell.innerHTML='<div class="th"><div class="tin"></div></div><div class="lb"><i>'+(i+1)+'</i>'+(s.getAttribute('data-title')||'')+'</div>';
    g.appendChild(cell);cells[i]={el:cell,th:cell.firstChild,tin:cell.firstChild.firstChild,done:false,html:'',isig:''};
  });
}
function inkSig(a){var s='',i,st;for(i=0;i<a.length;i++){st=a[i];s+=(st._id||(st._id=++strokeSeq))+'.'+st.pts.length+(st.op?'o'+st.op:'')+',';}return s;}
/* the annotations of slide i, drawn small on top of its thumbnail */
function paintThumbInk(i){
  var c=cells[i],a=ink[i]||[],sig=inkSig(a);
  if(c.isig===sig&&c.tin.querySelector('.tinkw')||(!a.length&&c.isig===sig))return;
  c.isig=sig;var old=c.tin.querySelector('.tinkw');if(old)old.parentNode.removeChild(old);
  if(!a.length)return;
  var w=document.createElement('div'),k=1280/1920,hx=null,px=null,j;
  w.className='tinkw'+(slides[i].classList.contains('hero')?' nb':'');
  function mk(cls){var cn=document.createElement('canvas');cn.width=1280;cn.height=720;cn.className=cls;w.appendChild(cn);var x=cn.getContext('2d');x.setTransform(k,0,0,k,0,0);return x;}
  for(j=0;j<a.length;j++){
    if(a[j].k==='h'){if(!hx)hx=mk('hl');}
  }
  px=mk('pen');
  for(j=0;j<a.length;j++){if(a[j].k==='h')drawHL(a[j],hx,tkP,tkX);else strokeTo(px,a[j]);}
  c.tin.appendChild(w);
}
function buildThumb(i){
  var c=cells[i];if(c.done)return;
  c.html=snapHTML(i);c.tin.innerHTML=c.html;c.isig='';c.done=true;ovBuilt++;paintThumbInk(i);
}
/* when the grid opens: a slide you have been on may have changed (a slider moved, a quiz answered) — re-snapshot it */
function refreshThumb(i){
  var c=cells[i];
  if(!c.done){buildThumb(i);return;}
  if(ovVis[i]||i===cur){var h=snapHTML(i);if(h!==c.html){c.html=h;c.tin.innerHTML=h;c.isig='';}}
  paintThumbInk(i);
}
function idleBuild(){
  if(ovBuilt>=N||ovOpen)return;
  if(busy||G){setTimeout(idleBuild,600);return;}
  for(var i=0;i<N;i++)if(!cells[i].done){buildThumb(i);break;}
  (window.requestIdleCallback||function(f){setTimeout(f,120);})(idleBuild,{timeout:900});
}
function layoutOv(){
  var vw=innerWidth,cols=vw<720?2:(vw<1000||N<=9?3:4),pad=Math.max(20,Math.round(vw*.028)),gap=Math.round(Math.max(14,vw*.016));
  ov.style.setProperty('--cols',cols);ov.style.setProperty('--pad',pad+'px');ov.style.setProperty('--gap',gap+'px');
  ov._cols=cols;
  var w=(vw-pad*2-gap*(cols-1))/cols,k=w/1920;
  cells.forEach(function(c){c.tin.style.transform='scale('+k+')';});
}
function selCell(j,focus){
  ovSel=Math.max(0,Math.min(N-1,j));
  cells.forEach(function(c,k){c.el.classList.toggle('cur',k===ovSel);});
  if(focus){cells[ovSel].el.focus({preventScroll:true});cells[ovSel].el.scrollIntoView({block:'nearest'});}
}
function openOv(){
  if(ovOpen||ovBusy||wbOn)return;
  var B=document.body;
  fxCancel();cancelAll();cleanup();B.classList.add('notr');applyStep(cur,meta[cur].max);
  setTimeout(function(){B.classList.remove('notr');},160);
  if(!cells.length)buildOvShell();
  for(var i=0;i<N;i++)refreshThumb(i);
  ovOpen=true;layoutOv();selCell(cur);
  B.classList.add('ovanim');hideRing();
  ov.classList.add('show');
  var cell=cells[cur].el,th=cells[cur].th,r=cell.getBoundingClientRect();
  ov.scrollTop+=r.top-(innerHeight-r.height)/2;
  var tr=th.getBoundingClientRect(),sr=stage.getBoundingClientRect();
  th.style.zIndex=5;
  var bk=ov.querySelector('.bk'),bar=ov.querySelector('.bar');
  if(!REDUCED){
    bk.animate([{opacity:0},{opacity:1}],{duration:420,easing:'ease'});
    bar.animate([{opacity:0},{opacity:1}],{duration:420,delay:200,fill:'backwards'});
    th.animate([{transform:'translate('+(sr.left-tr.left)+'px,'+(sr.top-tr.top)+'px) scale('+(sr.width/tr.width)+')',borderRadius:'0px'},{transform:'none',borderRadius:'10px'}],{duration:620,easing:EASE});
    cells.forEach(function(c,k){
      if(k===cur)return;var q=c.el.getBoundingClientRect();if(q.bottom<0||q.top>innerHeight)return;
      c.el.animate([{opacity:0,transform:'translate3d(0,30px,0) scale(.94)'},{opacity:1,transform:'none'}],{duration:560,delay:200+Math.min(Math.abs(k-cur),10)*34,easing:OUT,fill:'backwards'});
    });
    cell.querySelector('.lb').animate([{opacity:0},{opacity:1}],{duration:400,delay:380,fill:'backwards'});
    setTimeout(function(){th.style.zIndex='';if(ovOpen)B.classList.add('ovopen');},640);
  }else{th.style.zIndex='';B.classList.add('ovopen');}
  setTimeout(function(){if(ovOpen)cells[cur].el.focus({preventScroll:true});},60);
}
/* closing: the stage is switched to the chosen slide WHILE it is still hidden behind the grid, with every
   transition off; only once it has painted does the thumbnail fly out to cover it. Nothing blinks. */
function closeOv(j){
  if(!ovOpen||ovBusy)return;
  ovBusy=true;j=(j==null)?cur:j;
  var dest=j,B=document.body,th=cells[dest].th;
  B.classList.add('notr');
  if(dest!==cur)go(dest,dest>cur?1:-1,true,true);else applyStep(cur,meta[cur].max);
  function fin(){
    ov.getAnimations({subtree:true}).forEach(function(a){try{a.cancel();}catch(x){}});
    ov.classList.remove('show');ovOpen=false;ovBusy=false;th.style.zIndex='';th.style.boxShadow='';
    B.classList.remove('ovanim','ovopen','notr','inkon');
    inkRedraw();poke();
  }
  if(REDUCED){B.classList.remove('ovopen');fin();return;}
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    var tr=th.getBoundingClientRect(),sr=stage.getBoundingClientRect();
    B.classList.remove('ovopen');inkRedraw();
    th.style.zIndex=6;th.style.boxShadow='none';
    var bk=ov.querySelector('.bk'),bar=ov.querySelector('.bar');
    cells.forEach(function(c,k){if(k!==dest){c.el.animate([{opacity:1},{opacity:0}],{duration:260,fill:'forwards'});}});
    cells[dest].el.querySelector('.lb').animate([{opacity:1},{opacity:0}],{duration:200,fill:'forwards'});
    bar.animate([{opacity:1},{opacity:0}],{duration:220,fill:'forwards'});
    th.animate([{transform:'none',borderRadius:'10px'},{transform:'translate('+(sr.left-tr.left)+'px,'+(sr.top-tr.top)+'px) scale('+(sr.width/tr.width)+')',borderRadius:'0px'}],{duration:560,easing:EASE,fill:'forwards'});
    bk.animate([{opacity:1},{opacity:0}],{duration:240,delay:400,fill:'forwards'});
    th.animate([{opacity:1},{opacity:0}],{duration:220,delay:520,fill:'forwards'});
    setTimeout(function(){B.classList.add('inkon');},500);
    setTimeout(fin,760);
  });});
}
ov.addEventListener('click',function(e){
  if(e.target.closest('[data-ov=x]')){closeOv();return;}
  var c=e.target.closest('.cell');if(c)closeOv(+c.getAttribute('data-i'));
});
function ovKey(e){
  var k=e.key,cols=ov._cols||4;
  if(k==='Escape'||k==='g'||k==='G'){closeOv();}
  else if(k==='Enter'||k===' '){closeOv(ovSel);}
  else if(k==='ArrowRight')selCell(ovSel+1,true);else if(k==='ArrowLeft')selCell(ovSel-1,true);
  else if(k==='ArrowDown')selCell(ovSel+cols,true);else if(k==='ArrowUp')selCell(ovSel-cols,true);
  else if(k==='Home')selCell(0,true);else if(k==='End')selCell(N-1,true);
  else return;
  e.preventDefault();
}

/* ---------- keyboard ---------- */
addEventListener('keydown',function(e){
  var tg=e.target;if(tg&&((tg.tagName==='INPUT'&&tg.type!=='range'&&tg.type!=='checkbox')||tg.tagName==='TEXTAREA'||tg.isContentEditable))return;
  if(e.ctrlKey&&(e.key==='z'||e.key==='Z')){e.preventDefault();if(!ovOpen){if(e.shiftKey)redo();else undo();}return;}
  if(e.ctrlKey&&(e.key==='y'||e.key==='Y')){e.preventDefault();if(!ovOpen)redo();return;}
  if(e.ctrlKey||e.altKey||e.metaKey)return;
  if(ovOpen){ovKey(e);return;}
  var k=e.key,h=true;
  if(wbOn){
    if(k==='Escape'&&anyPop())closePops();
    else if(k==='Escape'||k==='w'||k==='W')setWB(false);
    else if(k==='ArrowDown'||k==='PageDown'||k===' '||k==='Enter')wbScrollTo(wy+innerHeight/scaleF*.85);
    else if(k==='ArrowUp'||k==='PageUp'||k==='Backspace')wbScrollTo(wy-innerHeight/scaleF*.85);
    else if(k==='Home')wbScrollTo(0,500);
    else if(k==='f'||k==='F')toggleFS();
    else if(k==='a'||k==='A')setAnnot(!annot);
    else if(k==='p'||k==='P'){setTool('pen');setAnnot(true);}
    else if(k==='h'||k==='H'){setTool('hl');setAnnot(true);}
    else if(k==='l'||k==='L'){setTool('laser');setAnnot(true);}
    else if(k==='e'||k==='E'){setTool('eraser');setAnnot(true);}
    else if(k==='c'||k==='C')clearInk();
    else if(k==='b'||k==='B'){if(!annot)setAnnot(true);bgPop(!bgOpen);}
    else h=false;
    if(h)e.preventDefault();return;
  }
  if(k==='ArrowRight'||k==='ArrowDown'||k==='PageDown'||k===' '||k==='Enter')next();
  else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'||k==='Backspace')prev();
  else if(k==='Home')go(0,-1,false);else if(k==='End')go(N-1,1,false);
  else if(k==='f'||k==='F')toggleFS();
  else if(k==='g'||k==='G')openOv();
  else if(k==='w'||k==='W')setWB(true);
  else if(k==='a'||k==='A')setAnnot(!annot);
  else if(k==='p'||k==='P'){setTool('pen');setAnnot(true);}
  else if(k==='h'||k==='H'){setTool('hl');setAnnot(true);}
  else if(k==='l'||k==='L'){setTool('laser');setAnnot(true);}
  else if(k==='e'||k==='E'){setTool('eraser');setAnnot(true);}
  else if(k==='c'||k==='C')clearInk();
  else if(k==='Escape'){if(anyPop())closePops();else if(annot)setAnnot(false);else h=false;}
  else h=false;
  if(h)e.preventDefault();
});



/* ---------- whiteboard (endless, scrolls vertically) ---------- */
var wbEl=document.getElementById('wb'),wbg=document.getElementById('wbg'),wbbar=document.getElementById('wbbar'),wbBusy=false,inr=0,sraf=0,scrAnim=0;
var wbPat='dots',wbCol='white';
try{wbPat=localStorage.getItem('lop-wbp')||'dots';wbCol=localStorage.getItem('lop-wbc')||'white';}catch(x){}
var PATS=[['blank','Blank'],['dots','Dots'],['grid','Squares'],['lines','Ruled lines'],['graph','Graph paper']];
var COLS=[['white','#fcfeff','White'],['cream','#fbf5e4','Cream'],['dark','#16272f','Blackboard'],['green','#1d3b30','Chalkboard']];
function tileH(){return 48*scaleF*(wbPat==='lines'?1.2:1);}
function applyWbStyle(){wbEl.setAttribute('data-p',wbPat);wbEl.setAttribute('data-c',wbCol);document.body.classList.toggle('wbdark',wbOn&&(wbCol==='dark'||wbCol==='green'));}
function layoutWb(){
  var g=48*scaleF,t=tileH();
  wbg.style.width=(innerWidth+2*g)+'px';wbg.style.height=(innerHeight+2*t)+'px';wbg.style.setProperty('--g',g+'px');wbg.style.setProperty('--t',t+'px');
  applyWbStyle();gridTx();wbBar();
}
function gridTx(){
  var g=48*scaleF,t=tileH(),mx=((ox%g)+g)%g,my=(((oy-scaleF*wy)%t)+t)%t;
  wbg.style.transform='translate3d('+(mx-g)+'px,'+(my-t)+'px,0)';
}
/* board background picker */
var bgOpen=false,bgEl=document.createElement('div');bgEl.id='bgpop';bgEl.className='dk';document.body.appendChild(bgEl);
function bgHTML(){
  var h='';PATS.forEach(function(p){h+='<button data-a="bgp" data-v="'+p[0]+'" class="'+(wbPat===p[0]?'act':'')+'" title="'+p[1]+'" aria-label="'+p[1]+'">'+ic('p_'+p[0])+'</button>';});
  h+='<span class="sep"></span>';
  COLS.forEach(function(c){h+='<button data-a="bgc" data-v="'+c[0]+'" class="sw'+(wbCol===c[0]?' sel':'')+'" title="'+c[2]+'" aria-label="'+c[2]+'"><i style="background:'+c[1]+'"></i></button>';});
  return h;
}
function placePop(el,btn){
  var r=btn.getBoundingClientRect(),dr=dock.getBoundingClientRect(),x,y,orx,ory;
  /* the popover may only use the room that is NOT the toolbar: it scrolls inside instead of sliding over it */
  el.style.maxHeight=Math.max(220,vert?innerHeight-16:(dr.top<innerHeight/2?innerHeight-dr.bottom-24:dr.top-24))+'px';
  var w=el.offsetWidth,h=el.offsetHeight;
  if(vert){
    var right=dr.left+dr.width/2>innerWidth/2;
    x=right?dr.left-w-12:dr.right+12;y=r.top+r.height/2-h/2;
    x=Math.max(8,Math.min(innerWidth-w-8,x));y=Math.max(8,Math.min(innerHeight-h-8,y));
    orx=right?'100%':'0';ory=(r.top+r.height/2-y)+'px';
  }else{
    var below=dr.top<innerHeight/2;
    x=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2));y=below?dr.bottom+12:dr.top-h-12;
    y=Math.max(8,Math.min(innerHeight-h-8,y));
    orx=(r.left+r.width/2-x)+'px';ory=below?'0':'100%';
  }
  el.style.left=x+'px';el.style.top=y+'px';el.style.transformOrigin=orx+' '+ory;
}
function bgPlace(){var b=document.getElementById('bbg');if(!b||!b.offsetWidth)b=document.getElementById('bwb');if(!b||!b.offsetWidth)b=document.getElementById('logo');placePop(bgEl,b);}
function bgPop(on){
  if(on===bgOpen)return;
  if(on&&!wbOn)return;
  if(on){if(cfgOpen)cfgPop(false);if(setOpen)setPop(false);}
  bgOpen=on;
  var b=document.getElementById('bbg');if(b)b.classList.toggle('act',on);
  if(bgEl._an){bgEl._an.cancel();bgEl._an=null;}
  if(on){
    bgEl.innerHTML=bgHTML();bgEl.classList.add('show');bgPlace();
    if(bgEl.animate&&!REDUCED)bgEl._an=bgEl.animate([{opacity:0,transform:'scale(.7)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.9,.3,1.2)'});
  }else{
    if(bgEl.animate&&!REDUCED){var an=bgEl._an=bgEl.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.7)'}],{duration:200,easing:'ease',fill:'forwards'});an.onfinish=function(){if(!bgOpen){bgEl.classList.remove('show');}if(bgEl._an===an){an.cancel();bgEl._an=null;}};}
    else bgEl.classList.remove('show');
  }
}
bgEl.addEventListener('click',function(e){
  var b=e.target.closest('button[data-a]');if(!b)return;var a=b.getAttribute('data-a'),v=b.getAttribute('data-v');
  if(a==='bgp'){wbPat=v;try{localStorage.setItem('lop-wbp',v);}catch(x){}}
  else if(a==='bgc'){wbCol=v;try{localStorage.setItem('lop-wbc',v);}catch(x){}}
  applyWbStyle();layoutWb();
  var ps=bgEl.querySelectorAll('[data-a=bgp]'),cs=bgEl.querySelectorAll('[data-a=bgc]'),k;
  for(k=0;k<ps.length;k++)ps[k].classList.toggle('act',ps[k].getAttribute('data-v')===wbPat);
  for(k=0;k<cs.length;k++)cs[k].classList.toggle('sel',cs[k].getAttribute('data-v')===wbCol);
  poke();
});
/* ---------- popovers: tool settings · toolbar settings · board background ---------- */
var cfgOpen=false,cfgTool=null,cfgBtn=null,cfgEl=document.createElement('div');cfgEl.id='cfgpop';cfgEl.className='dk pop';document.body.appendChild(cfgEl);
var setOpen=false,setEl=document.createElement('div');setEl.id='setpop';setEl.className='dk pop';document.body.appendChild(setEl);
function anyPop(){return cfgOpen||bgOpen||setOpen||cpOpen;}
function closePops(){if(cpOpen)cpPop(false);if(cfgOpen)cfgPop(false);if(bgOpen)bgPop(false);if(setOpen)setPop(false);}
function closeCfg(){if(cpOpen)cpPop(false);if(cfgOpen)cfgPop(false);}
document.addEventListener('pointerdown',function(e){if(anyPop()&&!e.target.closest('#bgpop,#cfgpop,#cpop,#setpop,#dock')){closePops();swallowUntil=performance.now()+350;}},true);
function popAnim(el,on){
  el._want=on;
  if(el._an){try{el._an.cancel();}catch(x){}el._an=null;}
  if(on){el.classList.add('show');if(el.animate&&!REDUCED)el._an=el.animate([{opacity:0,transform:'scale(.7)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.9,.3,1.2)'});}
  else if(el.animate&&!REDUCED){var an=el._an=el.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.7)'}],{duration:200,easing:'ease',fill:'forwards'});an.onfinish=function(){if(el._an===an){try{an.cancel();}catch(x){}el._an=null;}if(!el._want)el.classList.remove('show');};}
  else el.classList.remove('show');
}
function follow(el,btn,ms){var t0=performance.now();(function f(){if(!el._want)return;placePop(el,btn);if(performance.now()-t0<ms)requestAnimationFrame(f);})();}
function repopPlace(){
  if(cfgOpen&&cfgBtn)placePop(cfgEl,cfgBtn);
  if(cpOpen)cpPlace();
  if(setOpen)placePop(setEl,document.getElementById('logo'));
  if(bgOpen)bgPlace();
}
function lmap(v,a,b,x,y){return x+(v-a)/(b-a)*(y-x);}
function hex2hsv(hx){var n=parseInt(hx.slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,mx?d/mx:0,mx];}
function hsv2hex(h,s,v){var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;
  if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
  function q(z){var s2=Math.round((z+m)*255).toString(16);return s2.length<2?'0'+s2:s2;}
  return '#'+q(r)+q(g)+q(b);}

/* ----- our own slider (touch-sized, pointer-captured, keyboard friendly) ----- */
function slHTML(p,min,max,step,v,lab,cls){
  return '<div class="sl'+(cls?' '+cls:'')+'" data-p="'+p+'" data-min="'+min+'" data-max="'+max+'" data-step="'+step+'" role="slider" tabindex="0" aria-label="'+lab+'" aria-valuemin="'+min+'" aria-valuemax="'+max+'" aria-valuenow="'+v+'" style="--f:'+((v-min)/(max-min))+'"><div class="trk"><i></i></div><b></b></div>';
}
function slPaint(el,v){var min=+el.getAttribute('data-min'),max=+el.getAttribute('data-max');el.style.setProperty('--f',(v-min)/(max-min));el.setAttribute('aria-valuenow',v);}
function slFrom(el,e){
  var min=+el.getAttribute('data-min'),max=+el.getAttribute('data-max'),st=+el.getAttribute('data-step')||1,r=el.getBoundingClientRect(),pad=parseFloat(getComputedStyle(el).getPropertyValue('--pad'))||16;
  var f=Math.max(0,Math.min(1,(e.clientX-r.left-pad)/Math.max(1,r.width-2*pad))),v=min+f*(max-min);
  v=Math.round((v-min)/st)*st+min;return Math.max(min,Math.min(max,+v.toFixed(4)));
}
function slBind(root,onVal){
  root.addEventListener('pointerdown',function(e){
    var s=e.target.closest('.sl');if(!s)return;e.preventDefault();
    try{s.setPointerCapture(e.pointerId);}catch(x){}
    s._dr=e.pointerId;s.classList.add('drag');onVal(s,slFrom(s,e));poke();
  });
  root.addEventListener('pointermove',function(e){var s=e.target.closest('.sl');if(!s||s._dr!==e.pointerId)return;onVal(s,slFrom(s,e));});
  function up(e){var s=e.target.closest('.sl');if(!s||s._dr!==e.pointerId)return;s._dr=null;s.classList.remove('drag');}
  root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
  root.addEventListener('keydown',function(e){
    var s=e.target.closest&&e.target.closest('.sl');if(!s)return;
    var min=+s.getAttribute('data-min'),max=+s.getAttribute('data-max'),st=+s.getAttribute('data-step')||1,v=+s.getAttribute('aria-valuenow'),k=e.key,n=null,big=(max-min)/10;
    if(k==='ArrowRight'||k==='ArrowUp')n=v+st;else if(k==='ArrowLeft'||k==='ArrowDown')n=v-st;else if(k==='PageUp')n=v+big;else if(k==='PageDown')n=v-big;else if(k==='Home')n=min;else if(k==='End')n=max;
    if(n===null)return;e.preventDefault();e.stopPropagation();onVal(s,Math.max(min,Math.min(max,Math.round((n-min)/st)*st+min)));
  });
}

/* ----- tool settings popover (+ its own side popup for the colour picker) ----- */
function tname(t){return TOOLS.filter(function(x){return x[0]===t;})[0][1].replace(/ \(.\)/,'');}
function cfgPreview(t){
  var c=CFG[t],r=RNG[t],W=240,H=84,i,n,s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
  function pt(u){return [24+u*190,44+17*Math.sin(u*5.4+.5)];}
  if(t==='pen'){
    var wp=lmap(c.w,r[0],r[1],1.6,32);n=44;
    for(i=0;i<n;i++){var a=pt(i/n),b=pt((i+1)/n),k=c.press?(.3+.95*Math.sin(Math.PI*(i+.5)/n)):1;
      s+='<line x1="'+a[0].toFixed(1)+'" y1="'+a[1].toFixed(1)+'" x2="'+b[0].toFixed(1)+'" y2="'+b[1].toFixed(1)+'" stroke="'+c.c+'" stroke-width="'+Math.max(1,wp*k).toFixed(2)+'" stroke-linecap="round"/>';}
  }else if(t==='hl'){
    var d='';n=40;for(i=0;i<=n;i++){var q=pt(i/n);d+=(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1);}
    s+='<path d="'+d+'" fill="none" stroke="'+c.c+'" stroke-opacity="'+c.op+'" stroke-width="'+lmap(c.w,r[0],r[1],7,50).toFixed(1)+'" stroke-linecap="round" stroke-linejoin="round"/>';
  }else if(t==='laser'){
    var L=lmap(c.life,300,4000,.1,1),gr=lmap(c.w,r[0],r[1],6,26),tw=lmap(c.w,r[0],r[1],2.5,14);n=40;
    for(i=0;i<n;i++){var u0=1-L+L*i/n,u1=1-L+L*(i+1)/n,p0=pt(u0),p1=pt(u1),f=(i+1)/n;
      s+='<line x1="'+p0[0].toFixed(1)+'" y1="'+p0[1].toFixed(1)+'" x2="'+p1[0].toFixed(1)+'" y2="'+p1[1].toFixed(1)+'" stroke="'+c.c+'" stroke-opacity="'+(f*.8).toFixed(2)+'" stroke-width="'+Math.max(1.2,tw*f).toFixed(2)+'" stroke-linecap="round"/>';}
    var h=pt(1);
    s+='<defs><radialGradient id="pvg"><stop offset="0" stop-color="'+c.c+'"/><stop offset=".3" stop-color="'+c.c+'"/><stop offset="1" stop-color="'+c.c+'" stop-opacity="0"/></radialGradient></defs><circle cx="'+h[0]+'" cy="'+h[1]+'" r="'+gr*1.6+'" fill="url(#pvg)"/><circle cx="'+h[0]+'" cy="'+h[1]+'" r="'+Math.max(1.8,gr*.2)+'" fill="#fff"/>';
  }else{
    var dd=lmap(c.w,r[0],r[1],8,70);
    s+='<g stroke="#10222b" stroke-opacity=".38" stroke-width="3" stroke-linecap="round" fill="none"><path d="M14 22L66 60M40 14l60 56M110 20l70 44M150 12l76 50M20 66l40-30"/></g>';
    s+='<circle cx="120" cy="42" r="'+(dd/2).toFixed(1)+'" fill="#f5fbfd" stroke="#0b2a36" stroke-opacity=".7" stroke-width="2"/>';
  }
  return s+'</svg>';
}
function cfgBuild(t){
  var c=CFG[t],r=RNG[t],h='',i;
  h+='<div class="ch"><span class="ci">'+ic(t)+'</span><b>'+tname(t)+'</b><button class="rs" data-x="reset">Reset</button></div><div class="pv">'+cfgPreview(t)+'</div>';
  if(COL[t]){
    h+='<div class="cr">';
    COL[t].forEach(function(col){h+='<button class="sw" data-c="'+col+'" aria-label="Colour '+col+'"><i style="background:'+col+'"></i></button>';});
    h+='</div><div class="cl">Your colours</div><div class="cr">';
    for(i=0;i<3;i++){var v=c.cust[i];h+=v?'<button class="sw" data-c="'+v+'" aria-label="Saved colour '+v+'"><i style="background:'+v+'"></i></button>':'<span class="sw em"><i></i></span>';}
    h+='<button class="sw pk" data-x="picker" aria-label="Pick any colour" title="Pick any colour">'+ic('pick')+'</button></div>';
  }
  h+='<div class="lr"><span class="lb">Size</span><span class="pz">';
  SZ[t].forEach(function(s,k){var d=t==='eraser'?12+k*6:(t==='laser'?7+k*4:(t==='hl'?8+k*4:4+k*4));h+='<button class="sz" data-w="'+s+'" aria-label="Size '+s+'"><i style="width:'+d+'px;height:'+d+'px;'+(t==='hl'?'border-radius:3px':'')+'"></i></button>';});
  h+='</span><output data-o="w"></output></div>'+slHTML('w',r[0],r[1],r[2],c.w,'Size');
  if(t==='hl')h+='<div class="lr"><span class="lb">Strength</span><output data-o="op"></output></div>'+slHTML('op',15,85,1,Math.round(c.op*100),'Strength');
  if(t==='laser')h+='<div class="lr"><span class="lb">Trail length</span><output data-o="life"></output></div>'+slHTML('life',300,4000,100,c.life,'Trail length');
  if(t==='pen')h+='<label class="tg"><input type="checkbox" data-p="press"'+(c.press?' checked':'')+'><span class="tk"></span><span>Pressure sensitive <small>(stylus)</small></span></label>';
  cfgEl.innerHTML=h;
}
function cfgSync(){
  var t=cfgTool,c=CFG[t],k,e;
  cfgEl.querySelector('.pv').innerHTML=cfgPreview(t);
  var sw=cfgEl.querySelectorAll('.sw[data-c]');
  for(k=0;k<sw.length;k++)sw[k].classList.toggle('sel',!cpOpen&&!!c.c&&sw[k].getAttribute('data-c')===c.c.toLowerCase());
  var pk=cfgEl.querySelector('.pk');if(pk)pk.classList.toggle('act',cpOpen);
  var sz=cfgEl.querySelectorAll('.sz');for(k=0;k<sz.length;k++)sz[k].classList.toggle('sel',+sz[k].getAttribute('data-w')===c.w);
  cfgEl.querySelector('[data-o=w]').textContent=c.w;slPaint(cfgEl.querySelector('.sl[data-p=w]'),c.w);
  if((e=cfgEl.querySelector('[data-o=op]'))){e.textContent=Math.round(c.op*100)+'%';slPaint(cfgEl.querySelector('.sl[data-p=op]'),Math.round(c.op*100));}
  if((e=cfgEl.querySelector('[data-o=life]'))){e.textContent=(c.life/1000).toFixed(1)+' s';slPaint(cfgEl.querySelector('.sl[data-p=life]'),c.life);}
  var tb=dock.querySelector('[data-a=tool][data-v='+t+']');if(tb&&c.c)tb.style.setProperty('--tc',c.c);
  if(t===tool)document.getElementById('logo').style.setProperty('--tc',c.c||'#fff');
  if(cpOpen)cpSync();
  saveSettings();updRing();
}
function cfgPop(on,t,btn){
  if(on){if(bgOpen)bgPop(false);if(setOpen)setPop(false);}
  if(!on&&!cfgOpen)return;
  if(on){
    var was=cfgOpen,chg=!cfgOpen||cfgTool!==t;
    if(was&&chg&&cpOpen)cpPop(false);
    cfgOpen=true;cfgTool=t;cfgBtn=btn;
    cfgBuild(t);cfgSync();cfgEl.classList.add('show');cfgEl._want=true;placePop(cfgEl,btn);
    if(!was)popAnim(cfgEl,true);
  }else{if(cpOpen)cpPop(false);cfgOpen=false;popAnim(cfgEl,false);}
}
slBind(cfgEl,function(s,v){
  var p=s.getAttribute('data-p'),c=CFG[cfgTool];
  if(p==='op')c.op=v/100;else c[p]=v;
  cfgSync();
});
function addCustom(t,hx){
  var c=CFG[t];hx=String(hx).toLowerCase();
  if(COL[t].indexOf(hx)>=0)return;
  var i=c.cust.indexOf(hx);if(i>=0)c.cust.splice(i,1);
  c.cust.unshift(hx);c.cust.length=Math.min(3,c.cust.length);   /* newest first, the oldest drops off */
}
cfgEl.addEventListener('pointerdown',function(){poke();});
cfgEl.addEventListener('mousedown',function(e){if(e.target.closest('label.tg'))e.preventDefault();});
cfgEl.addEventListener('click',function(e){
  var t=cfgTool,c=CFG[t],b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-c')){c.c=b.getAttribute('data-c');if(cpOpen){cpFromHex(c.c);}}
  else if(b.hasAttribute('data-w'))c.w=+b.getAttribute('data-w');
  else if(b.getAttribute('data-x')==='reset'){CFG[t]=defCfg()[t];if(cpOpen)cpPop(false);cfgBuild(t);cfgSync();return;}
  else if(b.getAttribute('data-x')==='picker'){cpPop(!cpOpen);b.blur();return;}
  else return;
  cfgSync();poke();b.blur();
});
cfgEl.addEventListener('input',function(e){
  var el=e.target,c=CFG[cfgTool];
  if(el.type==='checkbox')c.press=el.checked;else return;
  cfgSync();poke();
});

/* ----- colour picker: its own little popup beside the tool settings ----- */
var cpEl=document.createElement('div');cpEl.id='cpop';cpEl.className='dk pop';document.body.appendChild(cpEl);
var cpS={h:0,s:1,v:1},cpOpen=false,cpStart='';
function cpFromHex(hx){var a=hex2hsv(hx);if(a[1]>.03&&a[2]>.03)cpS.h=a[0];cpS.s=a[1];cpS.v=a[2];}
function cpBuild(){
  var c=CFG[cfgTool];
  cpEl.innerHTML='<div class="ch"><span class="ci">'+ic('pick')+'</span><b>Pick a colour</b></div><div class="sv"><i class="svk"></i></div>'+
   slHTML('hue',0,360,1,Math.round(cpS.h),'Hue','hue')+
   '<div class="hx"><span class="hs"></span><input class="hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" value="'+c.c+'" aria-label="Hex colour"></div>'+
   '<button class="bt use" data-x="use">Save to my colours</button>';
}
function cpSync(){
  var c=CFG[cfgTool],sv=cpEl.querySelector('.sv');if(!sv)return;
  sv.style.backgroundColor='hsl('+cpS.h+',100%,50%)';var kn=sv.firstChild;kn.style.left=(cpS.s*100)+'%';kn.style.top=((1-cpS.v)*100)+'%';kn.style.background=c.c;
  slPaint(cpEl.querySelector('.sl.hue'),Math.round(cpS.h));
  var hx=cpEl.querySelector('.hex');if(hx&&document.activeElement!==hx)hx.value=c.c;
  cpEl.querySelector('.hs').style.background=c.c;
}
function cpPlace(){
  var w=cpEl.offsetWidth,h=cpEl.offsetHeight,r=cfgEl.getBoundingClientRect(),b=cfgEl.querySelector('.pk').getBoundingClientRect(),x,orx;
  if(r.right+10+w<=innerWidth-8){x=r.right+10;orx='0';}else{x=Math.max(8,r.left-10-w);orx='100%';}
  var y=Math.max(8,Math.min(innerHeight-h-8,b.top+b.height/2-h/2));
  cpEl.style.left=x+'px';cpEl.style.top=y+'px';cpEl.style.transformOrigin=orx+' '+(b.top+b.height/2-y)+'px';
}
function cpPop(on){
  if(on===cpOpen)return;
  if(on){
    var c=CFG[cfgTool];cpStart=c.c;cpFromHex(c.c);cpOpen=true;cpBuild();cpEl.classList.add('show');cpEl._want=true;cpPlace();popAnim(cpEl,true);
    cfgSync();
  }else{
    var c2=CFG[cfgTool];cpOpen=false;
    if(c2&&c2.c!==cpStart){addCustom(cfgTool,c2.c);if(cfgOpen){cfgBuild(cfgTool);}}   /* a colour you chose is remembered */
    popAnim(cpEl,false);if(cfgOpen)cfgSync();
  }
}
slBind(cpEl,function(s,v){var c=CFG[cfgTool];cpS.h=v;c.c=hsv2hex(cpS.h,cpS.s,cpS.v);cfgSync();});
cpEl.addEventListener('pointerdown',function(e){
  poke();var sv=e.target.closest('.sv');if(!sv)return;
  e.preventDefault();try{sv.setPointerCapture(e.pointerId);}catch(x){}sv._dr=e.pointerId;svSet(sv,e);
});
cpEl.addEventListener('pointermove',function(e){var sv=e.target.closest('.sv');if(sv&&sv._dr===e.pointerId)svSet(sv,e);});
function svUp(e){var sv=e.target.closest('.sv');if(sv&&sv._dr===e.pointerId)sv._dr=null;}
cpEl.addEventListener('pointerup',svUp);cpEl.addEventListener('pointercancel',svUp);
function svSet(sv,e){
  var r=sv.getBoundingClientRect();cpS.s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));cpS.v=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
  CFG[cfgTool].c=hsv2hex(cpS.h,cpS.s,cpS.v);cfgSync();
}
cpEl.addEventListener('click',function(e){var b=e.target.closest('button');if(b&&b.getAttribute('data-x')==='use'){cpPop(false);b.blur();}});
cpEl.addEventListener('input',function(e){
  var el=e.target;if(!el.classList.contains('hex'))return;
  var v=el.value.trim();if(v.charAt(0)!=='#')v='#'+v;
  if(/^#[0-9a-f]{6}$/i.test(v)){CFG[cfgTool].c=v.toLowerCase();cpFromHex(v);cfgSync();poke();}
});
cpEl.addEventListener('change',function(e){if(e.target.classList.contains('hex'))e.target.value=CFG[cfgTool].c;});
cpEl.addEventListener('keydown',function(e){if(e.target.classList.contains('hex')){e.stopPropagation();if(e.key==='Enter'){e.target.blur();cpPop(false);}}});

/* ----- toolbar settings popover (right-click / long-press the logo) ----- */
function seg(k,opts,val){var h='<div class="seg">';opts.forEach(function(o){h+='<button data-s="seg" data-k="'+k+'" data-v="'+o[0]+'" class="'+(String(val)===String(o[0])?'on':'')+'">'+o[1]+'</button>';});return h+'</div>';}
function tgl(k,on,id){return '<label class="tg"><input type="checkbox" data-s="tgl" data-k="'+k+'"'+(id?' data-id="'+id+'"':'')+(on?' checked':'')+'><span class="tk"></span></label>';}
function srowS(l,ctl,sub){return '<div class="sr stk"><span class="sn">'+l+(sub?'<small>'+sub+'</small>':'')+'</span>'+ctl+'</div>';}
function srow(l,ctl,sub){return '<div class="sr"><span class="sn">'+l+(sub?'<small>'+sub+'</small>':'')+'</span>'+ctl+'</div>';}
function pgrid(){var h='<div class="pg">';['tl','tc','tr','bl','bc','br'].forEach(function(p){var dis=UIS.vert&&p.charAt(1)==='c';h+='<button data-s="pos" data-v="'+p+'" class="'+(UIS.pos===p?'on':'')+'"'+(dis?' disabled':'')+' aria-label="Position '+p+'"><i></i></button>';});return h+'</div>';}
function setBuild(){
  var sb0=setEl.querySelector('.sbody'),st=sb0?sb0.scrollTop:0,h='<div class="ch"><span class="ci">'+ic('gear')+'</span><b>Toolbar settings</b><button class="rs" data-s="resetall">Reset all</button></div><div class="sbody">';
  h+='<div class="hd">Behaviour</div>';
  h+=srow('Start with toolbar open',tgl('open',UIS.open));
  h+=srow('Auto-hide when closed',tgl('sink',UIS.sink),'Logo sinks into the screen edge');
  h+=srow('Hide after',seg('sinkDelay',[[2,'2 s'],[4,'4 s'],[8,'8 s']],UIS.sinkDelay));
  h+=srowS('Starting tool',seg('tool',[['pen','Pen'],['hl','Marker'],['laser','Laser'],['eraser','Eraser']],UIS.tool));
  h+='<div class="hd">Layout</div>';
  h+=srowS('Orientation',seg('vert',[[0,'Horizontal'],[1,'Vertical']],UIS.vert?1:0));
  h+=srowS('Position',pgrid());
  h+='<div class="hd">Touch</div>';
  h+=srowS('Tablet mode',seg('tablet',[['auto','Auto'],['on','On'],['off','Off']],UIS.tablet),'Larger buttons and sliders');
  h+='<div class="hd">Tool gestures</div>';
  h+=srow('Tap a selected tool again',tgl('tapAgain',UIS.tapAgain),'Opens that tool’s settings');
  h+=srow('Double-tap a tool',tgl('dbl',UIS.dbl),'Selects it and opens its settings');
  h+=srow('Right-click a tool',tgl('rclick',UIS.rclick),'Long-press does the same on touch');
  h+='<div class="hd">Buttons <small>reorder · show / hide</small></div>';
  UIS.order.forEach(function(id,k){
    var it=ITEMS[id];
    h+='<div class="ro"><span class="ri">'+ic(it.i)+'</span><span class="rn">'+it.l+'</span>'+
       '<button data-s="up" data-id="'+id+'" aria-label="Move up"'+(k?'':' disabled')+'>'+ic('up')+'</button>'+
       '<button data-s="dn" data-id="'+id+'" aria-label="Move down"'+(k<UIS.order.length-1?'':' disabled')+'>'+ic('dn')+'</button>'+
       tgl('vis',UIS.hidden.indexOf(id)<0,id)+'</div>';
  });
  h+='<div class="hd">Settings file</div><div class="sr two"><button class="bt" data-s="export">Export</button><button class="bt" data-s="import">Import</button></div>';
  h+='<p class="nt">Everything here is saved on this device and shared by every deck opened from the same place. Use Export / Import to carry it to another device or app.</p></div>';
  setEl.innerHTML=h;setEl.querySelector('.sbody').scrollTop=st;
}
var setAt=0;
function setPop(on){
  if(on===setOpen)return;if(on)setAt=performance.now();
  if(on){if(cfgOpen)cfgPop(false);if(bgOpen)bgPop(false);}
  setOpen=on;
  if(on){setBuild();setEl.classList.add('show');setEl._want=true;placePop(setEl,document.getElementById('logo'));popAnim(setEl,true);}
  else popAnim(setEl,false);
  armSink();
}
function applyAll(){
  fixAll();tool=UIS.tool;vert=UIS.vert;applyTablet();
  fillMain();setPos(UIS.pos);renderDock(true);saveSettings();
}
function moveItem(id,d){var o=UIS.order,i=o.indexOf(id),j=i+d;if(j<0||j>=o.length)return;o[i]=o[j];o[j]=id;fillMain();renderDock(false);}
function exportSet(){
  var blob=new Blob([JSON.stringify({v:1,ui:UIS,tools:CFG},null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='toolbar-settings.json';document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
}
function importSet(){
  var f=document.createElement('input');f.type='file';f.accept='.json,application/json';
  f.onchange=function(){var r=new FileReader();r.onload=function(){try{var o=JSON.parse(r.result);assign(UIS,o.ui);if(o.tools)for(var t in CFG)assign(CFG[t],o.tools[t]);applyAll();setBuild();toast('Settings imported',1400);}catch(x){toast('Not a settings file',1600);}};if(f.files[0])r.readAsText(f.files[0]);};
  f.click();
}
function setVert(v){
  if(v===vert)return;vert=UIS.vert=v;
  var pc=UIS.pos;if(v&&pc.charAt(1)==='c')pc=pc.charAt(0)+'r';
  setPos(pc);
}
slBind(setEl,function(){});
/* a click on a toggle must not move keyboard focus (focus can scroll things); and the popup frame itself never scrolls */
setEl.addEventListener('mousedown',function(e){if(e.target.closest('label.tg'))e.preventDefault();});
setEl.addEventListener('scroll',function(){setEl.scrollTop=0;setEl.scrollLeft=0;});
setEl.addEventListener('pointerdown',function(){poke();});
setEl.addEventListener('click',function(e){
  var b=e.target.closest('button[data-s]');if(!b||b.disabled)return;
  var s=b.getAttribute('data-s'),k=b.getAttribute('data-k'),v=b.getAttribute('data-v'),id=b.getAttribute('data-id');
  if(s==='seg'){
    if(k==='sinkDelay'){UIS.sinkDelay=+v;armSink();}
    else if(k==='tool'){UIS.tool=v;setTool(v,true);}
    else if(k==='vert')setVert(v==='1');
    else if(k==='tablet'){UIS.tablet=v;applyTablet();}
  }
  else if(s==='pos')setPos(v);
  else if(s==='up'||s==='dn')moveItem(id,s==='up'?-1:1);
  else if(s==='resetall'){UIS=defUI();CFG=defCfg();applyAll();toast('Toolbar settings reset',1400);}
  else if(s==='export')exportSet();
  else if(s==='import')importSet();
  saveSettings();setBuild();placePop(setEl,document.getElementById('logo'));b.blur();poke();
});
setEl.addEventListener('change',function(e){
  var i=e.target;if(!i.getAttribute||i.getAttribute('data-s')!=='tgl')return;
  var k=i.getAttribute('data-k'),id=i.getAttribute('data-id');
  if(k==='vis'){var j=UIS.hidden.indexOf(id);if(i.checked){if(j>=0)UIS.hidden.splice(j,1);}else if(j<0)UIS.hidden.push(id);fillMain(true);renderDock(false);follow(setEl,document.getElementById('logo'),700);}
  else{UIS[k]=i.checked;if(k==='sink')armSink();}
  saveSettings();poke();
});

function wbMaxY(){var a=ink.wb||[],m=0;for(var i=0;i<a.length;i++){var b=bbox(a[i])[3];if(b>m)m=b;}return m;}
function wbBar(){
  var vh=innerHeight/scaleF,ext=Math.max(wy+vh,wbMaxY()+vh*.35,vh*1.6),th=Math.max(.07,vh/ext),tp=wy/ext,i=wbbar.firstChild;
  i.style.height=(th*100)+'%';i.style.transform='translate3d(0,'+(tp/th*100)+'%,0)';
}
function setWy(v){
  wy=Math.max(0,v);
  if(!sraf)sraf=requestAnimationFrame(function(){sraf=0;if(!wbOn)return;applyTx();inkRedraw();gridTx();wbBar();});
}
function wbScrollTo(t,ms){
  cancelAnimationFrame(scrAnim);cancelAnimationFrame(inr);
  var a=wy,b=Math.max(0,t),t0=performance.now();ms=ms||380;
  (function f(n){var k=Math.min(1,(n-t0)/ms),e=1-Math.pow(1-k,3);setWy(a+(b-a)*e);if(k<1)scrAnim=requestAnimationFrame(f);})(t0);
}
function inertia(v){
  cancelAnimationFrame(inr);var last=performance.now();
  (function f(n){var dt=Math.min(40,n-last);last=n;setWy(wy+v*dt);v*=Math.pow(.945,dt/16.7);if(Math.abs(v)>.015&&(wy>0||v>0))inr=requestAnimationFrame(f);})(last);
}
addEventListener('wheel',function(e){
  if(!wbOn||ovOpen)return;e.preventDefault();cancelAnimationFrame(scrAnim);cancelAnimationFrame(inr);
  var d=e.deltaMode===1?e.deltaY*32:(e.deltaMode===2?e.deltaY*innerHeight:e.deltaY);setWy(wy+d/scaleF);
},{passive:false});
function setWB(on){
  on=!!on;if(on===wbOn||wbBusy||ovOpen)return;
  if(G)endGesture();trail=[];wbBusy=true;
  if(on&&!dockOpen)toggleDock(true);
  var b=document.getElementById('bwb');if(!b||!b.offsetWidth)b=document.getElementById('logo');
  var r=b?b.getBoundingClientRect():{left:innerWidth/2,top:innerHeight-30,width:0,height:0},
      x0=r.left+r.width/2,y0=r.top+r.height/2,R=Math.hypot(Math.max(x0,innerWidth-x0),Math.max(y0,innerHeight-y0))+30,an=null;
  var full=function(c){return 'circle('+c+'px at '+x0+'px '+y0+'px)';};
  if(on){
    prevAnnot=annot;hidSave=inkHidden;inkHidden=false;document.body.classList.remove('inkhide');wbOn=true;wbEl.classList.add('on');layoutWb();sizeCanvases();inkRedraw();
    inkwrap.style.opacity='0';setAnnot(true);
    if(wbEl.animate&&!REDUCED)an=wbEl.animate([{clipPath:full(0)},{clipPath:full(R)}],{duration:680,easing:EASE});
    setTimeout(function(){inkwrap.style.opacity='';document.body.classList.add('wbfull');wbBusy=false;wbBar();},an?640:0);
  }else{
    bgPop(false);document.body.classList.remove('wbfull','wbdark');wbOn=false;inkHidden=hidSave;document.body.classList.toggle('inkhide',inkHidden);sizeCanvases();inkRedraw();setAnnot(prevAnnot);
    inkwrap.style.opacity='0';
    if(wbEl.animate&&!REDUCED)an=wbEl.animate([{clipPath:full(R)},{clipPath:full(0)}],{duration:580,easing:EASE,fill:'forwards'});
    setTimeout(function(){wbEl.classList.remove('on');if(an)an.cancel();inkwrap.style.opacity='';wbBusy=false;},an?600:0);
  }
}

/* ---------- movable dock: drag the logo anywhere, it snaps to a corner / the centre ---------- */
function setPos(pos,from){
  closePops();
  POS.forEach(function(p){dock.classList.remove('p-'+p);});
  if(vert&&pos.charAt(1)==='c')pos=pos.charAt(0)+'r';
  sideT=pos.charAt(0)==='t';sideR=pos.charAt(1)==='r';
  dock.style.left=dock.style.top=dock.style.right=dock.style.bottom='';
  dock.classList.add('p-'+pos);UIS.pos=pos;saveSettings();
  renderDock();armSink();
  if(from&&dock.animate&&!REDUCED){var n=dock.getBoundingClientRect();dock.animate([{transform:'translate('+(from.left-n.left)+'px,'+(from.top-n.top)+'px)'},{transform:'none'}],{duration:420,easing:EASE});}
}
dock.addEventListener('pointerdown',function(e){
  poke();armSink();
  var l=e.target.closest('#logo');if(!l||(e.pointerType==='mouse'&&e.button!==0))return;
  var r=dock.getBoundingClientRect();
  lgG={id:e.pointerId,x:e.clientX,y:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,drag:false};
  lgG.t=setTimeout(function(){if(lgG&&!lgG.drag){lgSup=performance.now()+800;setPop(true);}},650);
});
document.addEventListener('pointermove',function(e){
  var g=lgG;if(!g||e.pointerId!==g.id)return;
  if(!g.drag){
    if(Math.hypot(e.clientX-g.x,e.clientY-g.y)<10)return;
    g.drag=true;clearTimeout(g.t);closePops();
    var r0=dock.getBoundingClientRect();
    try{dock.setPointerCapture(e.pointerId);}catch(x){}
    dock.classList.add('drag');dock.classList.remove('dim','sink');
    dock.style.left=r0.left+'px';dock.style.top=r0.top+'px';dock.style.right='auto';dock.style.bottom='auto';
  }
  var r=dock.getBoundingClientRect();
  dock.style.left=Math.max(4,Math.min(innerWidth-r.width-4,e.clientX-g.dx))+'px';
  dock.style.top=Math.max(4,Math.min(innerHeight-r.height-4,e.clientY-g.dy))+'px';
},true);
function endLg(e){
  var g=lgG;if(!g||e.pointerId!==g.id)return;
  clearTimeout(g.t);lgG=null;
  if(!g.drag)return;
  lgSup=performance.now()+450;dock.classList.remove('drag');
  var r=dock.getBoundingClientRect(),cx0=r.left+r.width/2,cy0=r.top+r.height/2,col;
  if(vert)col=cx0<innerWidth/2?'l':'r';else col=cx0<innerWidth/3?'l':(cx0>innerWidth*2/3?'r':'c');
  setPos((cy0<innerHeight/2?'t':'b')+col,r);poke();
}
document.addEventListener('pointerup',endLg,true);document.addEventListener('pointercancel',endLg,true);

/* ---------- init ---------- */
buildDock();applyTablet();setPos(UIS.pos);
UI=true;renderDock();onFit();poke();armSink();
setTimeout(function(){toast('<b>Tap the logo</b> to open the toolbar &nbsp;·&nbsp; <b>Drag</b> it to move &nbsp;·&nbsp; <b>Right-click / long-press</b> for settings',5600);},900);
(window.requestIdleCallback||function(f){setTimeout(f,300);})(function(){if(!cells.length)buildOvShell();idleBuild();},{timeout:2500});
window.__ui={setWB:setWB,ink:ink,setTool:setTool,setAnnot:setAnnot,openOv:openOv,closeOv:closeOv,toggleDock:toggleDock,cfg:function(){return CFG;},uis:function(){return UIS;},
  state:function(){return {tool:tool,annot:annot,wb:wbOn,wy:wy,ov:ovOpen,cur:cur,step:meta[cur].step,max:meta[cur].max,open:dockOpen,vert:vert};}};
