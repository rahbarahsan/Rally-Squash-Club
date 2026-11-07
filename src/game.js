import { SquashGame } from './engine.js?v=3.1.0';
import { CourtScene } from './scene.js?v=3.1.0';
import { courtSound, FootstepAudio } from './audio.js?v=3.1.0';
import { createInput } from './input.js?v=3.1.0';
import { RallyTutorial } from './tutorial.js?v=3.1.0';
import {
  $,
  all,
  show,
  loadPreferences,
  savePreferences,
} from './ui.js?v=3.1.0';
import { createDisplay } from './display.js?v=3.1.0';
import { contactFeedback } from './feedback.js?v=3.1.0';
import { DRILLS, PracticeChallenge } from './practice.js?v=3.1.0';
import { OPPONENTS } from './tactics.js?v=3.1.0';
import {
  ShotCharge,
  loadKeys,
  keyLabel,
  keyEditor,
} from './controls.js?v=3.1.0';
let scene,
  game,
  demo,
  playing = false,
  difficulty = 'rookie',
  mode = 'match',
  selectedShot = 'drive',
  aim = 0,
  input,
  sound = true,
  audio = null,
  toastTimer,
  helpWasPaused = false,
  best = 0;
let challenge = null,
  challengePresented = false,
  challengeSignature = '',
  contactTimer;
let recoverRequested = false;
const charge = new ShotCharge();
let powerShownUntil = 0,
  powerPercent = -1,
  lastPower = 0;
