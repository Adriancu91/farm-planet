// Farm Planet — main game
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { prepareLibrary, retargetClip } from './retarget.js';
import * as D from './data.js';
const {CROPS,EXOTIC,RARITY,ANIMALS,TREES,FISH,FORAGE,ORES,GOODS,FACTORIES,BUILD,PASSIVE,DECOR,TOOLS,UPGRADES,FARM_LEVELS,PEN_COST,PLOTS_PER_FIELD,VEH,WORKERS,CHARS,OUTFIT_COLORS,HAIR_COLORS,ACCS,FACES,BACKS,PETS,FRIENDS,DAILY,ACHIEVE,ACH_REWARD}=D;

const A = window.FP_ASSETS || 'assets/';
const MOBILE = matchMedia('(pointer:coarse)').matches;

/* ================= UTILS ================= */
const $ = s => document.querySelector(s);
const rand = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const sstep = (a,b,x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const lerp = (a,b,t) => a + (b-a)*t;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const wpick = (list,wf=x=>x.w) => {const tot=list.reduce((s,x)=>s+wf(x),0);let r=Math.random()*tot;for(const x of list){r-=wf(x);if(r<=0)return x;}return list[0];};
function distSeg(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az;const t=clamp(((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(px-(ax+dx*t),pz-(az+dz*t));}
function angLerp(a,b,t){let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*t;}
function seeded(s){return()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};}
const fmtTime=s=>{s=Math.max(0,Math.ceil(s));return s>=3600?`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`:s>=60?`${Math.floor(s/60)}m ${s%60}s`:`${s}s`;};
const fmt=n=>Math.round(n).toLocaleString('ro-RO');
const today=()=>new Date().toISOString().slice(0,10);

/* ================= STATE ================= */
function defState(){return{coins:25,xp:0,lv:1,inv:{},eggs:0,gold:0,
  plots:Array.from({length:PLOTS_PER_FIELD},()=>({c:null,p:0})),unl:4,fields:1,farmLv:0,own:{},pens:1,animals:[],seen:{},
  look:{ch:'e',acc:'paie',face:'none',back:'none',hc:0,cloth:0,hair:null},chars:{e:true,d:true},accs:{none:true,paie:true},faces:{none:true},backs:{none:true},cloths:{0:true},
  fr:{},st:{plant:0,harv:0,sold:0,eggs:0,hatch:0,help:0,orders:0,fish:0,made:0,forage:0,mine:0,prod:0,rare:0},seed:'morcov',tut:false,aid:1,pos:null,
  lay:{},decor:[],trees:{},fac:{},orders:[],up:{hambarCap:0,stropitoare:0,tarcCap:0,pusculita:0,limonada:0,pensiune:0,stupi:0,sera:0,linii:0,companion:0},
  pass:{pusculita:0,limonada:0,pensiune:0},hive:0,gh:[],pets:{},pet:null,last:Date.now(),daily:{d:'',streak:0},dn:1,
  work:{},dm:{d:'',list:[]},ach:{}};}
let S=defState();
try{const raw=localStorage.getItem(D.SAVE_KEY);if(raw){const d=JSON.parse(raw);S=Object.assign(defState(),d);for(const k of ['st','up','look','daily','pass','dm'])S[k]=Object.assign(defState()[k],d[k]||{});}}catch(e){}
// --- migrations from older versions ---
if(!CHARS[S.look.ch])S.look.ch='e';
const OLDA={rata:'gaina',iepure:'catel',capra:'oaie',panda:'zebra'};
S.animals=(S.animals||[]).map(a=>Object.assign(a,{t:OLDA[a.t]||a.t,r:a.r||0})).filter(a=>ANIMALS[a.t]);
{const sn={};for(const k in S.seen){const key=k.includes(':')?k:(OLDA[k]||k)+':0';if(ANIMALS[key.split(':')[0]])sn[key]=true;}for(const a of S.animals)sn[a.t+':'+a.r]=true;S.seen=sn;}
{const byName={};for(const a of Object.values(ANIMALS))byName[a.prod.n]=a.prod.id;const inv={};for(const [k,n] of Object.entries(S.inv)){if(!(n>0))continue;const id=byName[k]||k;inv[id]=(inv[id]||0)+n;}S.inv=inv;}
for(const id of ['pusculita','limonada','pensiune','stupi','sera'])if(S.own[id]&&!S.up[id]&&UPGRADES[id].need)S.up[id]=id==='sera'?0:1;
while(S.plots.length<S.fields*PLOTS_PER_FIELD)S.plots.push({c:null,p:0});
S.plots.forEach(p=>{if(p.c&&!CROPS[p.c])p.c='salata';});
if(!CROPS[S.seed])S.seed='morcov';
if(S.pig&&!S.pass.pusculita){S.pass.pusculita=S.pig;}delete S.pig;
S.farmLv=Math.min(S.farmLv||0,FARM_LEVELS.length-1);
let player=null;
function save(){if(player)S.pos=[player.pos.x,player.pos.z];S.last=Date.now();try{localStorage.setItem(D.SAVE_KEY,JSON.stringify(S))}catch(e){}}

/* ================= SOUND ================= */
let AC=null;
function snd(f=600,d=.12,type='sine',v=.12){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+d+.02);}catch(e){}}
const sfx={
  coin:()=>{snd(880,.08,'square',.05);setTimeout(()=>snd(1320,.14,'square',.05),70)},
  pick:()=>{snd(520,.1,'triangle');setTimeout(()=>snd(780,.15,'triangle'),70)},
  jump:()=>snd(380,.15,'triangle',.1), plant:()=>snd(260,.12,'triangle',.14),
  hatch:()=>[523,659,784,1046].forEach((f,i)=>setTimeout(()=>snd(f,.22,'triangle',.12),i*110)),
  sad:()=>{snd(330,.25,'sine',.1);setTimeout(()=>snd(240,.4,'sine',.1),220)},
  no:()=>snd(160,.18,'square',.05),
  lvl:()=>[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>snd(f,.25,'square',.06),i*120)),
  hit:()=>snd(140,.08,'square',.08),
};

/* ================= RENDERER ================= */
const canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.4:1.75));
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const FOG=0xd4e9f7; scene.fog=new THREE.Fog(FOG,100,380);
const camera=new THREE.PerspectiveCamera(58,1,.08,1600);
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize); resize();
const matCache={};
function mat(color,o={}){const k=color+JSON.stringify(o);if(!matCache[k])matCache[k]=new THREE.MeshStandardMaterial(Object.assign({color,roughness:.8,metalness:0},o));return matCache[k];}
const SPH=new THREE.SphereGeometry(1,20,14), CYL=new THREE.CylinderGeometry(1,1,1,20), CONE=new THREE.ConeGeometry(1,1,16), BOX=new THREE.BoxGeometry(1,1,1);
function M(geo,m,x=0,y=0,z=0,par,shadow=true){const o=new THREE.Mesh(geo,typeof m==='number'?mat(m):m);o.position.set(x,y,z);if(shadow){o.castShadow=true;o.receiveShadow=true;}if(par)par.add(o);return o;}
function E(geo,m,x,y,z,sx,sy,sz,par,shadow=true){const o=M(geo,m,x,y,z,par,shadow);o.scale.set(sx,sy,sz);return o;}

