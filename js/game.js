// Farm Planet — main game
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import * as D from './data.js';
const {CROPS,ANIMALS,TREES,FISH,GOODS,FACTORIES,BUILD,DECOR,TOOLS,UPGRADES,FARM_LEVELS,PEN_COST,PLOTS_PER_FIELD,VEH,CHARS,OUTFIT_COLORS,HAIR_COLORS,ACCS,FACES,BACKS,PETS,FRIENDS}=D;

const A = window.FP_ASSETS || 'assets/';
const MOBILE = matchMedia('(pointer:coarse)').matches;

/* ================= UTILS ================= */
const $ = s => document.querySelector(s);
const rand = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const sstep = (a,b,x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const lerp = (a,b,t) => a + (b-a)*t;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
function distSeg(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az;const t=clamp(((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(px-(ax+dx*t),pz-(az+dz*t));}
function angLerp(a,b,t){let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*t;}
function seeded(s){return()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};}
const fmtTime=s=>{s=Math.max(0,Math.ceil(s));return s>=3600?`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`:s>=60?`${Math.floor(s/60)}m ${s%60}s`:`${s}s`;};

/* ================= STATE ================= */
function defState(){return{coins:25,xp:0,lv:1,inv:{},eggs:0,gold:0,
  plots:Array.from({length:PLOTS_PER_FIELD},()=>({c:null,p:0})),unl:4,fields:1,farmLv:0,own:{},pens:1,animals:[],seen:{},
  look:{ch:'e',acc:'paie',face:'none',back:'none',hc:0,cloth:0,hair:null},chars:{e:true,d:true},accs:{none:true,paie:true},faces:{none:true},backs:{none:true},cloths:{0:true},
  fr:{},st:{plant:0,harv:0,sold:0,eggs:0,hatch:0,help:0,orders:0,fish:0,made:0},seed:'morcov',tut:false,aid:1,pos:null,
  lay:{},decor:[],trees:{},fac:{},orders:[],up:{hambarCap:0,stropitoare:0,pusculita:0,linii:0,companion:0},pig:0,pets:{},pet:null,last:Date.now(),daily:{d:'',streak:0},dn:1};}
let S=defState();
try{const raw=localStorage.getItem(D.SAVE_KEY);if(raw){const d=JSON.parse(raw);S=Object.assign(defState(),d);for(const k of ['st','up','look','daily'])S[k]=Object.assign(defState()[k],d[k]||{});}}catch(e){}
// --- migrations from earlier versions ---
if(!CHARS[S.look.ch])S.look.ch='e';
const OLDA={rata:'gaina',iepure:'catel',capra:'oaie',panda:'zebra'};
S.animals=(S.animals||[]).map(a=>Object.assign(a,{t:OLDA[a.t]||a.t})).filter(a=>ANIMALS[a.t]);
{const sn={};for(const k in S.seen)sn[OLDA[k]||k]=1;S.seen={};for(const k in sn)if(ANIMALS[k])S.seen[k]=true;}
{const byName={};for(const a of Object.values(ANIMALS))byName[a.prod.n]=a.prod.id;const inv={};for(const [k,n] of Object.entries(S.inv)){const id=byName[k]||(k==='rosie'?'salata':k);inv[id]=(inv[id]||0)+n;}S.inv=inv;}
if(S.stropitoareOld===undefined&&S.own.stropitoare&&!S.up.stropitoare){S.up.stropitoare=2;}S.stropitoareOld=1;
if(S.own.pusculita&&!S.up.pusculita)S.up.pusculita=1;
while(S.plots.length<S.fields*PLOTS_PER_FIELD)S.plots.push({c:null,p:0});
S.plots.forEach(p=>{if(p.c&&!CROPS[p.c])p.c='salata';});
if(!CROPS[S.seed])S.seed='morcov';
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
};

/* ================= RENDERER ================= */
const canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.4:1.75));
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const FOG=0xd4e9f7; scene.fog=new THREE.Fog(FOG,90,330);
const camera=new THREE.PerspectiveCamera(58,1,.08,1400);
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
const sky=new THREE.Mesh(new THREE.SphereGeometry(1000,32,16),skyMat); sky.frustumCulled=false; sky.renderOrder=-1; sky.layers.enable(1); scene.add(sky);
{const pm=new THREE.PMREMGenerator(renderer);const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(10,32,16),skyMat));
  const g=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({color:0x5a7a40}));g.rotation.x=-Math.PI/2;g.position.y=-1;es.add(g);
  scene.environment=pm.fromScene(es,0.04).texture;}
const hemi=new THREE.HemisphereLight(0xdcefff,0x7a8f55,.75); hemi.layers.enable(1); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0d8,3.0); sun.castShadow=true; const SM=MOBILE?1024:2048; sun.shadow.mapSize.set(SM,SM);
Object.assign(sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:220}); sun.shadow.bias=-.0004; sun.shadow.normalBias=.035;
sun.layers.enable(1); scene.add(sun); scene.add(sun.target);
const cloudTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');for(let i=0;i<14;i++){const x=rand(30,98),y=rand(45,85),r=rand(18,34);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;})();
const clouds=[];for(let i=0;i<30;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,fog:false,transparent:true,opacity:rand(.6,.95),depthWrite:false}));const s=rand(70,150);sp.scale.set(s,s*.55,1);sp.position.set(rand(-600,600),rand(120,190),rand(-600,600));scene.add(sp);clouds.push(sp);}

/* ================= LOADING ================= */
const manager=new THREE.LoadingManager();
manager.onProgress=(u,l,t)=>{const b=$('#barI');if(b)b.style.width=Math.round(l/t*100)+'%';};
const gltfL=new GLTFLoader(manager); gltfL.setMeshoptDecoder(MeshoptDecoder);
const vrmL=new GLTFLoader(); vrmL.register(p=>new VRMLoaderPlugin(p));
const texL=new THREE.TextureLoader(manager);
const loadGLB=u=>new Promise((res,rej)=>gltfL.load(A+u,res,undefined,rej));
const loadTex=u=>new Promise((res,rej)=>texL.load(A+u,t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;res(t);},undefined,rej));
function loadVRMFile(id,onProg){return new Promise((res,rej)=>vrmL.load(A+'chars/'+id+'.vrm',res,onProg,rej));}
const ANI_FILES=[...new Set(Object.values(ANIMALS).map(a=>a.f))];
const [VIL,NAT,CRP,TX,ANI,TRC,SUV,PETM]=await Promise.all([
  loadGLB('env/village.glb'),loadGLB('env/nature.glb'),loadGLB('env/crops.glb'),
  Promise.all(['grass','forest','path','soil','rock','snow'].map(n=>loadTex('tex/'+n+'.jpg'))).then(a=>({grass:a[0],forest:a[1],path:a[2],soil:a[3],rock:a[4],snow:a[5]})),
  Promise.all(ANI_FILES.map(f=>loadGLB('animals/'+f+'.glb').then(g=>[f,g]))).then(a=>Object.fromEntries(a)),
  loadGLB('env/tractor.glb'),loadGLB('env/suv.glb'),
  Promise.all(['dragon','slime','bat'].map(f=>loadGLB('pets/'+f+'.glb').then(g=>[f,g]))).then(a=>Object.fromEntries(a)),
]);
function partsOf(gltf){const P={};for(const k of [...gltf.scene.children]){const w=new THREE.Group();w.name=k.name;w.add(k);P[k.name.replace(/_1$/,'')]=w;}
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
const LAKES=[{x:-74,z:66,r:17},{x:118,z:22,r:10},{x:-30,z:-110,r:9}];
const WR=325; // world radius
function noise(x,z){return Math.sin(x*.05)*Math.cos(z*.045)*2.2+Math.sin(x*.13+1.3)*Math.sin(z*.11+.7)*.9+Math.sin(x*.31+z*.27)*.25;}
function H(x,z){
  const sq=Math.max(Math.abs(x),Math.abs(z)),r=Math.hypot(x,z);
  let h=noise(x,z)*sstep(58,82,sq)*1.25;
  for(const f of FRIENDS){const d=Math.hypot(x-f.x,z-f.z);h*=sstep(14,26,d);}
  for(const L of LAKES){const ld=Math.hypot(x-L.x,z-L.z);h=lerp(h,-2.4,sstep(L.r+3,L.r-4,ld));}
  const m=sstep(225,320,r);const a=Math.atan2(z,x);
  h+=m*m*62*(.72+.28*Math.sin(a*6+r*.04))+m*noise(x*2.3,z*2.3)*5;
  // a few hills in the wild
  h+=Math.max(0,Math.sin(x*.021+1)*Math.cos(z*.019-.5))*9*sstep(90,130,sq)*(1-sstep(200,240,r));
  return h;}
const PATHS=FRIENDS.map(f=>[0,0,f.x,f.z]);
function onPath(x,z){let d=99;for(const p of PATHS)d=Math.min(d,distSeg(x,z,...p));return d;}
function nearFriend(x,z,r){return FRIENDS.some(f=>Math.hypot(x-f.x,z-f.z)<r);}
function inLake(x,z,m=0){return LAKES.some(L=>Math.hypot(x-L.x,z-L.z)<L.r+m);}
{
  const TS=700,SEG=MOBILE?220:280;const tg=new THREE.PlaneGeometry(TS,TS,SEG,SEG);tg.rotateX(-Math.PI/2);
  const pos=tg.attributes.position,n=pos.count,cols=new Float32Array(n*3),spl=new Float32Array(n*4);
  for(let i=0;i<n;i++){const x=pos.getX(i),z=pos.getZ(i),y=H(x,z);pos.setY(i,y);const sq=Math.max(Math.abs(x),Math.abs(z));
    const v=.88+noise(x*2.1,z*2.1)*.05+Math.sin(x*.7)*Math.sin(z*.6)*.03;cols[i*3]=v;cols[i*3+1]=v;cols[i*3+2]=v;
    let path=0;const pd=onPath(x,z);if(sq>20)path=sstep(3,1.6,pd);
    for(const L of LAKES){const ld=Math.hypot(x-L.x,z-L.z);if(ld<L.r+4)path=Math.max(path,sstep(L.r+4,L.r+1,ld));}
    const forest=sstep(0,.9,noise(x*.9+40,z*.9-20)+.3)*sstep(60,85,sq)*.85;
    spl[i*4]=path;spl[i*4+1]=forest;spl[i*4+2]=sstep(11,19,y);spl[i*4+3]=sstep(34,42,y);}
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
{
  const rnd=seeded(1234);
  const TR=['CommonTree_1','CommonTree_3','CommonTree_5','Pine_2','Pine_4','Pine_5'];
  const pts=[];
  for(let k=0;k<12000&&pts.length<(MOBILE?560:760);k++){
    const a=rnd()*6.283,r=Math.sqrt(rnd())*250+30;const x=Math.cos(a)*r,z=Math.sin(a)*r;const sq=Math.max(Math.abs(x),Math.abs(z));
    if(sq<62)continue;if(nearFriend(x,z,24))continue;if(onPath(x,z)<5)continue;if(inLake(x,z,5))continue;
    const y=H(x,z);if(y>26)continue;if(sq<80&&rnd()<.6)continue;
    const pine=y>6||r>200||rnd()<.45;const t=pine?TR[3+Math.floor(rnd()*3)]:TR[Math.floor(rnd()*3)];
    pts.push({x,z,y,t,s:.75+rnd()*.45,ry:rnd()*6.28});addCirc(x,z,.6);}
  const CS=70,map={};
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
      if(Math.max(Math.abs(x),Math.abs(z))<58||nearFriend(x,z,14)||onPath(x,z)<3.2||inLake(x,z,2))continue;const y=H(x,z);if(y>18)continue;ms.push(TM(x,y,z,rnd()*6.28,smin+rnd()*(smax-smin)));}
    instance(NP[name],ms,{shadow:false});};
  scatter('Bush_Common',140,60,240,.8,1.3);scatter('Bush_Common_Flowers',100,60,200,.8,1.2);
  scatter('Flower_3_Group',140,58,180,.35,.55);scatter('Flower_4_Group',140,58,180,.35,.55);
  scatter('Fern_1',140,70,240,.6,1);scatter('Plant_1_Big',60,70,220,.5,.8);scatter('Mushroom_Common',80,70,240,.6,1);scatter('Mushroom_Laetiporus',30,70,240,.5,.8);
  scatter('Grass_Wispy_Tall',180,58,220,.45,.7);scatter('Grass_Common_Tall',200,58,220,.45,.7);
  const rocks=[];for(let k=0;k<700&&rocks.length<200;k++){const a=rnd()*6.283,r=70+rnd()*250;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.max(Math.abs(x),Math.abs(z))<60||nearFriend(x,z,18)||onPath(x,z)<4||inLake(x,z,2))continue;const s=r>215?2+rnd()*4:.5+rnd()*.9;rocks.push([x,z,s]);if(s>1.2)addCirc(x,z,s*1.3);}
  ['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'].forEach((name,i)=>instance(NP[name],rocks.filter((_,j)=>j%3===i).map(([x,z,s])=>TM(x,H(x,z)-.2*s,z,x*7%6,s))));
  for(const L of LAKES){const lil=[],reeds=[];for(let i=0;i<Math.round(L.r*1.1);i++){const a=rand(0,6.28),r=rand(2,L.r-2);lil.push(TM(L.x+Math.cos(a)*r,-.52,L.z+Math.sin(a)*r,rand(0,6),rand(2,3)));}
    for(let i=0;i<L.r*2.4;i++){const a=rand(0,6.28),r=L.r+rand(-.5,1.5);const x=L.x+Math.cos(a)*r,z=L.z+Math.sin(a)*r;reeds.push(TM(x,H(x,z),z,rand(0,6),rand(.5,.8)));}
    instance(CP['lily_large'],lil,{shadow:false});instance(NP['Grass_Wispy_Tall'],reeds,{shadow:false});
    const sign=new THREE.Group();sign.position.set(L.x+L.r+2.5,H(L.x+L.r+2.5,L.z),L.z);scene.add(sign);E(CYL,0x6b4226,0,.8,0,.07,1.6,.07,sign);label(sign,'🎣 Lac',2.1,{size:.9});}
}
const grassUni={uTime:{value:0}};
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
  for(let k=0;k<N*4&&c<N;k++){const a=rand(0,6.283),r=Math.sqrt(Math.random())*180+56;const x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(Math.max(Math.abs(x),Math.abs(z))<56)continue;if(onPath(x,z)<2.6)continue;if(inLake(x,z,1))continue;const y=H(x,z);if(y>12)continue;
    if(FRIENDS.some(f=>Math.abs(x-f.x)<12&&Math.abs(z-f.z)<12))continue;
    im.setMatrixAt(c,TM(x,y-.02,z,rand(0,6.28),rand(.7,1.35),rand(.7,1.5)));col.setHSL(rand(.2,.28),rand(.45,.65),rand(.42,.6));im.setColorAt(c,col);c++;}
  im.count=c;im.receiveShadow=true;im.castShadow=false;im.computeBoundingSphere();scene.add(im);
  // farm meadow grass gets its own instanced mesh so it can avoid buildings (rebuilt after arranging)
  var farmGrass={geo,gm,im:null};
}

/* ================= PLACEABLES (everything on the farm can be moved) ================= */
const PL={};           // key -> placeable
const spinners=[];
function fpSize(o){return (o.r%2)?[o.d/2,o.w/2]:[o.w/2,o.d/2];}
function farmF(){return FARM_LEVELS[S.farmLv].F;}
function setPlace(o,x,z,r=o.r||0){o.x=x;o.z=z;o.r=r;o.g.position.set(x,0,z);o.g.rotation.y=-r*Math.PI/2;
  if(o.col){const [hw,hd]=fpSize(o);o.col.x=x;o.col.z=z;if(o.col.r!==undefined){}else{o.col.hw=Math.max(.1,hw-(o.pad||0));o.col.hd=Math.max(.1,hd-(o.pad||0));}}
  S.lay[o.key]={x,z,r};if(o.onMove)o.onMove();}
function canPlace(o,x,z,r){const tmp={w:o.w,d:o.d,r};const [hw,hd]=fpSize(tmp);const F=farmF()-.6;if(Math.abs(x)+hw>F||Math.abs(z)+hd>F)return false;
  if(Math.abs(x)<3+hw&&z+hd>F-6)return false; // keep the gate free
  for(const k in PL){const p=PL[k];if(p===o)continue;const [pw,pd]=fpSize(p);if(Math.abs(p.x-x)<hw+pw+.2&&Math.abs(p.z-z)<hd+pd+.2)return false;}return true;}
function findSpot(w,d,pref){const F=farmF();const tmp={w,d,r:0};
  if(pref&&canPlace(tmp,pref[0],pref[1],0))return pref;
  for(let rad=0;rad<F;rad+=1)for(let a=0;a<24;a++){const x=Math.round((pref?pref[0]:0)+Math.cos(a/24*6.283)*rad),z=Math.round((pref?pref[1]:0)+Math.sin(a/24*6.283)*rad);if(canPlace(tmp,x,z,0))return [x,z];}
  return [rand(-F+5,F-5),rand(-F+5,F-5)];}
