import { create } from "zustand";
import type {
  Member,
  EstimateView,
  RetroView,
  PickView,
  Activity,
  ServerMsg,
} from "../../shared/protocol";

type RoomState = {
  connected: boolean;
  you: string | null;
  facilitator: string | null;
  members: Member[];
  activity: Activity;
  estimate: EstimateView | null;
  retro: RetroView | null;
  pick: PickView | null;
  setConnected: (connected: boolean) => void;
  apply: (snapshot: ServerMsg) => void;
};

export const useRoom = create<RoomState>((set) => ({
  connected: false,
  you: null,
  facilitator: null,
  members: [],
  activity: "estimate",
  estimate: null,
  retro: null,
  pick: null,
  setConnected: (connected) => set({ connected }),
  apply: (s) =>
    set({
      you: s.you,
      facilitator: s.facilitator,
      members: s.members,
      activity: s.activity,
      estimate: s.estimate,
      retro: s.retro,
      pick: s.pick,
    }),
}));
