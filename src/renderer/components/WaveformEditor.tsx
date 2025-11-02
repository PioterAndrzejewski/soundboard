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

  // Load audio file and generate real waveform
  useEffect(() => {
    const loadAudio = async () => {
      try {
        console.log('Loading audio for:', filePath);

        // Read the audio file as ArrayBuffer using Electron IPC
        const buffer = await window.electronAPI.readAudioFile(filePath);
        console.log('File loaded via IPC, buffer type:', buffer.constructor.name);

        // Convert to proper ArrayBuffer if needed
        let arrayBuffer: ArrayBuffer;
        if (buffer instanceof ArrayBuffer) {
          arrayBuffer = buffer;
        } else if (buffer.buffer instanceof ArrayBuffer) {
          // Handle Node.js Buffer (has .buffer property)
          arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        } else {
          throw new Error('Invalid buffer type received');
        }

        console.log('ArrayBuffer size:', arrayBuffer.byteLength);

        // Decode audio using Web Audio API
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        setAudioDuration(audioBuffer.duration);
        console.log('Audio decoded, duration:', audioBuffer.duration, 'seconds');

        // Extract waveform data
        const channelData = audioBuffer.getChannelData(0);
        const samples = audioBuffer.length;
        const buckets = 500;
        const blockSize = Math.floor(samples / buckets);
        const peaks = [];

        for (let i = 0; i < buckets; i++) {
          const start = i * blockSize;
          const end = Math.min(start + blockSize, samples);
          let min = 1;
          let max = -1;

          for (let j = start; j < end; j++) {
            const value = channelData[j];
            if (value < min) min = value;
            if (value > max) max = value;
          }

          peaks.push({ min, max });
        }

        setWaveformData(peaks);
        audioContext.close();

        console.log('✅ Real waveform generated with', peaks.length, 'data points');
      } catch (error) {
        console.error('Failed to load audio:', error);

        // Fallback: Load duration with HTML Audio and create placeholder waveform
        try {
          const audio = new Audio();
          const normalizedPath = filePath.replace(/\\/g, '/');
          const fileUrl = /^[A-Za-z]:\//.test(normalizedPath)
            ? `file:///${normalizedPath}`
            : `file://${normalizedPath}`;
          audio.src = fileUrl;

          await new Promise<void>((resolve, reject) => {
            audio.addEventListener('loadedmetadata', () => resolve());
            audio.addEventListener('error', () => reject(new Error('Failed to load audio')));
          });

          setAudioDuration(audio.duration);

          // Create placeholder waveform
          const buckets = 500;
          const peaks = [];
          for (let i = 0; i < buckets; i++) {
            const position = i / buckets;
            const envelope = Math.sin(position * Math.PI);
            const variation = Math.sin(position * 50 + i) * 0.3;
            const random = (Math.sin(i * 12.9898) * 43758.5453) % 1;
            const amplitude = (envelope * 0.6 + variation + random * 0.3) * 0.7;
            peaks.push({ min: -Math.abs(amplitude), max: Math.abs(amplitude) });
          }
          setWaveformData(peaks);

          console.log('⚠️ Using placeholder waveform (real waveform failed)');
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
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
    ctx.font = 'bold 10px Arial';
    ctx.fillText('S', startX - 3, 13);

    // Draw end marker (always show, at end if not set)
    const actualEndX = endTime > 0 ? endX : width;
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.fillRect(actualEndX - 2, 0, 4, height);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(actualEndX - 8, 0, 16, 20);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('E', actualEndX - 3, 13);
  }, [waveformData, startTime, endTime, audioDuration]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.width;

    const startX = (startTime / audioDuration) * width;
    const endX = endTime > 0 ? (endTime / audioDuration) * width : width;

    // Check if clicking near start or end marker (always allow end marker dragging)
    if (Math.abs(x - startX) < 10) {
      setIsDraggingStart(true);
    } else if (Math.abs(x - endX) < 10) {
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
