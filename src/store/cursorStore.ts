import { create } from "zustand";

// Live cursors update ~20×/sec — kept in their OWN store (not the room store) so a
// cursor frame only re-renders the canvas layer that reads it, never the whole Room
// tree (EstimateBoard, header, tabs, footer). This is the difference between a smooth
// 20-person room and one that drops frames on every mouse move.
type CursorEntry = { id: string; name: string; x: number; y: number; drag?: { cardId: string; x: number; y: number } };

type CursorState = {
  cursors: CursorEntry[];
  setCursors: (cursors: CursorEntry[]) => void;
};

export const useCursors = create<CursorState>((set) => ({
  cursors: [],
  setCursors: (cursors) => set({ cursors }),
}));