function canInteract() {
  return playing && !game.paused && !all('dialog').some((d) => d.open);
}
function cancelCharge() {
  const owner = charge.owner;
  charge.cancel();
  if (game) game.charging = false;
  if (typeof owner === 'string' && owner.startsWith('pointer-')) {
    const pointer = Number(owner.slice(8));
    if ($('touch-hit').hasPointerCapture(pointer))
      $('touch-hit').releasePointerCapture(pointer);
  }
  powerShownUntil = 0;
  lastPower = 0;
  renderPower();
}
function beginCharge(owner, shot = null) {
  if (
    !canInteract() ||
    !['ready', 'rally'].includes(game.phase) ||
    (game.phase === 'ready' && game.server !== 0)
  )
    return false;
  if (shot) setShot(shot);
  if (!charge.begin(owner)) return false;
  initAudio();
  game.charging = true;
  game.buffer = 0;
  game.pendingStrike = null;
  game.players[0].volley = true;
  renderPower();
  return true;
}
function endCharge(owner) {
  const power = charge.release(owner);
  if (power === null) return;
  if (game) game.charging = false;
  if (!canInteract()) {
    cancelCharge();
    return;
  }
  lastPower = power;
  powerShownUntil = performance.now() + 1100;
  hit(null, power);
  renderPower();
}
function renderPower() {
  const value = charge.active
    ? charge.power
    : performance.now() < powerShownUntil
      ? lastPower
      : 0;
  if (game && charge.active) game.chargePower = value;
  const percent = Math.round(value * 100);
  if (percent === powerPercent) return;
  powerPercent = percent;
  $('power-meter').setAttribute('aria-valuenow', String(percent));
  $('power-fill').style.width = `${percent}%`;
  $('power-label').textContent = value
    ? `${percent}%${charge.active ? ' · release' : ''}`
    : 'Hold Swing';
}
try {
  best = Number(localStorage.getItem('rally-best') || 0);
  if (!Number.isFinite(best)) best = 0;
} catch {}
function tone(
  freq,
  length = 0.1,
  type = 'sine',
  volume = 0.08,
  end = freq * 0.6,
) {
  if (!sound || !audio) return;
  const t = audio.currentTime,
    osc = audio.createOscillator(),
    gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(25, end), t + length);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t);
  osc.stop(t + length);
}
function initAudio() {
  try {
    if (!audio)
      audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {}
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => $('toast').classList.remove('visible'),
    message.length > 80 ? 6500 : 2200,
  );
}
function showContact(event) {
  const feedback = contactFeedback(event);
  if (!feedback) return;
  $('contact-title').textContent = feedback.title;
  $('contact-detail').textContent = feedback.detail;
  $('contact-feedback').dataset.tone = feedback.tone;
  $('contact-feedback').classList.add('visible');
  clearTimeout(contactTimer);
  contactTimer = setTimeout(
    () => $('contact-feedback').classList.remove('visible'),
    1400,
  );
}
function clearContact() {
  clearTimeout(contactTimer);
  $('contact-feedback').classList.remove('visible');
}
function updateChallenge() {
  if (!challenge || challenge.id === 'free') return;
  const signature = `${challenge.id}-${challenge.progress}-${challenge.best}-${game.assist}`;
  if (signature === challengeSignature) return;
  challengeSignature = signature;
  const key = `${challenge.id}-${game.assist ? 'assisted' : 'manual'}`;
  const records = (preferences.practiceRecords ||= {});
  const previous = Number(records[key]) || 0;
  if (challenge.best > previous) {
    records[key] = challenge.best;
    savePreferences(preferences);
  }
  $('practice-title').textContent = challenge.definition.name;
  $('practice-count').textContent =
    `${challenge.progress} / ${challenge.definition.goal}`;
  $('practice-best').textContent =
    `Best ${Math.max(previous, challenge.best)} · ${game.assist ? 'assisted' : 'manual'} swing`;
  if (challenge.complete && !challengePresented) {
    challengePresented = true;
    game.paused = true;
    resetInput();
    $('result-kicker').textContent = 'CHALLENGE COMPLETE';
    $('result-title').textContent = 'That’s the rhythm.';
    $('result-detail').textContent =
      `${challenge.definition.name} complete. Try again or choose a new focus in the clubhouse.`;
    $('result-score-label').textContent = 'TARGET REACHED';
    $('result-score').textContent =
      `${challenge.progress} / ${challenge.definition.goal}`;
    $('result-rally').textContent = String(game.best);
    $('result-dialog').showModal();
    tone(640, 0.3, 'sine', 0.06, 900);
  }
}
function resetInput() {
  input?.reset();
  cancelCharge();
  recoverRequested = false;
}
function setShot(shot) {
  selectedShot = shot;
  guideEvent('select');
  if (game) game.setShot(shot);
  updateIntent();
  all('[data-shot]').forEach((el) => {
    el.classList.toggle('active', el.dataset.shot === shot);
    el.setAttribute('aria-pressed', String(el.dataset.shot === shot));
  });
}
function setAim(value) {
  aim = value;
  if (game) game.setAim(aim);
  all('[data-aim]').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.aim) === aim);
    el.setAttribute('aria-pressed', String(Number(el.dataset.aim) === aim));
  });
  updateIntent();
}
const SHOT_NAMES = {
  drive: 'Straight length',
  cross: 'Crosscourt length',
  drop: 'Drop shot',
  lob: 'Defensive lob',
  boast: 'Two-wall boast',
};
function updateIntent() {
  if (!game) return;
  $('shot-intent').textContent = game.customTarget
    ? `${game.customTarget.z < 3.5 ? 'Short' : 'Deep'} ${game.customTarget.x < 0 ? 'left' : 'right'}`
    : SHOT_NAMES[game.shot];
  $('movement-hint').textContent = game.footwork
    ? 'Assisted footwork · movement keys take over'
    : `Manual footwork · hold ${keyLabel(preferences.keys.recover)} to recover`;
  scene.nextPlan = 0;
}
function placeShot(x, z) {
  if (!playing || game.paused) return;
  game.setTarget(x, z);
  guideEvent('aim');
  selectedShot = game.shot;
  all('[data-shot]').forEach((el) =>
    el.classList.toggle('active', el.dataset.shot === selectedShot),
  );
  all('[data-aim]').forEach((el) => el.classList.remove('active'));
  updateIntent();
  tone(490, 0.05, 'sine', 0.025);
}
function saveBest() {
  best = Math.max(best, game.best);
  try {
    localStorage.setItem('rally-best', String(best));
  } catch {}
}
function syncHUD() {
  $('score-you').textContent =
    mode === 'practice' ? game.returns : game.score[0];
  $('score-ai').textContent = mode === 'practice' ? game.faults : game.score[1];
  $('score-you').previousElementSibling.textContent =
    mode === 'practice' ? 'HITS' : 'YOU';
  $('score-ai').nextElementSibling.textContent =
    mode === 'practice' ? 'RESETS' : 'AI';
  $('score-label').textContent =
    mode === 'practice' ? 'RETURNS / RESETS' : 'FIRST TO 11';
  $('difficulty-label').textContent =
    mode === 'practice' ? 'SOLO PRACTICE' : difficulty.toUpperCase();
  $('rally-count').textContent = String(game.rally).padStart(2, '0');
  $('best-count').textContent = String(Math.max(best, game.best)).padStart(
    2,
    '0',
  );
  const isAi = mode !== 'practice' && game.turn === 1;
  $('turn-tag').classList.toggle('ai', isAi);
  $('turn-tag').querySelector('span').textContent = isAi
    ? 'RIVAL’S RETURN'
    : $('assist').checked
      ? 'YOUR RETURN · SELECT YOUR SHOT'
      : `YOUR RETURN · HOLD / RELEASE ${keyLabel(preferences.keys.swing)}`;
  show('turn-tag', game.phase === 'rally');
  $('touch-hit').innerHTML =
    game.phase === 'ready' ? 'SERVE <span>↗</span>' : 'SWING <span>↗</span>';
  $('touch-hit').disabled =
    ['point', 'over'].includes(game.phase) ||
    (game.phase === 'ready' && game.server !== 0);
}
function setStatus(kicker, title, detail) {
  $('status-kicker').textContent = kicker;
  $('status-title').textContent = title;
  $('status-detail').textContent = detail;
  show('status', !tutorial.active);
}
function events() {
  const pending = game.drainEvents();
  if (!pending.length) return;
  for (const e of pending) {
    challenge?.observe(e);
    if (e.type === 'swing-feedback') showContact(e);
    if (e.type === 'ready') {
      setStatus(
        mode === 'practice' ? 'SOLO PRACTICE' : 'READY WHEN YOU ARE',
        e.server === 0 ? 'Your serve' : 'Rival to serve',
        e.server === 0
          ? `Hold / release ${keyLabel(preferences.keys.swing)} or Serve · aim with arrows or the court`
          : 'Get ready for the return',
      );
    }
    if (e.type === 'hit') {
      if (e.id === 0) {
        guideEvent(e.serve ? 'serve' : 'return');
        showContact(e);
      }
      show('status', false);
      if (sound && audio)
        courtSound(audio, e.quality < 0.9 ? 'stretch' : 'clean', 0.2, {
          x: game.players[e.id].x,
          speed: Math.hypot(game.ball.vx, game.ball.vy, game.ball.vz),
        });
      saveBest();
    }
    if (e.type === 'bounce') {
      if (sound && audio) courtSound(audio, e.surface, 0.22, e);
      scene.impact(e);
    }
    if (e.type === 'point') {
      cancelCharge();
      if (sound && audio && e.reason.toLowerCase().includes('tin'))
        courtSound(audio, 'tin');
      saveBest();
      if (mode === 'practice')
        setStatus(
          'KEEP THE RHYTHM',
          `${e.rally} shot rally`,
          `${e.reason} · A fresh ball is on its way`,
        );
      else
        setStatus(
          e.winner === 0 ? 'NICELY PLAYED' : 'NEXT POINT, FRESH START',
          e.winner === 0 ? 'Your point' : 'Rival’s point',
          `${e.reason} · ${game.score[0]} – ${game.score[1]}`,
        );
      tone(
        e.winner === 0 ? 550 : 190,
        0.25,
        'sine',
        0.07,
        e.winner === 0 ? 800 : 100,
      );
    }
    if (e.type === 'over') {
      cancelCharge();
      saveBest();
      show('status', false);
      $('result-title').textContent =
        e.winner === 0 ? 'The court is yours.' : 'One more match?';
      $('result-detail').textContent =
        e.winner === 0
          ? 'Good positioning. Better angles. A well-earned win.'
          : 'Every rally teaches you something. Find the T and come back stronger.';
      $('result-score').textContent = game.score.join(' – ');
      $('result-kicker').textContent = 'MATCH COMPLETE';
      $('result-score-label').textContent = 'FINAL SCORE';
      $('result-rally').textContent = String(game.best);
      $('result-dialog').showModal();
      resetInput();
      tone(e.winner === 0 ? 600 : 250, 0.4, 'sine', 0.07, 400);
    }
  }
  syncHUD();
  updateChallenge();
}
const preferences = loadPreferences();
preferences.keys = loadKeys(preferences.keys);
$('arrow-mode').value = preferences.arrows === 'move' ? 'move' : 'aim';
function syncKeyHints() {
  $('shot-shortcuts-help').textContent = [
    'drive',
    'cross',
    'drop',
    'lob',
    'boast',
  ]
    .map((action) => keyLabel(preferences.keys[action]))
    .join(' · ');
  all('[data-action-key]').forEach(
    (element) =>
      (element.textContent = keyLabel(
        preferences.keys[element.dataset.actionKey],
      )),
  );
  all('[data-shot]').forEach((button) => {
    button.querySelector('kbd').textContent = keyLabel(
      preferences.keys[button.dataset.shot],
    );
  });
  $('movement-keys').textContent = ['forward', 'left', 'back', 'right']
    .map((action) => keyLabel(preferences.keys[action]))
    .join(' ');
  $('aim-hint').textContent =
    preferences.arrows === 'move'
      ? 'Click the court to aim · release to hit'
      : 'Arrows aim · release to hit';
}
const keyboardEditor = keyEditor({
  container: $('key-bindings'),
  status: $('binding-status'),
  reset: $('reset-keys'),
  read: () => preferences.keys,
  write: (keys) => {
    preferences.keys = keys;
    resetInput();
    savePreferences(preferences);
    syncKeyHints();
  },
});
$('arrow-mode').addEventListener('change', () => {
  preferences.arrows = $('arrow-mode').value;
  resetInput();
  savePreferences(preferences);
  syncKeyHints();
});
syncKeyHints();
if (
  !preferences.practiceRecords ||
  typeof preferences.practiceRecords !== 'object' ||
  Array.isArray(preferences.practiceRecords)
)
  preferences.practiceRecords = {};
