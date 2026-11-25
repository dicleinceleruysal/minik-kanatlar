import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

/**
 * Deterministic lightweight pseudo-noise for organic 3D terrain sculpting.
 */
function ridgeNoise(x, y, z, seed = 0) {
  const n1 = Math.sin(x * 0.19 + seed) * Math.cos(z * 0.19 - seed * 0.7);
  const n2 = Math.sin((x + z) * 0.37 + y * 0.14 + seed * 1.9) * 0.5;
  const n3 = Math.cos(x * 0.61 - z * 0.53 + seed * 2.7) * 0.25;
  return (n1 + n2 + n3) / 1.75;
}

/**
 * Creates an organic, vertex-colored snow-capped alpine mountain (single cohesive 3D mesh).
 */
function createAlpineMountain(radius, height, seed) {
  const geo = new THREE.ConeGeometry(radius, height, 18, 10, true);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cRock = new THREE.Color(0x3e4e63);
  const cSlope = new THREE.Color(0x6c8299);
  const cSnow = new THREE.Color(0xf6fbff);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const hRatio = Math.max(0, Math.min(1, y / height));
    const angle = Math.atan2(z, x);
    // Natural radiating mountain ridges
    const ridge = Math.sin(angle * 5 + seed) * 0.18 + Math.cos(angle * 3 - seed * 1.3) * 0.14;
    const n = ridgeNoise(x, y, z, seed);
    const disp = (1 + ridge + n * 0.22) * (1 - hRatio * 0.25);

    if (hRatio > 0.02 && hRatio < 0.99) {
      x *= disp;
      z *= disp;
      y += n * height * 0.05 * (1 - hRatio);
      pos.setXYZ(i, x, y, z);
    }

    // Organic snowline based on height + ridge
    const snowThreshold = 0.52 + n * 0.16 - ridge * 0.22;
    if (hRatio > snowThreshold + 0.1) {
      tmp.copy(cSnow);
    } else if (hRatio > snowThreshold - 0.08) {
      const t = (hRatio - (snowThreshold - 0.08)) / 0.18;
      tmp.copy(cSlope).lerp(cSnow, Math.max(0, Math.min(1, t)));
    } else {
      tmp.copy(cRock).lerp(cSlope, hRatio * 0.9);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.04,
    flatShading: true
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * Creates a sculpted layered red-rock canyon mesa with geological strata colors.
 */
function createCanyonMesa(radius, height, seed) {
  const geo = new THREE.CylinderGeometry(radius * 0.62, radius * 1.18, height, 18, 9, false);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const strata = [
    new THREE.Color(0x7c2d12),
    new THREE.Color(0xb84a27),
    new THREE.Color(0xd97736),
    new THREE.Color(0x9a3412),
    new THREE.Color(0xe69a5c)
  ];
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const hRatio = Math.max(0, Math.min(1, y / height));

    // Stepped cliff ledges + horizontal erosion
    const step = Math.sin(hRatio * Math.PI * 5) * 0.07;
    const n = ridgeNoise(x * 0.8, y * 0.4, z * 0.8, seed);
    const radialScale = 1 + n * 0.24 + step;

    if (hRatio > 0.01) {
      x *= radialScale;
      z *= radialScale;
      pos.setXYZ(i, x, y, z);
    }

    const bandIdx = Math.min(strata.length - 1, Math.floor(hRatio * strata.length));
    const nextIdx = Math.min(strata.length - 1, bandIdx + 1);
    const frac = (hRatio * strata.length) % 1;
    tmp.copy(strata[bandIdx]).lerp(strata[nextIdx], frac * 0.6);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.04,
    flatShading: true
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * Creates a natural red-rock canyon arch.
 */
function createCanyonArch(scale, seed) {
  const geo = new THREE.TorusGeometry(11 * scale, 2.8 * scale, 7, 16, Math.PI);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = ridgeNoise(x, y, z, seed) * 0.9 * scale;
    pos.setXYZ(i, x + n * 0.6, y + n * 0.4, z + n);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc2542d,
    roughness: 0.92,
    flatShading: true
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * Creates a stylized curved tropical palm tree.
 */
function createPalmTree(trunkMat, leafMat, scale = 1) {
  const group = new THREE.Group();
  // Slightly curved segmented trunk
  let curY = 0;
  let curX = 0;
  for (let s = 0; s < 4; s++) {
    const segH = 1.65 * scale;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry((0.28 - s * 0.04) * scale, (0.36 - s * 0.04) * scale, segH, 6),
      trunkMat
    );
    seg.position.set(curX + s * 0.14 * scale, curY + segH * 0.5, 0);
    seg.rotation.z = -0.1 * (s + 1);
    group.add(seg);
    curY += segH * 0.92;
    curX += s * 0.16 * scale;
  }

  // Fanning palm fronds
  const crown = new THREE.Group();
  crown.position.set(curX + 0.35 * scale, curY, 0);
  for (let f = 0; f < 6; f++) {
    const angle = (f * Math.PI * 2) / 6;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.62 * scale, 3.2 * scale, 4), leafMat);
    frond.scale.set(1.0, 1.0, 0.28);
    frond.position.set(Math.cos(angle) * 1.35 * scale, -0.25 * scale, Math.sin(angle) * 1.35 * scale);
    frond.rotation.z = Math.cos(angle) * -1.18;
    frond.rotation.x = Math.sin(angle) * 1.18;
    crown.add(frond);
  }
  group.add(crown);
  return group;
}

/**
 * Creates a multi-tiered snowy pine tree.
 */
function createPineTree(trunkMat, pineMat, snowMat, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * scale, 0.45 * scale, 2.0 * scale, 5), trunkMat);
  trunk.position.y = 1.0 * scale;
  group.add(trunk);

  for (let t = 0; t < 3; t++) {
    const r = (2.3 - t * 0.55) * scale;
    const h = (2.8 - t * 0.3) * scale;
    const tier = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), pineMat);
    tier.position.y = (2.6 + t * 1.55) * scale;
    group.add(tier);
  }
  const snowTip = new THREE.Mesh(new THREE.ConeGeometry(0.95 * scale, 1.5 * scale, 6), snowMat);
  snowTip.position.y = 6.2 * scale;
  group.add(snowTip);
  return group;
}

