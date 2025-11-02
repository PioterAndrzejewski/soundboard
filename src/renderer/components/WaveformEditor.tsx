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
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<Array<{ min: number; max: number }>>(
    []
  );
  const [audioDuration, setAudioDuration] = useState<number>(
    Number.isFinite(duration) && duration > 0 ? duration : 0
  );
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  // ---- Load audio duration and generate placeholder waveform immediately ----
  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;

    // Generate a nice-looking placeholder waveform immediately (no blocking)
    const generatePlaceholder = () => {
      const buckets = 500;
      const fake: Array<{ min: number; max: number }> = new Array(buckets);
      for (let i = 0; i < buckets; i++) {
        const t = i / (buckets - 1);
        const env = Math.sin(Math.PI * t); // Envelope shape
        const wobble = Math.sin(t * 40 + i * 0.5) * 0.2; // Some variation
        const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1 * 0.15; // Pseudo-random
        const amp = Math.max(0, env * 0.6 + wobble + noise);
        fake[i] = { min: -amp, max: amp };
      }
      return fake;
    };

    // Set placeholder immediately
    setWaveform(generatePlaceholder());

    // Load duration using HTML Audio (fast and doesn't crash)
    (async () => {
      try {
        const audio = new Audio();
        audio.src = toFileURL(filePath);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
          audio.addEventListener("loadedmetadata", () => {
            clearTimeout(timeout);
            resolve();
          });
          audio.addEventListener("error", () => {
            clearTimeout(timeout);
            reject(new Error("Failed to load audio"));
          });
        });

        if (cancelled) return;

        if (audio.duration && Number.isFinite(audio.duration)) {
          setAudioDuration(audio.duration);
          console.log(`✅ Audio duration loaded: ${audio.duration}s`);
        }
      } catch (err) {
        console.warn("Could not load audio duration:", err);
        // Keep placeholder waveform and use provided duration prop
        if (duration > 0) {
          setAudioDuration(duration);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath, duration]);

  // ---- Drawing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveform.length === 0) return;

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

    // Clear
    ctx.fillStyle = "#1f2937"; // gray-800
    ctx.fillRect(0, 0, width, hCss);

    // Guard duration
    const dur =
      audioDuration > 0 && Number.isFinite(audioDuration) ? audioDuration : 0;
    const sx = dur > 0 ? (startTime / dur) * width : 0;
    const ex = dur > 0 ? (Math.max(endTime, startTime) / dur) * width : width;

    // Draw waveform as vertical min/max lines
    const mid = hCss / 2;
    const barW = width / waveform.length;
    for (let i = 0; i < waveform.length; i++) {
      const { min, max } = waveform[i];
      const x = i * barW + 0.5;
      const inRegion = x >= sx && x <= (endTime > 0 ? ex : width);

      ctx.strokeStyle = inRegion ? "#3b82f6" : "#4b5563"; // blue-500 / gray-600
      ctx.lineWidth = Math.max(1, barW - 1);

      const y1 = mid + min * (mid - 2);
      const y2 = mid + max * (mid - 2);

      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }

    // Start marker
    if (dur > 0) {
      ctx.fillStyle = "#10b981"; // green-500
      ctx.fillRect(sx - 2, 0, 4, hCss);
      ctx.fillRect(sx - 8, 0, 16, 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial";
      ctx.fillText("S", sx - 3, 13);

      // End marker (if specified, else at end)
      const endX = endTime > 0 ? ex : width;
      ctx.fillStyle = "#ef4444"; // red-500
      ctx.fillRect(endX - 2, 0, 4, hCss);
      ctx.fillRect(endX - 8, 0, 16, 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial";
      ctx.fillText("E", endX - 3, 13);
    }
  }, [waveform, startTime, endTime, audioDuration, height]);

  // ---- Drag handlers ----
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width || canvas.width;

    const dur = audioDuration || 0;
    if (dur <= 0) return;

    const sx = (startTime / dur) * width;
    const ex = (Math.max(endTime, startTime) / dur) * width;
    if (Math.abs(x - sx) < 10) setDragging("start");
    else if (Math.abs(x - ex) < 10) setDragging("end");
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
      const newStart = Math.max(
        0,
        Math.min(t, (endTime > 0 ? endTime : dur) - 0.05)
      );
      onStartTimeChange(Number.isFinite(newStart) ? newStart : 0);
    } else if (dragging === "end") {
      const minEnd = Math.min(dur, Math.max(startTime + 0.05, 0));
      const newEnd = Math.max(minEnd, Math.min(t, dur));
      onEndTimeChange(Number.isFinite(newEnd) ? newEnd : minEnd);
    }
  };

  const onMouseUp = () => setDragging(null);
  const onMouseLeave = () => setDragging(null);

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
