import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addTab, removeTab, renameTab, setTabColor, setActiveTab, reorderTabs, setTabMidiMapping } from '../store/tabsSlice';
import { reassignSoundsTab } from '../store/soundsSlice';
import { startMidiListening } from '../store/uiSlice';

const TabBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(state => state.tabs.tabs);
  const activeTabId = useAppSelector(state => state.tabs.activeTabId);
  const [editingName, setEditingName] = useState('');
  const [settingsModalTabId, setSettingsModalTabId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

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
    if (tabs.length > 1) {
      if (window.confirm('Delete this tab? Sounds in this tab will be moved to the first tab.')) {
        // First reassign all sounds from this tab to the first tab
        const firstTab = tabs.find(t => t.id !== tabId);
        if (firstTab) {
          dispatch(reassignSoundsTab({ fromTabId: tabId, toTabId: firstTab.id }));
        }
        // Then remove the tab
        dispatch(removeTab(tabId));
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTabId(tabId);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetTabId) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }

    const draggedIndex = tabs.findIndex(t => t.id === draggedTabId);
    const targetIndex = tabs.findIndex(t => t.id === targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    dispatch(reorderTabs(newTabs));
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleAssignMidiToTab = (tabId: string) => {
    dispatch(startMidiListening({ mode: 'tab', target: tabId }));
  };

  const handleRemoveMidiFromTab = (tabId: string) => {
    dispatch(setTabMidiMapping({ tabId, mapping: undefined }));
  };

  const settingsTab = settingsModalTabId ? tabs.find(t => t.id === settingsModalTabId) : null;

  return (
    <>
      <div className="bg-dark-800 border-b border-dark-600 flex items-center gap-1 overflow-x-auto relative z-20">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="relative group"
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, tab.id)}
          >
            <div
              onClick={() => handleTabClick(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSettingsModalTabId(tab.id);
                setEditingName(tab.name);
              }}
              className={`px-3 py-1.5 cursor-move transition-all flex items-center gap-2 border-b-2 ${
                activeTabId === tab.id
                  ? 'border-opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-100'
              } ${
                dragOverTabId === tab.id && draggedTabId !== tab.id
                  ? 'bg-dark-700'
                  : ''
              } ${
                draggedTabId === tab.id
                  ? 'opacity-50'
                  : ''
              }`}
              style={{
                borderBottomColor: activeTabId === tab.id ? tab.color : 'transparent',
              }}
            >
              <span className="text-xs font-medium text-dark-100">{tab.name}</span>

              {/* MIDI indicator */}
              {tab.midiMapping && (
                <span className="text-[8px] text-green-400" title={`MIDI: Note ${tab.midiMapping.note}`}>
                  🎹
                </span>
              )}

              {tabs.length > 1 && activeTabId === tab.id && (
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
                  8 knobs (bidirectional) + 5 buttons + 1 button. AKAI APC RIGHT controller.
                </div>
                <div className="flex flex-col gap-1">
                  {/* Knobs preview - 2 rows of 4 */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex gap-0.5 justify-center">
                      {[...Array(4)].map((_, i) => (
                        <div key={`k1-${i}`} className="w-4 h-4 rounded-full bg-purple-600" />
                      ))}
                    </div>
                    <div className="flex gap-0.5 justify-center">
                      {[...Array(4)].map((_, i) => (
                        <div key={`k2-${i}`} className="w-4 h-4 rounded-full bg-purple-600" />
                      ))}
                    </div>
                  </div>
                  {/* Buttons preview */}
                  <div className="flex flex-col gap-0.5 mt-1">
                    <div className="flex gap-0.5 justify-center">
                      {[...Array(5)].map((_, i) => (
                        <div key={`b1-${i}`} className="w-4 h-2 bg-blue-600 rounded-sm" />
                      ))}
                    </div>
                    <div className="flex justify-center">
                      <div className="w-4 h-2 bg-blue-600 rounded-sm" />
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
