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
  const [waveform, setWaveform] = useState<Array<{ min: number; max: number }>>(
    []
  );
  const [audioDuration, setAudioDuration] = useState<number>(
    Number.isFinite(duration) && duration > 0 ? duration : 0
  );
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ---- Load REAL waveform from audio file ----
  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    let audioElement: HTMLAudioElement | null = null;

    const generatePlaceholder = () => {
      const buckets = 500;
      const fake: Array<{ min: number; max: number }> = new Array(buckets);
      for (let i = 0; i < buckets; i++) {
        const t = i / (buckets - 1);
        const env = Math.sin(Math.PI * t);
        const wobble = Math.sin(t * 40 + i * 0.5) * 0.2;
        const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1 * 0.15;
        const amp = Math.max(0, env * 0.6 + wobble + noise);
        fake[i] = { min: -amp, max: amp };
      }
      return fake;
    };

    // Show placeholder immediately
    setWaveform(generatePlaceholder());
    setIsLoadingWaveform(true);

    (async () => {
      try {
        // Step 1: Get duration quickly
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
        }

        // Step 2: Load real waveform using Web Audio API (with safety measures)
        console.log("Loading real waveform...");

        const response = await fetch(toFileURL(filePath));
        if (!response.ok) throw new Error("Fetch failed");

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        // Use OfflineAudioContext for better performance
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          if (cancelled) {
            audioContext.close();
            return;
          }

          // Extract peaks with aggressive downsampling to prevent crashes
          const channelData = audioBuffer.getChannelData(0);
          const samples = channelData.length;
          const buckets = 500;
          const samplesPerBucket = Math.floor(samples / buckets);
          const peaks: Array<{ min: number; max: number }> = [];

          // Process in chunks to avoid blocking
          for (let i = 0; i < buckets; i++) {
            const start = i * samplesPerBucket;
            const end = Math.min(start + samplesPerBucket, samples);
            let min = 1;
            let max = -1;

            // Sample aggressively - only every 64th sample
            for (let j = start; j < end; j += 64) {
              const value = channelData[j] || 0;
              if (value < min) min = value;
              if (value > max) max = value;
            }

            if (!Number.isFinite(min)) min = 0;
            if (!Number.isFinite(max)) max = 0;
            peaks.push({ min, max });

            // Yield every 100 buckets
            if (i % 100 === 0) {
              await new Promise(resolve => setTimeout(resolve, 0));
              if (cancelled) {
                audioContext.close();
                return;
              }
            }
          }

          audioContext.close();

          if (!cancelled) {
            setWaveform(peaks);
            setIsLoadingWaveform(false);
            console.log(`✅ Real waveform loaded: ${peaks.length} points`);
          }

        } catch (decodeError) {
          console.error("Failed to decode audio:", decodeError);
          audioContext.close();
          setIsLoadingWaveform(false);
        }

      } catch (err) {
        console.warn("Waveform loading failed:", err);
        if (duration > 0) setAudioDuration(duration);
        setIsLoadingWaveform(false);
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

    // Playback position indicator
    if (isPlaying && dur > 0 && currentTime > 0) {
      const playX = (currentTime / dur) * width;
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.fillRect(playX - 1, 0, 2, hCss);
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
      const actualEndTime = endTime > 0 && endTime > startTime ? endTime : dur;
      const endX = (actualEndTime / dur) * width;
      ctx.fillStyle = "#ef4444"; // red-500
      ctx.fillRect(endX - 2, 0, 4, hCss);
      ctx.fillRect(endX - 8, 0, 16, 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial";
      ctx.fillText("E", endX - 3, 13);
    }
  }, [waveform, startTime, endTime, audioDuration, height, isPlaying, currentTime]);

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
