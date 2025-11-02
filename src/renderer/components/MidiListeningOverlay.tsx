import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { stopMidiListening } from '../store/uiSlice';

interface MidiListeningOverlayProps {
  assignmentTarget?: string;
}

const MidiListeningOverlay: React.FC<MidiListeningOverlayProps> = ({ assignmentTarget }) => {
  const dispatch = useAppDispatch();
  const ui = useAppSelector(state => state.ui);

  if (!ui.isMidiListening) return null;

  const getAssignmentMessage = () => {
    switch (ui.listeningMode) {
      case 'volume':
        return 'Assign MIDI Knob to Master Volume';
      case 'stopall':
        return 'Assign MIDI Key to Stop All';
      case 'sound':
        return assignmentTarget ? `Assign MIDI Key to "${assignmentTarget}"` : 'Assign MIDI Key to Sound';
      default:
        return 'Waiting for MIDI Input...';
    }
  };

  const getInstructionMessage = () => {
    switch (ui.listeningMode) {
      case 'volume':
        return 'Move any MIDI knob or fader to assign it to the master volume control';
      case 'stopall':
        return 'Press any MIDI key to assign it to the Stop All function';
      case 'sound':
        return 'Press any MIDI key to assign it to this sound';
      default:
        return 'Waiting for MIDI input...';
    }
  };

  const handleCancel = () => {
    dispatch(stopMidiListening());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-dark-700 border-2 border-blue-500 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-center mb-6">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse mr-3"></div>
          <h2 className="text-2xl font-bold text-blue-400">Listening for MIDI...</h2>
        </div>

        <div className="text-center mb-6">
          <p className="text-xl font-semibold text-dark-50 mb-3">{getAssignmentMessage()}</p>
          <p className="text-sm text-dark-200">{getInstructionMessage()}</p>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded p-4 mb-6">
          <p className="text-xs text-dark-300 text-center">
            The assignment will be made automatically when a MIDI signal is detected
          </p>
        </div>

        <button
          onClick={handleCancel}
          className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-white font-medium transition-colors"
        >
          Cancel Assignment
        </button>
      </div>
    </div>
  );
};

export default MidiListeningOverlay;
