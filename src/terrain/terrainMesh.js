import * as THREE from 'three';
import { terrainElevationGLSL } from './terrainMath.js';
import { noiseGLSL } from '../shaders/noise.glsl.js';
import { pathwayGLSL } from './pathway.js';

export function createTerrain(size = 200, segments = 120) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const terrainVertexShader = /* glsl */ `
    ${terrainElevationGLSL}
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormalVec;

    void main() {
      vUv = uv;
      vec3 pos = position;
      pos.y = getTerrainHeight(pos.x, pos.z);
      
      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPosition.xyz;
      vNormalVec = normalize((modelMatrix * vec4(getTerrainNormal(pos.x, pos.z), 0.0)).xyz);

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const terrainFragmentShader = /* glsl */ `
    ${noiseGLSL}
    ${pathwayGLSL}
    
    uniform vec3 uBaseColor;
    uniform vec3 uSunlitColor;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform float uTime;
    uniform vec3 uFogColor;

    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormalVec;

    void main() {
      // Base painterly green tones
      vec3 colDark = vec3(0.14, 0.24, 0.12);
      vec3 colMid  = uBaseColor;
      vec3 colSun  = uSunlitColor;

      // Organic painterly patchiness
      float patchNoise = fbm2D(vWorldPos.xz * 0.08);
      vec3 groundCol = mix(colDark, colMid, patchNoise * 0.5 + 0.5);

      // Rolling cloud shadows matching the grass field
      vec2 shadowCoord = vWorldPos.xz * 0.02 + vec2(uTime * 0.015, uTime * 0.008);
      float cloudShadow = smoothstep(0.3, 0.7, snoise(shadowCoord) * 0.5 + 0.5);
      groundCol = mix(groundCol * 0.75, colSun * 0.85, cloudShadow);

      // Winding earthen dirt path (as shown in Ni no Kuni reference art)
      float pathDist = getPathDistance(vWorldPos.xz);
      float pathMask = smoothstep(1.5, 0.5, pathDist);
      vec3 dirtCol = vec3(0.66, 0.56, 0.42); // Warm sunny dirt
      groundCol = mix(groundCol, dirtCol, pathMask * 0.88);

      // Diffuse sun lighting
      float NdotL = max(0.0, dot(vNormalVec, uSunDirection));
      groundCol *= (0.55 + 0.45 * NdotL);

      // Distance fog
      float dist = length(vWorldPos - cameraPosition);
      float fog = smoothstep(50.0, 160.0, dist);
      groundCol = mix(groundCol, uFogColor, fog * 0.75);

      gl_FragColor = vec4(groundCol, 1.0);
    }
  `;

  const uniforms = {
    uBaseColor: { value: new THREE.Color(0x3d662c) },
    uSunlitColor: { value: new THREE.Color(0x8fae3f) },
    uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
    uSunColor: { value: new THREE.Color(0xfff6cf) },
    uTime: { value: 0.0 },
    uFogColor: { value: new THREE.Color(0xcae8f2) }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    uniforms: uniforms
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  return { mesh, material, uniforms };
}
