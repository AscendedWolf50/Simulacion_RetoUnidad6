import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- 1. ESCENA, CÁMARA Y RENDERIZADOR ---
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c16);
scene.fog = new THREE.FogExp2(0x0a0c16, 0.012);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 8, 30);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.01;
controls.target.set(0, 3, 0);

// Luces
const ambientLight = new THREE.AmbientLight(0x7080a0, 0.85);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x99bbff, 1.4);
dirLight.position.set(12, 35, 12);
dirLight.castShadow = true;
scene.add(dirLight);

const strikeLight = new THREE.PointLight(0x00aaff, 0, 60);
strikeLight.castShadow = true;
scene.add(strikeLight);

const cloudFlashLight = new THREE.PointLight(0x00aaff, 0, 100);
cloudFlashLight.position.set(0, 35, 0);
scene.add(cloudFlashLight);

// --- SUELO INFINITO (2000x2000) Y MONOLITOS DISPERSOS ---
const floorGeo = new THREE.PlaneGeometry(2000, 2000);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x222636, roughness: 0.6, metalness: 0.2 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const boxGeo = new THREE.BoxGeometry(1.2, 2.5, 1.2);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x363d56, roughness: 0.4, metalness: 0.4 });

const numBoxes = 300;
const boxes = [];

for (let i = 0; i < numBoxes; i++) {
  const box = new THREE.Mesh(boxGeo, boxMat);
  const angle = Math.random() * Math.PI * 2;
  const radius = 6 + Math.pow(Math.random(), 1.4) * 394;
  const heightScale = 0.8 + Math.random() * 1.5;
  const height = 2.5 * heightScale;

  box.scale.set(1, heightScale, 1);
  box.position.set(
    Math.cos(angle) * radius,
    height / 2,
    Math.sin(angle) * radius
  );
  box.rotation.y = Math.random() * Math.PI;
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);

  boxes.push({
    x: box.position.x,
    z: box.position.z,
    height: height,
    radius: 0.95
  });
}

// --- NUBES PROCEDURALES DE TORMENTA ---
const cloudGroup = new THREE.Group();
const cloudGeo = new THREE.DodecahedronGeometry(1, 1);
const cloudMat = new THREE.MeshStandardMaterial({
  color: 0x2e384e,
  roughness: 0.8,
  metalness: 0.1,
  transparent: true,
  opacity: 0.88,
  flatShading: true
});

const numClouds = 65;
const clouds = [];

for (let i = 0; i < numClouds; i++) {
  const cloud = new THREE.Mesh(cloudGeo, cloudMat);
  const x = (Math.random() - 0.5) * 140;
  const y = 32 + Math.random() * 6;
  const z = (Math.random() - 0.5) * 120;

  cloud.position.set(x, y, z);
  cloud.scale.set(8 + Math.random() * 12, 3 + Math.random() * 4, 8 + Math.random() * 12);
  cloud.rotation.y = Math.random() * Math.PI * 2;

  cloudGroup.add(cloud);
  clouds.push({ mesh: cloud, speed: 0.15 + Math.random() * 0.25 });
}
scene.add(cloudGroup);

// Post-Procesamiento (UnrealBloomPass)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.2
);
composer.addPass(bloomPass);

// Paleta de Colores
const colorPalette = [
  { name: 'Azul Eléctrico', hex: '#eef4ff', lightHex: 0x00aaff },
  { name: 'Cyan Neón', hex: '#00ffff', lightHex: 0x00ffff },
  { name: 'Magenta Plasma', hex: '#ff00aa', lightHex: 0xff00aa },
  { name: 'Violeta Eléctrico', hex: '#a000ff', lightHex: 0xa000ff },
  { name: 'Amarillo Dorado', hex: '#ffaa00', lightHex: 0xffaa00 },
  { name: 'Verde Radiactivo', hex: '#00ff66', lightHex: 0x00ff66 },
  { name: 'Rojo Fuego', hex: '#ff2200', lightHex: 0xff2200 }
];
let currentColorIndex = 0;
const colorTxt = document.getElementById('color-txt');
const modoTxt = document.getElementById('modo-txt');

// --- 2. RAYO PRINCIPAL DEL CIELO ---
const MAX_POINTS = 24;
const BOLT_HEIGHT = 40.0;

