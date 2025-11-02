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

  const displayValue = unit === 'st'
    ? (value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1))
    : unit === 'x'
    ? value.toFixed(2)
    : value.toFixed(2);

  return (
    <div className={`flex flex-col items-center gap-1 ${isMappingMode ? 'cursor-pointer' : ''}`}>
      <div
        className={`relative w-10 h-10 rounded-full bg-dark-600 border transition-all ${
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
          <div className="w-1.5 h-1.5 bg-dark-400 rounded-full" />
        </div>

        {/* Indicator line - fixed positioning */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `rotate(${angle}deg)`,
          }}
        >
          <div className="w-4 h-0.5 bg-blue-400 rounded-full" style={{ marginLeft: '50%', transformOrigin: 'left center' }} />
        </div>

        {/* MIDI indicator */}
        {hasMidiMapping && (
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center text-[8px]">
            🎹
          </div>
        )}
      </div>

      <div className="text-center">
        <div className="text-[10px] text-dark-200 font-medium">{label}</div>
        <div className="text-[9px] text-dark-400 font-mono">
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
    pitch: 0,
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
    { key: 'pitch', label: 'Pitch', min: -12, max: 12, defaultValue: 0, unit: 'st' },
    { key: 'filterLow', label: 'Low', min: 0, max: 1, defaultValue: 1 },
    { key: 'filterMid', label: 'Mid', min: 0, max: 1, defaultValue: 1 },
    { key: 'filterHigh', label: 'High', min: 0, max: 1, defaultValue: 1 },
    { key: 'distortion', label: 'Dist', min: 0, max: 1, defaultValue: 0 },
    { key: 'reverb', label: 'Reverb', min: 0, max: 1, defaultValue: 0 },
    { key: 'delay', label: 'Delay', min: 0, max: 1, defaultValue: 0 },
  ];

  return (
    <div className="bg-dark-700 border-t-2 border-dark-500 p-4">
      <div className="flex items-center justify-between">
        {/* Left side - Effects knobs */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-dark-300 font-semibold uppercase mr-2">Effects</span>
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
