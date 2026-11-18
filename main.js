// Sonic Molecules: just-intonation chords and scales as balls and rods on a prime lattice.
// three.js loads from jsDelivr's ESM build; the addons import three from the same URL, so one copy is shared.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/controls/OrbitControls.js/+esm';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/environments/RoomEnvironment.js/+esm';

/* ================= music ================= */

const DIATONIC = { A: '#CF573C', B: '#73BED3', C: '#A53030', D: '#D7B594', E: '#3C5E8B', F: '#DA863E', G: '#4F8FBA' };
const PRIME = { '1': '#F9C74F', '3': '#F8961E', '5': '#F94144', '7': '#577590', '3·5': '#F3722C', '3·7': '#4D908E', '5·7': '#90BE6D', '3·5·7': '#43AA8B' };
const PRIME_LABEL = { '1': '1', '3': '3', '5': '5', '7': '7', '3·5': '3 & 5', '3·7': '3 & 7', '5·7': '5 & 7', '3·5·7': '3, 5 & 7' };
// Keyed by number of sharps (negative = flats); ±3 stands for three or more.
const ACCIDENTAL = { '-3': '#0F6385', '-2': '#358292', '-1': '#88ACA2', '0': '#ECD9AF', '1': '#E5A065', '2': '#E4723E', '3': '#DC4029' };
const ACCIDENTAL_LABEL = {
  '-3': ['♭♭♭+', 'Three or more flats'], '-2': ['♭♭', 'Double flat'], '-1': ['♭', 'Flat'], '0': ['♮', 'Natural'],
  '1': ['♯', 'Sharp'], '2': ['♯♯', 'Double sharp'], '3': ['♯♯♯+', 'Three or more sharps'],
};
const accKey = (acc) => String(Math.max(-3, Math.min(3, acc)));

// Steps along the line of fifths: 3 = a fifth, 5 = four fifths (major third).
// 7 is a setting: ten fifths up (raised sixth, 7/4 = B♯) or two fifths down (flat seventh, 7/4 = C).
const SEVEN_FIFTHS = { sixth: 10, seventh: -2 };
const LETTER_BY_FIFTH = ['D', 'A', 'E', 'B', 'F', 'C', 'G'];
const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n) => String(n).replace(/./g, (c) => SUP[c]);

function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
function smallestPrime(n) { for (let p = 2; p * p <= n; p++) if (n % p === 0) return p; return n; }
function exponents(n) {
  const e = [0, 0, 0, 0];
  [2, 3, 5, 7].forEach((p, i) => { while (n % p === 0) { n /= p; e[i]++; } });
  return { e, rest: n };
}

function noteName(e, sevenFifths) {
  const f = e[1] + 4 * e[2] + sevenFifths * e[3];
  const letter = LETTER_BY_FIFTH[((f % 7) + 7) % 7];
  const acc = Math.floor((f + 3) / 7);
  const sign = acc > 0 ? '♯' : '♭';
  const n = Math.abs(acc);
  const accidental = n === 0 ? '' : n <= 3 ? sign.repeat(n) : sign + sup(n);
  return { letter, acc, name: letter + accidental };
}

function makeNote(num, den) {
  const g = gcd(num, den); num /= g; den /= g;
  const label = `${num}/${den}`;
  const a = exponents(num), b = exponents(den);
  if (a.rest > 1 || b.rest > 1) return { label, badPrime: smallestPrime(a.rest > 1 ? a.rest : b.rest) };
  const e = a.e.map((x, i) => x - b.e[i]);
  const odd = [3, 5, 7].filter((p, i) => e[i + 1] !== 0);
  const ratio = num / den;
  return { n: num, d: den, label, e, ratio, cents: 1200 * Math.log2(ratio), pkey: odd.join('·') || '1' };
}

