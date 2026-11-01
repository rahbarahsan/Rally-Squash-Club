import test from 'node:test';
import assert from 'node:assert/strict';
import {SquashGame,flightStep,predictBounce,planShot,traceFlight,COURT} from '../dist/engine.js';
const seedRandom=(seed=42)=>()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const ball=(more={})=>({x:0,y:1.5,z:3,vx:0,vy:0,vz:-10,frontHit:false,bounces:0,...more});
function autoplayer(g,dt=1/120){
  if(g.phase==='ready'&&g.server===0)g.requestShot();
  const p=g.players[0],target=g.turn===0?g.predictIntercept(0):{x:-.3,z:5.5};
  const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
  g.update(dt,{x:d>.08?dx/d:0,z:d>.08?dz/d:0});
}
test('front, side and back collisions reflect the ball inside the court',()=>{
  const front=ball({z:.08,vz:-12});assert.deepEqual(flightStep(front,1/120).events,['front']);assert.ok(front.vz>0);assert.ok(front.frontHit);
  const side=ball({x:3.13,vx:12,vz:0});assert.deepEqual(flightStep(side,1/120).events,['side']);assert.ok(side.vx<0);assert.ok(side.x<3.2);
  const back=ball({z:9.67,vz:12,frontHit:true});assert.deepEqual(flightStep(back,1/120).events,['back']);assert.ok(back.vz<0);
});
test('tin, out, short shots and double bounces are distinguished',()=>{
  assert.equal(flightStep(ball({z:.07,y:.3}),1/120).fault,'Tin');
  assert.equal(flightStep(ball({z:.07,y:4.7}),1/120).fault,'Out of court');
  assert.equal(flightStep(ball({y:.07,vy:-3}),1/120).fault,'Short of the front wall');
  const b=ball({y:.07,vy:-3,frontHit:true});assert.ok(flightStep(b,1/120).events.includes('floor'));assert.equal(b.bounces,1);assert.ok(b.vy>0);
  b.y=.07;b.vy=-3;assert.equal(flightStep(b,1/120).fault,'Double bounce');
});
test('a serve reaches the front wall and becomes a legal return',()=>{
  const g=new SquashGame({assist:false});g.requestShot();let hitFront=false;
  for(let i=0;i<160;i++){g.update(1/120);for(const e of g.drainEvents())if(e.type==='bounce'&&e.surface==='front')hitFront=true;}
  assert.ok(hitFront);assert.ok(g.rally>=1);
});
test('players cannot hit twice in succession or before front-wall contact',()=>{
  const g=new SquashGame();g.requestShot();g.sinceHit=1;g.ball.x=g.players[0].x;g.ball.z=g.players[0].z;g.ball.y=1;
  assert.equal(g.canHit(0),false);g.turn=0;assert.equal(g.canHit(0),false);g.ball.frontHit=true;assert.equal(g.canHit(0),true);
});
test('score uses rally scoring and requires two clear points at deuce',()=>{
  const g=new SquashGame();g.score=[10,10];g.phase='rally';g.award(0,'Double bounce');assert.deepEqual(g.score,[11,10]);assert.equal(g.phase,'point');
  g.phase='rally';g.award(1,'Tin');assert.deepEqual(g.score,[11,11]);assert.equal(g.phase,'point');
  g.phase='rally';g.award(0,'Double bounce');g.phase='rally';g.award(0,'Double bounce');assert.deepEqual(g.score,[13,11]);assert.equal(g.phase,'over');
});
test('a fault gives the point to the opponent of the hitter',()=>{
  const g=new SquashGame({assist:false});g.phase='rally';g.lastHit=0;g.turn=1;g.ball=ball({z:.07,y:.3});g.update(1/120);assert.deepEqual(g.score,[0,1]);
});
test('second bounce rewards the last legal hitter',()=>{
  const g=new SquashGame({assist:false});g.phase='rally';g.lastHit=0;g.turn=1;g.ball=ball({y:.07,vy:-3,bounces:1,frontHit:true});g.update(1/120);assert.deepEqual(g.score,[1,0]);
});
test('paused game does not advance or accept serve requests',()=>{
  const g=new SquashGame();g.paused=true;const before=JSON.stringify(g);assert.equal(g.requestShot(),false);g.update(1/60,{x:1,z:1});assert.equal(JSON.stringify(g),before);
});
test('player movement stays within court and diagonal speed is normalized',()=>{
  const g=new SquashGame(),p={...g.players[0]};g.update(1/120,{x:1,z:1});assert.ok(Math.hypot(g.players[0].x-p.x,g.players[0].z-p.z)<=5.4/120+.00001);
  for(let i=0;i<3000;i++)g.update(1/120,{x:1,z:1});assert.ok(g.players[0].x<COURT.halfWidth);assert.ok(g.players[0].z<COURT.length);
});
test('all three shot types reach front wall legally from a normal rear pickup',()=>{
  for(const shot of ['drive','drop','lob']){const g=new SquashGame({assist:false});g.ball=ball({x:-1,y:.7,z:7});g.launch(0,shot);let front=false;for(let i=0;i<160&&!front;i++){const r=flightStep(g.ball,1/120);assert.equal(r.fault,undefined,`${shot} faulted: ${r.fault}`);front=r.events.includes('front');}assert.ok(front,shot);}
});
test('bounce prediction does not mutate live state and matches simulation',()=>{
  const g=new SquashGame();g.requestShot();const before=JSON.stringify(g.ball),target=predictBounce(g.ball);assert.equal(JSON.stringify(g.ball),before);assert.ok(target);
  const b={...g.ball};let bounce;for(let i=0;i<360;i++){const r=flightStep(b,1/120);if(r.events?.includes('floor')){bounce={...b};break;}}assert.ok(bounce);assert.ok(Math.hypot(target.x-bounce.x,target.z-bounce.z)<.001);
});
test('a complete AI match progresses without deadlock or non-finite state',()=>{
  const g=new SquashGame({difficulty:'club',rng:seedRandom()});let longest=0,aiHits=0,points=0,selected=-1;
  for(let i=0;i<120*300&&g.phase!=='over';i++){
    if(g.phase==='ready'&&g.server===0)g.requestShot();
    if(g.turn===0&&g.phase==='rally'&&selected!==g.rally){selected=g.rally;g.requestShot(g.players[1].z>6.2?'drop':'cross');}
    g.update(1/120);longest=Math.max(longest,g.rally);
    for(const e of g.drainEvents()){if(e.type==='hit'&&e.id===1)aiHits++;if(e.type==='point')points++;}
    for(const n of Object.values(g.ball).filter(v=>typeof v==='number'))assert.ok(Number.isFinite(n));
  }
  assert.equal(g.phase,'over');assert.ok(points>=10);assert.ok(aiHits>=5);assert.ok(longest>=4,`longest rally was ${longest}`);
});
test('solo practice supports repeated returns and resets without an opponent score',()=>{
  const g=new SquashGame({mode:'practice',rng:seedRandom()});
  for(let i=0;i<120*90;i++){g.aim=i%1800<900?1:-1;autoplayer(g);g.drainEvents();}
  assert.ok(g.returns>=5,`returns: ${g.returns}`);assert.ok(g.best>=3);assert.deepEqual(g.score,[0,0]);assert.notEqual(g.phase,'over');
});

