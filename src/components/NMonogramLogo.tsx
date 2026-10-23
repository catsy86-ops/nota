import { useId } from "react";
import { cn } from "@/lib/utils";

interface NMonogramLogoProps {
  className?: string;
}

/** Obrys litery „G” (viewBox 24×24) — wspólny dla linii i kropki biegnącej po niej. */
const G_PATH = "M17.36 7.5 A7 7 0 1 0 19 12 H12.5";

/**
 * Animowany monogram „G”: litera rysuje się gradientową linią, chwilę świeci,
 * po czym wymazuje się w tym samym kierunku, a po jej obrysie biegnie jasna kropka.
 * Czysty SVG + CSS (`stroke-dashoffset`, `offset-distance`, `opacity`) — style
 * `.n-mark-*` w `index.css`; przy `prefers-reduced-motion` litera stoi w miejscu.
 */
export function NMonogramLogo({ className }: NMonogramLogoProps) {
  // Unikalny gradient — logo bywa jednocześnie w nagłówku i w pasku bocznym.
  const grad = `n-mark-grad-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" className={cn("w-8 h-8 overflow-visible", className)} aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="6" y1="5" x2="18" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(var(--primary))" />
          <stop offset="1" stopColor="hsl(var(--accent))" />
        </linearGradient>
      </defs>

      {/* poświata pod literą */}
      <path className="n-mark-glow" d={G_PATH} pathLength={100} fill="none" stroke={`url(#${grad})`} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* litera */}
      <path className="n-mark-line" d={G_PATH} pathLength={100} fill="none" stroke={`url(#${grad})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* kropka biegnąca po obrysie */}
      <circle className="n-mark-dot" r="1.6" fill="hsl(var(--primary-foreground, 0 0% 100%))" />
    </svg>
  );
}
