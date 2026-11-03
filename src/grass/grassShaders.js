import { noiseGLSL } from '../shaders/noise.glsl.js';

export const grassVertexShader = /* glsl */ `
${noiseGLSL}

attribute vec3 aInstancePosition;
attribute vec3 aInstanceScale;
attribute float aInstanceRotation;
attribute vec2 aInstanceLean;
attribute vec3 aInstanceColorVar;

uniform float uTime;
uniform float uWindSpeed;
uniform float uWindStrength;
uniform float uWindWaveFreq;
uniform vec2 uWindDirection;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewDir;
varying float vHeight;
varying float vWindIntensity;
varying vec3 vColorVar;

// 2D rotation helper
vec2 rotate2D(vec2 v, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

void main() {
  vUv = uv;
  vHeight = uv.y;
  vColorVar = aInstanceColorVar;

  // 1. Scale blade geometry locally
  vec3 localPos = position * aInstanceScale;

  // 2. Intrinsic natural blade curl (curving backwards slightly)
  float curlFactor = pow(uv.y, 2.0);
  localPos.z += curlFactor * aInstanceLean.y * 0.35;
  localPos.x += curlFactor * aInstanceLean.x * 0.25;

  // 3. Rotate blade around Y axis by instance orientation
  localPos.xz = rotate2D(localPos.xz, aInstanceRotation);

  // 4. Calculate World Instance Position
  vec3 worldBasePos = aInstancePosition;

  // 5. Multi-scale Wind Simulation
  // Coordinate in wind space
  vec2 windDirNorm = normalize(uWindDirection);
  vec2 windCoord = worldBasePos.xz * uWindWaveFreq - windDirNorm * (uTime * uWindSpeed * 0.7);
  
  // Smooth silky rolling wind waves (multi-harmonic)
  float wave1 = snoise(windCoord);
  float wave2 = sin(windCoord.x * 2.5 + windCoord.y * 1.8 + uTime * uWindSpeed * 1.5) * 0.35;
  float gust = snoise(windCoord * 2.4 - windDirNorm * (uTime * uWindSpeed * 1.3)) * 0.4;
  
  // High-frequency tip flutter
  float flutter = sin(uTime * 5.0 + worldBasePos.x * 3.5 + worldBasePos.z * 2.8) * 0.12;

  // Total wind force on this blade
  float totalWind = (wave1 * 0.7 + wave2 + gust + flutter) * uWindStrength * aInstanceColorVar.z;
  vWindIntensity = clamp(totalWind * 0.5 + 0.5, 0.0, 1.0);

  // Height-dependent displacement (quadratic bend: root stays rooted, tip bends far)
  float bend = pow(uv.y, 1.7);
  vec2 windOffset = windDirNorm * totalWind * bend * 0.85;

  // Apply displacement
  localPos.xz += windOffset;

  // Length preservation: blade dips slightly when pushed sideways
  float horizDist = length(windOffset);
  localPos.y -= horizDist * horizDist * 0.16;

  // Final world position
  vec3 worldPos = worldBasePos + localPos;
  vWorldPos = worldPos;

  // 6. Modified foliage normal:
  // Blend instance normal upwards for lush, soft volumetric lighting (prevents paper-thin harsh shading)
  vec3 baseNormal = normal;
  baseNormal.xz = rotate2D(baseNormal.xz, aInstanceRotation);
  vec3 blendedNormal = normalize(mix(baseNormal, vec3(0.0, 1.0, 0.0), 0.7 + 0.2 * uv.y));
  blendedNormal.xz += windDirNorm * totalWind * 0.22;
  vNormal = normalize((modelMatrix * vec4(blendedNormal, 0.0)).xyz);

  // View direction
  vec4 viewPos = modelViewMatrix * vec4(worldPos, 1.0);
  vViewDir = normalize(-viewPos.xyz);

  gl_Position = projectionMatrix * viewPos;
}
`;