/**
 * Creates a sculpted volcanic peak with glowing lava fissures & recessed magma crater.
 */
function createVolcanoPeak(radius, height, seed) {
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(radius * 0.24, radius, height, 18, 9, true);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cBasalt = new THREE.Color(0x3f3742);
  const cAsh = new THREE.Color(0x635561);
  const cLava = new THREE.Color(0xff6b00);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const hRatio = Math.max(0, Math.min(1, y / height));
    const angle = Math.atan2(z, x);

    const n = ridgeNoise(x, y, z, seed);
    const disp = 1 + n * 0.24;
    if (hRatio > 0.02) {
      x *= disp;
      z *= disp;
      pos.setXYZ(i, x, y, z);
    }

    // Glowing magma veins running down specific ridges
    const vein = Math.sin(angle * 3 + seed) > 0.88 && hRatio > 0.22;
    if (vein) {
      tmp.copy(cLava);
    } else if (hRatio > 0.84) {
      tmp.copy(cAsh).lerp(cLava, (hRatio - 0.84) * 4.5);
    } else {
      tmp.copy(cBasalt).lerp(cAsh, Math.max(0, n + 0.3) * 0.6);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const cone = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      flatShading: true
    })
  );
  group.add(cone);

  // Glowing molten magma pool inside crater
  const magma = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.24, 12),
    new THREE.MeshBasicMaterial({ color: 0xff9e00 })
  );
  magma.rotation.x = -Math.PI / 2;
  magma.position.y = height - 0.4;
  group.add(magma);

  // Rising volcanic ash plume puffs
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0x3b353d,
    emissive: 0x451208,
    emissiveIntensity: 0.35,
    roughness: 0.95,
    transparent: true,
    opacity: 0.72
  });
  for (let s = 0; s < 3; s++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * (0.2 + s * 0.09), 1), smokeMat);
    puff.position.set(s * 1.8, height + 3.2 + s * 4.2, -s * 1.2);
    group.add(puff);
  }

  return group;
}