test('straight length defaults to the side wall and crosscourts switch sides',()=>{
  for(const x of [-2.6,2.6]){
    const b=ball({x,y:.8,z:7});
    const straight=planShot(b,'drive'),cross=planShot(b,'cross');
    assert.equal(straight.fault,undefined);assert.equal(cross.fault,undefined);
    assert.ok(Math.sign(straight.landing.x)===Math.sign(x));assert.ok(Math.abs(straight.landing.x)>2.6);
    assert.ok(Math.sign(cross.landing.x)!==Math.sign(x));assert.ok(Math.abs(cross.landing.x)>2.6);
    assert.ok(straight.landing.z>7.3&&straight.landing.z<8.1);
  }
});
test('drops, lobs and boasts produce distinct intended trajectories',()=>{
  const b=ball({x:-2.6,y:.8,z:7}),drop=planShot(b,'drop'),lob=planShot(b,'lob'),boast=planShot(b,'boast');
  assert.ok(drop.landing.z<1.6);assert.ok(drop.front.y<1.1);assert.ok(lob.front.y>2.9);assert.ok(lob.landing.z>8);
  const flight=traceFlight({...b,...boast,frontHit:false,bounces:0});assert.ok(flight.sides>=1);assert.ok(boast.landing.x>2.4);assert.ok(boast.landing.z<2.4);
});
test('click placement survives a swing request and reaches its destination',()=>{
  const g=new SquashGame();g.phase='rally';g.turn=1;g.ball=ball({x:-1,y:.9,z:6});g.setTarget(2.5,1.2);g.requestShot();
  assert.deepEqual(g.customTarget,{x:2.5,z:1.2});const p=g.shotPlan();assert.ok(Math.abs(p.landing.x-2.5)<.12);assert.ok(Math.abs(p.landing.z-1.2)<.15);
});
test('movement accelerates, brakes and avoids instantaneous reversals',()=>{
  const g=new SquashGame({footwork:false});const p=g.players[0];g.update(1/120,{x:1,z:0});assert.ok(p.vx>0&&p.vx<.3);
  for(let i=0;i<60;i++)g.update(1/120,{x:1,z:0});assert.ok(p.vx>5);
  g.update(1/120,{x:-1,z:0});assert.ok(p.vx>0);
  for(let i=0;i<90;i++)g.update(1/120,{x:0,z:0});assert.equal(p.vx,0);
});
test('assisted footwork leaves hitting room and returns to the T',()=>{
  const g=new SquashGame();g.requestShot();let recovered=false;for(let i=0;i<120;i++){g.update(1/120);if(Math.hypot(g.players[0].x,g.players[0].z-5.5)<.4)recovered=true;}assert.ok(recovered);
  const target=g.predictIntercept(0);assert.ok(Math.abs(target.x)<=2.72);assert.ok(target.z>=.65&&target.z<=9.15);
});
test('manual movement overrides positioning assistance',()=>{
  const g=new SquashGame();g.requestShot();const start=g.players[0].x;for(let i=0;i<40;i++)g.update(1/120,{x:1,z:0});assert.ok(g.players[0].x>start+.9);assert.ok(g.players[0].manualTimer>0);
});
