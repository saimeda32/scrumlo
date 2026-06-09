import { create } from "zustand";

// The current "pick a person" spin, broadcast from the server so every screen lands
// on the same name. Kept in its own tiny store (like cursors/emotes) so a spin never
// re-renders the whole Room tree, only the overlay that reads it.
type Spotlight = { name: string; by: string; nonce: number };

type SpotlightState = {
  current: Spotlight | null;
  show: (s: Spotlight) => void;
  clear: () => void;
};

export const useSpotlight = create<SpotlightState>((set) => ({
  current: null,
  show: (current) => set({ current }),
  clear: () => set({ current: null }),
}));
