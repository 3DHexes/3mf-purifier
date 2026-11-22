// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { t, tCode, setLang, getLang, locale, applyStatic } from './i18n.js';
import { decodeImage, makeThumb } from './thumb.js';
import { isOutputDir } from './core/purify.js';

const api = window.api;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Ustawienia: magazyn platformy (Neutralino.storage), zapasowo localStorage.
const store = {
  get(k, d) { if (api.prefs) return api.prefs.get(k, d); try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { if (api.prefs) return api.prefs.set(k, v); try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bez pamięci ustawień */ } },
};

// Wynik: folder Cleaned_<nazwa modelu> obok pliku (oba tryby).
const outName = (name) => 'Cleaned_' + name.replace(/(\.gcode)?\.3mf$/i, '');
const state = {
  files: [],          // { path, name, dir, status, info, error, results: {clean, filaments, universal} }
  sel: -1,
  mode: 'filaments',          // każde uruchomienie: Z filamentami i po angielsku
  keepObj: store.get('keepObj', false),
  alsoUni: store.get('alsoUni', false),
  splitPlates: store.get('splitPlates', true),
  author: store.get('author', { on: false, Designer: '', License: '', Copyright: '' }),
  view: 'src',        // 'src' | 'out'
  running: false,
  test: null,
  viewErr: null,      // { key, params } - komunikat w podglądzie, tłumaczony przy zmianie języka
};
setLang('en');

// Błąd z procesu głównego: "C3MF{json}" z kodem do przetłumaczenia.
function parseErr(e) {
  const m = /C3MF(\{.*\})\s*$/s.exec(e?.message || '');
  if (m) { try { return JSON.parse(m[1]); } catch { /* zwykły tekst */ } }
  return { code: '', params: {}, message: String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') };
}
const errText = (er) => tCode('e', er);

const fmtSize = (n) => n >= 1 << 20 ? (n / (1 << 20)).toLocaleString(locale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const fmtInt = (n) => n.toLocaleString(locale());
const fmtMM = (v) => (Math.round(v * 10) / 10).toLocaleString(locale());
const baseName = (p) => p.split(/[\\/]/).pop();
const dirName = (p) => p.slice(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')));
const hex6 = (c) => (/^#[0-9a-f]{6}/i.test(c || '') ? c.slice(0, 7) : null);
const NEUTRAL = ['#b9b3a8', '#8f8a82', '#d7d2c9', '#6f6b65', '#a6a19a', '#c9c4bb', '#7f7a73', '#e2ddd5'];
const FALLBACK = ['#c2a36b', '#6b8f71', '#8a4a43', '#5f7ea8', '#b48ead', '#d08770', '#a3be8c', '#ebcb8b'];

// ============ podgląd 3D ============
const canvas = $('view');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
} catch (e) {
  console.error(e);
  state.viewErr = { key: 'view.noWebgl' };
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 10000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = true;
scene.add(new THREE.HemisphereLight(0xf6f0f2, 0x2a2026, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(0.8, 1.6, 1.1); scene.add(key);
const fill = new THREE.DirectionalLight(0xc7d4ff, 0.55); fill.position.set(-1.2, 0.6, -0.9); scene.add(fill);
const root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root);
let mesh = null, grid = null, current = null, wire = false, dirty = true, fitInfo = null;

function resize() {
  const r = $('viewer').getBoundingClientRect();
  if (!renderer) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
  dirty = true;
}
new ResizeObserver(resize).observe($('viewer'));
controls.addEventListener('change', () => { dirty = true; });
(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  if (dirty && renderer) { renderer.render(scene, camera); dirty = false; }
})();

function slotColors(p) {
  // Kolory slotów: z pliku (tryb z filamentami / wynik z Publish) albo neutralne odcienie.
  const useFil = state.view === 'out' ? p.filaments.length > 0 : state.mode === 'filaments' && p.filaments.length > 0;
  return (slot) => useFil ? (hex6(p.filaments[slot]?.color) || FALLBACK[slot % FALLBACK.length]) : NEUTRAL[slot % NEUTRAL.length];
}

function showModel(p) {
  if (mesh) { root.remove(mesh); mesh.geometry.dispose(); [].concat(mesh.material).forEach((m) => m.dispose()); mesh = null; }
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid = null; }
  current = p;
  if (!p || !p.stats.triangles) {
    if ($('snapThumb')) $('snapThumb').hidden = true;
    dirty = true;
    return;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
  g.setIndex(new THREE.BufferAttribute(p.indices, 1));
  const maxSlot = Math.max(...p.groups.map((x) => x.slot));
  const mats = [];
  for (let s = 0; s <= maxSlot; s++) mats.push(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide, wireframe: wire }));
  p.groups.forEach((gr) => g.addGroup(gr.start, gr.count, gr.slot));
  g.computeBoundingSphere();
  mesh = new THREE.Mesh(g, mats);
  const { min, max, size } = p.stats;
  mesh.position.set(-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]);
  root.add(mesh);
  recolor();
  const span = Math.max(size[0], size[1]);
  const step = span > 400 ? 50 : span > 120 ? 10 : 5;
  const gs = Math.ceil((span * 1.6) / step) * step;
  grid = new THREE.GridHelper(gs, gs / step, 0xffd6ea, 0xffffff);
  grid.material.transparent = true; grid.material.opacity = 0.13; grid.material.depthWrite = false;
  scene.add(grid);
  fitInfo = { size };
  fitView();
  if ($('snapThumb')) $('snapThumb').hidden = !renderer;
}

function recolor() {
  if (!mesh || !current) return;
  const col = slotColors(current);
  mesh.material.forEach((m, s) => m.color.set(col(s)));
  dirty = true;
  renderLegend();
}

function fitView() {
  if (!fitInfo) return;
  const [sx, sy, sz] = fitInfo.size;
  const r = Math.max(1, Math.hypot(sx, sy, sz) / 2);
  const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
  const dir = new THREE.Vector3(0.75, 0.72, 1).normalize();
  controls.target.set(0, sz * 0.35, 0);
  camera.position.copy(dir.multiplyScalar(dist).add(controls.target));
  camera.near = dist / 100; camera.far = dist * 20; camera.updateProjectionMatrix();
  controls.update();
  dirty = true;
}

$('resetView').onclick = fitView;
$('wire').onclick = () => {
  wire = !wire; $('wire').classList.toggle('on', wire);
  if (mesh) mesh.material.forEach((m) => { m.wireframe = wire; });
  dirty = true;
};
if ($('snapThumb')) $('snapThumb').onclick = captureThumb;

// Okładka z widoku 3D: osobny, kwadratowy render 1024 px z kątem patrzenia z podglądu,
// kadrem dopasowanym do modelu i jasnym tłem, żeby miniatura była czytelna wszędzie.
async function renderCover(size = 1024) {
  const off = document.createElement('canvas');
  off.width = off.height = size;
  const r = new THREE.WebGLRenderer({ canvas: off, antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    r.setPixelRatio(1);
    r.setSize(size, size, false);
    r.setClearColor(0x000000, 0);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 10000);
    const box = new THREE.Box3().setFromObject(mesh);
    // Kadr liczony na próbce wierzchołków (do 20 tys.), a nie na rogach prostopadłościanu: model wypełnia obraz ciaśniej.
    const pos = mesh.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 20000));
    mesh.updateMatrixWorld(true);
    const corners = [];
    for (let i = 0; i < pos.count; i += step) corners.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
    const dir = camera.position.clone().sub(controls.target).normalize();
    const target = box.getCenter(new THREE.Vector3());
    let dist = box.getSize(new THREE.Vector3()).length() / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    // Kilka przybliżeń: przesunięcie środka i odległość tak, żeby model zajął ok. 86% kadru.
    for (let it = 0; it < 4; it++) {
      cam.position.copy(dir).multiplyScalar(dist).add(target);
      cam.near = dist / 100; cam.far = dist * 20;
      cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const p = new THREE.Vector3();
      for (const c of corners) { p.copy(c).project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist;
      target.addScaledVector(right, ((x0 + x1) / 2) * halfH).addScaledVector(up, ((y0 + y1) / 2) * halfH);
      dist *= Math.max(x1 - x0, y1 - y0) / 2 / 0.86;
    }
    cam.position.copy(dir).multiplyScalar(dist).add(target);
    cam.near = dist / 100; cam.far = dist * 20;
    cam.lookAt(target); cam.updateProjectionMatrix();
    const gridWas = grid ? grid.visible : false;
    if (grid) grid.visible = false;
    try { r.render(scene, cam); } finally { if (grid) grid.visible = gridWas; }
    // Jasne tło z delikatnym gradientem pod model.
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const g = out.getContext('2d');
    const bg = g.createRadialGradient(size / 2, size * 0.42, size * 0.05, size / 2, size / 2, size * 0.75);
    bg.addColorStop(0, '#f4f2ef'); bg.addColorStop(1, '#c9c3bb');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.drawImage(off, 0, 0);
    return await createImageBitmap(out);
  } finally {
    r.dispose();
    r.forceContextLoss();
  }
}

