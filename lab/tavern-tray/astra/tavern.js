/* The tavern is built from little pieces of wood, cloth, glass and questionable manners. */
(function (root) {
  'use strict';
  const T = THREE, clamp = PintsCore.clamp;
  const C = {
    ink: '#213e3e', timber: '#543c30', darkWood: '#674634', wood: '#ac7949', lightWood: '#c89458',
    gold: '#dda85e', brass: '#b78b4c', cream: '#f5dfb1', rug: '#345952', rugDark: '#2c4945',
    red: '#a04f45', purple: '#735374', green: '#78977c', skin: '#d2a17c', mint: '#92c7a2'
  };
  const V = (x, y, z) => new T.Vector3(x, y, z);
  class Tavern {
    constructor(canvas) {
      this.canvas = canvas; this.time = 0; this.shake = 0; this.offset = 0; this.brace = 0; this.serve = 0; this.mode = 'ready';
      this.materials = new Map(); this.batches = new Map(); this.textureCache = new Map(); this.hazardModels = [];
      this.geos = {
        box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(1, 1, 1, 12), round: new T.CylinderGeometry(1, 1, 1, 32),
        body: new T.CylinderGeometry(.74, 1, 1, 10), cup: new T.CylinderGeometry(1, .86, 1, 20),
        cone: new T.ConeGeometry(1, 1, 10), sphere: new T.SphereGeometry(1, 12, 8), ico: new T.IcosahedronGeometry(1, 0),
        torus: new T.TorusGeometry(1, .14, 6, 24), thinTorus: new T.TorusGeometry(1, .025, 6, 64), circle: new T.CircleGeometry(1, 40),
        barrel: new T.LatheGeometry([new T.Vector2(.54,-.7),new T.Vector2(.65,-.58),new T.Vector2(.71,0),new T.Vector2(.65,.58),new T.Vector2(.54,.7)], 12),
        ring: new T.RingGeometry(.94, 1, 48),
        smile: new T.TorusGeometry(.065, .014, 4, 12, Math.PI),
        glass: new T.CylinderGeometry(.455, .37, 1.34, 20, 1, true)
      };
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.13;
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap; this.renderer.autoClear = false;
      this.scene = new THREE.Scene(); this.scene.background = new T.Color('#2c4240'); this.scene.fog = new T.Fog('#2c4240', 28, 69);
      this.camera = new THREE.PerspectiveCamera(46, 1, .2, 91);
      this.scene.add(new T.HemisphereLight('#ffe3ad', '#537977', 2.25));
      this.sun = new T.DirectionalLight('#ffdfab', 3.1); this.sun.position.set(-9, 20, 10); this.sun.castShadow = true;
      const sh = this.sun.shadow; sh.mapSize.set(1536,1536); sh.camera.left=-23; sh.camera.right=23; sh.camera.top=24; sh.camera.bottom=-24; sh.camera.near=.5; sh.camera.far=62; sh.bias=-.0007; sh.normalBias=.055; sh.camera.updateProjectionMatrix();
      this.scene.add(this.sun, this.sun.target);
      this.warmLights = [-1,1].map(side => { const l = new T.PointLight('#ffb761', 35, 17, 2); l.position.set(side*6,3.4,-7); this.scene.add(l); return l; });
      this.viewScene = new T.Scene(); this.viewCamera = new T.OrthographicCamera(-10,10,9,-3,.1,50); this.viewCamera.position.set(0,7.5,12); this.viewCamera.lookAt(0,0,0);
      this.viewScene.add(new T.HemisphereLight('#fff0d2', '#4f807a', 2.7));
      const trayLight = new T.DirectionalLight('#ffe0a1', 3.5); trayLight.position.set(-3,8,6); this.viewScene.add(trayLight);
      const rimLight = new T.DirectionalLight('#b9efe1', 1.8); rimLight.position.set(5,3,-4); this.viewScene.add(rimLight);
      this.makeWoodTexture(); this.buildRoom(); this.buildGoal(); this.flushBatches(); this.buildDust(); this.buildTray(); this.buildParticles();
      this.resize();
    }
    material(color, roughness = .84, metalness = 0) {
      const key = color + ':' + roughness + ':' + metalness;
      if (!this.materials.has(key)) this.materials.set(key, new T.MeshStandardMaterial({ color, roughness, metalness, flatShading: true }));
      return this.materials.get(key);
    }
    basic(color) {
      const key='b:'+color;
      if(!this.materials.has(key)) this.materials.set(key, new T.MeshBasicMaterial({color}));
      return this.materials.get(key);
    }
    geometry(kind) { return typeof kind === 'string' ? this.geos[kind] : kind; }
    mesh(parent, kind, mat, p = [0,0,0], s = [1,1,1], r = [0,0,0], shadows = true) {
      const m = new T.Mesh(this.geometry(kind), typeof mat === 'string' ? this.material(mat) : mat);
      m.position.set(...p); m.scale.set(...s); m.rotation.set(...r); m.castShadow = shadows; m.receiveShadow = shadows;
      parent.add(m); return m;
    }
    addStatic(kind, mat, p, s, r = [0,0,0], shadows = true) {
      const geo = this.geometry(kind); mat = typeof mat === 'string' ? this.material(mat) : mat;
      const key = geo.uuid + ':' + mat.uuid + ':' + shadows;
      if (!this.batches.has(key)) this.batches.set(key, {geo, mat, shadows, matrices: []});
      const o = new T.Object3D(); o.position.set(...p); o.scale.set(...s); o.rotation.set(...r); o.updateMatrix();
      this.batches.get(key).matrices.push(o.matrix.clone());
    }
    absorb(group) {
      group.updateMatrixWorld(true);
      group.traverse(m => {
        if (!m.isMesh) return;
        const key=m.geometry.uuid+':'+m.material.uuid+':'+m.castShadow;
        if(!this.batches.has(key)) this.batches.set(key,{geo:m.geometry,mat:m.material,shadows:m.castShadow,matrices:[]});
        this.batches.get(key).matrices.push(m.matrixWorld.clone());
      });
    }
    flushBatches() {
      for(const b of this.batches.values()) {
        const m = new T.InstancedMesh(b.geo,b.mat,b.matrices.length);
        b.matrices.forEach((matrix,i) => m.setMatrixAt(i,matrix)); m.instanceMatrix.needsUpdate=true;
        m.castShadow=b.shadows; m.receiveShadow=true; m.computeBoundingSphere(); this.scene.add(m);
      }
      this.batches.clear();
    }
    makeWoodTexture() {
      const c=document.createElement('canvas'); c.width=128; c.height=256; const x=c.getContext('2d');
      const rnd=PintsCore.random(9431); x.fillStyle='#ffffff'; x.fillRect(0,0,128,256);
      for(let i=0;i<70;i++) {
        const px=rnd()*128; x.strokeStyle='rgba(68,38,12,'+(.025+rnd()*.07)+')'; x.lineWidth=.6+rnd()*1.8;
        x.beginPath(); x.moveTo(px,0); x.bezierCurveTo(px-6+rnd()*12,70,px-6+rnd()*12,190,px-4+rnd()*8,256); x.stroke();
      }
      for(let i=0;i<3;i++) {x.strokeStyle='rgba(78,40,12,.10)'; x.beginPath();x.ellipse(20+rnd()*88,rnd()*256,3+rnd()*3,12+rnd()*9,.05,0,Math.PI*2);x.stroke();}
      this.woodTex = new T.CanvasTexture(c); this.woodTex.colorSpace=T.SRGBColorSpace; this.woodTex.anisotropy=4;
      this.floorMats=['#9e744f','#a97b51','#b08255','#906444','#b68a5d'].map(color=>new T.MeshStandardMaterial({color,map:this.woodTex,roughness:.92}));
      this.tableMat = new T.MeshStandardMaterial({color:'#ba8c53',map:this.woodTex,roughness:.8});
    }
    barrel(parent, p, scale=1, staticObject=false) {
      const g=new T.Group();
      this.mesh(g,'barrel',C.wood,[0,.74,0],[1,1,1]);
      for(const y of [.23,1.22]) this.mesh(g,'cyl',C.ink,[0,y,0],[.655,.085,.655]);
      this.mesh(g,'cyl',C.darkWood,[0,1.43,0],[.54,.045,.54]);
      this.mesh(g,'box',C.lightWood,[0,1.457,0],[1.0,.015,.035]);
      g.position.set(...p);g.scale.setScalar(scale);
      if(staticObject)this.absorb(g);else parent.add(g);return g;
    }
    candle(x,y,z,size=1) {
      this.addStatic('round',C.brass,[x,y,z],[.22*size,.045,.22*size]);
      this.addStatic('cyl',C.cream,[x,y+.26*size,z],[.085*size,.49*size,.085*size]);
      this.addStatic('sphere',this.basic('#e7893c'),[x,y+.56*size,z],[.11*size,.2*size,.10*size], [0,0,.1],false);
      this.addStatic('sphere',this.basic('#fff1a1'),[x,y+.57*size,z],[.064*size,.137*size,.064*size], [0,0,-.1],false);
    }
    table(x,z,rnd) {
      this.addStatic('round',C.darkWood,[x,1.37,z],[2.0,.20,2.0]);
      this.addStatic('round',this.tableMat,[x,1.5,z],[1.98,.13,1.98]);
      this.addStatic('cyl',C.darkWood,[x,.76,z],[.28,1.38,.28]);
      this.addStatic('box',C.timber,[x,.19,z],[2.4,.19,.27]);
      this.addStatic('box',C.timber,[x,.19,z],[.27,.19,2.4]);
      this.addStatic('box',C.darkWood,[x,1.575,z],[3.7,.012,.022],[0,.2,0],false);
      for(let i=0;i<3;i++) {
        const a=(i/3)*Math.PI*2+.5, sx=x+Math.cos(a)*2.46,sz=z+Math.sin(a)*2.46;
        this.addStatic('cyl',C.darkWood,[sx,.69,sz],[.52,.17,.52]);
        this.addStatic('cyl',i%2?C.red:C.rug,[sx,.80,sz],[.49,.09,.49]);
        for(const dx of [-.27,.27])for(const dz of [-.27,.27])this.addStatic('box',C.timber,[sx+dx,.34,sz+dz],[.115,.68,.115],[0,0,dx*.17]);
        const mx=x+Math.cos(a)*1.12,mz=z+Math.sin(a)*1.12;
        this.addStatic('cyl',C.brass,[mx,1.79,mz],[.20,.42,.20]);
        this.addStatic('cyl',this.material('#efc278'),[mx,2.01,mz],[.18,.027,.18]);
        this.addStatic('torus',C.brass,[mx+.23,1.82,mz],[.13,.15,.13]);
        if(i<2) {
          const kinds=['dwarf','wizard','orc']; const person=this.makePatron(kinds[Math.floor(rnd()*3)],rnd(), false);
          person.group.position.set(sx,-.02,sz); person.group.rotation.y=-a-Math.PI/2; person.group.scale.multiplyScalar(.89);
          person.legs[0].rotation.x=-.8;person.legs[1].rotation.x=-.8;
          person.arms[0].rotation.x=-1.05;person.arms[1].rotation.x=-.2;person.head.rotation.z=(rnd()-.5)*.25;
          this.absorb(person.group);
        }
      }
      this.candle(x-.2,1.59,z+.2,.82+rnd()*.3);
      this.addStatic('cyl',this.material('#8ba397',.45,.3),[x+.65,1.595,z-.30],[.42,.035,.42]);
      this.addStatic('sphere',this.material('#bd8147'),[x+.66,1.74,z-.30],[.30,.13,.24]);
      this.addStatic('box',C.cream,[x+.66,1.85,z-.30],[.20,.016,.025],[0,-.6,0],false);
    }
    buildRoom() {
      const rnd=PintsCore.random(72579);
      this.addStatic('box',C.timber,[0,-.34,-76],[24,.42,179]);
      for(let row=0;row<45;row++)for(let col=0;col<15;col++) {
        this.addStatic('box',this.floorMats[Math.floor(rnd()*5)],[-11.2+col*1.6,-.085,11-row*4],[1.575,.20,3.967]);
      }
      this.addStatic('box',C.rugDark,[0,.028,-75],[4.85,.035,176],[0,0,0],false);
      this.addStatic('box',C.rug,[0,.05,-75],[4.35,.035,176],[0,0,0],false);
      for(const side of [-1,1]) {
        this.addStatic('box',C.gold,[side*2.2,.073,-75],[.043,.012,176],[0,0,0],false);
        this.addStatic('box',C.gold,[side*2.33,.055,-75],[.07,.012,176],[0,0,0],false);
      }
      for(let z=7;z>-162;z-=5) {
        this.addStatic('box',C.brass,[0,.077,z],[.19,.008,.19],[0,Math.PI/4,0],false);
        for(const side of [-1,1]) {
          this.addStatic('box',C.brass,[side*1.95,.077,z],[.16,.008,.16],[0,Math.PI/4,0],false);
          this.addStatic('box',C.brass,[side*1.94,.077,z-.42],[.025,.008,.36],[0,side*.45,0],false);
          this.addStatic('box',C.brass,[side*1.94,.077,z+.42],[.025,.008,.36],[0,-side*.45,0],false);
        }
      }
      for(const side of [-1,1]) {
        this.addStatic('box',this.material('#35534b'),[side*11.65,1.45,-76],[.36,3,179]);
        this.addStatic('box',this.material('#8f775c'),[side*11.65,5.25,-76],[.36,4.6,179]);
        this.addStatic('box',C.timber,[side*11.37,3.03,-76],[.26,.17,179]);
        this.addStatic('box',C.timber,[side*11.4,7.2,-76],[.45,.35,179]);
        for(let z=10;z>-165;z-=12) {
          this.addStatic('box',C.timber,[side*11.3,3.8,z],[.50,7.6,.5]);
          this.addStatic('box',C.timber,[side*11.25,5.7,z-2.1],[.29,.31,4.4],[side*.42,0,0]);
        }
        for(let z=-12;z>-160;z-=24) {
          this.addStatic('box',C.darkWood,[side*11.1,4.8,z],[.20,2.8,2.4]);
          this.addStatic('box',this.basic('#ffd990'),[side*10.98,4.8,z],[.025,2.43,2.08],[0,0,0],false);
          this.addStatic('box',C.timber,[side*10.91,4.8,z],[.08,2.6,.09]);
          this.addStatic('box',C.timber,[side*10.91,4.8,z],[.08,.10,2.16]);
          this.addStatic('box',C.timber,[side*10.88,3.35,z],[.7,.20,2.7]);
          this.addStatic('box',side<0?C.red:C.purple,[side*10.90,4.85,z+1.22],[.11,3.1,.45]);
          this.addStatic('box',C.brass,[side*10.84,4.33,z+1.22],[.12,.12,.49]);
        }
        for(let z=-6;z>-151;z-=17) this.table(side*7.15,z+(side>0?-1.5:0),rnd);
        for(let z=2;z>-154;z-=25) {
          this.barrel(null,[side*9.8,0,z],.93,true);
          this.barrel(null,[side*9.75,0,z-1.55],.83,true);
          this.candle(side*9.8,1.39,z,.7);
        }
      }
      // A little bunting instead of a ceiling: the room stays readable like a storybook cutaway.
      const triangle=new T.BufferGeometry(); triangle.setAttribute('position',new T.Float32BufferAttribute([-.55,0,0,.55,0,0,0,-.85,0],3));triangle.computeVertexNormals();
      this.geos.flag=triangle;
      for(let z=-15;z>-148;z-=31) {
        for(let i=0;i<13;i++) {
          const x=-10.1+i*1.68,y=6.8+Math.pow(x/10,2)*.8;
          const mat=this.material([C.red,C.rug,C.gold][i%3]);mat.side=T.DoubleSide;
          this.addStatic(triangle,mat,[x,y,z],[1,1,1],[.06,0,(i%2-.5)*.06],false);
          this.addStatic('box',C.brass,[x,y+.018,z],[1.72,.023,.025],[0,0,x*.013],false);
        }
      }
      const sign=this.signTexture(['THE CROOKED','WYVERN'],'#233f3d','#e5bd76',512,256,true);
      this.addStatic('box',C.timber,[6.9,4.8,-10.3],[4.25,2.15,.20],[0,-.08,0]);
      const plane=new T.Mesh(new T.PlaneGeometry(4,2),new T.MeshBasicMaterial({map:sign}));plane.position.set(6.9,4.8,-10.16);plane.rotation.y=-.08;this.scene.add(plane);
      for(const x of [5.5,8.3])this.addStatic('box',C.brass,[x,6.25,-10.3],[.035,1.0,.035]);
      this.greeters=[];
      for(const spec of [['dwarf',-3.9,-4.5,.6],['orc',4.3,-9,-.5]]) {
        const p=this.makePatron(spec[0],.4,true);p.group.position.set(spec[1],0,spec[2]);p.group.rotation.y=spec[3];this.scene.add(p.group);this.greeters.push(p);
      }
    }
    signTexture(lines,bg,fg,w=512,h=256,border=false) {
      const key=lines.join('/')+bg+fg+w+h;
      if(this.textureCache.has(key))return this.textureCache.get(key);
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
      x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=fg;x.strokeStyle=fg;
      if(border){x.lineWidth=2;x.strokeRect(12,12,w-24,h-24);x.lineWidth=1;x.strokeRect(18,18,w-36,h-36);}
      x.textAlign='center';x.textBaseline='middle';
      lines.forEach((line,i)=>{x.font=(lines.length>1?(i===0?'22':'55'):'48')+'px Georgia';x.fillText(line,w/2,h*(lines.length>1?(i===0?.32:.63):.5));});
      if(border){x.font='19px Georgia';x.fillText('✦',w/2,h*.87);}
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;this.textureCache.set(key,tex);return tex;
    }
    buildGoal() {
      this.addStatic('box',this.material('#806851'),[0,3.75,-160],[23.5,7.6,.4]);
      for(let x=-10;x<=10;x+=4)this.addStatic('box',C.timber,[x,3.7,-159.6],[.35,7.4,.35]);
      this.addStatic('box',C.timber,[0,7.1,-159.5],[23,.32,.35]);
      this.addStatic('box',C.darkWood,[0,1.46,-153],[6.4,.26,2.55]);
      this.addStatic('box',this.tableMat,[0,1.62,-153],[6.3,.10,2.45]);
      for(const x of [-2.7,2.7])for(const z of [-153.8,-152.2])this.addStatic('box',C.timber,[x,.76,z],[.27,1.5,.27]);
      this.addStatic('box',C.red,[0,.99,-151.70],[2.9,1.16,.05]);
      this.addStatic('box',C.gold,[0,.45,-151.65],[2.9,.06,.045]);
      this.addStatic('box',C.gold,[0,1.05,-151.66],[.4,.4,.045],[0,0,Math.PI/4]);
      for(const x of [-1.55,0,1.55]) {
        this.addStatic('cyl',C.brass,[x,1.69,-152.5],[.48,.035,.48]);
        this.addStatic('ring',this.basic('#ffe2a0'),[x,1.712,-152.5],[.42,.42,.42],[-Math.PI/2,0,0],false);
      }
      this.candle(-2.6,1.7,-153,.9);this.candle(2.6,1.7,-153,.9);
      for(const [i,k] of ['wizard','orc','dwarf'].entries()) {
        const p=this.makePatron(k,.3+i*.3,false);p.group.position.set((i-1)*2.0,0,-154.9);p.arms[0].rotation.x=-2.1;p.arms[1].rotation.x=-1.7;this.absorb(p.group);
      }
      const signTex=this.signTexture(['YOUR VERY THIRSTY FRIENDS','TABLE 13'],'#284843','#f8d995',512,256,true);
      this.addStatic('box',C.timber,[0,5.2,-156],[5.6,2.0,.23]);
      const sign=new T.Mesh(new T.PlaneGeometry(5.4,1.8),new T.MeshBasicMaterial({map:signTex}));sign.position.set(0,5.2,-155.86);this.scene.add(sign);
      for(const x of [-2.1,2.1])this.addStatic('box',C.brass,[x,6.7,-156],[.035,1.05,.035]);
      // A cozy, low-poly hearth in the back corner.
      this.addStatic('box',this.material('#6e7364'),[-7.0,2.4,-159],[5,4.8,1.0]);
      this.addStatic('box',this.material('#283b36'),[-7,1.3,-158.42],[3.5,2.6,.15]);
      this.addStatic('box',C.timber,[-7,.27,-157.8],[2.6,.45,.6],[0,0,.11]);
      for(let i=0;i<7;i++)this.addStatic('cone',this.basic(i%2?'#ffd178':'#e79c50'),[-8.1+i*.36,.95,-157.9],[.32,.7+(i%3)*.2,.27],[0,0,(i-3)*.1],false);
      this.addStatic('box',C.lightWood,[-7,3.65,-158.4],[5.5,.28,1.6]);
    }
    makePatron(kind, variation, prop=true) {
      const g=new T.Group(), dwarf=kind==='dwarf',wizard=kind==='wizard',orc=kind==='orc';
      const skin=orc?C.green:(wizard?'#c5bda5':C.skin), cloth=wizard?C.purple:orc?C.red:(variation>.5?'#456b69':'#987348');
      const shirt=wizard?'#5c4767':orc?'#e2c598':'#d3ba8c';
      const legs=[],arms=[];
      for(const side of [-1,1]) {
        const leg=new T.Group();leg.position.set(side*.235,.62,0);g.add(leg);
        this.mesh(leg,'cyl',C.ink,[0,-.18,0],[.15,.43,.15]);this.mesh(leg,'box',C.darkWood,[0,-.47,.11],[.36,.23,.56]);legs.push(leg);
      }
      const body=this.mesh(g,'body',cloth,[0,1.09,0],[.59,.91,.45]);
      this.mesh(g,'cyl',C.timber,[0,.89,0],[.55,.13,.435]);this.mesh(g,'box',C.brass,[0,.9,.434],[.19,.16,.055]);
      this.mesh(g,'box',shirt,[0,1.38,.341],[.16,.40,.085],[0,0,.1]);
      for(const side of [-1,1]) {
        const arm=new T.Group();arm.position.set(side*.55,1.4,0);g.add(arm);
        this.mesh(arm,'cyl',shirt,[0,-.24,0],[.19,.50,.19]);this.mesh(arm,'sphere',skin,[0,-.56,.015],[.20,.225,.20]);
        arm.rotation.z=side*.16;arm.rotation.x=prop&&!wizard?-1.1:-.15;arms.push(arm);
      }
      const head=new T.Group();head.position.set(0,1.92,0);g.add(head);
      this.mesh(head,'sphere',skin,[0,0,0],[orc?.58:.48,.48,.44]);
      this.mesh(head,'sphere',skin,[0,-.01,.42],[orc?.21:.17,.135,.19]);
      for(const side of [-1,1]) {
        this.mesh(head,'sphere','#f5e8cd',[side*.17,.11,.376],[.09,.079,.047]);
        this.mesh(head,'sphere',C.ink,[side*.17,.105,.419],[.037,.045,.024]);
        this.mesh(head,'box',wizard?'#c9cbb0':C.timber,[side*.17,.235,.371],[.23,.055,.065],[0,0,side*-.16]);
        if(orc) {
          this.mesh(head,'cone',skin,[side*.60,.02,0],[.19,.48,.16],[0,0,-side*1.1]);
          this.mesh(head,'cone',C.cream,[side*.22,-.20,.427],[.075,.27,.085],[0,0,side*.15]);
        } else this.mesh(head,'sphere',skin,[side*.46,-.03,0],[.12,.18,.10]);
      }
      if(dwarf) {
        this.mesh(head,'cone',variation>.45?'#9c613b':'#b67c45',[0,-.31,.24],[.43,.62,.34],[0,0,Math.PI]);
        for(const side of [-1,1])this.mesh(head,'sphere','#be8953',[side*.15,-.12,.41],[.24,.09,.13],[0,0,-side*.12]);
        this.mesh(head,'sphere',C.red,[0,.38,-.04],[.5,.22,.45]);
        this.mesh(head,'cyl',C.darkWood,[0,.32,-.01],[.49,.075,.45]);
      } else if(wizard) {
        this.mesh(head,'cone','#ddd6b9',[0,-.32,.27],[.35,.77,.28],[0,0,Math.PI]);
        this.mesh(head,'cyl',C.purple,[0,.37,0],[.72,.095,.64]);
        this.mesh(head,'cone',C.purple,[-.09,.99,0],[.52,1.28,.48],[0,0,-.14]);
        this.mesh(head,'cyl',C.brass,[-.01,.52,0],[.44,.11,.40]);
        this.mesh(head,'box',C.gold,[-.05,.7,.39],[.12,.16,.027],[0,0,.6]);
        this.mesh(head,'sphere',C.gold,[-.18,1.63,0],[.055,.055,.055]);
      } else {
        this.mesh(head,'box',skin,[0,-.23,.18],[.63,.29,.43]);
        this.mesh(head,'box',C.ink,[0,-.28,.414],[.24,.027,.035]);
        this.mesh(head,'torus',C.gold,[.62,-.13,.01],[.105,.13,.105]);
        for(let i=-1;i<=1;i++)this.mesh(head,'cone',C.ink,[i*.17,.48,-.035],[.115,.29,.18],[0,0,-i*.16]);
      }
      if(prop) {
        if(dwarf) this.barrel(g,[0,.70,.68],.59,false);
        else if(wizard) {
          this.mesh(g,'cyl',C.darkWood,[.77,1.35,.26],[.055,2.64,.055],[0,0,-.08]);
          this.mesh(g,'torus',C.brass,[.88,2.69,.26],[.25,.29,.25]);
          this.mesh(g,'ico',this.basic('#a0e6be'),[.88,2.7,.26],[.16,.19,.16]);
          arms[1].rotation.x=-.6;
        } else {
          this.mesh(g,'round',C.brass,[0,1.02,.91],[1.04,.09,.57]);
          this.mesh(g,'sphere',this.material('#c48546'),[0,1.30,.9],[.58,.30,.40]);
          for(const side of [-1,1])this.mesh(g,'sphere',C.cream,[side*.55,1.33,1.09],[.21,.09,.10],[0,0,side*.3]);
        }
      }
      g.scale.setScalar(dwarf?.87:orc?1.13:1.02);
      return {group:g,body,head,legs,arms,kind,prop,baseScale:g.scale.x};
    }
    speechTexture(word) {
      const key='speech'+word;if(this.textureCache.has(key))return this.textureCache.get(key);
      const c=document.createElement('canvas');c.width=384;c.height=128;const x=c.getContext('2d');
      x.fillStyle='#fff0cf';x.beginPath();x.roundRect(8,8,368,91,20);x.fill();x.beginPath();x.moveTo(183,95);x.lineTo(176,122);x.lineTo(207,95);x.fill();
      x.fillStyle='#344943';x.textAlign='center';x.textBaseline='middle';x.font='italic 39px Georgia';x.fillText(word,192,55);
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;this.textureCache.set(key,tex);return tex;
    }
    setCourse(core) {
      for(const h of this.hazardModels) {
        this.scene.remove(h.root,h.mark,h.bubble);h.markMat.dispose();h.bubble.material.dispose();
      }
      this.hazardModels=[];
      for(const h of core.hazards) {
        let actor,root;
        if(h.kind==='barrel') {
          root=new T.Group();const roll=new T.Group();root.add(roll);this.barrel(roll,[0,-.73,0],1);roll.rotation.z=Math.PI/2;root.userData.roll=roll;actor=null;
        } else {actor=this.makePatron(h.kind,h.variation,true);root=actor.group;}
        root.position.set(h.x,0,-h.s);root.rotation.y=h.side>0?-Math.PI/2:Math.PI/2;this.scene.add(root);
        const mark=new T.Group();mark.position.set(0,.088,-h.s);
        const mat=new T.MeshBasicMaterial({color:'#f7bb6b',transparent:true,opacity:.6,depthWrite:false,side:T.DoubleSide});
        this.mesh(mark,'ring',mat,[0,0,0],[1.5,1.5,1.5],[-Math.PI/2,0,0],false);
        for(let i=-2;i<=2;i++)this.mesh(mark,'box',mat,[i*.78,.001,0],[.39,.015,.085],[0,0,0],false);
        for(const side of [-1,1])this.mesh(mark,'box',mat,[side*.20,.002,2.05],[.045,.017,.65],[0,side*.64,0],false);
        this.scene.add(mark);
        const words={dwarf:'Hic… pardon!',wizard:'My hat!',orc:'Tiny drinks!',barrel:'Barrel incoming!'};
        const bubble=new T.Sprite(new T.SpriteMaterial({map:this.speechTexture(words[h.kind]),transparent:true,depthWrite:false,opacity:0}));
        bubble.scale.set(h.kind==='barrel'?3.0:2.5,.86,1);this.scene.add(bubble);
        this.hazardModels.push({root,actor,mark,markMat:mat,bubble,data:h});
      }
    }
    buildDust() {
      const rnd=PintsCore.random(543);const count=100;const pos=new Float32Array(count*3);this.dustSeed=[];
      for(let i=0;i<count;i++)this.dustSeed.push({x:(rnd()-.5)*21,y:.7+rnd()*6,z:rnd()*58,phase:rnd()*7});
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));
      const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),gr=x.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'#fff0c6');gr.addColorStop(.3,'#fff0c688');gr.addColorStop(1,'#fff0c600');x.fillStyle=gr;x.fillRect(0,0,32,32);
      this.dust=new T.Points(geo,new T.PointsMaterial({color:'#f6d390',map:new T.CanvasTexture(c),size:.13,transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending}));
      this.dust.frustumCulled=false;this.scene.add(this.dust);
    }
    buildTray() {
      this.rig=new T.Group();this.rig.name='Carry rig';this.tray=new T.Group();this.tray.name='Serving tray';this.rig.add(this.tray);this.viewScene.add(this.rig);
      const wood=this.material('#805434',.63),gold=this.material('#d5a35a',.34,.57);
      this.mesh(this.tray,'round',wood,[0,-.035,0],[2.45,.20,1.43],[0,0,0],false);
      this.mesh(this.tray,'round',this.material('#a37041',.7),[0,.077,0],[2.36,.027,1.36],[0,0,0],false);
      this.mesh(this.tray,'thinTorus',gold,[0,.085,0],[2.43,1.42,1],[-Math.PI/2,0,0],false);
      for(const z of [-.65,0,.65])this.mesh(this.tray,'box',this.material('#785339'),[0,.096,z],[z===0?4.55:4.05,.006,.017],[0,0,0],false);
      this.mesh(this.tray,'ring',gold,[0,.102,.79],[.25,.25,.25],[-Math.PI/2,0,0],false);
      this.mesh(this.tray,'box',gold,[0,.11,.79],[.12,.008,.12],[0,Math.PI/4,0],false);
      this.steadyMat=new T.MeshBasicMaterial({color:'#b6f1cf',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
      this.steadyRing=this.mesh(this.tray,'ring',this.steadyMat,[0,.10,0],[2.54,1.5,1],[-Math.PI/2,0,0],false);
      for(const side of [-1,1]) {
        this.mesh(this.tray,'torus',gold,[side*2.5,-.025,0],[.30,.46,.31],[-Math.PI/2,0,0],false);
        this.mesh(this.tray,'cyl',this.material('#294f4c'),[side*2.78,-.63,.98],[.29,1.70,.32],[.73,0,side*.29],false);
        this.mesh(this.tray,'cyl',this.material('#b76b4a'),[side*2.65,-.12,.43],[.32,.21,.34],[.73,0,side*.29],false);
        this.mesh(this.tray,'sphere',this.material('#91b992'),[side*2.52,.05,.15],[.32,.21,.35],[0,0,-side*.2],false);
        for(let j=0;j<3;j++) {
          this.mesh(this.tray,'sphere',this.material('#a0c89b'),[side*(2.29+j*.012),.14,.32-j*.18],[.18,.105,.091],[0,0,side*.15],false);
          this.mesh(this.tray,'sphere',this.material('#d5d6af'),[side*2.18,.17,.32-j*.18],[.06,.025,.055],[0,0,0],false);
        }
      }
      this.drinks=[];
      const specs=[{color:'#f5a52f',foam:'#ffe4a3',x:-1.43,z:-.10,scale:1.02},{color:'#55d2b0',foam:'#b8f4d2',x:0,z:.20,scale:1.09},{color:'#d76492',foam:'#ffc0c5',x:1.43,z:-.10,scale:.98}];
      const glassMat=new T.MeshPhysicalMaterial({color:'#d9efdd',transparent:true,opacity:.19,roughness:.12,metalness:.12,clearcoat:1,side:T.DoubleSide,depthWrite:false});
      const highlight=new T.MeshBasicMaterial({color:'#fff4dd',transparent:true,opacity:.68,depthWrite:false});
      const shadowMat=new T.MeshBasicMaterial({color:'#2b3c31',transparent:true,opacity:.21,depthWrite:false});
      for(let i=0;i<3;i++) {
        const spec=specs[i],g=new T.Group();g.name='Enchanted drink '+i;g.position.set(spec.x,.13,spec.z);g.scale.setScalar(spec.scale);this.tray.add(g);
        this.mesh(this.tray,'circle',shadowMat,[spec.x,.111,spec.z],[.57,.57,1],[-Math.PI/2,0,0],false);
        this.mesh(g,'glass',glassMat,[0,.78,0],[1,1,1],[0,0,0],false);
        this.mesh(g,'round',glassMat,[0,.12,0],[.38,.08,.38],[0,0,0],false);
        this.mesh(g,'torus',gold,[0,1.45,0],[.451,.451,.22],[-Math.PI/2,0,0],false);
        this.mesh(g,'torus',gold,[0,.105,0],[.365,.365,.17],[-Math.PI/2,0,0],false);
        this.mesh(g,'torus',glassMat,[.58,.86,0],[.225,.30,.30],[0,0,0],false);
        this.mesh(g,'cyl',highlight,[-.278,.93,.302],[.018,.57,.018],[0,0,-.095],false);
        this.mesh(g,'sphere',highlight,[-.245,1.28,.352],[.035,.065,.022],[0,0,-.2],false);
        const liquidMat=new T.MeshStandardMaterial({color:spec.color,roughness:.3,metalness:.05,emissive:spec.color,emissiveIntensity:.11});
        const liquid=this.mesh(g,'cup',liquidMat,[0,.75,0],[.410,1.17,.410],[0,0,0],false);
        const surface=new T.Group();surface.position.y=1.335;g.add(surface);
        this.mesh(surface,'circle',this.material(spec.foam,.45),[0,0,0],[.408,.408,1],[-Math.PI/2,0,0],false);
        const bubbles=[];
        for(let j=0;j<10;j++) {
          const a=j/10*Math.PI*2,r=j%3===0?.18:.34;
          const m=this.mesh(surface,'sphere',this.material(spec.foam,.45),[Math.cos(a)*r,.029+(j%2)*.014,Math.sin(a)*r],[.068+(j%3)*.015,.057+(j%2)*.03,.075],[0,0,0],false);bubbles.push(m);
        }
        const face=new T.Group();g.add(face);face.position.y=1.065;
        const eyes=[],brows=[];
        for(const side of [-1,1]) {
          const eye=this.mesh(face,'sphere',this.material('#243d3b',.35),[side*.13,0,.386],[.044,.069,.027],[0,0,-side*.08],false);eyes.push(eye);
          this.mesh(face,'sphere',highlight,[side*.13-.009,.022,.410],[.011,.016,.009],[0,0,0],false);
          const brow=this.mesh(face,'box',this.material('#375147'),[side*.13,.12,.38],[.108,.019,.023],[0,0,-side*.25],false);brows.push(brow);
        }
        const smile=this.mesh(face,'smile',this.material('#243d3b'),[0,-.095,.409],[1,1,1],[0,0,Math.PI],false);
        const mouth=this.mesh(face,'sphere',this.material('#243d3b'),[0,-.12,.412],[.039,.060,.013],[0,0,0],false);
        this.drinks.push({root:g,liquid,surface,bubbles,face,eyes,brows,smile,mouth,spec,fill:1,baseX:spec.x});
      }
    }
    buildParticles() {
      this.particleMats=['#ffc257','#87edcb','#fa96b6','#fff0b1'].map(color=>new T.MeshStandardMaterial({color,roughness:.3,emissive:color,emissiveIntensity:.30}));
      this.particles=[];this.particleIndex=0;
      for(let i=0;i<100;i++) {
        const m=new T.Mesh(this.geos.ico,this.particleMats[i%4]);m.visible=false;this.viewScene.add(m);
        this.particles.push({mesh:m,v:new T.Vector3(),age:3,life:1,type:0});
      }
    }
    splash(power=1,side=1) {
      this.shake=Math.max(this.shake,.55*power);this.viewScene.updateMatrixWorld(true);
      for(let cup=0;cup<3;cup++) {
        if(this.drinks[cup].fill<.04)continue;
        const origin=this.drinks[cup].root.localToWorld(V(0,this.drinks[cup].fill*1.15+.16,0));
        for(let j=0;j<Math.round(11*power);j++) {
          const p=this.particles[this.particleIndex++%this.particles.length];p.mesh.material=this.particleMats[cup];p.mesh.visible=true;p.mesh.position.copy(origin);
          p.mesh.position.x+=(Math.random()-.5)*.65;p.mesh.position.z+=(Math.random()-.5)*.4;
          p.v.set(side*(.8+Math.random()*2.6)*power,(1.8+Math.random()*2.4)*power,(Math.random()-.3)*2.2);
          p.age=0;p.life=.7+Math.random()*.6;p.type=0;const size=.045+Math.random()*.048;p.mesh.scale.set(size,size*1.6,size);
        }
      }
    }
    sparkle(count=13) {
      this.viewScene.updateMatrixWorld(true);
      for(let i=0;i<count;i++) {
        const p=this.particles[this.particleIndex++%this.particles.length];p.mesh.material=this.particleMats[3];p.mesh.visible=true;
        p.mesh.position.copy(this.rig.position).add(V((Math.random()-.5)*4.6,.8+Math.random()*1.7,(Math.random()-.5)*1.5));
        p.v.set((Math.random()-.5)*1.5,1+Math.random()*1.4,(Math.random()-.5)*1.2);p.age=0;p.life=.6+Math.random()*.8;p.type=1;const size=.035+Math.random()*.045;p.mesh.scale.set(size,size*1.6,size);
      }
    }
    reset() {
      this.shake=0;this.brace=0;this.serve=0;for(const d of this.drinks)d.fill=1;
      for(const p of this.particles){p.mesh.visible=false;p.age=p.life;}
    }
    resize() {
      this.width=window.innerWidth;this.height=window.innerHeight;this.aspect=this.width/this.height;
      this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.aspect;this.camera.fov=this.aspect<.8?60:this.aspect<1.2?53:46;this.camera.updateProjectionMatrix();
      const h=Math.max(11.7,7.25/this.aspect);
      this.viewCamera.left=-h*this.aspect/2;this.viewCamera.right=h*this.aspect/2;this.viewCamera.top=h*.775;this.viewCamera.bottom=-h*.225;this.viewCamera.updateProjectionMatrix();
    }
    update(core,dt,t,mode,held,finishAge=0) {
      this.time=t;this.mode=mode;const running=mode==='playing';const d=core.distance;
      this.brace+=(+(held&&running)-this.brace)*(1-Math.exp(-dt*10));this.shake*=Math.exp(-dt*9);
      const bob=running?Math.sin(d*3.4)*(.026+.025*(1-this.brace)):Math.sin(t*1.3)*.025;
      const sideCamera=this.aspect<.8?.25:2.3;
      this.camera.position.set(sideCamera+Math.sin(t*31)*this.shake*.27,9.2+bob-this.brace*.10,11.8-d+Math.cos(t*37)*this.shake*.16);
      this.camera.lookAt(Math.sin(t*43)*this.shake*.17,.65,-11-d);
      this.sun.position.set(-9,20,10-d);this.sun.target.position.set(0,0,-8-d);this.sun.target.updateMatrixWorld();
      for(let i=0;i<2;i++){const light=this.warmLights[i];light.position.z=-d-8-i*8;light.intensity=31+Math.sin(t*7+i)*3;}
      for(const hm of this.hazardModels) {
        const h=hm.data,ahead=h.s-d;hm.root.visible=ahead>-13&&ahead<65;
        const active=h.triggered&&Math.abs(h.x)<6;
        hm.root.position.x=h.x;hm.root.position.z=-h.s;
        if(hm.actor) {
          const a=hm.actor,phase=active?h.time*10:t*1.8+h.id;
          hm.root.position.y=active?Math.abs(Math.sin(phase))*.073:Math.sin(phase)*.018;
          hm.root.rotation.z=active?Math.sin(phase*.5)*.045:Math.sin(phase)*.016;
          a.legs[0].rotation.x=active?Math.sin(phase)*.47:0;a.legs[1].rotation.x=active?-Math.sin(phase)*.47:0;
          a.head.rotation.z=Math.sin(phase*.5)*.06+(h.guarded?.10:0);a.head.rotation.y=h.side*.18;
          a.arms[0].rotation.z=-.16+Math.sin(phase)*.045;a.arms[1].rotation.z=.16-Math.sin(phase)*.045;
          if(a.kind==='wizard')a.arms[0].rotation.x=Math.sin(phase)*.3;
        } else {hm.root.position.y=.76;hm.root.userData.roll.rotation.y=h.x*1.45;hm.root.rotation.z=Math.sin(t*8)*.08;}
        hm.mark.visible=running&&ahead<13&&ahead>-2.6;
        hm.markMat.color.set(held?'#9be8c3':ahead<4.8?'#ffbd76':'#cba76b');
        hm.markMat.opacity=clamp((13-ahead)/5,0,.68)*(ahead<-1?clamp((ahead+2.6)/1.6,0,1):1);
        hm.mark.scale.setScalar(1+Math.sin(t*5)*.024);
        hm.bubble.visible=running&&ahead<10.8&&ahead>-.5;
        hm.bubble.position.set(h.x,h.kind==='wizard'?4.0:h.kind==='orc'?3.6:h.kind==='dwarf'?3.0:2.0,-h.s);
        hm.bubble.material.opacity=clamp((11-ahead)*.75,0,.92)*clamp((ahead+.5),0,1);
      }
      for(let i=0;i<this.greeters.length;i++){
        const p=this.greeters[i];p.group.visible=d<23;p.head.rotation.z=Math.sin(t*1.8+i)*.09;p.group.position.y=Math.sin(t*2+i)*.025;
      }
      const dp=this.dust.geometry.attributes.position.array;
      for(let i=0;i<this.dustSeed.length;i++) {
        const s=this.dustSeed[i];dp[i*3]=s.x+Math.sin(t*.3+s.phase)*.25;dp[i*3+1]=s.y+Math.sin(t*.5+s.phase)*.16;dp[i*3+2]=-d+9-((s.z+t*.14)%58);
      }
      this.dust.geometry.attributes.position.needsUpdate=true;
      const targetOffset=(mode==='ready'||mode==='result')&&this.aspect>1.14?Math.min(3.55,this.aspect*1.72):0;
      this.offset+=(targetOffset-this.offset)*(1-Math.exp(-dt*4));
      const serving=(mode==='settling'||mode==='result')&&core.result&&core.result.served>0;
      this.serve+=((serving?1:0)-this.serve)*(1-Math.exp(-dt*4));
      this.rig.position.set(this.offset,Math.sin(t*1.7)*.036+this.serve*.20,-this.serve*.65);
      if(mode==='settling'&&serving)this.rig.position.y+=Math.sin(Math.min(1,finishAge/.95)*Math.PI)*.23;
      if(mode==='result'&&this.aspect<1.14)this.rig.position.y=-.30;
      const gait=running?Math.sin(d*3.4)*.029*(1-this.brace*.7):Math.sin(t*1.5)*.025;
      this.tray.position.set(Math.sin(d*1.7)*.027*(running?1:0),gait+this.brace*.10,0);
      this.tray.rotation.z=-core.tiltX*.21+(running?Math.sin(d*1.7)*.014:Math.sin(t*1.3)*.015);
      this.tray.rotation.x=core.tiltZ*.16-this.brace*.025;
      this.tray.rotation.y=Math.sin(t*1.2)*.015;
      this.steadyMat.opacity=this.brace*.6;
      for(let i=0;i<3;i++) {
        const drink=this.drinks[i];drink.fill+=(core.fill[i]-drink.fill)*(1-Math.exp(-dt*8));
        const f=Math.max(.005,drink.fill),height=1.16*f,radius=.353+.057*f;
        drink.liquid.scale.set(radius,height,radius);drink.liquid.position.y=.16+height/2;drink.liquid.visible=f>.007;
        drink.surface.position.y=.16+height;drink.surface.scale.setScalar(radius/.408);drink.surface.visible=f>.007;
        drink.surface.rotation.z=core.tiltX*.12+Math.sin(t*3+i)*.012*(1-this.brace);
        drink.surface.rotation.x=-core.tiltZ*.1+Math.cos(t*3.3+i)*.011*(1-this.brace);
        drink.root.rotation.z=-core.tiltX*(.13+i*.02)+Math.sin(t*2.0+i)*.014;
        drink.root.rotation.x=core.tiltZ*.13;
        drink.root.position.y=.13+Math.abs(Math.sin(d*3.4+i*.4))*.017*(running?1:0);
        if(mode==='settling'&&serving){const pop=clamp((finishAge-i*.13)/.48,0,1);drink.root.position.y+=Math.sin(pop*Math.PI)*.28;}
        drink.face.position.y=Math.max(.32,.16+height-.23);drink.face.visible=f>.06;
        const afraid=this.shake>.05||drink.fill<.27;
        const blink=Math.sin(t*.7+i*1.9)>.997;
        drink.eyes.forEach(e=>e.scale.y=blink?.011:afraid?.10:this.brace>.5?.045:.069);
        drink.brows.forEach((b,j)=>b.rotation.z=(j?1:-1)*(afraid?.47:this.brace>.5?-.08:.21));
        drink.smile.visible=this.brace>.3||mode==='result'||mode==='ready';drink.mouth.visible=!drink.smile.visible;
        drink.mouth.scale.y=afraid?.10:.047;
        drink.bubbles.forEach((b,j)=>b.position.y=.033+Math.sin(t*2.4+j+i)*.014);
      }
      for(const p of this.particles) {
        if(p.age>=p.life){p.mesh.visible=false;continue;}p.age+=dt;p.v.y-=dt*(p.type===0?7.0:.65);p.mesh.position.addScaledVector(p.v,dt);
        p.mesh.rotation.x+=dt*4;p.mesh.rotation.z+=dt*3;
        if(p.age>p.life*.7)p.mesh.scale.multiplyScalar(Math.max(0,1-dt*5));
      }
      this.renderer.clear();this.renderer.render(this.scene,this.camera);this.renderer.clearDepth();this.renderer.render(this.viewScene,this.viewCamera);
    }
  }
  root.PintsTavern=Tavern;
})(window);
