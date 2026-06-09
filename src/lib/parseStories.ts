// Turn whatever a facilitator pastes or types into a clean list of stories.
//
// One story per line. Within a line, a comma row that looks like a CSV / Jira export
// (an ID-like first cell, or a numeric story-points cell) collapses to a single story
// titled "ID · Title" with the points dropped. A plain "a, b, c" line is treated as a
// quick list and split into one story per item, so you do not have to add them one by
// one. Quotes around cells are stripped.

const ID_LIKE = /^[A-Za-z]{1,8}-?\d+$/;
const NUM_CELL = /^\d+(\.\d+)?$/;

function parseLine(line: string): string[] {
  const t = line.trim().replace(/^["']|["']$/g, "");
  if (!t) return [];
  if (!t.includes(",")) return [t];
  const cells = t
    .split(",")
    .map((c) => c.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  if (!cells.length) return [];
  const isCsvRow = ID_LIKE.test(cells[0]) || cells.some((c) => NUM_CELL.test(c));
  if (!isCsvRow) return cells; // plain comma list, one story each
  const id = ID_LIKE.test(cells[0]) ? cells[0] : null;
  const rest = (id ? cells.slice(1) : cells).filter((c) => !NUM_CELL.test(c));
  const pool = rest.length ? rest : cells;
  const title = pool.slice().sort((a, b) => b.length - a.length)[0] || cells[0];
  return [id ? `${id} · ${title}` : title];
}

export function parseStoryList(text: string): string[] {
  return text.split("\n").flatMap(parseLine).filter(Boolean);
}
