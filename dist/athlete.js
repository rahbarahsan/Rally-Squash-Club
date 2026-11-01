import * as THREE from './vendor/three.module.js';
import {clamp} from './engine.js?v=2';
const UP=new THREE.Vector3(0,1,0),v=(x,y,z)=>new THREE.Vector3(x,y,z);
const mix=(a,b,t)=>a.clone().lerp(b,t);
function segment(mesh,a,b){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=Math.max(.001,d.length());mesh.quaternion.setFromUnitVectors(UP,d.normalize());}
function joint(a,b,l1,l2,bend){
  const dir=b.clone().sub(a),d=Math.min(l1+l2-.002,Math.max(.01,dir.length()));dir.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-along*along));
  const perpendicular=bend.clone().addScaledVector(dir,-bend.dot(dir)).normalize();
  return a.clone().addScaledVector(dir,along).addScaledVector(perpendicular,h);
}
export class Athlete{
  constructor(scene,color,label,textTexture){
    this.group=new THREE.Group();scene.add(this.group);this.body=new THREE.Group();this.group.add(this.body);this.phase=0;this.facing=0;
    const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.78});
    const skin=mat(label==='YOU'?0xc18b67:0x976d53),kit=mat(color),dark=mat(0x183c34),white=mat(0xf0eddf);
    const mesh=(geo,m,parent=this.body)=>{const a=new THREE.Mesh(geo,m);a.castShadow=true;parent.add(a);return a;};
    this.torso=mesh(new THREE.CapsuleGeometry(.235,.34,6,16),kit);this.torso.scale.set(1.07,1,.64);
    this.shorts=mesh(new THREE.BoxGeometry(.39,.23,.28),dark);
    this.head=mesh(new THREE.SphereGeometry(.158,20,14),skin);this.head.scale.set(1,1.14,1);
    this.hair=mesh(new THREE.SphereGeometry(.163,16,12,0,Math.PI*2,0,Math.PI*.53),dark);
    this.neck=mesh(new THREE.CylinderGeometry(.075,.08,.13,10),skin);
    this.band=mesh(new THREE.CylinderGeometry(.164,.164,.035,20),white);
    const number=new THREE.Mesh(new THREE.PlaneGeometry(.15,.17),new THREE.MeshBasicMaterial({map:textTexture(label==='YOU'?'01':'02',{width:128,height:128,size:95,fg:'#28482e'}),transparent:true}));number.position.set(0,1.29,.165);this.body.add(number);this.number=number;
    const bone=(radius,m)=>mesh(new THREE.CylinderGeometry(radius,radius*.92,1,12),m);
    this.legs=[-1,1].map(side=>({side,upper:bone(.081,skin),lower:bone(.063,skin),knee:mesh(new THREE.SphereGeometry(.085,12,8),skin),sock:bone(.068,white),shoe:mesh(new THREE.SphereGeometry(1,14,10),white)}));
    this.legs.forEach(l=>l.shoe.scale.set(.086,.062,.155));
    this.arms=[-1,1].map(side=>({side,upper:bone(.073,kit),lower:bone(.052,skin),elbow:mesh(new THREE.SphereGeometry(.06,12,8),skin),hand:mesh(new THREE.SphereGeometry(.06,12,8),skin)}));
    this.racket=new THREE.Group();this.body.add(this.racket);
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.023,.023,.19,10),dark);handle.position.y=.07;this.racket.add(handle);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.012,.017,.23,8),white);shaft.position.y=.26;this.racket.add(shaft);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.165,.013,8,32),mat(0xf7f4e6));rim.scale.set(.8,1.3,1);rim.position.y=.5;this.racket.add(rim);
    const string=[];for(let i=-4;i<=4;i++){const x=i*.025,z=Math.sqrt(Math.max(0,1-(x/.132)**2))*.21;string.push(x,.5-z,0,x,.5+z,0);const y=i*.04,extent=Math.sqrt(Math.max(0,1-(y/.215)**2))*.13;string.push(-extent,.5+y,0,extent,.5+y,0);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(string,3));this.racket.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xc8d9c9,transparent:true,opacity:.85})));
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.37,.395,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.025;this.group.add(this.ring);
    this.label=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture(label,{width:256,height:80,size:33,font:'700',fg:label==='YOU'?'#d5fa68':'#fb9477',bg:'#183b31'}),transparent:true,depthTest:false}));this.label.position.y=2.14;this.label.scale.set(.55,.17,1);this.group.add(this.label);
  }
  update(p,ball,dt,active){
    this.group.position.set(p.x,0,p.z);
    const speed=Math.hypot(p.vx,p.vz),weight=clamp(speed/1.2,0,1);this.phase+=speed*dt/1.04;
    const swing=p.swing>0,progress=1-p.swing/.48;
    const desiredFacing=swing?-(p.side||1)*Math.PI*.43:p.facing||0;
    const diff=Math.atan2(Math.sin(desiredFacing-this.facing),Math.cos(desiredFacing-this.facing));this.facing+=diff*Math.min(1,dt*15);this.body.rotation.y=this.facing;
    const local=point=>v(point.x-p.x,point.y,point.z-p.z).applyAxisAngle(UP,-this.facing);
    const near=Math.hypot(ball.x-p.x,ball.z-p.z);
    const lunge=swing?Math.pow(1-progress,1.3):clamp((1.65-near)/.8,0,1)*(p.prep||0);
    const contact=local(swing&&p.contact?p.contact:ball);
    const crouch=.23*lunge+Math.sin((p.split||0)/.22*Math.PI)*.055;
    const lean=clamp(contact.y<1?.1:0,0,.1)*lunge;
    this.torso.position.set(0,1.24-crouch,-lean);this.torso.rotation.x=-lean*.8;
    this.shorts.position.set(0,.85-crouch,0);this.neck.position.set(0,1.61-crouch,-lean);
    this.head.position.set(0,1.79-crouch,-lean-.025);this.hair.position.copy(this.head.position).y+=.035;this.band.position.copy(this.head.position).y+=.065;this.number.position.y=1.29-crouch;
    const localVelocity=v(p.vx,0,p.vz).applyAxisAngle(UP,-this.facing);if(speed>.02)localVelocity.divideScalar(speed);
    const toward=v(contact.x,0,contact.z).normalize();
    this.legs.forEach((leg,i)=>{
      const u=(this.phase+i*.5)%1;let offset,lift;
      if(u<.6){offset=.31-u/.6*.62;lift=0;}else{const t=(u-.6)/.4;offset=-.31+(.5-.5*Math.cos(t*Math.PI))*.62;lift=Math.sin(t*Math.PI)*.13;}
      const foot=v(leg.side*.17,.065,0).addScaledVector(localVelocity,offset*weight);foot.y+=lift*weight;
      const lead=(p.side>0?i===0:i===1);foot.addScaledVector(toward,lunge*(lead?.48:-.19));foot.y=.065+(1-lunge)*lift*weight;
      const hip=v(leg.side*.135,.85-crouch,0),knee=joint(hip,foot,.43,.43,v(0,0,-1));
      segment(leg.upper,hip,knee);segment(leg.lower,knee,foot);leg.knee.position.copy(knee);segment(leg.sock,mix(knee,foot,.63),foot);leg.shoe.position.copy(foot).z-=.05;leg.shoe.rotation.y=lead&&lunge>.3?Math.atan2(toward.x,-toward.z)*.45:0;
    });
    const side=p.side||1;
    let head=mix(v(.43,1.62,-.38),v(side>0?.42:-.42,1.98,.25),(p.prep||0));
    if(swing){const follow=v(-side*.6,1.6,-.2);const finish=clamp(progress/.48,0,1);head=mix(contact,follow,Math.sin(finish*Math.PI/2));if(progress>.55)head.lerp(v(.43,1.62,-.38),(progress-.55)/.45);}
    const shoulder=v(.27,1.46-crouch,-lean);
    const axis=swing?head.clone().sub(shoulder).normalize():v(side>0?.2:-.2,.97,.1).normalize();
    const wrist=head.clone().addScaledVector(axis,-.5);
    const armReach=wrist.clone().sub(shoulder);if(armReach.length()>.715)wrist.copy(shoulder).add(armReach.setLength(.715));
    this.racket.position.copy(wrist);this.racket.quaternion.setFromUnitVectors(UP,axis);
    this.arms.forEach((arm,i)=>{
      const shoulder=v(arm.side*.27,1.46-crouch,-lean),hand=i===1?wrist:v(-.38,1.08-crouch,-.3-lunge*.18);
      const elbow=joint(shoulder,hand,.36,.36,i===1?v(.7,-.5,.4):v(-.7,-.5,.4));
      segment(arm.upper,shoulder,elbow);segment(arm.lower,elbow,hand);arm.elbow.position.copy(elbow);arm.hand.position.copy(hand);
    });
    this.ring.material.opacity=active?.85:.32;
  }
}
