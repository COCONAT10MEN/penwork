/*
  The slide engine, dock, ink, whiteboard and overview grid, ported from the owner's template
  (reference/lop-deck/deck-template.html). All of it is that script, copied rather than rewritten, with
  only its joins changed: storage, files, full screen and start-up now go through the app, and strokes
  are drawn with perfect-freehand. "glue" at the bottom is new. Ink lives here, not in an overlay in the
  app, because the template routes pen, finger and mouse through one page: an overlay can't take a pen
  and let a finger through. Deck code shares this page, so the app treats all of it as untrusted.
*/
var W = {};
(function () {
"use strict";
var SORTER=location.search.indexOf('view=sorter')>=0,mode='boot',loop=true;
var stage=document.getElementById('stage');
var slides=Array.prototype.slice.call(stage.querySelectorAll('.slide'));
var N=slides.length, cur=-1, busy=null, anims=[], hidden=[], scaleF=1;
var REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
var EASE='cubic-bezier(.65,0,.25,1)', OUT='cubic-bezier(.2,.85,.25,1)';
function makeMeta(){return slides.map(function(s){
  var els=Array.prototype.slice.call(s.querySelectorAll('.st')),k=0;
  els.forEach(function(e){var a=e.getAttribute('data-st'); if(a==='='){} else k++; e._k=k;});
  return {els:els,max:k,step:0,init:false};
});}
if(!SORTER)stampAll();
var meta=makeMeta();
function $(s,r){return (r||document).querySelector(s);}
function fit(){
  var s=Math.min(innerWidth/1920,innerHeight/1080);scaleF=s;
  stage.style.transform='translate3d('+((innerWidth-1920*s)/2)+'px,'+((innerHeight-1080*s)/2)+'px,0) scale('+s+')';
  if(typeof onFit==='function')onFit();
}
addEventListener('resize',fit);fit();

/* ---------- steps ---------- */
function applyStep(i,n){
  var m=meta[i];m.step=n;
  var last=null;
  m.els.forEach(function(e){var on=e._k<=n;e.classList.toggle('on',on);if(on&&e.getAttribute('data-hl'))last=e.getAttribute('data-hl');});
  slides[i].classList.toggle('hasHL',!!last);
  var parts=slides[i].querySelectorAll('.part');
  for(var p=0;p<parts.length;p++)parts[p].classList.toggle('hl',parts[p].getAttribute('data-part')===last);
  var h=slides[i].getAttribute('data-onstep'); if(h&&W[h])W[h](slides[i],n);
}

/* ---------- background shapes ---------- */
var blobs=Array.prototype.slice.call(document.querySelectorAll('.blob'));
function applyBg(s){
  var d=(s.getAttribute('data-bg')||'').split(';');
  blobs.forEach(function(b,k){var v=(d[k]||'0,0,1').split(',');b.style.transform='translate3d('+v[0]+'px,'+v[1]+'px,0) scale('+v[2]+')';});
  stage.classList.toggle('dark',s.classList.contains('hero'));
}

/* ---------- morph engine (PowerPoint-style: match -> glide, words move, the rest fades) ---------- */
var MDUR=1000,MEASE='cubic-bezier(.45,.05,.2,1)';
var ghosts=[],flyEls=[],deco=[];
function keyMap(s){
  var map={},dup={};
  function add(k,e){if(map[k]||dup[k]){dup[k]=1;delete map[k];}else map[k]=e;}
  var a=s.querySelectorAll('[data-m]');for(var i=0;i<a.length;i++)add(a[i].getAttribute('data-m'),a[i]);
  var f=s.querySelectorAll('.fbox');for(i=0;i<f.length;i++)add('f:'+f[i].textContent.replace(/\s+/g,''),f[i]);
  return map;
}
function visible(e,root){
  for(var p=e;p&&p!==root&&p.nodeType===1;p=p.parentNode){if(p.classList.contains('st')&&!p.classList.contains('on'))return false;}
  return true;
}
function rectOf(e,sr){var r=e.getBoundingClientRect();return {cx:(r.left+r.width/2-sr.left)/scaleF,cy:(r.top+r.height/2-sr.top)/scaleF,w:r.width/scaleF,h:r.height/scaleF};}
function anim(e,kf,opt){if(!e.animate)return null;var a=e.animate(kf,opt);anims.push(a);return a;}
function cancelAll(){
  anims.forEach(function(a){try{a.cancel();}catch(e){}});anims=[];
  hidden.forEach(function(e){e.style.visibility='';});hidden=[];
  ghosts.forEach(function(g){if(g.parentNode)g.parentNode.removeChild(g);});ghosts=[];
  deco.forEach(function(e){e.classList.remove('deco0');});deco=[];
  flyEls.forEach(function(e){e.classList.remove('fly');e.classList.remove('flyb');});flyEls=[];
}
function cleanup(){
  slides.forEach(function(s,i){if(i!==cur){s.classList.remove('show');s.style.zIndex='';}else{s.style.zIndex='';}});
  hidden.forEach(function(e){e.style.visibility='';});hidden=[];
  ghosts.forEach(function(g){if(g.parentNode)g.parentNode.removeChild(g);});ghosts=[];
  deco.forEach(function(e){e.classList.remove('deco0');});deco=[];
  flyEls.forEach(function(e){e.classList.remove('fly');e.classList.remove('flyb');});flyEls=[];
}

/* words: text is split into inline-block spans once per slide so each word can travel on its own */
var SKIPW='svg,sub,sup,i,.fbox,.m,.tri,.sdot,.tbl,.quiz,[data-w],script,style,input,button,.w';
var WROOT='.sec,.main,.toc,.kick';
var STOP={};'the a an of to in is are and or it its as by on at for with from that this be can has so if we you i not no do does was were'.split(' ').forEach(function(w){STOP[w]=1;});
function wrapWords(slide){
  var roots=slide.querySelectorAll(WROOT);
  for(var r=0;r<roots.length;r++){
    var tw=document.createTreeWalker(roots[r],NodeFilter.SHOW_TEXT,null),nodes=[],n;
    while((n=tw.nextNode())){if(/\S/.test(n.nodeValue)&&!n.parentNode.closest(SKIPW))nodes.push(n);}
    nodes.forEach(function(t){
      var parts=t.nodeValue.split(/(\s+)/),f=document.createDocumentFragment();
      parts.forEach(function(s){
        if(!s)return;
        if(/^\s+$/.test(s))f.appendChild(document.createTextNode(s));
        else{var e=document.createElement('span');e.className='w';e.textContent=s;f.appendChild(e);}
      });
      t.parentNode.replaceChild(f,t);
    });
  }
}
function wkey(t){return t.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g,'');}
function roleOf(e){var h=e.closest('h1,h2,.eb,h3,.kick,.c');return h?h.nodeName+h.className:'p';}
function listWords(s){
  var a=s.querySelectorAll('.w'),out=[];
  for(var i=0;i<a.length;i++){
    var e=a[i];if(!visible(e,s))continue;
    var k=wkey(e.textContent);if(!k||k.length<2||STOP[k])continue;
    out.push({e:e,k:k,used:false});
  }
  return out;
}
function keySet(s){var a=s.querySelectorAll('.w'),o={};for(var i=0;i<a.length;i++){var k=wkey(a[i].textContent);if(k)o[k]=1;}return o;}
function measureWords(list,keys,sr){
  var out=[];
  for(var i=0;i<list.length;i++){var w=list[i];if(!keys[w.k])continue;var r=rectOf(w.e,sr);w.x=r.cx;w.y=r.cy;out.push(w);}
  return out;
}
function styleWord(w){if(w.fs)return;var cs=getComputedStyle(w.e);w.fs=parseFloat(cs.fontSize)||30;w.c=cs.color;w.role=roleOf(w.e);}
function collectBoxes(s,sr){
  var a=s.querySelectorAll('.card,.svgbox'),out=[];
  for(var i=0;i<a.length;i++){
    var e=a[i];if(e.hasAttribute('data-m')||!visible(e,s)||e.closest('.quiz'))continue;
    var r=rectOf(e,sr);r.e=e;r.k=e.classList.contains('svgbox')?'s':'c';r.used=false;out.push(r);
  }
  return out;
}
function mark(e){if(!e.classList.contains('fly')){e.classList.add('fly');flyEls.push(e);}}

function go(i,dir,fromEnd,quick){
  if(i<0||i>=N||i===cur)return;
  cancelAll();cleanup();clearTimeout(busy);
  var prev=cur>=0?slides[cur]:null,nx=slides[i];
  var sr=stage.getBoundingClientRect();
  var oldKeys=prev?keyMap(prev):{},oldR={},oldW=[],oldB=[];
  var fx=prev&&!REDUCED&&!quick;
  if(prev){for(var k in oldKeys){if(visible(oldKeys[k],prev))oldR[k]=rectOf(oldKeys[k],sr);}}
  var m=meta[i];
  if(!m.wrapped){m.wrapped=true;wrapWords(nx);}
  var newKeys_=fx?keySet(nx):null,oldList=null;
  if(fx){oldList=listWords(prev);oldW=measureWords(oldList,newKeys_,sr);oldB=collectBoxes(prev,sr);}
  nx.classList.add('show');nx.style.zIndex=2;if(prev)prev.style.zIndex=1;
  cur=i;
  if(!m.init){m.init=true;initWidgets(nx);}
  applyStep(i,fromEnd?m.max:0);
  applyBg(nx);
  var d0=0;
  if(fx){
    /* 1 · keyed elements (session badge, titles, formula boxes, named diagrams) */
    var newKeys=keyMap(nx);
    for(var key in newKeys){
      if(!oldR[key])continue;var ne=newKeys[key];if(!visible(ne,nx))continue;
      var nr=rectOf(ne,sr),or=oldR[key];
      var dx=or.cx-nr.cx,dy=or.cy-nr.cy,sx=or.w/nr.w,sy=or.h/nr.h;
      var box=ne.matches('.fbox,.svgbox,.card')||ne.getAttribute('data-mm')==='box';
      if(!box){var u=Math.min(sx,sy);sx=sy=u;}
      oldKeys[key].style.visibility='hidden';hidden.push(oldKeys[key]);
      mark(ne);
      if(Math.abs(dx)<1.5&&Math.abs(dy)<1.5&&Math.abs(sx-1)<.02&&Math.abs(sy-1)<.02)continue;
      var c0=getComputedStyle(oldKeys[key]).color,c1=getComputedStyle(ne).color;
      var f0={transformOrigin:'50% 50%',transform:'translate3d('+dx+'px,'+dy+'px,0) scale('+sx+','+sy+')'},f1={transformOrigin:'50% 50%',transform:'none'};
      if(!box&&c0!==c1){f0.color=c0;f1.color=c1;}
      anim(ne,[f0,f1],{duration:MDUR,easing:MEASE});
    }
    /* 2 · words: identical words glide from where they were (PowerPoint "by word") */
    var oldKeysW={};oldList.forEach(function(o){oldKeysW[o.k]=1;});
    var newW=measureWords(listWords(nx),oldKeysW,sr),byK={};
    oldW.forEach(function(o){(byK[o.k]=byK[o.k]||[]).push(o);});
    var wi=0,wcap=0;
    newW.forEach(function(n){
      var c=byK[n.k];if(!c||wcap>=34)return;
      styleWord(n);
      var best=null,bc=1e9,isP=n.role==='p';
      for(var q=0;q<c.length;q++){
        if(c[q].used)continue;
        styleWord(c[q]);
        var d=Math.hypot(c[q].x-n.x,c[q].y-n.y),rm=c[q].role!==n.role,cost;
        if(isP){if(rm||d>240)continue;cost=d;}else cost=d+(rm?500:0);
        if(cost<bc){bc=cost;best=c[q];}
      }
      if(!best)return;
      best.used=true;wcap++;
      best.e.style.visibility='hidden';hidden.push(best.e);
      mark(n.e);
      var dx=best.x-n.x,dy=best.y-n.y,s=best.fs/n.fs;
      if(Math.abs(dx)<1.5&&Math.abs(dy)<1.5&&Math.abs(s-1)<.02)return;
      var f0={transformOrigin:'50% 50%',transform:'translate3d('+dx+'px,'+dy+'px,0) scale('+s+')'},f1={transformOrigin:'50% 50%',transform:'none'};
      if(best.c!==n.c){f0.color=best.c;f1.color=n.c;}
      anim(n.e,[f0,f1],{duration:MDUR,delay:Math.min(wi++,24)*9,easing:MEASE});
    });
    /* 3 · boxes (cards / diagrams): the frame glides + resizes, content crossfades */
    var newB=collectBoxes(nx,sr),pairs=[];
    newB.forEach(function(n){oldB.forEach(function(o){
      if(o.k!==n.k)return;
      var cost=Math.hypot(o.cx-n.cx,o.cy-n.cy)+.6*(Math.abs(o.w-n.w)+Math.abs(o.h-n.h))+(o.e.className===n.e.className?0:140);
      if(cost<650)pairs.push({o:o,n:n,c:cost});
    });});
    pairs.sort(function(a,b){return a.c-b.c;});
    pairs.forEach(function(p){if(p.o.used||p.n.used)return;p.o.used=p.n.used=true;p.n.mate=p.o;});
    newB.forEach(function(n){
      if(!(n.e.querySelector('.fly')||n.mate||n.e.classList.contains('fly')))return;
      n.e.classList.add('flyb');flyEls.push(n.e);
      ghostBox(nx,n,n.mate);
    });
  }
  /* 4 · everything else fades / rises in, staggered; what is part of a morph stays put */
  if(fx||(!prev&&!REDUCED&&!quick)){
    var hero=nx.classList.contains('hero'),kc=0,wc=0;
    var base=prev?(hero?340:260):(hero?260:200);
    var UNIT='.card,.svgbox,.tbl,.fbox,.ex,.quiz,.eb,h1,h2,h3,.c,.kick,[data-w],.rc>*,.sdot';
    var enter=function(e,extra){
      if(e.nodeType!==1||e.classList.contains('st')||e.classList.contains('ghost')||e.classList.contains('fly'))return;
      var boxed=e.classList.contains('flyb');
      if(boxed)extra=300;
      if(!boxed&&!e.querySelector('.fly')&&!e.querySelector('.flyb')&&(e.matches(UNIT)||!e.querySelector(UNIT))){
        var isW=e.classList.contains('w'),yy=isW?12:(hero?30:24),dl=base+(extra||0)+(isW?Math.min(wc++,16)*34:Math.min(kc++,9)*70);
        anim(e,[{opacity:0,transform:'translate3d(0,'+yy+'px,0)'},{opacity:1,transform:'none'}],{duration:isW?620:760,delay:dl,easing:OUT,fill:'backwards'});
        return;
      }
      for(var c=e.firstElementChild;c;c=c.nextElementSibling)enter(c,extra);
    };
    var roots=nx.querySelectorAll(WROOT);
    for(var r=0;r<roots.length;r++){
      if(roots[r].closest('.st'))continue;
      if(roots[r].classList.contains('sec')||roots[r].classList.contains('kick'))enter(roots[r],0);
      else for(var c=roots[r].firstElementChild;c;c=c.nextElementSibling)enter(c,0);
    }
    if(prev){
      if(hero)anim(nx,[{opacity:0},{opacity:1}],{duration:700,easing:'ease'});
      else anim(prev,[{opacity:1},{opacity:0}],{duration:prev.classList.contains('hero')?800:380,easing:'ease',fill:'forwards'});
    }
  }
  busy=setTimeout(function(){cleanup();},(REDUCED||quick)?10:1350);
  if(quick)cleanup();
  report();
  if(typeof inkRedraw==='function')inkRedraw();
}
/* decoration ghosts: an old-looking frame travels to the new place while a new-looking frame fades in on top */
function ghostBox(nx,n,o){
  var ne=n.e;
  function mk(src,r){
    var g=src.cloneNode(false);g.removeAttribute('id');g.removeAttribute('data-m');
    g.className=src.className.replace(/\bfly\b|\bflyb\b|\bdeco0\b|\bon\b/g,'')+' ghost';
    g.style.cssText='position:absolute;margin:0;box-sizing:border-box;pointer-events:none;transition:none;transform:none;left:'+(r.cx-r.w/2)+'px;top:'+(r.cy-r.h/2)+'px;width:'+r.w+'px;height:'+r.h+'px;';
    nx.insertBefore(g,nx.firstChild);ghosts.push(g);return g;
  }
  ne.classList.add('deco0');deco.push(ne);
  if(!o){
    var g2=mk(ne,n);g2.style.opacity='0';
    anim(g2,[{opacity:0,transform:'translate3d(0,24px,0)'},{opacity:1,transform:'none'}],{duration:760,delay:260,easing:OUT,fill:'both'});
    return;
  }
  var sx=o.w/n.w,sy=o.h/n.h,dx=o.cx-n.cx,dy=o.cy-n.cy,near=sx>.85&&sx<1.18&&sy>.85&&sy<1.18;
  var g1,g2,fr;
  if(near){
    /* compositor path: frames sit at the final place and only transform (no layout / repaint per frame) */
    g1=mk(o.e,n);g2=mk(ne,n);
    var T0='translate3d('+dx+'px,'+dy+'px,0) scale('+sx+','+sy+')';
    fr=function(op0,op1,o0,o1){return [{transform:T0,opacity:op0,offset:0},{opacity:op0,offset:o0},{opacity:op1,offset:o1},{transform:'none',opacity:op1,offset:1}];};
  }else{
    g1=mk(o.e,o);g2=mk(ne,o);
    var to={left:(n.cx-n.w/2)+'px',top:(n.cy-n.h/2)+'px',width:n.w+'px',height:n.h+'px'};
    fr=function(op0,op1,o0,o1){return [{left:g1.style.left,top:g1.style.top,width:g1.style.width,height:g1.style.height,opacity:op0,offset:0},{opacity:op0,offset:o0},{opacity:op1,offset:o1},{left:to.left,top:to.top,width:to.width,height:to.height,opacity:op1,offset:1}];};
  }
  anim(g1,fr(1,0,.35,.8),{duration:MDUR,easing:MEASE,fill:'forwards'});
  anim(g2,fr(0,1,.1,.6),{duration:MDUR,easing:MEASE,fill:'forwards'});
}
function next(){var m=meta[cur];if(m.step<m.max){applyStep(cur,m.step+1);report();return;}var j=shown(cur,1);if(j<0){if(!loop)return;j=shown(-1,1);}if(j>=0&&j!==cur)go(j,1,false);}
function prev(){var m=meta[cur];if(m.step>0){applyStep(cur,m.step-1);report();return;}var j=shown(cur,-1);if(j>=0)go(j,-1,true);}
window.__go=function(i,end){go(i,i>cur?1:-1,!!end)};
window.__all=function(){applyStep(cur,meta[cur].max)};
window.__n=N;

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
 full:{g:'v',i:'close',l:'End show',t:'End show (F)'}
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
  [d,s].forEach(function(src){if(!src)return;assign(UIS,src.ui);if(src.tools)for(var t in CFG)assign(CFG[t],src.tools[t]);});
  fixAll();
}
var saveT=0;
function saveSettings(){if(mode==='boot')return;clearTimeout(saveT);saveT=setTimeout(function(){send('toolbar',{v:1,ui:UIS,tools:CFG,wb:{p:wbPat,c:wbCol}});},120);}
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