async function captureThumb() {
  const f = state.files[state.sel];
  if (!f || !renderer || !mesh || state.running) return;
  let bitmap;
  try { bitmap = await renderCover(); } catch (e) { toast(t('th.bad', { msg: e.message })); return; }
  const out = await makeThumb(bitmap, 'fill');
  const prev = f.thumb;
  f.thumb = { name: t('th.from3dName'), bitmap, mode: 'fill', ...out };
  releaseThumbIfUnused(prev);
  invalidate(f);
  refreshAfterThumb();
  toast(t('th.set', { name: f.thumb.name }));
}

// ============ lista plików ============
const hexIcon = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 8.5l3.4 2v3.9L12 16.4l-3.4-2v-3.9z" fill="currentColor" opacity=".6"/></svg>';

function statusPill(f) {
  const r = f.results[state.mode];
  if (f.status === 'working') return `<span class="pill work">${t('pill.working')}</span>`;
  if (r && r.error) return `<span class="pill err">${t('pill.error')}</span>`;
  if (r) return r.warnings?.length || r.also?.error || r.also?.warnings?.length ? `<span class="pill warn">${t('pill.done')} ⚠</span>` : `<span class="pill ok">${t('pill.done')}</span>`;
  if (f.error) return `<span class="pill err">${t('pill.error')}</span>`;
  if (!f.info) return '<span class="pill">…</span>';
  const priv = f.info.privacy || {};
  if (state.mode !== 'universal' && !f.info.remove.length && !f.info.overrides.length && !priv.paths && !priv.profile) return `<span class="pill">${t('pill.clean')}</span>`;
  return `<span class="pill">${t('pill.todo')}</span>`;
}

