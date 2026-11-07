import * as THREE from './vendor/three.module.js';
import { clamp, strikeCrouch } from './engine.js?v=3.1.0';
const UP = new THREE.Vector3(0, 1, 0),
  v = (x, y, z) => new THREE.Vector3(x, y, z);
const mix = (a, b, t) => a.clone().lerp(b, t);
function segment(mesh, a, b, plane = null) {
  const d = b.clone().sub(a);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.y = Math.max(0.001, d.length());
  d.normalize();
  if (plane) {
    const x = plane.clone().normalize(),
      z = x.clone().cross(d).normalize();
    if (z.lengthSq() < 1e-10) {
      x.set(Math.abs(d.x) < 0.9 ? 1 : 0, 0, Math.abs(d.x) < 0.9 ? 0 : 1);
      z.copy(x).cross(d).normalize();
    }
    x.copy(d).cross(z).normalize();
    mesh.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(x, d, z),
    );
  } else mesh.quaternion.setFromUnitVectors(UP, d);
}
function joint(a, b, l1, l2, bend) {
  const dir = b.clone().sub(a),
    d = Math.min(l1 + l2 - 0.002, Math.max(0.01, dir.length()));
  dir.normalize();
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const perpendicular = bend
    .clone()
    .addScaledVector(dir, -bend.dot(dir))
    .normalize();
  return a
    .clone()
    .addScaledVector(dir, along)
    .addScaledVector(perpendicular, h);
}
export class Athlete {
  constructor(scene, color, label, textTexture) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.phase = 0;
    this.facing = 0;
    const mat = (c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.78 });
    const skin = mat(label === 'YOU' ? 0xc18b67 : 0x976d53),
      kit = mat(color),
      dark = mat(0x183c34),
      white = mat(0xf0eddf);
    const mesh = (geo, m, parent = this.body) => {
      const a = new THREE.Mesh(geo, m);
      a.castShadow = true;
      parent.add(a);
      return a;
    };
    this.torso = mesh(new THREE.CapsuleGeometry(0.235, 0.34, 6, 16), kit);
    this.torso.scale.set(1.07, 1, 0.64);
    this.shorts = mesh(new THREE.BoxGeometry(0.39, 0.23, 0.28), dark);
    this.head = mesh(new THREE.SphereGeometry(0.158, 20, 14), skin);
    this.head.scale.set(1, 1.14, 1);
    this.hair = mesh(
      new THREE.SphereGeometry(
        0.163,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.53,
      ),
      dark,
    );
    this.neck = mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.13, 10), skin);
    this.band = mesh(
      new THREE.CylinderGeometry(0.164, 0.164, 0.035, 20),
      white,
    );
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.17),
      new THREE.MeshBasicMaterial({
        map: textTexture(label === 'YOU' ? '01' : '02', {
          width: 128,
          height: 128,
          size: 95,
          fg: '#28482e',
        }),
        transparent: true,
      }),
    );
    number.position.set(0, 1.29, 0.165);
    this.body.add(number);
    this.number = number;
    const bone = (radius, m) =>
      mesh(new THREE.CylinderGeometry(radius, radius * 0.92, 1, 12), m);
    this.legs = [-1, 1].map((side) => ({
      side,
      upper: bone(0.081, skin),
      lower: bone(0.063, skin),
      knee: mesh(new THREE.SphereGeometry(0.085, 12, 8), skin),
      sock: bone(0.068, white),
      shoe: mesh(new THREE.SphereGeometry(1, 14, 10), white),
    }));
    this.legs.forEach((l) => l.shoe.scale.set(0.086, 0.062, 0.155));
    this.arms = [-1, 1].map((side) => ({
      side,
      upper: bone(0.073, kit),
      lower: bone(0.052, skin),
      elbow: mesh(new THREE.SphereGeometry(0.06, 12, 8), skin),
      hand: mesh(new THREE.SphereGeometry(0.06, 12, 8), skin),
    }));
    this.racket = new THREE.Group();
    this.body.add(this.racket);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.023, 0.023, 0.19, 10),
      dark,
    );
    handle.position.y = 0.07;
    this.racket.add(handle);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.017, 0.23, 8),
      white,
    );
    shaft.position.y = 0.26;
    this.racket.add(shaft);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.165, 0.013, 8, 32),
      mat(0xf7f4e6),
    );
    rim.scale.set(0.8, 1.3, 1);
    rim.position.y = 0.5;
    this.racket.add(rim);
    const string = [];
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.025,
        z = Math.sqrt(Math.max(0, 1 - (x / 0.132) ** 2)) * 0.21;
      string.push(x, 0.5 - z, 0, x, 0.5 + z, 0);
      const y = i * 0.04,
        extent = Math.sqrt(Math.max(0, 1 - (y / 0.215) ** 2)) * 0.13;
      string.push(-extent, 0.5 + y, 0, extent, 0.5 + y, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(string, 3));
    this.racket.add(
      new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({
          color: 0xc8d9c9,
          transparent: true,
          opacity: 0.85,
        }),
      ),
    );
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.37, 0.395, 40),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.025;
    this.group.add(this.ring);
    this.label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textTexture(label, {
          width: 256,
          height: 80,
          size: 33,
          font: '700',
          fg: label === 'YOU' ? '#d5fa68' : '#fb9477',
          bg: '#183b31',
        }),
        transparent: true,
        depthTest: false,
      }),
    );
    this.label.position.y = 2.04;
    this.label.scale.set(0.55, 0.17, 1);
    this.group.add(this.label);
  }
  update(p, ball, dt, active) {
    this.group.position.set(p.x, 0, p.z);
    const speed = Math.hypot(p.vx, p.vz),
      weight = clamp(speed / 1.2, 0, 1);
    this.phase += (speed * dt) / 1.04;
    const swing = p.swing > 0,
      progress = 1 - p.swing / 0.48;
    const desiredFacing = swing
      ? -(p.side || 1) * Math.PI * 0.43
      : p.facing || 0;
    const diff = Math.atan2(
      Math.sin(desiredFacing - this.facing),
      Math.cos(desiredFacing - this.facing),
    );
    this.facing += diff * Math.min(1, dt * 15);
    if (p.swing > 0.46) this.facing = desiredFacing;
    this.body.rotation.y = this.facing;
    const local = (point) =>
      v(point.x - p.x, point.y, point.z - p.z).applyAxisAngle(UP, -this.facing);
    const near = Math.hypot(ball.x - p.x, ball.z - p.z);
    const lunge = swing
      ? Math.pow(1 - progress, 1.3)
      : clamp((1.65 - near) / 0.8, 0, 1) * (p.prep || 0);
    const contact = local(swing && p.contact ? p.contact : ball);
    const crouch =
      strikeCrouch(contact.y) * lunge +
      Math.sin(((p.split || 0) / 0.22) * Math.PI) * 0.055;
    const lean = clamp(contact.y < 1 ? 0.1 : 0, 0, 0.1) * lunge;
    this.torso.position.set(0, 1.24 - crouch, -lean);
    this.torso.rotation.x = -lean * 0.8;
    this.torso.rotation.z = clamp(-p.vx * 0.014, -0.065, 0.065) * (1 - lunge);
    this.torso.rotation.y = swing
      ? (p.side || 1) * Math.sin(progress * Math.PI) * 0.12
      : Math.sin(this.phase * Math.PI * 2) * weight * 0.025;
    this.shorts.position.set(0, 0.85 - crouch, 0);
    this.neck.position.set(0, 1.575 - crouch, -lean);
    this.head.position.set(0, 1.71 - crouch, -lean - 0.025);
    this.head.rotation.y =
      clamp(Math.atan2(-contact.x, -contact.z), -0.5, 0.5) * (p.prep || 0);
    this.hair.position.copy(this.head.position).y += 0.035;
    this.band.position.copy(this.head.position).y += 0.065;
    this.number.position.y = 1.29 - crouch;
    const localVelocity = v(p.vx, 0, p.vz).applyAxisAngle(UP, -this.facing);
    if (speed > 0.02) localVelocity.divideScalar(speed);
    const toward = v(contact.x, 0, contact.z).normalize();
    this.legs.forEach((leg, i) => {
      const u = (this.phase + i * 0.5) % 1;
      let offset, lift;
      if (u < 0.6) {
        offset = 0.31 - (u / 0.6) * 0.62;
        lift = 0;
      } else {
        const t = (u - 0.6) / 0.4;
        offset = -0.31 + (0.5 - 0.5 * Math.cos(t * Math.PI)) * 0.62;
        lift = Math.sin(t * Math.PI) * 0.13;
      }
      const foot = v(leg.side * 0.17, 0.065, 0).addScaledVector(
        localVelocity,
        offset * weight,
      );
      foot.y += lift * weight;
      const lead = p.side > 0 ? i === 0 : i === 1;
      foot.addScaledVector(toward, lunge * (lead ? 0.48 : -0.19));
      foot.y = 0.065 + (1 - lunge) * lift * weight;
      const hip = v(leg.side * 0.135, 0.85 - crouch, 0);
      // Preserve planted stance feet in world space until their next swing phase.
      if (!swing && lunge < 0.15 && u < 0.6 && speed > 0.1) {
        if (!leg.plant || leg.lastPhase >= 0.6) {
          leg.plant = foot
            .clone()
            .applyAxisAngle(UP, this.facing)
            .add(v(p.x, 0, p.z));
        }
        const planted = leg.plant
          .clone()
          .sub(v(p.x, 0, p.z))
          .applyAxisAngle(UP, -this.facing);
        if (planted.distanceTo(hip) < 0.855) foot.copy(planted);
        else leg.plant = null;
      } else leg.plant = null;
      leg.lastPhase = u;
      const span = foot.clone().sub(hip);
      if (span.length() > 0.855) foot.copy(hip).add(span.setLength(0.855));
      const knee = joint(hip, foot, 0.43, 0.43, v(0, 0, -1));
      segment(leg.upper, hip, knee);
      segment(leg.lower, knee, foot);
      leg.knee.position.copy(knee);
      segment(leg.sock, mix(knee, foot, 0.63), foot);
      leg.shoe.position.copy(foot).z -= 0.05;
      leg.shoe.rotation.y =
        lead && lunge > 0.3 ? Math.atan2(toward.x, -toward.z) * 0.45 : 0;
    });
    const side = p.side || 1;
    let head = mix(
      v(0.43, 1.62, -0.38),
      v(side > 0 ? 0.42 : -0.42, 1.98, 0.25),
      p.prep || 0,
    );
    if (swing) {
      const follow = v(-side * 0.6, 1.6, -0.2);
      // Hold the contact pose for the first simulation frame before following through.
      const finish = clamp((progress - 0.04) / 0.48, 0, 1);
      head = mix(contact, follow, Math.sin((finish * Math.PI) / 2));
      if (progress > 0.55)
        head.lerp(v(0.43, 1.62, -0.38), (progress - 0.55) / 0.45);
    }
    const shoulder = v(0.27, 1.46 - crouch, -lean);
    if (p.reaction)
      head = p.reaction === 'win' ? v(0.55, 2.25, -0.1) : v(0.45, 0.75, -0.25);
    const axis = swing
      ? head.clone().sub(shoulder).normalize()
      : v(side > 0 ? 0.2 : -0.2, 0.97, 0.1).normalize();
    const wrist = head.clone().addScaledVector(axis, -0.5);
    const armReach = wrist.clone().sub(shoulder);
    if (armReach.length() > 0.715)
      wrist.copy(shoulder).add(armReach.setLength(0.715));
    this.racket.position.copy(wrist);
    this.racket.quaternion.setFromUnitVectors(UP, axis);
    this.arms.forEach((arm, i) => {
      const shoulder = v(arm.side * 0.27, 1.46 - crouch, -lean),
        hand =
          i === 1
            ? wrist
            : v(
                -0.38 - lunge * 0.07,
                1.08 - crouch + lunge * 0.12,
                -0.3 -
                  lunge * 0.18 +
                  Math.sin(this.phase * Math.PI * 2) *
                    weight *
                    0.1 *
                    (1 - lunge),
              );
      const elbow = joint(
        shoulder,
        hand,
        0.36,
        0.36,
        i === 1 ? v(0.7, -0.5, 0.4) : v(-0.7, -0.5, 0.4),
      );
      const plane = elbow
        .clone()
        .sub(shoulder)
        .cross(hand.clone().sub(elbow))
        .normalize();
      segment(arm.upper, shoulder, elbow, plane);
      segment(arm.lower, elbow, hand, plane);
      arm.elbow.position.copy(elbow);
      arm.hand.position.copy(hand);
    });
    this.ring.material.opacity = active ? 0.85 : 0.32;
  }
}