/**
 * Creates a soft vertical gradient canvas texture for realistic Aurora Borealis curtains.
 */
function createAuroraTexture(colorTop, colorBottom) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Vertical soft glow gradient
  const vGrad = ctx.createLinearGradient(0, 0, 0, 128);
  vGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vGrad.addColorStop(0.28, colorTop);
  vGrad.addColorStop(0.72, colorBottom);
  vGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 256, 128);

  // Vertical light streaks
  for (let i = 0; i < 42; i++) {
    const x = (i / 42) * 256;
    const w = 2 + Math.random() * 5;
    ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.14})`;
    ctx.fillRect(x, 12, w, 104);
  }

  // Horizontal edge fade mask
  ctx.globalCompositeOperation = 'destination-in';
  const hGrad = ctx.createLinearGradient(0, 0, 256, 0);
  hGrad.addColorStop(0, 'rgba(0,0,0,0)');
  hGrad.addColorStop(0.18, 'rgba(0,0,0,1)');
  hGrad.addColorStop(0.82, 'rgba(0,0,0,1)');
  hGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 256, 128);

  return new THREE.CanvasTexture(canvas);
}

export class SkyEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.speedLines = [];
    this.biomeProps = [];
    this.auroraMeshes = [];
    this.weatherParticles = null;
    this.weatherConfig = null;
    this.currentBiome = null;
    this.hasLightning = false;
    this.lightningTimer = 3.0;
    this.baseSunIntensity = 2.2;
    this.time = 0;

    this.biomeGroup = new THREE.Group();
    this.scene.add(this.biomeGroup);

    this._initSky();
    this._initLights();
    this._initGroundPlane();
    this._initStarfield();
    this._initClouds();
    this._initSpeedLines();
  }

  _initSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    this.scene.add(this.sky);

    this.sunVector = new THREE.Vector3();

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gctx = glowCanvas.getContext('2d');
    const grad = gctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 240, 1)');
    grad.addColorStop(0.25, 'rgba(255, 238, 195, 0.7)');
    grad.addColorStop(0.6, 'rgba(255, 200, 130, 0.18)');
    grad.addColorStop(1, 'rgba(255, 200, 130, 0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 128, 128);

    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.sunGlow = new THREE.Sprite(glowMat);
    this.sunGlow.scale.set(95, 95, 1);
    this.scene.add(this.sunGlow);
  }

  _initLights() {
    this.ambientLight = new THREE.AmbientLight(0x8ecae6, 0.9);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3b6e8c, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff6e5, 2.3);
    this.sunLight.position.set(40, 80, -120);
    this.scene.add(this.sunLight);
  }

  _initGroundPlane() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 320; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const w = 14 + Math.random() * 44;
      const h = 2 + Math.random() * 5;
      ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
      ctx.fillRect(x, y, w, h);
    }

    this.groundTexture = new THREE.CanvasTexture(canvas);
    this.groundTexture.wrapS = THREE.RepeatWrapping;
    this.groundTexture.wrapT = THREE.RepeatWrapping;
    this.groundTexture.repeat.set(34, 34);

    const groundGeo = new THREE.PlaneGeometry(2400, 2400);
    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1d6fa3,
      map: this.groundTexture,
      roughness: 0.55,
      metalness: 0.2
    });
    this.groundMesh = new THREE.Mesh(groundGeo, this.groundMaterial);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -48;
    this.scene.add(this.groundMesh);
  }

  _initStarfield() {
    const count = 450;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.46;
      const r = 680;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starfieldMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      transparent: true,
      opacity: 0.0,
      fog: false
    });
    this.starfield = new THREE.Points(geo, this.starfieldMat);
    this.scene.add(this.starfield);
  }

  _initClouds() {
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x1a2836,
      emissiveIntensity: 0.22,
      roughness: 0.92,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88
    });

    const puffGeo = new THREE.SphereGeometry(1, 10, 8);

    for (let i = 0; i < 26; i++) {
      const group = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const mesh = new THREE.Mesh(puffGeo, this.cloudMaterial);
        const sx = 4.5 + Math.random() * 6.5;
        const sy = 2.0 + Math.random() * 3.0;
        const sz = 4.2 + Math.random() * 6.0;
        mesh.scale.set(sx, sy, sz);
        mesh.position.set(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 8
        );
        group.add(mesh);
      }
      this._placeCloud(group, true);
      this.scene.add(group);
      this.clouds.push(group);
    }
  }

  _placeCloud(group, initial = false) {
    const layer = Math.random();
    let x, y;
    if (layer < 0.3) {
      x = (Math.random() - 0.5) * 260;
      y = -24 + Math.random() * 8;
    } else if (layer < 0.68) {
      const side = Math.random() < 0.5 ? -1 : 1;
      x = side * (36 + Math.random() * 95);
      y = 4 + Math.random() * 34;
    } else {
      x = (Math.random() - 0.5) * 240;
      y = 26 + Math.random() * 34;
    }
    const z = initial ? -Math.random() * 460 + 30 : -420 - Math.random() * 90;
    group.position.set(x, y, z);
    group.scale.setScalar(0.85 + Math.random() * 1.05);
    group.userData.speedFactor = 0.42 + Math.random() * 0.34;
  }

  _initSpeedLines() {
    const lineGeo = new THREE.BoxGeometry(0.06, 0.06, 8);
    this.speedLineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0
    });
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(lineGeo, this.speedLineMat);
      m.position.set(
        (Math.random() - 0.5) * 36,
        (Math.random() - 0.5) * 22,
        -Math.random() * 120
      );
      this.scene.add(m);
      this.speedLines.push(m);
    }
  }

  // ==================== HIGH-DETAIL LIGHTWEIGHT 3D BIOMES ====================
  _clearBiome() {
    while (this.biomeGroup.children.length > 0) {
      const child = this.biomeGroup.children[0];
      this.biomeGroup.remove(child);
      child.traverse?.((obj) => {
        if (obj.isMesh || obj.isPoints) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });
    }
    this.biomeProps = [];
    this.auroraMeshes = [];
    this.weatherParticles = null;
    this.weatherConfig = null;
  }

  _placeBiomeProp(prop, biome, initial = false) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const z = initial ? -Math.random() * 480 + 40 : -440 - Math.random() * 90;

    if (biome === 'archipelago') {
      const x = side * (22 + Math.random() * 115);
      prop.position.set(x, -48, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
    } else if (biome === 'canyon') {
      const x = side * (30 + Math.random() * 88);
      prop.position.set(x, -48, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
    } else if (biome === 'alpine') {
      const x = side * (30 + Math.random() * 105);
      prop.position.set(x, -48, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
    } else if (biome === 'volcano') {
      const x = side * (32 + Math.random() * 100);
      prop.position.set(x, -48, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
    } else {
      if (prop.userData.isSkyGate) {
        prop.position.set(0, 1, z);
      } else {
        // Majestic icebergs & glacial spires along the polar ocean
        const x = side * (26 + Math.random() * 105);
        prop.position.set(x, -48, z);
        prop.rotation.y = Math.random() * Math.PI * 2;
      }
    }
  }

  _createWeatherParticles(count, color, size, fallSpeed, driftSpeed) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 68;
      positions[i * 3 + 1] = -14 + Math.random() * 38;
      positions[i * 3 + 2] = -Math.random() * 150 + 15;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const points = new THREE.Points(geo, mat);
    this.biomeGroup.add(points);
    this.weatherParticles = points;
    this.weatherConfig = { count, fallSpeed, driftSpeed };
  }

  _buildBiome(biome) {
    if (this.currentBiome === biome) return;
    this._clearBiome();
    this.currentBiome = biome;

    if (biome === 'archipelago') {
      // Tropical islands with glowing turquoise shallow lagoon rings, organic sandy/green hills & curved palm trees
      const lagoonMat = new THREE.MeshBasicMaterial({
        color: 0x48cae4,
        transparent: true,
        opacity: 0.45
      });
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.9, flatShading: true });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d936c, roughness: 0.78, flatShading: true });
      const boulderMat = new THREE.MeshStandardMaterial({ color: 0x7a8288, roughness: 0.9, flatShading: true });

      for (let i = 0; i < 20; i++) {
        const island = new THREE.Group();
        const r = 11 + Math.random() * 15;
        const h = 7 + Math.random() * 11;
        const seed = i * 4.7;

        // Shallow turquoise water halo
        const lagoon = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r * 1.42, 18), lagoonMat);
        lagoon.rotation.x = -Math.PI / 2;
        lagoon.position.y = 0.25;
        island.add(lagoon);

        // Sculpted organic island terrain (sand beach -> lush green peak)
        const geo = new THREE.CylinderGeometry(r * 0.15, r * 1.08, h, 16, 6);
        geo.translate(0, h * 0.5, 0);
        const pos = geo.attributes.position;
        const cols = new Float32Array(pos.count * 3);
        const cSand = new THREE.Color(0xf4d58d);
        const cGrass = new THREE.Color(0x2a9d8f);
        const cPeak = new THREE.Color(0x52b788);
        const tmp = new THREE.Color();

        for (let v = 0; v < pos.count; v++) {
          let vx = pos.getX(v);
          let vy = pos.getY(v);
          let vz = pos.getZ(v);
          const hr = Math.max(0, Math.min(1, vy / h));
          const n = ridgeNoise(vx, vy, vz, seed);
          if (hr > 0.02) {
            vx *= 1 + n * 0.28;
            vz *= 1 + n * 0.28;
            pos.setXYZ(v, vx, vy, vz);
          }
          if (hr < 0.24) tmp.copy(cSand);
          else if (hr < 0.68) tmp.copy(cSand).lerp(cGrass, (hr - 0.24) / 0.44);
          else tmp.copy(cGrass).lerp(cPeak, (hr - 0.68) / 0.32);
          cols[v * 3] = tmp.r;
          cols[v * 3 + 1] = tmp.g;
          cols[v * 3 + 2] = tmp.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        geo.computeVertexNormals();
        const land = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })
        );
        island.add(land);

        // 2-3 curved palm trees
        for (let p = 0; p < 3; p++) {
          const palm = createPalmTree(trunkMat, leafMat, 0.85 + Math.random() * 0.55);
          const pa = (p / 3) * Math.PI * 2 + seed;
          palm.position.set(Math.cos(pa) * r * 0.42, h * 0.36, Math.sin(pa) * r * 0.42);
          palm.rotation.y = pa;
          island.add(palm);
        }

        // Coastal rock
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), boulderMat);
        rock.scale.set(1.4, 0.8, 1.1);
        rock.position.set(r * 0.65, 1.1, 0);
        island.add(rock);

        this._placeBiomeProp(island, biome, true);
        this.biomeGroup.add(island);
        this.biomeProps.push(island);
      }
    } else if (biome === 'canyon') {
      // Sculpted layered red-rock mesas & dramatic natural stone arches
      for (let i = 0; i < 24; i++) {
        const seed = i * 5.3;
        let prop;
        if (i % 5 === 0) {
          prop = createCanyonArch(1.4 + Math.random() * 0.9, seed);
        } else {
          const r = 11 + Math.random() * 14;
          const h = 26 + Math.random() * 36;
          prop = createCanyonMesa(r, h, seed);
        }
        this._placeBiomeProp(prop, biome, true);
        this.biomeGroup.add(prop);
        this.biomeProps.push(prop);
      }
    } else if (biome === 'alpine') {
      // Sculpted vertex-colored snow-capped mountains + multi-tiered snowy pine trees + live snow
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
      const pineMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.85, flatShading: true });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f9fc, roughness: 0.6, flatShading: true });

      for (let i = 0; i < 22; i++) {
        const cluster = new THREE.Group();
        const r = 16 + Math.random() * 18;
        const h = 36 + Math.random() * 46;
        const seed = i * 6.1;

        const mainPeak = createAlpineMountain(r, h, seed);
        cluster.add(mainPeak);

        const shoulder = createAlpineMountain(r * 0.62, h * 0.62, seed + 11.3);
        shoulder.position.set(r * 0.58, 0, r * 0.25);
        cluster.add(shoulder);

        for (let t = 0; t < 3; t++) {
          const pine = createPineTree(trunkMat, pineMat, snowMat, 0.9 + Math.random() * 0.5);
          const ta = (t / 3) * Math.PI * 2 + seed;
          pine.position.set(Math.cos(ta) * r * 0.78, 0, Math.sin(ta) * r * 0.78);
          cluster.add(pine);
        }

        this._placeBiomeProp(cluster, biome, true);
        this.biomeGroup.add(cluster);
        this.biomeProps.push(cluster);
      }

      this._createWeatherParticles(260, 0xffffff, 0.58, 11, 3.8);
    } else if (biome === 'volcano') {
      // Sculpted basalt volcanoes with glowing magma veins, craters, ash plumes & rising embers
      for (let i = 0; i < 20; i++) {
        const r = 16 + Math.random() * 16;
        const h = 32 + Math.random() * 40;
        const volc = createVolcanoPeak(r, h, i * 7.4);
        this._placeBiomeProp(volc, biome, true);
        this.biomeGroup.add(volc);
        this.biomeProps.push(volc);
      }

      this._createWeatherParticles(210, 0xff7b00, 0.62, -8.0, 4.8);
    } else {
      // Level 5: Grand Polar Stratosphere — Sculpted Icebergs, Stratosphere Sky-Gates,
      // Ringed Horizon Planet & Live Wave-Animated Aurora Borealis Curtains
      const cDeepIce = new THREE.Color(0x0096c7);
      const cMidIce = new THREE.Color(0x90e0ef);
      const cSnowTop = new THREE.Color(0xf8fdff);
      const tmpCol = new THREE.Color();

      // 1) Majestic faceted polar icebergs & glacier spires
      for (let i = 0; i < 22; i++) {
        const berg = new THREE.Group();
        const r = 13 + Math.random() * 16;
        const h = 24 + Math.random() * 38;
        const seed = i * 8.3;

        const geo = new THREE.CylinderGeometry(r * 0.12, r * 1.15, h, 14, 7);
        geo.translate(0, h * 0.5, 0);
        const pos = geo.attributes.position;
        const cols = new Float32Array(pos.count * 3);

        for (let v = 0; v < pos.count; v++) {
          let vx = pos.getX(v);
          let vy = pos.getY(v);
          let vz = pos.getZ(v);
          const hr = Math.max(0, Math.min(1, vy / h));
          const n = ridgeNoise(vx, vy, vz, seed);
          if (hr > 0.02) {
            vx *= 1 + n * 0.3;
            vz *= 1 + n * 0.3;
            pos.setXYZ(v, vx, vy, vz);
          }
          if (hr < 0.32) tmpCol.copy(cDeepIce).lerp(cMidIce, hr / 0.32);
          else tmpCol.copy(cMidIce).lerp(cSnowTop, (hr - 0.32) / 0.68);
          cols[v * 3] = tmpCol.r;
          cols[v * 3 + 1] = tmpCol.g;
          cols[v * 3 + 2] = tmpCol.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        geo.computeVertexNormals();

        const bergMesh = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.32,
            metalness: 0.12,
            flatShading: true
          })
        );
        berg.add(bergMesh);

        // Glowing cyan ice floe halo at waterline
        const floe = new THREE.Mesh(
          new THREE.RingGeometry(r * 0.9, r * 1.38, 12),
          new THREE.MeshBasicMaterial({ color: 0xade8f4, transparent: true, opacity: 0.42 })
        );
        floe.rotation.x = -Math.PI / 2;
        floe.position.y = 0.3;
        berg.add(floe);

        this._placeBiomeProp(berg, biome, true);
        this.biomeGroup.add(berg);
        this.biomeProps.push(berg);
      }

      // 2) Cinematic glowing Stratosphere Sky-Gate Arches framing the flight path
      const gateOuterMat = new THREE.MeshStandardMaterial({
        color: 0xe0fbff,
        emissive: 0x00b4d8,
        emissiveIntensity: 0.45,
        metalness: 0.65,
        roughness: 0.2
      });
      const gateInnerMat = new THREE.MeshBasicMaterial({
        color: 0x72efdd,
        transparent: true,
        opacity: 0.65
      });

      for (let g = 0; g < 4; g++) {
        const gate = new THREE.Group();
        const outerArch = new THREE.Mesh(new THREE.TorusGeometry(26, 0.55, 8, 36, Math.PI * 1.25), gateOuterMat);
        outerArch.rotation.z = -Math.PI * 0.125;
        gate.add(outerArch);

        const innerGlow = new THREE.Mesh(new THREE.TorusGeometry(24.6, 0.22, 6, 36, Math.PI * 1.25), gateInnerMat);
        innerGlow.rotation.z = -Math.PI * 0.125;
        gate.add(innerGlow);

        gate.userData.isSkyGate = true;
        gate.position.set(0, 1, -85 - g * 125);
        this.biomeGroup.add(gate);
        this.biomeProps.push(gate);
      }

      // 3) Giant ringed icy moon/planet on the upper horizon
      const planetGroup = new THREE.Group();
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(34, 24, 18),
        new THREE.MeshStandardMaterial({
          color: 0xcaf0f8,
          emissive: 0x48bfe3,
          emissiveIntensity: 0.32,
          roughness: 0.65
        })
      );
      planetGroup.add(planet);

      const planetRing = new THREE.Mesh(
        new THREE.RingGeometry(44, 62, 42),
        new THREE.MeshBasicMaterial({
          color: 0x80ffdb,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      planetRing.rotation.x = Math.PI * 0.38;
      planetRing.rotation.y = 0.25;
      planetGroup.add(planetRing);
      planetGroup.position.set(115, 88, -460);
      this.biomeGroup.add(planetGroup);

      // 4) Vivid multi-layered live-waving Aurora Borealis curtains
      const auroraPalettes = [
        ['rgba(0, 255, 198, 0.82)', 'rgba(56, 189, 248, 0.42)'],
        ['rgba(114, 239, 221, 0.75)', 'rgba(155, 93, 229, 0.45)'],
        ['rgba(72, 202, 228, 0.72)', 'rgba(0, 245, 212, 0.38)'],
        ['rgba(199, 125, 255, 0.65)', 'rgba(72, 191, 227, 0.35)']
      ];
      for (let a = 0; a < 4; a++) {
        const tex = createAuroraTexture(auroraPalettes[a][0], auroraPalettes[a][1]);
        const geo = new THREE.PlaneGeometry(420, 68, 24, 2);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const ribbon = new THREE.Mesh(geo, mat);
        ribbon.position.set((a - 1.5) * 68, 52 + a * 11, -210 - a * 44);
        ribbon.rotation.y = (a - 1.5) * 0.24;
        ribbon.userData.baseY = ribbon.position.y;
        ribbon.userData.phase = a * 1.7;
        this.biomeGroup.add(ribbon);
        this.auroraMeshes.push(ribbon);
      }

      // Sparkling ice crystals & stardust in the air
      this._createWeatherParticles(220, 0xcaf0f8, 0.58, 3.2, 3.0);
    }
  }

  applyLevelTheme(skyCfg, biome = 'archipelago') {
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = skyCfg.turbidity;
    uniforms['rayleigh'].value = skyCfg.rayleigh;
    uniforms['mieCoefficient'].value = skyCfg.mieCoefficient;
    uniforms['mieDirectionalG'].value = skyCfg.mieDirectionalG;

    const phi = THREE.MathUtils.degToRad(90 - skyCfg.elevation);
    const theta = THREE.MathUtils.degToRad(skyCfg.azimuth);
    this.sunVector.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(this.sunVector);

    this.sunLight.position.copy(this.sunVector).multiplyScalar(220);
    this.sunLight.color.setHex(skyCfg.sunColor);
    this.sunLight.intensity = skyCfg.sunIntensity;
    this.baseSunIntensity = skyCfg.sunIntensity;

    this.sunGlow.position.copy(this.sunVector).multiplyScalar(480);
    this.sunGlow.material.color.setHex(skyCfg.sunColor);

    this.ambientLight.color.setHex(skyCfg.ambientColor);
    this.ambientLight.intensity = skyCfg.ambientIntensity;

    this.hemiLight.color.setHex(skyCfg.hemiSky);
    this.hemiLight.groundColor.setHex(skyCfg.hemiGround);

    this.cloudMaterial.color.setHex(skyCfg.cloudColor);
    this.cloudMaterial.emissive.setHex(skyCfg.cloudEmissive);

    this.groundMaterial.color.setHex(skyCfg.seaColor);
    this.starfieldMat.opacity = skyCfg.starfieldOpacity;

    this.scene.fog = new THREE.FogExp2(skyCfg.fogColor, skyCfg.fogDensity);
    this.hasLightning = !!skyCfg.hasLightning;
    this.lightningTimer = 2.0 + Math.random() * 3.0;

    this._buildBiome(biome);
  }

  update(dt, forwardSpeed, boostFactor = 0) {
    this.time += dt;

    this.groundTexture.offset.y -= dt * forwardSpeed * 0.012;

    for (const c of this.clouds) {
      c.position.z += forwardSpeed * c.userData.speedFactor * dt;
      if (c.position.z > 55) {
        this._placeCloud(c, false);
      }
    }

    for (const p of this.biomeProps) {
      p.position.z += forwardSpeed * (p.userData.isSkyGate ? 0.92 : 0.72) * dt;
      if (p.position.z > 65) {
        this._placeBiomeProp(p, this.currentBiome, false);
      }
    }

    for (const ribbon of this.auroraMeshes) {
      const pos = ribbon.geometry.attributes.position;
      const phase = ribbon.userData.phase;
      for (let v = 0; v < pos.count; v++) {
        const vx = pos.getX(v);
        pos.setZ(v, Math.sin(vx * 0.02 + this.time * 0.9 + phase) * 26);
      }
      pos.needsUpdate = true;
      ribbon.position.y = ribbon.userData.baseY + Math.sin(this.time * 0.7 + phase) * 3.5;
    }

    if (this.weatherParticles && this.weatherConfig) {
      const posAttr = this.weatherParticles.geometry.attributes.position;
      const arr = posAttr.array;
      const { count, fallSpeed, driftSpeed } = this.weatherConfig;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        arr[ix] += Math.sin(this.time * 1.5 + i) * driftSpeed * dt;
        arr[ix + 1] -= fallSpeed * dt;
        arr[ix + 2] += forwardSpeed * 1.15 * dt;

        if (arr[ix + 2] > 18 || arr[ix + 1] < -16 || arr[ix + 1] > 28) {
          arr[ix] = (Math.random() - 0.5) * 68;
          arr[ix + 1] = fallSpeed > 0 ? 18 + Math.random() * 10 : -14 + Math.random() * 8;
          arr[ix + 2] = -145 - Math.random() * 20;
        }
      }
      posAttr.needsUpdate = true;
    }

    const targetOpacity = Math.min(0.45, Math.max(0, boostFactor * 0.42 + (forwardSpeed - 70) * 0.004));
    this.speedLineMat.opacity += (targetOpacity - this.speedLineMat.opacity) * Math.min(1, dt * 8);
    if (this.speedLineMat.opacity > 0.01) {
      for (const l of this.speedLines) {
        l.position.z += forwardSpeed * 2.1 * dt;
        if (l.position.z > 15) {
          l.position.z = -110 - Math.random() * 30;
          l.position.x = (Math.random() - 0.5) * 34;
          l.position.y = (Math.random() - 0.5) * 20;
        }
      }
    }

    if (this.hasLightning) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.sunLight.intensity = this.baseSunIntensity * 3.8;
        this.lightningTimer = 2.4 + Math.random() * 4.2;
      } else if (this.sunLight.intensity > this.baseSunIntensity) {
        this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, this.baseSunIntensity, dt * 10);
      }
    }
  }
}
