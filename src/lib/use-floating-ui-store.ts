import { create } from 'zustand'

interface FloatingUiState {
  startTrackingOpen: boolean
  setStartTrackingOpen: (open: boolean) => void
}

export const useFloatingUiStore = create<FloatingUiState>((set) => ({
  startTrackingOpen: false,
  setStartTrackingOpen: (open) => set({ startTrackingOpen: open }),
}))
