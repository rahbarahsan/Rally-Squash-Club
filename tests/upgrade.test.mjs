import test from 'node:test';
import assert from 'node:assert/strict';
import { SquashGame } from '../src/engine.js';
import { RallyTutorial } from '../src/tutorial.js';
import { animationState } from '../src/model.js';
import { updatePath } from '../src/path.js';
import { Athlete } from '../src/athlete.js';
import * as T from '../src/vendor/three.module.js';
import { readFile } from 'node:fs/promises';

test('manual stretch reduces placement quality; assisted shots remain exact', () => {
  const run = (assist, x) => {
    const g = new SquashGame({ assist, rng: () => 0.5 });
    g.players[0].x = x;
    g.players[0].z = 6;
    g.ball = {
      x: -1,
      y: 0.8,
      z: 6,
      vx: 0,
      vy: 0,
      vz: 0,
      bounces: 1,
      frontHit: true,
    };
    g.launch(0, 'drive');
    return g.drainEvents().find((e) => e.type === 'hit');
  };
  const clean = run(false, -1.65),
    stretch = run(false, -2.08),
    assisted = run(true, -2.08);
  assert.equal(clean.quality, 1);
  assert.ok(stretch.quality < 0.9);
  assert.ok(stretch.target.z < clean.target.z);
  assert.equal(assisted.quality, 1);
  assert.deepEqual(assisted.target, clean.target);
});
test('reachable contact puts the racket on the ball with bounded arms', () => {
  const a = new Athlete(new T.Scene(), 0xffffff, 'YOU', () => new T.Texture());
  let cases = 0;
  for (const side of [-1, 1])
    for (const y of [0.2, 0.8, 1.7])
      for (const dx of [0.55, 0.8, 1]) {
        const g = new SquashGame();
        const p = g.players[0];
        Object.assign(p, { x: 0, z: 0 });
        Object.assign(g.ball, {
          x: side * dx,
          y,
          z: -0.22,
          frontHit: true,
          bounces: 1,
        });
        g.phase = 'rally';
        g.turn = 0;
        g.sinceHit = 1;
        if (!g.canHit(0)) continue;
        g.launch(0);
        a.update(p, g.ball, 0, true);
        a.group.updateMatrixWorld(true);
        const head = a.racket.localToWorld(new T.Vector3(0, 0.5, 0));
        assert.ok(
          head.distanceTo(
            new T.Vector3(p.contact.x, p.contact.y, p.contact.z),
          ) < 0.015,
        );
        assert.ok(a.arms[1].upper.scale.y <= 0.361);
        assert.ok(a.arms[1].lower.scale.y <= 0.361);
        cases++;
      }
  assert.ok(cases >= 8);
});
test('tutorial progresses only on its expected gameplay event', () => {
  const t = new RallyTutorial();
  t.start();
  t.observe('return');
  assert.equal(t.step, 0);
  for (const e of ['serve', 'aim', 'select', 'return', 'recover']) t.observe(e);
  assert.equal(t.active, false);
  assert.equal(t.step, 5);
  t.start();
  t.stop();
  assert.equal(t.active, false);
});
test('animation states cover serving, volley, low lunge, recovery and reactions', () => {
  const p = {
    swing: 0.4,
    stroke: 'serve',
    side: 1,
    contact: { y: 0.2 },
    vx: 0,
    vz: 0,
  };
  const g = { phase: 'rally', turn: 1 };
  assert.equal(animationState(p, g, 0), 'Serve');
  p.stroke = 'volley';
  assert.equal(animationState(p, g, 0), 'Volley');
  p.stroke = 'ground';
  assert.equal(animationState(p, g, 0), 'Lunge');
  p.swing = 0;
  p.vx = 1;
  assert.equal(animationState(p, g, 0), 'Recover');
  g.phase = 'point';
  g.lastWinner = 0;
  assert.equal(animationState(p, g, 0), 'Win');
  assert.equal(animationState(p, g, 1), 'Lose');
});
test('trajectory updates reuse buffers and discard the previous draw range', () => {
  const geometry = new T.BufferGeometry();
  const points = Array.from({ length: 100 }, (_, i) => ({
    x: i,
    y: i * 0.1,
    z: 0,
  }));
  updatePath(geometry, points);
  const position = geometry.getAttribute('position'),
    distance = geometry.getAttribute('lineDistance');
  for (let i = 0; i < 300; i++) updatePath(geometry, points.slice(0, 20));
  assert.equal(geometry.getAttribute('position'), position);
  assert.equal(geometry.getAttribute('lineDistance'), distance);
  assert.equal(geometry.drawRange.count, 20);
  assert.ok(distance.getX(19) > 19);
});
test('Blender export contains skins, racket and every animation clip within asset budget', async () => {
  const bytes = await readFile('public/models/athlete.glb');
  assert.ok(bytes.length < 5 * 1024 * 1024);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.ok(gltf.skins.length > 0);
  assert.ok(gltf.nodes.some((n) => n.name === 'Racket'));
  for (const name of [
    'Ready',
    'Split',
    'Move',
    'Recover',
    'Forehand',
    'Backhand',
    'Lunge',
    'Volley',
    'Serve',
    'Win',
    'Lose',
  ])
    assert.ok(gltf.animations.some((a) => a.name === name));
});
