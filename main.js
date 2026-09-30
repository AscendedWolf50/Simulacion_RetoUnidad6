import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- CONFIGURACIÓN DE ESCENA Y CÁMARA BAJA ---[cite: 28]
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Niebla exponencial en negro para horizonte infinito[cite: 28]
scene.fog = new THREE.FogExp2(0x000000, 0.025);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
// Cámara baja para ocultar el origen superior del rayo
camera.position.set(0, 3.5, 16);
camera.lookAt(0, 2, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Luces[cite: 28]
const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(6, 12, 5);
dirLight.castShadow = true;
scene.add(dirLight);

// Luz puntual del impacto en el suelo
const strikeLight = new THREE.PointLight(0x88ccff, 0, 30);
strikeLight.castShadow = true;
scene.add(strikeLight);

// Suelo con sombras[cite: 28]
const floorGeo = new THREE.PlaneGeometry(70, 70);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x111115,
  roughness: 0.8,
  metalness: 0.2
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Obstáculos en el suelo para proyectar sombras
const boxGeo = new THREE.BoxGeometry(1, 2, 1);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5 });
for (let i = 0; i < 35; i++) {
  const box = new THREE.Mesh(boxGeo, boxMat);
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * 20;
  box.position.set(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
}

// Post-Procesamiento: Bloom
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.8
);

const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);

// --- PALETA DE COLORES E INTERFAZ ---
const colorPalette = [
  { name: 'Azul Eléctrico', hex: '#eef4ff', lightHex: 0x88ccff },
  { name: 'Cyan Neón', hex: '#00ffff', lightHex: 0x00ffff },
  { name: 'Magenta Plasma', hex: '#ff00aa', lightHex: 0xff00aa },
  { name: 'Violeta Eléctrico', hex: '#a000ff', lightHex: 0xa000ff },
  { name: 'Amarillo Dorado', hex: '#ffaa00', lightHex: 0xffaa00 },
  { name: 'Verde Radiactivo', hex: '#00ff66', lightHex: 0x00ff66 },
  { name: 'Rojo Fuego', hex: '#ff2200', lightHex: 0xff2200 }
];
let currentColorIndex = 0;
const colorTxt = document.getElementById('color-txt');

// --- SHADERMATERIAL Y GEOMETRÍA DEL RAYO ---[cite: 29, 31, 33]
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

// --- GENERACIÓN DE CADENA Y ANIMACIÓN ---[cite: 30, 32]
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
  trauma = 1.0;
}

// --- INTERACCIÓN Y CONTROLES TECLADO ---[cite: 29]
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
  if (event.target.id === 'btn-audio' || event.target.closest('#ui-overlay')) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(floor);

  if (intersects.length > 0) {
    if (intersects[0].distance < 30) {
      triggerLightningStrike(intersects[0].point);
    }
  }
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    const rx = (Math.random() - 0.5) * 20;
    const rz = (Math.random() - 0.5) * 15;
    triggerLightningStrike(new THREE.Vector3(rx, 0, rz));
  } else if (event.code === 'KeyC') {
    currentColorIndex = (currentColorIndex + 1) % colorPalette.length;
    const activeColor = colorPalette[currentColorIndex];

    boltMat.uniforms.uColor.value = new THREE.Color(activeColor.hex).multiplyScalar(5);
    strikeLight.color.setHex(activeColor.lightHex);

    if (colorTxt) {
      colorTxt.innerText = activeColor.name;
    }
  }
});

// --- AUDIO Y REPRODUCCIÓN ---
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

// --- BUCLE DE ANIMACIÓN ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // 1. SINCRONIZACIÓN DE PIANO SENSIBLE (UMBRALES AJUSTADOS)
  if (audioLoaded && analyser && isAudioPlaying && sound.isPlaying) {
    const freqData = analyser.getFrequencyData();
    let pianoEnergy = 0;
    // Rango de frecuencias del piano (frecuencias medias/agudas)
    for (let k = 2; k <= 22; k++) pianoEnergy += freqData[k];
    pianoEnergy /= 21;

    const deltaPiano = pianoEnergy - prevPianoEnergy;
    prevPianoEnergy = pianoEnergy;

    // Umbrales reducidos: deltaPiano > 3.5 (antes 9.0) y pianoEnergy > 20 (antes 40)
    if (deltaPiano > 3.5 && pianoEnergy > 20 && strikeCooldown <= 0) {
      const rx = (Math.random() - 0.5) * 22;
      const rz = (Math.random() - 0.5) * 16;
      triggerLightningStrike(new THREE.Vector3(rx, 0, rz));
      strikeCooldown = 7; // Cooldown reducido para secuencias rápidas
    }
    if (strikeCooldown > 0) strikeCooldown--;
  }

  // 2. FADES, DESINTEGRACIÓN FBM Y PARPADEO[cite: 32, 33]
  const t = elapsed - strikeStart;

  if (boltMesh.visible) {
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

  // 3. SACUDIDA DE CÁMARA
  if (trauma > 0) {
    const phase = elapsed * 30;
    const amp = trauma * 0.03;
    camera.rotation.x = Math.sin(phase) * amp;
    camera.rotation.y = Math.sin(phase * 1.618) * amp;
    camera.rotation.z = Math.sin(phase * 0.882) * amp * 0.5;
    trauma = THREE.MathUtils.damp(trauma, 0, 8.0, delta);
  } else {
    camera.rotation.set(0, 0, 0);
  }

  composer.render();
}

animate();

// --- REAJUSTE DE VENTANA ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});