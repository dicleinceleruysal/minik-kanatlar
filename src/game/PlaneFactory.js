import * as THREE from 'three';

/**
 * Helper: Creates a sleek aerodynamic extruded wing/fin from 2D points in XZ plane.
 * Shape X -> world X (span), Shape Y -> world -Z (forward/back), extruded along Y (thickness).
 */
function createAirfoilMesh(points2D, thickness, material, bevel = 0.03) {
  const shape = new THREE.Shape();
  points2D.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8
  });
  // Rotate so extrusion thickness is along Y and shape lies flat in XZ
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -thickness * 0.5, 0);
  return new THREE.Mesh(geo, material);
}

/**
 * Helper: Creates a symmetric vertical fin from 2D points (X = forward/back, Y = height).
 */
function createVerticalFin(points2D, thickness, material, bevel = 0.02) {
  const shape = new THREE.Shape();
  points2D.forEach(([z, y], idx) => {
    if (idx === 0) shape.moveTo(z, y);
    else shape.lineTo(z, y);
  });
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2
  });
  // Shape X -> world Z, Shape Y -> world Y, depth -> world X
  geo.rotateY(-Math.PI / 2);
  geo.translate(thickness * 0.5, 0, 0);
  return new THREE.Mesh(geo, material);
}

/**
 * Helper: Smooth tapered fuselage using LatheGeometry along Z axis (nose at -Z, tail at +Z).
 */
function createFuselage(profilePoints, material, segments = 18, scaleX = 1, scaleY = 1) {
  const pts = profilePoints.map(([r, z]) => new THREE.Vector2(Math.max(0.001, r), z));
  const geo = new THREE.LatheGeometry(pts, segments);
  // Lathe revolves around Y; rotate +90deg around X so +Y becomes +Z (tail) and -Y becomes -Z (nose)
  geo.rotateX(Math.PI / 2);
  geo.scale(scaleX, scaleY, 1);
  return new THREE.Mesh(geo, material);
}

function createModernPropeller(bladeCount, radius, spinnerColor, bladeColor = 0x1b1f2a) {
  const propGroup = new THREE.Group();

  const spinner = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.44, 14),
    new THREE.MeshStandardMaterial({ color: spinnerColor, metalness: 0.72, roughness: 0.2 })
  );
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.1;
  propGroup.add(spinner);

  const bladeMat = new THREE.MeshStandardMaterial({ color: bladeColor, metalness: 0.55, roughness: 0.3 });
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xffd60a });

  for (let i = 0; i < bladeCount; i++) {
    const holder = new THREE.Group();
    const angle = (i * Math.PI * 2) / bladeCount;
    holder.rotation.z = angle;

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, radius, 0.025), bladeMat);
    blade.position.y = radius * 0.5;
    blade.rotation.y = 0.28; // aerodynamic pitch
    holder.add(blade);

    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.14, 0.028), tipMat);
    tip.position.y = radius * 0.94;
    tip.rotation.y = 0.28;
    holder.add(tip);

    propGroup.add(holder);
  }

  // Subtle spinning motion blur disc
  const disc = new THREE.Mesh(
    new THREE.RingGeometry(0.22, radius * 0.98, 24),
    new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  propGroup.add(disc);

  return propGroup;
}

function createJetNozzle(radius, length, metalMat, glowColor) {
  const nozzleGroup = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 1.12, length, 16, 1, true), metalMat);
  outer.rotation.x = Math.PI / 2;
  nozzleGroup.add(outer);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.85, radius * 0.1, 8, 16),
    new THREE.MeshBasicMaterial({ color: glowColor })
  );
  innerRing.position.z = length * 0.42;
  nozzleGroup.add(innerRing);

  return nozzleGroup;
}

