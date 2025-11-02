import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addTab, removeTab, renameTab, setTabColor, setActiveTab } from '../store/tabsSlice';
import { reassignSoundsTab } from '../store/soundsSlice';

const TabBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(state => state.tabs.tabs);
  const activeTabId = useAppSelector(state => state.tabs.activeTabId);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [colorPickerTabId, setColorPickerTabId] = useState<string | null>(null);

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

  const handleDoubleClick = (tab: { id: string; name: string }) => {
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };

  const handleRename = (tabId: string) => {
    if (editingName.trim()) {
      dispatch(renameTab({ tabId, name: editingName.trim() }));
    }
    setEditingTabId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      handleRename(tabId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingName('');
    }
  };

  const handleColorChange = (tabId: string, color: string) => {
    dispatch(setTabColor({ tabId, color }));
    setColorPickerTabId(null);
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

  return (
    <div className="bg-dark-700 border-b-2 border-dark-500 px-6 py-2 flex items-center gap-2 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="relative group"
        >
          <div
            onClick={() => handleTabClick(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab)}
            onContextMenu={(e) => {
              e.preventDefault();
              setColorPickerTabId(colorPickerTabId === tab.id ? null : tab.id);
            }}
            className={`px-4 py-2 rounded-t-lg cursor-pointer transition-all flex items-center gap-2 ${
              activeTabId === tab.id
                ? 'ring-2 ring-white ring-opacity-30'
                : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: tab.color,
            }}
          >
            {editingTabId === tab.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleRename(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                className="bg-dark-800 text-dark-50 px-2 py-0.5 rounded text-sm w-24 focus:outline-none focus:ring-2 focus:ring-white"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm font-semibold text-white">{tab.name}</span>
            )}

            {tabs.length > 1 && activeTabId === tab.id && (
              <button
                onClick={(e) => handleDeleteTab(e, tab.id)}
                className="opacity-0 group-hover:opacity-100 ml-1 text-white hover:text-red-300 transition-opacity"
                title="Delete tab"
              >
                ✕
              </button>
            )}
          </div>

          {/* Color Picker Dropdown */}
          {colorPickerTabId === tab.id && (
            <div className="absolute top-full left-0 mt-1 bg-dark-600 border-2 border-dark-500 rounded-lg p-3 z-50 shadow-xl">
              <div className="text-xs text-dark-200 mb-2 font-semibold">Choose Color</div>
              <div className="grid grid-cols-4 gap-2">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(tab.id, color)}
                    className="w-8 h-8 rounded-full border-2 border-dark-400 hover:border-white transition-all hover:scale-110"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-dark-500">
                <div className="text-xs text-dark-300 mb-1">Double-click to rename</div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add Tab Button */}
      <button
        onClick={handleAddTab}
        className="px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
        title="Add new tab"
      >
        <span>+</span>
        <span>Tab</span>
      </button>
    </div>
  );
};

export default TabBar;
