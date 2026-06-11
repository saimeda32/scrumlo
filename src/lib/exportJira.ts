import type { RetroView, EstimateView } from "../../shared/protocol";

/** One row of the Jira handoff: an action item or an estimated story. */
export type JiraItem = {
  id: string;
  summary: string;
  issueType: "Task" | "Story";
  description: string;
  assignee: string;
  points: string;
};

/** Collect everything worth handing to Jira: action items (retro + board) and
 *  locked estimate decisions. Pure view data — nothing leaves the browser. */
export function buildJiraItems(opts: {
  retro: RetroView | null;
  board: RetroView | null;
  estimate: EstimateView | null;
}): JiraItem[] {
  const items: JiraItem[] = [];
  for (const [label, view] of [
    ["Retro action item", opts.retro],
    ["Board action item", opts.board],
  ] as const) {
    for (const c of view?.cards ?? []) {
      if (!c.action || !c.text) continue;
      items.push({
        id: `card-${c.id}`,
        summary: c.text,
        issueType: "Task",
        description: `${label} from scrumlo`,
        assignee: c.owner ?? "",
        points: "",
      });
    }
  }
  for (const [i, d] of (opts.estimate?.log ?? []).entries()) {
    if (!d.story) continue;
    items.push({
      id: `story-${i}`,
      summary: d.story,
      issueType: "Story",
      description: d.note ? `Estimation note: ${d.note}` : "Estimated in scrumlo",
      assignee: "",
      points: d.value,
    });
  }
  return items;
}

const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;

/** Jira-importable CSV (map columns in Jira's import wizard). */
export function jiraCsv(items: JiraItem[]): string {
  const rows = [
    ["Summary", "Issue Type", "Description", "Assignee", "Story Points"],
    ...items.map((it) => [it.summary, it.issueType, it.description, it.assignee, it.points]),
  ];
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}