function parseNotes(text) {
  const notes = [], bad = [], high = [];
  for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
    let pairs;
    if (/^\d+(:\d+)+$/.test(tok)) {
      const parts = tok.split(':').map(Number);
      pairs = parts.map((p) => [p, parts[0]]);
    } else {
      const m = tok.match(/^(\d+)(?:\/(\d+))?$/);
      if (!m) { bad.push(tok); continue; }
      pairs = [[Number(m[1]), m[2] ? Number(m[2]) : 1]];
    }
    if (pairs.some(([n, d]) => !(n > 0 && d > 0) || n > Number.MAX_SAFE_INTEGER || d > Number.MAX_SAFE_INTEGER)) { bad.push(tok); continue; }
    for (const [n, d] of pairs) {
      const nt = makeNote(n, d);
      if (nt.badPrime) high.push(nt.label); else notes.push(nt);
    }
  }
  return { notes, bad, high };
}

function factorString(e) {
  const parts = [];
  [2, 3, 5, 7].forEach((p, i) => { if (e[i]) parts.push(e[i] === 1 ? String(p) : p + sup(e[i])); });
  return parts.join(' · ') || '1';
}

/* ================= state ================= */

const DIAMOND_7 = '1/1 8/7 7/6 6/5 5/4 4/3 7/5 10/7 3/2 8/5 5/3 12/7 7/4';
const PRESETS = [
  { id: 'diamond7', name: '7-limit tonality diamond', notes: DIAMOND_7 },
  { id: 'otonal', name: 'Otonal tetrad 4:5:6:7', notes: '4:5:6:7' },
  { id: 'utonal', name: 'Utonal tetrad 1/(4:5:6:7)', notes: '1/1 8/7 4/3 8/5' },
  { id: 'hexany', name: 'Hexany of 1, 3, 5, 7', notes: '3/2 5/4 7/4 15/8 21/16 35/32', rods: 'diagonal' },
  { id: 'major', name: 'Major triad 4:5:6', notes: '4:5:6' },
  { id: 'minor', name: 'Minor triad 10:12:15', notes: '10:12:15' },
  { id: 'ptolemy', name: 'Just major scale', notes: '1/1 9/8 5/4 4/3 3/2 5/3 15/8' },
  { id: 'diamond5', name: '5-limit tonality diamond', notes: '1/1 6/5 5/4 4/3 3/2 8/5 5/3' },
  { id: 'duodene', name: 'Ellis duodene', notes: '5/3 5/4 15/8 45/32\n4/3 1/1 3/2 9/8\n16/15 8/5 6/5 9/5' },
  { id: 'harmonics', name: 'Harmonics 1 to 6', notes: '1:2:3:4:5:6', lattice: '235' },
  { id: 'harmonics16', name: '5-limit harmonics up to 16', notes: '1 2 3 4 5 6 8 9 10 12 15 16', lattice: '235' },
];

const DEFAULTS = {
  notes: DIAMOND_7, lattice: '357', projection: 'ortho', colour: 'diatonic', labels: 'both',
  rods: 'straight', septimal: 'sixth', grid: true, axes: true, transparent: false,
};
const ENUMS = {
  lattice: ['357', '235'], projection: ['ortho', 'persp'], colour: ['diatonic', 'prime', 'accidental'],
  labels: ['none', 'ratio', 'note', 'both'], rods: ['none', 'straight', 'diagonal'], septimal: ['sixth', 'seventh'],
};
const STORE_KEY = 'sonic-molecules:v1';

function loadState() {
  const s = { ...DEFAULTS };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      if (typeof raw.notes === 'string') s.notes = raw.notes.slice(0, 5000);
      for (const k in ENUMS) if (ENUMS[k].includes(raw[k])) s[k] = raw[k];
      for (const k of ['grid', 'axes', 'transparent']) if (typeof raw[k] === 'boolean') s[k] = raw[k];
    }
  } catch (_) { /* storage unavailable: use defaults */ }
  return s;
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
}
const state = loadState();

