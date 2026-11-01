// Fixed-step squash simulation. Coordinates and velocities are metres and seconds.
export const COURT={halfWidth:3.2,length:9.75,tin:.48,frontOut:4.57,backOut:2.13};
export const LEVELS={rookie:{speed:3.2,reach:1.0,reaction:.45,timeScale:.78},club:{speed:4.2,reach:1.05,reaction:.28,timeScale:.9},pro:{speed:5.2,reach:1.1,reaction:.15,timeScale:1}};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const R=.065,G=9.81,FRONT=.94,SIDE=.94;
const sideOf=x=>x<-.1?-1:1;
const approach=(v,target,amount)=>v<target?Math.min(target,v+amount):Math.max(target,v-amount);

export function flightStep(b,dt){
  const events=[];
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt-.5*G*dt*dt;b.vy-=G*dt;
  if(b.z<R&&b.vz<0){
    if(b.y<=COURT.tin+R)return {fault:'Tin'};
    if(b.y>=COURT.frontOut-R)return {fault:'Out of court'};
    b.z=2*R-b.z;b.vz*=-FRONT;b.frontHit=true;events.push('front');
  }
  if(b.z>COURT.length-R&&b.vz>0){
    if(b.y>=COURT.backOut-R)return {fault:'Out of court'};
    b.z=2*(COURT.length-R)-b.z;b.vz*=-.82;events.push('back');
  }
  if(Math.abs(b.x)>COURT.halfWidth-R){
    const limit=COURT.frontOut-(COURT.frontOut-COURT.backOut)*clamp(b.z/COURT.length,0,1);
    if(b.y>=limit-R)return {fault:'Out of court'};
    b.x=Math.sign(b.x)*(2*(COURT.halfWidth-R)-Math.abs(b.x));b.vx*=-SIDE;events.push('side');
  }
  if(b.y<R&&b.vy<0){
    b.y=2*R-b.y;
    if(!b.frontHit)return {fault:'Short of the front wall'};
    b.bounces++;
    if(b.bounces>=2)return {fault:'Double bounce'};
    b.vy*=-.42;b.vx*=.96;b.vz*=.96;events.push('floor');
  }
  return {events};
}

export function traceFlight(ball,maxTime=3,step=1/180){
  const b={...ball},points=[{x:b.x,y:b.y,z:b.z}];let front=null,sides=0;
  for(let i=0;i<maxTime/step;i++){
    const s=flightStep(b,step);
    if(s.events?.includes('front'))front={x:b.x,y:b.y,z:b.z};
    if(s.events?.includes('side'))sides++;
    if(i%4===0||s.events?.length)points.push({x:b.x,y:b.y,z:b.z});
    if(s.events?.includes('floor')||s.fault==='Double bounce')return {landing:{x:b.x,z:b.z,time:(i+1)*step},front,points,sides};
    if(s.fault)return {fault:s.fault,front,points,sides};
  }
  return {points,front,sides};
}
export function predictBounce(ball){return traceFlight(ball,3,1/120).landing||null;}

