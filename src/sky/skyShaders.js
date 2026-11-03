import { noiseGLSL } from '../shaders/noise.glsl.js';

export const skyVertexShader = /* glsl */ `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const skyFragmentShader = /* glsl */ `
${noiseGLSL}

uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uZenithColor;
uniform vec3 uMidColor;
uniform vec3 uHorizonColor;
uniform vec3 uCloudSunColor;
uniform vec3 uCloudShadowColor;
uniform vec3 uCloudMidColor;
uniform float uCloudDensity;
uniform float uCloudCoverage;
uniform float uCloudSpeed;
uniform float uTime;

varying vec3 vWorldPosition;

// Studio Ghibli hand-painted cumulus cloud shape generator
// Simulates layered gouache brushstrokes with bulbous cauliflower lobes & flat bases
float ghibliCumulusMap(vec2 uv, float time) {
  vec2 p = uv * 1.35 + vec2(time * 0.008, time * 0.003);

  // Large billowy cumulus lobes
  float w1 = 1.0 - worley2D(p * 0.85);
  float w2 = 1.0 - worley2D(p * 1.8);
  float w3 = 1.0 - worley2D(p * 3.8);
  float worley = w1 * 0.58 + w2 * 0.30 + w3 * 0.12;

  // Feathered gouache brush edges
  float f = fbm2D(p * 1.5);
  float bristles = snoise(p * 8.0) * 0.05;

  return worley * 0.75 + f * 0.25 + bristles;
}

// High-altitude painterly cirrus brush wisps
float ghibliCirrusMap(vec2 uv, float time) {
  // Stretched horizontally for dry-brush stroke streaks
  vec2 p = vec2(uv.x * 1.8, uv.y * 5.0) + vec2(time * 0.006, 0.0);
  float streaks = snoise(p) * 0.5 + snoise(p * 2.2) * 0.3 + snoise(p * 4.5) * 0.2;
  return smoothstep(0.2, 0.75, streaks);
}

void main() {
  vec3 rayDir = normalize(vWorldPosition - cameraPosition);
  vec3 normSunDir = normalize(uSunDirection);

  // 1. Kazuo Oga Master Sky Wash (Elevation-based wet watercolor gradient)
  float elevation = clamp(rayDir.y, 0.0, 1.0);
  
  // Natural multi-stop exponential atmospheric gradient
  float tUpper = pow(elevation, 0.65);
  float tLower = pow(1.0 - elevation, 2.2);

  // Zenith deep blue -> mid azure -> warm turquoise-gold horizon
  vec3 skyCol = mix(uMidColor, uZenithColor, tUpper);
  skyCol = mix(skyCol, uHorizonColor, tLower);

  // Solar Corona Glow (warm sunlight bloom into the blue wash)
  float sunCos = dot(rayDir, normSunDir);
  float sunCorona = pow(max(0.0, sunCos), 8.0) * 0.4 + pow(max(0.0, sunCos), 48.0) * 0.5;
  skyCol += uSunColor * sunCorona;

  // 2. High-Altitude Painterly Cirrus Wisps
  if (rayDir.y > 0.2) {
    float cirrusUV_phi = asin(elevation);
    float cirrusUV_theta = atan(rayDir.z, rayDir.x);
    vec2 cirrusUV = vec2(cirrusUV_theta * 1.2, cirrusUV_phi * 1.8);
    float cirrus = ghibliCirrusMap(cirrusUV, uTime * uCloudSpeed);
    float cirrusFade = smoothstep(0.2, 0.55, elevation);
    vec3 cirrusColor = mix(uCloudMidColor, vec3(1.0), 0.75);
    skyCol = mix(skyCol, cirrusColor, cirrus * cirrusFade * 0.3);
  }

  // 3. Iconic Studio Ghibli Cumulus Clouds (Nicker Poster Color / Gouache style)
  if (rayDir.y > 0.01) {
    // Spherical dome projection prevents planar stretching & distortion
    float phi = asin(max(0.01, elevation));
    float theta = atan(rayDir.z, rayDir.x);
    vec2 cloudUV = vec2(theta * 0.95, (1.0 - phi / 1.5708) * 1.8);

    float speed = uCloudSpeed;
    float density = ghibliCumulusMap(cloudUV, uTime * speed);

    // Coverage threshold with crisp painterly gouache edge
    float threshold = 1.0 - uCloudCoverage;
    float cloudMask = smoothstep(threshold - 0.05, threshold + 0.08, density);

    if (cloudMask > 0.002) {
      // Numerical density gradient for direct solar illumination
      float eps = 0.035;
      float dX = ghibliCumulusMap(cloudUV + vec2(eps, 0.0), uTime * speed) - ghibliCumulusMap(cloudUV - vec2(eps, 0.0), uTime * speed);
      float dY = ghibliCumulusMap(cloudUV + vec2(0.0, eps), uTime * speed) - ghibliCumulusMap(cloudUV - vec2(0.0, eps), uTime * speed);
      vec3 cloudNorm = normalize(vec3(-dX * 4.2, 1.8, -dY * 4.2));

      float cNdotL = dot(cloudNorm, normSunDir);

      // --- Studio Ghibli 4-Tier Gouache Color Wash ---
      // Tier 1: Soft Slate-Periwinkle Shadow Wash (with delicate pigment edge pooling)
      // Tier 2: Warm Peach-Cream Body Wash
      // Tier 3: Radiant Warm Ivory Sunlight Crest
      // Tier 4: Golden Forward-Scattering Sunlight Rim Contour

      float lightFactor = smoothstep(-0.2, 0.40, cNdotL);
      vec3 cColor = mix(uCloudShadowColor, uCloudMidColor, lightFactor);
      cColor = mix(cColor, uCloudSunColor, smoothstep(0.2, 0.70, cNdotL));

      // Crisp anime golden sun rim light along forward contours
      float sunRim = pow(max(0.0, dot(normSunDir, -rayDir)), 3.0) * smoothstep(0.15, 0.75, cNdotL);
      cColor += uSunColor * sunRim * 0.7;

      // Horizon atmospheric fade (clouds merge gracefully into warm horizon haze)
      float horizonFade = smoothstep(0.01, 0.05, elevation);
      float finalAlpha = clamp(cloudMask * horizonFade * uCloudDensity * 1.4, 0.0, 1.0);

      // Composite Gouache Clouds over Watercolor Sky
      skyCol = mix(skyCol, cColor, finalAlpha);
    }
  }

  // 4. Watercolor Cotton Paper Grain Granulation (Simulates 300gsm Arches paper used by Ghibli)
  vec2 paperCoord = gl_FragCoord.xy * 0.22;
  float paperNoise = (snoise(paperCoord) + snoise(paperCoord * 2.3) * 0.5) * 0.022;
  skyCol *= (1.0 + paperNoise);

  // Sub-horizon earthy blend
  if (rayDir.y < 0.0) {
    skyCol = mix(uHorizonColor, vec3(0.22, 0.32, 0.20), clamp(-rayDir.y * 3.5, 0.0, 1.0));
  }

  gl_FragColor = vec4(skyCol, 1.0);
}
`;
