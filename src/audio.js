// Original synthesized rubber-ball impacts and short court reflections.
const contexts = new WeakMap();
const PROFILES = {
  front: {
    length: 0.22,
    low: 230,
    high: 580,
    decay: 30,
    noise: 0.8,
    room: 0.2,
  },
  side: {
    length: 0.18,
    low: 310,
    high: 760,
    decay: 36,
    noise: 0.82,
    room: 0.17,
  },
  back: {
    length: 0.25,
    low: 420,
    high: 980,
    decay: 26,
    noise: 0.85,
    room: 0.24,
  },
  floor: {
    length: 0.13,
    low: 105,
    high: 290,
    decay: 48,
    noise: 0.65,
    room: 0.08,
  },
  racket: {
    length: 0.11,
    low: 460,
    high: 1600,
    decay: 62,
    noise: 0.88,
    room: 0.15,
  },
  clean: {
    length: 0.11,
    low: 460,
    high: 1600,
    decay: 62,
    noise: 0.88,
    room: 0.15,
  },
  stretch: {
    length: 0.12,
    low: 260,
    high: 900,
    decay: 50,
    noise: 0.82,
    room: 0.13,
  },
  tin: {
    length: 0.42,
    low: 920,
    high: 2380,
    decay: 14,
    noise: 0.4,
    room: 0.25,
  },
  step: {
    length: 0.09,
    low: 70,
    high: 160,
    decay: 65,
    noise: 0.75,
    room: 0.05,
  },
  squeak: {
    length: 0.12,
    low: 1400,
    high: 2200,
    decay: 38,
    noise: 0.3,
    room: 0.08,
  },
};
export function impactSamples(kind, sampleRate, variant = 0) {
  const profile = PROFILES[kind] || PROFILES.front;
  const samples = new Float32Array(Math.ceil(sampleRate * profile.length));
  let seed = 12345 + variant * 7919,
    filtered = 0,
    previous = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const t = i / sampleRate;
    filtered += (noise - filtered) * (kind === 'floor' ? 0.13 : 0.36);
    const transient = filtered - previous * 0.55;
    previous = filtered;
    const detune = 1 + variant * 0.017;
    const body =
      Math.sin(2 * Math.PI * profile.low * detune * t) *
        Math.exp(-t * profile.decay * 1.6) +
      0.32 *
        Math.sin(2 * Math.PI * profile.high * detune * t) *
        Math.exp(-t * profile.decay * 2.3);
    const attack = Math.min(1, i / Math.max(1, sampleRate * 0.0006));
    samples[i] =
      attack *
      (profile.noise * transient * 1.7 * Math.exp(-t * profile.decay) +
        (1 - profile.noise) * body);
  }
  return samples;
}
export function courtSound(context, kind, volume = 0.12, impact = {}) {
  let state = contexts.get(context);
  if (!state) {
    state = { buffers: new Map(), count: 0 };
    contexts.set(context, state);
  }
  const variant = state.count++ % 4;
  const key = `${kind}-${variant}`;
  let buffer = state.buffers.get(key);
  if (!buffer) {
    const samples = impactSamples(kind, context.sampleRate, variant);
    buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    state.buffers.set(key, buffer);
  }
  const source = context.createBufferSource(),
    gain = context.createGain();
  const speed = Number.isFinite(impact.speed)
    ? Math.min(1, Math.max(0.1, impact.speed / 20))
    : 0.75;
  gain.gain.value = volume * (0.4 + speed * 0.8);
  source.buffer = buffer;
  source.connect(gain);
  const panner = context.createStereoPanner?.();
  if (panner) {
    panner.pan.value = Math.max(-0.65, Math.min(0.65, (impact.x || 0) / 5));
    gain.connect(panner);
    panner.connect(context.destination);
  } else gain.connect(context.destination);
  const nodes = [source, gain];
  if (panner) nodes.push(panner);
  const room = (PROFILES[kind] || PROFILES.front).room;
  for (const [time, amount] of [
    [0.038, room],
    [0.079, room * 0.45],
  ]) {
    const delay = context.createDelay(),
      reflection = context.createGain();
    delay.delayTime.value = time;
    reflection.gain.value = amount;
    gain.connect(delay);
    delay.connect(reflection);
    reflection.connect(context.destination);
    nodes.push(delay, reflection);
  }
  source.onended = () =>
    setTimeout(() => nodes.forEach((node) => node.disconnect()), 150);
  source.start();
}

export class FootstepAudio {
  constructor() {
    this.players = new WeakMap();
  }
  update(game, dt, play) {
    if (game.paused || game.phase !== 'rally') return;
    for (const [id, p] of game.players.entries()) {
      if (game.mode === 'practice' && id === 1) continue;
      const speed = Math.hypot(p.vx, p.vz);
      let state = this.players.get(p);
      if (!state) {
        state = { x: p.x, z: p.z, distance: 0, speed, cooldown: 0 };
        this.players.set(p, state);
      }
      state.distance += Math.hypot(p.x - state.x, p.z - state.z);
      state.cooldown = Math.max(0, state.cooldown - dt);
      if (state.distance > 0.65 && speed > 0.5) {
        play('step', 0.035);
        state.distance %= 0.65;
      }
      if (
        state.speed - speed > dt * 14 &&
        state.speed > 2 &&
        state.cooldown === 0
      ) {
        play('squeak', 0.035);
        state.cooldown = 0.45;
      }
      Object.assign(state, { x: p.x, z: p.z, speed });
    }
  }
}
