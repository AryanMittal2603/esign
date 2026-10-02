"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export type FaceState = "starting" | "loading" | "none" | "one" | "many" | "unavailable";
export type Geo = { lat: number; lng: number; accuracy: number };
export type CameraHandle = { capture: () => Promise<Blob> };

type Props = {
  onFace: (s: FaceState) => void;
  onError: (msg: string) => void;
};

/** Live front camera with in-browser face detection (MediaPipe). No frames leave the device until capture. */
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
    let detector: { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: unknown[] }; close: () => void } | null = null;
    const set = (s: FaceState) => { setFace(s); cbs.current.onFace(s); };

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
        const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.6,
        });
      } catch {
        set("unavailable");
        return;
      }
      if (stopped) { detector.close(); return; }

      let last = 0;
      let streak = { s: "none" as FaceState, n: 0 };
      const loop = (now: number) => {
        if (stopped) return;
        const v = video.current;
        if (v && v.readyState >= 2 && now - last > 140) {
          last = now;
          try {
            const n = detector!.detectForVideo(v, now).detections.length;
            const s: FaceState = n === 0 ? "none" : n === 1 ? "one" : "many";
            // require a few stable frames so the badge doesn't flicker
            streak = streak.s === s ? { s, n: streak.n + 1 } : { s, n: 1 };
            if (streak.n === 3) set(s);
          } catch { /* skip frame */ }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      detector?.close();
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