function renderList() {
  const ul = $('fileList');
  ul.innerHTML = state.files.map((f, i) => {
    const sub = f.info ? [fmtSize(f.info.size), f.info.filaments.length ? t('files.sub.filaments', f.info.filaments.length) : null, f.info.plates > 1 ? t('d.plates', f.info.plates) : null].filter(Boolean).join(' · ') : f.error ? t('files.sub.unreadable') : t('files.sub.analyzing');
    const tn = f.thumb?.url || f.info?.thumbnail?.dataUrl;
    const icon = tn ? `<img class="tn" src="${esc(tn)}" alt="">` : hexIcon;
    return `<li data-i="${i}" class="${i === state.sel ? 'sel' : ''}" title="${esc(f.path)}">${icon}<div><div class="fn">${esc(f.name)}</div><div class="sub">${esc(sub)}</div></div>${statusPill(f)}<button class="rm" data-rm="${i}" title="${esc(t('files.remove'))}">×</button></li>`;
  }).join('');
  const n = state.files.length;
  $('count').textContent = n ? String(n) : '';
  $('filesEmpty').hidden = n > 0;
  $('viewEmpty').hidden = n > 0;
  $('clearList').hidden = n === 0;
  document.querySelector('.files-foot').hidden = n === 0;
  const done = state.files.filter((f) => f.results[state.mode] && !f.results[state.mode].error).length;
  $('listSummary').textContent = n ? t('files.summary', { done, n }) : '';
  const run = $('run');
  run.disabled = !n || state.running;
  run.textContent = state.running ? t('run.busy') : n ? t('run.n', n) : t('run.idle');
}

// Uszkodzona miniatura w pliku: zamiast pustego obrazka pokaż ikonę / opis.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  const li = img.closest('#fileList li');
  const f = li ? state.files[+li.dataset.i] : img.closest('.thumb-box') ? state.files[state.sel] : null;
  if (f && !f.thumb && f.info?.thumbnail) { f.info.thumbnail = null; renderList(); renderDetails(); }
}, true);

$('fileList').addEventListener('click', (e) => {
  const rm = e.target.closest('[data-rm]');
  if (rm) { removeFile(+rm.dataset.rm); e.stopPropagation(); return; }
  const li = e.target.closest('li');
  if (li) select(+li.dataset.i);
});

function releaseThumbIfUnused(th) {
  if (!th) return;
  if (th.url && !state.files.some((f) => f.thumb?.url === th.url)) {
    try { URL.revokeObjectURL(th.url); } catch { /* ignore */ }
  }
  if (th.bitmap && !state.files.some((f) => f.thumb?.bitmap === th.bitmap)) {
    try { th.bitmap.close?.(); } catch { /* ignore */ }
  }
}

function removeFile(i) {
  if (state.running) return;
  const [removed] = state.files.splice(i, 1);
  releaseThumbIfUnused(removed?.thumb);
  if (state.sel >= state.files.length) state.sel = state.files.length - 1;
  else if (i < state.sel) state.sel--;
  renderList(); renderDropDir();
  select(state.sel, true);
}
$('clearList').onclick = () => {
  if (state.running) return;
  const old = state.files.map((f) => f.thumb).filter(Boolean);
  state.files = []; state.sel = -1;
  for (const th of old) releaseThumbIfUnused(th);
  renderList(); renderDropDir(); select(-1, true);
};

// Źródło danych pliku: ścieżka na dysku albo obiekt File przeciągnięty do okna.
const srcOf = (f) => (f.file ? { file: f.file, rel: f.rel || '' } : f.path);

async function addFiles(paths) {
  const known = new Set(state.files.map((f) => f.path.toLowerCase()));
  const fresh = paths.filter((p) => !known.has(p.toLowerCase()));
  if (!paths.length) toast(t('toast.noFiles'));
  if (!fresh.length) return;
  for (const p of fresh) state.files.push({ path: p, name: baseName(p), dir: dirName(p), status: 'idle', info: null, error: null, results: {} });
  renderList();
  if (state.sel < 0 || !state.files[state.sel]) select(state.files.length - fresh.length);
  for (const f of state.files.filter((x) => !x.info && !x.error)) {
    try { f.info = await api.analyze(srcOf(f)); } catch (e) { f.error = parseErr(e); }
    renderList();
    if (state.files[state.sel] === f) renderDetails();
  }
}

// Pliki przeciągnięte do okna (bez ścieżki): wynik trafia do folderu z ustawień.
async function addDropped(items) {
  const known = new Set(state.files.map((f) => f.path));
  const fresh = [];
  for (const { file, rel } of items) {
    const key = `drop:${rel}/${file.name}:${file.size}:${file.lastModified}`;
    if (known.has(key)) continue;
    known.add(key);
    fresh.push({ path: key, name: file.name, dir: '', file, rel, status: 'idle', info: null, error: null, results: {} });
  }
  if (!fresh.length) return;
  state.files.push(...fresh);
  await refreshDropDir();
  renderList();
  if (state.sel < 0 || !state.files[state.sel]) select(state.files.length - fresh.length);
  for (const f of fresh) {
    try { f.info = await api.analyze(srcOf(f)); } catch (e) { f.error = parseErr(e); }
    renderList();
    if (state.files[state.sel] === f) renderDetails();
  }
}

async function refreshDropDir() {
  if (api.getDropDir) state.dropDir = await api.getDropDir();
  renderDropDir();
}
function renderDropDir() {
  const has = state.files.some((f) => f.file);
  const el = $('dropDir');
  el.hidden = !has || !state.dropDir;
  if (!el.hidden) el.innerHTML = `${t('drop.saveTo')}: <span class="dd-path" title="${esc(state.dropDir)}">${esc(state.dropDir)}</span> <button class="link" id="dropDirChange">${t('drop.change')}</button>`;
  const b = $('dropDirChange');
  if (b) b.onclick = async () => {
    if (state.running) return;
    state.dropDir = await api.pickDropDir(getLang());
    for (const f of state.files) if (f.file) f.results = {};
    renderDropDir(); renderList(); renderDetails();
  };
}

$('addFiles').onclick = async () => addFiles(await api.pickFiles(getLang()));
$('emptyAdd').onclick = () => $('addFiles').click();
$('addFolder').onclick = async () => addFiles(await api.pickFolder(getLang()));
api.onAddFiles((files) => addFiles(files));

