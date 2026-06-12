import { create } from "zustand";
import type { LeadMsg } from "../../shared/protocol";

// "Take the lead": the facilitator's live viewport, in its own store so high-frequency
// scroll/zoom frames re-render only the canvas effect that follows them, not the Room.
type LeadState = {
  lead: LeadMsg | null; // null = nobody is leading
  ignoring: boolean; // this user clicked "Stop following" for the current lead session
  apply: (msg: LeadMsg) => void;
  stopFollowing: () => void;
};

export const useLead = create<LeadState>((set, get) => ({
  lead: null,
  ignoring: false,
  apply: (msg) => {
    if (!msg.on) {
      set({ lead: null, ignoring: false });
      return;
    }
    // A brand-new lead session (different leader, or first frame) re-arms following.
    const fresh = get().lead?.byId !== msg.byId;
    set({ lead: msg, ignoring: fresh ? false : get().ignoring });
  },
  stopFollowing: () => set({ ignoring: true }),
}));
