export const DRILLS = {
  free: {
    name: 'Free practice',
    description: 'Find your rhythm with no finish line.',
    goal: 0,
  },
  length: {
    name: 'Deep targets',
    description: 'Land five returns in the highlighted back corners.',
    goal: 5,
  },
  rally: {
    name: 'Ten-return rally',
    description: 'Make ten returns in a row. A fault restarts the count.',
    goal: 10,
  },
  recovery: {
    name: 'Own the T',
    description: 'Return to the T after five of your shots.',
    goal: 5,
  },
};
export class PracticeChallenge {
  constructor(id = 'free') {
    this.id = DRILLS[id] ? id : 'free';
    this.definition = DRILLS[this.id];
    this.progress = 0;
    this.best = 0;
    this.complete = false;
    this.pendingLanding = false;
    this.pendingRecovery = false;
  }
  score() {
    if (this.complete) return;
    this.progress++;
    this.best = Math.max(this.best, this.progress);
    this.complete = this.progress >= this.definition.goal;
  }
  observe(event) {
    if (this.complete || this.id === 'free') return;
    if (event.type === 'hit') {
      this.pendingLanding = event.id === 0 && !event.serve;
      this.pendingRecovery = event.id === 0 && !event.serve;
      if (this.pendingLanding && this.id === 'rally') this.score();
    }
    if (
      event.type === 'bounce' &&
      event.surface === 'floor' &&
      this.pendingLanding
    ) {
      this.pendingLanding = false;
      if (this.id === 'length' && Math.abs(event.x) >= 1.9 && event.z >= 6.8)
        this.score();
    }
    if (event.type === 'point' || event.type === 'ready') {
      this.pendingLanding = false;
      this.pendingRecovery = false;
      if (this.id === 'rally') this.progress = 0;
    }
  }
  update(player, phase, paused) {
    if (
      paused ||
      phase !== 'rally' ||
      this.complete ||
      this.id !== 'recovery' ||
      !this.pendingRecovery
    )
      return;
    if (Math.hypot(player.x, player.z - 5.5) < 0.65) {
      this.pendingRecovery = false;
      this.score();
    }
  }
}
