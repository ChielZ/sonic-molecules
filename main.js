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

// The note-set library. Edit freely: a line without // is a group (indent to nest groups),
// a line with // is a set: its ratios, then // and its name.
const LIBRARY_TEXT = `
Chords
  1/1 5/1 3/1 // Major triad
  1/1 3/5 3/1 // Minor triad
  1/1 5/1 3/1 15/1 // Major 7th
  1/1 3/5 3/1 9/5 // Minor 7th (major 6th)
  1/1 5/1 3/1 7/1 // Harmonic 7th overtonal (dominant 7th)
  1/1 1/5 1/3 1/7 // Harmonic 7th undertonal (minor 6th, half diminished)
  5/1 3/1 7/1 21/5 // Diminished overtonal
  1/5 1/3 1/7 5/21 // Diminished undertonal
Pentatonic scales
  1/1, 3/1, 9/1, 5/3, 5/1 // Major pentatonic
  3/5, 9/5, 1/3, 1/1, 3/1 // Minor pentatonic
  1/3, 1/1, 3/1, 5/1, 15/1 // Bati major
  1/15, 1/5, 1/3, 1/1, 3/1 // Hirajoshi / Tizita minor
Diatonic scales
  1/27, 1/9, 1/3, 1/1, 3/1, 9/1, 27/1 // Pythagorean (modal scale shape 1)
  1/3, 1/1, 3/1, 9/1, 5/3, 5/1, 15/1 // Major (modal scale shape 2)
  3/5, 9/5, 1/3, 1/1, 3/1, 5/9, 5/3 // Dorian (modal scale shape 3)
  1/5, 3/5, 1/9, 1/3, 1/1, 3/1, 5/9 // Natural minor (modal scale shape 4)
  3/5, 1/3, 1/1, 3/1, 9/1, 27/1, 15/1 // Melodic minor
  1/5 3/5, 1/3, 1/1, 3/1, 9/1, 15/1 // Harmonic minor
  1/15, 1/5, 1/3, 1/1, 3/1, 5/1, 15/1 // Double harmonic
Arithmophone
  Pentatonic scale system
    1/3, 1/1, 3/1, 5/9, 5/3 // Sun Occident
    1/3, 1/1, 3/1, 5/3, 5/1 // Sun Meridian
    1/3, 1/1, 3/1, 5/1, 15/1 // Sun Orient
    3/5, 1/3, 1/1, 3/1, 5/3 // Center Occident
    1/5, 1/3, 1/1, 3/1, 5/1 // Center Meridian
    1/15, 1/3, 1/1, 3/1, 15/1 // Center Orient
    3/5, 9/5, 1/3, 1/1, 3/1 // Moon Occident
    1/5, 3/5, 1/3, 1/1, 3/1 // Moon Meridian
    1/15, 1/5, 1/3, 1/1, 3/1 // Moon Orient
  Diatonic scale system
    9/5, 1/3, 1/1, 3/1, 9/1, 5/3, 5/1 // Northern Dawn
    1/3, 1/1, 3/1, 9/1, 5/3, 5/1, 15/1 // Northern Noon
    1/5, 1/3, 1/1, 3/1, 9/1, 5/1, 15/1 // Northern Dusk
    3/5, 9/5, 1/3, 1/1, 3/1, 5/9, 5/3 // Equator Dawn
    1/5, 1/9, 1/3, 1/1, 3/1, 9/1, 5/1 // Equator Noon
    1/15, 1/5, 1/3, 1/1, 3/1, 5/1, 15/1 // Equator Dusk
    1/5, 3/5, 1/9, 1/3, 1/1, 3/1, 5/9 // Southern Dawn
    1/15, 1/5, 3/5, 1/9, 1/3, 1/1, 3/1 // Southern Noon
    1/15, 1/5, 1/9, 1/3, 1/1, 3/1, 5/1 // Southern Dusk
  12-note sets (chromatic scales)
    3/1 1/5 5/3 9/5 15/1 1/1 1/15 9/1 3/5 5/1 1/3 45/1 // 5-limit overtonal
    1/45 3/1 1/5 5/3 1/9 15/1 1/1 1/15 9/1 3/5 5/1 1/3 45/1 // 5-limit symmetrical
    1/45 3/1 1/5 5/3 1/9 15/1 1/1 1/15 5/9 3/5 5/1 1/3 // 5-limit undertonal
    3/1 1/5 5/3 7/1 15/1 1/1 21/5 9/1 7/3 5/1 1/3 7/5 // 7-limit overtonal
    5/7 3/1 1/5 3/7 7/1 15/1 1/1 1/15 1/7 7/3 5/1 1/3 7/5 // 7-limit symmetrical
    5/7 3/1 1/5 3/7 1/9 5/21 1/1 1/15 1/7 3/5 5/1 1/3 // 7-limit undertonal
  22-note sets
    1/1, 25/3, 1/15, 5/9, 9/1, 75/1, 3/5, 5/1, 1/25, 1/3, 27/5, 45/1, 1/45, 5/27, 3/1, 25/1, 1/5, 5/3, 1/75, 1/9, 9/5, 15/1, 3/25 // 5-limit approximation of 22-EDO
    1/1, 9/35, 1/15, 35/1, 1/7, 7/3, 3/5, 5/1, 9/7, 1/3, 3/35, 7/5, 5/7, 35/3, 3/1, 7/9, 1/5, 5/3, 3/7, 7/1, 1/35, 15/1, 35/9 // 7-limit approximation of 22-EDO
  31-note sets
    625/3, 125/3, 125/1, 375/1, 1125/1, 25/3, 25/1, 75/1, 225/1, 5/3, 5/1, 15/1, 45/1, 1/9, 1/3, 1/1, 3/1, 9/1, 3/5, 1/5, 1/15, 1/45, 3/25, 1/25, 1/75, 1/225, 3/125, 1/125, 1/375, 1/1125, 3/625 // 5-limit approximation of 31-EDO
    1/25, 1/5, 1/1, 5/1, 25/1, 1/9, 1/3, 3/1, 9/1, 1/15, 3/5, 5/3, 15/1, 35/3, 35/1, 105/1, 7/3, 7/1, 21/1, 7/5, 21/5, 3/35, 1/35, 1/105, 3/7, 1/7, 1/21, 5/7, 5/21, 35/9, 9/35 // 7-limit approximation of 31-EDO
  41-note sets
    25/81, 25/27, 25/9, 25/3, 25/1, 75/1, 225/1, 675/1, 5/81, 5/27, 5/9, 5/3, 5/1, 15/1, 45/1, 135/1, 1/81, 1/27, 1/9, 1/3, 1/1, 3/1, 9/1, 27/1, 81/1, 1/135, 1/45, 1/15, 1/5, 3/5, 9/5, 27/5, 81/5, 1/675, 1/225, 1/75, 1/25, 3/25, 9/25, 27/25, 81/25 // 5-limit approximation of 41-EDO
    35/9, 35/3, 35/1, 105/1, 7/9, 7/3, 7/1, 21/1, 63/1 , 7/5, 21/5, 63/5, 5/27, 5/9, 5/3, 5/1, 15/1, 1/27, 1/9, 1/3, 1/1, 3/1, 9/1, 27/1, 1/15, 1/5, 3/5, 9/5, 27/5, 5/63, 5/21, 5/7, 1/63, 1/21, 1/7, 3/7, 9/7, 1/105, 1/35, 3/35, 9/35 // 7-limit approximation of 41-EDO
    35/3, 35/1, 105/1, 7/3, 7/1, 21/1, 63/1, 7/5, 21/5, 63/5, 25/3, 25/1, 5/27, 5/9, 5/3, 5/1, 15/1, 1/27, 1/9, 1/3, 1/1, 3/1, 9/1, 27/1, 1/15, 1/5, 3/5, 9/5, 27/5, 1/25, 3/25, 5/63, 5/21, 5/7, 1/63, 1/21, 1/7, 3/7, 1/105, 1/35, 3/35 // 7-limit approximation of 41-EDO (alternate version)
`;

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Parses LIBRARY_TEXT into a tree of groups and a flat list of sets, in library order.
function parseLibrary(text) {
  const root = { children: [], indent: -1 };
  const stack = [root];
  const sets = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const indent = raw.length - raw.trimStart().length;
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    const cut = line.indexOf('//');
    if (cut < 0) {
      const g = { type: 'group', name: line, indent, children: [] };
      parent.children.push(g);
      stack.push(g);
      continue;
    }
    const tokens = line.slice(0, cut).split(/[\s,;]+/).filter(Boolean);
    const path = stack.slice(1).map((g) => g.name);
    const name = line.slice(cut + 2).trim();
    const set = { type: 'set', id: slug([...path, name].join(' ')), name, path, notes: tokens.join(' '), count: tokens.length };
    parent.children.push(set);
    sets.push(set);
  }
  return { tree: root.children, sets };
}
const LIBRARY = parseLibrary(LIBRARY_TEXT);
const PRESETS = LIBRARY.sets;
const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));
const FIRST_SET = PRESETS.find((p) => p.name === '7-limit symmetrical') || PRESETS[0];

