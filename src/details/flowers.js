import * as THREE from 'three';
import { getTerrainHeight } from '../terrain/terrainMath.js';
import { noiseGLSL } from '../shaders/noise.glsl.js';

export function createWildflowers(flowerCount = 1800, fieldRadius = 55) {
  // Flower petal geometry: small cross or star with a rounded center
  const flowerGeom = new THREE.BufferGeometry();

  // Create simple 5-petal stylized flower geometry
  const positions = [];
  const uvs = [];
  const indices = [];

  // Center disk
  positions.push(0, 0, 0); // 0 center
  uvs.push(0.5, 0.5);

  const petalCount = 5;
  const radius = 0.16;

  for (let i = 0; i < petalCount; i++) {
    const angle1 = (i / petalCount) * Math.PI * 2;
    const angle2 = ((i + 1) / petalCount) * Math.PI * 2;
    const midAngle = (angle1 + angle2) / 2;

    const x1 = Math.cos(angle1) * radius * 0.4;
    const z1 = Math.sin(angle1) * radius * 0.4;
    const xTip = Math.cos(midAngle) * radius;
    const zTip = Math.sin(midAngle) * radius;
    const x2 = Math.cos(angle2) * radius * 0.4;
    const z2 = Math.sin(angle2) * radius * 0.4;

    const baseIdx = 1 + i * 3;
    positions.push(x1, 0, z1);
    positions.push(xTip, 0.02, zTip);
    positions.push(x2, 0, z2);

    uvs.push(0.5 + (x1 / radius) * 0.5, 0.5 + (z1 / radius) * 0.5);
    uvs.push(0.5 + (xTip / radius) * 0.5, 0.5 + (zTip / radius) * 0.5);
    uvs.push(0.5 + (x2 / radius) * 0.5, 0.5 + (z2 / radius) * 0.5);

    indices.push(0, baseIdx, baseIdx + 1);
    indices.push(0, baseIdx + 1, baseIdx + 2);
  }

  flowerGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  flowerGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  flowerGeom.setIndex(indices);
  flowerGeom.computeVertexNormals();

  const instancedGeom = new THREE.InstancedBufferGeometry();
  instancedGeom.index = flowerGeom.index;
  instancedGeom.attributes.position = flowerGeom.attributes.position;
  instancedGeom.attributes.normal = flowerGeom.attributes.normal;
  instancedGeom.attributes.uv = flowerGeom.attributes.uv;

  const instPositions = new Float32Array(flowerCount * 3);
  const instScales = new Float32Array(flowerCount * 3);
  const instColors = new Float32Array(flowerCount * 3);

  // Studio Ghibli wildflower color palette: pink cosmos, white daisy, buttercup yellow, lavender
  const flowerPalette = [
    new THREE.Color(0xf27b9b), // Soft pink
    new THREE.Color(0xff8fad), // Rose pink
    new THREE.Color(0xffffff), // Daisy white
    new THREE.Color(0xfef08a), // Buttercup yellow
    new THREE.Color(0xfde047), // Sunny dandelion
    new THREE.Color(0xd8b4fe)  // Soft lilac
  ];

  for (let i = 0; i < flowerCount; i++) {
    const i3 = i * 3;

    // Distribute in natural clumps / swaths, mostly in camera foreground & midground
    const r = Math.pow(Math.random(), 0.7) * fieldRadius;
    const theta = Math.random() * Math.PI * 2;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    // Sit slightly above ground, nestled in the grass
    const y = getTerrainHeight(x, z) + 0.45 + Math.random() * 0.5;

    instPositions[i3 + 0] = x;
    instPositions[i3 + 1] = y;
    instPositions[i3 + 2] = z;

    const s = 0.8 + Math.random() * 0.7;
    instScales[i3 + 0] = s;
    instScales[i3 + 1] = s;
    instScales[i3 + 2] = s;

    // Choose color from palette
    const color = flowerPalette[Math.floor(Math.random() * flowerPalette.length)];
    instColors[i3 + 0] = color.r;
    instColors[i3 + 1] = color.g;
    instColors[i3 + 2] = color.b;
  }

  instancedGeom.setAttribute('aInstancePosition', new THREE.InstancedBufferAttribute(instPositions, 3));
  instancedGeom.setAttribute('aInstanceScale', new THREE.InstancedBufferAttribute(instScales, 3));
  instancedGeom.setAttribute('aInstanceColor', new THREE.InstancedBufferAttribute(instColors, 3));

  const flowerVertexShader = /* glsl */ `
    ${noiseGLSL}

    attribute vec3 aInstancePosition;
    attribute vec3 aInstanceScale;
    attribute vec3 aInstanceColor;

    uniform float uTime;
    uniform float uWindSpeed;
    uniform float uWindStrength;
    uniform vec2 uWindDirection;

    varying vec3 vColor;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vColor = aInstanceColor;
      vUv = uv;

      vec3 localPos = position * aInstanceScale;
      vec3 worldBasePos = aInstancePosition;

      // Wind sway for flowers
      vec2 windDirNorm = normalize(uWindDirection);
      vec2 windCoord = worldBasePos.xz * 0.08 - windDirNorm * (uTime * uWindSpeed);
      float sway = snoise(windCoord) * uWindStrength * 0.45;
      localPos.xz += windDirNorm * sway;

      vec3 worldPos = worldBasePos + localPos;
      vWorldPos = worldPos;

      gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
  `;

  const flowerFragmentShader = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uFogColor;

    varying vec3 vColor;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      // Golden center for flower
      float dCenter = length(vUv - vec2(0.5));
      vec3 flowerCol = vColor;
      if (dCenter < 0.16) {
        flowerCol = vec3(0.95, 0.78, 0.15); // Yellow pollen center
      }

      // Sunlit boost
      flowerCol *= 1.15;

      // Distance fog
      float dist = length(vWorldPos - cameraPosition);
      float fog = smoothstep(40.0, 120.0, dist);
      flowerCol = mix(flowerCol, uFogColor, fog * 0.7);

      gl_FragColor = vec4(flowerCol, 1.0);
    }
  `;

  const uniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: 1.4 },
    uWindStrength: { value: 0.85 },
    uWindDirection: { value: new THREE.Vector2(1.0, 0.4).normalize() },
    uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
    uSunColor: { value: new THREE.Color(0xfffae0) },
    uFogColor: { value: new THREE.Color(0xd7ecf4) }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: flowerVertexShader,
    fragmentShader: flowerFragmentShader,
    uniforms: uniforms,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(instancedGeom, material);
  return { mesh, material, uniforms };
}
