/*
  Placeholder slide page for M2: shows a deck's slides, fully revealed, with no animation.
  M3 replaces this file with the real engine. The math code below is the template's, unchanged.
  Everything here runs in the sandbox; the app treats whatever it sends as untrusted.
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

  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(stage.querySelectorAll(".slide")).filter(function (s) {
    return s.getAttribute("data-hidden") !== "true";
  });
  var current = -1;

  function send(type, payload) {
    parent.postMessage({ v: 1, id: String(Date.now()), type: type, payload: payload }, "*");
  }
  function fit() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform =
      "translate3d(" + (innerWidth - 1920 * s) / 2 + "px," + (innerHeight - 1080 * s) / 2 + "px,0) scale(" + s + ")";
  }
  function go(i) {
    if (i < 0 || i >= slides.length || i === current) return;
    if (current >= 0) slides[current].classList.remove("show");
    current = i;
    var s = slides[i];
    s.classList.add("show");
    stage.classList.toggle("dark", s.classList.contains("hero"));
    var bg = (s.getAttribute("data-bg") || "").split(";");
    Array.prototype.forEach.call(document.querySelectorAll(".blob"), function (b, k) {
      var v = (bg[k] || "0,0,1").split(",");
      b.style.transform = "translate3d(" + v[0] + "px," + v[1] + "px,0) scale(" + v[2] + ")";
    });
    send("state", { slide: i, total: slides.length });
  }

  addEventListener("resize", fit);
  addEventListener("message", function (e) {
    if (e.source !== parent || !e.data || e.data.v !== 1) return;
    if (e.data.type === "go") go(e.data.payload.slide);
  });
  // A focused iframe keeps the keyboard for itself, so keys are passed up to the app.
  addEventListener("keydown", function (e) {
    send("key", { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".st"), function (e) {
    e.classList.add("on");
  });
  texAll(document);
  fit();

  addEventListener("load", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-w]"), function (el) {
      var fn = W[el.getAttribute("data-w")];
      if (fn) fn(el);
    });
    go(0);
    send("ready", { total: slides.length });
  });
})();
