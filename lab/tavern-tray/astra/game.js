(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const game=$('game'),intro=$('intro'),resultPanel=$('result');
  const ui={time:$('time'),clock:$('clock'),route:$('route-fill'),dot:$('route-dot'),toast:$('toast'),toastText:$('toast-text'),toastIcon:$('toast-icon'),warning:$('warning'),warningText:$('warning-text'),combo:$('combo'),comboNumber:$('combo-number'),tip:$('first-tip'),impact:$('impact'),control:$('control-state')};
  class Sound {
    constructor() {
      this.enabled=true;this.started=false;this.ctx=null;this.lastStep=0;
      this.music=new Audio('assets/generate_music-1.mp3');this.music.loop=true;this.music.volume=.23;this.music.preload='auto';
      this.clink=new Audio('assets/generate_sfx-1.mp3');this.clink.volume=.6;this.clink.preload='auto';
    }
    start() {
      if(!this.ctx){const A=window.AudioContext||window.webkitAudioContext;if(A){try{this.ctx=new A();}catch(e){/* Audio is optional. */}}}
      this.started=true;
      if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
      if(this.enabled)this.music.play().catch(()=>{});
    }
    toggle() {
      this.enabled=!this.enabled;
      if(this.enabled&&this.started){if(this.ctx)this.ctx.resume().catch(()=>{});this.music.play().catch(()=>{});}else{this.music.pause();this.clink.pause();}
      $('sound').classList.toggle('muted',!this.enabled);$('sound').setAttribute('aria-label',this.enabled?'Mute sound':'Enable sound');
    }
    tone(freq,duration,type='sine',volume=.06,end=freq,delay=0) {
      if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
      const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();const now=ctx.currentTime+delay;
      o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration);
      g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.008);g.gain.exponentialRampToValueAtTime(.0001,now+duration);
      o.connect(g);g.connect(ctx.destination);o.start(now);o.stop(now+duration+.025);
    }
    noise(duration,volume,cutoff=600) {
      if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
      const ctx=this.ctx,buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
      const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=buffer;f.type='lowpass';f.frequency.value=cutoff;g.gain.value=volume;
      n.connect(f);f.connect(g);g.connect(ctx.destination);n.start();n.stop(ctx.currentTime+duration);
    }
    foot(braced) {this.tone(braced?120:95,.055,'sine',braced?.012:.025,44);this.noise(.033,braced?.012:.022,430);}
    steady() {this.tone(245,.10,'sine',.032,310);}
    clean(combo) {
      const n=[0,2,4,7,9,12,14,16][Math.min(combo-1,7)];const f=520*Math.pow(2,n/12);
      this.tone(f,.20,'sine',.06,f*.998);this.tone(f*1.5,.15,'sine',.027,f*1.5,.065);
    }
    bump() {this.noise(.29,.19,1500);this.tone(320,.28,'triangle',.085,95);this.tone(620,.18,'sine',.045,235,.035);}
    tick() {this.tone(1150,.08,'sine',.03,900);}
    end(success) {
      if(success) {if(this.enabled){this.clink.currentTime=0;this.clink.play().catch(()=>{});}this.tone(392,.6,'sine',.04,392,.25);this.tone(494,.6,'sine',.04,494,.35);this.tone(587,.8,'sine',.04,587,.45);}
      else{this.tone(196,.75,'triangle',.07,146);this.tone(147,.75,'sine',.08,98,.18);}
    }
  }
  let world,core,mode='ready',held=false,spaceDown=false,pointerDown=false,last=0,elapsed=0,finishAge=0,resultAge=0,toastUntil=0,comboUntil=0,impactUntil=0,stepDistance=0,previousSecond=45;
  let best=0,round=0,hidden=false;
  try{best=Number(localStorage.getItem('mind-the-pints-best'))||0;}catch(e){/* A private local tab still plays normally. */}
  const audio=new Sound();
  const seed=()=>((Date.now()^(++round*2654435761))>>>0);
  function showToast(text,bad=false,icon='✦',duration=1.25) {
    ui.toastText.textContent=text;ui.toastIcon.textContent=icon;ui.toast.classList.toggle('bad',bad);ui.toast.classList.add('show');toastUntil=elapsed+duration;
  }
  function startRound() {
    if(!world)return;
    core.reset(seed());core.start();world.reset();world.setCourse(core);
    mode='playing';finishAge=0;resultAge=0;stepDistance=0;previousSecond=45;toastUntil=0;comboUntil=0;impactUntil=0;
    intro.classList.add('dismissed');resultPanel.classList.remove('visible');resultPanel.hidden=true;
    game.className='playing';ui.toast.classList.remove('show');ui.combo.classList.remove('show');ui.warning.classList.remove('show');ui.tip.style.opacity='1';ui.impact.style.opacity='0';
    audio.start();audio.music.volume=.23;audio.tone(392,.15,'sine',.045,440);audio.tone(587,.2,'sine',.04,659,.1);
  }
  function showResult() {
    mode='result';game.className='result-mode';held=false;pointerDown=false;spaceDown=false;resultAge=0;
    const r=core.result;
    $('result-title').innerHTML=r.title;$('result-description').textContent=r.description;
    $('result-kicker').textContent=r.served?`${r.served} DRINK${r.served===1?'':'S'} SERVED · ${r.clean} CLEAN PASSES`:r.reason==='late'?'LAST CALL MEANS LAST CALL':'MOP REQUIRED AT TABLE 13';
    $('result-stars').textContent=Array.from({length:3},(_,i)=>i<r.stars?'✦':'✧').join(' ');
    $('result-stars').style.color=r.stars?'#bb873d':'#879180';
    for(let i=0;i<3;i++) {
      const pct=Math.round(core.fill[i]*100);$('amount-'+i).textContent=pct+'%';$('fill-icon-'+i).style.transform='scaleY('+Math.max(0,core.fill[i])+')';
    }
    const newBest=r.score>best;
    if(newBest){best=r.score;try{localStorage.setItem('mind-the-pints-best',String(best));}catch(e){}}
    $('score').textContent=r.score.toLocaleString();$('best').textContent=best.toLocaleString();$('best-label').textContent=newBest?'A NEW HOUSE RECORD':'BEST SHIFT';
    document.querySelector('.best-line').classList.toggle('new-best',newBest);
    resultPanel.hidden=false;requestAnimationFrame(()=>resultPanel.classList.add('visible'));
    audio.music.volume=.16;
  }
  function handleEvents(events) {
    for(const e of events) {
      if(e.type==='bump') {
        const quips={dwarf:['Elbow room!','That was the good ale.'],wizard:['A spillbinding performance.','Mind the pointy hat!'],orc:['A very friendly elbow.','Oof. Big lad.'],barrel:['Barrel of laughs.','Not that kind of roll.']};
        showToast(quips[e.hazard.kind][Math.floor(Math.random()*2)],true,'!',1.6);
        world.splash(1,e.hazard.side);audio.bump();impactUntil=elapsed+.23;ui.combo.classList.remove('show');
        if(navigator.vibrate)try{navigator.vibrate(24);}catch(err){}
      } else if(e.type==='drip') {
        world.splash(.18,Math.sign(core.tiltX)||1);
      } else if(e.type==='guard') {
        showToast('Nicely does it.',false,'✧',.85);world.sparkle(7);audio.steady();
      } else if(e.type==='clean') {
        const words=['Smooth operator.','Not a drop.','A little tavern ballet.','Lovely footwork.','Steady as she goes.'];
        if(toastUntil<elapsed+.3||!e.close)showToast(words[(e.combo-1)%words.length],false,'✦',1.25);
        audio.clean(e.combo);world.sparkle(9+Math.min(e.combo,5));
        if(e.combo>=2){ui.comboNumber.textContent=e.combo;ui.combo.classList.add('show');comboUntil=elapsed+3;}
      } else if(e.type==='finish') {
        mode='settling';held=false;pointerDown=false;spaceDown=false;finishAge=0;game.className='settling';
        audio.end(e.result.served>0);if(e.result.served){world.sparkle(45);showToast('Table thirteen!',false,'✦',2);}else showToast(e.result.reason==='late'?'Last orders!':'Oh, the humanity.',true,'!',2);
      }
    }
  }
  function press(type) {
    if(!world)return;
    if(type==='key')spaceDown=true;else pointerDown=true;
    audio.start();
    if(mode==='ready')startRound();
    else if(mode==='result'&&resultAge>.55)startRound();
    else if(mode==='result'||mode==='settling'){spaceDown=false;pointerDown=false;return;}
    const was=held;held=spaceDown||pointerDown;
    if(held&&!was&&mode==='playing')audio.steady();
  }
  function release(type) {
    if(type==='key')spaceDown=false;else pointerDown=false;
    held=spaceDown||pointerDown;
  }
  window.addEventListener('keydown',e=>{
    if(e.code==='Space'||e.key===' '){e.preventDefault();if(!e.repeat)press('key');}
  });
  window.addEventListener('keyup',e=>{if(e.code==='Space'||e.key===' '){e.preventDefault();release('key');}});
  window.addEventListener('pointerdown',e=>{
    if(e.target.closest('[data-no-play]')||!e.isPrimary||e.button>0)return;
    e.preventDefault();
    if($('scene').setPointerCapture)try{$('scene').setPointerCapture(e.pointerId);}catch(err){}
    press('pointer');
  },{passive:false});
  window.addEventListener('pointerup',e=>{if(e.isPrimary)release('pointer');});
  window.addEventListener('pointercancel',()=>release('pointer'));
  window.addEventListener('blur',()=>{held=false;pointerDown=false;spaceDown=false;});
  document.addEventListener('visibilitychange',()=>{
    hidden=document.hidden;held=false;pointerDown=false;spaceDown=false;last=performance.now();
    if(hidden)audio.music.pause();else if(audio.started&&audio.enabled)audio.music.play().catch(()=>{});
  });
  $('sound').addEventListener('click',e=>{e.stopPropagation();audio.toggle();});
  // Native keyboard activation also works on the visible buttons; gameplay still uses just hold / release.
  for(const id of ['start','again'])$(id).addEventListener('click',e=>{if(e.detail===0&&(mode==='ready'||(mode==='result'&&resultAge>.55))){startRound();held=false;}});
  window.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('resize',()=>{if(world)world.resize();});
  function updateUI() {
    const remaining=Math.max(0,Math.ceil(core.limit-core.time));
    ui.time.textContent='0:'+String(remaining).padStart(2,'0');ui.clock.classList.toggle('urgent',remaining<=10);
    const progress=Math.min(100,core.distance/core.length*100);ui.route.style.width=progress+'%';ui.dot.style.left=progress+'%';
    game.classList.toggle('steady',held&&mode==='playing');ui.control.textContent=held?'STEADY HANDS':'HUSTLING';
    const nearest=core.nearest();
    if(nearest&&mode==='playing') {
      const ahead=nearest.s-core.distance;
      const show=ahead<8&&ahead>-.9&&!nearest.hit;
      ui.warning.classList.toggle('show',show);ui.warning.classList.toggle('safe',held);
      ui.warningText.textContent=held?'EASY… LET THEM THROUGH':ahead<4.9?'HOLD TO STEADY':nearest.name;
      ui.warning.querySelector('.warning-mark').textContent=held?'✓':'!';
    } else ui.warning.classList.remove('show');
    if(elapsed>toastUntil)ui.toast.classList.remove('show');
    if(elapsed>comboUntil)ui.combo.classList.remove('show');
    ui.impact.style.opacity=elapsed<impactUntil?'.9':'0';
    ui.tip.style.opacity=core.time<7?'1':'0';
    if(mode==='playing'&&remaining<=10&&remaining!==previousSecond){audio.tick();previousSecond=remaining;}
  }
  function frame(now) {
    requestAnimationFrame(frame);
    let dt=Math.min((now-(last||now))/1000,.05);last=now;
    if(hidden)return;
    elapsed+=dt;
    if(mode==='playing') {
      // Small physics steps keep contact timing the same on fast and slow displays.
      let left=dt;
      while(left>0&&mode==='playing'){const step=Math.min(left,1/90);handleEvents(core.update(step,held));left-=step;}
      if(core.distance-stepDistance>.95){stepDistance=core.distance;audio.foot(held);}
    } else if(mode==='settling') {
      finishAge+=dt;
      core.velX*=Math.exp(-dt*7);core.velZ*=Math.exp(-dt*7);core.tiltX*=Math.exp(-dt*5);core.tiltZ*=Math.exp(-dt*5);
      if(finishAge>.95)showResult();
    } else if(mode==='result')resultAge+=dt;
    updateUI();world.update(core,dt,elapsed,mode,held,finishAge);
  }
  try {
    core=new PintsCore.Shift(17863);world=new PintsTavern($('scene'));world.setCourse(core);
    requestAnimationFrame(now=>{last=now;frame(now);$('loading').classList.add('done');});
    // Useful, read-only experiment diagnostics. No network or external dependencies.
    window.pints={get state(){return mode;},get stats(){return{distance:core.distance,time:core.time,fill:core.fill.slice(),clean:core.clean,seed:core.seed};}};
  } catch(error) {
    console.error('The tavern could not open:',error);$('error').hidden=false;$('loading').classList.add('done');
  }
})();