// przeciąganie plików
let dragDepth = 0;
const IMAGE_RE = /\.(png|jpe?g|webp|bmp|gif|avif)$/i;
const isImageDrag = (dt) => {
  const items = [...(dt?.items || [])].filter((it) => it.kind === 'file');
  return items.length > 0 && items.every((it) => (it.type || '').startsWith('image/'));
};
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if (++dragDepth === 1) {
    const f = state.files[state.sel];
    $('dropText').textContent = isImageDrag(e.dataTransfer) ? (f ? t('th.dropFor', { name: f.name }) : t('th.noFile')) : t('drop');
    document.body.classList.add('dragging');
  }
});
window.addEventListener('dragleave', (e) => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
  const dt = e.dataTransfer;
  if (!dt) return;
  // Ścieżki (Electron) mają pierwszeństwo; w WebView2 bierzemy pliki i foldery przez API przeglądarki.
  const paths = [...(dt.files || [])].map((f) => api.pathForFile(f)).filter(Boolean);
  if (paths.length) { handleDroppedPaths(paths); return; }
  const entries = [...(dt.items || [])].filter((i) => i.kind === 'file').map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  const plain = [...(dt.files || [])];
  handleDroppedEntries(entries, plain);
});

async function handleDroppedEntries(entries, plain) {
  const found = [];
  const walk = async (entry, rel) => {
    if (entry.isFile) {
      try { found.push({ file: await new Promise((res, rej) => entry.file(res, rej)), rel }); } catch { /* pomijamy nieczytelny plik */ }
    } else if (entry.isDirectory) {
      if (rel !== null && isOutputDir(entry.name)) return;
      const sub = rel === null ? entry.name : rel + '/' + entry.name;
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej)).catch(() => []);
        if (!batch.length) break;
        for (const child of batch) await walk(child, sub);
      }
    }
  };
  if (entries.some(Boolean)) { for (const en of entries) if (en) await walk(en, null); }
  else plain.forEach((file) => found.push({ file, rel: null }));
  const norm = found.map((x) => ({ file: x.file, rel: x.rel || '' }));
  const models = norm.filter((x) => /\.3mf$/i.test(x.file.name));
  const images = norm.filter((x) => IMAGE_RE.test(x.file.name));
  if (models.length) { await addDropped(models.sort((a, b) => (a.rel + a.file.name).localeCompare(b.rel + b.file.name))); return; }
  if (images.length) {
    const f = state.files[state.sel];
    if (!f) { toast(t('th.noFile')); return; }
    if (!state.running) await applyImage([f], await api.imageFromFile(images[0].file), f.thumb?.mode || 'fill');
    return;
  }
  toast(t('toast.noFiles'));
}
// Platforma z natywnym przeciąganiem (Neutralino) podaje pełne ścieżki bez zdarzeń DOM.
api.onDropPaths?.((paths) => handleDroppedPaths(paths));
async function handleDroppedPaths(paths) {
  if (!paths.length) return;
  if (paths.every((p) => IMAGE_RE.test(p))) {
    const f = state.files[state.sel];
    if (!f) { toast(t('th.noFile')); return; }
    if (!state.running) await applyImage([f], await api.readImage(paths[0]), f.thumb?.mode || 'fill');
    return;
  }
  addFiles(await api.collect(paths));
}

// ============ wybór pliku i podgląd ============
let previewToken = 0;
async function select(i, force) {
  if (i === state.sel && !force) return;
  state.sel = i;
  const f = state.files[i];
  const r = f && f.results[state.mode];
  if (!r || r.error) state.view = 'src';
  renderList();
  renderDetails();
  await loadPreview();
}

async function loadPreview() {
  const f = state.files[state.sel];
  const r = f && f.results[state.mode];
  $('srcToggle').hidden = !(r && !r.error);
  document.querySelectorAll('#srcToggle button').forEach((b) => b.classList.toggle('on', b.dataset.src === state.view));
  if (renderer) state.viewErr = null;
  renderViewErr();
  if (!f) { showModel(null); $('vName').textContent = ''; $('vStats').innerHTML = ''; renderLegend(); return; }
  const file = state.view === 'out' && r ? r.out : srcOf(f);
  const token = ++previewToken;
  $('loading').hidden = false;
  $('vName').textContent = state.view === 'out' ? `${f.name}  →  ${state.mode === 'universal' ? baseName(r.out) : outName(f.name)}` : f.name;
  try {
    const p = await api.preview(file);
    if (token !== previewToken) return;
    showModel(p);
    renderStats();
  } catch (e) {
    if (token !== previewToken) return;
    showModel(null);
    state.viewErr = { key: 'view.failed', err: parseErr(e) };
    renderViewErr();
    $('vStats').innerHTML = '';
    renderLegend();
  } finally {
    if (token === previewToken) $('loading').hidden = true;
  }
}

document.querySelectorAll('#srcToggle button').forEach((b) => b.addEventListener('click', () => {
  if (state.view === b.dataset.src) return;
  state.view = b.dataset.src;
  loadPreview();
}));

function renderViewErr() {
  const v = state.viewErr;
  $('viewError').hidden = !v;
  if (v) $('viewError').textContent = v.err ? t(v.key, { msg: errText(v.err) }) : t(v.key);
}

function renderStats() {
  const p = current;
  if (!p) { $('vStats').innerHTML = ''; return; }
  const s = p.stats;
  const chips = [
    `<span class="chip">${t('chip.triangles', { value: s.triangles, text: fmtInt(s.triangles) })}</span>`,
    `<span class="chip">${t('chip.objects', s.objects)}</span>`,
    `<span class="chip">${fmtMM(s.size[0])} × ${fmtMM(s.size[1])} × ${fmtMM(s.size[2])} mm</span>`,
  ];
  if (s.painted) chips.push(`<span class="chip accent">${t('chip.painted')}</span>`);
  if (p.published) chips.push('<span class="chip accent">Publish 3MF</span>');
  $('vStats').innerHTML = chips.join('');
}

