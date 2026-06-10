import type { EstimateView, RetroView, RetroCardView, PickView, PulseView, PollView, Member } from "../../shared/protocol";
import { RETRO_TEMPLATES, DECK_LABELS } from "../../shared/protocol";
import { numericValue } from "./colors";

/** Reactions like 👍2❤️1 appended to a card line (empty when none). */
function reactionStr(c: RetroCardView): string {
  return c.reactions?.length ? " " + c.reactions.map((r) => `${r.emoji}${r.count}`).join("") : "";
}

/** Render one column's cards, collapsing clusters into a single headed entry (so a
 *  12-vote cluster reads as one item, not scattered bullets), sorted by weight, with
 *  reactions and (when the room shows names) the author. */
function renderColumn(out: string[], heading: string, cards: RetroCardView[]): void {
  const groups = new Map<string, RetroCardView[]>();
  const singles: RetroCardView[] = [];
  for (const c of cards) {
    if (c.groupId) (groups.get(c.groupId) ?? groups.set(c.groupId, []).get(c.groupId)!).push(c);
    else singles.push(c);
  }
  type Row = { weight: number; lines: string[] };
  const rows: Row[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => b.votes - a.votes);
    const head = g[0];
    const lines = [`- ${head.text}${head.author ? ` — ${head.author}` : ""} (▲ ${head.groupVotes}, ${g.length} cards)${reactionStr(head)}`];
    for (const c of g.slice(1)) lines.push(`  - ${c.text}${c.author ? ` — ${c.author}` : ""}${reactionStr(c)}`);
    rows.push({ weight: head.groupVotes, lines });
  }
  for (const c of singles) {
    rows.push({
      weight: c.votes,
      lines: [`- ${c.text}${c.author ? ` — ${c.author}` : ""}${c.votes ? ` (▲ ${c.votes})` : ""}${reactionStr(c)}`],
    });
  }
  rows.sort((a, b) => b.weight - a.weight);
  if (!rows.length) return;
  out.push("", heading);
  for (const r of rows) out.push(...r.lines);
}

/**
 * Build a clean Markdown digest of the live session, entirely client-side · the
 * carryover seam for an ephemeral tool: paste it into Slack/Jira/a doc and the
 * decisions survive even though the room won't.
 */
