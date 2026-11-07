export class RallyTutorial {
  constructor() {
    this.step = -1;
  }
  start() {
    this.step = 0;
  }
  get active() {
    return this.step >= 0 && this.step < 5;
  }
  get text() {
    return (
      [
        'Serve to start your first rally. Hold and release Serve or your Swing key.',
        'Choose a landing spot: tap the court or one of the four corner targets.',
        'Select Crosscourt or Drop. Selecting a shot does not swing.',
        'Return a ball. Swing assist helps; hold Swing for power, then release near contact.',
        'Let automatic footwork bring you back toward the T after your return.',
      ][this.step] || 'First rally complete. Keep exploring the angles!'
    );
  }
  observe(event) {
    const expected = ['serve', 'aim', 'select', 'return', 'recover'];
    if (this.active && event === expected[this.step]) this.step++;
    return this.step;
  }
  stop() {
    this.step = -1;
  }
}
