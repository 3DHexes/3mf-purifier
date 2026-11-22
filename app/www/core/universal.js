// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
// Tryb "Universal 3MF": zwykły 3MF według specyfikacji Core, bez Production Extension,
// dla PrusaSlicera, Cury i innych slicerów, które nie czytają projektów Orki i Bambu Studio.
//
// - części obiektu (normal_part) łączymy w jedną siatkę na obiekt, transformacje komponentów
//   są wliczone w wierzchołki; modyfikatory, części ujemne i blokery podpór są pomijane,
// - malowanie kolorem (paint_color) zapisujemy jako slic3rpe:mmu_segmentation, czyli tak,
//   jak czyta je PrusaSlicer; Cura i inne programy ten atrybut ignorują,
// - Metadata/Slic3r_PE_model.config opisuje części i extrudery dla PrusaSlicera,
// - projekt z kilkoma płytami można zapisać jako osobny plik dla każdej płyty.

import { zipSync } from '../vendor/fflate.js';
import { CodedError, readZip, findEntry, parseProjectSettings } from './purify.js';

const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');
const te = new TextEncoder();
const norm = (n) => n.replace(/^\/+/, '');
const xmlEscape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const xmlUnescape = (s) => String(s).replace(/&(quot|apos|lt|gt|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) => {
  const k = e.toLowerCase();
  if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  return { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' }[k];
});

class Grow {
  constructor(Type, n = 1 << 12) { this.Type = Type; this.a = new Type(n); this.n = 0; }
  push(v) { if (this.n === this.a.length) { const b = new this.Type(this.a.length * 2); b.set(this.a); this.a = b; } this.a[this.n++] = v; }
}

function attr(s, name) {
  for (const sep of [' ', '\n', '\t', '\r']) {
    for (const q of ['"', "'"]) {
      const k = sep + name + '=' + q;
      const i = s.indexOf(k);
      if (i >= 0) {
        const j = s.indexOf(q, i + k.length);
        return j >= 0 ? s.slice(i + k.length, j) : null;
      }
    }
  }
  return null;
}

// ---------- macierze 3MF (wektor wierszowy: p' = p * M, 12 liczb) ----------
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
function parseMatrix(s) {
  if (!s) return IDENTITY;
  const v = s.trim().split(/\s+/).map(Number);
  return v.length === 12 && v.every(Number.isFinite) ? v : IDENTITY;
}
function compose(a, b) {
  const r = new Array(12);
  for (let row = 0; row < 4; row++)
    for (let c = 0; c < 3; c++) {
      const x = a[row * 3], y = a[row * 3 + 1], z = a[row * 3 + 2];
      r[row * 3 + c] = x * b[c] + y * b[3 + c] + z * b[6 + c] + (row === 3 ? b[9 + c] : 0);
    }
  return r;
}
const isIdentity = (m) => m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-12);
const num = (x) => {
  if (Object.is(x, -0) || Math.abs(x) < 5e-10) return '0';
  return String(Math.round(x * 1e6) / 1e6);
};
const fmtMatrix = (m) => m.map(num).join(' ');
// Macierz dla Slic3r_PE_model.config: 4x4 wierszami, przesunięcie w czwartej kolumnie.
const prusaMatrix = (m) => [m[0], m[3], m[6], m[9], m[1], m[4], m[7], m[10], m[2], m[5], m[8], m[11], 0, 0, 0, 1].map(num).join(' ');

