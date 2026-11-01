import {SquashGame,clamp} from './engine.js?v=2';
import {CourtScene} from './scene.js?v=2';
const $=id=>document.getElementById(id),all=q=>[...document.querySelectorAll(q)];
let scene,game,demo,playing=false,difficulty='rookie',mode='match',selectedShot='drive',aim=0,keys=new Set(),stick={x:0,z:0},sound=true,audio=null,toastTimer,helpWasPaused=false,best=0;
try{best=Number(localStorage.getItem('rally-best')||0);if(!Number.isFinite(best))best=0;}catch{}
function tone(freq,length=.1,type='sine',volume=.08,end=freq*.6){
  if(!sound||!audio)return;
  const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(25,end),t+length);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+length);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+length);
}
function initAudio(){try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),1800);}
function show(id,visible){$(id).classList.toggle('hidden',!visible);}
function resetInput(){keys.clear();stick={x:0,z:0};$('joystick-knob').style.transform='';}
function setShot(shot){selectedShot=shot;if(game)game.setShot(shot);updateIntent();all('[data-shot]').forEach(el=>{el.classList.toggle('active',el.dataset.shot===shot);el.setAttribute('aria-pressed',String(el.dataset.shot===shot));});}
function setAim(value){aim=value;if(game)game.setAim(aim);all('[data-aim]').forEach(el=>{el.classList.toggle('active',Number(el.dataset.aim)===aim);el.setAttribute('aria-pressed',String(Number(el.dataset.aim)===aim));});updateIntent();}
const SHOT_NAMES={drive:'Straight length',cross:'Crosscourt length',drop:'Drop shot',lob:'Defensive lob',boast:'Two-wall boast'};
function updateIntent(){
  if(!game)return;
  $('shot-intent').textContent=game.customTarget?`${game.customTarget.z<3.5?'Short':'Deep'} ${game.customTarget.x<0?'left':'right'}`:SHOT_NAMES[game.shot];
  $('movement-hint').textContent=game.footwork?'Assisted footwork · WASD to take over':'Manual footwork · Hold R to recover';
  scene.nextPlan=0;
}
function placeShot(x,z){if(!playing||game.paused)return;game.setTarget(x,z);selectedShot=game.shot;all('[data-shot]').forEach(el=>el.classList.toggle('active',el.dataset.shot===selectedShot));all('[data-aim]').forEach(el=>el.classList.remove('active'));updateIntent();tone(490,.05,'sine',.025);}
function saveBest(){best=Math.max(best,game.best);try{localStorage.setItem('rally-best',String(best));}catch{}}
function syncHUD(){
  $('score-you').textContent=mode==='practice'?game.returns:game.score[0];$('score-ai').textContent=mode==='practice'?game.faults:game.score[1];
  $('score-you').previousElementSibling.textContent=mode==='practice'?'HITS':'YOU';$('score-ai').nextElementSibling.textContent=mode==='practice'?'RESETS':'AI';
  $('score-label').textContent=mode==='practice'?'RETURNS / RESETS':'FIRST TO 11';$('difficulty-label').textContent=mode==='practice'?'SOLO PRACTICE':difficulty.toUpperCase();
  $('rally-count').textContent=String(game.rally).padStart(2,'0');$('best-count').textContent=String(Math.max(best,game.best)).padStart(2,'0');
  const isAi=mode!=='practice'&&game.turn===1;$('turn-tag').classList.toggle('ai',isAi);$('turn-tag').querySelector('span').textContent=isAi?'RIVAL’S RETURN':$('assist').checked?'YOUR RETURN · SELECT YOUR SHOT':'YOUR RETURN · SPACE TO SWING';
  show('turn-tag',game.phase==='rally');$('touch-hit').innerHTML=game.phase==='ready'?'SERVE <span>↗</span>':'SWING <span>↗</span>';
}
function setStatus(kicker,title,detail){$('status-kicker').textContent=kicker;$('status-title').textContent=title;$('status-detail').textContent=detail;show('status',true);}
function events(){
  const pending=game.drainEvents();if(!pending.length)return;
  for(const e of pending){
    if(e.type==='ready'){
      setStatus(mode==='practice'?'SOLO PRACTICE':'READY WHEN YOU ARE',e.server===0?'Your serve':'Rival to serve',e.server===0?'Space to serve · Click a corner to place your next shot':'Get ready for the return');
    }
    if(e.type==='hit'){
      show('status',false);tone(e.id===0?270:220,.09,'triangle',.075,95);saveBest();
    }
    if(e.type==='bounce'){
      scene.impact(e);tone(e.surface==='floor'?155:340,.055,'sine',e.surface==='floor'?.045:.055,80);
    }
    if(e.type==='point'){
      saveBest();
      if(mode==='practice')setStatus('KEEP THE RHYTHM',`${e.rally} shot rally`,`${e.reason} · A fresh ball is on its way`);
      else setStatus(e.winner===0?'NICELY PLAYED':'NEXT POINT, FRESH START',e.winner===0?'Your point':'Rival’s point',`${e.reason} · ${game.score[0]} – ${game.score[1]}`);
      tone(e.winner===0?550:190,.25,'sine',.07,e.winner===0?800:100);
    }
    if(e.type==='over'){
      saveBest();show('status',false);$('result-title').textContent=e.winner===0?'The court is yours.':'One more match?';$('result-detail').textContent=e.winner===0?'Good positioning. Better angles. A well-earned win.':'Every rally teaches you something. Find the T and come back stronger.';$('result-score').textContent=game.score.join(' – ');$('result-rally').textContent=String(game.best);$('result-dialog').showModal();resetInput();tone(e.winner===0?600:250,.4,'sine',.07,400);
    }
  }
  syncHUD();
}
function start(){
  if(!scene)return;for(const d of all('dialog'))if(d.open)d.close();resetInput();initAudio();
  game=new SquashGame({difficulty,mode,assist:$('assist').checked,footwork:$('footwork').checked});game.setShot(selectedShot);game.aim=aim;playing=true;scene.setPlaying(true);$('app').classList.add('playing');
  ['menu','court-caption','menu-footer'].forEach(id=>show(id,false));['hud','game-controls','touch-controls','pause','camera','shot-feedback','placement-pad'].forEach(id=>show(id,true));updateIntent();events();
}
function clubhouse(){
  for(const d of all('dialog'))if(d.open)d.close();resetInput();playing=false;scene?.setPlaying(false);$('app').classList.remove('playing');
  ['menu','court-caption','menu-footer'].forEach(id=>show(id,true));['hud','game-controls','touch-controls','pause','camera','shot-feedback','placement-pad','status','turn-tag'].forEach(id=>show(id,false));
}
function pause(){if(!playing||game.phase==='over'||all('dialog').some(d=>d.open))return;game.paused=true;resetInput();$('pause-dialog').showModal();}
function resume(){if(game)game.paused=false;$('pause-dialog').close();resetInput();}
function help(){helpWasPaused=game?.paused||false;if(playing){game.paused=true;resetInput();}$('help-dialog').showModal();}
function hit(shot=null){
  if(!playing||game.paused||all('dialog').some(d=>d.open))return;initAudio();if(shot)setShot(shot);const success=game.requestShot();events();if(!success&&game.phase==='rally'&&!game.assist&&game.turn===0)toast('Get close to the ball — your swing is queued');
}
$('start').addEventListener('click',start);$('brand').addEventListener('click',()=>playing?pause():null);$('help').addEventListener('click',help);$('learn').addEventListener('click',help);$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('restart').addEventListener('click',start);$('again').addEventListener('click',start);$('exit').addEventListener('click',clubhouse);$('result-exit').addEventListener('click',clubhouse);
all('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('help-dialog').addEventListener('close',()=>{if(playing)game.paused=helpWasPaused;resetInput();});
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});$('result-dialog').addEventListener('cancel',e=>{e.preventDefault();clubhouse();});
$('sound').addEventListener('click',()=>{sound=!sound;initAudio();$('sound').textContent=sound?'♪':'♩';$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');$('sound').title=sound?'Sound on':'Sound off';$('sound').style.opacity=sound?'1':'.45';toast(sound?'Court audio on':'Court audio off');});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('app').requestFullscreen)await $('app').requestFullscreen();else toast('Use your browser’s fullscreen option');}catch{toast('Fullscreen isn’t available in this view');}});
all('[data-level]').forEach(b=>b.addEventListener('click',()=>{difficulty=b.dataset.level;all('[data-level]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});$('level-note').textContent={rookie:'Room to find your feet',club:'Make every angle count',pro:'A quicker, sharper rival'}[difficulty];}));
all('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;all('[data-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});all('[data-level]').forEach(x=>x.disabled=mode==='practice');$('match-note').textContent=mode==='practice'?'Just you, the wall, and your next personal best':'You vs. AI · First to 11, win by 2';$('level-note').textContent=mode==='practice'?'No opponent. No pressure.':{rookie:'Room to find your feet',club:'Make every angle count',pro:'A quicker, sharper rival'}[difficulty];}));
all('[data-shot]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();hit(b.dataset.shot);}));all('[data-aim]').forEach(b=>b.addEventListener('click',()=>setAim(Number(b.dataset.aim))));
all('[data-corner]').forEach(b=>b.addEventListener('click',()=>placeShot(...b.dataset.corner.split(',').map(Number))));
function cameraView(){scene.tactical=!scene.tactical;toast(scene.tactical?'Tactical view':'Courtside view');}
$('camera').addEventListener('click',cameraView);
$('touch-hit').addEventListener('click',e=>{e.preventDefault();hit();});
document.addEventListener('keydown',e=>{
  if(!playing)return;
  const code=e.code;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)&&!all('dialog').some(d=>d.open))e.preventDefault();
  if(code==='Escape'||code==='KeyP'){if(e.repeat)return;if($('pause-dialog').open&&code==='KeyP')resume();else if(!all('dialog').some(d=>d.open)){e.preventDefault();pause();}return;}
  if(all('dialog').some(d=>d.open)||game.paused)return;keys.add(code);
  if(e.repeat)return;if(code==='Space')hit();if(code==='KeyZ')hit('drive');if(code==='KeyC')hit('cross');if(code==='KeyB')hit('boast');if(code==='KeyV')cameraView();if(code==='KeyE')hit('drop');if(code==='KeyQ')hit('lob');if(code==='Digit1')setAim(-1);if(code==='Digit2')setAim(0);if(code==='Digit3')setAim(1);
});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{resetInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();pause();}});
let stickPointer=null;
function moveStick(e){if(e.pointerId!==stickPointer)return;const r=$('joystick').getBoundingClientRect(),max=r.width*.34;let x=(e.clientX-r.left-r.width/2)/max,z=(e.clientY-r.top-r.height/2)/max;const d=Math.hypot(x,z);if(d>1){x/=d;z/=d;}stick={x,z};$('joystick-knob').style.transform=`translate(${x*max}px,${z*max}px)`;}
$('joystick').addEventListener('pointerdown',e=>{e.preventDefault();stickPointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);moveStick(e);});$('joystick').addEventListener('pointermove',moveStick);for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(ev,()=>{stickPointer=null;stick={x:0,z:0};$('joystick-knob').style.transform='';});
function demoStep(dt){
  if(demo.phase==='ready')demo.requestShot();
  if(demo.phase==='over'){demo=new SquashGame({difficulty:'club',assist:true});return;}
  if(demo.phase==='rally'){
    if(demo.turn===0&&demo.ball.frontHit&&demo.buffer===0&&demo.rally%4===0)demo.requestShot('cross');demo.update(dt*.8);
  }else demo.update(dt);
  for(const e of demo.drainEvents())if(e.type==='bounce')scene.impact(e);
}
try{
  scene=new CourtScene($('scene'));scene.renderer.domElement.addEventListener('pointerdown',e=>{if(!playing||game.paused)return;const p=scene.courtPoint(e.clientX,e.clientY);if(p)placeShot(p.x,p.z);});$('loading').remove();demo=new SquashGame({difficulty:'club',assist:true});
  let previous=performance.now(),accumulator=0;const step=1/120;
  function frame(now){
    const dt=Math.min(.05,(now-previous)/1000);previous=now;accumulator+=dt;
    while(accumulator>=step){
      if(playing){const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x,z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.z;game.update(step*game.level.timeScale,{x,z,recover:keys.has('KeyR')});events();}else demoStep(step);
      accumulator-=step;
    }
    scene.render(playing?game:demo,playing&&game.paused?0:dt);requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}catch(e){console.error(e);show('error',true);$('start').disabled=true;}
