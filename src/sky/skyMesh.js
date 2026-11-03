import * as THREE from 'three';
import { skyVertexShader, skyFragmentShader } from './skyShaders.js';

export function createSkyDome() {
  const geometry = new THREE.SphereGeometry(400, 64, 48);

  const uniforms = {
    uSunDirection: { value: new THREE.Vector3(0.55, 0.65, 0.45).normalize() },
    uSunColor: { value: new THREE.Color(0xfffae0) },

    // Authentic Hayao Miyazaki / Kazuo Oga Anime Sky Palette
    uZenithColor: { value: new THREE.Color(0x1a5e9b) },    // Deep cerulean blue
    uMidColor: { value: new THREE.Color(0x569ad4) },       // Bright clear anime sky
    uHorizonColor: { value: new THREE.Color(0xd6eef5) },   // Warm pale turquoise-golden haze

    // Ghibli Cloud Palette
    uCloudSunColor: { value: new THREE.Color(0xfffdf4) },     // Crisp warm ivory highlight
    uCloudMidColor: { value: new THREE.Color(0xf2e8dd) },     // Warm peach-cream midtone
    uCloudShadowColor: { value: new THREE.Color(0x687494) },  // Stylized periwinkle / slate shadow

    uCloudDensity: { value: 1.25 },
    uCloudCoverage: { value: 0.55 },
    uCloudSpeed: { value: 0.4 },
    uTime: { value: 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms: uniforms,
    side: THREE.BackSide,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geometry, material);

  return { mesh, material, uniforms };
}
