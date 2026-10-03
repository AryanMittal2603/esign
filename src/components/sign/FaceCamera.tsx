"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * Liveness flow (all on-device):
 *   starting → loading → none/many → blink → turn → center → passed
 * "unavailable" means the model could not run on this device; capture is still allowed and recorded as such.
 */
export type FaceState = "starting" | "loading" | "none" | "many" | "blink" | "turn" | "center" | "passed" | "unavailable";
export type Geo = { lat: number; lng: number; accuracy: number };
export type CameraHandle = { capture: () => Promise<Blob> };

type Props = {
  onFace: (s: FaceState) => void;
  onError: (msg: string) => void;
};

type Landmarker = {
  detectForVideo: (v: HTMLVideoElement, t: number) => {
    faceLandmarks: { x: number; y: number; z: number }[][];
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
  };
  close: () => void;
};

const BLINK_CLOSED = 0.45; // both eyes at least this closed
const BLINK_OPEN = 0.22;   // and then open again
const TURN = 0.12;         // nose offset vs. cheek midpoint, as a fraction of face width
const CENTER = 0.06;

/** Live front camera with on-device face landmarks (MediaPipe). No frames leave the device until capture. */
export const FaceCamera = forwardRef<CameraHandle, Props>(function FaceCamera({ onFace, onError }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const [face, setFace] = useState<FaceState>("starting");
  const [failed, setFailed] = useState(false);
  const cbs = useRef({ onFace, onError });
  cbs.current = { onFace, onError };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let marker: Landmarker | null = null;
    let state: FaceState = "starting";
    const set = (s: FaceState) => { if (s !== state) { state = s; setFace(s); cbs.current.onFace(s); } };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot open the camera. Open the link in Chrome or Safari.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false });
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        set("loading");
      } catch (e) {
        setFailed(true);
        const name = (e as { name?: string }).name;
        cbs.current.onError(name === "NotAllowedError" ? "Camera access was blocked. Allow the camera for this site and try again." : (e as Error).message || "Camera could not start.");
        return;
      }

      try {
        const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        marker = (await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 2,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        })) as unknown as Landmarker;
      } catch {
        set("unavailable");
        return;
      }
      if (stopped) { marker.close(); return; }

      // liveness progress survives brief tracking gaps, but resets if a second face appears
      let blinkClosed = false, blinked = false, turned = false, passed = false;
      let streak = { key: "", n: 0 };
      let last = 0;
      const stable = (key: string) => { streak = streak.key === key ? { key, n: streak.n + 1 } : { key, n: 1 }; return streak.n >= 3; };

      const loop = (now: number) => {
        if (stopped) return;
        const v = video.current;
        if (v && v.readyState >= 2 && now - last > 90) {
          last = now;
          try {
            const r = marker!.detectForVideo(v, now);
            const n = r.faceLandmarks.length;
            if (n === 0) { if (stable("none")) set(passed ? "passed" : "none"); }
            else if (n > 1) { blinkClosed = blinked = turned = passed = false; if (stable("many")) set("many"); }
            else {
              const lm = r.faceLandmarks[0];
              const cats = r.faceBlendshapes?.[0]?.categories ?? [];
              const score = (name: string) => cats.find((c) => c.categoryName === name)?.score ?? 0;
              const eyes = Math.min(score("eyeBlinkLeft"), score("eyeBlinkRight"));
              const eyesOpen = Math.max(score("eyeBlinkLeft"), score("eyeBlinkRight")) < BLINK_OPEN;
              const nose = lm[1], left = lm[234], right = lm[454];
              const yaw = (nose.x - (left.x + right.x) / 2) / Math.max(0.01, Math.abs(right.x - left.x));

              if (!blinked) {
                if (eyes > BLINK_CLOSED) blinkClosed = true;
                else if (blinkClosed && eyesOpen) blinked = true;
                set(blinked ? "turn" : "blink");
              } else if (!turned) {
                if (Math.abs(yaw) > TURN) turned = true;
                set(turned ? "center" : "turn");
              } else if (!passed) {
                if (Math.abs(yaw) < CENTER && eyesOpen) passed = true;
                set(passed ? "passed" : "center");
              } else {
                set("passed");
              }
            }
          } catch { /* skip frame */ }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      marker?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useImperativeHandle(ref, () => ({
    capture: async () => {
      const v = video.current!;
      const vw = v.videoWidth, vh = v.videoHeight;
      // portrait 3:4 crop from the centre
      const targetRatio = 3 / 4;
      let sw = vw, sh = vh;
      if (vw / vh > targetRatio) sw = vh * targetRatio; else sh = vw / targetRatio;
      const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
      const c = document.createElement("canvas");
      c.width = 720; c.height = 960;
      c.getContext("2d")!.drawImage(v, sx, sy, sw, sh, 0, 0, 720, 960);
      return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Capture failed"))), "image/jpeg", 0.9));
    },
  }));

  return (
    <>
      <video ref={video} playsInline muted aria-label="Live camera" />
      {!failed && (face === "loading" || face === "none" || face === "starting") && (
        <div style={{ position: "absolute", left: "18%", right: "18%", top: 0, bottom: 0 }}>
          <div className="scan" style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#B8D9E400,#B8D9E4,#B8D9E400)", boxShadow: "0 0 18px 4px #B8D9E455" }} />
        </div>
      )}
    </>
  );
});

export function getPosition(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser cannot share location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? "Location access was blocked. Allow location for this site and try again." : "Could not get your location. Move near a window and try again.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  });
}