const LATTICE_NAME = { '357': '3 · 5 · 7', '235': '2 · 3 · 5' };
const LATTICE_HINT = {
  '357': 'Octaves collapse onto one ball. 3 runs across, 5 up, 7 toward you.',
  '235': 'Octaves stay apart: 2 runs toward you, and an octave is as long as a step of 3 or 5. There is no direction for 7.',
};
const SEPTIMAL_HINT = {
  sixth: '7 is ten fifths up: 7/4 is B♯ and 8/7 is F♭.',
  seventh: '7 is two fifths down: 7/4 is C and 8/7 is E.',
};
const RODS_HINT = {
  none: { '357': 'Balls only.', '235': 'Balls only.' },
  straight: {
    '357': 'Joins notes one 3, 5 or 7 step apart, such as 1/1 and 3/2.',
    '235': 'Joins notes one 2, 3 or 5 step apart, such as 1/1 and 2/1, or 1/1 and 3/1.',
  },
  diagonal: {
    '357': 'Also joins notes one step apart on two or three axes at once, such as 1/1 and 3/5, or 1/1 and 105/1.',
    '235': 'Also joins notes one step apart on two or three axes at once, such as 1/1 and 3/2, or 1/1 and 15/2.',
  },
};

/* ================= three.js stage ================= */

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const glCanvas = $('gl');
const overlay = $('overlay');
const octx = overlay.getContext('2d');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
} catch (err) {
  $('empty').textContent = 'This browser cannot draw 3D graphics here (WebGL is unavailable).';
  $('empty').hidden = false;
  throw err;
}
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR());
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;

// Two cameras share one orbit; orthographic keeps parallel lines parallel so the front view is an exact 3–5 grid.
const FOV = 28;
const ORTHO_DIST = 60;
const persp = new THREE.PerspectiveCamera(FOV, 1, 0.05, 4000);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 4000);
let camera = state.projection === 'ortho' ? ortho : persp;
camera.position.set(4, 3.5, 7);

// Lights follow the active camera so every side of the model is lit the same way.
const lightRig = new THREE.Group();
scene.add(lightRig);
const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0, -1);
const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(-2.5, 3, 2);
keyLight.target = lightTarget;
const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(3, -1.5, 1);
fillLight.target = lightTarget;
lightRig.add(lightTarget, keyLight, fillLight);

const controls = new OrbitControls(camera, glCanvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.minDistance = 0.8;
controls.maxDistance = 800;
controls.minZoom = 0.005;
controls.maxZoom = 40;

const BALL_R = 0.21;
const ROD_R = 0.045;
const ballGeo = new THREE.SphereGeometry(BALL_R, 48, 32);
const rodGeo = new THREE.CylinderGeometry(ROD_R, ROD_R, 1, 20, 1, true);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const ballMats = new Map();
function ballMat(hex) {
  if (!ballMats.has(hex)) ballMats.set(hex, new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.34, metalness: 0 }));
  return ballMats.get(hex);
}
const rodMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.42, metalness: 0.2 });
const gridMat = new THREE.LineBasicMaterial({ color: 0xcccccc });
const molecule = new THREE.Group();
scene.add(molecule);
let gridLines = null;

let dirty = true;
let theme = {};
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function readTheme() {
  theme = { stage: cssVar('--stage'), ink: cssVar('--ink'), muted: cssVar('--muted'), rod: cssVar('--rod'), grid: cssVar('--gridline') };
  rodMat.color.set(theme.rod);
  gridMat.color.set(theme.grid);
  dirty = true;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);

/* ---------- model ---------- */

// Lattice coordinates: x = 3, y = 5, z = 7 (or 2). One unit per prime step on every axis.
function coords(nt) {
  return state.lattice === '357' ? [nt.e[1], nt.e[2], nt.e[3]] : [nt.e[1], nt.e[2], nt.e[0]];
}
function colourOf(nd) {
  if (state.colour === 'diatonic') return DIATONIC[nd.letter];
  if (state.colour === 'accidental') return ACCIDENTAL[accKey(nd.acc)];
  return PRIME[nd.pkey];
}

function computeRods(nodes) {
  if (state.rods === 'none') return [];
  const rods = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].c, b = nodes[j].c;
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      if (d.some((x) => Math.abs(x) > 1)) continue;
      const axes = d.filter((x) => x !== 0).length;
      if (axes === 1) rods.push({ a: nodes[i], b: nodes[j], kind: 'straight' });
      else if (axes >= 2 && state.rods === 'diagonal') rods.push({ a: nodes[i], b: nodes[j], kind: 'diagonal' });
    }
  }
  return rods;
}