function addPlace(key,{w,d,build,collider='box',pad=0,def,label:lb,ly,onMove}){
  const g=new THREE.Group();scene.add(g);const o={key,g,w,d,r:0,pad,onMove};build(g,o);
  if(lb)o.lbl=label(g,lb,ly||4);
  if(collider==='box')o.col=addBoxC(0,0,1,1);
  PL[key]=o;const L=S.lay[key];let pos=L?[L.x,L.z]:null;let r=L?L.r:0;
  if(!pos){pos=findSpot(w,d,def);}o.r=r;setPlace(o,pos[0],pos[1],r);return o;}
function removePlace(key){const o=PL[key];if(!o)return;scene.remove(o.g);if(o.col){const i=colliders.indexOf(o.col);if(i>=0)colliders.splice(i,1);}delete PL[key];delete S.lay[key];}

/* ---------- builders ---------- */
function houseBox(par,{w=6,d=6,wall='Wall_Plaster_Straight',door='Wall_Plaster_Door_Round',win='Wall_Plaster_Window_Wide_Round',corner='Corner_Exterior_Wood',roof='Roof_RoundTiles_6x6',gable='Roof_Front_Brick6',chimney=true}={}){
  const hw=w/2,hd=d/2;
  for(let x=-hw+1;x<hw;x+=2){const mid=Math.abs(x)<.1;piece(VP,mid?door:win,x,0,hd,0,1,par);piece(VP,x===-hw+1?win:wall,x,0,-hd,Math.PI,1,par);}
  for(let z=-hd+1;z<hd;z+=2){piece(VP,Math.abs(z)<1.1?win:wall,hw,0,z,Math.PI/2,1,par);piece(VP,wall,-hw,0,z,-Math.PI/2,1,par);}
  for(const [x,z] of [[hw,hd],[-hw,hd],[hw,-hd],[-hw,-hd]])piece(VP,corner,x,0,z,0,1,par);
  piece(VP,roof,0,3.08,0,0,1,par);piece(VP,gable,0,3.08,hd,0,1,par);piece(VP,gable,0,3.08,-hd,Math.PI,1,par);
  piece(VP,'Door_1_Round',-.53,0,hd+.02,0,1,par);
  if(chimney)piece(VP,'Prop_Chimney',hw*.45,4.2,-hd*.3,0,1,par);}
function canopyTex(a,b){const cv=document.createElement('canvas');cv.width=128;cv.height=16;const g=cv.getContext('2d');for(let i=0;i<8;i++){g.fillStyle=i%2?a:b;g.fillRect(i*16,0,16,16);}const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;}
function fenceRect(par,hw,hd,gapSide=null,gap=1.6){const ms=[];const L=(x1,z1,x2,z2)=>{const len=Math.hypot(x2-x1,z2-z1),n=Math.max(1,Math.round(len/2.06)),ry=-Math.atan2(z2-z1,x2-x1);for(let i=0;i<n;i++){const t=(i+.5)/n;ms.push(TM(lerp(x1,x2,t),0,lerp(z1,z2,t),ry,1,1.15).multiply(new THREE.Matrix4().makeScale(len/n/2.06,1,1)));}};
  L(-hw,-hd,hw,-hd);L(-hw,hd,-hw,-hd);
  if(gapSide==='e'){L(hw,-hd,hw,-gap);L(hw,gap,hw,hd);}else L(hw,-hd,hw,hd);
  if(gapSide==='s'){L(hw,hd,gap,hd);L(-gap,hd,-hw,hd);}else L(hw,hd,-hw,hd);
  instance(VP['Prop_WoodenFence_Single'],ms,{parent:par});}
const soilMat=new THREE.MeshStandardMaterial({map:TX.path,roughness:1,color:0xd6aa80});
const soilGeo=new THREE.BoxGeometry(2.7,.28,2.7),furGeo=new THREE.BoxGeometry(2.4,.08,.34);
const B_BUILDERS={
  hambar(g){houseBox(g,{w:6,d:8,wall:'Wall_UnevenBrick_Straight',door:'Wall_UnevenBrick_Door_Round',win:'Wall_UnevenBrick_Window_Wide_Round',corner:'Corner_Exterior_Brick',roof:'Roof_RoundTiles_6x8',chimney:false});
    piece(VP,'Prop_Crate',3.6,0,3.2,0,1,g);piece(VP,'Prop_Crate',3.7,1.06,3.3,.4,.8,g);bake(g);},
  sera(g){const glass=new THREE.MeshPhysicalMaterial({color:0xe6fbff,roughness:.05,metalness:0,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide});
    const gl=new THREE.Mesh(new THREE.BoxGeometry(6,2.6,8),glass);gl.position.y=1.3;gl.userData.keep=1;g.add(gl);
    const rf=new THREE.Mesh(new THREE.CylinderGeometry(3,3,8,20,1,true,-Math.PI/2,Math.PI),glass);rf.rotation.set(Math.PI/2,0,Math.PI/2);rf.scale.set(1,1,.45);rf.position.y=2.6;rf.userData.keep=1;g.add(rf);
    const fr=mat(0xf5f5f5,{roughness:.5});for(const x of[-3,3])for(const z of[-4,-1.3,1.3,4])E(BOX,fr,x,1.3,z,.1,2.6,.1,g);for(const z of[-4,-1.3,1.3,4]){const a=new THREE.Mesh(new THREE.TorusGeometry(3,.05,6,24,Math.PI),fr);a.position.set(0,2.6,z);a.scale.set(1,.45,1);g.add(a);}
    const sm=new THREE.MeshStandardMaterial({map:TX.soil,roughness:1});for(let i=0;i<3;i++){E(BOX,sm,-1.8+i*1.8,.2,0,1.2,.4,6.5,g);for(let j=0;j<5;j++)piece(CP,pick(['crops_leafsStageB','crop_pumpkin','crops_cornStageB']),-1.8+i*1.8,.4,-2.6+j*1.3,rand(0,6),1.3,g);}bake(g);},
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
    E(BOX,mat(0x5a2a3a),0,2.02,0,.5,.04,.1,g);const coin=E(CYL,mat(0xffd54f,{metalness:.7,roughness:.25,emissive:0x6a4600}),0,2.4,0,.28,.06,.28,g);coin.rotation.x=Math.PI/2;spinners.push({o:coin,t:'coin'});},
  comenzi(g){E(CYL,0x6b4226,-1.2,1.2,0,.1,2.4,.1,g);E(CYL,0x6b4226,1.2,1.2,0,.1,2.4,.1,g);M(new THREE.BoxGeometry(2.8,1.7,.15),0x9c6b3e,0,1.9,0,g);
    const pm=[0xfff4c2,0xffffff,0xd6f0ff,0xffd6e8];for(let i=0;i<6;i++)M(new THREE.BoxGeometry(.6,.45,.03),pm[i%4],-.85+(i%3)*.85,2.25-Math.floor(i/2/1.5)*.6,.1,g);M(new THREE.ConeGeometry(1.8,.6,4),0xb5562f,0,3.05,0,g).rotation.y=Math.PI/4;},
};
function factoryModel(g,id){const F=FACTORIES[id];const wall={furaje:'Wall_UnevenBrick_Straight',brutarie:'Wall_Plaster_WoodGrid',lactate:'Wall_Plaster_Straight',zahar:'Wall_UnevenBrick_Straight',tesatorie:'Wall_Plaster_WoodGrid',cofetarie:'Wall_Plaster_Straight'}[id];
  const brick=wall.startsWith('Wall_Uneven');const h=new THREE.Group();h.scale.setScalar(F.w/6.6);g.add(h);
  houseBox(h,{wall,win:brick?'Wall_UnevenBrick_Window_Wide_Round':'Wall_Plaster_Window_Wide_Round',door:brick?'Wall_UnevenBrick_Door_Round':'Wall_Plaster_Door_Round',corner:brick?'Corner_Exterior_Brick':'Corner_Exterior_Wood',chimney:true});bake(h);
  const sign=new THREE.Group();sign.position.set(0,0,F.d/2+.9);g.add(sign);E(CYL,0x6b4226,0,.6,0,.06,1.2,.06,sign);
  const s=emoji(F.e,1.3);s.position.y=1.6;sign.add(s);}

/* ---------- core farm objects ---------- */
const farmHouse=addPlace('casa',{w:8,d:8,def:[12,-15],label:'🏡 Casa ta',ly:7.6,pad:.6,build(g){houseBox(g);piece(VP,'Prop_Vine1',2,2.9,3.12,0,1,g);piece(VP,'WindowShutters_Wide_Round_Open',2,0,3.1,0,1,g);piece(VP,'WindowShutters_Wide_Round_Open',-2,0,3.1,0,1,g);piece(CP,'log_stack',-4,0,1.5,0,2.2,g);piece(CP,'pot_large',1.8,0,4,0,1.6,g);bake(g);}});
const market=addPlace('piata',{w:6,d:4,def:[-6,9],label:'💰 Piața',ly:4,pad:.6,build(g){
  piece(VP,'Prop_Wagon',0,0,1,Math.PI/2,1,g);
  for(const [x,z,c] of [[-1.6,-.6,'crop_carrot'],[0,-.8,'crop_pumpkin'],[1.6,-.6,'crop_melon']]){piece(VP,'Prop_Crate',x,0,z,rand(-.2,.2),.8,g);for(let i=0;i<3;i++)piece(CP,c,x+rand(-.25,.25),.85,z+rand(-.25,.25),rand(0,6),.75,g);}
  for(const s of[-1,1])E(CYL,0x7a4f2c,s*2.4,1.4,-.3,.08,2.8,.08,g);
  const aw=new THREE.Mesh(new THREE.BoxGeometry(5.2,.08,2.6),new THREE.MeshStandardMaterial({map:canopyTex('#e85b4a','#fff4e6'),roughness:.9}));aw.position.set(0,2.8,.5);aw.rotation.x=.22;aw.castShadow=true;g.add(aw);bake(g);}});
const nest=addPlace('cuib',{w:3.6,d:3.6,def:[-6,-4],label:'✨ Cuibul magic',ly:3.2,collider:'box',pad:.6,build(g){
  const tw=mat(0x8a6236,{roughness:1});for(let i=0;i<46;i++){const a=i/46*6.28*3,r=.95+Math.sin(i*1.7)*.12;const s=M(CYL,tw,Math.cos(a)*r,.2+(i%3)*.12,Math.sin(a)*r,g);s.scale.set(.05,1.1,.05);s.rotation.order='YXZ';s.rotation.set(Math.PI/2+rand(-.3,.3),-a,0);}
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.32,12,32),mat(0x9a7044,{roughness:1}));ring.rotation.x=Math.PI/2;ring.position.y=.3;ring.castShadow=true;g.add(ring);bake(g);
  const egg=E(SPH,new THREE.MeshPhysicalMaterial({color:0xfff2c2,emissive:0xffb340,emissiveIntensity:.35,roughness:.25,clearcoat:1}),0,.95,0,.5,.66,.5,g);spinners.push({o:egg,t:'bob'});}});

/* ---------- fields of plots ---------- */
const plotObjs=[];
const FIELD_W=13;
function plotLocal(j){const row=Math.floor(j/4),col=j%4;return [-4.575+col*3.05,4.575-row*3.05];}
function plotPos(i){const f=PL['camp'+Math.floor(i/PLOTS_PER_FIELD)];const [lx,lz]=plotLocal(i%PLOTS_PER_FIELD);if(!f)return [lx,lz];const c=Math.cos(-f.r*Math.PI/2),s=Math.sin(-f.r*Math.PI/2);return [f.x+lx*c+lz*s,f.z-lx*s+lz*c];}
function addField(fi){const def=[[8.2,-.6],[-8,-17],[26,-10],[-26,10]][fi]||null;
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
const penObjs=[];
function addPen(i){const def=[[-16,11],[-16,3],[-16,-5],[-16,-13],[-26,11],[-26,1],[-26,-9],[-26,-19],[26,14],[26,24]][i]||null;
  penObjs[i]=addPlace('tarc'+i,{w:7.6,d:7.6,def,collider:null,label:'🐾 Țarc '+(i+1),ly:2.4,build(g){
    fenceRect(g,3.5,3.5,'e',1.2);
    const hay=E(CYL,mat(0xe3c160,{roughness:1}),-2.2,.45,-2.3,.55,1,.55,g);hay.rotation.z=Math.PI/2;
    M(new THREE.BoxGeometry(1.6,.4,.6),mat(0x8d7b6a),2,.2,-2.6,g);E(BOX,mat(0x4aa3d8,{roughness:.1}),2,.39,-2.6,1.4,.04,.45,g,false);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(6.8,6.8),new THREE.MeshStandardMaterial({map:TX.path,roughness:1,color:0xddc79a}));fl.rotation.x=-Math.PI/2;fl.position.y=.03;fl.receiveShadow=true;g.add(fl);}});}
for(let i=0;i<S.pens;i++)addPen(i);
const penPos=i=>{const p=PL['tarc'+i];return p?[p.x,p.z]:[0,0];};

/* ---------- buildings / factories / decor / fruit trees ---------- */
const DEF_POS={fantana:[-1,3],flori:[12,-9.5],lampi:[-3.5,16],siloz:[-9,-17],hambar:[-1,-17],moara:[18,-4],sera:[17,14],pusculita:[3,15],comenzi:[-3,-9]};
function addBuilding(id){const b=BUILD[id];
  return addPlace('b:'+id,{w:b.w,d:b.d,def:DEF_POS[id],pad:.3,collider:['flori','lampi'].includes(id)?null:'box',label:['hambar','sera','moara','siloz','fantana','pusculita','comenzi'].includes(id)?b.e+' '+b.n:null,
    ly:{moara:10.6,hambar:8.2,siloz:9.2,sera:4.6,fantana:4.4,pusculita:3.4,comenzi:4}[id],build(g){B_BUILDERS[id](g);}});}
function addFactory(id){const F=FACTORIES[id];const o=addPlace('f:'+id,{w:F.w,d:F.d+1.5,pad:.6,label:F.e+' '+F.n,ly:F.w*1.25+1.5,build(g){factoryModel(g,id);}});
  const ic=emoji('✅',1.1);ic.position.y=F.w*1.25+.3;ic.visible=false;o.g.add(ic);o.ready=ic;return o;}
const DECOR_BUILD={
  banca(g){const w=mat(0x8a5a33,{roughness:.8});for(const z of[-.15,.15])E(BOX,w,0,.5,z,1.8,.08,.25,g);E(BOX,w,0,.85,-.32,1.8,.4,.06,g);for(const x of[-.75,.75])E(BOX,mat(0x333333,{metalness:.5}),x,.25,0,.08,.5,.6,g);},
  copac(g){instance(NP['CommonTree_2'],[TM(0,0,0,rand(0,6),.75)],{parent:g});},
  tufis(g){instance(NP['Bush_Common_Flowers'],[TM(0,0,0,rand(0,6),.9)],{parent:g});},
  ciuperci(g){instance(NP['Mushroom_Common'],[TM(0,0,0,0,1.3)],{parent:g,shadow:false});},
  piatra(g){instance(NP['Rock_Medium_2'],[TM(0,-.2,0,rand(0,6),1)],{parent:g});},
  lazi(g){piece(VP,'Prop_Crate',0,0,0,.2,.8,g);piece(VP,'Prop_Crate',.2,.85,.1,-.3,.6,g);},
  caruta(g){piece(VP,'Prop_Wagon',0,0,1.1,0,1,g);},
  felinar(g){const post=mat(0x4a3a2c,{roughness:.6,metalness:.3});E(CYL,post,0,.08,0,.22,.16,.22,g);E(CYL,post,0,1.35,0,.09,2.6,.09,g);E(BOX,new THREE.MeshStandardMaterial({color:0xffe9a8,emissive:0xffb340,emissiveIntensity:1.4}),0,2.88,0,.34,.46,.34,g,false);E(CONE,post,0,3.28,0,.32,.34,.32,g);},
  statuie(g){E(CYL,mat(0xe8e2d6),0,.3,0,.9,.6,.9,g);const e=E(SPH,new THREE.MeshStandardMaterial({color:0xffd54f,metalness:.9,roughness:.2,emissive:0x5a3c00,emissiveIntensity:.4}),0,1.6,0,.75,1,.75,g);spinners.push({o:e,t:'spinY'});},
};
function addDecor(id,key){const d=DECOR[id];return addPlace(key,{w:d.w,d:d.d,collider:['copac','piatra','statuie','caruta'].includes(id)?'box':null,pad:.4,def:[rand(-10,10),rand(-10,10)],build(g){DECOR_BUILD[id](g);}});}
const treeObjs={};
function addFruitTree(key){const T=S.trees[key];const D_=TREES[T.t];
  const o=addPlace(key,{w:3,d:3,collider:'box',pad:1,def:[rand(-12,12),rand(10,18)],build(g){instance(NP['CommonTree_1'],[TM(0,0,0,rand(0,6),.42)],{parent:g});
    const fr=new THREE.Group();g.add(fr);const fm=mat(D_.fruit,{roughness:.4});for(let i=0;i<14;i++){const a=rand(0,6.28),r=rand(.55,1.15),y=rand(1.7,2.8);E(SPH,fm,Math.cos(a)*r,y,Math.sin(a)*r,.14,.14,.14,fr,false);}
    const ic=emoji(D_.e,.9);ic.position.y=4.6;g.add(ic);treeObjs[key]={fr,ic};}});return o;}
