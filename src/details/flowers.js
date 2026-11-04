import * as THREE from 'three';
import { getTerrainHeight } from '../terrain/terrainMath.js';
import { getDistanceToPath } from '../terrain/pathway.js';
import { noiseGLSL } from '../shaders/noise.glsl.js';

export function createWildflowers(flowerCount = 2200, fieldRadius = 65) {
  // --- Construct 3D Stylized Wildflower Geometry ---
  // Includes cupped petals, golden pollen center, and vertical green stem cross
  const positions = [];
  const uvs = [];
  const normals = [];
  const types = []; // 0.0 = petal, 1.0 = pollen center, 2.0 = stem/leaf
  const indices = [];

  let vertIdx = 0;

  // Helper to add a triangle
  function addTriangle(p1, p2, p3, uv1, uv2, uv3, norm, typeVal) {
    positions.push(...p1, ...p2, ...p3);
    uvs.push(...uv1, ...uv2, ...uv3);
    normals.push(...norm, ...norm, ...norm);
    types.push(typeVal, typeVal, typeVal);
    indices.push(vertIdx, vertIdx + 1, vertIdx + 2);
    vertIdx += 3;
  }

  // Helper to add a double-sided quad
  function addQuad(p1, p2, p3, p4, uv1, uv2, uv3, uv4, norm, typeVal) {
    addTriangle(p1, p2, p3, uv1, uv2, uv3, norm, typeVal);
    addTriangle(p1, p3, p4, uv1, uv3, uv4, norm, typeVal);
  }

  // 1. Center Pollen Disk (Hexagonal disc, slightly raised)
  const centerRadius = 0.055;
  const centerY = 0.045;
  const centerVert = [0, centerY, 0];
  const centerUv = [0.5, 0.5];
  const diskSegments = 6;

  for (let s = 0; s < diskSegments; s++) {
    const a1 = (s / diskSegments) * Math.PI * 2;
    const a2 = ((s + 1) / diskSegments) * Math.PI * 2;

    const p1 = [Math.cos(a1) * centerRadius, centerY, Math.sin(a1) * centerRadius];
    const p2 = [Math.cos(a2) * centerRadius, centerY, Math.sin(a2) * centerRadius];

    const u1 = [0.5 + Math.cos(a1) * 0.15, 0.5 + Math.sin(a1) * 0.15];
    const u2 = [0.5 + Math.cos(a2) * 0.15, 0.5 + Math.sin(a2) * 0.15];

    addTriangle(centerVert, p1, p2, centerUv, u1, u2, [0, 1, 0], 1.0);
  }

  // 2. 5-Petal 3D Cupped Crown
  const petalCount = 5;
  const petalLength = 0.22;
  const petalHalfWidth = 0.085;

  for (let i = 0; i < petalCount; i++) {
    const angleMid = (i / petalCount) * Math.PI * 2;
    const angleLeft = angleMid - 0.38;
    const angleRight = angleMid + 0.38;

    // Petal base (at center perimeter)
    const bL = [Math.cos(angleLeft) * centerRadius, centerY, Math.sin(angleLeft) * centerRadius];
    const bR = [Math.cos(angleRight) * centerRadius, centerY, Math.sin(angleRight) * centerRadius];

    // Petal mid-belly (cupped upward and outward)
    const midR = centerRadius + petalLength * 0.55;
    const midY = centerY + 0.045; // Cupped upward arch
    const mL = [Math.cos(angleLeft) * midR - Math.sin(angleMid) * petalHalfWidth, midY, Math.sin(angleLeft) * midR + Math.cos(angleMid) * petalHalfWidth];
    const mR = [Math.cos(angleRight) * midR + Math.sin(angleMid) * petalHalfWidth, midY, Math.sin(angleRight) * midR - Math.cos(angleMid) * petalHalfWidth];

    // Petal tip (gently curving out)
    const tipR = centerRadius + petalLength;
    const tipY = centerY + 0.025;
    const tip = [Math.cos(angleMid) * tipR, tipY, Math.sin(angleMid) * tipR];

    // UVs for petal texture gradient
    const uvBL = [0.3, 0.0];
    const uvBR = [0.7, 0.0];
    const uvML = [0.1, 0.6];
    const uvMR = [0.9, 0.6];
    const uvTip = [0.5, 1.0];

    // Petal normal (upward angled)
    const pNorm = [Math.cos(angleMid) * 0.3, 0.9, Math.sin(angleMid) * 0.3];

    // Lower petal quad
    addQuad(bL, mL, mR, bR, uvBL, uvML, uvMR, uvBR, pNorm, 0.0);
    // Upper petal triangle to tip
    addTriangle(mL, tip, mR, uvML, uvTip, uvMR, pNorm, 0.0);
  }

  // 3. Vertical Cross-Quad Green Stem & Leaf Base (Ensures visibility from horizontal / low camera angles!)
  const stemWidth = 0.024;
  const stemTop = centerY;
  const stemBottom = -0.52; // Nestles deep into the grass field and soil

  // Stem Quad 1 (along X-axis)
  addQuad(
    [-stemWidth, stemTop, 0],
    [-stemWidth, stemBottom, 0],
    [stemWidth, stemBottom, 0],
    [stemWidth, stemTop, 0],
    [0, 1], [0, 0], [1, 0], [1, 1],
    [0, 0, 1],
    2.0
  );

  // Stem Quad 2 (along Z-axis)
  addQuad(
    [0, stemTop, -stemWidth],
    [0, stemBottom, -stemWidth],
    [0, stemBottom, stemWidth],
    [0, stemTop, stemWidth],
    [0, 1], [0, 0], [1, 0], [1, 1],
    [1, 0, 0],
    2.0
  );

  // Small leafy calyx tabs under petals
  for (let c = 0; c < 3; c++) {
    const cAng = (c / 3) * Math.PI * 2 + 0.5;
    const cR = 0.10;
    const lTip = [Math.cos(cAng) * cR, centerY - 0.04, Math.sin(cAng) * cR];
    const l1 = [Math.cos(cAng - 0.5) * 0.03, centerY - 0.01, Math.sin(cAng - 0.5) * 0.03];
    const l2 = [Math.cos(cAng + 0.5) * 0.03, centerY - 0.01, Math.sin(cAng + 0.5) * 0.03];
    addTriangle(l1, lTip, l2, [0, 0], [0.5, 1], [1, 0], [0, -1, 0], 2.0);
  }

  // Base Geometry
  const baseGeom = new THREE.BufferGeometry();
  baseGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  baseGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  baseGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  baseGeom.setAttribute('aType', new THREE.Float32BufferAttribute(types, 1));
  baseGeom.setIndex(indices);

  // Instanced Geometry
  const instancedGeom = new THREE.InstancedBufferGeometry();
  instancedGeom.index = baseGeom.index;
  instancedGeom.attributes.position = baseGeom.attributes.position;
  instancedGeom.attributes.normal = baseGeom.attributes.normal;
  instancedGeom.attributes.uv = baseGeom.attributes.uv;
  instancedGeom.attributes.aType = baseGeom.attributes.aType;

  const instPositions = new Float32Array(flowerCount * 3);
  const instScales = new Float32Array(flowerCount * 3);
  const instColors = new Float32Array(flowerCount * 3);
  const instAngles = new Float32Array(flowerCount * 2); // (yaw, tilt)

  // Studio Ghibli wildflower color palette: pink cosmos, daisy white, sunny buttercup, lilac, forget-me-not sky blue, warm poppy
  const flowerPalette = [
    new THREE.Color(0xf27b9b), // Soft cosmos pink
    new THREE.Color(0xff8fad), // Rose pink
    new THREE.Color(0xffffff), // Daisy white
    new THREE.Color(0xfef08a), // Buttercup yellow
    new THREE.Color(0xfde047), // Sunny dandelion
    new THREE.Color(0xd8b4fe), // Soft lilac
    new THREE.Color(0x38bdf8), // Sky blue forget-me-not
    new THREE.Color(0xfb923c)  // Vibrant poppy
  ];

  let placedCount = 0;
  let attempts = 0;
  const maxAttempts = flowerCount * 5;

  while (placedCount < flowerCount && attempts < maxAttempts) {
    attempts++;

    // Distribute in natural clumps / swaths, mostly in camera foreground & midground
    const r = Math.pow(Math.random(), 0.65) * fieldRadius;
    const theta = Math.random() * Math.PI * 2;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);

    // Keep path clear for Doge and walking
    if (getDistanceToPath(x, z) < 0.75) continue;

    // Keep house perimeter clear
    if (Math.hypot(x - (-7), z - (-22)) < 5.2) continue;

    // Sit naturally nestled in the grass field, reaching up through the blades
    const y = getTerrainHeight(x, z) + 0.58 + Math.random() * 0.62;

    const i3 = placedCount * 3;
    const i2 = placedCount * 2;

    instPositions[i3 + 0] = x;
    instPositions[i3 + 1] = y;
    instPositions[i3 + 2] = z;

    // Varied natural scale (1.15 to 2.0) for lush visibility
    const s = 1.15 + Math.random() * 0.85;
    instScales[i3 + 0] = s;
    instScales[i3 + 1] = s;
    instScales[i3 + 2] = s;

    // Color from palette
    const color = flowerPalette[Math.floor(Math.random() * flowerPalette.length)];
    instColors[i3 + 0] = color.r;
    instColors[i3 + 1] = color.g;
    instColors[i3 + 2] = color.b;

    // Natural random yaw (0..2PI) and gentle random tilt (10..30 degrees)
    // This guarantees flowers face in all directions so they never vanish at low/grazing camera angles!
    instAngles[i2 + 0] = Math.random() * Math.PI * 2; // yaw
    instAngles[i2 + 1] = 0.18 + Math.random() * 0.32; // tilt (radians)

    placedCount++;
  }

  instancedGeom.setAttribute('aInstancePosition', new THREE.InstancedBufferAttribute(instPositions, 3));
  instancedGeom.setAttribute('aInstanceScale', new THREE.InstancedBufferAttribute(instScales, 3));
  instancedGeom.setAttribute('aInstanceColor', new THREE.InstancedBufferAttribute(instColors, 3));
  instancedGeom.setAttribute('aInstanceAngle', new THREE.InstancedBufferAttribute(instAngles, 2));

  // CRITICAL: Set extensive bounding sphere and box so Three.js never falsely culls instanced flowers!
  instancedGeom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), fieldRadius * 2.5);
  instancedGeom.boundingBox = new THREE.Box3(
    new THREE.Vector3(-fieldRadius * 1.5, -20, -fieldRadius * 1.5),
    new THREE.Vector3(fieldRadius * 1.5, 45, fieldRadius * 1.5)
  );

  const flowerVertexShader = /* glsl */ `
    ${noiseGLSL}

    attribute vec3 aInstancePosition;
    attribute vec3 aInstanceScale;
    attribute vec3 aInstanceColor;
    attribute vec2 aInstanceAngle; // (yaw, tilt)
    attribute float aType;

    uniform float uTime;
    uniform float uWindSpeed;
    uniform float uWindStrength;
    uniform vec2 uWindDirection;

    varying vec3 vColor;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying float vType;
    varying vec3 vNormal;

    void main() {
      vColor = aInstanceColor;
      vUv = uv;
      vType = aType;

      vec3 localPos = position * aInstanceScale;

      // Apply instance natural 3D tilt (around X) then yaw (around Y)
      float cosT = cos(aInstanceAngle.y);
      float sinT = sin(aInstanceAngle.y);
      vec3 tilted = vec3(localPos.x, localPos.y * cosT - localPos.z * sinT, localPos.y * sinT + localPos.z * cosT);

      float cosY = cos(aInstanceAngle.x);
      float sinY = sin(aInstanceAngle.x);
      vec3 rotated = vec3(tilted.x * cosY + tilted.z * sinY, tilted.y, -tilted.x * sinY + tilted.z * cosY);

      vec3 worldBasePos = aInstancePosition;

      // Realistic wind sway (head sways dynamically, stem base anchored in ground)
      float heightFactor = clamp((position.y + 0.52) / 0.58, 0.0, 1.0);
      vec2 windDirNorm = normalize(uWindDirection);
      vec2 windCoord = worldBasePos.xz * 0.08 - windDirNorm * (uTime * uWindSpeed);
      float sway = snoise(windCoord) * uWindStrength * 0.40 * heightFactor;
      rotated.xz += windDirNorm * sway;

      vec3 worldPos = worldBasePos + rotated;
      vWorldPos = worldPos;

      // Transformed normal for smooth diffuse lighting
      vec3 norm = normal;
      vec3 tiltedNorm = vec3(norm.x, norm.y * cosT - norm.z * sinT, norm.y * sinT + norm.z * cosT);
      vNormal = vec3(tiltedNorm.x * cosY + tiltedNorm.z * sinY, tiltedNorm.y, -tiltedNorm.x * sinY + tiltedNorm.z * cosY);

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
    varying float vType;
    varying vec3 vNormal;

    void main() {
      vec3 col = vColor;

      if (vType > 1.5) {
        // Lush green stem & leaves nestled in grass
        col = vec3(0.24, 0.46, 0.15);
      } else if (vType > 0.5) {
        // Golden sunny pollen center
        col = vec3(0.98, 0.82, 0.15);
      } else {
        // Petal: gradient from golden core to luminous petal color
        float dCenter = length(vUv - vec2(0.5, 0.0));
        if (dCenter < 0.22) {
          col = mix(vec3(0.98, 0.82, 0.15), vColor, smoothstep(0.08, 0.22, dCenter));
        }
      }

      // Soft Ghibli diffuse wrap lighting
      vec3 norm = normalize(vNormal);
      vec3 sunDir = normalize(uSunDirection);
      float NdotL = max(0.0, dot(norm, sunDir)) * 0.45 + 0.55;
      col *= (uSunColor * NdotL);

      // Sunlit boost
      col *= 1.15;

      // Distance fog (matches terrain and grass fog)
      float dist = length(vWorldPos - cameraPosition);
      float fog = smoothstep(45.0, 130.0, dist);
      col = mix(col, uFogColor, fog * 0.72);

      gl_FragColor = vec4(col, 1.0);
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
    side: THREE.DoubleSide,
    depthWrite: true
  });

  const mesh = new THREE.Mesh(instancedGeom, material);
  // CRITICAL: Disable frustum culling on instanced mesh so flowers NEVER vanish when moving or zooming!
  mesh.frustumCulled = false;

  return { mesh, material, uniforms };
}