var LOGO_SVG='<svg viewBox="283 214 862 996" aria-hidden="true"><g fill="currentColor" fill-rule="evenodd"><path opacity=".5" d="M603.96 221.82C600.16 231.22 608.74 239.12 611.63 249.43C614.79 260.65 613.89 279.20 613.59 291.10C613.13 309.35 613.23 327.66 613.29 345.91C613.33 359.79 613.77 373.51 612.74 387.36C612.20 394.62 610.09 402.00 605.78 407.98C604.61 409.61 603.10 411.14 602.47 413.09C601.71 415.42 602.39 418.08 603.26 420.29C606.60 428.75 616.08 426.62 623.43 426.62C638.90 426.62 654.37 426.87 669.84 426.87C676.59 426.87 684.90 428.24 691.11 425.26C693.19 416.32 689.41 413.87 685.94 406.69C682.55 399.69 680.79 392.76 680.26 385.03C679.08 367.93 680.35 350.51 680.37 333.39C680.40 318.25 680.63 303.11 680.61 287.98C680.60 282.05 679.99 276.13 680.18 270.20C680.45 262.01 681.95 254.32 685.12 246.74C688.90 237.70 696.75 233.60 688.90 221.72C679.25 219.87 651.15 221.12 639.63 221.12C630.04 221.12 612.62 219.83 603.96 221.82Z M425.58 223.28C424.38 233.05 436.51 240.27 437.92 254.31C439.02 265.32 438.37 276.60 438.37 287.65C438.37 307.16 438.37 326.67 438.37 346.18C438.37 360.46 439.99 385.03 435.13 397.87C432.15 405.73 421.07 412.12 428.37 419.60C435.30 420.39 442.54 419.68 449.52 419.75C474.00 419.98 498.53 419.30 523.04 419.64C528.43 419.71 534.29 420.54 539.62 421.39C541.45 421.68 543.19 422.40 545.03 422.53C551.25 422.95 557.58 421.85 563.76 422.26C568.12 422.54 572.07 423.72 576.48 423.14C579.38 418.21 579.74 412.07 580.89 406.53C582.57 398.50 588.11 377.35 587.41 370.36C586.87 365.07 580.62 355.68 574.69 356.20C569.91 356.62 560.13 367.98 555.15 371.35C544.68 378.44 532.12 380.02 519.89 381.16C516.30 381.50 513.17 382.17 509.58 381.45C505.12 372.76 507.69 358.86 507.28 349.16C506.33 326.39 507.39 300.02 507.37 276.78C507.37 269.88 507.62 250.09 511.68 244.86C513.73 242.21 517.11 240.79 519.77 238.85C520.07 233.20 517.48 227.14 514.68 222.30C507.83 219.88 499.36 221.12 492.16 221.12C477.66 221.12 463.15 221.12 448.64 221.12C441.59 221.12 431.68 219.25 425.58 223.28Z M878.03 426.34C885.86 427.53 887.96 424.75 894.54 423.82C899.29 423.15 904.81 423.42 909.60 423.65C928.08 424.53 946.56 423.56 965.02 423.90C975.58 424.09 986.61 425.40 997.12 423.88C1001.99 423.17 1006.64 421.50 1011.43 420.64C1015.97 419.83 1020.56 419.87 1024.88 418.11C1028.46 411.53 1027.93 403.29 1028.92 396.00C1030.05 387.73 1031.18 379.38 1032.51 371.14C1033.07 367.74 1034.19 363.32 1030.56 361.13C1023.73 357.00 1013.33 369.22 1007.95 372.81C996.31 380.59 981.00 383.06 967.22 383.12C962.80 383.14 956.29 384.19 952.89 380.66C949.52 377.16 950.87 366.38 950.87 361.62C950.87 356.10 950.10 350.00 952.01 344.75C958.63 347.12 965.61 345.69 972.15 348.49C977.69 350.86 984.12 358.91 990.67 357.08C995.02 355.86 998.33 351.11 999.43 346.93C1001.01 340.94 999.87 316.18 999.87 308.30C999.87 303.66 1001.08 296.95 999.08 292.65C997.35 288.92 993.00 288.87 989.99 291.01C986.67 293.38 984.00 296.28 980.39 298.30C972.50 302.73 958.98 304.62 951.43 298.79C950.29 292.38 949.89 271.48 951.93 265.68C958.92 267.89 965.46 267.46 972.59 268.33C980.26 269.28 987.93 272.92 994.88 276.09C999.52 278.22 1009.06 286.85 1013.38 286.16C1018.76 285.31 1022.67 277.61 1024.06 272.94C1026.49 264.71 1022.51 249.50 1021.91 240.50C1021.59 235.64 1021.67 228.71 1019.07 224.44C1018.11 222.86 1016.52 221.91 1014.76 221.47C1008.79 219.95 994.00 221.12 987.11 221.12C961.02 221.12 934.87 220.34 908.80 221.08C902.47 221.25 884.52 219.43 879.81 222.42C875.10 225.40 874.33 233.37 876.85 237.88C879.60 242.83 882.68 247.27 884.44 252.74C888.85 266.45 886.87 300.37 886.87 316.23C886.87 330.33 886.79 344.43 886.88 358.52C886.96 370.85 888.37 383.80 886.14 396.01C884.15 406.90 870.50 417.20 878.03 426.34Z M711.19 222.44C707.20 233.45 713.36 238.83 717.64 247.98C720.10 253.24 721.48 259.40 721.99 265.18C722.64 272.40 722.02 279.81 721.91 287.05C721.73 297.95 721.85 308.94 721.88 319.85C721.91 333.31 721.98 346.79 722.14 360.26C722.21 366.33 722.85 372.44 722.47 378.50C722.05 385.25 722.02 392.94 719.48 399.28C715.47 409.30 705.32 415.02 713.09 426.47C719.27 427.68 767.40 426.87 777.84 426.87C783.63 426.87 795.51 429.06 797.81 421.83C800.34 413.83 791.05 407.01 788.55 398.26C786.16 389.95 783.80 355.53 784.47 346.76C792.36 344.71 802.20 344.53 809.77 347.93C815.20 350.36 819.54 356.97 826.20 355.60C832.06 354.39 832.71 347.07 832.84 342.17C833.15 330.51 832.87 318.82 832.87 307.16C832.87 302.53 834.09 295.78 832.05 291.51C830.51 288.29 826.46 287.53 823.56 289.40C821.73 290.59 820.27 292.33 818.59 293.72C812.22 298.96 805.34 301.12 797.15 301.12C793.29 301.13 790.00 301.03 786.48 299.32L785.60 268.14C800.16 265.64 814.89 268.72 827.98 275.23C837.24 279.83 843.07 288.43 851.17 287.19C860.48 275.53 855.56 259.04 855.00 245.55C854.70 238.44 854.67 228.77 851.72 222.33C844.25 219.34 826.98 220.87 818.32 220.87C794.64 220.87 770.97 220.87 747.29 220.87C738.13 220.87 718.82 218.85 711.19 222.44Z"/><path d="M429.75 222.82C432.41 229.94 437.81 235.54 439.53 243.17C442.21 255.10 440.94 268.41 440.66 280.54C440.27 297.35 440.62 314.22 440.62 331.05C440.62 349.79 442.94 373.11 439.12 391.24C437.08 400.92 432.05 403.72 429.98 410.67C435.75 413.09 467.99 411.63 476.52 411.63C493.46 411.62 510.58 410.91 527.51 411.71C534.24 412.02 540.72 413.80 547.38 414.39C552.07 414.81 556.89 414.08 561.60 414.14C565.76 414.19 569.87 414.82 574.02 414.83C577.02 409.57 577.52 403.79 578.79 397.98C580.47 390.36 585.53 375.22 584.26 368.00C583.41 363.17 579.49 358.91 575.21 356.86C567.79 361.14 562.57 368.16 555.30 372.62C544.16 379.46 520.67 383.24 507.82 381.38C501.87 371.15 505.13 356.83 504.92 345.54C504.48 320.97 505.12 296.44 505.12 271.87C505.12 263.41 504.59 244.54 509.17 237.56C510.90 234.91 513.89 233.24 516.21 231.15L512.25 222.51C502.98 219.50 464.37 221.12 452.03 221.12C445.04 221.12 436.04 219.24 429.75 222.82Z M878.47 227.71C881.01 234.58 885.57 240.26 887.28 247.52C891.54 265.66 889.56 292.87 889.15 311.87C888.65 335.31 890.10 358.75 889.60 382.16C889.46 388.56 889.14 395.47 886.48 401.38C884.17 406.49 878.79 411.96 880.14 417.85C885.29 418.50 890.29 415.95 895.44 415.53C901.02 415.08 906.68 415.42 912.26 415.66C929.98 416.41 947.74 415.84 965.48 415.88C975.30 415.89 985.05 417.24 994.83 415.79C999.49 415.10 1003.97 413.65 1008.59 412.78C1013.25 411.91 1017.90 411.65 1022.42 410.10C1026.55 401.77 1027.06 386.24 1028.24 376.57C1028.83 371.71 1030.46 366.58 1029.21 361.75C1021.54 360.54 1012.69 371.59 1006.02 375.25C993.79 381.96 979.89 382.67 966.31 383.20C961.47 383.39 954.46 384.33 950.85 380.29C946.79 375.74 948.37 362.86 948.37 356.94C948.37 350.26 948.00 343.55 949.86 337.08C953.59 336.58 956.85 337.52 960.52 338.03C982.57 341.09 973.29 342.99 988.53 348.78C1002.05 342.81 997.63 319.62 997.63 307.42C997.62 301.58 999.04 294.77 994.44 290.38C989.62 292.36 986.22 296.46 981.61 298.84C972.36 303.62 958.64 304.15 949.50 299.04C947.22 289.66 947.22 267.23 949.78 257.93C954.13 257.58 958.13 258.75 962.42 259.29C974.95 260.84 982.08 261.00 993.90 266.60C1000.41 269.67 1006.05 275.13 1012.90 277.24C1026.98 268.64 1020.51 253.01 1019.66 239.94C1019.30 234.51 1019.72 225.89 1014.44 222.56C1008.89 219.06 991.52 221.12 984.49 221.12C959.38 221.12 934.28 221.05 909.17 221.12C899.59 221.15 883.47 217.03 878.47 227.71Z M606.19 222.32C607.67 230.91 613.55 237.54 615.07 247.36C618.16 267.39 615.49 299.32 615.38 320.66C615.28 340.20 618.16 381.98 612.62 398.85C611.04 403.69 607.91 407.47 605.67 411.95C609.58 420.04 618.04 418.63 625.69 418.62C639.50 418.62 653.30 418.87 667.11 418.88C674.33 418.88 681.74 420.01 688.57 417.16C686.45 408.80 680.96 403.15 678.86 391.94C675.68 374.95 678.04 349.00 678.12 331.13C678.18 317.33 678.38 303.52 678.37 289.72C678.37 276.02 676.60 262.15 679.64 248.63C681.45 240.62 685.99 234.46 689.07 227.05L686.45 221.87C669.91 218.99 652.39 221.18 635.68 221.12C626.12 221.09 615.43 219.27 606.19 222.32Z M713.22 223.00C712.77 230.12 722.50 241.13 724.09 256.49C725.12 266.36 724.26 276.20 724.14 286.08C723.98 299.07 724.12 312.08 724.12 325.08C724.12 342.84 726.85 380.10 722.90 395.46C721.14 402.29 716.47 407.77 713.45 414.03L715.40 418.03C729.08 420.88 758.00 418.87 773.29 418.88C780.64 418.88 789.10 420.79 794.75 415.07C792.79 408.85 788.09 404.00 786.26 397.68C782.72 385.47 781.12 351.95 782.43 339.08C791.05 336.27 803.23 336.07 811.62 339.84C816.38 341.98 819.75 346.00 824.95 347.24C827.02 345.69 828.59 344.08 829.46 341.58C832.11 333.98 830.62 313.06 830.63 304.06C830.63 298.56 831.58 293.17 827.19 289.14C823.27 291.00 820.41 294.29 816.72 296.55C807.99 301.90 793.94 303.15 784.47 299.24L783.63 260.42C798.14 256.83 817.18 260.50 830.31 267.31C836.69 270.62 841.92 276.69 849.01 278.37C851.46 275.18 853.21 271.58 853.84 267.58C854.55 263.12 852.57 236.16 851.72 230.89C851.24 227.96 850.41 225.21 849.25 222.48C838.93 218.75 826.47 220.87 815.68 220.87C793.51 220.87 771.34 220.88 749.17 220.87C738.55 220.87 722.75 217.92 713.22 223.00Z"/><path opacity=".5" d="M743.37 455.63C734.72 465.17 744.29 472.46 746.28 482.71C747.90 491.08 747.86 532.21 746.72 541.24C745.55 550.48 737.52 557.91 742.72 567.26C753.10 567.77 779.07 568.50 788.18 565.70C792.89 558.10 788.05 554.16 785.48 547.18C783.11 540.75 782.02 532.77 783.59 526.07C793.61 523.77 799.43 528.80 806.87 527.51C807.72 526.01 808.44 524.61 808.71 522.88C809.55 517.35 809.46 497.53 807.94 492.47C806.03 491.32 804.84 491.16 802.63 491.41C796.94 497.08 793.43 499.23 785.15 497.49L783.45 484.50C790.36 481.85 799.33 483.40 805.95 486.38C810.24 488.31 815.88 493.13 820.79 490.07C823.37 488.46 823.78 485.08 823.77 482.31C823.74 477.34 824.49 463.26 823.04 459.34C822.41 457.62 821.01 456.29 819.31 455.64C815.23 454.08 801.32 455.12 796.21 455.12C783.32 455.12 754.45 453.85 743.37 455.63Z M666.49 453.41C659.93 454.39 653.61 455.61 647.73 458.83C620.57 473.69 615.69 510.58 625.76 537.31C627.81 542.75 630.00 547.97 633.80 552.48C647.23 568.45 672.29 572.74 691.91 568.42C698.77 566.92 705.46 564.75 711.17 560.57C736.24 542.19 736.99 497.36 719.53 473.67C707.59 457.45 686.15 450.48 666.49 453.41Z M689.76 483.13C696.02 495.04 695.52 518.58 691.12 531.14C688.20 539.49 681.10 546.66 671.53 543.67C662.20 540.75 661.38 526.37 661.38 518.41C661.37 512.61 661.06 496.90 662.40 492.00C662.99 489.85 664.52 488.36 665.85 486.64C670.03 481.26 673.96 479.62 680.78 480.73C683.88 481.23 686.84 481.97 689.76 483.13Z"/><path d="M743.01 459.62C744.31 465.05 747.60 469.69 748.54 475.24C750.90 489.09 750.07 515.44 749.57 530.08C749.42 534.39 749.36 538.91 748.49 543.14C747.41 548.43 743.65 553.31 744.78 558.80C752.65 560.38 780.60 560.98 786.60 556.24C785.94 552.75 784.15 549.79 782.97 546.47C779.97 537.96 779.58 527.16 781.60 518.40C789.45 516.20 796.66 518.83 804.49 519.24C807.95 512.77 807.88 499.14 805.12 492.37C796.12 496.51 794.43 500.26 783.16 497.17C781.54 490.52 780.51 483.16 781.60 476.36C790.35 474.35 799.95 474.59 808.20 478.42C811.30 479.87 814.08 481.58 817.42 482.49C818.65 481.54 819.79 480.69 820.48 479.24C822.84 474.32 822.84 458.92 817.29 456.13C812.07 453.50 804.56 455.05 798.93 455.11C785.86 455.26 772.72 454.17 759.66 454.72C753.43 454.98 746.80 453.75 743.01 459.62Z M672.68 453.03C634.36 455.48 616.10 490.88 626.93 525.66C628.71 531.35 630.75 537.27 634.35 542.10C640.58 550.45 649.49 556.09 659.39 559.10C666.24 561.19 673.54 562.24 680.69 561.72C689.82 561.05 699.64 558.64 707.33 553.54C739.92 531.94 734.69 474.35 696.22 457.53C689.03 454.39 680.55 452.53 672.68 453.03Z M691.84 475.20C698.61 488.75 698.20 515.17 693.81 529.53C690.51 540.34 681.01 547.26 669.56 543.46C658.24 539.69 659.12 523.45 659.12 514.00C659.12 496.19 654.78 469.97 681.43 472.60C685.05 472.96 688.46 473.88 691.84 475.20Z"/><path opacity=".5" d="M813.43 1049.24C813.48 1056.06 817.68 1061.86 818.04 1068.58C818.48 1076.86 818.12 1085.25 818.12 1093.54C818.12 1109.64 818.12 1125.75 818.12 1141.84C818.13 1150.40 819.85 1167.66 815.88 1174.91C814.60 1177.25 812.41 1178.83 810.49 1180.60C809.91 1185.80 811.66 1196.25 816.88 1198.93C821.65 1201.38 844.09 1199.87 850.75 1199.87C858.06 1199.87 868.33 1201.79 874.43 1197.05C875.62 1187.68 866.84 1180.27 866.02 1171.11C864.78 1157.32 865.88 1136.23 865.88 1121.66C865.88 1108.51 864.08 1080.29 867.92 1069.00C869.23 1065.13 871.88 1062.04 873.57 1058.37C871.74 1054.89 868.95 1051.35 865.17 1049.84C861.66 1048.45 835.98 1048.71 830.18 1048.61C824.73 1048.52 818.61 1047.26 813.43 1049.24Z M594.58 1196.95C601.42 1201.47 611.03 1199.39 618.86 1199.73C625.34 1200.02 652.06 1200.92 655.88 1196.95C657.49 1195.29 658.05 1192.91 658.52 1190.72C661.20 1178.47 652.35 1176.15 650.46 1165.77C647.28 1148.34 651.02 1133.11 657.65 1117.14C664.68 1100.19 674.52 1084.24 683.88 1068.50C687.57 1062.30 694.04 1055.06 689.99 1047.69C682.49 1046.34 652.53 1046.37 644.96 1047.65C639.80 1055.13 645.76 1059.75 645.84 1067.29C645.89 1073.30 638.89 1090.70 634.92 1095.20C627.98 1089.75 621.16 1067.79 620.18 1058.97C619.76 1055.18 620.93 1051.61 620.04 1047.87C612.74 1046.07 603.94 1046.89 596.48 1047.37C590.05 1047.78 569.07 1046.61 565.03 1050.35C556.06 1058.67 565.77 1068.55 570.42 1076.36C578.66 1090.20 586.25 1104.45 593.70 1118.72C597.41 1125.81 602.62 1133.43 604.44 1141.27C605.84 1147.32 604.97 1172.30 602.83 1178.03C600.41 1184.48 592.46 1184.27 594.58 1196.95Z M419.80 1194.63C422.78 1200.92 429.14 1199.87 435.14 1199.87C446.14 1199.87 457.15 1199.88 468.15 1199.87C474.84 1199.87 481.05 1199.66 484.01 1192.73C488.53 1182.16 484.42 1181.88 481.36 1172.78C479.72 1167.94 473.21 1143.40 473.38 1139.54C480.05 1138.23 493.47 1138.06 500.04 1139.59C502.54 1144.90 502.34 1173.76 500.48 1179.73C498.35 1186.60 492.07 1188.37 493.46 1196.84C498.47 1200.78 505.20 1199.62 511.24 1199.63C519.69 1199.63 544.87 1201.25 551.34 1197.97C554.36 1196.44 556.28 1193.25 557.59 1190.24C561.37 1181.58 554.67 1178.74 552.26 1171.51C551.20 1168.32 551.33 1164.77 551.20 1161.45C550.34 1139.11 551.25 1116.63 550.89 1094.27C550.76 1085.62 552.63 1073.65 549.04 1065.80C551.58 1060.06 556.66 1056.06 556.49 1049.39C550.74 1047.46 526.29 1048.77 518.30 1048.60C513.35 1048.49 506.98 1047.10 502.23 1048.70C498.31 1050.02 495.08 1053.98 493.15 1057.46C494.40 1062.14 498.10 1065.20 499.72 1069.72C502.76 1078.23 502.91 1093.07 500.91 1101.85L482.08 1099.17C480.60 1089.25 480.70 1074.72 482.03 1064.76C482.79 1059.12 486.28 1055.19 485.64 1049.16C480.83 1046.29 475.04 1047.12 469.63 1047.12C461.37 1047.12 437.37 1045.89 430.89 1047.76C426.97 1048.89 422.18 1052.56 420.78 1056.51C419.19 1061.00 424.01 1065.13 425.64 1068.97C428.50 1075.70 428.85 1083.41 428.88 1090.63C428.92 1106.06 428.82 1121.49 428.88 1136.93C428.92 1149.01 430.24 1166.74 428.10 1178.20C426.93 1184.44 421.46 1188.51 419.80 1194.63Z M1005.68 1097.81C1008.03 1092.55 1007.37 1086.67 1007.37 1081.02C1007.37 1075.03 1008.58 1064.14 1005.76 1058.89C1003.94 1055.48 1000.44 1052.04 996.98 1050.30C985.98 1044.77 958.53 1044.02 946.19 1045.28C929.14 1047.04 911.79 1054.08 900.39 1067.27C878.87 1092.19 877.72 1144.55 896.15 1171.44C915.68 1199.93 944.34 1204.09 976.54 1201.02C982.05 1200.49 1000.70 1197.32 1004.70 1194.35C1006.35 1193.12 1006.98 1191.20 1007.27 1189.24C1008.18 1183.09 1008.52 1165.41 1006.95 1159.67C1005.65 1154.88 1000.41 1147.77 994.99 1147.49C990.74 1147.28 983.58 1157.96 976.75 1160.73C967.31 1164.56 948.57 1162.62 941.81 1154.23C937.01 1148.28 935.66 1138.99 935.01 1131.58C933.11 1109.92 940.08 1082.28 966.14 1080.77C970.42 1080.52 974.97 1080.56 979.11 1081.76C995.59 1086.50 991.13 1104.47 1005.68 1097.81Z M756.26 1156.50C755.22 1165.62 748.80 1167.69 740.60 1167.06C727.07 1166.02 718.42 1160.74 708.39 1152.14C704.65 1148.93 701.46 1144.58 696.17 1144.98C693.86 1150.50 694.70 1173.85 695.01 1181.01C695.18 1184.75 694.19 1190.10 697.03 1193.05C701.31 1197.51 714.96 1198.95 721.04 1199.96C740.11 1203.13 763.82 1204.43 780.50 1192.72C784.45 1189.95 787.79 1186.14 790.88 1182.47C800.20 1171.37 802.56 1151.51 797.98 1137.94C794.73 1128.30 788.03 1119.32 779.70 1113.42C767.30 1104.64 749.32 1101.34 736.08 1092.29C735.70 1074.53 766.48 1078.23 776.66 1087.22C780.82 1090.89 782.88 1096.71 788.44 1098.40C792.38 1094.74 791.53 1090.10 791.67 1085.13C791.94 1075.28 794.67 1056.94 785.00 1050.92C779.12 1047.26 770.26 1046.82 763.54 1045.99C742.09 1043.33 718.72 1045.34 704.26 1063.36C699.91 1068.76 697.16 1075.57 695.63 1082.30C694.36 1087.95 693.93 1093.88 694.17 1099.67C695.13 1122.39 712.94 1133.52 731.47 1142.16C739.97 1146.13 749.95 1149.24 756.26 1156.50Z M289.69 1058.44C291.40 1065.84 295.68 1067.53 297.74 1080.07C299.30 1089.58 298.12 1107.53 298.12 1117.92C298.12 1136.97 299.18 1156.97 298.04 1175.91C297.51 1184.81 289.52 1188.82 289.75 1196.68C294.76 1201.01 301.52 1199.87 307.75 1199.87C317.53 1199.87 339.87 1201.47 348.16 1198.42C352.27 1196.90 357.15 1192.08 358.08 1187.69C358.98 1183.41 354.78 1180.09 352.73 1176.81C348.26 1169.62 344.85 1162.30 342.81 1154.06C353.45 1149.98 369.04 1152.19 383.23 1146.39C393.23 1142.30 407.12 1129.56 412.20 1120.02C419.26 1106.79 421.32 1083.45 414.85 1069.72C401.36 1041.09 353.31 1045.12 327.38 1045.12C314.42 1045.12 307.22 1042.77 296.42 1051.28C293.67 1053.43 291.37 1055.34 289.69 1058.44Z M365.97 1115.75C361.43 1117.05 356.81 1116.70 352.26 1115.60C349.98 1105.32 350.14 1093.63 350.28 1083.13C347.92 1082.67 345.95 1082.92 344.04 1081.33C346.79 1079.87 349.61 1080.03 352.66 1079.97C364.97 1079.75 367.11 1088.92 367.72 1099.08C368.05 1104.67 368.06 1110.47 365.97 1115.75Z M1090.61 1158.77L1086.95 1166.66C1075.51 1168.40 1061.36 1167.96 1051.47 1161.25C1045.40 1157.13 1034.92 1145.82 1028.39 1144.66C1026.50 1144.32 1024.95 1144.91 1023.25 1145.65C1021.07 1152.40 1021.27 1172.30 1023.15 1179.25C1024.43 1183.99 1026.87 1188.78 1030.57 1192.09C1035.75 1196.72 1050.32 1198.80 1057.29 1199.95C1083.27 1204.23 1114.56 1204.29 1132.81 1182.13C1144.71 1167.66 1143.45 1142.95 1131.89 1128.66C1124.80 1119.90 1114.65 1114.17 1104.88 1108.87C1096.74 1104.45 1075.07 1099.50 1077.32 1089.53C1078.42 1084.66 1083.60 1082.07 1087.97 1080.82C1098.46 1077.82 1109.43 1082.50 1116.93 1089.84C1118.88 1091.74 1120.29 1094.12 1122.26 1095.99C1124.89 1098.48 1127.81 1098.84 1131.25 1098.28C1134.88 1093.42 1133.88 1087.27 1133.88 1081.49C1133.88 1070.67 1136.35 1062.57 1127.93 1054.50C1126.10 1052.75 1124.27 1051.00 1121.93 1049.96C1113.38 1046.14 1102.17 1045.31 1092.93 1045.10C1071.94 1044.63 1047.02 1045.38 1033.05 1063.96C1028.90 1069.47 1026.17 1075.82 1024.86 1082.57C1024.07 1086.62 1024.11 1090.66 1024.13 1094.77C1024.21 1110.52 1030.75 1117.90 1042.65 1127.00C1049.62 1132.33 1056.66 1136.80 1064.40 1140.92C1073.52 1145.77 1086.36 1148.22 1090.61 1158.77Z"/><path d="M817.67 1048.99C818.30 1052.76 819.79 1056.34 820.19 1060.16C821.03 1068.20 820.44 1076.35 820.38 1084.40C820.26 1102.68 819.71 1121.15 820.47 1139.41C820.85 1148.54 822.14 1165.29 818.58 1173.53C817.45 1176.16 815.45 1178.10 813.52 1180.15C814.13 1183.71 815.18 1187.53 818.17 1189.86C823.91 1194.32 843.29 1191.87 850.87 1191.88C857.61 1191.88 864.41 1192.96 870.62 1189.75C869.42 1183.40 864.97 1178.23 864.02 1171.72C861.28 1152.88 863.70 1125.40 863.36 1105.35C863.06 1088.33 861.46 1070.57 868.52 1054.70C867.04 1052.79 865.54 1051.24 863.25 1050.32C856.09 1047.47 839.12 1048.66 830.93 1048.62C826.47 1048.60 822.04 1047.93 817.67 1048.99Z M646.64 1048.53C646.08 1053.52 648.14 1058.65 648.12 1063.76C648.08 1074.30 643.61 1086.79 636.97 1094.98C630.24 1094.92 627.72 1089.31 625.23 1083.75C621.78 1076.04 618.76 1067.18 618.03 1058.73C617.71 1055.16 617.94 1051.59 617.50 1048.02C609.75 1045.83 587.33 1047.22 578.49 1047.92C572.76 1048.38 567.97 1048.97 564.66 1054.12C566.76 1061.09 571.98 1067.27 575.59 1073.57C581.35 1083.61 602.53 1120.63 605.42 1129.21C608.94 1139.66 607.90 1158.54 606.55 1169.57C605.03 1181.98 601.62 1179.62 597.50 1188.71C599.70 1190.20 601.91 1191.06 604.54 1191.50C609.81 1192.37 634.03 1192.09 640.44 1191.81C644.66 1191.62 651.12 1191.56 654.02 1187.95C659.20 1181.49 650.78 1174.09 648.87 1167.96C645.61 1157.51 646.59 1140.06 648.81 1129.37C652.73 1110.48 662.52 1092.52 672.33 1076.11C676.39 1069.30 686.50 1055.34 687.82 1048.30C680.11 1045.70 654.10 1045.50 646.64 1048.53Z M424.53 1054.04C426.37 1060.13 429.26 1063.60 430.39 1070.49C432.60 1083.82 430.95 1118.00 431.14 1133.68C431.30 1146.90 433.75 1167.88 429.63 1180.16C428.51 1183.52 426.29 1186.36 424.78 1189.55C429.74 1192.90 436.27 1191.87 442.00 1191.87C450.28 1191.87 471.06 1193.74 477.54 1189.57C480.56 1187.63 481.87 1184.48 482.78 1181.17C477.04 1168.74 469.85 1145.25 471.49 1131.72C480.04 1129.61 493.74 1129.48 502.23 1131.84C505.05 1141.11 505.36 1169.64 502.74 1178.96C501.65 1182.87 498.98 1185.84 497.39 1189.50C502.89 1192.44 509.25 1191.61 515.30 1191.63C524.09 1191.65 543.09 1193.95 550.28 1188.98C552.78 1187.25 554.13 1184.55 555.32 1181.86C553.54 1177.76 550.70 1174.13 549.70 1169.71C547.67 1160.79 548.62 1149.36 548.62 1140.15C548.62 1122.99 548.62 1105.82 548.63 1088.65C548.63 1084.21 549.02 1079.72 548.80 1075.28C548.51 1069.38 545.83 1063.73 547.26 1057.74C547.96 1054.81 549.99 1052.23 551.23 1049.51C546.74 1047.82 541.73 1048.37 537.01 1048.38C531.91 1048.38 508.00 1047.85 505.07 1048.75C502.12 1049.66 499.98 1051.66 498.01 1053.95C499.46 1057.34 501.53 1060.39 502.59 1063.96C505.44 1073.56 505.43 1091.85 502.95 1101.55C495.63 1102.27 487.08 1100.71 480.01 1098.78C477.88 1089.47 478.26 1069.72 479.39 1060.02C479.84 1056.19 481.10 1052.54 481.59 1048.72C476.20 1046.40 470.17 1047.17 464.42 1047.11C451.98 1046.99 433.45 1043.42 424.53 1054.04Z M1088.80 1166.53C1076.49 1169.00 1060.64 1168.46 1049.76 1161.57C1042.09 1156.72 1035.65 1146.70 1026.22 1145.47C1021.38 1155.85 1023.79 1176.30 1032.91 1183.89C1037.80 1187.96 1044.65 1189.18 1050.71 1190.39C1078.19 1195.89 1112.57 1197.70 1131.58 1172.73C1134.64 1168.70 1136.65 1163.68 1137.72 1158.76C1142.95 1134.76 1120.19 1116.89 1100.97 1108.14C1087.74 1102.13 1073.08 1100.59 1075.06 1083.29C1076.46 1071.01 1095.76 1070.42 1104.73 1073.11C1109.17 1074.44 1113.38 1076.96 1116.90 1079.95C1120.95 1083.40 1123.63 1088.32 1128.87 1090.05C1131.80 1085.42 1131.62 1080.69 1131.63 1075.38C1131.65 1060.41 1128.90 1052.07 1113.04 1047.78C1104.63 1045.50 1095.80 1045.13 1087.13 1045.13C1065.79 1045.12 1041.95 1049.46 1031.30 1070.40C1015.48 1101.53 1042.52 1120.80 1067.42 1133.21C1082.13 1140.53 1101.58 1146.02 1088.80 1166.53Z M758.41 1148.59C758.73 1153.20 759.08 1158.54 756.24 1162.50C748.74 1172.96 723.34 1164.74 714.86 1158.79C709.46 1155.00 704.70 1149.53 698.83 1146.56C695.01 1154.05 697.21 1166.86 697.36 1175.16C697.43 1179.35 697.34 1183.59 701.13 1186.26C707.54 1190.76 717.22 1190.94 724.71 1192.08C749.77 1195.92 774.09 1194.78 790.17 1172.36C793.41 1167.85 795.40 1162.40 796.58 1157.01C797.70 1151.88 797.86 1147.16 796.70 1142.02C788.61 1105.99 754.91 1107.56 734.02 1092.19C733.80 1087.52 733.18 1081.73 735.95 1077.65C742.48 1068.07 765.07 1071.41 773.83 1076.02C779.50 1079.01 782.24 1084.71 787.52 1087.92C789.67 1084.04 789.31 1079.89 789.51 1075.58C790.04 1064.15 789.96 1052.15 776.77 1048.43C752.75 1041.65 718.54 1043.56 703.97 1066.95C701.02 1071.68 699.10 1077.02 697.92 1082.45C696.93 1086.98 696.32 1091.44 697.01 1096.06C702.18 1130.65 741.84 1130.99 758.41 1148.59Z M995.42 1148.48C987.86 1152.18 983.63 1159.78 975.00 1161.80C970.73 1162.80 966.24 1162.74 961.88 1162.52C940.78 1161.44 934.19 1150.69 932.78 1130.84C932.21 1122.87 932.13 1114.79 933.18 1106.85C935.86 1086.61 947.42 1072.83 968.65 1072.63C973.93 1072.58 979.28 1072.77 984.19 1074.93C991.59 1078.19 993.83 1086.14 1000.02 1090.69C1005.45 1088.75 1005.11 1082.90 1005.12 1077.91C1005.15 1067.62 1006.08 1057.01 995.80 1051.09C986.53 1045.76 973.34 1044.93 962.87 1044.88C915.34 1044.64 887.11 1069.82 885.72 1118.14C885.48 1126.40 887.21 1135.12 889.43 1143.04C900.10 1181.08 931.81 1195.61 969.01 1193.46C977.07 1193.00 995.03 1191.01 1001.59 1186.60C1005.30 1184.11 1005.33 1178.79 1005.54 1174.78C1006.06 1164.72 1005.34 1153.73 995.42 1148.48Z M294.27 1055.67C295.64 1059.23 297.60 1062.57 298.64 1066.26C303.39 1082.98 300.14 1101.51 300.39 1118.62C300.58 1131.21 302.49 1168.37 299.77 1178.47C298.67 1182.53 296.12 1185.84 294.50 1189.67C299.71 1192.83 306.40 1191.86 312.26 1191.88C325.55 1191.91 346.22 1196.11 354.30 1182.71C347.94 1170.71 339.03 1160.82 341.03 1146.15C353.12 1141.46 366.74 1143.46 379.04 1139.01C404.56 1129.78 423.88 1098.17 413.36 1071.65C401.68 1042.20 356.85 1045.12 331.27 1045.12C316.97 1045.13 304.44 1043.27 294.27 1055.67Z M367.88 1115.65C362.20 1117.13 355.99 1117.00 350.33 1115.42C346.86 1105.04 349.10 1093.87 347.41 1083.26L342.65 1081.66L342.39 1073.15C348.82 1071.27 358.96 1070.39 364.42 1075.09C372.20 1081.78 371.59 1106.91 367.88 1115.65Z"/></g><g transform="translate(2.5 3.5)" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="17.5"><ellipse cx="721.3" cy="756.2" rx="315.5" ry="92.6" transform="rotate(0.03 721.3 756.2)"/><ellipse cx="704.7" cy="774.8" rx="316.8" ry="85.3" transform="rotate(48.66 704.7 774.8)"/><ellipse cx="737.3" cy="775.0" rx="316.7" ry="85.1" transform="rotate(131.46 737.3 775.0)"/></g><circle cx="724.3" cy="770.6" r="42.7" fill="currentColor" fill-opacity=".5"/><g fill="none" stroke="currentColor" stroke-width="17.5"><ellipse cx="721.3" cy="756.2" rx="315.5" ry="92.6" transform="rotate(0.03 721.3 756.2)"/><ellipse cx="704.7" cy="774.8" rx="316.8" ry="85.3" transform="rotate(48.66 704.7 774.8)"/><ellipse cx="737.3" cy="775.0" rx="316.7" ry="85.1" transform="rotate(131.46 737.3 775.0)"/></g><circle cx="721.8" cy="767.1" r="42.7" fill="currentColor"/></svg>';
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
  if(REDUCED)ani=false;
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
function fsIcon(){}
function hasInk(){var a=ink[ikey()];return !!(a&&a.length);}
function toggleFS(){send('end',{});}

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
mkCanvas('cHL');mkCanvas('cHLv');mkCanvas('cPen');mkCanvas('cPenL',{desynchronized:true});mkCanvas('cLive');
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
/* the template's width rule, pw(), is the same curve: thinning .6 gives .4 to 1.6 times the size */
function outline(st,done){
  var flat=st.k==='h'||st.np;
  var o=window.__pf.getStroke(flat?st.pts.map(function(p){return [p[0],p[1],.5];}):st.pts,{size:st.w,thinning:flat?0:.6,smoothing:.5,streamline:.4,simulatePressure:false,last:done!==false});
  var P=new Path2D();if(!o.length)return P;
  P.moveTo(o[0][0],o[0][1]);
  for(var i=1;i<o.length;i++){var q=o[(i+1)%o.length];P.quadraticCurveTo(o[i][0],o[i][1],(o[i][0]+q[0])/2,(o[i][1]+q[1])/2);}
  P.closePath();return P;
}
function strokeTo(c,st,live){
  var P=st.pts;c.fillStyle=st.c;
  if(P.length===1){c.beginPath();c.arc(P[0][0],P[0][1],pw(st,P[0][2])/2,0,6.2832);c.fill();return;}
  c.fill(outline(st,!live));
}
function clearLive(x,cn){x.save();x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cn.width,cn.height);x.restore();}
function liveDraw(st){var hl=st.k==='h',x=hl?cx.cHLv:cx.cPenL;clearLive(x,hl?cv.cHLv:cv.cPenL);strokeTo(x,st,true);}
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
function pushHist(i,snap){inkChanged(i);(hist[i]=hist[i]||[]).push(snap);if(hist[i].length>60)hist[i].shift();redoS[i]=[];updActs();}
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
function swapInk(k,nw,kind){setTimeout(function(){inkChanged(k);},0);
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
    if(G.st.k==='h')cv.cHLv.style.opacity=G.st.op;
    liveDraw(G.st);
    updActs();
  }else if(mode==='erase'){eraseAt(p[0],p[1],G);}
  else{laserPt(p[0],p[1],true);}
}
function endGesture(){
  var g=G;G=null;if(!g)return;
  if(g.mode==='draw'&&g.st){
    var P=g.st.pts;
    if(g.st.k==='h'){
      clearLive(cx.cHLv,cv.cHLv);if(!g.committed)drawHL(g.st);
    }else{clearLive(cx.cPenL,cv.cPenL);if(!g.committed)strokeTo(cx.cPen,g.st);}
    pushHist(g.slide,g.snap);
  }else if(g.mode==='erase'&&g.erased)pushHist(g.slide,g.snap);
  else if(g.mode==='laser'){trail.push([lx,ly,performance.now(),1]);laserKick();}
  if(g.mode!=='pending')swallowUntil=performance.now()+350;
  busy_(false);
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
      if(e.shiftKey){st.pts=[g.all[0],p];g.committed=true;clearLive(cx.cPenL,cv.cPenL);clearLive(cx.cHLv,cv.cHLv);inkRedraw();continue;}
      var L=g.all[g.all.length-1];if(Math.abs(p[0]-L[0])+Math.abs(p[1]-L[1])<.6&&Math.abs(p[2]-L[2])<.02)continue;
      g.all.push(p);if(st.pts.length<2||st.pts[st.pts.length-1]===g.all[g.all.length-2])st.pts.push(p);else st.pts=g.all.slice();
      g.moved=true;
    }else if(g.mode==='erase')eraseTo(p[0],p[1],g);
    else laserPt(p[0],p[1],false);
  }
  if(g.moved){g.moved=false;liveDraw(g.st);}
}
document.addEventListener('pointerdown',function(e){
  if(mode!=='present')return;
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
  if(mode!=='present')return;
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
    if(hiddenSlide(i))cell.classList.add('off');
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
  if(dest!==cur)go(dest,dest>cur?1:-1,true,true);else{applyStep(cur,meta[cur].max);report();}
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
  else if(k==='ArrowRight')stepSel(1);else if(k==='ArrowLeft')stepSel(-1);
  else if(k==='ArrowDown')stepSel(cols);else if(k==='ArrowUp')stepSel(-cols);
  else if(k==='Home')selCell(shown(-1,1),true);else if(k==='End')selCell(shown(N,-1),true);
  else return;
  e.preventDefault();
}

/* ---------- keyboard ---------- */
addEventListener('keydown',function(e){
  if(layer&&mode==='edit'&&editKey(e))return;
  if(e.key==='F5'){e.preventDefault();keyUp(e);return;}
  var tg=e.target;if(tg&&((tg.tagName==='INPUT'&&tg.type!=='range'&&tg.type!=='checkbox')||tg.tagName==='TEXTAREA'||tg.isContentEditable))return;
  if(mode!=='present'){if(e.ctrlKey||e.altKey||(SORTER&&/^(Arrow|Page|Home|End)/.test(e.key)))e.preventDefault();keyUp(e);return;}
  if(e.ctrlKey&&(e.key==='z'||e.key==='Z')){e.preventDefault();if(!ovOpen){if(e.shiftKey)redo();else undo();}return;}
  if(e.ctrlKey&&(e.key==='y'||e.key==='Y')){e.preventDefault();if(!ovOpen)redo();return;}
  if(e.ctrlKey||e.altKey||e.metaKey){keyUp(e);return;}
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
  else if(k==='Home'){var a0=shown(-1,1);if(a0>=0)go(a0,-1,false);}
  else if(k==='End'){var z0=shown(N,-1);if(z0>=0)go(z0,1,false);}
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
  if(h)e.preventDefault();else keyUp(e);
});



/* ---------- whiteboard (endless, scrolls vertically) ---------- */
var wbEl=document.getElementById('wb'),wbg=document.getElementById('wbg'),wbbar=document.getElementById('wbbar'),wbBusy=false,inr=0,sraf=0,scrAnim=0;
var wbPat='dots',wbCol='white';
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
  if(a==='bgp'){wbPat=v;saveSettings();}
  else if(a==='bgc'){wbCol=v;saveSettings();}
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
  h+='<p class="nt">Everything here is saved on this device and shared by every presentation. Use Export / Import to carry it to another device.</p></div>';
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
/* a sandboxed page can't download or pick files, so the app does both with its own dialogs */
function exportSet(){send('exportToolbar',{text:JSON.stringify({v:1,ui:UIS,tools:CFG},null,2)});}
function importSet(){send('importToolbar',{});}
function importText(text){try{var o=JSON.parse(text);assign(UIS,o.ui);if(o.tools)for(var t in CFG)assign(CFG[t],o.tools[t]);applyAll();setBuild();toast('Settings imported',1400);}catch(x){toast('Not a settings file',1600);}}
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
function wbScrollTo(t,ms){if(REDUCED){setWy(t);return;}
  cancelAnimationFrame(scrAnim);cancelAnimationFrame(inr);
  var a=wy,b=Math.max(0,t),t0=performance.now();ms=ms||380;
  (function f(n){var k=Math.min(1,(n-t0)/ms),e=1-Math.pow(1-k,3);setWy(a+(b-a)*e);if(k<1)scrAnim=requestAnimationFrame(f);})(t0);
}
function inertia(v){if(REDUCED)return;
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
    setTimeout(function(){inkwrap.style.opacity='';if(wbOn)document.body.classList.add('wbfull');wbBusy=false;wbBar();},an?640:0);
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
applyTablet();
if(!SORTER){buildDock();setPos(UIS.pos);UI=true;renderDock();onFit();poke();armSink();}
var HINT='<b>Tap the logo</b> to open the toolbar &nbsp;·&nbsp; <b>Drag</b> it to move &nbsp;·&nbsp; <b>Right-click / long-press</b> for settings';
window.__ui={setWB:setWB,ink:ink,setTool:setTool,setAnnot:setAnnot,openOv:openOv,closeOv:closeOv,toggleDock:toggleDock,cfg:function(){return CFG;},uis:function(){return UIS;},
  state:function(){return {tool:tool,annot:annot,wb:wbOn,wy:wy,ov:ovOpen,cur:cur,step:meta[cur].step,max:meta[cur].max,open:dockOpen,vert:vert};}};

/* ---------- mini-LaTeX -> HTML (so slides can contain <span class="tex">\frac{a}{b}</span>) ---------- */
var TEXG={theta:'θ',phi:'φ',tau:'τ',mu:'μ',pi:'π',rho:'ρ',alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',eta:'η',lambda:'λ',nu:'ν',omega:'ω',sigma:'σ',
 Phi:'Φ',Omega:'Ω',Delta:'Δ',Sigma:'Σ',times:'×',cdot:'·',therefore:'∴',because:'∵',perp:'⟂',approx:'≈',propto:'∝',to:'→',rightarrow:'→',leftarrow:'←',
 Rightarrow:'⇒',leftrightarrow:'⇄',infty:'∞',pm:'±',ge:'≥',le:'≤',neq:'≠',deg:'°',circ:'°',downarrow:'↓',uparrow:'↑',gg:'≫',ll:'≪',micro:'µ',nabla:'∇',partial:'∂',sum:'∑'};
var TEXI='θφτμπρλνωσβγδεηα',TEXF={sin:1,cos:1,tan:1,log:1,ln:1,max:1,min:1,lim:1};
function texGrp(s,i){var d=0;for(var j=i;j<s.length;j++){if(s[j]==='{')d++;else if(s[j]==='}'){d--;if(!d)return [s.slice(i+1,j),j+1];}}throw new Error('unbalanced braces: '+s);}
function texConv(s,mode){
  var out='',i=0,c,j,a,g;mode=mode||'math';
  while(i<s.length){
    c=s[i];
    if(c==='\\'){
      j=i+1;
      if(/[a-zA-Z]/.test(s[j])){while(j<s.length&&/[a-zA-Z]/.test(s[j]))j++;}else j++;
      var name=s.slice(i+1,j);
      if(name==='frac'){a=texGrp(s,j);var b=texGrp(s,a[1]);out+='<span class="fr"><span class="n">'+texConv(a[0],mode)+'</span><span class="d">'+texConv(b[0],mode)+'</span></span>';j=b[1];}
      else if(name==='u'){a=texGrp(s,j);out+=texConv(a[0],'up');j=a[1];}
      else if(name==='sqrt'){a=texGrp(s,j);out+='√<span class="sq">'+texConv(a[0],mode)+'</span>';j=a[1];}
      else if(name===','||name===';')out+='<span style="display:inline-block;width:.18em"></span>';
      else if(name===' ')out+='&nbsp;';
      else if(TEXF[name])out+=name;
      else if(TEXG[name]){g=TEXG[name];out+=(TEXI.indexOf(g)>=0&&mode!=='up')?'<i>'+g+'</i>':g;}
      else out+='<span style="color:#d2463a">\\'+name+'</span>';
      i=j;
    }else if(c==='_'||c==='^'){
      i++;
      if(s[i]==='{'){a=texGrp(s,i);g=a[0];i=a[1];}
      else if(s[i]==='\\'){j=i+1;while(j<s.length&&/[a-zA-Z]/.test(s[j]))j++;g=s.slice(i,j);i=j;}
      else{g=s[i];i++;}
      var tg=c==='_'?'sub':'sup';
      out+='<'+tg+'>'+texConv(g,mode==='up'?'up':'sub')+'</'+tg+'>';
    }else if(c==='{'){a=texGrp(s,i);out+=texConv(a[0],mode);i=a[1];}
    else if(TEXI.indexOf(c)>=0){out+=mode==='up'?c:'<i>'+c+'</i>';i++;}
    else if(/[a-zA-Z]/.test(c)){
      j=i;while(j<s.length&&/[a-zA-Z]/.test(s[j]))j++;
      var w=s.slice(i,j);
      out+=(mode==='up'||TEXF[w]||(mode==='sub'&&w.length>1))?w:w.split('').map(function(ch){return '<i>'+ch+'</i>';}).join('');
      i=j;
    }
    else if(c==='-'){out+='−';i++;}
    else if(c==='<'){out+='&lt;';i++;}
    else if(c==='>'){out+='&gt;';i++;}
    else if(c==='&'){out+='&amp;';i++;}
    else{out+=c;i++;}
  }
  return out;
}
/* convert every <span class="tex">…</span> inside root (called at start-up and after the quiz renders) */
function texAll(root){
  var a=(root||document).querySelectorAll('.tex');
  for(var i=0;i<a.length;i++){var e=a[i];try{e.innerHTML=texConv(e.textContent);}catch(x){e.innerHTML='<span style="color:#d2463a">'+x.message+'</span>';}e.classList.remove('tex');e.classList.add('m');}
}
window.__tex=function(s){return '<span class="m">'+texConv(s)+'</span>';};
texAll(document);


/* ================= widgets ================= */
function initWidgets(slide){
  var ws=slide.querySelectorAll('[data-w]');
  for(var i=0;i<ws.length;i++){var n=ws[i].getAttribute('data-w');if(W[n])W[n](ws[i]);}
  var qs=slide.querySelectorAll('.quiz');for(var j=0;j<qs.length;j++)quiz(qs[j]);
}
function ns(tag,attrs){var e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(var k in attrs)e.setAttribute(k,attrs[k]);return e;}
function arrowHead(x,y,dir,s,fill){ // dir: 'u','d','l','r'
  s=s||14;var p;
  if(dir==='u')p=[x,y,x-s*.7,y+s*1.5,x+s*.7,y+s*1.5];
  else if(dir==='d')p=[x,y,x-s*.7,y-s*1.5,x+s*.7,y-s*1.5];
  else if(dir==='l')p=[x,y,x+s*1.5,y-s*.7,x+s*1.5,y+s*.7];
  else p=[x,y,x-s*1.5,y-s*.7,x-s*1.5,y+s*.7];
  return '<polygon points="'+p.join(' ')+'" fill="'+fill+'"/>';
}
function mi(t){return '<i style="font-family:var(--math)">'+t+'</i>';}

/* ---- demo widget: <div data-w="demo"></div> ---- */
W.demo=function(root){
  root.innerHTML='<div class="svgbox" style="padding:22px 30px">'+
   '<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lbl">Force F</span><b class="fv val">12 N</b></div><input type="range" class="sl f" min="1" max="40" step="1" value="12">'+
   '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px"><span class="lbl">Mass m</span><b class="mv val">3 kg</b></div><input type="range" class="sl m" min="1" max="20" step="1" value="3">'+
   '<div class="ctr" style="margin-top:14px;font-size:44px"><span class="out"></span></div>'+
   '<div style="height:22px;background:#e2f3f8;border-radius:11px;overflow:hidden;margin-top:12px"><div class="bar" style="height:100%;width:100%;background:#1a4fb4;transform-origin:left;transition:transform .35s"></div></div></div>';
  var f=root.querySelector('.f'),m=root.querySelector('.m');
  function upd(){
    var F=+f.value,M=+m.value,a=F/M;
    root.querySelector('.fv').textContent=F+' N';root.querySelector('.mv').textContent=M+' kg';
    root.querySelector('.out').innerHTML=__tex('a = \\frac{'+F+'}{'+M+'} = '+a.toFixed(2)+'\\ \\u{m/s^2}');
    root.querySelector('.bar').style.transform='scaleX('+Math.min(1,a/40)+')';
  }
  f.oninput=m.oninput=upd;upd();
};
/* ---- quiz ---- */
function quiz(root){
  var data=JSON.parse(root.querySelector('script').textContent),qi=0,score=0,done=false;
  var box=root.querySelector('.qbox');
  function render(){
    if(qi>=data.length){box.innerHTML='<div class="score">Score: '+score+' / '+data.length+(score===data.length?' 🎉':'')+'</div><div class="ctr"><button class="btn" data-r="1">Try again</button></div>';
      box.querySelector('[data-r]').onclick=function(){qi=0;score=0;render();};return;}
    var q=data[qi],h='<div class="qh"><span class="qn">QUICK CHECK · '+(qi+1)+' / '+data.length+'</span></div><div class="qt">'+q.q+'</div><div class="opts">';
    q.o.forEach(function(op,k){h+='<button class="op" data-k="'+k+'"><b>'+'ABCD'[k]+'</b><span>'+op+'</span></button>';});
    h+='</div><div class="fb"></div><div class="nx"><button class="btn" style="visibility:hidden">'+(qi+1<data.length?'Next ▸':'Finish ▸')+'</button></div>';
    box.innerHTML=h;texAll(box);done=false;
    var ops=box.querySelectorAll('.op'),fb=box.querySelector('.fb'),nb=box.querySelector('.nx .btn');
    Array.prototype.forEach.call(ops,function(b){b.addEventListener('click',function(){
      if(done)return;done=true;var k=+b.getAttribute('data-k');
      if(k===q.a){score++;b.classList.add('ok');}else{b.classList.add('no');ops[q.a].classList.add('ok');}
      Array.prototype.forEach.call(ops,function(x){if(!x.classList.contains('ok')&&!x.classList.contains('no'))x.classList.add('dim');});
      fb.innerHTML='<b class="or">'+(k===q.a?'Correct! ':'Not quite. ')+'</b>'+q.e;texAll(fb);fb.classList.add('on');
      nb.style.visibility='visible';
    });});
    nb.addEventListener('click',function(){qi++;render();});
  }
  render();
}

/* ================= glue: what connects this page to the app ================= */
var OS_REDUCED=REDUCED,hinted=false;
function send(type,payload){parent.postMessage({v:1,id:String(Date.now()),type:type,payload:payload},'*');}
function keyUp(e){send('key',{key:e.key,ctrl:e.ctrlKey,shift:e.shiftKey,alt:e.altKey||e.metaKey});}
function report(){var m=meta[cur];if(m)send('state',{slide:cur,step:m.step,steps:m.max,total:N});}
function hiddenSlide(i){return slides[i].getAttribute('data-hidden')==='true';}
/* the next slide in direction d that a show may stop on, or -1 */
function shown(i,d){for(var j=i+d;j>=0&&j<N;j+=d)if(!hiddenSlide(j))return j;return -1;}
function stepSel(d){
  var j=ovSel+d,one=d>0?1:-1;
  while(j>=0&&j<N&&hiddenSlide(j))j+=one;
  if(j>=0&&j<N)selCell(j,true);
}

/* widget code runs outside this closure, so what the template let it reach is made global */
window.ns=ns;window.arrowHead=arrowHead;window.mi=mi;window.texAll=texAll;window.texConv=texConv;window.$=$;

/* ---------- ink goes to the app by slide id, which survives reordering ---------- */
var inkDirty={},inkT=0;
function slideId(k){return k==='wb'?'wb':(slides[k]?slides[k].getAttribute('data-id'):null);}
function inkChanged(k){inkDirty[k]=1;clearTimeout(inkT);inkT=setTimeout(flushInk,300);}
function plain(a){return (a||[]).map(function(s){return {k:s.k,c:s.c,w:s.w,op:s.op,np:!!s.np,pts:s.pts};});}
function flushInk(){
  for(var k in inkDirty){var id=slideId(k);if(id)send('ink',{id:id,strokes:plain(ink[k])});}
  inkDirty={};
}
function indexOfId(id){if(id==='wb')return 'wb';for(var i=0;i<N;i++)if(slides[i].getAttribute('data-id')===id)return i;return -1;}
function setInk(all){
  for(var id in all){
    var k=indexOfId(id);if(k===-1)continue;
    ink[k]=all[id];
    if(SORTER&&cells[k]&&cells[k].done)paintThumbInk(k);
  }
  if(!SORTER&&cur>=0)inkRedraw();
  if(!SORTER)updActs();
}

/* Edit shows a slide whole and still. The show starts from nothing, like the template's first load. */
function preview(i){
  if(i!==cur){
    endText();
    var was=sel;sel=null;hov=null;
    go(i,i>cur?1:-1,true,true);
    if(was&&layer)send('picked',{slide:cur,n:-1,tag:''});
  }
  else{cancelAll();cleanup();applyStep(cur,meta[cur].max);report();}
  if(stepping>=0)stepView(0);
  drawEdit();
}
/* Steps in the edit view: the slide as it stands after that many clicks, animating for real */
var stepping=-1;
function stepView(k){
  stepping=k;
  var m=meta[cur];if(!m)return;
  document.body.classList.toggle('still',k<0||REDUCED);
  applyStep(cur,k<0?m.max:Math.min(k,m.max));
  report();
  setTimeout(drawEdit,0);
}
function closeOvNow(){
  if(!ovOpen)return;
  ov.classList.remove('show');ovOpen=false;ovBusy=false;
  document.body.classList.remove('ovanim','ovopen');
}
function leaveShow(){
  flushInk();closePops();closeOvNow();
  /* wbBusy: the board may still be opening, and closing it mustn't wait for that */
  if(wbOn){var r=REDUCED;REDUCED=true;wbBusy=false;setWB(false);REDUCED=r;}
  if(annot)setAnnot(false);
  /* the only button that shows hidden ink again is in the dock, which the edit view doesn't have */
  inkHidden=false;document.body.classList.remove('inkhide');renderDock();
  hideRing();
}
function setMode(p){
  endText();sel=null;hov=null;
  REDUCED=OS_REDUCED||p.reduced===true;
  loop=p.loop!==false;
  mode=p.mode==='present'?'present':'edit';
  document.body.classList.toggle('still',mode==='edit'||REDUCED);
  document.body.classList.toggle('editing',mode==='edit');
  document.body.classList.toggle('calm',REDUCED);
  var i=Math.max(0,Math.min(N-1,p.slide|0));
  if(mode==='edit'){leaveShow();preview(i);return;}
  if(hiddenSlide(i)){var a=shown(i,1);i=a>=0?a:shown(i,-1);}
  if(i<0)return;
  cancelAll();cleanup();clearTimeout(busy);
  if(cur>=0)slides[cur].classList.remove('show');
  cur=-1;
  go(i,1,false);
  poke();armSink();
  if(!hinted&&!UIS.hinted){hinted=UIS.hinted=true;saveSettings();setTimeout(function(){toast(HINT,5600);},900);}
}

/* New slides from the editor, in place, so the page keeps running and nothing flashes. */
function setSlides(p){
  flushInk();
  var was={};
  slides.forEach(function(s,i){was[s.getAttribute('data-id')]=i;s.remove();});
  cancelAll();cleanup();clearTimeout(busy);
  var t=document.createElement('template');t.innerHTML=p.html;
  slides=Array.prototype.slice.call(t.content.querySelectorAll('.slide'));
  slides.forEach(function(s){stage.appendChild(s);});
  if(!SORTER)stampAll();
  ed=null;sel=null;hov=null;
  N=slides.length;meta=makeMeta();cur=-1;window.__n=N;
  /* ink and its undo are kept by position here, so they have to move with their slides */
  var move=function(o){
    var n={};if(o.wb)n.wb=o.wb;
    slides.forEach(function(s,i){var w=was[s.getAttribute('data-id')];if(w!==undefined&&o[w])n[i]=o[w];});
    return n;
  };
  ink=move(ink);hist=move(hist);redoS=move(redoS);
  if(window.__ui)window.__ui.ink=ink;
  texAll(stage);
  relist=ov.contains(document.activeElement);
  cells=[];ov.innerHTML='';
  if(SORTER)sorterCells();
  else{
    preview(Math.max(0,Math.min(N-1,p.slide|0)));
    /* the selection stays on what was just typed */
    if(typeof p.pick==='number')reselect=p.pick;
    var again=reselect>=0&&slides[cur]?slides[cur].querySelector('[data-pw="'+reselect+'"]'):null;
    reselect=-1;
    /* also when there's nothing to pick again: what was picked may be gone, after an undo */
    pick(again);
  }
}

/* ---------- the slide list in the edit view: the same thumbnails as the grid, in a column ---------- */
var listFrom=0;
var relist=false; /* the list was rebuilt while it had focus, so it gets it back */
function sorterSelect(i,sel){
  /* focus moves with the selection only if it's already in the list: the big slide keeps its own */
  var inside=relist||ov.contains(document.activeElement);
  relist=false;
  selCell(i,inside);
  cells.forEach(function(c,k){
    c.el.tabIndex=k===ovSel?0:-1; /* one Tab stop for the whole list, not one per slide */
    if(k===ovSel)c.el.setAttribute('aria-current','true');else c.el.removeAttribute('aria-current');
    var on=!!sel&&sel.indexOf(k)>=0;
    c.el.classList.toggle('sel',on&&sel.length>1);
    c.el.setAttribute('aria-pressed',on?'true':'false');
  });
  if(cells[ovSel])cells[ovSel].el.scrollIntoView({block:'nearest'});
  /* the list following the slide isn't the user scrolling it */
  listFrom=ov.scrollTop;
}
function sorterLayout(){
  var first=cells[0];if(!first)return;
  var k=first.th.getBoundingClientRect().width/1920;
  cells.forEach(function(c){c.tin.style.transform='scale('+k+')';});
}
function sorterCells(){
  buildOvShell();
  cells.forEach(function(c,i){
    var n=document.createElement('span');n.className='num';n.textContent=i+1;
    if(hiddenSlide(i)){var h=document.createElement('b');h.textContent='Hidden';n.appendChild(h);}
    c.el.insertBefore(n,c.th);c.el.setAttribute('role','button');
    c.el.tabIndex=-1;c.tin.inert=true; /* a thumbnail's own buttons and sliders aren't real controls */
    var title=slides[i].getAttribute('data-title');
    c.el.setAttribute('aria-label','Slide '+(i+1)+(title?', '+title:'')+(hiddenSlide(i)?', hidden':''));
  });
  sorterLayout();
  /* built a few at a time, so a long presentation doesn't hold up the window */
  var i=0,mine=cells;
  (function build(){
    if(cells!==mine)return; /* new slides arrived meanwhile */
    var end=Math.min(N,i+12);
    for(;i<end;i++)buildThumb(i);
    if(i<N)(window.requestIdleCallback||function(f){setTimeout(f,60);})(build,{timeout:300});
  })();
}
function bootSorter(){
  document.documentElement.classList.add('sorter');
  stage.setAttribute('aria-hidden','true');
  ov.classList.add('show');
  sorterCells();
  /* a size change, not only a window resize: the scroll bar appears once the list fills up */
  new ResizeObserver(sorterLayout).observe(ov);
  /* the toolbar under the slide shrinks going down the list and comes back going up, past 40px as Google's does */
  ov.addEventListener('scroll',function(){
    var y=ov.scrollTop;
    if(Math.abs(y-listFrom)<40)return;
    send('scrolled',{down:y>listFrom});listFrom=y;
  },{passive:true});
  var cellOf=function(t){return t&&t.closest?t.closest('.cell'):null;},indexOf=function(c){return +c.getAttribute('data-i');};
  var drag=null,dropTo=-1,dragged=false;
  var clearDrop=function(){cells.forEach(function(c){c.el.classList.remove('dropb','dropa');});};
  ov.addEventListener('click',function(e){
    var c=cellOf(e.target);if(!c)return;
    e.stopPropagation();
    if(dragged){dragged=false;return;}
    send('pick',{slide:indexOf(c),ctrl:e.ctrlKey,shift:e.shiftKey});
  },true);
  ov.addEventListener('keydown',function(e){
    var c=cellOf(e.target);
    if(!c||(e.key!=='Enter'&&e.key!==' '))return;
    e.preventDefault();e.stopPropagation();send('pick',{slide:indexOf(c),ctrl:e.ctrlKey,shift:e.shiftKey});
  },true);
  ov.addEventListener('contextmenu',function(e){
    var c=cellOf(e.target);if(c)send('menu',{slide:indexOf(c),x:e.clientX,y:e.clientY});
  });
  ov.addEventListener('pointerdown',function(e){
    var c=cellOf(e.target);
    if(c&&e.button===0)drag={id:e.pointerId,i:indexOf(c),y:e.clientY,on:false};
  });
  ov.addEventListener('pointermove',function(e){
    if(!drag||e.pointerId!==drag.id)return;
    if(!drag.on){
      if(Math.abs(e.clientY-drag.y)<6)return;
      drag.on=true;dropTo=-1;
      try{ov.setPointerCapture(e.pointerId);}catch(x){}
    }
    var c=cellOf(document.elementFromPoint(e.clientX,e.clientY));
    if(c){
      var r=c.getBoundingClientRect(),after=e.clientY>r.top+r.height/2;
      clearDrop();c.classList.add(after?'dropa':'dropb');dropTo=indexOf(c)+(after?1:0);
    }
    if(e.clientY<36)ov.scrollTop-=14;else if(e.clientY>innerHeight-36)ov.scrollTop+=14;
  });
  var endDrag=function(e){
    if(!drag||e.pointerId!==drag.id)return;
    var d=drag;drag=null;
    if(!d.on)return;
    dragged=true;clearDrop();
    if(e.type==='pointerup'&&dropTo>=0)send('move',{slide:d.i,to:dropTo});
    setTimeout(function(){dragged=false;},300);
  };
  ov.addEventListener('pointerup',endDrag);
  ov.addEventListener('pointercancel',endDrag);
}

/* Browser tooltips give away a web page, so titles become our own chip, which grows out of the tool it names. */
var tipEl=document.createElement('div'),tipT,tipWarm=0;
tipEl.id='tip';document.body.appendChild(tipEl);
function tipOff(){clearTimeout(tipT);if(tipEl.classList.contains('on'))tipWarm=Date.now();tipEl.classList.remove('on');}
function tipAt(t){
  /* starts over at the new tool at once, or it would travel across from the last one */
  tipEl.style.transition='none';tipEl.classList.remove('on');
  tipEl.textContent=t.getAttribute('data-tip');
  var r=t.getBoundingClientRect(),w=tipEl.offsetWidth,h=tipEl.offsetHeight,cx=r.left+r.width/2,cy=r.top+r.height/2,x,y,ox,oy;
  if(document.getElementById('dock').classList.contains('vert')){
    var right=cx<innerWidth/2;
    x=right?r.right+8:r.left-w-8;y=cy-h/2;ox=right?r.right:r.left;oy=cy;
  }else{
    var up=r.top-h-8>=4;
    x=cx-w/2;y=up?r.top-h-8:r.bottom+8;ox=cx;oy=up?r.top:r.bottom;
  }
  x=Math.round(Math.max(4,Math.min(innerWidth-w-4,x)));y=Math.round(Math.max(4,Math.min(innerHeight-h-4,y)));
  tipEl.style.left=x+'px';tipEl.style.top=y+'px';
  tipEl.style.transformOrigin=Math.round(ox-x)+'px '+Math.round(oy-y)+'px';
  void tipEl.offsetWidth;
  tipEl.style.transition='';tipEl.classList.add('on');
}
document.addEventListener('pointerover',function(e){
  var t=e.target&&e.target.closest?e.target.closest('[title],[data-tip]'):null;
  tipOff();
  if(!t)return;
  if(t.hasAttribute('title')){t.setAttribute('data-tip',t.title);t.removeAttribute('title');}
  /* once one is showing, the next tool's comes up straight away */
  if(e.pointerType==='mouse')tipT=setTimeout(function(){tipAt(t);},Date.now()-tipWarm<400?0:120);
},true);
document.addEventListener('pointerdown',tipOff,true);

/* ---------- selecting and typing on the slide: the edit view only, never during a show ---------- */
/*
  Every element gets a number here, before anything changes the page. The app counts the elements of
  its own clean copy the same way, so an edit can name an element without sending the running page's
  word wrappers, step classes and drawn formulas back into the file.
*/
var KINDS=[['.cols','Columns'],['.quiz','Quiz'],['.card','Card'],['ul,ol','List'],['li','Bullet'],['.fbox','Formula'],['.m,.tex','Formula'],
  ['table','Table'],['td,th','Cell'],['.svgbox','Diagram'],['img','Image'],['.ex','Worked example'],
  ['h1,h2','Title'],['h3,h4','Heading'],['.cap','Caption'],['.toc','Contents'],['p','Text']];
var STYLES=['soft','key','note','tips','vio'];
var layer=null,hovBox=null,selBox=null,selTag=null,hov=null,sel=null,ed=null,holdFocus=false,reselect=-1,chip=null,barFrame=0;
function stampAll(){
  slides.forEach(function(s){
    [s].concat(Array.prototype.slice.call(s.querySelectorAll('*'))).forEach(function(e,n){e.setAttribute('data-pw',n);});
    s._src=s.cloneNode(true);
  });
}
function stampOf(e){return e.hasAttribute('data-pw')?+e.getAttribute('data-pw'):-1;}
function srcOf(e){
  var n=stampOf(e),s=e.closest('.slide');
  if(!s||!s._src||n<0)return null;
  return n===0?s._src:s._src.querySelector('[data-pw="'+n+'"]');
}
/* in the clean copy: the running page has moved every word of the text into a span of its own */
function ownText(e){
  var o=srcOf(e);if(!o)return false;
  for(var c=o.firstChild;c;c=c.nextSibling)if(c.nodeType===3&&c.nodeValue.trim())return true;
  return false;
}
function kindOf(e){
  for(var i=0;i<KINDS.length;i++)if(e.matches(KINDS[i][0]))return KINDS[i][1];
  if(!ownText(e))return '';
  /* a word in a sentence belongs to the sentence; a label on its own is text in its own right */
  var up=e.parentElement;
  return getComputedStyle(e).display!=='inline'||!up||!ownText(up)?'Text':'';
}
/* a widget's own drawing has no numbers, so what's numbered in one is what the author wrote */
function pickable(e){return !e.parentElement.closest('svg,.m,.quiz')&&!!kindOf(e);}
function chainOf(t){
  var s=slides[cur],c=[];
  if(!s||!t||!s.contains(t)||t===s)return c;
  for(var e=t;e&&e!==s;e=e.parentElement)if(stampOf(e)>=0&&pickable(e))c.unshift(e);
  return c;
}
function nextIn(c){
  var i=c.indexOf(sel);
  if(i>=0)return c[Math.min(i+1,c.length-1)];
  return c.filter(function(e){return !e.matches('.cols');})[0]||c[0];
}
function textIn(e){return e.matches('h1,h2,h3,h4,p,li,td,th')||(ownText(e)&&!e.matches('.m,.tex,ul,ol'));}
function tagOf(e){
  var k=kindOf(e),a=STYLES.filter(function(c){return e.classList.contains(c);})[0];
  return a?k+' · '+a[0].toUpperCase()+a.slice(1):k;
}
function place(node,r,pad){
  node.style.left=(r.left-pad)+'px';node.style.top=(r.top-pad)+'px';
  node.style.width=(r.width+pad*2)+'px';node.style.height=(r.height+pad*2)+'px';
}
function drawSteps(){
  Array.prototype.slice.call(layer.querySelectorAll('.sn')).forEach(function(n){n.remove();});
  var m=meta[cur],last=0;if(!m)return;
  m.els.forEach(function(e){
    if(e._k===last)return;
    var r=e.getBoundingClientRect();if(!r.width)return;
    last=e._k;
    var n=document.createElement('span');n.className='sn';n.textContent=e._k;
    n.style.left=r.left+'px';n.style.top=r.top+'px';layer.appendChild(n);
  });
}
function drawEdit(){
  if(!layer||mode!=='edit')return;
  drawSteps();
  hovBox.classList.toggle('on',!!hov&&hov!==sel&&!ed);
  if(hov&&hov!==sel)place(hovBox,hov.getBoundingClientRect(),2);
  selBox.classList.toggle('on',!!sel);
  if(sel){
    place(selBox,sel.getBoundingClientRect(),4);
    selTag.textContent=tagOf(sel);
  }
}
function pick(e){
  sel=e;hov=null;drawEdit();
  send('picked',e?{slide:cur,n:stampOf(e),tag:e.tagName,crumbs:chainOf(e).map(function(x){return {n:stampOf(x),label:tagOf(x)};})}:{slide:cur,n:-1,tag:''});
}
function comps(){
  var s=slides[cur];if(!s)return [];
  return Array.prototype.slice.call(s.querySelectorAll('[data-pw]')).filter(function(e){return pickable(e)&&!e.matches('.cols');});
}
function buildLayer(){
  layer=document.createElement('div');layer.id='edit';
  layer.innerHTML='<i class="eh"></i><i class="es"><b class="et"></b></i>';
  document.body.appendChild(layer);
  hovBox=layer.querySelector('.eh');selBox=layer.querySelector('.es');selTag=layer.querySelector('.et');
  addEventListener('resize',drawEdit);
  document.addEventListener('pointermove',function(e){
    if(mode!=='edit'||ed)return;
    var c=chainOf(e.target),h=c.length?nextIn(c):null;
    if(h!==hov){hov=h;drawEdit();}
  },true);
  document.addEventListener('pointerdown',function(e){
    if(ed&&!ed.root.contains(e.target))endText();
  },true);
  document.addEventListener('click',function(e){
    if(mode!=='edit')return;
    if(ed&&ed.root.contains(e.target)){
      var f=e.target.closest('[data-src]');
      if(f&&ed.root.contains(f))openFormula(f);
      return;
    }
    /* a slide's own buttons and sliders are for the show */
    e.preventDefault();e.stopPropagation();
    var c=chainOf(e.target);
    pick(c.length?nextIn(c):null);
  },true);
  document.addEventListener('dblclick',function(e){
    if(mode!=='edit'||ed)return;
    var t=e.target,f=t.closest('.m');
    if(f&&stampOf(f)>=0&&f.parentElement&&stampOf(f.parentElement)>=0){
      var mark=stampOf(f);
      beginText(f.parentElement);
      var again=ed&&ed.root.querySelector('[data-pw="'+mark+'"]');
      if(again)openFormula(again);
      return;
    }
    var label=t.closest('svg text');
    if(label&&stampOf(label)>=0){beginLabel(label);return;}
    var c=chainOf(t).filter(textIn);
    if(c.length)beginText(c[c.length-1],e.clientX,e.clientY);
  },true);
  document.addEventListener('selectionchange',barSoon);
  document.addEventListener('paste',function(e){
    if(!ed)return;
    e.preventDefault();
    var t=(e.clipboardData.getData('text/plain')||'').replace(/\s*\n\s*/g,' ');
    if(t)document.execCommand('insertText',false,t);
  },true);
  document.addEventListener('drop',function(e){if(ed)e.preventDefault();},true);
  addEventListener('blur',function(){if(ed&&!holdFocus)endText();});
}

/* one element at a time becomes typeable. A bullet brings its whole list, so Enter can add another */
function toChip(t){
  t.setAttribute('data-src',t.textContent);t.classList.remove('tex');t.classList.add('m');
  t.setAttribute('contenteditable','false');drawChip(t);
}
function drawChip(t){
  try{t.innerHTML=texConv(t.getAttribute('data-src'))||'&#8203;';}catch(x){t.textContent=t.getAttribute('data-src');}
}
function cleanHtml(root){
  var c=root.cloneNode(true);
  Array.prototype.slice.call(c.querySelectorAll('[data-src]')).forEach(function(t){
    var s=document.createElement('span');s.className='tex';s.textContent=t.getAttribute('data-src');t.replaceWith(s);
  });
  Array.prototype.slice.call(c.querySelectorAll('*')).forEach(function(e){
    e.removeAttribute('data-pw');e.removeAttribute('contenteditable');
    e.classList.remove('on');if(!e.getAttribute('class'))e.removeAttribute('class');
  });
  return c.innerHTML.replace(/&nbsp;/g,' ');
}
function caretAt(root,x,y){
  var s=getSelection(),r=x!==undefined&&document.caretRangeFromPoint?document.caretRangeFromPoint(x,y):null;
  if(!r||!root.contains(r.startContainer)){r=document.createRange();r.selectNodeContents(root);r.collapse(false);}
  s.removeAllRanges();s.addRange(r);
}
function beginText(e,x,y){
  var up=e.parentElement,root=e.matches('li')&&up&&stampOf(up)>=0?up:e,n=stampOf(root);
  var from=n===0?slides[cur]._src:slides[cur]._src.querySelector('[data-pw="'+n+'"]');
  if(!from)return;
  var kids=Array.prototype.slice.call(root.childNodes);
  root.innerHTML=from.innerHTML;
  Array.prototype.slice.call(root.querySelectorAll('.st')).forEach(function(i){i.classList.add('on');});
  Array.prototype.slice.call(root.querySelectorAll('.tex')).forEach(toChip);
  root.setAttribute('contenteditable','true');root.spellcheck=false;
  ed={root:root,n:n,tag:root.tagName,kids:kids,before:cleanHtml(root)};
  document.body.classList.add('typing');
  sel=e===root?root:e;hov=null;
  root.focus();caretAt(root,x,y);
  drawEdit();barSoon();
}
/* words in a drawing can't take a caret, so they're typed in the app's field and appear live */
function beginLabel(t){
  ed={root:t,n:stampOf(t),tag:t.tagName,kids:Array.prototype.slice.call(t.childNodes),before:cleanHtml(t),label:true};
  chip=t;holdFocus=true;sel=null;hov=null;
  drawEdit();barSoon();
  send('formula',{src:t.textContent});
}
function endText(){
  if(!ed)return;
  var d=ed;ed=null;holdFocus=false;chip=null;
  document.body.classList.remove('typing');
  d.root.removeAttribute('contenteditable');
  getSelection().removeAllRanges();
  send('textbar',{open:false});
  var html=cleanHtml(d.root);
  if(html===d.before){
    /* nothing changed, so the running page gets back its own elements and no undo step is made */
    d.root.textContent='';d.kids.forEach(function(k){d.root.appendChild(k);});
    pick(d.root);return;
  }
  reselect=d.n;
  send('text',{slide:cur,n:d.n,tag:d.tag,html:html});
}
function near(q){
  var a=getSelection().anchorNode,e=a&&(a.nodeType===1?a:a.parentElement),f=e&&e.closest(q);
  return f&&ed&&ed.root.contains(f)&&f!==ed.root?f:null;
}
function barSoon(){
  if(!ed)return;
  cancelAnimationFrame(barFrame);
  barFrame=requestAnimationFrame(function(){
    if(!ed)return;
    var s=getSelection(),r=s.rangeCount&&!s.isCollapsed?s.getRangeAt(0).getBoundingClientRect():ed.root.getBoundingClientRect();
    drawEdit();
    send('textbar',{open:true,x:r.left,y:r.top,w:r.width,h:r.height,bold:!!near('b:not(.or)'),
      italic:!!near('i'),orange:!!near('b.or'),teal:!!near('.tl'),muted:!!near('.mut')});
  });
}
function unwrap(e){while(e.firstChild)e.parentNode.insertBefore(e.firstChild,e);e.remove();}
function wrapWith(q,tag,cls){
  var on=near(q),s=getSelection();
  if(on){
    /* the text stays selected, ready for the next button */
    var a=on.firstChild,z=on.lastChild,back=document.createRange();
    unwrap(on);
    if(a){back.setStartBefore(a);back.setEndAfter(z);s.removeAllRanges();s.addRange(back);}
    return;
  }
  if(!s.rangeCount||s.isCollapsed)return;
  var r=s.getRangeAt(0),w=document.createElement(tag);w.className=cls;
  w.appendChild(r.extractContents());r.insertNode(w);
  r.selectNodeContents(w);s.removeAllRanges();s.addRange(r);
}
/* with nothing selected, a colour goes on the whole of what's being typed */
function paint(hex){
  if(!/^#[0-9a-f]{6}$/i.test(hex))return;
  var s=getSelection();
  if(!near('span[style]')&&(!s.rangeCount||s.isCollapsed||!ed.root.contains(s.anchorNode))){
    var all=document.createRange();all.selectNodeContents(ed.root);s.removeAllRanges();s.addRange(all);
  }
  var on=near('span[style]');
  if(on)on.style.color=hex;
  else{
    var r=s.getRangeAt(0),w=document.createElement('span');w.style.color=hex;
    w.appendChild(r.extractContents());r.insertNode(w);
    r.selectNodeContents(w);s.removeAllRanges();s.addRange(r);
  }
  barSoon();
}
function format(c,v){
  if(!ed||ed.label)return;
  ed.root.focus();
  /* not the browser's bold: in a title, already heavy, that would turn it off with a style */
  if(c==='bold')wrapWith('b:not(.or)','b','');
  else if(c==='italic')wrapWith('i','i','');
  else if(c==='color'){paint(v);return;}
  else if(c==='orange')wrapWith('b.or','b','or');
  else if(c==='teal')wrapWith('.tl','span','tl');
  else if(c==='muted')wrapWith('.mut','span','mut');
  else if(c==='clear'){
    var s=getSelection(),r=s.rangeCount?s.getRangeAt(0):null;
    if(r)Array.prototype.slice.call(ed.root.querySelectorAll('b,i,.tl,.mut,span[style]')).forEach(function(e){if(r.intersectsNode(e))unwrap(e);});
    ed.root.normalize();
  }
  else if(c==='formula'){
    var f=document.createElement('span');f.setAttribute('data-src','');f.className='m';f.setAttribute('contenteditable','false');
    var g=getSelection();if(!g.rangeCount)caretAt(ed.root);
    var q=g.getRangeAt(0);q.deleteContents();q.insertNode(f);
    openFormula(f);return;
  }
  barSoon();
}
function openFormula(f){chip=f;holdFocus=true;send('formula',{src:f.getAttribute('data-src')});}
function formulaDone(){
  if(!ed||!chip)return;
  if(ed.label){endText();return;}
  var r=document.createRange(),s=getSelection(),gone=!chip.getAttribute('data-src');
  if(gone){r.setStartBefore(chip);chip.remove();}else r.setStartAfter(chip);
  r.collapse(true);chip=null;holdFocus=false;
  ed.root.focus();s.removeAllRanges();s.addRange(r);barSoon();
}
function bulletKey(e){
  var a=getSelection().anchorNode,li=a&&(a.nodeType===1?a:a.parentElement).closest('li');
  if(!li||!ed.root.contains(li))return false;
  if(e.key==='Backspace'&&!li.textContent.trim()&&!li.querySelector('[data-src]')&&ed.root.children.length>1){
    e.preventDefault();
    var p=li.previousElementSibling||li.nextElementSibling;li.remove();caretAt(p);return true;
  }
  if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){
    e.preventDefault();e.stopPropagation();
    var o=e.key==='ArrowUp'?li.previousElementSibling:li.nextElementSibling;
    if(o){if(e.key==='ArrowUp')ed.root.insertBefore(li,o);else ed.root.insertBefore(o,li);caretAt(li);barSoon();}
    return true;
  }
  return false;
}
function editKey(e){
  var k=e.key;
  if(ed){
    if(k==='Escape'||k==='Tab'){e.preventDefault();e.stopPropagation();endText();return true;}
    if(e.ctrlKey&&/^[bi]$/i.test(k)){e.preventDefault();format(/b/i.test(k)?'bold':'italic');return true;}
    if(ed.root.matches('ul,ol')){if(bulletKey(e))return true;}
    else if(k==='Enter'){
      e.preventDefault();e.stopPropagation();
      if(e.shiftKey)document.execCommand('insertLineBreak');else endText();
      return true;
    }
    /* the app's own shortcuts finish the typing first, so Save saves what was just typed */
    if(k==='F5'||(e.ctrlKey&&/^[se]$/i.test(k)))endText();
    return false;
  }
  if(k==='Tab'){
    var all=comps(),i=all.indexOf(sel)+(e.shiftKey?-1:1);
    if(sel===null&&e.shiftKey)i=all.length-1;
    /* past either end the keyboard moves on, out of the slide */
    if(i<0||i>=all.length){if(sel)pick(null);return false;}
    e.preventDefault();pick(all[i]);return true;
  }
  if(!sel)return false;
  if(k==='Escape'){
    e.preventDefault();
    var c=chainOf(sel),at=c.indexOf(sel);
    pick(at>0?c[at-1]:null);return true;
  }
  if(k==='Enter'){
    e.preventDefault();
    if(textIn(sel))beginText(sel);
    else{var under=comps().filter(function(x){return sel.contains(x)&&x!==sel;})[0];if(under)pick(under);}
    return true;
  }
  /* Delete would take the whole slide; the selected thing is what the user is looking at */
  if(k==='Delete'||k==='Backspace'){
    e.preventDefault();
    if(k==='Delete'&&sel.matches('li,tr,.toc .c')){send('removePicked',{slide:cur,n:stampOf(sel),tag:sel.tagName});pick(null);}
    return true;
  }
  return false;
}

function isHex(v){return /^#[0-9a-f]{6}$/i.test(v);}
function setVar(name,v){if(isHex(v))document.documentElement.style.setProperty(name,v);}
addEventListener('message',function(e){
  if(e.source!==parent||!e.data||e.data.v!==1)return;
  var p=e.data.payload||{};
  switch(e.data.type){
    case 'mode':setMode(p);break;
    case 'go':if(mode==='edit')preview(Math.max(0,Math.min(N-1,p.slide|0)));break;
    case 'pick':{
      var live=p.n>=0&&slides[cur]?slides[cur].querySelector('[data-pw="'+(p.n|0)+'"]'):null;
      pick(live);break;
    }
    case 'preview':{
      var view=slides[cur]&&slides[cur].querySelector('[data-pw="'+(p.n|0)+'"]');
      if(!view)break;
      if(typeof p.tex==='string'){try{view.innerHTML=texConv(p.tex);}catch(x){}}
      if(typeof p.prop==='string'&&/^--[a-z-]+$/.test(p.prop)&&typeof p.value==='string'){
        if(p.prop==='--pw-svg'){var box=view.querySelector('svg');if(box)box.style.height=p.value;}
        else view.style.setProperty(p.prop,p.value);
      }
      drawEdit();break;
    }
    case 'stepView':stepView(p.on?p.step|0:-1);break;
    case 'format':format(String(p.cmd),String(p.value||''));break;
    case 'hold':holdFocus=!!p.on;if(!holdFocus&&ed&&!ed.label)ed.root.focus();break;
    case 'formulaSrc':
      if(chip&&typeof p.src==='string'){
        if(ed&&ed.label)chip.textContent=p.src;
        else{chip.setAttribute('data-src',p.src);drawChip(chip);}
        barSoon();
      }
      break;
    case 'formulaDone':formulaDone();break;
    case 'key':
      if(p.key)window.dispatchEvent(new KeyboardEvent('keydown',{key:p.key,shiftKey:!!p.shift,ctrlKey:!!p.ctrl,altKey:!!p.alt,bubbles:true,cancelable:true}));
      break;
    case 'select':if(SORTER)sorterSelect(p.slide|0,p.selected);break;
    case 'focusList':if(SORTER&&cells[ovSel])cells[ovSel].el.focus();break;
    case 'slides':if(typeof p.html==='string')setSlides(p);break;
    case 'ink':setInk(p.slides||{});break;
    case 'toolbar':
      /* saved settings from the app. fixAll inside applyAll checks every value, as the template does */
      if(p.ui)assign(UIS,p.ui);
      if(p.tools)for(var t in CFG)assign(CFG[t],p.tools[t]);
      if(p.wb){if(p.wb.p)wbPat=p.wb.p;if(p.wb.c)wbCol=p.wb.c;}
      /* the template read these before it first drew the dock; here they arrive just after */
      if(!SORTER){dockOpen=UIS.open;applyAll();}
      break;
    case 'toolbarFile':importText(p.text);break;
    case 'logo':{
      var l=document.querySelector('#logo .lg');
      if(l&&typeof p.svg==='string'){
        l.innerHTML=p.svg;
        /* engine.css sets these on every logo, which would fill in a logo drawn with lines */
        var root=l.querySelector('svg');
        if(root)['fill','stroke'].forEach(function(a){var v=root.getAttribute(a);if(v)root.style[a]=v;});
      }
      setVar('--pw-dock-accent',p.color);setVar('--pw-dock-on',p.background);setVar('--acc',p.color);break;
    }
    case 'chrome':
      setVar('--pw-accent',p.accent);setVar('--pw-text',p.text);setVar('--pw-line',p.line);setVar('--pw-muted',p.muted);setVar('--pw-on-accent',p.onAccent);
      /* a see-through page must match the app, or the browser paints it white */
      if(SORTER&&(p.scheme==='dark'||p.scheme==='light'))document.documentElement.style.colorScheme=p.scheme;
      break;
  }
});

texAll(document);
document.body.classList.add('still','editing');
/* load, not now: widgets.js comes after this file, and a slide's widgets start on first show */
addEventListener('load',function(){
  if(SORTER)bootSorter();else buildLayer();
  send('ready',{total:N});
});

})();
