/* Structural smoke tests using real Three.js scene/math, mocked GPU and DOM.
   This checks runtime, input and projection logic, not visual appearance. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
class ClassList {
  constructor(){this.values=new Set();}
  add(...s){s.forEach(x=>this.values.add(x));}
  remove(...s){s.forEach(x=>this.values.delete(x));}
  contains(s){return this.values.has(s);}
  toggle(s,force){const on=force===undefined?!this.values.has(s):!!force;on?this.add(s):this.remove(s);return on;}
}
class Element {
  constructor(id){this.id=id;this.style={};this.classList=new ClassList();this.hidden=false;this.events={};this.textContent='';this.attributes={};this.children={};}
  set className(s){this.classList=new ClassList();s.split(' ').filter(Boolean).forEach(s=>this.classList.add(s));}
  get className(){return [...this.classList.values].join(' ');}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(n,fn){(this.events[n]||(this.events[n]=[])).push(fn);}
  dispatch(n,e={}){for(const fn of this.events[n]||[])fn(e);}
  closest(){return this.id==='sound'?this:null;}
  querySelector(s){return this.children[s]||(this.children[s]=new Element(s));}
}
function sandbox(width=1280,height=800){
  let raf=[],now=0;const nodes=new Map(),listeners={},errors=[],renderers=[];
  const draw=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:(()=>{})});
  const canvas=()=>({width:1,height:1,style:{},getContext:()=>draw});
  const doc={hidden:false,getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);},querySelector:s=>doc.getElementById(s),createElement:()=>canvas(),addEventListener:(n,f)=>{(listeners['document:'+n]||(listeners['document:'+n]=[])).push(f);}};
  class Renderer {
    constructor(options){this.canvas=options.canvas;this.shadowMap={};this.scenes=[];this.calls=0;renderers.push(this);}
    setPixelRatio(){}setSize(w,h){this.width=w;this.height=h;}clear(){}clearDepth(){}
    render(s,c){s.updateMatrixWorld();c.updateMatrixWorld();this.calls++;this.scenes.push({s,c});if(this.scenes.length>2)this.scenes.shift();}
  }
  class Audio {constructor(src){this.src=src;this.volume=1;this.paused=true;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const storage=new Map();
  const ctx={console:{log:console.log,warn:()=>{},error:(...s)=>errors.push(s)},document:doc,Audio,performance:{now:()=>now},navigator:{vibrate:()=>{}},innerWidth:width,innerHeight:height,devicePixelRatio:1,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame:fn=>{raf.push(fn);},addEventListener:(n,f)=>{(listeners[n]||(listeners[n]=[])).push(f);},setTimeout,clearTimeout};ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(base,'three.global.js'),'utf8'),ctx,{filename:'three.global.js'});
  ctx.THREE={...ctx.THREE,WebGLRenderer:Renderer};
  for(const file of ['core.js','tavern.js','game.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file});
  const tick=(dt=1000/60)=>{now+=dt;const q=raf;raf=[];for(const fn of q)fn(now);};
  const event=(name,e={})=>{for(const fn of listeners[name]||[])fn({preventDefault(){},stopPropagation(){},...e});};
  tick();return {ctx,nodes,doc,errors,renderers,tick,event,storage};
}
test('all scene construction and a complete keyboard round run without runtime errors',()=>{
  const s=sandbox();assert.deepEqual(s.errors,[]);assert.equal(s.ctx.pints.state,'ready');assert.ok(s.nodes.get('loading').classList.contains('done'));
  s.event('keydown',{code:'Space',repeat:false});s.event('keyup',{code:'Space'});
  assert.equal(s.ctx.pints.state,'playing');
  const route=new s.ctx.PintsCore.Shift(s.ctx.pints.stats.seed).hazards;let held=false;
  for(let f=0;f<3100&&s.ctx.pints.state!=='result';f++){
    const stats=s.ctx.pints.stats;const wanted=route.some(h=>h.s-stats.distance<4.8&&h.s-stats.distance>-1.5);
    if(wanted!==held){s.event(wanted?'keydown':'keyup',{code:'Space',repeat:false});held=wanted;}
    s.tick();
  }
  assert.deepEqual(s.errors,[]);assert.equal(s.ctx.pints.state,'result');assert.ok(s.ctx.pints.stats.fill.every(f=>f>.99));assert.equal(s.ctx.pints.stats.clean,8);
  assert.ok(Number(s.nodes.get('score').textContent.replace(/,/g,''))>3000);assert.ok(s.storage.has('mind-the-pints-best'));
  for(let i=0;i<40;i++)s.tick();
  s.event('pointerdown',{target:s.nodes.get('scene'),isPrimary:true,button:0});s.event('pointerup',{isPrimary:true});
  assert.equal(s.ctx.pints.state,'playing');assert.equal(s.ctx.pints.stats.time,0);assert.equal(s.ctx.pints.stats.distance,0);
});
test('touch, focus loss, hidden-tab timing, sound toggle and resize are safe',()=>{
  const s=sandbox(390,844);assert.deepEqual(s.errors,[]);
  s.event('pointerdown',{target:s.nodes.get('scene'),isPrimary:true,button:0});s.tick();
  assert.ok(s.nodes.get('game').classList.contains('steady'));
  s.event('blur');s.tick();assert.ok(!s.nodes.get('game').classList.contains('steady'));
  s.doc.hidden=true;s.event('document:visibilitychange');const before=s.ctx.pints.stats.time;
  for(let i=0;i<120;i++)s.tick();assert.equal(s.ctx.pints.stats.time,before);
  s.doc.hidden=false;s.event('document:visibilitychange');s.tick();assert.ok(s.ctx.pints.stats.time>before);
  s.nodes.get('sound').dispatch('click',{stopPropagation(){}});assert.ok(s.nodes.get('sound').classList.contains('muted'));
  s.ctx.innerWidth=844;s.ctx.innerHeight=390;s.event('resize');s.tick();assert.equal(s.renderers[0].width,844);assert.deepEqual(s.errors,[]);
});
test('Three.js object transforms, bounds, and tray projection are finite at desktop and phone sizes',()=>{
  for(const [w,h]of [[1440,900],[390,844],[375,667],[844,390]]){
    const s=sandbox(w,h);for(let i=0;i<120;i++)s.tick();
    const [main,view]=s.renderers[0].scenes;let meshes=0,instances=0,triangles=0;
    for(const {s:scene}of[main,view])scene.traverse(o=>{
      assert.ok(o.matrixWorld.elements.every(Number.isFinite));
      if(o.isMesh){meshes++;o.geometry.computeBoundingSphere();assert.ok(Number.isFinite(o.geometry.boundingSphere.radius));triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.count||1);if(o.isInstancedMesh)instances+=o.count;}
    });
    const center=new s.ctx.THREE.Vector3(0,0,0).project(view.c);assert.ok(center.y>-.65&&center.y<-.4);assert.ok(center.x>-.01&&center.x<.01);
    assert.ok(meshes>200&&meshes<1200);assert.ok(instances>1500);assert.ok(triangles<1000000);
    assert.deepEqual(s.errors,[]);
    if(w===1440)console.log('Scene budget:',{meshes,instances,triangles:Math.round(triangles)});
  }
});
