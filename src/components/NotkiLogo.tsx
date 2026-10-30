import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface NotkiLogoProps {
  size?: "sm" | "lg";
  className?: string;
}

/** Ta sama geometria co ekran startowy w `index.html` (viewBox 0 0 82 40): „notki” pisane długopisem. */
const STROKES: { d: string; delay: number; dur: number }[] = [
  { d: "M6 30V20Q6 16 11.5 16Q17 16 17 21V30", delay: 0.1, dur: 0.34 },
  { d: "M36 23A7 7 0 1 1 22 23A7 7 0 1 1 36 23", delay: 0.38, dur: 0.32 },
  { d: "M44 8V26Q44 30 48 30H50", delay: 0.62, dur: 0.2 },
  { d: "M40 16H50", delay: 0.74, dur: 0.12 },
  { d: "M56 5V30", delay: 0.8, dur: 0.16 },
  { d: "M67 16L57 25", delay: 0.9, dur: 0.14 },
  { d: "M60.5 22.5L67.5 30", delay: 0.96, dur: 0.1 },
  { d: "M74 16V30", delay: 1, dur: 0.1 },
];

/** Rysowanie tylko raz na sesję: kolejne wejścia do aplikacji i zmiany widoku pokazują gotowe logo. */
const DRAWN_KEY = "kaczy.logo.drawn.v1";
function takeFirstDraw(): boolean {
  try {
    if (sessionStorage.getItem(DRAWN_KEY)) return false;
    sessionStorage.setItem(DRAWN_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Logo „notki” (plan motywów 1.6, decyzja T-9): pisane długopisem w gradiencie marki, które stoi
 * na gotowo. Pierwsze wejście w sesji rysuje je kreska po kresce (`guide-draw`, respektuje ograniczony
 * ruch). Kolory z tokenów `--brand-*` — każdy styl może je przestawić w `index.css`.
 */
export function NotkiLogo({ size = "lg", className }: NotkiLogoProps) {
  const [draw] = useState(takeFirstDraw);
  const gradId = "notki-logo-grad";
  return (
    <svg
      role="img"
      aria-label="NOTKI"
      viewBox="4 3 74 30"
      className={cn("notki-logo inline-block overflow-visible align-[-0.12em]", size === "lg" ? "h-[2em] w-auto" : "h-[1.6em] w-auto", className)}
    >
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="4" y1="0" x2="78" y2="0">
          <stop offset="0" style={{ stopColor: "var(--brand-from)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--brand-via)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-to)" }} />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${gradId})`} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        {STROKES.map((s) => (
          <path
            key={s.d}
            d={s.d}
            pathLength={1}
            className={draw ? "guide-draw" : undefined}
            style={draw ? ({ "--d": `${s.delay}s`, "--t": `${s.dur}s` } as CSSProperties) : undefined}
          />
        ))}
      </g>
      <circle
        cx={74}
        cy={9.6}
        r={2}
        fill="var(--brand-to)"
        className={draw ? "guide-pop" : undefined}
        style={draw ? ({ "--d": "1.06s" } as CSSProperties) : undefined}
      />
    </svg>
  );
}
