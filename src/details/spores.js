import * as THREE from 'three';

export function createAirSpores(count = 600) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const scales = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3 + 0] = (Math.random() - 0.5) * 60;
    positions[i3 + 1] = 0.5 + Math.random() * 8.0;
    positions[i3 + 2] = (Math.random() - 0.5) * 60;

    phases[i] = Math.random() * Math.PI * 2;
    scales[i] = 12.0 + Math.random() * 24.0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

  const sporeVertexShader = /* glsl */ `
    attribute float aPhase;
    attribute float aScale;

    uniform float uTime;
    varying float vAlpha;

    void main() {
      vec3 pos = position;

      // Gentle floating drift with wind
      pos.x += sin(uTime * 0.4 + aPhase) * 1.5 + uTime * 0.8;
      pos.y += cos(uTime * 0.6 + aPhase) * 0.5;
      pos.z += sin(uTime * 0.3 + aPhase * 2.0) * 1.0;

      // Wrap around bounding box
      pos.x = mod(pos.x + 30.0, 60.0) - 30.0;
      pos.z = mod(pos.z + 30.0, 60.0) - 30.0;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aScale * (20.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;

      // Pulsing glow alpha
      vAlpha = 0.4 + 0.4 * sin(uTime * 2.0 + aPhase);
    }
  `;

  const sporeFragmentShader = /* glsl */ `
    varying float vAlpha;

    void main() {
      // Soft radial circular particle
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;

      float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
      vec3 sporeColor = vec3(1.0, 0.96, 0.75); // Warm golden sun mote
      gl_FragColor = vec4(sporeColor, alpha * 0.8);
    }
  `;

  const uniforms = {
    uTime: { value: 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: sporeVertexShader,
    fragmentShader: sporeFragmentShader,
    uniforms: uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const points = new THREE.Points(geometry, material);
  return { points, uniforms };
}
