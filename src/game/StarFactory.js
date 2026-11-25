import * as THREE from 'three';

let cachedStarGeometry = null;
let cachedStarMaterial = null;
let cachedHaloMaterial = null;
let cachedHaloGeometry = null;

function getStarAssets() {
  if (!cachedStarGeometry) {
    const shape = new THREE.Shape();
    const spikes = 5;
    const outerRadius = 1.05;
    const innerRadius = 0.46;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    cachedStarGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.08,
      bevelSegments: 2
    });
    cachedStarGeometry.center();

    cachedStarMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd60a,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.65,
      metalness: 0.68,
      roughness: 0.18
    });

    cachedHaloGeometry = new THREE.RingGeometry(1.15, 1.38, 24);
    cachedHaloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe66d,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide
    });
  }
  return {
    starGeo: cachedStarGeometry,
    starMat: cachedStarMaterial,
    haloGeo: cachedHaloGeometry,
    haloMat: cachedHaloMaterial
  };
}

export function createStarMesh() {
  const { starGeo, starMat, haloGeo, haloMat } = getStarAssets();
  const group = new THREE.Group();

  const star = new THREE.Mesh(starGeo, starMat);
  group.add(star);

  const halo = new THREE.Mesh(haloGeo, haloMat);
  group.add(halo);

  group.userData = {
    collected: false,
    phase: Math.random() * Math.PI * 2,
    halo
  };
  return group;
}

export function spawnCollectBurst(scene, position, burstList, color = 0xffd60a) {
  const count = 12;
  const geo = new THREE.OctahedronGeometry(0.18, 0);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(geo, mat.clone());
    p.position.copy(position);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14
    );
    scene.add(p);
    burstList.push({ mesh: p, vel, life: 0.55, maxLife: 0.55 });
  }
}
