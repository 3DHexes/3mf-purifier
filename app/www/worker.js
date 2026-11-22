// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
// Ciężka praca (rozpakowanie, parsowanie, kompresja) w osobnym wątku, żeby okno nie zamarzało.
import { analyzeBytes, cleanBytes } from './core/purify.js';
import { buildPreviewBytes } from './core/preview.js';
import { universalBytes } from './core/universal.js';

self.onmessage = (e) => {
  const { job, bytes, opts } = e.data;
  try {
    if (job === 'analyze') {
      self.postMessage({ ok: true, value: analyzeBytes(bytes) });
    } else if (job === 'preview') {
      const p = buildPreviewBytes(bytes);
      self.postMessage({ ok: true, value: p }, [p.positions.buffer, p.indices.buffer]);
    } else if (job === 'clean' && opts.universal) {
      const m = opts.metadata || {};
      const r = universalBytes(bytes, { ...opts, metadata: { Designer: m.Designer, LicenseTerms: m.License, Copyright: m.Copyright } });
      self.postMessage({ ok: true, value: { files: r.files, r } }, r.files.map((f) => f.zipped.buffer));
    } else if (job === 'clean') {
      const { zipped, r } = cleanBytes(bytes, opts);
      self.postMessage({ ok: true, value: { zipped, r } }, [zipped.buffer]);
    } else {
      throw new Error('unknown job ' + job);
    }
  } catch (err) {
    self.postMessage({ ok: false, code: err.code || '', params: err.params || {}, message: err.message || String(err) });
  }
};
