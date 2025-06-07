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
  pick: PickView;
}): string {
  const { room, members, estimate, retro, pick } = args;
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const out: string[] = [`# Ephem — ${room}`, `_Exported ${new Date().toLocaleString()}_`];

  // Estimation
  out.push("", "## Estimation", `**Story:** ${estimate.story || "—"}`);
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
    const cards = retro.cards.filter((c) => c.column === col.id).sort((a, b) => b.votes - a.votes);
    if (!cards.length) continue;
    anyCards = true;
    out.push("", `### ${col.emoji} ${col.title}`);
    for (const c of cards) out.push(`- ${c.text}${c.votes ? ` (▲ ${c.votes})` : ""}`);
  }
  if (!anyCards) out.push("_(no cards)_");

  // Picker
  if (pick.result.length) {
    out.push("", "## Picker", `Picked: ${pick.result.join(pick.mode === "order" ? " → " : ", ")}`);
  }

  out.push("", "_Made with Ephem — no account, no database, deleted when the room ends._");
  return out.join("\n");
}
