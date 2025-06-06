const AVATAR = [
  "#5b6cff", "#34b27b", "#f0a23b", "#e8615f",
  "#8b5bff", "#0ea5e9", "#ec4899", "#14b8a6",
];

export function avatarColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
}

export function initials(name: string): string {
  const t = name.trim();
  return (t.slice(0, 2) || "?").toUpperCase();
}

/** numeric value of a card, or null for ?, ☕, and t-shirt sizes */
export function numericValue(card: string): number | null {
  if (card === "½") return 0.5;
  const n = Number(card);
  return Number.isFinite(n) ? n : null;
}

/** consensus traffic-light: reserved EXCLUSIVELY for vote magnitude */
export function consensusColor(card: string): string {
  const n = numericValue(card);
  if (n === null) return "#94a3b8"; // slate for non-numeric
  if (n <= 3) return "#34b27b"; // green
  if (n <= 8) return "#f0a23b"; // amber
  return "#e8615f"; // red
}
