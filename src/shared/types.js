"use strict";
// Type definitions for MIDI Soundboard
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcChannel = void 0;
// IPC channel names
var IpcChannel;
(function (IpcChannel) {
    // Sound management
    IpcChannel["ADD_SOUND"] = "add-sound";
    IpcChannel["REMOVE_SOUND"] = "remove-sound";
    IpcChannel["UPDATE_SOUND"] = "update-sound";
    IpcChannel["GET_SOUNDS"] = "get-sounds";
    // MIDI
    IpcChannel["GET_MIDI_DEVICES"] = "get-midi-devices";
    IpcChannel["START_MIDI_LISTEN"] = "start-midi-listen";
    IpcChannel["STOP_MIDI_LISTEN"] = "stop-midi-listen";
    IpcChannel["MIDI_MESSAGE"] = "midi-message";
    // Audio
    IpcChannel["GET_AUDIO_DEVICES"] = "get-audio-devices";
    IpcChannel["PLAY_SOUND"] = "play-sound";
    IpcChannel["STOP_SOUND"] = "stop-sound";
    IpcChannel["STOP_ALL_SOUNDS"] = "stop-all-sounds";
    // Settings
    IpcChannel["GET_SETTINGS"] = "get-settings";
    IpcChannel["UPDATE_SETTINGS"] = "update-settings";
    // File selection
    IpcChannel["SELECT_SOUND_FILE"] = "select-sound-file";
    // Project management
    IpcChannel["NEW_PROJECT"] = "new-project";
    IpcChannel["SAVE_PROJECT"] = "save-project";
    IpcChannel["SAVE_PROJECT_AS"] = "save-project-as";
    IpcChannel["LOAD_PROJECT"] = "load-project";
    IpcChannel["GET_RECENT_PROJECTS"] = "get-recent-projects";
})(IpcChannel || (exports.IpcChannel = IpcChannel = {}));
