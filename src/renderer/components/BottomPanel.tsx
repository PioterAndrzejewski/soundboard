import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMasterVolume, updateSettings, setEffectValue, setEffectMidiMapping } from '../store/settingsSlice';
import { toggleMidiMappingMode, startMappingTarget, clearMappingTarget, setDirty } from '../store/uiSlice';
import { MidiMessage, EffectsState, EffectCCMapping } from '../../shared/types';

interface BottomPanelProps {
  midiHandler: any;
}

type EffectKnobType = keyof EffectsState;

interface SmallKnobProps {
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

const SmallKnob: React.FC<SmallKnobProps> = ({
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

  // Calculate angle based on value and default position
  // For effects with default=0 (dist, reverb, delay): use standard mapping
  // For effects with default at center: remap so default appears at top (0deg)
  const normalizedDefault = (defaultValue - min) / (max - min);
  const normalizedValue = (value - min) / (max - min);

  let angle: number;

  // Check if default is at minimum (0 on normalized scale)
  if (normalizedDefault === 0) {
    // Standard mapping: min=-135deg, max=+135deg
    angle = -135 + normalizedValue * 270;
  } else {
    // Default is in the middle - remap so default is at 0deg (top center)
    // Map the normalized value range [0, 1] to angle range where default is at 0deg
    const valueRelativeToDefault = normalizedValue - normalizedDefault;
    const rangeToLeft = normalizedDefault; // Range from min to default
    const rangeToRight = 1 - normalizedDefault; // Range from default to max

    if (normalizedValue < normalizedDefault) {
      // Value is below default: map to [-135, 0]
      angle = -135 + (normalizedValue / normalizedDefault) * 135;
    } else {
      // Value is at or above default: map to [0, +135]
      angle = 0 + ((normalizedValue - normalizedDefault) / rangeToRight) * 135;
    }
  }

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
    const sensitivity = (max - min) / 200;
    let newValue = Math.max(min, Math.min(max, dragStartValue.current + deltaY * sensitivity));

    // Snap to default value when close (within 2% of range)
    const snapThreshold = (max - min) * 0.02;
    if (Math.abs(newValue - defaultValue) < snapThreshold) {
      newValue = defaultValue;
    }

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
  }, [isDragging, dragStartValue.current]);

  const displayValue = unit === 'x'
    ? value.toFixed(2)
    : unit === '%'
    ? `${Math.round(value * 100)}`
    : value.toFixed(2);

