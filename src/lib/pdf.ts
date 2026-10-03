import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";
import { GUILLOCHE_INK, IMPRESSION_INK, drawGuilloche, drawHalftone, halftoneGrid, type Halftone } from "./impression";

/* ── palette (matches the UI) ── */
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  paper: hex("#F3F6F4"), ink: hex("#142844"), quiet: hex("#637383"), line: hex("#A8BBC2"), soft: hex("#D4DEE0"),
  copper: hex("#B76A3B"), copperInk: hex("#9A5530"), green: hex("#2E7567"), white: rgb(1, 1, 1), photoBg: hex("#2A4A78"),
};

const A4 = { w: 595.28, h: 841.89 };
const STRIP = 66;

/** Standard PDF fonts only cover WinAnsi; replace anything else so drawing never throws. */
const EXTRA = new Set("•–—‘’“”…€™".split(""));
export function pdfSafe(s: string): string {
  return Array.from(s ?? "").map((ch) => {
    const c = ch.codePointAt(0)!;
    if (ch === "\n" || ch === "\t") return " ";
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || EXTRA.has(ch)) return ch;
    return "?";
  }).join("");
}

function fit(text: string, font: PDFFont, size: number, max: number): string {
  let t = pdfSafe(text);
  if (font.widthOfTextAtSize(t, size) <= max) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > max) t = t.slice(0, -1);
  return t + "…";
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      // a single very long token (e.g. a hash) is hard-split
      let rest = w;
      while (font.widthOfTextAtSize(rest, size) > max) {
        let i = rest.length;
        while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > max) i--;
        lines.push(rest.slice(0, i));
        rest = rest.slice(i);
      }
      cur = rest;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ───────────────────────── merge uploads into one PDF ───────────────────────── */

export type UploadPart = { bytes: Uint8Array; type: string; name?: string };

export async function mergeToPdf(parts: UploadPart[]): Promise<{ bytes: Uint8Array; pages: number }> {
  const out = await PDFDocument.create();
  for (const part of parts) {
    const type = part.type.toLowerCase();
    if (type === "application/pdf") {
      const src = await PDFDocument.load(part.bytes, { ignoreEncryption: true });
      const copied = await out.copyPages(src, src.getPageIndices());
      copied.forEach((p) => out.addPage(p));
      continue;
    }
    let img: PDFImage;
    if (type === "image/jpeg" || type === "image/jpg") img = await out.embedJpg(part.bytes);
    else if (type === "image/png") img = await out.embedPng(part.bytes);
    else throw new Error(`Unsupported file type: ${part.type || part.name}. Use PDF, JPG or PNG.`);
    const landscape = img.width > img.height;
    const pw = landscape ? A4.h : A4.w;
    const ph = landscape ? A4.w : A4.h;
    const m = 14;
    const s = Math.min((pw - m * 2) / img.width, (ph - m * 2) / img.height);
    const w = img.width * s, h = img.height * s;
    const page = out.addPage([pw, ph]);
    page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: C.white });
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  if (out.getPageCount() === 0) throw new Error("No pages found in the upload.");
  out.setProducer("SeqreSign");
  out.setCreator("SeqreSign");
  return { bytes: await out.save(), pages: out.getPageCount() };
}

/* ───────────────────────── sign: stamp every page + certificate ───────────────────────── */

export type SignInput = {
  draft: Uint8Array;
  photoJpeg: Uint8Array;
  documentId: string;
  originalHash: string;
  signer: { name: string; mobileMasked: string };
  project: { name: string; exam?: string | null };
  centre: { code: string; name: string };
  signedAtText: string; // "12 Oct 2026, 14:32:10 IST"
  otp: { ref: string; sentAtText: string; verifiedAtText: string };
  geo: { lat: number; lng: number; accuracy?: number | null } | null;
  photoAtText: string;
  faceCheck: string;
  liveness: string;
  device: string;
  ip: string;
  trail: { at: string; what: string }[];
};