const display = createDisplay({
  element: $('app'),
  document,
  screen,
  onMessage: toast,
  onChange: ({ fullscreen, locked, pending }) => {
    $('fullscreen').setAttribute(
      'aria-label',
      fullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
    );
    $('landscape').setAttribute('aria-pressed', String(locked));
    $('landscape').disabled = pending;
    $('landscape').textContent = locked ? 'Unlock screen' : 'Landscape';
  },
});
$('landscape').addEventListener('click', display.landscape);
$('fullscreen').addEventListener('click', display.fullscreen);
const footsteps = new FootstepAudio();
sound = preferences.sound !== false;
$('sound').setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
preferences.quality ||= matchMedia('(pointer: coarse)').matches
  ? 'low'
  : 'medium';
if (!['low', 'medium', 'high'].includes(preferences.quality))
  preferences.quality = 'medium';
$('sound').textContent = sound ? '♪' : '♩';
$('quality').value = preferences.quality;
$('left-handed').checked = !!preferences.leftHanded;
$('movement').value = preferences.movement || 'assisted';
$('assist').checked = preferences.assist !== false;
function applyPreferences() {
  preferences.assist = $('assist').checked;
  preferences.quality = $('quality').value;
  preferences.leftHanded = $('left-handed').checked;
  preferences.movement = $('movement').value;
  $('app').classList.toggle('left-handed', preferences.leftHanded);
  $('app').classList.toggle(
    'manual-movement',
    preferences.movement === 'manual',
  );
  $('footwork').checked = preferences.movement !== 'manual';
  if (game) game.footwork = $('footwork').checked;
  scene?.setQuality(preferences.quality);
  savePreferences(preferences);
}
for (const id of ['quality', 'left-handed', 'movement', 'assist'])
  $(id).addEventListener('change', applyPreferences);
