import { m as motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Wordmark „G” — litera wypisuje się odręcznie,
 * a na końcu podkreśla się jednym pociągnięciem. Za nim mruga kursor tekstowy.
 *
 * Zamiast obrazka: same ścieżki SVG, więc rysunek jest ostry w każdej skali,
 * bierze kolory z motywu (`--primary` / `--foreground`) i nic nie waży
 * w bundlu. Przy `prefers-reduced-motion` pokazuje od razu stan końcowy.
 */

interface Stroke {
  d: string;
  /** Kolejność pisania — opóźnienie w sekundach. */
  at: number;
  dur?: number;
}

// Litera G jako jedno pociągnięcie pióra. Baseline y=64, wysokość liter górnych od y=18.
const LETTERS: Stroke[] = [
  // G: łuk od prawego góry, dookoła, i poprzeczka do środka
  { d: "M160 32 C150 22 110 18 102 40 C95 62 110 70 128 66 C141 63 146 56 146 50 L128 50", at: 0.0, dur: 0.9 },
];

const UNDERLINE = "M96 80 C120 75 150 74 172 78";
const WRITING_END = 0.95;

export function NotatnikWordmark({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  // Bez animacji: od razu gotowy napis.
  const draw = (at: number, dur = 0.3) =>
    reduce
      ? { initial: { pathLength: 1, opacity: 1 }, animate: { pathLength: 1, opacity: 1 } }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: {
            pathLength: { delay: at, duration: dur, ease: "easeInOut" as const },
            opacity: { delay: at, duration: 0.05 },
          },
        };

  return (
    <svg
      viewBox="0 0 264 96"
      role="img"
      aria-label="G"
      className={cn("w-64 max-w-full h-auto", className)}
    >
      {/* Napis */}
      <g
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {LETTERS.map((s) => (
          <motion.path key={s.d} d={s.d} {...draw(s.at, s.dur)} />
        ))}
      </g>

      {/* Podkreślenie — ostatni, najszerszy ruch ręki. */}
      <motion.path
        d={UNDERLINE}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3.5"
        strokeLinecap="round"
        {...draw(WRITING_END, 0.42)}
      />

      {/* Kursor tekstowy — mruga dopiero, gdy pióro skończyło. */}
      {!reduce && (
        <motion.rect
          x="178"
          y="34"
          width="2.5"
          height="32"
          rx="1.25"
          fill="hsl(var(--primary))"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0, 0, 1] }}
          transition={{ delay: WRITING_END + 0.3, duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
      )}
    </svg>
  );
}