type Fonts = { reg: PDFFont; bold: PDFFont; mono: PDFFont };
type Impressions = { mini: Halftone; big: Halftone } | null;

function seal(page: PDFPage, cx: number, cy: number, r: number) {
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: C.green, borderWidth: Math.max(1, r * 0.09) });
  page.drawCircle({ x: cx, y: cy, size: r * 0.76, color: C.green });
  const k = r * 0.36;
  page.drawLine({ start: { x: cx - k, y: cy }, end: { x: cx - k * 0.25, y: cy - k * 0.7 }, thickness: Math.max(1.2, r * 0.13), color: C.white });
  page.drawLine({ start: { x: cx - k * 0.25, y: cy - k * 0.7 }, end: { x: cx + k * 1.05, y: cy + k * 0.75 }, thickness: Math.max(1.2, r * 0.13), color: C.white });
}

function drawStrip(page: PDFPage, width: number, f: Fonts, photo: PDFImage, inp: SignInput, i: number, n: number, imp: Impressions) {
  page.drawRectangle({ x: 0, y: 0, width, height: STRIP, color: C.paper });
  page.drawLine({ start: { x: 0, y: STRIP }, end: { x: width, y: STRIP }, thickness: 0.8, color: C.line, dashArray: [3, 3] });

  const ph = 50, pw = (photo.width / photo.height) * ph;
  page.drawRectangle({ x: 13, y: 7, width: pw + 2, height: ph + 2, color: C.green });
  page.drawImage(photo, { x: 14, y: 8, width: pw, height: ph });

  // facial impression: halftone of the live photo over a guilloche patch
  let x = 14 + pw + 12;
  if (imp) {
    const gx = 14 + pw + 6, gw = 38, gh = ph + 2;
    page.drawRectangle({ x: gx, y: 7, width: gw, height: gh, color: rgb(0.95, 0.97, 0.99), borderColor: C.soft, borderWidth: 0.5 });
    drawGuilloche(page, gx, 7, gw, gh, { color: GUILLOCHE_INK, font: f.mono, micro: inp.documentId, lines: 7 });
    drawHalftone(page, imp.mini, gx + 2, 8, gw - 4, gh - 2, IMPRESSION_INK, 0.85);
    x = gx + gw + 12;
  }
  const right = 118;
  const max = width - x - right;
  page.drawText(fit(`Digitally signed by ${inp.signer.name}`, f.bold, 9.5, max), { x, y: STRIP - 17, size: 9.5, font: f.bold, color: C.ink });
  page.drawText(fit(`Centre ${inp.centre.code} · ${inp.project.name}`, f.reg, 7.4, max), { x, y: STRIP - 29, size: 7.4, font: f.reg, color: C.ink });
  page.drawText(fit(`${inp.signedAtText} · OTP ref ${inp.otp.ref}`, f.reg, 7.4, max), { x, y: STRIP - 40, size: 7.4, font: f.reg, color: C.quiet });
  const geo = inp.geo ? `${inp.geo.lat.toFixed(4)}° N, ${inp.geo.lng.toFixed(4)}° E · ` : "";
  page.drawText(fit(`${geo}Face + mobile OTP eSign`, f.reg, 7.4, max), { x, y: STRIP - 51, size: 7.4, font: f.reg, color: C.quiet });

  seal(page, width - right + 16, STRIP / 2, 13);
  const idW = f.mono.widthOfTextAtSize(inp.documentId, 7.6);
  page.drawText(inp.documentId, { x: width - 14 - idW, y: STRIP / 2 + 2, size: 7.6, font: f.mono, color: C.ink });
  const pg = `Page ${i + 1} of ${n}`;
  page.drawText(pg, { x: width - 14 - f.mono.widthOfTextAtSize(pg, 7), y: STRIP / 2 - 10, size: 7, font: f.mono, color: C.quiet });
}