// ---------- malowanie (format TriangleSelector z PrusaSlicera / Orki) ----------
// Ciąg szesnastkowy czytany od końca; każdy węzeł to półbajt: 2 bity liczby podziałów
// i 2 bity stanu (albo boku specjalnego przy podziale). Stan >= 3 zajmuje dodatkowe półbajty.
function decodeTree(hex) {
  if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const nib = [];
  for (let i = hex.length - 1; i >= 0; i--) nib.push(parseInt(hex[i], 16));
  let p = 0;
  const next = () => (p < nib.length ? nib[p++] : -1);
  const nodes = []; // { split: code } albo { state }
  const walk = () => {
    const code = next();
    if (code < 0) return false;
    const sides = code & 3;
    if (sides) {
      nodes.push({ split: code });
      for (let i = 0; i <= sides; i++) if (!walk()) return false;
      return true;
    }
    let s = code >> 2;
    if ((code & 12) === 12) {
      const q = next();
      if (q < 0) return false;
      if (q === 15) {
        const r = next();
        if (r < 0) return false;
        s = r + 18;
      } else {
        s = q + 3;
      }
    }
    nodes.push({ state: s });
    return true;
  };
  return walk() && p === nib.length ? nodes : null;
}
function encodeTree(nodes) {
  const nib = [];
  for (const n of nodes) {
    if (n.split !== undefined) { nib.push(n.split & 15); continue; }
    const s = Math.min(33, Math.max(0, n.state | 0));
    if (s < 3) nib.push(s << 2);
    else if (s < 18) nib.push(12, s - 3);
    else nib.push(12, 15, s - 18);
  }
  let out = '';
  for (let i = nib.length - 1; i >= 0; i--) out += '0123456789ABCDEF'[nib[i]];
  return out;
}
// Unpainted (stan 0) w części z własnym extruderem: po połączeniu części w jeden obiekt
// stan 0 oznaczałby extruder obiektu, więc wpisujemy extruder części wprost.
const fullState = (s) => encodeTree([{ state: s }]);
function bakePartExtruder(hex, ext) {
  if (!hex) return fullState(ext);
  const nodes = decodeTree(hex);
  if (!nodes) return hex;
  let changed = false;
  for (const n of nodes) if (n.state === 0) { n.state = ext; changed = true; }
  return changed ? encodeTree(nodes) : hex;
}

// ---------- odczyt plików .model ----------
const PAINT_ATTRS = [
  ['paint_color', 'mmu'], ['slic3rpe:mmu_segmentation', 'mmu'],
  ['paint_supports', 'sup'], ['slic3rpe:custom_supports', 'sup'],
  ['paint_seam', 'seam'], ['slic3rpe:custom_seam', 'seam'],
];
function parseModel(u8, objects, fileKey, wantMeta) {
  const items = [];
  const meta = {};
  let cur = null;
  const CHUNK = 32 << 20;
  let pos = 0, inResources = false, metaName = null, metaBuf = '';
  // Metadane w nagłówku są w UTF-8; resztę czytamy jako latin1 (szybciej, liczby i tak są ASCII).
  while (pos < u8.length) {
    let end = Math.min(u8.length, pos + CHUNK);
    if (end < u8.length) { const gt = u8.lastIndexOf(62, end - 1); if (gt > pos) end = gt + 1; }
    const s = (inResources ? latin1 : utf8).decode(u8.subarray(pos, end));
    pos = end;
    const re = /<(\/?)([A-Za-z_:]+)([^>]*)>/g;
    let m, last = 0;
    while ((m = re.exec(s))) {
      if (metaName !== null) metaBuf += s.slice(last, m.index);
      last = re.lastIndex;
      const tag = m[2], a = m[3];
      const t = tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag;
      if (t === 'vertex' && cur) {
        cur.v.push(+attr(a, 'x')); cur.v.push(+attr(a, 'y')); cur.v.push(+attr(a, 'z'));
      } else if (t === 'triangle' && cur) {
        cur.t.push(+attr(a, 'v1')); cur.t.push(+attr(a, 'v2')); cur.t.push(+attr(a, 'v3'));
        const idx = cur.t.n / 3 - 1;
        for (const [name, kind] of PAINT_ATTRS) {
          if (!a.includes(name)) continue;
          const v = attr(a, name);
          if (v) cur.paint[kind].set(idx, v);
        }
      } else if (t === 'object') {
        if (m[1]) { cur = null; continue; }
        const id = attr(a, 'id');
        cur = { key: fileKey + '#' + id, id, name: xmlUnescape(attr(a, 'name') || ''), type: attr(a, 'type') || 'model',
          v: new Grow(Float64Array), t: new Grow(Uint32Array), paint: { mmu: new Map(), sup: new Map(), seam: new Map() }, comps: [] };
        objects.set(cur.key, cur);
        if (a.trimEnd().endsWith('/')) cur = null;
      } else if (t === 'component' && cur) {
        const path = attr(a, 'p:path');
        cur.comps.push({ key: (path ? norm(path) : fileKey) + '#' + attr(a, 'objectid'), objectid: attr(a, 'objectid'), m: parseMatrix(attr(a, 'transform')) });
      } else if (t === 'item' && !m[1]) {
        const path = attr(a, 'p:path');
        items.push({ key: (path ? norm(path) : fileKey) + '#' + attr(a, 'objectid'), objectid: attr(a, 'objectid'), m: parseMatrix(attr(a, 'transform')) });
      } else if (t === 'resources') {
        inResources = !m[1];
      } else if (t === 'metadata' && wantMeta && !inResources && !cur) {
        if (m[1]) { meta[metaName] = xmlUnescape(metaBuf.trim()); metaName = null; }
        else if (!a.trimEnd().endsWith('/')) { metaName = attr(a, 'name') || ''; metaBuf = ''; }
      }
    }
    if (metaName !== null) metaBuf += s.slice(last);
  }
  return { items, meta };
}

