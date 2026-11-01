import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {frameCourt,projectBounds} from '../dist/camera.js';
import {Athlete} from '../dist/athlete.js';
import {SquashGame,planShot} from '../dist/engine.js';
test('courtside camera enlarges desktop court width by at least 50 percent',()=>{
 const w=1440,h=900,old=new T.PerspectiveCamera(43,w/h,.1,100);old.position.set(0,10.7,14.9);old.lookAt(0,.9,4.6);const oldB=projectBounds(old);
 const camera=new T.PerspectiveCamera(),newB=frameCourt(camera,w,h);assert.ok((newB.right-newB.left)/(oldB.right-oldB.left)>1.5);
});
test('court frame stays inside viewports and the ball has a stable pixel size',()=>{
 for(const [w,h] of [[1440,900],[1920,1080],[390,844],[844,390]])for(const tactical of [false,true]){
  const c=new T.PerspectiveCamera(),b=frameCourt(c,w,h,tactical);assert.ok(b.left>=-.961&&b.right<=.961);assert.ok(b.top<=1&&b.bottom>=-1);
  for(const z of [.1,5,9.6]){const p=new T.Vector3(1,.8,z),depth=Math.abs(p.clone().applyMatrix4(c.matrixWorldInverse).z),size=17*2*depth/(c.projectionMatrix.elements[5]*h);const q=p.clone().add(new T.Vector3(1,0,0).applyQuaternion(c.quaternion).multiplyScalar(size));const width=Math.abs(q.project(c).x-p.project(c).x)*w/2;assert.ok(Math.abs(width-17)<.001);}
 }
});
test('athlete poses remain finite through preparation, contact and recovery',()=>{
 const scene=new T.Scene(),athlete=new Athlete(scene,0xd5fa68,'YOU',()=>new T.Texture()),g=new SquashGame();
 const p=g.players[0];p.x=p.z=0;p.prep=1;
 for(const side of [-1,1])for(const y of [.2,.9,1.7]){
  p.side=side;p.facing=-side*Math.PI*.43;p.contact={x:side*.85,y,z:-.35};p.swing=.48;
  for(let i=0;i<45;i++){p.swing=Math.max(0,p.swing-1/120);p.vx=i>30?1:0;athlete.update(p,p.contact,1/120,true);assert.ok(athlete.arms[1].upper.scale.y<.37);assert.ok(athlete.arms[1].lower.scale.y<.37);scene.updateMatrixWorld(true);athlete.group.traverse(o=>{for(const n of o.matrixWorld.elements)assert.ok(Number.isFinite(n));});}
 }
});
test('135 representative shot situations reach the intended floor region',()=>{
 for(const x of [-2.8,0,2.8])for(const y of [.15,.8,1.8])for(const z of [1,5,9])for(const shot of ['drive','cross','drop','lob','boast']){
  const p=planShot({x,y,z},shot);assert.equal(p.fault,undefined,`${shot} at ${x},${y},${z}`);assert.ok(p.landing);assert.ok(Math.abs(p.landing.x-p.target.x)<.18);assert.ok(Math.abs(p.landing.z-p.target.z)<.18);
 }
});
