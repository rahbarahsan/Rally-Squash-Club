import * as THREE from './vendor/three.module.js';
export const COURT_FRAME = [
  [-3.24, 0, 0],
  [3.24, 0, 0],
  [-3.24, 4.2, 0],
  [3.24, 4.2, 0],
  [-3.24, 0, 9.78],
  [3.24, 0, 9.78],
  [-2.8, 2.1, 9.2],
  [2.8, 2.1, 9.2],
];
export function projectBounds(camera, points = COURT_FRAME) {
  camera.updateMatrixWorld();
  const p = points.map((v) => new THREE.Vector3(...v).project(camera));
  return {
    left: Math.min(...p.map((v) => v.x)),
    right: Math.max(...p.map((v) => v.x)),
    bottom: Math.min(...p.map((v) => v.y)),
    top: Math.max(...p.map((v) => v.y)),
  };
}
export function frameCourt(
  camera,
  width,
  height,
  tactical = false,
  expanded = false,
) {
  const portrait = width / height < 0.95,
    compact = width < 760,
    landscape = !portrait && height < 600;
  camera.aspect = width / height;
  camera.fov = 45;
  camera.zoom = 1;
  camera.clearViewOffset();
  camera.position.set(
    0,
    tactical ? 13.5 : portrait ? 10 : landscape ? 3.1 : 4,
    tactical ? 14.5 : portrait ? 15 : landscape ? 15.5 : 13,
  );
  camera.lookAt(0, 1.2, 4.6);
  camera.updateProjectionMatrix();
  const rect = {
    left: -0.96,
    right: 0.96,
    top: 1 - 2 * (portrait ? 0.17 : landscape ? 0.16 : 0.105),
    bottom:
      -1 +
      2 *
        (portrait
          ? 0.27 + (expanded ? 0.07 : 0)
          : landscape
            ? 0.16
            : compact
              ? 0.23
              : 0.12),
  };
  let b = projectBounds(camera);
  camera.zoom = Math.min(
    (rect.right - rect.left) / (b.right - b.left),
    (rect.top - rect.bottom) / (b.top - b.bottom),
  );
  camera.updateProjectionMatrix();
  b = projectBounds(camera);
  // Off-axis framing keeps the full floor visible and leaves room for the controls.
  camera.projectionMatrix.elements[8] +=
    (b.left + b.right - rect.left - rect.right) / 2;
  camera.projectionMatrix.elements[9] +=
    (b.top + b.bottom - rect.top - rect.bottom) / 2;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return projectBounds(camera);
}
