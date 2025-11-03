import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { toggleMidiMappingMode, setDirty } from "../store/uiSlice";
import { updateSettings } from "../store/settingsSlice";

interface HeaderProps {
  projectPath: string | null;
  isDirty: boolean;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
  onAddSound: () => void;
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
  midiHandler,
}) => {
  const dispatch = useAppDispatch();
  const projectName = projectPath
    ? projectPath.split(/[\\/]/).pop()
    : "Untitled";
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

  const [showFileMenu, setShowFileMenu] = useState(false);

  // Close file menu when clicking outside
  useEffect(() => {
    if (!showFileMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".file-menu-container")) {
        setShowFileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFileMenu]);

  // Close MIDI devices menu when clicking outside
  useEffect(() => {
    if (!showMidiDevices) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".midi-devices-container")) {
        setShowMidiDevices(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMidiDevices]);

  return (
    <header className="bg-dark-600 border-b-2 border-dark-500 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">GIbellini Soundboard</h1>

        {/* File Menu Dropdown */}
        <div className="relative file-menu-container">
          <button
            onClick={() => setShowFileMenu(!showFileMenu)}
            className="px-2 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors"
            title="File menu"
          >
            ≡
          </button>
          {showFileMenu && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-dark-600 border-2 border-dark-500 rounded-lg shadow-xl z-50 overflow-hidden">
              <button
                onClick={() => {
                  onNew();
                  setShowFileMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-500 transition-colors"
              >
                New
              </button>
              <button
                onClick={() => {
                  onLoad();
                  setShowFileMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-500 transition-colors"
              >
                Open
              </button>
              <button
                onClick={() => {
                  onSave();
                  setShowFileMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-500 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  onSaveAs();
                  setShowFileMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-500 transition-colors rounded-b-lg"
              >
                Save As
              </button>
            </div>
          )}
        </div>

        <span className="text-dark-200 text-sm">
          {projectName}
          {isDirty && " *"}
        </span>
      </div>

      <div className="flex gap-2">
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
        <div className="relative midi-devices-container">
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
            <div className="absolute top-full right-0 mt-2 w-80 bg-dark-600 border-2 border-dark-500 rounded-lg shadow-xl z-50 overflow-hidden">
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
        {/* MIDI Mapping Mode Toggle - Icon Only */}
        <button
          onClick={() => dispatch(toggleMidiMappingMode())}
          className={`px-3 py-1.5 rounded text-lg transition-all ${
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
          🎹
        </button>
      </div>
    </header>
  );
};

export default Header;
