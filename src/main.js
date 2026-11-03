import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ArtStylesShader } from './shaders/artStylesShader.js';

import { createTerrain } from './terrain/terrainMesh.js';
import { createGrassField } from './grass/grassMesh.js';
import { createSkyDome } from './sky/skyMesh.js';
import { createWildflowers } from './details/flowers.js';
import { createAirSpores } from './details/spores.js';

// Cleaned Scene Elements: House & Doge (all unwanted stones, pond, and mountains removed)
import { createDogeController } from './animals/doge.js';
import { createGhibliHouse } from './scenery/house.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
// Panoramic scenic framing: vast Ghibli sky, billowing clouds, watermill house, and running Doge meadow
camera.position.set(-1.0, 5.8, 16.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(-4.2, 3.5, -9.0);
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 2;
controls.maxDistance = 180;

// --- Post-Processing: Fine Art & Ghibli Painting Pipeline ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const artPass = new ShaderPass(ArtStylesShader);
artPass.uniforms.uResolution.value = new THREE.Vector2(
  window.innerWidth * Math.min(window.devicePixelRatio, 2),
  window.innerHeight * Math.min(window.devicePixelRatio, 2)
);
// Default: Anime Cel & Hand-Drawn Sketch Shader
artPass.uniforms.uStyleMode.value = 2;
composer.addPass(artPass);

composer.addPass(new OutputPass());

// --- Lighting for Models & Scenery ---
const hemiLight = new THREE.HemisphereLight(0xb8e3ff, 0x41682f, 0.95);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfffae0, 1.85);
dirLight.position.set(25, 40, 20);
dirLight.castShadow = true;
scene.add(dirLight);

// --- Create Pure Ghibli Scene Elements ---
// 1. Terrain Base (Rolling green hills with dirt footpath)
const terrain = createTerrain(220, 120);
scene.add(terrain.mesh);

// 2. Instanced Anime Grass Field (160,000 curved tufted blades)
const grass = createGrassField(160000, 70);
scene.add(grass.mesh);

// 3. Studio Ghibli Sky Dome (Master Kazuo Oga watercolor wash + gouache cumulus & cirrus clouds)
const sky = createSkyDome();
scene.add(sky.mesh);

// 4. Stylized Wildflowers (Pink cosmos, daisies, buttercups scattered in grass)
const flowers = createWildflowers(2200, 62);
scene.add(flowers.mesh);

// 5. Air Spores (disabled in cel mode to keep ink lines pristine)
const spores = createAirSpores(0);

// 6. Ghibli Watermill House (Stone base, timber frames, terracotta roof & chimney smoke)
const house = createGhibliHouse(-7, -22);
scene.add(house.group);

// 7. Animated Doge Shiba Inu Character (WASD controllable + auto-roam)
const doge = createDogeController(scene);

// Camera Following Doge State
let isFollowingDoge = false;

function setFollowDogeMode(enabled) {
  isFollowingDoge = enabled;
  if (btnCam) btnCam.classList.toggle('active', enabled);
  if (isFollowingDoge) {
    // Initial placement behind the dog, respecting user's current zoom distance or defaulting to 6.5
    const dogPos = doge.group.position;
    const currentDist = Math.max(3.5, camera.position.distanceTo(controls.target));
    const dist = currentDist || 6.5;
    controls.target.set(dogPos.x, dogPos.y + 0.85, dogPos.z);
    camera.position.set(
      dogPos.x - Math.sin(doge.state.heading) * dist,
      dogPos.y + 0.85 + Math.max(1.8, dist * 0.35),
      dogPos.z - Math.cos(doge.state.heading) * dist
    );
    controls.update();
  }
}

// Default: Hide all UI overlays for clean cinematic view (Press 'H' to toggle)
document.body.classList.add('ui-hidden');
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') {
    document.body.classList.toggle('ui-hidden');
  }
  if (e.code === 'KeyM') {
    toggleAudio();
  }
});

// --- Web Audio API: Sample-Accurate Gapless Looper & Controls ---
let audioCtx = null;
let gainNode = null;
let windSource = null;
let windBuffer = null;
let isAudioPlaying = false;
let currentVolume = 0.55;