  return (
    <div className={`flex flex-col items-center gap-1.5 ${isMappingMode ? 'cursor-pointer' : ''}`}>
      <div
        className={`relative w-12 h-12 rounded-full bg-dark-600 border transition-all ${
          isBeingMapped
            ? 'border-green-500 animate-pulse'
            : isMappingMode
            ? 'border-purple-500'
            : 'border-dark-500'
        } ${isDragging ? 'ring-1 ring-blue-500' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: isMappingMode ? 'pointer' : 'ns-resize' }}
      >
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-dark-400 rounded-full" />
        </div>

        {/* Indicator line - fixed positioning */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `rotate(${angle}deg)`,
          }}
        >
          <div className="w-5 h-0.5 bg-blue-400 rounded-full" style={{ marginLeft: '50%', transformOrigin: 'left center' }} />
        </div>

        {/* MIDI indicator */}
        {hasMidiMapping && (
          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center text-[9px]">
            🎹
          </div>
        )}
      </div>

      <div className="text-center">
        <div className="text-[11px] text-dark-200 font-medium">{label}</div>
        <div className="text-[10px] text-dark-400 font-mono">
          {displayValue}{unit}
        </div>
      </div>
    </div>
  );
};

const BottomPanel: React.FC<BottomPanelProps> = ({ midiHandler }) => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(state => state.settings);
  const ui = useAppSelector(state => state.ui);
  const [isOpen, setIsOpen] = useState(true);
  const [volumeFlash, setVolumeFlash] = useState(false);
  const [prevVolume, setPrevVolume] = useState(settings.masterVolume);

  // Detect volume changes from MIDI and trigger flash
  useEffect(() => {
    if (settings.masterVolume !== prevVolume) {
      setPrevVolume(settings.masterVolume);
      setVolumeFlash(true);
      const timer = setTimeout(() => setVolumeFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [settings.masterVolume, prevVolume]);

  useEffect(() => {
    if (!midiHandler || !ui.isMidiListening || !ui.mappingTarget) return;

    const handleMidiMessage = (message: MidiMessage) => {
      if (ui.mappingTarget === 'volume' && message.type === 'cc') {
        dispatch(updateSettings({
          volumeMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            ccNumber: message.ccNumber!,
            channel: message.channel,
          },
        }));
        dispatch(clearMappingTarget());
        dispatch(setDirty(true));
      }
    };

    midiHandler.addListener(handleMidiMessage);
    return () => {
      midiHandler.removeListener(handleMidiMessage);
    };
  }, [midiHandler, ui.isMidiListening, ui.mappingTarget, dispatch]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseInt(e.target.value) / 100;
    dispatch(setMasterVolume(volume));
    dispatch(setDirty(true));
  };

  const isMappingVolume = ui.isMidiMappingMode && ui.mappingTarget === 'volume';
  const volumeHasMappingTitle = settings.volumeMapping
    ? `Mapped to: ${settings.volumeMapping.deviceName} CC${settings.volumeMapping.ccNumber} Ch${settings.volumeMapping.channel + 1}`
    : 'Not mapped';

  if (!isOpen) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-dark-700 border-t-2 border-dark-500 px-6 py-2 flex justify-center">
        <button
          onClick={() => setIsOpen(true)}
          className="text-sm text-dark-300 hover:text-dark-100 transition-colors"
        >
          ▲ Show Controls
        </button>
      </div>
    );
  }

  const effects = settings.effects || {
    speed: 1,
    pan: 0,
    filterLow: 1,
    filterMid: 1,
    filterHigh: 1,
    distortion: 0,
    reverb: 0,
    delay: 0,
  };

  const effectsMappings = settings.effectsMidiMappings || {};

  const handleEffectChange = (effect: EffectKnobType, value: number) => {
    dispatch(setEffectValue({ effect, value }));
    dispatch(setDirty(true));
  };

  const handleStartEffectMapping = (effect: EffectKnobType) => {
    dispatch(startMappingTarget(effect));
  };

  const knobs: Array<{
    key: EffectKnobType;
    label: string;
    min: number;
    max: number;
    defaultValue: number;
    unit?: string;
  }> = [
    { key: 'speed', label: 'Speed', min: 0.5, max: 2, defaultValue: 1, unit: 'x' },
    { key: 'pan', label: 'Pan', min: -1, max: 1, defaultValue: 0, unit: '%' },
    { key: 'filterLow', label: 'Low', min: 0, max: 1, defaultValue: 1, unit: '%' },
    { key: 'filterMid', label: 'Mid', min: 0, max: 1, defaultValue: 1, unit: '%' },
    { key: 'filterHigh', label: 'High', min: 0, max: 1, defaultValue: 1, unit: '%' },
    { key: 'distortion', label: 'Dist', min: 0, max: 1, defaultValue: 0, unit: '%' },
    { key: 'reverb', label: 'Reverb', min: 0, max: 1, defaultValue: 0, unit: '%' },
    { key: 'delay', label: 'Delay', min: 0, max: 1, defaultValue: 0, unit: '%' },
  ];

  return (
    <div className="bg-dark-700 border-t-2 border-dark-500 p-4">
      <div className="flex items-center justify-between gap-6">
        {/* Left side - Effects knobs */}
        <div className="flex-1 flex items-center justify-between">
          {knobs.map((knob) => (
            <SmallKnob
              key={knob.key}
              label={knob.label}
              value={effects[knob.key]}
              min={knob.min}
              max={knob.max}
              defaultValue={knob.defaultValue}
              unit={knob.unit}
              onChange={(value) => handleEffectChange(knob.key, value)}
              onStartMapping={() => handleStartEffectMapping(knob.key)}
              isMappingMode={ui.isMidiMappingMode}
              isBeingMapped={ui.mappingTarget === knob.key}
              hasMidiMapping={!!(effectsMappings[knob.key])}
            />
          ))}
        </div>

        {/* Right side - Master Volume */}
        <div className="flex items-center gap-4">
          <section
            className={`p-3 rounded transition-all duration-300 relative min-w-[300px] ${
              volumeFlash ? 'bg-blue-900 bg-opacity-30 ring-2 ring-blue-500' : ''
            } ${
              ui.isMidiMappingMode ? 'ring-2 ring-purple-500 hover:ring-purple-400 cursor-pointer' : ''
            } ${
              isMappingVolume ? 'ring-2 ring-green-500 animate-pulse' : ''
            }`}
            onClick={() => {
              if (ui.isMidiMappingMode && !ui.mappingTarget) {
                dispatch(startMappingTarget('volume'));
              }
            }}
            title={ui.isMidiMappingMode ? 'Click to map MIDI knob' : volumeHasMappingTitle}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-dark-200 uppercase">Master Volume</h3>
              <span className={`text-sm transition-opacity ${settings.volumeMapping ? 'opacity-100 text-green-400' : 'opacity-30 text-gray-400'}`}>
                🎹
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(settings.masterVolume * 100)}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 h-1.5 bg-dark-500 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm w-12 text-right">{Math.round(settings.masterVolume * 100)}%</span>
            </div>
            {settings.volumeMapping && !ui.isMidiMappingMode && (
              <div className="mt-1.5 p-1.5 bg-dark-800 rounded text-xs">
                <div>Device: {settings.volumeMapping.deviceName}</div>
                <div>CC: {settings.volumeMapping.ccNumber} Ch{settings.volumeMapping.channel + 1}</div>
              </div>
            )}
            {isMappingVolume && (
              <div className="mt-2 p-2 bg-green-900 border border-green-500 rounded text-xs text-green-300 animate-pulse">
                ⏳ Listening for MIDI knob...
              </div>
            )}
          </section>

          <button
            onClick={() => setIsOpen(false)}
            className="text-dark-400 hover:text-dark-200 transition-colors"
            title="Hide controls"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
};

export default BottomPanel;
