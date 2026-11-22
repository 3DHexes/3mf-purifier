// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
// Warstwa platformy: Neutralino (WebView2 na Windows, WebKitGTK na Linuksie, WKWebView na macOS). Udostępnia window.api,
// z którego korzysta interfejs (app.js) i okno pomocy (help.js).
import { baseName, dirName, outDirFor, isOutputDir, modelName } from './core/purify.js';

const N = window.Neutralino;
const LINKS = {
  mmf: 'https://www.myminifactory.com/profile/3DHexes',
  discord: 'https://discord.gg/MfkejWQZ4D',
  kickstarter: 'https://www.kickstarter.com/profile/3dhexes/created',
  kofi: 'https://ko-fi.com/3dhexes',
  repo: 'https://github.com/3DHexes/3mf-purifier',
};
const DIALOG = {
  en: { files: 'Select 3MF files', filter: '3MF files', folder: 'Select a folder with 3MF files', image: 'Select a thumbnail image', images: 'Images', dropDir: 'Where to save files dragged into the window' },
  pl: { files: 'Wybierz pliki 3MF', filter: 'Pliki 3MF', folder: 'Wybierz folder z plikami 3MF', image: 'Wybierz obraz miniatury', images: 'Obrazy', dropDir: 'Gdzie zapisywać pliki przeciągnięte do okna' },
  de: { files: '3MF-Dateien wählen', filter: '3MF-Dateien', folder: 'Ordner mit 3MF-Dateien wählen', image: 'Vorschaubild wählen', images: 'Bilder', dropDir: 'Wohin ins Fenster gezogene Dateien gespeichert werden' },
  fr: { files: 'Choisir des fichiers 3MF', filter: 'Fichiers 3MF', folder: 'Choisir un dossier de fichiers 3MF', image: 'Choisir une miniature', images: 'Images', dropDir: 'Où enregistrer les fichiers glissés dans la fenêtre' },
  es: { files: 'Elegir archivos 3MF', filter: 'Archivos 3MF', folder: 'Elegir una carpeta con archivos 3MF', image: 'Elegir una miniatura', images: 'Imágenes', dropDir: 'Dónde guardar los archivos arrastrados a la ventana' },
};
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'avif'];
const IMAGE_RE = new RegExp('\\.(' + IMAGE_EXT.join('|') + ')$', 'i');
const isWindows = () => (window.NL_OS || '').toLowerCase().startsWith('win');
const query = new URLSearchParams(location.search);

// Błąd z kodem przekazywany do interfejsu w tym samym formacie co w wersji Electron.
const coded = (code, params, message) => new Error('C3MF' + JSON.stringify({ code: code || '', params: params || {}, message: message || '' }));

const ready = (async () => {
  N.init();
  await new Promise((resolve) => {
    if (window.NL_TOKEN === undefined && !sessionStorage.getItem('NL_TOKEN')) return resolve();
    N.events.on('ready', resolve);
    setTimeout(resolve, 3000);
  });
  try { prefs = JSON.parse(await N.storage.getData('prefs')) || {}; } catch { prefs = {}; }
})();
let prefs = {};

// ---------- pliki ----------
// Odczyt przez wbudowany serwer HTTP (szybki, binarny); zapasowo przez API plików (base64).
const mounts = new Map();
let mountSeq = 0;
async function readBytes(src) {
  // Plik przeciągnięty do okna: przeglądarka daje zawartość, ale nie ścieżkę.
  if (src && typeof src === 'object' && src.file) return new Uint8Array(await src.file.arrayBuffer());
  const path = src;
  const dir = dirName(path), name = baseName(path);
  try {
    let mp = mounts.get(dir);
    if (!mp) {
      mp = `/__m${++mountSeq}`;
      await N.server.mount(mp, dir);
      mounts.set(dir, mp);
    }
    const res = await fetch(`${mp}/${encodeURIComponent(name)}`, { cache: 'no-store' });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
  } catch { /* zapasowa ścieżka niżej */ }
  try {
    return new Uint8Array(await N.filesystem.readBinaryFile(path));
  } catch (e) {
    throw coded('readFailed', { path, detail: e?.message || e?.code || '' });
  }
}

