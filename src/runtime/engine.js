/*
  The slide engine, ported from the owner's template (reference/lop-deck/deck-template.html). The steps,
  Morph, background, maths, widgets, quiz and overview grid below are that code, copied, not rewritten.
  Only the joins changed: the dock, ink and whiteboard live in the app, not here, and "glue" at the
  bottom talks to it. Everything on this page is untrusted to the app: deck code shares it (see bridge.ts).
*/
var W = {};
(function () {
"use strict";
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
function texAll(root){
  var a=(root||document).querySelectorAll('.tex');
  for(var i=0;i<a.length;i++){var e=a[i];try{e.innerHTML=texConv(e.textContent);}catch(x){e.innerHTML='<span style="color:#d2463a">'+x.message+'</span>';}e.classList.remove('tex');e.classList.add('m');}
}

/* ================= engine: stage, steps, background, Morph ================= */
var stage=document.getElementById('stage');
var slides=Array.prototype.slice.call(stage.querySelectorAll('.slide'));
var N=slides.length, cur=-1, busy=null, anims=[], hidden=[], scaleF=1;
var REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
var EASE='cubic-bezier(.65,0,.25,1)', OUT='cubic-bezier(.2,.85,.25,1)';
var meta=slides.map(function(s){
  var els=Array.prototype.slice.call(s.querySelectorAll('.st')),k=0;
  els.forEach(function(e){var a=e.getAttribute('data-st'); if(a==='='){} else k++; e._k=k;});
  return {els:els,max:k,step:0,init:false};
});
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

/* ================= overview grid ================= */
var ov=document.getElementById('ov');
var ovOpen=false,ovBusy=false,cells=[],ovSel=0,ovVis={};
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
  ov.innerHTML='<div class="bk"></div><div class="bar"><h3>All slides<span>Tap a slide to open it</span></h3><button data-ov="x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="grid"></div>';
  var g=ov.querySelector('.grid');
  slides.forEach(function(s,i){
    var cell=document.createElement('div');cell.className='cell';cell.tabIndex=0;cell.setAttribute('data-i',i);
    cell.innerHTML='<div class="th"><div class="tin"></div></div><div class="lb"><i>'+(i+1)+'</i>'+(s.getAttribute('data-title')||'')+'</div>';
    g.appendChild(cell);cells[i]={el:cell,th:cell.firstChild,tin:cell.firstChild.firstChild,done:false,html:''};
    if(hiddenSlide(i))cell.classList.add('off');
  });
}
function buildThumb(i){
  var c=cells[i];if(c.done)return;
  c.html=snapHTML(i);c.tin.innerHTML=c.html;c.done=true;
}
/* when the grid opens: a slide you have been on may have changed (a slider moved, a quiz answered) — re-snapshot it */
function refreshThumb(i){
  var c=cells[i];
  if(!c.done){buildThumb(i);return;}
  if(ovVis[i]||i===cur){var h=snapHTML(i);if(h!==c.html){c.html=h;c.tin.innerHTML=h;}}
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
  if(ovOpen||ovBusy)return;
  var B=document.body;
  cancelAll();cleanup();B.classList.add('notr');applyStep(cur,meta[cur].max);
  setTimeout(function(){B.classList.remove('notr');},160);
  if(!cells.length)buildOvShell();
  for(var i=0;i<N;i++)refreshThumb(i);
  ovOpen=true;layoutOv();selCell(cur);
  B.classList.add('ovanim');send('grid',{open:true});
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
    send('grid',{open:false});
  }
  if(REDUCED){B.classList.remove('ovopen');fin();return;}
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    var tr=th.getBoundingClientRect(),sr=stage.getBoundingClientRect();
    B.classList.remove('ovopen');
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
var INTER='input,button,select,textarea,a,.op,.btn,.wsel,[data-r],[data-a]';
var OS_REDUCED=REDUCED,mode='boot',loop=true,tG=null,swallowUntil=0,penSeen=0;
/* tablet mode is on by default in the template, and it sizes the widgets' sliders. Its setting comes with the dock */
document.documentElement.classList.add('tab');
var SORTER=location.search.indexOf('view=sorter')>=0;

/* widget code runs outside this closure, so what the template let it reach is made global */
window.ns=ns;window.arrowHead=arrowHead;window.mi=mi;window.texAll=texAll;window.texConv=texConv;window.$=$;

function send(type,payload){parent.postMessage({v:1,id:String(Date.now()),type:type,payload:payload},'*');}
function report(){var m=meta[cur];if(m)send('state',{slide:cur,step:m.step,steps:m.max,total:N});}
function hiddenSlide(i){return slides[i].getAttribute('data-hidden')==='true';}
/* the next slide in direction d that a show may stop on, or -1 */
function shown(i,d){for(var j=i+d;j>=0&&j<N;j+=d)if(!hiddenSlide(j))return j;return -1;}
function stepSel(d){
  var j=ovSel+d,one=d>0?1:-1;
  while(j>=0&&j<N&&hiddenSlide(j))j+=one;
  if(j>=0&&j<N)selCell(j,true);
}

/* Edit shows a slide whole and still. The show starts from nothing, like the template's first load. */
function preview(i){
  if(i!==cur)go(i,i>cur?1:-1,true,true);
  else{cancelAll();cleanup();applyStep(cur,meta[cur].max);report();}
}
function closeOvNow(){
  if(!ovOpen)return;
  ov.classList.remove('show');ovOpen=false;ovBusy=false;
  document.body.classList.remove('ovanim','ovopen');
  send('grid',{open:false});
}
function setMode(p){
  REDUCED=OS_REDUCED||p.reduced===true;
  loop=p.loop!==false;
  mode=p.mode==='present'?'present':'edit';
  document.body.classList.toggle('still',mode==='edit'||REDUCED);
  var i=Math.max(0,Math.min(N-1,p.slide|0));
  closeOvNow();
  if(mode==='edit'){preview(i);return;}
  if(hiddenSlide(i)){var a=shown(i,1);i=a>=0?a:shown(i,-1);}
  if(i<0)return;
  cancelAll();cleanup();clearTimeout(busy);
  if(cur>=0)slides[cur].classList.remove('show');
  cur=-1;
  go(i,1,false);
}

/* ---------- keyboard: same keys as the template. What isn't a slide key goes up to the app ---------- */
function keyUp(e){send('key',{key:e.key,ctrl:e.ctrlKey,shift:e.shiftKey,alt:e.altKey||e.metaKey});}
function onKey(e){
  if(e.key==='F5')e.preventDefault();
  if(e.ctrlKey||e.altKey||e.metaKey||mode!=='present'){keyUp(e);return;}
  if(ovOpen){ovKey(e);return;}
  var k=e.key,h=true;
  if(k==='ArrowRight'||k==='ArrowDown'||k==='PageDown'||k===' '||k==='Enter')next();
  else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'||k==='Backspace')prev();
  else if(k==='Home'){var a=shown(-1,1);if(a>=0)go(a,-1,false);}
  else if(k==='End'){var z=shown(N,-1);if(z>=0)go(z,1,false);}
  else if(k==='g'||k==='G')openOv();
  else{h=false;keyUp(e);}
  if(h&&e.preventDefault)e.preventDefault();
}
addEventListener('keydown',function(e){
  var tg=e.target;if(tg&&((tg.tagName==='INPUT'&&tg.type!=='range'&&tg.type!=='checkbox')||tg.tagName==='TEXTAREA'||tg.isContentEditable))return;
  if(tg&&tg.tagName==='INPUT'&&tg.type==='range'&&/^Arrow/.test(e.key))return;
  onKey(e);
});

/* ---------- pointer: click and swipe, as in the template. Ink comes with the dock, in the app ---------- */
function isInter(t){return !!(t&&t.closest&&t.closest(INTER));}
function inOv(t){return !!(t&&t.closest&&t.closest('#ov'));}
document.addEventListener('pointerdown',function(e){
  if(mode!=='present'||ovOpen||inOv(e.target))return;
  var ty=e.pointerType;
  if(ty==='touch'){
    if(performance.now()-penSeen<1200||e.width>90&&e.height>90)return; // palm rejection
    if(tG){tG.cancel=true;return;}
    tG={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp,inter:isInter(e.target),cancel:false};return;
  }
  if(ty==='pen')penSeen=performance.now();
  if(e.button===0)tG={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp,inter:isInter(e.target),cancel:false,mouse:true};
},true);
function pointerEnd(e){
  if(!tG||tG.id!==e.pointerId)return;
  var g=tG;tG=null;
  if(g.cancel||e.type==='pointercancel')return;
  var dx=e.clientX-g.x,dy=e.clientY-g.y,dt=e.timeStamp-g.t;
  if(!g.mouse&&Math.abs(dx)>46&&Math.abs(dx)>Math.abs(dy)*1.3&&dt<1000){swallowUntil=performance.now()+400;dx<0?next():prev();return;}
  if(!g.mouse&&dy<-90&&Math.abs(dy)>Math.abs(dx)*1.5&&dt<1000){swallowUntil=performance.now()+400;openOv();return;}
  if(Math.abs(dx)<14&&Math.abs(dy)<14&&dt<800&&!g.inter&&!inOv(e.target)){
    var ox=stage.getBoundingClientRect().left,rx=(e.clientX-ox)/scaleF;if(rx<1920*.12)prev();else next();
  }
}
document.addEventListener('pointerup',pointerEnd,true);
document.addEventListener('pointercancel',pointerEnd,true);
document.addEventListener('click',function(e){if(performance.now()<swallowUntil&&!inOv(e.target)){e.stopPropagation();e.preventDefault();}},true);
document.addEventListener('contextmenu',function(e){e.preventDefault();},true);

/* ---------- the slide list in the edit view: the same thumbnails as the grid, in a column ---------- */
function sorterSelect(i){
  selCell(i);
  if(cells[i])cells[i].el.scrollIntoView({block:'nearest'});
}
function bootSorter(){
  document.documentElement.classList.add('sorter');
  stage.setAttribute('aria-hidden','true');
  ov.classList.add('show');
  buildOvShell();
  cells.forEach(function(c,i){
    var n=document.createElement('span');n.className='num';n.textContent=i+1;
    c.el.insertBefore(n,c.th);c.el.setAttribute('role','button');
    c.el.setAttribute('aria-label','Slide '+(i+1)+(hiddenSlide(i)?', hidden':''));
  });
  var layout=function(){
    var first=cells[0];if(!first)return;
    var k=first.th.getBoundingClientRect().width/1920;
    cells.forEach(function(c){c.tin.style.transform='scale('+k+')';});
  };
  /* a size change, not only a window resize: the scroll bar appears once the list fills up */
  if(cells[0])new ResizeObserver(layout).observe(cells[0].th);
  ov.addEventListener('click',function(e){
    var c=e.target.closest('.cell');if(c)send('pick',{slide:+c.getAttribute('data-i')});
  },true);
  /* built a few at a time, so a long presentation doesn't hold up the window */
  var i=0;
  (function build(){
    var end=Math.min(N,i+4);
    for(;i<end;i++)buildThumb(i);
    if(i<N)(window.requestIdleCallback||function(f){setTimeout(f,60);})(build,{timeout:300});
  })();
}

addEventListener('message',function(e){
  if(e.source!==parent||!e.data||e.data.v!==1)return;
  var p=e.data.payload||{};
  switch(e.data.type){
    case 'mode':setMode(p);break;
    case 'go':if(mode==='edit')preview(Math.max(0,Math.min(N-1,p.slide|0)));break;
    case 'grid':if(mode==='present'){if(ovOpen)closeOv();else openOv();}break;
    case 'key':if(p.key)onKey({key:p.key,ctrlKey:!!p.ctrl,shiftKey:!!p.shift,altKey:!!p.alt});break;
    case 'select':if(SORTER)sorterSelect(p.slide|0);break;
    case 'chrome':
      if(/^#[0-9a-f]{6}$/i.test(p.accent))document.documentElement.style.setProperty('--pw-accent',p.accent);
      if(/^#[0-9a-f]{6}$/i.test(p.text))document.documentElement.style.setProperty('--pw-text',p.text);
      /* a see-through page must match the app, or the browser paints it white */
      if(p.scheme==='dark'||p.scheme==='light')document.documentElement.style.colorScheme=p.scheme;
      break;
  }
});

texAll(document);
addEventListener('resize',function(){if(ovOpen)layoutOv();});
/* load, not now: widgets.js comes after this file, and a slide's widgets start on first show */
addEventListener('load',function(){
  if(SORTER)bootSorter();
  send('ready',{total:N});
});

})();
