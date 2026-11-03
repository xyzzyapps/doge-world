import * as THREE from 'three';
import { getTerrainHeight } from '../terrain/terrainMath.js';

export function createStoneProps() {
  const group = new THREE.Group();

  // Stylized painterly stone material with moss top
  const stoneVertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    void main() {
      vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const stoneFragmentShader = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uFogColor;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    void main() {
      vec3 norm = normalize(vNormal);
      vec3 sunDir = normalize(uSunDirection);

      // Base earthy stone grey-brown
      vec3 stoneCol = vec3(0.42, 0.38, 0.34);
      vec3 mossCol = vec3(0.38, 0.52, 0.22); // Ghibli green moss

      // Moss grows on upward facing surfaces
      float upFactor = smoothstep(0.3, 0.75, norm.y);
      vec3 col = mix(stoneCol, mossCol, upFactor * 0.75);

      // Diffuse wrap lighting
      float NdotL = dot(norm, sunDir) * 0.5 + 0.5;
      col *= (0.4 + 0.6 * NdotL);

      // Distance fog
      float dist = length(vWorldPos - cameraPosition);
      float fog = smoothstep(45.0, 140.0, dist);
      col = mix(col, uFogColor, fog * 0.7);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const uniforms = {
    uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
    uSunColor: { value: new THREE.Color(0xfffae0) },
    uFogColor: { value: new THREE.Color(0xd7ecf4) }
  };

  const stoneMaterial = new THREE.ShaderMaterial({
    vertexShader: stoneVertexShader,
    fragmentShader: stoneFragmentShader,
    uniforms: uniforms
  });

  // Helper to place sculpted rock clusters
  function addGuardianStone(x, z, scale, rotationY) {
    const stoneGroup = new THREE.Group();
    const y = getTerrainHeight(x, z);

    // Body
    const bodyGeom = new THREE.DodecahedronGeometry(1.2, 1);
    const body = new THREE.Mesh(bodyGeom, stoneMaterial);
    body.scale.set(1.0, 1.4, 0.9);
    body.position.y = 1.0;
    stoneGroup.add(body);

    // Head / top cap
    const headGeom = new THREE.DodecahedronGeometry(0.85, 1);
    const head = new THREE.Mesh(headGeom, stoneMaterial);
    head.scale.set(0.9, 0.85, 0.85);
    head.position.set(0.1, 2.2, 0.05);
    stoneGroup.add(head);

    stoneGroup.position.set(x, y - 0.2, z);
    stoneGroup.scale.set(scale, scale, scale);
    stoneGroup.rotation.y = rotationY;
    group.add(stoneGroup);
  }

  // Left standing guardian rock (like in the picture)
  addGuardianStone(-16, -4, 1.4, 0.4);

  // Center-right frog-like guardian rock (like in the picture)
  addGuardianStone(3.5, -9, 1.25, -0.6);

  // Far right sitting rock (like in the picture)
  addGuardianStone(17, -13, 1.35, -0.9);

  return { group, material: stoneMaterial, uniforms };
}