$('footwork').addEventListener('change', () => {
  $('movement').value = $('footwork').checked ? 'assisted' : 'manual';
  applyPreferences();
});
applyPreferences();
$('advanced-shots').addEventListener('click', () => {
  const open = $('app').classList.toggle('advanced-shots');
  scene.controlsExpanded = open;
  $('advanced-shots').setAttribute('aria-expanded', String(open));
});
const tutorial = new RallyTutorial();
function renderGuide() {
  show('tutorial-card', tutorial.active);
  if (tutorial.active) show('status', false);
  $('tutorial-text').textContent = tutorial.text;
  if (tutorial.step === 5) {
    toast('First rally complete — well played!');
    try {
      localStorage.setItem('rally-tutorial', 'done');
    } catch {}
    if (game) {
      game.assist = $('assist').checked;
      game.footwork = $('footwork').checked;
    }
    $('app').classList.toggle(
      'manual-movement',
      preferences.movement === 'manual',
    );
  }
}
function guideEvent(event) {
  if (tutorial.active) {
    tutorial.observe(event);
    renderGuide();
  }
}
function closeGuide() {
  if (tutorial.active && game) {
    game.assist = $('assist').checked;
    game.footwork = $('footwork').checked;
  }
  tutorial.stop();
  show('tutorial-card', false);
  $('app').classList.toggle(
    'manual-movement',
    preferences.movement === 'manual',
  );
}
$('tutorial').addEventListener('click', () => {
  start();
  challenge = null;
  show('practice-progress', false);
  scene.drill = 'free';
  show('touch-recover', false);
  $('app').classList.remove('has-challenge');
  game.assist = true;
  game.footwork = true;
  $('app').classList.remove('manual-movement');
  tutorial.start();
  renderGuide();
});
$('tutorial-skip').addEventListener('click', closeGuide);
function start() {
  keyboardEditor.cancel();
  closeGuide();
  if (!scene) return;
  for (const d of all('dialog')) if (d.open) d.close();
  resetInput();
  clearContact();
  initAudio();
  game = new SquashGame({
    difficulty,
    mode,
    assist: $('assist').checked,
    footwork: $('footwork').checked,
    opponent: $('opponent').value,
  });
  challenge =
    mode === 'practice'
      ? new PracticeChallenge($('practice-focus').value)
      : null;
  challengePresented = false;
  challengeSignature = '';
  $('app').classList.toggle(
    'has-challenge',
    !!challenge && challenge.id !== 'free',
  );
  scene.drill = challenge?.id || 'free';
  show('touch-recover', challenge?.id === 'recovery');
  show('practice-progress', !!challenge && challenge.id !== 'free');
  game.setShot(selectedShot);
  game.aim = aim;
  playing = true;
  scene.setPlaying(true);
  $('app').classList.add('playing');
  ['menu', 'court-caption', 'menu-footer'].forEach((id) => show(id, false));
  [
    'hud',
    'game-controls',
    'touch-controls',
    'pause',
    'camera',
    'shot-feedback',
    'placement-pad',
    'power-meter',
  ].forEach((id) => show(id, true));
  updateIntent();
  events();
}
function clubhouse() {
  closeGuide();
  for (const d of all('dialog')) if (d.open) d.close();
  resetInput();
  clearContact();
  challenge = null;
  $('app').classList.remove('has-challenge');
  scene.drill = 'free';
  show('practice-progress', false);
  show('touch-recover', false);
  playing = false;
  scene?.setPlaying(false);
  $('app').classList.remove('playing');
  ['menu', 'court-caption', 'menu-footer'].forEach((id) => show(id, true));
  [
    'hud',
    'game-controls',
    'touch-controls',
    'pause',
    'camera',
    'shot-feedback',
    'placement-pad',
    'status',
    'turn-tag',
    'power-meter',
  ].forEach((id) => show(id, false));
}
function pause() {
  if (!playing || game.phase === 'over' || all('dialog').some((d) => d.open))
    return;
  game.paused = true;
  resetInput();
  $('pause-dialog').showModal();
}
function resume() {
  if (game) game.paused = false;
  $('pause-dialog').close();
  resetInput();
}
function help() {
  helpWasPaused = game?.paused || false;
  if (playing) {
    game.paused = true;
    resetInput();
  }
  $('help-dialog').showModal();
}
function hit(shot = null, power = null) {
  if (!playing || game.paused || all('dialog').some((d) => d.open)) return;
  initAudio();
  recoverRequested = false;
  if (shot) setShot(shot);
  game.requestShot(null, power);
  events();
}
$('start').addEventListener('click', start);
$('brand').addEventListener('click', () => (playing ? pause() : null));
$('help').addEventListener('click', help);
$('learn').addEventListener('click', help);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('restart').addEventListener('click', start);
$('again').addEventListener('click', start);
$('exit').addEventListener('click', clubhouse);
$('result-exit').addEventListener('click', clubhouse);
all('[data-close]').forEach((b) =>
  b.addEventListener('click', () => $(b.dataset.close).close()),
);
$('help-dialog').addEventListener('close', () => {
  if (playing) game.paused = helpWasPaused;
  resetInput();
});
$('pause-dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  resume();
});
$('result-dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  clubhouse();
});
$('sound').addEventListener('click', () => {
  sound = !sound;
  preferences.sound = sound;
  savePreferences(preferences);
  initAudio();
  $('sound').textContent = sound ? '♪' : '♩';
  $('sound').setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
  $('sound').title = sound ? 'Sound on' : 'Sound off';
  $('sound').style.opacity = sound ? '1' : '.45';
  toast(sound ? 'Court audio on' : 'Court audio off');
});
$('opponent').addEventListener('change', () => {
  $('opponent-note').textContent = OPPONENTS[$('opponent').value].description;
});
$('practice-focus').addEventListener('change', () => {
  $('practice-note').textContent =
    DRILLS[$('practice-focus').value].description;
});
all('[data-level]').forEach((b) =>
  b.addEventListener('click', () => {
    difficulty = b.dataset.level;
    all('[data-level]').forEach((x) => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    $('level-note').textContent = {
      rookie: 'Room to find your feet',
      club: 'Make every angle count',
      pro: 'A quicker, sharper rival',
    }[difficulty];
  }),
);
all('[data-mode]').forEach((b) =>
  b.addEventListener('click', () => {
    mode = b.dataset.mode;
    show('opponent-option', mode === 'match');
    show('opponent-note', mode === 'match');
    show('practice-option', mode === 'practice');
    show('practice-note', mode === 'practice');
    all('[data-mode]').forEach((x) => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    all('[data-level]').forEach((x) => (x.disabled = mode === 'practice'));
    $('match-note').textContent =
      mode === 'practice'
        ? 'Just you, the wall, and your next personal best'
        : 'You vs. AI · First to 11, win by 2';
    $('level-note').textContent =
      mode === 'practice'
        ? 'No opponent. No pressure.'
        : {
            rookie: 'Room to find your feet',
            club: 'Make every angle count',
            pro: 'A quicker, sharper rival',
          }[difficulty];
  }),
);
all('[data-shot]').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.preventDefault();
    setShot(b.dataset.shot);
  }),
);
all('[data-aim]').forEach((b) =>
  b.addEventListener('click', () => setAim(Number(b.dataset.aim))),
);
all('[data-corner]').forEach((b) =>
  b.addEventListener('click', () =>
    placeShot(...b.dataset.corner.split(',').map(Number)),
  ),
);
function cameraView() {
  scene.tactical = !scene.tactical;
  toast(scene.tactical ? 'Tactical view' : 'Courtside view');
}
$('camera').addEventListener('click', cameraView);
$('touch-recover').addEventListener('click', () => {
  if (playing && !game.paused) recoverRequested = true;
});
$('touch-hit').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (beginCharge(`pointer-${e.pointerId}`))
    $('touch-hit').setPointerCapture(e.pointerId);
});
$('touch-hit').addEventListener('pointerup', (e) => {
  e.preventDefault();
  endCharge(`pointer-${e.pointerId}`);
});
for (const type of ['pointercancel', 'lostpointercapture'])
  $('touch-hit').addEventListener(type, (e) => {
    if (charge.owner === `pointer-${e.pointerId}`) cancelCharge();
  });
