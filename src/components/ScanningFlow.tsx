"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
} from "lucide-react";
import QuickMessageSidebar from "./QuickMessageSidebar";

// FaceDetector is an experimental browser API (Chrome/Edge)
declare class FaceDetector {
  constructor(options?: { fastMode?: boolean; maxDetectedFaces?: number });
  detect(
    image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ): Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
}

type QualityState = "good" | "adjusting" | "too-close" | "too-far";
type NotifyStatus = "idle" | "sending" | "success" | "error";

function MouthGuideOverlay({
  quality,
  label,
  viewLabel,
}: {
  quality: QualityState;
  label: string;
  viewLabel: string;
}) {
  const ringClass =
    quality === "good"
      ? "border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.35)]"
      : quality === "adjusting"
        ? "border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.2)]"
        : "border-rose-400 shadow-[0_0_24px_rgba(251,113,133,0.2)]";

  const pulseClass = quality === "adjusting" ? "animate-pulse" : "";

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* Corner brackets */}
      <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-white/30 rounded-tl-md" />
      <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-white/30 rounded-tr-md" />
      <div className="absolute bottom-24 left-6 w-8 h-8 border-b-2 border-l-2 border-white/30 rounded-bl-md" />
      <div className="absolute bottom-24 right-6 w-8 h-8 border-b-2 border-r-2 border-white/30 rounded-br-md" />

      {/* View label at top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold tracking-wide backdrop-blur-sm text-white/90">
        {viewLabel}
      </div>

      {/* Main guide ring */}
      <div className="relative flex items-center justify-center w-[72%] max-w-[320px] aspect-[1.1/1]">
        <div
          className={`absolute inset-0 rounded-[45%] border-4 ${ringClass} ${pulseClass} transition-all duration-300`}
        />
        <div className="absolute inset-[10%] rounded-[45%] border border-white/15" />

        {/* Crosshair lines */}
        <div className="absolute top-0 left-1/2 w-px h-[12%] bg-white/20" />
        <div className="absolute bottom-0 left-1/2 w-px h-[12%] bg-white/20" />
        <div className="absolute left-0 top-1/2 h-px w-[12%] bg-white/20" />
        <div className="absolute right-0 top-1/2 h-px w-[12%] bg-white/20" />

        {/* Feedback label */}
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-4 py-2 text-xs font-medium backdrop-blur-sm">
          <span
            className={
              quality === "good"
                ? "text-emerald-400"
                : quality === "adjusting"
                  ? "text-amber-400"
                  : "text-rose-400"
            }>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

function CaptureFlash({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-30 bg-white animate-[flash_300ms_ease-out_forwards] pointer-events-none" />
  );
}

