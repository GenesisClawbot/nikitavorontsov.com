const test = require('node:test');
const assert = require('node:assert/strict');
const {Shift} = require('../core.js');
const careful = g => g.hazards.some(h => h.s-g.distance < 4.8 && h.s-g.distance > -1.5);
const tight = g => g.hazards.some(h => h.s-g.distance < 2.1 && h.s-g.distance > -1.4);
function run(seed,policy,dt=1/90) {
  const g=new Shift(seed);g.start();const events=[];let frames=0;
  while(g.state==='playing' && frames++ < 12000) {
    for(const e of g.update(dt,policy(g)))events.push(e.type);
    assert.ok(Number.isFinite(g.distance) && Number.isFinite(g.tiltX) && Number.isFinite(g.tiltZ));
    assert.ok(g.fill.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
  }
  assert.equal(g.state,'finished');return {g,events};
}
test('idle does not run the clock, move, or spill',()=>{
  const g=new Shift(1);g.update(1/30,false);assert.equal(g.distance,0);assert.equal(g.time,0);assert.deepEqual(g.fill,[1,1,1]);
});
test('a seed reproduces the same crowd',()=>{
  assert.deepEqual(new Shift(31).hazards,new Shift(31).hazards);
  assert.notDeepEqual(new Shift(31).hazards,new Shift(32).hazards);
});
test('holding forever preserves the drinks but misses last call',()=>{
  const {g}=run(12,()=>true);assert.equal(g.reason,'late');assert.ok(g.time>=45&&g.time<45.05);assert.deepEqual(g.fill,[1,1,1]);assert.equal(g.result.score,0);
});
test('reckless rushing spills almost everything, but still makes a 30-second round',()=>{
  for(let seed=1;seed<=15;seed++){
    const {g,events}=run(seed,()=>false);assert.ok(g.time>=30&&g.time<32);assert.ok(g.result.average<.045);assert.ok(events.includes('bump'));
  }
});
test('readable early holds fit within the limit, with all drinks intact',()=>{
  for(let seed=1;seed<=20;seed++){
    const {g}=run(seed,careful);assert.equal(g.reason,'served');assert.equal(g.result.served,3);assert.equal(g.clean,8);assert.equal(g.result.stars,3);assert.ok(g.time>40&&g.time<44);assert.ok(g.result.average>.99);
  }
});
test('confident, later catches are faster and earn a larger tip',()=>{
  const slow=run(54,careful).g,fast=run(54,tight).g;
  assert.ok(fast.time>30&&fast.time<38);assert.ok(fast.time<slow.time);assert.ok(fast.result.score>slow.result.score);assert.equal(fast.bestCombo,8);
});
test('timing and contacts behave consistently at 20, 30, 60, and 120 Hz',()=>{
  const scores=[];
  for(const hz of [20,30,60,120]){const {g}=run(99,careful,1/hz);assert.equal(g.result.served,3);assert.equal(g.clean,8);assert.ok(g.time<44);scores.push(g.time);}
  assert.ok(Math.max(...scores)-Math.min(...scores)<.7);
});
test('a bump is recoverable and only happens once per patron',()=>{
  const {g,events}=run(321,g=>g.hazards[0].passed&&careful(g));
  assert.equal(events.filter(e=>e==='bump').length,1);assert.equal(g.result.served,3);assert.equal(g.clean,7);assert.ok(g.result.average>.8);
});
test('reset clears the bill, the tray, and all previous contact state',()=>{
  const g=run(67,careful).g;g.reset(68);assert.equal(g.state,'ready');assert.equal(g.time,0);assert.equal(g.points,0);assert.equal(g.clean,0);assert.equal(g.tiltX,0);assert.ok(g.hazards.every(h=>!h.hit&&!h.guarded&&!h.passed));assert.deepEqual(g.fill,[1,1,1]);
  g.start();g.update(.01,false);assert.ok(g.distance>0);
});
