import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleActiveSoundsPanel } from '../store/uiSlice';
import { AudioEngine } from '../audioEngine';

interface ActiveSoundsPanelProps {
  audioEngine: AudioEngine | null;
}

const ActiveSoundsPanel: React.FC<ActiveSoundsPanelProps> = ({ audioEngine }) => {
  const dispatch = useAppDispatch();
  const ui = useAppSelector(state => state.ui);
  const sounds = useAppSelector(state => state.sounds.sounds);
  const [playingSounds, setPlayingSounds] = useState<Array<{
    playingId: string;
    soundId: string;
    soundName: string;
    currentTime: number;
    duration: number;
    playMode: string;
    isFadingOut: boolean;
  }>>([]);

  // Update playing sounds info every 100ms
  useEffect(() => {
    if (!audioEngine) return;

    const updatePlayingSounds = () => {
      const info = audioEngine.getPlayingSoundsInfo();

      // Add sound names from Redux store
      const enrichedInfo = info.map(item => {
        const sound = sounds.find(s => s.id === item.soundId);
        return {
          ...item,
          soundName: sound?.name || 'Unknown',
        };
      });

      setPlayingSounds(enrichedInfo);
    };

    updatePlayingSounds();
    const interval = setInterval(updatePlayingSounds, 100);

    return () => clearInterval(interval);
  }, [audioEngine, sounds]);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!ui.isActiveSoundsPanelOpen) {
    return (
      <button
        onClick={() => dispatch(toggleActiveSoundsPanel())}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-dark-600 hover:bg-dark-500 border-l-2 border-dark-400 px-2 py-6 rounded-l-lg transition-colors z-40"
        title="Show Active Sounds"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xl">▶</span>
          <span className="text-xs writing-mode-vertical">ACTIVE</span>
        </div>
      </button>
    );
  }

  return (
    <aside className="w-80 bg-dark-700 border-l-2 border-dark-500 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-dark-600 border-b-2 border-dark-500 px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-200 uppercase">Active Sounds</h2>
        <button
          onClick={() => dispatch(toggleActiveSoundsPanel())}
          className="text-dark-300 hover:text-dark-50 transition-colors"
          title="Hide Panel"
        >
          ✕
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {playingSounds.length === 0 ? (
          <div className="text-center text-dark-300 text-sm py-8">
            No sounds currently playing
          </div>
        ) : (
          <div className="space-y-3">
            {playingSounds.map((sound) => (
              <div
                key={sound.playingId}
                className="bg-dark-600 rounded-lg p-3 border border-dark-500 transition-opacity duration-300"
                style={{ opacity: sound.isFadingOut ? 0.3 : 1 }}
              >
                {/* Sound name and mode */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-dark-50 truncate">
                    {sound.soundName}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    sound.playMode === 'gate'
                      ? 'bg-blue-900 text-blue-300'
                      : 'bg-green-900 text-green-300'
                  }`}>
                    {sound.playMode === 'gate' ? 'GATE' : 'TRIGGER'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="w-full bg-dark-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-100"
                      style={{
                        width: sound.duration > 0
                          ? `${(sound.currentTime / sound.duration) * 100}%`
                          : '0%'
                      }}
                    />
                  </div>
                </div>

                {/* Time display */}
                <div className="flex justify-between text-xs text-dark-300">
                  <span>{formatTime(sound.currentTime)}</span>
                  <span>{formatTime(sound.duration)}</span>
                </div>

                {/* Fading indicator */}
                {sound.isFadingOut && (
                  <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                    <span className="animate-pulse">⏳</span>
                    <span>Fading out...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default ActiveSoundsPanel;
