import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  startMappingTarget,
  clearMappingTarget,
  toggleMidiMappingMode,
} from "../store/uiSlice";
import { updateSettings } from "../store/settingsSlice";
import { setDirty } from "../store/uiSlice";

interface HeaderProps {
  projectPath: string | null;
  isDirty: boolean;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
  onAddSound: () => void;
  onStopAll: () => void;
  midiHandler?: any;
}

const Header: React.FC<HeaderProps> = ({
  projectPath,
  isDirty,
  onNew,
  onSave,
  onSaveAs,
  onLoad,
  onAddSound,
  onStopAll,
  midiHandler,
}) => {
  const dispatch = useAppDispatch();
  const projectName = projectPath
    ? projectPath.split(/[\\/]/).pop()
    : "Untitled";
  const [stopAllFlash, setStopAllFlash] = useState(false);
  const [showMidiDevices, setShowMidiDevices] = useState(false);
  const [audioOutputDevices, setAudioOutputDevices] = useState<
    MediaDeviceInfo[]
  >([]);
  const [midiDevices, setMidiDevices] = useState<any[]>([]);
  const ui = useAppSelector((state) => state.ui);
  const settings = useAppSelector((state) => state.settings);

  // Load MIDI devices
  useEffect(() => {
    if (midiHandler) {
      setMidiDevices(midiHandler.getDevices());
    }
  }, [midiHandler]);

  // Enumerate audio output devices
  useEffect(() => {
    const enumerateAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
        setAudioOutputDevices(audioOutputs);
      } catch (error) {
        console.error("Failed to enumerate audio devices:", error);
      }
    };

    enumerateAudioDevices();
  }, []);

  // Watch for Stop All trigger (from button or MIDI)
  useEffect(() => {
    if (ui.lastStopAllTrigger > 0) {
      setStopAllFlash(true);
      const timer = setTimeout(() => setStopAllFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [ui.lastStopAllTrigger]);

  const isMappingStopAll =
    ui.isMidiMappingMode && ui.mappingTarget === "stopall";
  const stopAllHasMappingTitle = settings.stopAllMapping
    ? `Mapped to: ${settings.stopAllMapping.deviceName} Note${
        settings.stopAllMapping.note
      } Ch${settings.stopAllMapping.channel + 1}`
    : "Not mapped";

  const handleStopAllClick = () => {
    if (ui.isMidiMappingMode && !ui.mappingTarget) {
      dispatch(startMappingTarget("stopall"));
    } else if (!ui.isMidiMappingMode) {
      onStopAll();
    }
  };

  return (
    <header className="bg-dark-600 border-b-2 border-dark-500 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">MIDI Soundboard</h1>
        <span className="text-dark-200 text-sm">
          {projectName}
          {isDirty && " *"}
        </span>

        <div className="w-px bg-dark-500 h-6"></div>

        {/* MIDI Mapping Mode Toggle */}
        <button
          onClick={() => dispatch(toggleMidiMappingMode())}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
            ui.isMidiMappingMode
              ? "bg-purple-600 hover:bg-purple-500 ring-2 ring-purple-400"
              : "bg-dark-500 hover:bg-dark-400"
          }`}
          title={
            ui.isMidiMappingMode
              ? "Exit MIDI mapping mode"
              : "Enter MIDI mapping mode"
          }
        >
          {ui.isMidiMappingMode ? "🎹 Mapping Mode: ON" : "🎹 MIDI Mapping"}
        </button>

        <div
          className={`relative rounded transition-all ${
            ui.isMidiMappingMode
              ? "ring-2 ring-purple-500 hover:ring-purple-400 cursor-pointer"
              : ""
          } ${isMappingStopAll ? "ring-2 ring-green-500 animate-pulse" : ""}`}
          onClick={handleStopAllClick}
          title={
            ui.isMidiMappingMode
              ? "Click to map MIDI key"
              : stopAllHasMappingTitle
          }
        >
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                if (!ui.isMidiMappingMode) {
                  e.stopPropagation();
                  onStopAll();
                }
              }}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                stopAllFlash
                  ? "bg-red-400 ring-2 ring-red-300 scale-105"
                  : "bg-red-600 hover:bg-red-500"
              } ${ui.isMidiMappingMode ? "cursor-pointer" : ""}`}
            >
              Stop All
            </button>
            <span
              className={`text-sm ${
                settings.stopAllMapping ? "text-green-400" : "text-gray-500"
              }`}
            >
              🎹
            </span>
          </div>
          {isMappingStopAll && (
            <div className="absolute top-full mt-1 left-0 right-0 p-2 bg-green-900 border border-green-500 rounded text-xs text-green-300 animate-pulse whitespace-nowrap z-50">
              ⏳ Listening for MIDI key...
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onNew}
          className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors"
        >
          New
        </button>
        <button
          onClick={onLoad}
          className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors"
        >
          Open
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors"
        >
          Save
        </button>
        <button
          onClick={onSaveAs}
          className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors"
        >
          Save As
        </button>
        <div className="w-px bg-dark-500 mx-2"></div>

        {/* Audio Output Selector */}
        <div className="relative">
          <select
            value={settings.defaultOutputDeviceId || "default"}
            onChange={(e) => {
              dispatch(
                updateSettings({
                  defaultOutputDeviceId:
                    e.target.value === "default" ? undefined : e.target.value,
                })
              );
              dispatch(setDirty(true));
            }}
            className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors cursor-pointer appearance-none pr-8"
            title="Select audio output device"
          >
            <option value="default">🔊 Default Output</option>
            {audioOutputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                🔊 {device.label || `Device ${device.deviceId.substring(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        {/* MIDI Devices Button */}
        <div className="relative">
          <button
            onClick={() => setShowMidiDevices(!showMidiDevices)}
            className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors flex items-center gap-1"
            title="Show MIDI devices"
          >
            🎛️ MIDI Devices
            {midiDevices.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-green-600 rounded-full text-xs">
                {midiDevices.length}
              </span>
            )}
          </button>

          {showMidiDevices && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-dark-600 border-2 border-dark-500 rounded-lg shadow-xl z-50">
              <div className="p-4 border-b border-dark-500 flex items-center justify-between">
                <h3 className="font-semibold">Connected MIDI Devices</h3>
                <button
                  onClick={() => setShowMidiDevices(false)}
                  className="text-dark-300 hover:text-dark-100 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                {midiDevices.length === 0 ? (
                  <div className="text-dark-300 text-sm italic text-center py-4">
                    No MIDI devices connected
                  </div>
                ) : (
                  <div className="space-y-2">
                    {midiDevices.map((device) => (
                      <div
                        key={device.id}
                        className="p-3 bg-dark-700 rounded border border-dark-500"
                      >
                        <div className="font-medium text-sm">{device.name}</div>
                        <div className="text-xs text-dark-300 mt-1">
                          {device.manufacturer || "Unknown manufacturer"}
                        </div>
                        <div className="text-xs text-dark-400 mt-1">
                          ID: {device.id}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onAddSound}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
        >
          Add Sound
        </button>
      </div>
    </header>
  );
};

export default Header;