function renderLegend() {
  const el = $('legend');
  const p = current;
  if (!p || !p.stats.triangles) { el.innerHTML = ''; return; }
  const used = new Set(p.stats.slotsUsed);
  const col = slotColors(p);
  const showFil = state.view === 'out' ? p.filaments.length > 0 : state.mode === 'filaments' && p.filaments.length > 0;
  if (showFil) {
    el.innerHTML = `<div class="lt">${t(state.view === 'out' ? 'legend.out' : 'legend.src')}</div><div class="row">` +
      p.filaments.map((fl, i) => `<div class="sw ${used.has(i + 1) ? '' : 'unused'}"><span class="dot" style="background:${col(i)}"></span>${i + 1}. ${esc(fl.type || t('filament'))} <span class="t">${esc(hex6(fl.color) || '')}</span></div>`).join('') + '</div>';
  } else {
    const slots = [...used].sort((a, b) => a - b);
    const why = t(state.mode === 'filaments' && !p.filaments.length ? 'legend.noList' : 'legend.customer');
    el.innerHTML = `<div class="lt">${why}</div><div class="row">` +
      slots.map((s) => `<div class="sw"><span class="dot" style="background:${col(s - 1)}"></span>${t('legend.slot', { n: s })}</div>`).join('') + '</div>';
  }
}

// ============ panel szczegółów ============
function renderDetails() {
  const el = $('details');
  const f = state.files[state.sel];
  if (!f) {
    el.innerHTML = `<div class="d-empty">${t('d.empty')}</div>`;
    return;
  }
  const where = f.file ? `${t('d.dropped')}${f.rel ? ' · ' + f.rel : ''}` : f.dir;
  let h = `<div class="d-file"><h3>${esc(f.name)}</h3><div class="path">${esc(where)}</div></div>`;
  const r = f.results[state.mode];
  if (r) h += resultCard(r);
  if (f.error && !(r && r.error)) h += `<div class="card result err"><h4>${t('d.readError')}</h4><div>${esc(errText(f.error))}</div></div>`;
  const info = f.info;
  if (!info) { el.innerHTML = h + (f.error ? '' : `<div class="d-empty">${t('d.analyzing')}</div>`); boxCards(el); bindResult(); return; }

  const uni = state.mode === 'universal';
  if (info.hasGcode) h += `<div class="note">${t('d.gcodeAlert')}</div>`;
  if (state.mode === 'filaments') h += `<div class="note">${t('d.filNote')}</div>`;
  if (uni) h += `<div class="note">${t('d.uniNote')}</div>`;
  h += thumbCard(f);

  if (info.printer || info.process) {
    h += `<div class="card"><h4>${t('d.profile')} <span class="tag drop">${t('d.tag.removed')}</span></h4><dl class="kv">
      ${info.printer ? `<dt>${t('d.printer')}</dt><dd class="struck">${esc(info.printer)}</dd>` : ''}
      ${info.process ? `<dt>${t('d.process')}</dt><dd class="struck">${esc(info.process)}</dd>` : ''}</dl></div>`;
  }

  if (info.filaments.length) {
    const keep = state.mode === 'filaments';  // w trybie uniwersalnym lista filamentów też znika
    h += `<div class="card"><h4>${t('d.filaments', { n: info.filaments.length })} <span class="tag ${keep ? 'keep' : 'drop'}">${t(keep ? 'd.tag.kept' : 'd.tag.removedMany')}</span></h4>` +
      info.filaments.map((fl, i) => `<div class="fil"><span class="dot" style="background:${hex6(fl.color) || FALLBACK[i % FALLBACK.length]}"></span>
        <span class="nm">${i + 1}. ${esc(fl.preset || fl.type || t('filament'))}</span><span class="ty">${esc(fl.type)}</span></div>`).join('') + '</div>';
  }

  let removing = info.remove.map((g) => ({ ...g, text: t(state.mode === 'filaments' && g.label === 'profile' ? 'group.profileFil' : 'group.' + g.label) }));
  if (uni) {
    removing = [{ text: t('group.uniAll'), files: [] }];
    if (info.modifiers) removing.push({ text: t('group.uniModifiers'), files: [], n: info.modifiers });
    if (info.negative) removing.push({ text: t('group.uniNegative'), files: [], n: info.negative, warn: true });
  }
  const priv = info.privacy || {};
  if (priv.paths) removing.push({ text: t('group.privPaths'), files: [], n: priv.paths });
  if (priv.profile) removing.push({ text: t('group.privProfile'), files: [], n: priv.profile });
  const ov = state.keepObj || uni ? [] : info.overrides;
  if (removing.length || ov.length) {
    h += `<div class="card"><h4>${t('d.toRemove')}</h4><ul class="list">` +
      removing.map((g) => `<li${g.warn ? ' class="warn-li"' : ''}>${esc(g.text)}<span class="n">${g.files.length > 1 ? t('d.nFiles', { n: g.files.length }) : g.n ? g.n : ''}</span></li>`).join('') +
      (ov.length ? `<li>${t('d.perObject')}<span class="n">${ov.length}</span></li>` : '') + '</ul>' +
      (ov.length ? `<div class="keys">${ov.slice(0, 18).map((k) => `<code>${esc(k)}</code>`).join('')}${ov.length > 18 ? `<code>+${ov.length - 18}</code>` : ''}</div>` : '') + '</div>';
  } else {
    h += `<div class="card"><h4>${t('d.toRemove')}</h4><div class="muted">${t('d.nothing')}${state.mode === 'filaments' && !info.filaments.length ? t('d.nothingFil') : ''}</div></div>`;
  }
  if (uni) {
    const plates = info.plates > 1 ? `<li>${t(state.splitPlates ? 'd.platesSplit' : 'd.plates', info.plates)}</li>` : '';
    h += `<div class="card"><h4>${t('d.unchanged')}</h4><ul class="list keep">
      <li>${t('d.uniKeep.geometry')}</li><li>${t('d.uniKeep.names')}</li><li>${t('d.uniKeep.paint')}</li><li>${t('d.uniKeep.meta')}</li>${plates}</ul></div>`;
  } else {
    h += `<div class="card"><h4>${t('d.unchanged')}</h4><ul class="list keep">
    <li>${t('d.keep.geometry')}</li><li>${t('d.keep.names')}</li><li>${t('d.keep.paint')}</li><li>${t('d.keep.plate')}</li>
    ${state.keepObj && info.overrides.length ? `<li>${t('d.keep.objSettings')}</li>` : ''}</ul></div>`;
  }
  el.innerHTML = h;
  boxCards(el);
  bindResult();
}

