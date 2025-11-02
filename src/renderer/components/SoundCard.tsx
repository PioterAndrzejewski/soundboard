import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Sound } from '../../shared/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSelectedSound, openSettingsModal, startMidiListening } from '../store/uiSlice';
import { SoundManager } from '../soundManager';

interface SoundCardProps {
  sound: Sound;
  onRemove: (soundId: string) => void;
  soundManager: SoundManager | null;
}

const SoundCard: React.FC<SoundCardProps> = ({ sound, onRemove, soundManager }) => {
  const dispatch = useAppDispatch();
  const ui = useAppSelector(state => state.ui);
  const [isHighlighted, setIsHighlighted] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sound.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Watch for MIDI triggers
  useEffect(() => {
    if (ui.lastTriggeredSoundId === sound.id && ui.lastTriggeredSoundTimestamp > 0) {
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 500);
      return () => clearTimeout(timer);
    }
  }, [ui.lastTriggeredSoundId, ui.lastTriggeredSoundTimestamp, sound.id]);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager?.playSound(sound.id).catch(console.error);
  };

  const handleMidiAssign = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setSelectedSound(sound.id));
    dispatch(startMidiListening('sound'));
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setSelectedSound(sound.id));
    dispatch(openSettingsModal());
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete sound "${sound.name}"?`)) {
      onRemove(sound.id);
    }
  };

  const mappingText = sound.midiMapping
    ? `${sound.midiMapping.deviceName}: Ch${sound.midiMapping.channel + 1} Note${sound.midiMapping.note}`
    : 'none';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`bg-dark-600 rounded-lg p-3 border-2 transition-all min-w-[200px] ${
        isHighlighted
          ? 'border-green-500 ring-4 ring-green-500 ring-opacity-50 scale-105'
          : 'border-transparent hover:border-blue-600'
      }`}
    >
      <div className="mb-2 cursor-move" {...listeners}>
        <h3 className="font-semibold text-sm mb-1 truncate">{sound.name}</h3>
        <div className="text-xs text-dark-200">
          <div>Mode: {sound.settings.playMode}</div>
          <div>Volume: {Math.round(sound.settings.volume * 100)}%</div>
        </div>
        <div className={`mt-1.5 px-2 py-0.5 bg-dark-800 rounded text-xs truncate ${
          sound.midiMapping ? 'text-green-400' : 'text-dark-400'
        }`}>
          {mappingText}
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        <button
          onClick={handlePlay}
          className="flex-1 min-w-[50px] px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium transition-colors"
        >
          ▶ Play
        </button>
        <button
          onClick={handleMidiAssign}
          className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs transition-colors"
          title="Assign MIDI key"
        >
          🎹
        </button>
        <button
          onClick={handleEdit}
          className="px-2 py-1 bg-dark-500 hover:bg-dark-400 rounded text-xs transition-colors"
          title="Edit settings"
        >
          ⚙️
        </button>
        <button
          onClick={handleDelete}
          className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs transition-colors"
          title="Delete sound"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default SoundCard;