function computeModel() {
  const parsed = parseNotes(state.notes);
  const nodes = [], no7 = [], seen = new Set();
  for (const nt of parsed.notes) {
    if (state.lattice === '235' && nt.e[3] !== 0) { if (!no7.includes(nt.label)) no7.push(nt.label); continue; }
    const c = coords(nt);
    const key = c.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    nodes.push({ ...nt, ...noteName(nt.e, SEVEN_FIFTHS[state.septimal]), c, pos: new THREE.Vector3(c[0], c[1], c[2]) });
  }
  return { nodes, rods: computeRods(nodes), bad: parsed.bad, high: parsed.high, no7 };
}

let model = { nodes: [], rods: [], bad: [], high: [], no7: [] };
let ballMeshes = [];
let hovered = null;

// The 3–5 grid sits as a backdrop just behind the rearmost ball.
function buildGrid() {
  const ns = model.nodes;
  const xs = ns.map((n) => n.c[0]), ys = ns.map((n) => n.c[1]);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1;
  const y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  const z = Math.min(...ns.map((n) => n.c[2])) - BALL_R - 0.3;
  const pts = [];
  for (let y = y0; y <= y1; y++) pts.push(x0, y, z, x1, y, z);
  for (let x = x0; x <= x1; x++) pts.push(x, y0, z, x, y1, z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, gridMat);
}

function buildScene() {
  molecule.clear();
  if (gridLines) { gridLines.geometry.dispose(); gridLines = null; }
  ballMeshes = [];
  hovered = null;
  hideTip();
  for (const nd of model.nodes) {
    const m = new THREE.Mesh(ballGeo, ballMat(colourOf(nd)));
    m.position.copy(nd.pos);
    m.userData.node = nd;
    molecule.add(m);
    ballMeshes.push(m);
  }
  const dir = new THREE.Vector3();
  for (const r of model.rods) {
    dir.subVectors(r.b.pos, r.a.pos);
    const len = dir.length();
    const thick = r.kind === 'straight' ? 1 : 0.72;
    const m = new THREE.Mesh(rodGeo, rodMat);
    m.position.copy(r.a.pos).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
    m.scale.set(thick, len, thick);
    molecule.add(m);
  }
  if (state.grid && model.nodes.length) { gridLines = buildGrid(); molecule.add(gridLines); }
  dirty = true;
}

/* ---------- camera ---------- */