const DEFAULTS = {
  notes: FIRST_SET.notes, preset: FIRST_SET.id, lattice: '357', projection: 'ortho', colour: 'diatonic', labels: 'both',
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
      // A remembered set counts only if the notes still match it; otherwise the notes are the visitor's own.
      const p = PRESET_BY_ID.get(raw.preset);
      s.preset = p && p.notes === s.notes ? p.id : '';
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
  if (labelSprites.length) makeLabels(DPR(), true);
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
  makeLabels(DPR(), true);
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

/* ---------- labels: images placed in the scene, so nearer balls and rods hide them ---------- */

const FONT_NOTE = '600 13px Jost, "Avenir Next", "Helvetica Neue", sans-serif';
const FONT_RATIO = '500 11px "IBM Plex Mono", ui-monospace, Menlo, monospace';
const FONT_AXIS = '500 11px Jost, "Avenir Next", "Helvetica Neue", sans-serif';
const LABEL_GAP = 3;              // CSS px between a ball and its label
const LABEL_PAD = 3;              // CSS px of room around the text for its halo
const LABEL_LIFT = BALL_R + 0.02; // a label sits just in front of its own ball, so its own rods never cover it

const labelGroup = new THREE.Group();
scene.add(labelGroup);
let labelSprites = [];
let labelScale = 1; // device pixels per CSS pixel in the label images

function labelLines(nd) {
  const lines = [];
  if (state.labels === 'note' || state.labels === 'both') lines.push([nd.name, FONT_NOTE, theme.ink, 15]);
  if (state.labels === 'ratio' || state.labels === 'both') lines.push([nd.label, FONT_RATIO, state.labels === 'both' ? theme.muted : theme.ink, 13]);
  return lines;
}

// Draws one label at `scale` device pixels per CSS pixel; its width is even so it can sit on whole pixels.
function labelImage(nd, scale, halo) {
  const lines = labelLines(nd);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  let tw = 0;
  for (const [text, font] of lines) { ctx.font = font; tw = Math.max(tw, ctx.measureText(text).width); }
  const cssW = tw + 2 * LABEL_PAD + 2;
  const cssH = LABEL_GAP + lines.reduce((sum, l) => sum + l[3], 0) + LABEL_PAD;
  c.width = 2 * Math.ceil(cssW * scale / 2);
  c.height = Math.ceil(cssH * scale);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  let y = LABEL_GAP;
  for (const [text, font, colour, lh] of lines) {
    ctx.font = font;
    if (halo) { ctx.strokeStyle = theme.stage; ctx.lineWidth = 3.5; ctx.strokeText(text, c.width / scale / 2, y); }
    ctx.fillStyle = colour;
    ctx.fillText(text, c.width / scale / 2, y);
    y += lh;
  }
  return c;
}

function disposeLabels() {
  for (const sp of labelSprites) { sp.material.map.dispose(); sp.material.dispose(); }
  labelGroup.clear();
  labelSprites = [];
}

function makeLabels(scale, halo) {
  disposeLabels();
  labelScale = scale;
  if (state.labels === 'none') return;
  for (const nd of model.nodes) {
    const img = labelImage(nd, scale, halo);
    const tex = new THREE.CanvasTexture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false, toneMapped: false });
    const sp = new THREE.Sprite(mat);
    sp.center.set(0.5, 1); // hangs from its top edge
    sp.userData = { node: nd, w: img.width, h: img.height };
    labelGroup.add(sp);
    labelSprites.push(sp);
  }
  dirty = true;
}