const btnAudioToggle = document.getElementById('btn-audio-toggle');
const audioIcon = document.getElementById('audio-icon');
const audioVolumeSlider = document.getElementById('audio-volume');
const audioVolText = document.getElementById('audio-vol-text');

function initWebAudio() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();
  gainNode = audioCtx.createGain();
  gainNode.gain.value = currentVolume;
  gainNode.connect(audioCtx.destination);

  fetch('./audio/pleasant_wind.wav')
    .then(res => res.arrayBuffer())
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => {
      windBuffer = decoded;
      if (isAudioPlaying) {
        startGaplessPlayback();
      }
    })
    .catch(err => console.warn('Could not load wind audio:', err));
}

function startGaplessPlayback() {
  if (!audioCtx || !windBuffer) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (windSource) {
    try { windSource.stop(); } catch (e) {}
    windSource.disconnect();
  }
  windSource = audioCtx.createBufferSource();
  windSource.buffer = windBuffer;
  windSource.loop = true; // Web Audio API sample-accurate hardware gapless loop!
  windSource.connect(gainNode);
  windSource.start(0);
  isAudioPlaying = true;
  updateAudioUI();
}

function stopGaplessPlayback() {
  if (windSource) {
    try { windSource.stop(); } catch (e) {}
    windSource.disconnect();
    windSource = null;
  }
  isAudioPlaying = false;
  updateAudioUI();
}

function toggleAudio() {
  if (!audioCtx) initWebAudio();
  if (isAudioPlaying) {
    stopGaplessPlayback();
  } else {
    isAudioPlaying = true;
    startGaplessPlayback();
  }
}

function setAudioVolume(val) {
  currentVolume = Math.max(0, Math.min(1, val));
  if (gainNode && audioCtx) {
    gainNode.gain.setTargetAtTime(currentVolume, audioCtx.currentTime, 0.05);
  }
  updateAudioUI();
}

function updateAudioUI() {
  if (btnAudioToggle) {
    btnAudioToggle.classList.toggle('muted', !isAudioPlaying);
  }
  if (audioIcon) {
    audioIcon.textContent = isAudioPlaying ? '🔊' : '🔇';
  }
  if (audioVolumeSlider) {
    audioVolumeSlider.value = currentVolume;
  }
  if (audioVolText) {
    audioVolText.textContent = isAudioPlaying ? `${Math.round(currentVolume * 100)}%` : 'Muted';
  }
}

// User-gesture auto-unlock for Web Audio policy
const unlockAudio = () => {
  if (!audioCtx) initWebAudio();
  if (!isAudioPlaying && windBuffer) {
    startGaplessPlayback();
  }
  window.removeEventListener('click', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('click', unlockAudio);
window.addEventListener('keydown', unlockAudio);

if (btnAudioToggle) {
  btnAudioToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAudio();
  });
}

if (audioVolumeSlider) {
  audioVolumeSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    setAudioVolume(parseFloat(e.target.value));
    if (!isAudioPlaying) {
      isAudioPlaying = true;
      startGaplessPlayback();
    }
  });
}

// --- Uniform Synchronization Helper ---
function updateSunDirection(elevation, azimuth) {
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  const sunDir = new THREE.Vector3(
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.cos(theta)
  ).normalize();

  grass.uniforms.uSunDirection.value.copy(sunDir);
  sky.uniforms.uSunDirection.value.copy(sunDir);
  terrain.uniforms.uSunDirection.value.copy(sunDir);
  flowers.uniforms.uSunDirection.value.copy(sunDir);

  dirLight.position.set(sunDir.x * 50, sunDir.y * 50, sunDir.z * 50);
}

let sunParams = {
  elevation: 48,
  azimuth: 135
};
updateSunDirection(sunParams.elevation, sunParams.azimuth);