function createAfterburnerFlame(color, scale = 1.0) {
  const flameGroup = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.26 * scale, 1.85 * scale, 12),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    })
  );
  outer.rotation.x = Math.PI / 2;
  outer.position.z = 0.92 * scale;
  flameGroup.add(outer);

  const mid = new THREE.Mesh(
    new THREE.ConeGeometry(0.17 * scale, 1.25 * scale, 10),
    new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    })
  );
  mid.rotation.x = Math.PI / 2;
  mid.position.z = 0.62 * scale;
  flameGroup.add(mid);

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.09 * scale, 0.72 * scale, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      depthWrite: false
    })
  );
  core.rotation.x = Math.PI / 2;
  core.position.z = 0.36 * scale;
  flameGroup.add(core);

  return flameGroup;
}

function createCockpitCanopy(cockpitMat, frameMat, sx, sy, sz, posY, posZ) {
  const canopyGroup = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), cockpitMat);
  glass.scale.set(sx, sy, sz);
  canopyGroup.add(glass);

  // Sleek cockpit frame arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.42 * sx, 0.025, 6, 14, Math.PI), frameMat);
  arch.position.set(0, 0, -0.05);
  canopyGroup.add(arch);

  // Pilot silhouette inside canopy
  const pilotHelmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.25 })
  );
  pilotHelmet.position.set(0, 0.04, -0.08);
  canopyGroup.add(pilotHelmet);

  canopyGroup.position.set(0, posY, posZ);
  return canopyGroup;
}

function addNavLights(group, x, y, z) {
  const geo = new THREE.SphereGeometry(0.085, 8, 8);
  const left = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff2e4c }));
  left.position.set(-x, y, z);
  const right = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00f59b }));
  right.position.set(x, y, z);
  group.add(left, right);
}