for(const id in BUILD)if(S.own[id])addBuilding(id);
for(const id in FACTORIES)if(S.own['f_'+id])addFactory(id);
for(const d of S.decor)addDecor(d.id,d.key);
for(const k in S.trees)addFruitTree(k);

/* ---------- farm fence (rebuilt when the farm grows) ---------- */
let fenceGroup=null, gateSign=null;
function buildFarmFence(){if(fenceGroup)scene.remove(fenceGroup);fenceGroup=new THREE.Group();scene.add(fenceGroup);const F=farmF();
  const ms=[];const line=(x1,z1,x2,z2)=>{const L=Math.hypot(x2-x1,z2-z1),n=Math.max(1,Math.round(L/2.06)),ry=-Math.atan2(z2-z1,x2-x1);for(let i=0;i<n;i++){const t=(i+.5)/n;const x=lerp(x1,x2,t),z=lerp(z1,z2,t);ms.push(TM(x,H(x,z),z,ry,1,1.15).multiply(new THREE.Matrix4().makeScale(L/n/2.06,1,1)));}};
  const gap=3.5;for(const [ax,az,bx,bz] of[[-F,-F,F,-F],[F,-F,F,F],[F,F,-F,F],[-F,F,-F,-F]]){const mx=(ax+bx)/2,mz=(az+bz)/2,dx=bx-ax,dz=bz-az,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L;line(ax,az,mx-ux*gap,mz-uz*gap);line(mx+ux*gap,mz+uz*gap,bx,bz);}
  instance(VP['Prop_WoodenFence_Single'],ms,{parent:fenceGroup});
  const sign=new THREE.Group();sign.position.set(0,0,F);fenceGroup.add(sign);for(const s of[-1,1])E(CYL,0x6b4226,3.6*s,1.8,0,.14,3.6,.14,sign);
  M(new THREE.BoxGeometry(7.4,.9,.18),0x9c6b3e,0,3.4,0,sign);label(sign,'🌻 Ferma mea',3.4,{size:1.4});
  // meadow grass inside the farm, avoiding everything placed
  rebuildFarmGrass();}
function rebuildFarmGrass(){if(farmGrass.im){scene.remove(farmGrass.im);farmGrass.im.dispose();}
  const F=56,N=MOBILE?1800:3200;const im=new THREE.InstancedMesh(farmGrass.geo,farmGrass.gm,N);let c=0;const col=new THREE.Color();
  const blocked=(x,z)=>{for(const k in PL){const p=PL[k];const [hw,hd]=fpSize(p);if(Math.abs(x-p.x)<hw+.6&&Math.abs(z-p.z)<hd+.6)return true;}if(Math.abs(x)<2.6&&z>8)return true;return false;};
  for(let k=0;k<N*5&&c<N;k++){const x=rand(-F,F),z=rand(-F,F);if(blocked(x,z))continue;im.setMatrixAt(c,TM(x,H(x,z)-.02,z,rand(0,6.28),rand(.6,1.2),rand(.6,1.3)));col.setHSL(rand(.2,.28),rand(.45,.65),rand(.42,.6));im.setColorAt(c,col);c++;}
  im.count=c;im.receiveShadow=true;im.computeBoundingSphere();scene.add(im);farmGrass.im=im;}
buildFarmFence();

/* ---------- locks / "for sale" signs ---------- */
const locks={};
function lockSign(key,x,z,text){if(locks[key]){const L=locks[key];L.g.position.set(x,0,z);L.x=x;L.z=z;return;}const g=new THREE.Group();g.position.set(x,0,z);E(CYL,0x6b4226,0,.7,0,.07,1.4,.07,g);M(new THREE.BoxGeometry(1.3,.8,.12),0xc9a06a,0,1.5,0,g);label(g,text,2.3,{size:.65});scene.add(g);locks[key]={g,x,z};}
function unlock(key){if(locks[key]){scene.remove(locks[key].g);delete locks[key];}}
function refreshLocks(){
  if(S.unl<maxPlots()){const [x,z]=plotPos(S.unl);unlock('plot');lockSign('plot',x,z,'➕ Parcelă '+plotCost()+'🪙');}else unlock('plot');
  for(const k of Object.keys(locks))if(k.startsWith('v:')&&S.own[k.slice(2)])unlock(k);}

/* ================= VEHICLES ================= */
function recolorMap(tex,rgb){const img=tex.image;const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const g=cv.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,cv.width,cv.height),p=d.data;
  for(let i=0;i<p.length;i+=4){const r=p[i],gg=p[i+1],b=p[i+2];if(b>r+18&&b>gg+14&&r>90&&r<215&&Math.abs(r-gg)<14){const l=(r+gg+b)/3/175;p[i]=Math.min(255,rgb[0]*l);p[i+1]=Math.min(255,rgb[1]*l);p[i+2]=Math.min(255,rgb[2]*l);}}
  g.putImageData(d,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;}
for(const [G,rgb] of [[TRC,[60,170,70]],[SUV,[232,170,66]]]){const done=new Set();G.scene.traverse(o=>{if(o.isMesh&&o.material.map&&!done.has(o.material)){const m=o.material;m.map=recolorMap(m.map,rgb);m.roughness=.45;m.metalness=.15;m.needsUpdate=true;done.add(m);}});}
function vehModel(gltf,scale,seat){const g=new THREE.Group();const m=gltf.scene.clone(true);m.scale.setScalar(scale);g.add(m);const W=[];
  m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(/wheel/i.test(o.name)&&!/back$/.test(o.name))W.push(o);});
  g.userData={wheels:W,seat:new THREE.Vector3(...seat)};return g;}
const vehicles={};
function spawnVehicle(id){if(vehicles[id])return;const v=id==='tractor'?vehModel(TRC,1.45,[0,.9,-.35]):vehModel(SUV,1.6,[-.32,.55,.05]);
  const p=S.lay['v:'+id]||{x:id==='tractor'?6:10,z:id==='tractor'?18:18};v.position.set(p.x,0,p.z);v.rotation.y=Math.PI;scene.add(v);vehicles[id]=v;}

/* ================= CHARACTERS (VRM anime) ================= */
const BONES=['hips','spine','chest','neck','head','leftUpperArm','leftLowerArm','rightUpperArm','rightLowerArm','leftUpperLeg','leftLowerLeg','rightUpperLeg','rightLowerLeg'];
const matsOf=o=>Array.isArray(o.material)?o.material:[o.material];
async function makeChar(id,onProg){
  const gltf=await loadVRMFile(id,onProg);const v=gltf.userData.vrm;VRMUtils.removeUnnecessaryVertices(gltf.scene);VRMUtils.rotateVRM0(v);
  v.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;}});
  const root=new THREE.Group();root.add(v.scene);const B={};for(const n of BONES)B[n]=v.humanoid.getNormalizedBoneNode(n);
  const hairMeshes=[],hairMats=[],clothMats=[];
  v.scene.traverse(o=>{if(!o.isMesh)return;const ms=matsOf(o);if(ms.some(m=>/HAIR/i.test(m.name))){hairMeshes.push(o);ms.forEach(m=>{if(!hairMats.includes(m))hairMats.push(m);});}
    ms.forEach(m=>{if(/CLOTH/i.test(m.name)&&!clothMats.includes(m))clothMats.push(m);});});
  v.update(0);const box=new THREE.Box3().setFromObject(v.scene);const head=v.humanoid.getRawBoneNode('head');const hp=new THREE.Vector3();head.getWorldPosition(hp);
  const chest=v.humanoid.getRawBoneNode('upperChest')||v.humanoid.getRawBoneNode('chest');const cp=new THREE.Vector3();chest.getWorldPosition(cp);
  return {id,v,root,B,hairMeshes,hairMats,clothMats,head,chest,headTop:box.max.y-hp.y,chestY:cp.y,height:box.max.y,t:rand(0,10),blink:rand(1,4),happy:0,acc:{},donor:null};}
function setLayers(c,on){const f=o=>on?o.layers.enable(1):o.layers.disable(1);c.root.traverse(f);if(c.donor)c.donor.v.scene.traverse(f);}

// --- texture recolouring (clothes hue / hair colour) ---
function remapTexture(tex,fn){const img=tex.userData.orig||tex.image;const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const g=cv.getContext('2d');g.drawImage(img,0,0);
  const d=g.getImageData(0,0,cv.width,cv.height);fn(d.data);g.putImageData(d,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=tex.flipY;t.colorSpace=tex.colorSpace;t.wrapS=tex.wrapS;t.wrapT=tex.wrapT;t.userData.orig=img;return t;}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6;}return [h,s,l];}
function hsl2rgb(h,s,l){if(s===0)return [l*255,l*255,l*255];const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;const f=t=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};return [f(h+1/3)*255,f(h)*255,f(h-1/3)*255];}
function matTextures(m){return ['map','shadeMultiplyTexture'].filter(k=>m[k]&&m[k].image);}
function restoreTex(m){for(const k of matTextures(m)){if(m.userData['o_'+k]){m[k]=m.userData['o_'+k];}}m.needsUpdate=true;}
function applyCloth(c,idx){const opt=OUTFIT_COLORS[idx]||OUTFIT_COLORS[0];
  for(const m of c.clothMats){for(const k of matTextures(m)){if(!m.userData['o_'+k])m.userData['o_'+k]=m[k];const base=m.userData['o_'+k];
      if(opt.c===null){m[k]=base;continue;}const H_=opt.c/360;
      m[k]=remapTexture(base,p=>{for(let i=0;i<p.length;i+=4){if(p[i+3]<10)continue;const [h,s,l]=rgb2hsl(p[i],p[i+1],p[i+2]);if(s<.16||l>.93)continue;
        let o;if(opt.c===-1)o=hsl2rgb(h,s*.15,l*.38);else o=hsl2rgb(H_,Math.max(s,.45),l);p[i]=o[0];p[i+1]=o[1];p[i+2]=o[2];}});}
    m.needsUpdate=true;}}
function applyHairColor(c,idx){const opt=HAIR_COLORS[idx]||HAIR_COLORS[0];const mats=c.donor?c.donor.hairMats:c.hairMats;
  for(const m of mats){for(const k of matTextures(m)){if(!m.userData['o_'+k])m.userData['o_'+k]=m[k];const base=m.userData['o_'+k];
      if(opt.c===null){m[k]=base;continue;}const tc=new THREE.Color(opt.c);const T=[tc.r*255,tc.g*255,tc.b*255];const shade=k==='shadeMultiplyTexture'?.72:1;
      m[k]=remapTexture(base,p=>{let lo=255,hi=0;for(let i=0;i<p.length;i+=16){if(p[i+3]<40)continue;const L=.3*p[i]+.59*p[i+1]+.11*p[i+2];lo=Math.min(lo,L);hi=Math.max(hi,L);}
        const rg=Math.max(20,hi-lo);for(let i=0;i<p.length;i+=4){if(p[i+3]<5)continue;const L=(.3*p[i]+.59*p[i+1]+.11*p[i+2]-lo)/rg;const f=(.55+.7*L)*shade;
          p[i]=Math.min(255,T[0]*f+18*L);p[i+1]=Math.min(255,T[1]*f+18*L);p[i+2]=Math.min(255,T[2]*f+18*L);}});}
    m.needsUpdate=true;}}
// --- hairstyle swap: borrow the hair of another character ---
const donorCache={};
async function applyHairStyle(c,donorId){
  if(c.donor){scene.remove(c.donor.v.scene);c.donor=null;}
  c.hairMeshes.forEach(o=>o.visible=true);
  if(!donorId||donorId===c.id)return;
  let gltf=donorCache[donorId+'@'+c.id];
  if(!gltf){gltf=await loadVRMFile(donorId);donorCache[donorId+'@'+c.id]=gltf;}
  const v=gltf.userData.vrm;if(!v.__rot){VRMUtils.rotateVRM0(v);v.__rot=1;}
  const hairMats=[];v.scene.traverse(o=>{if(o.isMesh){const ms=matsOf(o);const isHair=ms.some(m=>/HAIR/i.test(m.name));o.visible=isHair;o.castShadow=true;o.frustumCulled=false;if(isHair)ms.forEach(m=>{if(!hairMats.includes(m))hairMats.push(m);});}});
  v.scene.matrixAutoUpdate=true;v.scene.position.set(0,0,0);v.scene.rotation.set(0,Math.PI,0);v.update(0);v.scene.updateMatrixWorld(true);
  const dHead=v.humanoid.getRawBoneNode('head');const Dm=new THREE.Matrix4().copy(v.scene.matrixWorld).invert().multiply(dHead.matrixWorld);
  const box=new THREE.Box3().setFromObject(v.scene);const hp=new THREE.Vector3();dHead.getWorldPosition(hp);const dTop=box.max.y-hp.y;
  const sc=clamp(c.headTop/dTop,.85,1.15);
  v.scene.matrixAutoUpdate=false;scene.add(v.scene);
  c.donor={v,Dinv:Dm.clone().invert(),sc,hairMats,id:donorId};c.hairMeshes.forEach(o=>o.visible=false);
  if(lookOpen&&c===pch)setLayers(c,true);}
const _sm=new THREE.Matrix4();
function syncDonor(c,dt){if(!c.donor)return;c.head.updateWorldMatrix(true,false);const m=c.donor.v.scene.matrix;
  m.copy(c.head.matrixWorld).multiply(_sm.makeScale(c.donor.sc,c.donor.sc,c.donor.sc)).multiply(c.donor.Dinv);c.donor.v.scene.updateMatrixWorld(true);c.donor.v.update(dt);
  c.donor.v.scene.visible=c.root.visible;}