// --- Color Presets ---
const presets = {
  sunny: {
    name: 'Sunny Meadow',
    sunElevation: 48,
    azimuth: 135,
    sunColor: '#fff8e2',
    fogColor: '#cae9f4',
    rootColor: '#1f4419',
    midColor: '#6bb82d',
    tipColor: '#c7ea3b',
    sunlitColor: '#f8fb6d',
    sunlitStrength: 0.95,
    shadowStrength: 0.55,
    windStrength: 0.85,
    windSpeed: 1.3,
    zenithColor: '#164a85',
    skyMidColor: '#4288ce',
    horizonColor: '#d8eef5',
    cloudSunColor: '#ffffff',
    cloudMidColor: '#faeee1',
    cloudShadowColor: '#687494',
    cloudDensity: 1.25,
    cloudCoverage: 0.55
  },
  sunset: {
    name: 'Golden Sunset',
    sunElevation: 12,
    azimuth: 220,
    sunColor: '#ffba60',
    fogColor: '#f4c8aa',
    rootColor: '#2b2318',
    midColor: '#7a5a2b',
    tipColor: '#d48a33',
    sunlitColor: '#ffcf63',
    sunlitStrength: 1.15,
    shadowStrength: 0.75,
    windStrength: 1.1,
    windSpeed: 1.5,
    zenithColor: '#3c356e',
    skyMidColor: '#934d75',
    horizonColor: '#f39459',
    cloudSunColor: '#ffe5b4',
    cloudMidColor: '#c46979',
    cloudShadowColor: '#4d3a66',
    cloudDensity: 1.0,
    cloudCoverage: 0.52
  },
  overcast: {
    name: 'Overcast Day',
    sunElevation: 60,
    azimuth: 90,
    sunColor: '#d8e5e8',
    fogColor: '#b9cbd3',
    rootColor: '#1c2e1b',
    midColor: '#4b753b',
    tipColor: '#8ca75b',
    sunlitColor: '#b4cc78',
    sunlitStrength: 0.35,
    shadowStrength: 0.3,
    windStrength: 0.6,
    windSpeed: 0.9,
    zenithColor: '#526e82',
    skyMidColor: '#7e9aae',
    horizonColor: '#b8c9d4',
    cloudSunColor: '#eef3f6',
    cloudMidColor: '#cfdce3',
    cloudShadowColor: '#7e93a0',
    cloudDensity: 1.1,
    cloudCoverage: 0.72
  },
  night: {
    name: 'Totoro Night',
    sunElevation: 35,
    azimuth: 140,
    sunColor: '#a8d2ff',
    fogColor: '#101d30',
    rootColor: '#0a1410',
    midColor: '#153123',
    tipColor: '#2f5e48',
    sunlitColor: '#5fa48c',
    sunlitStrength: 0.7,
    shadowStrength: 0.9,
    windStrength: 0.7,
    windSpeed: 1.1,
    zenithColor: '#08111e',
    skyMidColor: '#10223b',
    horizonColor: '#1d3552',
    cloudSunColor: '#7a9fcc',
    cloudMidColor: '#374e6f',
    cloudShadowColor: '#131e2e',
    cloudDensity: 0.85,
    cloudCoverage: 0.38
  }
};

function applyPreset(presetKey) {
  const p = presets[presetKey];
  if (!p) return;

  sunParams.elevation = p.sunElevation;
  sunParams.azimuth = p.azimuth;
  updateSunDirection(p.sunElevation, p.azimuth);

  const sunC = new THREE.Color(p.sunColor);
  const fogC = new THREE.Color(p.fogColor);

  grass.uniforms.uSunColor.value.copy(sunC);
  grass.uniforms.uFogColor.value.copy(fogC);
  grass.uniforms.uColorRoot.value.set(p.rootColor);
  grass.uniforms.uColorMid.value.set(p.midColor);
  grass.uniforms.uColorTip.value.set(p.tipColor);
  grass.uniforms.uColorSunlit.value.set(p.sunlitColor);
  grass.uniforms.uSunlitStrength.value = p.sunlitStrength;
  grass.uniforms.uShadowStrength.value = p.shadowStrength;
  grass.uniforms.uWindStrength.value = p.windStrength;
  grass.uniforms.uWindSpeed.value = p.windSpeed;

  terrain.uniforms.uSunColor.value.copy(sunC);
  terrain.uniforms.uFogColor.value.copy(fogC);
  terrain.uniforms.uBaseColor.value.set(p.midColor);
  terrain.uniforms.uSunlitColor.value.set(p.tipColor);

  sky.uniforms.uSunColor.value.copy(sunC);
  sky.uniforms.uZenithColor.value.set(p.zenithColor);
  sky.uniforms.uMidColor.value.set(p.skyMidColor);
  sky.uniforms.uHorizonColor.value.set(p.horizonColor);
  sky.uniforms.uCloudSunColor.value.set(p.cloudSunColor);
  sky.uniforms.uCloudMidColor.value.set(p.cloudMidColor);
  sky.uniforms.uCloudShadowColor.value.set(p.cloudShadowColor);
  sky.uniforms.uCloudDensity.value = p.cloudDensity;
  sky.uniforms.uCloudCoverage.value = p.cloudCoverage;

  flowers.uniforms.uSunColor.value.copy(sunC);
  flowers.uniforms.uFogColor.value.copy(fogC);
  flowers.uniforms.uWindSpeed.value = p.windSpeed;
  flowers.uniforms.uWindStrength.value = p.windStrength;

  if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());

  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === presetKey);
  });
}