// Karty w stylu GNOME: tytuł nad listą, zawartość w zaokrąglonym polu.
function boxCards(root) {
  root.querySelectorAll('.card').forEach((card) => {
    if (card.querySelector(':scope > .box')) return;
    const head = card.querySelector(':scope > h4');
    const box = document.createElement('div');
    box.className = 'box';
    [...card.childNodes].filter((n) => n !== head).forEach((n) => box.appendChild(n));
    card.appendChild(box);
  });
}

// Dodatkowa kopia uniwersalna przy trybach dla Orki ("Zapisz też wersję Uniwersalną").
function alsoBlock(u) {
  if (u.error) return `<div class="also"><b>${t('r.alsoTitle')}</b><div class="warn">⚠ ${esc(errText(u.error))}</div></div>`;
  return `<div class="also"><b>${t('r.alsoTitle')}</b><div class="out-more">${(u.outAll || [u.outDisplay || u.out]).map((p) => esc(baseName(p))).join('<br>')}</div>
    ${(u.warnings || []).map((w) => `<div class="warn">⚠ ${esc(tCode('w', w))}</div>`).join('')}</div>`;
}

function resultCard(r) {
  if (r.error) return `<div class="card result err"><h4>${t('r.error')} <span class="tag drop">${t('r.notSaved')}</span></h4><div>${esc(errText(r.error))}</div></div>`;
  const ov = Object.keys(r.overrides || {}).length;
  return `<div class="card result"><h4>${t('r.saved')} <span class="tag keep">${esc(fmtSize(r.sizeBefore))} → ${esc(fmtSize(r.sizeAfter))}</span></h4>
    <div class="out">${esc(r.outDisplay || r.out)}</div>
    ${r.outCount > 1 ? `<div class="out-more">${r.outAll.slice(1).map((p) => esc(baseName(p))).join('<br>')}</div>` : ''}
    <div class="muted" style="font-size:12px">${r.universal ? t('r.uniSummary', { n: r.outCount || 1 }) : t('r.summary', { removed: r.removed.length, ov, slots: r.slots?.length || 0 })}${r.thumbnail ? t('r.thumb') : ''}${r.author ? t('r.author') : ''}</div>
    ${(r.warnings || []).map((w) => `<div class="warn">⚠ ${esc(tCode('w', w))}</div>`).join('')}
    ${r.also ? alsoBlock(r.also) : ''}
    <button class="btn primary big show-btn" data-show="${esc(r.out)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 10.5v5m0 0-2.2-2.2M12 15.5l2.2-2.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>${t('r.show')}</button></div>`;
}
function bindResult() {
  document.querySelectorAll('[data-show]').forEach((b) => { b.onclick = () => api.showInFolder(b.dataset.show); });
  document.querySelectorAll('[data-th]').forEach((b) => { b.onclick = () => thumbAction(b.dataset.th); });
  document.querySelectorAll('[data-th-mode]').forEach((b) => { b.onclick = () => setThumbMode(state.files[state.sel], b.dataset.thMode); });
}

// ============ miniatura ============
function thumbCard(f) {
  const custom = f.thumb;
  const orig = f.info?.thumbnail;
  const src = custom?.url || orig?.dataUrl;
  const tag = custom ? `<span class="tag custom">${t('th.custom')}</span>` : orig ? `<span class="tag neutral">${t('th.fromFile')}</span>` : '';
  const others = state.files.length > 1;
  return `<div class="card"><h4>${t('th.title')} ${tag}</h4>
    <div class="thumb-row">
      <button class="thumb-box" data-th="pick" title="${esc(t(custom ? 'th.change' : 'th.choose'))}">${src ? `<img src="${esc(src)}" alt="">` : `<span class="ph">${t('th.none')}</span>`}</button>
      <div class="thumb-actions">
        <button class="btn ghost sm" data-th="pick">${t(custom ? 'th.change' : 'th.choose')}</button>
        ${renderer ? `<button class="btn ghost sm" data-th="snap">${t('th.from3d')}</button>` : ''}
        ${custom ? `<div class="seg"><button data-th-mode="fill" class="${custom.mode === 'fill' ? 'on' : ''}" title="${esc(t('th.fill.title'))}">${t('th.fill')}</button><button data-th-mode="fit" class="${custom.mode === 'fit' ? 'on' : ''}" title="${esc(t('th.fit.title'))}">${t('th.fit')}</button></div>` : ''}
        ${custom ? `<button class="link" data-th="reset">${t('th.reset')}</button>` : ''}
        ${custom && others ? `<button class="link" data-th="all">${t('th.all', state.files.length)}</button>` : ''}
      </div>
    </div>
    <div class="thumb-note">${esc(custom ? custom.name : '')}${custom ? ' · ' : ''}${t('th.hint')}</div></div>`;
}