export function createPlaneMesh(planeConfig) {
  const group = new THREE.Group();
  const propellers = [];
  const flames = [];

  const c = planeConfig.colors;
  const level = planeConfig.level;

  const primaryMat = new THREE.MeshStandardMaterial({
    color: c.primary,
    metalness: 0.38 + level * 0.09,
    roughness: Math.max(0.16, 0.42 - level * 0.05)
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: c.secondary,
    metalness: 0.32 + level * 0.08,
    roughness: 0.28
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    metalness: 0.78,
    roughness: 0.28
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: c.accent,
    emissive: c.accent,
    emissiveIntensity: level >= 4 ? 0.7 : 0.22,
    metalness: 0.5,
    roughness: 0.22
  });
  const cockpitMat = new THREE.MeshPhysicalMaterial({
    color: c.cockpit,
    metalness: 0.18,
    roughness: 0.06,
    transparent: true,
    opacity: 0.82,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  if (level === 1) {
    // =========================================================================
    // LEVEL 1: CESUR KIRLANGIÇ — Modern Composite Sport / Aerobatic Prop Plane
    // =========================================================================
    const fuselage = createFuselage(
      [
        [0.01, -2.35],
        [0.24, -2.18],
        [0.42, -1.55],
        [0.46, -0.55],
        [0.41, 0.5],
        [0.28, 1.55],
        [0.14, 2.38],
        [0.01, 2.52]
      ],
      secondaryMat,
      18,
      0.95,
      1.05
    );
    group.add(fuselage);

    // Racing cowling & dorsal stripe
    const cowling = createFuselage(
      [
        [0.25, -2.19],
        [0.435, -1.55],
        [0.465, -0.8]
      ],
      primaryMat,
      18,
      0.97,
      1.06
    );
    group.add(cowling);

    // Tapered modern sport wings
    const mainWing = createAirfoilMesh(
      [
        [-2.85, -0.05],
        [-2.75, 0.32],
        [-0.35, 0.72],
        [0.35, 0.72],
        [2.75, 0.32],
        [2.85, -0.05],
        [0.4, -0.42],
        [-0.4, -0.42]
      ],
      0.11,
      primaryMat,
      0.03
    );
    mainWing.position.set(0, -0.1, -0.35);
    group.add(mainWing);

    // Wing racing accents + upturned winglets
    [-1, 1].forEach((side) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.125, 0.14), accentMat);
      stripe.position.set(side * 1.55, -0.1, -0.48);
      stripe.rotation.y = side * -0.08;
      group.add(stripe);

      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.32), secondaryMat);
      winglet.position.set(side * 2.86, 0.06, -0.25);
      winglet.rotation.z = side * -0.32;
      group.add(winglet);

      // Aerodynamic wheel fairing (landing gear spats)
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.14), darkMetalMat);
      strut.position.set(side * 0.62, -0.46, -0.78);
      strut.rotation.z = side * 0.25;
      group.add(strut);

      const fairing = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), primaryMat);
      fairing.scale.set(0.75, 0.85, 2.2);
      fairing.position.set(side * 0.72, -0.68, -0.78);
      group.add(fairing);
    });

    // Swept horizontal stabilizer
    const hTail = createAirfoilMesh(
      [
        [-1.12, -0.08],
        [-1.02, 0.2],
        [1.02, 0.2],
        [1.12, -0.08],
        [0.25, -0.32],
        [-0.25, -0.32]
      ],
      0.07,
      secondaryMat,
      0.02
    );
    hTail.position.set(0, 0.08, 2.08);
    group.add(hTail);

    // Sleek vertical tail fin
    const vTail = createVerticalFin(
      [
        [1.45, 0.15],
        [2.12, 1.15],
        [2.45, 1.15],
        [2.42, 0.05]
      ],
      0.08,
      primaryMat,
      0.02
    );
    group.add(vTail);

    // Bubble canopy
    group.add(createCockpitCanopy(cockpitMat, darkMetalMat, 0.85, 0.72, 2.15, 0.35, -0.15));

    // 3-blade modern carbon propeller
    const prop = createModernPropeller(3, 1.08, c.accent);
    prop.position.set(0, 0, -2.35);
    group.add(prop);
    propellers.push(prop);

    addNavLights(group, 2.9, 0.18, -0.25);
  } else if (level === 2) {
    // =========================================================================
    // LEVEL 2: RÜZGAR AVCISI — Modern Twin-Turboprop Racer w/ Canards & T-Tail
    // =========================================================================
    const fuselage = createFuselage(
      [
        [0.01, -2.95],
        [0.2, -2.55],
        [0.42, -1.75],
        [0.48, -0.65],
        [0.45, 0.65],
        [0.32, 1.75],
        [0.14, 2.65],
        [0.01, 2.85]
      ],
      secondaryMat,
      18,
      0.92,
      1.0
    );
    group.add(fuselage);

    // Metallic blue top aero shell
    const topBand = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 3.3), primaryMat);
    topBand.position.set(0, 0.42, 0.55);
    group.add(topBand);

    // Sleek front mustache canards (Piaggio Avanti style)
    const canard = createAirfoilMesh(
      [
        [-1.08, -0.12],
        [-1.02, 0.08],
        [1.02, 0.08],
        [1.08, -0.12],
        [0.25, -0.24],
        [-0.25, -0.24]
      ],
      0.06,
      accentMat,
      0.015
    );
    canard.position.set(0, -0.06, -2.15);
    group.add(canard);

    // High-aspect modern swept wings
    const mainWing = createAirfoilMesh(
      [
        [-3.25, -0.35],
        [-3.12, 0.02],
        [-0.45, 0.68],
        [0.45, 0.68],
        [3.12, 0.02],
        [3.25, -0.35],
        [0.45, -0.3],
        [-0.45, -0.3]
      ],
      0.1,
      primaryMat,
      0.025
    );
    mainWing.position.set(0, -0.04, 0.15);
    group.add(mainWing);

    // Twin sleek engine nacelles + 4-blade props + tall curved winglets
    [-1, 1].forEach((side) => {
      const nacelle = createFuselage(
        [
          [0.08, -1.05],
          [0.24, -0.75],
          [0.26, 0.2],
          [0.16, 0.85],
          [0.06, 1.05]
        ],
        darkMetalMat,
        14,
        1.0,
        1.0
      );
      nacelle.position.set(side * 1.38, -0.04, -0.15);
      group.add(nacelle);

      const accentRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 16), accentMat);
      accentRing.position.set(side * 1.38, -0.04, -0.72);
      group.add(accentRing);

      const prop = createModernPropeller(4, 0.86, c.accent);
      prop.position.set(side * 1.38, -0.04, -1.24);
      group.add(prop);
      propellers.push(prop);

      const winglet = createVerticalFin(
        [
          [-0.08, 0],
          [0.28, 0.62],
          [0.52, 0.62],
          [0.34, 0]
        ],
        0.05,
        accentMat,
        0.015
      );
      winglet.position.set(side * 3.18, -0.02, 0.12);
      winglet.rotation.z = side * -0.22;
      group.add(winglet);
    });

    // Swept T-Tail
    const vTail = createVerticalFin(
      [
        [1.55, 0.15],
        [2.28, 1.35],
        [2.72, 1.35],
        [2.58, 0.05]
      ],
      0.09,
      primaryMat,
      0.02
    );
    group.add(vTail);

    const tTailHoriz = createAirfoilMesh(
      [
        [-1.25, -0.2],
        [-1.15, 0.08],
        [1.15, 0.08],
        [1.25, -0.2],
        [0.25, -0.35],
        [-0.25, -0.35]
      ],
      0.065,
      secondaryMat,
      0.015
    );
    tTailHoriz.position.set(0, 1.32, 2.52);
    group.add(tTailHoriz);

    // Panoramic cockpit
    group.add(createCockpitCanopy(cockpitMat, darkMetalMat, 0.88, 0.64, 2.45, 0.34, -0.75));
    addNavLights(group, 3.28, 0.45, 0.38);
  } else if (level === 3) {
    // =========================================================================
    // LEVEL 3: ŞİMŞEK JET — Modern Supersonic Light Fighter / Tactical Jet
    // =========================================================================
    const fuselage = createFuselage(
      [
        [0.01, -3.55],
        [0.16, -2.95],
        [0.38, -2.0],
        [0.5, -0.7],
        [0.52, 0.7],
        [0.44, 1.85],
        [0.34, 2.45]
      ],
      secondaryMat,
      18,
      1.05,
      0.86
    );
    group.add(fuselage);

    // Sharp dorsal spine
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 3.0), primaryMat);
    spine.position.set(0, 0.36, 0.65);
    group.add(spine);

    // Trapezoidal swept jet wings with leading-edge root extensions (LERX)
    const mainWing = createAirfoilMesh(
      [
        [-3.05, -0.95],
        [-2.95, -0.42],
        [-0.65, 0.72],
        [-0.45, 1.55],
        [0.45, 1.55],
        [0.65, 0.72],
        [2.95, -0.42],
        [3.05, -0.95],
        [0.55, -0.98],
        [-0.55, -0.98]
      ],
      0.09,
      primaryMat,
      0.025
    );
    mainWing.position.set(0, -0.05, 0.25);
    group.add(mainWing);

    // Side air intakes + wingtip sensor rails
    [-1, 1].forEach((side) => {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 1.75), darkMetalMat);
      intake.position.set(side * 0.56, -0.08, -0.42);
      intake.rotation.y = side * 0.08;
      group.add(intake);

      const intakeLip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.14), accentMat);
      intakeLip.position.set(side * 0.58, -0.08, -1.28);
      group.add(intakeLip);

      // Wingtip missile/sensor pod rail
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.35, 8), accentMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * 3.02, -0.05, 0.92);
      group.add(rail);
    });

    // All-moving swept rear stabilators
    const hTail = createAirfoilMesh(
      [
        [-1.52, -0.42],
        [-1.4, -0.05],
        [1.4, -0.05],
        [1.52, -0.42],
        [0.36, -0.58],
        [-0.36, -0.58]
      ],
      0.07,
      secondaryMat,
      0.015
    );
    hTail.position.set(0, 0.0, 2.15);
    group.add(hTail);

    // Swept jet vertical stabilizer
    const vTail = createVerticalFin(
      [
        [1.15, 0.25],
        [2.22, 1.48],
        [2.68, 1.48],
        [2.48, 0.18]
      ],
      0.09,
      accentMat,
      0.02
    );
    group.add(vTail);

    // Single detailed afterburner nozzle + flame
    const nozzle = createJetNozzle(0.34, 0.58, darkMetalMat, c.engine);
    nozzle.position.set(0, -0.02, 2.58);
    group.add(nozzle);

    const flame = createAfterburnerFlame(c.engine, 1.12);
    flame.position.set(0, -0.02, 2.75);
    group.add(flame);
    flames.push(flame);

    // Long teardrop fighter canopy
    group.add(createCockpitCanopy(cockpitMat, darkMetalMat, 0.85, 0.65, 2.75, 0.34, -0.95));
    addNavLights(group, 3.04, -0.05, 0.92);
  } else if (level === 4) {
    // =========================================================================
    // LEVEL 4: FIRTINA KARTALI — 5th-Gen Twin-Tail Stealth Fighter (KAAN/F-22)
    // =========================================================================
    // Wide stealth chined fuselage
    const fuselage = createFuselage(
      [
        [0.01, -3.9],
        [0.24, -3.15],
        [0.58, -2.0],
        [0.82, -0.6],
        [0.86, 0.85],
        [0.74, 2.1],
        [0.58, 2.65]
      ],
      primaryMat,
      8, // faceted stealth cross-section
      1.12,
      0.56
    );
    group.add(fuselage);

    // Diamond stealth main wings
    const mainWing = createAirfoilMesh(
      [
        [-3.45, -1.05],
        [-3.32, -0.45],
        [-0.85, 1.05],
        [0.85, 1.05],
        [3.32, -0.45],
        [3.45, -1.05],
        [0.95, -1.35],
        [-0.95, -1.35]
      ],
      0.085,
      secondaryMat,
      0.02
    );
    mainWing.position.set(0, -0.04, 0.35);
    group.add(mainWing);

    // Glowing aero leading-edge accents + forward chine intakes + canted twin tails
    [-1, 1].forEach((side) => {
      // Glowing stealth accent line
      const accentBar = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.095, 0.12), accentMat);
      accentBar.position.set(side * 1.95, -0.02, 0.22);
      accentBar.rotation.y = side * -0.52;
      group.add(accentBar);

      // Caret stealth air intake
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 1.9), darkMetalMat);
      intake.position.set(side * 0.78, -0.06, -0.65);
      intake.rotation.y = side * 0.14;
      group.add(intake);

      // Canted twin vertical tails (signature 5th-gen look)
      const vTail = createVerticalFin(
        [
          [1.25, 0.1],
          [2.15, 1.38],
          [2.65, 1.38],
          [2.52, 0.05]
        ],
        0.075,
        primaryMat,
        0.018
      );
      vTail.position.set(side * 0.78, 0.08, 0.05);
      vTail.rotation.z = side * -0.36;
      group.add(vTail);

      // Twin vectoring nozzles & blue plasma flames
      const nozzle = createJetNozzle(0.28, 0.56, darkMetalMat, c.engine);
      nozzle.position.set(side * 0.42, -0.02, 2.72);
      group.add(nozzle);

      const flame = createAfterburnerFlame(c.engine, 1.02);
      flame.position.set(side * 0.42, -0.02, 2.88);
      group.add(flame);
      flames.push(flame);
    });

    // Stealth rear diamond stabilators
    const hTail = createAirfoilMesh(
      [
        [-1.88, -0.52],
        [-1.72, -0.08],
        [1.72, -0.08],
        [1.88, -0.52],
        [0.65, -0.78],
        [-0.65, -0.78]
      ],
      0.065,
      primaryMat,
      0.015
    );
    hTail.position.set(0, -0.02, 2.28);
    group.add(hTail);

    // Gold-tinted stealth radar canopy
    group.add(createCockpitCanopy(cockpitMat, darkMetalMat, 0.92, 0.62, 2.85, 0.34, -1.15));
    addNavLights(group, 3.42, -0.03, 1.15);
  } else {
    // =========================================================================
    // LEVEL 5: ANKA-X HAYALET — 6th-Gen Futuristic Hypersonic Blended-Wing Stealth
    // =========================================================================
    // Faceted stealth central core
    const core = createFuselage(
      [
        [0.01, -4.25],
        [0.34, -3.25],
        [0.78, -1.85],
        [1.05, -0.2],
        [1.02, 1.35],
        [0.72, 2.55],
        [0.35, 2.85]
      ],
      primaryMat,
      6,
      1.2,
      0.46
    );
    group.add(core);

    // Blended cranked-kite stealth wing (ultra-modern 6th gen silhouette)
    const stealthWing = createAirfoilMesh(
      [
        [-3.9, -1.35],
        [-3.75, -0.72],
        [-2.05, 0.55],
        [-1.15, 1.65],
        [0.0, 2.45],
        [1.15, 1.65],
        [2.05, 0.55],
        [3.75, -0.72],
        [3.9, -1.35],
        [2.15, -1.15],
        [1.15, -1.85],
        [0.0, -1.25],
        [-1.15, -1.85],
        [-2.15, -1.15]
      ],
      0.09,
      primaryMat,
      0.022
    );
    stealthWing.position.set(0, -0.04, 0.4);
    group.add(stealthWing);

    // Gold trim + glowing plasma veins + sleek wingtip stabilizer fins
    [-1, 1].forEach((side) => {
      // Gold leading edge strip
      const goldEdge = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.1, 0.12), secondaryMat);
      goldEdge.position.set(side * 2.15, -0.02, -0.05);
      goldEdge.rotation.y = side * -0.58;
      group.add(goldEdge);

      // Purple/cyan energy circuit strip
      const energyBar = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.11, 0.09), accentMat);
      energyBar.position.set(side * 1.65, 0.03, 0.45);
      energyBar.rotation.y = side * -0.58;
      group.add(energyBar);

      // Angled futuristic wingtip blades
      const tipFin = createVerticalFin(
        [
          [0.0, 0.0],
          [0.55, 0.72],
          [0.98, 0.72],
          [0.72, 0.0]
        ],
        0.055,
        secondaryMat,
        0.015
      );
      tipFin.position.set(side * 3.65, -0.02, 1.05);
      tipFin.rotation.z = side * -0.45;
      group.add(tipFin);

      // Side plasma thrusters
      const sideNozzle = createJetNozzle(0.24, 0.48, darkMetalMat, c.engine);
      sideNozzle.position.set(side * 0.66, -0.02, 2.52);
      group.add(sideNozzle);

      const sideFlame = createAfterburnerFlame(c.engine, 0.92);
      sideFlame.position.set(side * 0.66, -0.02, 2.66);
      group.add(sideFlame);
      flames.push(sideFlame);
    });

    // Central dorsal energy spine & primary cyan hypersonic core
    const dorsalRidge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 2.85), accentMat);
    dorsalRidge.position.set(0, 0.28, 0.75);
    group.add(dorsalRidge);

    const centerNozzle = createJetNozzle(0.32, 0.56, darkMetalMat, 0x00f5d4);
    centerNozzle.position.set(0, -0.02, 2.75);
    group.add(centerNozzle);

    const centerFlame = createAfterburnerFlame(0x00f5d4, 1.3);
    centerFlame.position.set(0, -0.02, 2.92);
    group.add(centerFlame);
    flames.push(centerFlame);

    // Flush futuristic cyan panoramic cockpit
    group.add(createCockpitCanopy(cockpitMat, secondaryMat, 1.05, 0.52, 3.15, 0.28, -1.25));
    addNavLights(group, 3.92, 0.42, 1.65);
  }

  group.userData.propellers = propellers;
  group.userData.flames = flames;
  return group;
}

export function animatePlaneMesh(planeGroup, dt, time, boostFactor = 0) {
  if (!planeGroup) return;
  const props = planeGroup.userData.propellers || [];
  for (const p of props) {
    p.rotation.z += dt * (34 + boostFactor * 26);
  }
  const flames = planeGroup.userData.flames || [];
  for (const f of flames) {
    const pulse = 0.92 + Math.sin(time * 42) * 0.16 + boostFactor * 0.72;
    f.scale.set(1 + boostFactor * 0.2, 1 + boostFactor * 0.2, pulse);
  }
}
