import * as THREE from 'three';
import { getTerrainHeight } from '../terrain/terrainMath.js';

export function createGhibliHouse(posX = -7, posZ = -22) {
  const houseGroup = new THREE.Group();
  const posY = getTerrainHeight(posX, posZ);
  houseGroup.position.set(posX, posY, posZ);
  // Turned slightly towards the camera to showcase the waterwheel, timber porch, and copper dome
  houseGroup.rotation.y = -0.38;
  houseGroup.scale.set(1.25, 1.25, 1.25);

  // --- Anime / Ghibli Materials ---
  // 1. Plaster / Stucco walls (warm cream)
  const plasterMat = new THREE.MeshStandardMaterial({
    color: 0xf5ebd7,
    roughness: 0.85,
    metalness: 0.05
  });

  // 2. Timber framing & woodwork (dark warm walnut)
  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x483223,
    roughness: 0.75,
    metalness: 0.05
  });

  // 3. Stone foundation & chimney (weathered mossy stone)
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x5e5b52,
    roughness: 0.9,
    metalness: 0.02
  });

  // 4. Terracotta roof tiles (radiant Ghibli red-orange)
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xc44f33,
    roughness: 0.6,
    metalness: 0.05
  });

  // 5. Copper observatory dome (aged warm copper)
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xb57048,
    roughness: 0.45,
    metalness: 0.35
  });

  // 6. Glowing warm window glass
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffe896,
    emissive: 0xffaa33,
    emissiveIntensity: 0.6,
    roughness: 0.3
  });

  // --- 1. Foundation & Stone Base ---
  const foundationGeom = new THREE.BoxGeometry(6.4, 2.0, 5.4);
  const foundation = new THREE.Mesh(foundationGeom, stoneMat);
  foundation.position.y = 1.0;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  houseGroup.add(foundation);

  // --- 2. Main Floor & Timber Structure ---
  const mainFloorGeom = new THREE.BoxGeometry(6.0, 2.6, 5.0);
  const mainFloor = new THREE.Mesh(mainFloorGeom, plasterMat);
  mainFloor.position.y = 3.3;
  mainFloor.castShadow = true;
  mainFloor.receiveShadow = true;
  houseGroup.add(mainFloor);

  // Add decorative timber beam columns & cross-bracing
  const beamMat = timberMat;
  function addTimberBeam(x, y, z, sx, sy, sz, rotZ = 0) {
    const beamGeom = new THREE.BoxGeometry(sx, sy, sz);
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.set(x, y, z);
    beam.rotation.z = rotZ;
    beam.castShadow = true;
    houseGroup.add(beam);
  }

  // Corner timber posts
  addTimberBeam(-3.05, 3.3, -2.55, 0.25, 2.6, 0.25);
  addTimberBeam(3.05, 3.3, -2.55, 0.25, 2.6, 0.25);
  addTimberBeam(-3.05, 3.3, 2.55, 0.25, 2.6, 0.25);
  addTimberBeam(3.05, 3.3, 2.55, 0.25, 2.6, 0.25);

  // Horizontal mid-floor beams
  addTimberBeam(0, 2.05, 2.55, 6.2, 0.2, 0.2);
  addTimberBeam(0, 4.55, 2.55, 6.2, 0.2, 0.2);

  // Front porch with wooden deck
  const porchDeckGeom = new THREE.BoxGeometry(3.6, 0.3, 1.8);
  const porchDeck = new THREE.Mesh(porchDeckGeom, timberMat);
  porchDeck.position.set(0.5, 0.85, 3.4);
  houseGroup.add(porchDeck);

  // Porch roof awning
  const awningGeom = new THREE.BoxGeometry(3.8, 0.15, 1.9);
  const awning = new THREE.Mesh(awningGeom, roofMat);
  awning.position.set(0.5, 2.4, 3.4);
  awning.rotation.x = 0.2;
  houseGroup.add(awning);

  // Porch posts
  addTimberBeam(-1.2, 1.6, 4.1, 0.15, 1.5, 0.15);
  addTimberBeam(2.2, 1.6, 4.1, 0.15, 1.5, 0.15);

  // Front Wooden Door
  const doorGeom = new THREE.BoxGeometry(1.2, 2.0, 0.1);
  const door = new THREE.Mesh(doorGeom, timberMat);
  door.position.set(0.5, 2.0, 2.55);
  houseGroup.add(door);

  // Windows with warm anime light
  function addWindow(x, y, z, sx = 0.9, sy = 1.1) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.15, sy + 0.15, 0.1), timberMat);
    frame.position.set(x, y, z);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.12), windowMat);
    glass.position.set(x, y, z);
    houseGroup.add(frame);
    houseGroup.add(glass);
  }

  // Front & side windows
  addWindow(-1.8, 3.3, 2.55);
  addWindow(2.2, 3.3, 2.55);
  addWindow(3.05, 3.3, 0);
  addWindow(-3.05, 3.3, 1.0);

  // --- 3. Terracotta Gabled Roof ---
  const roofGeom = new THREE.ConeGeometry(4.8, 2.8, 4);
  roofGeom.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeom, roofMat);
  roof.scale.set(1.15, 1.0, 0.95);
  roof.position.y = 5.9;
  roof.castShadow = true;
  houseGroup.add(roof);

  // Dormer window on roof
  const dormerGeom = new THREE.BoxGeometry(1.2, 1.0, 1.2);
  const dormer = new THREE.Mesh(dormerGeom, plasterMat);
  dormer.position.set(0.6, 5.6, 1.8);
  const dormerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.8, 4), roofMat);
  dormerRoof.position.set(0.6, 6.3, 1.8);
  dormerRoof.rotation.y = Math.PI / 4;
  houseGroup.add(dormer);
  houseGroup.add(dormerRoof);
  addWindow(0.6, 5.6, 2.45, 0.6, 0.6);

  // --- 4. Copper Observatory Dome (as seen in Ni no Kuni reference art) ---
  const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.9, 16), stoneMat);
  turretBase.position.set(-1.4, 6.8, -0.4);
  const copperDome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), copperMat);
  copperDome.position.set(-1.4, 7.25, -0.4);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.0, 8), copperMat);
  spire.position.set(-1.4, 8.2, -0.4);
  houseGroup.add(turretBase);
  houseGroup.add(copperDome);
  houseGroup.add(spire);

  // --- 5. Stone Chimney & Animated Smoke System ---
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.2, 0.8), stoneMat);
  chimney.position.set(2.0, 6.2, -1.2);
  chimney.castShadow = true;
  houseGroup.add(chimney);

  // Chimney Smoke Particles
  const smokeCount = 35;
  const smokeGeom = new THREE.BufferGeometry();
  const smokePositions = new Float32Array(smokeCount * 3);
  const smokeAges = new Float32Array(smokeCount);
  const smokeScales = new Float32Array(smokeCount);

  for (let i = 0; i < smokeCount; i++) {
    smokePositions[i * 3 + 0] = 2.0;
    smokePositions[i * 3 + 1] = 7.8;
    smokePositions[i * 3 + 2] = -1.2;
    smokeAges[i] = Math.random() * 4.0;
    smokeScales[i] = 0.4 + Math.random() * 0.4;
  }

  smokeGeom.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
  smokeGeom.setAttribute('aAge', new THREE.BufferAttribute(smokeAges, 1));
  smokeGeom.setAttribute('aScale', new THREE.BufferAttribute(smokeScales, 1));

  const smokeVertexShader = /* glsl */ `
    attribute float aAge;
    attribute float aScale;
    uniform float uTime;
    varying float vAlpha;

    void main() {
      float life = mod(uTime * 0.8 + aAge, 4.0);
      float progress = life / 4.0; // 0.0 to 1.0

      vec3 pos = position;
      // Rising smoke with breeze drift
      pos.y += progress * 4.5;
      pos.x += progress * progress * 2.5 + sin(progress * 8.0) * 0.2;
      pos.z += progress * 1.2;

      // Expand as it rises (classic anime puffy smoke)
      float size = aScale * (1.0 + progress * 4.5);

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = size * (40.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;

      // Soft puff alpha curve
      vAlpha = smoothstep(0.0, 0.2, progress) * smoothstep(1.0, 0.6, progress);
    }
  `;

  const smokeFragmentShader = /* glsl */ `
    varying float vAlpha;
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      float softEdge = smoothstep(0.5, 0.05, dist);
      vec3 smokeColor = vec3(0.96, 0.94, 0.92); // Fluffy anime white puff
      gl_FragColor = vec4(smokeColor, softEdge * vAlpha * 0.5);
    }
  `;

  const smokeMat = new THREE.ShaderMaterial({
    vertexShader: smokeVertexShader,
    fragmentShader: smokeFragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false
  });

  const smokePoints = new THREE.Points(smokeGeom, smokeMat);
  houseGroup.add(smokePoints);

  // --- 6. Rotating Wooden Water Wheel ---
  const waterWheelGroup = new THREE.Group();
  waterWheelGroup.position.set(-3.6, 1.4, 0.5); // On the left wall facing the pond

  // Wheel rim & spokes
  const wheelRadius = 1.6;
  const rimGeom = new THREE.TorusGeometry(wheelRadius, 0.08, 8, 24);
  rimGeom.rotateY(Math.PI / 2);
  const outerRim = new THREE.Mesh(rimGeom, timberMat);
  waterWheelGroup.add(outerRim);

  const innerRim = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius * 0.6, 0.07, 8, 24), timberMat);
  innerRim.rotation.y = Math.PI / 2;
  waterWheelGroup.add(innerRim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 12), timberMat);
  hub.rotation.z = Math.PI / 2;
  waterWheelGroup.add(hub);

  // Spokes and paddles
  const paddleCount = 8;
  for (let i = 0; i < paddleCount; i++) {
    const angle = (i / paddleCount) * Math.PI * 2;
    // Spoke
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, wheelRadius * 2, 0.08), timberMat);
    spoke.rotation.x = angle;
    waterWheelGroup.add(spoke);

    // Paddle blade
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.05), timberMat);
    paddle.position.set(0, Math.sin(angle) * wheelRadius, Math.cos(angle) * wheelRadius);
    paddle.rotation.x = angle + Math.PI / 2;
    waterWheelGroup.add(paddle);
  }

  houseGroup.add(waterWheelGroup);

  // --- 7. Warm Porch Lantern ---
  const lanternLight = new THREE.PointLight(0xffb040, 2.5, 12, 1.2);
  lanternLight.position.set(0.5, 2.3, 4.0);
  houseGroup.add(lanternLight);

  const lanternMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), windowMat);
  lanternMesh.position.set(0.5, 2.3, 4.0);
  houseGroup.add(lanternMesh);

  // Update function for animations
  function update(delta, elapsedTime) {
    // Rotate the water wheel continuously
    waterWheelGroup.rotation.x += delta * 1.2;
    // Update smoke time
    smokeMat.uniforms.uTime.value = elapsedTime;
  }

  return { group: houseGroup, update };
}
