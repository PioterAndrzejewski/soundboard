import React, { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import {
  setSounds,
  addSound,
  removeSound,
  updateSound,
  reorderSounds,
} from "./store/soundsSlice";
import { setSettings, setMasterVolume, updateSettings, setEffectValue, setEffectMidiMapping } from "./store/settingsSlice";
import {
  setCurrentProjectPath,
  setDirty,
  triggerStopAll,
  triggerSoundHighlight,
  stopMidiListening,
  clearMappingTarget,
  startMappingTarget,
} from "./store/uiSlice";
import { setTabs } from "./store/tabsSlice";
import { AudioEngine } from "./audioEngine";
import { MidiHandler } from "./midiHandler";
import { SoundManager } from "./soundManager";
import Header from "./components/Header";
import TabBar from "./components/TabBar";
import SoundsGrid from "./components/SoundsGrid";
import SoundSettingsModal from "./components/SoundSettingsModal";
import MidiListeningOverlay from "./components/MidiListeningOverlay";
import ActiveSoundsPanel from "./components/ActiveSoundsPanel";
import BottomPanel from "./components/BottomPanel";
import EffectsPanel from "./components/EffectsPanel";
import { Project, EffectsState } from "../shared/types";

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const sounds = useAppSelector((state) => state.sounds.sounds);
  const settings = useAppSelector((state) => state.settings);
  const ui = useAppSelector((state) => state.ui);
  const activeTabId = useAppSelector((state) => state.tabs.activeTabId);
  const tabs = useAppSelector((state) => state.tabs.tabs);

  // Filter sounds by active tab
  const filteredSounds = sounds.filter((sound) => {
    // If sound doesn't have a tabId (old projects), show in first tab
    if (!sound.tabId) {
      return activeTabId === tabs[0]?.id;
    }
    return sound.tabId === activeTabId;
  });

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const midiHandlerRef = useRef<MidiHandler | null>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);

  // Initialize engines
  useEffect(() => {
    // Add global error handler to catch crashes
    const handleError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);
      event.preventDefault();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    const initEngines = async () => {
      try {
        audioEngineRef.current = new AudioEngine();
        midiHandlerRef.current = new MidiHandler();
        await midiHandlerRef.current.initialize();

        soundManagerRef.current = new SoundManager(
          audioEngineRef.current,
          midiHandlerRef.current,
          settings
        );

        // Set up callback for MIDI-triggered sounds
        soundManagerRef.current.onSoundTriggered((soundId) => {
          dispatch(triggerSoundHighlight(soundId));
        });

        console.log("Engines initialized successfully");
      } catch (error) {
        console.error("Failed to initialize engines:", error);
      }
    };

    initEngines();

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
      soundManagerRef.current?.destroy();
    };
  }, []);

  // Update sound manager when settings change
  useEffect(() => {
    if (soundManagerRef.current) {
      soundManagerRef.current.updateSettings(settings);
    }

    // Update audio output device
    if (audioEngineRef.current) {
      audioEngineRef.current.setOutputDevice(settings.defaultOutputDeviceId);
    }

    // Update audio effects
    if (audioEngineRef.current && settings.effects) {
      audioEngineRef.current.setEffects(settings.effects);
    }
  }, [settings]);

  // Handle MIDI messages for volume and stop-all controls
  useEffect(() => {
    if (!midiHandlerRef.current) return;

    const handleMidiMessage = (message: any) => {
      // Debug logging for CC messages
      if (message.type === "cc") {
        console.log("🎛️ MIDI CC Message:", {
          device: message.deviceName,
          deviceId: message.deviceId,
          channel: message.channel + 1, // Display as 1-16 instead of 0-15
          ccNumber: message.ccNumber,
          value: message.value,
          percentage: Math.round((message.value / 127) * 100) + "%",
        });
      }

      // Handle volume mapping
      if (message.type === "cc" && settings.volumeMapping) {
        const vm = settings.volumeMapping;
        if (
          message.deviceId === vm.deviceId &&
          message.ccNumber === vm.ccNumber &&
          message.channel === vm.channel
        ) {
          console.log("✅ Matched volume mapping!", {
            value: message.value,
            volume: message.value / 127,
          });
          const volume = message.value / 127;
          dispatch(setMasterVolume(volume));
        }
      }

      // Handle effects mappings
      if (message.type === "cc" && settings.effectsMidiMappings) {
        const effectKeys: Array<keyof EffectsState> = [
          'pitch', 'filterLow', 'filterMid', 'filterHigh',
          'filterResonance', 'distortion', 'reverb', 'delay'
        ];

        for (const effectKey of effectKeys) {
          const mapping = settings.effectsMidiMappings[effectKey];
          if (
            mapping &&
            message.deviceId === mapping.deviceId &&
            message.ccNumber === mapping.ccNumber &&
            message.channel === mapping.channel
          ) {
            // Calculate value based on effect type
            let value: number;
            if (effectKey === 'pitch') {
              // Pitch: -12 to +12 semitones
              value = ((message.value / 127) * 24) - 12;
            } else {
              // All other effects: 0 to 1
              value = message.value / 127;
            }

            console.log(`✅ Matched ${effectKey} mapping!`, {
              ccValue: message.value,
              effectValue: value,
            });

            dispatch(setEffectValue({ effect: effectKey, value }));
            dispatch(setDirty(true));
            break;
          }
        }
      }

      // Handle stop all mapping
      if (message.type === "noteon" && settings.stopAllMapping) {
        const sam = settings.stopAllMapping;
        if (
          message.deviceId === sam.deviceId &&
          message.note === sam.note &&
          message.channel === sam.channel
        ) {
          handleStopAll();
        }
      }
    };

    midiHandlerRef.current.addListener(handleMidiMessage);
    return () => {
      midiHandlerRef.current?.removeListener(handleMidiMessage);
    };
  }, [
    midiHandlerRef.current,
    settings.volumeMapping,
    settings.stopAllMapping,
    settings.effectsMidiMappings,
    dispatch,
  ]);

  // Handle MIDI mapping assignment for Stop All button
  useEffect(() => {
    if (!midiHandlerRef.current || !ui.isMidiMappingMode || ui.mappingTarget !== 'stopall') return;

    const handleMidiMessage = (message: any) => {
      if (message.type === 'noteon') {
        dispatch(updateSettings({
          stopAllMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            note: message.note,
            channel: message.channel,
          },
        }));
        dispatch(clearMappingTarget());
        dispatch(setDirty(true));
      }
    };

    midiHandlerRef.current.addListener(handleMidiMessage);
    return () => {
      midiHandlerRef.current?.removeListener(handleMidiMessage);
    };
  }, [midiHandlerRef.current, ui.isMidiMappingMode, ui.mappingTarget, dispatch]);

  // Handle MIDI mapping assignment for effects
  useEffect(() => {
    if (!midiHandlerRef.current || !ui.isMidiMappingMode) return;

    const effectKeys: Array<keyof EffectsState> = [
      'pitch', 'filterLow', 'filterMid', 'filterHigh',
      'filterResonance', 'distortion', 'reverb', 'delay'
    ];

    if (!ui.mappingTarget || !effectKeys.includes(ui.mappingTarget as keyof EffectsState)) return;

    const handleMidiMessage = (message: any) => {
      if (message.type === 'cc') {
        const effectKey = ui.mappingTarget as keyof EffectsState;
        dispatch(setEffectMidiMapping({
          effect: effectKey,
          mapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            ccNumber: message.ccNumber,
            channel: message.channel,
          },
        }));
        dispatch(clearMappingTarget());
        dispatch(setDirty(true));
      }
    };

    midiHandlerRef.current.addListener(handleMidiMessage);
    return () => {
      midiHandlerRef.current?.removeListener(handleMidiMessage);
    };
  }, [midiHandlerRef.current, ui.isMidiMappingMode, ui.mappingTarget, dispatch]);

  // Handle direct MIDI assignment for sounds (when not in modal)
  useEffect(() => {
    if (
      !midiHandlerRef.current ||
      !ui.isMidiListening ||
      ui.listeningMode !== "sound" ||
      ui.isSettingsModalOpen
    )
      return;
    if (!ui.selectedSoundId) return;

    const handleMidiMessage = (message: any) => {
      if (message.type === "noteon") {
        // Update the sound with the new MIDI mapping
        dispatch(
          updateSound({
            id: ui.selectedSoundId || "",
            updates: {
              midiMapping: {
                deviceId: message.deviceId,
                deviceName: message.deviceName,
                note: message.note,
                channel: message.channel,
              },
            },
          })
        );

        // Update the sound manager
        if (soundManagerRef.current) {
          const sound = sounds.find((s) => s.id === ui.selectedSoundId);
          if (sound) {
            soundManagerRef.current.updateSound(ui.selectedSoundId || "", {
              ...sound,
              midiMapping: {
                deviceId: message.deviceId,
                deviceName: message.deviceName,
                note: message.note,
                channel: message.channel,
              },
            });
          }
        }

        // Stop listening and mark as dirty
        dispatch(stopMidiListening());
        dispatch(setDirty(true));
      }
    };

    midiHandlerRef.current.addListener(handleMidiMessage);
    return () => {
      midiHandlerRef.current?.removeListener(handleMidiMessage);
    };
  }, [
    midiHandlerRef.current,
    ui.isMidiListening,
    ui.listeningMode,
    ui.selectedSoundId,
    ui.isSettingsModalOpen,
    sounds,
    dispatch,
  ]);

  // Handle project operations
  const handleNewProject = async () => {
    if (ui.isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Create new project?"
      );
      if (!confirmed) return;
    }

    await window.electronAPI.newProject();
    dispatch(setSounds([]));
    dispatch(
      setSettings({
        masterVolume: 0.8,
        defaultFadeInMs: 100,
        defaultFadeOutMs: 500,
      })
    );
    dispatch(setCurrentProjectPath(null));
    dispatch(setDirty(false));
  };

  const handleSaveProject = async () => {
    try {
      const project: Project = {
        name: ui.currentProjectPath
          ? ui.currentProjectPath.split("/").pop()?.replace(".sboard", "") ||
            "Untitled"
          : "Untitled",
        version: "1.0.0",
        sounds,
        settings,
        tabs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const filePath = await window.electronAPI.saveProject(
        project,
        ui.currentProjectPath || undefined
      );
      dispatch(setCurrentProjectPath(filePath));
      dispatch(setDirty(false));
    } catch (error: any) {
      if (error.message !== "Save canceled") {
        console.error("Failed to save project:", error);
        alert(`Failed to save project: ${error.message}`);
      }
    }
  };

  const handleSaveProjectAs = async () => {
    try {
      const project: Project = {
        name: "Untitled",
        version: "1.0.0",
        sounds,
        settings,
        tabs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const filePath = await window.electronAPI.saveProjectAs(project);
      dispatch(setCurrentProjectPath(filePath));
      dispatch(setDirty(false));
    } catch (error: any) {
      if (error.message !== "Save canceled") {
        console.error("Failed to save project:", error);
        alert(`Failed to save project: ${error.message}`);
      }
    }
  };

  const handleLoadProject = async () => {
    if (ui.isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Load project?"
      );
      if (!confirmed) return;
    }

    try {
      const result = await window.electronAPI.loadProject();
      if (result) {
        dispatch(setSounds(result.project.sounds));
        dispatch(setSettings(result.project.settings));

        // Load tabs if they exist, otherwise keep default tab
        if (result.project.tabs && result.project.tabs.length > 0) {
          dispatch(setTabs(result.project.tabs));
        }

        dispatch(setCurrentProjectPath(result.filePath));
        dispatch(setDirty(false));

        // Reload sounds into audio engine
        if (soundManagerRef.current && audioEngineRef.current) {
          for (const sound of result.project.sounds) {
            try {
              await audioEngineRef.current.loadSound(sound);
            } catch (error) {
              console.error(`Failed to load sound ${sound.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      alert(`Failed to load project: ${error}`);
    }
  };

  const handleAddSound = async () => {
    try {
      console.log("📂 Opening file picker...");
      const filePath = await window.electronAPI.selectSoundFile();
      console.log("📂 Selected file:", filePath);

      if (filePath && soundManagerRef.current) {
        const fileName =
          filePath
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^/.]+$/, "") || "Untitled";
        console.log("➕ Adding sound:", fileName);

        const sound = await soundManagerRef.current.addSound(
          filePath,
          fileName
        );
        console.log("✅ Sound added to manager:", sound.id);

        // Assign to active tab
        const soundWithTab = { ...sound, tabId: activeTabId || tabs[0]?.id };

        dispatch(addSound(soundWithTab));
        console.log(
          "✅ Sound added to Redux store with tab:",
          soundWithTab.tabId
        );

        dispatch(setDirty(true));
        console.log("✅ All done!");
      }
    } catch (error: any) {
      console.error("❌ Failed to add sound:", error);
      console.error("Error details:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      alert(`Failed to add sound: ${error?.message || error}`);
    }
  };

  const handleRemoveSound = (soundId: string) => {
    if (soundManagerRef.current) {
      soundManagerRef.current.removeSound(soundId);
      dispatch(removeSound(soundId));
      dispatch(setDirty(true));
    }
  };

  const handleStopAll = () => {
    if (soundManagerRef.current) {
      soundManagerRef.current.stopAllSounds();
      dispatch(triggerStopAll());
    }
  };

  const handleEffectChange = (effect: keyof EffectsState, value: number) => {
    dispatch(setEffectValue({ effect, value }));
    dispatch(setDirty(true));
  };

  const handleStartEffectMapping = (effect: keyof EffectsState) => {
    dispatch(startMappingTarget(effect));
  };

  return (
    <div className="flex flex-col h-screen bg-dark-800 text-dark-50">
      <Header
        projectPath={ui.currentProjectPath}
        isDirty={ui.isDirty}
        onNew={handleNewProject}
        onSave={handleSaveProject}
        onSaveAs={handleSaveProjectAs}
        onLoad={handleLoadProject}
        onAddSound={handleAddSound}
        midiHandler={midiHandlerRef.current}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          <div className="flex-1 overflow-auto p-3">
            <SoundsGrid
              sounds={filteredSounds}
              onRemove={handleRemoveSound}
              soundManager={soundManagerRef.current}
              onAddSound={handleAddSound}
            />
          </div>
        </main>

        <ActiveSoundsPanel
          audioEngine={audioEngineRef.current}
          onStopAll={handleStopAll}
        />
      </div>

      <BottomPanel midiHandler={midiHandlerRef.current} />

      <EffectsPanel
        onEffectChange={handleEffectChange}
        onStartMapping={handleStartEffectMapping}
      />

      <SoundSettingsModal
        soundManager={soundManagerRef.current}
        midiHandler={midiHandlerRef.current}
      />

      <MidiListeningOverlay
        assignmentTarget={
          ui.selectedSoundId
            ? sounds.find((s) => s.id === ui.selectedSoundId)?.name
            : undefined
        }
      />
    </div>
  );
};

export default App;