// ---------- model_settings.config: obiekty, części i płyty ----------
function parseSettings(text) {
  const objs = new Map(), plates = [];
  if (!text) return { objs, plates };
  const val = (body, key) => { const m = new RegExp('key="' + key + '"\\s+value="([^"]*)"').exec(body); return m ? xmlUnescape(m[1]) : null; };
  for (const om of text.matchAll(/<object\s+id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g)) {
    const body = om[2];
    const ps = body.search(/<part\b/);
    const head = ps >= 0 ? body.slice(0, ps) : body;
    const o = { extruder: +(val(head, 'extruder') || 0) || 1, name: val(head, 'name') || '', parts: new Map() };
    for (const pm of body.matchAll(/<part\s+id="(\d+)"(?:\s+subtype="([^"]*)")?[^>]*>([\s\S]*?)<\/part>/g))
      o.parts.set(pm[1], { subtype: pm[2] || 'normal_part', extruder: +(val(pm[3], 'extruder') || 0), name: val(pm[3], 'name') || '' });
    objs.set(om[1], o);
  }
  for (const pm of text.matchAll(/<plate>([\s\S]*?)<\/plate>/g)) {
    const body = pm[1];
    const id = +(val(body.replace(/<model_instance>[\s\S]*?<\/model_instance>/g, ''), 'plater_id') || plates.length + 1);
    const name = val(body.replace(/<model_instance>[\s\S]*?<\/model_instance>/g, ''), 'plater_name') || '';
    const inst = [...body.matchAll(/<model_instance>([\s\S]*?)<\/model_instance>/g)].map((im) => ({ object: val(im[1], 'object_id'), instance: +(val(im[1], 'instance_id') || 0) }));
    plates.push({ id, name, inst });
  }
  plates.sort((a, b) => a.id - b.id);
  return { objs, plates };
}

// Rozmiar stołu z printable_area ("0x0", "256x0", ...).
function bedOf(cfg) {
  const area = cfg && cfg.printable_area;
  const pts = (Array.isArray(area) ? area : typeof area === 'string' ? area.split(',') : [])
    .map((p) => String(p).split('x').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const b = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  return b.x1 - b.x0 > 1 && b.y1 - b.y0 > 1 ? b : null;
}
// Bambu Studio / Orca układają płyty w siatce: kolumny = zaokrąglony w górę pierwiastek liczby płyt,
// odstęp między płytami to 1/5 wymiaru stołu.
function plateOffset(index, count, bed) {
  const v = Math.sqrt(count), r = Math.round(v);
  const cols = v > r ? r + 1 : r;
  const row = Math.floor(index / cols), col = index % cols;
  const w = bed.x1 - bed.x0, d = bed.y1 - bed.y0;
  return [col * w * 1.2, -row * d * 1.2];
}

// ---------- analiza (do panelu szczegółów) ----------
export function universalInfo(text) {
  const { objs, plates } = parseSettings(text);
  let modifiers = 0, negative = 0;
  for (const o of objs.values()) for (const p of o.parts.values()) {
    if (p.subtype === 'negative_part') negative++;
    else if (p.subtype !== 'normal_part') modifiers++;
  }
  return { plates: plates.length, modifiers, negative };
}

// ---------- budowa wyniku ----------
const META_MAP = [ // nazwa w źródle -> nazwa w 3MF Core
  ['Title', 'Title'], ['Designer', 'Designer'], ['Description', 'Description'],
  ['Copyright', 'Copyright'], ['CopyRight', 'Copyright'],
  ['LicenseTerms', 'LicenseTerms'], ['License', 'LicenseTerms'],
  ['CreationDate', 'CreationDate'], ['ModificationDate', 'ModificationDate'],
];

export function universalBytes(u8, opts = {}) {
  const entries = readZip(u8, (f) => /\.model$/i.test(f.name) || /(model_settings|project_settings)\.config$/i.test(f.name) ||
    /\.rels$/i.test(f.name) || (/\.png$/i.test(f.name) && f.originalSize < (16 << 20)));
  const rootKey = findEntry(entries, '3D/3dmodel.model');
  if (!rootKey) throw new CodedError('noModel');
  const objects = new Map();
  for (const k of Object.keys(entries)) if (/\.model$/i.test(k) && k !== rootKey) parseModel(entries[k], objects, norm(k), false);
  const { items, meta } = parseModel(entries[rootKey], objects, norm(rootKey), true);
  const msKey = findEntry(entries, 'Metadata/model_settings.config');
  const { objs: settings, plates } = parseSettings(msKey ? utf8.decode(entries[msKey]) : '');
  const cfg = parseProjectSettings(entries[findEntry(entries, 'Metadata/project_settings.config')]);
  const r = { warnings: [], plates: plates.length || 1, files: [], dropped: { modifiers: 0, negative: 0 }, painted: false, badPaint: 0 };

  // Jeden obiekt wynikowy na obiekt źródłowy z <build>, z częściami jako osobnymi zakresami trójkątów.
  const built = new Map();
  const buildObject = (item) => {
    if (built.has(item.key)) return built.get(item.key);
    const root = objects.get(item.key);
    const os = settings.get(item.objectid);
    const objExt = os ? os.extruder : 1;
    const out = { name: (os && os.name) || (root && root.name) || 'Object ' + item.objectid, extruder: objExt,
      v: new Grow(Float64Array), t: new Grow(Uint32Array), paint: { mmu: [], sup: [], seam: [] }, volumes: [] };
    if (!root) { built.set(item.key, null); return null; }
    const addMesh = (o, m, ext, volName, partMatrix) => {
      const vo = out.v.n / 3, to = out.t.n / 3;
      const v = o.v.a, nv = o.v.n / 3, ident = isIdentity(m);
      for (let i = 0; i < nv; i++) {
        const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
        if (ident) { out.v.push(x); out.v.push(y); out.v.push(z); continue; }
        out.v.push(x * m[0] + y * m[3] + z * m[6] + m[9]);
        out.v.push(x * m[1] + y * m[4] + z * m[7] + m[10]);
        out.v.push(x * m[2] + y * m[5] + z * m[8] + m[11]);
      }
      const t = o.t.a, nt = o.t.n / 3;
      for (let i = 0; i < nt * 3; i++) out.t.push(t[i] + vo);
      const bake = ext && ext !== objExt;
      // Orca i PrusaSlicer czytają tylko wielkie litery A-F; ciąg nieczytelny pomijamy i liczymy do ostrzeżenia.
      for (const [i, raw] of o.paint.mmu) {
        const s = raw.toUpperCase();
        if (!decodeTree(s)) { r.badPaint++; continue; }
        out.paint.mmu[to + i] = bake ? bakePartExtruder(s, ext) : s;
        r.painted = true;
      }
      if (bake) for (let i = 0; i < nt; i++) if (!out.paint.mmu[to + i]) out.paint.mmu[to + i] = fullState(ext);
      for (const k of ['sup', 'seam']) for (const [i, raw] of o.paint[k]) { const s = raw.toUpperCase(); if (decodeTree(s)) out.paint[k][to + i] = s; }
      if (nt) out.volumes.push({ first: to, last: to + nt - 1, name: volName || o.name || out.name, extruder: ext && ext !== objExt ? ext : 0, matrix: partMatrix });
    };
    const visit = (key, m, depth, ext, volName, partMatrix) => {
      const o = objects.get(key);
      if (!o || depth > 16) return;
      if (o.t.n) addMesh(o, m, ext, volName, partMatrix);
      for (const c of o.comps) {
        let e = ext, nm = volName, pm = partMatrix;
        if (depth === 0) {
          const ps = os && os.parts.get(c.objectid);
          if (ps && ps.subtype !== 'normal_part') {
            if (ps.subtype === 'negative_part') r.dropped.negative++; else r.dropped.modifiers++;
            continue;
          }
          if (ps && ps.extruder) e = ps.extruder;
          if (ps && ps.name) nm = ps.name;
          pm = compose(c.m, m);
        }
        visit(c.key, compose(c.m, m), depth + 1, e, nm, pm);
      }
    };
    visit(item.key, IDENTITY, 0, objExt, '', IDENTITY);
    const res = out.t.n ? out : null;
    built.set(item.key, res);
    return res;
  };

  // Płyty: przypisanie instancji (kolejne <item> tego samego obiektu to kolejne instancje).
  const seen = new Map();
  const inst = items.map((it) => { const k = seen.get(it.objectid) || 0; seen.set(it.objectid, k + 1); return { ...it, instance: k }; });
  const plateOf = new Map();
  plates.forEach((p, pi) => p.inst.forEach((x) => plateOf.set(x.object + ':' + x.instance, pi)));
  const groups = (plates.length ? plates : [{ id: 1, name: '' }]).map((p) => ({ plate: p, items: [] }));
  for (const it of inst) {
    const pi = plateOf.get(it.objectid + ':' + it.instance) ?? plateOf.get(it.objectid + ':0') ?? 0;
    groups[Math.min(pi, groups.length - 1)].items.push(it);
  }
  const used = groups.filter((g) => g.items.some((it) => buildObject(it)));
  if (!used.length) throw new CodedError('uniEmpty');

  const bed = bedOf(cfg);
  const split = !!opts.splitPlates && used.length > 1;
  const sets = split ? used.map((g) => ({ plate: g.plate, groups: [g] })) : [{ plate: null, groups: used }];
  const plateCount = Math.max(plates.length, 1);

  // Miniatura: własna, okładka z pliku albo podgląd płyty.
  const pngOf = (name) => { const k = findEntry(entries, name); return k ? entries[k] : null; };
  let cover = null;
  const relsKey = findEntry(entries, '_rels/.rels');
  if (relsKey) {
    const m = /Target="\/?([^"]+)"[^>]*Type="[^"]*\/metadata\/thumbnail"/.exec(utf8.decode(entries[relsKey])) ||
      /Type="[^"]*\/metadata\/thumbnail"[^>]*Target="\/?([^"]+)"/.exec(utf8.decode(entries[relsKey]));
    if (m && /\.png$/i.test(m[1])) cover = pngOf(m[1]);
  }

  const srcMeta = {};
  for (const [from, to] of META_MAP) if (meta[from] && !srcMeta[to]) srcMeta[to] = meta[from];
  for (const [k, v] of Object.entries(opts.metadata || {})) if (v) srcMeta[k] = v;

  for (const set of sets) {
    const objList = [];
    const ids = new Map();
    const buildItems = [];
    for (const g of set.groups) {
      // Osobny plik dla płyty 2, 3...: przesuwamy ją na miejsce płyty 1, żeby model leżał na stole.
      // We wspólnym pliku zostawiamy układ z projektu (slicer pozwoli go rozłożyć).
      let dx = 0, dy = 0;
      const pi = plates.indexOf(g.plate);
      if (split && pi > 0 && bed) [dx, dy] = plateOffset(pi, plateCount, bed).map((v) => -v);
      for (const it of g.items) {
        const o = buildObject(it);
        if (!o) continue;
        if (!ids.has(o)) { ids.set(o, objList.length + 1); objList.push(o); }
        const m = it.m.slice();
        m[9] += dx; m[10] += dy;
        buildItems.push({ id: ids.get(o), m });
      }
    }
    const files = {};
    files['[Content_Types].xml'] = te.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
      ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
      ' <Default Extension="png" ContentType="image/png"/>\n' +
      ' <Default Extension="config" ContentType="text/xml"/>\n</Types>\n');
    const thumb = opts.thumbnail && opts.thumbnail.middle ? opts.thumbnail.middle
      : (set.plate ? pngOf(`Metadata/plate_${set.plate.id}.png`) : null) || cover || pngOf('Metadata/plate_1.png');
    files['_rels/.rels'] = te.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      ' <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n' +
      (thumb ? ' <Relationship Target="/Metadata/thumbnail.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>\n' : '') +
      '</Relationships>\n');
    if (thumb) files['Metadata/thumbnail.png'] = [thumb, { level: 0 }];

    const anyMmu = objList.some((o) => o.paint.mmu.length);
    const head = ['<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">\n',
      ' <metadata name="slic3rpe:Version3mf">1</metadata>\n'];
    if (anyMmu) head.push(' <metadata name="slic3rpe:MmPaintingVersion">1</metadata>\n');
    for (const [k, v] of Object.entries(srcMeta)) head.push(` <metadata name="${k}">${xmlEscape(v)}</metadata>\n`);
    head.push(' <metadata name="Application">3MF Purifier</metadata>\n <resources>\n');
    files['3D/3dmodel.model'] = modelXml(head.join(''), objList, buildItems);

    files['Metadata/Slic3r_PE_model.config'] = te.encode(prusaConfig(objList, buildItems));
    const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Array.isArray(v) ? v : [v, { level: 6 }]])));
    r.files.push({ plate: set.plate ? set.plate.id : 0, zipped, objects: objList.length, items: buildItems.length });
  }
  if (r.dropped.negative) r.warnings.push({ code: 'uniNegative', params: { n: r.dropped.negative } });
  if (r.dropped.modifiers) r.warnings.push({ code: 'uniModifiers', params: { n: r.dropped.modifiers } });
  if (r.badPaint) r.warnings.push({ code: 'uniBadPaint', params: { n: r.badPaint } });
  return r;
}

