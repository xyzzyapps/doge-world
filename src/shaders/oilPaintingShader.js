// Advanced Real-Time Oil Painting / Painterly Shader
// Implements Kuwahara Filter (impasto brushstroke smoothing), Canvas Weave Texture, and Edge Highlighting

export const OilPaintingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: null }, // vec2(width, height)
    uRadius: { value: 4 },        // Brush stroke radius (2 to 7)
    uCanvasIntensity: { value: 0.045 }, // Subtle linen canvas grain
    uPaintVibrance: { value: 1.1 },     // Rich oil pigment saturation
    uImpastoRelief: { value: 0.35 },    // Brush stroke 3D relief / sheen
    uEnabled: { value: 1.0 }            // 1.0 = on, 0.0 = bypass
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform int uRadius;
    uniform float uCanvasIntensity;
    uniform float uPaintVibrance;
    uniform float uImpastoRelief;
    uniform float uEnabled;

    varying vec2 vUv;

    // Convert RGB to Luminance
    float getLuminance(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec3 origColor = texture2D(tDiffuse, vUv).rgb;
      if (uEnabled < 0.5) {
        gl_FragColor = vec4(origColor, 1.0);
        return;
      }

      vec2 texel = 1.0 / uResolution;
      int r = clamp(uRadius, 2, 7);

      // --- Kuwahara Filter ---
      // Divides the neighborhood into 4 quadrants around (0,0):
      // Q0: [-r, 0] x [-r, 0] (top-left)
      // Q1: [0,  r] x [-r, 0] (top-right)
      // Q2: [0,  r] x [0,  r] (bottom-right)
      // Q3: [-r, 0] x [0,  r] (bottom-left)

      vec3 m[4];
      vec3 s[4];
      for (int k = 0; k < 4; k++) {
        m[k] = vec3(0.0);
        s[k] = vec3(0.0);
      }

      // Pre-calculate sample counts for quadrant
      float n = float((r + 1) * (r + 1));

      // Quadrant 0: Top-Left
      for (int j = -r; j <= 0; j++) {
        for (int i = -r; i <= 0; i++) {
          vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
          m[0] += c;
          s[0] += c * c;
        }
      }

      // Quadrant 1: Top-Right
      for (int j = -r; j <= 0; j++) {
        for (int i = 0; i <= r; i++) {
          vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
          m[1] += c;
          s[1] += c * c;
        }
      }

      // Quadrant 2: Bottom-Right
      for (int j = 0; j <= r; j++) {
        for (int i = 0; i <= r; i++) {
          vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
          m[2] += c;
          s[2] += c * c;
        }
      }

      // Quadrant 3: Bottom-Left
      for (int j = 0; j <= r; j++) {
        for (int i = -r; i <= 0; i++) {
          vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
          m[3] += c;
          s[3] += c * c;
        }
      }

      // Find quadrant with minimum variance (color standard deviation)
      float minSigma2 = 1e5;
      vec3 paintColor = origColor;

      for (int k = 0; k < 4; k++) {
        m[k] /= n;
        s[k] = abs(s[k] / n - m[k] * m[k]);
        float sigma2 = s[k].r + s[k].g + s[k].b;

        if (sigma2 < minSigma2) {
          minSigma2 = sigma2;
          paintColor = m[k];
        }
      }

      // --- 2. Oil Paint Impasto Stroke Relief (Brush Ridge Shimmer) ---
      // Estimate gradient to detect thick oil stroke edges
      float lumCenter = getLuminance(paintColor);
      float lumX = getLuminance(texture2D(tDiffuse, vUv + vec2(texel.x * 2.0, 0.0)).rgb);
      float lumY = getLuminance(texture2D(tDiffuse, vUv + vec2(0.0, texel.y * 2.0)).rgb);
      vec2 strokeGradient = vec2(lumX - lumCenter, lumY - lumCenter);
      
      // Light glancing off impasto paint ridges (from upper-right sun direction)
      vec2 lightDir = normalize(vec2(0.7, 0.7));
      float strokeRidge = dot(strokeGradient, lightDir);
      paintColor += vec3(strokeRidge * uImpastoRelief * 0.45);

      // --- 3. Procedural Fine-Art Canvas / Linen Weave Texture ---
      if (uCanvasIntensity > 0.001) {
        vec2 canvasCoord = vUv * uResolution * 0.35;
        float warp = sin(canvasCoord.x * 3.14159) * 0.5 + 0.5;
        float weft = sin(canvasCoord.y * 3.14159) * 0.5 + 0.5;
        float weavePattern = mix(warp, weft, step(0.5, fract((canvasCoord.x + canvasCoord.y) * 0.5)));
        float canvasGrain = (weavePattern - 0.5) * uCanvasIntensity;
        paintColor *= (1.0 + canvasGrain);
      }

      // --- 4. Oil Pigment Vibrance & Saturation Boost ---
      float lum = getLuminance(paintColor);
      paintColor = mix(vec3(lum), paintColor, uPaintVibrance);

      gl_FragColor = vec4(paintColor, 1.0);
    }
  `
};
