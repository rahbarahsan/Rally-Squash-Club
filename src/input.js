export function createInput({
  stickElement,
  knob,
  enabled,
  onHit,
  onAim,
  onCamera,
  onPause,
  onBlur,
}) {
  const keys = new Set();
  let pointer = null,
    stick = { x: 0, z: 0 };
  function reset() {
    keys.clear();
    if (pointer !== null && stickElement.hasPointerCapture(pointer))
      stickElement.releasePointerCapture(pointer);
    pointer = null;
    stick = { x: 0, z: 0 };
    knob.style.transform = '';
  }
  function move(e) {
    if (e.pointerId !== pointer) return;
    const r = stickElement.getBoundingClientRect(),
      max = r.width * 0.34;
    if (max <= 0) return;
    let x = (e.clientX - r.left - r.width / 2) / max,
      z = (e.clientY - r.top - r.height / 2) / max;
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    stick = { x, z };
    knob.style.transform = `translate(${x * max}px,${z * max}px)`;
  }
  stickElement.addEventListener('pointerdown', (e) => {
    if (!enabled() || pointer !== null) return;
    e.preventDefault();
    pointer = e.pointerId;
    stickElement.setPointerCapture(pointer);
    move(e);
  });
  stickElement.addEventListener('pointermove', move);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    stickElement.addEventListener(event, (e) => {
      if (e.pointerId === pointer) {
        pointer = null;
        stick = { x: 0, z: 0 };
        knob.style.transform = '';
      }
    });
  document.addEventListener('keydown', (e) => {
    if (['Escape', 'KeyP'].includes(e.code)) {
      if (!e.repeat) onPause(e);
      return;
    }
    if (!enabled() || e.target.closest('input,select,textarea')) return;
    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        e.code,
      )
    )
      e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    const shots = {
      KeyZ: 'drive',
      KeyC: 'cross',
      KeyE: 'drop',
      KeyQ: 'lob',
      KeyB: 'boast',
    };
    if (e.code === 'Space') onHit();
    else if (shots[e.code]) onHit(shots[e.code]);
    else if (e.code === 'KeyV') onCamera();
    else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code))
      onAim(Number(e.code.slice(-1)) - 2);
  });
  document.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    reset();
    onBlur();
  });
  window.addEventListener('resize', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      reset();
      onBlur();
    }
  });
  return {
    reset,
    sample: () => ({
      x:
        Number(keys.has('KeyD') || keys.has('ArrowRight')) -
        Number(keys.has('KeyA') || keys.has('ArrowLeft')) +
        stick.x,
      z:
        Number(keys.has('KeyS') || keys.has('ArrowDown')) -
        Number(keys.has('KeyW') || keys.has('ArrowUp')) +
        stick.z,
      recover: keys.has('KeyR'),
    }),
  };
}
