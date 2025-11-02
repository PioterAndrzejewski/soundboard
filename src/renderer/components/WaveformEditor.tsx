// WaveformEditor.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

interface WaveformEditorProps {
  filePath: string; // absolute path to audio file
  startTime: number; // seconds
  endTime: number; // seconds (0 or <= start => treated as "to end")
  duration: number; // optional initial duration (can be 0)
  onStartTimeChange: (time: number) => void;
  onEndTimeChange: (time: number) => void;
  /** Optional CSS height (px). Canvas adapts to width automatically. Default 120. */
  height?: number;
  /** Optional: is audio currently playing? */
  isPlaying?: boolean;
  /** Optional: current playback time for visualization */
  currentTime?: number;
}

/** Small utility: robust file:// URL for display/fallback labels only. */
function toFileURL(absPath: string) {
  // Minimal conversion; not used for fetch(). Good for <audio> fallback only if needed.
  let p = absPath.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(p)) p = "/" + p; // ensure leading slash on Windows
  return `file://${p.split("/").map(encodeURIComponent).join("/")}`;
}

const WaveformEditor: React.FC<WaveformEditorProps> = ({
  filePath,
  startTime,
  endTime,
  duration,
  onStartTimeChange,
  onEndTimeChange,
  height = 120,
  isPlaying = false,
  currentTime = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioDuration, setAudioDuration] = useState<number>(
    Number.isFinite(duration) && duration > 0 ? duration : 0
  );
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ---- Load audio duration only (no waveform generation) ----
  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    let audioElement: HTMLAudioElement | null = null;

    (async () => {
      try {
        audioElement = new Audio();
        audioElement.src = toFileURL(filePath);
        audioElement.preload = 'metadata';

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
          audioElement!.addEventListener("loadedmetadata", () => {
            clearTimeout(timeout);
            resolve();
          });
          audioElement!.addEventListener("error", () => {
            clearTimeout(timeout);
            reject(new Error("Failed to load"));
          });
        });

        if (cancelled) return;

        const dur = audioElement.duration && Number.isFinite(audioElement.duration)
          ? audioElement.duration
          : duration;

        if (dur > 0) {
          setAudioDuration(dur);
          console.log(`✅ Audio duration loaded: ${dur}s`);
        }

      } catch (err) {
        console.warn("Failed to load audio duration:", err);
        if (duration > 0) setAudioDuration(duration);
      }
    })();

    return () => {
      cancelled = true;
      if (audioElement) {
        audioElement.src = '';
        audioElement = null;
      }
    };
  }, [filePath, duration]);

  // ---- Drawing simple timeline (no waveform) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize to CSS size * devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 800;
    const cssHeight = canvas.clientHeight || height;
    const w = Math.max(1, Math.floor(cssWidth * dpr));
    const h = Math.max(1, Math.floor(cssHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels

    const width = cssWidth;
    const hCss = cssHeight;

    // Clear background
    ctx.fillStyle = "#1f2937"; // gray-800
    ctx.fillRect(0, 0, width, hCss);

    // Guard duration
    const dur =
      audioDuration > 0 && Number.isFinite(audioDuration) ? audioDuration : 0;

    if (dur > 0) {
      const sx = (startTime / dur) * width;
      const actualEndTime = endTime > 0 && endTime > startTime ? endTime : dur;
      const ex = (actualEndTime / dur) * width;

      // Draw timeline base (full width)
      ctx.fillStyle = "#4b5563"; // gray-600
      ctx.fillRect(0, hCss / 2 - 2, width, 4);

      // Draw selected region (between start and end)
      ctx.fillStyle = "#3b82f6"; // blue-500
      ctx.fillRect(sx, hCss / 2 - 2, ex - sx, 4);

      // Playback position indicator
      if (isPlaying && currentTime > 0) {
        const playX = (currentTime / dur) * width;
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillRect(playX - 1, 0, 2, hCss);
      }

      // Start marker (green)
      ctx.fillStyle = "#10b981"; // green-500
      ctx.fillRect(sx - 2, 0, 4, hCss);
      ctx.fillRect(sx - 8, 0, 16, 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial";
      ctx.fillText("S", sx - 3, 13);

      // End marker (red)
      ctx.fillStyle = "#ef4444"; // red-500
      ctx.fillRect(ex - 2, 0, 4, hCss);
      ctx.fillRect(ex - 8, 0, 16, 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial";
      ctx.fillText("E", ex - 3, 13);
    }
  }, [startTime, endTime, audioDuration, height, isPlaying, currentTime]);

  // Audio preview helper
  const playPreview = (time: number) => {
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.src = toFileURL(filePath);
      previewAudioRef.current.volume = 0.5;
    }

    const audio = previewAudioRef.current;
    audio.currentTime = Math.max(0, time);
    audio.play().catch(err => console.warn("Preview playback failed:", err));
  };

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
  };

  // Cleanup preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
        previewAudioRef.current = null;
      }
    };
  }, []);

  // ---- Drag handlers with audio preview ----
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width || canvas.width;

    const dur = audioDuration || 0;
    if (dur <= 0) return;

    const sx = (startTime / dur) * width;
    const actualEndTime = endTime > 0 && endTime > startTime ? endTime : dur;
    const ex = (actualEndTime / dur) * width;

    if (Math.abs(x - sx) < 10) {
      setDragging("start");
      playPreview(startTime);
    } else if (Math.abs(x - ex) < 10) {
      setDragging("end");
      // Play from 2 seconds before end marker
      const previewTime = Math.max(0, actualEndTime - 2);
      playPreview(previewTime);
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.width;
    const dur = audioDuration || 0;
    if (dur <= 0) return;

    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const t = (x / width) * dur;

    if (dragging === "start") {
      const actualEndTime = endTime > 0 && endTime > startTime ? endTime : dur;
      const newStart = Math.max(0, Math.min(t, actualEndTime - 0.05));
      if (Number.isFinite(newStart)) {
        onStartTimeChange(newStart);
        // Update preview playback position
        if (previewAudioRef.current) {
          previewAudioRef.current.currentTime = newStart;
        }
      }
    } else if (dragging === "end") {
      const minEnd = startTime + 0.05;
      const newEnd = Math.max(minEnd, Math.min(t, dur));
      if (Number.isFinite(newEnd)) {
        onEndTimeChange(newEnd);
        // For end marker, keep playing from offset
      }
    }
  };

  const onMouseUp = () => {
    stopPreview();
    setDragging(null);
  };

  const onMouseLeave = () => {
    stopPreview();
    setDragging(null);
  };

  // ---- Render ----
  const prettyDuration = useMemo(() => {
    const d = audioDuration || 0;
    if (!Number.isFinite(d) || d <= 0) return "—";
    return `${d.toFixed(2)}s`;
  }, [audioDuration]);

  return (
    <div className="w-full">
      <div className="w-full border border-gray-700 rounded" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer block"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0:00</span>
        <span>{prettyDuration}</span>
      </div>
    </div>
  );
};

export default WaveformEditor;
