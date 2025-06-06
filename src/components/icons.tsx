// Monoline icon set (1.75px stroke, currentColor) — replaces full-color OS emoji
// that render inconsistently per-OS and pull the brand toward "toy".

type IconProps = { className?: string };

function svg(className?: string) {
  return {
    className,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

const dot = { fill: "currentColor", stroke: "none" } as const;

export const IconEstimate = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <rect x="3.5" y="4.5" width="8" height="11" rx="1.5" />
    <path d="M9 4.8l3.4-1 3 9.5-2.2.7" />
  </svg>
);

export const IconRetro = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <rect x="3" y="5" width="3.6" height="10" rx="1" />
    <rect x="8.2" y="5" width="3.6" height="10" rx="1" />
    <rect x="13.4" y="5" width="3.6" height="10" rx="1" />
  </svg>
);

export const IconPick = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <rect x="4" y="4" width="12" height="12" rx="2.5" />
    <circle cx="8" cy="8" r="1.1" {...dot} />
    <circle cx="12" cy="8" r="1.1" {...dot} />
    <circle cx="8" cy="12" r="1.1" {...dot} />
    <circle cx="12" cy="12" r="1.1" {...dot} />
  </svg>
);

export const IconPerson = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <circle cx="10" cy="7" r="3" />
    <path d="M4.5 16c0-3 2.5-4.8 5.5-4.8S15.5 13 15.5 16" />
  </svg>
);

export const IconOrder = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <path d="M5.5 4.5v11M5.5 4.5l-2 2M5.5 4.5l2 2" />
    <path d="M14.5 15.5v-11M14.5 15.5l-2-2M14.5 15.5l2-2" />
  </svg>
);

export const IconList = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <path d="M7 6h9M7 10h9M7 14h9" />
    <circle cx="3.6" cy="6" r="1.1" {...dot} />
    <circle cx="3.6" cy="10" r="1.1" {...dot} />
    <circle cx="3.6" cy="14" r="1.1" {...dot} />
  </svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <path d="M4 10.5l3.5 3.5 8.5-9" />
  </svg>
);

export const IconWaiting = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <circle cx="6" cy="10" r="1.2" {...dot} />
    <circle cx="10" cy="10" r="1.2" {...dot} />
    <circle cx="14" cy="10" r="1.2" {...dot} />
  </svg>
);

export const IconMoon = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <path d="M16 11.6A6.2 6.2 0 1 1 8.4 4a4.9 4.9 0 0 0 7.6 7.6z" />
  </svg>
);

export const IconClock = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <circle cx="10" cy="10" r="6.8" />
    <path d="M10 6v4.2l2.6 1.8" />
  </svg>
);

export const IconCoffee = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <path d="M4 8h10v3.5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" />
    <path d="M14 9h1.8a2 2 0 0 1 0 4H14" />
    <path d="M6 2.8v1.6M9 2.8v1.6M12 2.8v1.6" />
  </svg>
);

export const IconCrown = ({ className }: IconProps) => (
  <svg {...svg(className)}>
    <path d="M3 7.5l3.2 2.8L10 4.5l3.8 5.8L17 7.5l-1 8H4z" />
  </svg>
);
