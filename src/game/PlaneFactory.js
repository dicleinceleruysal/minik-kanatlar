import * as THREE from 'three';

// =============================================================================
// SHARED PROCEDURAL AEROSPACE TEXTURES (Generated once, zero external assets)
// =============================================================================
let _panelBumpTex = null;
let _panelRoughTex = null;
let _glowSpriteTex = null;

function getAerospaceTextures() {
  if (_panelBumpTex) {
    return { bumpMap: _panelBumpTex, roughnessMap: _panelRoughTex };
  }

  const size = 512;

  // 1. Panel seams & micro-rivet bump map
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle brushed aerospace aluminum grain
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * size;
    const alpha = 0.02 + Math.random() * 0.03;
    bCtx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    bCtx.fillRect(0, y, size, 1);
  }

  // Skin panel grid seams
  bCtx.strokeStyle = 'rgba(25, 25, 25, 0.72)';
  bCtx.lineWidth = 2;
  const cols = [0, 128, 256, 384, 512];
  const rows = [0, 85, 170, 256, 341, 426, 512];
  for (const x of cols) {
    bCtx.beginPath();
    bCtx.moveTo(x, 0);
    bCtx.lineTo(x, size);
    bCtx.stroke();
  }
  for (const y of rows) {
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.lineTo(size, y);
    bCtx.stroke();
  }

  // Subtle inspection hatches
  bCtx.strokeStyle = 'rgba(30, 30, 30, 0.65)';
  bCtx.lineWidth = 1.5;
  bCtx.strokeRect(24, 188, 68, 44);
  bCtx.strokeRect(284, 276, 74, 48);
  bCtx.strokeRect(156, 22, 62, 40);

  // Micro-rivets along panel edges
  bCtx.fillStyle = 'rgba(220, 220, 220, 0.55)';
  for (const y of rows) {
    for (let x = 10; x < size; x += 16) {
      bCtx.fillRect(x, (y + 5) % size, 2, 2);
      bCtx.fillRect(x, (y - 7 + size) % size, 2, 2);
    }
  }
  for (const x of cols) {
    for (let y = 10; y < size; y += 16) {
      bCtx.fillRect((x + 5) % size, y, 2, 2);
    }
  }

  _panelBumpTex = new THREE.CanvasTexture(bumpCanvas);
  _panelBumpTex.wrapS = THREE.RepeatWrapping;
  _panelBumpTex.wrapT = THREE.RepeatWrapping;
  _panelBumpTex.repeat.set(2, 2);

  // 2. Subtle panel-variation roughness map
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');
  rCtx.fillStyle = '#c8c8c8';
  rCtx.fillRect(0, 0, size, size);

  // Slight tonal sheen variation per panel (realistic aircraft skin)
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols.length - 1; c++) {
      const shade = 185 + ((r * 17 + c * 31) % 38);
      rCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
      rCtx.fillRect(cols[c] + 2, rows[r] + 2, cols[c + 1] - cols[c] - 4, rows[r + 1] - rows[r] - 4);
    }
  }
  // Darker (rougher) panel seams
  rCtx.strokeStyle = '#ffffff';
  rCtx.lineWidth = 2;
  for (const x of cols) {
    rCtx.beginPath();
    rCtx.moveTo(x, 0);
    rCtx.lineTo(x, size);
    rCtx.stroke();
  }
  for (const y of rows) {
    rCtx.beginPath();
    rCtx.moveTo(0, y);
    rCtx.lineTo(size, y);
    rCtx.stroke();
  }

  _panelRoughTex = new THREE.CanvasTexture(roughCanvas);
  _panelRoughTex.wrapS = THREE.RepeatWrapping;
  _panelRoughTex.wrapT = THREE.RepeatWrapping;
  _panelRoughTex.repeat.set(2, 2);

  return { bumpMap: _panelBumpTex, roughnessMap: _panelRoughTex };
}

function getGlowSpriteTexture() {
  if (_glowSpriteTex) return _glowSpriteTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.28, 'rgba(255,255,255,0.72)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  _glowSpriteTex = new THREE.CanvasTexture(canvas);
  return _glowSpriteTex;
}

// =============================================================================
// TRUE 3D AERODYNAMIC GEOMETRY BUILDERS
// =============================================================================

/**
 * Generates normalized NACA-style airfoil profile points (u from 0=LE to 1=TE).
 * Returns closed loop around upper & lower surface with rounded leading edge and crisp trailing edge.
 */
function sampleAirfoilProfile(camber = 0.025, numPerSide = 10) {
  const pts = [];
  // Upper surface: LE (0) -> TE (1)
  for (let i = 0; i <= numPerSide; i++) {
    const beta = (i / numPerSide) * Math.PI;
    const x = 0.5 * (1 - Math.cos(beta)); // cosine spacing for smooth rounded LE
    const yt =
      5 *
      (0.2969 * Math.sqrt(Math.max(0, x)) -
        0.126 * x -
        0.3516 * x * x +
        0.2843 * x * x * x -
        0.1015 * x * x * x * x);
    const yc = camber * 4 * x * (1 - x);
    pts.push([x, yc + yt]);
  }
  // Lower surface: TE (1) -> LE (0)
  for (let i = numPerSide - 1; i >= 1; i--) {
    const beta = (i / numPerSide) * Math.PI;
    const x = 0.5 * (1 - Math.cos(beta));
    const yt =
      5 *
      (0.2969 * Math.sqrt(Math.max(0, x)) -
        0.126 * x -
        0.3516 * x * x +
        0.2843 * x * x * x -
        0.1015 * x * x * x * x);
    const yc = camber * 4 * x * (1 - x);
    pts.push([x, yc - yt * 0.78]);
  }
  return pts;
}

/**
 * Creates a true 3D lofted airfoil wing (single side: side = -1 left or +1 right).
 * stations: array of { span, zLE, chord, thickness, y, twist }
 */