// Every frame: hang each label under its ball, lift it toward the camera, keep it a fixed size on
// screen, snap it to whole device pixels so the text stays sharp, and fade labels further back.
const _a = new THREE.Vector3(), _camUp = new THREE.Vector3(), _toCam = new THREE.Vector3();
function placeLabels() {
  if (!labelSprites.length) return;
  camera.updateMatrixWorld();
  const W = renderer.domElement.width, H = renderer.domElement.height;
  const isOrtho = camera === ortho;
  // World units per CSS pixel (in perspective, per unit of distance: sizeAttenuation is off).
  const k = isOrtho ? (ortho.top - ortho.bottom) / ortho.zoom / size.h : 2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) / size.h;
  _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  if (isOrtho) _toCam.set(0, 0, 1).applyQuaternion(camera.quaternion);
  const depths = labelSprites.map((sp) => _a.copy(sp.userData.node.pos).project(camera).z);
  const dmin = Math.min(...depths), dmax = Math.max(...depths);
  labelSprites.forEach((sp, i) => {
    const { node, w, h } = sp.userData;
    _a.copy(node.pos).addScaledVector(_camUp, -BALL_R);
    if (!isOrtho) _toCam.subVectors(camera.position, _a).normalize();
    _a.addScaledVector(_toCam, LABEL_LIFT).project(camera);
    sp.visible = _a.z > -1 && _a.z < 1;
    if (!sp.visible) return;
    const left = Math.round((_a.x + 1) / 2 * W - w / 2);
    const top = Math.round((1 - _a.y) / 2 * H);
    _a.x = (left + w / 2) / W * 2 - 1;
    _a.y = 1 - top / H * 2;
    sp.position.copy(_a.unproject(camera));
    sp.scale.set(w / labelScale * k, h / labelScale * k, 1);
    sp.material.opacity = dmax > dmin ? 1 - 0.45 * (depths[i] - dmin) / (dmax - dmin) : 1;
  });
}

