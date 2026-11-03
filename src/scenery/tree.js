import * as THREE from 'three';
import { getTerrainHeight } from '../terrain/terrainMath.js';
import { noiseGLSL } from '../shaders/noise.glsl.js';

export function createGhibliTree(posX = 12, posZ = 4) {
  const treeGroup = new THREE.Group();
  const posY = getTerrainHeight(posX, posZ);
  treeGroup.position.set(posX, posY, posZ);

  // Gnarled stylized trunk
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x614833, // Warm anime bark
    roughness: 0.9,
    metalness: 0.05
  });

  // Base trunk with natural lean / curve
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.4, 3.0, -0.2),
    new THREE.Vector3(0.2, 5.5, -0.5),
    new THREE.Vector3(-0.6, 7.8, -0.8),
    new THREE.Vector3(-1.2, 9.5, -1.0)
  ]);

  const trunkGeom = new THREE.TubeGeometry(trunkCurve, 20, 0.55, 10, false);
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.castShadow = true;
  treeGroup.add(trunk);

  // Big branches
  function addBranch(start, end, radius) {
    const curve = new THREE.CatmullRomCurve3([start, end]);
    const bGeom = new THREE.TubeGeometry(curve, 10, radius, 8, false);
    const bMesh = new THREE.Mesh(bGeom, trunkMat);
    treeGroup.add(bMesh);
  }

  addBranch(new THREE.Vector3(0.2, 5.5, -0.5), new THREE.Vector3(2.5, 7.2, 0.4), 0.32);
  addBranch(new THREE.Vector3(-0.6, 7.8, -0.8), new THREE.Vector3(-3.2, 9.2, 0.2), 0.28);
  addBranch(new THREE.Vector3(-1.2, 9.5, -1.0), new THREE.Vector3(0.8, 11.2, -1.5), 0.24);

  // Fluffy Stylized Anime Foliage Puff Shader
  const foliageVertexShader = /* glsl */ `
    ${noiseGLSL}

    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    void main() {
      vec3 pos = position;
      // Gentle wind flutter on tree leaves
      float sway = snoise(pos * 0.5 + vec3(uTime * 0.6, 0.0, 0.0)) * 0.18;
      pos += normal * sway;

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPos.xyz;

      // Soft foliage normal
      vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 viewPos = modelViewMatrix * vec4(pos, 1.0);
      vViewDir = normalize(-viewPos.xyz);

      gl_Position = projectionMatrix * viewPos;
    }
  `;

  const foliageFragmentShader = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uLeafShadowColor;
    uniform vec3 uLeafMidColor;
    uniform vec3 uLeafTipColor;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    void main() {
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uSunDirection);

      // 3-Tone Ghibli leaf lighting
      float NdotL = dot(N, L);
      float tier = smoothstep(-0.2, 0.5, NdotL);
      vec3 col = mix(uLeafShadowColor, uLeafMidColor, tier);
      col = mix(col, uLeafTipColor, smoothstep(0.3, 0.85, NdotL));

      // Sun rim
      float rim = pow(1.0 - max(0.0, dot(N, normalize(vViewDir))), 2.5) * smoothstep(0.1, 0.6, NdotL);
      col += uSunColor * rim * 0.4;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const foliageUniforms = {
    uTime: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(0.55, 0.65, 0.45).normalize() },
    uSunColor: { value: new THREE.Color(0xfffae0) },
    uLeafShadowColor: { value: new THREE.Color(0x274d22) }, // Deep shadow foliage
    uLeafMidColor: { value: new THREE.Color(0x568a2d) },    // Lush anime leaf green
    uLeafTipColor: { value: new THREE.Color(0x9fc942) }     // Sunlit lime highlight
  };

  const foliageMat = new THREE.ShaderMaterial({
    vertexShader: foliageVertexShader,
    fragmentShader: foliageFragmentShader,
    uniforms: foliageUniforms
  });

  // Clusters of volumetric foliage spheres
  const puffGeom = new THREE.DodecahedronGeometry(1.0, 2);
  const leafClusters = [
    { pos: [-1.2, 10.2, -1.0], scale: [3.8, 2.8, 3.2] },
    { pos: [1.2, 9.4, -0.2], scale: [3.2, 2.5, 2.8] },
    { pos: [-2.8, 8.8, 0.2], scale: [3.0, 2.4, 2.6] },
    { pos: [2.5, 8.0, 0.4], scale: [2.8, 2.2, 2.5] },
    { pos: [-0.5, 11.5, -1.2], scale: [2.8, 2.4, 2.8] },
    { pos: [0.8, 11.0, -1.8], scale: [2.4, 2.0, 2.4] },
    { pos: [-2.2, 10.5, -0.4], scale: [2.6, 2.2, 2.5] }
  ];

  leafClusters.forEach(c => {
    const mesh = new THREE.Mesh(puffGeom, foliageMat);
    mesh.position.set(c.pos[0], c.pos[1], c.pos[2]);
    mesh.scale.set(c.scale[0], c.scale[1], c.scale[2]);
    mesh.castShadow = true;
    treeGroup.add(mesh);
  });

  return {
    group: treeGroup,
    uniforms: foliageUniforms,
    update: (delta, time) => { foliageUniforms.uTime.value = time; }
  };
}
