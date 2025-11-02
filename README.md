# MIDI Soundboard

A professional MIDI-controlled soundboard application built with **Electron**, **React**, **Redux Toolkit**, **TypeScript**, **Tailwind CSS**, and **dnd-kit**. Trigger and control audio samples using MIDI devices with advanced features like drag-and-drop ordering, project save/load, fade in/out, multiple playback modes, and device-specific mappings.

## Features

### Core Features
- **React + Redux Architecture**: Modern state management with Redux Toolkit
- **Tailwind CSS Styling**: Beautiful, responsive dark theme
- **Drag and Drop**: Reorder sounds with dnd-kit library
- **Project Management**: Save and load complete projects to disk

### MIDI Control
- Map sounds to MIDI keys from multiple MIDI devices
- Support for multiple MIDI devices with separate mappings
- Map MIDI knobs to master volume (CC messages)
- Mappable "Stop All Sounds" key
- Visual listening mode indicator

### Audio Features
- **Multiple Playback Modes**:
  - **Trigger Mode**: One-shot playback (fire and forget)
  - **Gate Mode**: Hold-to-play with automatic fade in/out
- Play multiple sounds simultaneously
- Adjustable fade in/fade out times per sound
- Individual volume control per sound
- Master volume control with MIDI knob mapping
- Audio output device selection per sound (planned)

### User Interface
- Modern React-based UI with Tailwind CSS
- Drag-and-drop sound reordering
- Visual sound cards with MIDI mapping display
- Settings modal for detailed sound configuration
- Real-time MIDI device detection
- Project dirty state tracking

## Tech Stack

- **Frontend**: React 18, TypeScript
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS
- **Drag & Drop**: dnd-kit
- **Desktop**: Electron 28
- **Build**: Webpack 5
- **Audio**: Web Audio API
- **MIDI**: Web MIDI API

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A MIDI device (optional, for MIDI control)

### Setup

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Build the application:
```bash
npm run build
```

4. Start the application:
```bash
npm start
```

## Development

For development with hot reload:

```bash
# Terminal 1: Build main process and watch
npm run dev:main

# Terminal 2: Start webpack dev server for renderer
npm run dev:renderer

# Terminal 3: Start Electron
npm run dev
```

Or use the concurrent script:
```bash
npm run dev
```

## Project Structure

```
soundboard/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # Main process entry
│   │   ├── preload.ts        # Context bridge
│   │   ├── storage.ts        # Electron-store wrapper
│   │   └── projectManager.ts # Project save/load
│   │
│   ├── renderer/             # React application
│   │   ├── components/       # React components
│   │   │   ├── Header.tsx    # Top bar with project controls
│   │   │   ├── Sidebar.tsx   # Settings and MIDI devices
│   │   │   ├── SoundsGrid.tsx# Drag-and-drop grid
│   │   │   ├── SoundCard.tsx # Individual sound card
│   │   │   └── SoundSettingsModal.tsx # Settings modal
│   │   │
│   │   ├── store/            # Redux store
│   │   │   ├── index.ts      # Store configuration
│   │   │   ├── hooks.ts      # Typed Redux hooks
│   │   │   ├── soundsSlice.ts# Sounds state
│   │   │   ├── settingsSlice.ts # Settings state
│   │   │   └── uiSlice.ts    # UI state
│   │   │
│   │   ├── styles/           # Styles
│   │   │   └── index.css     # Tailwind CSS entry
│   │   │
│   │   ├── audioEngine.ts    # Web Audio API wrapper
│   │   ├── midiHandler.ts    # Web MIDI API wrapper
│   │   ├── soundManager.ts   # Sound and MIDI management
│   │   ├── App.tsx           # Main App component
│   │   ├── index.tsx         # React entry point
│   │   └── index.html        # HTML template
│   │
│   └── shared/               # Shared types
│       └── types.ts          # TypeScript definitions
│
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json             # Base TypeScript config
├── tsconfig.main.json        # Main process TypeScript config
├── tsconfig.renderer.json    # Renderer process TypeScript config
├── webpack.config.js         # Webpack configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
└── README.md
```

## Usage

### Project Management

#### Creating a New Project
1. Click "New" in the header
2. Add sounds and configure settings
3. Click "Save" or "Save As" to save the project