// --- accessories ---
function gm(c,o){return mat(c,o);}
function makeHeadAcc(kind){const g=new THREE.Group();
  if(kind==='paie'){const s=gm(0xe9c46a,{roughness:1});E(CYL,s,0,0,0,.27,.02,.27,g);E(CYL,s,0,.07,0,.13,.13,.13,g);E(CYL,gm(0xd94a4a),0,.035,0,.135,.04,.135,g);}
  if(kind==='cowboy'){const s=gm(0x8a5a2b,{roughness:.8});E(CYL,s,0,0,0,.28,.02,.24,g);E(CYL,s,0,.08,0,.13,.15,.14,g);E(CYL,gm(0x3b2414),0,.03,0,.135,.035,.145,g);}
  if(kind==='flori'){const cs=[0xff7ab8,0xffe14d,0xffffff,0xa27bff,0xff8a3d];for(let i=0;i<12;i++){const a=i/12*6.283;E(SPH,gm(cs[i%5],{roughness:.6}),Math.cos(a)*.13,0,Math.sin(a)*.13,.035,.03,.035,g);}const r=new THREE.Mesh(new THREE.TorusGeometry(.13,.012,6,24),gm(0x4caf50));r.rotation.x=Math.PI/2;g.add(r);}
  if(kind==='tiara'){const gd=gm(0xffc93a,{metalness:.45,roughness:.3,emissive:0x5a3a00});const r=new THREE.Mesh(new THREE.TorusGeometry(.12,.012,6,24,Math.PI),gd);r.rotation.x=Math.PI/2;r.rotation.z=Math.PI;r.position.y=.01;g.add(r);
    for(const x of[-.07,0,.07])E(CONE,gd,x,.04+(x?0:.02),-.11,.018,.06,.018,g);E(SPH,new THREE.MeshStandardMaterial({color:0xff3d8b,emissive:0xff3d8b,emissiveIntensity:.5,roughness:.2}),0,.09,-.115,.022,.022,.022,g);}
  if(kind==='pisica'){for(const s of[-1,1]){const e=E(CONE,gm(0xf0e0d6),.09*s,.05,0,.05,.11,.035,g);e.rotation.z=-.3*s;const i=E(CONE,gm(0xff9ecb),.088*s,.045,-.01,.03,.075,.02,g);i.rotation.z=-.3*s;}}
  if(kind==='iepure'){for(const s of[-1,1]){const e=E(SPH,gm(0xffffff,{roughness:.9}),.06*s,.14,0,.035,.14,.025,g);e.rotation.z=-.15*s;const i=E(SPH,gm(0xffb3cf),.06*s,.14,-.012,.022,.11,.015,g);i.rotation.z=-.15*s;}const b=new THREE.Mesh(new THREE.TorusGeometry(.13,.01,6,24,Math.PI),gm(0xff7ab8));b.rotation.y=Math.PI/2;b.position.y=-.01;g.add(b);}
  if(kind==='caciula'){E(SPH,gm(0xd94a4a,{roughness:1}),0,-.02,0,.155,.13,.155,g);E(CYL,gm(0xffffff,{roughness:1}),0,-.06,0,.157,.05,.157,g);E(SPH,gm(0xffffff,{roughness:1}),0,.12,0,.05,.05,.05,g);}
  if(kind==='sapca'){E(SPH,gm(0x2f7de1,{roughness:.7}),0,-.02,0,.145,.1,.145,g);const v=E(CYL,gm(0x2f7de1,{roughness:.7}),0,-.05,-.13,.11,.015,.1,g);E(SPH,gm(0xffffff),0,.075,0,.02,.02,.02,g);}
  if(kind==='fundita'){const p=gm(0xff4f8b,{roughness:.5});for(const s of[-1,1]){const l=E(SPH,p,.07*s,0,.05,.07,.045,.03,g);l.rotation.z=.4*s;}E(SPH,p,0,0,.05,.025,.03,.025,g);}
  if(kind==='coarne'){const h=E(CONE,new THREE.MeshStandardMaterial({color:0xffd54f,metalness:.6,roughness:.25,emissive:0x6a4600,emissiveIntensity:.4}),0,.06,-.06,.03,.17,.03,g);h.rotation.x=-.4;}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function makeFaceAcc(kind){const g=new THREE.Group();if(kind==='none')return g;
  const frame=kind==='inimioare'?gm(0xff4f8b):gm(0x2b2b2b,{metalness:.4,roughness:.4});const lens=new THREE.MeshStandardMaterial({color:kind==='soare'?0x111111:kind==='inimioare'?0xff7ab8:0xcfefff,transparent:true,opacity:kind==='ochelari'?.25:.85,roughness:.1});
  for(const s of[-1,1]){const r=new THREE.Mesh(new THREE.TorusGeometry(.032,.005,6,20),frame);r.position.set(.042*s,0,0);g.add(r);const l=new THREE.Mesh(new THREE.CircleGeometry(.03,20),lens);l.position.set(.042*s,0,-.001);l.rotation.y=Math.PI;g.add(l);
    E(BOX,frame,.083*s,.005,.04,.004,.006,.08,g,false);}
  E(BOX,frame,0,.005,0,.025,.005,.005,g,false);return g;}
function wingShape(w,h,col,op){const sh=new THREE.Shape();sh.moveTo(0,0);sh.bezierCurveTo(w*.3,h*.9,w*.9,h,w,h*.55);sh.bezierCurveTo(w*.95,h*.2,w*.5,-h*.15,0,0);
  return new THREE.Mesh(new THREE.ShapeGeometry(sh),new THREE.MeshStandardMaterial({color:col,transparent:true,opacity:op,side:THREE.DoubleSide,roughness:.3,emissive:col,emissiveIntensity:.2}));}
function makeBackAcc(kind){const g=new THREE.Group();
  if(kind==='rucsac'){E(BOX,gm(0xe8574a,{roughness:.7}),0,-.08,0,.26,.3,.13,g);E(BOX,gm(0xd04236),0,-.16,.07,.2,.12,.04,g);}
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
function animChar(c,dt,{moving=false,speed=1,air=false,sit=false,fish=false}={}){
  c.t+=dt*(moving?8.5*clamp(speed,.6,1.6):1);const B=c.B,k=Math.min(1,dt*12),s=Math.sin(c.t),co=Math.cos(c.t);
  const set=(b,x,y,z)=>{const n=B[b];if(!n)return;n.rotation.x=lerp(n.rotation.x,x,k);n.rotation.y=lerp(n.rotation.y,y,k);n.rotation.z=lerp(n.rotation.z,z,k);};
  if(sit){set('leftUpperLeg',-1.45,0,.05);set('rightUpperLeg',-1.45,0,-.05);set('leftLowerLeg',1.45,0,0);set('rightLowerLeg',1.45,0,0);
    set('leftUpperArm',-.9,0,1.05);set('rightUpperArm',-.9,0,-1.05);set('leftLowerArm',0,0,.2);set('rightLowerArm',0,0,-.2);set('spine',0,0,0);set('chest',.05,0,0);}
  else if(air){set('leftUpperLeg',-.7,0,0);set('rightUpperLeg',.25,0,0);set('leftLowerLeg',1,0,0);set('rightLowerLeg',.6,0,0);
    set('leftUpperArm',-.2,0,.35);set('rightUpperArm',-.2,0,-.35);set('leftLowerArm',0,0,.3);set('rightLowerArm',0,0,-.3);set('spine',-.05,0,0);set('chest',0,0,0);}
  else if(moving){const a=.55*clamp(speed,.5,1.2);
    // thigh swings forward (negative x) when s>0; the knee bends while the leg travels forward (swing phase)
    set('leftUpperLeg',-s*a,0,0);set('rightUpperLeg',s*a,0,0);
    set('leftLowerLeg',Math.max(0,co)*1.05*clamp(speed,.6,1.2)+.06,0,0);set('rightLowerLeg',Math.max(0,-co)*1.05*clamp(speed,.6,1.2)+.06,0,0);
    set('leftUpperArm',s*.45,0,1.2);set('rightUpperArm',-s*.45,0,-1.2);set('leftLowerArm',0,0,.25);set('rightLowerArm',0,0,-.25);
    set('spine',.05*speed,s*.06,0);set('chest',0,s*.04,0);}
  else if(fish){set('leftUpperLeg',0,0,.03);set('rightUpperLeg',0,0,-.03);set('leftLowerLeg',.05,0,0);set('rightLowerLeg',.05,0,0);
    set('leftUpperArm',-1.1,.2,.5);set('rightUpperArm',-1.1,-.2,-.5);set('leftLowerArm',0,0,.6);set('rightLowerArm',0,0,-.6);set('spine',.08,0,0);set('chest',0,0,0);}
  else{const br=Math.sin(c.t*1.6);set('leftUpperLeg',0,0,.02);set('rightUpperLeg',0,0,-.02);set('leftLowerLeg',.03,0,0);set('rightLowerLeg',.03,0,0);
    set('leftUpperArm',.05,0,1.22+br*.02);set('rightUpperArm',.05,0,-1.22-br*.02);set('leftLowerArm',0,0,.15);set('rightLowerArm',0,0,-.15);set('spine',0,Math.sin(c.t*.4)*.04,0);set('chest',br*.015,0,0);}
  set('head',0,0,moving?0:Math.sin(c.t*.7)*.04);
  c.v.scene.position.y=moving&&!sit?Math.abs(co)*.03:0;
  const em=c.v.expressionManager;if(em){c.blink-=dt;let bl=0;if(c.blink<0){bl=1-Math.abs(c.blink+.08)/.08;if(c.blink<-.16)c.blink=rand(2,5);}
    em.setValue('blink',clamp(bl,0,1));c.happy=Math.max(0,c.happy-dt);em.setValue('happy',c.happy>0?Math.min(1,c.happy*2)*.8:0);}
  if(c.acc.back)c.acc.back.traverse(o=>{if(o.userData.wing)o.rotation.y=o.userData.wing*(.5+Math.sin(T*(moving?9:3))*.25);if(o.userData.cape)o.rotation.x=.12+(moving?.5+Math.sin(T*8)*.08:.02);});
  c.v.update(dt);syncDonor(c,dt);}

/* ================= PLAYER ================= */
const root=new THREE.Group();scene.add(root);
player={pos:new THREE.Vector3(...(S.pos?[S.pos[0],0,S.pos[1]]:[0,0,14])),vy:0,ground:true,face:Math.PI,veh:null,speed:0};
const stage=new THREE.Mesh(new THREE.CylinderGeometry(.7,.76,.1,48),mat(0xfff1d6,{roughness:.6}));stage.position.y=-.06;stage.receiveShadow=true;stage.layers.set(1);root.add(stage);
let pch=null,lookOpen=false;const vrmCache={};
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
function makeCreature(file,h,{walk='Walk',idle='Idle',uni=false,tint=null,gold=false}={}){const T=animalTpl[file];const obj=skClone(T.g.scene);const sc=h/T.h;obj.scale.setScalar(sc);obj.position.y=-T.minY*sc;
  const g=new THREE.Group();g.add(obj);
  const remat=fn=>obj.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(fn):fn(o.material);}});
  if(uni){remat(m=>{const n=m.clone();n.color.lerp(new THREE.Color(0xffffff),.85);n.emissive=new THREE.Color(0xffd6f5);n.emissiveIntensity=.12;return n;});
    g.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(obj);
    const horn=new THREE.Mesh(new THREE.ConeGeometry(.06,.45,12),new THREE.MeshStandardMaterial({color:0xffd54f,metalness:.8,roughness:.25,emissive:0xffb300,emissiveIntensity:.3}));
    horn.position.set(0,bb.max.y-.02,bb.max.z-.3);horn.rotation.x=.55;horn.castShadow=true;g.add(horn);g.userData.horn=horn;}
  if(tint!==null){const hsl={};remat(m=>{const n=m.clone();n.color.getHSL(hsl);const tc=new THREE.Color(tint);
    if(gold){n.color.copy(tc).multiplyScalar(.6+hsl.l);n.metalness=.75;n.roughness=.3;n.emissive=new THREE.Color(0x5a3c00);n.emissiveIntensity=.35;}
    else if((hsl.h<.08||hsl.h>.9)&&hsl.s>.2){n.color.copy(tc).multiplyScalar(.45+hsl.l*1.2);}return n;});}
  const mixer=new THREE.AnimationMixer(obj);const anims=T.g.animations;const clip=n=>anims.find(a=>a.name===n)||anims.find(a=>a.name.toLowerCase().includes(n.toLowerCase()));
  const w=clip(walk)||clip('fly')||anims[0],i=clip(idle)||clip('fly')||anims[0];
  const walkA=mixer.clipAction(w),idleA=mixer.clipAction(i);idleA.play();mixer.update(rand(0,2));return {g,obj,mixer,walk:walkA,idle:idleA,moving:false};}
const makeAnimal=t=>{const D_=ANIMALS[t];return makeCreature(D_.f,D_.h,{walk:D_.walk,idle:D_.idle,uni:D_.uni});};
const animalObjs=[];
function capacity(){return S.pens*4;}
function placeAnimals(){S.animals.forEach((a,i)=>{if(i>=capacity()||animalObjs.find(o=>o.a===a))return;const pen=Math.floor(i/4);const [px,pz]=penPos(pen);
    const m=makeAnimal(a.t);m.g.position.set(px+rand(-2.3,2.3),0,pz+rand(-2.3,2.3));m.g.rotation.y=rand(0,6.28);scene.add(m.g);
    const ic=emoji(ANIMALS[a.t].prod.e,.8);ic.position.y=ANIMALS[a.t].h+.7;ic.visible=false;m.g.add(ic);
    const fed=emoji('💖',.55);fed.position.y=ANIMALS[a.t].h+.35;fed.visible=false;m.g.add(fed);
    animalObjs.push({a,m,ic,fed,pen,tx:px,tz:pz,wait:rand(0,3)});});}
function setMove(m,mv){if(m.moving===mv)return;m.moving=mv;const on=mv?m.walk:m.idle,off=mv?m.idle:m.walk;if(on===off)return;on.reset().fadeIn(.25).play();off.fadeOut(.25);}

/* ================= COMPANION PET ================= */
let pet=null;
function spawnPet(){if(pet){scene.remove(pet.m.g);pet=null;}if(!S.pet||!PETS[S.pet])return;const P=PETS[S.pet];
  const m=P.f==='pug'?makeCreature('pug',P.h):makeCreature(P.f,P.h,{walk:P.fly?'Flying':'Walk',idle:P.fly?'Flying':'Idle',tint:P.tint??null,gold:!!P.gold});
  m.g.position.set(player.pos.x+1.5,0,player.pos.z+1);scene.add(m.g);
  const hearts=emoji('💕',.7);hearts.position.y=P.h+.6;hearts.visible=false;m.g.add(hearts);
  pet={m,P,hearts,ht:0,coinT:rand(30,50)};}
const petHas=id=>S.pet===id||(S.pet==='dragonaur');
const petIsDragon=()=>S.pet&&PETS[S.pet].f==='dragon';

/* ================= EGGS IN WORLD ================= */
function eggTex(base,dot){const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');g.fillStyle=base;g.fillRect(0,0,128,128);g.fillStyle=dot;for(let i=0;i<26;i++){g.beginPath();g.arc(Math.random()*128,Math.random()*128,rand(3,9),0,7);g.fill();}const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;}
const eggMats=[['#ffd6e8','#ff6fa8'],['#d6f0ff','#3fa9f5'],['#e8ffd6','#43b047'],['#f3e3ff','#9c5cff'],['#fff4c2','#ff8a3d']].map(([a,b])=>new THREE.MeshPhysicalMaterial({map:eggTex(a,b),roughness:.35,clearcoat:.8,emissive:0x222222}));
const goldMat=new THREE.MeshStandardMaterial({color:0xffd54f,metalness:.95,roughness:.18,emissive:0x6a4600,emissiveIntensity:.4});
const beamGeo=new THREE.CylinderGeometry(.3,.45,10,12,1,true);
const worldEggs=[];
function maxEggs(){return 16+(S.own.cos?7:0)+(petHas('liliac')?6:0);}
function spawnEgg(){for(let k=0;k<40;k++){const a=rand(0,6.28),mnt=Math.random()<.25,r=mnt?rand(225,285):rand(65,215);const x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(nearFriend(x,z,18)||inLake(x,z,3))continue;const y=H(x,z);if(y>44)continue;
  const gold=(mnt&&Math.random()<.35)||Math.random()<.04;const g=new THREE.Group();g.position.set(x,y,z);
  const e=E(SPH,gold?goldMat:pick(eggMats),0,.55,0,.3,.4,.3,g);
  const beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:gold?0xffd54f:0xfff8e0,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.position.y=5;g.add(beam);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.45,.7,32),new THREE.MeshBasicMaterial({color:gold?0xffd54f:0xfff3a8,transparent:true,opacity:.7,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.05;g.add(ring);
  scene.add(g);worldEggs.push({g,e,x,z,gold,t:rand(0,6)});return;}}
for(let i=0;i<maxEggs();i++)spawnEgg();

/* ================= FRIEND FARMS (BOTS) ================= */
const friendObjs=[];
FRIENDS.forEach(f=>{
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
  const pets=['vaca','oaie','porc','cal','catel'];const petA=makeAnimal(pets[FRIENDS.indexOf(f)%pets.length]);petA.g.position.set(f.x-6,0,f.z+5);scene.add(petA.g);
  friendObjs.push({f,ch:null,loading:false,plots,tx:f.x,tz:f.z+4,wait:0,pet:petA,pos:new THREE.Vector3(f.x,0,f.z+4),rot:0});
});

/* ================= INPUT ================= */
const keys={};
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){doJump();e.preventDefault();}if(e.code==='KeyE')doAction();if(e.code==='KeyF')toggleVehicle();});
addEventListener('keyup',e=>keys[e.code]=false);
const joyEl=$('#joy'),knob=$('#knob');
const joy={id:null,ox:0,oy:0,vx:0,vy:0}, drag={id:null,x:0,y:0};
let camYaw=0, camPitch=.3, camDist=4.2;
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
canvas.addEventListener('wheel',e=>{if(arrange.on){arrange.h=clamp(arrange.h+e.deltaY*.03,14,80);return;}camDist=clamp(camDist+e.deltaY*.01,3,14);},{passive:true});
$('#jump').addEventListener('pointerdown',e=>{e.preventDefault();doJump();});
$('#act').addEventListener('pointerdown',e=>{e.preventDefault();doAction();});
$('#veh').addEventListener('pointerdown',e=>{e.preventDefault();toggleVehicle();});
$('#bShop').onclick=()=>openShop(shopTab);$('#bLook').onclick=()=>openLook('ch');$('#bBag').onclick=openBag;$('#bArr').onclick=enterArrange;$('#bOrd').onclick=()=>{if(S.own.comenzi)openOrders();else toast('Construiește Panoul de comenzi (Magazin → Clădiri) 📋');};
function doJump(){if(player.veh||arrange.on)return;if(player.ground){player.vy=7.6;player.ground=false;sfx.jump();}}

/* ================= HUD ================= */
function toast(msg){const d=document.createElement('div');d.className='t';d.textContent=msg;$('#toast').appendChild(d);setTimeout(()=>d.remove(),2400);while($('#toast').children.length>3)$('#toast').firstChild.remove();}
function hud(){$('#coins').textContent=S.coins;$('#eggs').textContent=S.eggs+S.gold;$('#ani').textContent=S.animals.length;$('#lv').textContent=S.lv;
  $('#xpI').style.width=Math.min(100,S.xp/D.xpFor(S.lv)*100)+'%';$('#bOrd').classList.toggle('dim',!S.own.comenzi);}
function happy(){if(pch)pch.happy=1.3;}
function addXP(n){S.xp+=n;let up=false;while(S.xp>=D.xpFor(S.lv)){S.xp-=D.xpFor(S.lv);S.lv++;up=true;}
  if(up){sfx.lvl();happy();const gift=20+S.lv*10;S.coins+=gift;S.eggs++;
    const news=[...Object.values(CROPS).filter(c=>c.lv===S.lv).map(c=>c.e+' '+c.n),...Object.values(BUILD).filter(c=>c.lv===S.lv).map(c=>c.e+' '+c.n),...Object.values(FACTORIES).filter(c=>c.lv===S.lv).map(c=>c.e+' '+c.n),...Object.values(TREES).filter(c=>c.lv===S.lv).map(c=>c.e+' '+c.n),...Object.values(PETS).filter(c=>c.lv===S.lv).map(c=>c.e+' '+c.n),...FARM_LEVELS.filter(f=>f.lv===S.lv&&f.cost).map(()=> '🌍 Extinderea fermei')];
    openModal(`<h2>⭐ Nivelul ${S.lv}!</h2><div class="egg-big">🎉</div><p style="text-align:center">Cadou: <b>+${gift} 🪙</b> și <b>1 🥚 ou misterios</b></p>${news.length?`<h3>Ai deblocat:</h3><p>${news.join(' · ')}</p>`:''}<div style="text-align:center"><button class="big" data-close>Super! 🚀</button></div>`);}
  hud();}