const VIEW = {
  front: new THREE.Vector3(0, 0, 1),
  top: new THREE.Vector3(0, 1, 1e-4).normalize(),
  side: new THREE.Vector3(-1, 0, 0),
  iso: new THREE.Vector3(0.8, 0.55, 1.4).normalize(),
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
let tween = null;

function fitView(dir = null, animate = true) {
  const pts = model.nodes.map((n) => n.pos);
  const center = new THREE.Vector3();
  let R = 1.2;
  if (pts.length) {
    new THREE.Box3().setFromPoints(pts).getCenter(center);
    R = Math.max(R, Math.max(...pts.map((p) => p.distanceTo(center))) + BALL_R + 0.5);
  }
  const aspect = size.w / size.h;
  const vfov = THREE.MathUtils.degToRad(FOV);
  const hfov = 2 * Math.atan(tanHalf * aspect);
  const perspDist = R / Math.sin(Math.min(vfov, hfov) / 2);
  const zoom = Math.min(1 / R, aspect / R);
  const d = dir ? dir.clone() : camera.position.clone().sub(controls.target).normalize();
  const dist = camera === ortho ? Math.max(ORTHO_DIST, perspDist) : perspDist;
  moveCamera(center, d, dist, zoom, animate);
}

function moveCamera(target, dir, dist, zoom, animate) {
  dir = dir.clone().normalize();
  const isOrtho = camera === ortho;
  if (!animate || reduceMotion.matches) {
    tween = null;
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(dir, dist);
    if (isOrtho) { ortho.zoom = zoom; ortho.updateProjectionMatrix(); }
    controls.update();
    dirty = true;
    return;
  }
  const fromT = controls.target.clone();
  const off = camera.position.clone().sub(fromT);
  const fromDist = off.length();
  const fromDir = off.normalize();
  tween = {
    t0: performance.now(), dur: 520, fromT, toT: target.clone(), fromDir, fromDist, toDist: dist,
    fromZoom: isOrtho ? ortho.zoom : null, toZoom: zoom,
    q: new THREE.Quaternion().setFromUnitVectors(fromDir, dir),
  };
}

function stepTween(now) {
  const k = Math.min(1, (now - tween.t0) / tween.dur);
  const e = 1 - Math.pow(1 - k, 3);
  const dir = tween.fromDir.clone().applyQuaternion(new THREE.Quaternion().slerp(tween.q, e));
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  camera.position.copy(controls.target).addScaledVector(dir, THREE.MathUtils.lerp(tween.fromDist, tween.toDist, e));
  camera.lookAt(controls.target);
  if (camera === ortho && tween.fromZoom != null) {
    ortho.zoom = Math.exp(THREE.MathUtils.lerp(Math.log(tween.fromZoom), Math.log(tween.toZoom), e));
    ortho.updateProjectionMatrix();
  }
  if (k >= 1) tween = null;
  dirty = true;
}

// Switch cameras while keeping the same direction and apparent size.
function setProjection(p) {
  const to = p === 'ortho' ? ortho : persp;
  if (to === camera) return;
  tween = null;
  const target = controls.target;
  const dir = camera.position.clone().sub(target).normalize();
  if (to === ortho) {
    const D = camera.position.distanceTo(target);
    ortho.zoom = 1 / (D * tanHalf);
    ortho.position.copy(target).addScaledVector(dir, Math.max(ORTHO_DIST, D));
  } else {
    persp.position.copy(target).addScaledVector(dir, 1 / (ortho.zoom * tanHalf));
  }
  to.quaternion.copy(camera.quaternion);
  to.updateProjectionMatrix();
  camera = to;
  controls.object = to;
  controls.update();
  if (hovered) setHover(null);
  dirty = true;
}

controls.addEventListener('start', () => { tween = null; if (hovered) setHover(null); });
controls.addEventListener('change', () => { dirty = true; });

/* ---------- overlay: labels and axis key ---------- */

const FONT_NOTE = '600 13px Jost, "Avenir Next", "Helvetica Neue", sans-serif';
const FONT_RATIO = '500 11px "IBM Plex Mono", ui-monospace, Menlo, monospace';
const FONT_AXIS = '500 11px Jost, "Avenir Next", "Helvetica Neue", sans-serif';
const labelRay = new THREE.Raycaster();

function drawLabels(ctx, w, h, halo) {
  const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), at = new THREE.Vector2();
  const items = [];
  for (const nd of model.nodes) {
    v.copy(nd.pos).project(camera);
    if (v.z < -1 || v.z > 1) continue;
    const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
    v2.copy(nd.pos).addScaledVector(camUp, BALL_R).project(camera);
    const r = Math.abs((1 - v2.y) / 2 * h - y);
    // A ball hidden behind another ball gets a faint label.
    at.set(v.x, v.y);
    labelRay.setFromCamera(at, camera);
    const first = labelRay.intersectObjects(ballMeshes, false)[0];
    const hidden = !!first && first.object.userData.node !== nd;
    items.push({ nd, x, y, r, depth: v.z, hidden });
  }
  if (!items.length) return;
  const dmin = Math.min(...items.map((i) => i.depth)), dmax = Math.max(...items.map((i) => i.depth));
  items.sort((a, b) => b.depth - a.depth);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  for (const it of items) {
    const fade = dmax > dmin ? 1 - 0.45 * (it.depth - dmin) / (dmax - dmin) : 1;
    ctx.globalAlpha = fade * (it.hidden ? 0.3 : 1);
    let y = it.y + it.r + 3;
    const lines = [];
    if (state.labels === 'note' || state.labels === 'both') lines.push([it.nd.name, FONT_NOTE, theme.ink, 15]);
    if (state.labels === 'ratio' || state.labels === 'both') lines.push([it.nd.label, FONT_RATIO, state.labels === 'both' ? theme.muted : theme.ink, 13]);
    for (const [text, font, colour, lh] of lines) {
      ctx.font = font;
      if (halo) { ctx.strokeStyle = theme.stage; ctx.lineWidth = 3.5; ctx.strokeText(text, it.x, y); }
      ctx.fillStyle = colour;
      ctx.fillText(text, it.x, y);
      y += lh;
    }
  }
  ctx.globalAlpha = 1;
}