async function thumbAction(kind) {
  const f = state.files[state.sel];
  if (!f || state.running) return;
  if (kind === 'pick') {
    const img = await api.pickImage(getLang());
    if (img) await applyImage([f], img, f.thumb?.mode || 'fill');
  } else if (kind === 'snap') {
    await captureThumb();
  } else if (kind === 'reset') {
    const prev = f.thumb;
    f.thumb = null; releaseThumbIfUnused(prev); invalidate(f); refreshAfterThumb();
  } else if (kind === 'all' && f.thumb) {
    const src = f.thumb;
    for (const o of state.files) if (o !== f) { const prev = o.thumb; o.thumb = { ...src }; releaseThumbIfUnused(prev); invalidate(o); }
    refreshAfterThumb();
    toast(t('th.setAll', state.files.length));
  }
}

async function applyImage(files, img, mode) {
  if (!img) { toast(t('th.unsupported')); return; }
  let bitmap;
  try { bitmap = await decodeImage(img.bytes); } catch (e) { toast(t('th.bad', { msg: e.message })); return; }
  const out = await makeThumb(bitmap, mode);
  for (const f of files) { const prev = f.thumb; f.thumb = { name: img.name, bitmap, mode, ...out }; releaseThumbIfUnused(prev); invalidate(f); }
  refreshAfterThumb();
  toast(files.length > 1 ? t('th.setAll', files.length) : t('th.set', { name: img.name }));
}

async function setThumbMode(f, mode) {
  if (!f?.thumb || f.thumb.mode === mode || state.running) return;
  const out = await makeThumb(f.thumb.bitmap, mode);
  const prevUrl = f.thumb.url;
  f.thumb = { ...f.thumb, mode, ...out };
  if (prevUrl && !state.files.some((x) => x.thumb?.url === prevUrl)) { try { URL.revokeObjectURL(prevUrl); } catch { /* ignore */ } }
  invalidate(f);
  refreshAfterThumb();
}

// Zmiana miniatury unieważnia wcześniejszy wynik tego pliku.
function invalidate(f) {
  f.results = {};
  if (state.files[state.sel] === f && state.view === 'out') { state.view = 'src'; loadPreview(); }
}
function refreshAfterThumb() { renderList(); renderDetails(); const f = state.files[state.sel]; $('srcToggle').hidden = !(f && f.results[state.mode] && !f.results[state.mode].error); }

// ============ tryb i opcje ============
function setMode(m) {
  state.mode = m;
  $('keepObjRow').hidden = m === 'universal';
  if ($('alsoUniRow')) $('alsoUniRow').hidden = m === 'universal';
  $('splitRow').hidden = m !== 'universal';
  document.querySelectorAll('.mode').forEach((b) => { b.classList.toggle('on', b.dataset.mode === m); b.setAttribute('aria-checked', String(b.dataset.mode === m)); });
  const f = state.files[state.sel];
  const r = f && f.results[m];
  if (state.view === 'out' && !(r && !r.error)) { state.view = 'src'; }
  renderList(); renderDetails();
  if (state.view === 'out') loadPreview();
  else { $('srcToggle').hidden = !(r && !r.error); document.querySelectorAll('#srcToggle button').forEach((b) => b.classList.toggle('on', b.dataset.src === state.view)); recolor(); }
}
document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('keepObj').checked = state.keepObj;
$('keepObj').onchange = () => {
  state.keepObj = $('keepObj').checked; store.set('keepObj', state.keepObj);
  for (const f of state.files) f.results = {};
  renderList(); renderDetails(); if (state.view === 'out') { state.view = 'src'; loadPreview(); } else $('srcToggle').hidden = true;
};

if ($('alsoUni')) {
  $('alsoUni').checked = state.alsoUni;
  $('alsoUni').onchange = () => {
    state.alsoUni = $('alsoUni').checked; store.set('alsoUni', state.alsoUni);
  };
}
$('splitPlates').checked = state.splitPlates;
$('splitPlates').onchange = () => {
  state.splitPlates = $('splitPlates').checked; store.set('splitPlates', state.splitPlates);
  for (const f of state.files) delete f.results.universal;
  renderList(); renderDetails(); if (state.mode === 'universal' && state.view === 'out') { state.view = 'src'; loadPreview(); }
};

