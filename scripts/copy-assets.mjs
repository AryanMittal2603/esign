// Copies browser runtime files that must be served as static assets:
// MediaPipe face detection WASM and the pdf.js worker.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const out = "public";
if (existsSync("node_modules/@mediapipe/tasks-vision/wasm")) {
  mkdirSync(`${out}/mediapipe`, { recursive: true });
  cpSync("node_modules/@mediapipe/tasks-vision/wasm", `${out}/mediapipe/wasm`, { recursive: true });
}
if (existsSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs")) {
  cpSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", `${out}/pdf.worker.min.mjs`);
}
console.log("Copied MediaPipe WASM and pdf.js worker to /public");