/* ---------- overlay: axis key ---------- */

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
  if (labelSprites.length && labelScale !== DPR()) makeLabels(DPR(), true);
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
  placeLabels();
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
const libraryEl = $('library');
const setRows = new Map();

// Groups are <details>; siblings share a name, so opening one group closes the others.
function buildLibrary(items, depth, groupName) {
  const frag = document.createDocumentFragment();
  let list = null;
  for (const it of items) {
    if (it.type === 'group') {
      const d = document.createElement('details');
      d.className = 'lib-group';
      d.setAttribute('name', groupName);
      const sum = document.createElement('summary');
      sum.textContent = it.name;
      d.append(sum, buildLibrary(it.children, depth + 1, 'lib-' + slug(it.name)));
      frag.append(d);
      list = null;
    } else {
      if (!list) { list = document.createElement('div'); list.className = 'lib-items'; frag.append(list); }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'set';
      const name = document.createElement('span');
      name.textContent = it.name;
      const count = document.createElement('span');
      count.className = 'set-count';
      count.textContent = it.count;
      count.title = `${it.count} notes`;
      b.append(name, count);
      b.addEventListener('click', () => loadPreset(it));
      setRows.set(it.id, b);
      list.append(b);
    }
  }
  return frag;
}
libraryEl.append(buildLibrary(LIBRARY.tree, 0, 'lib-top'));

// Marks the current set in the library and names it on the stage. With `reveal`, opens its
// groups and scrolls the library (only the library, never the page) to bring it into view.
function syncLibrary(reveal = false) {
  const p = PRESET_BY_ID.get(state.preset);
  for (const [id, row] of setRows) {
    row.classList.toggle('active', id === state.preset);
    if (id === state.preset) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
  }
  $('set-group').textContent = p ? p.path.join(' · ') : '';
  $('set-name').textContent = p ? p.name : 'Your notes';
  if (!p || !reveal) return;
  const row = setRows.get(p.id);
  for (let d = row.closest('details'); d; d = d.parentElement.closest('details')) d.open = true;
  const lr = libraryEl.getBoundingClientRect(), rr = row.getBoundingClientRect();
  if (rr.top < lr.top) libraryEl.scrollTop += rr.top - lr.top - 8;
  else if (rr.bottom > lr.bottom) libraryEl.scrollTop += rr.bottom - lr.bottom + 8;
}

function loadPreset(p) {
  state.preset = p.id;
  state.notes = p.notes;
  notesEl.value = p.notes;
  if (state.lattice !== '357' && parseNotes(p.notes).notes.some((n) => n.e[3] !== 0)) state.lattice = '357';
  saveState();
  refresh({ fit: true });
  syncLibrary(true);
}

function stepPreset(dir) {
  const n = PRESETS.length;
  const i = PRESETS.findIndex((p) => p.id === state.preset);
  loadPreset(PRESETS[i < 0 ? (dir > 0 ? 0 : n - 1) : (i + dir + n) % n]);
}
$('set-prev').addEventListener('click', () => stepPreset(-1));
$('set-next').addEventListener('click', () => stepPreset(1));
// ← and → step through the sets, except while typing or using a control that needs the arrow keys.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  e.preventDefault();
  stepPreset(e.key === 'ArrowRight' ? 1 : -1);
});

const settingsEl = $('settings');
settingsEl.addEventListener('toggle', (e) => { $('settings-btn').classList.toggle('on', e.newState === 'open'); });

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
  syncLibrary();
  if (fit) fitView();
}

let typing = null;
notesEl.addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => { state.notes = notesEl.value; state.preset = ''; saveState(); refresh({ fit: true }); }, 220);
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
  if (labelSprites.length) makeLabels(scale, !state.transparent);
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
  if (labelSprites.length) makeLabels(DPR(), true);
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
syncLibrary(true);
fitView(VIEW.iso, false);
requestAnimationFrame(loop);

if (document.fonts) {
  Promise.all([
    document.fonts.load('600 13px Jost'),
    document.fonts.load('500 11px "IBM Plex Mono"'),
  ]).catch(() => {}).finally(() => { makeLabels(DPR(), true); });
}
