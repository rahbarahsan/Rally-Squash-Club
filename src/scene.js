import * as THREE from './vendor/three.module.js';
import { predictBounce, clamp } from './engine.js?v=3';
import { frameCourt } from './camera.js?v=3';
import { Athlete } from './athlete.js?v=3';
import { attachModel } from './model.js';
import { updatePath } from './path.js';
const C = { lime: 0xd5fa68, coral: 0xfb9477, ink: 0x163c36, lines: 0xe26e54 };
const UP = new THREE.Vector3(0, 1, 0);
export class CourtScene {
  constructor(container) {
    this.container = container;
    this.time = 0;
    this.inGame = false;
    this.cameraBlend = 0;
    this.effects = [];
    this.trail = [];
    this.nextPrediction = 0;
    this.bounceTarget = null;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x132d2b);
    this.scene.fog = new THREE.Fog(0x132d2b, 25, 64);
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0xf3f5e3, 0x24473f, 2.1));
    const sun = new THREE.DirectionalLight(0xfff3db, 3.4);
    sun.position.set(-4, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -10,
      right: 10,
      top: 13,
      bottom: -12,
      near: 1,
      far: 35,
    });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0xb9e5e6, 1.7);
    fill.position.set(8, 7, -5);
    this.scene.add(fill);
    this.court();
    this.people = [this.person(C.lime, 'YOU'), this.person(C.coral, 'RIVAL')];
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff632e }),
    );
    this.scene.add(this.ball);
    const markerCanvas = document.createElement('canvas');
    markerCanvas.width = markerCanvas.height = 128;
    const markerContext = markerCanvas.getContext('2d');
    markerContext.beginPath();
    markerContext.arc(64, 64, 51, 0, Math.PI * 2);
    markerContext.fillStyle = '#ff702d';
    markerContext.fill();
    markerContext.lineWidth = 14;
    markerContext.strokeStyle = '#102720';
    markerContext.stroke();
    markerContext.beginPath();
    markerContext.arc(51, 47, 16, 0, Math.PI * 2);
    markerContext.fillStyle = '#fff9d9';
    markerContext.fill();
    const markerMap = new THREE.CanvasTexture(markerCanvas);
    markerMap.colorSpace = THREE.SRGBColorSpace;
    this.ballMarker = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: markerMap,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.ballMarker.renderOrder = 100;
    this.scene.add(this.ballMarker);
    this.heightLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
      new THREE.LineDashedMaterial({
        color: 0x6a5030,
        transparent: true,
        opacity: 0.4,
        dashSize: 0.08,
        gapSize: 0.09,
        depthWrite: false,
      }),
    );
    this.scene.add(this.heightLine);
    this.shotPath = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: 0xf3ffdf,
        transparent: true,
        opacity: 0.65,
        dashSize: 0.13,
        gapSize: 0.1,
        depthWrite: false,
      }),
    );
    this.scene.add(this.shotPath);
    this.nextPlan = 0;
    this.plannedShot = null;
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 24),
      new THREE.MeshBasicMaterial({
        color: 0x173a29,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    this.landing = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.23, 0.28, 40),
      new THREE.MeshBasicMaterial({
        color: 0xff702d,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    this.landing.add(ring);
    this.landing.position.y = 0.028;
    this.scene.add(this.landing);
    this.aimTarget = new THREE.Group();
    const aimMat = new THREE.MeshBasicMaterial({
      color: C.lime,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    const aimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.19, 0.205, 32),
      aimMat,
    );
    this.aimTarget.add(aimRing);
    this.box(0.1, 0.018, 0.008, aimMat, 0, 0, 0.01, this.aimTarget);
    this.box(0.018, 0.1, 0.008, aimMat, 0, 0, 0.01, this.aimTarget);
    this.aimTarget.rotation.x = -Math.PI / 2;
    this.scene.add(this.aimTarget);
    this.trailMeshes = Array.from({ length: 18 }, (_, i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 4),
        new THREE.MeshBasicMaterial({
          color: 0xff6b28,
          transparent: true,
          opacity: 0.62 * (1 - i / 18),
          depthWrite: false,
          depthTest: false,
        }),
      );
      m.renderOrder = 98;
      this.scene.add(m);
      return m;
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  setQuality(quality) {
    const low = quality === 'low',
      high = quality === 'high';
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, high ? 2 : low ? 1 : 1.5),
    );
    this.renderer.shadowMap.enabled = !low;
    const size = high ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(size, size);
    }
    this.resize();
  }
  material(color, roughness = 0.65) {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }
  box(w, h, d, mat, x, y, z, parent = this.scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  line(points, color = C.lines, width = 0.035) {
    const mat = this.material(color, 0.6);
    for (let i = 1; i < points.length; i++) {
      const a = new THREE.Vector3(...points[i - 1]),
        b = new THREE.Vector3(...points[i]);
      const dir = b.clone().sub(a),
        m = new THREE.Mesh(
          new THREE.CylinderGeometry(width / 2, width / 2, dir.length(), 8),
          mat,
        );
      m.position.copy(a.add(b).multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(UP, dir.normalize());
      this.scene.add(m);
    }
  }
  textTexture(
    text,
    {
      width = 1024,
      height = 256,
      fg = '#e8efdc',
      bg = null,
      size = 170,
      font = '900',
    } = {},
  ) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = fg;
    ctx.font = `${font} ${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  sign(text, x, y, z, w, h, options = {}) {
    const map = this.textTexture(text, options),
      m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map,
          transparent: true,
          depthWrite: false,
        }),
      );
    m.position.set(x, y, z);
    this.scene.add(m);
    return m;
  }
  glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d'),
      g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.2, '#ffffff99');
    g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  court() {
    const concrete = this.material(0x18352f),
      edge = this.material(0x284e44, 0.4),
      red = this.material(C.lines),
      ivory = this.material(0xc7dbcb, 0.85);
    this.box(100, 0.15, 100, concrete, 0, -0.32, 3);
    this.box(7.05, 0.25, 10.4, this.material(0x365e4c), 0, -0.18, 4.875);
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 2048;
    const ctx = c.getContext('2d');
    let seed = 21;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    ctx.fillStyle = '#cfb990';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let x = 0; x < 1024; x += 51) {
      for (let y = -400 + rand() * 200; y < 2048; y += 340) {
        const light = 66 + rand() * 11;
        ctx.fillStyle = `hsl(36 37% ${light}%)`;
        ctx.fillRect(x, y, 50, 339);
        ctx.strokeStyle = 'rgba(80,55,18,.09)';
        for (let i = 0; i < 12; i++) {
          const xx = x + rand() * 50;
          ctx.beginPath();
          ctx.moveTo(xx, y);
          ctx.bezierCurveTo(xx + 6, y + 70, xx - 5, y + 180, xx + 2, y + 339);
          ctx.stroke();
        }
      }
    }
    const wood = new THREE.CanvasTexture(c);
    wood.colorSpace = THREE.SRGBColorSpace;
    wood.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 9.75),
      new THREE.MeshStandardMaterial({
        map: wood,
        roughness: 0.48,
        metalness: 0.035,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.005, 4.875);
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.box(6.55, 4.7, 0.14, ivory, 0, 2.35, -0.08);
    this.box(6.4, 0.48, 0.045, this.material(0x73948a, 0.55), 0, 0.24, 0.02);
    this.box(6.4, 0.045, 0.05, red, 0, 0.48, 0.05);
    this.box(6.4, 0.035, 0.035, red, 0, 1.78, 0.04);
    this.box(6.4, 0.045, 0.045, red, 0, 4.57, 0.04);
    const wallGlass = new THREE.MeshPhysicalMaterial({
      color: 0xa8d5ca,
      transparent: true,
      opacity: 0.075,
      roughness: 0.15,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const x of [-3.24, 3.24]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(9.75, 0);
      shape.lineTo(9.75, 2.2);
      shape.lineTo(0, 4.7);
      shape.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), wallGlass);
      m.rotation.y = -Math.PI / 2;
      m.position.x = x;
      this.scene.add(m);
      this.line(
        [
          [x, 0.03, 0],
          [x, 0.03, 9.75],
        ],
        0x7d9b87,
        0.055,
      );
      this.line(
        [
          [x, 4.68, 0],
          [x, 2.24, 9.75],
        ],
        0x5f8d7e,
        0.055,
      );
      this.line(
        [
          [x, 4.57, 0],
          [x, 2.13, 9.75],
        ],
        C.lines,
        0.032,
      );
      for (let z = 0; z <= 9.76; z += 3.25) {
        const h = 4.68 - (2.44 * z) / 9.75;
        this.box(0.035, h, 0.04, edge, x, h / 2, z);
      }
      this.box(0.045, 0.06, 9.75, edge, x, 0.03, 4.875);
    }
    // The back glass is deliberately very clear, keeping the ball legible.
    this.box(
      6.45,
      2.2,
      0.025,
      new THREE.MeshPhysicalMaterial({
        color: 0xc1e8df,
        transparent: true,
        opacity: 0.025,
        roughness: 0.1,
        depthWrite: false,
      }),
      0,
      1.1,
      9.79,
    );
    this.line(
      [
        [-3.2, 2.13, 9.79],
        [3.2, 2.13, 9.79],
      ],
      0x8fae99,
      0.024,
    );
    this.line(
      [
        [-3.2, 0.018, 5.5],
        [3.2, 0.018, 5.5],
      ],
      C.lines,
      0.035,
    );
    this.line(
      [
        [0, 0.018, 5.5],
        [0, 0.018, 9.75],
      ],
      C.lines,
      0.035,
    );
    this.line(
      [
        [-3.2, 0.02, 7.1],
        [-1.6, 0.02, 7.1],
        [-1.6, 0.02, 5.5],
      ],
      C.lines,
      0.035,
    );
    this.line(
      [
        [3.2, 0.02, 7.1],
        [1.6, 0.02, 7.1],
        [1.6, 0.02, 5.5],
      ],
      C.lines,
      0.035,
    );
    this.sign('RALLY', 0, 3.4, 0.012, 3.4, 0.85, { fg: '#426a5c', size: 195 });
    this.sign('S Q U A S H   C L U B', 0, 2.85, 0.014, 2.1, 0.28, {
      fg: '#658879',
      size: 70,
      font: '500',
    });
    this.sign('01', -2.73, 4.16, 0.016, 0.37, 0.3, {
      fg: '#638674',
      size: 180,
    });
    const floorLogo = this.sign('R A L L Y', 0, 0.015, 7.95, 1.7, 0.4, {
      fg: '#526e5650',
      size: 130,
      font: '600',
    });
    floorLogo.rotation.x = -Math.PI / 2;
    const led = new THREE.MeshBasicMaterial({ color: 0xd6f6ce });
    for (const x of [-3.6, 3.6]) {
      this.box(0.025, 0.012, 10, led, x, -0.05, 4.7);
      this.box(0.07, 5.9, 0.07, edge, x, 2.7, -0.3);
    }
    this.overhead = [];
    for (const z of [1.4, 5, 8.6]) {
      this.overhead.push(
        this.box(6.8, 0.08, 0.13, edge, 0, 5.7, z),
        this.box(6.5, 0.018, 0.08, led, 0, 5.65, z),
      );
    }
    // Architectural benches, foliage and lane markings make the court feel like a place.
    for (const side of [-1, 1]) {
      this.box(0.55, 0.12, 4.8, this.material(0x294b3e), side * 5.1, 0.5, 5.6);
      for (const z of [3.8, 7.4])
        this.box(0.08, 0.5, 0.15, edge, side * 5.1, 0.22, z);
      for (let i = 0; i < 5; i++)
        this.box(
          0.5,
          0.55,
          0.6,
          this.material(0x315549),
          side * 5.4,
          0.78,
          3.7 + i * 0.95,
        );
      this.plant(side * 4.6, 0, -0.9);
      this.plant(side * 4.6, 0, 10.3);
    }
    const backSign = this.sign('THE GLASS COURT', 0, 0.02, -2.0, 4, 0.5, {
      fg: '#608575',
      size: 95,
      font: '600',
    });
    backSign.rotation.x = -Math.PI / 2;
  }
  plant(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    this.scene.add(group);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.2, 0.55, 12),
      this.material(0x274c40),
    );
    pot.position.y = 0.15;
    pot.castShadow = true;
    group.add(pot);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(1, 7, 5),
        this.material(i % 2 ? 0x41694c : 0x315b40),
      );
      leaf.scale.set(0.11, 0.5, 0.05);
      leaf.position.set(
        Math.sin(i * 2.4) * 0.16,
        0.7 + (i % 3) * 0.13,
        Math.cos(i * 2.4) * 0.16,
      );
      leaf.rotation.set(Math.cos(i) * 0.35, 0, Math.sin(i) * 0.38);
      leaf.castShadow = true;
      group.add(leaf);
    }
  }
  person(color, label) {
    const athlete = new Athlete(
      this.scene,
      color,
      label,
      this.textTexture.bind(this),
    );
    attachModel(athlete, color);
    return athlete;
  }
  resize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }
  courtPoint(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect(),
      pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, this.camera);
    const hit = ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.025),
      new THREE.Vector3(),
    );
    if (!hit || Math.abs(hit.x) > 3.2 || hit.z < 0 || hit.z > 9.75) return null;
    return { x: hit.x, z: hit.z };
  }
  setPlaying(value) {
    this.inGame = value;
    this.trail = [];
  }
  impact(e) {
    const geo = new THREE.RingGeometry(0.07, 0.095, 24),
      mat = new THREE.MeshBasicMaterial({
        color: e.surface === 'floor' ? 0xf9ffca : C.lime,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(e.x, e.y, e.z);
    if (e.surface === 'floor') {
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.035;
    } else if (e.surface === 'front') {
      m.position.z = 0.085;
    } else if (e.surface === 'back') {
      m.position.z = 9.7;
    } else {
      m.rotation.y = Math.PI / 2;
      m.position.x = clamp(e.x, -3.16, 3.16);
    }
    this.scene.add(m);
    this.effects.push({ mesh: m, life: 0.45 });
  }
  render(game, dt) {
    this.time += dt;
    this.cameraBlend +=
      (Number(this.inGame) - this.cameraBlend) * Math.min(1, dt * 3);
    const portrait = this.width / this.height < 0.95;
    const menuPos = portrait
      ? new THREE.Vector3(11, 14, 20)
      : new THREE.Vector3(11.8, 11.7, 17.5);
    if (this.inGame) {
      frameCourt(
        this.camera,
        this.width,
        this.height,
        this.tactical,
        this.controlsExpanded,
      );
    } else {
      this.camera.zoom = 1;
      this.camera.position.copy(menuPos);
      this.camera.lookAt(0, 0.9, 4.6);
      this.camera.fov = portrait ? 53 : 43;
      this.camera.setViewOffset(
        this.width,
        this.height,
        portrait ? 0 : -this.width * 0.19,
        portrait ? this.height * 0.2 : -this.height * 0.025,
        this.width,
        this.height,
      );
      this.camera.updateProjectionMatrix();
    }
    for (const m of this.overhead || []) m.visible = !this.inGame;
    game.players.forEach((p, i) => {
      const a = this.people[i];
      a.group.visible = !(game.mode === 'practice' && i === 1 && this.inGame);
      a.label.visible = this.inGame;
      a.update(p, game.ball, dt, this.inGame && game.turn === i);
      a.animateModel?.(p, dt, game, i);
    });
    this.ball.position.set(game.ball.x, game.ball.y, game.ball.z);
    this.ballMarker.position.copy(this.ball.position);
    const distance = Math.abs(
      this.ball.position.clone().applyMatrix4(this.camera.matrixWorldInverse).z,
    );
    const pixels = this.width < 760 ? 18 : 17;
    const worldSize =
      (pixels * 2 * distance) /
      (this.camera.projectionMatrix.elements[5] * this.height);
    this.ballMarker.scale.set(worldSize, worldSize, 1);
    const heightPoints = this.heightLine.geometry.attributes.position;
    heightPoints.setXYZ(0, game.ball.x, 0.03, game.ball.z);
    heightPoints.setXYZ(1, game.ball.x, game.ball.y, game.ball.z);
    heightPoints.needsUpdate = true;
    this.heightLine.computeLineDistances();
    this.heightLine.visible = this.inGame && game.ball.y > 0.3;
    this.shadow.position.set(game.ball.x, 0.022, game.ball.z);
    this.shadow.scale.setScalar(0.8 + game.ball.y * 0.16);
    this.shadow.material.opacity = 0.42 / (1 + game.ball.y * 0.28);
    const show = game.phase === 'rally';
    if (show) {
      this.trail.unshift(this.ball.position.clone());
      if (this.trail.length > 18) this.trail.pop();
    } else this.trail = [];
    this.trailMeshes.forEach((m, i) => {
      m.visible = show && !!this.trail[i];
      if (m.visible) {
        m.position.copy(this.trail[i]);
        m.scale.setScalar(1 - i / 22);
      }
    });
    this.nextPrediction -= dt;
    if (this.nextPrediction <= 0) {
      this.bounceTarget = show ? predictBounce(game.ball) : null;
      this.nextPrediction = 0.07;
    }
    this.landing.visible =
      this.inGame && show && game.turn === 0 && !!this.bounceTarget;
    if (this.bounceTarget) {
      this.landing.position.set(
        this.bounceTarget.x,
        0.026,
        this.bounceTarget.z,
      );
      this.landing.scale.setScalar(1 + Math.sin(this.time * 6) * 0.1);
    }
    this.nextPlan -= dt;
    if (this.nextPlan <= 0) {
      this.plannedShot = game.shotPlan();
      this.nextPlan = 0.12;
      updatePath(this.shotPath.geometry, this.plannedShot.points || []);
      this.shotPath.frustumCulled = false;
    }
    const guide =
      this.inGame &&
      (game.phase === 'ready' || (game.phase === 'rally' && game.turn === 0));
    this.aimTarget.visible = guide;
    this.shotPath.visible = guide;
    if (this.plannedShot) {
      this.aimTarget.position.set(
        this.plannedShot.target.x,
        0.045,
        this.plannedShot.target.z,
      );
      this.aimTarget.scale.setScalar(1.35);
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      e.mesh.material.opacity = Math.max(0, e.life / 0.45) * 0.65;
      e.mesh.scale.setScalar(1 + (1 - e.life / 0.45) * 4);
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