#### Saving a Project
- **Save**: Save to current file (Ctrl+S)
- **Save As**: Save to a new file with custom name

#### Loading a Project
1. Click "Open" in the header
2. Select a `.sboard` project file
3. All sounds and settings will be loaded

### Adding and Managing Sounds

1. Click "Add Sound" in the header
2. Select an audio file (MP3, WAV, OGG, FLAC, M4A, AAC)
3. The sound appears as a card in the grid
4. Drag and drop to reorder sounds
5. Click "Edit" to configure sound settings

### Configuring Sounds

Click "Edit" on any sound card to open settings:

- **Name**: Change the display name
- **Play Mode**: Choose between Trigger or Gate mode
- **Volume**: Set individual sound volume (0-100%)
- **Fade In/Out**: Set fade times in milliseconds (for Gate mode)
- **MIDI Mapping**: Assign a MIDI key to trigger the sound
- **Output Device**: Select specific audio output (coming soon)

### MIDI Mapping

#### Mapping a Sound to MIDI

1. Click "Edit" on a sound card
2. Click "Assign MIDI Key"
3. The app shows "Listening for MIDI input..."
4. Press the desired MIDI key on your device
5. The mapping is saved automatically

#### Mapping Master Volume

1. In the sidebar, click "Map MIDI Knob"
2. Turn a knob or move a fader on your MIDI device
3. The mapping is saved automatically
4. The knob now controls master volume

#### Mapping Stop All Sounds

1. In the sidebar under "Stop All Mapping", click "Map MIDI Key"
2. Press the desired MIDI key
3. This key will now stop all playing sounds instantly

### Play Modes Explained

**Trigger Mode**:
- Sound plays once when MIDI key is pressed
- Continues playing even if key is released
- Ideal for: drum hits, sound effects, one-shots

**Gate Mode**:
- Sound starts playing when MIDI key is pressed (with fade in)
- Sound stops when MIDI key is released (with fade out)
- Fade times are configurable per sound
- Ideal for: sustained sounds, loops, pads

### Keyboard Shortcuts

- **Ctrl+N**: New project
- **Ctrl+O**: Open project
- **Ctrl+S**: Save project
- **Ctrl+Shift+S**: Save project as

### Tips

- Sounds are saved with their order, so drag-and-drop arrangement persists
- The asterisk (*) next to the project name indicates unsaved changes
- Multiple sounds can use the same MIDI key from different devices
- Use the "Stop All" button or mapped MIDI key for emergency stops
- Project files (.sboard) contain all settings and file references

## Architecture

### State Management

The app uses Redux Toolkit with three slices:

1. **soundsSlice**: Manages the array of sounds
2. **settingsSlice**: Manages app settings (volume, fade times, mappings)
3. **uiSlice**: Manages UI state (modals, listening mode, project path)

### Component Structure

- **App.tsx**: Root component, manages engine initialization and project operations
- **Header.tsx**: Project controls and action buttons
- **Sidebar.tsx**: Master volume, MIDI mappings, device list
- **SoundsGrid.tsx**: Drag-and-drop grid container using dnd-kit
- **SoundCard.tsx**: Individual draggable sound card
- **SoundSettingsModal.tsx**: Modal for detailed sound configuration

### IPC Communication

The app uses Electron's `contextBridge` for secure IPC:
- Project save/load operations
- File dialogs for sounds and projects
- Settings persistence

## Troubleshooting

### MIDI Device Not Detected

- Ensure your MIDI device is connected before starting the app
- Check browser MIDI permissions
- Restart the app to refresh device list

### Sound Not Playing

- Check that the audio file is a supported format
- Verify master volume and individual sound volume
- Check the browser console for loading errors

### Build Errors

- Delete `node_modules` and run `npm install` again
- Ensure TypeScript version is 5.3+
- Clear `dist` folder and rebuild

### Drag and Drop Not Working

- Make sure you're clicking and holding on the card body (not buttons)
- Check that sounds have valid order properties

## Future Enhancements

- Multiple audio output routing per sound
- Sample looping options
- Waveform visualization
- Sound groups and categories
- MIDI learn mode for all mappings
- Keyboard shortcut customization
- Performance metrics view
- Export/import sound banks

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository.