$('touch-hit').addEventListener('click', (e) => {
  e.preventDefault();
  if (e.detail === 0) hit(null, 0.6);
});
input = createInput({
  stickElement: $('joystick'),
  knob: $('joystick-knob'),
  enabled: () => playing && !game.paused && !all('dialog').some((d) => d.open),
  onChargeStart: beginCharge,
  onChargeEnd: endCharge,
  onCancel: cancelCharge,
  bindings: () => preferences.keys,
  arrowsAim: () => preferences.arrows !== 'move',
  onAim: setAim,
  onCamera: cameraView,
  onPause: (e) => {
    if (!playing) return;
    if ($('pause-dialog').open && e.code === preferences.keys.pause) resume();
    else if (!all('dialog').some((d) => d.open)) {
      e.preventDefault();
      pause();
    }
  },
  onBlur: pause,
});
function demoStep(dt) {
  if (demo.phase === 'ready') demo.requestShot();
  if (demo.phase === 'over') {
    demo = new SquashGame({ difficulty: 'club', assist: true });
    return;
  }
  if (demo.phase === 'rally') {
    if (
      demo.turn === 0 &&
      demo.ball.frontHit &&
      demo.buffer === 0 &&
      demo.rally % 4 === 0
    )
      demo.requestShot('cross');
    demo.update(dt * demo.level.timeScale);
  } else demo.update(dt * demo.level.timeScale);
  for (const e of demo.drainEvents()) if (e.type === 'bounce') scene.impact(e);
}
try {
  scene = new CourtScene($('scene'));
  scene.setQuality(preferences.quality);
  scene.renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!playing || game.paused) return;
    const p = scene.courtPoint(e.clientX, e.clientY);
    if (p) placeShot(p.x, p.z);
  });
  $('loading').remove();
  demo = new SquashGame({ difficulty: 'club', assist: true });
  let previous = performance.now(),
    accumulator = 0;
  const step = 1 / 120;
  function frame(now) {
    const dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    accumulator += dt;
    while (accumulator >= step) {
      if (playing) {
        const controls = input.sample();
        if (canInteract() && (controls.aimX || controls.aimZ)) {
          game.nudgeTarget(controls.aimX, controls.aimZ, step);
          guideEvent('aim');
          updateIntent();
        }
        if (Math.hypot(controls.x, controls.z) > 0.03) recoverRequested = false;
        if (recoverRequested) controls.recover = true;
        game.update(step * game.level.timeScale, controls);
        if (Math.hypot(game.players[0].x, game.players[0].z - 5.5) < 0.55)
          recoverRequested = false;
        challenge?.update(game.players[0], game.phase, game.paused);
        updateChallenge();
        footsteps.update(game, step * game.level.timeScale, (kind, volume) => {
          if (sound && audio) courtSound(audio, kind, volume);
        });
        if (
          tutorial.active &&
          tutorial.step === 4 &&
          game.lastHit === 0 &&
          Math.hypot(game.players[0].x, game.players[0].z - 5.5) < 0.65
        )
          guideEvent('recover');
        events();
      } else demoStep(step);
      accumulator -= step;
    }
    scene.render(
      playing ? game : demo,
      playing && game.paused
        ? 0
        : dt * (playing ? game.level.timeScale : demo.level.timeScale),
    );
    renderPower();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (e) {
  console.error(e);
  show('error', true);
  $('start').disabled = true;
}
