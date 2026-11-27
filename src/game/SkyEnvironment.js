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
    new THREE.Color(0x6e503f),
    new THREE.Color(0x946149),
    new THREE.Color(0xb58668),
    new THREE.Color(0x7d5542),
    new THREE.Color(0xcfb497)
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
 * Creates a seamless, tileable 3D canyon valley segment with stepped red-rock cliff walls,
 * sandy canyon floor, and a winding turquoise canyon river down the center.
 */
function createCanyonSegment(segLength = 220, segWidth = 340) {
  const group = new THREE.Group();

  const geo = new THREE.PlaneGeometry(segWidth, segLength, 44, 16);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cFloor = new THREE.Color(0xc2a88c);
  const cDarkRed = new THREE.Color(0x6b4c3b);
  const cTerracotta = new THREE.Color(0x996249);
  const cOchre = new THREE.Color(0xb88667);
  const cSandstone = new THREE.Color(0xd1b699);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Periodic along Z so segments tile seamlessly end-to-end
    const zPhase = (z / segLength) * Math.PI * 2;
    const meander = Math.sin(zPhase) * 9.5 + Math.cos(zPhase * 2) * 3.5;
    const distFromCenter = Math.abs(x - meander);

    let y = 0;
    if (distFromCenter < 14) {
      // Flat sandy canyon floor + slight riverbed dip
      y = distFromCenter < 7 ? -1.4 : (distFromCenter - 7) * 0.2;
    } else if (distFromCenter < 56) {
      // Dramatic stepped canyon cliff walls rising on both sides
      const t = (distFromCenter - 14) / 42;
      const smoothRise = Math.pow(t, 0.85) * 62;
      // Geological horizontal cliff terraces (steps)
      const terrace = Math.sin(t * Math.PI * 6) * 2.4;
      const crag =
        Math.sin(zPhase * 3 + x * 0.14) * 3.8 +
        Math.cos(zPhase * 5 - x * 0.21) * 2.1;
      y = smoothRise + terrace + crag * t;
    } else {
      // High sunlit desert plateau & distant canyon ridges
      const plateauNoise =
        Math.sin(zPhase * 2 + x * 0.08) * 9.5 +
        Math.cos(zPhase * 4 - x * 0.13) * 5.2;
      y = 62 + plateauNoise;
    }

    pos.setY(i, y);

    // Geological rock strata coloring based on elevation
    if (y < 2.5) {
      tmp.copy(cFloor);
    } else if (y < 18) {
      tmp.copy(cDarkRed).lerp(cTerracotta, (y - 2.5) / 15.5);
    } else if (y < 36) {
      tmp.copy(cTerracotta).lerp(cOchre, (y - 18) / 18);
    } else if (y < 52) {
      tmp.copy(cOchre).lerp(cDarkRed, ((y - 36) / 16) * 0.65);
    } else {
      tmp.copy(cOchre).lerp(cSandstone, Math.min(1, (y - 52) / 18));
    }

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0,
      flatShading: true
    })
  );
  group.add(terrain);

  // Winding canyon river ribbon along the floor
  const riverGeo = new THREE.PlaneGeometry(13, segLength, 4, 16);
  riverGeo.rotateX(-Math.PI / 2);
  const rPos = riverGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const rx = rPos.getX(i);
    const rz = rPos.getZ(i);
    const zPhase = (rz / segLength) * Math.PI * 2;
    const meander = Math.sin(zPhase) * 9.5 + Math.cos(zPhase * 2) * 3.5;
    rPos.setX(i, rx + meander);
  }
  const river = new THREE.Mesh(
    riverGeo,
    new THREE.MeshStandardMaterial({
      color: 0x3b6e75,
      emissive: 0x0d2226,
      emissiveIntensity: 0.12,
      roughness: 0.22,
      metalness: 0.3
    })
  );
  river.position.y = -0.35;
  group.add(river);

  return group;
}

/**
 * Creates a seamless, wide open Arctic Tundra snowfield with gentle rolling snowdrifts
 * and frozen ice patches (completely distinct from the narrow walled Canyon).
 */
function createArcticTundraSegment(segLength = 220, segWidth = 420) {
  const group = new THREE.Group();

  const geo = new THREE.PlaneGeometry(segWidth, segLength, 38, 16);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cPureSnow = new THREE.Color(0xf6fbff);
  const cSoftBlue = new THREE.Color(0xd2e8f7);
  const cIcePatch = new THREE.Color(0x9bd1eb);
  const cDistantRidge = new THREE.Color(0xb8d4e8);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const zPhase = (z / segLength) * Math.PI * 2;
    const absX = Math.abs(x);

    // Wide open rolling snowdrifts across the center; gentle distant polar hills far out
    const drift =
      Math.sin(zPhase * 2 + x * 0.045) * 3.8 +
      Math.cos(zPhase * 3 - x * 0.07) * 2.2;
    const farRise = absX > 95 ? Math.pow((absX - 95) / 115, 1.5) * 38 : 0;
    const y = drift + farRise;
    pos.setY(i, y);

    if (farRise > 12) {
      tmp.copy(cDistantRidge).lerp(cPureSnow, Math.min(1, (farRise - 12) / 24));
    } else if (drift < -2.4) {
      tmp.copy(cIcePatch).lerp(cSoftBlue, 0.5);
    } else if (drift < 0.8) {
      tmp.copy(cSoftBlue).lerp(cPureSnow, (drift + 2.4) / 3.2);
    } else {
      tmp.copy(cPureSnow);
    }

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const snowfield = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.06,
      flatShading: true
    })
  );
  group.add(snowfield);
  return group;
}

