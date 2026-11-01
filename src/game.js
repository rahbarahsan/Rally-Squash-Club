import { SquashGame } from './engine.js?v=3';
import { CourtScene } from './scene.js?v=3';
import { courtSound, FootstepAudio } from './audio.js';
import { createInput } from './input.js';
import { RallyTutorial } from './tutorial.js';
import { $, all, show, loadPreferences, savePreferences } from './ui.js';
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
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 1800);
}
function resetInput() {
  input?.reset();
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
    ? 'Assisted footwork · WASD to take over'
    : 'Manual footwork · Hold R to recover';
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
      : 'YOUR RETURN · SPACE TO SWING';
  show('turn-tag', game.phase === 'rally');
  $('touch-hit').innerHTML =
    game.phase === 'ready' ? 'SERVE <span>↗</span>' : 'SWING <span>↗</span>';
}
function setStatus(kicker, title, detail) {
  $('status-kicker').textContent = kicker;
  $('status-title').textContent = title;
  $('status-detail').textContent = detail;
  show('status', true);
}
function events() {
  const pending = game.drainEvents();
  if (!pending.length) return;
  for (const e of pending) {
    if (e.type === 'ready') {
      setStatus(
        mode === 'practice' ? 'SOLO PRACTICE' : 'READY WHEN YOU ARE',
        e.server === 0 ? 'Your serve' : 'Rival to serve',
        e.server === 0
          ? 'Tap Serve or press Space · Tap the court to aim'
          : 'Get ready for the return',
      );
    }
    if (e.type === 'hit') {
      if (e.id === 0) {
        guideEvent(e.serve ? 'serve' : 'return');
        if (e.quality < 0.9)
          toast('Stretched return — recover early for a tighter shot');
      }
      show('status', false);
      if (sound && audio) courtSound(audio, 'racket');
      saveBest();
    }
    if (e.type === 'bounce') {
      if (sound && audio) courtSound(audio, e.surface, 0.09);
      scene.impact(e);
      tone(
        e.surface === 'floor' ? 155 : 340,
        0.055,
        'sine',
        e.surface === 'floor' ? 0.045 : 0.055,
        80,
      );
    }
    if (e.type === 'point') {
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
      saveBest();
      show('status', false);
      $('result-title').textContent =
        e.winner === 0 ? 'The court is yours.' : 'One more match?';
      $('result-detail').textContent =
        e.winner === 0
          ? 'Good positioning. Better angles. A well-earned win.'
          : 'Every rally teaches you something. Find the T and come back stronger.';
      $('result-score').textContent = game.score.join(' – ');
      $('result-rally').textContent = String(game.best);
      $('result-dialog').showModal();
      resetInput();
      tone(e.winner === 0 ? 600 : 250, 0.4, 'sine', 0.07, 400);
    }
  }
  syncHUD();
}
const preferences = loadPreferences();
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
  game.assist = true;
  game.footwork = true;
  $('app').classList.remove('manual-movement');
  tutorial.start();
  renderGuide();
});
$('tutorial-skip').addEventListener('click', closeGuide);
function start() {
  closeGuide();
  if (!scene) return;
  for (const d of all('dialog')) if (d.open) d.close();
  resetInput();
  initAudio();
  game = new SquashGame({
    difficulty,
    mode,
    assist: $('assist').checked,
    footwork: $('footwork').checked,
  });
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
  ].forEach((id) => show(id, true));
  updateIntent();
  events();
}
function clubhouse() {
  closeGuide();
  for (const d of all('dialog')) if (d.open) d.close();
  resetInput();
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
function hit(shot = null) {
  if (!playing || game.paused || all('dialog').some((d) => d.open)) return;
  initAudio();
  if (shot) setShot(shot);
  const success = game.requestShot();
  events();
  if (!success && game.phase === 'rally' && !game.assist && game.turn === 0)
    toast('Get close to the ball — your swing is queued');
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
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('app').requestFullscreen) await $('app').requestFullscreen();
    else toast('Use your browser’s fullscreen option');
  } catch {
    toast('Fullscreen isn’t available in this view');
  }
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
$('touch-hit').addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') {
    e.preventDefault();
    hit();
  }
});
$('touch-hit').addEventListener('click', (e) => {
  e.preventDefault();
  if (e.detail === 0 || e.pointerType === 'mouse') hit();
});
input = createInput({
  stickElement: $('joystick'),
  knob: $('joystick-knob'),
  enabled: () => playing && !game.paused && !all('dialog').some((d) => d.open),
  onHit: hit,
  onAim: setAim,
  onCamera: cameraView,
  onPause: (e) => {
    if (!playing) return;
    if ($('pause-dialog').open && e.code === 'KeyP') resume();
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
        game.update(step * game.level.timeScale, input.sample());
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
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (e) {
  console.error(e);
  show('error', true);
  $('start').disabled = true;
}
