import type { EstimateView, RetroView, PickView, Member } from "../../shared/protocol";
import { RETRO_TEMPLATES } from "../../shared/protocol";
import { numericValue } from "./colors";

/**
 * Build a clean Markdown digest of the live session, entirely client-side — the
 * carryover seam for an ephemeral tool: paste it into Slack/Jira/a doc and the
 * decisions survive even though the room won't.
 */
export function buildSessionMarkdown(args: {
  room: string;
  members: Member[];
  estimate: EstimateView;
  retro: RetroView;
  board?: RetroView;
  pick: PickView;
}): string {
  const { room, members, estimate, retro, board, pick } = args;
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const out: string[] = [`# Scrumlo — ${room}`, `_Exported ${new Date().toLocaleString()}_`];

  // Action items first — the one artifact stakeholders actually want from a retro.
  const actions = retro.cards.filter((c) => c.action);
  if (actions.length) {
    out.push("", "## Action Items");
    for (const a of actions) {
      out.push(`- [ ] ${a.text}${a.owner ? ` — **@${a.owner}**` : ""}`);
    }
  }

  // Estimation
  out.push("", "## Estimation");
  if (estimate.log.length) {
    out.push("", "**Estimated this session:**");
    for (const e of estimate.log) {
      out.push(`- ${e.story} → **${e.value}**${e.note ? ` (${e.note})` : ""}`);
    }
    out.push("");
  }
  out.push(`**Now:** ${estimate.story || "—"}`);
  if (estimate.decision) {
    out.push(
      "",
      `**Decision: \`${estimate.decision.value}\`**${estimate.decision.note ? ` — ${estimate.decision.note}` : ""}`,
    );
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
      const median = sorted[Math.floor((sorted.length - 1) / 2)];
      out.push(
        "",
        min === max
          ? `Consensus: **${min}**`
          : `Spread **${min}–${max}**, median **${median}**, avg **${avg}**`,
      );
    }
    // The reason the room disagreed — the part that's actually worth keeping.
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
  out.push("", `## Retro — ${tplLabel}`);
  let anyCards = false;
  for (const col of retro.columns) {
    const cards = retro.cards
      .filter((c) => c.column === col.id && !c.masked && c.text.trim())
      .sort((a, b) => b.votes - a.votes);
    if (!cards.length) continue;
    anyCards = true;
    out.push("", `### ${col.emoji} ${col.title}`);
    for (const c of cards) out.push(`- ${c.text}${c.votes ? ` (▲ ${c.votes})` : ""}`);
  }
  if (!anyCards) out.push("_(no cards)_");

  // Roadmap board (only if it has cards)
  if (board && board.cards.some((c) => c.text.trim())) {
    out.push("", "## Roadmap board");
    for (const col of board.columns) {
      const cards = board.cards
        .filter((c) => c.column === col.id && c.text.trim())
        .sort((a, b) => b.votes - a.votes);
      if (!cards.length) continue;
      out.push("", `### ${col.emoji} ${col.title}`);
      for (const c of cards) out.push(`- ${c.text}${c.votes ? ` (▲ ${c.votes})` : ""}`);
    }
  }

  // Picker
  if (pick.result.length) {
    out.push("", "## Picker", `Picked: ${pick.result.join(pick.mode === "order" ? " → " : ", ")}`);
  }

  out.push("", "_Made with Scrumlo — no account, no database, deleted when the room ends._");
  return out.join("\n");
}
