import * as THREE from 'three';

// Winding footpath control points matching the reference art
export const pathPoints = [
  new THREE.Vector2(-1.5, 16.0),
  new THREE.Vector2(0.5, 9.0),
  new THREE.Vector2(3.5, 1.0),
  new THREE.Vector2(4.2, -6.0),
  new THREE.Vector2(2.0, -13.0),
  new THREE.Vector2(-2.5, -18.0),
  new THREE.Vector2(-6.5, -18.6)
];

// Distance to polyline path segments
export function getDistanceToPath(x, z) {
  let minDistSq = 1e9;
  const p = new THREE.Vector2(x, z);

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];

    const ab = b.clone().sub(a);
    const ap = p.clone().sub(a);

    const abLenSq = ab.lengthSq();
    let t = ap.dot(ab) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    const closest = a.clone().add(ab.multiplyScalar(t));
    const dSq = p.distanceToSquared(closest);
    if (dSq < minDistSq) minDistSq = dSq;
  }

  return Math.sqrt(minDistSq);
}

// GLSL chunk for distance to path calculation in terrain and grass fragment shaders
export const pathwayGLSL = /* glsl */ `
float distToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float getPathDistance(vec2 p) {
  float d = 1e5;
  d = min(d, distToSegment(p, vec2(-1.5, 16.0), vec2(0.5, 9.0)));
  d = min(d, distToSegment(p, vec2(0.5, 9.0), vec2(3.5, 1.0)));
  d = min(d, distToSegment(p, vec2(3.5, 1.0), vec2(4.2, -6.0)));
  d = min(d, distToSegment(p, vec2(4.2, -6.0), vec2(2.0, -13.0)));
  d = min(d, distToSegment(p, vec2(2.0, -13.0), vec2(-2.5, -18.0)));
  d = min(d, distToSegment(p, vec2(-2.5, -18.0), vec2(-6.5, -18.6)));
  return d;
}
`;
