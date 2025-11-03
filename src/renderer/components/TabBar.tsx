import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addTab, removeTab, renameTab, setTabColor, setActiveTab } from '../store/tabsSlice';
import { reassignSoundsTab } from '../store/soundsSlice';

const TabBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(state => state.tabs.tabs);
  const activeTabId = useAppSelector(state => state.tabs.activeTabId);
  const [editingName, setEditingName] = useState('');
  const [settingsModalTabId, setSettingsModalTabId] = useState<string | null>(null);

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
    dispatch(addTab());
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

  const settingsTab = settingsModalTabId ? tabs.find(t => t.id === settingsModalTabId) : null;

  return (
    <>
      <div className="bg-dark-800 border-b border-dark-600 flex items-center gap-1 overflow-x-auto relative z-20">
        {tabs.map((tab) => (
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
              <span className="text-xs font-medium text-dark-100">{tab.name}</span>

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
            <div className="mb-6">
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