function createLoftedWingSide(stations, side, material, camber = 0.025) {
  const profile = sampleAirfoilProfile(camber, 10);
  const ringLen = profile.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let s = 0; s < stations.length; s++) {
    const st = stations[s];
    const vCoord = s / Math.max(1, stations.length - 1);
    const twist = st.twist || 0;
    const cosT = Math.cos(twist);
    const sinT = Math.sin(twist);

    for (let p = 0; p < ringLen; p++) {
      const [u, h] = profile[p];
      const localZ = u * st.chord;
      const localY = h * st.thickness;

      // Apply aerodynamic washout/twist around quarter chord
      const dz = localZ - st.chord * 0.25;
      const rotZ = dz * cosT - localY * sinT + st.chord * 0.25;
      const rotY = dz * sinT + localY * cosT;

      positions.push(side * st.span, st.y + rotY, st.zLE + rotZ);
      uvs.push(u * 2.0, vCoord * 2.2);
    }
  }

  for (let s = 0; s < stations.length - 1; s++) {
    const baseA = s * ringLen;
    const baseB = (s + 1) * ringLen;
    for (let p = 0; p < ringLen; p++) {
      const nextP = (p + 1) % ringLen;
      const a = baseA + p;
      const b = baseA + nextP;
      const c = baseB + nextP;
      const d = baseB + p;
      if (side > 0) {
        indices.push(a, d, c, a, c, b);
      } else {
        indices.push(a, c, d, a, b, c);
      }
    }
  }

  // Cap wingtip cleanly
  const tipStart = (stations.length - 1) * ringLen;
  const tipCenterIdx = positions.length / 3;
  const tipSt = stations[stations.length - 1];
  positions.push(side * tipSt.span, tipSt.y, tipSt.zLE + tipSt.chord * 0.45);
  uvs.push(0.5, 1.0);
  for (let p = 0; p < ringLen; p++) {
    const nextP = (p + 1) % ringLen;
    if (side > 0) {
      indices.push(tipCenterIdx, tipStart + nextP, tipStart + p);
    } else {
      indices.push(tipCenterIdx, tipStart + p, tipStart + nextP);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * Helper: Creates symmetric left + right lofted 3D wings in a group.
 */
function createSymmetricLoftedWing(stations, material, camber = 0.025) {
  const g = new THREE.Group();
  g.add(createLoftedWingSide(stations, -1, material, camber));
  g.add(createLoftedWingSide(stations, 1, material, camber));
  return g;
}

/**
 * Creates a true 3D lofted vertical tail fin (symmetric airfoil cross-section).
 * stations: array of { height, zLE, chord, thickness, xOffset }
 */
function createLoftedVerticalFin(stations, material) {
  const profile = sampleAirfoilProfile(0, 8);
  const ringLen = profile.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let s = 0; s < stations.length; s++) {
    const st = stations[s];
    const vCoord = s / Math.max(1, stations.length - 1);
    const xOff = st.xOffset || 0;
    for (let p = 0; p < ringLen; p++) {
      const [u, h] = profile[p];
      positions.push(xOff + h * st.thickness, st.height, st.zLE + u * st.chord);
      uvs.push(u * 1.5, vCoord * 1.6);
    }
  }

  for (let s = 0; s < stations.length - 1; s++) {
    const baseA = s * ringLen;
    const baseB = (s + 1) * ringLen;
    for (let p = 0; p < ringLen; p++) {
      const nextP = (p + 1) % ringLen;
      const a = baseA + p;
      const b = baseA + nextP;
      const c = baseB + nextP;
      const d = baseB + p;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Cap top of vertical fin
  const topStart = (stations.length - 1) * ringLen;
  const topCenterIdx = positions.length / 3;
  const topSt = stations[stations.length - 1];
  positions.push(topSt.xOffset || 0, topSt.height, topSt.zLE + topSt.chord * 0.45);
  uvs.push(0.5, 1.0);
  for (let p = 0; p < ringLen; p++) {
    const nextP = (p + 1) % ringLen;
    indices.push(topCenterIdx, topStart + p, topStart + nextP);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * Smooth tapered fuselage using LatheGeometry along Z axis (nose at -Z, tail at +Z).
 * Optional crossSectionFn(angle) lets us sculpt realistic oval, teardrop, or chined stealth cross-sections!
 */
function createSculptedFuselage(profilePoints, material, segments = 24, scaleX = 1, scaleY = 1, chineStrength = 0) {
  const pts = profilePoints.map(([r, z]) => new THREE.Vector2(Math.max(0.002, r), z));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.rotateX(Math.PI / 2);

  if (chineStrength > 0 || scaleX !== 1 || scaleY !== 1) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      const r = Math.hypot(x, y);
      if (chineStrength > 0 && r > 0.004) {
        const ang = Math.atan2(y, x);
        // Flatten belly slightly & sharpen lateral stealth chines at ang = 0 and PI
        const chine = 1 + chineStrength * Math.pow(Math.abs(Math.cos(ang)), 4);
        x *= chine;
        if (y < 0) y *= 1 - chineStrength * 0.55;
      }
      pos.setXYZ(i, x * scaleX, y * scaleY, pos.getZ(i));
    }
    geo.computeVertexNormals();
  }

  return new THREE.Mesh(geo, material);
}

/**
 * Sculpted scimitar/elliptical modern carbon propeller with spinner & subtle motion-blur disc.
 */
function createModernPropeller(bladeCount, radius, spinnerColor, bladeColor = 0x161b26) {
  const propGroup = new THREE.Group();

  // Aerodynamic paraboloid spinner cone
  const spinner = createSculptedFuselage(
    [
      [0.004, -0.38],
      [0.11, -0.26],
      [0.19, -0.1],
      [0.22, 0.08],
      [0.2, 0.14]
    ],
    new THREE.MeshStandardMaterial({
      color: spinnerColor,
      metalness: 0.78,
      roughness: 0.18,
      envMapIntensity: 1.25
    }),
    20
  );
  propGroup.add(spinner);

  // Chrome backplate ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.205, 0.018, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
  );
  ring.position.z = 0.08;
  propGroup.add(ring);

  const bladeMat = new THREE.MeshStandardMaterial({
    color: bladeColor,
    metalness: 0.45,
    roughness: 0.28
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0xffd60a,
    emissive: 0xffb703,
    emissiveIntensity: 0.25,
    roughness: 0.3
  });

  // Sculpted scimitar blade shape
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.035, 0.12);
  bladeShape.quadraticCurveTo(-0.085, radius * 0.48, -0.055, radius * 0.88);
  bladeShape.quadraticCurveTo(-0.01, radius * 1.01, 0.045, radius * 0.92);
  bladeShape.quadraticCurveTo(0.08, radius * 0.52, 0.04, 0.12);
  bladeShape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2
  });
  bladeGeo.translate(0, 0, -0.009);

  const tipGeo = new THREE.BoxGeometry(0.088, 0.1, 0.028);

  for (let i = 0; i < bladeCount; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI * 2) / bladeCount;

    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.y = 0.32;
    holder.add(blade);

    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, radius * 0.91, 0);
    tip.rotation.y = 0.32;
    holder.add(tip);

    propGroup.add(holder);
  }

  // Subtle spinning motion blur disc + outer yellow safety tip ring
  const disc = new THREE.Mesh(
    new THREE.RingGeometry(0.22, radius * 0.96, 28),
    new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  propGroup.add(disc);

  const tipBlur = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.88, radius * 0.97, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffd60a,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  propGroup.add(tipBlur);

  return propGroup;
}

