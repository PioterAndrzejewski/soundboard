import React, { useRef, useEffect, useState } from 'react';

interface WaveformEditorProps {
  filePath: string;
  startTime: number;
  endTime: number;
  duration: number;
  onStartTimeChange: (time: number) => void;
  onEndTimeChange: (time: number) => void;
}

const WaveformEditor: React.FC<WaveformEditorProps> = ({
  filePath,
  startTime,
  endTime,
  duration,
  onStartTimeChange,
  onEndTimeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<Array<{ min: number; max: number }>>([]);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [audioDuration, setAudioDuration] = useState(duration);

  // Load audio file to get duration (no waveform visualization)
  useEffect(() => {
    const loadAudio = async () => {
      try {
        console.log('Loading audio for:', filePath);

        // Create a simple audio element to get duration
        const audio = new Audio();

        // Normalize file path for file:// URL
        const normalizedPath = filePath.replace(/\\/g, '/');
        const fileUrl = /^[A-Za-z]:\//.test(normalizedPath)
          ? `file:///${normalizedPath}`
          : `file://${normalizedPath}`;

        audio.src = fileUrl;

        // Wait for metadata to load
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => resolve());
          audio.addEventListener('error', () => reject(new Error('Failed to load audio')));
        });

        setAudioDuration(audio.duration);
        console.log('Audio loaded, duration:', audio.duration, 'seconds');

        // Create simple placeholder waveform (bars of equal height)
        const buckets = 500;
        const peaks = [];
        for (let i = 0; i < buckets; i++) {
          // Create a simple wave pattern
          peaks.push({ min: -0.5, max: 0.5 });
        }
        setWaveformData(peaks);
      } catch (error) {
        console.error('Failed to load audio:', error);
      }
    };

    if (filePath) {
      loadAudio();
    }
  }, [filePath]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / waveformData.length;

    // Clear canvas
    ctx.fillStyle = '#1f2937'; // dark-800
    ctx.fillRect(0, 0, width, height);

    // Calculate marker positions
    const startX = (startTime / audioDuration) * width;
    const endX = endTime > 0 ? (endTime / audioDuration) * width : width;

    // Draw waveform using min/max peaks
    const mid = height / 2;
    waveformData.forEach((peak, index) => {
      const x = index * barWidth + 0.5;

      // Highlight region between start and end
      const isInRegion = x >= startX && x <= endX;
      ctx.strokeStyle = isInRegion ? '#3b82f6' : '#4b5563'; // blue-500 : gray-600
      ctx.lineWidth = Math.max(1, barWidth - 1);

      // Draw vertical line from min to max
      const minY = mid + peak.min * mid;
      const maxY = mid + peak.max * mid;

      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
      ctx.stroke();
    });

    // Draw start marker
    ctx.fillStyle = '#10b981'; // green-500
    ctx.fillRect(startX - 2, 0, 4, height);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(startX - 8, 0, 16, 20);
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText('S', startX - 3, 13);

    // Draw end marker
    if (endTime > 0) {
      ctx.fillStyle = '#ef4444'; // red-500
      ctx.fillRect(endX - 2, 0, 4, height);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(endX - 8, 0, 16, 20);
      ctx.fillStyle = 'white';
      ctx.fillText('E', endX - 3, 13);
    }
  }, [waveformData, startTime, endTime, audioDuration]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.width;

    const startX = (startTime / audioDuration) * width;
    const endX = endTime > 0 ? (endTime / audioDuration) * width : width;

    // Check if clicking near start or end marker
    if (Math.abs(x - startX) < 10) {
      setIsDraggingStart(true);
    } else if (endTime > 0 && Math.abs(x - endX) < 10) {
      setIsDraggingEnd(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || (!isDraggingStart && !isDraggingEnd)) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.width;
    const time = (x / width) * audioDuration;

    if (isDraggingStart) {
      const newStartTime = Math.max(0, Math.min(time, endTime > 0 ? endTime - 0.1 : audioDuration));
      onStartTimeChange(newStartTime);
    } else if (isDraggingEnd) {
      const newEndTime = Math.max(startTime + 0.1, Math.min(time, audioDuration));
      onEndTimeChange(newEndTime);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
  };

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        width={800}
        height={120}
        className="w-full border border-dark-500 rounded cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="flex justify-between text-xs text-dark-300 mt-1">
        <span>0:00</span>
        <span>{audioDuration.toFixed(2)}s</span>
      </div>
    </div>
  );
};

export default WaveformEditor;