document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    applyPreset(btn.dataset.preset);
  });
});

// --- Hook Up On-Screen HUD Buttons ---
document.querySelectorAll('.control-btn').forEach(btn => {
  const action = btn.dataset.action;
  if (!action) return;

  const startAction = (e) => {
    e.preventDefault();
    doge.keys[action] = true;
    doge.state.mode = 'manual';
    btn.classList.add('active');
  };

  const endAction = (e) => {
    e.preventDefault();
    doge.keys[action] = false;
    btn.classList.remove('active');
  };

  btn.addEventListener('mousedown', startAction);
  btn.addEventListener('mouseup', endAction);
  btn.addEventListener('mouseleave', endAction);
  btn.addEventListener('touchstart', startAction, { passive: false });
  btn.addEventListener('touchend', endAction, { passive: false });
});

// Action buttons
const btnSprint = document.getElementById('btn-sprint');
if (btnSprint) {
  btnSprint.addEventListener('click', (e) => {
    e.preventDefault();
    doge.keys.sprint = !doge.keys.sprint;
    btnSprint.classList.toggle('active', doge.keys.sprint);
  });
}

const btnJump = document.getElementById('btn-jump');
if (btnJump) {
  btnJump.addEventListener('click', () => doge.triggerJump());
}

const btnSniff = document.getElementById('btn-sniff');
if (btnSniff) {
  btnSniff.addEventListener('click', () => doge.triggerSniff());
}

const btnMode = document.getElementById('btn-mode');
if (btnMode) {
  btnMode.addEventListener('click', () => {
    doge.state.mode = doge.state.mode === 'roam' ? 'manual' : 'roam';
    btnMode.classList.toggle('active', doge.state.mode === 'roam');
    btnMode.textContent = doge.state.mode === 'roam' ? '🎮 Manual' : '🤖 Auto-Roam';
  });
}

const btnCam = document.getElementById('btn-cam');
if (btnCam) {
  btnCam.classList.remove('active');
  btnCam.addEventListener('click', () => {
    setFollowDogeMode(!isFollowingDoge);
  });
}

// Painting Style switcher button
const styleNames = ['Pure 3D', 'Watercolor', 'Anime Cel', 'Oil Paint'];
const btnOil = document.getElementById('btn-oil');
if (btnOil) {
  btnOil.textContent = '🎨 Style: Anime Cel';
  btnOil.classList.add('active');
  btnOil.addEventListener('click', () => {
    let mode = (artPass.uniforms.uStyleMode.value + 1) % 4;
    artPass.uniforms.uStyleMode.value = mode;
    btnOil.textContent = `🎨 Style: ${styleNames[mode]}`;
    btnOil.classList.toggle('active', mode !== 0);
    if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
  });
}

// --- Lil-GUI Setup ---
const gui = new GUI({ title: '🎨 Ghibli Scene Controls', width: 330 });

