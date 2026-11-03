// Mathematical elevation function matching between CPU (JS) and GPU (GLSL)

export function getTerrainHeight(x, z) {
  // Gentle rolling hills matching the anime meadow landscape
  const h1 = Math.sin(x * 0.025) * Math.cos(z * 0.02) * 3.0;
  const h2 = Math.sin((x + z) * 0.015) * 2.2;
  const h3 = Math.cos(x * 0.05 - z * 0.035) * 0.9;
  const bowl = (x * x + z * z) * 0.0003; // slight rise at extreme distance
  return h1 + h2 + h3 + bowl;
}

export const terrainElevationGLSL = /* glsl */ `
float getTerrainHeight(float x, float z) {
  float h1 = sin(x * 0.025) * cos(z * 0.02) * 3.0;
  float h2 = sin((x + z) * 0.015) * 2.2;
  float h3 = cos(x * 0.05 - z * 0.035) * 0.9;
  float bowl = (x * x + z * z) * 0.0003;
  return h1 + h2 + h3 + bowl;
}

vec3 getTerrainNormal(float x, float z) {
  float eps = 0.2;
  float hL = getTerrainHeight(x - eps, z);
  float hR = getTerrainHeight(x + eps, z);
  float hD = getTerrainHeight(x, z - eps);
  float hU = getTerrainHeight(x, z + eps);
  return normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
}
`;