function drawAxes(ctx, w, h, halo) {
  const ox = 44, oy = h - 44, L = 24;
  const inv = camera.quaternion.clone().invert();
  const third = state.lattice === '357' ? '7' : '2';
  const axes = [
    { v: new THREE.Vector3(1, 0, 0), label: '3', colour: PRIME['3'] },
    { v: new THREE.Vector3(0, 1, 0), label: '5', colour: PRIME['5'] },
    { v: new THREE.Vector3(0, 0, 1), label: third, colour: third === '7' ? PRIME['7'] : theme.muted },
  ].map((a) => ({ ...a, c: a.v.applyQuaternion(inv) }));
  axes.sort((a, b) => a.c.z - b.c.z); // farthest first
  ctx.lineCap = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const a of axes) {
    ctx.globalAlpha = 0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - a.c.z * a.c.z));
    const ex = ox + a.c.x * L, ey = oy - a.c.y * L;
    ctx.strokeStyle = a.colour;
    ctx.lineWidth = 2.25;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = a.colour;
    ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, Math.PI * 2); ctx.fill();
    const lx = ox + a.c.x * (L + 12), ly = oy - a.c.y * (L + 12);
    ctx.font = FONT_AXIS;
    if (halo) { ctx.strokeStyle = theme.stage; ctx.lineWidth = 3; ctx.strokeText(a.label, lx, ly); }
    ctx.fillStyle = theme.muted;
    ctx.fillText(a.label, lx, ly);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay(ctx, w, h, scale, onScreen) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (onScreen) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const halo = onScreen || !state.transparent;
  if (state.labels !== 'none' && model.nodes.length) drawLabels(ctx, w, h, halo);
  if (state.axes && model.nodes.length) drawAxes(ctx, w, h, halo);
}

/* ---------- size and render loop ---------- */

const size = { w: 1, h: 1 };
function resize() {
  const r = stage.getBoundingClientRect();
  size.w = Math.max(1, r.width);
  size.h = Math.max(1, r.height);
  renderer.setPixelRatio(DPR());
  renderer.setSize(size.w, size.h, false);
  overlay.width = Math.round(size.w * DPR());
  overlay.height = Math.round(size.h * DPR());
  const aspect = size.w / size.h;
  persp.aspect = aspect;
  persp.updateProjectionMatrix();
  ortho.left = -aspect; ortho.right = aspect; ortho.top = 1; ortho.bottom = -1;
  ortho.updateProjectionMatrix();
  dirty = true;
}
new ResizeObserver(resize).observe(stage);

function render() {
  lightRig.position.copy(camera.position);
  lightRig.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
}

function loop(now) {
  requestAnimationFrame(loop);
  if (tween) stepTween(now);
  if (controls.update()) dirty = true;
  if (!dirty) return;
  dirty = false;
  render();
  drawOverlay(octx, size.w, size.h, overlay.width / size.w, true);
}

/* ---------- hover and tap details ---------- */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tip = $('tip');

