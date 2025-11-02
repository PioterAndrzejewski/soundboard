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
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [audioDuration, setAudioDuration] = useState(duration);

  // Load and decode audio file to get waveform data
  useEffect(() => {
    const loadWaveform = async () => {
      try {
        console.log('Loading waveform for:', filePath);

        // Use Electron IPC to read the audio file
        const arrayBuffer = await window.electronAPI.readAudioFile(filePath);
        console.log('File loaded, size:', arrayBuffer.byteLength, 'bytes');

        // Create audio context and decode
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log('Audio decoded, duration:', audioBuffer.duration, 'seconds');

        setAudioDuration(audioBuffer.duration);

        // Merge to mono if stereo
        const ch0 = audioBuffer.getChannelData(0);
        const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

        const samples = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
          samples[i] = ch1 ? (ch0[i] + ch1[i]) / 2 : ch0[i];
        }

        // Downsample to canvas width using min/max per bucket (gives nice "peaks")
        const buckets = 500; // Number of buckets for waveform
        const blockSize = Math.floor(samples.length / buckets);
        const peaks = [];

        for (let i = 0; i < buckets; i++) {
          const start = i * blockSize;
          const end = Math.min(start + blockSize, samples.length);
          let min = 1, max = -1;
          for (let j = start; j < end; j++) {
            const s = samples[j];
            if (s < min) min = s;
            if (s > max) max = s;
          }
          peaks.push({ min, max });
        }

        setWaveformData(peaks);
        audioContext.close();
      } catch (error) {
        console.error('Failed to load waveform:', error);
      }
    };

    if (filePath) {
      loadWaveform();
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

    // Normalize waveform data
    const max = Math.max(...waveformData);

    // Calculate marker positions
    const startX = (startTime / audioDuration) * width;
    const endX = endTime > 0 ? (endTime / audioDuration) * width : width;

    // Draw waveform bars
    waveformData.forEach((value, index) => {
      const barHeight = (value / max) * height * 0.8;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      // Highlight region between start and end
      const isInRegion = x >= startX && x <= endX;
      ctx.fillStyle = isInRegion ? '#3b82f6' : '#4b5563'; // blue-500 : gray-600

      ctx.fillRect(x, y, barWidth - 1, barHeight);
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
