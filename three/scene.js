// Visor 3D de la bolsa, escena v3 (sin lata). three.js r169 (MIT), copia local.
// El puente de la ficha está en src/lib/visor-3d.ts y pasa frontUrl y backUrl.
// FOLKS · escena 3D procedural (v3) (sin modelos externos). three.js r169 (MIT), copia local en vendor/.
import * as THREE from "./three.module.min.js";

const C = { cr: 0xF5E6D3, b: 0x561A28, lb: 0xADC4EA, pk: 0xF0AAA6, ro: 0xF33B0B, mu: 0xCFA545 };
const FACES = ['el frente', 'el costado derecho', 'el dorso', 'el costado izquierdo'];

function loadTex(url, renderer) {
  return new THREE.TextureLoader().loadAsync(url).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  });
}

// Bolsa con fondo plano: caja subdividida, frente y dorso abombados y la parte de arriba aplastada en el sellado.
function makeBag(front, back) {
  const W = 1.28, H = 1.9, D = 0.62;
  const g = new THREE.BoxGeometry(W, H, D, 20, 28, 8);
  const p = g.attributes.position, v = new THREE.Vector3();
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const yn = (v.y + H / 2) / H;                 // 0 abajo, 1 arriba
    const xn = v.x / (W / 2);                     // -1..1
    const pinch = 1 - 0.93 * sm(0.72, 0.93, yn);  // el sellado de arriba queda casi plano
    const bulge = 1 + 0.16 * Math.cos(xn * Math.PI / 2) * Math.sin(Math.PI * Math.min(1, yn / 0.9));
    v.z *= pinch * bulge;
    v.x *= 1 - 0.035 * sm(0.75, 1, yn) + 0.02 * Math.sin(Math.PI * yn); // leve cintura de bolsa real
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const side = new THREE.MeshStandardMaterial({ color: C.b, roughness: 0.85 });
  const mats = [side, side,
    new THREE.MeshStandardMaterial({ color: 0xE8D5BF, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xE8D5BF, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: front, roughness: 0.75 }),
    new THREE.MeshStandardMaterial({ map: back, roughness: 0.75 })];
  const m = new THREE.Mesh(g, mats); m.position.y = H / 2; return m;
}

// Granos y lunares (v3, revisión de Julia #2): pocos lunares grandes, en 3 tamaños, que miran siempre a cámara
// (billboard: nunca quedan de canto, así no parecen confeti). Mostaza y naranja: el naranja va como forma, nunca en texto.
function makeConfetti(nBeans, nDots, spread = 0.9) {
  const bean = new THREE.SphereGeometry(0.085, 10, 8); bean.scale(1, 0.72, 0.5);
  const beans = new THREE.InstancedMesh(bean, new THREE.MeshStandardMaterial({ color: C.b, roughness: 0.6 }), nBeans);
  const dot = new THREE.CircleGeometry(1, 32);
  const dots = new THREE.InstancedMesh(dot, new THREE.MeshBasicMaterial(), nDots);
  const pal = [C.mu, C.ro].map((c) => new THREE.Color(c));
  const SIZES = [0.12, 0.17, 0.24];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3();
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bData = [], dData = [];
  for (let i = 0; i < nBeans; i++) {
    const side = rnd() < 0.5 ? -1 : 1;  // siempre a los costados o detrás: nunca tapan la etiqueta
    bData.push({ p: new THREE.Vector3(side * (1.2 + rnd() * 1.2), 0.15 + rnd() * 2.3, -0.6 - rnd() * 2.0), e: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), ph: rnd() * 6 });
  }
  for (let i = 0; i < nDots; i++) {
    // Repartidos parejo (alternando lados y alturas) para que no se amontonen
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), rows = Math.ceil(nDots / 2);
    dData.push({ p: new THREE.Vector3(side * (1.2 + rnd() * spread), 0.3 + (row + 0.2 + rnd() * 0.6) * (2.4 / rows), -0.7 - rnd() * 1.6), s: SIZES[(i * 2 + row) % 3], ph: rnd() * 6 });
    dots.setColorAt(i, pal[(i + row) % 2]);
  }
  const update = (t, camQ) => {
    for (let i = 0; i < nBeans; i++) {
      const d = bData[i]; v.set(d.p.x, d.p.y + Math.sin(t * 0.8 + d.ph) * 0.06, d.p.z);
      q.setFromEuler(e.set(d.e.x + t * 0.2, d.e.y + t * 0.3, d.e.z)); m.compose(v, q, one); beans.setMatrixAt(i, m);
    }
    for (let i = 0; i < nDots; i++) {
      const d = dData[i]; v.set(d.p.x, d.p.y + Math.sin(t * 0.6 + d.ph) * 0.05, d.p.z);
      m.compose(v, camQ, sc.set(d.s, d.s, d.s)); dots.setMatrixAt(i, m);   // misma orientación que la cámara = de frente
    }
    beans.instanceMatrix.needsUpdate = dots.instanceMatrix.needsUpdate = true;
  };
  return { beans, dots, update };
}

function shadowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(86,26,40,.38)'); g.addColorStop(1, 'rgba(86,26,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

export async function createViewer(canvas, { calm = false, live, onLost, frontUrl = "/folks-prototipo/three/tex/bolsa_frente.webp", backUrl = "/folks-prototipo/three/tex/bolsa_dorso.webp" } = {}) {
  const mobile = matchMedia('(max-width: 820px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'low-power', alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(C.lb);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b8a8, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 4, 5); scene.add(key);

  const [front, back] = await Promise.all([frontUrl, backUrl].map((u) => loadTex(u, renderer)));
  const pivot = new THREE.Group(); scene.add(pivot);
  const bag = makeBag(front, back);
  pivot.add(bag);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.005; scene.add(sh);
  const conf = makeConfetti(mobile ? 12 : 18, mobile ? 8 : 12, mobile ? 0.5 : 0.9); scene.add(conf.beans, conf.dots);

  // Estado de cámara/rotación
  const st = { yaw: -0.35, pitch: 0.05, zoom: 1, tYaw: -0.35, tPitch: 0.05, tZoom: 1, spin: !calm, vel: 0 };
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.updateProjectionMatrix(); dirty = true;
  };
  let dirty = true; const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  let lastFace = 0;
  const announce = (force = true) => {
    const a = ((-st.tYaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const f = Math.round(a / (Math.PI / 2)) % 4;
    if (force || f !== lastFace) { lastFace = f; live && (live.textContent = `Mostrando ${FACES[f]} de la bolsa.`); }
  };
  const stopSpin = () => { st.spin = false; };

  // Arrastre (mouse/touch): solo eje horizontal para no secuestrar el scroll vertical (touch-action: pan-y)
  let drag = null;
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); stopSpin(); };
  const onMove = (e) => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    st.tYaw += dx * 0.012; st.tPitch = THREE.MathUtils.clamp(st.tPitch + dy * 0.006, -0.35, 0.45); st.vel = calm ? 0 : dx * 0.0016; dirty = true;
  };
  const up = () => { if (drag) { drag = null; announce(false); } };
  const onKey = (e) => {
    const k = e.key; let used = true;
    if (k === 'ArrowLeft') ctl.rotate(-1); else if (k === 'ArrowRight') ctl.rotate(1);
    else if (k === 'ArrowUp') st.tPitch = Math.max(-0.35, st.tPitch - 0.15); else if (k === 'ArrowDown') st.tPitch = Math.min(0.45, st.tPitch + 0.15);
    else if (k === '+' || k === '=') st.tZoom = Math.min(1.5, st.tZoom + 0.15); else if (k === '-') st.tZoom = Math.max(0.8, st.tZoom - 0.15);
    else if (k === 'Home' || k === '0') ctl.reset(); else used = false;
    if (used) { e.preventDefault(); stopSpin(); dirty = true; }
  };
  const onContextLost = (e) => { e.preventDefault(); running = false; onLost && onLost(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('keydown', onKey);

  let visible = true;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }); io.observe(canvas);
  canvas.addEventListener('webglcontextlost', onContextLost);

  // Métricas para la medición (renderer.info + FPS)
  const stats = window.__folksStats = { frames: 0, fpsSamples: [], triangles: 0, calls: 0, textures: 0, geometries: 0 };
  let running = true, last = performance.now(), acc = 0, accN = 0, t0 = performance.now(), confT = 0;
  // v3 (Julia #16): cámara más cerca (r 5,3 → 4,4) para que la etiqueta y el sello se vean más grandes.
  const placeCamera = () => { const r = 4.4 / st.zoom; camera.position.set(0, 1.0 + Math.sin(st.pitch) * r, Math.cos(st.pitch) * r); camera.lookAt(0, 0.95, 0); };
  const loop = (now) => {
    if (!running) return; requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    acc += dt; accN++; if (acc >= 1) { stats.fpsSamples.push(accN / acc); acc = 0; accN = 0; }
    if (st.spin) { st.tYaw -= dt * 0.45; dirty = true; }
    if (Math.abs(st.vel) > 1e-4) { st.tYaw += st.vel; st.vel *= 0.92; dirty = true; }
    const k = calm ? 1 : 1 - Math.pow(0.0015, dt);       // movimiento reducido: sin interpolación
    st.yaw += (st.tYaw - st.yaw) * k; st.pitch += (st.tPitch - st.pitch) * k; st.zoom += (st.tZoom - st.zoom) * k;
    // v3 (Julia #16): las partículas se mueven solo los primeros 6 s y mientras gira solo; "Pausar giro" o arrastrar las frena.
    const animConf = !calm && st.spin && now - t0 < 6000;
    const moving = Math.abs(st.tYaw - st.yaw) > 1e-3 || Math.abs(st.tPitch - st.pitch) > 1e-3 || Math.abs(st.tZoom - st.zoom) > 1e-3;
    if (!dirty && !animConf && !moving) return;   // render bajo demanda
    pivot.rotation.y = st.yaw;
    placeCamera();
    if (animConf || dirty || moving) conf.update(confT = animConf ? (now - t0) / 1000 : confT, camera.quaternion);
    renderer.render(scene, camera); stats.frames++; dirty = false;
    const i = renderer.info; stats.triangles = i.render.triangles; stats.calls = i.render.calls; stats.textures = i.memory.textures; stats.geometries = i.memory.geometries;
    // El giro automático no anuncia nada: el lector de pantalla solo habla cuando la persona gira.
  };
  requestAnimationFrame(loop);
  placeCamera(); conf.update(0, camera.quaternion); renderer.render(scene, camera);

  const ctl = {
    rotate(dir) { stopSpin(); st.tYaw -= dir * Math.PI / 2; dirty = true; announce(); },
    reset() { stopSpin(); st.tYaw = Math.round(st.tYaw / (2 * Math.PI)) * 2 * Math.PI; st.tPitch = 0.05; st.tZoom = 1; dirty = true; announce(); },
    get spinning() { return st.spin; },
    toggleSpin() { st.spin = !st.spin; dirty = true; return st.spin; },
    dispose() {
      running = false; io.disconnect(); ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
    },
    setDecor(on) { conf.beans.visible = conf.dots.visible = on; dirty = true; },   // solo para generar la imagen fija sin recortes
    setYaw(y) { st.yaw = st.tYaw = y; st.spin = false; dirty = true; },
  };
  window.__folksCtl = ctl;
  return ctl;
}
