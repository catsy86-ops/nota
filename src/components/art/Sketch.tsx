import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Szkic „kreska długopisem” (plan motywów 2026-10-30, 2.1) — jeden komponent dla pustych ekranów,
 * rysowany CSS-em (`.sketch-draw`, ta sama technika co `GuideArt` w samouczku), bez framer-motion.
 * Wygląd kreski z tokenów stylu: `--sketch-w` (grubość),
 * `--sketch-glow` (poświata w Neonie, Zorzy, Matrycy). `--sketch-dash` przerywa linie kartki (Plan) — samej kreski
 * nie, bo `stroke-dasharray` rysuje animację. Ograniczony ruch: od razu gotowy rysunek.
 */
export function Sketch({ paths, className = "relative mx-auto h-28 w-40 text-primary-ink", testId = "empty-illustration" }: {
  paths: readonly string[];
  className?: string;
  testId?: string;
}) {
  const at = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;
  return (
    <svg viewBox="0 0 120 84" className={cn("sketch", className)} aria-hidden="true" data-testid={testId}>
      {/* Linie kartki. */}
      {[72, 78].map((y) => (
        <line key={y} x1="10" x2="110" y1={y} y2={y} className="sketch-paper" />
      ))}
      {paths.map((d, i) => (
        <path key={d} d={d} pathLength={1} className="sketch-line sketch-draw" style={at(0.35 + i * 0.18)} />
      ))}
      {/* Podkreślenie jednym pociągnięciem. */}
      <path d="M22 76 C46 72 76 80 98 74" pathLength={1} className="sketch-line sketch-under sketch-draw" style={at(0.5 + paths.length * 0.18)} />
    </svg>
  );
}
