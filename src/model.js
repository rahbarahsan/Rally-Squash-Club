import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Quaternion,
  Vector3,
} from './vendor/three.module.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

export function animationState(p, game, id) {
  if (game.phase === 'over' || game.phase === 'point')
    return game.lastWinner === id ? 'Win' : 'Lose';
  if (p.swing > 0)
    return p.stroke === 'serve'
      ? 'Serve'
      : p.stroke === 'volley'
        ? 'Volley'
        : p.contact?.y < 0.45
          ? 'Lunge'
          : p.side > 0
            ? 'Forehand'
            : 'Backhand';
  if (p.split > 0) return 'Split';
  if (Math.hypot(p.vx, p.vz) > 0.3)
    return game.turn === id ? 'Move' : 'Recover';
  return 'Ready';
}
export async function attachModel(athlete, color) {
  try {
    const gltf = await new GLTFLoader().loadAsync(
      './models/athlete.glb?v=3.1.0',
    );
    const targets = {
      Torso: athlete.torso,
      Shorts: athlete.shorts,
      Head: athlete.head,
      Neck: athlete.neck,
      Racket: athlete.racket,
    };
    for (const [i, label] of ['L', 'R'].entries())
      Object.assign(targets, {
        ['UpperArm' + label]: athlete.arms[i].upper,
        ['LowerArm' + label]: athlete.arms[i].lower,
        ['Hand' + label]: athlete.arms[i].hand,
        ['Thigh' + label]: athlete.legs[i].upper,
        ['Shin' + label]: athlete.legs[i].lower,
        ['Shoe' + label]: athlete.legs[i].shoe,
      });
    const bindings = Object.entries(targets).map(([name, target]) => ({
      name,
      target,
      bone: gltf.scene.getObjectByName(name),
    }));
    if (bindings.some((b) => !b.bone))
      throw new Error('Athlete rig is missing required attachment bones');
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        const recolor = (m) => {
          const copy = m.clone();
          if (copy.name === 'Kit') copy.color.setHex(color);
          return copy;
        };
        o.material = Array.isArray(o.material)
          ? o.material.map(recolor)
          : recolor(o.material);
      }
    });
    athlete.body.add(gltf.scene);
    athlete.body.updateWorldMatrix(true, true);
    for (const b of bindings) b.rest = b.bone.quaternion.clone();
    const mixer = new AnimationMixer(gltf.scene),
      actions = new Map(
        gltf.animations.map((c) => [c.name, mixer.clipAction(c)]),
      );
    const position = new Vector3(),
      rotation = new Quaternion(),
      parentRotation = new Quaternion(),
      accent = new Quaternion();
    let current, nameBefore;
    athlete.animateModel = (p, dt, game, id) => {
      const name = animationState(p, game, id),
        next = actions.get(name);
      // Restore the bind rotation before sampling so procedural IK cannot feed back into clips.
      for (const b of bindings) b.bone.quaternion.copy(b.rest);
      if (next && name !== nameBefore) {
        next
          .reset()
          .setLoop(
            ['Ready', 'Move', 'Recover'].includes(name) ? LoopRepeat : LoopOnce,
            Infinity,
          )
          .fadeIn(0.08)
          .play();
        next.clampWhenFinished = true;
        current?.fadeOut(0.08);
        current = next;
        nameBefore = name;
      }
      if (current && p.swing > 0) {
        current.timeScale = 0;
        current.time = (1 - p.swing / 0.48) * current.getClip().duration;
      } else if (current) current.timeScale = 1;
      mixer.update(dt);
      athlete.body.updateWorldMatrix(true, true);
      for (const b of bindings) {
        accent.copy(b.rest).invert().multiply(b.bone.quaternion);
        b.target.getWorldPosition(position);
        b.target.getWorldQuaternion(rotation);
        b.bone.parent.updateWorldMatrix(true, false);
        b.bone.position.copy(b.bone.parent.worldToLocal(position));
        b.bone.parent.getWorldQuaternion(parentRotation);
        b.bone.quaternion.copy(parentRotation.invert().multiply(rotation));
        if (b.name === 'Torso' || b.name === 'Head')
          b.bone.quaternion.multiply(accent);
        b.bone.updateWorldMatrix(false, true);
      }
    };
    for (const child of athlete.body.children)
      if (child !== gltf.scene) child.visible = false;
    athlete.group.userData.modelLoaded = true;
    return true;
  } catch (error) {
    console.warn('Athlete asset unavailable; using procedural athlete.', error);
    return false;
  }
}
