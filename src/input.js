export function createInput({
  stickElement,
  knob,
  enabled,
  onChargeStart,
  onChargeEnd,
  onCancel,
  bindings,
  arrowsAim,
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
    onCancel?.();
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
    if (
      e.target.closest('input,select,textarea') ||
      e.metaKey ||
      e.altKey ||
      e.ctrlKey
    )
      return;
    const mapping = bindings();
    const action = Object.keys(mapping).find(
      (name) => mapping[name] === e.code,
    );
    if (e.code === 'Escape' || action === 'pause') {
      if (!e.repeat) {
        if (e.code !== 'Escape') e.preventDefault();
        onPause(e);
      }
      return;
    }
    if (!enabled()) return;
    if (
      action ||
      e.code.startsWith('Arrow') ||
      ['Digit1', 'Digit2', 'Digit3'].includes(e.code)
    )
      e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (
      action === 'swing' ||
      ['drive', 'cross', 'drop', 'lob', 'boast'].includes(action)
    ) {
      onChargeStart(e.code, action === 'swing' ? null : action);
    } else if (action === 'camera') onCamera();
    else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code))
      onAim(Number(e.code.slice(-1)) - 2);
  });
  document.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    onChargeEnd(e.code);
  });
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
    sample: () => {
      const mapping = bindings();
      const held = (action) => keys.has(mapping[action]);
      const arrowX =
        Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
      const arrowZ =
        Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
      return {
        x:
          Number(held('right')) -
          Number(held('left')) +
          stick.x +
          (arrowsAim() ? 0 : arrowX),
        z:
          Number(held('back')) -
          Number(held('forward')) +
          stick.z +
          (arrowsAim() ? 0 : arrowZ),
        aimX: arrowsAim() ? arrowX : 0,
        aimZ: arrowsAim() ? arrowZ : 0,
        recover: held('recover'),
      };
    },
  };
}
