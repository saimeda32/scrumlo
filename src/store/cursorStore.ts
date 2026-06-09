import { create } from "zustand";

// Live cursors update ~20×/sec · kept in their OWN store (not the room store) so a
// cursor frame only re-renders the canvas layer that reads it, never the whole Room
// tree (EstimateBoard, header, tabs, footer). This is the difference between a smooth
// 20-person room and one that drops frames on every mouse move.
type CursorEntry = { id: string; name: string; x: number; y: number; drag?: { cardId: string; x: number; y: number } };

type CursorState = {
  cursors: CursorEntry[];
  // Live drags indexed by card id, so a card can look up "is a teammate dragging me?"
  // in O(1) instead of every card running a .find() over every cursor ~20x/sec.
  dragsByCard: Record<string, { x: number; y: number }>;
  setCursors: (cursors: CursorEntry[]) => void;
};

export const useCursors = create<CursorState>((set) => ({
  cursors: [],
  dragsByCard: {},
  setCursors: (cursors) => {
    const dragsByCard: Record<string, { x: number; y: number }> = {};
    for (const c of cursors) if (c.drag) dragsByCard[c.drag.cardId] = { x: c.drag.x, y: c.drag.y };
    set({ cursors, dragsByCard });
  },
}));
