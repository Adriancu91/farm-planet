// Retarget Quaternius "Universal Animation Library" (Rigify DEF- bones) clips onto VRM humanoids.
import * as THREE from 'three';

const RAW = {
  'DEF-hips':'hips','DEF-spine.001':'spine','DEF-spine.002':'chest','DEF-spine.003':'upperChest','DEF-neck':'neck','DEF-head':'head',
  'DEF-shoulder.L':'leftShoulder','DEF-upper_arm.L':'leftUpperArm','DEF-forearm.L':'leftLowerArm','DEF-hand.L':'leftHand',
  'DEF-shoulder.R':'rightShoulder','DEF-upper_arm.R':'rightUpperArm','DEF-forearm.R':'rightLowerArm','DEF-hand.R':'rightHand',
  'DEF-thigh.L':'leftUpperLeg','DEF-shin.L':'leftLowerLeg','DEF-foot.L':'leftFoot','DEF-toe.L':'leftToes',
  'DEF-thigh.R':'rightUpperLeg','DEF-shin.R':'rightLowerLeg','DEF-foot.R':'rightFoot','DEF-toe.R':'rightToes',
  'DEF-thumb.01.L':'leftThumbMetacarpal','DEF-thumb.02.L':'leftThumbProximal','DEF-thumb.03.L':'leftThumbDistal',
  'DEF-f_index.01.L':'leftIndexProximal','DEF-f_index.02.L':'leftIndexIntermediate','DEF-f_index.03.L':'leftIndexDistal',
  'DEF-f_middle.01.L':'leftMiddleProximal','DEF-f_middle.02.L':'leftMiddleIntermediate','DEF-f_middle.03.L':'leftMiddleDistal',
  'DEF-f_ring.01.L':'leftRingProximal','DEF-f_ring.02.L':'leftRingIntermediate','DEF-f_ring.03.L':'leftRingDistal',
  'DEF-f_pinky.01.L':'leftLittleProximal','DEF-f_pinky.02.L':'leftLittleIntermediate','DEF-f_pinky.03.L':'leftLittleDistal',
  'DEF-thumb.01.R':'rightThumbMetacarpal','DEF-thumb.02.R':'rightThumbProximal','DEF-thumb.03.R':'rightThumbDistal',
  'DEF-f_index.01.R':'rightIndexProximal','DEF-f_index.02.R':'rightIndexIntermediate','DEF-f_index.03.R':'rightIndexDistal',
  'DEF-f_middle.01.R':'rightMiddleProximal','DEF-f_middle.02.R':'rightMiddleIntermediate','DEF-f_middle.03.R':'rightMiddleDistal',
  'DEF-f_ring.01.R':'rightRingProximal','DEF-f_ring.02.R':'rightRingIntermediate','DEF-f_ring.03.R':'rightRingDistal',
  'DEF-f_pinky.01.R':'rightLittleProximal','DEF-f_pinky.02.R':'rightLittleIntermediate','DEF-f_pinky.03.R':'rightLittleDistal',
};
const MAP = Object.fromEntries(Object.entries(RAW).map(([k,v])=>[THREE.PropertyBinding.sanitizeNodeName(k),v]));

// Prepare the source library once: compute each bone's T-pose world rotation (from the A_TPose clip)
export function prepareLibrary(gltf){
  const src = gltf.scene;
  const tpose = gltf.animations.find(a=>a.name==='A_TPose');
  const mixer = new THREE.AnimationMixer(src);
  if(tpose){ mixer.clipAction(tpose).play(); mixer.update(0); }
  src.updateMatrixWorld(true);
  const rest = {};
  for(const name of Object.keys(MAP)){
    const n = src.getObjectByName(name); if(!n) continue;
    const w = new THREE.Quaternion(); n.getWorldQuaternion(w);
    const p = new THREE.Quaternion(); n.parent.getWorldQuaternion(p);
    rest[name] = { invWorld: w.clone().invert(), parentWorld: p };
  }
  const hips = src.getObjectByName('DEF-hips'); const hp = new THREE.Vector3(); hips.getWorldPosition(hp);
  mixer.stopAllAction(); mixer.uncacheRoot(src);
  return { clips: gltf.animations, rest, hipsHeight: hp.y, scene: src };
}

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
export function retargetClip(lib, clip, vrm, { inPlace = true } = {}){
  const tracks = [];
  const isV0 = vrm.meta?.metaVersion === '0';
  const vrmHipsY = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(_v).y - vrm.scene.getWorldPosition(new THREE.Vector3()).y;
  const scale = Math.abs(vrmHipsY) / lib.hipsHeight;
  for(const track of clip.tracks){
    const [boneName, prop] = track.name.split('.');
    const vrmBone = MAP[boneName]; if(!vrmBone) continue;
    const node = vrm.humanoid.getNormalizedBoneNode(vrmBone); if(!node) continue;
    const r = lib.rest[boneName]; if(!r) continue;
    if(prop === 'quaternion'){
      const vals = new Float32Array(track.values.length);
      for(let i=0;i<track.values.length;i+=4){
        _q.fromArray(track.values, i).premultiply(r.parentWorld).multiply(r.invWorld);
        vals[i] = isV0 ? -_q.x : _q.x; vals[i+1] = _q.y; vals[i+2] = isV0 ? -_q.z : _q.z; vals[i+3] = _q.w;
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, track.times, vals));
    } else if(prop === 'position' && vrmBone === 'hips'){
      // source positions are in the parent (root) space; convert to world then scale
      const vals = new Float32Array(track.values.length);
      const parentM = lib.scene.getObjectByName(boneName).parent.matrixWorld;
      for(let i=0;i<track.values.length;i+=3){
        _v.fromArray(track.values, i).applyMatrix4(parentM);
        vals[i] = (isV0 ? -_v.x : _v.x) * scale * (inPlace ? 0 : 1);
        vals[i+1] = _v.y * scale;
        vals[i+2] = (isV0 ? -_v.z : _v.z) * scale * (inPlace ? 0 : 1);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${node.name}.position`, track.times, vals));
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