export function buildSessionMarkdown(args: {
  room: string;
  members: Member[];
  estimate: EstimateView;
  retro: RetroView;
  board?: RetroView;
  pulse?: PulseView;
  poll?: PollView;
  pick: PickView;
}): string {
  const { room, members, estimate, retro, board, pulse, poll, pick } = args;
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  // ISO-8601 with the offset, so the timestamp is portable and unambiguous.
  const out: string[] = [`# Scrumlo · ${room}`, `_Exported ${new Date().toISOString()}_`];

  // Action items first · collected from BOTH the retro and the roadmap board, since a
  // board action would otherwise be lost.
  const actions = [...retro.cards, ...(board?.cards ?? [])].filter((c) => c.action && !c.masked);
  if (actions.length) {
    out.push("", "## Action Items");
    for (const a of actions) out.push(`- [ ] ${a.text}${a.owner ? ` · **@${a.owner}**` : ""}`);
  }

  // Estimation
  out.push("", `## Estimation · ${DECK_LABELS[estimate.deck] ?? estimate.deck}`);
  if (estimate.log.length) {
    out.push("", "**Estimated this session:**");
    for (const e of estimate.log) out.push(`- ${e.story} → **${e.value}**${e.note ? ` (${e.note})` : ""}`);
    out.push("");
  }
  out.push(`**Now:** ${estimate.story || "-"}`);
  if (estimate.decision) {
    out.push("", `**Decision: \`${estimate.decision.value}\`**${estimate.decision.note ? ` · ${estimate.decision.note}` : ""}`);
  }
  if (estimate.phase === "revealed" && estimate.votes) {
    const entries = Object.entries(estimate.votes);
    for (const [id, card] of entries) out.push(`- ${nameById.get(id) ?? "anon"}: **${card}**`);
    const nums = entries.map(([, c]) => numericValue(c)).filter((n): n is number => n !== null);
    if (nums.length) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
      const sorted = [...nums].sort((a, b) => a - b);
      // Round the median UP to the more conservative card on even counts.
      const median = sorted[Math.ceil((sorted.length - 1) / 2)];
      out.push("", min === max ? `Consensus: **${min}**` : `Spread **${min}–${max}**, median **${median}**, avg **${avg}**`);
    } else {
      // Non-numeric decks (t-shirt sizes, etc.): summarize the most common card.
      const counts = new Map<string, number>();
      for (const [, c] of entries) counts.set(c, (counts.get(c) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) out.push("", `Most common: **${top[0]}** (${top[1]} of ${entries.length})`);
    }
    if (estimate.rationales) {
      const why = Object.entries(estimate.rationales).filter(([, t]) => t?.trim());
      if (why.length) {
        out.push("", "**Why they disagreed:**");
        for (const [id, text] of why) out.push(`- ${nameById.get(id) ?? "anon"}: ${text}`);
      }
    }
  } else {
    out.push("_(votes not revealed)_");
  }

  // Retro
  const tplLabel = RETRO_TEMPLATES[retro.template]?.label ?? retro.template;
  out.push("", `## Retro · ${tplLabel}`);
  const before = out.length;
  for (const col of retro.columns) {
    const cards = retro.cards.filter((c) => c.column === col.id && !c.masked && c.text.trim());
    renderColumn(out, `### ${col.emoji} ${col.title}`, cards);
  }
  if (out.length === before) out.push("_(no cards)_");

  // Roadmap board (only if it has cards)
  if (board && board.cards.some((c) => c.text.trim())) {
    out.push("", "## Roadmap board");
    for (const col of board.columns) {
      const cards = board.cards.filter((c) => c.column === col.id && c.text.trim());
      renderColumn(out, `### ${col.emoji} ${col.title}`, cards);
    }
  }

  // Team health check (only once revealed), with the distribution, not just the mean.
  if (pulse?.results && pulse.results.length) {
    out.push("", "## Team health check");
    for (const r of pulse.results) {
      const dist = r.spread?.length ? ` _[${[...r.spread].sort((a, b) => a - b).join(", ")}]_` : "";
      out.push(`- ${r.dim}: **${r.avg.toFixed(1)}** / 5 _(from ${r.count})_${dist}`);
    }
  }

  // Poll / Q&A
  if (poll && (poll.total > 0 || poll.log.length > 0)) {
    out.push("", "## Poll");
    // Earlier questions first (the order they were asked), then the live one.
    for (const l of poll.log) {
      out.push("", `### ${l.prompt}`);
      out.push(l.results.map((r) => `${r.text}${r.count ? ` (${r.count})` : ""}`).join(" · "));
    }
    if (poll.total > 0) {
      out.push("", `### ${poll.prompt || "Current question"}`);
      // Blind + unrevealed: the snapshot only carries this user's own entries, so a
      // full export would silently misrepresent the room. Say so instead.
      if (poll.blind && poll.phase === "answering") out.push("_Results were still hidden (not yet revealed) at export time._");
      else if (poll.mode === "cloud") out.push(poll.cloud.map((c) => `${c.word} (${c.count})`).join(" · "));
      else for (const a of poll.answers) out.push(`- ${a.text}${a.votes ? ` (▲ ${a.votes})` : ""}`);
    }
  }

  // Picker
  if (pick.result.length) {
    const label = pick.mode === "order" ? "Order" : pick.mode === "list" ? "Picked from list" : "Picked";
    out.push("", "## Picker", `${label}: ${pick.result.join(pick.mode === "order" ? " → " : ", ")}`);
    if (pick.recent.length > pick.result.length) out.push(`_History: ${pick.recent.join(", ")}_`);
  }

  out.push("", "_Made with Scrumlo · no account, no database, deleted when the room ends._");
  return out.join("\n");
}