// Zapis XML kawałkami, żeby duże siatki nie tworzyły jednego ogromnego stringa.
function modelXml(head, objList, buildItems) {
  const parts = [te.encode(head)];
  let buf = '';
  const flush = () => { if (buf) { parts.push(te.encode(buf)); buf = ''; } };
  objList.forEach((o, oi) => {
    buf += `  <object id="${oi + 1}" name="${xmlEscape(o.name)}" type="model">\n   <mesh>\n    <vertices>\n`;
    const v = o.v.a, nv = o.v.n / 3;
    for (let i = 0; i < nv; i++) {
      buf += `     <vertex x="${num(v[i * 3])}" y="${num(v[i * 3 + 1])}" z="${num(v[i * 3 + 2])}"/>\n`;
      if (buf.length > (1 << 20)) flush();
    }
    buf += '    </vertices>\n    <triangles>\n';
    const t = o.t.a, nt = o.t.n / 3, pm = o.paint.mmu, ps = o.paint.sup, pz = o.paint.seam;
    for (let i = 0; i < nt; i++) {
      buf += `     <triangle v1="${t[i * 3]}" v2="${t[i * 3 + 1]}" v3="${t[i * 3 + 2]}"`;
      if (ps[i]) buf += ` slic3rpe:custom_supports="${ps[i]}"`;
      if (pz[i]) buf += ` slic3rpe:custom_seam="${pz[i]}"`;
      if (pm[i]) buf += ` slic3rpe:mmu_segmentation="${pm[i]}"`;
      buf += '/>\n';
      if (buf.length > (1 << 20)) flush();
    }
    buf += '    </triangles>\n   </mesh>\n  </object>\n';
  });
  buf += ' </resources>\n <build>\n';
  for (const it of buildItems) buf += `  <item objectid="${it.id}" transform="${fmtMatrix(it.m)}"/>\n`;
  buf += ' </build>\n</model>\n';
  flush();
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function prusaConfig(objList, buildItems) {
  let s = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n';
  objList.forEach((o, oi) => {
    const count = buildItems.filter((it) => it.id === oi + 1).length;
    s += ` <object id="${oi + 1}" instances_count="${count}">\n`;
    s += `  <metadata type="object" key="name" value="${xmlEscape(o.name)}"/>\n`;
    s += `  <metadata type="object" key="extruder" value="${o.extruder}"/>\n`;
    for (const vol of o.volumes) {
      s += `  <volume firstid="${vol.first}" lastid="${vol.last}">\n`;
      s += `   <metadata type="volume" key="name" value="${xmlEscape(vol.name)}"/>\n`;
      s += '   <metadata type="volume" key="volume_type" value="ModelPart"/>\n';
      s += `   <metadata type="volume" key="matrix" value="${prusaMatrix(vol.matrix)}"/>\n`;
      if (vol.extruder) s += `   <metadata type="volume" key="extruder" value="${vol.extruder}"/>\n`;
      s += '   <mesh edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n';
      s += '  </volume>\n';
    }
    s += ' </object>\n';
  });
  return s + '</config>\n';
}

export { decodeTree, encodeTree, bakePartExtruder, plateOffset };