export async function signPdf(inp: SignInput): Promise<Uint8Array> {
  const src = await PDFDocument.load(inp.draft, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const f: Fonts = {
    reg: await out.embedFont(StandardFonts.Helvetica),
    bold: await out.embedFont(StandardFonts.HelveticaBold),
    mono: await out.embedFont(StandardFonts.Courier),
  };
  const photo = await out.embedJpg(inp.photoJpeg);
  let imp: Impressions = null;
  try {
    imp = { mini: halftoneGrid(inp.photoJpeg, 18, 24), big: halftoneGrid(inp.photoJpeg, 42, 56) };
  } catch {
    imp = null; // never block signing on the decorative impression
  }
  const srcPages = src.getPages();
  const n = srcPages.length + 1; // + certificate

  for (let i = 0; i < srcPages.length; i++) {
    const sp = srcPages[i];
    const emb = await out.embedPage(sp);
    const rot = ((sp.getRotation().angle % 360) + 360) % 360;
    const w = emb.width, h = emb.height;
    const vw = rot === 90 || rot === 270 ? h : w;
    const vh = rot === 90 || rot === 270 ? w : h;
    const page = out.addPage([vw, vh + STRIP]);
    // draw the original page above the strip, honouring its /Rotate
    if (rot === 0) page.drawPage(emb, { x: 0, y: STRIP });
    else if (rot === 90) page.drawPage(emb, { x: 0, y: STRIP + w, rotate: degrees(-90) });
    else if (rot === 180) page.drawPage(emb, { x: w, y: STRIP + h, rotate: degrees(180) });
    else page.drawPage(emb, { x: h, y: STRIP, rotate: degrees(90) });
    drawStrip(page, vw, f, photo, inp, i, n, imp);
  }

  drawCertificate(out.addPage([A4.w, A4.h]), f, photo, inp, n, imp);

  out.setTitle(`Signed CSR · Centre ${inp.centre.code} · ${inp.documentId}`);
  out.setAuthor(pdfSafe(inp.signer.name));
  out.setSubject(pdfSafe(`${inp.project.name} · ${inp.centre.name}`));
  out.setKeywords(["SeqreSign", "eSign", inp.documentId, `sha256:${inp.originalHash}`]);
  out.setProducer("SeqreSign");
  out.setCreator("SeqreSign");
  return out.save();
}

function drawCertificate(page: PDFPage, f: Fonts, photo: PDFImage, inp: SignInput, n: number, imp: Impressions) {
  const W = A4.w, H = A4.h, M = 46;
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.paper });

  // header
  page.drawCircle({ x: M + 9, y: H - M - 6, size: 9, borderColor: C.ink, borderWidth: 1.6 });
  page.drawLine({ start: { x: M + 4.5, y: H - M - 5.5 }, end: { x: M + 8, y: H - M - 9 }, thickness: 1.9, color: C.copper });
  page.drawLine({ start: { x: M + 8, y: H - M - 9 }, end: { x: M + 14, y: H - M - 2 }, thickness: 1.9, color: C.copper });
  page.drawText("Seqre", { x: M + 24, y: H - M - 11, size: 14, font: f.bold, color: C.ink });
  page.drawText("Sign", { x: M + 24 + f.bold.widthOfTextAtSize("Seqre", 14), y: H - M - 11, size: 14, font: f.bold, color: C.copper });
  const idTxt = `Document ID · ${inp.documentId}`;
  page.drawText(idTxt, { x: W - M - f.mono.widthOfTextAtSize(idTxt, 8.5), y: H - M - 9, size: 8.5, font: f.mono, color: C.quiet });

  // kicker + title
  let y = H - M - 56;
  page.drawLine({ start: { x: M, y: y + 3 }, end: { x: M + 20, y: y + 3 }, thickness: 1.6, color: C.copper });
  page.drawText("CERTIFICATE OF ELECTRONIC SIGNATURE", { x: M + 28, y, size: 8, font: f.mono, color: C.copperInk });
  y -= 36;
  const t1 = "Signed with face + ";
  page.drawText(t1, { x: M, y, size: 27, font: f.bold, color: C.ink });
  page.drawText("mobile OTP.", { x: M + f.bold.widthOfTextAtSize(t1, 27), y, size: 27, font: f.bold, color: C.green });
  y -= 18;
  page.drawText(fit(`Appended to the ${n - 1}-page CSR for centre ${inp.centre.code}. Each page carries a signature block.`, f.reg, 9.5, W - M * 2), { x: M, y, size: 9.5, font: f.reg, color: C.quiet });

  // photo
  const top = y - 24;
  const pW = 138, pH = 184;
  page.drawRectangle({ x: M - 3, y: top - pH - 3, width: pW + 6, height: pH + 6, color: C.green });
  page.drawRectangle({ x: M, y: top - pH, width: pW, height: pH, color: C.photoBg });
  // contain inside the frame (pdf-lib cannot clip images)
  const cs = Math.min(pW / photo.width, pH / photo.height);
  const iw = photo.width * cs, ih = photo.height * cs;
  page.drawImage(photo, { x: M + (pW - iw) / 2, y: top - pH + (pH - ih) / 2, width: iw, height: ih });
  page.drawText(fit(`Photo signature · ${inp.photoAtText}`, f.mono, 7, pW + 20), { x: M, y: top - pH - 16, size: 7, font: f.mono, color: C.quiet });

  // facts
  const fx = M + pW + 26, fw = W - M - fx;
  const facts: [string, string][] = [
    ["Signatory", inp.signer.name],
    ["Registered mobile", `+91 ${inp.signer.mobileMasked}`],
    ["Project", inp.project.name + (inp.project.exam ? ` · ${inp.project.exam}` : "")],
    ["Centre", `${inp.centre.code} · ${inp.centre.name}`],
    ["Signed at", inp.signedAtText],
    ["Location", inp.geo ? `${inp.geo.lat.toFixed(6)}, ${inp.geo.lng.toFixed(6)}${inp.geo.accuracy ? ` · ±${Math.round(inp.geo.accuracy)} m` : ""}` : "Not available"],
    ["Device", inp.device],
    ["IP address", inp.ip],
    ["Liveness", inp.liveness === "passed" ? "Passed · one live face, blinked and turned head" : inp.faceCheck === "passed" ? "One face detected in live camera (liveness not supported on device)" : "Live camera photo (face check unavailable)"],
    ["Document", `${n - 1} page${n - 1 === 1 ? "" : "s"} + this certificate`],
  ];
  let fy = top;
  for (const [k, v] of facts) {
    const lines = wrap(v, f.reg, 9.5, fw - 104);
    page.drawText(k.toUpperCase(), { x: fx, y: fy - 11, size: 6.8, font: f.mono, color: C.quiet });
    lines.forEach((ln, j) => page.drawText(ln, { x: fx + 104, y: fy - 11 - j * 12, size: 9.5, font: f.bold, color: C.ink }));
    fy -= 11 + lines.length * 12 + 2;
    page.drawLine({ start: { x: fx, y: fy }, end: { x: W - M, y: fy }, thickness: 0.6, color: C.soft });
  }

  let by = Math.min(fy, top - pH - 26) - 14;

  // facial impression band (passport-style secondary portrait)
  if (imp) {
    const bh2 = 100, bw = W - M * 2;
    page.drawRectangle({ x: M, y: by - bh2, width: bw, height: bh2, color: rgb(0.96, 0.975, 0.99), borderColor: C.soft, borderWidth: 0.8 });
    drawGuilloche(page, M, by - bh2, bw, bh2, { color: GUILLOCHE_INK, font: f.mono, micro: `${inp.documentId} · SEQRESIGN · ${inp.signer.name.toUpperCase()}`, lines: 18 });
    const gw = 72, gh = 96;
    drawHalftone(page, imp.big, M + 16, by - bh2 + 2, gw, gh, IMPRESSION_INK, 0.92);
    const tx = M + 16 + gw + 20;
    page.drawRectangle({ x: tx - 8, y: by - bh2 + 20, width: 300, height: 62, color: rgb(0.96, 0.975, 0.99), opacity: 0.88 });
    page.drawText("FACIAL IMPRESSION", { x: tx, y: by - 32, size: 6.8, font: f.mono, color: C.quiet });
    page.drawText("Rendered from the live photo signature", { x: tx, y: by - 47, size: 11, font: f.bold, color: C.ink });
    page.drawText(fit(`Captured ${inp.photoAtText} · ${inp.liveness === "passed" ? "liveness passed (blink + head turn)" : "liveness not available"}`, f.reg, 8, 290), { x: tx, y: by - 61, size: 8, font: f.reg, color: C.quiet });
    page.drawText(fit("Vector halftone over a guilloche pattern - altering the photo breaks the print.", f.reg, 7.4, 290), { x: tx, y: by - 74, size: 7.4, font: f.reg, color: C.quiet });
    by -= bh2 + 14;
  }

  // OTP block
  const bh = 62;
  page.drawRectangle({ x: M, y: by - bh, width: W - M * 2, height: bh, color: C.white, borderColor: C.soft, borderWidth: 0.8 });
  const colW = (W - M * 2) / 3;
  const otpCols: [string, string, string][] = [
    ["OTP SENT", inp.otp.sentAtText, `to +91 ${inp.signer.mobileMasked}`],
    ["OTP VERIFIED", inp.otp.verifiedAtText, "signature acknowledged"],
    ["OTP REFERENCE", inp.otp.ref, "acts as the OTP signature"],
  ];
  otpCols.forEach(([k, v, sub], j) => {
    const x = M + 16 + j * colW;
    page.drawText(k, { x, y: by - 18, size: 6.8, font: f.mono, color: C.quiet });
    page.drawText(fit(v, f.mono, 9.5, colW - 24), { x, y: by - 33, size: 9.5, font: f.mono, color: j === 2 ? C.green : C.ink });
    page.drawText(fit(sub, f.reg, 7.6, colW - 24), { x, y: by - 46, size: 7.6, font: f.reg, color: C.quiet });
  });

  // audit trail
  by -= bh + 26;
  page.drawText("AUDIT TRAIL", { x: M, y: by, size: 7, font: f.mono, color: C.quiet });
  by -= 16;
  for (const row of inp.trail.slice(-12)) {
    if (by < 100) break;
    page.drawText(fit(row.at, f.mono, 7.6, 60), { x: M, y: by, size: 7.6, font: f.mono, color: C.quiet });
    page.drawCircle({ x: M + 66, y: by + 2.6, size: 2.4, color: C.green });
    page.drawText(fit(row.what, f.reg, 8.6, W - M * 2 - 80), { x: M + 76, y: by, size: 8.6, font: f.reg, color: C.ink });
    by -= 14;
  }

  // footer
  const footY = M + 8;
  page.drawText("ORIGINAL DOCUMENT SHA-256", { x: M, y: footY + 34, size: 6.8, font: f.mono, color: C.quiet });
  page.drawText(inp.originalHash, { x: M, y: footY + 22, size: 7, font: f.mono, color: C.ink });
  page.drawText(fit("Generated by SeqreSign. This page is part of the signed document.", f.reg, 7.6, 380), { x: M, y: footY + 8, size: 7.6, font: f.reg, color: C.quiet });
  const pillW = 92;
  page.drawRectangle({ x: W - M - pillW, y: footY + 8, width: pillW, height: 26, color: C.green });
  page.drawText("eSigned", { x: W - M - pillW + 30, y: footY + 17, size: 10.5, font: f.bold, color: C.white });
  page.drawLine({ start: { x: W - M - pillW + 13, y: footY + 21 }, end: { x: W - M - pillW + 17, y: footY + 17 }, thickness: 1.6, color: C.white });
  page.drawLine({ start: { x: W - M - pillW + 17, y: footY + 17 }, end: { x: W - M - pillW + 24, y: footY + 26 }, thickness: 1.6, color: C.white });
}