/**
 * Detailed titanium jet exhaust nozzle with articulated turkey-feather petals & turbine throat.
 */
function createDetailedJetNozzle(radius, length, metalMat, glowColor, petalCount = 12) {
  const nozzleGroup = new THREE.Group();

  // Outer heat-tinted titanium collar
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x3b4252,
    metalness: 0.88,
    roughness: 0.24,
    envMapIntensity: 1.3
  });
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.08, radius * 1.0, length * 0.52, 20),
    titaniumMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.z = -length * 0.22;
  nozzleGroup.add(collar);

  // Articulated exhaust actuator petals converging slightly toward rear
  const petalGeo = new THREE.BoxGeometry((2 * Math.PI * radius) / petalCount * 0.82, 0.035, length * 0.62);
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? metalMat : titaniumMat);
    const rMid = radius * 0.96;
    petal.position.set(Math.cos(angle) * rMid, Math.sin(angle) * rMid, length * 0.22);
    petal.rotation.z = angle + Math.PI / 2;
    petal.rotation.x = -0.14;
    nozzleGroup.add(petal);
  }

  // Recessed dark throat + glowing afterburner flame-holder rings
  const throat = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.82, 18),
    new THREE.MeshBasicMaterial({ color: 0x0b0f19 })
  );
  throat.position.z = length * 0.12;
  nozzleGroup.add(throat);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.66, radius * 0.075, 8, 20),
    new THREE.MeshBasicMaterial({ color: glowColor })
  );
  innerRing.position.z = length * 0.34;
  nozzleGroup.add(innerRing);

  const coreRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.34, radius * 0.055, 8, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  coreRing.position.z = length * 0.28;
  nozzleGroup.add(coreRing);

  return nozzleGroup;
}

/**
 * Realistic volumetric afterburner plume with Mach shock diamonds & additive glow.
 */
function createAfterburnerFlame(color, scale = 1.0) {
  const flameGroup = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.28 * scale, 2.05 * scale, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  outer.rotation.x = Math.PI / 2;
  outer.position.z = 1.02 * scale;
  flameGroup.add(outer);

  const mid = new THREE.Mesh(
    new THREE.ConeGeometry(0.18 * scale, 1.38 * scale, 14),
    new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  mid.rotation.x = Math.PI / 2;
  mid.position.z = 0.68 * scale;
  flameGroup.add(mid);

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.1 * scale, 0.72 * scale, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  core.rotation.x = Math.PI / 2;
  core.position.z = 0.35 * scale;
  flameGroup.add(core);

  // Mach shock diamonds along the supersonic exhaust plume
  const diamondMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  for (let i = 0; i < 3; i++) {
    const dScale = (1 - i * 0.22) * scale;
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.085 * dScale, 0), diamondMat);
    diamond.scale.set(1, 1, 1.9);
    diamond.position.z = (0.45 + i * 0.42) * scale;
    flameGroup.add(diamond);
  }

  // Soft nozzle glow halo
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlowSpriteTexture(),
      color,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  glow.scale.set(0.95 * scale, 0.95 * scale, 1);
  glow.position.z = 0.16 * scale;
  flameGroup.add(glow);

  return flameGroup;
}

/**
 * Detailed cockpit canopy with recessed interior tub, HUD glass, ejection seat, pilot & visor, and metallic frame bows.
 */
