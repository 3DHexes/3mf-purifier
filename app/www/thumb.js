// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
// Miniatura 3MF: dekodowanie obrazu (PNG, JPG, WebP, BMP, GIF, AVIF) i przeskalowanie
// do kwadratowych PNG 512x512 (okładka) i 128x128 (mała miniatura).
// mode: 'fill' - wypełnij kwadrat i przytnij nadmiar, 'fit' - zmieść cały obraz (przezroczyste marginesy).

export const SIZES = { middle: 512, small: 128 };

export async function decodeImage(bytes) {
  return createImageBitmap(new Blob([bytes]));
}

async function render(bitmap, size, mode) {
  const c = new OffscreenCanvas(size, size);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  const { width: iw, height: ih } = bitmap;
  const scale = mode === 'fit' ? Math.min(size / iw, size / ih) : Math.max(size / iw, size / ih);
  // Duże zmniejszenia robimy w kilku krokach, żeby uniknąć aliasingu.
  let src = bitmap, sw = iw, sh = ih;
  while (sw * scale < sw / 2 && Math.max(sw, sh) > size * 2) {
    const nw = Math.max(1, Math.round(sw / 2)), nh = Math.max(1, Math.round(sh / 2));
    const step = new OffscreenCanvas(nw, nh);
    const sg = step.getContext('2d');
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(src, 0, 0, nw, nh);
    src = step; sw = nw; sh = nh;
  }
  const w = iw * scale, h = ih * scale;
  g.drawImage(src, (size - w) / 2, (size - h) / 2, w, h);
  const blob = await c.convertToBlob({ type: 'image/png' });
  return { blob, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

export async function makeThumb(bitmap, mode) {
  const m = await render(bitmap, SIZES.middle, mode);
  const s = await render(bitmap, SIZES.small, mode);
  return { middle: m.bytes, small: s.bytes, url: URL.createObjectURL(m.blob) };
}
