import type { Mode } from "../../lib/mode";

/** Small line icons for the main-nav modes. `currentColor` makes them inherit
 *  the ModeButton's text color (active/hover re-theme for free). aria-hidden —
 *  the button's text label remains the accessible name. */
export function ModeIcon({ mode }: { mode: Mode }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "flex-none",
  };
  switch (mode) {
    case "reader":
      return (
        <svg {...common}>
          <path d="M12 6.5C10.5 5.3 8.5 4.8 4 5v13c4.5-.2 6.5.3 8 1.5 1.5-1.2 3.5-1.7 8-1.5V5c-4.5-.2-6.5.3-8 1.5z" />
          <path d="M12 6.5v13" />
        </svg>
      );
    case "council":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M5 7h14" />
          <path d="M5 7l-2.5 6a3 3 0 0 0 5 0L5 7z" />
          <path d="M19 7l-2.5 6a3 3 0 0 0 5 0L19 7z" />
        </svg>
      );
    case "theology":
      return (
        <svg {...common}>
          <path d="M3 9l9-5 9 5" />
          <path d="M5 9v8M10 9v8M14 9v8M19 9v8" />
          <path d="M3 20h18" />
        </svg>
      );
    case "resources":
      return (
        <svg {...common}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
      );
    case "workspaces":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      );
    case "tags":
      return (
        <svg {...common}>
          <path d="M4 4h7l9 9-7 7-9-9V4z" />
          <circle cx="8.5" cy="8.5" r="1.2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
        </svg>
      );
    default:
      return null;
  }
}