function createDetailedCockpit(cockpitMat, frameMat, sx, sy, sz, posY, posZ, hasHud = true) {
  const canopyGroup = new THREE.Group();

  // Dark recessed cockpit tub base
  const tub = new THREE.Mesh(
    new THREE.SphereGeometry(0.41, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85, metalness: 0.2 })
  );
  tub.scale.set(sx * 0.95, 0.12, sz * 0.95);
  tub.position.y = -0.02;
  canopyGroup.add(tub);

  // Ejection seat / headrest behind pilot
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.22 * sx, 0.24 * sy, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.3 })
  );
  seat.position.set(0, 0.09 * sy, 0.14 * sz);
  seat.rotation.x = -0.22;
  canopyGroup.add(seat);

  // Pilot shoulders
  const shoulders = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 })
  );
  shoulders.scale.set(1.15 * sx, 0.55 * sy, 0.75);
  shoulders.position.set(0, 0.03 * sy, 0.02 * sz);
  canopyGroup.add(shoulders);

  // Pilot flight helmet + dark reflective visor
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.22 })
  );
  helmet.position.set(0, 0.14 * sy, -0.02 * sz);
  canopyGroup.add(helmet);

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.118, 10, 8, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.25, Math.PI * 0.36),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.08 })
  );
  visor.rotation.y = Math.PI;
  visor.position.copy(helmet.position);
  canopyGroup.add(visor);

  // Glowing green/cyan HUD combiner glass in front of pilot
  if (hasHud) {
    const hud = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16 * sx, 0.11 * sy),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    hud.position.set(0, 0.12 * sy, -0.22 * sz);
    hud.rotation.x = -0.35;
    canopyGroup.add(hud);
  }

  // Sculpted teardrop clearcoat glass canopy
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
    cockpitMat
  );
  glass.scale.set(sx, sy, sz);
  canopyGroup.add(glass);

  // Canopy base sill rim
  const sill = new THREE.Mesh(new THREE.TorusGeometry(0.415, 0.022, 8, 24), frameMat);
  sill.rotation.x = Math.PI / 2;
  sill.scale.set(sx, sz, 1);
  sill.position.y = 0.01;
  canopyGroup.add(sill);

  // Forward windshield bow arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.425 * sx, 0.02, 8, 18, Math.PI), frameMat);
  arch.position.set(0, 0.0, -0.1 * sz);
  arch.rotation.x = -0.22;
  arch.scale.set(1, sy / sx, 1);
  canopyGroup.add(arch);

  canopyGroup.position.set(0, posY, posZ);
  return canopyGroup;
}

/**
 * Adds aviation navigation lights (port red, starboard green) + blinking white tail strobe with soft halos.
 */
function addAviationLights(group, x, y, z, tailPos, strobes) {
  const bulbGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const glowTex = getGlowSpriteTexture();

  const makeLight = (lx, ly, lz, color, haloScale = 0.55) => {
    const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color }));
    bulb.position.set(lx, ly, lz);
    group.add(bulb);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    halo.scale.set(haloScale, haloScale, 1);
    halo.position.set(lx, ly, lz);
    group.add(halo);
    return halo;
  };

  makeLight(-x, y, z, 0xff2e4c, 0.55); // Port (Left) Red
  makeLight(x, y, z, 0x00f59b, 0.55);  // Starboard (Right) Green

  if (tailPos) {
    const strobe = makeLight(tailPos[0], tailPos[1], tailPos[2], 0xffffff, 0.65);
    strobes.push(strobe);
  }
}

