import { create } from 'zustand';

const DEFAULT_SIDEBAR_WIDTH = 240;
/** Below this width (px) the sidebar collapses. */
const COLLAPSE_THRESHOLD = 120;
/** Width the sidebar restores to when un-collapsed. */
const RESTORE_WIDTH = 240;

interface AppState {
  activeTool: string;
  setActiveTool: (tool: string) => void;

  sidebarWidth: number;
  sidebarCollapsed: boolean;
  setSidebarWidth: (width: number) => void;
  collapseSidebar: () => void;
  expandSidebar: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTool: 'audio-converter',
  setActiveTool: (tool) => set({ activeTool: tool }),

  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  sidebarCollapsed: false,
  setSidebarWidth: (width) => {
    // Dragging below the threshold collapses the sidebar.
    if (width < COLLAPSE_THRESHOLD) {
      set({ sidebarCollapsed: true });
    } else {
      set({ sidebarWidth: width, sidebarCollapsed: false });
    }
  },
  collapseSidebar: () => set({ sidebarCollapsed: true }),
  expandSidebar: () =>
    set({
      sidebarCollapsed: false,
      sidebarWidth: Math.max(get().sidebarWidth, RESTORE_WIDTH),
    }),
}));
