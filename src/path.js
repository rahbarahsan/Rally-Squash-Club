import { BufferAttribute } from './vendor/three.module.js';
export function updatePath(geometry, points) {
  let position = geometry.getAttribute('position'),
    distance = geometry.getAttribute('lineDistance');
  if (!position || position.count < points.length) {
    const capacity = Math.max(
      256,
      2 ** Math.ceil(Math.log2(points.length || 1)),
    );
    position = new BufferAttribute(new Float32Array(capacity * 3), 3);
    distance = new BufferAttribute(new Float32Array(capacity), 1);
    geometry.setAttribute('position', position);
    geometry.setAttribute('lineDistance', distance);
  }
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    position.setXYZ(i, p.x, p.y, p.z);
    if (i) {
      const prev = points[i - 1];
      length += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    }
    distance.setX(i, length);
  }
  position.needsUpdate = distance.needsUpdate = true;
  geometry.setDrawRange(0, points.length);
  // Preallocated unused vertices must not affect culling bounds.
  geometry.boundingSphere = null;
}
