import * as THREE from 'three';

let cachedSmokeTex = null;
function getObstacleSmokeTexture() {
  if (cachedSmokeTex) return cachedSmokeTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const puffs = [
    [128, 128, 86, 0.56],
    [90, 120, 66, 0.46],
    [166, 124, 68, 0.46],
    [120, 90, 62, 0.42],
    [142, 154, 62, 0.4]
  ];
  for (const [x, y, r, alpha] of puffs) {
    const grad = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.55, `rgba(215, 210, 210, ${alpha * 0.5})`);
    grad.addColorStop(1, 'rgba(170, 165, 165, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  cachedSmokeTex = new THREE.CanvasTexture(canvas);
  return cachedSmokeTex;
}

const BALLOON_PALETTES = [
  [0xe63946, 0xf8f9fa, 0xffb703],
  [0x0077b6, 0x90e0ef, 0xffd166],
  [0xf77f00, 0xfcbf49, 0x2b2d42],
  [0x7209b7, 0xf72585, 0x4cc9f0],
  [0x2a9d8f, 0xe9c46a, 0x264653]
];

export function createObstacle(type) {
  const group = new THREE.Group();
  let radius = 2.2;
  let bobSpeed = 1.6;
  let bobAmp = 0.45;
  let spinSpeed = 0;

  if (type === 'balloon') {
    // Realistic teardrop LatheGeometry hot air balloon with varied sizes (small, medium, giant)
    const [c1, c2, c3] = BALLOON_PALETTES[Math.floor(Math.random() * BALLOON_PALETTES.length)];
    const balloonScale = 0.78 + Math.random() * 0.7;
    const envProfile = [
      new THREE.Vector2(0.45, -1.2),
      new THREE.Vector2(0.85, -0.5),
      new THREE.Vector2(1.55, 0.3),
      new THREE.Vector2(2.05, 1.15),
      new THREE.Vector2(2.15, 1.95),
      new THREE.Vector2(1.82, 2.7),
      new THREE.Vector2(1.1, 3.22),
      new THREE.Vector2(0.01, 3.45)
    ];
    const envGeo = new THREE.LatheGeometry(envProfile, 16);
    const pos = envGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const colA = new THREE.Color(c1);
    const colB = new THREE.Color(c2);
    const colC = new THREE.Color(c3);

    for (let i = 0; i < pos.count; i++) {
      const ang = Math.atan2(pos.getZ(i), pos.getX(i));
      const y = pos.getY(i);
      const stripe = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 12) % 2 === 0;
      const chosen = y > 1.0 && y < 1.65 ? colC : stripe ? colA : colB;
      cols[i * 3] = chosen.r;
      cols[i * 3 + 1] = chosen.g;
      cols[i * 3 + 2] = chosen.b;
    }
    envGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

    const envelope = new THREE.Mesh(
      envGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 })
    );
    envelope.position.y = -0.7;
    group.add(envelope);

    // Burner glow under throat
    const burner = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9f1c })
    );
    burner.position.y = -2.0;
    group.add(burner);

    // Wicker basket + rim
    const basketMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.88 });
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.85, 1.05), basketMat);
    basket.position.y = -2.9;
    group.add(basket);

    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.14, 1.16),
      new THREE.MeshStandardMaterial({ color: 0x5c3615, roughness: 0.85 })
    );
    rim.position.y = -2.46;
    group.add(rim);

    // 4 suspension cables
    const ropeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].forEach(([rx, rz]) => {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 5), ropeMat);
      rope.position.set(rx, -2.08, rz);
      group.add(rope);
    });

    group.scale.setScalar(balloonScale);
    radius = 2.15 * balloonScale;
    bobSpeed = 1.1 + (1.5 - balloonScale) * 0.5;
    bobAmp = 0.55;
  } else if (type === 'canyonPillar') {
    // Realistic sandstone canyon spire / hoodoo rising from the canyon floor
    const pillarHeight = 52;
    const baseR = 2.6 + Math.random() * 1.1;
    const geo = new THREE.CylinderGeometry(baseR * 0.52, baseR * 1.15, pillarHeight, 10, 8);
    // Position so top of pillar is at local y = 0, extending down to -52
    geo.translate(0, -pillarHeight * 0.5, 0);

    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cDark = new THREE.Color(0x6e4f3d);
    const cMid = new THREE.Color(0x9c664a);
    const cLight = new THREE.Color(0xc49574);
    const tmp = new THREE.Color();
    const seed = Math.random() * 10;

    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      let vy = pos.getY(i);
      let vz = pos.getZ(i);
      const hNorm = (vy + pillarHeight) / pillarHeight;
      const ledge = Math.sin(hNorm * Math.PI * 7) * 0.14;
      const rough = Math.sin(vx * 0.9 + vy * 0.2 + seed) * 0.14;
      vx *= 1 + ledge + rough;
      vz *= 1 + ledge + rough;
      pos.setXYZ(i, vx, vy, vz);

      if (hNorm < 0.4) tmp.copy(cDark).lerp(cMid, hNorm / 0.4);
      else if (hNorm < 0.78) tmp.copy(cMid).lerp(cLight, (hNorm - 0.4) / 0.38);
      else tmp.copy(cLight).lerp(cDark, ((hNorm - 0.78) / 0.22) * 0.4);
      cols[i * 3] = tmp.r;
      cols[i * 3 + 1] = tmp.g;
      cols[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();

    const spire = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })
    );
    group.add(spire);

    // Balancing sandstone cap rock (classic hoodoo silhouette)
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(baseR * 0.78, baseR * 0.58, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xb5815f, roughness: 0.94, flatShading: true })
    );
    cap.position.y = 0.7;
    group.add(cap);

    radius = baseR * 0.85;
    bobSpeed = 0;
    bobAmp = 0;
    group.userData.isPillar = true;
  } else if (type === 'eagle') {
    // Soaring 3D Golden Canyon Eagle with animated flapping wings
    const featherMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.82, flatShading: true });
    const lightFeatherMat = new THREE.MeshStandardMaterial({ color: 0x8c6239, roughness: 0.82, flatShading: true });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.75 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), featherMat);
    body.scale.set(0.85, 0.75, 2.2);
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), headMat);
    head.position.set(0, 0.2, 1.32);
    group.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.52, 6), beakMat);
    beak.rotation.x = Math.PI / 2 + 0.18;
    beak.position.set(0, 0.1, 1.78);
    group.add(beak);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.95), lightFeatherMat);
    tail.position.set(0, 0.05, -1.45);
    group.add(tail);

    const wings = [];
    [-1, 1].forEach((side) => {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.42, 0.12, 0.15);

      const innerWing = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 1.05), featherMat);
      innerWing.position.set(side * 0.85, 0, -0.05);
      wingPivot.add(innerWing);

      const outerWing = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.75), lightFeatherMat);
      outerWing.position.set(side * 2.25, 0.04, -0.18);
      outerWing.rotation.y = side * -0.25;
      wingPivot.add(outerWing);

      wingPivot.userData.side = side;
      group.add(wingPivot);
      wings.push(wingPivot);
    });

    const eagleScale = 0.95 + Math.random() * 0.35;
    group.scale.setScalar(eagleScale);
    group.userData.wings = wings;
    radius = 1.95 * eagleScale;
    bobSpeed = 2.4;
    bobAmp = 0.9;
  } else if (type === 'seagull') {
    // Graceful white & slate-grey tropical seabird / albatross with flapping wings
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
    const greyMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), whiteMat);
    body.scale.set(0.78, 0.72, 2.3);
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), whiteMat);
    head.position.set(0, 0.16, 1.25);
    group.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.52, 6), beakMat);
    beak.rotation.x = Math.PI / 2 + 0.08;
    beak.position.set(0, 0.12, 1.68);
    group.add(beak);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.85), whiteMat);
    tail.position.set(0, 0.05, -1.4);
    group.add(tail);

    const wings = [];
    [-1, 1].forEach((side) => {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.36, 0.12, 0.12);

      const inner = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.82), greyMat);
      inner.position.set(side * 0.82, 0, -0.05);
      wingPivot.add(inner);

      const outer = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.56), tipMat);
      outer.position.set(side * 2.15, 0.03, -0.18);
      outer.rotation.y = side * -0.28;
      wingPivot.add(outer);

      wingPivot.userData.side = side;
      group.add(wingPivot);
      wings.push(wingPivot);
    });

    const birdScale = 0.95 + Math.random() * 0.35;
    group.scale.setScalar(birdScale);
    group.userData.wings = wings;
    radius = 1.85 * birdScale;
    bobSpeed = 2.1;
    bobAmp = 0.85;
  } else if (type === 'paraglider') {
    // Realistic ram-air paraglider with curved crescent airfoil wing, V-riser lines & seated pilot in harness
    const canopies = [
      [0x0096c7, 0xf8fafc, 0xffb703],
      [0xe63946, 0xf8fafc, 0x1d3557],
      [0x2a9d8f, 0xf4f1de, 0xe76f51],
      [0xf77f00, 0xf8fafc, 0x2b2d42],
      [0x7209b7, 0x4cc9f0, 0xf8fafc]
    ];
    const [cMain, cLight, cTip] = canopies[Math.floor(Math.random() * canopies.length)];

    // Sculpted curved crescent airfoil wing (single smooth vertex-colored mesh)
    const spanSegs = 22;
    const chordSegs = 6;
    const wingGeo = new THREE.PlaneGeometry(5.6, 1.85, spanSegs, chordSegs);
    wingGeo.rotateX(-Math.PI / 2);
    const wPos = wingGeo.attributes.position;
    const wCols = new Float32Array(wPos.count * 3);
    const colMain = new THREE.Color(cMain);
    const colLight = new THREE.Color(cLight);
    const colTip = new THREE.Color(cTip);
    const tmpC = new THREE.Color();

    for (let i = 0; i < wPos.count; i++) {
      let x = wPos.getX(i); // -2.8 .. 2.8
      let z = wPos.getZ(i); // -0.925 .. 0.925
      const u = x / 2.8; // -1 .. 1 (spanwise)
      const v = z / 0.925; // -1 .. 1 (chordwise: -1 leading edge, +1 trailing edge)

      // Tapered elliptical wingtip chord
      const chordTaper = Math.sqrt(Math.max(0.14, 1 - u * u * 0.82));
      z *= chordTaper;
      // Slight crescent sweep back toward tips
      z += u * u * 0.42;

      // Graceful paraglider arch + inflated airfoil camber + subtle cell ribs
      const archY = Math.cos(u * 1.15) * 1.35 + 1.3;
      const camber = Math.cos(v * Math.PI * 0.5) * 0.24 * chordTaper;
      const cellPuff = Math.abs(Math.sin(u * Math.PI * 6)) * 0.05;
      const y = archY + camber + cellPuff;

      wPos.setXYZ(i, x, y, z);

      // Realistic striped paraglider canopy pattern
      const absU = Math.abs(u);
      if (absU > 0.72) tmpC.copy(colTip);
      else if (v < -0.32) tmpC.copy(colMain);
      else if (absU < 0.28) tmpC.copy(colLight);
      else tmpC.copy(colMain).lerp(colLight, 0.25);

      wCols[i * 3] = tmpC.r;
      wCols[i * 3 + 1] = tmpC.g;
      wCols[i * 3 + 2] = tmpC.b;
    }
    wingGeo.setAttribute('color', new THREE.BufferAttribute(wCols, 3));
    wingGeo.computeVertexNormals();

    const wingMesh = new THREE.Mesh(
      wingGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.48,
        metalness: 0.04,
        side: THREE.DoubleSide
      })
    );
    group.add(wingMesh);

    // Fine realistic suspension lines converging from wing arch to pilot risers
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.78 });
    const anchorPoints = [
      [-2.35, 1.82, 0.12, -0.26],
      [-1.55, 2.38, -0.22, -0.26],
      [-1.55, 2.38, 0.26, -0.26],
      [-0.65, 2.74, -0.25, -0.22],
      [0.65, 2.74, -0.25, 0.22],
      [1.55, 2.38, -0.22, 0.26],
      [1.55, 2.38, 0.26, 0.26],
      [2.35, 1.82, 0.12, 0.26]
    ];
    for (const [wx, wy, wz, px] of anchorPoints) {
      const targetY = -0.82;
      const targetZ = 0.05;
      const dx = px - wx;
      const dy = targetY - wy;
      const dz = targetZ - wz;
      const len = Math.hypot(dx, dy, dz);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 4), lineMat);
      line.position.set((wx + px) * 0.5, (wy + targetY) * 0.5, (wz + targetZ) * 0.5);
      line.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(dx, dy, dz).normalize()
      );
      group.add(line);
    }

    // Realistic seated 3D paraglider pilot with harness pod, visor helmet & raised arms on brake toggles
    const harnessMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: cMain, roughness: 0.58 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.22 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.12 });

    // Harness seat pod behind/under pilot
    const harness = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), harnessMat);
    harness.scale.set(0.95, 1.2, 1.35);
    harness.position.set(0, -1.52, -0.14);
    group.add(harness);

    // Pilot torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.72, 10), jacketMat);
    torso.position.set(0, -1.24, 0.02);
    torso.rotation.x = 0.18;
    group.add(torso);

    // Helmet + dark ski/flight visor
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), helmetMat);
    helmet.position.set(0, -0.72, 0.08);
    group.add(helmet);

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), visorMat);
    visor.scale.set(0.95, 0.55, 0.65);
    visor.position.set(0, -0.72, 0.22);
    group.add(visor);

    // Raised arms holding brake lines
    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.58, 6), jacketMat);
      arm.position.set(side * 0.28, -0.94, 0.08);
      arm.rotation.z = side * -0.45;
      group.add(arm);

      // Bent seated legs + boots
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.52, 6), pantsMat);
      thigh.position.set(side * 0.14, -1.66, 0.24);
      thigh.rotation.x = Math.PI / 2 - 0.25;
      group.add(thigh);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.52, 6), pantsMat);
      shin.position.set(side * 0.14, -1.94, 0.44);
      shin.rotation.x = 0.15;
      group.add(shin);
    });

    const pScale = 0.88 + Math.random() * 0.34;
    const driftDir = Math.random() < 0.5 ? 1 : -1; // +1: left-to-right, -1: right-to-left
    group.scale.setScalar(pScale);
    // Face the cross-wind gliding direction (angled slightly so 3D wing & pilot look great)
    group.rotation.y = driftDir > 0 ? Math.PI * 0.44 : -Math.PI * 0.44;

    group.userData.driftDir = driftDir;
    group.userData.driftSpeed = 6.5 + Math.random() * 5.0;
    group.userData.swayAmp = 0.09;
    radius = 2.05 * pScale;
    bobSpeed = 1.4;
    bobAmp = 0.55;
  } else if (type === 'arcticTower') {
    // Realistic red-and-white Arctic Weather & Radar Tower rising from the snowy tundra
    const redMat = new THREE.MeshStandardMaterial({ color: 0xd62828, metalness: 0.35, roughness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.25, roughness: 0.38 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.35 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a44 });

    // Segmented red & white steel lattice mast (4 corner legs + horizontal rings)
    const totalH = 52;
    const sections = 6;
    const secH = totalH / sections;
    for (let s = 0; s < sections; s++) {
      const yTop = -s * secH;
      const yBot = -(s + 1) * secH;
      const rTop = 0.85 + s * 0.22;
      const rBot = 0.85 + (s + 1) * 0.22;
      const mat = s % 2 === 0 ? redMat : whiteMat;

      // 4 angled steel legs per section
      for (let c = 0; c < 4; c++) {
        const a = (c * Math.PI) / 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, secH + 0.2, 5), mat);
        leg.position.set(
          Math.cos(a) * ((rTop + rBot) * 0.5),
          (yTop + yBot) * 0.5,
          Math.sin(a) * ((rTop + rBot) * 0.5)
        );
        group.add(leg);
      }

      // Horizontal structural ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rTop, 0.09, 5, 8), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = yTop;
      group.add(ring);
    }

    // Upper observation & instrument deck
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.3, 0.55, 10), darkMat);
    deck.position.y = 0.2;
    group.add(deck);

    // Spinning polar radar dish & weather vane on top
    const radarGroup = new THREE.Group();
    radarGroup.position.y = 1.4;

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.1, 8), whiteMat);
    pedestal.position.y = -0.4;
    radarGroup.add(pedestal);

    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
      whiteMat
    );
    dish.rotation.x = Math.PI * 0.42;
    dish.position.set(0, 0.35, 0.35);
    radarGroup.add(dish);

    const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 6), redMat);
    feedHorn.rotation.x = Math.PI / 2;
    feedHorn.position.set(0, 0.35, 0.95);
    radarGroup.add(feedHorn);

    group.add(radarGroup);

    // Bright red aviation warning beacon above the tower
    const mastTip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.8, 6), redMat);
    mastTip.position.set(-1.1, 1.2, 0);
    group.add(mastTip);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), beaconMat);
    beacon.position.set(-1.1, 2.2, 0);
    group.add(beacon);

    group.userData.topRotor = radarGroup;
    group.userData.topRotorSpeed = 1.8;
    group.userData.isPillar = true;
    radius = 2.05;
    bobSpeed = 0;
    bobAmp = 0;
  } else if (type === 'arcticHeli') {
    // Realistic red-and-white Polar Research / Rescue Helicopter gliding across the valley
    const redMat = new THREE.MeshStandardMaterial({ color: 0xd62828, metalness: 0.35, roughness: 0.32 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.25, roughness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      metalness: 0.2,
      roughness: 0.08,
      transparent: true,
      opacity: 0.82
    });

    // Rounded helicopter cabin fuselage
    const cabin = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), redMat);
    cabin.scale.set(0.95, 0.9, 1.75);
    group.add(cabin);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.34, 1.6), whiteMat);
    stripe.position.set(0, -0.05, -0.1);
    group.add(stripe);

    // Panoramic nose cockpit glass
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.88, 12, 10), glassMat);
    canopy.scale.set(0.92, 0.78, 1.15);
    canopy.position.set(0, 0.12, 0.95);
    group.add(canopy);

    // Tail boom & vertical fin
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.36, 3.1, 8), redMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.16, -2.5);
    group.add(boom);

    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.75), whiteMat);
    tailFin.position.set(0, 0.55, -3.95);
    tailFin.rotation.x = -0.25;
    group.add(tailFin);

    // Landing skids
    [-0.78, 0.78].forEach((sx) => {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 6), darkMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -1.12, 0.1);
      group.add(skid);

      [-0.65, 0.75].forEach((sz) => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.65, 6), darkMat);
        strut.position.set(sx * 0.85, -0.82, sz);
        strut.rotation.z = sx > 0 ? -0.35 : 0.35;
        group.add(strut);
      });
    });

    // Main spinning overhead rotor
    const topRotor = new THREE.Group();
    topRotor.position.set(0, 1.18, 0.05);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.42, 8), darkMat);
    mast.position.y = -0.15;
    topRotor.add(mast);

    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 4.8), darkMat);
      blade.rotation.y = (i * Math.PI) / 2;
      topRotor.add(blade);
    }
    group.add(topRotor);

    const hScale = 0.82 + Math.random() * 0.22;
    const driftDir = Math.random() < 0.5 ? 1 : -1;
    group.scale.setScalar(hScale);
    group.rotation.y = driftDir > 0 ? Math.PI * 0.46 : -Math.PI * 0.46;

    group.userData.topRotor = topRotor;
    group.userData.driftDir = driftDir;
    group.userData.driftSpeed = 8.5 + Math.random() * 5.5;
    group.userData.swayAmp = 0.04;
    radius = 2.1 * hScale;
    bobSpeed = 1.8;
    bobAmp = 0.35;
  } else if (type === 'stormCloud') {
    // Realistic dark billowing 3D Thundercloud / Hail Storm Cloud with glowing 3D lightning bolt
    const darkCloudMat = new THREE.MeshStandardMaterial({
      color: 0x3b4859,
      emissive: 0x16202e,
      emissiveIntensity: 0.35,
      roughness: 0.94
    });
    const midCloudMat = new THREE.MeshStandardMaterial({
      color: 0x526278,
      emissive: 0x1d2a3d,
      emissiveIntensity: 0.25,
      roughness: 0.92
    });

    const puffs = [
      [0, 0.5, 0, 1.85, 1.3, 1.55, darkCloudMat],
      [-1.55, 0.15, 0.25, 1.45, 1.05, 1.25, midCloudMat],
      [1.55, 0.2, -0.2, 1.5, 1.08, 1.28, midCloudMat],
      [-0.75, 1.1, -0.35, 1.35, 1.0, 1.2, midCloudMat],
      [0.85, 1.05, 0.3, 1.3, 0.95, 1.15, darkCloudMat],
      [0, -0.35, 0, 1.7, 0.8, 1.3, darkCloudMat]
    ];
    for (const [px, py, pz, sx, sy, sz, mat] of puffs) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
      puff.position.set(px, py, pz);
      puff.scale.set(sx, sy, sz);
      group.add(puff);
    }

    // Glowing 3D jagged lightning bolt beneath the storm cloud
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xfff07c });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.35, 0.24), boltMat);
    b1.position.set(0.18, -1.25, 0.15);
    b1.rotation.z = -0.35;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), boltMat);
    b2.position.set(-0.08, -2.15, 0.15);
    b2.rotation.z = 0.42;
    const b3 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.05, 5), boltMat);
    b3.position.set(0.12, -2.95, 0.15);
    b3.rotation.z = Math.PI - 0.28;
    group.add(b1, b2, b3);

    // Subtle electric blue core glow inside the cloud
    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.24 })
    );
    innerGlow.position.set(0, -0.3, 0);
    group.add(innerGlow);

    radius = 2.35;
    bobSpeed = 1.2;
    bobAmp = 0.45;
  } else if (type === 'lavaBomb') {
    // Realistic smooth-shaded basalt volcanic bomb with glowing magma cracks & soft volumetric smoke trail
    const smokeTex = getObstacleSmokeTexture();
    const rockGeo = new THREE.IcosahedronGeometry(1.72, 3);
    const pos = rockGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cCrust = new THREE.Color(0x241f21);
    const cAsh = new THREE.Color(0x453c3e);
    const cLava = new THREE.Color(0xe85d04);
    const cHot = new THREE.Color(0xffc300);
    const tmp = new THREE.Color();
    const seed = Math.random() * 10;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const n =
        Math.sin(vx * 1.9 + seed) * Math.cos(vy * 1.8 - seed) * 0.22 +
        Math.sin((vx + vz) * 2.9) * 0.12;
      const sc = 1 + n;
      pos.setXYZ(i, vx * sc, vy * sc * 0.88, vz * sc);

      if (n < -0.16) tmp.copy(cHot);
      else if (n < -0.06) tmp.copy(cLava);
      else if (n > 0.14) tmp.copy(cAsh);
      else tmp.copy(cCrust);
      cols[i * 3] = tmp.r;
      cols[i * 3 + 1] = tmp.g;
      cols[i * 3 + 2] = tmp.b;
    }
    rockGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    rockGeo.computeVertexNormals();

    const boulder = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: 0x6e1a00,
        emissiveIntensity: 0.35,
        roughness: 0.9
      })
    );
    group.add(boulder);

    // Soft volumetric fire & dark smoke sprite trail
    for (let t = 0; t < 4; t++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: smokeTex,
          color: t === 0 ? 0xff7b29 : 0x453b3d,
          transparent: true,
          opacity: t === 0 ? 0.65 : 0.52 - t * 0.1,
          depthWrite: false
        })
      );
      const sc = 2.8 + t * 0.7;
      sp.scale.set(sc, sc, 1);
      sp.position.set(0, 0.25 + t * 0.4, -1.2 - t * 1.25);
      group.add(sp);
    }

    radius = 1.95;
    spinSpeed = 1.05;
    bobSpeed = 1.5;
    bobAmp = 0.5;
  } else if (type === 'ashCloud') {
    // Realistic soft volumetric Pyroclastic Volcanic Ash Cloud (layered smoke sprites, zero boxy spheres!)
    const smokeTex = getObstacleSmokeTexture();
    const layers = [
      [0, 0.4, 0, 6.2, 4.4, 0x3a3234, 0.92],
      [-1.7, 0.0, 0.3, 4.8, 3.6, 0x4d4346, 0.86],
      [1.7, 0.1, -0.2, 5.0, 3.8, 0x4d4346, 0.86],
      [0, 1.2, -0.3, 4.6, 3.5, 0x63585b, 0.78],
      [0, -0.8, 0.4, 4.4, 2.8, 0xc84b18, 0.58] // warm lava under-glow on belly of cloud
    ];
    for (const [lx, ly, lz, sx, sy, col, op] of layers) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: smokeTex,
          color: col,
          transparent: true,
          opacity: op,
          depthWrite: false
        })
      );
      sp.position.set(lx, ly, lz);
      sp.scale.set(sx, sy, 1);
      group.add(sp);
    }

    radius = 2.35;
    bobSpeed = 1.1;
    bobAmp = 0.4;
  } else if (type === 'volcanicPlume') {
    // Realistic rising volcanic ash & smoke column built from soft layered volumetric smoke sprites
    const smokeTex = getObstacleSmokeTexture();
    for (let s = 0; s < 14; s++) {
      const y = -s * 3.8;
      const isHotBase = s > 9;
      const col = isHotBase ? 0xd9531e : s % 2 === 0 ? 0x3b3336 : 0x52484a;
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: smokeTex,
          color: col,
          transparent: true,
          opacity: isHotBase ? 0.78 : 0.88,
          depthWrite: false
        })
      );
      const sc = 5.4 + (s < 3 ? 1.2 : 0) + (s % 2) * 0.6;
      sp.scale.set(sc * 1.1, sc, 1);
      sp.position.set(Math.sin(s * 0.85) * 0.85, y, Math.cos(s * 0.75) * 0.6);
      group.add(sp);
    }

    // Broad drifting mushroom cap at top of plume
    [[-1.8, 0.8, 0.2, 5.6], [1.8, 0.6, -0.2, 5.4], [0, 1.5, 0, 6.2]].forEach(([cx, cy, cz, sc]) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: smokeTex,
          color: 0x594f52,
          transparent: true,
          opacity: 0.82,
          depthWrite: false
        })
      );
      sp.scale.set(sc * 1.2, sc * 0.85, 1);
      sp.position.set(cx, cy, cz);
      group.add(sp);
    });

    group.userData.isPillar = true;
    radius = 2.2;
    bobSpeed = 0;
    bobAmp = 0;
  } else if (type === 'fjordLighthouse') {
    // Realistic Nordic Fjord Lighthouse rising from the polar sea with rotating warm light beams
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.65 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xb8292f, roughness: 0.58 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe899,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const segH = 10.5;
    for (let s = 0; s < 5; s++) {
      const rTop = 1.2 + s * 0.26;
      const rBot = 1.46 + s * 0.26;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, segH, 14),
        s % 2 === 0 ? redMat : whiteMat
      );
      seg.position.y = -segH * 0.5 - s * segH;
      group.add(seg);
    }

    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.42, 0.52, 14), darkMat);
    gallery.position.y = 0.25;
    group.add(gallery);

    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 14), lampMat);
    lantern.position.y = 1.35;
    group.add(lantern);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.38, 1.45, 14), redMat);
    roof.position.y = 2.95;
    group.add(roof);

    // Rotating twin warm lighthouse light cones cutting through the Nordic aurora night
    const beamGroup = new THREE.Group();
    beamGroup.position.y = 1.35;
    [-1, 1].forEach((dir) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 13, 12, 1, true), beamMat);
      cone.rotation.z = dir * (Math.PI / 2);
      cone.position.x = dir * 7.2;
      beamGroup.add(cone);
    });
    group.add(beamGroup);

    group.userData.topRotor = beamGroup;
    group.userData.topRotorSpeed = 1.4;
    group.userData.isPillar = true;
    radius = 2.0;
    bobSpeed = 0;
    bobAmp = 0;
  } else if (type === 'seaplane') {
    // Realistic Nordic Fjord Floatplane (yellow & navy bush seaplane with twin pontoons) gliding across the fjord
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf4b41a, metalness: 0.3, roughness: 0.35 });
    const navyMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, metalness: 0.35, roughness: 0.38 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.65, roughness: 0.3 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      roughness: 0.1,
      transparent: true,
      opacity: 0.82
    });

    // Fuselage
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.24, 3.6, 12), yellowMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.85, 12), navyMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 2.2;
    group.add(nose);

    // High bush-plane wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 1.05), yellowMat);
    wing.position.set(0, 0.42, 0.35);
    group.add(wing);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.22, 0.15, 0.24), navyMat);
    stripe.position.set(0, 0.43, 0.65);
    group.add(stripe);

    // Tail fins
    const hTail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.09, 0.55), yellowMat);
    hTail.position.set(0, 0.15, -1.65);
    const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.72), navyMat);
    vTail.position.set(0, 0.55, -1.62);
    group.add(hTail, vTail);

    // Cockpit windshield
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.44, 0.95), glassMat);
    cockpit.position.set(0, 0.28, 0.85);
    group.add(cockpit);

    // Twin seaplane floats (pontoons) underneath
    [-0.78, 0.78].forEach((px) => {
      const pontoon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.85, 8), silverMat);
      pontoon.rotation.x = Math.PI / 2;
      pontoon.position.set(px, -0.95, 0.35);
      group.add(pontoon);

      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.16), navyMat);
      strut.position.set(px * 0.75, -0.52, 0.55);
      strut.rotation.z = px > 0 ? -0.32 : 0.32;
      group.add(strut);
    });

    // Front spinning propeller
    const prop = new THREE.Group();
    prop.position.set(0, 0, 2.65);
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.11, 0.04), navyMat);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.45, 0.04), navyMat);
    prop.add(b1, b2);
    group.add(prop);

    // Warm landing headlight + red/green wingtip nav lights
    const headlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
    );
    headlight.position.set(0, -0.1, 2.6);
    group.add(headlight);

    const driftDir = Math.random() < 0.5 ? 1 : -1;
    const sScale = 0.85 + Math.random() * 0.22;
    group.scale.setScalar(sScale);
    group.rotation.y = driftDir > 0 ? Math.PI * 0.45 : -Math.PI * 0.45;

    group.userData.rotor = prop;
    group.userData.driftDir = driftDir;
    group.userData.driftSpeed = 9.0 + Math.random() * 5.0;
    group.userData.swayAmp = 0.05;
    radius = 2.05 * sScale;
    bobSpeed = 1.4;
    bobAmp = 0.4;
  } else if (type === 'auroraStorm') {
    // Realistic soft volumetric Polar Night Cloud infused with emerald-teal aurora luminescence
    const smokeTex = getObstacleSmokeTexture();
    const layers = [
      [0, 0.35, 0, 6.2, 4.3, 0x1b3452, 0.9],
      [-1.7, 0.0, 0.3, 4.9, 3.6, 0x26486e, 0.84],
      [1.7, 0.1, -0.2, 5.0, 3.7, 0x26486e, 0.84],
      [0, 1.25, -0.2, 4.8, 3.4, 0x2ec4b6, 0.52], // Emerald-teal aurora glow on upper rim
      [0, -0.45, 0.35, 4.2, 2.7, 0x72efdd, 0.42]
    ];
    for (const [lx, ly, lz, sx, sy, col, op] of layers) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: smokeTex,
          color: col,
          transparent: true,
          opacity: op,
          depthWrite: false
        })
      );
      sp.position.set(lx, ly, lz);
      sp.scale.set(sx, sy, 1);
      group.add(sp);
    }

    radius = 2.35;
    bobSpeed = 1.1;
    bobAmp = 0.42;
  }

  group.userData = {
    ...group.userData,
    type,
    collisionRadius: radius,
    bobSpeed,
    bobAmp,
    spinSpeed,
    phase: Math.random() * Math.PI * 2,
    baseY: 0,
    hit: false
  };

  return group;
}