// 0. Fine-Art Painting Style Folder
const artFolder = gui.addFolder('🎨 Painting Style Shaders');
const styleController = artFolder.add(artPass.uniforms.uStyleMode, 'value', {
  'Ghibli Watercolor (Kazuo Oga)': 1,
  'Anime Cel & Sketch': 2,
  'Oil Painting (Impasto)': 3,
  'Pure 3D (No Post-Filter)': 0
}).name('Painting Style').listen().onChange(m => {
  if (btnOil) {
    btnOil.textContent = `🎨 Style: ${styleNames[m]}`;
    btnOil.classList.toggle('active', m !== 0);
  }
});
artFolder.add(artPass.uniforms.uPaperTexture, 'value', 0.0, 0.12, 0.005).name('📜 Paper Granulation');
artFolder.add(artPass.uniforms.uEdgeDarkening, 'value', 0.0, 1.0, 0.05).name('✒️ Watercolor Edge Rim');
artFolder.add(artPass.uniforms.uWashSmoothness, 'value', 0.0, 1.0, 0.05).name('💧 Wet-in-Wet Wash');
artFolder.add(artPass.uniforms.uColorVibrance, 'value', 0.8, 1.6, 0.05).name('🌈 Pigment Vibrance');

// 1. Doge Animal Folder
const dogeFolder = gui.addFolder('🐕 Doge Character');
dogeFolder.add(doge.state, 'mode', ['manual', 'roam']).name('Control Mode').listen().onChange(m => {
  if (btnMode) {
    btnMode.classList.toggle('active', m === 'roam');
    btnMode.textContent = m === 'roam' ? '🎮 Manual' : '🤖 Auto-Roam';
  }
});
dogeFolder.add({ jump: () => doge.triggerJump() }, 'jump').name('🦘 Jump [Space]');
dogeFolder.add({ sniff: () => doge.triggerSniff() }, 'sniff').name('🌸 Sniff Flowers [E]');
dogeFolder.add({ follow: isFollowingDoge }, 'follow').name('🎥 Follow Doge Cam').listen().onChange(v => {
  isFollowingDoge = v;
  if (btnCam) btnCam.classList.toggle('active', v);
});

// 2. Pure Ghibli Sky Folder
const skyFolder = gui.addFolder('🌤️ Pure Ghibli Sky');
skyFolder.add(sunParams, 'elevation', 2, 85, 1).name('Sun Elevation').onChange(() => updateSunDirection(sunParams.elevation, sunParams.azimuth));
skyFolder.add(sunParams, 'azimuth', 0, 360, 1).name('Sun Azimuth').onChange(() => updateSunDirection(sunParams.elevation, sunParams.azimuth));
skyFolder.addColor({ val: '#164a85' }, 'val').name('Zenith Blue').onChange(c => sky.uniforms.uZenithColor.value.set(c));
skyFolder.addColor({ val: '#4288ce' }, 'val').name('Azure Mid').onChange(c => sky.uniforms.uMidColor.value.set(c));
skyFolder.addColor({ val: '#d8eef5' }, 'val').name('Horizon Gold Haze').onChange(c => {
  sky.uniforms.uHorizonColor.value.set(c);
  grass.uniforms.uFogColor.value.set(c);
  terrain.uniforms.uFogColor.value.set(c);
});
skyFolder.add(sky.uniforms.uCloudCoverage, 'value', 0.1, 0.9, 0.02).name('Cloud Coverage');
skyFolder.add(sky.uniforms.uCloudDensity, 'value', 0.2, 1.5, 0.05).name('Cloud Density');
skyFolder.add(sky.uniforms.uCloudSpeed, 'value', 0.0, 3.0, 0.1).name('Drift Speed');

// 3. Grass Folder
const grassFolder = gui.addFolder('🌾 Grass Field');
grassFolder.addColor({ val: '#1f4419' }, 'val').name('Root Dark Color').onChange(c => grass.uniforms.uColorRoot.value.set(c));
grassFolder.addColor({ val: '#6bb82d' }, 'val').name('Mid Lush Green').onChange(c => grass.uniforms.uColorMid.value.set(c));
grassFolder.addColor({ val: '#c7ea3b' }, 'val').name('Tip Chartreuse').onChange(c => grass.uniforms.uColorTip.value.set(c));
grassFolder.addColor({ val: '#f8fb6d' }, 'val').name('Sunlit Wave Crest').onChange(c => grass.uniforms.uColorSunlit.value.set(c));
grassFolder.add(grass.uniforms.uSunlitStrength, 'value', 0.0, 1.5, 0.05).name('Sunlit Glow');
grassFolder.add(grass.uniforms.uShadowStrength, 'value', 0.0, 1.0, 0.05).name('Cloud Shadow Depth');