// =============================================================================
// MAIN AIRCRAFT FACTORY (5 DISTINCT REALISTIC 3D AIRCRAFT)
// =============================================================================
export function createPlaneMesh(planeConfig, envMap = null) {
  const group = new THREE.Group();
  const propellers = [];
  const flames = [];
  const strobes = [];

  const c = planeConfig.colors;
  const level = planeConfig.level;
  const { bumpMap, roughnessMap } = getAerospaceTextures();

  // Upgraded clearcoat painted aerospace aluminum / composite materials
  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: c.primary,
    metalness: 0.34 + level * 0.08,
    roughness: Math.max(0.22, 0.44 - level * 0.04),
    clearcoat: level <= 3 ? 0.85 : 0.45,
    clearcoatRoughness: level <= 3 ? 0.14 : 0.28,
    bumpMap,
    bumpScale: 0.012,
    roughnessMap,
    envMapIntensity: 1.15
  });

  const secondaryMat = new THREE.MeshPhysicalMaterial({
    color: c.secondary,
    metalness: 0.28 + level * 0.07,
    roughness: 0.3,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    bumpMap,
    bumpScale: 0.01,
    roughnessMap,
    envMapIntensity: 1.1
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1b2230,
    metalness: 0.82,
    roughness: 0.26,
    bumpMap,
    bumpScale: 0.008,
    envMapIntensity: 1.25
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.14,
    envMapIntensity: 1.35
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: c.accent,
    emissive: c.accent,
    emissiveIntensity: level >= 4 ? 0.72 : 0.18,
    metalness: 0.48,
    roughness: 0.22,
    envMapIntensity: 1.1
  });

  const cockpitMat = new THREE.MeshPhysicalMaterial({
    color: c.cockpit,
    metalness: 0.15,
    roughness: 0.05,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
    envMapIntensity: 1.5
  });

  if (level === 1) {
    // =========================================================================
    // LEVEL 1: CESUR KIRLANGIÇ — Modern Composite Aerobatic Sport Prop (Extra 330 / Cirrus)
    // =========================================================================
    const fuselage = createSculptedFuselage(
      [
        [0.01, -2.42],
        [0.24, -2.26],
        [0.39, -1.78],
        [0.45, -1.05],
        [0.46, -0.25],
        [0.41, 0.55],
        [0.29, 1.48],
        [0.15, 2.28],
        [0.04, 2.58]
      ],
      secondaryMat,
      24,
      0.92,
      1.04
    );
    group.add(fuselage);

    // Sculpted red nose cowling with twin lower cooling intakes
    const cowling = createSculptedFuselage(
      [
        [0.245, -2.27],
        [0.402, -1.78],
        [0.46, -1.08],
        [0.462, -0.78]
      ],
      primaryMat,
      24,
      0.935,
      1.05
    );
    group.add(cowling);

    // Racing cheatline band wrapping rear fuselage
    const band = createSculptedFuselage(
      [
        [0.38, 0.85],
        [0.32, 1.32],
        [0.27, 1.65]
      ],
      accentMat,
      24,
      0.94,
      1.06
    );
    group.add(band);

    // Twin engine air intake scoops + chrome exhaust stacks under cowling
    [-1, 1].forEach((side) => {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.26), darkMetalMat);
      vent.position.set(side * 0.16, -0.24, -2.02);
      group.add(vent);

      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.42, 8), chromeMat);
      pipe.rotation.x = Math.PI / 2 + 0.2;
      pipe.position.set(side * 0.24, -0.38, -1.45);
      group.add(pipe);
    });

    // True NACA cambered lofted main wings with dihedral & curved upturned winglets
    const mainWing = createSymmetricLoftedWing(
      [
        { span: 0.28, zLE: -1.05, chord: 1.24, thickness: 0.16, y: -0.14 },
        { span: 1.55, zLE: -0.92, chord: 0.96, thickness: 0.125, y: -0.05 },
        { span: 2.82, zLE: -0.76, chord: 0.64, thickness: 0.08, y: 0.05 },
        { span: 3.04, zLE: -0.62, chord: 0.42, thickness: 0.05, y: 0.38 } // blended upturned winglet
      ],
      primaryMat,
      0.03
    );
    group.add(mainWing);

    // Wing racing stripes + aerodynamic landing gear spats with visible rubber tires
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.92 });
    [-1, 1].forEach((side) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.018, 0.13), accentMat);
      stripe.position.set(side * 1.68, 0.015, -0.54);
      stripe.rotation.y = side * -0.09;
      stripe.rotation.z = side * 0.075;
      group.add(stripe);

      // Streamlined landing gear leg
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.14), chromeMat);
      strut.position.set(side * 0.62, -0.46, -0.76);
      strut.rotation.z = side * 0.28;
      group.add(strut);

      // Sculpted aerodynamic wheel fairing (spat)
      const spat = createSculptedFuselage(
        [
          [0.01, -0.34],
          [0.11, -0.18],
          [0.13, 0.02],
          [0.09, 0.26],
          [0.01, 0.42]
        ],
        primaryMat,
        14,
        0.82,
        1.0
      );
      spat.position.set(side * 0.76, -0.68, -0.76);
      group.add(spat);

      // Visible lower rubber tire peeking out of fairing
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 14), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(side * 0.76, -0.76, -0.76);
      group.add(tire);
    });

    // Lofted horizontal stabilizer
    const hTail = createSymmetricLoftedWing(
      [
        { span: 0.08, zLE: 1.75, chord: 0.68, thickness: 0.08, y: 0.08 },
        { span: 1.18, zLE: 1.94, chord: 0.38, thickness: 0.048, y: 0.1 }
      ],
      secondaryMat,
      0.0
    );
    group.add(hTail);

    // Lofted vertical tail fin with dorsal fillet
    const vTail = createLoftedVerticalFin(
      [
        { height: 0.06, zLE: 1.22, chord: 1.25, thickness: 0.1 },
        { height: 0.32, zLE: 1.62, chord: 0.85, thickness: 0.085 },
        { height: 1.18, zLE: 2.08, chord: 0.44, thickness: 0.052 }
      ],
      primaryMat
    );
    group.add(vTail);

    // Detailed bubble canopy with pilot, seat & HUD
    group.add(createDetailedCockpit(cockpitMat, darkMetalMat, 0.82, 0.76, 2.05, 0.34, -0.22, false));

    // 3-blade sculpted carbon scimitar propeller
    const prop = createModernPropeller(3, 1.12, c.accent);
    prop.position.set(0, 0, -2.42);
    group.add(prop);
    propellers.push(prop);

    addAviationLights(group, 3.06, 0.39, -0.45, [0, 1.18, 2.52], strobes);
  } else if (level === 2) {
    // =========================================================================
    // LEVEL 2: RÜZGAR AVCISI — Twin-Turboprop Executive Racer (Piaggio Avanti style)
    // =========================================================================
    const fuselage = createSculptedFuselage(
      [
        [0.01, -3.05],
        [0.18, -2.68],
        [0.37, -1.98],
        [0.47, -1.05],
        [0.49, 0.15],
        [0.43, 1.15],
        [0.29, 2.05],
        [0.14, 2.75],
        [0.03, 3.0]
      ],
      secondaryMat,
      24,
      0.94,
      1.02
    );
    group.add(fuselage);

    // Sleek metallic blue dorsal aero spine & cabin side windows
    const dorsalFairing = createSculptedFuselage(
      [
        [0.01, -1.35],
        [0.2, -0.5],
        [0.22, 0.95],
        [0.14, 2.15],
        [0.02, 2.5]
      ],
      primaryMat,
      14,
      1.0,
      0.52
    );
    dorsalFairing.position.y = 0.38;
    group.add(dorsalFairing);

    // Executive cabin oval windows along both sides
    const winGeo = new THREE.SphereGeometry(0.085, 10, 8);
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 4; i++) {
        const win = new THREE.Mesh(winGeo, cockpitMat);
        win.scale.set(0.32, 0.85, 1.25);
        win.position.set(side * 0.44, 0.14, -0.25 + i * 0.42);
        group.add(win);
      }
    });

    // Forward lofted mustache canards
    const canard = createSymmetricLoftedWing(
      [
        { span: 0.16, zLE: -2.35, chord: 0.42, thickness: 0.055, y: -0.06 },
        { span: 1.12, zLE: -2.18, chord: 0.24, thickness: 0.035, y: -0.04 }
      ],
      accentMat,
      0.015
    );
    group.add(canard);

    // High-aspect swept lofted main wings with tall blended winglets
    const mainWing = createSymmetricLoftedWing(
      [
        { span: 0.36, zLE: -0.58, chord: 1.16, thickness: 0.15, y: -0.05 },
        { span: 1.75, zLE: -0.26, chord: 0.86, thickness: 0.11, y: 0.02 },
        { span: 3.18, zLE: 0.1, chord: 0.5, thickness: 0.065, y: 0.1 },
        { span: 3.42, zLE: 0.34, chord: 0.34, thickness: 0.042, y: 0.66 } // tall blended winglet
      ],
      primaryMat,
      0.028
    );
    group.add(mainWing);

    // Twin sculpted turboprop engine nacelles + chin intakes + 4-blade scimitar props
    [-1, 1].forEach((side) => {
      const nacelle = createSculptedFuselage(
        [
          [0.06, -1.16],
          [0.21, -0.88],
          [0.26, -0.35],
          [0.26, 0.25],
          [0.19, 0.82],
          [0.08, 1.12],
          [0.02, 1.2]
        ],
        darkMetalMat,
        18,
        0.96,
        1.04
      );
      nacelle.position.set(side * 1.42, -0.03, -0.18);
      group.add(nacelle);

      // Chin air intake scoop under spinner
      const chin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.42), primaryMat);
      chin.position.set(side * 1.42, -0.24, -0.88);
      group.add(chin);

      // Glowing turquoise engine collar ring
      const accentRing = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.026, 8, 20), accentMat);
      accentRing.position.set(side * 1.42, -0.03, -0.78);
      group.add(accentRing);

      // Twin side chrome turbine exhaust stubs
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 0.28, 8), chromeMat);
      stub.rotation.x = Math.PI / 2;
      stub.rotation.z = side * -0.25;
      stub.position.set(side * 1.66, -0.06, -0.42);
      group.add(stub);

      // 4-blade scimitar propeller
      const prop = createModernPropeller(4, 0.88, c.accent);
      prop.position.set(side * 1.42, -0.03, -1.32);
      group.add(prop);
      propellers.push(prop);
    });

    // Swept lofted T-Tail
    const vTail = createLoftedVerticalFin(
      [
        { height: 0.08, zLE: 1.45, chord: 1.35, thickness: 0.1 },
        { height: 0.48, zLE: 1.88, chord: 0.96, thickness: 0.085 },
        { height: 1.38, zLE: 2.38, chord: 0.62, thickness: 0.06 }
      ],
      primaryMat
    );
    group.add(vTail);

    const tTailHoriz = createSymmetricLoftedWing(
      [
        { span: 0.04, zLE: 2.34, chord: 0.62, thickness: 0.065, y: 1.34 },
        { span: 1.32, zLE: 2.58, chord: 0.34, thickness: 0.042, y: 1.38 }
      ],
      secondaryMat,
      0.0
    );
    group.add(tTailHoriz);

    // Panoramic nose cockpit
    group.add(createDetailedCockpit(cockpitMat, darkMetalMat, 0.84, 0.66, 2.3, 0.34, -0.95, true));
    addAviationLights(group, 3.44, 0.66, 0.46, [0, 1.38, 2.98], strobes);
  } else if (level === 3) {
    // =========================================================================
    // LEVEL 3: ŞİMŞEK JET — Modern Supersonic Light Fighter (F-16 / Hürjet)
    // =========================================================================
    const fuselage = createSculptedFuselage(
      [
        [0.008, -3.65],
        [0.14, -3.12],
        [0.34, -2.25],
        [0.48, -1.05],
        [0.53, 0.15],
        [0.5, 1.35],
        [0.4, 2.25],
        [0.35, 2.52]
      ],
      secondaryMat,
      24,
      1.06,
      0.86
    );
    group.add(fuselage);

    // Sharp nose radar cone + metallic pitot probe
    const radome = createSculptedFuselage(
      [
        [0.008, -3.66],
        [0.148, -3.12],
        [0.28, -2.55]
      ],
      darkMetalMat,
      20,
      1.07,
      0.87
    );
    group.add(radome);

    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.022, 0.42, 8), chromeMat);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(0, 0, -3.85);
    group.add(pitot);

    // Sculpted aerodynamic dorsal avionics spine
    const spine = createSculptedFuselage(
      [
        [0.01, -0.45],
        [0.24, 0.15],
        [0.25, 1.45],
        [0.16, 2.25],
        [0.02, 2.48]
      ],
      primaryMat,
      14,
      0.92,
      0.68
    );
    spine.position.set(0, 0.34, 0);
    group.add(spine);

    // True NACA swept fighter wings with LERX strakes
    const mainWing = createSymmetricLoftedWing(
      [
        { span: 0.36, zLE: -1.45, chord: 2.65, thickness: 0.14, y: -0.04 }, // LERX root
        { span: 0.78, zLE: -0.62, chord: 1.92, thickness: 0.13, y: -0.04 },
        { span: 2.1, zLE: 0.05, chord: 1.18, thickness: 0.088, y: -0.06 },
        { span: 3.12, zLE: 0.56, chord: 0.62, thickness: 0.052, y: -0.08 }
      ],
      primaryMat,
      0.018
    );
    group.add(mainWing);

    // Sculpted side air intakes with hollow dark ducts + underwing pylons + wingtip missile rails
    [-1, 1].forEach((side) => {
      const intake = createSculptedFuselage(
        [
          [0.16, -1.32],
          [0.24, -0.95],
          [0.26, 0.05],
          [0.2, 0.82],
          [0.04, 1.15]
        ],
        darkMetalMat,
        14,
        0.92,
        0.84
      );
      intake.position.set(side * 0.55, -0.09, -0.18);
      group.add(intake);

      // Intake lip accent frame + dark hollow throat
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 8, 16), accentMat);
      lip.scale.set(0.9, 0.82, 1);
      lip.position.set(side * 0.55, -0.09, -1.46);
      group.add(lip);

      const duct = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 14),
        new THREE.MeshBasicMaterial({ color: 0x05070d })
      );
      duct.rotation.y = Math.PI;
      duct.position.set(side * 0.55, -0.09, -1.47);
      group.add(duct);

      // Underwing aerodynamic fuel pod / pylon
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.65), darkMetalMat);
      pylon.position.set(side * 1.45, -0.19, 0.35);
      group.add(pylon);

      const pod = createSculptedFuselage(
        [
          [0.008, -0.78],
          [0.09, -0.45],
          [0.095, 0.35],
          [0.01, 0.72]
        ],
        secondaryMat,
        12
      );
      pod.position.set(side * 1.45, -0.32, 0.35);
      group.add(pod);

      // Wingtip missile/sensor rail
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 1.42, 10), accentMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * 3.16, -0.08, 0.88);
      group.add(rail);

      const railTip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 10), chromeMat);
      railTip.rotation.x = -Math.PI / 2;
      railTip.position.set(side * 3.16, -0.08, 0.06);
      group.add(railTip);
    });

    // All-moving swept lofted stabilators
    const hTail = createSymmetricLoftedWing(
      [
        { span: 0.32, zLE: 1.72, chord: 0.86, thickness: 0.075, y: 0.0 },
        { span: 1.56, zLE: 2.26, chord: 0.42, thickness: 0.042, y: -0.04 }
      ],
      secondaryMat,
      0.0
    );
    group.add(hTail);

    // Tall swept vertical tail with radar warning pod at base
    const vTail = createLoftedVerticalFin(
      [
        { height: 0.22, zLE: 1.05, chord: 1.45, thickness: 0.1 },
        { height: 0.82, zLE: 1.62, chord: 0.96, thickness: 0.075 },
        { height: 1.56, zLE: 2.18, chord: 0.52, thickness: 0.048 }
      ],
      accentMat
    );
    group.add(vTail);

    // Detailed articulated petal nozzle + Mach-diamond afterburner
    const nozzle = createDetailedJetNozzle(0.35, 0.62, darkMetalMat, c.engine, 14);
    nozzle.position.set(0, -0.02, 2.66);
    group.add(nozzle);

    const flame = createAfterburnerFlame(c.engine, 1.15);
    flame.position.set(0, -0.02, 2.86);
    group.add(flame);
    flames.push(flame);

    // Long fighter bubble canopy with HUD & pilot
    group.add(createDetailedCockpit(cockpitMat, darkMetalMat, 0.82, 0.68, 2.65, 0.33, -1.05, true));
    addAviationLights(group, 3.18, -0.08, 0.95, [0, 1.56, 2.68], strobes);
  } else if (level === 4) {
    // =========================================================================
    // LEVEL 4: FIRTINA KARTALI — 5th-Gen Twin-Tail Stealth Fighter (KAAN / F-22)
    // =========================================================================
    // Wide chined stealth fuselage
    const fuselage = createSculptedFuselage(
      [
        [0.01, -4.0],
        [0.24, -3.22],
        [0.54, -2.1],
        [0.78, -0.82],
        [0.86, 0.52],
        [0.76, 1.85],
        [0.56, 2.62]
      ],
      primaryMat,
      20,
      1.12,
      0.55,
      0.24 // sharp stealth lateral chines
    );
    group.add(fuselage);

    // Diamond stealth lofted main wings
    const mainWing = createSymmetricLoftedWing(
      [
        { span: 0.58, zLE: -1.22, chord: 2.92, thickness: 0.145, y: -0.03 },
        { span: 1.98, zLE: -0.25, chord: 1.75, thickness: 0.095, y: -0.04 },
        { span: 3.55, zLE: 0.72, chord: 0.68, thickness: 0.048, y: -0.06 }
      ],
      secondaryMat,
      0.012
    );
    group.add(mainWing);

    // Forward stealth DSI caret intakes, glowing leading-edge accents, canted twin tails & twin vectoring nozzles
    [-1, 1].forEach((side) => {
      // Sculpted caret stealth air intake
      const intake = createSculptedFuselage(
        [
          [0.18, -1.55],
          [0.3, -1.05],
          [0.34, 0.15],
          [0.3, 1.55],
          [0.24, 2.38]
        ],
        darkMetalMat,
        12,
        0.9,
        0.65,
        0.18
      );
      intake.position.set(side * 0.68, -0.06, -0.05);
      group.add(intake);

      const duct = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.22, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x04070d })
      );
      duct.position.set(side * 0.72, -0.06, -1.56);
      duct.rotation.y = side * 0.25;
      group.add(duct);

      // Subtle glowing cyan stealth leading-edge strip
      const accentBar = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.045, 0.075), accentMat);
      accentBar.position.set(side * 2.02, 0.018, 0.12);
      accentBar.rotation.y = side * -0.58;
      group.add(accentBar);

      // Signature 5th-gen outward-canted twin vertical tails (true airfoil lofted)
      const vTail = createLoftedVerticalFin(
        [
          { height: 0.02, zLE: 1.15, chord: 1.42, thickness: 0.095 },
          { height: 0.68, zLE: 1.62, chord: 0.98, thickness: 0.072 },
          { height: 1.42, zLE: 2.12, chord: 0.56, thickness: 0.045 }
        ],
        primaryMat
      );
      vTail.position.set(side * 0.78, 0.06, 0.0);
      vTail.rotation.z = side * -0.38;
      group.add(vTail);

      // Twin thrust-vectoring serrated nozzles + blue plasma Mach-diamond flames
      const nozzle = createDetailedJetNozzle(0.28, 0.6, darkMetalMat, c.engine, 12);
      nozzle.position.set(side * 0.42, -0.02, 2.74);
      group.add(nozzle);

      const flame = createAfterburnerFlame(c.engine, 1.04);
      flame.position.set(side * 0.42, -0.02, 2.94);
      group.add(flame);
      flames.push(flame);
    });

    // Stealth diamond rear stabilators
    const hTail = createSymmetricLoftedWing(
      [
        { span: 0.58, zLE: 1.78, chord: 0.96, thickness: 0.072, y: -0.02 },
        { span: 1.95, zLE: 2.42, chord: 0.44, thickness: 0.04, y: -0.05 }
      ],
      primaryMat,
      0.0
    );
    group.add(hTail);

    // Gold-tinted radar-absorbent stealth canopy with HUD
    group.add(createDetailedCockpit(cockpitMat, darkMetalMat, 0.88, 0.62, 2.8, 0.31, -1.2, true));
    addAviationLights(group, 3.56, -0.05, 1.06, [0, 0.25, 2.65], strobes);
  } else {
    // =========================================================================
    // LEVEL 5: ANKA-X HAYALET — 6th-Gen Hypersonic Blended-Wing Stealth
    // =========================================================================
    // Chined wide blended-wing-body (BWB) hypersonic core
    const core = createSculptedFuselage(
      [
        [0.01, -4.35],
        [0.34, -3.32],
        [0.74, -1.95],
        [1.04, -0.35],
        [1.02, 1.18],
        [0.74, 2.38],
        [0.42, 2.86]
      ],
      primaryMat,
      20,
      1.22,
      0.44,
      0.28
    );
    group.add(core);

    // Cranked-kite 6th-gen lofted stealth wings
    const stealthWing = createSymmetricLoftedWing(
      [
        { span: 0.65, zLE: -1.75, chord: 3.95, thickness: 0.16, y: -0.02 },
        { span: 2.15, zLE: -0.22, chord: 2.25, thickness: 0.1, y: -0.03 },
        { span: 3.85, zLE: 1.02, chord: 0.82, thickness: 0.05, y: -0.04 },
        { span: 4.18, zLE: 1.48, chord: 0.48, thickness: 0.038, y: 0.48 } // canted stealth wingtip fin
      ],
      primaryMat,
      0.01
    );
    group.add(stealthWing);

    // Dorsal flush stealth air intakes + gold heat-shield leading edge + glowing energy conduits + twin side plasma thrusters
    [-1, 1].forEach((side) => {
      // Flush dorsal stealth intake cowling
      const dorsalIntake = createSculptedFuselage(
        [
          [0.08, -1.1],
          [0.2, -0.65],
          [0.22, 0.75],
          [0.14, 1.85],
          [0.04, 2.2]
        ],
        darkMetalMat,
        12,
        1.15,
        0.55
      );
      dorsalIntake.position.set(side * 0.68, 0.19, 0.15);
      group.add(dorsalIntake);

      // Gold metallic leading-edge heat tile strip
      const goldEdge = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.052, 0.1), secondaryMat);
      goldEdge.position.set(side * 2.15, 0.015, -0.08);
      goldEdge.rotation.y = side * -0.64;
      group.add(goldEdge);

      // Violet/cyan glowing hypersonic energy conduit
      const energyBar = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.04, 0.065), accentMat);
      energyBar.position.set(side * 1.72, 0.052, 0.48);
      energyBar.rotation.y = side * -0.64;
      group.add(energyBar);

      // Side plasma vectoring thrusters
      const sideNozzle = createDetailedJetNozzle(0.24, 0.52, darkMetalMat, c.engine, 10);
      sideNozzle.position.set(side * 0.68, -0.02, 2.58);
      group.add(sideNozzle);

      const sideFlame = createAfterburnerFlame(c.engine, 0.94);
      sideFlame.position.set(side * 0.68, -0.02, 2.76);
      group.add(sideFlame);
      flames.push(sideFlame);
    });

    // Central dorsal energy spine & primary cyan hypersonic scramjet core
    const dorsalRidge = createSculptedFuselage(
      [
        [0.01, -0.35],
        [0.12, 0.45],
        [0.12, 1.85],
        [0.02, 2.55]
      ],
      accentMat,
      10,
      0.85,
      0.6
    );
    dorsalRidge.position.set(0, 0.28, 0);
    group.add(dorsalRidge);

    const centerNozzle = createDetailedJetNozzle(0.32, 0.6, darkMetalMat, 0x00f5d4, 14);
    centerNozzle.position.set(0, -0.02, 2.8);
    group.add(centerNozzle);

    const centerFlame = createAfterburnerFlame(0x00f5d4, 1.32);
    centerFlame.position.set(0, -0.02, 3.0);
    group.add(centerFlame);
    flames.push(centerFlame);

    // Flush futuristic cyan panoramic cockpit
    group.add(createDetailedCockpit(cockpitMat, secondaryMat, 0.98, 0.52, 3.05, 0.26, -1.28, true));
    addAviationLights(group, 4.18, 0.48, 1.72, [0, 0.22, 2.86], strobes);
  }

  // Apply aircraft-only sky IBL reflection map without affecting the surrounding biome
  if (envMap) {
    group.traverse((obj) => {
      if (obj.isMesh && obj.material && (obj.material.isMeshStandardMaterial || obj.material.isMeshPhysicalMaterial)) {
        obj.material.envMap = envMap;
        obj.material.needsUpdate = true;
      }
    });
  }

  group.userData.propellers = propellers;
  group.userData.flames = flames;
  group.userData.strobes = strobes;
  return group;
}

export function animatePlaneMesh(planeGroup, dt, time, boostFactor = 0) {
  if (!planeGroup) return;

  const props = planeGroup.userData.propellers || [];
  for (const p of props) {
    p.rotation.z += dt * (36 + boostFactor * 28);
  }

  const flames = planeGroup.userData.flames || [];
  for (let i = 0; i < flames.length; i++) {
    const f = flames[i];
    const pulse = 0.92 + Math.sin(time * 46 + i * 1.7) * 0.14 + boostFactor * 0.78;
    const width = 1 + boostFactor * 0.22 + Math.sin(time * 32 + i) * 0.04;
    f.scale.set(width, width, pulse);
  }

  // Realistic double-flash aviation strobe on tail
  const strobes = planeGroup.userData.strobes || [];
  if (strobes.length > 0) {
    const cycle = time % 1.4;
    const flash = (cycle < 0.09 || (cycle > 0.18 && cycle < 0.26)) ? 1.0 : 0.12;
    for (const s of strobes) {
      s.material.opacity = flash;
      const sc = 0.45 + flash * 0.42;
      s.scale.set(sc, sc, 1);
    }
  }
}