export default function ScanningFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camReady, setCamReady] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [quality, setQuality] = useState<QualityState>("adjusting");
  const [flashVisible, setFlashVisible] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState<NotifyStatus>("idle");
  const [capturedLabel, setCapturedLabel] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [completedScanId, setCompletedScanId] = useState<string | null>(null);

  const VIEWS = [
    {
      label: "Front View",
      instruction: "Smile and look straight at the camera.",
    },
    { label: "Left View", instruction: "Turn your head to the left." },
    { label: "Right View", instruction: "Turn your head to the right." },
    { label: "Upper Teeth", instruction: "Tilt your head back and open wide." },
    { label: "Lower Teeth", instruction: "Tilt your head down and open wide." },
  ];

  // Initialize Camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCamReady(true);
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    startCamera();
  }, []);

  // Real-time face/position detection
  useEffect(() => {
    if (!camReady || currentStep >= 5) return;

    const video = videoRef.current;
    if (!video) return;

    let rafId: number;
    let faceDetector: FaceDetector | null = null;

    // Try native FaceDetector (Chrome / Edge)
    if (typeof globalThis.FaceDetector !== "undefined") {
      faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Fallback: estimate face region via skin-tone pixel concentration
    function detectSkinTone(
      vw: number,
      vh: number,
    ): { cx: number; cy: number; area: number } | null {
      if (!ctx) return null;
      canvas.width = 160; // downsample for speed
      canvas.height = Math.round(160 * (vh / vw));
      ctx.drawImage(video!, 0, 0, canvas.width, canvas.height);
      const { data, width, height } = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      let sumX = 0,
        sumY = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 16) {
        // sample every 4th pixel
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        // simple skin-tone heuristic (works across many skin tones)
        if (
          r > 60 &&
          g > 40 &&
          b > 20 &&
          r > g &&
          r > b &&
          r - g > 15 &&
          Math.abs(g - b) < 80
        ) {
          const px = ((i / 4) % width) / width;
          const py = Math.floor(i / 4 / width) / height;
          sumX += px;
          sumY += py;
          count++;
        }
      }
      if (count < 30) return null; // not enough skin pixels
      return {
        cx: sumX / count, // 0-1 normalized
        cy: sumY / count,
        area: count / ((width * height) / 4), // fraction of sampled pixels
      };
    }

    function evaluateBox(
      cx: number,
      cy: number,
      areaRatio: number,
    ): QualityState {
      // Check centering (within ±20% of center)
      const offCenterX = Math.abs(cx - 0.5);
      const offCenterY = Math.abs(cy - 0.45); // slightly above center is ideal
      if (offCenterX > 0.2 || offCenterY > 0.2) return "adjusting";
      // Check distance via area
      if (areaRatio > 0.55) return "too-close";
      if (areaRatio < 0.05) return "too-far";
      return "good";
    }

    async function tick() {
      if (video!.readyState < 2) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const vw = video!.videoWidth;
      const vh = video!.videoHeight;

      let newQuality: QualityState = "adjusting";

      if (faceDetector) {
        try {
          const faces = await faceDetector.detect(video!);
          if (faces.length > 0) {
            const box = faces[0].boundingBox;
            const cx = (box.x + box.width / 2) / vw;
            const cy = (box.y + box.height / 2) / vh;
            const areaRatio = (box.width * box.height) / (vw * vh);
            newQuality = evaluateBox(cx, cy, areaRatio);
          }
          // no face detected → stays "adjusting"
        } catch {
          // FaceDetector can throw if frame isn't ready; skip this tick
        }
      } else {
        // Fallback: skin-tone analysis
        const result = detectSkinTone(vw, vh);
        if (result) {
          newQuality = evaluateBox(result.cx, result.cy, result.area);
        }
      }

      setQuality(newQuality);
      rafId = requestAnimationFrame(tick);
    }

    // Small delay to let camera warm up on step change
    const startDelay = setTimeout(() => {
      rafId = requestAnimationFrame(tick);
    }, 400);

    return () => {
      clearTimeout(startDelay);
      cancelAnimationFrame(rafId);
    };
  }, [camReady, currentStep]);

  const handleCapture = useCallback(() => {
    if (quality !== "good") return;

    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

      // Flash effect
      setFlashVisible(true);
      setTimeout(() => setFlashVisible(false), 300);

      // "Captured" toast
      setCapturedLabel(VIEWS[currentStep]?.label ?? "Image");
      setTimeout(() => setCapturedLabel(null), 1500);

      setCapturedImages(prev => [...prev, dataUrl]);
      setCurrentStep(prev => prev + 1);
    }
  }, [quality, currentStep]);

  // Notify server when all steps complete
  useEffect(() => {
    if (currentStep !== 5) return;

    const notifyServer = async () => {
      setNotifyStatus("sending");
      const scanId = completedScanId ?? `scan-${Date.now()}`;
      if (!completedScanId) {
        setCompletedScanId(scanId);
      }
      try {
        const response = await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanId,
            status: "completed",
            userId: "example-user-id",
          }),
        });
        const data = await response.json();
        console.log("Notification API Response:", data);
        setNotifyStatus(data.ok ? "success" : "error");
      } catch (err) {
        console.error("Failed to notify server:", err);
        setNotifyStatus("error");
      }
    };
    notifyServer();
  }, [currentStep]);

  const qualityLabel =
    quality === "good"
      ? "Great position — hold steady"
      : quality === "adjusting"
        ? "Center your mouth in the guide"
        : quality === "too-close"
          ? "Move slightly back"
          : "Move a little closer";

  const progress = Math.round((currentStep / 5) * 100);

  return (
    <div className="flex flex-col items-center bg-black min-h-screen text-white">
      {/* Header */}
      <div className="p-4 w-full bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
        <h1 className="font-bold text-blue-400">DentalScan AI</h1>
        <span className="text-xs text-zinc-500">
          Step {Math.min(currentStep + 1, 5)} / 5
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md h-1 bg-zinc-800">
        <div
          className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main Viewport */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-zinc-950 overflow-hidden flex items-center justify-center">
        {currentStep < 5 ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover grayscale opacity-80"
            />

            {/* Capture flash */}
            <CaptureFlash visible={flashVisible} />

            {/* Mouth Guide Overlay */}
            <MouthGuideOverlay
              quality={quality}
              label={qualityLabel}
              viewLabel={VIEWS[currentStep].label}
            />

            {/* "Captured!" toast */}
            {capturedLabel && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-emerald-500/90 px-4 py-2 text-xs font-semibold backdrop-blur-sm animate-[fadeSlideUp_1.5s_ease-out_forwards]">
                <CheckCircle2 size={14} />
                {capturedLabel} captured
              </div>
            )}

            {/* Instruction Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-black via-black/60 to-transparent text-center">
              <p className="text-sm font-medium">
                {VIEWS[currentStep].instruction}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                {quality === "good"
                  ? "Tap the button to capture"
                  : "Adjusting…"}
              </p>
            </div>
          </>
        ) : (
          <div className="text-center p-10 space-y-4">
            {notifyStatus === "sending" && (
              <>
                <Loader2
                  size={48}
                  className="text-blue-400 mx-auto animate-spin"
                />
                <h2 className="text-xl font-bold">Processing…</h2>
                <p className="text-zinc-400 text-sm">
                  Uploading your scan results
                </p>
              </>
            )}
            {notifyStatus === "success" && (
              <>
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
                <h2 className="text-xl font-bold">Scan Complete</h2>
                <p className="text-zinc-400 text-sm">
                  Your dental scan has been submitted and is ready for review.
                </p>
                <button
                  onClick={() => setSidebarOpen(true)}
                  disabled={!completedScanId}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 px-5 py-2.5 text-sm font-medium transition-colors">
                  <MessageSquare size={14} /> Message Your Clinic
                </button>
              </>
            )}
            {notifyStatus === "error" && (
              <>
                <AlertCircle size={48} className="text-rose-400 mx-auto" />
                <h2 className="text-xl font-bold">Upload Failed</h2>
                <p className="text-zinc-400 text-sm">
                  Something went wrong. Please try again.
                </p>
                <button
                  onClick={() => {
                    setCurrentStep(0);
                    setCapturedImages([]);
                    setNotifyStatus("idle");
                    setCompletedScanId(null);
                    setSidebarOpen(false);
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-zinc-800 px-5 py-2 text-sm font-medium hover:bg-zinc-700 transition-colors">
                  <RefreshCw size={14} /> Retry Scan
                </button>
              </>
            )}
            {notifyStatus === "idle" && (
              <>
                <Loader2
                  size={48}
                  className="text-blue-400 mx-auto animate-spin"
                />
                <p className="text-zinc-400 text-sm">Preparing…</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-10 w-full flex justify-center">
        {currentStep < 5 && (
          <button
            onClick={handleCapture}
            disabled={quality !== "good"}
            className={`w-20 h-20 rounded-full border-4 flex items-center justify-center active:scale-90 transition-all duration-200 ${
              quality === "good"
                ? "border-white shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                : "border-zinc-600 opacity-60"
            }`}>
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
              <Camera className="text-black" />
            </div>
          </button>
        )}
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 p-4 overflow-x-auto w-full justify-center">
        {VIEWS.map((v, i) => (
          <div
            key={i}
            className={`relative w-16 h-20 rounded-lg border-2 shrink-0 overflow-hidden transition-all duration-300 ${
              i === currentStep
                ? "border-blue-500 bg-blue-500/10 scale-105"
                : capturedImages[i]
                  ? "border-emerald-500/50"
                  : "border-zinc-800"
            }`}>
            {capturedImages[i] ? (
              <>
                <img
                  src={capturedImages[i]}
                  alt={v.label}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-center py-0.5">
                  <CheckCircle2 size={10} className="inline text-emerald-400" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-700">
                <span className="text-[10px]">{i + 1}</span>
                <span className="text-[8px] text-zinc-600">{v.label}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick-Message Sidebar */}
      <QuickMessageSidebar
        scanId={completedScanId}
        patientId="example-user-id"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}