function quest(){const s=S.st;
  if(!s.plant)return'🌱 Mergi la parcelele maro și plantează un morcov';
  if(!s.harv)return'⏳ Așteaptă să crească ✨ și recoltează';
  if(!s.sold)return'💰 Du legumele la Piață și vinde-le';
  if(!s.eggs)return'🥚 Caută un ou misterios în pădure (lumina din depărtare)';
  if(!s.hatch)return'✨ Deschide oul la Cuibul magic';
  if(S.lv>=2&&!S.own.comenzi)return'📋 Construiește Panoul de comenzi (Magazin → Clădiri)';
  if(S.own.comenzi&&!s.orders)return'📋 Livrează o comandă de la Panoul de comenzi';
  if(!s.help)return'🤝 Mergi pe potecă la un prieten și ajută-l la fermă';
  if(S.lv>=2&&!S.own.pusculita)return'🐖 Construiește Pușculița — face bani singură';
  if(S.lv>=3&&!S.own.f_furaje)return'🏭 Construiește Fabrica de furaje';
  if(S.lv>=4&&!S.own.f_brutarie)return'🥖 Construiește Brutăria';
  if(!S.pet&&S.lv>=2)return'🐉 Adoptă un companion (Magazin → Companioni)';
  const n=Object.keys(S.seen).length,N=Object.keys(ANIMALS).length;return n<N?`🌍 Colecția de animale: ${n}/${N} · Nivel ${S.lv}`:`🏆 Super fermier! Nivel ${S.lv}`;}

/* ================= INVENTORY ================= */
const ITEM={};
for(const [k,c] of Object.entries(CROPS))ITEM[k]={e:c.e,n:c.n,v:c.v};
for(const a of Object.values(ANIMALS))ITEM[a.prod.id]={e:a.prod.e,n:a.prod.n,v:a.prod.v};
for(const [k,g] of Object.entries(GOODS))ITEM[k]=g;
for(const [k,t] of Object.entries(TREES))ITEM[k]={e:t.e,n:t.n==='Măr'?'Mere':t.n==='Cireș'?'Cireșe':t.n==='Păr'?'Pere':'Portocale',v:t.v};
for(const f of FISH)ITEM[f.id]=f;
const itemInfo=k=>ITEM[k]||{e:'📦',n:k,v:1};
const invTotal=()=>Object.values(S.inv).reduce((a,b)=>a+b,0);
const invCap=()=>60+40*S.up.hambarCap;
function canStore(n){if(invTotal()+n<=invCap())return true;toast('📦 Hambarul e plin! Vinde lucruri sau mărește-l (Magazin → Îmbunătățiri)');sfx.no();return false;}
function addInv(k,n){S.inv[k]=(S.inv[k]||0)+n;}
function have(need){return Object.entries(need).every(([k,q])=>(S.inv[k]||0)>=q);}
function take(need){for(const [k,q] of Object.entries(need)){S.inv[k]-=q;if(S.inv[k]<=0)delete S.inv[k];}}

/* ================= MODALS ================= */
let modalOn=false;
const modal=$('#modal'), box=$('#box');
function openModal(html,sheet=false){box.innerHTML='<button class="x" data-close>✕</button>'+html;modal.classList.toggle('sheet',sheet);modal.classList.add('on');modalOn=true;joy.id=null;joy.vx=joy.vy=0;joyHome();}
function closeModal(){modal.classList.remove('on');modalOn=false;if(lookOpen&&pch)setLayers(pch,false);lookOpen=false;document.body.classList.remove('looking');curFac=null;}
modal.addEventListener('pointerdown',e=>{if(e.target===modal)closeModal();});
box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if('close' in d)return closeModal();
  if(d.tab)return openShop(d.tab);
  if(d.buy)return buy(d.buy);
  if(d.look)return setLook(d.look);
  if(d.ltab)return openLook(d.ltab);
  if(d.hatch)return doHatch(d.hatch==='gold');
  if(d.make)return makeGood(d.make);
  if(d.collect)return collectFactory(d.collect);
  if(d.ord)return deliverOrder(+d.ord);
  if(d.drop)return dropOrder(+d.drop);
  if(d.sell)return sellOne(d.sell);
  if(d.pet)return setPet(d.pet);});
const lockedLv=lv=>S.lv<lv;
function itemRow(em,name,desc,btnLabel,data,disabled){return `<div class="item"><div class="em">${em}</div><div class="info"><b>${name}</b><small>${desc}</small></div><button class="buy" data-buy="${data}" ${disabled?'disabled':''}>${btnLabel}</button></div>`;}
const lvBtn=(lv,own,cost)=>own?'✔ Ai':lockedLv(lv)?`🔒 Nivel ${lv}`:cost+' 🪙';
let shopTab='parcele';
function openShop(tab){shopTab=tab;const T_={parcele:'🌱 Câmp',cladiri:'🏠 Clădiri',fabrici:'🏭 Fabrici',pomi:'🌳 Pomi',decor:'🌷 Decor',animale:'🐾 Țarcuri',comp:'🐉 Companioni',unelte:'🧰 Unelte',vehicule:'🚜 Vehicule',upg:'⬆️ Îmbunătățiri'};
  let h=`<h2>🛒 Magazin <small style="font-size:16px">— ${S.coins} 🪙 · ⭐ Nivel ${S.lv}</small></h2><div class="tabs">${Object.entries(T_).map(([k,v])=>`<button class="tab ${k===tab?'on':''}" data-tab="${k}">${v}</button>`).join('')}</div>`;
  if(tab==='parcele'){h+=S.unl<maxPlots()?itemRow('🟫','Parcelă nouă',`Ai ${S.unl}/${maxPlots()} parcele`,plotCost()+' 🪙','plot',S.coins<plotCost()):`<p>Ai toate parcelele din ${S.fields} ${S.fields>1?'câmpuri':'câmp'}.</p>`;
    const FL=FARM_LEVELS[S.farmLv+1];
    if(S.fields<FARM_LEVELS[S.farmLv].fields)h+=itemRow('🌾','Câmp nou (16 parcele)','Un câmp întreg pe care îl poți muta unde vrei',(150*S.fields)+' 🪙','field',S.coins<150*S.fields);
    h+=FL?itemRow('🌍',`Extinde ferma (nivel ${S.farmLv+2})`,`Ferma devine mai mare, cu loc de ${FL.fields} câmpuri și ${FL.pens} țarcuri`,lvBtn(FL.lv,false,FL.cost),'farm',lockedLv(FL.lv)||S.coins<FL.cost):'<p>🌍 Ferma ta e la mărimea maximă!</p>';
    h+='<h3>Semințe (le plătești când plantezi)</h3>'+Object.values(CROPS).map(c=>`<div class="item"><div class="em">${c.e}</div><div class="info"><b>${c.n}</b><small>${lockedLv(c.lv)?`🔒 de la nivelul ${c.lv} · `:''}Sămânță ${c.cost}🪙 · crește ${c.t}s · vinzi ${c.v}🪙/buc</small></div></div>`).join('');}
  if(tab==='cladiri')h+=Object.entries(BUILD).map(([k,b])=>itemRow(b.e,b.n,b.d2,lvBtn(b.lv,S.own[k],b.cost),'b:'+k,S.own[k]||lockedLv(b.lv)||S.coins<b.cost)).join('');
  if(tab==='fabrici')h+='<p>Fabricile transformă ce crești în produse scumpe. Le folosești de lângă ele.</p>'+Object.entries(FACTORIES).map(([k,f])=>itemRow(f.e,f.n,f.rec.map(r=>itemInfo(r.out).e+' '+itemInfo(r.out).n).join(', '),lvBtn(f.lv,S.own['f_'+k],f.cost),'f:'+k,S.own['f_'+k]||lockedLv(f.lv)||S.coins<f.cost)).join('');
  if(tab==='pomi')h+='<p>Pomii fac fructe iar și iar. Îi poți planta oriunde în fermă.</p>'+Object.entries(TREES).map(([k,t])=>itemRow(t.e,'Pom: '+t.n,`Fructe la ${t.t}s · ${t.v}🪙 bucata`,lockedLv(t.lv)?`🔒 Nivel ${t.lv}`:t.cost+' 🪙','t:'+k,lockedLv(t.lv)||S.coins<t.cost)).join('');
  if(tab==='decor')h+='<p>Decorațiuni pe care le aranjezi cum vrei (🏗️).</p>'+Object.entries(DECOR).map(([k,d])=>itemRow(d.e,d.n,`Ai ${S.decor.filter(x=>x.id===k).length}`,lockedLv(d.lv)?`🔒 Nivel ${d.lv}`:d.cost+' 🪙','d:'+k,lockedLv(d.lv)||S.coins<d.cost)).join('');
  if(tab==='animale'){const maxP=FARM_LEVELS[S.farmLv].pens;h+=`<p>Fiecare țarc are loc pentru 4 animale. Ai ${S.pens}/${maxP} țarcuri (${S.animals.length}/${capacity()} animale). Extinde ferma pentru mai multe țarcuri.</p>`;
    h+=S.pens<maxP?itemRow('🐾','Țarc nou','Încă 4 locuri pentru animale',PEN_COST[S.pens]+' 🪙','pen',S.coins<PEN_COST[S.pens]):'<p>Nu mai e loc de țarcuri — extinde ferma 🌍</p>';}
  if(tab==='comp'){h+='<p>Companionul te urmează peste tot și te ajută. Poți schimba companionul oricând.</p>'+Object.entries(PETS).map(([k,p])=>{const own=S.pets[k];const act=S.pet===k;
      return `<div class="item"><div class="em">${p.e}</div><div class="info"><b>${p.n}</b><small>${p.bonus}</small></div>${own?`<button class="buy" data-pet="${k}" ${act?'disabled':''}>${act?'✔ Cu tine':'Ia-l cu tine'}</button>`:`<button class="buy" data-buy="p:${k}" ${lockedLv(p.lv)||S.coins<p.cost?'disabled':''}>${lockedLv(p.lv)?'🔒 Nivel '+p.lv:p.cost+' 🪙'}</button>`}</div>`;}).join('')+'<p style="font-size:13px;opacity:.75">🌟 Ouăle de aur pot ascunde un pui de dragon!</p>';}
  if(tab==='unelte')h+=Object.entries(TOOLS).map(([k,b])=>itemRow(b.e,b.n,b.d,lvBtn(b.lv,S.own[k],b.cost),'t2:'+k,S.own[k]||lockedLv(b.lv)||S.coins<b.cost)).join('');
  if(tab==='vehicule')h+=Object.entries(VEH).map(([k,b])=>itemRow(b.e,b.n,b.d,lvBtn(b.lv,S.own[k],b.cost),'v:'+k,S.own[k]||lockedLv(b.lv)||S.coins<b.cost)).join('');
  if(tab==='upg')h+=Object.entries(UPGRADES).map(([k,u])=>{const l=S.up[k];const need=k==='pusculita'&&!S.own.pusculita;const max=l>=u.max;const c=u.cost(l+(k==='pusculita'?0:1));
      return itemRow(u.e,`${u.n} · nivel ${l}`,`Acum: ${u.d(l)}${max?'':' → '+u.d(l+1)}`,max?'MAX':need?'Construiește-o':c+' 🪙','u:'+k,max||need||S.coins<c);}).join('');
  openModal(h);}
function pay(c){if(S.coins<c){toast('Nu ai destule monede 🪙');sfx.no();return false;}S.coins-=c;sfx.coin();hud();return true;}
function buy(what,fromWorld){
  const [k,id]=what.split(':');
  if(what==='plot'){if(S.unl>=maxPlots()||!pay(plotCost()))return;S.unl++;refreshPlot(S.unl-1);toast('🟫 Parcelă nouă!');addXP(2);}
  else if(what==='field'){if(S.fields>=FARM_LEVELS[S.farmLv].fields||!pay(150*S.fields))return;S.fields++;while(S.plots.length<maxPlots())S.plots.push({c:null,p:0});addField(S.fields-1);rebuildFarmGrass();toast('🌾 Câmp nou! Îl poți muta cu 🏗️');addXP(10);}
  else if(what==='farm'){const FL=FARM_LEVELS[S.farmLv+1];if(!FL||lockedLv(FL.lv)||!pay(FL.cost))return;S.farmLv++;buildFarmFence();toast('🌍 Ferma ta a crescut!');addXP(25);}
  else if(what==='pen'){if(S.pens>=FARM_LEVELS[S.farmLv].pens||!pay(PEN_COST[S.pens]))return;addPen(S.pens);S.pens++;placeAnimals();rebuildFarmGrass();toast('🐾 Țarc nou construit!');addXP(5);}
  else if(k==='b'){const b=BUILD[id];if(S.own[id]||lockedLv(b.lv)||!pay(b.cost))return;S.own[id]=true;if(id==='pusculita'&&!S.up.pusculita)S.up.pusculita=1;addBuilding(id);rebuildFarmGrass();toast(b.e+' '+b.n+' — construit!');addXP(8);happy();}
  else if(k==='f'){const f=FACTORIES[id];if(S.own['f_'+id]||lockedLv(f.lv)||!pay(f.cost))return;S.own['f_'+id]=true;S.fac[id]={q:[],done:[]};addFactory(id);rebuildFarmGrass();toast(f.e+' '+f.n+' — construită!');addXP(15);happy();}
  else if(k==='t'){const t=TREES[id];if(lockedLv(t.lv)||!pay(t.cost))return;const key='t:'+id+'#'+(S.dn++);S.trees[key]={t:id,p:0};addFruitTree(key);rebuildFarmGrass();toast(t.e+' Pom plantat! Îl poți muta cu 🏗️');addXP(5);}
  else if(k==='d'){const d=DECOR[id];if(lockedLv(d.lv)||!pay(d.cost))return;const key='d:'+id+'#'+(S.dn++);S.decor.push({id,key});addDecor(id,key);rebuildFarmGrass();toast(d.e+' '+d.n+' — pune-l unde vrei cu 🏗️');addXP(2);}
  else if(k==='t2'){const t=TOOLS[id];if(S.own[id]||lockedLv(t.lv)||!pay(t.cost))return;S.own[id]=true;if(id==='cos')while(worldEggs.length<maxEggs())spawnEgg();toast(t.e+' '+t.n+' — cumpărat!');}
  else if(k==='v'){const v=VEH[id];if(S.own[id]||lockedLv(v.lv)||!pay(v.cost))return;S.own[id]=true;spawnVehicle(id);toast(v.e+' '+v.n+' — e al tău!');addXP(10);}
  else if(k==='p'){const p=PETS[id];if(S.pets[id]||lockedLv(p.lv)||!pay(p.cost))return;S.pets[id]=true;setPet(id,true);toast(p.e+' '+p.n+' e acum companionul tău!');addXP(10);}
  else if(k==='u'){const u=UPGRADES[id];const l=S.up[id];if(l>=u.max)return;const c=u.cost(l+(id==='pusculita'?0:1));if(!pay(c))return;S.up[id]++;toast(u.e+' '+u.n+' — nivel '+S.up[id]);addXP(5);}
  refreshLocks();save();hud();if(!fromWorld&&modalOn&&!lookOpen)openShop(shopTab);}
function setPet(id,silent){S.pet=id;spawnPet();save();if(!silent&&modalOn)openShop('comp');}
function openBag(){
  const inv=Object.entries(S.inv).filter(([,n])=>n>0);
  let h=`<h2>🎒 Hambarul meu <small style="font-size:15px">— ${invTotal()}/${invCap()}</small></h2><p>🪙 ${S.coins} · 🥚 ${S.eggs} ouă · 🌟 ${S.gold} ouă de aur · ⭐ nivel ${S.lv}</p>`;
  h+=inv.length?inv.map(([k,n])=>{const it=itemInfo(k);return `<div class="item"><div class="em">${it.e}</div><div class="info"><b>${it.n} × ${n}</b><small>${it.v}🪙 bucata</small></div><button class="buy" data-sell="${k}">Vinde 1</button></div>`;}).join(''):'<p>Hambarul e gol. Recoltează legume sau strânge produse de la animale!</p>';
  h+=`<h3>🐾 Animalele mele (${S.animals.length}/${capacity()} locuri)</h3>`;
  if(S.animals.length>capacity())h+=`<p>⚠️ ${S.animals.length-capacity()} animale așteaptă un țarc nou!</p>`;
  h+='<h3>📖 Colecția</h3><div class="coll">'+Object.entries(ANIMALS).map(([k,a])=>{const n=S.animals.filter(x=>x.t===k).length;return `<div class="${S.seen[k]?'':'no'}"><span>${a.e}</span>${S.seen[k]?a.n+(n?' ×'+n:''):'???'}</div>`;}).join('')+'</div>';
  openModal(h);}
