import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addTab, removeTab, renameTab, setTabColor, setActiveTab, reorderTabs, setTabMidiMapping, setTabVolume, setTabVolumeMapping } from '../store/tabsSlice';
import { reassignSoundsTab } from '../store/soundsSlice';
import { startMidiListening, setDirty } from '../store/uiSlice';

const TabBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(state => state.tabs.tabs);
  const activeTabId = useAppSelector(state => state.tabs.activeTabId);
  const [editingName, setEditingName] = useState('');
  const [settingsModalTabId, setSettingsModalTabId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Sort tabs by their order property for display
  const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);

  const predefinedColors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#6b7280', // gray
  ];

  const handleAddTab = () => {
    setShowCreateModal(true);
  };

  const handleCreateTab = (layoutType: 'free' | 'apc-mini' | 'apc-key25' | 'apc-key' | 'apc-right') => {
    dispatch(addTab({ layoutType, shouldGenerateSounds: layoutType === 'apc-key25' }));
    setShowCreateModal(false);
  };

  const handleTabClick = (tabId: string) => {
    dispatch(setActiveTab(tabId));
  };

  const handleColorChange = (tabId: string, color: string) => {
    dispatch(setTabColor({ tabId, color }));
  };

  const handleRenameInModal = (tabId: string, newName: string) => {
    if (newName.trim()) {
      dispatch(renameTab({ tabId, name: newName.trim() }));
    }
  };

  const handleDeleteTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (sortedTabs.length > 1) {
      if (window.confirm('Delete this tab? Sounds in this tab will be moved to the first tab.')) {
        // First reassign all sounds from this tab to the first tab
        const firstTab = sortedTabs.find(t => t.id !== tabId);
        if (firstTab) {
          dispatch(reassignSoundsTab({ fromTabId: tabId, toTabId: firstTab.id }));
        }
        // Then remove the tab
        dispatch(removeTab(tabId));
      }
    }
  };

  const handleAssignMidiToTab = (tabId: string) => {
    dispatch(startMidiListening({ mode: 'tab', target: tabId }));
  };

  const handleRemoveMidiFromTab = (tabId: string) => {
    dispatch(setTabMidiMapping({ tabId, mapping: undefined }));
  };

  const handleVolumeChange = (tabId: string, volume: number) => {
    dispatch(setTabVolume({ tabId, volume }));
    dispatch(setDirty(true));
  };

  const handleAssignVolumeMapping = (tabId: string) => {
    dispatch(startMidiListening({ mode: 'tab-volume', target: tabId }));
  };

  const handleRemoveVolumeMapping = (tabId: string) => {
    dispatch(setTabVolumeMapping({ tabId, mapping: undefined }));
    dispatch(setDirty(true));
  };

  const handleMoveTabLeft = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const currentIndex = sortedTabs.findIndex(t => t.id === tabId);
    if (currentIndex > 0) {
      const newTabs = [...sortedTabs];
      const [tab] = newTabs.splice(currentIndex, 1);
      newTabs.splice(currentIndex - 1, 0, tab);
      dispatch(reorderTabs(newTabs));
    }
  };

  const handleMoveTabRight = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const currentIndex = sortedTabs.findIndex(t => t.id === tabId);
    if (currentIndex < sortedTabs.length - 1) {
      const newTabs = [...sortedTabs];
      const [tab] = newTabs.splice(currentIndex, 1);
      newTabs.splice(currentIndex + 1, 0, tab);
      dispatch(reorderTabs(newTabs));
    }
  };

  const settingsTab = settingsModalTabId ? sortedTabs.find(t => t.id === settingsModalTabId) : null;

  return (
    <>
      <div className="bg-dark-800 border-b border-dark-600 flex items-center gap-1 overflow-x-auto relative z-20">
        {sortedTabs.map((tab) => (
          <div
            key={tab.id}
            className="relative group"
          >
            <div
              onClick={() => handleTabClick(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSettingsModalTabId(tab.id);
                setEditingName(tab.name);
              }}
              className={`px-3 py-1.5 cursor-pointer transition-all flex items-center gap-2 border-b-2 ${
                activeTabId === tab.id
                  ? 'border-opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              style={{
                borderBottomColor: activeTabId === tab.id ? tab.color : 'transparent',
              }}
            >
              {/* Move left button */}
              {activeTabId === tab.id && sortedTabs.findIndex(t => t.id === tab.id) > 0 && (
                <button
                  onClick={(e) => handleMoveTabLeft(e, tab.id)}
                  className="text-xs text-dark-300 hover:text-dark-100 transition-colors"
                  title="Move tab left"
                >
                  ◀
                </button>
              )}

              <span className="text-xs font-medium text-dark-100">{tab.name}</span>

              {/* MIDI indicator */}
              {tab.midiMapping && (
                <span className="text-[8px] text-green-400" title={`MIDI: Note ${tab.midiMapping.note}`}>
                  🎹
                </span>
              )}

              {/* Move right button */}
              {activeTabId === tab.id && sortedTabs.findIndex(t => t.id === tab.id) < sortedTabs.length - 1 && (
                <button
                  onClick={(e) => handleMoveTabRight(e, tab.id)}
                  className="text-xs text-dark-300 hover:text-dark-100 transition-colors"
                  title="Move tab right"
                >
                  ▶
                </button>
              )}

              {sortedTabs.length > 1 && activeTabId === tab.id && (
                <button
                  onClick={(e) => handleDeleteTab(e, tab.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-dark-300 hover:text-red-400 transition-opacity"
                  title="Delete tab"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add Tab Button */}
        <button
          onClick={handleAddTab}
          className="px-3 py-1.5 hover:bg-dark-700 text-xs text-dark-300 hover:text-dark-100 transition-colors"
          title="Add new tab"
        >
          + Tab
        </button>
      </div>

      {/* Create Tab Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-700 rounded-lg p-6 w-[1200px] border border-dark-600">
            <h2 className="text-lg font-semibold mb-4">Create New Tab</h2>
            <p className="text-sm text-dark-300 mb-6">Choose a layout for your new tab:</p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Empty Page Option */}
              <button
                onClick={() => handleCreateTab('free')}
                className="p-4 bg-dark-600 hover:bg-dark-500 border-2 border-dark-500 hover:border-blue-500 rounded-lg transition-all text-left"
              >
                <div className="text-base font-medium mb-2">Empty Sound Page</div>
                <div className="text-xs text-dark-300 mb-3">
                  Free-form layout. Add sounds anywhere, drag to reorder.
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="w-12 h-12 bg-dark-500 rounded" />
                  ))}
                </div>
              </button>

              {/* APC MINI Layout Option */}
              <button
                onClick={() => handleCreateTab('apc-mini')}
                className="p-4 bg-dark-600 hover:bg-dark-500 border-2 border-dark-500 hover:border-blue-500 rounded-lg transition-all text-left"
              >
                <div className="text-base font-medium mb-2">APC MINI Layout</div>
                <div className="text-xs text-dark-300 mb-3">
                  Fixed 8×8 grid + 8 bottom + 9 side buttons. Matches APC MINI controller.
                </div>
                <div className="flex flex-col gap-0.5">
                  {/* Top section: 8x8 grid + side column preview */}
                  <div className="flex gap-0.5">
                    {/* 8x8 grid preview */}
                    <div className="grid grid-cols-8 gap-[1px] flex-1">
                      {[...Array(64)].map((_, i) => (
                        <div key={i} className="aspect-[2.5/1] bg-blue-600" />
                      ))}
                    </div>
                    {/* Right side column */}
                    <div className="flex flex-col gap-[1px]" style={{ width: '12.5%' }}>
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="aspect-[2.5/1] bg-green-600 rounded-sm" />
                      ))}
                    </div>
                  </div>
                  {/* Bottom section: 8 rounded buttons + square button */}
                  <div className="flex gap-0.5">
                    {/* Bottom row */}
                    <div className="grid grid-cols-8 gap-[1px] flex-1">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="aspect-[2.5/1] bg-green-600 rounded-sm" />
                      ))}
                    </div>
                    {/* Square button */}
                    <div style={{ width: '12.5%' }}>
                      <div className="aspect-[2.5/1] bg-red-600" />
                    </div>
                  </div>
                </div>
              </button>

              {/* APC KEY25 Layout Option */}
              <button
                onClick={() => handleCreateTab('apc-key25')}
                className="p-4 bg-dark-600 hover:bg-dark-500 border-2 border-dark-500 hover:border-blue-500 rounded-lg transition-all text-left"
              >
                <div className="text-base font-medium mb-2">APC KEY25 Layout</div>
                <div className="text-xs text-dark-300 mb-3">
                  25 piano keys (C1-C3). Matches piano keyboard layout.
                </div>
                <div className="flex flex-col gap-0.5">
                  {/* Piano keys preview */}
                  <div className="relative h-16">
                    {/* White keys */}
                    <div className="flex gap-[1px] h-full">
                      {[...Array(15)].map((_, i) => (
                        <div key={`w-${i}`} className="flex-1 bg-gray-300 border border-dark-400" />
                      ))}
                    </div>
                    {/* Black keys positioned on top */}
                    <div className="absolute top-0 left-0 right-0 flex h-10 pointer-events-none">
                      {[...Array(15)].map((_, i) => {
                        // Black keys appear at positions: after 1st, 2nd, 4th, 5th, 6th white keys, then repeat
                        const showBlack = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].includes(i);
                        return (
                          <div key={`b-${i}`} className="flex-1 relative">
                            {showBlack && (
                              <div className="absolute right-[-25%] w-[50%] h-full bg-dark-900 border border-dark-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </button>

              {/* APC KEY Layout Option */}
              <button
                onClick={() => handleCreateTab('apc-key')}
                className="p-4 bg-dark-600 hover:bg-dark-500 border-2 border-dark-500 hover:border-blue-500 rounded-lg transition-all text-left"
              >
                <div className="text-base font-medium mb-2">APC KEY Layout</div>
                <div className="text-xs text-dark-300 mb-3">
                  8×5 grid + 5 right + 9 bottom buttons. Matches APC KEY controller.
                </div>
                <div className="flex flex-col gap-0.5">
                  {/* Top section: 8x5 grid + right column preview */}
                  <div className="flex gap-0.5">
                    {/* 8x5 grid preview */}
                    <div className="grid grid-cols-8 gap-[1px] flex-1">
                      {[...Array(40)].map((_, i) => (
                        <div key={i} className="aspect-[2.5/1] bg-blue-600" />
                      ))}
                    </div>
                    {/* Right side column */}
                    <div className="flex flex-col gap-[1px]" style={{ width: '12.5%' }}>
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="aspect-[2.5/1] bg-green-600" />
                      ))}
                    </div>
                  </div>
                  {/* Bottom section: 9 buttons */}
                  <div className="flex gap-[1px]">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="flex-1 aspect-[2.5/1] bg-green-600" />
                    ))}
                  </div>
                </div>
              </button>

              {/* APC RIGHT Layout Option */}
              <button
                onClick={() => handleCreateTab('apc-right')}
                className="p-4 bg-dark-600 hover:bg-dark-500 border-2 border-dark-500 hover:border-blue-500 rounded-lg transition-all text-left"
              >
                <div className="text-base font-medium mb-2">APC RIGHT Layout</div>
                <div className="text-xs text-dark-300 mb-3">
                  8 knobs with dual sound assignment. Each knob has left/right sides.
                </div>
                <div className="flex flex-col gap-1">
                  {/* Knobs preview - 2 rows of 4 dual buttons */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex gap-0.5 justify-center">
                      {[...Array(4)].map((_, i) => (
                        <div key={`k1-${i}`} className="flex gap-[1px]">
                          <div className="w-2 h-4 bg-purple-600 rounded-l" />
                          <div className="w-2 h-4 bg-purple-600 rounded-r" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-0.5 justify-center">
                      {[...Array(4)].map((_, i) => (
                        <div key={`k2-${i}`} className="flex gap-[1px]">
                          <div className="w-2 h-4 bg-purple-600 rounded-l" />
                          <div className="w-2 h-4 bg-purple-600 rounded-r" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Settings Modal */}
      {settingsTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-700 rounded-lg p-6 w-96 border border-dark-600">
            <h2 className="text-lg font-semibold mb-4">Tab Settings</h2>

            {/* Tab Name */}
            <div className="mb-4">
              <label className="block text-sm text-dark-200 mb-2">Tab Name</label>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded text-dark-50 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Color Selection */}
            <div className="mb-4">
              <label className="block text-sm text-dark-200 mb-2">Tab Color</label>
              <div className="grid grid-cols-8 gap-2">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(settingsTab.id, color)}
                    className={`w-8 h-8 rounded border-2 transition-all ${
                      settingsTab.color === color
                        ? 'border-white scale-110'
                        : 'border-dark-500 hover:border-dark-300'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* MIDI Mapping */}
            <div className="mb-6">
              <label className="block text-sm text-dark-200 mb-2">MIDI Mapping</label>
              {settingsTab.midiMapping ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-dark-600 border border-dark-500 rounded text-sm text-dark-100">
                    🎹 Note {settingsTab.midiMapping.note} (Ch {settingsTab.midiMapping.channel + 1})
                  </div>
                  <button
                    onClick={() => handleRemoveMidiFromTab(settingsTab.id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors"
                    title="Remove MIDI mapping"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAssignMidiToTab(settingsTab.id)}
                  className="w-full px-3 py-2 bg-dark-600 hover:bg-dark-500 border border-dark-500 rounded text-sm transition-colors"
                >
                  🎹 Assign MIDI Note
                </button>
              )}
              <p className="text-xs text-dark-400 mt-1">
                Press a MIDI note to switch to this tab
              </p>
            </div>

            {/* Tab Volume */}
            <div className="mb-4">
              <label className="block text-sm text-dark-200 mb-2">
                Tab Volume: {((settingsTab.volume || 1) * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.01"
                value={settingsTab.volume || 1}
                onChange={(e) => handleVolumeChange(settingsTab.id, parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-dark-400 mt-1">
                <span>0%</span>
                <span>100%</span>
                <span>200%</span>
                <span>300%</span>
              </div>
              <p className="text-xs text-dark-400 mt-1">
                Volume multiplier for all sounds in this tab (allows boosting beyond 100%)
              </p>
            </div>

            {/* Tab Volume MIDI Mapping */}
            <div className="mb-6">
              <label className="block text-sm text-dark-200 mb-2">Volume MIDI Control</label>
              {settingsTab.volumeMapping ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-dark-600 border border-dark-500 rounded text-sm text-dark-100">
                    🎛️ CC {settingsTab.volumeMapping.ccNumber} (Ch {settingsTab.volumeMapping.channel + 1})
                  </div>
                  <button
                    onClick={() => handleRemoveVolumeMapping(settingsTab.id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors"
                    title="Remove volume MIDI mapping"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAssignVolumeMapping(settingsTab.id)}
                  className="w-full px-3 py-2 bg-dark-600 hover:bg-dark-500 border border-dark-500 rounded text-sm transition-colors"
                >
                  🎛️ Assign MIDI CC
                </button>
              )}
              <p className="text-xs text-dark-400 mt-1">
                Use a MIDI fader/knob to control volume for this tab
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setSettingsModalTabId(null);
                  setEditingName('');
                }}
                className="px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRenameInModal(settingsTab.id, editingName);
                  setSettingsModalTabId(null);
                  setEditingName('');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TabBar;