const lightningShader = {
  uniforms: {
    uPoints: { value: Array.from({ length: MAX_POINTS }, () => new THREE.Vector2()) },
    uCount: { value: 0 },
    uColor: { value: new THREE.Color(colorPalette[0].hex).multiplyScalar(5) },
    uOpacity: { value: 0 },
    uWidth: { value: 0.035 },
    uErode: { value: 0 },
    uNoiseBoost: { value: 1.0 },
    uSeed: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec2 uPoints[${MAX_POINTS}];
    uniform int uCount;
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uWidth;
    uniform float uErode;
    uniform float uNoiseBoost;
    uniform float uSeed;

    varying vec2 vUv;

    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float fbm(float y, float seed) {
      float sum = 0.0, amp = 1.0, freq = 2.5, norm = 0.0;
      for (int i = 0; i < 10; i++) {
        sum += snoise(vec2(y * freq, seed + float(i) * 17.0)) * amp;
        norm += amp;
        freq *= 3.0;
        amp *= 0.5;
      }
      return sum / norm;
    }

    float sdSegment(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * h);
    }

    void main() {
      vec2 p = vUv;
      p.x += fbm(p.y, uSeed) * 0.04 * uNoiseBoost;

      float dist = 1e9;
      for (int i = 0; i < ${MAX_POINTS - 1}; i++) {
        if (i >= uCount - 1) break;
        vec2 a = uPoints[i];
        vec2 b = uPoints[i + 1];

        vec2 start = a + (b - a) * uErode;
        dist = min(dist, sdSegment(p, start, b));
      }

      float width = uWidth;
      float stroke = 1.0 - smoothstep(width * 0.3, width, dist);

      if (stroke <= 0.001) discard;

      vec3 col = uColor * stroke;
      float alpha = stroke * uOpacity;

      gl_FragColor = vec4(col, alpha);
    }
  `
};

const boltGeo = new THREE.PlaneGeometry(8, BOLT_HEIGHT);
const boltMat = new THREE.ShaderMaterial({
  ...lightningShader,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const boltMesh = new THREE.Mesh(boltGeo, boltMat);
boltMesh.visible = false;
scene.add(boltMesh);

// --- 3. GENERADOR DE RAYOS PROCEDURALES INTER-AGENTES ---
class ProceduralLightning3D {
  constructor(scene, colorHex = 0x00aaff) {
    this.scene = scene;
    this.maxPoints = 16;
    this.group = new THREE.Group();

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxPoints * 3 * 2), 3));
    this.material = new THREE.LineBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    this.line = new THREE.LineSegments(this.geometry, this.material);

    this.coreGeometry = new THREE.BufferGeometry();
    this.coreGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxPoints * 3 * 2), 3));
    this.coreMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    this.coreLine = new THREE.LineSegments(this.coreGeometry, this.coreMaterial);

    this.group.add(this.line);
    this.group.add(this.coreLine);
    this.scene.add(this.group);
    this.hide();
  }

  update(src, dst) {
    const dir = new THREE.Vector3().subVectors(dst, src);
    const len = dir.length();
    if (len < 0.1) {
      this.hide();
      return;
    }

    const numSegments = 12;
    const points = [src.clone()];

    const normDir = dir.clone().normalize();
    const up = Math.abs(normDir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(normDir, up).normalize();
    const perp = new THREE.Vector3().crossVectors(normDir, side).normalize();

    for (let i = 1; i < numSegments; i++) {
      const progress = i / numSegments;
      const basePoint = new THREE.Vector3().copy(src).lerp(dst, progress);
      const envelope = Math.sin(progress * Math.PI) * len * 0.12;

      const offsetX = (Math.random() - 0.5) * 2 * envelope;
      const offsetY = (Math.random() - 0.5) * 2 * envelope;

      basePoint.addScaledVector(side, offsetX);
      basePoint.addScaledVector(perp, offsetY);
      points.push(basePoint);
    }
    points.push(dst.clone());

    const arr = this.geometry.attributes.position.array;
    const coreArr = this.coreGeometry.attributes.position.array;

    let idx = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      arr[idx] = p1.x; arr[idx + 1] = p1.y; arr[idx + 2] = p1.z;
      coreArr[idx] = p1.x; coreArr[idx + 1] = p1.y; coreArr[idx + 2] = p1.z;
      idx += 3;

      arr[idx] = p2.x; arr[idx + 1] = p2.y; arr[idx + 2] = p2.z;
      coreArr[idx] = p2.x; coreArr[idx + 1] = p2.y; coreArr[idx + 2] = p2.z;
      idx += 3;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.coreGeometry.attributes.position.needsUpdate = true;
    this.geometry.setDrawRange(0, (points.length - 1) * 2);
    this.coreGeometry.setDrawRange(0, (points.length - 1) * 2);

    this.line.visible = true;
    this.coreLine.visible = true;
  }

  setColor(hex) {
    this.material.color.setHex(hex);
  }

  hide() {
    this.line.visible = false;
    this.coreLine.visible = false;
  }
}

// --- 4. SISTEMA DE 600 PARTÍCULAS / AGENTES ---
const NUM_PARTICLES = 600;
const particleGeo = new THREE.DodecahedronGeometry(0.35, 0);
const particleMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  wireframe: true,
  emissive: colorPalette[0].lightHex,
  emissiveIntensity: 1.4
});

const particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, NUM_PARTICLES);
scene.add(particleMesh);

const particlePositions = new Float32Array(NUM_PARTICLES * 3);
const particleVelocities = new Float32Array(NUM_PARTICLES * 3);
const particleRotations = new Float32Array(NUM_PARTICLES * 3);
const dummy = new THREE.Object3D();

for (let i = 0; i < NUM_PARTICLES; i++) {
  const i3 = i * 3;
  particlePositions[i3] = (Math.random() - 0.5) * 240;
  particlePositions[i3 + 1] = 1.5 + Math.random() * 22;
  particlePositions[i3 + 2] = (Math.random() - 0.5) * 240;

  particleVelocities[i3] = (Math.random() - 0.5) * 0.12;
  particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.04;
  particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.12;

  particleRotations[i3] = Math.random() * Math.PI;
  particleRotations[i3 + 1] = Math.random() * Math.PI;
  particleRotations[i3 + 2] = 0;
}

let activeMode = 1;
const modeWeights = {
  1: { flow: 0.2, seek: 0.0, maxSpeed: 0.12, name: '1 — Flocking (Enjambre Masivo)' },
  2: { flow: 1.8, seek: 0.0, maxSpeed: 0.25, name: '2 — Flow Field (Turbulencia Espacial)' },
  3: { flow: 0.1, seek: 2.2, maxSpeed: 0.35, name: '3 — Atracción (Plasma Concentrado)' }
};

const MAX_ARCS = 150;
const arcPool = Array.from({ length: MAX_ARCS }, () => new ProceduralLightning3D(scene, colorPalette[0].lightHex));

// --- 5. SHADER Y CLASE DE ONDA DE CHOQUE ESFÉRICA CON CORTE DE INTERSECCIÓN BRILLANTE ---
const shockwaveShader = {
  uniforms: {
    uColor: { value: new THREE.Color(colorPalette[0].hex).multiplyScalar(3.5) },
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uFresnelPower: { value: 2.0 }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uProgress;
    uniform float uFresnelPower;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      
      // Fresnel Effect en el borde de la esfera
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), uFresnelPower);
      
      // Intersección / Corte deslumbrante con el Suelo (y = 0)
      float floorIntersect = smoothstep(1.2, 0.0, abs(vWorldPosition.y));
      
      // Intersección con la franja de altura de los Cubos (y en rango 0 a 4.0)
      float boxIntersect = smoothstep(4.5, 0.0, vWorldPosition.y) * 0.7;

      // Ruido de plasma eléctrico animado
      float noise = snoise(vUv * 12.0 + vec2(uTime * 8.0, uTime * 4.0));
      float electric = smoothstep(0.2, 0.8, noise);

      // Latido de brillo ecuatorial
      float equatorGlow = smoothstep(0.35, 0.0, abs(vUv.y - 0.5));

      // Desvanecimiento progresivo
      float fade = pow(1.0 - uProgress, 1.5);

      // Mezcla de opacidad y brillo reforzado
      float alpha = (fresnel * 1.3 + floorIntersect * 2.8 + boxIntersect * 1.2 + electric * 0.9 + equatorGlow * 0.7) * fade;

      if (alpha < 0.008) discard;

      // Color de emisión súper vivo con acento de corte en el piso
      vec3 col = uColor * (1.8 + floorIntersect * 2.2 + electric * 1.2);
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    }
  `
};

