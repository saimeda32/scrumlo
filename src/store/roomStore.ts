import { create } from "zustand";
import type {
  Member,
  EstimateView,
  RetroView,
  PickView,
  Activity,
  Snapshot,
} from "../../shared/protocol";

type RoomState = {
  connected: boolean;
  ended: boolean;
  you: string | null;
  facilitator: string | null;
  members: Member[];
  activity: Activity;
  estimate: EstimateView | null;
  retro: RetroView | null;
  pick: PickView | null;
  timerEndsAt: number | null;
  timerDurationMs: number | null;
  cursors: { id: string; name: string; x: number; y: number; drag?: { cardId: string; x: number; y: number } }[];
  setConnected: (connected: boolean) => void;
  setEnded: (ended: boolean) => void;
  setCursors: (cursors: { id: string; name: string; x: number; y: number }[]) => void;
  apply: (snapshot: Snapshot) => void;
};

export const useRoom = create<RoomState>((set) => ({
  connected: false,
  ended: false,
  you: null,
  facilitator: null,
  members: [],
  activity: "estimate",
  estimate: null,
  retro: null,
  pick: null,
  timerEndsAt: null,
  timerDurationMs: null,
  cursors: [],
  setConnected: (connected) => set({ connected }),
  setEnded: (ended) => set({ ended }),
  setCursors: (cursors) => set({ cursors }),
  apply: (s) =>
    set({
      you: s.you,
      facilitator: s.facilitator,
      members: s.members,
      activity: s.activity,
      estimate: s.estimate,
      retro: s.retro,
      pick: s.pick,
      timerEndsAt: s.timerEndsAt,
      timerDurationMs: s.timerDurationMs,
    }),
}));
