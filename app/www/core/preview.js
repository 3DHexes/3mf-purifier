// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
// Szybki odczyt geometrii 3MF do podglądu: siatki, komponenty (Production Extension),
// pozycje z <build>, przypisanie extruderów z model_settings.config oraz malowanie kolorem
// (paint_color / slic3rpe:mmu_segmentation, dekodowane jak TriangleSelector w OrcaSlicerze).

import { CodedError, readZip, findEntry, parseProjectSettings, filamentSlots } from './purify.js';
const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');

class Grow {
  constructor(Type, n = 1 << 12) { this.Type = Type; this.a = new Type(n); this.n = 0; }
  push(v) { if (this.n === this.a.length) this.grow(); this.a[this.n++] = v; }
  grow() { const b = new this.Type(this.a.length * 2); b.set(this.a); this.a = b; }
  done() { return this.a.subarray(0, this.n); }
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

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
function parseMatrix(s) {
  if (!s) return IDENTITY;
  const v = s.trim().split(/\s+/).map(Number);
  return v.length === 12 && v.every(Number.isFinite) ? v : IDENTITY;
}
// 3MF: wektor wierszowy, p' = p * M. compose(a, b) = najpierw a, potem b.
function compose(a, b) {
  const r = new Array(12);
  for (let row = 0; row < 4; row++)
    for (let c = 0; c < 3; c++) {
      const x = a[row * 3], y = a[row * 3 + 1], z = a[row * 3 + 2];
      r[row * 3 + c] = x * b[c] + y * b[3 + c] + z * b[6 + c] + (row === 3 ? b[9 + c] : 0);
    }
  return r;
}

// ---- malowanie kolorem ----
const paintCache = new Map();
function paintState(hex) {
  if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) return 0;
  let st = paintCache.get(hex);
  if (st !== undefined) return st;
  const nib = [];
  for (let i = hex.length - 1; i >= 0; i--) nib.push(parseInt(hex[i], 16));
  let p = 0;
  const area = new Map();
  const next = () => (p < nib.length ? nib[p++] : -1);
  const walk = (w) => {
    const code = next();
    if (code < 0) return false;
    const sides = code & 3;
    if (sides) {
      const n = sides + 1;
      for (let i = 0; i < n; i++) if (!walk(w / n)) return false;
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
    area.set(s, (area.get(s) || 0) + w);
    return true;
  };
  if (!walk(1)) return 0;
  st = 0; let best = -1;
  for (const [s, w] of area) if (w > best) { best = w; st = s; }
  if (paintCache.size < 50000) paintCache.set(hex, st);
  return st;
}

// ---- parser plików .model ----
function parseModel(u8, objects, fileKey) {
  const buf = u8;
  const items = [];
  let cur = null, base = 0;
  const CHUNK = 32 << 20;
  let pos = 0;
  while (pos < buf.length) {
    let end = Math.min(buf.length, pos + CHUNK);
    if (end < buf.length) { const gt = buf.lastIndexOf(62, end - 1); if (gt > pos) end = gt + 1; }
    const s = latin1.decode(buf.subarray(pos, end));
    pos = end;
    const re = /<(\/?)([A-Za-z_:]+)([^>]*)>/g;
    let m;
    while ((m = re.exec(s))) {
      const tag = m[2], a = m[3];
      const t = tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag;
      if (t === 'vertex' && cur) {
        cur.v.push(+attr(a, 'x')); cur.v.push(+attr(a, 'y')); cur.v.push(+attr(a, 'z'));
      } else if (t === 'triangle' && cur) {
        cur.t.push(+attr(a, 'v1')); cur.t.push(+attr(a, 'v2')); cur.t.push(+attr(a, 'v3'));
        const pc = attr(a, 'paint_color') || attr(a, 'slic3rpe:mmu_segmentation');
        const st = pc ? paintState(pc) : 0;
        if (st) cur.painted = true;
        cur.p.push(st);
      } else if (t === 'object') {
        if (m[1]) { cur = null; continue; }
        const id = attr(a, 'id');
        cur = { key: fileKey + '#' + id, id, name: attr(a, 'name') || '', type: attr(a, 'type') || 'model',
          v: new Grow(Float32Array), t: new Grow(Uint32Array), p: new Grow(Uint8Array), comps: [], painted: false };
        objects.set(cur.key, cur);
        if (m[3].trimEnd().endsWith('/')) cur = null;
      } else if (t === 'component' && cur) {
        const path = attr(a, 'p:path');
        cur.comps.push({ key: (path ? path.replace(/^\/+/, '') : fileKey) + '#' + attr(a, 'objectid'), objectid: attr(a, 'objectid'), m: parseMatrix(attr(a, 'transform')) });
      } else if (t === 'item' && !m[1]) {
        const path = attr(a, 'p:path');
        items.push({ key: (path ? path.replace(/^\/+/, '') : fileKey) + '#' + attr(a, 'objectid'), objectid: attr(a, 'objectid'), m: parseMatrix(attr(a, 'transform')), printable: attr(a, 'printable') !== '0' });
      }
    }
  }
  return items;
}

// model_settings.config: extruder obiektu, extruder i typ części
function parseModelSettings(text) {
  const objs = new Map();
  if (!text) return objs;
  for (const om of text.matchAll(/<object\s+id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g)) {
    const body = om[2];
    const partsStart = body.search(/<part\b/);
    const head = partsStart >= 0 ? body.slice(0, partsStart) : body;
    const ex = /key="extruder"\s+value="(\d+)"/.exec(head);
    const nm = /key="name"\s+value="([^"]*)"/.exec(head);
    const o = { extruder: ex ? +ex[1] : 1, name: nm ? nm[1] : '', parts: new Map() };
    for (const pm of body.matchAll(/<part\s+id="(\d+)"(?:\s+subtype="([^"]*)")?[^>]*>([\s\S]*?)<\/part>/g)) {
      const pe = /key="extruder"\s+value="(\d+)"/.exec(pm[3]);
      o.parts.set(pm[1], { subtype: pm[2] || 'normal_part', extruder: pe ? +pe[1] : 0 });
    }
    objs.set(om[1], o);
  }
  return objs;
}