const shockwaveSphereGeo = new THREE.SphereGeometry(1, 32, 32);

class ElectricShockwave {
  constructor(scene) {
    this.scene = scene;
    this.maxRadius = 14.0;
    this.duration = 0.75;
    this.life = 0;
    this.active = false;
    this.center = new THREE.Vector3();

    this.mat = new THREE.ShaderMaterial({
      ...shockwaveShader,
      uniforms: {
        uColor: { value: new THREE.Color(colorPalette[0].hex).multiplyScalar(3.5) },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uFresnelPower: { value: 2.0 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.sphereMesh = new THREE.Mesh(shockwaveSphereGeo, this.mat);
    this.sphereMesh.visible = false;

    this.scene.add(this.sphereMesh);
  }

  spawn(point, colorHex) {
    this.center.copy(point);
    this.sphereMesh.position.copy(point);
    this.life = 0;
    this.active = true;
    this.sphereMesh.visible = true;

    this.mat.uniforms.uColor.value.setHex(colorHex).multiplyScalar(3.5);
    this.mat.uniforms.uProgress.value = 0;
  }

  update(delta, elapsed) {
    if (!this.active) return;

    this.life += delta;
    const progress = Math.min(this.life / this.duration, 1.0);
    this.mat.uniforms.uProgress.value = progress;
    this.mat.uniforms.uTime.value = elapsed;

    const currentRadius = progress * this.maxRadius;
    this.sphereMesh.scale.set(currentRadius, currentRadius, currentRadius);

    // Impulso expansivo omnidireccional en 3D sobre las partículas
    const minR = Math.max(0, currentRadius - 3.0);
    const maxR = currentRadius + 1.5;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const i3 = i * 3;
      const dx = particlePositions[i3] - this.center.x;
      const dy = particlePositions[i3 + 1] - this.center.y;
      const dz = particlePositions[i3 + 2] - this.center.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq >= minR * minR && distSq <= maxR * maxR) {
        const dist = Math.sqrt(distSq) || 0.1;
        const impulse = (1.0 - progress) * 0.38;
        particleVelocities[i3] += (dx / dist) * impulse;
        particleVelocities[i3 + 1] += (dy / dist) * impulse;
        particleVelocities[i3 + 2] += (dz / dist) * impulse;
      }
    }

    if (progress >= 1.0) {
      this.active = false;
      this.sphereMesh.visible = false;
    }
  }

  setColor(hex) {
    this.mat.uniforms.uColor.value.setHex(hex).multiplyScalar(3.5);
  }
}

const shockwavePool = Array.from({ length: 8 }, () => new ElectricShockwave(scene));

function spawnShockwave(point, colorHex) {
  const sw = shockwavePool.find((s) => !s.active) || shockwavePool[0];
  sw.spawn(point, colorHex);
}

// --- FUNCIÓN PARA DETECTAR EL PUNTO DE MAYOR DENSIDAD DE PARTÍCULAS ---
function findHighestParticleDensityPoint() {
  const searchRadiusSq = 8.0 * 8.0;
  let maxNeighbors = -1;
  let bestX = 0, bestY = 3, bestZ = 0;

  for (let i = 0; i < NUM_PARTICLES; i++) {
    const i3 = i * 3;
    const px = particlePositions[i3];
    const py = particlePositions[i3 + 1];
    const pz = particlePositions[i3 + 2];

    let neighbors = 0;
    let sumX = px, sumY = py, sumZ = pz;

    for (let j = 0; j < NUM_PARTICLES; j++) {
      if (i === j) continue;
      const j3 = j * 3;
      const dx = particlePositions[j3] - px;
      const dy = particlePositions[j3 + 1] - py;
      const dz = particlePositions[j3 + 2] - pz;

      if (dx * dx + dy * dy + dz * dz < searchRadiusSq) {
        neighbors++;
        sumX += particlePositions[j3];
        sumY += particlePositions[j3 + 1];
        sumZ += particlePositions[j3 + 2];
      }
    }

    if (neighbors > maxNeighbors) {
      maxNeighbors = neighbors;
      bestX = sumX / (neighbors + 1);
      bestY = sumY / (neighbors + 1);
      bestZ = sumZ / (neighbors + 1);
    }
  }

  return new THREE.Vector3(bestX, bestY, bestZ);
}

// --- 6. DISPARO DE RAYO PRINCIPAL DEL CIELO ---
let strikeStart = -100;
let trauma = 0.0;
const strikePoint = new THREE.Vector3();

const FLICKER = [40, 10, 30, 5];
const FLICKER_STEP = 0.04;

function triggerLightningStrike(point) {
  strikePoint.copy(point);

  boltMesh.position.set(point.x, BOLT_HEIGHT / 2, point.z);
  boltMesh.rotation.y = Math.atan2(
    camera.position.x - boltMesh.position.x,
    camera.position.z - boltMesh.position.z
  );

  const points = [];
  let x = 0.5;
  let y = 0.0;
  let count = 0;
  points.push(new THREE.Vector2(x, y));
  count++;

  while (y < 1.0 && count < MAX_POINTS) {
    const lean = (Math.random() - 0.5) * 0.45;
    const len = 0.05 + Math.random() * 0.12;
    x += Math.sin(lean) * len;
    y += Math.cos(lean) * len;
    points.push(new THREE.Vector2(x, y));
    count++;
  }

  for (let i = 0; i < MAX_POINTS; i++) {
    if (i < points.length) {
      boltMat.uniforms.uPoints.value[i].copy(points[i]);
    } else {
      boltMat.uniforms.uPoints.value[i].set(0, 0);
    }
  }
  boltMat.uniforms.uCount.value = count;
  boltMat.uniforms.uOpacity.value = 1.0;
  boltMat.uniforms.uWidth.value = 0.035;
  boltMat.uniforms.uErode.value = 0.0;
  boltMat.uniforms.uNoiseBoost.value = 1.0;
  boltMat.uniforms.uSeed.value = Math.random() * 100.0;

  boltMesh.visible = true;

  strikeLight.position.set(point.x, 1.5, point.z);
  cloudFlashLight.position.set(point.x, 35, point.z);

  strikeStart = clock.getElapsedTime();
  trauma = 0.4;
}

// --- 7. CONTROLES E INTERACCIÓN ---
let pointerDownPos = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (e) => {
  pointerDownPos.x = e.clientX;
  pointerDownPos.y = e.clientY;
});

window.addEventListener('pointerup', (event) => {
  if (event.target.id === 'btn-audio' || event.target.closest('#ui-overlay')) return;

  const dx = event.clientX - pointerDownPos.x;
  const dy = event.clientY - pointerDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) < 6) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(floor);

