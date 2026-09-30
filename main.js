import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- 1. ESCENA, CÁMARA Y RENDERIZADOR ---
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);
scene.fog = new THREE.FogExp2(0x050508, 0.02);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 26);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Controles de cámara Orbit
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.target.set(0, 3, 0);

// Luces
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const strikeLight = new THREE.PointLight(0x00aaff, 0, 50);
strikeLight.castShadow = true;
scene.add(strikeLight);

// Suelo y Monolitos de Escenario
const floorGeo = new THREE.PlaneGeometry(80, 80);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.7, metalness: 0.3 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const boxGeo = new THREE.BoxGeometry(1.2, 2.5, 1.2);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3d, roughness: 0.5, metalness: 0.5 });
for (let i = 0; i < 25; i++) {
  const box = new THREE.Mesh(boxGeo, boxMat);
  const angle = Math.random() * Math.PI * 2;
  const radius = 6 + Math.random() * 18;
  box.position.set(Math.cos(angle) * radius, 1.25, Math.sin(angle) * radius);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
}

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

// --- 2. SHADERMATERIAL Y GEOMETRÍA DEL RAYO PRINCIPAL DEL CIELO ---
const MAX_POINTS = 24;
const BOLT_HEIGHT = 28.0;

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

// --- 4. AGENTES AUTÓNOMOS (DODECAEDROS WIREFRAME - UNIDAD 6) ---
const NUM_NODES = 8;
const nodeGeo = new THREE.DodecahedronGeometry(0.8, 0);

class AgentNode {
  constructor(id) {
    this.id = id;
    this.position = new THREE.Vector3(
      (Math.random() - 0.5) * 22,
      5 + Math.random() * 6,
      (Math.random() - 0.5) * 16
    );
    this.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.08);
    this.acceleration = new THREE.Vector3();
    this.maxSpeed = 0.08;
    this.maxForce = 0.005;
    this.perceptionRadius = 11.0;

    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      wireframe: true,
      emissive: colorPalette[0].lightHex,
      emissiveIntensity: 1.2
    });
    this.mesh = new THREE.Mesh(nodeGeo, this.mat);
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.clampLength(0, this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.set(0, 0, 0);

    this.mesh.rotation.x += 0.01;
    this.mesh.rotation.y += 0.015;
    this.mesh.position.copy(this.position);

    if (Math.abs(this.position.x) > 18) this.velocity.x *= -1;
    if (this.position.y < 3.5 || this.position.y > 14) this.velocity.y *= -1;
    if (Math.abs(this.position.z) > 14) this.velocity.z *= -1;
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  steer(target) {
    const desired = new THREE.Vector3().subVectors(target, this.position).setLength(this.maxSpeed);
    return new THREE.Vector3().subVectors(desired, this.velocity).clampLength(0, this.maxForce);
  }

  flock(nodes, weights) {
    let sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3();
    let count = 0;

    for (let other of nodes) {
      let d = this.position.distanceTo(other.position);
      if (other !== this && d < this.perceptionRadius) {
        if (d > 0.1) {
          let diff = new THREE.Vector3().subVectors(this.position, other.position).divideScalar(d * d);
          sep.add(diff);
        }
        ali.add(other.velocity);
        coh.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      sep.divideScalar(count);
      if (sep.lengthSq() > 0) sep.setLength(this.maxSpeed).sub(this.velocity).clampLength(0, this.maxForce);

      ali.divideScalar(count);
      if (ali.lengthSq() > 0) ali.setLength(this.maxSpeed).sub(this.velocity).clampLength(0, this.maxForce);

      coh.divideScalar(count);
      coh = this.steer(coh);
    }

    this.applyForce(sep.multiplyScalar(weights.sep));
    this.applyForce(ali.multiplyScalar(weights.ali));
    this.applyForce(coh.multiplyScalar(weights.coh));
  }

  flowField(time, weight) {
    const angle = Math.sin(this.position.x * 0.1 + time) * Math.cos(this.position.z * 0.1 + time) * Math.PI * 2;
    const flowVector = new THREE.Vector3(Math.cos(angle), Math.sin(angle * 0.5) * 0.2, Math.sin(angle)).setLength(this.maxSpeed);
    const steer = new THREE.Vector3().subVectors(flowVector, this.velocity).clampLength(0, this.maxForce);
    this.applyForce(steer.multiplyScalar(weight));
  }

  seekStrike(strikePos, weight) {
    const steer = this.steer(strikePos);
    this.applyForce(steer.multiplyScalar(weight));
  }
}

const agentNodes = Array.from({ length: NUM_NODES }, (_, i) => new AgentNode(i));

let activeMode = 1;
const modeWeights = {
  1: { sep: 1.5, ali: 1.0, coh: 1.2, flow: 0.4, seek: 0.0, name: '1 — Flocking (Red Estable)' },
  2: { sep: 0.8, ali: 0.3, coh: 0.2, flow: 2.0, seek: 0.0, name: '2 — Flow Field (Turbulencia)' },
  3: { sep: 0.5, ali: 0.1, coh: 2.5, flow: 0.3, seek: 1.8, name: '3 — Atracción (Plasma Concentrado)' }
};

const MAX_ARCS = 10;
const arcPool = Array.from({ length: MAX_ARCS }, () => new ProceduralLightning3D(scene, colorPalette[0].lightHex));

// --- 5. DISPARO DE RAYO PRINCIPAL DEL CIELO ---
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
    const lean = (Math.random() * 2 - 1) * 0.45;
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
  strikeStart = clock.getElapsedTime();
  trauma = 0.4;
}

