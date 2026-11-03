import * as THREE from 'three';
import { noiseGLSL } from '../shaders/noise.glsl.js';

export function createDistantMountains() {
  const group = new THREE.Group();

  // Mountain ridge plane on the far horizon
  const geom = new THREE.PlaneGeometry(360, 90, 90, 40);

  const mountainVertexShader = /* glsl */ `
    ${noiseGLSL}

    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Sculpt jagged alpine mountain peaks with multi-frequency noise
      float x = pos.x * 0.025;
      float mainRidge = sin(x * 1.5) * 18.0 + cos(x * 3.2) * 9.0 + snoise(vec2(x * 4.0, 0.0)) * 6.0;
      
      // Peaks rise higher towards the center and left
      float envelope = smoothstep(0.0, 0.45, uv.y) * (1.0 - abs(uv.x - 0.45) * 0.7);
      pos.z += mainRidge * envelope;
      pos.y += mainRidge * envelope * 0.8;

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPos.xyz;
      vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const mountainFragmentShader = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uRockColor;
    uniform vec3 uSnowColor;
    uniform vec3 uFogColor;

    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;

    void main() {
      // Base anime mountain slate / blue-grey rock
      vec3 col = uRockColor;

      // Snow dusted on the summit ridges (high UV.y)
      float snowMask = smoothstep(0.55, 0.85, vUv.y + (vNormal.y - 0.5) * 0.4);
      col = mix(col, uSnowColor, snowMask * 0.85);

      // Diffuse sunlight
      float NdotL = dot(normalize(vNormal), normalize(uSunDirection)) * 0.5 + 0.5;
      col *= (0.45 + 0.55 * NdotL);

      // Heavy atmospheric perspective / horizon mist (as in Ni no Kuni reference art)
      float mist = smoothstep(0.1, 0.5, 1.0 - vUv.y);
      col = mix(col, uFogColor, mist * 0.82 + 0.18);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const uniforms = {
    uSunDirection: { value: new THREE.Vector3(0.55, 0.65, 0.45).normalize() },
    uSunColor: { value: new THREE.Color(0xfffae0) },
    uRockColor: { value: new THREE.Color(0x52637a) },  // Slate mountain rock
    uSnowColor: { value: new THREE.Color(0xeef5fa) },  // Soft anime snow
    uFogColor: { value: new THREE.Color(0xcde5f2) }   // Horizon mist
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: mountainVertexShader,
    fragmentShader: mountainFragmentShader,
    uniforms: uniforms,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(-20, 22, -135);
  mesh.rotation.y = 0.1;
  group.add(mesh);

  return { group, uniforms };
}
