import { MidiDevice, MidiMessage } from '../shared/types';

type MidiMessageCallback = (message: MidiMessage) => void;

export class MidiHandler {
  private midiAccess: MIDIAccess | null = null;
  private listeners: Set<MidiMessageCallback> = new Set();
  private isListening: boolean = false;
  private connectedDevices: Map<string, MIDIInput> = new Map();

  public async initialize(): Promise<void> {
    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });

      // Set up device connection listeners
      this.midiAccess.onstatechange = (event) => {
        this.handleDeviceStateChange(event);
      };

      // Connect to all available inputs
      this.connectToAllInputs();
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      throw new Error('MIDI access denied or not supported');
    }
  }

  private connectToAllInputs(): void {
    if (!this.midiAccess) return;

    this.midiAccess.inputs.forEach((input) => {
      this.connectToInput(input);
    });
  }

  private connectToInput(input: MIDIInput): void {
    if (this.connectedDevices.has(input.id)) return;

    input.onmidimessage = (event) => {
      this.handleMidiMessage(event, input);
    };

    this.connectedDevices.set(input.id, input);
    console.log(`Connected to MIDI device: ${input.name} (${input.id})`);
  }

  private disconnectFromInput(inputId: string): void {
    const input = this.connectedDevices.get(inputId);
    if (input) {
      input.onmidimessage = null;
      this.connectedDevices.delete(inputId);
      console.log(`Disconnected from MIDI device: ${input.name} (${inputId})`);
    }
  }

  private handleDeviceStateChange(event: MIDIConnectionEvent): void {
    const port = event.port;
    if (!port) return;

    if (port.type === 'input') {
      if (port.state === 'connected') {
        this.connectToInput(port as MIDIInput);
      } else if (port.state === 'disconnected') {
        this.disconnectFromInput(port.id);
      }
    }
  }

  private handleMidiMessage(event: MIDIMessageEvent, input: MIDIInput): void {
    if (!event.data || event.data.length < 2) return;

    const status = event.data[0];
    const data1 = event.data[1];
    const data2 = event.data[2] || 0;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    let message: MidiMessage | null = null;

    switch (messageType) {
      case 0x90: // Note On
        if (data2 > 0) {
          message = {
            type: 'noteon',
            deviceId: input.id,
            deviceName: input.name || 'Unknown',
            note: data1,
            value: data2,
            channel,
            timestamp: event.timeStamp,
          };
        } else {
          // Note on with velocity 0 is treated as note off
          message = {
            type: 'noteoff',
            deviceId: input.id,
            deviceName: input.name || 'Unknown',
            note: data1,
            value: 0,
            channel,
            timestamp: event.timeStamp,
          };
        }
        break;

      case 0x80: // Note Off
        message = {
          type: 'noteoff',
          deviceId: input.id,
          deviceName: input.name || 'Unknown',
          note: data1,
          value: data2,
          channel,
          timestamp: event.timeStamp,
        };
        break;

      case 0xb0: // Control Change
        message = {
          type: 'cc',
          deviceId: input.id,
          deviceName: input.name || 'Unknown',
          ccNumber: data1,
          value: data2,
          channel,
          timestamp: event.timeStamp,
        };
        break;
    }

    if (message) {
      this.notifyListeners(message);
    }
  }

  private notifyListeners(message: MidiMessage): void {
    this.listeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in MIDI message listener:', error);
      }
    });
  }

  public addListener(callback: MidiMessageCallback): void {
    this.listeners.add(callback);
  }

  public removeListener(callback: MidiMessageCallback): void {
    this.listeners.delete(callback);
  }

  public getDevices(): MidiDevice[] {
    if (!this.midiAccess) return [];

    const devices: MidiDevice[] = [];
    this.midiAccess.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
      });
    });

    return devices;
  }

  public startListening(): void {
    this.isListening = true;
  }

  public stopListening(): void {
    this.isListening = false;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public destroy(): void {
    // Disconnect all inputs
    this.connectedDevices.forEach((input, id) => {
      this.disconnectFromInput(id);
    });

    this.listeners.clear();

    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
    }
  }
}