// --- 6. CONTROLES E INTERACCIÓN ---
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

    if (intersects.length > 0 && intersects[0].distance < 35) {
      triggerLightningStrike(intersects[0].point);
    }
  }
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    const rx = (Math.random() - 0.5) * 22;
    const rz = (Math.random() - 0.5) * 16;
    triggerLightningStrike(new THREE.Vector3(rx, 0, rz));
  } else if (event.code === 'KeyC') {
    currentColorIndex = (currentColorIndex + 1) % colorPalette.length;
    const activeColor = colorPalette[currentColorIndex];

    boltMat.uniforms.uColor.value = new THREE.Color(activeColor.hex).multiplyScalar(5);
    strikeLight.color.setHex(activeColor.lightHex);

    agentNodes.forEach((node) => {
      node.mat.emissive.setHex(activeColor.lightHex);
    });

    arcPool.forEach((arc) => arc.setColor(activeColor.lightHex));

    if (colorTxt) colorTxt.innerText = activeColor.name;
  } else if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
    activeMode = parseInt(event.code.replace('Digit', ''));
    if (modoTxt) modoTxt.innerText = modeWeights[activeMode].name;
  }
});

// --- 7. AUDIO FFT (Fade Away.mp3) ---
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

// --- 8. BUCLE DE ANIMACIÓN ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  controls.update();

  // 1. Agentes Autónomos
  const weights = modeWeights[activeMode];
  const isBoltActive = boltMesh.visible;

  agentNodes.forEach((node) => {
    node.flock(agentNodes, weights);
    node.flowField(elapsed, weights.flow);

    if (isBoltActive && weights.seek > 0) {
      node.seekStrike(strikePoint, weights.seek);
    }

    node.update();
  });

  // 2. Conectar Agentes Cercanos con Rayos Inter-agentes
  let arcIdx = 0;
  arcPool.forEach((arc) => arc.hide());

  for (let i = 0; i < agentNodes.length; i++) {
    for (let j = i + 1; j < agentNodes.length; j++) {
      if (arcIdx >= MAX_ARCS) break;

      const nodeA = agentNodes[i];
      const nodeB = agentNodes[j];
      const dist = nodeA.position.distanceTo(nodeB.position);

      if (dist > 1.0 && dist < 11.0) {
        arcPool[arcIdx].update(nodeA.position, nodeB.position);
        arcIdx++;
      }
    }
  }

  // 3. Audio FFT (Sensibilidad equilibrada)
  if (audioLoaded && analyser && isAudioPlaying && sound.isPlaying) {
    const freqData = analyser.getFrequencyData();
    let pianoEnergy = 0;
    for (let k = 2; k <= 22; k++) pianoEnergy += freqData[k];
    pianoEnergy /= 21;

    const deltaPiano = pianoEnergy - prevPianoEnergy;
    prevPianoEnergy = pianoEnergy;

    // Umbrales calibrados para respuesta musical limpia sin saturación
    if (deltaPiano > 2.6 && pianoEnergy > 16 && strikeCooldown <= 0) {
      const rx = (Math.random() - 0.5) * 22;
      const rz = (Math.random() - 0.5) * 16;
      triggerLightningStrike(new THREE.Vector3(rx, 0, rz));
      strikeCooldown = 6;
    }
    if (strikeCooldown > 0) strikeCooldown--;
  }

  // 4. Parpadeo, FBM Erosion Fade y Billboarding del Rayo del Cielo
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
    } else {
      bloomPass.strength = THREE.MathUtils.damp(bloomPass.strength, 0.8, 4.0, delta);
      strikeLight.intensity = THREE.MathUtils.damp(strikeLight.intensity, 0, 5.0, delta);

      boltMat.uniforms.uOpacity.value = THREE.MathUtils.damp(boltMat.uniforms.uOpacity.value, 0, 5.0, delta);
      boltMat.uniforms.uWidth.value = THREE.MathUtils.damp(boltMat.uniforms.uWidth.value, 0, 4.0, delta);
      boltMat.uniforms.uErode.value = THREE.MathUtils.damp(boltMat.uniforms.uErode.value, 0.35, 3.0, delta);
      boltMat.uniforms.uNoiseBoost.value = THREE.MathUtils.damp(boltMat.uniforms.uNoiseBoost.value, 3.5, 2.5, delta);

      if (boltMat.uniforms.uOpacity.value < 0.02) {
        boltMesh.visible = false;
      }
    }
  }

  // 5. Sacudida de Cámara
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

// Reajuste de Ventana
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});