import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { Sound } from '../../shared/types';
import SoundCard from './SoundCard';
import { useAppDispatch } from '../store/hooks';
import { reorderSounds } from '../store/soundsSlice';
import { setDirty } from '../store/uiSlice';
import { SoundManager } from '../soundManager';

interface SoundsGridProps {
  sounds: Sound[];
  onRemove: (soundId: string) => void;
  soundManager: SoundManager | null;
}

const SoundsGrid: React.FC<SoundsGridProps> = ({ sounds, onRemove, soundManager }) => {
  const dispatch = useAppDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sounds.findIndex(s => s.id === active.id);
      const newIndex = sounds.findIndex(s => s.id === over.id);

      const newSounds = [...sounds];
      const [movedSound] = newSounds.splice(oldIndex, 1);
      newSounds.splice(newIndex, 0, movedSound);

      // Update order property
      const reorderedSounds = newSounds.map((sound, index) => ({
        ...sound,
        order: index,
      }));

      dispatch(reorderSounds(reorderedSounds));
      dispatch(setDirty(true));
    }
  };

  const sortedSounds = [...sounds].sort((a, b) => a.order - b.order);

  if (sounds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-dark-300">
          <p className="text-lg mb-2">No sounds added yet</p>
          <p className="text-sm">Click "Add Sound" to get started</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedSounds.map(s => s.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedSounds.map(sound => (
            <SoundCard
              key={sound.id}
              sound={sound}
              onRemove={onRemove}
              soundManager={soundManager}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default SoundsGrid;
