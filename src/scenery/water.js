import * as THREE from 'three';
import { noiseGLSL } from '../shaders/noise.glsl.js';

export function createAnimeWater(posX = -10, posZ = -22, sizeX = 26, sizeZ = 18) {
  const geom = new THREE.PlaneGeometry(sizeX, sizeZ, 48, 48);
  geom.rotateX(-Math.PI / 2);

  const waterVertexShader = /* glsl */ `
    ${noiseGLSL}

    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Gentle anime ripples
      float wave1 = sin(pos.x * 0.8 + uTime * 1.8) * cos(pos.z * 0.6 + uTime * 1.4) * 0.08;
      float wave2 = snoise(pos.xz * 0.4 + uTime * 0.3) * 0.06;
      pos.y += wave1 + wave2;

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPos.xyz;

      // Water normal
      vec3 n = normalize(vec3(
        -cos(pos.x * 0.8 + uTime * 1.8) * 0.15,
        1.0,
        -sin(pos.z * 0.6 + uTime * 1.4) * 0.12
      ));
      vNormal = normalize((modelMatrix * vec4(n, 0.0)).xyz);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const waterFragmentShader = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uDeepWaterColor;
    uniform vec3 uShallowWaterColor;
    uniform vec3 uSkyColor;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;

    void main() {
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uSunDirection);
      vec3 V = normalize(cameraPosition - vWorldPos);

      // Fresnel reflection factor
      float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.0);

      // Stylized Ghibli water color ramp
      vec3 waterCol = mix(uDeepWaterColor, uShallowWaterColor, fresnel * 0.7);
      waterCol = mix(waterCol, uSkyColor, fresnel * 0.65);

      // Specular sunlight sparkle on water
      vec3 H = normalize(L + V);
      float NdotH = max(0.0, dot(N, H));
      float specular = pow(NdotH, 64.0) * 0.8;
      waterCol += uSunColor * specular;

      // Soft shore edge / foam vignette
      float distFromCenter = length((vUv - vec2(0.5)) * vec2(1.0, 1.3));
      float alpha = smoothstep(0.49, 0.36, distFromCenter) * 0.88;

      gl_FragColor = vec4(waterCol, alpha);
    }
  `;

  const uniforms = {
    uTime: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(0.55, 0.65, 0.45).normalize() },
    uSunColor: { value: new THREE.Color(0xfffae0) },
    uDeepWaterColor: { value: new THREE.Color(0x2878b5) },   // Deep radiant anime blue
    uShallowWaterColor: { value: new THREE.Color(0x6ec0e6) },// Clear turquoise pond shallows
    uSkyColor: { value: new THREE.Color(0xaae2f5) }
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: uniforms,
    transparent: true,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(posX, 0.15, posZ);

  return { mesh, uniforms, update: (delta, time) => { uniforms.uTime.value = time; } };
}
