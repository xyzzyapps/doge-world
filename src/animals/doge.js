import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from '../terrain/terrainMath.js';

export function createDogeController(scene) {
  const dogGroup = new THREE.Group();
  scene.add(dogGroup);

  let mixer = null;
  const actions = {};
  let currentAction = null;
  let isLoaded = false;
  let modelMesh = null;

  // Waypoints for auto-roam mode (wide sweeping circuit across open meadow, avoiding cottage)
  const waypoints = [
    new THREE.Vector2(0.0, 5.0),
    new THREE.Vector2(6.5, -2.0),
    new THREE.Vector2(7.5, -10.0),
    new THREE.Vector2(2.0, -13.0),
    new THREE.Vector2(-6.0, -13.0), // Sweeping across meadow in front of cottage with 6+ meters clearance
    new THREE.Vector2(-13.5, -9.0), // Curving around left hill
    new THREE.Vector2(-11.0, -1.0),
    new THREE.Vector2(-4.5, 4.5)
  ];
  let currentWaypointIndex = 0;

  // Kinematic state
  const state = {
    mode: 'roam', // Default to auto-roam
    isRunMode: true, // Run / Gallop mode active!
    currentSpeed: 8.2,
    targetSpeed: 8.2,
    heading: -0.8,
    turnVelocity: 0,
    jumpY: 0,
    jumpVelocity: 0,
    isJumping: false,
    activeAnimation: 'Gallop',
    isSniffing: false
  };

  // Input keys tracking
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false
  };

  // Keyboard Event Listeners
  window.addEventListener('keydown', (e) => {
    // If typing in an input field, ignore
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    let handled = false;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = true;
        state.mode = 'manual';
        handled = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.backward = true;
        state.mode = 'manual';
        handled = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = true;
        state.mode = 'manual';
        handled = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = true;
        state.mode = 'manual';
        handled = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.sprint = true;
        handled = true;
        break;
      case 'Space':
        triggerJump();
        handled = true;
        break;
      case 'KeyE':
        triggerSniff();
        handled = true;
        break;
    }
    if (handled) {
      updateInputUI();
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.sprint = false;
        break;
    }
    updateInputUI();
  });

  function triggerJump() {
    if (state.isJumping) return;
    state.isJumping = true;
    state.jumpVelocity = 4.8;
    playAnimation('Gallop_Jump', 0.2);
  }

  function triggerSniff() {
    if (state.isSniffing) return;
    state.isSniffing = true;
    state.currentSpeed = 0;
    state.targetSpeed = 0;
    playAnimation('Eating', 0.35);
    setTimeout(() => {
      state.isSniffing = false;
      playAnimation('Idle', 0.35);
    }, 2800);
  }

  function updateInputUI() {
    document.querySelectorAll('.control-btn').forEach(btn => {
      const action = btn.dataset.action;
      if (action && keys[action] !== undefined) {
        btn.classList.toggle('active', keys[action]);
      }
    });
  }

  // Initial position clamped to terrain
  const startX = -1.5;
  const startZ = 4.0;
  const startY = getTerrainHeight(startX, startZ);
  dogGroup.position.set(startX, startY, startZ);

  // Load GLTF Model
  const loader = new GLTFLoader();
  loader.load(
    './models/shiba.gltf',
    (gltf) => {
      const model = gltf.scene;
      modelMesh = model;

      const scale = 0.95;
      model.scale.set(scale, scale, scale);

      // Warm anime rim lighting and tone matching
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            child.material.roughness = 0.65;
            child.material.metalness = 0.05;
            if (child.material.name === 'Main') {
              child.material.color.set(0xdf9140); // Radiant warm Shiba tan
            } else if (child.material.name === 'Main_Light') {
              child.material.color.set(0xfdf7eb); // Soft cream white underbelly
            }
          }
        }
      });

      dogGroup.add(model);

      // Setup Animation Mixer
      mixer = new THREE.AnimationMixer(model);

      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        actions[clip.name] = action;
      });

      // Default action (Gallop in Run Mode)
      playAnimation(state.isRunMode ? 'Gallop' : 'Idle');
      isLoaded = true;
    },
    undefined,
    (error) => {
      console.error('Error loading Shiba Inu GLTF:', error);
    }
  );

  function playAnimation(name, duration = 0.3) {
    if (!actions[name]) return;
    const nextAction = actions[name];

    if (currentAction && currentAction !== nextAction) {
      currentAction.fadeOut(duration);
      nextAction.reset().fadeIn(duration).play();
    } else {
      nextAction.play();
    }
    currentAction = nextAction;
    state.activeAnimation = name;
  }

  // Update loop with smooth kinematics & physics
  function update(delta, elapsedTime) {
    if (!isLoaded || !mixer) return;

    // 1. Process Input & Steering
    if (state.mode === 'manual') {
      if (!state.isSniffing) {
        // Target Speed calculation
        if (keys.forward) {
          state.targetSpeed = keys.sprint ? 8.5 : 3.0;
        } else if (keys.backward) {
          state.targetSpeed = -2.0;
        } else {
          state.targetSpeed = 0;
        }

        // Steer with smooth angular acceleration
        let turnInput = 0;
        if (keys.left) turnInput += 1;
        if (keys.right) turnInput -= 1;

        const targetTurnVel = turnInput * (keys.sprint ? 3.0 : 2.5);
        state.turnVelocity += (targetTurnVel - state.turnVelocity) * Math.min(1.0, delta * 8.0);
        state.heading += state.turnVelocity * delta;
      }
    } else if (state.mode === 'roam') {
      // Auto-roam waypoint navigation in Run Mode
      const targetWaypoint = waypoints[currentWaypointIndex];
      const currentPos2D = new THREE.Vector2(dogGroup.position.x, dogGroup.position.z);
      const toTarget = new THREE.Vector2(targetWaypoint.x, targetWaypoint.y).sub(currentPos2D);
      const dist = toTarget.length();

      if (dist < 3.2) {
        currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
      }

      state.targetSpeed = state.isRunMode ? 8.2 : 2.6;
      toTarget.normalize();
      const desiredHeading = Math.atan2(toTarget.x, toTarget.y);

      let diff = desiredHeading - state.heading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      state.turnVelocity = Math.max(-2.4, Math.min(2.4, diff * 3.4));
      state.heading += state.turnVelocity * delta;
    }

    // 2. Smooth Speed Interpolation (No instantaneous jerky movements)
    state.currentSpeed += (state.targetSpeed - state.currentSpeed) * Math.min(1.0, delta * 6.5);

    // 3. Move along heading
    if (Math.abs(state.currentSpeed) > 0.02) {
      const moveStep = state.currentSpeed * delta;
      dogGroup.position.x += Math.sin(state.heading) * moveStep;
      dogGroup.position.z += Math.cos(state.heading) * moveStep;
    }

    // Explicit House Obstacle Avoidance / Collision Hard-Boundary
    const houseCenterX = -7.0;
    const houseCenterZ = -22.0;
    const minSafeDist = 7.8; // Keeps Doge safely clear of porch, stairs, walls, and waterwheel
    const dx = dogGroup.position.x - houseCenterX;
    const dz = dogGroup.position.z - houseCenterZ;
    const distToHouse = Math.sqrt(dx * dx + dz * dz);
    if (distToHouse < minSafeDist && distToHouse > 0.001) {
      const pushFactor = (minSafeDist - distToHouse);
      dogGroup.position.x += (dx / distToHouse) * pushFactor;
      dogGroup.position.z += (dz / distToHouse) * pushFactor;
      // Steer heading away from house
      const awayAngle = Math.atan2(dx, dz);
      state.heading = THREE.MathUtils.lerp(state.heading, awayAngle, 0.25);
    }

    // 4. Smooth Rotation & Bank into turns
    dogGroup.rotation.y = state.heading;
    if (modelMesh) {
      // Roll bank into turns
      const bankAngle = -state.turnVelocity * 0.08;
      modelMesh.rotation.z += (bankAngle - modelMesh.rotation.z) * Math.min(1.0, delta * 6.0);
    }

    // 5. Jump Physics
    if (state.isJumping) {
      state.jumpY += state.jumpVelocity * delta;
      state.jumpVelocity -= 12.0 * delta; // gravity
      if (state.jumpY <= 0) {
        state.jumpY = 0;
        state.isJumping = false;
        state.jumpVelocity = 0;
      }
    }

    // 6. Terrain Elevation Clamping & Slope Alignment
    const groundY = getTerrainHeight(dogGroup.position.x, dogGroup.position.z);
    // Smooth vertical position adjustment
    dogGroup.position.y += ((groundY + state.jumpY) - dogGroup.position.y) * Math.min(1.0, delta * 15.0);

    // Pitch tilt according to terrain slope (calculating gradient)
    const eps = 0.4;
    const hFwd = getTerrainHeight(dogGroup.position.x + Math.sin(state.heading) * eps, dogGroup.position.z + Math.cos(state.heading) * eps);
    const hBack = getTerrainHeight(dogGroup.position.x - Math.sin(state.heading) * eps, dogGroup.position.z - Math.cos(state.heading) * eps);
    const targetPitch = Math.atan2(hFwd - hBack, eps * 2.0);
    dogGroup.rotation.x += (targetPitch - dogGroup.rotation.x) * Math.min(1.0, delta * 8.0);

    // 7. Dynamic Animation State Switching based on current speed
    if (!state.isJumping && !state.isSniffing) {
      const absSpeed = Math.abs(state.currentSpeed);
      if (absSpeed > 3.8) {
        if (state.activeAnimation !== 'Gallop') playAnimation('Gallop', 0.25);
      } else if (absSpeed > 0.3) {
        if (state.activeAnimation !== 'Walk') playAnimation('Walk', 0.25);
      } else {
        if (state.activeAnimation !== 'Idle') playAnimation('Idle', 0.3);
      }
    }

    // Dynamic animation playback rate precisely matching ground movement speed (no foot sliding)
    if (mixer && !state.isSniffing) {
      const absSpeed = Math.abs(state.currentSpeed);
      if (state.activeAnimation === 'Gallop') {
        // Natural gallop stride cadence synchronized with ground displacement
        mixer.timeScale = THREE.MathUtils.clamp(absSpeed / 7.8, 0.8, 1.25);
      } else if (state.activeAnimation === 'Walk') {
        mixer.timeScale = THREE.MathUtils.clamp(absSpeed / 2.6, 0.6, 1.3);
      } else {
        mixer.timeScale = 1.0;
      }
    }

    mixer.update(delta);
  }

  return {
    group: dogGroup,
    state,
    keys,
    playAnimation,
    triggerJump,
    triggerSniff,
    update,
    get isLoaded() { return isLoaded; }
  };
}
