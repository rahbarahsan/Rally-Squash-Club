export const ACTIONS = {
  swing: 'Serve / swing',
  drive: 'Straight',
  cross: 'Crosscourt',
  drop: 'Drop',
  lob: 'Lob',
  boast: 'Boast',
  left: 'Move left',
  right: 'Move right',
  forward: 'Move forward',
  back: 'Move back',
  recover: 'Recover to T',
  camera: 'Camera',
  pause: 'Pause',
};
export const DEFAULT_KEYS = {
  swing: 'Space',
  drive: 'KeyZ',
  cross: 'KeyC',
  drop: 'KeyE',
  lob: 'KeyQ',
  boast: 'KeyB',
  left: 'KeyA',
  right: 'KeyD',
  forward: 'KeyW',
  back: 'KeyS',
  recover: 'KeyR',
  camera: 'KeyV',
  pause: 'KeyP',
};
export const keyLabel = (code) =>
  code === 'Space'
    ? 'Space'
    : code
        .replace(/^Key|^Digit|^Numpad/, '')
        .replace('Left', ' L')
        .replace('Right', ' R');
export const usableKey = (code) =>
  /^(Key[A-Z]|Digit[4-9]|Space|Enter|ShiftLeft|ShiftRight|Numpad[0-9])$/.test(
    code,
  );
export function assignKey(bindings, action, code) {
  if (!(action in DEFAULT_KEYS) || !usableKey(code))
    return {
      error:
        'Choose a letter, Space, Enter, Shift, or number 4–9. Arrows and 1–3 are reserved for aiming.',
    };
  const conflict = Object.keys(bindings).find(
    (name) => name !== action && bindings[name] === code,
  );
  const next = { ...bindings };
  if (conflict) next[conflict] = bindings[action];
  next[action] = code;
  return { bindings: next, swapped: conflict };
}
export function loadKeys(saved) {
  const result = { ...DEFAULT_KEYS };
  if (!saved || typeof saved !== 'object') return result;
  const codes = Object.values(saved);
  if (new Set(codes).size !== codes.length) return result;
  for (const action of Object.keys(result))
    if (!usableKey(saved[action])) return result;
  return Object.fromEntries(
    Object.keys(result).map((action) => [action, saved[action]]),
  );
}
export class ShotCharge {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.owner = null;
    this.started = 0;
  }
  begin(owner) {
    if (this.owner !== null) return false;
    this.owner = owner;
    this.started = this.now();
    return true;
  }
  get active() {
    return this.owner !== null;
  }
  get power() {
    return this.active
      ? Math.min(
          1,
          0.35 + (0.65 * Math.max(0, this.now() - this.started)) / 900,
        )
      : 0.6;
  }
  release(owner) {
    if (this.owner !== owner) return null;
    const power = this.power;
    this.cancel();
    return power;
  }
  cancel() {
    this.owner = null;
  }
}

export function keyEditor({ container, status, reset, read, write }) {
  let capturing = null;
  const document = container.ownerDocument;
  function render() {
    container.replaceChildren();
    for (const [action, name] of Object.entries(ACTIONS)) {
      const row = document.createElement('div'),
        label = document.createElement('span'),
        button = document.createElement('button');
      label.textContent = name;
      button.type = 'button';
      button.textContent =
        capturing === action ? 'Press a key…' : keyLabel(read()[action]);
      button.dataset.bindAction = action;
      button.setAttribute(
        'aria-label',
        `Change ${name} key, currently ${keyLabel(read()[action])}`,
      );
      button.addEventListener('click', () => {
        capturing = action;
        status.textContent = `Press a key for ${name}.`;
        render();
        container.querySelector(`[data-bind-action="${action}"]`).focus();
      });
      row.append(label, button);
      container.append(row);
    }
  }
  document.addEventListener(
    'keydown',
    (event) => {
      if (!capturing) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === 'Escape') {
        capturing = null;
        status.textContent = 'Key change cancelled.';
        render();
        return;
      }
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const action = capturing,
        result = assignKey(read(), action, event.code);
      if (result.error) {
        status.textContent = result.error;
        return;
      }
      capturing = null;
      write(result.bindings);
      status.textContent = `${ACTIONS[action]} uses ${keyLabel(event.code)}.${result.swapped ? ` Swapped with ${ACTIONS[result.swapped]}.` : ''}`;
      render();
      container.querySelector(`[data-bind-action="${action}"]`).focus();
    },
    true,
  );
  container.closest('details')?.addEventListener('toggle', (event) => {
    if (!event.target.open) {
      capturing = null;
      render();
    }
  });
  reset.addEventListener('click', () => {
    capturing = null;
    write({ ...DEFAULT_KEYS });
    status.textContent = 'Default keyboard restored.';
    render();
  });
  render();
  return {
    cancel: () => {
      capturing = null;
      render();
    },
  };
}