/**
 * Creates a cozy warm-lit Arctic Research Outpost (geodesic domes, radar dish & beacon)
 * nestled on the open snow tundra.
 */
function createArcticOutpost() {
  const group = new THREE.Group();
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45, metalness: 0.2, flatShading: true });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf77f00, roughness: 0.5 });
  const warmGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });

  // Main geodesic research dome
  const mainDome = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5, 1), domeMat);
  mainDome.scale.set(1, 0.72, 1);
  mainDome.position.y = 1.6;
  group.add(mainDome);

  // Warm glowing panoramic window band
  const windowBand = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.45, 1.15, 10), warmGlowMat);
  windowBand.position.y = 2.1;
  group.add(windowBand);

  // Secondary orange habitat module
  const hab = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.8, 3.6), orangeMat);
  hab.position.set(8.2, 1.4, 2.2);
  group.add(hab);

  const habWin = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 3.7), warmGlowMat);
  habWin.position.set(8.2, 1.6, 2.2);
  group.add(habWin);

  // Tall polar radar tower + glowing red aviation beacon
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.55, 10.5, 6), metalMat);
  tower.position.set(-7.5, 5.2, -3.0);
  group.add(tower);

  const dish = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), domeMat);
  dish.position.set(-7.5, 9.8, -3.0);
  dish.rotation.x = 0.75;
  group.add(dish);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3b5c })
  );
  beacon.position.set(-7.5, 11.2, -3.0);
  group.add(beacon);

  return group;
}

let cachedVolcanicTextures = null;
let cachedSmokeTexture = null;
let cachedMoonTexture = null;
let cachedIceBumpTexture = null;

/**
 * Generates a realistic 256x256 procedural glacier ice & snow surface bump/albedo detail texture.
 */
function getIceBumpTexture() {
  if (cachedIceBumpTexture) return cachedIceBumpTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 650; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 8 + Math.random() * 28;
    const h = 3 + Math.random() * 14;
    const s = 70 + Math.floor(Math.random() * 140);
    ctx.fillStyle = `rgba(${s},${s},${s},0.28)`;
    ctx.fillRect(x, y, w, h);
  }
  for (let c = 0; c < 24; c++) {
    ctx.strokeStyle = 'rgba(35,35,35,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (Math.random() - 0.5) * 35;
      y += 10 + Math.random() * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  cachedIceBumpTexture = tex;
  return tex;
}

let cachedWaterNormalMap = null;

/**
 * Generates a seamless 512x512 organic water ripple normal map (tangent-space RGB)
 * using periodic multi-directional wave synthesis so there are zero grid seams or plaid artifacts.
 */
