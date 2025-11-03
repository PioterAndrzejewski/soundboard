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
  setSelectedSound,
  openSettingsModal,
  startMidiListening,
} from "./store/uiSlice";
import { setTabs, setTabMidiMapping, setActiveTab } from "./store/tabsSlice";
import { AudioEngine } from "./audioEngine";
import { MidiHandler } from "./midiHandler";
import { SoundManager } from "./soundManager";
import { generateAndSaveSynthSound, InstrumentType } from "./synthGenerator";
import Header from "./components/Header";
import TabBar from "./components/TabBar";
import SoundsGrid from "./components/SoundsGrid";
import APCMiniLayout from "./components/APCMiniLayout";
import APCKey25Layout from "./components/APCKey25Layout";
import APCKeyLayout from "./components/APCKeyLayout";
import APCRightLayout from "./components/APCRightLayout";
import SoundSettingsModal from "./components/SoundSettingsModal";
import MidiListeningOverlay from "./components/MidiListeningOverlay";
import ActiveSoundsPanel from "./components/ActiveSoundsPanel";
import BottomPanel from "./components/BottomPanel";
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

  // Initialize engines and auto-load last project
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

        // Auto-load last project
        await autoLoadLastProject();
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

  // Auto-load last project on startup
  const autoLoadLastProject = async () => {
    try {
      const lastProjectPath = await window.electronAPI.getLastProjectPath();
      if (lastProjectPath) {
        console.log("Auto-loading last project:", lastProjectPath);

        const result = await window.electronAPI.loadProjectByPath(lastProjectPath);
        if (result) {
          dispatch(setSounds(result.project.sounds));
          dispatch(setSettings(result.project.settings));

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
      }
    } catch (error) {
      console.error("Failed to auto-load last project:", error);
      // If auto-load fails, just start with empty project
    }
  };

  // Auto-save periodically
  useEffect(() => {
    const autoSaveInterval = setInterval(async () => {
      if (ui.isDirty) {
        try {
          const project: Project = {
            name: ui.currentProjectPath
              ? ui.currentProjectPath.split("/").pop()?.replace(".sboard", "") || "Untitled"
              : "Untitled",
            version: "1.0.0",
            sounds,
            settings,
            tabs,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await window.electronAPI.saveAutoSave(project);
          console.log("Auto-saved project state");
        } catch (error) {
          console.error("Auto-save failed:", error);
        }
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [ui.isDirty, ui.currentProjectPath, sounds, settings, tabs]);

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
          'speed', 'pan', 'filterLow', 'filterMid', 'filterHigh',
          'distortion', 'reverb', 'delay'
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
            if (effectKey === 'speed') {
              // Speed: 0.5 to 2.0
              value = 0.5 + ((message.value / 127) * 1.5);
            } else if (effectKey === 'pan') {
              // Pan: -1 (left) to 1 (right)
              value = ((message.value / 127) * 2) - 1;
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
      'speed', 'pan', 'filterLow', 'filterMid', 'filterHigh',
      'distortion', 'reverb', 'delay'
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
      ui.isSettingsModalOpen ||
      ui.tabListeningTarget // Exclude if listening for tab
    )
      return;
    if (!ui.selectedSoundId) return;

    const handleMidiMessage = (message: any) => {
      // Find the sound to determine if it's in an APC RIGHT layout (knob)
      const sound = sounds.find((s) => s.id === ui.selectedSoundId);
      const soundTab = tabs.find(t => t.id === sound?.tabId);
      const isAPCRightKnob = soundTab?.layoutType === 'apc-right' &&
                             sound?.slotPosition?.row !== undefined &&
                             sound.slotPosition.row >= 0 &&
                             sound.slotPosition.row <= 7;

      // For APC RIGHT knobs, use CC messages; for others, use note messages
      const shouldAcceptMessage = isAPCRightKnob ? message.type === "cc" : message.type === "noteon";

      if (shouldAcceptMessage) {
        // For APC RIGHT knobs, determine expected ccValue based on column
        // col=0 (left button) expects ccValue=127, col=1 (right button) expects ccValue=1
        let expectedCcValue: number | undefined;
        if (isAPCRightKnob && sound?.slotPosition) {
          expectedCcValue = sound.slotPosition.col === 0 ? 127 : 1;
        }

        const midiMapping = isAPCRightKnob
          ? {
              deviceId: message.deviceId,
              deviceName: message.deviceName,
              ccNumber: message.ccNumber,
              ccValue: expectedCcValue, // Set based on button position
              channel: message.channel,
            }
          : {
              deviceId: message.deviceId,
              deviceName: message.deviceName,
              note: message.note,
              channel: message.channel,
            };

        // Update the sound with the new MIDI mapping
        dispatch(
          updateSound({
            id: ui.selectedSoundId || "",
            updates: { midiMapping },
          })
        );

        // Update the sound manager
        if (soundManagerRef.current && sound) {
          soundManagerRef.current.updateSound(ui.selectedSoundId || "", {
            ...sound,
            midiMapping,
          });
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
    ui.tabListeningTarget,
    sounds,
    tabs,
    dispatch,
  ]);

  // Handle MIDI assignment for tabs
  useEffect(() => {
    if (
      !midiHandlerRef.current ||
      !ui.isMidiListening ||
      !ui.tabListeningTarget
    )
      return;

    const handleMidiMessage = (message: any) => {
      if (message.type === "noteon") {
        // Assign MIDI mapping to tab
        dispatch(
          setTabMidiMapping({
            tabId: ui.tabListeningTarget!,
            mapping: {
              deviceId: message.deviceId,
              deviceName: message.deviceName,
              note: message.note,
              channel: message.channel,
            },
          })
        );

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
    ui.tabListeningTarget,
    dispatch,
  ]);

  // Handle MIDI tab switching (when tabs have MIDI mappings)
  useEffect(() => {
    if (!midiHandlerRef.current) return;

    const handleMidiMessage = (message: any) => {
      if (message.type === "noteon") {
        // Check if any tab has this MIDI mapping
        const matchingTab = tabs.find(
          (tab) =>
            tab.midiMapping &&
            tab.midiMapping.deviceId === message.deviceId &&
            tab.midiMapping.note === message.note &&
            tab.midiMapping.channel === message.channel
        );

        if (matchingTab) {
          console.log(`🎹 MIDI tab switch: ${matchingTab.name}`);
          dispatch(setActiveTab(matchingTab.id));
        }
      }
    };

    midiHandlerRef.current.addListener(handleMidiMessage);
    return () => {
      midiHandlerRef.current?.removeListener(handleMidiMessage);
    };
  }, [midiHandlerRef.current, tabs, dispatch]);

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

  const handleRevertAutoSave = async () => {
    try {
      const autoSaveData = await window.electronAPI.getAutoSave();
      if (!autoSaveData) {
        alert("No auto-save available");
        return;
      }

      const timestamp = new Date(autoSaveData.timestamp).toLocaleString();
      const confirmed = window.confirm(
        `Revert to auto-save from ${timestamp}? Current unsaved changes will be lost.`
      );

      if (!confirmed) return;

      const project = autoSaveData.project;

      dispatch(setSounds(project.sounds));
      dispatch(setSettings(project.settings));

      if (project.tabs && project.tabs.length > 0) {
        dispatch(setTabs(project.tabs));
      }

      dispatch(setDirty(true)); // Mark as dirty since we reverted from auto-save

      // Reload sounds into audio engine
      if (soundManagerRef.current && audioEngineRef.current) {
        for (const sound of project.sounds) {
          try {
            await audioEngineRef.current.loadSound(sound);
          } catch (error) {
            console.error(`Failed to load sound ${sound.name}:`, error);
          }
        }
      }

      console.log("Reverted to auto-save successfully");
    } catch (error) {
      console.error("Failed to revert to auto-save:", error);
      alert(`Failed to revert: ${error}`);
    }
  };

  const handleAssignSoundToSlot = async (row: number, col: number, section: 'grid' | 'bottom' | 'side' | 'piano' | 'right' | 'knobs' | 'buttons') => {
    try {
      const filePath = await window.electronAPI.selectSoundFile();
      if (filePath && soundManagerRef.current) {
        const fileName =
          filePath
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^/.]+$/, "") || "Untitled";

        const sound = await soundManagerRef.current.addSound(
          filePath,
          fileName
        );

        // Adjust row based on section to make positions unique
        // Grid: row 0-7, col 0-7 (keep actual values)
        // Bottom: row 100-107, col 0 (APC MINI) or row 500-508, col 0 (APC KEY)
        // Side: row 200-207 or 300, col 0 (APC MINI)
        // Right: row 400-404, col 0 (APC KEY)
        // Piano: row as keyIndex (0-24), col 0
        // Knobs: row as passed (0-7 for APC RIGHT knobs), col 0
        // Buttons: row as passed (100-200 for APC RIGHT buttons), col 0
        let adjustedRow = row;
        let adjustedCol = col;

        if (section === 'grid') {
          // Keep row and col as-is for grid
          adjustedRow = row;
          adjustedCol = col;
        } else if (section === 'bottom') {
          // Check current tab layout to determine offset
          const currentTab = tabs.find(t => t.id === activeTabId);
          if (currentTab?.layoutType === 'apc-key') {
            adjustedRow = 500 + col; // APC KEY: 500-508
          } else {
            adjustedRow = 100 + col; // APC MINI: 100-107
          }
          adjustedCol = 0;
        } else if (section === 'side') {
          adjustedRow = 200 + row;
          adjustedCol = 0;
        } else if (section === 'right') {
          adjustedRow = 400 + row; // APC KEY right column: 400-404
          adjustedCol = 0;
        } else if (section === 'piano') {
          // For piano keys, use row as-is (keyIndex 0-24)
          adjustedRow = row;
          adjustedCol = 0;
        } else if (section === 'knobs' || section === 'buttons') {
          // For APC RIGHT knobs and buttons, use row and col as-is
          // col=0 for left button, col=1 for right button
          adjustedRow = row;
          adjustedCol = col;
        }

        // Assign to active tab with slot position
        const soundWithPosition = {
          ...sound,
          tabId: activeTabId || tabs[0]?.id,
          slotPosition: { row: adjustedRow, col: adjustedCol },
        };

        dispatch(addSound(soundWithPosition));
        dispatch(setDirty(true));
      }
    } catch (error: any) {
      console.error("Failed to assign sound to slot:", error);
      alert(`Failed to add sound: ${error?.message || error}`);
    }
  };

  const handlePlaySound = (soundId: string) => {
    if (soundManagerRef.current) {
      soundManagerRef.current.playSound(soundId);
    }
  };

  const handleRegenerateWithInstrument = async (instrument: InstrumentType) => {
    if (!activeTabId) return;

    console.log(`🔄 Switching to ${instrument} instrument...`);

    // Save MIDI mappings from current sounds (indexed by slotPosition.row)
    const tabSounds = sounds.filter(s => s.tabId === activeTabId);
    const midiMappingsByRow = new Map<number, any>();

    tabSounds.forEach(sound => {
      if (sound.midiMapping && sound.slotPosition) {
        midiMappingsByRow.set(sound.slotPosition.row, sound.midiMapping);
        console.log(`💾 Saved MIDI mapping for row ${sound.slotPosition.row}:`, sound.midiMapping);
      }
    });

    // Remove all sounds from this tab from Redux and audio engine
    for (const sound of tabSounds) {
      if (soundManagerRef.current) {
        soundManagerRef.current.removeSound(sound.id);
      }
      dispatch(removeSound(sound.id));
    }

    // Load pre-generated sounds for the selected instrument
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const pianoKeys: string[] = [];

    for (let octave = 1; octave <= 3; octave++) {
      for (let noteIdx = 0; noteIdx < notes.length; noteIdx++) {
        const note = notes[noteIdx];
        const noteName = `${note}${octave}`;
        pianoKeys.push(noteName);
        if (noteName === 'C3') break;
      }
      if (pianoKeys.length >= 25) break;
    }

    try {
      // Get temp directory once
      const tempDir = await window.electronAPI.getTempDir();
      console.log('📁 Temp directory:', tempDir);

      for (let i = 0; i < pianoKeys.length; i++) {
        const noteName = pianoKeys[i];
        console.log(`Loading ${instrument} sound for ${noteName} (${i + 1}/25)...`);

        // Get path to pre-generated sound file
        // The file was saved as: synth_${noteName}_${instrument}.wav with # replaced by 's'
        const fileName = `synth_${noteName}_${instrument}.wav`.replace('#', 's');
        const filePath = `${tempDir}/soundboard-synth/${fileName}`;

        console.log(`📂 Loading file: ${filePath}`);

        if (soundManagerRef.current && audioEngineRef.current) {
          try {
            const sound = await soundManagerRef.current.addSound(filePath, noteName);
            console.log(`✅ Sound loaded into manager:`, sound.id, sound.name);

            await audioEngineRef.current.loadSound(sound);
            console.log(`✅ Sound loaded into audio engine:`, sound.id);

            // Restore MIDI mapping if it existed for this position
            const savedMidiMapping = midiMappingsByRow.get(i);
            if (savedMidiMapping) {
              console.log(`🎹 Restoring MIDI mapping for row ${i}:`, savedMidiMapping);
            }

            const soundWithGateMode = {
              ...sound,
              settings: {
                ...sound.settings,
                playMode: 'gate' as const,
              },
              tabId: activeTabId,
              slotPosition: { row: i, col: 0 },
              midiMapping: savedMidiMapping || undefined,
            };

            // Update sound manager with MIDI mapping
            if (savedMidiMapping) {
              soundManagerRef.current.updateSound(sound.id, soundWithGateMode);
              console.log(`✅ Updated sound manager with MIDI mapping:`, sound.id);
            }

            dispatch(addSound(soundWithGateMode));
            console.log(`✅ Sound added to Redux:`, sound.id);
          } catch (error) {
            console.error(`❌ Failed to load sound ${noteName}:`, error);
          }
        }
      }

      console.log(`✅ Loaded all ${instrument} sounds`);
      dispatch(setDirty(true));
    } catch (error) {
      console.error('Failed to load sounds:', error);
      alert(`Failed to load sounds: ${error}`);
    }
  };

  // Auto-generate synth sounds for APC KEY25 tabs - generate all instruments at startup
  useEffect(() => {
    const generateSoundsForPianoTab = async () => {
      // Find APC KEY25 tabs that don't have sounds yet
      const pianoTabs = tabs.filter(t => t.layoutType === 'apc-key25');

      for (const tab of pianoTabs) {
        // Check if this tab already has sounds
        const tabSounds = sounds.filter(s => s.tabId === tab.id);
        if (tabSounds.length > 0) continue; // Skip if already has sounds

        console.log(`Generating synth sounds for tab: ${tab.name}`);

        // Generate sounds for all 25 keys (C1 to C3)
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const pianoKeys: string[] = [];

        for (let octave = 1; octave <= 3; octave++) {
          for (let noteIdx = 0; noteIdx < notes.length; noteIdx++) {
            const note = notes[noteIdx];
            const noteName = `${note}${octave}`;
            pianoKeys.push(noteName);
            if (noteName === 'C3') break; // Stop at C3 (25th key)
          }
          if (pianoKeys.length >= 25) break;
        }

        // Generate sounds for ALL instruments at startup
        const instruments: InstrumentType[] = ['piano', 'house', 'flute', 'trumpet'];

        try {
          for (const instrument of instruments) {
            console.log(`Generating ${instrument} sounds...`);

            for (let i = 0; i < pianoKeys.length; i++) {
              const noteName = pianoKeys[i];

              console.log(`Generating ${instrument} sound for ${noteName} (${i + 1}/25)...`);

              // Generate synth sound for this instrument
              const filePath = await generateAndSaveSynthSound(noteName, instrument);

              // Only add sounds to Redux for the default instrument (piano)
              // Other instrument files are pre-generated and cached
              if (instrument === 'piano' && soundManagerRef.current && audioEngineRef.current) {
                const sound = await soundManagerRef.current.addSound(filePath, noteName);

                // Load sound into audio engine
                await audioEngineRef.current.loadSound(sound);

                // Set to gate mode for piano-style playing
                const soundWithGateMode = {
                  ...sound,
                  settings: {
                    ...sound.settings,
                    playMode: 'gate' as const,
                  },
                  tabId: tab.id,
                  slotPosition: { row: i, col: 0 }, // keyIndex as row
                };

                dispatch(addSound(soundWithGateMode));
              }

              // Small delay between generations to keep UI responsive
              await new Promise(resolve => setTimeout(resolve, 30));
            }
          }

          console.log(`✅ Generated all synth sounds for tab: ${tab.name}`);
          dispatch(setDirty(true));
        } catch (error) {
          console.error('Failed to generate synth sounds:', error);
        }
      }
    };

    // Only run if we have sound manager initialized
    if (soundManagerRef.current && tabs.length > 0) {
      generateSoundsForPianoTab();
    }
  }, [tabs, dispatch]); // Re-run when tabs change

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
        onRevertAutoSave={handleRevertAutoSave}
        midiHandler={midiHandlerRef.current}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col">
          <TabBar />
          <div className="flex-1 overflow-auto p-3">
            {(() => {
              const currentLayout = tabs.find(t => t.id === activeTabId)?.layoutType;

              if (currentLayout === 'apc-mini') {
                return (
                  <APCMiniLayout
                    tabId={activeTabId || ''}
                    sounds={filteredSounds}
                    onAssignSound={handleAssignSoundToSlot}
                    onPlaySound={handlePlaySound}
                    onRemoveSound={handleRemoveSound}
                    onEditSound={(soundId) => {
                      dispatch(setSelectedSound(soundId));
                      dispatch(openSettingsModal());
                    }}
                    onStartMidiMapping={(soundId) => {
                      dispatch(setSelectedSound(soundId));
                      dispatch(startMidiListening('sound'));
                    }}
                  />
                );
              } else if (currentLayout === 'apc-key25') {
                return (
                  <APCKey25Layout
                    tabId={activeTabId || ''}
                    sounds={filteredSounds}
                    onAssignSound={handleAssignSoundToSlot}
                    onPlaySound={handlePlaySound}
                    onRemoveSound={handleRemoveSound}
                    onEditSound={(soundId) => {
                      dispatch(setSelectedSound(soundId));
                      dispatch(openSettingsModal());
                    }}
                    onStartMidiMapping={(soundId) => {
                      dispatch(setSelectedSound(soundId));
                      dispatch(startMidiListening('sound'));
                    }}
                    onRegenerateWithInstrument={handleRegenerateWithInstrument}
                  />
                );
              } else if (currentLayout === 'apc-key') {
                return (
                  <APCKeyLayout
                    tabId={activeTabId || ''}
                    sounds={filteredSounds}
                    onAssignSound={handleAssignSoundToSlot}
                    onPlaySound={handlePlaySound}
                    onRemoveSound={handleRemoveSound}
                    onEditSound={(soundId) => {
                      dispatch(setSelectedSound(soundId));
                      dispatch(openSettingsModal());
                    }}
                    onStartMidiMapping={(soundId) => {
                      dispatch(setSelectedSound(soundId));
                      dispatch(startMidiListening('sound'));
                    }}
                  />
                );
              } else if (currentLayout === 'apc-right') {
                return (
                  <APCRightLayout
                    tabId={activeTabId || ''}
                    sounds={filteredSounds}
                    onAssignSound={handleAssignSoundToSlot}
                    onPlaySound={handlePlaySound}
                    onRemoveSound={handleRemoveSound}
                    onEditSound={(soundId) => {
                      dispatch(setSelectedSound(soundId));
                      dispatch(openSettingsModal());
                    }}
                    onStartMidiMapping={(soundId) => {
                      dispatch(setSelectedSound(soundId));
                      dispatch(startMidiListening('sound'));
                    }}
                  />
                );
              } else {
                return (
                  <SoundsGrid
                    sounds={filteredSounds}
                    onRemove={handleRemoveSound}
                    soundManager={soundManagerRef.current}
                    onAddSound={handleAddSound}
                  />
                );
              }
            })()}
          </div>
        </main>

        <ActiveSoundsPanel
          audioEngine={audioEngineRef.current}
          onStopAll={handleStopAll}
        />
      </div>

      <BottomPanel midiHandler={midiHandlerRef.current} />

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
