import { create } from "zustand";

// Live floating reactions (Zoom-style). Ephemeral and ultra-light — kept in their
// own store so a flurry of emotes never re-renders the Room tree, only the overlay.
let counter = 0;

type Emote = { id: number; emoji: string; x: number };

type EmoteState = {
  emotes: Emote[];
  push: (emoji: string) => void;
  remove: (id: number) => void;
};

export const useEmotes = create<EmoteState>((set) => ({
  emotes: [],
  push: (emoji) => {
    const id = ++counter;
    const x = Math.floor(Math.random() * 70); // a little horizontal spread near the corner
    set((s) => ({ emotes: [...s.emotes.slice(-40), { id, emoji, x }] }));
  },
  remove: (id) => set((s) => ({ emotes: s.emotes.filter((e) => e.id !== id) })),
}));