    if (intersects.length > 0 && intersects[0].distance < 400) {
      triggerLightningStrike(intersects[0].point);
    }
  }
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    const rx = (Math.random() - 0.5) * 60;
    const rz = (Math.random() - 0.5) * 60;
    triggerLightningStrike(new THREE.Vector3(rx, 0, rz));
  } else if (event.code === 'KeyE') {
    // Activar Onda Esférica en el punto de densidad máxima del enjambre
    const densityPoint = findHighestParticleDensityPoint();
    spawnShockwave(densityPoint, colorPalette[currentColorIndex].lightHex);
  } else if (event.code === 'KeyC') {
    currentColorIndex = (currentColorIndex + 1) % colorPalette.length;
    const activeColor = colorPalette[currentColorIndex];

    boltMat.uniforms.uColor.value = new THREE.Color(activeColor.hex).multiplyScalar(5);
    strikeLight.color.setHex(activeColor.lightHex);
    cloudFlashLight.color.setHex(activeColor.lightHex);

    particleMat.emissive.setHex(activeColor.lightHex);
    arcPool.forEach((arc) => arc.setColor(activeColor.lightHex));
    shockwavePool.forEach((sw) => sw.setColor(activeColor.lightHex));

    if (colorTxt) colorTxt.innerText = activeColor.name;
  } else if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
    activeMode = parseInt(event.code.replace('Digit', ''));
    if (modoTxt) modoTxt.innerText = modeWeights[activeMode].name;
  }
});

