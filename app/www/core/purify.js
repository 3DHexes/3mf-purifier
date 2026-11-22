// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
// 3MF Purifier - czyszczenie plików 3MF (wersja przeglądarkowa, bez Node.js).
// Usuwa ustawienia drukarki, procesu i filamentów, G-code i nadpisania per obiekt.
// Tryb "filaments" zapisuje listę filamentów w formacie "Publish 3MF" z OrcaSlicera 2.5+.
// Działa na bajtach (Uint8Array); odczyt i zapis plików robi warstwa platformy.

import { unzipSync, zipSync } from '../vendor/fflate.js';

// ---------- ścieżki ----------
// Wynik trafia do folderu "Cleaned_<nazwa modelu>" obok pliku źródłowego (w obu trybach).
export const OUT_PREFIX = 'Cleaned_';
export const LEGACY_OUT = new Set(['geometry_only', 'geometry_filaments']);
const sepOf = (p) => (p.includes('\\') && !p.includes('/') ? '\\' : '/');
export const baseName = (p) => p.split(/[\\/]/).pop();
export const dirName = (p) => { const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i < 0 ? '' : p.slice(0, i); };
export const modelName = (p) => baseName(p).replace(/(\.gcode)?\.3mf$/i, '');
export const outDirFor = (srcPath) => dirName(srcPath) + sepOf(srcPath) + OUT_PREFIX + modelName(srcPath);
export const outFileFor = (srcPath) => outDirFor(srcPath) + sepOf(srcPath) + modelName(srcPath) + '.3mf';
export const isOutputDir = (name) => name.toLowerCase().startsWith(OUT_PREFIX.toLowerCase()) || LEGACY_OUT.has(name.toLowerCase());

// ---------- reguły ----------
const DROP_RE = new RegExp('^Metadata/(' + [
  'project_settings\\.config',
  '(print|process|filament|machine|printer)_settings_\\d+\\.config',
  'slice_info\\.config',
  '.*\\.gcode', '.*\\.gcode\\.md5', '.*\\.bgcode',
  '.*statistics.*\\.json',
  'custom_gcode_per_layer\\.xml',
  'layer_heights_profile\\.txt', 'layer_config_ranges\\.xml',
  'Slic3r_PE\\.config',
  'Prusa_Slicer_custom_gcode_per_print_z\\.xml',
].join('|') + ')$', 'i');

const DROP_LABELS = [
  [/project_settings\.config$/i, 'profile'],
  [/_settings_\d+\.config$/i, 'presets'],
  [/slice_info\.config$/i, 'sliceInfo'],
  [/\.(b?gcode|md5)$/i, 'gcode'],
  [/statistics.*\.json$/i, 'stats'],
  [/custom_gcode_per_layer\.xml$/i, 'customGcode'],
  [/layer_heights_profile\.txt$|layer_config_ranges\.xml$/i, 'layerHeight'],
  [/Slic3r_PE\.config$|Prusa_Slicer/i, 'prusa'],
];

// Błąd z kodem: interfejs tłumaczy go na wybrany język.
export class CodedError extends Error {
  constructor(code, params = {}) { super(code + (Object.keys(params).length ? ' ' + JSON.stringify(params) : '')); this.code = code; this.params = params; }
}

const STRUCTURAL_KEYS = new Set(['name', 'matrix', 'extruder', 'module', 'source_file',
  'source_object_id', 'source_volume_id', 'source_offset_x', 'source_offset_y', 'source_offset_z',
  'source_in_inches', 'source_in_meters']);

const LEAK_MARKERS = ['printer_settings_id', 'print_settings_id', 'filament_settings_id', 'printer_model"', 'inherits_group'];

