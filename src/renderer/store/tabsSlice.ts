import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { Tab, TabLayoutType, VolumeMapping } from '../../shared/types';

interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
}

const defaultTabId = 'default-tab';

const initialState: TabsState = {
  tabs: [
    {
      id: defaultTabId,
      name: 'Main',
      color: '#3b82f6', // blue
      order: 0,
      layoutType: 'free',
    },
  ],
  activeTabId: defaultTabId,
};

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    addTab: (state, action: PayloadAction<{ layoutType?: TabLayoutType; shouldGenerateSounds?: boolean }>) => {
      const layoutType = action.payload?.layoutType || 'free';
      let tabName = `Tab ${state.tabs.length + 1}`;
      if (layoutType === 'apc-mini') {
        tabName = 'APC MINI';
      } else if (layoutType === 'apc-key25') {
        tabName = 'APC KEY25';
      } else if (layoutType === 'apc-key') {
        tabName = 'APC KEY';
      } else if (layoutType === 'apc-right') {
        tabName = 'APC RIGHT';
      }
      const newTab: Tab = {
        id: uuidv4(),
        name: tabName,
        color: '#6b7280', // gray
        order: state.tabs.length,
        layoutType,
      };
      state.tabs.push(newTab);
      state.activeTabId = newTab.id;
    },
    removeTab: (state, action: PayloadAction<string>) => {
      const tabId = action.payload;
      // Don't allow removing the last tab
      if (state.tabs.length <= 1) return;

      state.tabs = state.tabs.filter(t => t.id !== tabId);

      // If we deleted the active tab, switch to first tab
      if (state.activeTabId === tabId) {
        state.activeTabId = state.tabs[0]?.id || null;
      }

      // Reorder remaining tabs
      state.tabs.forEach((tab, index) => {
        tab.order = index;
      });
    },
    renameTab: (state, action: PayloadAction<{ tabId: string; name: string }>) => {
      const tab = state.tabs.find(t => t.id === action.payload.tabId);
      if (tab) {
        tab.name = action.payload.name;
      }
    },
    setTabColor: (state, action: PayloadAction<{ tabId: string; color: string }>) => {
      const tab = state.tabs.find(t => t.id === action.payload.tabId);
      if (tab) {
        tab.color = action.payload.color;
      }
    },
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTabId = action.payload;
    },
    reorderTabs: (state, action: PayloadAction<Tab[]>) => {
      // Clear the array and repopulate it with updated order
      state.tabs.splice(0, state.tabs.length);
      action.payload.forEach((tab, index) => {
        state.tabs.push({ ...tab, order: index });
      });
    },
    setTabs: (state, action: PayloadAction<Tab[]>) => {
      state.tabs = action.payload;
    },
    setTabMidiMapping: (state, action: PayloadAction<{ tabId: string; mapping: { deviceId: string; deviceName: string; note: number; channel: number } | undefined }>) => {
      const tab = state.tabs.find(t => t.id === action.payload.tabId);
      if (tab) {
        tab.midiMapping = action.payload.mapping;
      }
    },
    setTabRowLabel: (state, action: PayloadAction<{ tabId: string; rowIndex: number; label: string }>) => {
      const tab = state.tabs.find(t => t.id === action.payload.tabId);
      if (tab) {
        if (!tab.rowLabels) {
          tab.rowLabels = [];
        }
        tab.rowLabels[action.payload.rowIndex] = action.payload.label;
      }
    },
    setTabVolume: (state, action: PayloadAction<{ tabId: string; volume: number }>) => {
      const tab = state.tabs.find(t => t.id === action.payload.tabId);
      if (tab) {
        tab.volume = action.payload.volume;
      }
    },
    setTabVolumeMapping: (state, action: PayloadAction<{ tabId: string; mapping: VolumeMapping | undefined }>) => {
      const tab = state.tabs.find(t => t.id === action.payload.tabId);
      if (tab) {
        tab.volumeMapping = action.payload.mapping;
      }
    },
    updateTab: (state, action: PayloadAction<{ id: string; updates: Partial<Tab> }>) => {
      const tab = state.tabs.find(t => t.id === action.payload.id);
      if (tab) {
        Object.assign(tab, action.payload.updates);
      }
    },
  },
});

export const {
  addTab,
  removeTab,
  renameTab,
  setTabColor,
  setActiveTab,
  reorderTabs,
  setTabs,
  setTabRowLabel,
  setTabMidiMapping,
  setTabVolume,
  setTabVolumeMapping,
  updateTab,
} = tabsSlice.actions;

export default tabsSlice.reducer;