function pick(cx, cy) {
  const r = glCanvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(ballMeshes, false)[0];
  return hit ? hit.object : null;
}
function hideTip() { tip.hidden = true; }
function showTip(nd, cx, cy) {
  const cents = state.lattice === '357' ? ((nd.cents % 1200) + 1200) % 1200 : nd.cents;
  const head = document.createElement('div');
  head.className = 'tip-head';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = colourOf(nd);
  const name = document.createElement('b');
  name.textContent = nd.name;
  const ratio = document.createElement('span');
  ratio.className = 'mono';
  ratio.textContent = nd.label;
  head.append(dot, name, ratio);
  const body = document.createElement('div');
  body.className = 'tip-body mono';
  body.textContent = `${cents.toFixed(1)}¢ · ${factorString(nd.e)}`;
  tip.replaceChildren(head, body);
  tip.hidden = false;
  const r = stage.getBoundingClientRect();
  let x = cx - r.left + 14, y = cy - r.top + 14;
  if (x + tip.offsetWidth > r.width - 8) x = cx - r.left - tip.offsetWidth - 14;
  if (y + tip.offsetHeight > r.height - 8) y = cy - r.top - tip.offsetHeight - 14;
  tip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
}
function setHover(mesh, cx, cy) {
  if (hovered && hovered !== mesh) hovered.scale.setScalar(1);
  hovered = mesh;
  if (mesh) { mesh.scale.setScalar(1.12); showTip(mesh.userData.node, cx, cy); }
  else hideTip();
  dirty = true;
}
let downAt = null;
glCanvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  const m = pick(e.clientX, e.clientY);
  if (m || hovered) setHover(m, e.clientX, e.clientY);
});
glCanvas.addEventListener('pointerleave', () => { if (hovered) setHover(null); });
glCanvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
glCanvas.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse' && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8) {
    setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY);
  }
  downAt = null;
});

/* ================= panel ================= */

const notesEl = $('notes');
const presetEl = $('preset');
for (const p of PRESETS) {
  const o = document.createElement('option');
  o.value = p.id;
  o.textContent = p.name;
  presetEl.append(o);
}

function renderMessages() {
  const msgs = [];
  if (model.bad.length) msgs.push(`Couldn't read ${model.bad.join(', ')}. Use forms like 5/4, 7 or 4:5:6.`);
  if (model.high.length) msgs.push(`Skipped ${model.high.join(', ')}: only the primes 2, 3, 5 and 7 have a direction here.`);
  if (model.no7.length) msgs.push(`Skipped ${model.no7.join(', ')}: 7 has no direction in ${LATTICE_NAME[state.lattice]}. Switch to 3 · 5 · 7 to see ${model.no7.length === 1 ? 'it' : 'them'}.`);
  const ul = $('msgs');
  ul.replaceChildren(...msgs.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
  ul.hidden = msgs.length === 0;
}

function renderLegend() {
  const mode = state.colour;
  const keyOf = { diatonic: (n) => n.letter, prime: (n) => n.pkey, accidental: (n) => accKey(n.acc) }[mode];
  const present = new Set(model.nodes.map(keyOf));
  const entries = {
    diatonic: () => Object.keys(DIATONIC).map((k) => [k, DIATONIC[k], k]),
    prime: () => Object.keys(PRIME).map((k) => [k, PRIME[k], PRIME_LABEL[k]]),
    accidental: () => ['-3', '-2', '-1', '0', '1', '2', '3'].map((k) => [k, ACCIDENTAL[k], ...ACCIDENTAL_LABEL[k]]),
  }[mode]();
  $('legend').replaceChildren(...entries.map(([k, hex, label, title]) => {
    const li = document.createElement('li');
    if (!present.has(k)) li.className = 'absent';
    if (title) li.title = title;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = hex;
    const t = document.createElement('span');
    t.textContent = label;
    li.append(dot, t);
    return li;
  }));
}

function renderStatus() {
  const n = model.nodes.length, r = model.rods.length;
  const rods = state.rods === 'none' ? '' : ` · ${r} ${r === 1 ? 'rod' : 'rods'}`;
  $('status').textContent = n ? `${n} ${n === 1 ? 'note' : 'notes'}${rods}` : '';
  $('empty').hidden = n > 0;
}

function syncControls() {
  for (const k of Object.keys(ENUMS)) {
    document.querySelectorAll(`input[name="${k}"]`).forEach((inp) => { inp.checked = inp.value === state[k]; });
  }
  $('show-grid').checked = state.grid;
  $('show-axes').checked = state.axes;
  $('transparent').checked = state.transparent;
  $('lattice-hint').textContent = LATTICE_HINT[state.lattice];
  $('rods-hint').textContent = RODS_HINT[state.rods][state.lattice];
  $('septimal-hint').textContent = state.lattice === '357' ? SEPTIMAL_HINT[state.septimal] : 'No effect in 2 · 3 · 5, which has no 7.';
  const third = state.lattice === '357' ? '7' : '2';
  $('view-front').title = 'Front: the 3–5 plane';
  $('view-top').title = `Top: the 3–${third} plane`;
  $('view-side').title = `Side: the ${third}–5 plane`;
}

function refresh({ fit = false } = {}) {
  model = computeModel();
  buildScene();
  renderMessages();
  renderLegend();
  renderStatus();
  syncControls();
  if (fit) fitView();
}

let typing = null;
notesEl.addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => { state.notes = notesEl.value; saveState(); refresh({ fit: true }); }, 220);
});