const REL_RE = /<Relationship\b[^>]*?\bTarget="([^"]+)"[^>]*?\/>\s*/g;
const OVERRIDE_RE = /<Override\b[^>]*?\bPartName="([^"]+)"[^>]*?\/>\s*/g;
const META_LINE_RE = /^[ \t]*<metadata\s+key="([^"]+)"\s+value="[^"]*"\s*\/>[ \t]*\r?\n?/gm;
const BLOCK_RE = /<(object|part)\b[^>]*>[\s\S]*?<\/(object|part)>/g;
const GCODE_FILE_RE = /(<metadata\s+key="gcode_file"\s+value=")[^"]*(")/g;

const td = new TextDecoder('utf-8');
const te = new TextEncoder();
const norm = (n) => n.replace(/^\/+/, '');

// ---------- narzędzia bajtowe ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
export function crc32(u8) {
  let c = -1;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function indexOfAscii(u8, ascii, limit) {
  const first = ascii.charCodeAt(0), n = ascii.length, end = Math.min(u8.length, limit) - n;
  outer: for (let i = 0; i <= end; i++) {
    if (u8[i] !== first) continue;
    for (let j = 1; j < n; j++) if (u8[i + j] !== ascii.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}
function toBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
const asU8 = (b) => (b instanceof Uint8Array ? b : new Uint8Array(b));

export function readZip(u8, filter) {
  try {
    return unzipSync(asU8(u8), filter ? { filter } : undefined);
  } catch (e) {
    throw new CodedError('notZip', { detail: e.message });
  }
}
export function findEntry(entries, wanted) {
  const w = wanted.toLowerCase();
  return Object.keys(entries).find((k) => norm(k).toLowerCase() === w);
}
function labelFor(name) {
  for (const [re, label] of DROP_LABELS) if (re.test(name)) return label;
  return 'other';
}

// ---------- miniatura (okładka 3MF) ----------
// Ten sam mechanizm co okładka w OrcaSlicer/Bambu Studio: pliki w Auxiliaries/.thumbnails
// i relacje w _rels/.rels. Podglądy płyt (plate_N, top_N, pick_N) zostają bez zmian.
export const THUMB_FILES = {
  cover: 'Auxiliaries/.thumbnails/thumbnail_3mf.png',
  middle: 'Auxiliaries/.thumbnails/thumbnail_middle.png',
  small: 'Auxiliaries/.thumbnails/thumbnail_small.png',
};
const THUMB_TYPES = {
  cover: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail',
  middle: 'http://schemas.bambulab.com/package/2021/cover-thumbnail-middle',
  small: 'http://schemas.bambulab.com/package/2021/cover-thumbnail-small',
};
const THUMB_REL_RE = /<Relationship\b[^>]*?\bType="[^"]*(?:\/metadata\/thumbnail|cover-thumbnail-middle|cover-thumbnail-small)"[^>]*?\/>\s*/g;
const relAttr = (tag, name) => (new RegExp('\\b' + name + '="([^"]*)"').exec(tag) || [])[1] || '';

export function setThumbnailRels(xml) {
  let s = xml || '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n';
  s = s.replace(THUMB_REL_RE, '');
  const ids = new Set([...s.matchAll(/\bId="([^"]*)"/g)].map((m) => m[1]));
  const pick = (want) => { let id = want, i = 1; while (ids.has(id)) id = want + '-' + i++; ids.add(id); return id; };
  const rows = [['cover', 'rel-2'], ['middle', 'rel-4'], ['small', 'rel-5']]
    .map(([k, id]) => ` <Relationship Target="/${THUMB_FILES[k]}" Id="${pick(id)}" Type="${THUMB_TYPES[k]}"/>\n`).join('');
  const end = s.lastIndexOf('</Relationships>');
  return end < 0 ? s + rows : s.slice(0, end) + rows + s.slice(end);
}

function ensurePngType(xml) {
  if (/Extension="png"/i.test(xml)) return xml;
  const end = xml.lastIndexOf('</Types>');
  const row = ' <Default Extension="png" ContentType="image/png"/>\n';
  return end < 0 ? xml : xml.slice(0, end) + row + xml.slice(end);
}

export function readThumbnail(u8) {
  const rels = readZip(u8, (f) => /^\/?_rels\/\.rels$/i.test(f.name));
  const relKey = Object.keys(rels)[0];
  const cands = [];
  if (relKey) {
    const xml = td.decode(rels[relKey]);
    for (const m of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      const type = relAttr(m[0], 'Type'), target = norm(relAttr(m[0], 'Target'));
      if (/\/metadata\/thumbnail$/.test(type)) cands.unshift(target);
      else if (/cover-thumbnail-middle$/.test(type)) cands.push(target);
    }
  }
  cands.push('Metadata/plate_1.png', 'Metadata/thumbnail.png');
  const want = new Set(cands.filter((c) => /\.(png|jpe?g)$/i.test(c)).map((c) => c.toLowerCase()));
  const imgs = readZip(u8, (f) => want.has(norm(f.name).toLowerCase()) && f.originalSize < (8 << 20));
  for (const c of cands) {
    const k = findEntry(imgs, c);
    if (k) return { path: c, dataUrl: `data:${/\.png$/i.test(c) ? 'image/png' : 'image/jpeg'};base64,` + toBase64(imgs[k]) };
  }
  return null;
}

// ---------- filamenty i "Publish 3MF" ----------
const PUBLISH_KEYS = ['filament_colour', 'filament_type', 'filament_vendor', 'filament_ids',
  'filament_diameter', 'filament_self_index', 'filament_extruder_variant',
  'wipe_tower_x', 'wipe_tower_y', 'wipe_tower_rotation_angle'];
const PUBLISH_STRING_KEYS = new Set(['filament_colour', 'filament_type', 'filament_vendor', 'filament_ids', 'filament_extruder_variant']);
const scalar = (v) => (v === null || v === undefined) ? '' : typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
const strList = (v) => Array.isArray(v) ? v.map(scalar) : (v === undefined || v === null ? [] : [scalar(v)]);

// Odpowiednik escape_strings_cstyle() z libslic3r/Config.cpp.
export function escapeStringsCStyle(strs) {
  return strs.map((s) => {
    const quote = (strs.length === 1 && s === '') || /[ \t;\\"\r\n]/.test(s);
    if (!quote) return s;
    return '"' + s.replace(/[\\"]/g, (c) => '\\' + c).replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
  }).join(';');
}
export function parseProjectSettings(bytes) {
  if (!bytes) return null;
  try { return JSON.parse(td.decode(bytes)); } catch { return null; }
}
export function filamentSlots(cfg) {
  if (!cfg) return [];
  const colours = strList(cfg.filament_colour);
  const types = strList(cfg.filament_type), vendors = strList(cfg.filament_vendor);
  const ids = strList(cfg.filament_ids), presets = strList(cfg.filament_settings_id);
  return colours.map((c, i) => ({ color: c, type: types[i] || '', vendor: vendors[i] || '', id: ids[i] || '', preset: presets[i] || '' }));
}
export function buildPublish(cfg) {
  const slots = filamentSlots(cfg);
  if (!slots.length) throw new CodedError('noFilaments');
  let payload = '';
  for (const key of PUBLISH_KEYS) {
    if (!(key in cfg)) continue;
    const v = cfg[key];
    const s = Array.isArray(v) ? (PUBLISH_STRING_KEYS.has(key) ? escapeStringsCStyle(strList(v)) : strList(v).join(',')) : scalar(v);
    if (/[\r\n]/.test(s)) continue;
    payload += `${key} = ${s}\n`;
  }
  const materials = slots.map((s, i) => ({
    material: { filament_type: s.type, filament_vendor: s.vendor, filament_id: s.id, setting_id: '', name: s.preset },
    slot: i, keys: [], full: false, full_keys: [],
    publish_type: s.type !== '', type: s.type,
    publish_color: s.color !== '', color: s.color,
  }));
  return { payload, materials: JSON.stringify(materials), slots };
}

const SLICER_TAG_RE = /[ \t]*<metadata\s+name="(?:Application|OrcaSlicer|BambuStudio:3mfVersion|bamboo_slicer:Version3mf|orca_published[a-z_]*)"[^>]*?(?:\/>|>[\s\S]*?<\/metadata>)[ \t]*\r?\n?/g;
const xmlEscape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

// Nagłówek 3D/3dmodel.model (wszystko przed <resources>). Reszta pliku zostaje bajt w bajt.
function headSplit(model) {
  const limit = 16 << 20;
  let at = -1;
  for (const probe of ['<resources>', '<resources ', '<resources\n', '<resources\r', '<resources\t']) {
    const i = indexOfAscii(model, probe, limit);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) throw new CodedError('noResources');
  return { head: td.decode(model.subarray(0, at)), at };
}
function rewriteHead(model, fn) {
  const { head, at } = headSplit(model);
  const next = fn(head);
  return next === head ? model : concat(te.encode(next), model.subarray(at));
}

// Metadane profilu MakerWorld/Bambu (autor profilu druku, jego ID i okładka). Profil i tak usuwamy.
const PROFILE_META_RE = /[ \t]*<metadata\s+name="(?:ProfileTitle|ProfileCover|ProfileDescription|ProfileUserId|ProfileUserName)"[^>]*?(?:\/>|>[\s\S]*?<\/metadata>)[ \t]*\r?\n?/g;
const countProfileMeta = (head) => (head.match(PROFILE_META_RE) || []).length;

// Autor i licencja ustawiane przez użytkownika (nazwy pól jak w OrcaSlicer: Designer, License, Copyright).
export const AUTHOR_FIELDS = ['Designer', 'License', 'Copyright'];
function setAuthorMeta(head, meta) {
  let h = head;
  for (const key of AUTHOR_FIELDS) {
    const v = (meta[key] || '').trim();
    if (!v) continue;
    const names = key === 'Copyright' ? 'Copyright|CopyRight' : key;
    h = h.replace(new RegExp('[ \\t]*<metadata\\s+name="(?:' + names + ')"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/metadata>)[ \\t]*\\r?\\n?', 'g'), '');
    h = h.replace(/[ \t]+$/, '');
    if (!h.endsWith('\n')) h += '\n';
    h += ` <metadata name="${key}">${xmlEscape(v)}</metadata>\n `;
  }
  return h;
}

function cleanHead(head, r, pd, meta) {
  let h = head;
  const n = countProfileMeta(h);
  if (n) { h = h.replace(PROFILE_META_RE, ''); r.privacy.profile += n; }
  if (pd) {
    h = h.replace(SLICER_TAG_RE, '').replace(/[ \t]+$/, '');
    if (!h.endsWith('\n')) h += '\n';
    const tag = (k, v) => ` <metadata name="${k}">${xmlEscape(v)}</metadata>\n`;
    h += tag('orca_published', '1') + tag('orca_published_keys', '[]') +
      tag('orca_published_material_keys', pd.materials) + tag('orca_published_config', pd.payload) + ' ';
  }
  if (meta && AUTHOR_FIELDS.some((k) => (meta[k] || '').trim())) { h = setAuthorMeta(h, meta); r.author = true; }
  return h;
}

// Pełna ścieżka importowanego pliku (opcja "pełne ścieżki" w slicerze) zdradza nazwę konta
// i układ folderów. Zostawiamy samą nazwę pliku.
const SOURCE_FILE_RE = /(<metadata\s+key="source_file"\s+value=")([^"]*)(")/g;
const isPathLike = (v) => /[\\/]/.test(v);
function shortenSources(text, r) {
  return text.replace(SOURCE_FILE_RE, (m, a, v, b) => {
    if (!isPathLike(v)) return m;
    r.privacy.paths++;
    return a + v.split(/[\\/]/).pop() + b;
  });
}

// ---------- analiza ----------
export function analyzeBytes(u8) {
  u8 = asU8(u8);
  const names = [];
  const entries = readZip(u8, (f) => { names.push(f.name); return /project_settings\.config$|model_settings\.config$/i.test(f.name) || /^\/?3D\/3dmodel\.model$/i.test(f.name); });
  const cfg = parseProjectSettings(entries[findEntry(entries, 'Metadata/project_settings.config')]);
  const msKey = findEntry(entries, 'Metadata/model_settings.config');
  const overrides = new Set();
  if (msKey) {
    const ms = td.decode(entries[msKey]);
    for (const block of ms.match(BLOCK_RE) || [])
      for (const m of block.matchAll(META_LINE_RE)) if (!STRUCTURAL_KEYS.has(m[1])) overrides.add(m[1]);
  }
  const privacy = { paths: 0, profile: 0 };
  const plates = { count: 0, modifiers: 0, negative: 0 };
  if (msKey) {
    const ms = td.decode(entries[msKey]);
    privacy.paths = [...ms.matchAll(SOURCE_FILE_RE)].filter((m) => isPathLike(m[2])).length;
    plates.count = (ms.match(/<plate>/g) || []).length;
    for (const m of ms.matchAll(/<part\s+id="\d+"\s+subtype="([^"]*)"/g)) {
      if (m[1] === 'negative_part') plates.negative++; else if (m[1] !== 'normal_part') plates.modifiers++;
    }
  }
  const modelKey = findEntry(entries, '3D/3dmodel.model');
  let headMeta = {};
  if (modelKey) {
    try {
      const { head } = headSplit(entries[modelKey]);
      privacy.profile = countProfileMeta(head);
      for (const m of head.matchAll(/<metadata\s+name="([^"]+)"[^>]*>([^<]*)<\/metadata>/g)) headMeta[m[1]] = m[2].replace(/&(quot|apos|lt|gt|amp);/g, (_, e) => ({ quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' }[e]));
    } catch { /* bez <resources> - błąd zgłosi czyszczenie */ }
  }
  const removeGroups = {};
  for (const n of names) if (DROP_RE.test(norm(n))) (removeGroups[labelFor(n)] ||= []).push(norm(n));
  const hasGcode = !!(removeGroups.gcode?.length || removeGroups.customGcode?.length || names.some((n) => /Prusa_Slicer_custom_gcode/i.test(n)));
  return {
    size: u8.length,
    hasModel: names.some((n) => norm(n).toLowerCase() === '3d/3dmodel.model'),
    hasGcode,
    printer: cfg ? scalar(cfg.printer_settings_id) : '',
    process: cfg ? scalar(cfg.print_settings_id) : '',
    filaments: filamentSlots(cfg),
    remove: Object.entries(removeGroups).map(([label, files]) => ({ label, files })),
    overrides: [...overrides].sort(),
    privacy, plates: plates.count || 1, modifiers: plates.modifiers, negative: plates.negative,
    author: { Designer: headMeta.Designer || '', License: headMeta.License || headMeta.LicenseTerms || '', Copyright: headMeta.Copyright || headMeta.CopyRight || '' },
    thumbnail: readThumbnail(u8),
  };
}

// ---------- czyszczenie ----------
// Zwraca { zipped: Uint8Array, r } - zapis na dysk robi warstwa platformy.
export function cleanBytes(u8, opts = {}) {
  u8 = asU8(u8);
  const r = { removed: [], overrides: {}, warnings: [], slots: [], sizeBefore: u8.length, sizeAfter: 0, privacy: { paths: 0, profile: 0 } };
  const all = [];
  const entries = readZip(u8, (f) => {
    const n = norm(f.name);
    all.push(f.name);
    if (DROP_RE.test(n)) {
      r.removed.push(n);
      return !!opts.filaments && /^Metadata\/project_settings\.config$/i.test(n);
    }
    return true;
  });
  if (!all.some((n) => norm(n).toLowerCase() === '3d/3dmodel.model')) throw new CodedError('noModel');

  const dropped = new Set(r.removed.map((n) => n.toLowerCase()));
  let pd = null;
  if (opts.filaments) {
    const psKey = findEntry(entries, 'Metadata/project_settings.config');
    if (psKey) {
      const ps = parseProjectSettings(entries[psKey]);
      delete entries[psKey];
      try {
        if (!ps) throw new CodedError('badProjectJson');
        pd = buildPublish(ps);
        r.slots = pd.slots;
      } catch (e) {
        r.warnings.push({ code: e.code || 'noFilaments', params: {} });
      }
    } else {
      r.warnings.push({ code: 'noFilaments', params: {} });
    }
  }

  const outFiles = {};
  for (const name of Object.keys(entries)) {
    const lname = norm(name).toLowerCase();
    let data = entries[name];
    if (lname === '3d/3dmodel.model') {
      data = rewriteHead(data, (h) => cleanHead(h, r, pd, opts.metadata));
    } else if (lname.endsWith('.rels')) {
      data = te.encode(td.decode(data).replace(REL_RE, (m, t) => dropped.has(norm(t).toLowerCase()) ? '' : m));
    } else if (lname === '[content_types].xml') {
      data = te.encode(td.decode(data).replace(OVERRIDE_RE, (m, t) => dropped.has(norm(t).toLowerCase()) ? '' : m));
    } else if (lname === 'metadata/model_settings.config') {
      let s = shortenSources(td.decode(data).replace(GCODE_FILE_RE, '$1$2'), r);
      if (!opts.keepObjectSettings) {
        s = s.replace(BLOCK_RE, (block) => block.replace(META_LINE_RE, (line, key) => {
          if (STRUCTURAL_KEYS.has(key)) return line;
          r.overrides[key] = (r.overrides[key] || 0) + 1;
          return '';
        }));
      }
      data = te.encode(s);
    }
    outFiles[name] = [asU8(data), { level: /\.(png|jpe?g)$/i.test(lname) ? 0 : 6 }];
  }

  const th = opts.thumbnail;
  if (th && th.middle && th.small) {
    const own = new Set(Object.values(THUMB_FILES).map((f) => f.toLowerCase()));
    for (const k of Object.keys(outFiles)) if (own.has(norm(k).toLowerCase())) delete outFiles[k];
    const relKey = Object.keys(outFiles).find((k) => norm(k).toLowerCase() === '_rels/.rels') || '_rels/.rels';
    outFiles[relKey] = [te.encode(setThumbnailRels(outFiles[relKey] ? td.decode(outFiles[relKey][0]) : '')), { level: 6 }];
    const ctKey = Object.keys(outFiles).find((k) => norm(k).toLowerCase() === '[content_types].xml');
    if (ctKey) outFiles[ctKey] = [te.encode(ensurePngType(td.decode(outFiles[ctKey][0]))), { level: 6 }];
    outFiles[THUMB_FILES.cover] = [asU8(th.middle), { level: 0 }];
    outFiles[THUMB_FILES.middle] = [asU8(th.middle), { level: 0 }];
    outFiles[THUMB_FILES.small] = [asU8(th.small), { level: 0 }];
    r.thumbnail = true;
  }

  const zipped = zipSync(outFiles);
  verify(zipped, outFiles, !!pd, r);
  r.sizeAfter = zipped.length;
  return { zipped, r };
}

function verify(zipped, written, published, r) {
  const back = unzipSync(zipped);
  for (const [name, [data]] of Object.entries(written)) {
    const got = back[name];
    if (!got || got.length !== data.length || crc32(got) !== crc32(data)) throw new CodedError('verifyFailed', { name });
    const lname = norm(name).toLowerCase();
    if (/\.(config|json|xml|rels)$/.test(lname)) {
      const s = td.decode(got);
      const m = LEAK_MARKERS.find((k) => s.includes(k));
      if (m) r.warnings.push({ code: 'leak', params: { name, marker: m.replace('"', '') } });
    }
    if (published && lname === '3d/3dmodel.model') {
      const head = td.decode(got.subarray(0, Math.min(got.length, 4 << 20)));
      if (!head.includes('<metadata name="orca_published">1</metadata>')) throw new CodedError('verifyFailed', { name: 'orca_published' });
      if (head.includes('<metadata name="Application"')) throw new CodedError('verifyFailed', { name: 'Application' });
    }
  }
}