function sellOne(k){if(!S.inv[k])return;const v=Math.round(itemInfo(k).v*(S.own.moara?1.2:1));S.inv[k]--;if(!S.inv[k])delete S.inv[k];S.coins+=v;sfx.coin();hud();save();openBag();}

/* ---------- look / dressing room ---------- */
function openLook(tab='ch'){lookOpen=true;if(pch)setLayers(pch,true);const L=S.look;
  const tabs={ch:'🧑 Personaj',cl:'👗 Haine',hair:'💇 Păr',acc:'🎀 Accesorii'};
  let h=`<h2>👗 Cabina de probă</h2><div class="tabs">${Object.entries(tabs).map(([k,v])=>`<button class="tab ${k===tab?'on':''}" data-ltab="${k}">${v}</button>`).join('')}</div>`;
  if(tab==='ch')h+='<div class="chars">'+Object.entries(CHARS).map(([k,c])=>`<button class="chr ${L.ch===k?'on':''} ${S.chars[k]?'':'lock'}" data-look="c:${k}"><img src="${A}ui/${k}.jpg" alt="${c.n}">${c.n}<small>${S.chars[k]?c.d:'🔒 '+c.cost+'🪙'}</small></button>`).join('')+'</div>';
  if(tab==='cl')h+='<p>Alege culoarea hainelor pentru personajul tău.</p><div class="grid">'+OUTFIT_COLORS.map((o,i)=>`<button class="opt ${L.cloth===i?'on':''}" data-look="o:${i}"><span class="sw2" style="background:${o.c===null?'linear-gradient(45deg,#ffd6e8,#d6f0ff)':o.c===-1?'#222':`hsl(${o.c} 70% 55%)`}"></span>${o.n}<br>${S.cloths[i]?'':'🔒 '+o.cost+'🪙'}</button>`).join('')+'</div>';
  if(tab==='hair'){h+='<h3>Coafură</h3><div class="chars">'+Object.entries(CHARS).map(([k,c])=>`<button class="chr ${(L.hair||L.ch)===k?'on':''}" data-look="h:${k}"><img src="${A}ui/${k}.jpg" alt="${c.n}" style="object-position:50% 8%;aspect-ratio:1">Părul lui ${c.n}</button>`).join('')+'</div>';
    h+='<h3>Culoare păr</h3><div class="row">'+HAIR_COLORS.map((c,i)=>`<button class="sw ${L.hc===i?'on':''}" title="${c.n}" style="background:${c.c?'#'+c.c.toString(16).padStart(6,'0'):'#fff'}" data-look="t:${i}">${c.c?'':'✨'}</button>`).join('')+'</div>';}
  if(tab==='acc'){const grid=(title,set,own,cur,p)=>`<h3>${title}</h3><div class="grid">`+Object.entries(set).map(([k,a])=>`<button class="opt ${cur===k?'on':''}" data-look="${p}:${k}"><span class="em">${a.e}</span>${a.n}<br>${own[k]?'':'🔒 '+a.cost+'🪙'}</button>`).join('')+'</div>';
    h+=grid('Pe cap',ACCS,S.accs,L.acc,'a')+grid('Ochelari',FACES,S.faces,L.face,'f')+grid('Pe spate',BACKS,S.backs,L.back,'b');}
  openModal(h,true);lookOpen=true;document.body.classList.add('looking');box.dataset.ltab=tab;}
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

/* ---------- eggs / nest ---------- */
function openEggs(){
  openModal(`<h2>✨ Cuibul magic</h2><p>Fiecare ou are <b>60%</b> șanse să fie un animal și <b>40%</b> să fie gol. Ouăle de aur aduc animale mai rare — și poate chiar un pui de dragon!</p>
  <div class="egg-big" id="eggShow">🥚</div><div class="row" style="justify-content:center">
  <button class="big" data-hatch="normal" ${S.eggs?'':'disabled'}>🥚 Deschide (${S.eggs})</button>
  <button class="big" style="background:#e0a800" data-hatch="gold" ${S.gold?'':'disabled'}>🌟 Ou de aur (${S.gold})</button></div>
  <p style="text-align:center;font-size:14px;opacity:.75">Ouăle le găsești în pădure și la munte — caută luminițele!</p>`);}
let hatching=false;
function doHatch(gold){if(hatching)return;if(gold?!S.gold:!S.eggs)return;hatching=true;if(gold)S.gold--;else S.eggs--;hud();
  const show=$('#eggShow');show.innerHTML=`<span class="wob">${gold?'🌟':'🥚'}</span>`;snd(500,.1,'triangle');
  setTimeout(()=>{S.st.hatch++;addXP(gold?10:4);
    if(gold&&!S.pets.dragon&&Math.random()<.15){S.pets.dragon=true;show.innerHTML='🐉<div style="font-size:22px">WOW! Un <b>pui de dragon</b>!<br><small>E companionul tău acum</small></div>';sfx.hatch();setPet('dragon',true);happy();}
    else{let r;if(Math.random()<.4)r=null;else{const ws=Object.entries(ANIMALS).map(([k,a])=>[k,gold&&a.w<=10?a.w*4:a.w]);let tot=ws.reduce((s,[,w])=>s+w,0),x=Math.random()*tot;for(const [k,w] of ws){x-=w;if(x<=0){r=k;break;}}r=r||'gaina';}
      if(!r){show.innerHTML='🐣<div style="font-size:22px">Oul a fost gol… 😅<br>Mai încearcă!</div>';sfx.sad();}
      else{const An=ANIMALS[r];const isNew=!S.seen[r];S.seen[r]=true;S.animals.push({t:r,id:S.aid++,pt:0,rd:false});const over=S.animals.length>capacity();
        show.innerHTML=`${An.e}<div style="font-size:22px">${isNew?'🆕 ':''}Ai primit: <b>${An.n}</b>!${over?'<br><small>⚠️ Ai nevoie de un țarc nou pentru el</small>':''}</div>`;sfx.hatch();happy();placeAnimals();}}
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
function makeGood(v){const [id,i]=v.split(':');const F=FACTORIES[id],r=F.rec[+i],st=S.fac[id];if(st.q.length>=slots()||!have(r.need))return;take(r.need);st.q.push({r:+i,t:r.t});sfx.plant();save();openFactory(id);}
function collectFactory(id){const st=S.fac[id];if(!st.done.length)return;if(!canStore(st.done.length))return;let xp=0;for(const o of st.done){addInv(o,1);xp+=4;}toast(`${st.done.map(o=>itemInfo(o).e).join('')} în hambar!`);S.st.made+=st.done.length;st.done=[];sfx.pick();happy();addXP(xp);save();if(curFac===id&&modalOn)openFactory(id);}

/* ---------- orders ---------- */
function orderPool(){const ids=Object.entries(CROPS).filter(([,c])=>c.lv<=S.lv).map(([k])=>k);
  for(const a of Object.values(ANIMALS))if(S.seen[Object.keys(ANIMALS).find(k=>ANIMALS[k]===a)])ids.push(a.prod.id);
  for(const [k,f] of Object.entries(FACTORIES))if(S.own['f_'+k])for(const r of f.rec)ids.push(r.out);
  for(const t of Object.values(S.trees))ids.push(t.t);if(S.own.undita)ids.push('biban','caras');return [...new Set(ids)];}
function newOrder(){const pool=orderPool();const n=1+Math.floor(Math.random()*Math.min(3,1+S.lv/3));const items={};
  for(let i=0;i<n;i++){const k=pick(pool);const v=itemInfo(k).v;items[k]=(items[k]||0)+Math.max(1,Math.round(rand(2,6)*(v<12?1.5:v<40?.8:.4)));}
  const val=Object.entries(items).reduce((s,[k,q])=>s+itemInfo(k).v*q,0);
  return {items,coins:Math.round(val*rand(1.35,1.7)),xp:Math.round(4+val/6),wait:0,who:pick(['Bunica','Brutarul','Ana','Luca','Sofia','Matei','Ioana','Doamna Florica','Moș Ion'])};}
function fillOrders(){while(S.orders.length<6)S.orders.push(newOrder());}
function openOrders(){fillOrders();let h='<h2>📋 Comenzi</h2><p>Strânge ce cer oamenii și primești monede și ⭐.</p>';
  h+=S.orders.map((o,i)=>{if(o.wait>0)return `<div class="item"><div class="em">⏳</div><div class="info"><b>Comandă nouă în curând</b><small>${fmtTime(o.wait)}</small></div></div>`;
    const ok=have(o.items);return `<div class="item"><div class="em">📦</div><div class="info"><b>${o.who}: ${Object.entries(o.items).map(([k,q])=>`${itemInfo(k).e}×${q}`).join(' ')}</b><small>${Object.entries(o.items).map(([k,q])=>`${itemInfo(k).n} ${S.inv[k]||0}/${q}`).join(' · ')} · ⭐+${o.xp}</small></div><button class="buy" data-ord="${i}" ${ok?'':'disabled'}>+${o.coins} 🪙</button><button class="buy" style="background:#ff6b6b;min-width:40px" data-drop="${i}">✕</button></div>`;}).join('');
  openModal(h);}
function deliverOrder(i){const o=S.orders[i];if(!o||o.wait>0||!have(o.items))return;take(o.items);S.coins+=o.coins;S.st.orders++;toast(`📦 Comandă livrată: +${o.coins} 🪙`);sfx.coin();happy();addXP(o.xp);S.orders[i]=Object.assign(newOrder(),{wait:12});save();hud();if(modalOn)openOrders();}
function dropOrder(i){S.orders[i]=Object.assign(newOrder(),{wait:30});save();openOrders();}

/* ---------- fishing ---------- */
const fish={on:false,phase:'',t:0,bob:null,L:null};
function startFish(L){if(fish.on)return;fish.on=true;fish.phase='wait';fish.t=rand(2,5);fish.L=L;
  const dx=L.x-player.pos.x,dz=L.z-player.pos.z,d=Math.hypot(dx,dz);player.face=Math.atan2(dx,dz);
  const bob=new THREE.Group();E(SPH,mat(0xff3b3b,{roughness:.4}),0,0,0,.12,.12,.12,bob);E(SPH,mat(0xffffff),0,.09,0,.08,.06,.08,bob);
  bob.position.set(player.pos.x+dx/d*4,-.5,player.pos.z+dz/d*4);scene.add(bob);fish.bob=bob;toast('🎣 Așteaptă să tragă peștele…');}
function endFish(){if(fish.bob)scene.remove(fish.bob);fish.on=false;fish.phase='';fish.bob=null;}
function updateFish(dt){if(!fish.on)return;fish.t-=dt;const b=fish.bob;
  if(Math.hypot(player.pos.x-fish.L.x,player.pos.z-fish.L.z)>fish.L.r+6){endFish();return;}
  if(fish.phase==='wait'){b.position.y=-.5+Math.sin(T*3)*.03;if(fish.t<=0){fish.phase='bite';fish.t=1.6;snd(900,.1,'square',.06);}}
  else if(fish.phase==='bite'){b.position.y=-.62+Math.sin(T*30)*.07;if(fish.t<=0){toast('🐟 A scăpat! Mai încearcă.');sfx.sad();endFish();}}}
function catchFish(){if(fish.phase!=='bite'){toast('Încă nu! Așteaptă să se miște dopul');endFish();return;}
  const tot=FISH.reduce((s,f)=>s+f.w,0);let x=Math.random()*tot,f=FISH[0];for(const F of FISH){x-=F.w;if(x<=0){f=F;break;}}
  if(canStore(1)){addInv(f.id,1);S.st.fish++;toast(`${f.e} Ai prins: ${f.n}!`);sfx.pick();happy();addXP(f.v>20?6:3);}endFish();save();}

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
  if(PL['b:pusculita']&&near(PL['b:pusculita'],1.3))consider(.7,{t:'pig'},9);
  if(PL['b:comenzi']&&near(PL['b:comenzi'],1.3))consider(.7,{t:'orders'},9);
  for(const k in S.trees){const o=PL[k];if(o&&S.trees[k].p>=1)consider(Math.hypot(p.x-o.x,p.z-o.z),{t:'tree',k},2.6);}
  for(const k in locks){const L=locks[k];consider(Math.hypot(p.x-L.x,p.z-L.z),{t:'lock',k},2.4);}
  for(const o of animalObjs){const d=Math.hypot(p.x-o.m.g.position.x,p.z-o.m.g.position.z);if(o.a.rd&&!S.own.hambar)consider(d,{t:'animal',o},2.4);}
  for(let i=0;i<S.pens;i++){const [x,z]=penPos(i);if(S.inv.hrana&&animalObjs.some(o=>o.pen===i&&!o.a.fed))consider(Math.hypot(p.x-x,p.z-z)+1.2,{t:'feed',pen:i},7.2);}
  for(const fo of friendObjs)for(const pl of fo.plots)if(pl.need)consider(Math.hypot(p.x-pl.x,p.z-pl.z),{t:'help',fo,pl},2.2);
  if(!player.veh)for(const id in vehicles)consider(Math.hypot(p.x-vehicles[id].position.x,p.z-vehicles[id].position.z),{t:'veh',id},2.6);
  for(const fo of friendObjs)consider(Math.hypot(p.x-fo.pos.x,p.z-fo.pos.z),{t:'talk',fo},2);
  if(pet&&!player.veh)consider(Math.hypot(p.x-pet.m.g.position.x,p.z-pet.m.g.position.z)+.4,{t:'pet'},2.2);
  if(S.own.undita&&!player.veh)for(const L of LAKES){const d=Math.hypot(p.x-L.x,p.z-L.z);if(d<L.r+3.5&&d>L.r-1.5)consider(.8,{t:'fish',L},9);}
  return best;}
function updateActionUI(){
  target=nearest();let txt='',wait=false,seeds=false;
  if(fish.on){txt=fish.phase==='bite'?'🎣 TRAGE ACUM!':'🎣 Așteaptă…';wait=fish.phase!=='bite';target={t:'fishing'};}
  else if(target){const t=target;
    if(t.t==='plot'){const p=S.plots[t.i];if(!p.c){txt=`🌱 Plantează ${CROPS[S.seed].e}`;seeds=true;}else if(p.p>=1)txt=`🧺 Recoltează ${CROPS[p.c].e}`;else{txt=`${CROPS[p.c].e} crește… ${Math.floor(p.p*100)}%`;wait=true;}}
    if(t.t==='market'){const n=invTotal();txt=n?`💰 Vinde tot (${n})`:'💰 Piața (nimic de vândut)';wait=!n;}
    if(t.t==='nest')txt=`✨ Deschide ouă (${S.eggs+S.gold})`;
    if(t.t==='fac'){const st=S.fac[t.id];txt=st&&st.done.length?`${FACTORIES[t.id].e} Ia ${st.done.map(o=>itemInfo(o).e).join('')}`:`${FACTORIES[t.id].e} ${FACTORIES[t.id].n}`;}
    if(t.t==='pig'){const c=Math.floor(S.pig);txt=c?`🐖 Ia ${c} 🪙`:'🐖 Pușculița se umple…';wait=!c;}
    if(t.t==='orders')txt='📋 Comenzi';
    if(t.t==='tree'){const T_=TREES[S.trees[t.k].t];txt=`${T_.e} Culege ${T_.n}`;}
    if(t.t==='lock')txt=`➕ Cumpără parcelă ${plotCost()}🪙`;
    if(t.t==='animal'){const pr=ANIMALS[t.o.a.t].prod;txt=`${pr.e} Colectează ${pr.n}`;}
    if(t.t==='feed')txt='🥣 Hrănește animalele';
    if(t.t==='help')txt=`💧 ${t.fo.f.pe}`;
    if(t.t==='veh')txt=`${VEH[t.id].e} Urcă în ${VEH[t.id].n}`;
    if(t.t==='talk')txt=`👋 Salut, ${t.fo.f.n}!`;
    if(t.t==='pet')txt=`💕 Mângâie ${pet.P.n}`;
    if(t.t==='fish')txt='🎣 Pescuiește';}
  actEl.style.display=txt?'block':'none';actEl.textContent=txt;actEl.classList.toggle('wait',wait);
  if(seeds){const avail=Object.entries(CROPS).filter(([,c])=>c.lv<=S.lv);const key=S.coins+S.seed+S.lv;if(seedsEl.style.display!=='flex'||seedsEl.dataset.c!=key){seedsEl.dataset.c=key;seedsEl.innerHTML=avail.map(([k,c])=>`<button class="seed ${k===S.seed?'sel':''} ${S.coins<c.cost?'off':''}" data-seed="${k}">${c.e} ${c.cost}🪙</button>`).join('');}seedsEl.style.display='flex';}else seedsEl.style.display='none';
  const anyVeh=Object.keys(vehicles).length>0;vehEl.style.display=player.veh||anyVeh?'grid':'none';vehEl.textContent=player.veh?'🚶':(S.own.safari?'🚙':'🚜');}
seedsEl.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-seed]');if(!b)return;e.preventDefault();S.seed=b.dataset.seed;if(target&&target.t==='plot'&&!S.plots[target.i].c)plantAt(target.i,true);else updateActionUI();});
function nearPlots(i){const [x,z]=plotPos(i);const r=[];for(let j=0;j<S.unl;j++){const [a,b]=plotPos(j);if(Math.hypot(a-x,b-z)<7)r.push(j);}return r;}
function plantAt(i,group){if(CROPS[S.seed].lv>S.lv)S.seed='morcov';const list=group&&player.veh?nearPlots(i):[i];let planted=0;
  for(const j of list){const p=S.plots[j];if(p.c)continue;const c=CROPS[S.seed];if(S.coins<c.cost){if(!planted){toast('Nu ai destule monede pentru semințe 🪙');sfx.no();}break;}S.coins-=c.cost;p.c=S.seed;p.p=0;planted++;refreshPlot(j);}
  if(planted){S.st.plant++;sfx.plant();addXP(planted);hud();}updateActionUI();}
function harvestAt(i){const list=player.veh==='tractor'?nearPlots(i):[i];let tot=0,em='';
  for(const j of list){const p=S.plots[j];if(!p.c||p.p<1)continue;let n=3*(S.own.sapa?2:1);if(S.own.siloz&&Math.random()<.25)n*=2;if(!canStore(n))break;addInv(p.c,n);tot+=n;em=CROPS[p.c].e;p.c=null;p.p=0;refreshPlot(j);}
  if(tot){S.st.harv++;toast(`${em} +${tot} în hambar`);sfx.pick();happy();addXP(Math.ceil(tot/2));}}
function doAction(){if(modalOn||arrange.on)return;if(fish.on){catchFish();return;}if(!target)return;const t=target;
  if(t.t==='plot'){const p=S.plots[t.i];if(!p.c)plantAt(t.i,true);else if(p.p>=1)harvestAt(t.i);}
  if(t.t==='market'){let sum=0;const mult=S.own.moara?1.2:1;for(const [k,n] of Object.entries(S.inv))sum+=Math.round(itemInfo(k).v*n*mult);if(!sum)return toast('Nu ai nimic de vândut');S.inv={};S.coins+=sum;S.st.sold++;toast(`💰 Ai vândut tot: +${sum} 🪙`);sfx.coin();happy();addXP(Math.ceil(sum/25));}
  if(t.t==='nest')openEggs();
  if(t.t==='fac'){const st=S.fac[t.id];if(st&&st.done.length)collectFactory(t.id);else openFactory(t.id);}
  if(t.t==='pig'){const c=Math.floor(S.pig);if(c){S.pig-=c;S.coins+=c;toast(`🐖 +${c} 🪙 din pușculiță`);sfx.coin();happy();addXP(1);}}
  if(t.t==='orders')openOrders();
  if(t.t==='tree'){const tr=S.trees[t.k];if(!canStore(3))return;addInv(tr.t,3);tr.p=0;toast(`${TREES[tr.t].e} +3 în hambar`);sfx.pick();happy();addXP(3);}
  if(t.t==='lock')buy('plot',true);
  if(t.t==='animal'){const pr=ANIMALS[t.o.a.t].prod;if(!canStore(1))return;addInv(pr.id,1);t.o.a.rd=false;t.o.a.pt=0;t.o.a.fed=false;t.o.ic.visible=false;toast(`${pr.e} +1 ${pr.n}`);sfx.pick();happy();addXP(2);}
  if(t.t==='feed'){let n=0;for(const o of animalObjs)if(o.pen===t.pen&&!o.a.fed&&S.inv.hrana){o.a.fed=true;S.inv.hrana--;n++;}if(!S.inv.hrana)delete S.inv.hrana;toast(`🥣 Ai hrănit ${n} animale — produc de 2× mai repede!`);sfx.pick();happy();addXP(n);}
  if(t.t==='help'){t.pl.need=false;t.pl.timer=rand(25,60);t.pl.drop.visible=false;const fr=S.fr[t.fo.f.n]=S.fr[t.fo.f.n]||{h:0};fr.h++;S.coins+=4;S.st.help++;sfx.coin();happy();addXP(3);if(t.fo.ch)t.fo.ch.happy=1.5;
    if(fr.h%3===0){S.eggs++;toast(`🎁 ${t.fo.f.n} îți dă un ou misterios! Mulțumesc! 💚`);sfx.hatch();}else toast(`💚 ${t.fo.f.n}: Mulțumesc! +4 🪙`);}
  if(t.t==='veh')mountVehicle(t.id);
  if(t.t==='talk'){const fr=S.fr[t.fo.f.n]||{h:0};if(t.fo.ch)t.fo.ch.happy=1.5;toast(pick([`${t.fo.f.n}: Bună! Mă ajuți la udat? 💧`,`${t.fo.f.n}: Ai văzut ouăle de aur de la munte? 🌟`,`${t.fo.f.n}: Prietenie: ${fr.h%3}/3 până la un ou cadou 🎁`,`${t.fo.f.n}: Ce frumos arăți azi! 😍`,`${t.fo.f.n}: Ai încercat să pescuiești la lac? 🎣`]));snd(700,.08,'triangle');}
  if(t.t==='pet'){pet.ht=1.6;pet.hearts.visible=true;happy();snd(980,.1,'triangle');}
  if(t.t==='fish')startFish(t.L);
  hud();save();updateActionUI();}
function mountVehicle(id){const v=vehicles[id];if(!v)return;if(player.veh)dismount();
  scene.remove(v);root.add(v);v.position.set(0,0,0);v.rotation.set(0,0,0);player.veh=id;pch.root.position.copy(v.userData.seat);player.vy=0;toast(`${VEH[id].e} Vrrrum!`);snd(120,.4,'sawtooth',.06);updateActionUI();}
function dismount(){const id=player.veh;const v=vehicles[id];root.remove(v);scene.add(v);v.position.copy(player.pos);v.rotation.y=player.face;S.lay['v:'+id]={x:v.position.x,z:v.position.z};
  player.veh=null;pch.root.position.set(0,0,0);player.pos.x+=Math.cos(player.face)*1.8;player.pos.z-=Math.sin(player.face)*1.8;updateActionUI();}
function toggleVehicle(){if(arrange.on)return;if(player.veh)return dismount();const id=S.own.safari?'safari':S.own.tractor?'tractor':null;if(!id)return toast('Cumpără un vehicul din Magazin 🚜');
  const v=vehicles[id];if(Math.hypot(v.position.x-player.pos.x,v.position.z-player.pos.z)>3){v.position.copy(player.pos);toast(`${VEH[id].e} Vehiculul a venit la tine!`);}mountVehicle(id);}

/* ================= ARRANGE MODE ================= */
const arrange={on:false,sel:null,drag:false,off:[0,0],pan:null,tx:0,tz:0,h:38,valid:true,last:null};
const selRing=new THREE.Mesh(new THREE.RingGeometry(.96,1,4,1),new THREE.MeshBasicMaterial({color:0x4cff6a,transparent:true,opacity:.95,side:THREE.DoubleSide,depthTest:false}));
selRing.rotation.x=-Math.PI/2;selRing.rotation.z=Math.PI/4;selRing.renderOrder=10;selRing.visible=false;scene.add(selRing);
const selFill=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x4cff6a,transparent:true,opacity:.22,depthTest:false,side:THREE.DoubleSide}));selFill.rotation.x=-Math.PI/2;selFill.renderOrder=9;selFill.visible=false;scene.add(selFill);
function enterArrange(){if(modalOn||player.veh)return;arrange.on=true;arrange.sel=null;arrange.tx=0;arrange.tz=0;arrange.h=Math.max(30,farmF()*1.5);document.body.classList.add('arranging');
  $('#arrTxt').textContent='Atinge o construcție și trage-o unde vrei';toast('🏗️ Mod aranjare');}