// Solve a ballistic path through the front wall to a floor destination. The ball
// keeps its momentum at contact; its horizontal angle is never redirected in mid-air.
export function planShot(ball,shot='drive',aim=0,custom=null,serve=false){
  const sourceSide=sideOf(ball.x);
  let side=aim||((shot==='cross'||serve)?-sourceSide:sourceSide);
  const depth=serve?8.05:shot==='drop'?1.35:shot==='boast'?2.15:shot==='lob'?8.35:7.65;
  let target={x:side*(shot==='drop'?2.84:2.8),z:depth};
  if(custom&&!serve)target={x:clamp(custom.x,-2.95,2.95),z:clamp(custom.z,.9,8.7)};
  const boast=shot==='boast'&&!serve;
  if(boast)target={x:-sourceSide*2.65,z:2.15};
  const frontDistance=Math.max(.15,ball.z-R),backDistance=(target.z-R)/FRONT,path=frontDistance+backDistance,a=frontDistance/path;
  const desiredHeight=serve?2.45:shot==='lob'?3.2:shot==='drop'?.72:boast?.85:1.48;
  const baseline=ball.y*(1-a)+R*a;
  const height=Math.max(desiredHeight,baseline+.12);
  let totalTime=Math.sqrt(2*(height-baseline)/(G*a*(1-a)));
  // Keep normal drives punchy while allowing low, soft drops and high defensive lobs.
  const maxSpeed=shot==='drive'||shot==='cross'?23:shot==='lob'?16:18;
  totalTime=Math.max(totalTime,path/maxSpeed,.26);
  const unfoldedX=boast?sourceSide*2*(COURT.halfWidth-R)-target.x:target.x;
  const velocity={vx:(unfoldedX-ball.x)/totalTime,vy:(R-ball.y+.5*G*totalTime*totalTime)/totalTime,vz:-path/totalTime};
  let trace;
  // Account for energy lost at the side wall on boasts and the integration interval.
  for(let i=0;i<3;i++){
    trace=traceFlight({...ball,...velocity,frontHit:false,bounces:0});
    if(!trace.landing)break;
    const sign=trace.sides%2?-1:1;
    velocity.vx+=(target.x-trace.landing.x)/(trace.landing.time*sign);
    if(Math.abs(target.x-trace.landing.x)<.015)break;
  }
  trace=traceFlight({...ball,...velocity,frontHit:false,bounces:0});
  return {...velocity,target,front:trace.front,points:trace.points,landing:trace.landing,fault:trace.fault,shot};
}
const newPlayer=(x,z)=>({x,z,vx:0,vz:0,swing:0,prep:0,split:0,side:1,contact:null,facing:0,manualTimer:0,stance:'ready',volley:false,missed:false});
export class SquashGame{
  constructor({difficulty='rookie',mode='match',assist=true,footwork=true,rng=Math.random}={}){
    this.level=LEVELS[difficulty]||LEVELS.rookie;this.difficulty=difficulty;this.mode=mode;this.assist=assist;this.footwork=footwork;this.rng=rng;
    this.players=[newPlayer(-1.6,6.7),newPlayer(1.5,6.4)];
    this.score=[0,0];this.rally=0;this.best=0;this.returns=0;this.faults=0;this.events=[];this.aim=0;this.customTarget=null;this.shot='drive';this.server=0;this.clock=0;this.elapsed=0;this.paused=false;this.aiTimer=0;this.playerTimer=0;this.sinceHit=0;this.buffer=0;this.lastShot=null;
    this.prepareServe();
  }
  emit(type,data={}){this.events.push({type,...data});}
  drainEvents(){return this.events.splice(0);}
  prepareServe(){
    this.phase='ready';this.clock=0;this.rally=0;this.sinceHit=0;this.buffer=0;
    this.players=[newPlayer(-1.9,6.55),newPlayer(1.8,6.3)];
    this.lastHit=this.server;this.turn=this.mode==='practice'?0:1-this.server;
    const p=this.players[this.server];this.ball={x:p.x+.5,y:1.05,z:p.z-.2,vx:0,vy:0,vz:0,frontHit:false,bounces:0};
    this.aiTarget=null;this.playerTarget=null;this.aiTimer=0;this.playerTimer=0;this.emit('ready',{server:this.server});
  }
  setShot(shot){if(['drive','cross','drop','lob','boast'].includes(shot)){this.shot=shot;this.customTarget=null;}}
  setAim(aim){this.aim=clamp(aim,-1,1);this.customTarget=null;}
  setTarget(x,z){this.customTarget={x:clamp(x,-2.95,2.95),z:clamp(z,.9,8.7)};this.shot=z<3.5?'drop':'drive';}
  shotPlan(){return planShot(this.ball,this.shot,this.aim,this.customTarget,this.phase==='ready');}
  canHit(id){
    if(this.phase!=='rally'||this.turn!==id||!this.ball.frontHit||this.sinceHit<.2)return false;
    const p=this.players[id],b=this.ball,reach=id===0?1.18:this.level.reach;
    return Math.hypot(p.x-b.x,p.z-b.z)<reach&&b.y>.085&&b.y<2.0;
  }
  requestShot(shot=null){
    if(this.paused||this.phase==='over')return false;
    if(shot)this.setShot(shot);
    if(this.phase==='ready'&&this.server===0){this.launch(0,'drive',true);return true;}
    this.buffer=.7;this.players[0].volley=true;this.playerTimer=0;
    if(this.canHit(0)){this.launch(0,this.shot);return true;}
    return false;
  }
  chooseAIShot(){
    const me=this.players[1],other=this.players[0],b=this.ball,roll=this.rng();
    const stretched=Math.hypot(b.x-me.x,b.z-me.z)>.95;
    if(b.z>7.8&&(stretched||b.y<.4))return 'lob';
    if(b.z<4.8&&other.z>6.3&&b.y>.45&&roll<.64)return 'drop';
    if(b.z>5.8&&other.z>6.6&&roll<.13)return 'boast';
    if(sideOf(other.x)===sideOf(b.x)&&Math.abs(other.x)>1.1&&roll<.65)return 'cross';
    return roll>.83?'cross':'drive';
  }
  launch(id,shot='drive',serve=false){
    const b=this.ball,p=this.players[id];
    const plan=planShot(b,shot,id===0?this.aim:0,id===0?this.customTarget:null,serve);
    p.side=b.x-p.x<0?-1:1;p.contact={x:b.x,y:b.y,z:b.z};p.swing=.48;p.prep=1;p.stance='strike';
    Object.assign(b,{vx:plan.vx,vy:plan.vy,vz:plan.vz,frontHit:false,bounces:0});
    this.lastHit=id;this.turn=this.mode==='practice'?0:1-id;this.sinceHit=0;this.phase='rally';this.rally++;this.best=Math.max(this.best,this.rally);
    if(id===0&&!serve)this.returns++;
    this.players[1-id].split=.22;this.players[1-id].missed=false;this.players[1-id].volley=1-id===1?this.rng()<({rookie:.08,club:.28,pro:.55}[this.difficulty]||.28):false;this.lastShot={id,shot,target:plan.target};
    this.aiTarget=null;this.playerTarget=null;this.aiTimer=0;this.playerTimer=0;this.buffer=0;this.emit('hit',{id,shot,serve,side:p.side,target:plan.target});
  }
  award(winner,reason){
    if(this.phase!=='rally')return;
    if(this.mode==='practice'){this.faults++;this.server=0;this.phase='point';this.clock=0;this.emit('point',{winner:0,reason,rally:this.rally});return;}
    this.score[winner]++;this.server=winner;this.clock=0;
    const over=this.score[winner]>=11&&this.score[winner]-this.score[1-winner]>=2;
    this.phase=over?'over':'point';this.emit(over?'over':'point',{winner,reason,rally:this.rally});
  }
  recoveryTarget(id){
    const other=this.players[1-id];return {x:other.x<0?.18:-.18,z:5.5};
  }
  predictIntercept(id=1){
    const p=this.players[id],b={...this.ball},speed=id===0?5.8:this.level.speed;
    let fallback={x:clamp(b.x-sideOf(b.x)*.6,-2.65,2.65),z:clamp(b.z+.25,.7,9.1)};
    for(let i=1;i<=270;i++){
      const state=flightStep(b,1/90),t=i/90;if(state.fault)break;
      if(b.frontHit&&(b.bounces>0||p.volley)&&b.y>.18&&b.y<1.75&&this.sinceHit+t>.22){
        // Leave room between the body and ball for the racket and a side-on lunge.
        const position={x:clamp(b.x-sideOf(b.x)*.62,-2.72,2.72),z:clamp(b.z+.22,.65,9.15)};
        fallback=position;const reaction=id===0?.05:Math.max(0,this.level.reaction-this.sinceHit);
        if(Math.hypot(p.x-position.x,p.z-position.z)<=Math.max(0,t-reaction-.07)*speed+.28)return {...position,ballX:b.x,ballZ:b.z,time:t};
      }
    }
    return fallback;
  }
  movePlayer(p,x,z,speed,dt){
    const n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}
    const targetX=x*speed,targetZ=z*speed,dx=targetX-p.vx,dz=targetZ-p.vz,d=Math.hypot(dx,dz),acc=n<.05?38:26;
    const change=Math.min(1,acc*dt/Math.max(.0001,d));p.vx+=dx*change;p.vz+=dz*change;
    if(p.swing>.35){p.vx*=Math.exp(-dt*9);p.vz*=Math.exp(-dt*9);}
    p.x=clamp(p.x+p.vx*dt,-2.84,2.84);p.z=clamp(p.z+p.vz*dt,.58,9.2);
  }
  moveToward(p,target,speed,dt){
    const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),factor=Math.min(1,Math.sqrt(2*20*Math.max(0,d-.06))/speed);
    this.movePlayer(p,d>.06?dx/d*factor:0,d>.06?dz/d*factor:0,speed,dt);
  }
  update(dt,input={x:0,z:0}){
    if(this.paused||this.phase==='over')return;
    dt=clamp(dt,0,1/30);this.clock+=dt;this.elapsed+=dt;this.sinceHit+=dt;this.buffer=Math.max(0,this.buffer-dt);
    for(const p of this.players){p.swing=Math.max(0,p.swing-dt);p.split=Math.max(0,p.split-dt);p.manualTimer=Math.max(0,p.manualTimer-dt);}
    if(this.phase==='point'){for(const p of this.players){p.vx*=Math.exp(-dt*16);p.vz*=Math.exp(-dt*16);}if(this.clock>1.8)this.prepareServe();return;}
    const human=this.players[0],manual=Math.hypot(input.x||0,input.z||0)>.03;
    if(manual){human.manualTimer=.3;this.movePlayer(human,input.x,input.z,5.8,dt);}
    else if(this.phase==='rally'&&(input.recover||this.footwork)&&human.manualTimer<=0){
      this.playerTimer-=dt;
      if(this.playerTimer<=0){this.playerTarget=this.turn===0&&!input.recover?this.predictIntercept(0):this.recoveryTarget(0);this.playerTimer=.1;}
      this.moveToward(human,this.playerTarget||this.recoveryTarget(0),5.8,dt);
    }else this.movePlayer(human,0,0,5.8,dt);
    if(this.phase==='ready'){
      const p=this.players[this.server];Object.assign(this.ball,{x:p.x+.5,y:1.05,z:p.z-.2});if(this.server===1&&this.clock>1.2)this.launch(1,'drive',true);return;
    }
    if(this.mode!=='practice'){
      this.aiTimer-=dt;
      if(this.aiTimer<=0){this.aiTarget=this.turn===1?this.predictIntercept(1):this.recoveryTarget(1);this.aiTimer=.11;}
      this.moveToward(this.players[1],this.sinceHit>this.level.reaction?(this.aiTarget||this.recoveryTarget(1)):this.recoveryTarget(1),this.level.speed,dt);
    }
    this.players.forEach((p,id)=>{
      const receiving=this.turn===id&&(this.mode!=='practice'||id===0),d=Math.hypot(p.x-this.ball.x,p.z-this.ball.z);
      const prep=receiving&&d<4.2?1:0;p.prep=approach(p.prep,prep,dt*5);
      if(p.swing===0){p.side=this.ball.x-p.x<0?-1:1;p.stance=prep?'prepare':Math.hypot(p.vx,p.vz)>.3?'recover':'ready';}
      const angle=prep?-p.side*Math.PI*.43:0;const diff=Math.atan2(Math.sin(angle-p.facing),Math.cos(angle-p.facing));p.facing+=diff*Math.min(1,dt*11);
    });
    if(this.canHit(0)&&(this.assist||this.buffer>0)&&(this.ball.bounces>0||this.players[0].volley||!this.footwork))this.launch(0,this.shot);
    else if(this.mode!=='practice'&&!this.players[1].missed&&this.canHit(1)&&this.sinceHit>this.level.reaction&&(this.ball.bounces>0||this.players[1].volley)){
      const p=this.players[1],stretch=clamp((Math.hypot(p.x-this.ball.x,p.z-this.ball.z)-.65)/.5,0,1);
      // Finite timing precision: a sprinting, stretched receiver is less reliable.
      const error={rookie:.05,club:.025,pro:.01}[this.difficulty]+stretch*.035+Math.hypot(p.vx,p.vz)/this.level.speed*.015;
      if(this.rng()<error){p.missed=true;p.swing=.48;p.contact={x:this.ball.x,y:this.ball.y,z:this.ball.z};this.emit('miss',{id:1});}
      else this.launch(1,this.chooseAIShot());
    }
    const result=flightStep(this.ball,dt);
    if(result.fault){this.award(result.fault==='Double bounce'?this.lastHit:1-this.lastHit,result.fault);return;}
    for(const surface of result.events)this.emit('bounce',{surface,x:this.ball.x,y:this.ball.y,z:this.ball.z});
  }
}
