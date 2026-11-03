import * as THREE from 'three';
import { grassVertexShader, grassFragmentShader } from './grassShaders.js';
import { getTerrainHeight } from '../terrain/terrainMath.js';
import { getDistanceToPath } from '../terrain/pathway.js';

export function createBladeGeometry() {
  const geom = new THREE.BufferGeometry();

  // 5 segment blade (11 vertices, 9 triangles)
  // Height fractions and width fractions
  const segments = [
    { y: 0.0,  w: 1.00 },
    { y: 0.22, w: 0.92 },
    { y: 0.46, w: 0.78 },
    { y: 0.70, w: 0.58 },
    { y: 0.90, w: 0.32 },
    { y: 1.00, w: 0.00 } // pointed tip
  ];

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const baseWidth = 0.12;
  const baseHeight = 1.35;

  let vertIndex = 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const y = s.y * baseHeight;
    const halfW = (s.w * baseWidth) / 2;

    if (i === segments.length - 1) {
      // Single tip vertex
      positions.push(0, y, 0);
      normals.push(0, 0, 1);
      uvs.push(0.5, s.y);
    } else {
      // Left and right vertices
      positions.push(-halfW, y, 0);
      normals.push(0, 0, 1);
      uvs.push(0.0, s.y);

      positions.push(halfW, y, 0);
      normals.push(0, 0, 1);
      uvs.push(1.0, s.y);
    }
  }

  // Generate triangles
  for (let i = 0; i < segments.length - 2; i++) {
    const b = i * 2;
    indices.push(b, b + 1, b + 2);
    indices.push(b + 1, b + 3, b + 2);
  }
  // Top cap triangle to tip
  const lastBase = (segments.length - 2) * 2;
  const tipIdx = lastBase + 2;
  indices.push(lastBase, lastBase + 1, tipIdx);

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);

  return geom;
}

export function createGrassField(instanceCount = 160000, fieldRadius = 68) {
  const baseGeom = createBladeGeometry();
  const instancedGeom = new THREE.InstancedBufferGeometry();

  instancedGeom.index = baseGeom.index;
  instancedGeom.attributes.position = baseGeom.attributes.position;
  instancedGeom.attributes.normal = baseGeom.attributes.normal;
  instancedGeom.attributes.uv = baseGeom.attributes.uv;

  const positions = new Float32Array(instanceCount * 3);
  const scales = new Float32Array(instanceCount * 3);
  const rotations = new Float32Array(instanceCount);
  const leans = new Float32Array(instanceCount * 2);
  const colorVars = new Float32Array(instanceCount * 3);

  // Group blades into natural organic tufts / clumps
  const clumpCount = Math.floor(instanceCount / 4);
  const clumpCenters = [];
  for (let c = 0; c < clumpCount; c++) {
    const r = Math.sqrt(Math.random()) * fieldRadius;
    const theta = Math.random() * Math.PI * 2;
    clumpCenters.push({
      x: r * Math.cos(theta),
      z: r * Math.sin(theta),
      hue: Math.random(),
      leanAngle: Math.random() * Math.PI * 2
    });
  }

  for (let i = 0; i < instanceCount; i++) {
    const i3 = i * 3;
    const i2 = i * 2;

    const clump = clumpCenters[i % clumpCount];
    // Offset slightly from clump center for natural floral tufts
    const offsetR = Math.random() * 0.45;
    const offsetA = Math.random() * Math.PI * 2;
    const x = clump.x + offsetR * Math.cos(offsetA);
    const z = clump.z + offsetR * Math.sin(offsetA);
    const y = getTerrainHeight(x, z);

    // Check distance to winding footpath
    const distPath = getDistanceToPath(x, z);
    let pathFactor = 1.0;
    if (distPath < 0.7) {
      pathFactor = 0.04; // Clear center of path
    } else if (distPath < 1.4) {
      pathFactor = 0.04 + 0.96 * ((distPath - 0.7) / 0.7); // Gentle taper to path margins
    }

    positions[i3 + 0] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    // Randomize scale: taller towards back, varied widths
    const heightScale = (0.9 + Math.random() * 0.65) * pathFactor;
    const widthScale = (0.85 + Math.random() * 0.45) * (pathFactor > 0.1 ? 1.0 : 0.0);
    scales[i3 + 0] = widthScale;
    scales[i3 + 1] = heightScale;
    scales[i3 + 2] = widthScale;

    // Rotate blade towards clump direction plus random flutter
    rotations[i] = clump.leanAngle + (Math.random() - 0.5) * 1.2;

    // Natural lean / curl in rest state
    leans[i2 + 0] = (Math.random() - 0.5) * 0.75;
    leans[i2 + 1] = 0.2 + Math.random() * 0.8;

    // Color and wind sensitivity variation
    colorVars[i3 + 0] = clump.hue; // hue/lightness shift correlated by clump
    colorVars[i3 + 1] = Math.random();
    colorVars[i3 + 2] = 0.8 + Math.random() * 0.4; // wind sensitivity factor
  }

  instancedGeom.setAttribute('aInstancePosition', new THREE.InstancedBufferAttribute(positions, 3));
  instancedGeom.setAttribute('aInstanceScale', new THREE.InstancedBufferAttribute(scales, 3));
  instancedGeom.setAttribute('aInstanceRotation', new THREE.InstancedBufferAttribute(rotations, 1));
  instancedGeom.setAttribute('aInstanceLean', new THREE.InstancedBufferAttribute(leans, 2));
  instancedGeom.setAttribute('aInstanceColorVar', new THREE.InstancedBufferAttribute(colorVars, 3));

  const uniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: 1.3 },
    uWindStrength: { value: 0.85 },
    uWindWaveFreq: { value: 0.075 },
    uWindDirection: { value: new THREE.Vector2(1.0, 0.35).normalize() },

    // Luminous Studio Ghibli & Ni no Kuni Color Palette
    uColorRoot: { value: new THREE.Color(0x1f4419) },      // Rich deep forest moss
    uColorMid: { value: new THREE.Color(0x6bb82d) },       // Vibrant luminous anime green
    uColorTip: { value: new THREE.Color(0xc7ea3b) },       // Sunlit lime chartreuse
    uColorSunlit: { value: new THREE.Color(0xf8fb6d) },    // Radiant golden sunny crest

    uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
    uSunColor: { value: new THREE.Color(0xfffae0) },
    uSkyLightColor: { value: new THREE.Color(0x7ec1e6) },
    uFogColor: { value: new THREE.Color(0xd7ecf4) },

    uSunlitStrength: { value: 0.95 },
    uShadowStrength: { value: 0.55 }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms: uniforms,
    side: THREE.DoubleSide,
    depthWrite: true
  });

  const mesh = new THREE.Mesh(instancedGeom, material);
  mesh.frustumCulled = false;

  return { mesh, material, uniforms };
}