presetEl.addEventListener('change', () => {
  const p = PRESETS.find((x) => x.id === presetEl.value);
  presetEl.value = '';
  if (!p) return;
  state.notes = p.notes;
  notesEl.value = p.notes;
  if (p.lattice) state.lattice = p.lattice;
  else if (state.lattice !== '357' && parseNotes(p.notes).notes.some((n) => n.e[3] !== 0)) state.lattice = '357';
  if (p.rods) state.rods = p.rods;
  saveState();
  refresh({ fit: true });
});

for (const k of Object.keys(ENUMS)) {
  document.querySelectorAll(`input[name="${k}"]`).forEach((inp) => {
    inp.addEventListener('change', () => {
      if (!inp.checked) return;
      state[k] = inp.value;
      saveState();
      if (k === 'projection') { setProjection(state.projection); return; }
      refresh({ fit: k === 'lattice' });
    });
  });
}

$('show-grid').addEventListener('change', (e) => { state.grid = e.target.checked; saveState(); refresh(); });
$('show-axes').addEventListener('change', (e) => { state.axes = e.target.checked; saveState(); dirty = true; });
$('transparent').addEventListener('change', (e) => { state.transparent = e.target.checked; saveState(); });

$('view-front').addEventListener('click', () => fitView(VIEW.front));
$('view-top').addEventListener('click', () => fitView(VIEW.top));
$('view-side').addEventListener('click', () => fitView(VIEW.side));
$('view-iso').addEventListener('click', () => fitView(VIEW.iso));

/* ---------- PNG export ---------- */

const exportMsg = $('export-msg');
function setExportMsg(text) { exportMsg.textContent = text; exportMsg.hidden = !text; }

async function savePNG() {
  if (hovered) setHover(null);
  const w = size.w, h = size.h;
  const scale = Math.max(1, Math.min(3, 4096 / Math.max(w, h)));
  renderer.setPixelRatio(scale);
  renderer.setSize(w, h, false);
  render();
  const out = document.createElement('canvas');
  out.width = renderer.domElement.width;
  out.height = renderer.domElement.height;
  const ctx = out.getContext('2d');
  if (!state.transparent) { ctx.fillStyle = theme.stage; ctx.fillRect(0, 0, out.width, out.height); }
  ctx.drawImage(renderer.domElement, 0, 0);
  drawOverlay(ctx, w, h, out.width / w, false);
  renderer.setPixelRatio(DPR());
  renderer.setSize(w, h, false);
  dirty = true;

  const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
  if (!blob) { setExportMsg('The image could not be created.'); return; }
  setExportMsg('');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sonic-molecule.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('save').addEventListener('click', savePNG);

/* ================= start ================= */

notesEl.value = state.notes;
readTheme();
resize();
refresh();
fitView(VIEW.iso, false);
requestAnimationFrame(loop);

if (document.fonts) {
  Promise.all([
    document.fonts.load('600 13px Jost'),
    document.fonts.load('500 11px "IBM Plex Mono"'),
  ]).catch(() => {}).finally(() => { dirty = true; });
}
