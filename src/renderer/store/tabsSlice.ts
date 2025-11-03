import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { Tab, TabLayoutType } from '../../shared/types';

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
      state.tabs = action.payload;
    },
    setTabs: (state, action: PayloadAction<Tab[]>) => {
      state.tabs = action.payload;
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
} = tabsSlice.actions;

export default tabsSlice.reducer;
