import * as THREE from 'three';

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
    // Realistic teardrop LatheGeometry hot air balloon with burner glow & detailed basket
    const [c1, c2, c3] = BALLOON_PALETTES[Math.floor(Math.random() * BALLOON_PALETTES.length)];
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

    radius = 2.25;
    bobSpeed = 1.4;
    bobAmp = 0.6;
  } else if (type === 'zeppelin') {
    // Sleek modern aerodynamic airship with LatheGeometry hull, glass gondola & stabilizer fins
    const hullPts = [
      new THREE.Vector2(0.01, -4.2),
      new THREE.Vector2(0.85, -3.5),
      new THREE.Vector2(1.55, -2.2),
      new THREE.Vector2(1.85, -0.5),
      new THREE.Vector2(1.72, 1.4),
      new THREE.Vector2(1.15, 2.9),
      new THREE.Vector2(0.45, 3.85),
      new THREE.Vector2(0.01, 4.2)
    ];
    const hullGeo = new THREE.LatheGeometry(hullPts, 18);
    hullGeo.rotateX(Math.PI / 2);

    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.42, roughness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xd62828, metalness: 0.3, roughness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 });

    group.add(new THREE.Mesh(hullGeo, hullMat));

    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.87, 1.87, 0.72, 18), accentMat);
    band.rotation.x = Math.PI / 2;
    band.position.z = -0.35;
    group.add(band);

    // Aerodynamic passenger gondola with glowing windows
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 2.15), darkMat);
    gondola.position.set(0, -1.92, -0.2);
    group.add(gondola);

    const windows = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.22, 1.55),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
    );
    windows.position.set(0, -1.86, -0.25);
    group.add(windows);

    // 4 cruciform tail fins
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((rot) => {
      const finHolder = new THREE.Group();
      finHolder.rotation.z = rot;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.45, 1.45), accentMat);
      fin.position.set(0, 1.35, 3.05);
      fin.rotation.x = -0.25;
      finHolder.add(fin);
      group.add(finHolder);
    });

    radius = 2.35;
    bobSpeed = 1.1;
    bobAmp = 0.35;
  } else if (type === 'ring') {
    // High-tech rotating sky turbine hazard with angled blades & reactor core
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, metalness: 0.7, roughness: 0.28 });
    const dangerMat = new THREE.MeshStandardMaterial({
      color: 0xff3b5c,
      emissive: 0x9b1130,
      emissiveIntensity: 0.55,
      metalness: 0.45,
      roughness: 0.28
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd60a });

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.24, 10, 24), housingMat);
    group.add(outerRing);

    const innerGlow = new THREE.Mesh(new THREE.TorusGeometry(1.94, 0.08, 8, 24), dangerMat);
    group.add(innerGlow);

    // 4 angled turbine blades
    for (let i = 0; i < 4; i++) {
      const holder = new THREE.Group();
      holder.rotation.z = (i * Math.PI) / 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.85, 0.1), dangerMat);
      blade.position.y = 1.05;
      blade.rotation.y = 0.4;
      holder.add(blade);
      group.add(holder);
    }

    const hub = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 1), housingMat);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), coreMat);
    group.add(hub, core);

    radius = 2.2;
    spinSpeed = 2.2;
    bobAmp = 0.2;
  } else if (type === 'drone') {
    // Modern futuristic 4-rotor interceptor drone
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, metalness: 0.75, roughness: 0.25 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x00d9ff, emissive: 0x00a8cc, emissiveIntensity: 0.5 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });

    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.2, 0.58, 8), chassisMat);
    group.add(core);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 0.35), eyeMat);
    visor.position.set(0, 0.02, 1.02);
    group.add(visor);

    [[-1.65, -1.25], [1.65, -1.25], [-1.65, 1.25], [1.65, 1.25]].forEach(([rx, rz]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 1.9), chassisMat);
      arm.position.set(rx * 0.55, 0.05, rz * 0.55);
      arm.rotation.y = Math.atan2(rx, rz);
      group.add(arm);

      const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.09, 6, 16), trimMat);
      shroud.rotation.x = Math.PI / 2;
      shroud.position.set(rx, 0.16, rz);
      group.add(shroud);

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.58, 12),
        new THREE.MeshBasicMaterial({ color: 0x90e0ef, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(rx, 0.16, rz);
      group.add(disc);
    });

    radius = 2.05;
    bobSpeed = 2.6;
    bobAmp = 0.85;
  } else if (type === 'mine') {
    // Detailed metallic naval/sky mine with collar bands & glowing beacon spikes
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x262c38, metalness: 0.8, roughness: 0.26 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xff3b5c,
      emissive: 0xff1e42,
      emissiveIntensity: 0.8
    });

    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.42, 2), shellMat));

    const belt1 = new THREE.Mesh(new THREE.TorusGeometry(1.43, 0.1, 6, 20), bandMat);
    const belt2 = belt1.clone();
    belt2.rotation.x = Math.PI / 2;
    group.add(belt1, belt2);

    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
      [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0]
    ];
    for (const [dx, dy, dz] of dirs) {
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.45, 8), bandMat);
      base.position.copy(dir).multiplyScalar(1.48);
      base.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      group.add(base);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), glowMat);
      tip.position.copy(dir).multiplyScalar(1.82);
      group.add(tip);
    }

    radius = 2.0;
    spinSpeed = 1.35;
    bobAmp = 0.4;
  } else {
    // Organic sculpted asteroid / meteor rock with glowing crystal fissures
    const rockGeo = new THREE.IcosahedronGeometry(2.0, 2);
    const pos = rockGeo.attributes.position;
    const seed = Math.random() * 10;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const n =
        Math.sin(vx * 1.4 + seed) * Math.cos(vy * 1.3 - seed) * 0.24 +
        Math.sin((vx + vz) * 2.2) * 0.12;
      const sc = 1 + n;
      pos.setXYZ(i, vx * sc, vy * sc * 0.9, vz * sc);
    }
    rockGeo.computeVertexNormals();

    const rock = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({ color: 0x5c4d44, roughness: 0.92, metalness: 0.08, flatShading: true })
    );
    group.add(rock);

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xff595e,
      emissive: 0xd62828,
      emissiveIntensity: 0.7,
      flatShading: true
    });
    for (let c = 0; c < 3; c++) {
      const shard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.36, 1.3, 5), crystalMat);
      const a = (c / 3) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 1.25, 1.15, Math.sin(a) * 1.25);
      shard.rotation.z = Math.cos(a) * -0.5;
      shard.rotation.x = Math.sin(a) * 0.5;
      group.add(shard);
    }

    radius = 2.15;
    spinSpeed = 0.85;
    bobAmp = 0.3;
  }

  group.userData = {
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