export const grassFragmentShader = /* glsl */ `
${noiseGLSL}

uniform vec3 uColorRoot;
uniform vec3 uColorMid;
uniform vec3 uColorTip;
uniform vec3 uColorSunlit;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyLightColor;
uniform vec3 uFogColor;
uniform float uTime;
uniform float uSunlitStrength;
uniform float uShadowStrength;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewDir;
varying float vHeight;
varying float vWindIntensity;
varying vec3 vColorVar;

void main() {
  // 1. Vertical Color Gradient (Root -> Mid -> Tip)
  vec3 baseCol = mix(uColorRoot, uColorMid, smoothstep(0.0, 0.35, vHeight));
  baseCol = mix(baseCol, uColorTip, smoothstep(0.3, 0.95, vHeight));

  // Subtle per-instance warm/cool hue shift
  baseCol = mix(baseCol, baseCol * (0.88 + 0.28 * vColorVar.x), 0.35);

  // 2. Rolling Cloud Shadows & Bright Sunny Patches (The iconic Ghibli field effect)
  vec2 shadowCoord = vWorldPos.xz * 0.022 + vec2(uTime * 0.012, uTime * 0.007);
  float cloudNoise = fbm2D(shadowCoord);
  float sunPatch = smoothstep(-0.2, 0.4, cloudNoise);

  // Warm golden sunlit tips in sunny regions
  vec3 sunlitTipColor = mix(uColorTip, uColorSunlit, 0.75);
  vec3 surfaceColor = mix(baseCol, sunlitTipColor, sunPatch * smoothstep(0.25, 1.0, vHeight) * uSunlitStrength);

  // 3. Shaded Areas: cooler, deeper tones in cloud shadows
  vec3 shadowTint = vec3(0.68, 0.85, 0.95); // cool sky reflection in shade
  surfaceColor = mix(surfaceColor * shadowTint * (1.0 - uShadowStrength * 0.4), surfaceColor, sunPatch);

  // 4. Stylized Anime Lighting
  // Half-Lambert wrap lighting with upward bias (soft lush anime foliage shading)
  vec3 norm = normalize(vNormal);
  if (norm.y < 0.0) norm.y = -norm.y;
  vec3 normSunDir = normalize(uSunDirection);
  float NdotL = dot(norm, normSunDir) * 0.5 + 0.5;
  vec3 diffuse = mix(uSkyLightColor * 0.55, uSunColor, NdotL);

  // Translucency / Subsurface Scattering when looking towards sun (glowing golden tips)
  vec3 viewDirWorld = normalize(cameraPosition - vWorldPos);
  float backlight = max(0.0, dot(viewDirWorld, -normSunDir));
  float sss = pow(backlight, 2.2) * smoothstep(0.15, 1.0, vHeight) * 0.75;
  vec3 sssColor = uSunColor * vec3(1.0, 0.97, 0.48) * sss * sunPatch;

  // Fresnel rim sheen along blade contours
  float fresnel = pow(1.0 - max(0.0, dot(norm, viewDirWorld)), 3.0) * smoothstep(0.3, 1.0, vHeight) * 0.4;
  vec3 rimColor = uSunColor * fresnel * (0.5 + 0.5 * sunPatch);

  // Wind crest sheen (tips shimmering as gusts roll over them)
  float windGlint = pow(vWindIntensity, 2.2) * smoothstep(0.4, 1.0, vHeight) * 0.5 * sunPatch;
  vec3 glintColor = uSunColor * windGlint;

  // Blade edge soft ambient occlusion
  float edgeAO = smoothstep(0.0, 0.22, abs(vUv.x - 0.5) * 2.0);
  float baseAO = smoothstep(0.0, 0.28, vHeight);
  float ao = mix(0.72, 1.0, baseAO) * mix(0.88, 1.0, edgeAO);

  // Compose lighting
  vec3 finalColor = (surfaceColor * diffuse * ao) + sssColor + rimColor + glintColor;

  // 5. Distance Atmospheric Haze (Ghibli soft horizon blend)
  float dist = length(vWorldPos - cameraPosition);
  float fog = smoothstep(45.0, 150.0, dist);
  finalColor = mix(finalColor, uFogColor, fog * 0.68);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;
