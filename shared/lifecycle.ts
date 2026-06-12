/** Why a room should end right now, or null to keep living. Pure, so it's testable. */
export type ReapReason = "empty" | "idle" | "lifetime" | null;

export function reapReason(opts: {
  sockets: number; // live websockets (joined or spectating)
  members: number; // joined members among them
  now: number;
  lastActivityAt: number;
  createdAt: number;
  idleMs: number;
  maxRoomMs: number;
}): ReapReason {
  if (opts.sockets === 0) return "empty";
  if (opts.now - opts.createdAt >= opts.maxRoomMs) return "lifetime";
  // Idle only reaps rooms with no JOINED members (spectator ghosts, abandoned tabs).
  // A connected team that's just talking shouldn't lose its wall mid-discussion;
  // the lifetime cap above still bounds everything.
  if (opts.members === 0 && opts.now - opts.lastActivityAt >= opts.idleMs) return "idle";
  return null;
}