// --- 8. AUDIO FFT (Fade Away.mp3) ---
const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

let analyser;
let audioLoaded = false;
let isAudioPlaying = false;
let prevPianoEnergy = 0;
let strikeCooldown = 0;

const btnAudio = document.getElementById('btn-audio');

btnAudio.addEventListener('click', (e) => {
  e.stopPropagation();

  if (!audioLoaded) {
    btnAudio.innerText = '⏳ Cargando audio...';
    audioLoader.load(
      'Fade Away.mp3',
      (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.85);
        sound.play();

        isAudioPlaying = true;
        analyser = new THREE.AudioAnalyser(sound, 128);
        audioLoaded = true;
        btnAudio.innerText = '⏸ Pausar Audio';
      },
      undefined,
      (error) => {
        console.error('Error al cargar audio:', error);
        btnAudio.innerText = '❌ Error al cargar audio';
      }
    );
  } else {
    if (isAudioPlaying) {
      sound.pause();
      isAudioPlaying = false;
      btnAudio.innerText = '▶ Reanudar Audio';
    } else {
      sound.play();
      isAudioPlaying = true;
      btnAudio.innerText = '⏸ Pausar Audio';
    }
  }
});

// --- 9. BUCLE DE ANIMACIÓN ---
const clock = new THREE.Clock();
const tempVecA = new THREE.Vector3();
const tempVecB = new THREE.Vector3();

