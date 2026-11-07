import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_KEYS,
  assignKey,
  loadKeys,
  ShotCharge,
} from '../src/controls.js';
import { SquashGame, traceFlight, planShot } from '../src/engine.js';
import { chooseTacticalShot } from '../src/tactics.js';
import { impactSamples } from '../src/audio.js';
import { contactPower } from '../src/strike.js';

test('rebinding A to Straight swaps movement and persists a unique complete mapping', () => {
  const changed = assignKey(DEFAULT_KEYS, 'drive', 'KeyA');
  assert.equal(changed.swapped, 'left');
  assert.equal(changed.bindings.left, 'KeyZ');
  assert.equal(changed.bindings.drive, 'KeyA');
  assert.equal(
    new Set(Object.values(changed.bindings)).size,
    Object.keys(DEFAULT_KEYS).length,
  );
  assert.deepEqual(
    loadKeys(JSON.parse(JSON.stringify(changed.bindings))),
    changed.bindings,
  );
  assert.ok(assignKey(changed.bindings, 'drive', 'Escape').error);
  assert.ok(assignKey(changed.bindings, 'drive', 'ArrowLeft').error);
  assert.deepEqual(loadKeys({ ...DEFAULT_KEYS, swing: 'KeyA' }), DEFAULT_KEYS);
});

test('charge grows with hold duration, caps, owns its input and cancels cleanly', () => {
  let now = 0;
  const charge = new ShotCharge(() => now);
  assert.equal(charge.begin('touch1'), true);
  assert.equal(charge.begin('touch2'), false);
  assert.equal(charge.power, 0.35);
  now = 450;
  assert.ok(charge.power > 0.65 && charge.power < 0.7);
  assert.equal(charge.release('touch2'), null);
  now = 1200;
  assert.equal(charge.release('touch1'), 1);
  charge.begin('Space');
  charge.cancel();
  assert.equal(charge.release('Space'), null);
});

function contactGame() {
  const game = new SquashGame({
    assist: false,
    footwork: false,
    rng: () => 0.5,
  });
  Object.assign(game, { phase: 'rally', turn: 0, sinceHit: 1 });
  Object.assign(game.players[0], { x: -1.65, z: 6, vx: 0, vz: 0 });
  Object.assign(game.ball, {
    x: -1,
    y: 0.8,
    z: 6,
    vx: 0,
    vy: 0,
    vz: 0,
    frontHit: true,
    bounces: 1,
  });
  game.drainEvents();
  return game;
}
test('charged contacts produce physically different speed and depth, while serves stay legal', () => {
  const results = [0.35, 0.65, 1].map((power) => {
    const game = contactGame();
    assert.equal(game.requestShot(null, power), true);
    const event = game.drainEvents().find((e) => e.type === 'hit');
    const trace = traceFlight(game.ball);
    assert.equal(trace.fault, undefined);
    assert.ok(Math.abs(trace.landing.z - event.target.z) < 0.18);
    return { depth: trace.landing.z, speed: Math.abs(game.ball.vz) };
  });
  assert.ok(
    results[0].depth < results[1].depth && results[1].depth < results[2].depth,
  );
  assert.ok(results[0].speed < results[2].speed);
  for (const power of [0.35, 1]) {
    const plan = planShot(
      { x: -1, y: 1.05, z: 6 },
      'drive',
      0,
      null,
      true,
      power,
    );
    assert.equal(plan.fault, undefined);
    assert.ok(plan.landing.z > 6);
    assert.ok(plan.front.y > 1.7);
  }
});

test('incoming pace adds bounded carry to a controlled return', () => {
  const still = { vx: 0, vy: 0, vz: 0 },
    fast = { vx: 0, vy: 0, vz: 24 };
  assert.equal(contactPower(0.5, still), 0.5);
  assert.equal(contactPower(0.5, fast), 0.6);
  assert.equal(contactPower(1, fast), 1);
});

test('queued swing retains power and loses placement precision after a long wait', () => {
  const game = contactGame();
  game.players[0].x = 2;
  game.requestShot(null, 0.9);
  for (let i = 0; i < 30; i++) game.update(1 / 120);
  game.players[0].x = game.ball.x - 0.65;
  game.players[0].z = game.ball.z;
  game.update(1 / 120);
  const hit = game.drainEvents().find((e) => e.type === 'hit');
  assert.ok(hit);
  assert.equal(hit.power, 0.9);
  assert.ok(hit.timing < 0.9);
  assert.ok(hit.quality < 0.9);
});

test('holding a charge suppresses automatic returns and arrow aiming preserves shot selection', () => {
  const game = contactGame();
  game.assist = true;
  game.charging = true;
  game.update(1 / 120);
  assert.equal(
    game.drainEvents().some((e) => e.type === 'hit'),
    false,
  );
  game.setShot('cross');
  const before = game.shotPlan().target;
  game.nudgeTarget(-1, -1, 0.2);
  assert.equal(game.shot, 'cross');
  assert.ok(game.customTarget.x < before.x && game.customTarget.z < before.z);
  game.requestShot(null, 0.7);
  assert.ok(game.drainEvents().some((e) => e.type === 'hit'));
});

test('AI uses all five shot types, levels vary choice, and repeated drives are discouraged', () => {
  const me = { x: 1.6, z: 6.6 },
    other = { x: -1, z: 5.5 },
    ball = { x: 1.5, y: 0.8, z: 6.5 };
  const sample = (level, history) => {
    const counts = {};
    for (let i = 0; i < 1000; i++) {
      const shot = chooseTacticalShot(
        'balanced',
        me,
        other,
        ball,
        (i + 0.5) / 1000,
        level,
        history,
      );
      counts[shot] = (counts[shot] || 0) + 1;
    }
    return counts;
  };
  const rookie = sample('rookie'),
    pro = sample('pro');
  assert.deepEqual(Object.keys(pro).sort(), [
    'boast',
    'cross',
    'drive',
    'drop',
    'lob',
  ]);
  assert.ok(pro.cross > rookie.cross);
  assert.ok(
    sample('club', { shot: 'drive', count: 3 }).drive <
      sample('club', {}).drive,
  );
});

test('court surfaces have distinct bounded transients that decay instead of continuous tones', () => {
  const samples = ['floor', 'front', 'side', 'back', 'clean', 'tin'].map(
    (kind) => impactSamples(kind, 24000),
  );
  for (const data of samples) {
    assert.ok(
      data.every((value) => Number.isFinite(value) && Math.abs(value) < 1.5),
    );
    const energy = (data) =>
      data.reduce((sum, v) => sum + v * v, 0) / data.length;
    assert.ok(
      energy(data.slice(0, Math.floor(data.length / 4))) >
        energy(data.slice(-Math.floor(data.length / 4))) * 3,
    );
  }
  assert.notDeepEqual(samples[0].slice(0, 100), samples[1].slice(0, 100));
  assert.notDeepEqual(
    impactSamples('front', 24000, 0),
    impactSamples('front', 24000, 1),
  );
});