// Zapis kawałkami, żeby nie przesyłać kilkuset MB w jednej wiadomości.
async function writeBytes(path, u8) {
  const CHUNK = 4 << 20;
  const piece = (i) => u8.buffer.slice(u8.byteOffset + i, u8.byteOffset + Math.min(u8.length, i + CHUNK));
  await N.filesystem.writeBinaryFile(path, piece(0));
  for (let i = CHUNK; i < u8.length; i += CHUNK) await N.filesystem.appendBinaryFile(path, piece(i));
}

async function exists(path) {
  try { await N.filesystem.getStats(path); return true; } catch { return false; }
}

// Tworzy folder razem z brakującymi folderami nadrzędnymi.
async function mkdirp(dir) {
  if (!dir || await exists(dir)) return;
  await mkdirp(dirName(dir));
  try { await N.filesystem.createDirectory(dir); } catch (e) { if (!(await exists(dir))) throw e; }
}
const display = (p) => (isWindows() ? p.replace(/\//g, '\\') : p);

// Folder na wyniki plików przeciągniętych do okna (domyślnie Dokumenty/3MF Purifier).
async function dropDir() {
  if (prefs.dropDir) return prefs.dropDir;
  let docs = '';
  try { docs = await N.os.getPath('documents'); } catch { /* bez folderu Dokumenty */ }
  if (!docs) { try { docs = await N.os.getPath('downloads'); } catch { docs = window.NL_CWD || '.'; } }
  return docs.replace(/[\\/]+$/, '') + '/3MF Purifier';
}

async function collect(paths) {
  const out = new Set();
  for (const p of paths.filter(Boolean)) {
    let st;
    try { st = await N.filesystem.getStats(p); } catch { continue; }
    if (st.isFile) { if (/\.3mf$/i.test(p)) out.add(p); continue; }
    let entries = [];
    try { entries = await N.filesystem.readDirectory(p, { recursive: true }); } catch { continue; }
    const root = p.replace(/[\\/]+$/, '');
    for (const e of entries) {
      const full = e.path || (root + '/' + e.entry);
      if (e.type !== 'FILE' || !/\.3mf$/i.test(full)) continue;
      // Pomijamy wyniki w podfolderach Cleaned_* (i stare geometry_*), poza wskazanym folderem.
      const rel = full.slice(root.length).split(/[\\/]/).filter(Boolean);
      if (rel.slice(0, -1).some(isOutputDir)) continue;
      out.add(full);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

// ---------- wątek roboczy ----------
function runJob(job, bytes, opts) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => { w.terminate(); e.data.ok ? resolve(e.data.value) : reject(coded(e.data.code, e.data.params, e.data.message)); };
    w.onerror = (e) => { w.terminate(); reject(coded('', {}, e.message || 'worker error')); };
    w.postMessage({ job, bytes, opts }, [bytes.buffer]);
  });
}

// ---------- okno pomocy ----------
let helpFrame = null;
function openHelpOverlay(lang) {
  if (helpFrame) { helpFrame.querySelector('iframe').contentWindow.postMessage({ helpLang: lang }, '*'); helpFrame.hidden = false; return; }
  helpFrame = document.createElement('div');
  helpFrame.className = 'help-overlay';
  helpFrame.innerHTML = `<div class="help-dialog"><button class="help-close" aria-label="Close">×</button><iframe src="help.html?lang=${encodeURIComponent(lang)}&embedded=1"></iframe></div>`;
  helpFrame.addEventListener('click', (e) => { if (e.target === helpFrame || e.target.closest('.help-close')) helpFrame.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && helpFrame) helpFrame.hidden = true; });
  document.body.appendChild(helpFrame);
}

// ---------- API ----------
const dropListeners = [];
const api = {
  async init() {
    await ready;
    const args = (window.NL_ARGS || []).slice(1).filter((a) => !a.startsWith('--'));
    // Hooki testowe w URL działają tylko w trybie przeglądarkowym (testy automatyczne), nie w docelowym oknie aplikacji.
    const allowTest = window.NL_MODE !== 'window';
    const qFiles = allowTest ? (query.get('files') || '').split('|').filter(Boolean) : [];
    const test = allowTest && query.get('test') ? {
      mode: query.get('mode') || '', run: query.get('run') === '1', view: query.get('view') || '',
      select: +(query.get('select') || 0), lang: query.get('lang') || '', thumb: query.get('thumb') || '', thumbMode: query.get('thumbMode') || '', help: query.get('help') === '1',
      split: query.get('split') || '', author: query.get('author') || '',
    } : null;
    return { files: await collect([...args, ...qFiles]), test, platform: window.NL_OS || '' };
  },
  prefs: {
    get: (k, d) => (k in prefs ? prefs[k] : d),
    set: (k, v) => { prefs[k] = v; N.storage.setData('prefs', JSON.stringify(prefs)).catch(() => {}); },
  },
  async pickFiles(lang) {
    const d = DIALOG[lang] || DIALOG.en;
    try { return await collect(await N.os.showOpenDialog(d.files, { multiSelections: true, filters: [{ name: d.filter, extensions: ['3mf'] }] })); } catch { return []; }
  },
  async pickFolder(lang) {
    const d = DIALOG[lang] || DIALOG.en;
    try { const p = await N.os.showFolderDialog(d.folder); return p ? await collect([p]) : []; } catch { return []; }
  },
  collect,
  async analyze(path) { return runJob('analyze', await readBytes(path)); },
  async preview(path) { return runJob('preview', await readBytes(path)); },
  async clean(src, opts) {
    const bytes = await readBytes(src);
    const srcSize = bytes.length;
    const thumb = opts.thumbnail ? { middle: new Uint8Array(opts.thumbnail.middle), small: new Uint8Array(opts.thumbnail.small) } : null;
    const res = await runJob('clean', bytes, { ...opts, thumbnail: thumb });
    let outDir, name;
    if (src && typeof src === 'object' && src.file) {
      // Przeciągnięty plik: folder wyników + ewentualna podścieżka z przeciągniętego folderu.
      const base = (await dropDir()) + (src.rel ? '/' + src.rel : '');
      name = modelName(src.file.name);
      outDir = base + '/Cleaned_' + name;
    } else {
      outDir = outDirFor(src); name = modelName(src);
    }
    const sep = outDir.includes('\\') && !outDir.includes('/') ? '\\' : '/';
    // Tryb Universal: osobna nazwa, żeby nie nadpisać pliku dla Orki; płyty jako _plateN.
    const outs = res.files
      ? res.files.map((f) => ({ dst: outDir + sep + name + (f.plate && res.files.length > 1 ? '_plate' + f.plate : '') + '_universal.3mf', data: f.zipped }))
      : [{ dst: outDir + sep + name + '.3mf', data: res.zipped }];
    try {
      await mkdirp(outDir);
      for (const o of outs) {
        const tmp = o.dst + '.tmp';
        await writeBytes(tmp, o.data);
        if (await exists(o.dst)) await N.filesystem.remove(o.dst);
        await N.filesystem.move(tmp, o.dst);
      }
    } catch (e) {
      throw coded('writeFailed', { path: outs[0].dst, detail: e?.message || e?.code || '' });
    }
    const r = res.r;
    if (res.files) {
      r.sizeBefore = srcSize;
      r.sizeAfter = outs.reduce((a, o) => a + o.data.length, 0);
      r.removed = r.removed || [];
      r.overrides = r.overrides || {};
      r.universal = true;
      r.thumbnail = !!thumb;
      r.author = !!(opts.metadata && Object.values(opts.metadata).some(Boolean));
      delete r.files;
    }
    return { ...r, out: outs[0].dst, outDir, outDisplay: display(outs[0].dst), outCount: outs.length, outAll: outs.map((o) => display(o.dst)) };
  },
  async getDropDir() { return display(await dropDir()); },
  async pickDropDir(lang) {
    const d = DIALOG[lang] || DIALOG.en;
    try {
      const p = await N.os.showFolderDialog(d.dropDir, { defaultPath: await dropDir() });
      if (p) api.prefs.set('dropDir', p);
    } catch { /* anulowano */ }
    return display(await dropDir());
  },
  async showInFolder(p) {
    if (!p) return;
    const clean = String(p).replace(/[\0\r\n]/g, '');
    if (!clean) return;
    const fileThere = await exists(clean);
    const target = fileThere ? clean : dirName(clean);
    if (!target) return;
    if (isWindows()) {
      const win = target.replace(/\//g, '\\').replace(/"/g, '');
      const cmd = fileThere ? `explorer.exe /select,"${win}"` : `explorer.exe "${win}"`;
      await N.os.execCommand(cmd, { background: true });
    } else {
      const shQuote = (s) => "'" + s.replace(/'/g, "'\\''") + "'";
      if (/^darwin/i.test(window.NL_OS || '')) await N.os.execCommand(`open ${fileThere ? '-R ' : ''}${shQuote(target)}`, { background: true });
      else await N.os.execCommand(`xdg-open ${shQuote(fileThere ? dirName(target) : target)}`, { background: true });
    }
  },
  async pickImage(lang) {
    const d = DIALOG[lang] || DIALOG.en;
    try {
      const [p] = await N.os.showOpenDialog(d.image, { filters: [{ name: d.images, extensions: IMAGE_EXT }] });
      return p ? await api.readImage(p) : null;
    } catch { return null; }
  },
  async readImage(p) {
    if (!p || !IMAGE_RE.test(p)) return null;
    try { const st = await N.filesystem.getStats(p); if (st.size > 60 << 20) return null; } catch { return null; }
    return { name: baseName(p), path: p, bytes: await readBytes(p) };
  },
  openLink(key) { if (LINKS[key]) N.os.open(LINKS[key]); },
  async openHelp(lang) {
    if (window.NL_MODE === 'window' && !query.get('test')) {
      try {
        await N.window.create(`/help.html?lang=${encodeURIComponent(lang)}`, {
          title: ({ pl: 'Pomoc 3MF Purifier', de: '3MF Purifier Hilfe', fr: 'Aide de 3MF Purifier', es: 'Ayuda de 3MF Purifier' })[lang] || '3MF Purifier help', icon: '/www/icon.png',
          width: 900, height: 760, minWidth: 640, minHeight: 480, center: true, enableInspector: false, exitProcessOnClose: true,
        });
        return;
      } catch { /* okno w oknie poniżej */ }
    }
    openHelpOverlay(lang);
  },
  setHelpLang(lang) { helpFrame?.querySelector('iframe')?.contentWindow.postMessage({ helpLang: lang }, '*'); },
  onHelpLang(cb) { window.addEventListener('message', (e) => { if (e.data?.helpLang) cb(e.data.helpLang); }); },
  onAddFiles() { /* jedna instancja na okno */ },
  onDropPaths(cb) { dropListeners.push(cb); },
  async imageFromFile(file) {
    if (!file || !IMAGE_RE.test(file.name) || file.size > 60 << 20) return null;
    return { name: file.name, path: '', bytes: new Uint8Array(await file.arrayBuffer()) };
  },
  pathForFile() { return ''; },
  rendered() { window.__rendered = true; },
};

// Upuszczone pliki z pełnymi ścieżkami (window.emitDropEvents w konfiguracji Neutralino).
ready.then(() => N.events.on('filesDropped', (e) => {
  const d = e.detail;
  const list = (Array.isArray(d) ? d : d?.files || d?.paths || []).map((x) => (typeof x === 'string' ? x : x?.path || x?.name || '')).filter(Boolean);
  if (list.length) dropListeners.forEach((cb) => cb(list));
}));

window.api = api;