export function buildPreviewBytes(buf) {
  const entries = readZip(buf, (f) => /\.model$/i.test(f.name) || /model_settings\.config$|project_settings\.config$/i.test(f.name));
  const rootKey = findEntry(entries, '3D/3dmodel.model');
  if (!rootKey) throw new CodedError('noModel');
  const objects = new Map();
  for (const k of Object.keys(entries)) if (/\.model$/i.test(k) && k !== rootKey) parseModel(entries[k], objects, k.replace(/^\/+/, ''));
  const items = parseModel(entries[rootKey], objects, rootKey.replace(/^\/+/, ''));
  const msKey = findEntry(entries, 'Metadata/model_settings.config');
  const settings = parseModelSettings(msKey ? utf8.decode(entries[msKey]) : '');
  const cfg = parseProjectSettings(entries[findEntry(entries, 'Metadata/project_settings.config')]);
  let filaments = filamentSlots(cfg);
  let published = false;
  {
    // Plik po trybie "z filamentami": lista filamentów jest w metadanych Publish 3MF.
    const r = entries[rootKey];
    const head = utf8.decode(r.subarray(0, Math.min(r.length, 4 << 20)));
    published = head.includes('<metadata name="orca_published">1</metadata>');
    const mk = /<metadata name="orca_published_material_keys">([^<]*)<\/metadata>/.exec(head);
    if (!filaments.length && mk) {
      try {
        const un = mk[1].replace(/&(quot|apos|lt|gt|amp);/g, (_, e) => ({ quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' }[e]));
        filaments = JSON.parse(un).sort((a, b) => a.slot - b.slot).map((m) => ({ color: m.color || '', type: m.type || '', vendor: (m.material || {}).filament_vendor || '', id: '', preset: (m.material || {}).name || '' }));
      } catch { /* brak kolorów w podglądzie */ }
    }
  }

  // Zbierz instancje siatek: [obiekt z siatką, macierz świata, extruder]
  const parts = [];
  const visit = (key, m, rootId, depth, ext) => {
    const o = objects.get(key);
    if (!o || depth > 16) return;
    if (o.t.n) parts.push({ o, m, ext });
    for (const c of o.comps) {
      let e = ext;
      if (depth === 0) {
        const os = settings.get(rootId), ps = os && os.parts.get(c.objectid);
        if (ps && ps.subtype !== 'normal_part') continue; // modyfikatory, części ujemne, blokery
        if (ps && ps.extruder) e = ps.extruder;
      }
      visit(c.key, compose(c.m, m), rootId, depth + 1, e);
    }
  };
  for (const it of items) {
    const rootId = it.objectid;
    const os = settings.get(rootId);
    visit(it.key, it.m, rootId, 0, os ? os.extruder || 1 : 1);
  }

  let nv = 0, nt = 0;
  for (const p of parts) { nv += p.o.v.n / 3; nt += p.o.t.n / 3; }
  const positions = new Float32Array(nv * 3);
  const slotOf = new Uint8Array(nt);
  const triIdx = new Uint32Array(nt * 3);
  let vo = 0, to = 0, painted = false;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const { o, m, ext } of parts) {
    const v = o.v.a, nvo = o.v.n / 3;
    for (let i = 0; i < nvo; i++) {
      const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
      const X = x * m[0] + y * m[3] + z * m[6] + m[9];
      const Y = x * m[1] + y * m[4] + z * m[7] + m[10];
      const Z = x * m[2] + y * m[5] + z * m[8] + m[11];
      const j = (vo + i) * 3;
      positions[j] = X; positions[j + 1] = Y; positions[j + 2] = Z;
      if (X < min[0]) min[0] = X; if (Y < min[1]) min[1] = Y; if (Z < min[2]) min[2] = Z;
      if (X > max[0]) max[0] = X; if (Y > max[1]) max[1] = Y; if (Z > max[2]) max[2] = Z;
    }
    const t = o.t.a, p = o.p.a, nto = o.t.n / 3;
    if (o.painted) painted = true;
    for (let i = 0; i < nto; i++) {
      triIdx[(to + i) * 3] = t[i * 3] + vo; triIdx[(to + i) * 3 + 1] = t[i * 3 + 1] + vo; triIdx[(to + i) * 3 + 2] = t[i * 3 + 2] + vo;
      const st = p[i] || ext || 1;
      slotOf[to + i] = Math.min(255, Math.max(1, st)) - 1;
    }
    vo += nvo; to += nto;
  }
  // Sortowanie trójkątów po slocie (grupy = osobne materiały w three.js)
  const counts = new Uint32Array(256);
  for (let i = 0; i < nt; i++) counts[slotOf[i]]++;
  const starts = new Uint32Array(256); const groups = [];
  let acc = 0;
  for (let s = 0; s < 256; s++) { starts[s] = acc; if (counts[s]) groups.push({ start: acc * 3, count: counts[s] * 3, slot: s }); acc += counts[s]; }
  const indices = new Uint32Array(nt * 3);
  for (let i = 0; i < nt; i++) { const d = starts[slotOf[i]]++ * 3; indices[d] = triIdx[i * 3]; indices[d + 1] = triIdx[i * 3 + 1]; indices[d + 2] = triIdx[i * 3 + 2]; }

  const objectNames = [...new Set(items.map((it) => (settings.get(it.objectid) || {}).name || (objects.get(it.key) || {}).name).filter(Boolean))];
  return {
    positions, indices, groups,
    stats: { triangles: nt, vertices: nv, objects: items.length, objectNames, painted, slotsUsed: groups.map((g) => g.slot + 1),
      size: nt ? [max[0] - min[0], max[1] - min[1], max[2] - min[2]] : [0, 0, 0], min, max },
    filaments, published,
  };
}

export { paintState, parseModelSettings };
