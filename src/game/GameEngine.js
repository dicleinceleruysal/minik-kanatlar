import * as THREE from 'three';
import { SkyEnvironment } from './SkyEnvironment.js';
import { createPlaneMesh, animatePlaneMesh } from './PlaneFactory.js';
import { createObstacle } from './ObstacleFactory.js';
import { createStarMesh, spawnCollectBurst } from './StarFactory.js';

export class GameEngine {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 14000);
    this.camera.position.set(0, 4.2, 13);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;

    // Subtle rim light to make modern 3D aircraft contours pop
    this.rimLight = new THREE.DirectionalLight(0x90e0ef, 0.85);
    this.rimLight.position.set(-18, 12, 22);
    this.scene.add(this.rimLight);

    // Lightweight sky IBL applied ONLY to aircraft materials (never alters biome colors)
    this.planeEnvMap = this._createPlaneEnvironmentMap();

    this.skyEnv = new SkyEnvironment(this.scene);

    // State: 'menu' | 'hangar' | 'playing' | 'paused' | 'quiz' | 'ended'
    this.mode = 'menu';
    this.planeConfig = null;
    this.levelConfig = null;
    this.planeMesh = null;

    this.planePos = new THREE.Vector3(0, 0, 0);
    this.planeVel = new THREE.Vector2(0, 0);
    this.planeRot = new THREE.Euler(0, 0, 0);

    this.bounds = { x: 15.5, yMin: -8.5, yMax: 10.5 };
    this.distance = 0;
    this.levelStars = 0;
    this.boostEnergy = 100;
    this.isBoosting = false;
    this.invulnTimer = 0;
    this.shakeTimer = 0;

    this.obstacles = [];
    this.stars = [];
    this.bursts = [];
    this.obstacleSpawnTimer = 0;
    this.starSpawnTimer = 0;

    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      boost: false
    };
    this.touchInput = { x: 0, y: 0, boost: false };

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.hangarOrbitAngle = 0;

    this._bindEvents();
    this._animate = this._animate.bind(this);
    this._animate();
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.keys.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.keys.down = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
      if (e.code === 'Space') {
        this.keys.boost = true;
        if (this.mode === 'playing') e.preventDefault();
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && (this.mode === 'playing' || this.mode === 'paused')) {
        this.callbacks.onTogglePause?.();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.keys.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.keys.down = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
      if (e.code === 'Space') this.keys.boost = false;
    });
  }

  _createPlaneEnvironmentMap() {
    // Tiny 256x128 procedural sky-horizon-ground equirectangular map for crisp aircraft reflections (<5ms)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, '#1d4ed8');
    grad.addColorStop(0.32, '#60a5fa');
    grad.addColorStop(0.49, '#e0f2fe');
    grad.addColorStop(0.52, '#fef9c3');
    grad.addColorStop(0.58, '#475569');
    grad.addColorStop(1.0, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);

    // Soft bright sun reflection disc
    const sunGrad = ctx.createRadialGradient(185, 36, 2, 185, 36, 26);
    sunGrad.addColorStop(0, 'rgba(255,255,245,1)');
    sunGrad.addColorStop(0.35, 'rgba(255,245,210,0.65)');
    sunGrad.addColorStop(1, 'rgba(255,245,210,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(150, 8, 70, 56);

    const envTex = new THREE.CanvasTexture(canvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const pmremTex = pmrem.fromEquirectangular(envTex).texture;
    envTex.dispose();
    pmrem.dispose();
    return pmremTex;
  }

  setPlane(planeConfig) {
    this.planeConfig = planeConfig;
    if (this.planeMesh) {
      this.scene.remove(this.planeMesh);
      this._disposeObject(this.planeMesh);
    }
    this.planeMesh = createPlaneMesh(planeConfig, this.planeEnvMap);
    this.planeMesh.position.copy(this.planePos);
    this.scene.add(this.planeMesh);
  }

  applyLevelTheme(levelConfig) {
    this.levelConfig = levelConfig;
    this.skyEnv.applyLevelTheme(levelConfig.sky, levelConfig.biome);
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'menu' || mode === 'hangar') {
      this._clearEntities();
      this.planePos.set(0, 0, 0);
      this.planeVel.set(0, 0);
      if (this.planeMesh) {
        this.planeMesh.visible = true;
        this.planeMesh.position.set(0, 0, 0);
        this.planeMesh.rotation.set(0, 0, 0);
      }
    }
  }

  startLevel(levelConfig, planeConfig) {
    this._clearEntities();
    this.applyLevelTheme(levelConfig);
    this.setPlane(planeConfig);

    this.planePos.set(0, 0.5, 0);
    this.planeVel.set(0, 0);
    this.distance = 0;
    this.levelStars = 0;
    this.boostEnergy = 100;
    this.isBoosting = false;
    this.invulnTimer = 1.6;
    this.shakeTimer = 0;
    this.obstacleSpawnTimer = 1.2;
    this.starSpawnTimer = 0.5;
    this.mode = 'playing';

    this.keys.up = false;
    this.keys.down = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.boost = false;
  }

  setTouchInput(x, y) {
    this.touchInput.x = THREE.MathUtils.clamp(x, -1, 1);
    this.touchInput.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  setTouchBoost(active) {
    this.touchInput.boost = !!active;
  }

  pauseForQuiz() {
    this.mode = 'quiz';
    this.keys.up = this.keys.down = this.keys.left = this.keys.right = this.keys.boost = false;
    this.touchInput.x = 0;
    this.touchInput.y = 0;
    this.touchInput.boost = false;
  }

  resumeAfterQuiz(isCorrect) {
    // Clear immediate nearby obstacles so the player isn't trapped
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (obs.position.z > -48) {
        this.scene.remove(obs);
        this.obstacles.splice(i, 1);
      }
    }
    this.invulnTimer = isCorrect ? 2.8 : 2.5;
    if (this.planeMesh) this.planeMesh.visible = true;
    this.mode = 'playing';
  }

  _disposeObject(obj) {
    obj.traverse?.((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material?.dispose();
      } else if (child.isSprite) {
        child.material?.dispose();
      }
    });
  }

  _clearEntities() {
    for (const o of this.obstacles) {
      this.scene.remove(o);
      this._disposeObject(o);
    }
    for (const s of this.stars) this.scene.remove(s);
    for (const b of this.bursts) {
      this.scene.remove(b.mesh);
      b.mesh.material?.dispose();
    }
    this.obstacles = [];
    this.stars = [];
    this.bursts = [];
  }

  _spawnObstacle() {
    const types = this.levelConfig.obstacleTypes;
    const type = types[Math.floor(Math.random() * types.length)];
    const obs = createObstacle(type);

    // Bias ~35% of obstacles somewhat toward the player's corridor so dodging is engaging
    let x, y;
    if (obs.userData.isPillar) {
      // Canyon rock pillar rises from floor; top reaches lower-to-upper flight altitude
      x = (Math.random() * 2 - 1) * (this.bounds.x - 1.5);
      y = -4.5 + Math.random() * 10.5;
    } else if (obs.userData.driftDir) {
      // Cross-gliding paragliders enter from left or right and glide across the sky
      x = -obs.userData.driftDir * (this.bounds.x + 8 + Math.random() * 12);
      y = this.bounds.yMin + 2.5 + Math.random() * (this.bounds.yMax - this.bounds.yMin - 4);
    } else if (Math.random() < 0.35) {
      x = THREE.MathUtils.clamp(this.planePos.x + (Math.random() - 0.5) * 9, -this.bounds.x + 1, this.bounds.x - 1);
      y = THREE.MathUtils.clamp(this.planePos.y + (Math.random() - 0.5) * 7, this.bounds.yMin + 1.5, this.bounds.yMax - 1.5);
    } else {
      x = (Math.random() * 2 - 1) * (this.bounds.x - 1);
      y = this.bounds.yMin + 1.5 + Math.random() * (this.bounds.yMax - this.bounds.yMin - 3);
    }

    obs.position.set(x, y, -210 - Math.random() * 35);
    obs.userData.baseY = y;
    this.scene.add(obs);
    this.obstacles.push(obs);
  }

  _spawnStars() {
    // Sometimes spawn a line/arc of 3 stars, otherwise 1 star
    const pattern = Math.random() < 0.35 ? 3 : 1;
    const startX = (Math.random() * 2 - 1) * (this.bounds.x - 2.5);
    const startY = this.bounds.yMin + 2 + Math.random() * (this.bounds.yMax - this.bounds.yMin - 4);

    for (let i = 0; i < pattern; i++) {
      const star = createStarMesh();
      const x = THREE.MathUtils.clamp(startX + (i - 1) * 1.4, -this.bounds.x + 1.5, this.bounds.x - 1.5);
      const y = THREE.MathUtils.clamp(startY + Math.sin(i * 1.2) * 1.2, this.bounds.yMin + 1.5, this.bounds.yMax - 1.5);
      star.position.set(x, y, -185 - i * 11);
      this.scene.add(star);
      this.stars.push(star);
    }
  }

  _updatePlaying(dt) {
    const plane = this.planeConfig;
    const level = this.levelConfig;

    // Boost logic (keyboard Space or mobile Touch Boost)
    const boostPressed = this.keys.boost || this.touchInput.boost;
    if (boostPressed && this.boostEnergy > 8) {
      if (!this.isBoosting) {
        this.callbacks.onBoostStart?.();
      }
      this.isBoosting = true;
      this.boostEnergy = Math.max(0, this.boostEnergy - dt * 36);
    } else {
      this.isBoosting = false;
      this.boostEnergy = Math.min(100, this.boostEnergy + dt * 16);
    }

    const boostMult = this.isBoosting ? plane.turboPower : 1.0;
    const forwardSpeed = level.baseSpeed * (0.85 + plane.speed * 0.22) * boostMult;
    const boostFactor = this.isBoosting ? 1 : 0;

    // Input movement (keyboard + analog mobile joystick)
    const keyX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const keyY = (this.keys.up ? 1 : 0) - (this.keys.down ? 1 : 0);
    const inputX = THREE.MathUtils.clamp(keyX + this.touchInput.x, -1, 1);
    const inputY = THREE.MathUtils.clamp(keyY + this.touchInput.y, -1, 1);

    const maxLatSpeed = 20 * plane.maneuver;
    const accel = 9.5 * plane.maneuver;

    this.planeVel.x = THREE.MathUtils.lerp(this.planeVel.x, inputX * maxLatSpeed, Math.min(1, dt * accel));
    this.planeVel.y = THREE.MathUtils.lerp(this.planeVel.y, inputY * (maxLatSpeed * 0.8), Math.min(1, dt * accel));

    this.planePos.x = THREE.MathUtils.clamp(this.planePos.x + this.planeVel.x * dt, -this.bounds.x, this.bounds.x);
    this.planePos.y = THREE.MathUtils.clamp(this.planePos.y + this.planeVel.y * dt, this.bounds.yMin, this.bounds.yMax);

    // Smooth bank & pitch
    const targetRoll = -this.planeVel.x * 0.032;
    const targetPitch = this.planeVel.y * 0.025;
    const targetYaw = -this.planeVel.x * 0.008;

    this.planeRot.z = THREE.MathUtils.lerp(this.planeRot.z, targetRoll, Math.min(1, dt * 8));
    this.planeRot.x = THREE.MathUtils.lerp(this.planeRot.x, targetPitch, Math.min(1, dt * 8));
    this.planeRot.y = THREE.MathUtils.lerp(this.planeRot.y, targetYaw, Math.min(1, dt * 8));

    if (this.planeMesh) {
      this.planeMesh.position.copy(this.planePos);
      this.planeMesh.rotation.copy(this.planeRot);
      animatePlaneMesh(this.planeMesh, dt, this.elapsed, boostFactor);

      // Invulnerability blink
      if (this.invulnTimer > 0) {
        this.invulnTimer -= dt;
        this.planeMesh.visible = Math.floor(this.invulnTimer * 14) % 2 === 0;
        if (this.invulnTimer <= 0) this.planeMesh.visible = true;
      }
    }

    // Camera smooth follow + dynamic FOV + screen shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const mag = this.shakeTimer * 1.4;
      shakeX = (Math.random() - 0.5) * mag;
      shakeY = (Math.random() - 0.5) * mag;
    }

    const desiredCamX = this.planePos.x * 0.55 + shakeX;
    const desiredCamY = this.planePos.y * 0.55 + 3.4 + shakeY;
    const desiredCamZ = this.isBoosting ? 13.8 : 11.8;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, desiredCamX, Math.min(1, dt * 6));
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, desiredCamY, Math.min(1, dt * 6));
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, desiredCamZ, Math.min(1, dt * 5));
    this.camera.lookAt(this.planePos.x * 0.35, this.planePos.y * 0.35 + 0.5, -24);

    const targetFov = this.isBoosting ? 74 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 6));
      this.camera.updateProjectionMatrix();
    }

    // Sky & clouds
    this.skyEnv.update(dt, forwardSpeed, boostFactor);

    // Spawning
    this.obstacleSpawnTimer -= dt * (this.isBoosting ? 1.25 : 1.0);
    if (this.obstacleSpawnTimer <= 0) {
      this._spawnObstacle();
      this.obstacleSpawnTimer = level.obstacleInterval * (0.78 + Math.random() * 0.45);
    }

    this.starSpawnTimer -= dt;
    if (this.starSpawnTimer <= 0) {
      this._spawnStars();
      this.starSpawnTimer = level.starInterval * (0.8 + Math.random() * 0.45);
    }

    // Update stars + magnet attraction
    const magnetR = plane.magnetRadius;
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.position.z += forwardSpeed * dt;
      s.rotation.y += dt * 2.6;
      s.userData.halo.rotation.z -= dt * 1.8;

      const dist = s.position.distanceTo(this.planePos);
      if (dist < magnetR) {
        s.position.lerp(this.planePos, Math.min(1, dt * 14));
      }

      if (dist < 2.2) {
        spawnCollectBurst(this.scene, s.position, this.bursts, 0xffd60a);
        this.scene.remove(s);
        this.stars.splice(i, 1);
        this.levelStars += 1;
        this.callbacks.onStarCollected?.(this.levelStars);
        continue;
      }

      if (s.position.z > 20) {
        this.scene.remove(s);
        this.stars.splice(i, 1);
      }
    }

    // Update obstacles + collision
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.position.z += forwardSpeed * dt;
      o.position.y = o.userData.baseY + Math.sin(this.elapsed * o.userData.bobSpeed + o.userData.phase) * o.userData.bobAmp;
      if (o.userData.spinSpeed) {
        o.rotation.z += dt * o.userData.spinSpeed;
        o.rotation.y += dt * o.userData.spinSpeed * 0.5;
      }
      if (o.userData.wings) {
        const flap = Math.sin(this.elapsed * 7.5 + o.userData.phase) * 0.42;
        for (const w of o.userData.wings) {
          w.rotation.z = w.userData.side * flap;
        }
      }
      if (o.userData.rotor) {
        o.userData.rotor.rotation.z -= dt * 2.4;
      }
      if (o.userData.topRotor) {
        o.userData.topRotor.rotation.y += dt * (o.userData.topRotorSpeed || 18);
      }
      if (o.userData.driftDir) {
        o.position.x += o.userData.driftDir * o.userData.driftSpeed * dt;
        o.rotation.z = Math.sin(this.elapsed * 1.9 + o.userData.phase) * (o.userData.swayAmp || 0.08);
      }

      // Collision check
      if (this.invulnTimer <= 0 && !o.userData.hit) {
        const dx = o.position.x - this.planePos.x;
        const dy = o.position.y - this.planePos.y;
        const dz = o.position.z - this.planePos.z;
        const hitDist = o.userData.collisionRadius + 1.35;
        let collided = false;
        if (o.userData.isPillar) {
          // Vertical cylinder collision from canyon floor up to pillar cap
          collided = dx * dx + dz * dz < hitDist * hitDist && this.planePos.y < o.position.y + 1.5;
        } else {
          collided = dx * dx + dy * dy + dz * dz < hitDist * hitDist;
        }
        if (collided) {
          o.userData.hit = true;
          this.shakeTimer = 0.45;
          spawnCollectBurst(this.scene, o.position, this.bursts, 0xff4d6d);
          this.scene.remove(o);
          this.obstacles.splice(i, 1);
          this.pauseForQuiz();
          this.callbacks.onObstacleHit?.();
          return;
        }
      }

      if (o.position.z > 24) {
        this.scene.remove(o);
        this._disposeObject(o);
        this.obstacles.splice(i, 1);
      }
    }

    // Progress
    this.distance += forwardSpeed * dt * 0.55;
    const progress = Math.min(1, this.distance / level.distanceGoal);
    this.callbacks.onProgress?.({
      progress,
      distance: Math.floor(this.distance),
      goal: level.distanceGoal,
      speedKmh: Math.round(forwardSpeed * 6.5),
      boostEnergy: this.boostEnergy
    });

    if (this.distance >= level.distanceGoal) {
      this.mode = 'ended';
      this.callbacks.onLevelComplete?.(this.levelStars);
    }
  }

  _updateBursts(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += dt * 6;
      b.mesh.rotation.y += dt * 6;
      b.mesh.material.opacity = b.life / b.maxLife;
      const sc = b.life / b.maxLife;
      b.mesh.scale.setScalar(sc);
    }
  }

  _updateShowcase(dt) {
    this.skyEnv.update(dt, 28, 0);
    if (this.planeMesh) {
      animatePlaneMesh(this.planeMesh, dt, this.elapsed, this.mode === 'hangar' ? 0.25 : 0);
      this.planeMesh.position.y = Math.sin(this.elapsed * 1.8) * 0.35;
      this.planeMesh.rotation.z = Math.sin(this.elapsed * 1.1) * 0.1;
      this.planeMesh.rotation.x = Math.cos(this.elapsed * 0.9) * 0.05;
    }

    if (this.mode === 'hangar') {
      this.hangarOrbitAngle += dt * 0.55;
      const radius = 7.4;
      const cx = Math.sin(this.hangarOrbitAngle) * radius - 2.0;
      const cz = Math.cos(this.hangarOrbitAngle) * radius;
      this.camera.position.lerp(new THREE.Vector3(cx, 2.05, cz), Math.min(1, dt * 4));
      this.camera.lookAt(-1.25, 0.15, 0);
    } else {
      // Menu cinematic orbit
      const cx = Math.sin(this.elapsed * 0.25) * 6.5;
      const cy = 2.6 + Math.sin(this.elapsed * 0.4) * 0.6;
      this.camera.position.lerp(new THREE.Vector3(cx, cy, 10.5), Math.min(1, dt * 3));
      this.camera.lookAt(0, 0.3, -4);
    }
  }

  _animate() {
    requestAnimationFrame(this._animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    this._updateBursts(dt);

    if (this.mode === 'playing') {
      this._updatePlaying(dt);
    } else if (this.mode === 'menu' || this.mode === 'hangar') {
      this._updateShowcase(dt);
    } else if (this.mode === 'quiz' || this.mode === 'paused' || this.mode === 'ended') {
      // Gentle idle animation of propeller/flames even while paused
      if (this.planeMesh) {
        animatePlaneMesh(this.planeMesh, dt * 0.25, this.elapsed, 0);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