function exitArrange(){arrange.on=false;arrange.sel=null;selRing.visible=selFill.visible=false;document.body.classList.remove('arranging');rebuildFarmGrass();refreshLocks();
  for(const o of animalObjs){const [px,pz]=penPos(o.pen);o.m.g.position.set(px+rand(-2,2),0,pz+rand(-2,2));o.tx=px;o.tz=pz;}save();toast('✔ Ferma a fost aranjată!');}
function pickPlace(p){let best=null,bd=1e9;for(const k in PL){const o=PL[k];const [hw,hd]=fpSize(o);if(Math.abs(p.x-o.x)<=hw&&Math.abs(p.z-o.z)<=hd){const a=hw*hd;if(a<bd){bd=a;best=o;}}}return best;}
function showSel(){const o=arrange.sel;if(!o){selRing.visible=selFill.visible=false;return;}const [hw,hd]=fpSize(o);
  selRing.visible=selFill.visible=true;selRing.position.set(o.x,.12,o.z);selRing.scale.set(hw*Math.SQRT2,hd*Math.SQRT2,1);selFill.position.set(o.x,.1,o.z);selFill.scale.set(hw*2,hd*2,1);
  const col=arrange.valid?0x4cff6a:0xff4c4c;selRing.material.color.setHex(col);selFill.material.color.setHex(col);
  $('#arrTxt').textContent=(o.lbl?'':'')+'Trage ca să muți · ↻ ca să rotești';}
function arrangeDown(e){const p=groundAt(e.clientX,e.clientY);if(!p)return;const o=pickPlace(p);
  if(o){arrange.sel=o;arrange.drag=true;arrange.off=[o.x-p.x,o.z-p.z];arrange.valid=true;showSel();sfx.pick();}
  else{arrange.pan={x:e.clientX,y:e.clientY};if(arrange.sel&&!arrange.drag){}}}
function arrangeMove(e){if(arrange.drag&&arrange.sel){const p=groundAt(e.clientX,e.clientY);if(!p)return;const o=arrange.sel;
    const x=Math.round((p.x+arrange.off[0])*2)/2,z=Math.round((p.z+arrange.off[1])*2)/2;if(canPlace(o,x,z,o.r)){setPlace(o,x,z,o.r);arrange.valid=true;}else arrange.valid=false;showSel();}
  else if(arrange.pan){const k=arrange.h/innerHeight*1.2;const dx=(e.clientX-arrange.pan.x)*k,dz=(e.clientY-arrange.pan.y)*k;arrange.tx=clamp(arrange.tx-dx,-60,60);arrange.tz=clamp(arrange.tz-dz,-60,60);arrange.pan={x:e.clientX,y:e.clientY};}}
function arrangeUp(){arrange.drag=false;arrange.pan=null;arrange.valid=true;showSel();}
$('#arrRot').onclick=()=>{const o=arrange.sel;if(!o)return toast('Atinge întâi o construcție');const r=(o.r+1)%4;if(canPlace(o,o.x,o.z,r)){setPlace(o,o.x,o.z,r);showSel();snd(600,.08,'triangle');}else{toast('Nu încape așa — mut-o puțin');sfx.no();}};
$('#arrDone').onclick=exitArrange;
$('#arrZoomIn').onclick=()=>arrange.h=clamp(arrange.h-8,14,80);$('#arrZoomOut').onclick=()=>arrange.h=clamp(arrange.h+8,14,80);

/* ================= UPDATE ================= */
function resolveCollisions(p,rad){
  for(const c of colliders){const dx=p.x-c.x,dz=p.z-c.z;
    if(c.r!==undefined){const R=c.r+rad;if(Math.abs(dx)>R||Math.abs(dz)>R)continue;const d=Math.hypot(dx,dz);if(d<R&&d>1e-4){p.x=c.x+dx/d*R;p.z=c.z+dz/d*R;}}
    else{const ox=c.hw+rad-Math.abs(dx),oz=c.hd+rad-Math.abs(dz);if(ox>0&&oz>0){if(ox<oz)p.x+=Math.sign(dx)*ox;else p.z+=Math.sign(dz)*oz;}}}
  const r=Math.hypot(p.x,p.z);if(r>WR-5){p.x*=(WR-5)/r;p.z*=(WR-5)/r;}}
function updatePlayer(dt){
  let ix=joy.vx,iy=joy.vy;
  if(keys.KeyW||keys.ArrowUp)iy=-1;if(keys.KeyS||keys.ArrowDown)iy=1;if(keys.KeyA||keys.ArrowLeft)ix=-1;if(keys.KeyD||keys.ArrowRight)ix=1;
  if(modalOn||arrange.on){ix=iy=0;}
  const mag=Math.min(1,Math.hypot(ix,iy));if(mag>.2&&fish.on)endFish();
  const fx=-Math.sin(camYaw),fz=-Math.cos(camYaw),rx=Math.cos(camYaw),rz=-Math.sin(camYaw);
  let mx=fx*(-iy)+rx*ix,mz=fz*(-iy)+rz*ix;const ml=Math.hypot(mx,mz);
  const sp=player.veh?VEH[player.veh].sp:5.2;
  if(ml>.05){mx/=ml;mz/=ml;player.face=angLerp(player.face,Math.atan2(mx,mz),Math.min(1,dt*(player.veh?5:12)));player.speed=lerp(player.speed,sp*mag,Math.min(1,dt*8));
    if(player.veh){mx=Math.sin(player.face);mz=Math.cos(player.face);}}
  else{player.speed=lerp(player.speed,0,Math.min(1,dt*10));mx=Math.sin(player.face);mz=Math.cos(player.face);}
  player.pos.x+=mx*player.speed*dt;player.pos.z+=mz*player.speed*dt;
  resolveCollisions(player.pos,player.veh?1.1:.35);
  const gy=H(player.pos.x,player.pos.z);
  player.vy-=22*dt;player.pos.y+=player.vy*dt;
  if(player.pos.y<=gy){player.pos.y=gy;player.vy=0;player.ground=true;}else if(player.pos.y-gy>.15)player.ground=false;
  root.position.copy(player.pos);root.rotation.y=player.face;
  if(window.FORCEWALK)animChar(pch,dt,{moving:true,speed:1});else if(!lookOpen)animChar(pch,dt,{moving:player.speed>.4&&!player.veh,speed:player.speed/5.2,air:!player.ground&&!player.veh,sit:!!player.veh,fish:fish.on});
  else animChar(pch,dt,{});
  if(player.veh){const v=vehicles[player.veh];for(const w of v.userData.wheels)w.rotation.x+=player.speed*dt*1.6;v.position.y=Math.sin(T*30)*.012*player.speed/6;
    const ahead=H(player.pos.x+mx*1.2,player.pos.z+mz*1.2),behind=H(player.pos.x-mx*1.2,player.pos.z-mz*1.2);v.rotation.x=lerp(v.rotation.x,-Math.atan2(ahead-behind,2.4),.2);}}
function growMult(){return (1+.25*S.up.stropitoare)*(S.own.sera?1.3:1)*(S.own.fantana?1.1:1)*(petHas('slime')?1.15:1);}
function tickWorld(dt,offline=false){ // things that progress even while away
  const m=growMult();let grown=0;
  for(let i=0;i<S.unl;i++){const p=S.plots[i];if(p.c&&p.p<1){p.p=Math.min(1,p.p+dt/CROPS[p.c].t*m);if(p.p>=1)grown++;if(!offline)refreshPlot(i);}}
  let made=0,prods=0;
  for(const [id,st] of Object.entries(S.fac)){for(const q of st.q)q.t-=dt;const fin=st.q.filter(q=>q.t<=0);st.q=st.q.filter(q=>q.t>0);for(const q of fin){const r=FACTORIES[id].rec[q.r];for(let i=0;i<r.q;i++)st.done.push(r.out);made+=r.q;}}
  for(const tr of Object.values(S.trees))if(tr.p<1)tr.p=Math.min(1,tr.p+dt/TREES[tr.t].t);
  S.animals.forEach((a,i)=>{if(i>=capacity()||a.rd)return;const D_=ANIMALS[a.t];a.pt+=dt*(a.fed?2:1);if(a.pt>=D_.prod.t){if(S.own.hambar&&invTotal()<invCap()){addInv(D_.prod.id,1);a.pt=0;a.fed=false;prods++;}else if(!S.own.hambar)a.rd=true;else a.pt=D_.prod.t;}});
  if(S.own.pusculita){const rate=D.pigRate(S.up.pusculita);S.pig=Math.min(rate*180,S.pig+rate*dt/60);}
  for(const o of S.orders)if(o.wait>0)o.wait-=dt;
  return {grown,made,prods};}
function updateFarm(dt){tickWorld(dt);
  for(let i=0;i<S.unl;i++){const o=plotObjs[i];if(o&&o.ready.visible)o.ready.position.y=1.8+Math.sin(T*3+i)*.12;}
  for(const id in FACTORIES){const o=PL['f:'+id];if(o&&o.ready){o.ready.visible=!!(S.fac[id]&&S.fac[id].done.length);if(o.ready.visible)o.ready.position.y=FACTORIES[id].w*1.25+.3+Math.sin(T*3)*.12;}}
  for(const k in treeObjs){const tr=S.trees[k];if(!tr)continue;const ob=treeObjs[k];ob.fr.visible=tr.p>=1;ob.fr.scale.setScalar(.4+.6*Math.min(1,tr.p));ob.ic.visible=tr.p>=1;}}