const MIN_DIST_SQ = 0.6 * 0.6;
const MAX_DIST_SQ = 8.0 * 8.0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  controls.update();

  clouds.forEach((c) => {
    c.mesh.position.x += c.speed * delta * 4.0;
    if (c.mesh.position.x > 80) c.mesh.position.x = -80;
  });

  // 1. Actualizar Ondas Esféricas
  shockwavePool.forEach((sw) => sw.update(delta, elapsed));

  // 2. Bucle Físico y de Fuerza de las 600 Partículas
  const config = modeWeights[activeMode];
  const isBoltActive = boltMesh.visible;
  const particleRadius = 0.35;

  for (let i = 0; i < NUM_PARTICLES; i++) {
    const i3 = i * 3;

    let px = particlePositions[i3];
    let py = particlePositions[i3 + 1];
    let pz = particlePositions[i3 + 2];

    let vx = particleVelocities[i3];
    let vy = particleVelocities[i3 + 1];
    let vz = particleVelocities[i3 + 2];

    const angle = Math.sin(px * 0.05 + elapsed * 0.8) * Math.cos(pz * 0.05 + elapsed * 0.8) * Math.PI * 2;
    vx += Math.cos(angle) * config.flow * 0.008;
    vy += Math.sin(angle * 0.5) * config.flow * 0.003;
    vz += Math.sin(angle * 0.5) * config.flow * 0.008;

    if (isBoltActive && config.seek > 0) {
      const dx = strikePoint.x - px;
      const dy = strikePoint.y - py;
      const dz = strikePoint.z - pz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

      vx += (dx / dist) * config.seek * 0.02;
      vy += (dy / dist) * config.seek * 0.02;
      vz += (dz / dist) * config.seek * 0.02;
    }

    const speedSq = vx * vx + vy * vy + vz * vz;
    const maxSpd = config.maxSpeed;
    if (speedSq > maxSpd * maxSpd) {
      const spd = Math.sqrt(speedSq);
      vx = (vx / spd) * maxSpd;
      vy = (vy / spd) * maxSpd;
      vz = (vz / spd) * maxSpd;
    }

    px += vx;
    py += vy;
    pz += vz;

    const minHeight = 0.5;
    if (py < minHeight) {
      py = minHeight;
      if (vy < 0) vy *= -0.5;
    }

    for (let bIdx = 0; bIdx < boxes.length; bIdx++) {
      const b = boxes[bIdx];
      if (py - particleRadius < b.height && py + particleRadius > 0) {
        const dx = px - b.x;
        const dz = pz - b.z;
        const distSq = dx * dx + dz * dz;
        const minDist = b.radius + particleRadius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;

          px += nx * overlap;
          pz += nz * overlap;

          const dot = vx * nx + vz * nz;
          if (dot < 0) {
            vx -= 1.4 * dot * nx;
            vz -= 1.4 * dot * nz;
          }
        }
      }
    }

    if (Math.abs(px) > 130) vx *= -1;
    if (py > 28) vy *= -1;
    if (Math.abs(pz) > 130) vz *= -1;

    particlePositions[i3] = px;
    particlePositions[i3 + 1] = py;
    particlePositions[i3 + 2] = pz;

    particleVelocities[i3] = vx;
    particleVelocities[i3 + 1] = vy;
    particleVelocities[i3 + 2] = vz;

    particleRotations[i3] += 0.01;
    particleRotations[i3 + 1] += 0.015;

    dummy.position.set(px, py, pz);
    dummy.rotation.set(particleRotations[i3], particleRotations[i3 + 1], particleRotations[i3 + 2]);
    dummy.updateMatrix();
    particleMesh.setMatrixAt(i, dummy.matrix);
  }
  particleMesh.instanceMatrix.needsUpdate = true;

  // 3. Conectar Partículas Cercanas
  let arcIdx = 0;
  arcPool.forEach((arc) => arc.hide());

  for (let i = 0; i < NUM_PARTICLES && arcIdx < MAX_ARCS; i++) {
    const i3 = i * 3;
    const ax = particlePositions[i3];
    const ay = particlePositions[i3 + 1];
    const az = particlePositions[i3 + 2];

    for (let j = i + 1; j < NUM_PARTICLES && arcIdx < MAX_ARCS; j++) {
      const j3 = j * 3;
      const dx = particlePositions[j3] - ax;
      const dy = particlePositions[j3 + 1] - ay;
      const dz = particlePositions[j3 + 2] - az;

      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > MIN_DIST_SQ && distSq < MAX_DIST_SQ) {
        tempVecA.set(ax, ay, az);
        tempVecB.set(particlePositions[j3], particlePositions[j3 + 1], particlePositions[j3 + 2]);
        arcPool[arcIdx].update(tempVecA, tempVecB);
        arcIdx++;
      }
    }
  }

  // 4. Audio FFT
  if (audioLoaded && analyser && isAudioPlaying && sound.isPlaying) {
    const freqData = analyser.getFrequencyData();
    let pianoEnergy = 0;
    for (let k = 2; k <= 22; k++) pianoEnergy += freqData[k];
    pianoEnergy /= 21;

    const deltaPiano = pianoEnergy - prevPianoEnergy;
    prevPianoEnergy = pianoEnergy;

    if (deltaPiano > 2.6 && pianoEnergy > 16 && strikeCooldown <= 0) {
      const rx = (Math.random() - 0.5) * 40;
      const rz = (Math.random() - 0.5) * 40;
      triggerLightningStrike(new THREE.Vector3(rx, 0, rz));
      strikeCooldown = 6;
    }
    if (strikeCooldown > 0) strikeCooldown--;
  }

  // 5. Parpadeo y Fade Out del Rayo del Cielo
  const t = elapsed - strikeStart;

  if (boltMesh.visible) {
    boltMesh.rotation.y = Math.atan2(
      camera.position.x - boltMesh.position.x,
      camera.position.z - boltMesh.position.z
    );

    if (t < FLICKER.length * FLICKER_STEP) {
      const stepIdx = Math.floor(t / FLICKER_STEP);
      bloomPass.strength = FLICKER[stepIdx] * 0.12;
      strikeLight.intensity = FLICKER[stepIdx] * 12.0;
      cloudFlashLight.intensity = FLICKER[stepIdx] * 18.0;
    } else {
      bloomPass.strength = THREE.MathUtils.damp(bloomPass.strength, 0.8, 4.0, delta);
      strikeLight.intensity = THREE.MathUtils.damp(strikeLight.intensity, 0, 5.0, delta);
      cloudFlashLight.intensity = THREE.MathUtils.damp(cloudFlashLight.intensity, 0, 6.0, delta);

      boltMat.uniforms.uOpacity.value = THREE.MathUtils.damp(boltMat.uniforms.uOpacity.value, 0, 5.0, delta);
      boltMat.uniforms.uWidth.value = THREE.MathUtils.damp(boltMat.uniforms.uWidth.value, 0, 4.0, delta);
      boltMat.uniforms.uErode.value = THREE.MathUtils.damp(boltMat.uniforms.uErode.value, 0.35, 3.0, delta);
      boltMat.uniforms.uNoiseBoost.value = THREE.MathUtils.damp(boltMat.uniforms.uNoiseBoost.value, 3.5, 2.5, delta);

      if (boltMat.uniforms.uOpacity.value < 0.02) {
        boltMesh.visible = false;
      }
    }
  }

  // 6. Sacudida de Cámara
  if (trauma > 0) {
    const phase = elapsed * 24;
    const amp = trauma * 0.012;
    camera.rotation.x += Math.sin(phase) * amp;
    camera.rotation.y += Math.sin(phase * 1.618) * amp;
    trauma = THREE.MathUtils.damp(trauma, 0, 10.0, delta);
  }

  composer.render();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});