// ---- autor i licencja ----
const AUTHOR_KEYS = ['Designer', 'License', 'Copyright'];
function renderAuthor() {
  const a = state.author;
  $('authorOn').checked = !!a.on;
  const parts = AUTHOR_KEYS.map((k) => (a[k] || '').trim()).filter(Boolean);
  $('authorSum').textContent = !a.on ? t('author.sumOff') : parts.length ? parts.join(' · ') : t('author.sumEmpty');
}
function authorChanged() {
  store.set('author', state.author);
  for (const f of state.files) f.results = {};
  renderAuthor(); renderList(); renderDetails();
  if (state.view === 'out') { state.view = 'src'; loadPreview(); } else $('srcToggle').hidden = true;
}
$('authorOn').onchange = () => {
  state.author = { ...state.author, on: $('authorOn').checked };
  if (state.author.on && !AUTHOR_KEYS.some((k) => (state.author[k] || '').trim())) { openAuthor(); return; }
  authorChanged();
};
function openAuthor() {
  for (const k of AUTHOR_KEYS) $('a' + k).value = state.author[k] || '';
  $('authorModal').hidden = false;
  setTimeout(() => $('aDesigner').focus(), 30);
}
function closeAuthor() {
  $('authorModal').hidden = true;
  if (state.author.on && !AUTHOR_KEYS.some((k) => (state.author[k] || '').trim())) { state.author = { ...state.author, on: false }; authorChanged(); }
}
$('authorEdit').onclick = openAuthor;
$('authorCancel').onclick = closeAuthor;
$('authorModal').addEventListener('click', (e) => { if (e.target === $('authorModal')) closeAuthor(); });
document.addEventListener('keydown', (e) => {
  if ($('authorModal').hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeAuthor(); return; }
  if (e.key === 'Tab') {
    const focusable = [...$('authorModal').querySelectorAll('input, button')].filter((el) => !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$('authorForm').onsubmit = (e) => {
  e.preventDefault();
  const next = { ...state.author };
  for (const k of AUTHOR_KEYS) next[k] = $('a' + k).value.trim();
  next.on = AUTHOR_KEYS.some((k) => next[k]);
  state.author = next;
  $('authorModal').hidden = true;
  authorChanged();
};

// ============ czyszczenie ============
$('run').onclick = runAll;
async function runAll() {
  if (state.running || !state.files.length) return;
  state.running = true;
  const mode = state.mode;
  const a = state.author;
  const opts = { filaments: mode === 'filaments', universal: mode === 'universal', splitPlates: state.splitPlates, keepObjectSettings: state.keepObj,
    metadata: a.on ? { Designer: a.Designer || '', License: a.License || '', Copyright: a.Copyright || '' } : null };
  const files = state.files.slice();
  $('progress').hidden = false;
  const bar = $('progress').querySelector('.bar');
  let ok = 0, err = 0, warn = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    f.status = 'working';
    $('runNote').textContent = `${i + 1} / ${files.length}: ${f.name}`;
    bar.style.width = `${(i / files.length) * 100}%`;
    renderList();
    try {
      const thumbArg = f.thumb ? { middle: f.thumb.middle, small: f.thumb.small } : null;
      f.results[mode] = await api.clean(srcOf(f), { ...opts, thumbnail: thumbArg });
      if (mode !== 'universal' && state.alsoUni) {
        // Kopia uniwersalna to osobny wynik: jej błąd nie unieważnia zapisanego pliku dla Orki.
        try {
          f.results.universal = await api.clean(srcOf(f), { ...opts, filaments: false, universal: true, thumbnail: thumbArg });
          f.results[mode].also = f.results.universal;
        } catch (e) {
          f.results[mode].also = { error: parseErr(e) };
          delete f.results.universal;
        }
      }
      // Tryby dla Orki zapisują ten sam plik, więc wynik drugiego z nich został nadpisany.
      if (mode !== 'universal') delete f.results[mode === 'clean' ? 'filaments' : 'clean'];
      ok++; if (f.results[mode].warnings.length || f.results[mode].also?.error || f.results[mode].also?.warnings?.length) warn++;
    } catch (e) {
      f.results[mode] = { error: parseErr(e) };
      err++;
    }
    f.status = 'idle';
    renderList();
    if (state.files[state.sel] === f) renderDetails();
  }
  bar.style.width = '100%';
  state.running = false;
  renderList();
  state.lastRun = { ok, warn, err, dir: files.length === 1 ? outName(files[0].name) : 'Cleaned_…' };
  $('runNote').textContent = t('run.done', state.lastRun);
  setTimeout(() => { $('progress').hidden = true; bar.style.width = '0'; }, 1200);
  toast(err ? t('toast.errors', { n: err }) : t('toast.ok', ok));
  const f = state.files[state.sel];
  if (f && f.results[mode] && !f.results[mode].error) { state.view = 'out'; renderDetails(); await loadPreview(); }
}

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

window.addEventListener('keydown', (e) => {
  if (!$('authorModal').hidden || e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowDown' && state.sel < state.files.length - 1) { select(state.sel + 1); e.preventDefault(); }
  if (e.key === 'ArrowUp' && state.sel > 0) { select(state.sel - 1); e.preventDefault(); }
  if (e.key === 'Delete' && state.sel >= 0) removeFile(state.sel);
});

// ============ język ============
function setLanguage(l) {
  setLang(l); store.set('lang', getLang());
  api.setHelpLang(getLang());
  document.querySelectorAll('.lang button').forEach((b) => { const on = b.dataset.lang === getLang(); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  applyStatic();
  renderList(); renderDetails(); renderStats(); renderLegend(); renderViewErr(); renderDropDir(); renderAuthor();
  if (state.lastRun && !state.running) $('runNote').textContent = t('run.done', state.lastRun);
}
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLanguage(b.dataset.lang)));
document.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => api.openLink(b.dataset.link)));
$('helpBtn').addEventListener('click', () => api.openHelp(getLang()));

// ============ start ============
(async () => {
  const init = await api.init();
  state.test = init.test;
  // Ustawienia z magazynu platformy są dostępne dopiero po inicjalizacji.
  state.keepObj = store.get('keepObj', state.keepObj);
  $('keepObj').checked = state.keepObj;
  state.alsoUni = store.get('alsoUni', state.alsoUni);
  if ($('alsoUni')) $('alsoUni').checked = state.alsoUni;
  state.splitPlates = store.get('splitPlates', state.splitPlates);
  state.author = store.get('author', state.author);
  if (init.test?.split) state.splitPlates = init.test.split === '1';
  if (init.test?.author) { const [d, l, c] = init.test.author.split('|'); state.author = { on: true, Designer: d || '', License: l || '', Copyright: c || '' }; }
  $('splitPlates').checked = state.splitPlates;
  renderAuthor();
  setLang(store.get('lang', 'en'));   // pierwsze uruchomienie po angielsku, potem ostatnio wybrany język
  setLanguage(init.test?.lang || getLang());
  if (init.test?.mode) state.mode = init.test.mode;
  setMode(state.mode);
  renderList(); renderDetails();
  if (init.files.length) {
    await addFiles(init.files);
    if (init.test?.thumb) await applyImage(state.files, await api.readImage(init.test.thumb), init.test.thumbMode || 'fill');
    if (init.test?.select) await select(init.test.select);
    if (init.test?.run) await runAll();
    if (init.test?.view === 'src' && state.view !== 'src') { state.view = 'src'; }
    if (init.test) await loadPreview();
  }
  if (init.test?.help) api.openHelp(getLang());
  if (init.test) setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => api.rendered())), 300);
  else api.rendered();
})();
