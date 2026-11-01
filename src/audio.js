// Original procedural court sounds: no downloaded recordings or runtime services.
const buffers = new WeakMap();
export function courtSound(context, kind, volume = 0.12) {
  const length = kind === 'tin' ? 0.4 : 0.16;
  let cache = buffers.get(context);
  if (!cache) {
    cache = new Map();
    buffers.set(context, cache);
  }
  let buffer = cache.get(kind);
  if (!buffer) {
    buffer = context.createBuffer(
      1,
      context.sampleRate * length,
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    const frequency =
      {
        racket: 180,
        front: 110,
        back: 130,
        floor: 75,
        side: 150,
        tin: 1200,
        step: 60,
        squeak: 900,
      }[kind] || 140;
    for (let i = 0; i < data.length; i++) {
      const t = i / context.sampleRate;
      data[i] =
        (Math.sin(t * frequency * Math.PI * 2) * 0.55 +
          (Math.random() * 2 - 1) * 0.45) *
        Math.exp(-t * (kind === 'tin' ? 14 : 45));
    }
    cache.set(kind, buffer);
  }
  const source = context.createBufferSource(),
    gain = context.createGain(),
    delay = context.createDelay();
  source.buffer = buffer;
  gain.gain.value = volume;
  delay.delayTime.value = 0.055;
  const reflection = context.createGain();
  reflection.gain.value = 0.18;
  source.connect(gain);
  gain.connect(context.destination);
  gain.connect(delay);
  delay.connect(reflection);
  reflection.connect(context.destination);
  source.start();
  source.onended = () =>
    setTimeout(() => {
      source.disconnect();
      gain.disconnect();
      delay.disconnect();
      reflection.disconnect();
    }, 200);
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