// 4. Wind Dynamics Folder
const windFolder = gui.addFolder('💨 Wind & Waves');
windFolder.add(grass.uniforms.uWindSpeed, 'value', 0.1, 4.0, 0.1).name('Wind Speed').onChange(v => {
  flowers.uniforms.uWindSpeed.value = v;
});
windFolder.add(grass.uniforms.uWindStrength, 'value', 0.0, 2.5, 0.05).name('Wind Strength').onChange(v => {
  flowers.uniforms.uWindStrength.value = v;
});
windFolder.add(grass.uniforms.uWindWaveFreq, 'value', 0.02, 0.25, 0.01).name('Wave Frequency');

// 5. Camera Presets Folder
const camFolder = gui.addFolder('🎥 Camera Views');
const cameraPresets = {
  followDoge: () => {
    setFollowDogeMode(true);
  },
  skyAndMeadow: () => {
    setFollowDogeMode(false);
    controls.target.set(0, 10.0, -30);
    camera.position.set(-1.5, 4.0, 16.0);
  },
  cottageView: () => {
    setFollowDogeMode(false);
    controls.target.set(-7, 3.5, -22);
    camera.position.set(-1.5, 5.0, -10.0);
  },
  panorama: () => {
    setFollowDogeMode(false);
    controls.target.set(5, 8, -25);
    camera.position.set(-25, 14, 40);
  }
};
camFolder.add(cameraPresets, 'followDoge').name('🐕 Follow Doge Cam (Active)');
camFolder.add(cameraPresets, 'skyAndMeadow').name('🌤️ Pure Ghibli Sky & Meadow');
camFolder.add(cameraPresets, 'cottageView').name('🏡 Cottage View');
camFolder.add(cameraPresets, 'panorama').name('🏞️ Vast Rolling Vista');

// --- Window Resize Handling ---
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(w, h);
  artPass.uniforms.uResolution.value.set(
    w * Math.min(window.devicePixelRatio, 2),
    h * Math.min(window.devicePixelRatio, 2)
  );
});

// --- FPS Counter ---
const fpsEl = document.getElementById('fps-counter');
let frameCount = 0;
let lastFpsTime = performance.now();

// --- Main Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  // Update time uniforms across GLSL shaders
  grass.uniforms.uTime.value = elapsedTime;
  sky.uniforms.uTime.value = elapsedTime;
  terrain.uniforms.uTime.value = elapsedTime;
  flowers.uniforms.uTime.value = elapsedTime;
  spores.uniforms.uTime.value = elapsedTime;

  // Update animated scenery & doge
  doge.update(delta, elapsedTime);
  house.update(delta, elapsedTime);

  // Keep sky dome centered on camera to maintain seamless infinite horizon
  sky.mesh.position.copy(camera.position);

  // Camera Tracking behind Doge (follows dog while preserving user zoom and orbit adjustments!)
  if (isFollowingDoge) {
    const dogPos = doge.group.position;
    const targetPos = new THREE.Vector3(dogPos.x, dogPos.y + 0.85, dogPos.z);
    // Smoothly shift both target and camera position together by follow delta
    const followDelta = new THREE.Vector3().subVectors(targetPos, controls.target);
    const followStep = followDelta.multiplyScalar(0.15);
    controls.target.add(followStep);
    camera.position.add(followStep);
  }

  controls.update();

  // Render post-processing pipeline with selected Fine Art Painting Shader
  composer.render();

  // Performance FPS display
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    fpsEl.textContent = `${fps} FPS • Pure Ghibli Sky & Meadow`;
    frameCount = 0;
    lastFpsTime = now;
  }
}

animate();