function updateAnimals(dt){for(const o of animalObjs){const a=o.a,D_=ANIMALS[a.t];
  o.ic.visible=a.rd;if(a.rd)o.ic.position.y=D_.h+.7+Math.sin(T*3+a.id)*.1;o.fed.visible=!!a.fed&&!a.rd;
  const g=o.m.g;const [px,pz]=penPos(o.pen);if(Math.hypot(g.position.x-px,g.position.z-pz)>6){g.position.set(px,0,pz);o.tx=px;o.tz=pz;}
  const dx=o.tx-g.position.x,dz=o.tz-g.position.z,d=Math.hypot(dx,dz);
  let moving=false;if(o.wait>0)o.wait-=dt;else if(d<.2){o.tx=px+rand(-2.6,2.6);o.tz=pz+rand(-2.6,2.6);o.wait=rand(1.5,6);}
  else{const s=(D_.sp||.9)*dt;g.position.x+=dx/d*s;g.position.z+=dz/d*s;g.rotation.y=angLerp(g.rotation.y,Math.atan2(dx,dz),dt*5);moving=true;}
  setMove(o.m,moving);if(Math.hypot(g.position.x-player.pos.x,g.position.z-player.pos.z)<80)o.m.mixer.update(dt);
  if(g.userData.horn)g.userData.horn.material.emissiveIntensity=.3+Math.sin(T*3)*.2;}}
function updatePet(dt){if(!pet)return;const g=pet.m.g,P=pet.P;const f=player.face;const sp=(1+S.up.companion*.1);
  const tx=player.pos.x+Math.cos(f)*1.3-Math.sin(f)*1.1,tz=player.pos.z-Math.sin(f)*1.3-Math.cos(f)*1.1;const dx=tx-g.position.x,dz=tz-g.position.z,d=Math.hypot(dx,dz);
  let moving=false;if(d>30){g.position.set(tx,0,tz);}else if(d>.4){const v=Math.min(d*3,Math.max(5.5*sp,player.speed*1.15));g.position.x+=dx/d*v*dt;g.position.z+=dz/d*v*dt;g.rotation.y=angLerp(g.rotation.y,Math.atan2(dx,dz),dt*8);moving=true;}
  else g.rotation.y=angLerp(g.rotation.y,player.face,dt*3);
  const gy=H(g.position.x,g.position.z);g.position.y=P.fly?gy+1.3+Math.sin(T*2.4)*.18:gy;
  if(!P.fly)setMove(pet.m,moving);pet.m.mixer.update(dt*(P.fly&&moving?1.6:1));
  if(pet.ht>0){pet.ht-=dt;pet.hearts.position.y=P.h+.6+(1.6-pet.ht)*.4;if(pet.ht<=0)pet.hearts.visible=false;}
  if(petHas('catel')||S.pet==='dragonaur'){pet.coinT-=dt;if(pet.coinT<=0){pet.coinT=rand(40,70);const c=Math.round(rand(3,9)*(S.pet==='dragonaur'?2:1));S.coins+=c;toast(`${P.e} ${P.n} a găsit ${c} 🪙!`);sfx.coin();hud();pet.ht=1.2;pet.hearts.visible=true;}}}
let eggTimer=0;
function updateEggs(dt){const p=player.pos;const rr=(S.own.cos?3:1.7)+(petIsDragon()?4:0);
  for(let i=worldEggs.length-1;i>=0;i--){const e=worldEggs[i];e.t+=dt;e.e.position.y=.6+Math.sin(e.t*2.5)*.12;e.e.rotation.y+=dt;
    const d=Math.hypot(p.x-e.x,p.z-e.z);e.g.visible=d<330;
    if(d<rr+(player.veh?1:0)){scene.remove(e.g);worldEggs.splice(i,1);if(e.gold)S.gold++;else S.eggs++;S.st.eggs++;toast(e.gold?'🌟 Ai găsit un OU DE AUR!':'🥚 Ai găsit un ou misterios!');sfx.pick();happy();addXP(2);hud();save();}}
  eggTimer+=dt;if(eggTimer>10&&worldEggs.length<maxEggs()){eggTimer=0;spawnEgg();}}
function updateFriends(dt){for(const fo of friendObjs){
  const pd=Math.hypot(player.pos.x-fo.pos.x,player.pos.z-fo.pos.z);
  if(!fo.ch&&!fo.loading&&pd<110){fo.loading=true;makeChar(fo.f.ch).then(c=>{fo.ch=c;c.root.position.copy(fo.pos);scene.add(c.root);setAccs(c,{acc:fo.f.acc});
      const nm=textSprite(fo.f.n,{size:.8,bg:'rgba(255,255,255,.92)'});nm.position.y=c.height+.35;c.root.add(nm);}).catch(()=>{fo.loading=false;});}
  const dx=fo.tx-fo.pos.x,dz=fo.tz-fo.pos.z,d=Math.hypot(dx,dz);let mv=false;
  if(fo.wait>0)fo.wait-=dt;else if(d<.3){const pl=pick(fo.plots);fo.tx=pl.x+rand(-1.5,1.5);fo.tz=pl.z+1.9;fo.wait=rand(2,6);}
  else{const s=1.9*dt;fo.pos.x+=dx/d*s;fo.pos.z+=dz/d*s;fo.rot=angLerp(fo.rot,Math.atan2(dx,dz),dt*8);mv=true;}
  if(!mv&&pd<6)fo.rot=angLerp(fo.rot,Math.atan2(player.pos.x-fo.pos.x,player.pos.z-fo.pos.z),dt*5);
  if(fo.ch){fo.ch.root.position.copy(fo.pos);fo.ch.root.rotation.y=fo.rot;if(pd<70)animChar(fo.ch,dt,{moving:mv,speed:.4});fo.ch.root.visible=pd<180;}
  for(const pl of fo.plots){if(!pl.need){pl.timer-=dt;if(pl.timer<=0)pl.need=true;}pl.drop.visible=pl.need;if(pl.need)pl.drop.position.y=1.8+Math.sin(T*3+pl.x)*.12;}
  if(pd<80)fo.pet.mixer.update(dt);}}
function updateWorld(dt){for(const s of spinners){if(s.t==='spin')s.o.rotation.z+=dt*.8;if(s.t==='bob'){s.o.position.y=.95+Math.sin(T*2)*.08;s.o.rotation.y+=dt*.5;}if(s.t==='coin'){s.o.rotation.z+=dt*2;s.o.position.y=2.4+Math.sin(T*2)*.1;}if(s.t==='spinY')s.o.rotation.y+=dt*.6;}
  for(const c of clouds){c.position.x+=dt*2;if(c.position.x>620)c.position.x=-620;}
  grassUni.uTime.value=T;
  for(const k in locks){const L=locks[k];L.g.children[2].visible=Math.hypot(L.x-player.pos.x,L.z-player.pos.z)>4.5;}
  const cx=arrange.on?arrange.tx:player.pos.x,cz=arrange.on?arrange.tz:player.pos.z;
  for(const ch of chunks){const d=Math.hypot(ch.x-cx,ch.z-cz);const near=d<(MOBILE?75:100);ch.g.visible=near;ch.f.visible=!near;}}
const camPos=new THREE.Vector3(), lookAt=new THREE.Vector3();
function updateCamera(dt){const p=player.pos;
  camera.layers.set(lookOpen?1:0);
  if(arrange.on){if(camera.view&&camera.view.enabled)camera.clearViewOffset();camPos.set(arrange.tx,arrange.h,arrange.tz+arrange.h*.55);lookAt.set(arrange.tx,0,arrange.tz);camera.position.lerp(camPos,Math.min(1,dt*6));camera.lookAt(lookAt);}
  else if(lookOpen){const f=player.face;const hh=pch.height;camPos.set(p.x+Math.sin(f)*2.05,p.y+hh*.68,p.z+Math.cos(f)*2.05);lookAt.set(p.x,p.y+hh*.56,p.z);camera.position.lerp(camPos,Math.min(1,dt*8));camera.lookAt(lookAt);
    const W=innerWidth,Hh=innerHeight;camera.setViewOffset(W,Hh,Math.min(W*.24,230),0,W,Hh);pch.root.rotation.y=Math.sin(T*.6)*.45;}
  else{if(camera.view&&camera.view.enabled){camera.clearViewOffset();pch.root.rotation.y=0;}
    const dist=player.veh?camDist+3.5:camDist;
    if(Math.abs(joy.vx)+Math.abs(joy.vy)>.1&&drag.id===null){const behind=player.face+Math.PI;camYaw=angLerp(camYaw,behind,dt*(player.veh?1.6:.6)*(joy.vy<0?1:.3));}
    camPos.set(p.x+Math.sin(camYaw)*dist*Math.cos(camPitch),p.y+1.25+Math.sin(camPitch)*dist,p.z+Math.cos(camYaw)*dist*Math.cos(camPitch));
    const gy=H(camPos.x,camPos.z)+.5;if(camPos.y<gy)camPos.y=gy;
    camera.position.lerp(camPos,Math.min(1,dt*10));lookAt.set(p.x,p.y+1.05,p.z);camera.lookAt(lookAt);}
  if(window.DC){camera.position.set(...window.DC[0]);camera.lookAt(...window.DC[1]);}
  sky.position.copy(camera.position);
  const sc=arrange.on?new THREE.Vector3(arrange.tx,0,arrange.tz):p;sun.position.copy(sc).addScaledVector(SUN_DIR,110);sun.target.position.copy(sc);
  const sz=arrange.on?Math.max(42,arrange.h*1.1):42;if(sun.shadow.camera.right!==sz){Object.assign(sun.shadow.camera,{left:-sz,right:sz,top:sz,bottom:-sz});sun.shadow.camera.updateProjectionMatrix();}}

/* ================= MINIMAP ================= */
const mini=$('#mini'),mg=mini.getContext('2d');
function drawMini(){const W=224,c=W/2,s=(W/2-6)/WR;mg.clearRect(0,0,W,W);mg.save();mg.beginPath();mg.arc(c,c,c,0,7);mg.clip();
  mg.fillStyle='#8a8580';mg.fillRect(0,0,W,W);mg.fillStyle='#4f8a36';mg.beginPath();mg.arc(c,c,232*s,0,7);mg.fill();mg.fillStyle='#6cb04a';mg.beginPath();mg.arc(c,c,110*s,0,7);mg.fill();
  mg.strokeStyle='#d8b77d';mg.lineWidth=3;for(const p of PATHS){mg.beginPath();mg.moveTo(c,c);mg.lineTo(c+p[2]*s,c+p[3]*s);mg.stroke();}
  mg.fillStyle='#3fb0ec';for(const L of LAKES){mg.beginPath();mg.arc(c+L.x*s,c+L.z*s,Math.max(3,L.r*s),0,7);mg.fill();}
  const F=farmF();mg.fillStyle='#c89b6d';mg.fillRect(c-F*s,c-F*s,2*F*s,2*F*s);mg.font='bold 16px sans-serif';mg.textAlign='center';mg.textBaseline='middle';mg.fillText('🏡',c,c);
  for(const fo of friendObjs){const f=fo.f;mg.fillStyle='#'+f.c.toString(16).padStart(6,'0');mg.beginPath();mg.arc(c+f.x*s,c+f.z*s,8,0,7);mg.fill();mg.fillStyle='#fff';mg.font='bold 11px sans-serif';mg.fillText(f.n[0],c+f.x*s,c+f.z*s+1);}
  if(S.own.busola||S.own.safari||petIsDragon())for(const e of worldEggs){mg.fillStyle=e.gold?'#ffd54f':'#fff';mg.beginPath();mg.arc(c+e.x*s,c+e.z*s,3.5,0,7);mg.fill();}
  const px=c+player.pos.x*s,pz=c+player.pos.z*s;mg.translate(px,pz);mg.rotate(-player.face+Math.PI);mg.fillStyle='#ff3d6e';mg.strokeStyle='#fff';mg.lineWidth=2.5;mg.beginPath();mg.moveTo(0,-9);mg.lineTo(6,6);mg.lineTo(-6,6);mg.closePath();mg.fill();mg.stroke();
  mg.restore();}

/* ================= INIT ================= */
for(const id in VEH)if(S.own[id])spawnVehicle(id);
for(let i=0;i<maxPlots();i++)refreshPlot(i);refreshLocks();placeAnimals();spawnPet();fillOrders();hud();
if(S.pos)player.pos.y=H(player.pos.x,player.pos.z);
camYaw=player.face+Math.PI;
// --- offline progress (idle earnings) ---
const away=Math.min(12*3600,Math.max(0,(Date.now()-(S.last||Date.now()))/1000));
let welcome=null;
if(away>90){const pig0=S.pig;let rem=away,res={grown:0,made:0,prods:0};while(rem>0){const st=Math.min(30,rem);const r=tickWorld(st,true);res.grown+=r.grown;res.made+=r.made;res.prods+=r.prods;rem-=st;}
  for(let i=0;i<maxPlots();i++)refreshPlot(i);
  const coins=Math.floor(S.pig-pig0);welcome={away,coins,...res};}
// --- daily gift ---
const today=new Date().toISOString().slice(0,10);let daily=null;
if(S.daily.d!==today){const yest=new Date(Date.now()-864e5).toISOString().slice(0,10);S.daily.streak=S.daily.d===yest?Math.min(7,S.daily.streak+1):1;S.daily.d=today;
  const st=S.daily.streak;const coins=15*st;S.coins+=coins;if(st===3||st===5)S.eggs++;if(st===7)S.gold++;daily={st,coins,egg:st===3||st===5,gold:st===7};}

let T=0,last=performance.now(),uiT=0,mapT=0,saveT=0;
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;T+=dt;
  updatePlayer(dt);updateFarm(dt);updateAnimals(dt);updatePet(dt);updateEggs(dt);updateFriends(dt);updateFish(dt);updateWorld(dt);updateCamera(dt);
  uiT+=dt;if(uiT>.12){uiT=0;updateActionUI();$('#quest').textContent=quest();}
  mapT+=dt;if(mapT>.25){mapT=0;drawMini();}
  saveT+=dt;if(saveT>8){saveT=0;save();}
  renderer.render(scene,camera);requestAnimationFrame(loop);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.FP={S,player,scene,camera,renderer,friendObjs,PL,arrange,get T(){return T},get pch(){return pch},addXP,setPlace,canPlace};
$('#barI').style.width='100%';
$('#loadTxt').outerHTML='<br><button id="play">▶ Joacă</button>';
$('#play').addEventListener('click',async()=>{snd(660,.1,'triangle');
  try{const el=document.documentElement;if(!document.fullscreenElement&&el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});}catch(e){}
  try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape');}catch(e){}
  $('#load').remove();resize();});
requestAnimationFrame(loop);
if(!S.tut){S.tut=true;openModal(`<h2>🌍 Bun venit la Farm Planet!</h2>
<p>🕹️ <b>Joystick</b> stânga jos pentru mers, <b>Sari</b> în dreapta. Trage cu degetul pe ecran ca să rotești camera.</p>
<p>🌱 Plantează legume, recoltează-le și vinde-le la <b>Piață</b> sau livrează <b>comenzi</b> 📋 pentru mai mulți bani.</p>
<p>🏭 Construiește <b>fabrici</b> (brutărie, lăptărie…) și fă produse scumpe. Crești în <b>nivel ⭐</b> și deblochezi lucruri noi.</p>
<p>🥚 Caută <b>ouă misterioase</b> în pădure și la munte. La <b>Cuibul magic</b> iese un animal (60%) sau e gol (40%).</p>
<p>🏗️ Cu butonul de <b>aranjare</b> muți clădirile, câmpurile și țarcurile unde vrei.</p>
<p>🐉 Adoptă un <b>companion</b> — chiar și un dragon! 👗 Schimbă-ți personajul, hainele și părul.</p>
<div style="text-align:center;margin-top:10px"><button class="big" data-close>Hai să jucăm! 🚀</button></div>`);save();}
else if(welcome||daily){let h='<h2>👋 Bine ai revenit!</h2>';
  if(daily)h+=`<div class="item"><div class="em">🎁</div><div class="info"><b>Cadoul zilei ${daily.st}/7</b><small>+${daily.coins} 🪙${daily.egg?' · +1 🥚':''}${daily.gold?' · +1 🌟 ou de aur':''} — vino zilnic pentru cadouri mai mari!</small></div></div>`;
  if(welcome){h+=`<p>Cât ai lipsit (${fmtTime(welcome.away)}):</p>`;
    if(welcome.coins)h+=`<div class="item"><div class="em">🐖</div><div class="info"><b>Pușculița a strâns ${welcome.coins} 🪙</b><small>Mergi la ea să le iei</small></div></div>`;
    if(welcome.grown)h+=`<div class="item"><div class="em">🌾</div><div class="info"><b>${welcome.grown} parcele sunt gata de recoltat</b></div></div>`;
    if(welcome.made)h+=`<div class="item"><div class="em">🏭</div><div class="info"><b>Fabricile au făcut ${welcome.made} produse</b></div></div>`;
    if(welcome.prods)h+=`<div class="item"><div class="em">🏚️</div><div class="info"><b>Hambarul a strâns ${welcome.prods} produse de la animale</b></div></div>`;}
  h+='<div style="text-align:center;margin-top:8px"><button class="big" data-close>Super! 🚀</button></div>';openModal(h);hud();save();}
