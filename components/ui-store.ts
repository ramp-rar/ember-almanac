'use client';

import { create } from 'zustand';
import type { PaletteName } from '@/components/calendar/palette';

/** UI-only state that does not belong in the shareable URL. */
interface UiState {
  palette: PaletteName;
  newestFirst: boolean;
  /** Point picked on the map, offered to the coordinates form. */
  draftPoint: { lat: number; lon: number } | null;
  setPalette: (p: PaletteName) => void;
  toggleOrder: () => void;
  setDraftPoint: (p: { lat: number; lon: number } | null) => void;
}

export const useUi = create<UiState>((set) => ({
  palette: 'inferno',
  newestFirst: false,
  draftPoint: null,
  setPalette: (palette) => set({ palette }),
  toggleOrder: () => set((s) => ({ newestFirst: !s.newestFirst })),
  setDraftPoint: (draftPoint) => set({ draftPoint }),
}));
