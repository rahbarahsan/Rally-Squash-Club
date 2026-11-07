import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisplay } from '../src/display.js';
import { PracticeChallenge } from '../src/practice.js';
import { chooseTacticalShot } from '../src/tactics.js';
import { contactFeedback } from '../src/feedback.js';
import { SquashGame, strikeCrouch } from '../src/engine.js';

test('landscape lock is explicit, unlocks on fullscreen exit, and handles unsupported browsers', async () => {
  const document = new EventTarget();
  const messages = [],
    states = [],
    calls = [];
  const screen = {
    orientation: {
      lock: async (value) => calls.push(value),
      unlock: () => calls.push('unlock'),
    },
  };
  const element = {
    requestFullscreen: async () => {
      document.fullscreenElement = element;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
  };
  document.exitFullscreen = async () => {
    document.fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  const display = createDisplay({
    element,
    document,
    screen,
    onMessage: (m) => messages.push(m),
    onChange: (state) => states.push(state),
  });
  assert.deepEqual(calls, []);
  await display.landscape();
  assert.equal(states.at(-1).locked, true);
  assert.deepEqual(calls, ['landscape']);
  await display.fullscreen();
  assert.equal(states.at(-1).locked, false);
  assert.deepEqual(calls, ['landscape', 'unlock']);
  screen.orientation.lock = async () => {
    throw new Error('Unsupported');
  };
  await display.landscape();
  assert.equal(states.at(-1).pending, false);
  assert.equal(states.at(-1).locked, false);
  assert.match(messages.at(-1), /Turn your phone sideways/);
});

test('missing display APIs degrade to manual rotation without throwing', async () => {
  const messages = [];
  const display = createDisplay({
    element: {},
    document: new EventTarget(),
    screen: {},
    onMessage: (m) => messages.push(m),
    onChange: () => {},
  });
  await display.landscape();
  await display.fullscreen();
  assert.equal(messages.length, 2);
  assert.match(messages[0], /rotation lock/);
});

test('deep-target drill counts actual first bounces, excluding serves and repeated bounces', () => {
  const drill = new PracticeChallenge('length');
  const bounce = { type: 'bounce', surface: 'floor', x: 2.6, z: 7.5 };
  drill.observe({ type: 'hit', id: 0, serve: true });
  drill.observe(bounce);
  assert.equal(drill.progress, 0);
  drill.observe({ type: 'hit', id: 0 });
  drill.observe({ ...bounce, x: 0 });
  drill.observe(bounce);
  assert.equal(drill.progress, 0);
  for (let i = 0; i < 5; i++) {
    drill.observe({ type: 'hit', id: 0 });
    drill.observe(bounce);
    drill.observe(bounce);
    assert.equal(drill.progress, i + 1);
  }
  assert.equal(drill.complete, true);
  drill.observe({ type: 'point' });
  assert.equal(drill.progress, 5);
});

test('rally challenge resets its streak after a fault while retaining the session best', () => {
  const drill = new PracticeChallenge('rally');
  for (let i = 0; i < 4; i++) drill.observe({ type: 'hit', id: 0 });
  drill.observe({ type: 'point' });
  assert.equal(drill.progress, 0);
  assert.equal(drill.best, 4);
  for (let i = 0; i < 10; i++) drill.observe({ type: 'hit', id: 0 });
  assert.equal(drill.complete, true);
  assert.equal(new PracticeChallenge('unknown').id, 'free');
});

test('recovery earns one credit per return and never while paused or between points', () => {
  const drill = new PracticeChallenge('recovery');
  const player = { x: 0, z: 5.5 };
  drill.observe({ type: 'hit', id: 0 });
  drill.update(player, 'rally', true);
  drill.update(player, 'point', false);
  assert.equal(drill.progress, 0);
  drill.update({ x: 2, z: 7 }, 'rally', false);
  assert.equal(drill.progress, 0);
  drill.update(player, 'rally', false);
  drill.update(player, 'rally', false);
  assert.equal(drill.progress, 1);
  drill.observe({ type: 'hit', id: 0 });
  drill.observe({ type: 'point' });
  drill.update(player, 'rally', false);
  assert.equal(drill.progress, 1);
});

test('opponent styles make distinct tactical choices but defend stretched back-court balls', () => {
  const me = { x: 0, z: 3 },
    other = { x: 0, z: 8 },
    ball = { x: 0.5, y: 0.8, z: 3 };
  assert.equal(chooseTacticalShot('patient', me, other, ball, 0.5), 'drive');
  assert.equal(chooseTacticalShot('attacker', me, other, ball, 0.5), 'drop');
  for (const style of ['patient', 'attacker', 'balanced']) {
    assert.equal(
      chooseTacticalShot(style, me, other, { x: 2.5, y: 0.2, z: 9 }, 0.5),
      'lob',
    );
    let seed = 42;
    const game = new SquashGame({
      opponent: style,
      difficulty: 'club',
      rng: () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 4294967296;
      },
    });
    for (let i = 0; i < 120000 && game.phase !== 'over'; i++) {
      if (game.phase === 'ready') game.requestShot();
      game.update(1 / 120);
    }
    assert.equal(game.phase, 'over', style);
    assert.ok(game.score.some((score) => score >= 11));
  }
});

test('manual swing feedback distinguishes early requests and expired out-of-reach swings', () => {
  const game = new SquashGame({ assist: false, footwork: false });
  game.requestShot();
  game.drainEvents();
  game.requestShot();
  assert.equal(game.drainEvents()[0].reason, 'early');
  Object.assign(game, { turn: 0, buffer: 0.001, sinceHit: 1 });
  Object.assign(game.ball, {
    x: 2.5,
    y: 1,
    z: 3,
    vx: 0,
    vy: 0,
    vz: 0,
    frontHit: true,
  });
  game.update(1 / 120);
  assert.equal(
    game.drainEvents().find((e) => e.type === 'swing-feedback').reason,
    'reach',
  );
  assert.equal(
    contactFeedback({ type: 'hit', id: 0, quality: 0.8 }).title,
    'Stretched return',
  );
  assert.equal(
    contactFeedback({ type: 'hit', id: 0, quality: 1, volley: true }).title,
    'Clean volley',
  );
  assert.equal(contactFeedback({ type: 'hit', id: 1 }), null);
  assert.ok(strikeCrouch(1.5) < 0.1);
  assert.ok(strikeCrouch(0.2) > 0.3);
});

test('all practice challenges can finish using actual simulation events', () => {
  for (const id of ['length', 'rally', 'recovery']) {
    const game = new SquashGame({ mode: 'practice', rng: () => 0.5 });
    const drill = new PracticeChallenge(id);
    let steps = 0;
    for (; steps < 120000 && !drill.complete; steps++) {
      if (game.phase === 'ready') game.requestShot();
      game.update(1 / 120, {
        x: 0,
        z: 0,
        recover: id === 'recovery' && drill.pendingRecovery,
      });
      for (const event of game.drainEvents()) drill.observe(event);
      drill.update(game.players[0], game.phase, game.paused);
    }
    assert.equal(
      drill.complete,
      true,
      `${id} did not finish after ${steps} steps`,
    );
    assert.equal(drill.progress, drill.definition.goal);
  }
});