/* ================= SKY / LIGHT ================= */
const SUN_DIR=new THREE.Vector3(.55,.62,.36).normalize();
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:new THREE.Color(0x2f86e0)},mid:{value:new THREE.Color(0x8cc4f2)},bot:{value:new THREE.Color(FOG)},sunDir:{value:SUN_DIR}},
  vertexShader:'varying vec3 vP;void main(){vP=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
  fragmentShader:`uniform vec3 top;uniform vec3 mid;uniform vec3 bot;uniform vec3 sunDir;varying vec3 vP;
  void main(){float h=vP.y;vec3 c=h>0.?mix(mid,top,pow(clamp(h,0.,1.),.7)):bot;c=mix(bot,c,smoothstep(-.02,.18,h));
  float s=max(dot(normalize(vP),sunDir),0.);c+=vec3(1.,.93,.75)*(pow(s,900.)*4.+pow(s,30.)*.25);gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,32,16),skyMat); sky.frustumCulled=false; sky.renderOrder=-1; sky.layers.enable(1); scene.add(sky);
{const pm=new THREE.PMREMGenerator(renderer);const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(10,32,16),skyMat));
  const g=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({color:0x5a7a40}));g.rotation.x=-Math.PI/2;g.position.y=-1;es.add(g);
  scene.environment=pm.fromScene(es,0.04).texture;}
const hemi=new THREE.HemisphereLight(0xdcefff,0x7a8f55,.75); hemi.layers.enable(1); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0d8,3.0); sun.castShadow=true; const SM=MOBILE?1024:2048; sun.shadow.mapSize.set(SM,SM);
Object.assign(sun.shadow.camera,{left:-44,right:44,top:44,bottom:-44,near:1,far:240}); sun.shadow.bias=-.0004; sun.shadow.normalBias=.035;
sun.layers.enable(1); scene.add(sun); scene.add(sun.target);
const cloudTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');for(let i=0;i<14;i++){const x=rand(30,98),y=rand(45,85),r=rand(18,34);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;})();
const clouds=[];for(let i=0;i<34;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,fog:false,transparent:true,opacity:rand(.6,.95),depthWrite:false}));const s=rand(80,170);sp.scale.set(s,s*.55,1);sp.position.set(rand(-750,750),rand(140,220),rand(-750,750));scene.add(sp);clouds.push(sp);}

/* ================= LOADING ================= */
const manager=new THREE.LoadingManager();
manager.onProgress=(u,l,t)=>{const b=$('#barI');if(b)b.style.width=Math.round(l/t*100)+'%';};
const gltfL=new GLTFLoader(manager); gltfL.setMeshoptDecoder(MeshoptDecoder);
const vrmL=new GLTFLoader(); vrmL.register(p=>new VRMLoaderPlugin(p));
const texL=new THREE.TextureLoader(manager);
const loadGLB=u=>new Promise((res,rej)=>gltfL.load(A+u,res,undefined,rej));
const loadTex=u=>new Promise((res,rej)=>texL.load(A+u,t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;res(t);},undefined,rej));
function loadVRMFile(id,onProg){return new Promise((res,rej)=>vrmL.load(A+'chars/'+id+'.vrm',res,onProg,rej));}
const ANI_FILES=[...new Set(Object.values(ANIMALS).filter(a=>!['slime','dragon'].includes(a.f)).map(a=>a.f))];
const [VIL,NAT,CRP,TX,ANI,TRC,SUV,PETM,UAL]=await Promise.all([
  loadGLB('env/village.glb'),loadGLB('env/nature.glb'),loadGLB('env/crops.glb'),
  Promise.all(['grass','forest','path','soil','rock','snow'].map(n=>loadTex('tex/'+n+'.jpg'))).then(a=>({grass:a[0],forest:a[1],path:a[2],soil:a[3],rock:a[4],snow:a[5]})),
  Promise.all(ANI_FILES.map(f=>loadGLB('animals/'+f+'.glb').then(g=>[f,g]))).then(a=>Object.fromEntries(a)),
  loadGLB('env/tractor.glb'),loadGLB('env/suv.glb'),
  Promise.all(['dragon','slime','bat'].map(f=>loadGLB('pets/'+f+'.glb').then(g=>[f,g]))).then(a=>Object.fromEntries(a)),
  loadGLB('anim/ual.glb'),
]);
const LIB=prepareLibrary(UAL);
function partsOf(gltf){const P={};for(const k of [...gltf.scene.children]){const w=new THREE.Group();w.name=k.name;w.add(k);P[k.name]=w;const st=k.name.replace(/_1$/,'');if(!P[st])P[st]=w;}
  for(const w of Object.values(P))w.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return P;}
const VP=partsOf(VIL), NP=partsOf(NAT), CP=partsOf(CRP);
const eachMat=(P,fn)=>{const seen=new Set();for(const w of Object.values(P))w.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(!seen.has(m)){seen.add(m);fn(m);}});};
{const CC={_defaultMat:0xd9b04a,grass:0x5aa83a,leafsGreen:0x4f9a34,leafsDark:0x3a7d2c,leafsFall:0xff7a1f,corn:0xe0b03a,woodBirch:0xe2bc5c,woodInner:0xd9b070,dirt:0xd96a2b,dirtDark:0x5a3a26,wood:0x9a6438,woodDark:0x6b4226,stone:0x9aa0a6,colorRed:0xd8403a,woodBarkDark:0x5d4030};
  eachMat(CP,m=>{if(CC[m.name]!==undefined)m.color.setHex(CC[m.name]);m.roughness=.85;m.metalness=0;});}
eachMat(VP,m=>m.side=THREE.DoubleSide);
function piece(P,name,x=0,y=0,z=0,ry=0,s=1,par){const src=P[name];if(!src){console.warn('missing',name);return new THREE.Group();}const o=src.clone();o.position.set(x,y,z);o.rotation.y=ry;o.scale.setScalar(s);(par||scene).add(o);return o;}
const GET=['getX','getY','getZ','getW'];
function toF32(a){if(!a.isInterleavedBufferAttribute&&a.array instanceof Float32Array&&!a.normalized)return a.clone();const n=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let c=0;c<a.itemSize;c++)n[i*a.itemSize+c]=a[GET[c]](i);return new THREE.BufferAttribute(n,a.itemSize);}
function bake(g){g.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(g.matrixWorld).invert();const by=new Map(),rm=[];
  g.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh||o.isInstancedMesh||Array.isArray(o.material)||o.userData.keep)return;rm.push(o);
    const src=o.geometry,geo=new THREE.BufferGeometry();for(const n of ['position','normal','uv'])if(src.attributes[n])geo.setAttribute(n,toF32(src.attributes[n]));if(src.index)geo.setIndex(src.index.clone());
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));if(!by.has(o.material))by.set(o.material,{l:[],c:o.castShadow});by.get(o.material).l.push(geo);});
  for(const o of rm)o.parent.remove(o);
  for(const [m,{l,c}] of by){const names=['position','normal','uv'].filter(n=>l.every(gm=>gm.attributes[n]));const idx=l.every(gm=>gm.index);
    const list=l.map(gm=>{for(const n of Object.keys(gm.attributes))if(!names.includes(n))gm.deleteAttribute(n);return idx?gm:gm.index?gm.toNonIndexed():gm;});
    const merged=mergeGeometries(list,false);if(!merged)continue;const mesh=new THREE.Mesh(merged,m);mesh.castShadow=c;mesh.receiveShadow=true;g.add(mesh);}
  return g;}

/* ================= SPRITES ================= */
const spriteCache={};
function textSprite(text,{bg='rgba(255,250,240,.95)',fg='#3b2a1a',size=1,font=56,depth=true}={}){
  const k=text+bg+fg+font; let tex=spriteCache[k];
  if(!tex){const cv=document.createElement('canvas'),g=cv.getContext('2d');g.font=`800 ${font}px "Baloo 2", system-ui, sans-serif`;
    const w=Math.ceil(g.measureText(text).width)+(bg?44:12),h=font+(bg?30:16);cv.width=w;cv.height=h;g.font=`800 ${font}px "Baloo 2", system-ui, sans-serif`;
    if(bg){g.fillStyle=bg;g.strokeStyle='#fff';g.lineWidth=8;const r=h/2;g.beginPath();g.moveTo(r,4);g.lineTo(w-r,4);g.arc(w-r,h/2,h/2-4,-Math.PI/2,Math.PI/2);g.lineTo(r,h-4);g.arc(r,h/2,h/2-4,Math.PI/2,Math.PI*1.5);g.fill();g.stroke();}
    g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';g.fillText(text,w/2,h/2+font*.06);
    tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.minFilter=THREE.LinearFilter;tex.userData={w,h};spriteCache[k]=tex;}
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:depth,transparent:true,fog:false}));
  sp.scale.set(.7*size*tex.userData.w/tex.userData.h,.7*size,1);sp.renderOrder=5;return sp;}
const emoji=(e,size=1)=>textSprite(e,{bg:null,size,font:90});
function label(par,text,y,opts){const s=textSprite(text,Object.assign({size:1.3},opts));s.position.y=y;par.add(s);return s;}

/* ================= WORLD / TERRAIN ================= */
const LAKES=[{x:-95,z:85,r:20},{x:150,z:30,r:12},{x:-40,z:-140,r:11},{x:60,z:200,r:14}];
const WR=420;
function noise(x,z){return Math.sin(x*.05)*Math.cos(z*.045)*2.2+Math.sin(x*.13+1.3)*Math.sin(z*.11+.7)*.9+Math.sin(x*.31+z*.27)*.25;}
function H(x,z){
  const sq=Math.max(Math.abs(x),Math.abs(z)),r=Math.hypot(x,z);
  let h=noise(x,z)*sstep(88,112,sq)*1.25;
  for(const f of FRIENDS){const d=Math.hypot(x-f.x,z-f.z);h*=sstep(14,26,d);}
  for(const L of LAKES){const ld=Math.hypot(x-L.x,z-L.z);h=lerp(h,-2.4,sstep(L.r+3,L.r-4,ld));}
  const m=sstep(300,410,r);const a=Math.atan2(z,x);
  h+=m*m*70*(.72+.28*Math.sin(a*6+r*.04))+m*noise(x*2.3,z*2.3)*5;
  h+=Math.max(0,Math.sin(x*.021+1)*Math.cos(z*.019-.5))*10*sstep(120,160,sq)*(1-sstep(270,310,r));
  return h;}
const PATHS=FRIENDS.map(f=>[0,0,f.x,f.z]);
function onPath(x,z){let d=99;for(const p of PATHS)d=Math.min(d,distSeg(x,z,...p));return d;}
function nearFriend(x,z,r){return FRIENDS.some(f=>Math.hypot(x-f.x,z-f.z)<r);}
function inLake(x,z,m=0){return LAKES.some(L=>Math.hypot(x-L.x,z-L.z)<L.r+m);}
const FARM_MAX=FARM_LEVELS[FARM_LEVELS.length-1].F;
{
  const TS=900,SEG=MOBILE?230:300;const tg=new THREE.PlaneGeometry(TS,TS,SEG,SEG);tg.rotateX(-Math.PI/2);
  const pos=tg.attributes.position,n=pos.count,cols=new Float32Array(n*3),spl=new Float32Array(n*4);
  for(let i=0;i<n;i++){const x=pos.getX(i),z=pos.getZ(i),y=H(x,z);pos.setY(i,y);const sq=Math.max(Math.abs(x),Math.abs(z));
    const v=.88+noise(x*2.1,z*2.1)*.05+Math.sin(x*.7)*Math.sin(z*.6)*.03;cols[i*3]=v;cols[i*3+1]=v;cols[i*3+2]=v;
    let path=0;const pd=onPath(x,z);if(sq>FARM_MAX+2)path=sstep(3,1.6,pd);
    for(const L of LAKES){const ld=Math.hypot(x-L.x,z-L.z);if(ld<L.r+4)path=Math.max(path,sstep(L.r+4,L.r+1,ld));}
    const forest=sstep(0,.9,noise(x*.9+40,z*.9-20)+.3)*sstep(90,115,sq)*.85;
    spl[i*4]=path;spl[i*4+1]=forest;spl[i*4+2]=sstep(11,19,y);spl[i*4+3]=sstep(40,50,y);}
  tg.setAttribute('color',new THREE.BufferAttribute(cols,3));tg.setAttribute('splat',new THREE.BufferAttribute(spl,4));tg.computeVertexNormals();
  const tm=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,envMapIntensity:.6});
  tm.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{tG:{value:TX.grass},tF:{value:TX.forest},tP:{value:TX.path},tR:{value:TX.rock},tS:{value:TX.snow}});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 splat;varying vec4 vSplat;varying vec3 vWp;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvSplat=splat;vWp=(modelMatrix*vec4(position,1.)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tG;uniform sampler2D tF;uniform sampler2D tP;uniform sampler2D tR;uniform sampler2D tS;varying vec4 vSplat;varying vec3 vWp;')
      .replace('#include <map_fragment>',`vec2 uw=vWp.xz;
        vec3 tc=mix(texture2D(tG,uw*.13).rgb,texture2D(tG,uw*.031+.37).rgb,.45);tc=mix(tc,vec3(dot(tc,vec3(.3,.59,.11))),-.35)*vec3(1.05,1.22,.78);
        tc=mix(tc,texture2D(tF,uw*.1).rgb,vSplat.y*.7);
        tc=mix(tc,texture2D(tP,uw*.16).rgb,vSplat.x);
        tc=mix(tc,texture2D(tR,uw*.05).rgb*1.1,vSplat.z);
        tc=mix(tc,texture2D(tS,uw*.07).rgb*1.15,vSplat.w);
        diffuseColor.rgb*=tc*1.45;`);};
  const ter=new THREE.Mesh(tg,tm);ter.receiveShadow=true;scene.add(ter);
  const wm=new THREE.MeshStandardMaterial({color:0x2f8fc4,roughness:.06,metalness:.1,transparent:true,opacity:.85,envMapIntensity:1.4});
  for(const L of LAKES){const w=new THREE.Mesh(new THREE.CircleGeometry(L.r+1.6,64),wm);w.rotation.x=-Math.PI/2;w.position.set(L.x,-.55,L.z);scene.add(w);}
}

/* ================= INSTANCING HELPERS ================= */
const _v=new THREE.Vector3(),_s=new THREE.Vector3(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_m=new THREE.Matrix4();
function templateParts(obj){obj.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(obj.matrixWorld).invert();const parts=[];
  obj.traverse(o=>{if(o.isMesh)parts.push({geo:o.geometry,mat:o.material,rel:new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld)});});return parts;}
const depthMats=new Map();
function depthFor(m){if(Array.isArray(m)||!m.alphaTest||!m.map)return null;if(!depthMats.has(m))depthMats.set(m,new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:m.map,alphaTest:m.alphaTest}));return depthMats.get(m);}
function instance(obj,mats,{shadow=true,parent=scene}={}){const out=[];if(!obj||!mats.length)return out;
  for(const p of templateParts(obj)){const im=new THREE.InstancedMesh(p.geo,p.mat,mats.length);
    mats.forEach((m,i)=>{_m.multiplyMatrices(m,p.rel);im.setMatrixAt(i,_m);});
    im.castShadow=shadow;im.receiveShadow=true;const dm=depthFor(p.mat);if(dm)im.customDepthMaterial=dm;
    im.computeBoundingSphere();parent.add(im);out.push(im);}return out;}
const TM=(x,y,z,ry=0,s=1,sy)=>new THREE.Matrix4().compose(_v.set(x,y,z),_q.setFromEuler(_e.set(0,ry,0)),_s.set(s,sy??s,s));

/* ================= COLLIDERS ================= */
const colliders=[];
const addCirc=(x,z,r)=>{const c={x,z,r};colliders.push(c);return c;};
const addBoxC=(x,z,hw,hd)=>{const c={x,z,hw,hd};colliders.push(c);return c;};
for(const L of LAKES)addCirc(L.x,L.z,L.r-1.5);

/* ================= NATURE ================= */
const chunks=[];
const wildOK=(x,z,m=0)=>Math.max(Math.abs(x),Math.abs(z))>FARM_MAX+6+m;
{
  const rnd=seeded(1234);
  const TR=['CommonTree_1','CommonTree_3','CommonTree_5','Pine_2','Pine_4','Pine_5'];
  const pts=[];
  for(let k=0;k<16000&&pts.length<(MOBILE?620:860);k++){
    const a=rnd()*6.283,r=Math.sqrt(rnd())*330+40;const x=Math.cos(a)*r,z=Math.sin(a)*r;const sq=Math.max(Math.abs(x),Math.abs(z));
    if(!wildOK(x,z,2))continue;if(nearFriend(x,z,24))continue;if(onPath(x,z)<5)continue;if(inLake(x,z,5))continue;
    const y=H(x,z);if(y>28)continue;if(sq<110&&rnd()<.6)continue;
    const pine=y>6||r>270||rnd()<.45;const t=pine?TR[3+Math.floor(rnd()*3)]:TR[Math.floor(rnd()*3)];
    pts.push({x,z,y,t,s:.75+rnd()*.45,ry:rnd()*6.28});addCirc(x,z,.6);}
  const CS=80,map={};
  for(const p of pts){const k=Math.floor(p.x/CS)+','+Math.floor(p.z/CS);(map[k]=map[k]||[]).push(p);}
  const proxyTrunk=new THREE.CylinderGeometry(.25,.4,3,6);proxyTrunk.translate(0,1.5,0);
  const proxyCrown=new THREE.ConeGeometry(2.6,6.5,7);proxyCrown.translate(0,5.5,0);
  const pmT=mat(0x5b3d26),pmC=mat(0x3f6e33,{roughness:1});
  for(const k in map){const list=map[k];const g=new THREE.Group(),f=new THREE.Group();scene.add(g);scene.add(f);
    const byT={};list.forEach(p=>(byT[p.t]=byT[p.t]||[]).push(TM(p.x,p.y-.1,p.z,p.ry,p.s)));
    for(const t in byT)instance(NP[t],byT[t],{parent:g});
    const all=list.map(p=>TM(p.x,p.y-.1,p.z,p.ry,p.s));
    const a=new THREE.InstancedMesh(proxyTrunk,pmT,all.length),b=new THREE.InstancedMesh(proxyCrown,pmC,all.length);
    all.forEach((m,i)=>{a.setMatrixAt(i,m);b.setMatrixAt(i,m);});a.computeBoundingSphere();b.computeBoundingSphere();f.add(a,b);
    const cx=list.reduce((s,p)=>s+p.x,0)/list.length,cz=list.reduce((s,p)=>s+p.z,0)/list.length;chunks.push({g,f,x:cx,z:cz});f.visible=false;}
  const scatter=(name,count,rmin,rmax,smin,smax)=>{count=Math.round(count*(MOBILE?.6:1));const ms=[];for(let k=0;k<count*6&&ms.length<count;k++){const a=rnd()*6.283,r=rmin+rnd()*(rmax-rmin);const x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(!wildOK(x,z)||nearFriend(x,z,14)||onPath(x,z)<3.2||inLake(x,z,2))continue;const y=H(x,z);if(y>18)continue;ms.push(TM(x,y,z,rnd()*6.28,smin+rnd()*(smax-smin)));}
    instance(NP[name],ms,{shadow:false});};
  scatter('Bush_Common',180,90,320,.8,1.3);scatter('Bush_Common_Flowers',120,90,280,.8,1.2);
  scatter('Flower_3_Group',170,88,250,.35,.55);scatter('Flower_4_Group',170,88,250,.35,.55);
  scatter('Fern_1',170,100,320,.6,1);scatter('Plant_1_Big',70,100,300,.5,.8);scatter('Mushroom_Common',90,100,320,.6,1);scatter('Mushroom_Laetiporus',35,100,320,.5,.8);
  scatter('Grass_Wispy_Tall',210,88,300,.45,.7);scatter('Grass_Common_Tall',230,88,300,.45,.7);
  const rocks=[];for(let k=0;k<900&&rocks.length<240;k++){const a=rnd()*6.283,r=100+rnd()*310;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(!wildOK(x,z)||nearFriend(x,z,18)||onPath(x,z)<4||inLake(x,z,2))continue;const s=r>290?2+rnd()*4:.5+rnd()*.9;rocks.push([x,z,s]);if(s>1.2)addCirc(x,z,s*1.3);}
  ['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'].forEach((name,i)=>instance(NP[name],rocks.filter((_,j)=>j%3===i).map(([x,z,s])=>TM(x,H(x,z)-.2*s,z,x*7%6,s))));
  for(const L of LAKES){const lil=[],reeds=[];for(let i=0;i<Math.round(L.r*1.1);i++){const a=rand(0,6.28),r=rand(2,L.r-2);lil.push(TM(L.x+Math.cos(a)*r,-.52,L.z+Math.sin(a)*r,rand(0,6),rand(2,3)));}
    for(let i=0;i<L.r*2.4;i++){const a=rand(0,6.28),r=L.r+rand(-.5,1.5);const x=L.x+Math.cos(a)*r,z=L.z+Math.sin(a)*r;reeds.push(TM(x,H(x,z),z,rand(0,6),rand(.5,.8)));}
    instance(CP['lily_large'],lil,{shadow:false});instance(NP['Grass_Wispy_Tall'],reeds,{shadow:false});
    const sign=new THREE.Group();sign.position.set(L.x+L.r+2.5,H(L.x+L.r+2.5,L.z),L.z);scene.add(sign);E(CYL,0x6b4226,0,.8,0,.07,1.6,.07,sign);label(sign,'🎣 Lac',2.1,{size:.9});}
}
const grassUni={uTime:{value:0}};
const farmGrass={};
{
  const cv=document.createElement('canvas');cv.width=128;cv.height=128;const g=cv.getContext('2d');
  for(let i=0;i<34;i++){const x=rand(8,120),hgt=rand(60,124),w=rand(3,6),bend=rand(-18,18);const gr=g.createLinearGradient(0,128,0,128-hgt);gr.addColorStop(0,'#3d6b22');gr.addColorStop(1,i%3?'#a8d65a':'#c9e27a');g.fillStyle=gr;
    g.beginPath();g.moveTo(x-w,128);g.quadraticCurveTo(x+bend*.4,128-hgt*.6,x+bend,128-hgt);g.quadraticCurveTo(x+bend*.4+w*.3,128-hgt*.6,x+w,128);g.fill();}
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  const P=[],U=[],I=[];for(let i=0;i<3;i++){const p=new THREE.PlaneGeometry(.9,.6);p.translate(0,.3,0);p.rotateY(i*Math.PI/3);P.push(...p.attributes.position.array);U.push(...p.attributes.uv.array);const o=i*4;p.index.array.forEach(v=>I.push(v+o));}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  const nrm=new Float32Array(P.length);for(let i=1;i<nrm.length;i+=3)nrm[i]=1;geo.setAttribute('normal',new THREE.BufferAttribute(nrm,3));geo.setIndex(I);
  const gm=new THREE.MeshStandardMaterial({map:tex,alphaTest:.45,side:THREE.DoubleSide,roughness:1});
  gm.onBeforeCompile=sh=>{sh.uniforms.uTime=grassUni.uTime;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 ip=instanceMatrix[3];float hh=uv.y;transformed.x+=sin(uTime*1.7+ip.x*.35+ip.z*.25)*.13*hh;transformed.z+=cos(uTime*1.3+ip.z*.3)*.08*hh;');};
  const N=MOBILE?5000:9000;const im=new THREE.InstancedMesh(geo,gm,N);let c=0;const col=new THREE.Color();
  for(let k=0;k<N*4&&c<N;k++){const a=rand(0,6.283),r=Math.sqrt(Math.random())*220+FARM_MAX;const x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(!wildOK(x,z))continue;if(onPath(x,z)<2.6)continue;if(inLake(x,z,1))continue;const y=H(x,z);if(y>12)continue;
    if(FRIENDS.some(f=>Math.abs(x-f.x)<12&&Math.abs(z-f.z)<12))continue;
    im.setMatrixAt(c,TM(x,y-.02,z,rand(0,6.28),rand(.7,1.35),rand(.7,1.5)));col.setHSL(rand(.2,.28),rand(.45,.65),rand(.42,.6));im.setColorAt(c,col);c++;}
  im.count=c;im.receiveShadow=true;im.castShadow=false;im.computeBoundingSphere();scene.add(im);
  Object.assign(farmGrass,{geo,gm,im:null});
}

/* ================= PLACEABLES ================= */
const PL={};const spinners=[];
function fpSize(o){return (o.r%2)?[o.d/2,o.w/2]:[o.w/2,o.d/2];}
function farmF(){return FARM_LEVELS[S.farmLv].F;}
function setPlace(o,x,z,r=o.r||0){o.x=x;o.z=z;o.r=r;o.g.position.set(x,H(x,z),z);o.g.rotation.y=-r*Math.PI/2;
  if(o.col){const [hw,hd]=fpSize(o);o.col.x=x;o.col.z=z;o.col.hw=Math.max(.1,hw-(o.pad||0));o.col.hd=Math.max(.1,hd-(o.pad||0));}
  S.lay[o.key]={x,z,r};if(o.onMove)o.onMove();}
function canPlace(o,x,z,r){const tmp={w:o.w,d:o.d,r};const [hw,hd]=fpSize(tmp);const F=farmF()-.6;if(Math.abs(x)+hw>F||Math.abs(z)+hd>F)return false;
  if(Math.abs(x)<3+hw&&z+hd>F-6)return false;
  for(const k in PL){const p=PL[k];if(p===o)continue;const [pw,pd]=fpSize(p);if(Math.abs(p.x-x)<hw+pw+.2&&Math.abs(p.z-z)<hd+pd+.2)return false;}return true;}
function findSpot(w,d,pref){const F=farmF();const tmp={w,d,r:0};
  if(pref&&canPlace(tmp,pref[0],pref[1],0))return pref;
  for(let rad=0;rad<F*1.5;rad+=1)for(let a=0;a<28;a++){const x=Math.round((pref?pref[0]:0)+Math.cos(a/28*6.283)*rad),z=Math.round((pref?pref[1]:0)+Math.sin(a/28*6.283)*rad);if(canPlace(tmp,x,z,0))return [x,z];}
  return [rand(-F+5,F-5),rand(-F+5,F-5)];}
function addPlace(key,{w,d,build,collider='box',pad=0,def,label:lb,ly,onMove}){
  const g=new THREE.Group();scene.add(g);const o={key,g,w,d,r:0,pad,onMove};build(g,o);
  if(lb)o.lbl=label(g,lb,ly||4);
  if(collider==='box')o.col=addBoxC(0,0,1,1);
  PL[key]=o;const L=S.lay[key];let pos=L?[L.x,L.z]:null;const r=L?L.r:0;
  if(!pos)pos=findSpot(w,d,def);o.r=r;setPlace(o,pos[0],pos[1],r);return o;}

function houseBox(par,{w=6,d=6,wall='Wall_Plaster_Straight',door='Wall_Plaster_Door_Round',win='Wall_Plaster_Window_Wide_Round',corner='Corner_Exterior_Wood',roof='Roof_RoundTiles_6x6',gable='Roof_Front_Brick6',chimney=true}={}){
  const hw=w/2,hd=d/2;
  for(let x=-hw+1;x<hw;x+=2){const mid=Math.abs(x)<.1;piece(VP,mid?door:win,x,0,hd,0,1,par);piece(VP,x===-hw+1?win:wall,x,0,-hd,Math.PI,1,par);}
  for(let z=-hd+1;z<hd;z+=2){piece(VP,Math.abs(z)<1.1?win:wall,hw,0,z,Math.PI/2,1,par);piece(VP,wall,-hw,0,z,-Math.PI/2,1,par);}
  for(const [x,z] of [[hw,hd],[-hw,hd],[hw,-hd],[-hw,-hd]])piece(VP,corner,x,0,z,0,1,par);
  piece(VP,roof,0,3.08,0,0,1,par);piece(VP,gable,0,3.08,hd,0,1,par);piece(VP,gable,0,3.08,-hd,Math.PI,1,par);
  piece(VP,'Door_1_Round',-.53,0,hd+.02,0,1,par);
  if(chimney)piece(VP,'Prop_Chimney',hw*.45,4.2,-hd*.3,0,1,par);}
function canopyTex(a,b,n=8){const cv=document.createElement('canvas');cv.width=128;cv.height=16;const g=cv.getContext('2d');for(let i=0;i<n;i++){g.fillStyle=i%2?a:b;g.fillRect(i*128/n,0,128/n,16);}const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;}
function fenceRect(par,hw,hd,gapSide=null,gap=1.6){const ms=[];const L=(x1,z1,x2,z2)=>{const len=Math.hypot(x2-x1,z2-z1),n=Math.max(1,Math.round(len/2.06)),ry=-Math.atan2(z2-z1,x2-x1);for(let i=0;i<n;i++){const t=(i+.5)/n;ms.push(TM(lerp(x1,x2,t),0,lerp(z1,z2,t),ry,1,1.15).multiply(new THREE.Matrix4().makeScale(len/n/2.06,1,1)));}};
  L(-hw,-hd,hw,-hd);L(-hw,hd,-hw,-hd);
  if(gapSide==='e'){L(hw,-hd,hw,-gap);L(hw,gap,hw,hd);}else L(hw,-hd,hw,hd);
  if(gapSide==='s'){L(hw,hd,gap,hd);L(-gap,hd,-hw,hd);}else L(hw,hd,-hw,hd);
  instance(VP['Prop_WoodenFence_Single'],ms,{parent:par});}
const soilMat=new THREE.MeshStandardMaterial({map:TX.path,roughness:1,color:0xd6aa80});
const soilGeo=new THREE.BoxGeometry(2.7,.28,2.7),furGeo=new THREE.BoxGeometry(2.4,.08,.34);
const woodMat=mat(0x9c6b3e,{roughness:.85}),woodDark=mat(0x6b4226,{roughness:.9});
const ghSlotsN=()=>4+2*S.up.sera;
const B_BUILDERS={
  hambar(g){houseBox(g,{w:6,d:8,wall:'Wall_UnevenBrick_Straight',door:'Wall_UnevenBrick_Door_Round',win:'Wall_UnevenBrick_Window_Wide_Round',corner:'Corner_Exterior_Brick',roof:'Roof_RoundTiles_6x8',chimney:false});
    piece(VP,'Prop_Crate',3.6,0,3.2,0,1,g);piece(VP,'Prop_Crate',3.7,1.06,3.3,.4,.8,g);bake(g);},
  sera(g,o){const glass=new THREE.MeshPhysicalMaterial({color:0xe6fbff,roughness:.05,metalness:0,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide});
    const gl=new THREE.Mesh(new THREE.BoxGeometry(6,2.6,8),glass);gl.position.y=1.3;g.add(gl);
    const rf=new THREE.Mesh(new THREE.CylinderGeometry(3,3,8,20,1,true,-Math.PI/2,Math.PI),glass);rf.rotation.set(Math.PI/2,0,Math.PI/2);rf.scale.set(1,1,.45);rf.position.y=2.6;g.add(rf);
    const fr=mat(0xf5f5f5,{roughness:.5});for(const x of[-3,3])for(const z of[-4,-1.3,1.3,4])E(BOX,fr,x,1.3,z,.1,2.6,.1,g);for(const z of[-4,-1.3,1.3,4]){const a=new THREE.Mesh(new THREE.TorusGeometry(3,.05,6,24,Math.PI),fr);a.position.set(0,2.6,z);a.scale.set(1,.45,1);g.add(a);}
    const sm=new THREE.MeshStandardMaterial({map:TX.soil,roughness:1});for(const x of[-1.6,1.6])E(BOX,sm,x,.2,0,1.6,.4,7,g);
    o.plants=new THREE.Group();g.add(o.plants);},
  moara(g){const pl=mat(0xf1e6cf,{roughness:.9});M(new THREE.CylinderGeometry(1.5,2.3,7.5,12),pl,0,3.75,0,g);
    const rm=new THREE.Mesh(new THREE.ConeGeometry(2.1,2.6,12),mat(0xb5562f,{roughness:.7}));rm.position.y=8.8;rm.castShadow=true;g.add(rm);
    M(new THREE.BoxGeometry(1,1.9,.2),0x6b4226,0,.95,2.15,g).rotation.x=-.12;for(const y of[3.3,5.6])M(new THREE.BoxGeometry(.8,.9,.2),0x9fd3f0,0,y,1.95-(y-3.3)*.1,g).rotation.x=-.1;
    const hub=new THREE.Group();hub.position.set(0,7.2,2.05);g.add(hub);const hc=E(CYL,0x5d4037,0,0,0,.32,.5,.32,hub);hc.rotation.x=Math.PI/2;
    for(let i=0;i<4;i++){const arm=new THREE.Group();arm.rotation.z=i*Math.PI/2;hub.add(arm);M(new THREE.BoxGeometry(.18,4.4,.12),0x7a5230,0,2.3,0,arm);M(new THREE.BoxGeometry(.9,3.6,.04),mat(0xf6efe0,{roughness:1}),.5,2.6,.06,arm);}
    spinners.push({o:hub,t:'spin'});},
  fantana(g){const st=new THREE.MeshStandardMaterial({map:TX.rock,roughness:.95,color:0xdedede,side:THREE.DoubleSide});
    const ring=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.35,1,20,1,true),st);ring.position.y=.5;ring.castShadow=true;g.add(ring);
    const t=new THREE.Mesh(new THREE.TorusGeometry(1.25,.16,8,24),st);t.rotation.x=Math.PI/2;t.position.y=1;g.add(t);
    E(CYL,new THREE.MeshStandardMaterial({color:0x2f8fc4,roughness:.05}),0,.8,0,1.15,.04,1.15,g,false);
    for(const s of[-1,1])E(CYL,0x6b4226,1.15*s,1.8,0,.09,2.6,.09,g);piece(VP,'Roof_RoundTiles_4x4',0,3,0,0,.55,g);E(CYL,0x6b4226,0,2.5,0,.08,2.3,.08,g).rotation.z=Math.PI/2;},
  siloz(g){const mt=mat(0xb8c4cc,{metalness:.7,roughness:.35});M(new THREE.CylinderGeometry(1.8,1.8,7,24),mt,0,3.5,0,g);E(SPH,mat(0x9aa8b2,{metalness:.7,roughness:.3}),0,7,0,1.85,1.1,1.85,g);
    for(const y of[1.5,3,4.5,6]){const t=new THREE.Mesh(new THREE.TorusGeometry(1.82,.05,6,32),mat(0x7a8790,{metalness:.6,roughness:.4}));t.rotation.x=Math.PI/2;t.position.y=y;g.add(t);}},
  flori(g){instance(NP['Flower_3_Group'],[-4,-2,0,2,4].map((x,i)=>TM(x,0,(i%2)*.6-.3,i,.45)),{shadow:false,parent:g});instance(NP['Flower_4_Group'],[-3,-1,1,3].map((x,i)=>TM(x,0,0,i,.45)),{shadow:false,parent:g});},
  lampi(g){const lm=new THREE.MeshStandardMaterial({color:0xffe9a8,emissive:0xffb340,emissiveIntensity:1.4});const post=mat(0x4a3a2c,{roughness:.6,metalness:.3});
    for(let i=0;i<3;i++){const z=-3.2+i*3.2;E(CYL,post,0,.08,z,.22,.16,.22,g);E(CYL,post,0,1.35,z,.09,2.6,.09,g);E(BOX,post,0,2.62,z,.42,.06,.42,g);E(BOX,lm,0,2.88,z,.34,.46,.34,g,false);E(CONE,post,0,3.28,z,.32,.34,.32,g);}},
  pusculita(g){const pk=mat(0xff9ec4,{roughness:.35});E(SPH,pk,0,1.15,0,1.1,.9,.85,g);for(const [x,z] of[[.6,.4],[-.6,.4],[.6,-.4],[-.6,-.4]])E(CYL,pk,x,.35,z,.18,.7,.18,g);
    const sn=E(CYL,mat(0xff7fae),0,1.15,.95,.32,.25,.28,g);sn.rotation.x=Math.PI/2;for(const s of[-1,1]){E(CONE,pk,.45*s,1.95,.2,.18,.35,.12,g);E(SPH,mat(0x222222),.35*s,1.4,.75,.07,.07,.05,g);}
    E(BOX,mat(0x5a2a3a),0,2.02,0,.5,.04,.1,g);const coin=E(CYL,mat(0xffd54f,{metalness:.7,roughness:.25,emissive:0x6a4600}),0,2.4,0,.28,.06,.28,g);coin.rotation.x=Math.PI/2;spinners.push({o:coin,t:'coin',y:2.4});},
  comenzi(g){E(CYL,0x6b4226,-1.2,1.2,0,.1,2.4,.1,g);E(CYL,0x6b4226,1.2,1.2,0,.1,2.4,.1,g);M(new THREE.BoxGeometry(2.8,1.7,.15),0x9c6b3e,0,1.9,0,g);
    const pm=[0xfff4c2,0xffffff,0xd6f0ff,0xffd6e8];for(let i=0;i<6;i++)M(new THREE.BoxGeometry(.6,.45,.03),pm[i%4],-.85+(i%3)*.85,2.25-Math.floor(i/3)*.6,.1,g);M(new THREE.ConeGeometry(1.8,.6,4),0xb5562f,0,3.05,0,g).rotation.y=Math.PI/4;},
  stupi(g){for(const x of[-1.1,1.1]){const h=new THREE.Group();h.position.x=x;g.add(h);E(BOX,woodDark,0,.2,0,.9,.4,.9,h);for(let i=0;i<3;i++)E(BOX,mat(i%2?0xf2c14e:0xe3a63a,{roughness:.7}),0,.55+i*.32,0,.8,.3,.8,h);E(BOX,woodMat,0,1.55,0,1,.12,1,h);}
    const bees=new THREE.Group();g.add(bees);for(let i=0;i<6;i++){const b=E(SPH,mat(0xffd02a),0,0,0,.06,.05,.08,bees,false);b.userData.ph=i;}spinners.push({o:bees,t:'bees'});},
  limonada(g){E(BOX,woodMat,0,.55,0,2.4,1.1,1,g);E(BOX,mat(0xfff176),0,.6,.51,2.2,.6,.02,g);for(const s of[-1,1])E(CYL,woodDark,1.1*s,1.4,-.4,.06,2.8,.06,g);
    const aw=new THREE.Mesh(new THREE.BoxGeometry(2.8,.06,1.5),new THREE.MeshStandardMaterial({map:canopyTex('#ffd23f','#ffffff'),roughness:.9}));aw.position.set(0,2.75,0);aw.rotation.x=.18;aw.castShadow=true;g.add(aw);
    for(let i=0;i<3;i++){E(CYL,new THREE.MeshPhysicalMaterial({color:0xfff59d,transparent:true,opacity:.8,roughness:.1}),-.6+i*.6,1.25,.1,.12,.3,.12,g);}E(SPH,mat(0xffe03a),.9,1.2,.1,.13,.11,.13,g);E(SPH,mat(0xffe03a),.75,1.2,-.05,.12,.1,.12,g);},
  pensiune(g){const h=new THREE.Group();g.add(h);houseBox(h,{w:8,d:6,wall:'Wall_Plaster_WoodGrid',roof:'Roof_RoundTiles_6x8'});h.rotation.y=Math.PI/2;bake(h);
    const sign=new THREE.Group();sign.position.set(0,0,4.6);g.add(sign);E(CYL,woodDark,0,.8,0,.06,1.6,.06,sign);const s=emoji('🏨',1.2);s.position.y=1.9;sign.add(s);
    for(const x of[-2.5,2.5]){instance(NP['Bush_Common_Flowers'],[TM(x,0,3.8,0,.55)],{parent:g,shadow:false});}},
  turn(g){const st=new THREE.MeshStandardMaterial({map:TX.rock,color:0xc8c0e8,roughness:.8});M(new THREE.CylinderGeometry(1.8,2.3,9,10),st,0,4.5,0,g);
    const rm=new THREE.Mesh(new THREE.ConeGeometry(2.4,3.4,10),mat(0x6a4fd8,{roughness:.4,metalness:.2}));rm.position.y=10.7;rm.castShadow=true;g.add(rm);
    const orb=E(SPH,new THREE.MeshStandardMaterial({color:0xd6c2ff,emissive:0xb388ff,emissiveIntensity:1.2}),0,13,0,.6,.6,.6,g,false);spinners.push({o:orb,t:'orb'});
    for(const y of[3,6])for(const a of[0,2.1,4.2]){M(new THREE.BoxGeometry(.6,.9,.1),0x9fd3f0,Math.sin(a)*1.95,y,Math.cos(a)*1.95,g).rotation.y=a;}},
};
function factoryModel(g,id){const F=FACTORIES[id];const walls={furaje:'Wall_UnevenBrick_Straight',brutarie:'Wall_Plaster_WoodGrid',lactate:'Wall_Plaster_Straight',zahar:'Wall_UnevenBrick_Straight',tesatorie:'Wall_Plaster_WoodGrid',cofetarie:'Wall_Plaster_Straight',bucatarie:'Wall_Plaster_WoodGrid',atelier:'Wall_UnevenBrick_Straight'};const wall=walls[id]||'Wall_Plaster_Straight';
  const brick=wall.startsWith('Wall_Uneven');const h=new THREE.Group();h.scale.setScalar(F.w/6.6);g.add(h);
  houseBox(h,{wall,win:brick?'Wall_UnevenBrick_Window_Wide_Round':'Wall_Plaster_Window_Wide_Round',door:brick?'Wall_UnevenBrick_Door_Round':'Wall_Plaster_Door_Round',corner:brick?'Corner_Exterior_Brick':'Corner_Exterior_Wood',chimney:true});bake(h);
  const sign=new THREE.Group();sign.position.set(0,0,F.d/2+.9);g.add(sign);E(CYL,0x6b4226,0,.6,0,.06,1.2,.06,sign);
  const s=emoji(F.e,1.3);s.position.y=1.6;sign.add(s);}

/* ---------- core farm objects ---------- */
addPlace('casa',{w:8,d:8,def:[12,-15],label:'🏡 Casa ta',ly:7.6,pad:.6,build(g){houseBox(g);piece(VP,'Prop_Vine1',2,2.9,3.12,0,1,g);piece(VP,'WindowShutters_Wide_Round_Open',2,0,3.1,0,1,g);piece(VP,'WindowShutters_Wide_Round_Open',-2,0,3.1,0,1,g);piece(CP,'log_stack',-4,0,1.5,0,2.2,g);piece(CP,'pot_large',1.8,0,4,0,1.6,g);bake(g);}});
// market stall in the style of the first version: wooden counter, red-white striped awning, crates of vegetables
const market=addPlace('piata',{w:6,d:4,def:[-6,9],label:'💰 Piața',ly:4.3,pad:.6,build(g){
  E(BOX,woodMat,0,.55,0,4.2,1.1,1.5,g);E(BOX,woodDark,0,1.12,0,4.4,.08,1.7,g);E(BOX,mat(0x7a4f2c),0,.55,.76,4,.9,.02,g);
  for(const s of[-1,1])for(const z of[-.7,.7])E(CYL,woodDark,2.05*s,1.45,z,.09,2.9,.09,g);
  const aw=new THREE.Mesh(new THREE.BoxGeometry(4.8,.1,2.3),new THREE.MeshStandardMaterial({map:canopyTex('#ff5c5c','#ffffff'),roughness:.9}));aw.position.set(0,2.95,.1);aw.rotation.x=.18;aw.castShadow=true;g.add(aw);
  const fr=new THREE.Mesh(new THREE.BoxGeometry(4.8,.35,.04),new THREE.MeshStandardMaterial({map:canopyTex('#ff5c5c','#ffffff',16),roughness:.9}));fr.position.set(0,2.72,1.27);g.add(fr);
  const crops=[['crop_carrot',1.1],['crop_pumpkin',1.2],['crop_melon',1.2],['crops_cornStageD',.55]];
  crops.forEach(([c,s],i)=>{const x=-1.5+i*1;E(BOX,mat(0xc89b6d,{roughness:.9}),x,1.32,0,.85,.32,.75,g);for(let j=0;j<4;j++)piece(CP,c,x+(j%2-.5)*.32,1.42,(Math.floor(j/2)-.5)*.3,rand(0,6),s*.7,g);});
  piece(VP,'Prop_Crate',2.7,0,.5,.3,.7,g);piece(VP,'Prop_Crate',2.75,.74,.55,-.2,.55,g);
  instance(NP['Flower_3_Group'],[TM(-2.6,0,1,0,.3),TM(-2.9,0,.2,1,.28)],{parent:g,shadow:false});bake(g);}});
const nest=addPlace('cuib',{w:3.6,d:3.6,def:[-6,-4],label:'✨ Cuibul magic',ly:3.2,pad:.6,build(g){
  const tw=mat(0x8a6236,{roughness:1});for(let i=0;i<46;i++){const a=i/46*6.28*3,r=.95+Math.sin(i*1.7)*.12;const s=M(CYL,tw,Math.cos(a)*r,.2+(i%3)*.12,Math.sin(a)*r,g);s.scale.set(.05,1.1,.05);s.rotation.order='YXZ';s.rotation.set(Math.PI/2+rand(-.3,.3),-a,0);}
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.32,12,32),mat(0x9a7044,{roughness:1}));ring.rotation.x=Math.PI/2;ring.position.y=.3;ring.castShadow=true;g.add(ring);bake(g);
  const egg=E(SPH,new THREE.MeshPhysicalMaterial({color:0xfff2c2,emissive:0xffb340,emissiveIntensity:.35,roughness:.25,clearcoat:1}),0,.95,0,.5,.66,.5,g);spinners.push({o:egg,t:'bob'});}});

/* ---------- fields ---------- */
const plotObjs=[];
const FIELD_W=13;
function plotLocal(j){const row=Math.floor(j/4),col=j%4;return [-4.575+col*3.05,4.575-row*3.05];}
function plotPos(i){const f=PL['camp'+Math.floor(i/PLOTS_PER_FIELD)];const [lx,lz]=plotLocal(i%PLOTS_PER_FIELD);if(!f)return [lx,lz];const c=Math.cos(-f.r*Math.PI/2),s=Math.sin(-f.r*Math.PI/2);return [f.x+lx*c+lz*s,f.z-lx*s+lz*c];}
function addField(fi){const def=[[8.2,-.6],[-8,-17],[26,-10],[-26,10],[30,24],[-30,-28]][fi]||null;
  addPlace('camp'+fi,{w:FIELD_W,d:FIELD_W,def,collider:null,build(g){
    const pad=new THREE.Mesh(new THREE.PlaneGeometry(12.8,12.8),new THREE.MeshStandardMaterial({map:TX.path,color:0xb8956c,roughness:1,transparent:true,opacity:.55,depthWrite:false}));pad.rotation.x=-Math.PI/2;pad.position.y=.04;pad.receiveShadow=true;g.add(pad);
    for(let j=0;j<PLOTS_PER_FIELD;j++){const i=fi*PLOTS_PER_FIELD+j;const [lx,lz]=plotLocal(j);const pg=new THREE.Group();pg.position.set(lx,0,lz);g.add(pg);
      const s=M(soilGeo,soilMat,0,.1,0,pg);s.castShadow=false;for(const dz of[-.8,0,.8])M(furGeo,soilMat,0,.26,dz,pg).castShadow=false;
      pg.visible=false;const ready=emoji('✨',.9);ready.position.y=1.8;ready.visible=false;pg.add(ready);
      const cropG=new THREE.Group();cropG.position.y=.24;pg.add(cropG);
      plotObjs[i]={g:pg,cropG,crop:null,key:null,ready};}}});}
for(let f=0;f<S.fields;f++)addField(f);
function cropStage(c,p){const st=CROPS[c].st;return st[Math.min(st.length-1,Math.floor(p*st.length*.999))];}
function refreshPlot(i){const o=plotObjs[i],p=S.plots[i];if(!o)return;o.g.visible=i<S.unl;
  const name=p.c?(p.p>=1?CROPS[p.c].st[CROPS[p.c].st.length-1]:cropStage(p.c,p.p)):null;const key=p.c?p.c+':'+name+(p.p>=1?'R':''):null;
  if(o.key!==key){if(o.crop){o.cropG.remove(o.crop);o.crop=null;}o.key=key;
    if(p.c){o.crop=new THREE.Group();for(const dx of[-.8,0,.8])for(const dz of[-.8,0,.8])piece(CP,name,dx,0,dz,rand(0,6),CROPS[p.c].sc,o.crop);bake(o.crop);o.cropG.add(o.crop);o.ready.material=emoji(CROPS[p.c].e,.9).material;}}
  if(o.crop){const sub=CROPS[p.c].st.length;const local=(p.p*sub)%1;o.crop.scale.setScalar(p.p>=1?1:.55+.45*local);}
  o.ready.visible=!!p.c&&p.p>=1;}
const maxPlots=()=>S.fields*PLOTS_PER_FIELD;
const plotCost=()=>D.plotCostFor(S.unl);

/* ---------- pens ---------- */
const penCap=()=>4+2*S.up.tarcCap;
const PEN_DEF=[[-16,11],[-16,3],[-16,-5],[-16,-13],[-26,11],[-26,1],[-26,-9],[-26,-19],[26,14],[26,24],[-36,11],[-36,1],[-36,-9],[-36,-19],[36,14],[36,24]];
function addPen(i){addPlace('tarc'+i,{w:7.6,d:7.6,def:PEN_DEF[i]||null,collider:null,label:'🐾 Țarc '+(i+1),ly:2.4,build(g){
    fenceRect(g,3.5,3.5,'e',1.2);
    const hay=E(CYL,mat(0xe3c160,{roughness:1}),-2.2,.45,-2.3,.55,1,.55,g);hay.rotation.z=Math.PI/2;
    M(new THREE.BoxGeometry(1.6,.4,.6),mat(0x8d7b6a),2,.2,-2.6,g);E(BOX,mat(0x4aa3d8,{roughness:.1}),2,.39,-2.6,1.4,.04,.45,g,false);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(6.8,6.8),new THREE.MeshStandardMaterial({map:TX.path,roughness:1,color:0xddc79a}));fl.rotation.x=-Math.PI/2;fl.position.y=.03;fl.receiveShadow=true;g.add(fl);}});}
for(let i=0;i<S.pens;i++)addPen(i);
const penPos=i=>{const p=PL['tarc'+i];return p?[p.x,p.z]:[0,0];};

/* ---------- buildings / factories / decor / trees ---------- */
const DEF_POS={fantana:[-1,3],flori:[12,-9.5],lampi:[-3.5,16],siloz:[-9,-17],hambar:[-1,-17],moara:[18,-4],sera:[17,14],pusculita:[3,15],comenzi:[-3,-9],stupi:[20,-15],limonada:[6,18],pensiune:[24,2],turn:[-20,-24]};
const LABELED=['hambar','sera','moara','siloz','fantana','pusculita','comenzi','stupi','limonada','pensiune','turn'];
const LBLY={moara:10.6,hambar:8.2,siloz:9.2,sera:4.6,fantana:4.4,pusculita:3.4,comenzi:4,stupi:2.6,limonada:3.6,pensiune:8,turn:14.5};
function addBuilding(id){const b=BUILD[id];
  const o=addPlace('b:'+id,{w:b.w,d:b.d,def:DEF_POS[id],pad:.3,collider:['flori','lampi'].includes(id)?null:'box',label:LABELED.includes(id)?b.e+' '+b.n:null,ly:LBLY[id],build(g,o){B_BUILDERS[id](g,o);}});
  if(['pusculita','limonada','pensiune','stupi','sera'].includes(id)){const ic=emoji(id==='stupi'?'🍯':id==='sera'?'✅':'🪙',1);ic.position.y=(LBLY[id]||4)-1;ic.visible=false;o.g.add(ic);o.ready=ic;}
  if(id==='sera')refreshGH();return o;}
function addFactory(id){const F=FACTORIES[id];const o=addPlace('f:'+id,{w:F.w,d:F.d+1.5,pad:.6,label:F.e+' '+F.n,ly:F.w*1.25+1.5,build(g){factoryModel(g,id);}});
  const ic=emoji('✅',1.1);ic.position.y=F.w*1.25+.3;ic.visible=false;o.g.add(ic);o.ready=ic;return o;}
const DECOR_BUILD={
  banca(g){for(const z of[-.15,.15])E(BOX,woodMat,0,.5,z,1.8,.08,.25,g);E(BOX,woodMat,0,.85,-.32,1.8,.4,.06,g);for(const x of[-.75,.75])E(BOX,mat(0x333333,{metalness:.5}),x,.25,0,.08,.5,.6,g);},
  copac(g){instance(NP['CommonTree_2'],[TM(0,0,0,rand(0,6),.75)],{parent:g});},
  pin(g){instance(NP['Pine_3'],[TM(0,0,0,rand(0,6),.7)],{parent:g});},
  tufis(g){instance(NP['Bush_Common_Flowers'],[TM(0,0,0,rand(0,6),.9)],{parent:g});},
  ciuperci(g){instance(NP['Mushroom_Common'],[TM(0,0,0,0,1.3)],{parent:g,shadow:false});},
  piatra(g){instance(NP['Rock_Medium_2'],[TM(0,-.2,0,rand(0,6),1)],{parent:g});},
  lazi(g){piece(VP,'Prop_Crate',0,0,0,.2,.8,g);piece(VP,'Prop_Crate',.2,.85,.1,-.3,.6,g);},
  caruta(g){piece(VP,'Prop_Wagon',0,0,1.1,0,1,g);},
  felinar(g){const post=mat(0x4a3a2c,{roughness:.6,metalness:.3});E(CYL,post,0,.08,0,.22,.16,.22,g);E(CYL,post,0,1.35,0,.09,2.6,.09,g);E(BOX,new THREE.MeshStandardMaterial({color:0xffe9a8,emissive:0xffb340,emissiveIntensity:1.4}),0,2.88,0,.34,.46,.34,g,false);E(CONE,post,0,3.28,0,.32,.34,.32,g);},
  sperietoare(g){E(CYL,woodDark,0,1,0,.05,2,.05,g);E(BOX,woodDark,0,1.5,0,1.3,.05,.05,g);E(BOX,mat(0x4a7ac8),0,1.35,0,.5,.6,.25,g);E(SPH,mat(0xff8a1a),0,2.15,0,.24,.22,.24,g);E(CYL,mat(0xe9c46a),0,2.38,0,.32,.03,.32,g);E(CYL,mat(0xe9c46a),0,2.47,0,.16,.16,.16,g);},
  statuie(g){E(CYL,mat(0xe8e2d6),0,.3,0,.9,.6,.9,g);const e=E(SPH,new THREE.MeshStandardMaterial({color:0xffd54f,metalness:.9,roughness:.2,emissive:0x5a3c00,emissiveIntensity:.4}),0,1.6,0,.75,1,.75,g);spinners.push({o:e,t:'spinY'});},
};
function addDecor(id,key){const d=DECOR[id];if(!d)return;return addPlace(key,{w:d.w,d:d.d,collider:['copac','pin','piatra','statuie','caruta'].includes(id)?'box':null,pad:.4,def:[rand(-10,10),rand(-10,10)],build(g){DECOR_BUILD[id](g);}});}
const treeObjs={};
function addFruitTree(key){const T_=S.trees[key];const D_=TREES[T_.t];if(!D_)return;
  return addPlace(key,{w:3,d:3,collider:'box',pad:1,def:[rand(-12,12),rand(10,18)],build(g){instance(NP['CommonTree_1'],[TM(0,0,0,rand(0,6),.42)],{parent:g});
    const fr=new THREE.Group();g.add(fr);const fm=mat(D_.fruit,{roughness:.4});for(let i=0;i<14;i++){const a=rand(0,6.28),r=rand(.55,1.15),y=rand(1.7,2.8);E(SPH,fm,Math.cos(a)*r,y,Math.sin(a)*r,.14,.14,.14,fr,false);}
    const ic=emoji(D_.e,.9);ic.position.y=4.2;g.add(ic);treeObjs[key]={fr,ic};}});}
for(const id in BUILD)if(S.own[id])addBuilding(id);
for(const id in FACTORIES)if(S.own['f_'+id])addFactory(id);
for(const d of S.decor)addDecor(d.id,d.key);
for(const k in S.trees){if(TREES[S.trees[k].t])addFruitTree(k);else delete S.trees[k];}

/* ---------- greenhouse visuals ---------- */
function refreshGH(){const o=PL['b:sera'];while(S.gh.length<ghSlotsN())S.gh.push({c:null,p:0});if(!o||!o.plants)return;
  o.plants.clear();const n=ghSlotsN();const rows=Math.ceil(n/2);
  S.gh.slice(0,n).forEach((s,i)=>{if(!s.c)return;const X=EXOTIC[s.c];const x=i%2?1.6:-1.6,z=-3.2+Math.floor(i/2)*(rows>1?6.4/(rows-1):0);const g=new THREE.Group();g.position.set(x,.4,z);o.plants.add(g);
    const sc=.35+.65*Math.min(1,s.p);instance(NP['Plant_7'],[TM(0,0,0,i,.6*sc)],{parent:g,shadow:false});
    if(s.p>=1)for(let k=0;k<6;k++)E(SPH,mat(X.col,{roughness:.4}),rand(-.35,.35),.3+rand(0,.45),rand(-.35,.35),.1,.1,.1,g,false);});}

/* ---------- farm fence ---------- */
let fenceGroup=null;
function buildFarmFence(){if(fenceGroup)scene.remove(fenceGroup);fenceGroup=new THREE.Group();scene.add(fenceGroup);const F=farmF();
  const ms=[];const line=(x1,z1,x2,z2)=>{const L=Math.hypot(x2-x1,z2-z1),n=Math.max(1,Math.round(L/2.06)),ry=-Math.atan2(z2-z1,x2-x1);for(let i=0;i<n;i++){const t=(i+.5)/n;const x=lerp(x1,x2,t),z=lerp(z1,z2,t);ms.push(TM(x,H(x,z),z,ry,1,1.15).multiply(new THREE.Matrix4().makeScale(L/n/2.06,1,1)));}};
  const gap=3.5;for(const [ax,az,bx,bz] of[[-F,-F,F,-F],[F,-F,F,F],[F,F,-F,F],[-F,F,-F,-F]]){const mx=(ax+bx)/2,mz=(az+bz)/2,dx=bx-ax,dz=bz-az,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L;line(ax,az,mx-ux*gap,mz-uz*gap);line(mx+ux*gap,mz+uz*gap,bx,bz);}
  instance(VP['Prop_WoodenFence_Single'],ms,{parent:fenceGroup});
  const sign=new THREE.Group();sign.position.set(0,0,F);fenceGroup.add(sign);for(const s of[-1,1])E(CYL,0x6b4226,3.6*s,1.8,0,.14,3.6,.14,sign);
  M(new THREE.BoxGeometry(7.4,.9,.18),0x9c6b3e,0,3.4,0,sign);label(sign,'🌻 Ferma mea',3.4,{size:1.4});
  rebuildFarmGrass();}
function rebuildFarmGrass(){if(farmGrass.im){scene.remove(farmGrass.im);farmGrass.im.dispose();}
  const F=FARM_MAX+4,N=MOBILE?2400:4200;const im=new THREE.InstancedMesh(farmGrass.geo,farmGrass.gm,N);let c=0;const col=new THREE.Color();
  const blocked=(x,z)=>{for(const k in PL){const p=PL[k];const [hw,hd]=fpSize(p);if(Math.abs(x-p.x)<hw+.6&&Math.abs(z-p.z)<hd+.6)return true;}if(Math.abs(x)<2.6&&z>farmF()-8&&z<farmF()+3)return true;return false;};
  for(let k=0;k<N*5&&c<N;k++){const x=rand(-F,F),z=rand(-F,F);if(blocked(x,z))continue;im.setMatrixAt(c,TM(x,H(x,z)-.02,z,rand(0,6.28),rand(.6,1.2),rand(.6,1.3)));col.setHSL(rand(.2,.28),rand(.45,.65),rand(.42,.6));im.setColorAt(c,col);c++;}
  im.count=c;im.receiveShadow=true;im.computeBoundingSphere();scene.add(im);farmGrass.im=im;}
buildFarmFence();

/* ---------- lock signs ---------- */
const locks={};
function lockSign(key,x,z,text){if(locks[key])unlock(key);const g=new THREE.Group();g.position.set(x,0,z);E(CYL,0x6b4226,0,.7,0,.07,1.4,.07,g);M(new THREE.BoxGeometry(1.3,.8,.12),0xc9a06a,0,1.5,0,g);label(g,text,2.3,{size:.65});scene.add(g);locks[key]={g,x,z};}
function unlock(key){if(locks[key]){scene.remove(locks[key].g);delete locks[key];}}
function refreshLocks(){if(S.unl<maxPlots()){const [x,z]=plotPos(S.unl);lockSign('plot',x,z,'➕ Parcelă '+plotCost()+'🪙');}else unlock('plot');}

/* ================= VEHICLES ================= */
function recolorMap(tex,rgb){const img=tex.image;const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const g=cv.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,cv.width,cv.height),p=d.data;
  for(let i=0;i<p.length;i+=4){const r=p[i],gg=p[i+1],b=p[i+2];if(b>248&&gg>228&&r>205&&r<253&&!(r===255&&gg===255)){p[i+3]=0;continue;}if(b>r+18&&b>gg+14&&r>90&&r<215&&Math.abs(r-gg)<14){const l=(r+gg+b)/3/175;p[i]=Math.min(255,rgb[0]*l);p[i+1]=Math.min(255,rgb[1]*l);p[i+2]=Math.min(255,rgb[2]*l);}}
  g.putImageData(d,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;}
for(const [G,rgb] of [[TRC,[60,170,70]],[SUV,[232,170,66]]]){const done=new Set();G.scene.traverse(o=>{if(o.isMesh&&o.material.map&&!done.has(o.material)){const m=o.material;m.map=recolorMap(m.map,rgb);m.alphaTest=.5;m.side=THREE.DoubleSide;m.roughness=.45;m.metalness=.15;m.needsUpdate=true;done.add(m);}});}
function vehModel(gltf,scale,seat){const g=new THREE.Group();const m=gltf.scene.clone(true);m.scale.setScalar(scale);g.add(m);const W=[];
  m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(/wheel/i.test(o.name)&&!/back$/.test(o.name))W.push(o);});
  g.userData={wheels:W,seat:new THREE.Vector3(...seat)};return g;}
// safari jeep: cut away the roof so the driver is visible (open-top jeep)
SUV.scene.traverse(o=>{if(o.isMesh&&/body/.test(o.name)){o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox;const cut=bb.min.y+(bb.max.y-bb.min.y)*.72;
  const m=o.material=o.material.clone();m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vLy;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLy=position.y;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLy;').replace('void main() {','void main() {\nif(vLy>'+cut.toFixed(5)+')discard;');};m.customProgramCacheKey=()=>'suvcut';}});
const vehicles={};
function spawnVehicle(id){if(vehicles[id])return;const v=id==='tractor'?vehModel(TRC,1.45,[0,.78,-.3]):vehModel(SUV,1.2,[-.25,.26,.1]);
  const p=S.lay['v:'+id]||{x:id==='tractor'?6:10,z:18};v.position.set(p.x,H(p.x,p.z),p.z);v.rotation.y=Math.PI;scene.add(v);vehicles[id]=v;}

/* ================= CHARACTERS (VRM anime + real mocap animations) ================= */
const ANIMS=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Jump_Loop','Driving_Loop','PickUp_Table','Interact','Fixing_Kneeling','Dance_Loop','Idle_Talking_Loop','Spell_Simple_Shoot'];
const ONCE={PickUp_Table:1,Interact:1,Spell_Simple_Shoot:1};
const matsOf=o=>Array.isArray(o.material)?o.material:[o.material];
async function makeChar(id,onProg){
  const gltf=await loadVRMFile(id,onProg);const v=gltf.userData.vrm;VRMUtils.removeUnnecessaryVertices(gltf.scene);VRMUtils.rotateVRM0(v);
  v.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;}});
  const root=new THREE.Group();root.add(v.scene);
  const hairMeshes=[],hairMats=[],clothMats=[];
  v.scene.traverse(o=>{if(!o.isMesh)return;const ms=matsOf(o);if(ms.some(m=>/HAIR/i.test(m.name))){hairMeshes.push(o);ms.forEach(m=>{if(!hairMats.includes(m))hairMats.push(m);});}
    ms.forEach(m=>{if(/CLOTH/i.test(m.name)&&!clothMats.includes(m))clothMats.push(m);});});
  v.update(0);const box=new THREE.Box3().setFromObject(v.scene);const head=v.humanoid.getRawBoneNode('head');const hp=new THREE.Vector3();head.getWorldPosition(hp);
  const chest=v.humanoid.getRawBoneNode('upperChest')||v.humanoid.getRawBoneNode('chest');const hand=v.humanoid.getRawBoneNode('rightHand');
  const mixer=new THREE.AnimationMixer(v.scene);const acts={};
  for(const n of ANIMS){const src=LIB.clips.find(a=>a.name===n);if(!src)continue;const a=mixer.clipAction(retargetClip(LIB,src,v));if(ONCE[n]){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}acts[n]=a;}
  const c={id,v,root,hairMeshes,hairMats,clothMats,head,chest,hand,headTop:box.max.y-hp.y,height:box.max.y,blink:rand(1,4),happy:0,acc:{},donor:null,mixer,acts,cur:null,lock:0,rod:null};
  playAnim(c,'Idle_Loop',0);return c;}
function playAnim(c,name,fade=.25){if(c.cur===name||!c.acts[name])return;const next=c.acts[name];const prev=c.acts[c.cur];next.reset().setEffectiveWeight(1).fadeIn(fade).play();if(prev&&prev!==next)prev.fadeOut(fade);c.cur=name;}
function playOnce(c,name,dur){if(!c||!c.acts[name])return;const prev=c.cur;c.cur=null;const a=c.acts[name];a.reset().setEffectiveWeight(1).fadeIn(.15).play();if(prev&&c.acts[prev]&&prev!==name)c.acts[prev].fadeOut(.15);c.cur=name;c.lock=dur??a.getClip().duration*.9;}
function setLayers(c,on){const f=o=>on?o.layers.enable(1):o.layers.disable(1);c.root.traverse(f);if(c.donor)c.donor.v.scene.traverse(f);}
function remapTexture(tex,fn){const img=tex.userData.orig||tex.image;const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const g=cv.getContext('2d');g.drawImage(img,0,0);
  const d=g.getImageData(0,0,cv.width,cv.height);fn(d.data);g.putImageData(d,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=tex.flipY;t.colorSpace=tex.colorSpace;t.wrapS=tex.wrapS;t.wrapT=tex.wrapT;t.userData.orig=img;return t;}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6;}return [h,s,l];}
function hsl2rgb(h,s,l){if(s===0)return [l*255,l*255,l*255];const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;const f=t=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};return [f(h+1/3)*255,f(h)*255,f(h-1/3)*255];}
function matTextures(m){return ['map','shadeMultiplyTexture'].filter(k=>m[k]&&m[k].image);}
function applyCloth(c,idx){const opt=OUTFIT_COLORS[idx]||OUTFIT_COLORS[0];
  for(const m of c.clothMats){for(const k of matTextures(m)){if(!m.userData['o_'+k])m.userData['o_'+k]=m[k];const base=m.userData['o_'+k];
      if(opt.c===null){m[k]=base;continue;}const H_=opt.c/360;
      m[k]=remapTexture(base,p=>{for(let i=0;i<p.length;i+=4){if(p[i+3]<10)continue;const [h,s,l]=rgb2hsl(p[i],p[i+1],p[i+2]);if(s<.16||l>.93)continue;
        let o;if(opt.c===-1)o=hsl2rgb(h,s*.15,l*.38);else o=hsl2rgb(H_,Math.max(s,.45),l);p[i]=o[0];p[i+1]=o[1];p[i+2]=o[2];}});}
    m.needsUpdate=true;}}
function applyHairColor(c,idx){const opt=HAIR_COLORS[idx]||HAIR_COLORS[0];const mats=c.donor?c.donor.hairMats:c.hairMats;
  for(const m of mats){for(const k of matTextures(m)){if(!m.userData['o_'+k])m.userData['o_'+k]=m[k];const base=m.userData['o_'+k];
      if(opt.c===null){m[k]=base;continue;}const tc=new THREE.Color(opt.c);const T_=[tc.r*255,tc.g*255,tc.b*255];const shade=k==='shadeMultiplyTexture'?.72:1;
      m[k]=remapTexture(base,p=>{let lo=255,hi=0;for(let i=0;i<p.length;i+=16){if(p[i+3]<40)continue;const L=.3*p[i]+.59*p[i+1]+.11*p[i+2];lo=Math.min(lo,L);hi=Math.max(hi,L);}
        const rg=Math.max(20,hi-lo);for(let i=0;i<p.length;i+=4){if(p[i+3]<5)continue;const L=(.3*p[i]+.59*p[i+1]+.11*p[i+2]-lo)/rg;const f=(.55+.7*L)*shade;
          p[i]=Math.min(255,T_[0]*f+18*L);p[i+1]=Math.min(255,T_[1]*f+18*L);p[i+2]=Math.min(255,T_[2]*f+18*L);}});}
    m.needsUpdate=true;}}
const donorCache={};
async function applyHairStyle(c,donorId){
  if(c.donor){scene.remove(c.donor.v.scene);c.donor=null;}
  c.hairMeshes.forEach(o=>o.visible=true);
  if(!donorId||donorId===c.id)return;
  let gltf=donorCache[donorId+'@'+c.id];if(!gltf){gltf=await loadVRMFile(donorId);donorCache[donorId+'@'+c.id]=gltf;}
  const v=gltf.userData.vrm;if(!v.__rot){VRMUtils.rotateVRM0(v);v.__rot=1;}
  const hairMats=[];v.scene.traverse(o=>{if(o.isMesh){const ms=matsOf(o);const isHair=ms.some(m=>/HAIR/i.test(m.name));o.visible=isHair;o.castShadow=true;o.frustumCulled=false;if(isHair)ms.forEach(m=>{if(!hairMats.includes(m))hairMats.push(m);});}});
  v.scene.matrixAutoUpdate=true;v.scene.position.set(0,0,0);v.scene.rotation.set(0,Math.PI,0);v.update(0);v.scene.updateMatrixWorld(true);
  const dHead=v.humanoid.getRawBoneNode('head');const Dm=new THREE.Matrix4().copy(v.scene.matrixWorld).invert().multiply(dHead.matrixWorld);
  const box=new THREE.Box3().setFromObject(v.scene);const hp=new THREE.Vector3();dHead.getWorldPosition(hp);const dTop=box.max.y-hp.y;
  const sc=clamp(c.headTop/dTop,.85,1.15);v.scene.matrixAutoUpdate=false;scene.add(v.scene);
  c.donor={v,Dinv:Dm.clone().invert(),sc,hairMats,id:donorId};c.hairMeshes.forEach(o=>o.visible=false);if(lookOpen&&c===pch)setLayers(c,true);}
const _sm=new THREE.Matrix4();
function syncDonor(c,dt){if(!c.donor)return;c.head.updateWorldMatrix(true,false);const m=c.donor.v.scene.matrix;
  m.copy(c.head.matrixWorld).multiply(_sm.makeScale(c.donor.sc,c.donor.sc,c.donor.sc)).multiply(c.donor.Dinv);c.donor.v.scene.updateMatrixWorld(true);c.donor.v.update(dt);c.donor.v.scene.visible=c.root.visible;}
function makeHeadAcc(kind){const g=new THREE.Group();const gm=mat;
  if(kind==='paie'){const s=gm(0xe9c46a,{roughness:1});E(CYL,s,0,0,0,.27,.02,.27,g);E(CYL,s,0,.07,0,.13,.13,.13,g);E(CYL,gm(0xd94a4a),0,.035,0,.135,.04,.135,g);}
  if(kind==='cowboy'){const s=gm(0x8a5a2b,{roughness:.8});E(CYL,s,0,0,0,.28,.02,.24,g);E(CYL,s,0,.08,0,.13,.15,.14,g);E(CYL,gm(0x3b2414),0,.03,0,.135,.035,.145,g);}
  if(kind==='flori'){const cs=[0xff7ab8,0xffe14d,0xffffff,0xa27bff,0xff8a3d];for(let i=0;i<12;i++){const a=i/12*6.283;E(SPH,gm(cs[i%5],{roughness:.6}),Math.cos(a)*.13,0,Math.sin(a)*.13,.035,.03,.035,g);}const r=new THREE.Mesh(new THREE.TorusGeometry(.13,.012,6,24),gm(0x4caf50));r.rotation.x=Math.PI/2;g.add(r);}
  if(kind==='tiara'){const gd=gm(0xffc93a,{metalness:.45,roughness:.3,emissive:0x5a3a00});const r=new THREE.Mesh(new THREE.TorusGeometry(.12,.012,6,24,Math.PI),gd);r.rotation.x=Math.PI/2;r.rotation.z=Math.PI;r.position.y=.01;g.add(r);
    for(const x of[-.07,0,.07])E(CONE,gd,x,.04+(x?0:.02),-.11,.018,.06,.018,g);E(SPH,new THREE.MeshStandardMaterial({color:0xff3d8b,emissive:0xff3d8b,emissiveIntensity:.5,roughness:.2}),0,.09,-.115,.022,.022,.022,g);}
  if(kind==='pisica'){for(const s of[-1,1]){const e=E(CONE,gm(0xf0e0d6),.09*s,.05,0,.05,.11,.035,g);e.rotation.z=-.3*s;const i=E(CONE,gm(0xff9ecb),.088*s,.045,-.01,.03,.075,.02,g);i.rotation.z=-.3*s;}}
  if(kind==='iepure'){for(const s of[-1,1]){const e=E(SPH,gm(0xffffff,{roughness:.9}),.06*s,.14,0,.035,.14,.025,g);e.rotation.z=-.15*s;const i=E(SPH,gm(0xffb3cf),.06*s,.14,-.012,.022,.11,.015,g);i.rotation.z=-.15*s;}const b=new THREE.Mesh(new THREE.TorusGeometry(.13,.01,6,24,Math.PI),gm(0xff7ab8));b.rotation.y=Math.PI/2;b.position.y=-.01;g.add(b);}
  if(kind==='caciula'){E(SPH,gm(0xd94a4a,{roughness:1}),0,-.02,0,.155,.13,.155,g);E(CYL,gm(0xffffff,{roughness:1}),0,-.06,0,.157,.05,.157,g);E(SPH,gm(0xffffff,{roughness:1}),0,.12,0,.05,.05,.05,g);}
  if(kind==='sapca'){E(SPH,gm(0x2f7de1,{roughness:.7}),0,-.02,0,.145,.1,.145,g);E(CYL,gm(0x2f7de1,{roughness:.7}),0,-.05,-.13,.11,.015,.1,g);E(SPH,gm(0xffffff),0,.075,0,.02,.02,.02,g);}
  if(kind==='fundita'){const p=gm(0xff4f8b,{roughness:.5});for(const s of[-1,1]){const l=E(SPH,p,.07*s,0,.05,.07,.045,.03,g);l.rotation.z=.4*s;}E(SPH,p,0,0,.05,.025,.03,.025,g);}
  if(kind==='coarne'){const h=E(CONE,new THREE.MeshStandardMaterial({color:0xffd54f,metalness:.6,roughness:.25,emissive:0x6a4600,emissiveIntensity:.4}),0,.06,-.06,.03,.17,.03,g);h.rotation.x=-.4;}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function makeFaceAcc(kind){const g=new THREE.Group();if(kind==='none')return g;
  const frame=kind==='inimioare'?mat(0xff4f8b):mat(0x2b2b2b,{metalness:.4,roughness:.4});const lens=new THREE.MeshStandardMaterial({color:kind==='soare'?0x111111:kind==='inimioare'?0xff7ab8:0xcfefff,transparent:true,opacity:kind==='ochelari'?.25:.85,roughness:.1});
  for(const s of[-1,1]){const r=new THREE.Mesh(new THREE.TorusGeometry(.032,.005,6,20),frame);r.position.set(.042*s,0,0);g.add(r);const l=new THREE.Mesh(new THREE.CircleGeometry(.03,20),lens);l.position.set(.042*s,0,-.001);l.rotation.y=Math.PI;g.add(l);E(BOX,frame,.083*s,.005,.04,.004,.006,.08,g,false);}
  E(BOX,frame,0,.005,0,.025,.005,.005,g,false);return g;}
function wingShape(w,h,col,op){const sh=new THREE.Shape();sh.moveTo(0,0);sh.bezierCurveTo(w*.3,h*.9,w*.9,h,w,h*.55);sh.bezierCurveTo(w*.95,h*.2,w*.5,-h*.15,0,0);
  return new THREE.Mesh(new THREE.ShapeGeometry(sh),new THREE.MeshStandardMaterial({color:col,transparent:true,opacity:op,side:THREE.DoubleSide,roughness:.3,emissive:col,emissiveIntensity:.2}));}
function makeBackAcc(kind){const g=new THREE.Group();
  if(kind==='rucsac'){E(BOX,mat(0xe8574a,{roughness:.7}),0,-.08,0,.26,.3,.13,g);E(BOX,mat(0xd04236),0,-.16,.07,.2,.12,.04,g);}
  if(kind==='aripi'||kind==='fluture'||kind==='dragon'){const col=kind==='aripi'?0xbfe8ff:kind==='fluture'?0xff9ad5:0x7a2a2a;const op=kind==='dragon'?1:.6;
    for(const s of[-1,1]){const w=wingShape(.42,.5,col,op);w.scale.set(s,1,1);w.position.set(.03*s,-.05,0);w.rotation.y=s*.5;w.userData.wing=s;g.add(w);
      if(kind==='fluture'){const w2=wingShape(.28,.3,0xffe066,.7);w2.scale.set(s,-1,1);w2.position.set(.03*s,-.06,0);w2.rotation.y=s*.5;w2.userData.wing=s;g.add(w2);}}}
  if(kind==='mantie'){const cv=new THREE.Mesh(new THREE.PlaneGeometry(.5,.9,1,6),new THREE.MeshStandardMaterial({color:0xc62828,side:THREE.DoubleSide,roughness:.8}));cv.position.set(0,-.45,.02);cv.rotation.x=.12;cv.userData.cape=1;g.add(cv);}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function setAccs(c,look){for(const k in c.acc){c.acc[k].parent?.remove(c.acc[k]);}c.acc={};
  if(look.acc&&look.acc!=='none'){const a=makeHeadAcc(look.acc);a.position.set(0,c.headTop+({paie:-.06,cowboy:-.06,flori:-.04,tiara:-.05,pisica:-.06,iepure:-.05,caciula:-.09,sapca:-.07,fundita:-.07,coarne:-.04}[look.acc]??-.05),.01);c.head.add(a);c.acc.head=a;}
  if(look.face&&look.face!=='none'){const f=makeFaceAcc(look.face);f.position.set(0,c.headTop*.43,-.105);c.head.add(f);c.acc.face=f;}
  if(look.back&&look.back!=='none'){const b=makeBackAcc(look.back);b.position.set(0,.04,.13);c.chest.add(b);c.acc.back=b;}
  if(lookOpen&&c===pch)setLayers(c,true);}
function showRod(c,on){if(on&&!c.rod){const g=new THREE.Group();E(CYL,mat(0x6b4226),0,.6,0,.012,1.4,.012,g);E(CYL,mat(0xdddddd),0,1.4,0,.004,.4,.004,g);g.rotation.set(-1.1,0,0);c.hand.add(g);c.rod=g;}
  if(c.rod)c.rod.visible=on;}
// state: 'idle' | 'walk' | 'jog' | 'air' | 'drive' | 'fish' | 'dance' | 'talk' | 'kneel'
const STATE_ANIM={idle:'Idle_Loop',walk:'Walk_Loop',jog:'Jog_Fwd_Loop',air:'Jump_Loop',drive:'Driving_Loop',fish:'Idle_Loop',dance:'Dance_Loop',talk:'Idle_Talking_Loop',kneel:'Fixing_Kneeling'};
function animChar(c,dt,state='idle'){
  if(c.lock>0&&state!=='air'&&state!=='drive'&&state!=='walk'&&state!=='jog')c.lock-=dt;else{c.lock=0;playAnim(c,STATE_ANIM[state]||'Idle_Loop');}
  if(c.acts.Walk_Loop)c.acts.Walk_Loop.timeScale=c.walkScale||1;if(c.acts.Jog_Fwd_Loop)c.acts.Jog_Fwd_Loop.timeScale=c.jogScale||1;
  c.mixer.update(dt);
  const em=c.v.expressionManager;if(em){c.blink-=dt;let bl=0;if(c.blink<0){bl=1-Math.abs(c.blink+.08)/.08;if(c.blink<-.16)c.blink=rand(2,5);}
    em.setValue('blink',clamp(bl,0,1));c.happy=Math.max(0,c.happy-dt);em.setValue('happy',c.happy>0?Math.min(1,c.happy*2)*.8:0);}
  const moving=state==='walk'||state==='jog';
  if(c.acc.back)c.acc.back.traverse(o=>{if(o.userData.wing)o.rotation.y=o.userData.wing*(.5+Math.sin(T*(moving?9:3))*.25);if(o.userData.cape)o.rotation.x=.12+(moving?.5+Math.sin(T*8)*.08:.02);});
  c.v.update(dt);syncDonor(c,dt);}

/* ================= PLAYER ================= */
const root=new THREE.Group();scene.add(root);
player={pos:new THREE.Vector3(...(S.pos?[S.pos[0],0,S.pos[1]]:[0,0,14])),vy:0,ground:true,face:Math.PI,veh:null,speed:0};
const stage=new THREE.Mesh(new THREE.CylinderGeometry(.7,.76,.1,48),mat(0xfff1d6,{roughness:.6}));stage.position.y=-.06;stage.receiveShadow=true;stage.layers.set(1);root.add(stage);
let pch=null,lookOpen=false,dressDance=false;const vrmCache={};
$('#loadTxt').textContent='se încarcă personajul…';
async function setPlayerChar(id){const onP=e=>{const b=$('#barI');if(e.total&&b)b.style.width=Math.round(e.loaded/e.total*100)+'%';};
  let c=vrmCache[id];if(!c){c=await makeChar(id,onP);vrmCache[id]=c;}
  if(pch&&pch!==c){root.remove(pch.root);setLayers(pch,false);if(pch.donor){scene.remove(pch.donor.v.scene);pch.donor=null;}}pch=c;root.add(c.root);
  c.root.position.set(0,0,0);if(player.veh)c.root.position.copy(vehicles[player.veh].userData.seat);
  applyCloth(c,S.look.cloth);await applyHairStyle(c,S.look.hair);applyHairColor(c,S.look.hc);setAccs(c,S.look);if(lookOpen)setLayers(c,true);}
await setPlayerChar(S.look.ch);

/* ================= ANIMALS ================= */
const animalTpl={};
function tplFrom(g){g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const tmp=skClone(g.scene);const mx=new THREE.AnimationMixer(tmp);const ic=g.animations.find(a=>/idle|fly/i.test(a.name))||g.animations[0];if(ic){mx.clipAction(ic).play();mx.update(0);}tmp.updateMatrixWorld(true);
  const b=new THREE.Box3();tmp.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();b.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));}else if(o.isMesh)b.expandByObject(o);});
  return {g,h:b.max.y-b.min.y,minY:b.min.y};}
for(const [f,g] of Object.entries(ANI))animalTpl[f]=tplFrom(g);
for(const [f,g] of Object.entries(PETM))animalTpl[f]=tplFrom(g);
function makeCreature(file,h,{walk='Walk',idle='Idle',uni=false,tint=null,gold=false,glow=false}={}){const T_=animalTpl[file];const obj=skClone(T_.g.scene);const sc=h/T_.h;obj.scale.setScalar(sc);obj.position.y=-T_.minY*sc;
  const g=new THREE.Group();g.add(obj);
  const remat=fn=>obj.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(fn):fn(o.material);}});
  if(uni){remat(m=>{const n=m.clone();n.color.lerp(new THREE.Color(0xffffff),.85);n.emissive=new THREE.Color(0xffd6f5);n.emissiveIntensity=.12;return n;});
    g.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(obj);
    const horn=new THREE.Mesh(new THREE.ConeGeometry(.06,.45,12),new THREE.MeshStandardMaterial({color:0xffd54f,metalness:.8,roughness:.25,emissive:0xffb300,emissiveIntensity:.3}));
    horn.position.set(0,bb.max.y-.02,bb.max.z-.3);horn.rotation.x=.55;horn.castShadow=true;g.add(horn);g.userData.horn=horn;}
  if(tint!==null&&tint!==undefined){const hsl={};const tc=new THREE.Color(tint);remat(m=>{const n=m.clone();n.color.getHSL(hsl);
    if(gold){n.color.copy(tc).multiplyScalar(.6+hsl.l);n.metalness=.7;n.roughness=.3;n.emissive=new THREE.Color(0x5a3c00);n.emissiveIntensity=.3;}
    else if(n.map){n.color.copy(tc).lerp(new THREE.Color(0xffffff),.35);}
    else if(hsl.l>.12||hsl.s>.15){const th={};tc.getHSL(th);n.color.setHSL(th.h,th.s,clamp(th.l*.55+hsl.l*.6,0,.95));}
    if(glow&&!gold){n.emissive=tc.clone().multiplyScalar(.35);n.emissiveIntensity=.6;}return n;});}
  const mixer=new THREE.AnimationMixer(obj);const anims=T_.g.animations;const clip=n=>anims.find(a=>a.name===n)||anims.find(a=>a.name.toLowerCase().includes(n.toLowerCase()));
  const w=clip(walk)||clip('fly')||anims[0],i=clip(idle)||clip('fly')||anims[0];
  const walkA=mixer.clipAction(w),idleA=mixer.clipAction(i);idleA.play();mixer.update(rand(0,2));return {g,obj,mixer,walk:walkA,idle:idleA,moving:false};}
const varName=a=>ANIMALS[a.t].var[a.r||0];
function makeAnimal(t,r=0){const D_=ANIMALS[t];const tint=D_.tint[r];return makeCreature(D_.f,D_.h*(1+.06*r),{walk:D_.walk,idle:D_.idle,uni:D_.uni,tint,gold:tint===0xffcc33,glow:r===3});}
const animalObjs=[];
function capacity(){return S.pens*penCap();}
function placeAnimals(){
  for(let i=animalObjs.length-1;i>=0;i--){const o=animalObjs[i];if(!S.animals.includes(o.a)){scene.remove(o.m.g);animalObjs.splice(i,1);}}
  S.animals.forEach((a,i)=>{const pen=Math.floor(i/penCap());let o=animalObjs.find(o=>o.a===a);if(i>=capacity()){if(o){scene.remove(o.m.g);animalObjs.splice(animalObjs.indexOf(o),1);}return;}
    if(o){o.pen=pen;return;}const [px,pz]=penPos(pen);
    const m=makeAnimal(a.t,a.r||0);m.g.position.set(px+rand(-2.3,2.3),0,pz+rand(-2.3,2.3));m.g.rotation.y=rand(0,6.28);scene.add(m.g);
    const D_=ANIMALS[a.t];const ic=emoji(D_.prod.e,.8);ic.position.y=D_.h+.7;ic.visible=false;m.g.add(ic);
    const fed=emoji('💖',.55);fed.position.y=D_.h+.35;fed.visible=false;m.g.add(fed);
    if(a.r>=2){const sp=emoji(a.r===3?'🌟':'✨',.5);sp.position.y=D_.h+.15;m.g.add(sp);m.sp=sp;}
    animalObjs.push({a,m,ic,fed,pen,tx:px,tz:pz,wait:rand(0,3)});});}
function setMove(m,mv){if(m.moving===mv)return;m.moving=mv;const on=mv?m.walk:m.idle,off=mv?m.idle:m.walk;if(on===off)return;on.reset().fadeIn(.25).play();off.fadeOut(.25);}

/* ================= COMPANION ================= */
let pet=null;
function spawnPet(){if(pet){scene.remove(pet.m.g);pet=null;}if(!S.pet||!PETS[S.pet])return;const P=PETS[S.pet];
  const m=P.f==='pug'?makeCreature('pug',P.h):makeCreature(P.f,P.h,{walk:P.fly?'Flying':'Walk',idle:P.fly?'Flying':'Idle',tint:P.tint??null,gold:!!P.gold});
  m.g.position.set(player.pos.x+1.5,0,player.pos.z+1);scene.add(m.g);const hearts=emoji('💕',.7);hearts.position.y=P.h+.6;hearts.visible=false;m.g.add(hearts);
  pet={m,P,hearts,ht:0,coinT:rand(30,50)};}
const petHas=id=>S.pet===id||(S.pet==='dragonaur');
const petIsDragon=()=>S.pet&&PETS[S.pet]&&PETS[S.pet].f==='dragon';

/* ================= WORLD PICKUPS: eggs, forage, ores ================= */
function eggTex(base,dot){const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');g.fillStyle=base;g.fillRect(0,0,128,128);g.fillStyle=dot;for(let i=0;i<26;i++){g.beginPath();g.arc(Math.random()*128,Math.random()*128,rand(3,9),0,7);g.fill();}const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;}
const eggMats=[['#ffd6e8','#ff6fa8'],['#d6f0ff','#3fa9f5'],['#e8ffd6','#43b047'],['#f3e3ff','#9c5cff'],['#fff4c2','#ff8a3d']].map(([a,b])=>new THREE.MeshPhysicalMaterial({map:eggTex(a,b),roughness:.35,clearcoat:.8,emissive:0x222222}));
const goldMat=new THREE.MeshStandardMaterial({color:0xffd54f,metalness:.95,roughness:.18,emissive:0x6a4600,emissiveIntensity:.4});
const beamGeo=new THREE.CylinderGeometry(.3,.45,10,12,1,true);
const worldEggs=[];
function maxEggs(){return 20+(S.own.cos?8:0)+(petHas('liliac')?6:0);}
function wildSpot(rmin,rmax,maxY=44){for(let k=0;k<50;k++){const a=rand(0,6.28),r=rand(rmin,rmax);const x=Math.cos(a)*r,z=Math.sin(a)*r;if(!wildOK(x,z)||nearFriend(x,z,18)||inLake(x,z,3))continue;const y=H(x,z);if(y>maxY)continue;return [x,y,z];}return null;}
function spawnEgg(){const mnt=Math.random()<.25;const p=mnt?wildSpot(300,365):wildSpot(95,290);if(!p)return;const [x,y,z]=p;
  const gold=(mnt&&Math.random()<.35)||Math.random()<(S.own.turn?.1:.04);const g=new THREE.Group();g.position.set(x,y,z);
  const e=E(SPH,gold?goldMat:pick(eggMats),0,.55,0,.3,.4,.3,g);
  const beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:gold?0xffd54f:0xfff8e0,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.position.y=5;g.add(beam);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.45,.7,32),new THREE.MeshBasicMaterial({color:gold?0xffd54f:0xfff3a8,transparent:true,opacity:.7,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.05;g.add(ring);
  scene.add(g);worldEggs.push({g,e,x,z,gold,t:rand(0,6)});}
for(let i=0;i<maxEggs();i++)spawnEgg();
const forage=[];
const FCOL={mure:0x3a2a6a,zmeura:0xe8304a,hribi:0x8a5a33,trufaalba:0xf4efe6};
function spawnForage(){const p=wildSpot(95,300,16);if(!p)return;const [x,y,z]=p;const f=wpick(FORAGE);const g=new THREE.Group();g.position.set(x,y,z);
  instance(NP['Bush_Common'],[TM(0,0,0,rand(0,6),.55)],{parent:g,shadow:false});
  for(let i=0;i<7;i++)E(SPH,mat(FCOL[f.id]||0xe8304a,{roughness:.5}),rand(-.5,.5),rand(.4,.85),rand(-.5,.5),.08,.08,.08,g,false);const ic=emoji(f.e,.7);ic.position.y=1.5;g.add(ic);scene.add(g);forage.push({g,x,z,f,ic});}
for(let i=0;i<34;i++)spawnForage();
const ores=[];
function spawnOre(){const p=wildSpot(250,360,60);if(!p)return;const [x,y,z]=p;const g=new THREE.Group();g.position.set(x,y,z);
  instance(NP['Rock_Medium_1'],[TM(0,-.2,0,rand(0,6),.9)],{parent:g});const cc=pick([0x8fe3ff,0xc49cff,0xff9ad5,0xfff07a]);const cm=new THREE.MeshStandardMaterial({color:cc,emissive:cc,emissiveIntensity:.5,roughness:.2,metalness:.2});
  for(let i=0;i<5;i++){const c=E(CONE,cm,rand(-.7,.7),rand(.9,1.4),rand(-.6,.6),.12,rand(.35,.6),.12,g,false);c.rotation.set(rand(-.5,.5),0,rand(-.5,.5));}
  const ic=emoji('⛏️',.7);ic.position.y=2.4;g.add(ic);scene.add(g);const col=addCirc(x,z,1.1);ores.push({g,x,z,hp:3,ic,col});}
for(let i=0;i<26;i++)spawnOre();

/* ================= FRIEND FARMS ================= */
const friendObjs=[];
FRIENDS.forEach((f,fi)=>{
  const g=new THREE.Group();g.position.set(f.x,0,f.z);scene.add(g);
  const brick=f.wall.startsWith('Wall_Uneven');
  const h=new THREE.Group();h.position.set(-5,0,-5.5);h.scale.setScalar(.85);g.add(h);houseBox(h,{wall:f.wall,win:brick?'Wall_UnevenBrick_Window_Wide_Round':'Wall_Plaster_Window_Wide_Round',door:brick?'Wall_UnevenBrick_Door_Round':'Wall_Plaster_Door_Round',corner:brick?'Corner_Exterior_Brick':'Corner_Exterior_Wood'});bake(h);
  addBoxC(f.x-5,f.z-5.5,2.9,2.9);
  const fg=new THREE.Group();fg.position.set(f.x,0,f.z);scene.add(fg);fenceRect(fg,11,11,'s',2.5);
  label(g,'🏡 '+f.farm,7.8,{size:1.4});
  const plots=[];const types=Object.keys(CROPS);
  for(let i=0;i<6;i++){const px=1.5+(i%3)*3.1,pz=-1+Math.floor(i/3)*3.1;const pg=new THREE.Group();pg.position.set(px,0,pz);g.add(pg);M(soilGeo,soilMat,0,.1,0,pg).castShadow=false;
    const t=pick(types);const nm=CROPS[t].st[CROPS[t].st.length-1];for(const dx of[-.8,0,.8])for(const dz of[-.8,0,.8])piece(CP,nm,dx,.24,dz,rand(0,6),CROPS[t].sc,pg);
    bake(pg);const drop=emoji('💧',.9);drop.position.y=1.8;pg.add(drop);plots.push({x:f.x+px,z:f.z+pz,need:Math.random()<.6,timer:rand(10,40),drop});}
  const pets=['vaca','oaie','porc','cal','catel','lama','zebra'];const petA=makeAnimal(pets[fi%pets.length],fi%3===2?1:0);petA.g.position.set(f.x-6,0,f.z+5);scene.add(petA.g);
  friendObjs.push({f,ch:null,loading:false,plots,tx:f.x,tz:f.z+4,wait:0,pet:petA,pos:new THREE.Vector3(f.x,0,f.z+4),rot:0,kneel:0,talk:0});
});

/* ================= WORKER BOTS ================= */
const BOT_CLIPS={};for(const a of UAL.animations)BOT_CLIPS[a.name]=a;
const bots={};
function makeBot(id){const W=WORKERS[id];const obj=skClone(UAL.scene);obj.scale.setScalar(.82);
  obj.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;const ms=matsOf(o).map(m=>{const n=m.clone();if(m.name==='M_Main'){n.color.setHex(W.col);n.roughness=.4;n.metalness=.25;}else{n.color.setHex(0xf2f2f2);n.metalness=.6;n.roughness=.3;}return n;});o.material=ms.length>1?ms:ms[0];}});
  const g=new THREE.Group();g.add(obj);const head=obj.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('DEF-head'));
  if(head){const hat=makeHeadAcc(id==='vanzator'?'sapca':id==='fabricant'?'caciula':id==='gradinar'?'flori':'paie');hat.scale.setScalar(1.25/.82);hat.position.set(0,.22,0);head.add(hat);}
  const lbl=textSprite('🤖 '+W.n.replace('Bot ',''),{size:.6,bg:'rgba(255,255,255,.9)'});lbl.position.y=1.85;g.add(lbl);
  const mixer=new THREE.AnimationMixer(obj);const acts={};for(const n of ['Idle_Loop','Walk_Loop','PickUp_Table','Interact']){if(!BOT_CLIPS[n])continue;const a=mixer.clipAction(BOT_CLIPS[n]);if(n==='PickUp_Table'||n==='Interact'){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}acts[n]=a;}
  const b={id,g,mixer,acts,cur:null,pos:new THREE.Vector3(),job:null,t:rand(0,2),rot:0,lock:0};
  const home=PL.casa;b.pos.set(home.x+rand(-3,3),0,home.z+6+rand(-1,1));g.position.copy(b.pos);scene.add(g);botPlay(b,'Idle_Loop');return b;}
function botPlay(b,n,fade=.25){if(b.cur===n)return;const a=b.acts[n],p=b.acts[b.cur];if(!a)return;a.reset().fadeIn(fade).play();if(p)p.fadeOut(fade);b.cur=n;}
for(const id in WORKERS)if(S.work[id])bots[id]=makeBot(id);
const workActive=id=>S.work[id]&&S.work[id].on&&S.coins>0;

/* ================= INPUT ================= */
const keys={};
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){doJump();e.preventDefault();}if(e.code==='KeyE')doAction();if(e.code==='KeyF')toggleVehicle();});
addEventListener('keyup',e=>keys[e.code]=false);
const joyEl=$('#joy'),knob=$('#knob');
const joy={id:null,ox:0,oy:0,vx:0,vy:0}, drag={id:null,x:0,y:0};
let camYaw=0, camPitch=.34, camDist=5.6;
function joyHome(){joyEl.style.left='';joyEl.style.top='';joyEl.style.bottom='';knob.style.transform='';}
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),gPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
function groundAt(cx,cy){ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);return ray.ray.intersectPlane(gPlane,hit)?hit.clone():null;}
canvas.addEventListener('pointerdown',e=>{
  if(arrange.on){arrangeDown(e);try{canvas.setPointerCapture(e.pointerId);}catch(_){}return;}
  if(modalOn)return;
  if(e.clientX<innerWidth*.45&&e.clientY>innerHeight*.38&&joy.id===null){joy.id=e.pointerId;joy.ox=e.clientX;joy.oy=e.clientY;
    joyEl.style.left=(e.clientX-70)+'px';joyEl.style.top=(e.clientY-70)+'px';joyEl.style.bottom='auto';}
  else if(drag.id===null){drag.id=e.pointerId;drag.x=e.clientX;drag.y=e.clientY;}
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}});
canvas.addEventListener('pointermove',e=>{
  if(arrange.on)return arrangeMove(e);
  if(e.pointerId===joy.id){let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const L=Math.hypot(dx,dy),mx=55;if(L>mx){dx*=mx/L;dy*=mx/L;}joy.vx=dx/mx;joy.vy=dy/mx;knob.style.transform=`translate(${dx}px,${dy}px)`;}
  else if(e.pointerId===drag.id){camYaw-=(e.clientX-drag.x)*.007;camPitch=clamp(camPitch+(e.clientY-drag.y)*.004,.05,1.15);drag.x=e.clientX;drag.y=e.clientY;}});
const endPtr=e=>{if(arrange.on)return arrangeUp(e);if(e.pointerId===joy.id){joy.id=null;joy.vx=joy.vy=0;joyHome();}if(e.pointerId===drag.id)drag.id=null;};
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{if(arrange.on){arrange.h=clamp(arrange.h+e.deltaY*.03,14,130);return;}camDist=clamp(camDist+e.deltaY*.01,3,16);},{passive:true});
$('#jump').addEventListener('pointerdown',e=>{e.preventDefault();doJump();});
$('#act').addEventListener('pointerdown',e=>{e.preventDefault();doAction();});
$('#veh').addEventListener('pointerdown',e=>{e.preventDefault();toggleVehicle();});
$('#bShop').onclick=()=>openShop(shopTab);$('#bLook').onclick=()=>openLook('ch');$('#bBag').onclick=()=>openBag('inv');$('#bArr').onclick=enterArrange;$('#bMis').onclick=openMissions;
$('#bOrd').onclick=()=>{if(S.own.comenzi)openOrders();else toast('Construiește Panoul de comenzi (Magazin → Clădiri) 📋');};
function doJump(){if(player.veh||arrange.on)return;if(player.ground){player.vy=7.6;player.ground=false;sfx.jump();}}

/* ================= HUD ================= */
function toast(msg){const d=document.createElement('div');d.className='t';d.textContent=msg;$('#toast').appendChild(d);setTimeout(()=>d.remove(),2400);while($('#toast').children.length>3)$('#toast').firstChild.remove();}
function hud(){$('#coins').textContent=fmt(S.coins);$('#eggs').textContent=S.eggs+S.gold;$('#ani').textContent=S.animals.length;$('#lv').textContent=S.lv;
  $('#xpI').style.width=Math.min(100,S.xp/D.xpFor(S.lv)*100)+'%';$('#bOrd').classList.toggle('dim',!S.own.comenzi);const md=$('#misDot');if(md)md.classList.toggle('on',missionsClaimable()>0);}
function happy(){if(pch)pch.happy=1.3;}
function addXP(n){S.xp+=n;let up=false;while(S.xp>=D.xpFor(S.lv)){S.xp-=D.xpFor(S.lv);S.lv++;up=true;}
  if(up){sfx.lvl();happy();if(pch&&!player.veh)playOnce(pch,'Dance_Loop',3.2);const gift=20+S.lv*10;S.coins+=gift;S.eggs++;
    const L=S.lv;const news=[...Object.values(CROPS),...Object.values(EXOTIC),...Object.values(BUILD),...Object.values(FACTORIES),...Object.values(TREES),...Object.values(PETS),...Object.values(WORKERS),...Object.values(TOOLS),...Object.values(VEH)].filter(c=>c.lv===L).map(c=>c.e+' '+c.n);
    if(FARM_LEVELS.some(f=>f.lv===L&&f.cost))news.push('🌍 Extinderea fermei');
    if(!modalOn)openModal(`<h2>⭐ Nivelul ${L}!</h2><div class="egg-big">🎉</div><p style="text-align:center">Cadou: <b>+${gift} 🪙</b> și <b>1 🥚 ou misterios</b></p>${news.length?`<h3>Ai deblocat:</h3><p>${news.join(' · ')}</p>`:''}<div style="text-align:center"><button class="big" data-close>Super! 🚀</button></div>`);
    else toast(`⭐ Nivelul ${L}! +${gift} 🪙 +1 🥚`);}
  hud();}
function quest(){const s=S.st;
  if(!s.plant)return'🌱 Mergi la parcelele maro și plantează un morcov';
  if(!s.harv)return'⏳ Așteaptă să crească ✨ și recoltează';
  if(!s.sold)return'💰 Du legumele la Piață și vinde-le';
  if(!s.eggs)return'🥚 Caută un ou misterios în natură (lumina din depărtare)';
  if(!s.hatch)return'✨ Deschide oul la Cuibul magic';
  if(missionsClaimable())return'🎯 Ai recompense de luat la Misiuni!';
  if(S.lv>=2&&!S.own.comenzi)return'📋 Construiește Panoul de comenzi (Magazin → Clădiri)';
  if(S.lv>=2&&!S.own.pusculita)return'🐖 Construiește Pușculița — face bani singură';
  if(S.lv>=3&&!S.own.f_furaje)return'🏭 Construiește Fabrica de furaje';
  if(S.lv>=4&&!Object.keys(S.work).length)return'🤖 Angajează un bot muncitor (Magazin → Muncitori)';
  if(S.lv>=5&&!S.own.sera)return'🌱 Construiește Sera pentru căpșuni și roșii';
  if(!S.pet&&S.lv>=2)return'🐉 Adoptă un companion (Magazin → Companioni)';
  const n=Object.keys(S.seen).length,N=Object.keys(ANIMALS).length*4;return n<N?`📖 Catalog animale: ${n}/${N} · Nivel ${S.lv}`:`🏆 Super fermier! Nivel ${S.lv}`;}

/* ================= INVENTORY ================= */
const ITEM={};
for(const [k,c] of Object.entries(CROPS))ITEM[k]={e:c.e,n:c.n,v:c.v};
for(const [k,c] of Object.entries(EXOTIC))ITEM[k]={e:c.e,n:c.n,v:c.v};
for(const a of Object.values(ANIMALS))ITEM[a.prod.id]={e:a.prod.e,n:a.prod.n,v:a.prod.v};
for(const [k,g] of Object.entries(GOODS))ITEM[k]={...g};
for(const [k,t] of Object.entries(TREES))ITEM[k]={e:t.e,n:t.pl,v:t.v};
for(const f of [...FISH,...FORAGE,...ORES])ITEM[f.id]={...f};
const itemInfo=k=>ITEM[k]||{e:'📦',n:k,v:1};
const invTotal=()=>Object.values(S.inv).reduce((a,b)=>a+b,0);
const invCap=()=>60+40*S.up.hambarCap;
function canStore(n,quiet){if(invTotal()+n<=invCap())return true;if(!quiet){toast('📦 Hambarul e plin! Vinde lucruri sau mărește-l (Magazin → Îmbunătățiri)');sfx.no();}return false;}
function addInv(k,n){S.inv[k]=(S.inv[k]||0)+n;}
function have(need){return Object.entries(need).every(([k,q])=>(S.inv[k]||0)>=q);}
function take(need){for(const [k,q] of Object.entries(need)){S.inv[k]-=q;if(S.inv[k]<=0)delete S.inv[k];}}
const sellMult=()=>S.own.moara?1.2:1;
function earn(n){S.coins+=n;S.st.sold+=n;}

/* ================= MODALS ================= */
let modalOn=false;
const modal=$('#modal'), box=$('#box');
function openModal(html,sheet=false){box.innerHTML='<button class="x" data-close>✕</button>'+html;modal.classList.toggle('sheet',sheet);modal.classList.add('on');modalOn=true;joy.id=null;joy.vx=joy.vy=0;joyHome();}
function closeModal(){modal.classList.remove('on');modalOn=false;if(lookOpen&&pch)setLayers(pch,false);lookOpen=false;dressDance=false;document.body.classList.remove('looking');curFac=null;}
modal.addEventListener('pointerdown',e=>{if(e.target===modal)closeModal();});
box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if('close' in d)return closeModal();
  if(d.tab)return openShop(d.tab);
  if(d.btab)return openBag(d.btab);
  if(d.buy)return buy(d.buy);
  if(d.look)return setLook(d.look);
  if(d.ltab)return openLook(d.ltab);
  if(d.dance){dressDance=!dressDance;return openLook(box.dataset.ltab||'ch');}
  if(d.hatch)return doHatch(d.hatch==='gold');
  if(d.make)return makeGood(d.make);
  if(d.collect)return collectFactory(d.collect);
  if(d.ord)return deliverOrder(+d.ord);
  if(d.drop)return dropOrder(+d.drop);
  if(d.sell)return sellOne(d.sell,+(d.q||1));
  if(d.sellall)return sellAllFromBag();
  if(d.sella)return sellAnimal(+d.sella);
  if(d.pet)return setPet(d.pet);
  if(d.wk)return toggleWorker(d.wk);
  if(d.gh)return ghAction(d.gh);
  if(d.mis)return claimDaily(+d.mis);
  if(d.ach)return claimAch(d.ach);});
const lockedLv=lv=>S.lv<lv;
function itemRow(em,name,desc,btnLabel,data,disabled){return `<div class="item"><div class="em">${em}</div><div class="info"><b>${name}</b><small>${desc}</small></div><button class="buy" data-buy="${data}" ${disabled?'disabled':''}>${btnLabel}</button></div>`;}
const lvBtn=(lv,own,cost)=>own?'✔ Ai':lockedLv(lv)?`🔒 Nivel ${lv}`:fmt(cost)+' 🪙';
const fieldCost=()=>150*S.fields*S.fields;
let shopTab='parcele';
function openShop(tab){shopTab=tab;const T_={parcele:'🌱 Câmp',cladiri:'🏠 Clădiri',fabrici:'🏭 Fabrici',muncitori:'🤖 Muncitori',pomi:'🌳 Pomi',decor:'🌷 Decor',animale:'🐾 Țarcuri',comp:'🐉 Companioni',unelte:'🧰 Unelte',vehicule:'🚜 Vehicule',upg:'⬆️ Îmbunătățiri'};
  let h=`<h2>🛒 Magazin <small style="font-size:16px">— ${fmt(S.coins)} 🪙 · ⭐ Nivel ${S.lv}</small></h2><div class="tabs">${Object.entries(T_).map(([k,v])=>`<button class="tab ${k===tab?'on':''}" data-tab="${k}">${v}</button>`).join('')}</div>`;
  if(tab==='parcele'){h+=S.unl<maxPlots()?itemRow('🟫','Parcelă nouă',`Ai ${S.unl}/${maxPlots()} parcele`,plotCost()+' 🪙','plot',S.coins<plotCost()):`<p>Ai toate parcelele din ${S.fields} ${S.fields>1?'câmpuri':'câmp'}.</p>`;
    const FL=FARM_LEVELS[S.farmLv+1];
    if(S.fields<FARM_LEVELS[S.farmLv].fields)h+=itemRow('🌾','Câmp nou (16 parcele)','Un câmp întreg pe care îl poți muta unde vrei',fmt(fieldCost())+' 🪙','field',S.coins<fieldCost());
    else if(FL)h+=`<p>🌾 Pentru încă un câmp, extinde ferma.</p>`;
    h+=FL?itemRow('🌍',`Extinde ferma (mărimea ${S.farmLv+2}/${FARM_LEVELS.length})`,`Ferma devine mult mai mare: loc de ${FL.fields} câmpuri și ${FL.pens} țarcuri`,lvBtn(FL.lv,false,FL.cost),'farm',lockedLv(FL.lv)||S.coins<FL.cost):'<p>🌍 Ferma ta e la mărimea maximă!</p>';
    h+='<h3>Semințe (le plătești când plantezi)</h3>'+Object.values(CROPS).map(c=>`<div class="item"><div class="em">${c.e}</div><div class="info"><b>${c.n}</b><small>${lockedLv(c.lv)?`🔒 de la nivelul ${c.lv} · `:''}Sămânță ${c.cost}🪙 · crește ${c.t}s · vinzi ${c.v}🪙/buc</small></div></div>`).join('');}
  if(tab==='cladiri')h+=Object.entries(BUILD).map(([k,b])=>itemRow(b.e,b.n,b.d2,lvBtn(b.lv,S.own[k],b.cost),'b:'+k,S.own[k]||lockedLv(b.lv)||S.coins<b.cost)).join('');
  if(tab==='fabrici')h+='<p>Fabricile transformă ce crești în produse scumpe.</p>'+Object.entries(FACTORIES).map(([k,f])=>itemRow(f.e,f.n,f.rec.map(r=>itemInfo(r.out).e+' '+itemInfo(r.out).n).join(', '),lvBtn(f.lv,S.own['f_'+k],f.cost),'f:'+k,S.own['f_'+k]||lockedLv(f.lv)||S.coins<f.cost)).join('');
  if(tab==='muncitori'){const wage=Object.entries(S.work).filter(([,w])=>w.on).reduce((s,[k])=>s+WORKERS[k].wage,0);
    h+=`<p>Boții lucrează singuri pe fermă, chiar și când nu joci. Primesc <b>salariu pe minut</b> cât timp sunt porniți (acum: <b>${wage} 🪙/min</b>). Îi poți opri oricând.</p>`;
    h+=Object.entries(WORKERS).map(([k,w])=>{const own=S.work[k];return `<div class="item"><div class="em">🤖</div><div class="info"><b>${w.n}</b><small>${w.d} · salariu ${w.wage} 🪙/min</small></div>${own?`<button class="buy" data-wk="${k}" style="background:${own.on?'#ff6b6b':'#43b047'}">${own.on?'⏸ Oprește':'▶ Pornește'}</button>`:`<button class="buy" data-buy="w:${k}" ${lockedLv(w.lv)||S.coins<w.cost?'disabled':''}>${lockedLv(w.lv)?'🔒 Nivel '+w.lv:'Angajează '+w.cost+' 🪙'}</button>`}</div>`;}).join('');}
  if(tab==='pomi')h+='<p>Pomii fac fructe iar și iar. Îi muți unde vrei cu 🏗️.</p>'+Object.entries(TREES).map(([k,t])=>itemRow(t.e,'Pom: '+t.n,`Fructe la ${t.t}s · ${t.v}🪙 bucata`,lockedLv(t.lv)?`🔒 Nivel ${t.lv}`:t.cost+' 🪙','t:'+k,lockedLv(t.lv)||S.coins<t.cost)).join('');
  if(tab==='decor')h+='<p>Decorațiuni pe care le aranjezi cum vrei (🏗️).</p>'+Object.entries(DECOR).map(([k,d])=>itemRow(d.e,d.n,`Ai ${S.decor.filter(x=>x.id===k).length}`,lockedLv(d.lv)?`🔒 Nivel ${d.lv}`:d.cost+' 🪙','d:'+k,lockedLv(d.lv)||S.coins<d.cost)).join('');
  if(tab==='animale'){const maxP=FARM_LEVELS[S.farmLv].pens;h+=`<p>Ai ${S.pens}/${maxP} țarcuri, câte ${penCap()} animale fiecare (${S.animals.length}/${capacity()}). Extinde ferma pentru mai multe țarcuri și mărește-le din Îmbunătățiri.</p>`;
    h+=S.pens<maxP?itemRow('🐾','Țarc nou',`Încă ${penCap()} locuri pentru animale`,fmt(PEN_COST[S.pens])+' 🪙','pen',S.coins<PEN_COST[S.pens]):'<p>Nu mai e loc de țarcuri — extinde ferma 🌍</p>';}
  if(tab==='comp'){h+='<p>Companionul te urmează peste tot și te ajută.</p>'+Object.entries(PETS).map(([k,p])=>{const own=S.pets[k];const act=S.pet===k;
      return `<div class="item"><div class="em">${p.e}</div><div class="info"><b>${p.n}</b><small>${p.bonus}</small></div>${own?`<button class="buy" data-pet="${k}" ${act?'disabled':''}>${act?'✔ Cu tine':'Ia-l cu tine'}</button>`:`<button class="buy" data-buy="p:${k}" ${lockedLv(p.lv)||S.coins<p.cost?'disabled':''}>${lockedLv(p.lv)?'🔒 Nivel '+p.lv:p.cost+' 🪙'}</button>`}</div>`;}).join('');}
  if(tab==='unelte')h+=Object.entries(TOOLS).map(([k,b])=>itemRow(b.e,b.n,b.d,lvBtn(b.lv,S.own[k],b.cost),'t2:'+k,S.own[k]||lockedLv(b.lv)||S.coins<b.cost)).join('');
  if(tab==='vehicule')h+=Object.entries(VEH).map(([k,b])=>itemRow(b.e,b.n,b.d,lvBtn(b.lv,S.own[k],b.cost),'v:'+k,S.own[k]||lockedLv(b.lv)||S.coins<b.cost)).join('');
  if(tab==='upg')h+=Object.entries(UPGRADES).map(([k,u])=>{const l=S.up[k];const need=u.need&&!S.own[u.need];const max=l>=u.max;const c=u.cost(l+(u.need?0:1));
      return itemRow(u.e,`${u.n} · nivel ${l}`,`Acum: ${u.d(l)}${max?'':' → '+u.d(l+1)}`,max?'MAX':need?'Construiește întâi':fmt(c)+' 🪙','u:'+k,max||need||S.coins<c);}).join('');
  const sc=box.scrollTop;const keep=modalOn&&box.dataset.view==='shop'+tab;openModal(h);box.dataset.view='shop'+tab;if(keep)box.scrollTop=sc;}
function pay(c){if(S.coins<c){toast('Nu ai destule monede 🪙');sfx.no();return false;}S.coins-=c;sfx.coin();hud();return true;}
function buy(what,fromWorld){
  const [k,id]=what.split(':');
  if(what==='plot'){if(S.unl>=maxPlots()||!pay(plotCost()))return;S.unl++;refreshPlot(S.unl-1);toast('🟫 Parcelă nouă!');addXP(2);}
  else if(what==='field'){const c=fieldCost();if(S.fields>=FARM_LEVELS[S.farmLv].fields||!pay(c))return;S.fields++;while(S.plots.length<maxPlots())S.plots.push({c:null,p:0});addField(S.fields-1);for(let i=0;i<maxPlots();i++)refreshPlot(i);rebuildFarmGrass();toast('🌾 Câmp nou! Îl poți muta cu 🏗️');addXP(10);}
  else if(what==='farm'){const FL=FARM_LEVELS[S.farmLv+1];if(!FL||lockedLv(FL.lv)||!pay(FL.cost))return;S.farmLv++;buildFarmFence();toast('🌍 Ferma ta a crescut!');addXP(25);}
  else if(what==='pen'){if(S.pens>=FARM_LEVELS[S.farmLv].pens||!pay(PEN_COST[S.pens]))return;addPen(S.pens);S.pens++;placeAnimals();rebuildFarmGrass();toast('🐾 Țarc nou construit!');addXP(5);}
  else if(k==='b'){const b=BUILD[id];if(S.own[id]||lockedLv(b.lv)||!pay(b.cost))return;S.own[id]=true;if(UPGRADES[id]&&UPGRADES[id].need&&id!=='sera'&&!S.up[id])S.up[id]=1;addBuilding(id);rebuildFarmGrass();toast(b.e+' '+b.n+' — construit!');addXP(8);happy();}
  else if(k==='f'){const f=FACTORIES[id];if(S.own['f_'+id]||lockedLv(f.lv)||!pay(f.cost))return;S.own['f_'+id]=true;S.fac[id]={q:[],done:[]};addFactory(id);rebuildFarmGrass();toast(f.e+' '+f.n+' — construită!');addXP(15);happy();}
  else if(k==='t'){const t=TREES[id];if(lockedLv(t.lv)||!pay(t.cost))return;const key='t:'+id+'#'+(S.dn++);S.trees[key]={t:id,p:0};addFruitTree(key);rebuildFarmGrass();toast(t.e+' Pom plantat! Îl poți muta cu 🏗️');addXP(5);}
  else if(k==='d'){const d=DECOR[id];if(lockedLv(d.lv)||!pay(d.cost))return;const key='d:'+id+'#'+(S.dn++);S.decor.push({id,key});addDecor(id,key);rebuildFarmGrass();toast(d.e+' '+d.n+' — pune-l unde vrei cu 🏗️');addXP(2);}
  else if(k==='t2'){const t=TOOLS[id];if(S.own[id]||lockedLv(t.lv)||!pay(t.cost))return;S.own[id]=true;toast(t.e+' '+t.n+' — cumpărat!');}
  else if(k==='v'){const v=VEH[id];if(S.own[id]||lockedLv(v.lv)||!pay(v.cost))return;S.own[id]=true;spawnVehicle(id);toast(v.e+' '+v.n+' — e al tău!');addXP(10);}
  else if(k==='p'){const p=PETS[id];if(S.pets[id]||lockedLv(p.lv)||!pay(p.cost))return;S.pets[id]=true;setPet(id,true);toast(p.e+' '+p.n+' e acum companionul tău!');addXP(10);}
  else if(k==='w'){const w=WORKERS[id];if(S.work[id]||lockedLv(w.lv)||!pay(w.cost))return;S.work[id]={on:true};bots[id]=makeBot(id);toast('🤖 '+w.n+' a început lucrul!');addXP(10);}
  else if(k==='u'){const u=UPGRADES[id];const l=S.up[id];if(l>=u.max)return;if(u.need&&!S.own[u.need])return;const c=u.cost(l+(u.need?0:1));if(!pay(c))return;S.up[id]++;if(id==='sera')refreshGH();if(id==='tarcCap')placeAnimals();toast(u.e+' '+u.n+' — nivel '+S.up[id]);addXP(5);}
  refreshLocks();save();hud();if(!fromWorld&&modalOn&&!lookOpen)openShop(shopTab);}
function setPet(id,silent){S.pet=id;spawnPet();save();if(!silent&&modalOn)openShop('comp');}
function toggleWorker(id){const w=S.work[id];if(!w)return;w.on=!w.on;toast(`🤖 ${WORKERS[id].n} ${w.on?'lucrează':'s-a oprit'}`);save();openShop('muncitori');}

/* ---------- bag: inventory / animals / catalog ---------- */
function openBag(tab='inv'){const T_={inv:'📦 Hambar',ani:'🐾 Animalele mele',cat:'📖 Catalog'};
  let h=`<h2>🎒 Rucsacul meu</h2><div class="tabs">${Object.entries(T_).map(([k,v])=>`<button class="tab ${k===tab?'on':''}" data-btab="${k}">${v}</button>`).join('')}</div>`;
  if(tab==='inv'){const inv=Object.entries(S.inv).filter(([,n])=>n>0);
    h+=`<p>📦 ${invTotal()}/${invCap()} · 🥚 ${S.eggs} ouă · 🌟 ${S.gold} ouă de aur</p>`;
    if(inv.length)h+=`<div style="text-align:right"><button class="buy" data-sellall="1">💰 Vinde tot (${fmt(inv.reduce((s,[k,n])=>s+Math.round(itemInfo(k).v*sellMult()*.9)*n,0))} 🪙)</button></div>`;
    h+=inv.length?inv.map(([k,n])=>{const it=itemInfo(k);const v=Math.round(it.v*sellMult()*.9);return `<div class="item"><div class="em">${it.e}</div><div class="info"><b>${it.n} × ${n}</b><small>${v}🪙 bucata</small></div><button class="buy" data-sell="${k}" data-q="1">Vinde 1</button>${n>=10?`<button class="buy" data-sell="${k}" data-q="10">×10</button>`:''}</div>`;}).join(''):'<p>Hambarul e gol.</p>';
    h+='<p style="font-size:13px;opacity:.7">Din rucsac vinzi cu 10% mai ieftin decât la Piață.</p>';}
  if(tab==='ani'){h+=`<p>${S.animals.length}/${capacity()} locuri în ${S.pens} țarcuri. Animalele rare produc mai mult și valorează mai mult.</p>`;
    if(S.animals.length>capacity())h+=`<p>⚠️ ${S.animals.length-capacity()} animale așteaptă un țarc nou!</p>`;
    h+=S.animals.map((a,i)=>{const A_=ANIMALS[a.t],R=RARITY[a.r||0];const price=Math.round(A_.price*R.sell);return `<div class="item"><div class="em">${A_.e}</div><div class="info"><b>${varName(a)} <span class="rar" style="background:${R.c}">${R.n}</span></b><small>${A_.prod.e} ${A_.prod.n} ×${R.mult} la ${A_.prod.t}s${i>=capacity()?' · fără țarc':''}</small></div><button class="buy" data-sella="${i}">Vinde ${fmt(price)} 🪙</button></div>`;}).join('')||'<p>Nu ai animale încă — deschide ouă la Cuibul magic!</p>';}
  if(tab==='cat'){const n=Object.keys(S.seen).length,N=Object.keys(ANIMALS).length*4;
    h+=`<p>Ai descoperit <b>${n}/${N}</b> animale. Ouăle de aur aduc mai des variante rare, iar animalele mitice ies doar din ouă de aur.</p><div class="bar2"><i style="width:${n/N*100}%"></i></div>`;
    for(const [k,A_] of Object.entries(ANIMALS)){h+=`<h3>${A_.e} ${A_.n}${A_.mythic?' <span class="rar" style="background:#ef5350">Mitic</span>':''}</h3><div class="coll">`+[0,1,2,3].map(r=>{const s=S.seen[k+':'+r];const R=RARITY[r];
      return `<div class="${s?'':'no'}" style="border-color:${s?R.c:'transparent'}"><span>${s?A_.e:'❔'}</span>${s?A_.var[r]:'???'}<small style="color:${R.c}">${R.n}</small></div>`;}).join('')+'</div>';}}
  const sc=box.scrollTop;const keep=modalOn&&box.dataset.view==='bag'+tab;openModal(h);box.dataset.view='bag'+tab;if(keep)box.scrollTop=sc;}
function sellOne(k,q=1){if(!S.inv[k])return;q=Math.min(q,S.inv[k]);const v=Math.round(itemInfo(k).v*sellMult()*.9)*q;S.inv[k]-=q;if(!S.inv[k])delete S.inv[k];earn(v);sfx.coin();hud();save();openBag('inv');}
function sellAllFromBag(){let sum=0;for(const [k,n] of Object.entries(S.inv))sum+=Math.round(itemInfo(k).v*sellMult()*.9)*n;S.inv={};earn(sum);toast(`💰 +${fmt(sum)} 🪙`);sfx.coin();addXP(Math.ceil(sum/30));hud();save();openBag('inv');}
function sellAnimal(i){const a=S.animals[i];if(!a)return;const A_=ANIMALS[a.t];const price=Math.round(A_.price*RARITY[a.r||0].sell);S.animals.splice(i,1);earn(price);toast(`${A_.e} ${varName(a)} vândut: +${fmt(price)} 🪙`);sfx.coin();placeAnimals();hud();save();openBag('ani');}

/* ---------- dressing room ---------- */
function openLook(tab='ch'){lookOpen=true;if(pch)setLayers(pch,true);const L=S.look;
  const tabs={ch:'🧑 Personaj',cl:'👗 Haine',hair:'💇 Păr',acc:'🎀 Accesorii'};
  let h=`<h2>👗 Cabina de probă <button class="buy" data-dance="1" style="font-size:13px;min-width:0;padding:2px 8px">${dressDance?'⏹ Stop':'💃 Dans'}</button></h2><div class="tabs">${Object.entries(tabs).map(([k,v])=>`<button class="tab ${k===tab?'on':''}" data-ltab="${k}">${v}</button>`).join('')}</div>`;
  if(tab==='ch')h+='<div class="chars">'+Object.entries(CHARS).map(([k,c])=>`<button class="chr ${L.ch===k?'on':''} ${S.chars[k]?'':'lock'}" data-look="c:${k}"><img src="${A}ui/${k}.jpg" alt="${c.n}">${c.n}<small>${S.chars[k]?c.d:'🔒 '+c.cost+'🪙'}</small></button>`).join('')+'</div>';
  if(tab==='cl')h+='<p>Alege culoarea hainelor.</p><div class="grid">'+OUTFIT_COLORS.map((o,i)=>`<button class="opt ${L.cloth===i?'on':''}" data-look="o:${i}"><span class="sw2" style="background:${o.c===null?'linear-gradient(45deg,#ffd6e8,#d6f0ff)':o.c===-1?'#222':`hsl(${o.c} 70% 55%)`}"></span>${o.n}<br>${S.cloths[i]?'':'🔒 '+o.cost+'🪙'}</button>`).join('')+'</div>';
  if(tab==='hair'){h+='<h3>Coafură</h3><div class="chars">'+Object.entries(CHARS).map(([k,c])=>`<button class="chr ${(L.hair||L.ch)===k?'on':''}" data-look="h:${k}"><img src="${A}ui/${k}.jpg" alt="${c.n}" style="object-position:50% 8%;aspect-ratio:1">Părul lui ${c.n}</button>`).join('')+'</div>';
    h+='<h3>Culoare păr</h3><div class="row">'+HAIR_COLORS.map((c,i)=>`<button class="sw ${L.hc===i?'on':''}" title="${c.n}" style="background:${c.c?'#'+c.c.toString(16).padStart(6,'0'):'#fff'}" data-look="t:${i}">${c.c?'':'✨'}</button>`).join('')+'</div>';}
  if(tab==='acc'){const grid=(title,set,own,cur,p)=>`<h3>${title}</h3><div class="grid">`+Object.entries(set).map(([k,a])=>`<button class="opt ${cur===k?'on':''}" data-look="${p}:${k}"><span class="em">${a.e}</span>${a.n}<br>${own[k]?'':'🔒 '+a.cost+'🪙'}</button>`).join('')+'</div>';
    h+=grid('Pe cap',ACCS,S.accs,L.acc,'a')+grid('Ochelari',FACES,S.faces,L.face,'f')+grid('Pe spate',BACKS,S.backs,L.back,'b');}
  openModal(h,true);lookOpen=true;document.body.classList.add('looking');box.dataset.ltab=tab;box.dataset.view='look';}
let switching=false;
async function setLook(v){const [k,val]=v.split(':');const tab=box.dataset.ltab||'ch';
  if(k==='c'){if(switching||S.look.ch===val)return;if(!S.chars[val]){if(!pay(CHARS[val].cost))return;S.chars[val]=true;toast('✨ '+CHARS[val].n+' e acum a ta!');}
    switching=true;S.look.ch=val;if(S.look.hair===val)S.look.hair=null;if(!vrmCache[val])toast('⏳ Se încarcă '+CHARS[val].n+'…');try{await setPlayerChar(val);}catch(e){toast('Nu s-a putut încărca personajul');}switching=false;happy();}
  if(k==='o'){const i=+val;if(!S.cloths[i]){if(!pay(OUTFIT_COLORS[i].cost))return;S.cloths[i]=true;}S.look.cloth=i;applyCloth(pch,i);happy();}
  if(k==='h'){if(switching)return;switching=true;const id=val===S.look.ch?null:val;S.look.hair=id;if(id)toast('⏳ Se încarcă coafura…');try{await applyHairStyle(pch,id);applyHairColor(pch,S.look.hc);}catch(e){toast('Nu s-a putut încărca coafura');}switching=false;happy();}
  if(k==='t'){S.look.hc=+val;applyHairColor(pch,S.look.hc);}
  if(k==='a'){if(!S.accs[val]){if(!pay(ACCS[val].cost))return;S.accs[val]=true;}S.look.acc=val;setAccs(pch,S.look);}
  if(k==='f'){if(!S.faces[val]){if(!pay(FACES[val].cost))return;S.faces[val]=true;}S.look.face=val;setAccs(pch,S.look);}
  if(k==='b'){if(!S.backs[val]){if(!pay(BACKS[val].cost))return;S.backs[val]=true;}S.look.back=val;setAccs(pch,S.look);}
  save();if(!lookOpen)return;const sc=box.scrollTop;openLook(tab);box.scrollTop=sc;}

/* ---------- eggs ---------- */
function openEggs(){
  openModal(`<h2>✨ Cuibul magic</h2><p>Fiecare ou: <b>60%</b> animal, <b>40%</b> gol. Animalele pot fi <b style="color:#3fa9f5">rare</b>, <b style="color:#b06cff">epice</b> sau <b style="color:#ffb300">legendare</b>. Ouăle de aur aduc mult mai des animale rare și doar ele pot avea animale <b style="color:#ef5350">mitice</b> (slime, dragoni)!</p>
  <div class="egg-big" id="eggShow">🥚</div><div class="row" style="justify-content:center">
  <button class="big" data-hatch="normal" ${S.eggs?'':'disabled'}>🥚 Deschide (${S.eggs})</button>
  <button class="big" style="background:#e0a800" data-hatch="gold" ${S.gold?'':'disabled'}>🌟 Ou de aur (${S.gold})</button></div>
  <p style="text-align:center;font-size:14px;opacity:.75">Ouăle le găsești în natură — caută luminițele!</p>`);}
let hatching=false;
function rollAnimal(gold){if(!gold&&Math.random()<.4)return null;if(gold&&Math.random()<.15)return null;
  const sp=wpick(Object.entries(ANIMALS).filter(([,a])=>gold||!a.mythic),([,a])=>gold&&a.w<=10?a.w*3:a.w)[0];
  const rw=gold?[30,38,22,10]:RARITY.map(r=>r.w);const r=wpick([0,1,2,3],i=>rw[i]);return {t:sp,r};}
function doHatch(gold){if(hatching)return;if(gold?!S.gold:!S.eggs)return;hatching=true;if(gold)S.gold--;else S.eggs--;hud();
  const show=$('#eggShow');show.innerHTML=`<span class="wob">${gold?'🌟':'🥚'}</span>`;snd(500,.1,'triangle');
  setTimeout(()=>{S.st.hatch++;addXP(gold?10:4);const res=rollAnimal(gold);
    if(!res){show.innerHTML='🐣<div style="font-size:22px">Oul a fost gol… 😅<br>Mai încearcă!</div>';sfx.sad();}
    else{const An=ANIMALS[res.t],R=RARITY[res.r];const key=res.t+':'+res.r;const isNew=!S.seen[key];S.seen[key]=true;S.st.rare=Object.keys(S.seen).length;
      S.animals.push({t:res.t,r:res.r,id:S.aid++,pt:0,rd:false});const over=S.animals.length>capacity();
      show.innerHTML=`${An.e}<div style="font-size:22px">${isNew?'🆕 ':''}<b>${An.var[res.r]}</b> <span class="rar" style="background:${R.c};font-size:15px">${R.n}</span>${over?'<br><small>⚠️ Ai nevoie de un țarc nou</small>':''}</div>`;sfx.hatch();happy();placeAnimals();}
    save();hud();hatching=false;
    box.querySelectorAll('[data-hatch]').forEach(b=>{const g=b.dataset.hatch==='gold';b.disabled=g?!S.gold:!S.eggs;b.textContent=g?`🌟 Ou de aur (${S.gold})`:`🥚 Deschide (${S.eggs})`;});},1300);}

/* ---------- factories ---------- */
let curFac=null;
const slots=()=>1+S.up.linii;
function openFactory(id){curFac=id;const F=FACTORIES[id];const st=S.fac[id]||(S.fac[id]={q:[],done:[]});
  let h=`<h2>${F.e} ${F.n}</h2><p>Lucrează ${st.q.length}/${slots()} · gata: ${st.done.length}</p>`;
  if(st.done.length)h+=`<div class="item"><div class="em">${st.done.map(o=>itemInfo(o).e).join('')}</div><div class="info"><b>Produse gata!</b></div><button class="buy" data-collect="${id}">Ia-le</button></div>`;
  for(const q of st.q){const r=F.rec[q.r];h+=`<div class="item"><div class="em">${itemInfo(r.out).e}</div><div class="info"><b>${itemInfo(r.out).n}</b><small>⏳ ${fmtTime(q.t)}</small></div></div>`;}
  h+='<h3>Rețete</h3>'+F.rec.map((r,i)=>{const ok=have(r.need)&&st.q.length<slots();return `<div class="item"><div class="em">${itemInfo(r.out).e}</div><div class="info"><b>${r.q>1?r.q+'× ':''}${itemInfo(r.out).n}</b><small>${Object.entries(r.need).map(([k,q])=>`${itemInfo(k).e}${q} <span style="opacity:.6">(${S.inv[k]||0})</span>`).join(' + ')} · ${fmtTime(r.t)} · ${itemInfo(r.out).v}🪙</small></div><button class="buy" data-make="${id}:${i}" ${ok?'':'disabled'}>Fă</button></div>`;}).join('');
  openModal(h);}
function startRecipe(id,i){const F=FACTORIES[id],r=F.rec[i],st=S.fac[id];if(!r||st.q.length>=slots()||!have(r.need))return false;take(r.need);st.q.push({r:i,t:r.t});st.last=i;return true;}
function makeGood(v){const [id,i]=v.split(':');if(startRecipe(id,+i)){sfx.plant();save();openFactory(id);}}
function collectFactory(id,quiet){const st=S.fac[id];if(!st||!st.done.length)return 0;if(!canStore(st.done.length,quiet))return 0;let xp=0;const n=st.done.length;for(const o of st.done){addInv(o,1);xp+=4;}if(!quiet)toast(`${st.done.map(o=>itemInfo(o).e).join('')} în hambar!`);S.st.made+=n;st.done=[];if(!quiet){sfx.pick();happy();}addXP(xp);save();if(!quiet&&curFac===id&&modalOn)openFactory(id);return n;}

/* ---------- greenhouse ---------- */
function openGH(){const n=ghSlotsN();while(S.gh.length<n)S.gh.push({c:null,p:0});const ready=S.gh.slice(0,n).filter(s=>s.c&&s.p>=1).length;
  let h=`<h2>🌱 Sera</h2><p>Aici cresc fructe și flori exotice, pentru rețete scumpe (înghețată, pizza, ketchup, buchete, ciocolată). ${n} locuri — mărește sera din Îmbunătățiri.</p>`;
  if(ready)h+=`<div style="text-align:right"><button class="buy" data-gh="all:1">🧺 Culege tot (${ready})</button></div>`;
  h+='<div>'+S.gh.slice(0,n).map((s,i)=>s.c?`<button class="slot" data-gh="h:${i}"><span>${EXOTIC[s.c].e}</span>${s.p>=1?'✅ Culege':Math.floor(s.p*100)+'%'}</button>`:`<span class="slot" style="opacity:.6"><span>🟫</span>Liber</span>`).join('')+'</div>';
  h+='<h3>Plantează în locurile libere</h3>'+Object.entries(EXOTIC).map(([k,x])=>`<div class="item"><div class="em">${x.e}</div><div class="info"><b>${x.n}</b><small>${lockedLv(x.lv)?`🔒 nivel ${x.lv} · `:''}${x.cost}🪙/loc · ${fmtTime(x.t)} · 2 bucăți × ${x.v}🪙</small></div><button class="buy" data-gh="p:${k}" ${lockedLv(x.lv)||S.coins<x.cost?'disabled':''}>Plantează</button></div>`).join('');
  openModal(h);}
function ghHarvest(i,quiet){const s=S.gh[i];if(!s||!s.c||s.p<1)return 0;if(!canStore(2,quiet))return 0;addInv(s.c,2);s.last=s.c;s.c=null;s.p=0;S.st.harv++;addXP(3);return 2;}
function ghPlant(k,quiet){const X=EXOTIC[k];let n=0;for(const s of S.gh.slice(0,ghSlotsN())){if(s.c)continue;if(S.coins<X.cost)break;S.coins-=X.cost;s.c=k;s.p=0;n++;}if(n&&!quiet){toast(`${X.e} Ai plantat ${n} în seră`);sfx.plant();}return n;}
function ghAction(v){const [k,a]=v.split(':');
  if(k==='h'){if(ghHarvest(+a)){toast(`${EXOTIC[S.gh[+a].last].e} +2 în hambar`);sfx.pick();}}
  if(k==='all'){let n=0;for(let i=0;i<ghSlotsN();i++)n+=ghHarvest(i,true);if(n){toast(`🧺 +${n} din seră`);sfx.pick();}}
  if(k==='p')ghPlant(a);refreshGH();hud();save();openGH();}

/* ---------- orders ---------- */
function orderPool(){const ids=Object.entries(CROPS).filter(([,c])=>c.lv<=S.lv).map(([k])=>k);
  for(const [k,a] of Object.entries(ANIMALS))if(S.animals.some(x=>x.t===k))ids.push(a.prod.id);
  for(const [k,f] of Object.entries(FACTORIES))if(S.own['f_'+k])for(const r of f.rec)ids.push(r.out);
  for(const t of Object.values(S.trees))ids.push(t.t);if(S.own.undita)ids.push('biban','caras');if(S.own.sera)for(const [k,x] of Object.entries(EXOTIC))if(x.lv<=S.lv)ids.push(k);ids.push('mure');return [...new Set(ids)];}
function newOrder(){const pool=orderPool();const n=1+Math.floor(Math.random()*Math.min(3,1+S.lv/3));const items={};
  for(let i=0;i<n;i++){const k=pick(pool);const v=itemInfo(k).v;items[k]=(items[k]||0)+Math.max(1,Math.round(rand(2,6)*(v<12?1.5:v<40?.8:.4)));}
  const val=Object.entries(items).reduce((s,[k,q])=>s+itemInfo(k).v*q,0);
  return {items,coins:Math.round(val*rand(1.35,1.7)),xp:Math.round(4+val/6),wait:0,who:pick(['Bunica','Brutarul','Ana','Luca','Sofia','Matei','Ioana','Radu','Elena','Doamna Florica','Moș Ion','Primarul'])};}
function fillOrders(){while(S.orders.length<6)S.orders.push(newOrder());}
const orderNeeds=()=>{const need={};if(!S.own.comenzi)return need;for(const o of S.orders)if(!(o.wait>0))for(const [k,q] of Object.entries(o.items))need[k]=Math.max(need[k]||0,q);return need;};
function openOrders(){fillOrders();let h='<h2>📋 Comenzi</h2><p>Strânge ce cer oamenii și primești monede și ⭐ (mai mult decât la piață!).</p>';
  h+=S.orders.map((o,i)=>{if(o.wait>0)return `<div class="item"><div class="em">⏳</div><div class="info"><b>Comandă nouă în curând</b><small>${fmtTime(o.wait)}</small></div></div>`;
    const ok=have(o.items);return `<div class="item"><div class="em">📦</div><div class="info"><b>${o.who}: ${Object.entries(o.items).map(([k,q])=>`${itemInfo(k).e}×${q}`).join(' ')}</b><small>${Object.entries(o.items).map(([k,q])=>`${itemInfo(k).n} ${S.inv[k]||0}/${q}`).join(' · ')} · ⭐+${o.xp}</small></div><button class="buy" data-ord="${i}" ${ok?'':'disabled'}>+${fmt(o.coins)} 🪙</button><button class="buy" style="background:#ff6b6b;min-width:40px" data-drop="${i}">✕</button></div>`;}).join('');
  openModal(h);}
function deliverOrder(i){const o=S.orders[i];if(!o||o.wait>0||!have(o.items))return;take(o.items);earn(o.coins);S.st.orders++;toast(`📦 Comandă livrată: +${fmt(o.coins)} 🪙`);sfx.coin();happy();addXP(o.xp);S.orders[i]=Object.assign(newOrder(),{wait:12});save();hud();if(modalOn)openOrders();}
function dropOrder(i){S.orders[i]=Object.assign(newOrder(),{wait:30});save();openOrders();}

/* ---------- missions ---------- */
function ensureDaily(){if(S.dm.d===today()&&S.dm.list.length)return;const ks=[...DAILY].sort(()=>Math.random()-.5).slice(0,4);const tier=Math.min(2,Math.floor(S.lv/5));
  S.dm={d:today(),list:ks.map(m=>({k:m.k,n:m.n.replace('{q}',m.q[tier]),q:m.q[tier],r:m.r[tier]+S.lv*5,base:S.st[m.k]||0,done:false})),bonus:false};}
ensureDaily();
const dProg=m=>clamp((S.st[m.k]||0)-m.base,0,m.q);
const achLevel=k=>S.ach[k]||0;
function missionsClaimable(){let n=S.dm.list.filter(m=>!m.done&&dProg(m)>=m.q).length;for(const [k,,steps] of ACHIEVE){const l=achLevel(k);if(l<steps.length&&(S.st[k]||0)>=steps[l])n++;}return n;}
const MEDAL=['🥉','🥈','🥇','🏅','🏆'];
function openMissions(){ensureDaily();let h='<h2>🎯 Misiuni</h2><h3>Misiunile zilei</h3>';
  h+=S.dm.list.map((m,i)=>{const p=dProg(m);return `<div class="item"><div class="em">${m.done?'✅':'🎯'}</div><div class="info"><b>${m.n}</b><small>${fmt(p)}/${fmt(m.q)} · recompensă ${m.r} 🪙 + ⭐</small><div class="bar2"><i style="width:${p/m.q*100}%"></i></div></div><button class="buy" data-mis="${i}" ${m.done||p<m.q?'disabled':''}>${m.done?'Luat':'Ia'}</button></div>`;}).join('');
  h+=`<p>${S.dm.bonus?'🎁 Ai luat bonusul zilei! Mâine primești misiuni noi.':'🎁 Termină toate 4 misiunile pentru un <b>🌟 ou de aur</b>!'}</p>`;
  h+='<h3>Realizări</h3>'+ACHIEVE.map(([k,n,steps])=>{const l=achLevel(k);const v=S.st[k]||0;if(l>=steps.length)return `<div class="item"><div class="em">🏆</div><div class="info"><b>${n} — complet!</b><small>${'⭐'.repeat(5)}</small></div></div>`;const goal=steps[l];const rw=ACH_REWARD[l];
    return `<div class="item"><div class="em">${MEDAL[l]}</div><div class="info"><b>${n} ${'⭐'.repeat(l)}</b><small>${fmt(v)}/${fmt(goal)} · ${rw.c}🪙${rw.e?' + '+rw.e+'🥚':''}${rw.g?' + '+rw.g+'🌟':''}</small><div class="bar2"><i style="width:${Math.min(100,v/goal*100)}%"></i></div></div><button class="buy" data-ach="${k}" ${v<goal?'disabled':''}>Ia</button></div>`;}).join('');
  const sc=box.scrollTop;const keep=modalOn&&box.dataset.view==='mis';openModal(h);box.dataset.view='mis';if(keep)box.scrollTop=sc;}
function claimDaily(i){const m=S.dm.list[i];if(!m||m.done||dProg(m)<m.q)return;m.done=true;S.coins+=m.r;addXP(8+S.lv);sfx.coin();toast(`🎯 +${m.r} 🪙`);
  if(S.dm.list.every(x=>x.done)&&!S.dm.bonus){S.dm.bonus=true;S.gold++;toast('🎁 Toate misiunile zilei! +1 🌟 ou de aur');sfx.hatch();}save();hud();openMissions();}
function claimAch(k){const steps=ACHIEVE.find(a=>a[0]===k)[2];const l=achLevel(k);if(l>=steps.length||(S.st[k]||0)<steps[l])return;const rw=ACH_REWARD[l];S.coins+=rw.c;S.eggs+=rw.e||0;S.gold+=rw.g||0;S.ach[k]=l+1;addXP(15*(l+1));sfx.hatch();happy();toast(`🏆 Realizare! +${rw.c} 🪙`);save();hud();openMissions();}

/* ---------- fishing ---------- */
const fish={on:false,phase:'',t:0,bob:null,L:null};
function startFish(L){if(fish.on)return;fish.on=true;fish.phase='wait';fish.t=rand(2,5);fish.L=L;
  const dx=L.x-player.pos.x,dz=L.z-player.pos.z,d=Math.hypot(dx,dz);player.face=Math.atan2(dx,dz);showRod(pch,true);playOnce(pch,'Spell_Simple_Shoot',.8);
  const bob=new THREE.Group();E(SPH,mat(0xff3b3b,{roughness:.4}),0,0,0,.12,.12,.12,bob);E(SPH,mat(0xffffff),0,.09,0,.08,.06,.08,bob);
  bob.position.set(player.pos.x+dx/d*4,-.5,player.pos.z+dz/d*4);scene.add(bob);fish.bob=bob;toast('🎣 Așteaptă să tragă peștele…');}
function endFish(){if(fish.bob)scene.remove(fish.bob);fish.on=false;fish.phase='';fish.bob=null;if(pch)showRod(pch,false);}
function updateFish(dt){if(!fish.on)return;fish.t-=dt;const b=fish.bob;
  if(Math.hypot(player.pos.x-fish.L.x,player.pos.z-fish.L.z)>fish.L.r+6){endFish();return;}
  if(fish.phase==='wait'){b.position.y=-.5+Math.sin(T*3)*.03;if(fish.t<=0){fish.phase='bite';fish.t=1.6;snd(900,.1,'square',.06);}}
  else if(fish.phase==='bite'){b.position.y=-.62+Math.sin(T*30)*.07;if(fish.t<=0){toast('🐟 A scăpat! Mai încearcă.');sfx.sad();endFish();}}}
function catchFish(){if(fish.phase!=='bite'){toast('Încă nu! Așteaptă să se miște dopul');endFish();return;}
  const f=wpick(FISH);if(canStore(1)){addInv(f.id,1);S.st.fish++;toast(`${f.e} Ai prins: ${f.n}!`);sfx.pick();happy();addXP(f.v>20?6:3);}endFish();playOnce(pch,'Interact',.8);save();}

/* ================= ACTIONS ================= */
let target=null;
const actEl=$('#act'), seedsEl=$('#seeds'), vehEl=$('#veh');
function nearest(){
  const p=player.pos;let best=null,bd=1e9;const consider=(d,o,r)=>{if(d<r&&d<bd){bd=d;best=o;}};
  for(let i=0;i<S.unl;i++){const [x,z]=plotPos(i);consider(Math.hypot(p.x-x,p.z-z),{t:'plot',i},player.veh?2.6:2);}
  const near=(o,extra=1.4)=>{const [hw,hd]=fpSize(o);return Math.max(0,Math.abs(p.x-o.x)-hw,Math.abs(p.z-o.z)-hd)<extra;};
  if(near(market,1.6))consider(.5,{t:'market'},9);
  if(near(nest,1.4))consider(.6,{t:'nest'},9);
  for(const id in FACTORIES)if(PL['f:'+id]&&near(PL['f:'+id],1.4))consider(.7,{t:'fac',id},9);
  for(const id of ['pusculita','limonada','pensiune'])if(PL['b:'+id]&&near(PL['b:'+id],1.3))consider(.7,{t:'pass',id},9);
  if(PL['b:stupi']&&near(PL['b:stupi'],1.3))consider(.7,{t:'hive'},9);
  if(PL['b:sera']&&near(PL['b:sera'],1.3))consider(.7,{t:'gh'},9);
  if(PL['b:comenzi']&&near(PL['b:comenzi'],1.3))consider(.7,{t:'orders'},9);
  for(const k in S.trees){const o=PL[k];if(o&&S.trees[k].p>=1)consider(Math.hypot(p.x-o.x,p.z-o.z),{t:'tree',k},2.6);}
  for(const k in locks){const L=locks[k];consider(Math.hypot(p.x-L.x,p.z-L.z),{t:'lock',k},2.4);}
  for(const o of animalObjs){const d=Math.hypot(p.x-o.m.g.position.x,p.z-o.m.g.position.z);if(o.a.rd)consider(d,{t:'animal',o},2.4);}
  for(let i=0;i<S.pens;i++){const [x,z]=penPos(i);if(S.inv.hrana&&animalObjs.some(o=>o.pen===i&&!o.a.fed))consider(Math.hypot(p.x-x,p.z-z)+1.2,{t:'feed',pen:i},7.2);}
  for(const fo of friendObjs)for(const pl of fo.plots)if(pl.need)consider(Math.hypot(p.x-pl.x,p.z-pl.z),{t:'help',fo,pl},2.2);
  if(!player.veh)for(const id in vehicles)consider(Math.hypot(p.x-vehicles[id].position.x,p.z-vehicles[id].position.z),{t:'veh',id},2.6);
  for(const fo of friendObjs)consider(Math.hypot(p.x-fo.pos.x,p.z-fo.pos.z),{t:'talk',fo},2);
  for(const f of forage)consider(Math.hypot(p.x-f.x,p.z-f.z),{t:'forage',f},2.2);
  for(const o of ores)consider(Math.hypot(p.x-o.x,p.z-o.z),{t:'ore',o},2.6);
  if(pet&&!player.veh)consider(Math.hypot(p.x-pet.m.g.position.x,p.z-pet.m.g.position.z)+.4,{t:'pet'},2.2);
  if(S.own.undita&&!player.veh)for(const L of LAKES){const d=Math.hypot(p.x-L.x,p.z-L.z);if(d<L.r+3.5&&d>L.r-1.5)consider(.8,{t:'fish',L},9);}
  return best;}
const passReady=id=>Math.floor(S.pass[id]||0);
function updateActionUI(){
  target=nearest();let txt='',wait=false,seeds=false;
  if(fish.on){txt=fish.phase==='bite'?'🎣 TRAGE ACUM!':'🎣 Așteaptă…';wait=fish.phase!=='bite';target={t:'fishing'};}
  else if(target){const t=target;
    if(t.t==='plot'){const p=S.plots[t.i];if(!p.c){txt=`🌱 Plantează ${CROPS[S.seed].e}`;seeds=true;}else if(p.p>=1)txt=`🧺 Recoltează ${CROPS[p.c].e}`;else{txt=`${CROPS[p.c].e} crește… ${Math.floor(p.p*100)}%`;wait=true;}}
    if(t.t==='market'){const n=invTotal();txt=n?`💰 Vinde tot (${n})`:'💰 Piața (nimic de vândut)';wait=!n;}
    if(t.t==='nest')txt=`✨ Deschide ouă (${S.eggs+S.gold})`;
    if(t.t==='fac'){const st=S.fac[t.id];txt=st&&st.done.length?`${FACTORIES[t.id].e} Ia ${st.done.map(o=>itemInfo(o).e).join('')}`:`${FACTORIES[t.id].e} ${FACTORIES[t.id].n}`;}
    if(t.t==='pass'){const c=passReady(t.id);txt=c?`${BUILD[t.id].e} Ia ${fmt(c)} 🪙`:`${BUILD[t.id].e} Se umple…`;wait=!c;}
    if(t.t==='hive'){txt=S.hive>=1?`🍯 Ia ${Math.floor(S.hive)} miere`:'🐝 Albinele lucrează…';wait=S.hive<1;}
    if(t.t==='gh')txt='🌱 Sera';
    if(t.t==='orders')txt='📋 Comenzi';
    if(t.t==='tree'){const T_=TREES[S.trees[t.k].t];txt=`${T_.e} Culege ${T_.pl}`;}
    if(t.t==='lock')txt=`➕ Cumpără parcelă ${plotCost()}🪙`;
    if(t.t==='animal'){const pr=ANIMALS[t.o.a.t].prod;txt=`${pr.e} Colectează ${pr.n}`;}
    if(t.t==='feed')txt='🥣 Hrănește animalele';
    if(t.t==='help')txt=`💧 ${t.fo.f.pe}`;
    if(t.t==='veh')txt=`${VEH[t.id].e} Urcă în ${VEH[t.id].n}`;
    if(t.t==='talk')txt=`👋 Salut, ${t.fo.f.n}!`;
    if(t.t==='pet')txt=`💕 Mângâie ${pet.P.n}`;
    if(t.t==='fish')txt='🎣 Pescuiește';
    if(t.t==='forage')txt=`${t.f.f.e} Culege ${t.f.f.n}`;
    if(t.t==='ore'){txt=S.own.tarnacop?`⛏️ Sparge piatra (${t.o.hp})`:'⛏️ Ai nevoie de târnăcop';wait=!S.own.tarnacop;}}
  actEl.style.display=txt?'block':'none';actEl.textContent=txt;actEl.classList.toggle('wait',wait);
  if(seeds){const avail=Object.entries(CROPS).filter(([,c])=>c.lv<=S.lv);const key=S.coins+S.seed+S.lv;if(seedsEl.style.display!=='flex'||seedsEl.dataset.c!=key){seedsEl.dataset.c=key;seedsEl.innerHTML=avail.map(([k,c])=>`<button class="seed ${k===S.seed?'sel':''} ${S.coins<c.cost?'off':''}" data-seed="${k}">${c.e} ${c.cost}🪙</button>`).join('');}seedsEl.style.display='flex';}else seedsEl.style.display='none';
  const anyVeh=Object.keys(vehicles).length>0;vehEl.style.display=player.veh||anyVeh?'grid':'none';vehEl.textContent=player.veh?'🚶':(S.own.safari?'🚙':'🚜');}
seedsEl.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-seed]');if(!b)return;e.preventDefault();S.seed=b.dataset.seed;if(target&&target.t==='plot'&&!S.plots[target.i].c)plantAt(target.i,true);else updateActionUI();});
function nearPlots(i){const [x,z]=plotPos(i);const r=[];for(let j=0;j<S.unl;j++){const [a,b]=plotPos(j);if(Math.hypot(a-x,b-z)<7)r.push(j);}return r;}
function plantPlot(j,seed){const p=S.plots[j];if(p.c)return false;const c=CROPS[seed];if(!c||S.coins<c.cost)return false;S.coins-=c.cost;p.c=seed;p.p=0;refreshPlot(j);S.st.plant++;return true;}
function harvestPlot(j,quiet){const p=S.plots[j];if(!p.c||p.p<1)return 0;let n=3*(S.own.sapa?2:1);if(S.own.siloz&&Math.random()<.25)n*=2;if(!canStore(n,quiet))return -1;addInv(p.c,n);p.last=p.c;p.c=null;p.p=0;refreshPlot(j);S.st.harv++;return n;}
function plantAt(i,group){if(CROPS[S.seed].lv>S.lv)S.seed='morcov';const list=group&&player.veh?nearPlots(i):[i];let planted=0;
  for(const j of list){if(S.plots[j].c)continue;if(!plantPlot(j,S.seed)){if(!planted){toast('Nu ai destule monede pentru semințe 🪙');sfx.no();}break;}planted++;}
  if(planted){sfx.plant();addXP(planted);hud();if(!player.veh)playOnce(pch,'PickUp_Table',.9);}updateActionUI();}
function harvestAt(i){const list=player.veh==='tractor'?nearPlots(i):[i];let tot=0,em='';
  for(const j of list){const p=S.plots[j];if(!p.c||p.p<1)continue;const c=p.c;const n=harvestPlot(j);if(n<0)break;tot+=n;em=CROPS[c].e;}
  if(tot){toast(`${em} +${tot} în hambar`);sfx.pick();happy();addXP(Math.ceil(tot/2));if(!player.veh)playOnce(pch,'PickUp_Table',.9);}}
function marketSell(keepNeeds=false){const need=keepNeeds?orderNeeds():{};let sum=0;for(const [k,n] of Object.entries(S.inv)){if(keepNeeds&&k==='hrana')continue;const keep=Math.min(n,need[k]||0);const s=n-keep;if(s<=0)continue;sum+=Math.round(itemInfo(k).v*sellMult())*s;if(keep)S.inv[k]=keep;else delete S.inv[k];}if(sum)earn(sum);return sum;}
function doAction(){if(modalOn||arrange.on)return;if(fish.on){catchFish();return;}if(!target)return;const t=target;
  if(t.t==='plot'){const p=S.plots[t.i];if(!p.c)plantAt(t.i,true);else if(p.p>=1)harvestAt(t.i);}
  if(t.t==='market'){const sum=marketSell();if(!sum)return toast('Nu ai nimic de vândut');toast(`💰 Ai vândut tot: +${fmt(sum)} 🪙`);sfx.coin();happy();addXP(Math.ceil(sum/25));playOnce(pch,'Interact',.9);}
  if(t.t==='nest')openEggs();
  if(t.t==='fac'){const st=S.fac[t.id];if(st&&st.done.length)collectFactory(t.id);else openFactory(t.id);}
  if(t.t==='pass'){const c=passReady(t.id);if(c){S.pass[t.id]-=c;earn(c);toast(`${BUILD[t.id].e} +${fmt(c)} 🪙`);sfx.coin();happy();addXP(1+Math.floor(c/50));playOnce(pch,'Interact',.8);}}
  if(t.t==='hive'){const n=Math.floor(S.hive);if(n&&canStore(n)){addInv('miere',n);S.hive-=n;S.st.prod+=n;toast(`🍯 +${n} miere`);sfx.pick();addXP(n);playOnce(pch,'Interact',.8);}}
  if(t.t==='gh')openGH();
  if(t.t==='orders')openOrders();
  if(t.t==='tree'){const tr=S.trees[t.k];if(!canStore(3))return;addInv(tr.t,3);tr.p=0;S.st.harv++;toast(`${TREES[tr.t].e} +3 în hambar`);sfx.pick();happy();addXP(3);playOnce(pch,'PickUp_Table',.9);}
  if(t.t==='lock')buy('plot',true);
  if(t.t==='animal'){if(collectAnimal(t.o)){sfx.pick();happy();playOnce(pch,'Interact',.8);}}
  if(t.t==='feed'){const n=feedPen(t.pen);toast(`🥣 Ai hrănit ${n} animale — produc de 2× mai repede!`);sfx.pick();happy();addXP(n);playOnce(pch,'Interact',.8);}
  if(t.t==='help'){t.pl.need=false;t.pl.timer=rand(25,60);t.pl.drop.visible=false;const fr=S.fr[t.fo.f.n]=S.fr[t.fo.f.n]||{h:0};fr.h++;S.coins+=4;S.st.help++;sfx.coin();happy();addXP(3);if(t.fo.ch)t.fo.ch.happy=1.5;playOnce(pch,'PickUp_Table',.9);
    if(fr.h%3===0){S.eggs++;toast(`🎁 ${t.fo.f.n} îți dă un ou misterios! Mulțumesc! 💚`);sfx.hatch();}else toast(`💚 ${t.fo.f.n}: Mulțumesc! +4 🪙`);}
  if(t.t==='veh')mountVehicle(t.id);
  if(t.t==='talk'){const fr=S.fr[t.fo.f.n]||{h:0};if(t.fo.ch){t.fo.ch.happy=1.5;t.fo.talk=3;}toast(pick([`${t.fo.f.n}: Bună! Mă ajuți la udat? 💧`,`${t.fo.f.n}: Ai văzut ouăle de aur de la munte? 🌟`,`${t.fo.f.n}: Prietenie: ${fr.h%3}/3 până la un ou cadou 🎁`,`${t.fo.f.n}: Ce frumos arăți azi! 😍`,`${t.fo.f.n}: În pădure sunt mure și hribi! 🫐`,`${t.fo.f.n}: Sus la munte sunt cristale ⛏️`]));snd(700,.08,'triangle');}
  if(t.t==='pet'){pet.ht=1.6;pet.hearts.visible=true;happy();snd(980,.1,'triangle');}
  if(t.t==='fish')startFish(t.L);
  if(t.t==='forage'){const f=t.f;if(!canStore(3))return;const n=1+Math.floor(Math.random()*3);addInv(f.f.id,n);S.st.forage+=n;scene.remove(f.g);forage.splice(forage.indexOf(f),1);toast(`${f.f.e} +${n} ${f.f.n}`);sfx.pick();happy();addXP(2);playOnce(pch,'PickUp_Table',.9);setTimeout(spawnForage,30000);}
  if(t.t==='ore'){if(!S.own.tarnacop)return toast('⛏️ Cumpără un târnăcop din Magazin → Unelte');const o=t.o;o.hp--;sfx.hit();playOnce(pch,'Interact',.6);
    if(o.hp<=0){if(!canStore(2)){o.hp=1;return;}const r=wpick(ORES);const n=r.v>50?1:1+Math.floor(Math.random()*2);addInv(r.id,n);S.st.mine++;toast(`${r.e} +${n} ${r.n}!`);sfx.pick();addXP(r.v>50?10:4);scene.remove(o.g);ores.splice(ores.indexOf(o),1);const ci=colliders.indexOf(o.col);if(ci>=0)colliders.splice(ci,1);setTimeout(spawnOre,45000);}}
  hud();save();updateActionUI();}
function collectAnimal(o,quiet){const a=o.a;const pr=ANIMALS[a.t].prod;const m=RARITY[a.r||0].mult;const n=Math.floor(m)+(Math.random()<m%1?1:0);if(!canStore(n,quiet))return 0;addInv(pr.id,n);a.rd=false;a.pt=0;a.fed=false;o.ic.visible=false;S.st.prod+=n;if(!quiet){toast(`${pr.e} +${n} ${pr.n}`);addXP(2);}return n;}
function feedPen(pen){let n=0;for(const o of animalObjs)if(o.pen===pen&&!o.a.fed&&S.inv.hrana){o.a.fed=true;S.inv.hrana--;n++;}if(!S.inv.hrana)delete S.inv.hrana;return n;}
function mountVehicle(id){const v=vehicles[id];if(!v)return;if(player.veh)dismount();
  scene.remove(v);root.add(v);v.position.set(0,0,0);v.rotation.set(0,0,0);player.veh=id;pch.root.position.copy(v.userData.seat);player.vy=0;toast(`${VEH[id].e} Vrrrum!`);snd(120,.4,'sawtooth',.06);updateActionUI();}
function dismount(){const id=player.veh;const v=vehicles[id];root.remove(v);scene.add(v);v.position.copy(player.pos);v.rotation.set(0,player.face,0);S.lay['v:'+id]={x:v.position.x,z:v.position.z};
  player.veh=null;pch.root.position.set(0,0,0);player.pos.x+=Math.cos(player.face)*1.8;player.pos.z-=Math.sin(player.face)*1.8;updateActionUI();}
function toggleVehicle(){if(arrange.on)return;if(player.veh)return dismount();const id=S.own.safari?'safari':S.own.tractor?'tractor':null;if(!id)return toast('Cumpără un vehicul din Magazin 🚜');
  const v=vehicles[id];if(Math.hypot(v.position.x-player.pos.x,v.position.z-player.pos.z)>3){v.position.copy(player.pos);toast(`${VEH[id].e} Vehiculul a venit la tine!`);}mountVehicle(id);}

/* ================= WORKER LOGIC ================= */
// a job = {x,z,anim,dur,run()}; bots walk there, offline catch-up runs it directly
function findJob(id){
  if(id==='culegator'){for(let i=0;i<S.unl;i++){const p=S.plots[i];if(p.c&&p.p>=1&&invTotal()+6<=invCap()){const [x,z]=plotPos(i);return {x,z:z+1.4,anim:'PickUp_Table',dur:1.4,run:()=>{const c=p.c;const n=harvestPlot(i,true);if(n>0)plantPlot(i,CROPS[c].lv<=S.lv?c:'morcov');return n>0;}};}}
    for(let i=0;i<S.unl;i++){const p=S.plots[i];if(!p.c&&p.last&&S.coins>=CROPS[p.last].cost){const [x,z]=plotPos(i);return {x,z:z+1.4,anim:'PickUp_Table',dur:1.2,run:()=>plantPlot(i,p.last)};}}}
  if(id==='ingrijitor'){for(const o of animalObjs){if(o.a.rd&&invTotal()+5<=invCap())return {x:o.m.g.position.x+.8,z:o.m.g.position.z+.8,anim:'Interact',dur:1.1,run:()=>collectAnimal(o,true)>0};}
    if(S.inv.hrana)for(let i=0;i<S.pens;i++)if(animalObjs.some(o=>o.pen===i&&!o.a.fed)){const [x,z]=penPos(i);return {x:x+4.4,z,anim:'Interact',dur:1.1,run:()=>feedPen(i)>0};}}
  if(id==='vanzator'){const need=orderNeeds();const sellable=Object.entries(S.inv).reduce((s,[k,n])=>s+(k==='hrana'?0:Math.max(0,n-(need[k]||0))),0);if(sellable>0&&(invTotal()>invCap()*.3||sellable>=15))return {x:market.x,z:market.z+2.8,anim:'Interact',dur:1.4,run:()=>{const s=marketSell(true);if(s)toastQuiet(`🤖 Vânzătorul a vândut marfă: +${fmt(s)} 🪙`);return s>0;}};}
  if(id==='fabricant'){for(const fid in FACTORIES){const st=S.fac[fid];const o=PL['f:'+fid];if(!st||!o)continue;const canStart=st.last!==undefined&&st.q.length<slots()&&have(FACTORIES[fid].rec[st.last].need);
      if((st.done.length&&invTotal()+st.done.length<=invCap())||canStart)return {x:o.x,z:o.z+fpSize(o)[1]+.8,anim:'Interact',dur:1.2,run:()=>{let ok=collectFactory(fid,true)>0;while(st.last!==undefined&&startRecipe(fid,st.last))ok=true;return ok;}};}}
  if(id==='gradinar'){for(const k in S.trees){const tr=S.trees[k];const o=PL[k];if(o&&tr.p>=1&&invTotal()+3<=invCap())return {x:o.x,z:o.z+1.9,anim:'PickUp_Table',dur:1.3,run:()=>{addInv(tr.t,3);tr.p=0;S.st.harv++;return true;}};}
    const gh=PL['b:sera'];if(gh)for(let i=0;i<ghSlotsN();i++){const s=S.gh[i];if(s&&s.c&&s.p>=1&&invTotal()+2<=invCap())return {x:gh.x,z:gh.z+fpSize(gh)[1]+.8,anim:'PickUp_Table',dur:1.3,run:()=>{const c=s.c;const n=ghHarvest(i,true);if(n&&S.coins>=EXOTIC[c].cost){S.coins-=EXOTIC[c].cost;s.c=c;s.p=0;}refreshGH();return n>0;}};}}
  return null;}
let quietT=-99;function toastQuiet(m){if(T-quietT>10){toast(m);quietT=T;}}
function updateBots(dt){for(const id in bots){const b=bots[id];const on=workActive(id);b.t-=dt;
    if(Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z)<120)b.mixer.update(dt);
    if(b.lock>0){b.lock-=dt;if(b.lock<=0&&b.job){try{b.job.run();}catch(e){console.warn(e);}b.job=null;b.t=.5;hud();}continue;}
    if(!on){botPlay(b,'Idle_Loop');continue;}
    if(!b.job&&b.t<=0){b.job=findJob(id);if(!b.job){b.t=rand(3,5);const h=PL.casa;b.wx=h.x+rand(-6,6);b.wz=h.z+rand(5,9);}}
    const tx=b.job?b.job.x:b.wx,tz=b.job?b.job.z:b.wz;if(tx===undefined){botPlay(b,'Idle_Loop');continue;}
    const dx=tx-b.pos.x,dz=tz-b.pos.z,d=Math.hypot(dx,dz);
    if(d>.9){const sp=3.6*dt;b.pos.x+=dx/d*Math.min(sp,d);b.pos.z+=dz/d*Math.min(sp,d);b.rot=angLerp(b.rot,Math.atan2(dx,dz),Math.min(1,dt*8));botPlay(b,'Walk_Loop');}
    else if(b.job){const a=b.acts[b.job.anim];b.cur=null;botPlay(b,b.job.anim,.15);a.reset().play();b.lock=b.job.dur;}
    else{botPlay(b,'Idle_Loop');b.wx=undefined;}
    b.pos.y=H(b.pos.x,b.pos.z);b.g.position.copy(b.pos);b.g.rotation.y=b.rot;}}
let wageAcc=0;
const wagesPerMin=()=>Object.entries(S.work).filter(([,x])=>x.on).reduce((s,[k])=>s+WORKERS[k].wage,0);
function payWages(dt){const w=wagesPerMin();if(!w||S.coins<=0)return;wageAcc+=w*dt/60;if(wageAcc>=1){const c=Math.floor(wageAcc);wageAcc-=c;S.coins=Math.max(0,S.coins-c);if(S.coins<=0)toastQuiet('🤖 Boții nu mai au salariu — se odihnesc până faci bani');}}

/* ================= ARRANGE MODE ================= */
const arrange={on:false,sel:null,drag:false,off:[0,0],pan:null,tx:0,tz:0,h:38,valid:true};
const selRing=new THREE.Mesh(new THREE.RingGeometry(.96,1,4,1),new THREE.MeshBasicMaterial({color:0x4cff6a,transparent:true,opacity:.95,side:THREE.DoubleSide,depthTest:false}));
selRing.rotation.x=-Math.PI/2;selRing.rotation.z=Math.PI/4;selRing.renderOrder=10;selRing.visible=false;scene.add(selRing);
const selFill=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x4cff6a,transparent:true,opacity:.22,depthTest:false,side:THREE.DoubleSide}));selFill.rotation.x=-Math.PI/2;selFill.renderOrder=9;selFill.visible=false;scene.add(selFill);
function enterArrange(){if(modalOn||player.veh)return;arrange.on=true;arrange.sel=null;arrange.tx=0;arrange.tz=0;arrange.h=Math.max(30,farmF()*1.4);document.body.classList.add('arranging');
  $('#arrTxt').textContent='Atinge o construcție și trage-o unde vrei';toast('🏗️ Mod aranjare');}
function exitArrange(){arrange.on=false;arrange.sel=null;selRing.visible=selFill.visible=false;document.body.classList.remove('arranging');rebuildFarmGrass();refreshLocks();
  for(const o of animalObjs){const [px,pz]=penPos(o.pen);o.m.g.position.set(px+rand(-2,2),0,pz+rand(-2,2));o.tx=px;o.tz=pz;}refreshGH();save();toast('✔ Ferma a fost aranjată!');}
function pickPlace(p){let best=null,bd=1e9;for(const k in PL){const o=PL[k];const [hw,hd]=fpSize(o);if(Math.abs(p.x-o.x)<=hw&&Math.abs(p.z-o.z)<=hd){const a=hw*hd;if(a<bd){bd=a;best=o;}}}return best;}
function showSel(){const o=arrange.sel;if(!o){selRing.visible=selFill.visible=false;return;}const [hw,hd]=fpSize(o);
  selRing.visible=selFill.visible=true;selRing.position.set(o.x,H(o.x,o.z)+.12,o.z);selRing.scale.set(hw*Math.SQRT2,hd*Math.SQRT2,1);selFill.position.set(o.x,H(o.x,o.z)+.1,o.z);selFill.scale.set(hw*2,hd*2,1);
  const col=arrange.valid?0x4cff6a:0xff4c4c;selRing.material.color.setHex(col);selFill.material.color.setHex(col);$('#arrTxt').textContent='Trage ca să muți · ↻ ca să rotești';}
function arrangeDown(e){const p=groundAt(e.clientX,e.clientY);if(!p)return;const o=pickPlace(p);
  if(o){arrange.sel=o;arrange.drag=true;arrange.off=[o.x-p.x,o.z-p.z];arrange.valid=true;showSel();sfx.pick();}else arrange.pan={x:e.clientX,y:e.clientY};}
function arrangeMove(e){if(arrange.drag&&arrange.sel){const p=groundAt(e.clientX,e.clientY);if(!p)return;const o=arrange.sel;
    const x=Math.round((p.x+arrange.off[0])*2)/2,z=Math.round((p.z+arrange.off[1])*2)/2;if(canPlace(o,x,z,o.r)){setPlace(o,x,z,o.r);arrange.valid=true;}else arrange.valid=false;showSel();}
  else if(arrange.pan){const k=arrange.h/innerHeight*1.2;const dx=(e.clientX-arrange.pan.x)*k,dz=(e.clientY-arrange.pan.y)*k;const L=farmF()+10;arrange.tx=clamp(arrange.tx-dx,-L,L);arrange.tz=clamp(arrange.tz-dz,-L,L);arrange.pan={x:e.clientX,y:e.clientY};}}
function arrangeUp(){arrange.drag=false;arrange.pan=null;arrange.valid=true;showSel();}
$('#arrRot').onclick=()=>{const o=arrange.sel;if(!o)return toast('Atinge întâi o construcție');const r=(o.r+1)%4;if(canPlace(o,o.x,o.z,r)){setPlace(o,o.x,o.z,r);showSel();snd(600,.08,'triangle');}else{toast('Nu încape așa — mut-o puțin');sfx.no();}};
$('#arrDone').onclick=exitArrange;
$('#arrZoomIn').onclick=()=>arrange.h=clamp(arrange.h-10,14,130);$('#arrZoomOut').onclick=()=>arrange.h=clamp(arrange.h+10,14,130);

/* ================= UPDATE ================= */
function resolveCollisions(p,rad){
  for(const c of colliders){const dx=p.x-c.x,dz=p.z-c.z;
    if(c.r!==undefined){const R=c.r+rad;if(Math.abs(dx)>R||Math.abs(dz)>R)continue;const d=Math.hypot(dx,dz);if(d<R&&d>1e-4){p.x=c.x+dx/d*R;p.z=c.z+dz/d*R;}}
    else{const ox=c.hw+rad-Math.abs(dx),oz=c.hd+rad-Math.abs(dz);if(ox>0&&oz>0){if(ox<oz)p.x+=Math.sign(dx)*ox;else p.z+=Math.sign(dz)*oz;}}}
  const r=Math.hypot(p.x,p.z);if(r>WR-8){p.x*=(WR-8)/r;p.z*=(WR-8)/r;}}
function updatePlayer(dt){
  let ix=joy.vx,iy=joy.vy;
  if(keys.KeyW||keys.ArrowUp)iy=-1;if(keys.KeyS||keys.ArrowDown)iy=1;if(keys.KeyA||keys.ArrowLeft)ix=-1;if(keys.KeyD||keys.ArrowRight)ix=1;
  if(modalOn||arrange.on){ix=iy=0;}
  const mag=Math.min(1,Math.hypot(ix,iy));if(mag>.2&&fish.on)endFish();
  const fx=-Math.sin(camYaw),fz=-Math.cos(camYaw),rx=Math.cos(camYaw),rz=-Math.sin(camYaw);
  let mx=fx*(-iy)+rx*ix,mz=fz*(-iy)+rz*ix;const ml=Math.hypot(mx,mz);
  const run=mag>.62;const sp=player.veh?VEH[player.veh].sp:(run?5.6:2.4);
  if(ml>.05){mx/=ml;mz/=ml;player.face=angLerp(player.face,Math.atan2(mx,mz),Math.min(1,dt*(player.veh?5:12)));player.speed=lerp(player.speed,sp*(player.veh?mag:1),Math.min(1,dt*8));
    if(player.veh){mx=Math.sin(player.face);mz=Math.cos(player.face);}}
  else{player.speed=lerp(player.speed,0,Math.min(1,dt*10));mx=Math.sin(player.face);mz=Math.cos(player.face);}
  if(pch.lock>0&&!player.veh&&ml<=.05)player.speed=0;
  player.pos.x+=mx*player.speed*dt;player.pos.z+=mz*player.speed*dt;
  resolveCollisions(player.pos,player.veh?1.1:.35);
  const gy=H(player.pos.x,player.pos.z);
  player.vy-=22*dt;player.pos.y+=player.vy*dt;
  if(player.pos.y<=gy){player.pos.y=gy;player.vy=0;player.ground=true;}else if(player.pos.y-gy>.15)player.ground=false;
  root.position.copy(player.pos);root.rotation.y=player.face;
  let st='idle';
  if(lookOpen)st=dressDance?'dance':'idle';
  else if(player.veh)st='drive';
  else if(!player.ground)st='air';
  else if(player.speed>3.4)st='jog';
  else if(player.speed>.35)st='walk';
  else if(fish.on)st='fish';
  pch.walkScale=clamp(player.speed/1.9,.6,1.4);pch.jogScale=clamp(player.speed/5.2,.8,1.25);
  if(window.FORCEWALK)st=window.FORCEWALK===2?'jog':window.FORCEWALK===3?'drive':'walk';
  animChar(pch,dt,st);
  if(player.veh){const v=vehicles[player.veh];for(const w of v.userData.wheels)w.rotation.x+=player.speed*dt*1.6;v.position.y=Math.sin(T*30)*.012*player.speed/6;
    const ahead=H(player.pos.x+mx*1.2,player.pos.z+mz*1.2),behind=H(player.pos.x-mx*1.2,player.pos.z-mz*1.2);v.rotation.x=lerp(v.rotation.x,-Math.atan2(ahead-behind,2.4),.2);}}
function growMult(){return (1+.25*S.up.stropitoare)*(S.own.fantana?1.1:1)*(petHas('slime')?1.15:1);}
function tickWorld(dt,offline=false){
  const m=growMult();let grown=0;
  for(let i=0;i<S.unl;i++){const p=S.plots[i];if(p.c&&p.p<1){p.p=Math.min(1,p.p+dt/CROPS[p.c].t*m);if(p.p>=1)grown++;if(!offline)refreshPlot(i);}}
  if(S.own.sera)for(const s of S.gh.slice(0,ghSlotsN()))if(s.c&&s.p<1)s.p=Math.min(1,s.p+dt/EXOTIC[s.c].t*(1+.25*S.up.stropitoare));
  let made=0,prods=0;
  for(const [id,st] of Object.entries(S.fac)){if(!FACTORIES[id])continue;for(const q of st.q)q.t-=dt;const fin=st.q.filter(q=>q.t<=0);st.q=st.q.filter(q=>q.t>0);for(const q of fin){const r=FACTORIES[id].rec[q.r];if(!r)continue;for(let i=0;i<r.q;i++)st.done.push(r.out);made+=r.q;}}
  for(const tr of Object.values(S.trees))if(tr.p<1&&TREES[tr.t])tr.p=Math.min(1,tr.p+dt/TREES[tr.t].t);
  S.animals.forEach((a,i)=>{if(i>=capacity()||a.rd)return;const D_=ANIMALS[a.t];a.pt=(a.pt||0)+dt*(a.fed?2:1);if(a.pt>=D_.prod.t){if(S.own.hambar){const mlt=RARITY[a.r||0].mult;const n=Math.floor(mlt)+(Math.random()<mlt%1?1:0);if(invTotal()+n<=invCap()){addInv(D_.prod.id,n);a.pt=0;a.fed=false;prods+=n;S.st.prod+=n;}else a.pt=D_.prod.t;}else a.rd=true;}});
  for(const id in PASSIVE)if(S.own[id]){const P=PASSIVE[id];const rate=P.rate(Math.max(1,S.up[id]));S.pass[id]=Math.min(rate*P.cap,(S.pass[id]||0)+rate*dt/60);}
  if(S.own.stupi){const l=Math.max(1,S.up.stupi);S.hive=Math.min(l*20,S.hive+l*dt/Math.max(20,90-8*l));}
  for(const o of S.orders)if(o.wait>0)o.wait-=dt;
  return {grown,made,prods};}
let ghT=0;
function updateFarm(dt){tickWorld(dt);
  for(let i=0;i<S.unl;i++){const o=plotObjs[i];if(o&&o.ready.visible)o.ready.position.y=1.8+Math.sin(T*3+i)*.12;}
  for(const id in FACTORIES){const o=PL['f:'+id];if(o&&o.ready){o.ready.visible=!!(S.fac[id]&&S.fac[id].done.length);if(o.ready.visible)o.ready.position.y=FACTORIES[id].w*1.25+.3+Math.sin(T*3)*.12;}}
  for(const id of ['pusculita','limonada','pensiune']){const o=PL['b:'+id];if(o&&o.ready)o.ready.visible=passReady(id)>=5;}
  if(PL['b:stupi']&&PL['b:stupi'].ready)PL['b:stupi'].ready.visible=S.hive>=1;
  if(PL['b:sera']&&PL['b:sera'].ready)PL['b:sera'].ready.visible=S.gh.some(s=>s.c&&s.p>=1);
  for(const k in treeObjs){const tr=S.trees[k];if(!tr)continue;const ob=treeObjs[k];ob.fr.visible=tr.p>=.3;ob.fr.scale.setScalar(.4+.6*Math.min(1,tr.p));ob.ic.visible=tr.p>=1;}
  ghT-=dt;if(ghT<=0){ghT=3;refreshGH();}}
function updateAnimals(dt){for(const o of animalObjs){const a=o.a,D_=ANIMALS[a.t];
  o.ic.visible=!!a.rd;if(a.rd)o.ic.position.y=D_.h+.7+Math.sin(T*3+a.id)*.1;o.fed.visible=!!a.fed&&!a.rd;
  const g=o.m.g;const [px,pz]=penPos(o.pen);if(Math.hypot(g.position.x-px,g.position.z-pz)>6){g.position.set(px,0,pz);o.tx=px;o.tz=pz;}
  const dx=o.tx-g.position.x,dz=o.tz-g.position.z,d=Math.hypot(dx,dz);
  let moving=false;if(o.wait>0)o.wait-=dt;else if(d<.2){o.tx=px+rand(-2.6,2.6);o.tz=pz+rand(-2.6,2.6);o.wait=rand(1.5,6);}
  else{const s=(D_.sp||.9)*dt;g.position.x+=dx/d*s;g.position.z+=dz/d*s;g.rotation.y=angLerp(g.rotation.y,Math.atan2(dx,dz),dt*5);moving=true;}
  g.position.y=H(g.position.x,g.position.z)+(D_.fly?1.2+Math.sin(T*2+a.id)*.2:0);
  setMove(o.m,moving);if(Math.hypot(g.position.x-player.pos.x,g.position.z-player.pos.z)<80)o.m.mixer.update(dt);
  if(g.userData.horn)g.userData.horn.material.emissiveIntensity=.3+Math.sin(T*3)*.2;if(o.m.sp)o.m.sp.position.y=D_.h+.15+Math.sin(T*2+a.id)*.15;}}
function updatePet(dt){if(!pet)return;const g=pet.m.g,P=pet.P;const f=player.face;const sp=(1+S.up.companion*.1);
  const tx=player.pos.x+Math.cos(f)*1.3-Math.sin(f)*1.1,tz=player.pos.z-Math.sin(f)*1.3-Math.cos(f)*1.1;const dx=tx-g.position.x,dz=tz-g.position.z,d=Math.hypot(dx,dz);
  let moving=false;if(d>30){g.position.set(tx,0,tz);}else if(d>.4){const v=Math.min(d*3,Math.max(5.5*sp,player.speed*1.15));g.position.x+=dx/d*v*dt;g.position.z+=dz/d*v*dt;g.rotation.y=angLerp(g.rotation.y,Math.atan2(dx,dz),dt*8);moving=true;}
  else g.rotation.y=angLerp(g.rotation.y,player.face,dt*3);
  const gy=H(g.position.x,g.position.z);g.position.y=P.fly?gy+1.3+Math.sin(T*2.4)*.18:gy;
  if(!P.fly)setMove(pet.m,moving);pet.m.mixer.update(dt*(P.fly&&moving?1.6:1));
  if(pet.ht>0){pet.ht-=dt;pet.hearts.position.y=P.h+.6+(1.6-pet.ht)*.4;if(pet.ht<=0)pet.hearts.visible=false;}
  if(petHas('catel')){pet.coinT-=dt;if(pet.coinT<=0){pet.coinT=rand(40,70);const c=Math.round(rand(3,9)*(S.pet==='dragonaur'?2:1));earn(c);toast(`${P.e} ${P.n} a găsit ${c} 🪙!`);sfx.coin();hud();pet.ht=1.2;pet.hearts.visible=true;}}}
let eggTimer=0;
function updateEggs(dt){const p=player.pos;const rr=(S.own.cos?3:1.7)+(petIsDragon()?4:0);
  for(let i=worldEggs.length-1;i>=0;i--){const e=worldEggs[i];e.t+=dt;e.e.position.y=.6+Math.sin(e.t*2.5)*.12;e.e.rotation.y+=dt;
    const d=Math.hypot(p.x-e.x,p.z-e.z);e.g.visible=d<380;
    if(d<rr+(player.veh?1:0)){scene.remove(e.g);worldEggs.splice(i,1);if(e.gold)S.gold++;else S.eggs++;S.st.eggs++;toast(e.gold?'🌟 Ai găsit un OU DE AUR!':'🥚 Ai găsit un ou misterios!');sfx.pick();happy();addXP(2);hud();save();}}
  eggTimer+=dt;if(eggTimer>9&&worldEggs.length<maxEggs()){eggTimer=0;spawnEgg();}
  for(const f of forage){f.ic.position.y=1.5+Math.sin(T*2+f.x)*.1;f.g.visible=Math.hypot(p.x-f.x,p.z-f.z)<150;}
  for(const o of ores){o.ic.visible=Math.hypot(p.x-o.x,p.z-o.z)<40;}}
function updateFriends(dt){for(const fo of friendObjs){
  const pd=Math.hypot(player.pos.x-fo.pos.x,player.pos.z-fo.pos.z);
  if(!fo.ch&&!fo.loading&&pd<110){fo.loading=true;makeChar(fo.f.ch).then(c=>{fo.ch=c;c.root.position.copy(fo.pos);scene.add(c.root);setAccs(c,{acc:fo.f.acc});
      const nm=textSprite(fo.f.n,{size:.8,bg:'rgba(255,255,255,.92)'});nm.position.y=c.height+.35;c.root.add(nm);}).catch(()=>{fo.loading=false;});}
  const dx=fo.tx-fo.pos.x,dz=fo.tz-fo.pos.z,d=Math.hypot(dx,dz);let mv=false;
  if(fo.wait>0){fo.wait-=dt;}else if(d<.3){const pl=pick(fo.plots);fo.tx=pl.x+rand(-1.5,1.5);fo.tz=pl.z+1.9;fo.wait=rand(3,7);fo.kneel=Math.random()<.6?fo.wait:0;}
  else{const s=1.3*dt;fo.pos.x+=dx/d*s;fo.pos.z+=dz/d*s;fo.rot=angLerp(fo.rot,Math.atan2(dx,dz),Math.min(1,dt*8));mv=true;}
  if(fo.kneel>0)fo.kneel-=dt;if(fo.talk>0)fo.talk-=dt;
  if(!mv&&pd<6){fo.rot=angLerp(fo.rot,Math.atan2(player.pos.x-fo.pos.x,player.pos.z-fo.pos.z),Math.min(1,dt*5));fo.kneel=0;}
  if(fo.ch){fo.ch.root.position.copy(fo.pos);fo.ch.root.position.y=H(fo.pos.x,fo.pos.z);fo.ch.root.rotation.y=fo.rot;if(pd<70){fo.ch.walkScale=.7;animChar(fo.ch,dt,mv?'walk':fo.talk>0?'talk':fo.kneel>0?'kneel':'idle');}fo.ch.root.visible=pd<190;}
  for(const pl of fo.plots){if(!pl.need){pl.timer-=dt;if(pl.timer<=0)pl.need=true;}pl.drop.visible=pl.need;if(pl.need)pl.drop.position.y=1.8+Math.sin(T*3+pl.x)*.12;}
  if(pd<80)fo.pet.mixer.update(dt);}}
function updateWorld(dt){for(const s of spinners){if(s.t==='spin')s.o.rotation.z+=dt*.8;if(s.t==='bob'){s.o.position.y=.95+Math.sin(T*2)*.08;s.o.rotation.y+=dt*.5;}if(s.t==='coin'){s.o.rotation.z+=dt*2;s.o.position.y=s.y+Math.sin(T*2)*.1;}if(s.t==='spinY')s.o.rotation.y+=dt*.6;
    if(s.t==='orb'){s.o.position.y=13+Math.sin(T*1.5)*.3;}if(s.t==='bees')s.o.children.forEach(b=>{const p=b.userData.ph;b.position.set(Math.sin(T*2+p)*1.4,1.4+Math.sin(T*3+p*2)*.4,Math.cos(T*2.3+p)*1.1);});}
  for(const c of clouds){c.position.x+=dt*2;if(c.position.x>780)c.position.x=-780;}
  grassUni.uTime.value=T;
  for(const k in locks){const L=locks[k];L.g.children[2].visible=Math.hypot(L.x-player.pos.x,L.z-player.pos.z)>4.5;}
  const cx=arrange.on?arrange.tx:player.pos.x,cz=arrange.on?arrange.tz:player.pos.z;
  for(const ch of chunks){const d=Math.hypot(ch.x-cx,ch.z-cz);const near=d<(MOBILE?80:110);ch.g.visible=near;ch.f.visible=!near;}}
const camPos=new THREE.Vector3(), lookAt=new THREE.Vector3(), _sc=new THREE.Vector3();
function updateCamera(dt){const p=player.pos;
  camera.layers.set(lookOpen?1:0);
  if(arrange.on){if(camera.view&&camera.view.enabled)camera.clearViewOffset();camPos.set(arrange.tx,arrange.h,arrange.tz+arrange.h*.55);lookAt.set(arrange.tx,0,arrange.tz);camera.position.lerp(camPos,Math.min(1,dt*6));camera.lookAt(lookAt);}
  else if(lookOpen){const f=player.face;const hh=pch.height;camPos.set(p.x+Math.sin(f)*2.2,p.y+hh*.66,p.z+Math.cos(f)*2.2);lookAt.set(p.x,p.y+hh*.54,p.z);camera.position.lerp(camPos,Math.min(1,dt*8));camera.lookAt(lookAt);
    const W=innerWidth,Hh=innerHeight;camera.setViewOffset(W,Hh,Math.min(W*.24,230),0,W,Hh);pch.root.rotation.y=dressDance?0:Math.sin(T*.6)*.45;}
  else{if(camera.view&&camera.view.enabled){camera.clearViewOffset();pch.root.rotation.y=0;}
    const dist=player.veh?camDist+3.5:camDist;
    if(Math.abs(joy.vx)+Math.abs(joy.vy)>.1&&drag.id===null){const behind=player.face+Math.PI;camYaw=angLerp(camYaw,behind,dt*(player.veh?1.6:.6)*(joy.vy<0?1:.3));}
    camPos.set(p.x+Math.sin(camYaw)*dist*Math.cos(camPitch),p.y+1.3+Math.sin(camPitch)*dist,p.z+Math.cos(camYaw)*dist*Math.cos(camPitch));
    const gy=H(camPos.x,camPos.z)+.5;if(camPos.y<gy)camPos.y=gy;
    camera.position.lerp(camPos,Math.min(1,dt*10));lookAt.set(p.x,p.y+1.1,p.z);camera.lookAt(lookAt);}
  if(window.DC){camera.position.set(...window.DC[0]);camera.lookAt(...window.DC[1]);}
  sky.position.copy(camera.position);
  const sc=arrange.on?_sc.set(arrange.tx,0,arrange.tz):p;sun.position.copy(sc).addScaledVector(SUN_DIR,120);sun.target.position.copy(sc);
  const sz=arrange.on?Math.max(44,arrange.h*1.1):44;if(sun.shadow.camera.right!==sz){Object.assign(sun.shadow.camera,{left:-sz,right:sz,top:sz,bottom:-sz});sun.shadow.camera.updateProjectionMatrix();}}

/* ================= MINIMAP ================= */
const mini=$('#mini'),mg=mini.getContext('2d');
function drawMini(){const W=mini.width,c=W/2,s=(W/2-6)/WR;mg.clearRect(0,0,W,W);mg.save();mg.beginPath();mg.arc(c,c,c,0,7);mg.clip();
  mg.fillStyle='#8a8580';mg.fillRect(0,0,W,W);mg.fillStyle='#4f8a36';mg.beginPath();mg.arc(c,c,305*s,0,7);mg.fill();mg.fillStyle='#6cb04a';mg.beginPath();mg.arc(c,c,140*s,0,7);mg.fill();
  mg.strokeStyle='#d8b77d';mg.lineWidth=3;for(const p of PATHS){mg.beginPath();mg.moveTo(c,c);mg.lineTo(c+p[2]*s,c+p[3]*s);mg.stroke();}
  mg.fillStyle='#3fb0ec';for(const L of LAKES){mg.beginPath();mg.arc(c+L.x*s,c+L.z*s,Math.max(3,L.r*s),0,7);mg.fill();}
  const F=farmF();mg.fillStyle='#c89b6d';mg.fillRect(c-F*s,c-F*s,2*F*s,2*F*s);mg.font='bold 15px sans-serif';mg.textAlign='center';mg.textBaseline='middle';mg.fillText('🏡',c,c);
  for(const fo of friendObjs){const f=fo.f;mg.fillStyle='#'+f.c.toString(16).padStart(6,'0');mg.beginPath();mg.arc(c+f.x*s,c+f.z*s,7,0,7);mg.fill();mg.fillStyle='#fff';mg.font='bold 10px sans-serif';mg.fillText(f.n[0],c+f.x*s,c+f.z*s+1);}
  if(S.own.busola||S.own.safari||petIsDragon())for(const e of worldEggs){mg.fillStyle=e.gold?'#ffd54f':'#fff';mg.beginPath();mg.arc(c+e.x*s,c+e.z*s,3,0,7);mg.fill();}
  if(S.own.tarnacop){mg.fillStyle='#c49cff';for(const o of ores)mg.fillRect(c+o.x*s-2,c+o.z*s-2,4,4);}
  const px=c+player.pos.x*s,pz=c+player.pos.z*s;mg.translate(px,pz);mg.rotate(-player.face+Math.PI);mg.fillStyle='#ff3d6e';mg.strokeStyle='#fff';mg.lineWidth=2.5;mg.beginPath();mg.moveTo(0,-9);mg.lineTo(6,6);mg.lineTo(-6,6);mg.closePath();mg.fill();mg.stroke();
  mg.restore();}

/* ================= INIT ================= */
for(const id in VEH)if(S.own[id])spawnVehicle(id);
for(let i=0;i<maxPlots();i++)refreshPlot(i);refreshLocks();placeAnimals();spawnPet();fillOrders();refreshGH();
if(S.pos)player.pos.y=H(player.pos.x,player.pos.z);
camYaw=player.face+Math.PI;
let T=0;
// --- offline progress (max 12h) ---
const away=Math.min(12*3600,Math.max(0,(Date.now()-(S.last||Date.now()))/1000));
let welcome=null;
if(away>90){const pass0={...S.pass};const c0=S.coins;let rem=away;const res={grown:0,made:0,prods:0,jobs:0};
  while(rem>0){const st=Math.min(30,rem);const r=tickWorld(st,true);res.grown+=r.grown;res.made+=r.made;res.prods+=r.prods;
    for(const id in S.work){if(!S.work[id].on||S.coins<=0)continue;S.coins=Math.max(0,S.coins-WORKERS[id].wage*st/60);for(let k=0;k<2;k++){const j=findJob(id);if(!j||!j.run())break;res.jobs++;}}
    rem-=st;}
  S.coins=Math.round(S.coins);
  for(let i=0;i<maxPlots();i++)refreshPlot(i);refreshGH();
  const passive=Object.keys(S.pass).reduce((s,k)=>s+Math.max(0,Math.floor(S.pass[k]-(pass0[k]||0))),0);welcome={away,passive,coinsDelta:Math.round(S.coins-c0),...res};}
let daily=null;
if(S.daily.d!==today()){const yest=new Date(Date.now()-864e5).toISOString().slice(0,10);S.daily.streak=S.daily.d===yest?Math.min(7,S.daily.streak+1):1;S.daily.d=today();
  const st=S.daily.streak;const coins=15*st;S.coins+=coins;if(st===3||st===5)S.eggs++;if(st===7)S.gold++;daily={st,coins,egg:st===3||st===5,gold:st===7};}
hud();

let last=performance.now(),uiT=0,mapT=0,saveT=0;
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;T+=dt;
  updatePlayer(dt);updateFarm(dt);updateAnimals(dt);updatePet(dt);updateBots(dt);payWages(dt);updateEggs(dt);updateFriends(dt);updateFish(dt);updateWorld(dt);updateCamera(dt);
  uiT+=dt;if(uiT>.12){uiT=0;updateActionUI();$('#quest').textContent=quest();}
  mapT+=dt;if(mapT>.25){mapT=0;drawMini();hud();}
  saveT+=dt;if(saveT>8){saveT=0;save();}
  renderer.render(scene,camera);requestAnimationFrame(loop);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.FP={S,player,scene,camera,renderer,friendObjs,PL,arrange,bots,animalObjs,vehicles,get T(){return T},get pch(){return pch},addXP,setPlace,canPlace,placeAnimals,refreshGH,buy,openShop,openBag,openMissions,openGH,findJob,tickWorld,makeBot,sim:sec=>{for(let t=0;t<sec;t+=.05){T+=.05;updateFarm(.05);updateAnimals(.05);updateBots(.05);payWages(.05);}}};
$('#barI').style.width='100%';
$('#loadTxt').outerHTML='<br><button id="play">▶ Joacă</button>';
$('#play').addEventListener('click',async()=>{snd(660,.1,'triangle');
  try{const el=document.documentElement;if(!document.fullscreenElement&&el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});}catch(e){}
  try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape');}catch(e){}
  $('#load').remove();resize();});
requestAnimationFrame(loop);
if(!S.tut){S.tut=true;openModal(`<h2>🌍 Bun venit la Farm Planet!</h2>
<p>🕹️ <b>Joystick</b> stânga jos (împinge puțin = mers, mult = alergare), <b>Sari</b> în dreapta. Trage pe ecran ca să rotești camera.</p>
<p>🌱 Plantează, recoltează și vinde la <b>Piață</b> sau livrează <b>comenzi</b> 📋. Fă <b>misiuni</b> 🎯 pentru recompense.</p>
<p>🏭 Construiește <b>fabrici</b>, 🌱 <b>seră</b>, 🐝 stupi și clădiri care fac <b>bani singure</b>. Angajează <b>boți muncitori</b> 🤖 care lucrează pentru tine.</p>
<p>🥚 Caută <b>ouă</b> în natură și deschide-le la Cuibul magic — colecționează animale <b>rare, epice și legendare</b>! 🫐 Culege fructe de pădure, 🎣 pescuiește, ⛏️ sparge cristale la munte.</p>
<p>🏗️ Mută clădirile cu <b>aranjarea</b>. 🐉 Adoptă un <b>companion</b>. 👗 Schimbă-ți personajul, hainele și părul.</p>
<div style="text-align:center;margin-top:10px"><button class="big" data-close>Hai să jucăm! 🚀</button></div>`);save();}
else if(welcome||daily){let h='<h2>👋 Bine ai revenit!</h2>';
  if(daily)h+=`<div class="item"><div class="em">🎁</div><div class="info"><b>Cadoul zilei ${daily.st}/7</b><small>+${daily.coins} 🪙${daily.egg?' · +1 🥚':''}${daily.gold?' · +1 🌟 ou de aur':''} — vino zilnic pentru cadouri mai mari!</small></div></div>`;
  if(welcome){h+=`<p>Cât ai lipsit (${fmtTime(welcome.away)}):</p>`;
    if(welcome.passive)h+=`<div class="item"><div class="em">🐖</div><div class="info"><b>Clădirile au strâns ${fmt(welcome.passive)} 🪙</b><small>Mergi la pușculiță / limonadă / pensiune să le iei</small></div></div>`;
    if(welcome.jobs)h+=`<div class="item"><div class="em">🤖</div><div class="info"><b>Boții au făcut ${welcome.jobs} treburi</b><small>Bilanț monede: ${welcome.coinsDelta>=0?'+':''}${fmt(welcome.coinsDelta)} 🪙 (după salarii)</small></div></div>`;
    if(welcome.grown)h+=`<div class="item"><div class="em">🌾</div><div class="info"><b>${welcome.grown} parcele au crescut</b></div></div>`;
    if(welcome.made)h+=`<div class="item"><div class="em">🏭</div><div class="info"><b>Fabricile au făcut ${welcome.made} produse</b></div></div>`;
    if(welcome.prods)h+=`<div class="item"><div class="em">🏚️</div><div class="info"><b>Hambarul a strâns ${welcome.prods} produse de la animale</b></div></div>`;}
  h+='<div style="text-align:center;margin-top:8px"><button class="big" data-close>Super! 🚀</button></div>';openModal(h);save();}
