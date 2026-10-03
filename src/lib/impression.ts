import jpeg from "jpeg-js";
import { PDFFont, PDFPage, rgb, type RGB } from "pdf-lib";

/**
 * "Ghost image" impression of the signatory's live photo, drawn as vector dots (halftone) over a
 * guilloche line pattern — like the secondary portrait on passports and ID cards. Vector dots stay
 * sharp at any zoom and are hard to replace without visibly breaking the pattern.
 */

export type Halftone = { cols: number; rows: number; dark: Float32Array };

/** Samples the photo into a grid of darkness values (0 light … 1 dark), with contrast stretch and an oval face mask. */
export function halftoneGrid(photoJpeg: Uint8Array, cols: number, rows: number): Halftone {
  const img = jpeg.decode(photoJpeg, { useTArray: true, formatAsRGBA: true });
  const { width: W, height: H, data } = img;
  const lum = new Float32Array(cols * rows);
  const cw = W / cols, ch = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0, n = 0;
      const x0 = Math.floor(c * cw), x1 = Math.min(W, Math.floor((c + 1) * cw));
      const y0 = Math.floor(r * ch), y1 = Math.min(H, Math.floor((r + 1) * ch));
      const step = Math.max(1, Math.floor((x1 - x0) / 4));
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const i = (y * W + x) * 4;
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
      }
      lum[r * cols + c] = n ? sum / n : 255;
    }
  }
  // contrast stretch between the 5th and 95th percentiles
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)], hi = sorted[Math.floor(sorted.length * 0.95)];
  const span = Math.max(1, hi - lo);
  const dark = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = Math.min(1, Math.max(0, (lum[r * cols + c] - lo) / span));
      // oval mask centred slightly above middle: keeps the face, fades the background
      const dx = (c + 0.5) / cols - 0.5, dy = (r + 0.5) / rows - 0.46;
      const d = Math.sqrt((dx / 0.46) ** 2 + (dy / 0.56) ** 2);
      const mask = d < 0.78 ? 1 : d > 1.05 ? 0 : 1 - (d - 0.78) / 0.27;
      dark[r * cols + c] = Math.pow(1 - t, 1.15) * mask;
    }
  }
  return { cols, rows, dark };
}

/** Draws the halftone as dots whose size follows the darkness of the face. */
export function drawHalftone(page: PDFPage, g: Halftone, x: number, y: number, w: number, h: number, color: RGB, opacity = 0.9) {
  const cw = w / g.cols, ch = h / g.rows;
  const maxR = Math.min(cw, ch) * 0.56;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const d = g.dark[r * g.cols + c];
      if (d < 0.06) continue;
      const rad = maxR * Math.sqrt(d);
      // offset every other row for a classic halftone screen
      const cx = x + (c + 0.5 + (r % 2 ? 0.25 : -0.25)) * cw;
      const cy = y + h - (r + 0.5) * ch;
      page.drawCircle({ x: cx, y: cy, size: rad, color, opacity });
    }
  }
}

/** Guilloche: interleaved sine waves plus microtext lines, the classic security-print background. */
export function drawGuilloche(page: PDFPage, x: number, y: number, w: number, h: number, opts: { color: RGB; font: PDFFont; micro: string; lines?: number }) {
  const lines = opts.lines ?? 16;
  const pts = 90;
  for (let k = 0; k < lines; k++) {
    const phase = (k / lines) * Math.PI * 2;
    const amp = h * 0.32;
    let d = "";
    for (let i = 0; i <= pts; i++) {
      const t = i / pts;
      const px = t * w;
      const py = h / 2 + amp * Math.sin(t * Math.PI * 4 + phase) * Math.cos(t * Math.PI * 1.5 + phase / 2);
      d += `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)} `;
    }
    // drawSvgPath uses SVG coordinates (y down) from the given origin
    page.drawSvgPath(d, { x, y: y + h, borderColor: opts.color, borderWidth: 0.35, borderOpacity: 0.55 });
  }
  // microtext rows — legible only when zoomed in
  const size = 3.2;
  const unit = `${opts.micro} · `;
  const unitW = opts.font.widthOfTextAtSize(unit, size);
  const reps = Math.ceil(w / unitW) + 1;
  let text = "";
  for (let i = 0; i < reps; i++) text += unit;
  while (opts.font.widthOfTextAtSize(text, size) > w && text.length) text = text.slice(0, -1);
  for (const fy of [0.08, 0.92]) {
    page.drawText(text, { x, y: y + h * fy - size / 2, size, font: opts.font, color: opts.color, opacity: 0.8 });
  }
}

export const IMPRESSION_INK = rgb(0.16, 0.36, 0.66); // passport-style blue
export const GUILLOCHE_INK = rgb(0.55, 0.7, 0.86);