function getWaterNormalMap() {
  if (cachedWaterNormalMap) return cachedWaterNormalMap;
  const size = 256;
  const heights = new Float32Array(size * size);

  // 10 periodic wave components at varied irrational-like directions (exact integer cycles -> 100% seamless tiling)
  const waves = [
    [2, 1, 0.28, 0.3],
    [-1, 3, 0.22, 1.4],
    [3, -2, 0.18, 2.5],
    [4, 3, 0.14, 0.8],
    [-4, 2, 0.12, 3.7],
    [5, -5, 0.09, 1.9],
    [7, 2, 0.07, 4.1],
    [-3, -7, 0.06, 2.2],
    [9, -4, 0.045, 0.5],
    [-6, 8, 0.04, 5.2]
  ];

  const TWO_PI = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    const ny = y / size;
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      let h = 0;
      for (let w = 0; w < waves.length; w++) {
        const [kx, ky, amp, phase] = waves[w];
        const arg = TWO_PI * (kx * nx + ky * ny) + phase;
        // Sharper wave crests (Gerstner-like trochoid shaping)
        h += Math.sin(arg) * amp + Math.cos(arg * 2.0) * amp * 0.18;
      }
      heights[y * size + x] = h;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const strength = 2.6;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dy = (heights[yp * size + x] - heights[ym * size + x]) * strength;
      const len = Math.hypot(dx, dy, 1.0);
      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((1.0 / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cachedWaterNormalMap = tex;
  return tex;
}

/**
 * Creates a realistic dual-scrolling normal-map GLSL Ocean Water material
 * with Schlick Fresnel sky reflection, subsurface wave scattering, and crisp sun glints.
 */
function createRealisticOceanMaterial() {
  const normalMap = getWaterNormalMap();
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uNormalMap: { value: normalMap },
      uDeepColor: { value: new THREE.Color(0x072642) },
      uShallowColor: { value: new THREE.Color(0x125a87) },
      uSkyColor: { value: new THREE.Color(0x87ceeb) },
      uSunDir: { value: new THREE.Vector3(0, 0.35, -0.94).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4e0) },
      uFogColor: { value: new THREE.Color(0x9bd0f5) },
      uFogDensity: { value: 0.002 }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying float vFogDepth;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPos = viewMatrix * wp;
        vFogDepth = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScroll;
      uniform sampler2D uNormalMap;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uSkyColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;

      varying vec3 vWorldPos;
      varying float vFogDepth;

      vec3 sampleNormal(vec2 uv) {
        vec3 n = texture2D(uNormalMap, uv).rgb * 2.0 - 1.0;
        return vec3(n.x, n.z, n.y);
      }

      void main() {
        vec2 baseUV = vec2(vWorldPos.x * 0.011, vWorldPos.z * 0.011 - uScroll * 0.24);

        // 3 layered organic normal-map samples at different scales & wind directions (zero grid look)
        vec2 uv1 = baseUV * 1.0 + vec2(uTime * 0.028, uTime * 0.018);
        vec2 uv2 = baseUV * 2.15 + vec2(-uTime * 0.036, uTime * 0.044);
        vec2 uv3 = baseUV * 4.6 + vec2(uTime * 0.052, -uTime * 0.061);

        // Fade high-frequency ripples in the distance to eliminate horizon shimmer/aliasing
        float distFade = exp(-vFogDepth * 0.0022);
        vec3 n1 = sampleNormal(uv1);
        vec3 n2 = sampleNormal(uv2);
        vec3 n3 = sampleNormal(uv3);

        vec3 N = normalize(
          vec3(0.0, 1.0, 0.0) +
          (n1 - vec3(0.0, 1.0, 0.0)) * 0.55 +
          (n2 - vec3(0.0, 1.0, 0.0)) * 0.42 * distFade +
          (n3 - vec3(0.0, 1.0, 0.0)) * 0.24 * distFade * distFade
        );

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Physically-based Schlick Fresnel (F0 = 0.02 for water)
        float cosTheta = clamp(dot(N, V), 0.0, 1.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);

        // Diffuse + subsurface light scatter through wave crests
        float diff = clamp(dot(N, L), 0.0, 1.0);
        float sss = pow(clamp(dot(V, -L + N * 0.6), 0.0, 1.0), 3.0) * 0.35;
        vec3 waterBody = mix(uDeepColor, uShallowColor, diff * 0.55 + sss);

        // Sky & horizon reflection
        vec3 reflColor = mix(uSkyColor, uFogColor, 0.35);
        vec3 col = mix(waterBody, reflColor, clamp(fresnel * 0.92, 0.0, 0.92));

        // Dual-lobe crisp sun sparkle path across ripples
        vec3 H = normalize(L + V);
        float ndoth = max(dot(N, H), 0.0);
        float tightSpec = pow(ndoth, 320.0) * 2.6;
        float softSpec = pow(ndoth, 36.0) * 0.28;
        col += uSunColor * (tightSpec + softSpec);

        // Seamless exponential squared horizon fog
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * Creates a majestic Norwegian/Lofoten-style Fjord mountain rising steeply from the polar sea,
 * with dark coastal granite cliffs, snow-dusted upper ridges, and cozy warm-lit shoreline cabins.
 */
function createFjordMountain(radius, height, seed, withVillage = false) {
  const group = new THREE.Group();
  const geo = new THREE.ConeGeometry(radius, height, 22, 12, true);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGranite = new THREE.Color(0x283645);
  const cSlate = new THREE.Color(0x475b70);
  const cSnow = new THREE.Color(0xeef6fc);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const hRatio = Math.max(0, Math.min(1, y / height));
    const angle = Math.atan2(z, x);
    // Dramatic steep glacial fjord ribs
    const ridge = Math.sin(angle * 4 + seed) * 0.22 + Math.cos(angle * 6 - seed * 1.4) * 0.12;
    const n = ridgeNoise(x * 0.65, y * 0.45, z * 0.65, seed);
    const disp = (1 + ridge + n * 0.22) * (1 - hRatio * 0.16);

    if (hRatio > 0.02 && hRatio < 0.99) {
      x *= disp;
      z *= disp;
      pos.setXYZ(i, x, y, z);
    }

    // Realistic fjord snowlines: dark steep granite near the water, snow accumulating on upper ledges
    const snowLine = 0.42 + n * 0.18 - ridge * 0.18;
    if (hRatio > snowLine + 0.14) {
      tmp.copy(cSnow);
    } else if (hRatio > snowLine - 0.06) {
      const t = (hRatio - (snowLine - 0.06)) / 0.2;
      tmp.copy(cSlate).lerp(cSnow, Math.max(0, Math.min(1, t)));
    } else {
      tmp.copy(cGranite).lerp(cSlate, Math.min(1, hRatio * 1.4));
    }

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mountain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      bumpMap: getIceBumpTexture(),
      bumpScale: 1.5,
      roughness: 0.78,
      metalness: 0.08
    })
  );
  group.add(mountain);

  // Cozy Nordic shoreline cabins with warm golden glowing windows along the base
  if (withVillage) {
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x9e2a2b, roughness: 0.75 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xeef6fc, roughness: 0.6 });
    const warmWinMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });

    for (let c = 0; c < 3; c++) {
      const ca = (c - 1) * 0.42 + seed;
      const cx = Math.cos(ca) * radius * 0.94;
      const cz = Math.sin(ca) * radius * 0.94;

      const cabin = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.2), cabinMat);
      body.position.y = 0.9;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.3, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 2.4;
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.55, 1.2), warmWinMat);
      win.position.y = 1.05;

      cabin.add(body, roof, win);
      cabin.position.set(cx, 0, cz);
      cabin.rotation.y = -ca;
      group.add(cabin);
    }
  }

  return group;
}

