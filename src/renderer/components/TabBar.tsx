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
    <div className="bg-dark-800 border-b border-dark-600 flex items-center gap-1 overflow-x-auto">
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
            className={`px-3 py-1.5 cursor-pointer transition-all flex items-center gap-2 border-b-2 ${
              activeTabId === tab.id
                ? 'border-opacity-100'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
            style={{
              borderBottomColor: activeTabId === tab.id ? tab.color : 'transparent',
            }}
          >
            {editingTabId === tab.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleRename(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                className="bg-dark-700 text-dark-50 px-2 py-0.5 text-xs w-20 focus:outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs font-medium text-dark-100">{tab.name}</span>
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

          {/* Color Picker Dropdown */}
          {colorPickerTabId === tab.id && (
            <div className="absolute top-full left-0 mt-1 bg-dark-700 border border-dark-600 rounded p-2 z-50 shadow-lg">
              <div className="text-xs text-dark-300 mb-1.5">Color</div>
              <div className="grid grid-cols-4 gap-1.5">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(tab.id, color)}
                    className="w-6 h-6 rounded border border-dark-500 hover:border-dark-300 transition-all"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-dark-600">
                <div className="text-xs text-dark-400">Double-click to rename</div>
              </div>
            </div>
          )}
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
  );
};

export default TabBar;
