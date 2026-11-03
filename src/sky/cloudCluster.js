import * as THREE from 'three';
import { noiseGLSL } from '../shaders/noise.glsl.js';

export function createAnimeCloudMountain() {
  const group = new THREE.Group();

  const cloudLobeVertexShader = /* glsl */ `
    ${noiseGLSL}

    uniform float uTime;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    void main() {
      // Displace sphere vertices with 3D simplex noise to create cauliflower lobes
      vec3 pos = position;
      vec3 n = normalize(pos);
      float displacement = snoise3D(pos * 0.4 + vec3(uTime * 0.03, 0.0, 0.0)) * 0.28
                         + snoise3D(pos * 1.2) * 0.12;
      pos += n * displacement * length(position);

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPos.xyz;
      
      // Calculate displaced normal
      vec3 displacedNormal = normalize(n + vec3(displacement * 0.5));
      vWorldNormal = normalize((modelMatrix * vec4(displacedNormal, 0.0)).xyz);
      
      vec4 viewPos = modelViewMatrix * vec4(pos, 1.0);
      vViewDir = normalize(-viewPos.xyz);

      gl_Position = projectionMatrix * viewPos;
    }
  `;

  const cloudLobeFragmentShader = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uCloudSunColor;
    uniform vec3 uCloudMidColor;
    uniform vec3 uCloudShadowColor;

    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 L = normalize(uSunDirection);
      vec3 V = normalize(vViewDir);

      // Diffuse sun lighting
      float NdotL = dot(N, L);

      // Studio Ghibli 3-tier stepped toon lighting
      float lightTier = smoothstep(-0.25, 0.45, NdotL);
      vec3 col = mix(uCloudShadowColor, uCloudMidColor, lightTier);
      col = mix(col, uCloudSunColor, smoothstep(0.3, 0.85, NdotL));

      // Sun rim highlight
      float rim = pow(1.0 - max(0.0, dot(N, V)), 3.0) * smoothstep(0.0, 0.5, NdotL);
      col += uSunColor * rim * 0.6;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const uniforms = {
    uSunDirection: { value: new THREE.Vector3(0.55, 0.65, 0.45).normalize() },
    uSunColor: { value: new THREE.Color(0xfffae0) },
    uCloudSunColor: { value: new THREE.Color(0xfffdf6) },
    uCloudMidColor: { value: new THREE.Color(0xf4ece3) },
    uCloudShadowColor: { value: new THREE.Color(0x657291) },
    uTime: { value: 0.0 }
  };

  const cloudMaterial = new THREE.ShaderMaterial({
    vertexShader: cloudLobeVertexShader,
    fragmentShader: cloudLobeFragmentShader,
    uniforms: uniforms,
    side: THREE.FrontSide
  });

  // Base sphere geometry shared among cloud puff lobes
  const sphereGeom = new THREE.SphereGeometry(1, 24, 20);

  // Position and radii of puffy lobes to construct a towering anime cumulus cloud mountain
  const lobes = [
    // Base lobes
    { pos: [0, 0, 0], scale: [22, 16, 18] },
    { pos: [-16, -2, -4], scale: [18, 14, 15] },
    { pos: [18, -3, 2], scale: [17, 13, 16] },
    { pos: [-8, 4, 6], scale: [16, 15, 15] },
    { pos: [12, 5, -5], scale: [16, 14, 14] },
    
    // Mid billowing towers
    { pos: [3, 14, -2], scale: [19, 18, 17] },
    { pos: [-10, 11, 2], scale: [15, 16, 14] },
    { pos: [14, 12, 4], scale: [14, 15, 13] },
    { pos: [-4, 22, 0], scale: [16, 17, 15] },
    { pos: [8, 20, -1], scale: [15, 16, 14] },

    // Summit peaks
    { pos: [2, 30, -1], scale: [14, 15, 13] },
    { pos: [-3, 37, 1], scale: [11, 12, 11] },
    { pos: [5, 34, 0], scale: [9, 10, 9] },
    { pos: [-1, 43, 0], scale: [7, 8, 7] }
  ];

  lobes.forEach(def => {
    const mesh = new THREE.Mesh(sphereGeom, cloudMaterial);
    mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
    mesh.scale.set(def.scale[0], def.scale[1], def.scale[2]);
    group.add(mesh);
  });

  // Position the majestic cloud mountain in the far right horizon, just like in the user's reference image!
  group.position.set(130, 22, -140);
  group.rotation.y = -0.35;

  // Add a secondary smaller cloud bank on the left horizon
  const leftCloudGroup = group.clone(true);
  leftCloudGroup.position.set(-160, 14, -120);
  leftCloudGroup.scale.set(0.65, 0.65, 0.65);
  leftCloudGroup.rotation.y = 0.5;

  const masterGroup = new THREE.Group();
  masterGroup.add(group);
  masterGroup.add(leftCloudGroup);

  return { group: masterGroup, material: cloudMaterial, uniforms };
}
