import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Sound } from '../../shared/types';
import { useAppDispatch } from '../store/hooks';
import { setSelectedSound, openSettingsModal } from '../store/uiSlice';
import { SoundManager } from '../soundManager';

interface SoundCardProps {
  sound: Sound;
  onRemove: (soundId: string) => void;
  soundManager: SoundManager | null;
}

const SoundCard: React.FC<SoundCardProps> = ({ sound, onRemove, soundManager }) => {
  const dispatch = useAppDispatch();

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

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager?.playSound(sound.id).catch(console.error);
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
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-dark-600 rounded-lg p-4 border-2 border-transparent hover:border-blue-600 transition-all"
    >
      <div className="mb-3 cursor-move" {...listeners}>
        <h3 className="font-semibold text-base mb-1 truncate">{sound.name}</h3>
        <div className="text-xs text-dark-200">
          <div>Mode: {sound.settings.playMode}</div>
          <div>Volume: {Math.round(sound.settings.volume * 100)}%</div>
        </div>
        {mappingText && (
          <div className="mt-2 px-2 py-1 bg-dark-800 rounded text-xs text-green-400 truncate">
            {mappingText}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handlePlay}
          className="flex-1 min-w-[70px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
        >
          ▶ Play
        </button>
        <button
          onClick={handleEdit}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm transition-colors"
        >
          🎹 MIDI
        </button>
        <button
          onClick={handleEdit}
          className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors"
        >
          ⚙️ Edit
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default SoundCard;
