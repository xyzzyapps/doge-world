// Comprehensive Fine-Art & Ghibli Painting Post-Processing Shader
// Includes:
// Mode 0: Off (Direct Shader Pass)
// Mode 1: Studio Ghibli Watercolor / Gouache (Pigment edge pooling, cotton paper granulation, wet-in-wet wash)
// Mode 2: Anime Cel & Hand-Drawn Sketch (Delicate pencil outline + vibrant cel wash)
// Mode 3: Oil Painting Impasto (Kuwahara filter + palette knife stroke sheen)

export const ArtStylesShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: null },
    uStyleMode: { value: 1 },        // 0: Off, 1: Ghibli Watercolor, 2: Anime Cel, 3: Oil Painting
    uPaperTexture: { value: 0.045 },  // Paper granulation intensity
    uEdgeDarkening: { value: 0.45 }, // Watercolor pigment pooling edge strength
    uWashSmoothness: { value: 0.65 },// Wet-on-wet blend softness
    uColorVibrance: { value: 1.12 }   // Ghibli pigment vibrance
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
    uniform int uStyleMode;
    uniform float uPaperTexture;
    uniform float uEdgeDarkening;
    uniform float uWashSmoothness;
    uniform float uColorVibrance;

    varying vec2 vUv;

    // Luminance helper
    float getLum(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    // Fast 2D procedural noise for paper granulation
    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    float paperGrain(vec2 coord) {
      vec2 i = floor(coord);
      vec2 f = fract(coord);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec3 orig = texture2D(tDiffuse, vUv).rgb;

      // Mode 0: Bypass / Pure 3D
      if (uStyleMode == 0) {
        gl_FragColor = vec4(orig, 1.0);
        return;
      }

      vec2 texel = 1.0 / uResolution;

      // Edge detection (Sobel filter for watercolor edge pooling & pencil inking)
      float lC = getLum(orig);
      float lR = getLum(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb);
      float lL = getLum(texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb);
      float lT = getLum(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb);
      float lB = getLum(texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb);

      float dX = (lR - lL);
      float dY = (lT - lB);
      float edgeGrad = sqrt(dX * dX + dY * dY);

      vec3 finalCol = orig;

      // ============================================================
      // MODE 1: STUDIO GHIBLI WATERCOLOR & GOUACHE (Kazuo Oga Style)
      // ============================================================
      if (uStyleMode == 1) {
        // 1. Wet-on-wet color blur (diffuse color slightly along gradients)
        vec3 blurred = orig * 0.36;
        blurred += texture2D(tDiffuse, vUv + vec2(texel.x * 1.5, 0.0)).rgb * 0.16;
        blurred += texture2D(tDiffuse, vUv - vec2(texel.x * 1.5, 0.0)).rgb * 0.16;
        blurred += texture2D(tDiffuse, vUv + vec2(0.0, texel.y * 1.5)).rgb * 0.16;
        blurred += texture2D(tDiffuse, vUv - vec2(0.0, texel.y * 1.5)).rgb * 0.16;

        finalCol = mix(orig, blurred, uWashSmoothness);

        // 2. Soft Watercolor Tonal Wash Stepping (smooth posterization into gouache layers)
        float lum = getLum(finalCol);
        float quantizedLum = floor(lum * 7.0 + 0.5) / 7.0;
        finalCol = mix(finalCol, finalCol * (quantizedLum / max(0.01, lum)), 0.32);

        // 3. Watercolor Pigment Edge Pooling (Meniscus effect - wet paint darkens at edges)
        float watercolorRim = smoothstep(0.04, 0.18, edgeGrad) * uEdgeDarkening;
        finalCol *= (1.0 - watercolorRim * 0.55);

        // 4. Arches Cotton Watercolor Paper Granulation
        float grain = paperGrain(gl_FragCoord.xy * 0.28) * 0.6 + paperGrain(gl_FragCoord.xy * 0.6) * 0.4;
        finalCol *= (1.0 + (grain - 0.5) * uPaperTexture);

        // 5. Ghibli Pigment Saturation
        finalCol = mix(vec3(lum), finalCol, uColorVibrance);
      }

      // ============================================================
      // MODE 2: ANIME CEL & PENCIL SKETCH (Animation Drawing Style)
      // ============================================================
      else if (uStyleMode == 2) {
        // Crisp graphite/ink outline on geometry silhouettes
        float pencilOutline = smoothstep(0.08, 0.28, edgeGrad);
        finalCol *= (1.0 - pencilOutline * 0.62);

        // Smooth 4-tier anime cel wash
        float lum = getLum(finalCol);
        float cel = floor(lum * 4.0 + 0.5) / 4.0;
        finalCol = mix(finalCol, finalCol * (cel / max(0.02, lum)), 0.36);

        // Warm anime vibrance & tone
        finalCol = mix(vec3(lum), finalCol, uColorVibrance * 1.08);

        // Subtle hand-drawn paper grain
        float grain = paperGrain(gl_FragCoord.xy * 0.35);
        finalCol *= (1.0 + (grain - 0.5) * (uPaperTexture * 0.45));
      }

      // ============================================================
      // MODE 3: OIL PAINTING / IMPASTO (Kuwahara Brushstrokes)
      // ============================================================
      else if (uStyleMode == 3) {
        // Kuwahara brush smoothing
        int r = 3;
        vec3 m[4];
        vec3 s[4];
        for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
        float n = 16.0;

        for (int j = -r; j <= 0; j++) {
          for (int i = -r; i <= 0; i++) {
            vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
            m[0] += c; s[0] += c * c;
          }
        }
        for (int j = -r; j <= 0; j++) {
          for (int i = 0; i <= r; i++) {
            vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
            m[1] += c; s[1] += c * c;
          }
        }
        for (int j = 0; j <= r; j++) {
          for (int i = 0; i <= r; i++) {
            vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
            m[2] += c; s[2] += c * c;
          }
        }
        for (int j = 0; j <= r; j++) {
          for (int i = -r; i <= 0; i++) {
            vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
            m[3] += c; s[3] += c * c;
          }
        }

        float minSigma2 = 1e5;
        vec3 paintCol = orig;
        for (int k = 0; k < 4; k++) {
          m[k] /= n;
          s[k] = abs(s[k] / n - m[k] * m[k]);
          float sigma2 = s[k].r + s[k].g + s[k].b;
          if (sigma2 < minSigma2) {
            minSigma2 = sigma2;
            paintCol = m[k];
          }
        }

        // Impasto stroke ridge sheen
        float ridge = dot(vec2(dX, dY), normalize(vec2(0.7, 0.7)));
        paintCol += vec3(ridge * 0.18);

        // Linen canvas texture
        float canvas = sin(vUv.x * uResolution.x * 0.8) * sin(vUv.y * uResolution.y * 0.8);
        paintCol *= (1.0 + canvas * 0.035);

        finalCol = paintCol;
      }

      gl_FragColor = vec4(finalCol, 1.0);
    }
  `
};
