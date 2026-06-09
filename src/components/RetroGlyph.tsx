// Custom line-drawn marks per retro format · bespoke, not stock emoji. Single-stroke,
// currentColor, so we can tint them with the theme accent and scale them as big faint
// scene art on the board.

const G: Record<string, React.ReactNode> = {
  // traffic light
  ssc: (
    <>
      <rect x="8" y="2.5" width="8" height="19" rx="4" />
      <circle cx="12" cy="7" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="17" r="1.6" />
    </>
  ),
  // mood face
  msg: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10h.01M15.5 10h.01" />
      <path d="M8.5 15c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8" />
    </>
  ),
  // clipboard + check
  wlww: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M8.5 12.5l2.2 2.2L15.5 10" />
    </>
  ),
  // lightbulb
  fourls: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </>
  ),
  // gear
  daki: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>
  ),
  // sailboat on a wave
  sailboat: (
    <>
      <path d="M12 3v11" />
      <path d="M12 5.5l6 7.5h-6z" />
      <path d="M5 17h14l-2.2 3H7.2z" />
      <path d="M3 21c1.2-1 2.4-1 3.6 0s2.4 1 3.6 0 2.4-1 3.6 0 2.4 1 3.6 0" />
    </>
  ),
  // five-point star (starfish)
  starfish: <path d="M12 3l2.5 5.6 6.1.6-4.6 4 1.4 6L12 16.9 6.6 19.2l1.4-6-4.6-4 6.1-.6z" />,
  // plus / delta
  plusdelta: (
    <>
      <path d="M6 4v6M3 7h6" />
      <path d="M15.5 20l4-7 4 7z" transform="translate(-3 -2)" />
    </>
  ),
  // speaker with sound waves
  kalm: (
    <>
      <path d="M4 9v6h3l5 4V5L7 9z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />
    </>
  ),
  // house
  pigs: (
    <>
      <path d="M4 11l8-6 8 6" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  // crown (GOT)
  got: (
    <>
      <path d="M4 8l3 8h10l3-8-4.5 3.5L12 6 8.5 11.5z" />
      <path d="M6 19h12" />
    </>
  ),
  // shield with star (Avengers)
  avengers: (
    <>
      <path d="M12 3l7 2.5v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10v-5z" />
      <path d="M12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.9 9.5 16.5l.6-2.8L8 11.8l2.8-.3z" />
    </>
  ),
  // rocket (Star Wars)
  starwars: (
    <>
      <path d="M12 3c3 2 4.5 5 4.5 9 0 2-.5 3.5-1 4.5h-7c-.5-1-1-2.5-1-4.5C7.5 8 9 5 12 3z" />
      <circle cx="12" cy="10" r="1.6" />
      <path d="M8.5 16.5L6 19l2 .3M15.5 16.5L18 19l-2 .3M11 20.5h2" />
    </>
  ),
  // flag on a pole (Roadmap)
  roadmap: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h12l-2.6 3.5L18 11.5H6" />
    </>
  ),
};

export function RetroGlyph({
  template,
  className = "",
  style,
}: {
  template: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const glyph = G[template] ?? G.wlww;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {glyph}
    </svg>
  );
}