/**
 * Creates a realistic GPU-animated GLSL Aurora Borealis curtain with vertical rays & emerald-to-violet fade.
 */
function createGLSLAuroraCurtain(width, height, phaseOffset) {
  const geo = new THREE.PlaneGeometry(width, height, 64, 8);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: phaseOffset }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float wave = sin(p.x * 0.016 + uTime * 0.55 + uPhase) * 28.0
                   + cos(p.x * 0.032 - uTime * 0.35 + uPhase * 1.7) * 14.0;
        p.z += wave;
        p.y += sin(p.x * 0.012 + uTime * 0.4 + uPhase) * 7.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPhase;
      varying vec2 vUv;
      void main() {
        // Horizontal edge fade
        float hFade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        // Vertical curtain profile (sharp luminous bottom edge, soft fading top)
        float vFade = smoothstep(0.0, 0.14, vUv.y) * pow(1.0 - vUv.y, 1.55);

        // Shimmering vertical aurora rays
        float rays = 0.55
          + 0.28 * sin(vUv.x * 58.0 + uTime * 1.3 + uPhase)
          + 0.17 * sin(vUv.x * 115.0 - uTime * 1.9 + uPhase * 2.0);
        rays = clamp(rays, 0.0, 1.0);

        vec3 emerald = vec3(0.18, 0.95, 0.62);
        vec3 teal = vec3(0.15, 0.78, 0.88);
        vec3 violet = vec3(0.55, 0.28, 0.88);

        vec3 col = mix(emerald, teal, smoothstep(0.12, 0.52, vUv.y));
        col = mix(col, violet, smoothstep(0.45, 0.92, vUv.y));

        float alpha = hFade * vFade * rays * 0.68;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * Generates a realistic cratered Moon surface texture.
 */
function getMoonTexture() {
  if (cachedMoonTexture) return cachedMoonTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d8dee6';
  ctx.fillRect(0, 0, size, size);

  // Subtle lunar maria (dark plains)
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 16 + Math.random() * 38;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(135, 145, 160, 0.45)');
    grad.addColorStop(1, 'rgba(135, 145, 160, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp lunar craters
  for (let c = 0; c < 45; c++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 11;
    ctx.fillStyle = 'rgba(115, 125, 138, 0.42)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 248, 252, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  cachedMoonTexture = new THREE.CanvasTexture(canvas);
  return cachedMoonTexture;
}

/**
 * Generates realistic 512x512 procedural basalt rock albedo, bump, and glowing magma fissure emissive maps.
 */
function getVolcanicTextures() {
  if (cachedVolcanicTextures) return cachedVolcanicTextures;

  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const emissiveCanvas = document.createElement('canvas');
  albedoCanvas.width = bumpCanvas.width = emissiveCanvas.width = size;
  albedoCanvas.height = bumpCanvas.height = emissiveCanvas.height = size;

  const aCtx = albedoCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const eCtx = emissiveCanvas.getContext('2d');

  // Base dark weathered basalt rock
  aCtx.fillStyle = '#2b2628';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);

  // Layered rocky grain & pahoehoe cooled lava folds
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 24;
    const shade = 28 + Math.floor(Math.random() * 42);
    aCtx.fillStyle = `rgba(${shade + 4}, ${shade}, ${shade + 2}, 0.28)`;
    aCtx.beginPath();
    aCtx.arc(x, y, r, 0, Math.PI * 2);
    aCtx.fill();

    const bShade = 90 + Math.floor(Math.random() * 120);
    bCtx.fillStyle = `rgba(${bShade}, ${bShade}, ${bShade}, 0.25)`;
    bCtx.beginPath();
    bCtx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Organic branching molten magma cracks (tileable feel)
  for (let c = 0; c < 14; c++) {
    let cx = Math.random() * size;
    let cy = Math.random() * size;
    let angle = Math.random() * Math.PI * 2;
    const steps = 18 + Math.floor(Math.random() * 18);

    eCtx.beginPath();
    eCtx.moveTo(cx, cy);
    bCtx.beginPath();
    bCtx.moveTo(cx, cy);

    for (let s = 0; s < steps; s++) {
      angle += (Math.random() - 0.5) * 0.85;
      cx += Math.cos(angle) * 16;
      cy += Math.sin(angle) * 16;
      eCtx.lineTo(cx, cy);
      bCtx.lineTo(cx, cy);
    }

    // Outer deep red crust glow
    eCtx.strokeStyle = 'rgba(180, 35, 0, 0.55)';
    eCtx.lineWidth = 10;
    eCtx.lineCap = 'round';
    eCtx.stroke();

    // Mid molten orange lava
    eCtx.strokeStyle = 'rgba(255, 95, 0, 0.85)';
    eCtx.lineWidth = 4.5;
    eCtx.stroke();

    // Hot yellow-white magma center
    eCtx.strokeStyle = 'rgba(255, 200, 70, 0.95)';
    eCtx.lineWidth = 1.6;
    eCtx.stroke();

    // Recessed fissure groove in bump map
    bCtx.strokeStyle = 'rgba(20, 20, 20, 0.8)';
    bCtx.lineWidth = 7;
    bCtx.stroke();
  }

  const wrap = (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  };

  cachedVolcanicTextures = {
    map: wrap(new THREE.CanvasTexture(albedoCanvas)),
    bumpMap: wrap(new THREE.CanvasTexture(bumpCanvas)),
    emissiveMap: wrap(new THREE.CanvasTexture(emissiveCanvas))
  };
  return cachedVolcanicTextures;
}

/**
 * Generates a soft, photorealistic multi-puff volumetric smoke/ash cloud sprite texture.
 */
function getSmokeSpriteTexture() {
  if (cachedSmokeTexture) return cachedSmokeTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Cluster of overlapping soft radial gradients for realistic billowing smoke
  const puffs = [
    [128, 128, 86, 0.52],
    [92, 118, 66, 0.42],
    [164, 122, 68, 0.42],
    [118, 92, 60, 0.38],
    [144, 152, 62, 0.38],
    [102, 148, 54, 0.32]
  ];
  for (const [x, y, r, alpha] of puffs) {
    const grad = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.5, `rgba(220, 215, 215, ${alpha * 0.55})`);
    grad.addColorStop(1, 'rgba(180, 175, 175, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  cachedSmokeTexture = new THREE.CanvasTexture(canvas);
  return cachedSmokeTexture;
}

/**
 * Creates a realistic smooth-shaded basalt lava field with procedural rock bump & glowing magma fissure maps.
 */
function createVolcanicTerrainSegment(segLength = 220, segWidth = 420) {
  const group = new THREE.Group();
  const { map, bumpMap, emissiveMap } = getVolcanicTextures();

  const geo = new THREE.PlaneGeometry(segWidth, segLength, 48, 22);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const zPhase = (z / segLength) * Math.PI * 2;
    const absX = Math.abs(x);

    const n1 = Math.sin(zPhase * 2 + x * 0.05) * Math.cos(zPhase * 3 - x * 0.04) * 7.5;
    const n2 = Math.sin(zPhase * 5 - x * 0.12) * 3.2 + Math.cos(zPhase * 4 + x * 0.15) * 2.1;
    const rimRise = absX > 84 ? Math.pow((absX - 84) / 126, 1.45) * 52 : 0;
    pos.setY(i, n1 + n2 + rimRise);
  }
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 1.8,
      emissive: 0xff6a00,
      emissiveMap,
      emissiveIntensity: 1.45,
      roughness: 0.9,
      metalness: 0.08
    })
  );
  group.add(terrain);

  return group;
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
    color: 0xa16c52,
    roughness: 0.94,
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
  const { map, bumpMap, emissiveMap } = getVolcanicTextures();
  const smokeTex = getSmokeSpriteTexture();

  // Wide-shouldered realistic stratovolcano (not a thin pointy cone)
  const geo = new THREE.CylinderGeometry(radius * 0.28, radius * 1.3, height, 22, 10, true);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const hRatio = Math.max(0, Math.min(1, y / height));
    const n = ridgeNoise(x * 0.7, y * 0.5, z * 0.7, seed);
    // Concave realistic stratovolcano slope curve
    const slopeCurve = 1 - Math.sin(hRatio * Math.PI) * 0.18;
    const disp = (1 + n * 0.22) * slopeCurve;
    if (hRatio > 0.02) {
      x *= disp;
      z *= disp;
      pos.setXYZ(i, x, y, z);
    }
  }
  geo.computeVertexNormals();

  const cone = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 1.5,
      emissive: 0xff5a00,
      emissiveMap,
      emissiveIntensity: 0.9,
      roughness: 0.92,
      metalness: 0.06
    })
  );
  group.add(cone);

  // Glowing molten magma pool inside crater
  const magma = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.28, 16),
    new THREE.MeshBasicMaterial({ color: 0xff9e00 })
  );
  magma.rotation.x = -Math.PI / 2;
  magma.position.y = height - 0.5;
  group.add(magma);

  // Realistic soft volumetric ash/smoke plume sprites drifting from crater
  for (let s = 0; s < 5; s++) {
    const isLow = s < 2;
    const spMat = new THREE.SpriteMaterial({
      map: smokeTex,
      color: isLow ? 0xa34828 : 0x5c5356,
      transparent: true,
      opacity: isLow ? 0.65 : 0.52 - s * 0.06,
      depthWrite: false
    });
    const sp = new THREE.Sprite(spMat);
    const sc = radius * (0.7 + s * 0.35);
    sp.scale.set(sc * 1.2, sc, 1);
    sp.position.set(s * 3.8, height + 4.5 + s * 6.5, -s * 2.2);
    group.add(sp);
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
    this.canyonSegments = [];
    this.auroraMeshes = [];
    this.earthMesh = null;
    this.earthCloudsMesh = null;
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

    // Warm under-glow light active in volcanic biome so aircraft & clouds catch real lava bounce light
    this.lavaUnderLight = new THREE.PointLight(0xff5500, 0, 140);
    this.lavaUnderLight.position.set(0, -24, -10);
    this.scene.add(this.lavaUnderLight);
  }

  _initGroundPlane() {
    const groundGeo = new THREE.PlaneGeometry(2600, 2600);
    this.oceanMaterial = createRealisticOceanMaterial();
    this.oceanScroll = 0;
    this.groundMesh = new THREE.Mesh(groundGeo, this.oceanMaterial);
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
    // Realistic soft volumetric billboard clouds (replaces plastic sphere-ball clusters)
    const cloudTex = getSmokeSpriteTexture();
    this.cloudMaterial = new THREE.SpriteMaterial({
      map: cloudTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.68,
      depthWrite: false
    });

    for (let i = 0; i < 32; i++) {
      const group = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 2);
      for (let p = 0; p < puffs; p++) {
        const sp = new THREE.Sprite(this.cloudMaterial);
        const sx = 18 + Math.random() * 18;
        const sy = 9 + Math.random() * 8;
        sp.scale.set(sx, sy, 1);
        sp.position.set(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 3.5,
          (Math.random() - 0.5) * 8
        );
        group.add(sp);
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
    const z = initial ? -460 + Math.random() * 880 : -460 - Math.random() * 90;
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
    this.canyonSegments = [];
    this.auroraMeshes = [];
    this.earthMesh = null;
    this.earthCloudsMesh = null;
    this.weatherParticles = null;
    this.weatherConfig = null;
  }

  _placeBiomeProp(prop, biome, initial = false) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const z = initial ? -460 + Math.random() * 880 : -460 - Math.random() * 90;

    if (biome === 'archipelago') {
      const x = side * (22 + Math.random() * 115);
      prop.position.set(x, -48, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
    } else if (biome === 'canyon') {
      const x = side * (30 + Math.random() * 88);
      prop.position.set(x, -48, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
    } else if (biome === 'alpine') {
      if (prop.userData.isDistantPeak) {
        // Grand snowy mountain ranges far on the flanks of the wide tundra
        const x = side * (82 + Math.random() * 75);
        prop.position.set(x, -48, z);
        prop.rotation.y = Math.random() * Math.PI * 2;
      } else {
        // Snowy pine forests & warm-lit Arctic Research Outposts scattered across the open snowfield
        const x = (Math.random() * 2 - 1) * 78;
        prop.position.set(x, -47, z);
        prop.rotation.y = Math.random() * Math.PI * 2;
      }
    } else if (biome === 'volcano') {
      const x = side * (32 + Math.random() * 100);
      prop.position.set(x, -48, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
    } else {
      if (prop.userData.isFjord) {
        // Dramatic snow-dusted Norwegian Fjord peaks framing both sides of the polar sea channel
        const x = side * (56 + Math.random() * 88);
        prop.position.set(x, -48, z);
        prop.rotation.y = Math.random() * Math.PI * 2;
      } else {
        // Drifting polar icebergs & sea-ice floes closer to the water channel
        const x = side * (22 + Math.random() * 44);
        prop.position.set(x, -48, z);
        prop.rotation.y = Math.random() * Math.PI * 2;
      }
    }
  }

  _createWeatherParticles(count, color, size, fallSpeed, driftSpeed) {
    // Soft circular radial-gradient sprite texture so snowflakes/dust look round & natural, never boxy squares
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    const pGrad = pCtx.createRadialGradient(16, 16, 1, 16, 16, 15);
    pGrad.addColorStop(0, 'rgba(255,255,255,1)');
    pGrad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    pGrad.addColorStop(1, 'rgba(255,255,255,0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 32, 32);
    const pTex = new THREE.CanvasTexture(pCanvas);

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
      map: pTex,
      size: size * 1.45,
      transparent: true,
      opacity: 0.9,
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
    // Hide flat sea plane in Canyon, Arctic Tundra & Volcanic Caldera; keep realistic ocean in Archipelago & Polar Stratosphere
    this.groundMesh.visible = biome === 'archipelago' || biome === 'aurora';
    this.sky.visible = true;
    for (const c of this.clouds) {
      c.visible = true;
    }
    this.lavaUnderLight.intensity = biome === 'volcano' ? 4.2 : 0;

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
      // Real continuous 3D canyon valley (5 seamless tiled segments covering full 360° horizon)
      const segLength = 220;
      for (let s = 0; s < 5; s++) {
        const seg = createCanyonSegment(segLength, 440);
        seg.position.set(0, -48, (s - 2) * segLength);
        this.biomeGroup.add(seg);
        this.canyonSegments.push(seg);
      }

      // Sculpted rock arches & tall red-rock spires along the canyon rim & walls
      for (let i = 0; i < 16; i++) {
        const seed = i * 5.3;
        let prop;
        if (i % 4 === 0) {
          prop = createCanyonArch(1.45 + Math.random() * 0.75, seed);
        } else {
          const r = 7 + Math.random() * 9;
          const h = 28 + Math.random() * 34;
          prop = createCanyonMesa(r, h, seed);
        }
        this._placeBiomeProp(prop, biome, true);
        this.biomeGroup.add(prop);
        this.biomeProps.push(prop);
      }

      // Subtle sunlit natural canyon dust motes
      this._createWeatherParticles(130, 0xe8d5be, 0.38, 0.7, 2.8);
    } else if (biome === 'alpine') {
      // Wide open Arctic Tundra snowfield (5 segments for full 360° horizon continuity)
      const segLength = 220;
      for (let s = 0; s < 5; s++) {
        const seg = createArcticTundraSegment(segLength, 480);
        seg.position.set(0, -48, (s - 2) * segLength);
        this.biomeGroup.add(seg);
        this.canyonSegments.push(seg);
      }

      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
      const pineMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.85, flatShading: true });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f9fc, roughness: 0.6, flatShading: true });

      // 1) Warm-lit Arctic Research Outposts across the snowy tundra
      for (let o = 0; o < 5; o++) {
        const outpost = createArcticOutpost();
        this._placeBiomeProp(outpost, biome, true);
        this.biomeGroup.add(outpost);
        this.biomeProps.push(outpost);
      }

      // 2) Dense snowy Taiga pine forest groves on the open snowfield
      for (let f = 0; f < 14; f++) {
        const grove = new THREE.Group();
        const treeCount = 4 + Math.floor(Math.random() * 3);
        for (let t = 0; t < treeCount; t++) {
          const pine = createPineTree(trunkMat, pineMat, snowMat, 1.0 + Math.random() * 0.65);
          pine.position.set((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16);
          grove.add(pine);
        }
        this._placeBiomeProp(grove, biome, true);
        this.biomeGroup.add(grove);
        this.biomeProps.push(grove);
      }

      // 3) Grand distant snow-capped mountain peaks framing the far horizon
      for (let m = 0; m < 12; m++) {
        const peak = createAlpineMountain(22 + Math.random() * 20, 48 + Math.random() * 44, m * 6.7);
        peak.userData.isDistantPeak = true;
        this._placeBiomeProp(peak, biome, true);
        this.biomeGroup.add(peak);
        this.biomeProps.push(peak);
      }

      this._createWeatherParticles(280, 0xffffff, 0.58, 11, 3.8);
    } else if (biome === 'volcano') {
      // Real continuous 3D volcanic basalt caldera (5 segments covering full 360° horizon)
      const segLength = 220;
      for (let s = 0; s < 5; s++) {
        const seg = createVolcanicTerrainSegment(segLength, 480);
        seg.position.set(0, -48, (s - 2) * segLength);
        this.biomeGroup.add(seg);
        this.canyonSegments.push(seg);
      }

      for (let i = 0; i < 16; i++) {
        const r = 18 + Math.random() * 18;
        const h = 36 + Math.random() * 44;
        const volc = createVolcanoPeak(r, h, i * 7.4);
        this._placeBiomeProp(volc, biome, true);
        this.biomeGroup.add(volc);
        this.biomeProps.push(volc);
      }

      this._createWeatherParticles(240, 0xff8c24, 0.62, -7.5, 4.8);
    } else {
      // Level 5: Aurora Fjords — Realistic GLSL Polar Sea, Dramatic Snow-Capped Fjord Peaks,
      // Warm-Lit Nordic Shoreline Cabins, Drifting Icebergs, Cratered Moon & GLSL Aurora Borealis
      const cWaterlineIce = new THREE.Color(0x3a86b7);
      const cGlacierBlue = new THREE.Color(0x9bd6f0);
      const cPureSnow = new THREE.Color(0xf4faff);
      const tmpCol = new THREE.Color();

      // 1) Dramatic steep Norwegian Fjord mountains rising directly from the polar sea
      for (let f = 0; f < 16; f++) {
        const r = 24 + Math.random() * 20;
        const h = 48 + Math.random() * 48;
        const fjord = createFjordMountain(r, h, f * 7.3, f % 3 === 0);
        fjord.userData.isFjord = true;
        this._placeBiomeProp(fjord, biome, true);
        this.biomeGroup.add(fjord);
        this.biomeProps.push(fjord);
      }

      // 2) Drifting realistic icebergs & flat tabular sea-ice floes in the fjord channel
      for (let i = 0; i < 14; i++) {
        const berg = new THREE.Group();
        const isFloe = i % 2 === 0;
        const seed = i * 8.7;

        if (isFloe) {
          const r = 10 + Math.random() * 12;
          const floeH = 1.8 + Math.random() * 1.8;
          const floeGeo = new THREE.CylinderGeometry(r * 0.9, r, floeH, 12, 2);
          floeGeo.translate(0, floeH * 0.5, 0);
          const fPos = floeGeo.attributes.position;
          for (let v = 0; v < fPos.count; v++) {
            const vx = fPos.getX(v);
            const vz = fPos.getZ(v);
            const n = ridgeNoise(vx * 0.6, 0, vz * 0.6, seed);
            fPos.setX(v, vx * (1 + n * 0.25));
            fPos.setZ(v, vz * (1 + n * 0.25));
          }
          floeGeo.computeVertexNormals();
          const floeMesh = new THREE.Mesh(
            floeGeo,
            new THREE.MeshStandardMaterial({
              color: 0xe6f4fc,
              bumpMap: getIceBumpTexture(),
              bumpScale: 0.8,
              roughness: 0.42,
              metalness: 0.08
            })
          );
          berg.add(floeMesh);
        } else {
          const r = 9 + Math.random() * 10;
          const h = 14 + Math.random() * 18;
          const geo = new THREE.CylinderGeometry(r * 0.14, r * 1.12, h, 16, 7);
          geo.translate(0, h * 0.5, 0);
          const pos = geo.attributes.position;
          const cols = new Float32Array(pos.count * 3);

          for (let v = 0; v < pos.count; v++) {
            let vx = pos.getX(v);
            let vy = pos.getY(v);
            let vz = pos.getZ(v);
            const hr = Math.max(0, Math.min(1, vy / h));
            const n = ridgeNoise(vx * 0.8, vy * 0.5, vz * 0.8, seed);
            if (hr > 0.02) {
              vx *= 1 + n * 0.3;
              vz *= 1 + n * 0.3;
              pos.setXYZ(v, vx, vy, vz);
            }
            if (hr < 0.28) tmpCol.copy(cWaterlineIce).lerp(cGlacierBlue, hr / 0.28);
            else tmpCol.copy(cGlacierBlue).lerp(cPureSnow, Math.min(1, (hr - 0.28) / 0.62));
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
              bumpMap: getIceBumpTexture(),
              bumpScale: 1.4,
              roughness: 0.26,
              metalness: 0.14
            })
          );
          berg.add(bergMesh);
        }

        this._placeBiomeProp(berg, biome, true);
        this.biomeGroup.add(berg);
        this.biomeProps.push(berg);
      }

      // 3) Realistic cratered Moon high over the fjord sky
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(22, 24, 18),
        new THREE.MeshStandardMaterial({
          map: getMoonTexture(),
          emissive: 0x9bb5cc,
          emissiveIntensity: 0.28,
          roughness: 0.92
        })
      );
      moon.position.set(130, 96, -460);
      this.biomeGroup.add(moon);

      // 4) Vivid GPU-animated GLSL Aurora Borealis curtains dancing across both front & back horizons
      for (let a = 0; a < 4; a++) {
        const ribbon = createGLSLAuroraCurtain(540, 96, a * 1.85);
        ribbon.position.set((a - 1.5) * 90, 62 + a * 13, -250 - a * 52);
        ribbon.rotation.y = (a - 1.5) * 0.22;
        this.biomeGroup.add(ribbon);
        this.auroraMeshes.push(ribbon);
      }
      for (let b = 0; b < 2; b++) {
        const backRibbon = createGLSLAuroraCurtain(540, 96, b * 2.4 + 4.1);
        backRibbon.position.set((b - 0.5) * 120, 66 + b * 14, 265 + b * 55);
        backRibbon.rotation.y = Math.PI + (b - 0.5) * 0.25;
        this.biomeGroup.add(backRibbon);
        this.auroraMeshes.push(backRibbon);
      }

      // Delicate glowing Arctic frost mist in the air
      this._createWeatherParticles(140, 0xdbf4ff, 0.36, 1.2, 2.0);
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

    // Sync realistic GLSL ocean shader with current level sky, sun, fog & water depth colors
    const deepFactor = biome === 'archipelago' ? 0.72 : 0.52;
    const deepCol = new THREE.Color(skyCfg.seaColor).multiplyScalar(deepFactor);
    this.oceanMaterial.uniforms.uDeepColor.value.copy(deepCol);
    this.oceanMaterial.uniforms.uShallowColor.value.setHex(skyCfg.seaColor);
    this.oceanMaterial.uniforms.uSkyColor.value.setHex(skyCfg.hemiSky);
    this.oceanMaterial.uniforms.uSunDir.value.copy(this.sunVector).normalize();
    this.oceanMaterial.uniforms.uSunColor.value.setHex(skyCfg.sunColor);
    this.oceanMaterial.uniforms.uFogColor.value.setHex(skyCfg.fogColor);
    this.oceanMaterial.uniforms.uFogDensity.value = skyCfg.fogDensity;

    this.starfieldMat.opacity = skyCfg.starfieldOpacity;

    this.scene.fog = new THREE.FogExp2(skyCfg.fogColor, skyCfg.fogDensity);
    this.hasLightning = !!skyCfg.hasLightning;
    this.lightningTimer = 2.0 + Math.random() * 3.0;

    this._buildBiome(biome);
  }

  update(dt, forwardSpeed, boostFactor = 0) {
    this.time += dt;

    if (this.oceanMaterial && this.groundMesh.visible) {
      this.oceanScroll += dt * forwardSpeed * 0.045;
      this.oceanMaterial.uniforms.uTime.value = this.time;
      this.oceanMaterial.uniforms.uScroll.value = this.oceanScroll;
    }

    for (const c of this.clouds) {
      c.position.z += forwardSpeed * c.userData.speedFactor * dt;
      if (c.position.z > 430) {
        this._placeCloud(c, false);
      }
    }

    for (const p of this.biomeProps) {
      p.position.z += forwardSpeed * (p.userData.isSkyGate ? 0.92 : 0.72) * dt;
      if (p.position.z > 430) {
        this._placeBiomeProp(p, this.currentBiome, false);
      }
    }

    // Scroll continuous 3D terrain segments seamlessly across full 360° horizon (-550 .. +550)
    if (this.canyonSegments.length > 0) {
      const segLength = 220;
      const totalSpan = segLength * this.canyonSegments.length;
      for (const seg of this.canyonSegments) {
        seg.position.z += forwardSpeed * 0.72 * dt;
        if (seg.position.z > 550) {
          seg.position.z -= totalSpan;
        }
      }
    }

    // Rotate curved 3D Earth & its stratospheric cloud layer beneath the aircraft
    if (this.earthMesh) {
      this.earthMesh.rotation.x += dt * forwardSpeed * 0.00055;
    }
    if (this.earthCloudsMesh) {
      this.earthCloudsMesh.rotation.x += dt * forwardSpeed * 0.00068;
      this.earthCloudsMesh.rotation.y += dt * 0.004;
    }

    for (const ribbon of this.auroraMeshes) {
      if (ribbon.material?.uniforms?.uTime) {
        ribbon.material.uniforms.uTime.value = this.time;
      }
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
