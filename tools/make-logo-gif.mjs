/* Records the sidebar logo's arrival and writes it out as a GIF, one per theme.

   Run `npm run build && npx vite preview` first, then `npm run logo-gif`; point it
   somewhere else with PREVIEW_URL. Frames are taken as fast as the browser will give them
   and each one carries the delay actually measured between it and the next, so the GIF
   plays at the speed the animation really runs rather than at a nominal frame rate. */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { writeFileSync } from 'node:fs';

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:4173/';
const OUT = process.argv[2] ?? new URL('../docs', import.meta.url).pathname;
const RUN = 4800; // the arrival is ~3.6s; the tail is the settled logo holding still
const MIN_GAP = 45; // ms between kept frames — about 20 a second
const HOLD = 1200; // how long the finished logo sits before the loop starts again

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function capture(theme) {
  const page = await browser.newPage({ viewport: { width: 420, height: 760 } });
  await page.addInitScript((t) => localStorage.setItem('pmo-tracker:theme', t), theme);
  /* The line under the name is not part of what was asked for, and leaving it in would
     either clip it in half or force the framing wider. Hidden rather than removed, so the
     lockup above it does not shift. */
  await page.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = '.sidebar .eyebrow { visibility: hidden }';
      document.head.append(style);
    };
    if (document.head) hide();
    else document.addEventListener('DOMContentLoaded', hide);
  });
  await page.goto(BASE);
  await page.waitForSelector('.brand-wordmark');

  /* The mark on its paper and the name beneath it, with a little air around them. The
     eyebrow below is left out — the name is what was asked for. */
  const clip = await page.evaluate(() => {
    const p = document.querySelector('.brand-paper').getBoundingClientRect();
    const w = document.querySelector('.brand-wordmark').getBoundingClientRect();
    const pad = 14;
    const x = Math.round(Math.min(p.left, w.left) - pad);
    const y = Math.round(p.top - pad);
    // Even dimensions keep the encoders happy and the halves symmetrical.
    const width = Math.round(Math.max(p.right, w.right) + pad - x);
    const height = Math.round(w.bottom + pad - y);
    return { x, y, width: width + (width % 2), height: height + (height % 2) };
  });

  // Reload so the arrival starts again, then take frames as fast as they come.
  const frames = [];
  const started = Date.now();
  await page.reload({ waitUntil: 'commit' });
  let last = -Infinity;
  while (Date.now() - started < RUN) {
    const at = Date.now() - started;
    if (at - last < MIN_GAP) continue;
    let buf;
    try {
      buf = await page.screenshot({ clip, animations: 'allow' });
    } catch {
      continue; // the reload can land mid-shot
    }
    frames.push({ at, buf });
    last = at;
  }
  await page.close();
  return { clip, frames };
}

function encode({ clip, frames }, path) {
  const { width, height } = clip;
  const pixels = frames.map((f) => new Uint8Array(PNG.sync.read(f.buf).data));

  /* One palette for the whole run, built from every third frame, so colours do not shift
     from frame to frame. The last slot is left for "unchanged since the frame before". */
  const sample = pixels.filter((_, i) => i % 3 === 0);
  const joined = new Uint8Array(sample.length * width * height * 4);
  sample.forEach((p, i) => joined.set(p, i * width * height * 4));
  const palette = quantize(joined, 255, { format: 'rgb565' });
  const clear = palette.length;
  palette.push([0, 0, 0]);

  const gif = GIFEncoder();
  let previous = null;
  pixels.forEach((rgba, i) => {
    const index = applyPalette(rgba, palette, 'rgb565');
    /* Everything that has not moved since the last frame is written as the transparent
       index and left standing, which is what keeps the file small: only the panes, the
       paper and the name are ever actually redrawn. */
    if (previous) {
      for (let p = 0; p < index.length; p++) {
        const o = p * 4;
        if (
          rgba[o] === previous[o] &&
          rgba[o + 1] === previous[o + 1] &&
          rgba[o + 2] === previous[o + 2]
        ) {
          index[p] = clear;
        }
      }
    }
    const next = frames[i + 1];
    const delay = next ? next.at - frames[i].at : HOLD;
    gif.writeFrame(index, width, height, {
      palette: i === 0 ? palette : undefined,
      delay,
      repeat: 0,
      transparent: i > 0,
      transparentIndex: clear,
      dispose: 1,
    });
    previous = rgba;
  });
  gif.finish();
  const bytes = gif.bytes();
  writeFileSync(path, bytes);
  return { bytes: bytes.length, frames: pixels.length, width, height };
}

for (const theme of ['light', 'dark']) {
  const shot = await capture(theme);
  const path = `${OUT}/project-glass-logo-${theme}.gif`;
  const info = encode(shot, path);
  const span = shot.frames[shot.frames.length - 1].at;
  console.log(
    `${theme}: ${info.frames} frames over ${span}ms, ${info.width}x${info.height}, ${(info.bytes / 1024).toFixed(0)} KB -> ${path}`,
  );
}
await browser.close();
