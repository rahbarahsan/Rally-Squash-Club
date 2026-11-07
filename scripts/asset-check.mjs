import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await page.goto('http://127.0.0.1:8000/asset-review');
const result = await page.evaluate(async () => {
  document.body.innerHTML =
    '<div id="review" style="position:fixed;inset:0"></div>';
  const { CourtScene } = await import('/scene.js');
  const { SquashGame } = await import('/engine.js');
  const court = new CourtScene(document.querySelector('#review'));
  court.setQuality('medium');
  court.setPlaying(true);
  const game = new SquashGame();
  const deadline = performance.now() + 15000;
  while (
    !court.people.every((a) => a.group.userData.modelLoaded) &&
    performance.now() < deadline
  )
    await new Promise((resolve) => setTimeout(resolve, 50));
  if (!court.people.every((a) => a.group.userData.modelLoaded))
    throw new Error('GLB did not load');
  window.reviewPose = (side, y, progress) => {
    game.phase = 'rally';
    game.turn = 1;
    const p = game.players[0];
    Object.assign(p, {
      x: 0,
      z: 7,
      vx: 0,
      vz: 0,
      side,
      contact: { x: side * 0.75, y, z: 6.78 },
      swing: 0.48 * (1 - progress),
      prep: progress === 1 ? 0 : 1,
      facing: 0,
      stroke: y > 1.3 ? 'volley' : 'ground',
    });
    if (progress === 1) court.people[0].facing = 0;
    court.render(game, 0);
    court.people[1].group.visible = false;
    court.camera.clearViewOffset();
    court.camera.zoom = 1;
    court.camera.aspect = 1000 / 700;
    court.camera.fov = 36;
    court.camera.position.set(2.5, 2.7, 11);
    court.camera.lookAt(0, 1, 7);
    if (progress === 1) {
      court.camera.position.set(1.2, 2.1, 3.9);
      court.camera.lookAt(0, 1.25, 7);
    }
    court.camera.updateProjectionMatrix();
    court.renderer.render(court.scene, court.camera);
    // Exercise the exported skin, not only the procedural pose driver.
    court.people[0].group.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const point = mesh.position.clone();
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i);
        mesh.applyBoneTransform(i, point).applyMatrix4(mesh.matrixWorld);
        if (
          ![point.x, point.y, point.z].every(Number.isFinite) ||
          Math.abs(point.x - p.x) > 2 ||
          Math.abs(point.z - p.z) > 2.5 ||
          point.y < -0.2 ||
          point.y > 2.8
        ) {
          throw new Error(`Athlete skin exceeded pose bounds at vertex ${i}`);
        }
      }
    });
  };
  return { modelsLoaded: true };
});
for (const [name, side, y, progress] of [
  ['forehand', 1, 0.8, 0],
  ['backhand', -1, 0.8, 0],
  ['low-lunge', 1, 0.2, 0],
  ['volley', -1, 1.7, 0],
  ['follow-through', 1, 0.8, 0.5],
  ['front-detail', 1, 1.2, 1],
]) {
  await page.evaluate(
    ({ side, y, progress }) => window.reviewPose(side, y, progress),
    { side, y, progress },
  );
  await page.screenshot({ path: `artifacts/pose-${name}.png` });
}
await browser.close();
await writeFile('artifacts/asset-report.json', JSON.stringify(result, null, 2));
console.log(result);
