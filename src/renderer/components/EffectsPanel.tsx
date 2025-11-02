import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';

type EffectKnobType = 'pitch' | 'filterLow' | 'filterMid' | 'filterHigh' | 'filterResonance' | 'distortion' | 'reverb' | 'delay';

interface EffectKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  unit?: string;
  onChange: (value: number) => void;
  onStartMapping?: () => void;
  isMappingMode: boolean;
  isBeingMapped: boolean;
  hasMidiMapping: boolean;
}

const EffectKnob: React.FC<EffectKnobProps> = ({
  label,
  value,
  min,
  max,
  defaultValue,
  unit = '',
  onChange,
  onStartMapping,
  isMappingMode,
  isBeingMapped,
  hasMidiMapping,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);

  const normalizedValue = (value - min) / (max - min);
  const angle = -135 + normalizedValue * 270; // -135deg to +135deg

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMappingMode && onStartMapping) {
      onStartMapping();
      return;
    }

    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = value;
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = dragStartY.current - e.clientY;
    const sensitivity = (max - min) / 200; // 200px for full range
    const newValue = Math.max(min, Math.min(max, dragStartValue.current + deltaY * sensitivity));

    onChange(newValue);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (!isMappingMode) {
      onChange(defaultValue);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const displayValue = unit === 'st'
    ? (value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1))
    : value.toFixed(2);

  return (
    <div className={`flex flex-col items-center gap-2 ${isMappingMode ? 'cursor-pointer' : ''}`}>
      {/* Knob container */}
      <div
        className={`relative w-16 h-16 rounded-full bg-dark-700 border-2 transition-all ${
          isBeingMapped
            ? 'border-green-500 animate-pulse'
            : isMappingMode
            ? 'border-purple-500'
            : 'border-dark-500'
        } ${isDragging ? 'ring-2 ring-blue-500' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: isMappingMode ? 'pointer' : 'ns-resize' }}
      >
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-dark-300 rounded-full" />
        </div>

        {/* Indicator line */}
        <div
          className="absolute top-1/2 left-1/2 origin-left transition-transform"
          style={{
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            width: '50%',
            height: '2px',
          }}
        >
          <div className="absolute right-0 w-6 h-0.5 bg-blue-400 rounded-full" />
        </div>

        {/* MIDI indicator */}
        {hasMidiMapping && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-xs">
            🎹
          </div>
        )}
      </div>

      {/* Label and value */}
      <div className="text-center">
        <div className="text-xs text-dark-200 font-medium">{label}</div>
        <div className="text-xs text-dark-400 font-mono">
          {displayValue}{unit}
        </div>
      </div>
    </div>
  );
};

interface EffectsPanelProps {
  onEffectChange: (effect: EffectKnobType, value: number) => void;
  onStartMapping?: (effect: EffectKnobType) => void;
}

const EffectsPanel: React.FC<EffectsPanelProps> = ({ onEffectChange, onStartMapping }) => {
  const dispatch = useAppDispatch();
  const effects = useAppSelector(state => state.settings.effects);
  const effectsMappings = useAppSelector(state => state.settings.effectsMidiMappings);
  const ui = useAppSelector(state => state.ui);

  const isMappingMode = ui.isMidiMappingMode;
  const mappingTarget = ui.mappingTarget as EffectKnobType | null;

  const knobs: Array<{
    key: EffectKnobType;
    label: string;
    min: number;
    max: number;
    defaultValue: number;
    unit?: string;
  }> = [
    { key: 'pitch', label: 'Pitch', min: -12, max: 12, defaultValue: 0, unit: 'st' },
    { key: 'filterLow', label: 'Low', min: 0, max: 1, defaultValue: 1 },
    { key: 'filterMid', label: 'Mid', min: 0, max: 1, defaultValue: 1 },
    { key: 'filterHigh', label: 'High', min: 0, max: 1, defaultValue: 1 },
    { key: 'filterResonance', label: 'Resonance', min: 0, max: 1, defaultValue: 0 },
    { key: 'distortion', label: 'Distortion', min: 0, max: 1, defaultValue: 0 },
    { key: 'reverb', label: 'Reverb', min: 0, max: 1, defaultValue: 0 },
    { key: 'delay', label: 'Delay', min: 0, max: 1, defaultValue: 0 },
  ];

  return (
    <div className="w-full bg-dark-800 border-t-2 border-dark-600">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-dark-200 uppercase">Global Effects</h3>
          {isMappingMode && (
            <div className="text-xs text-purple-400 flex items-center gap-2">
              <span className="animate-pulse">🎹</span>
              <span>MIDI Mapping Mode - Click knob to assign</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          {knobs.map((knob) => (
            <EffectKnob
              key={knob.key}
              label={knob.label}
              value={effects?.[knob.key] ?? knob.defaultValue}
              min={knob.min}
              max={knob.max}
              defaultValue={knob.defaultValue}
              unit={knob.unit}
              onChange={(value) => onEffectChange(knob.key, value)}
              onStartMapping={onStartMapping ? () => onStartMapping(knob.key) : undefined}
              isMappingMode={isMappingMode}
              isBeingMapped={mappingTarget === knob.key}
              hasMidiMapping={!!(effectsMappings?.[knob.key])}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default EffectsPanel;
