import { m as motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Wordmark „NOTKI” — litery wypisują się odręcznie, jedna po drugiej,
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

// Każda litera to jedno pociągnięcie pióra. Baseline y=64, wysokość liter od y=18 (pełne wielkie litery).
const LETTERS: Stroke[] = [
  // N: lewy słupek, skos i prawy słupek
  { d: "M14 64 V18 L48 64 V18", at: 0.0, dur: 0.5 },
  // O: owal
  { d: "M79 18 C91 18 101 27 101 41 C101 55 91 64 79 64 C67 64 57 55 57 41 C57 27 67 18 79 18 Z", at: 0.45, dur: 0.5 },
  // T: poziomka i słupek
  { d: "M112 18 H146 M129 18 V64", at: 0.95, dur: 0.4 },
  // K: słupek i dwa ramiona
  { d: "M160 18 V64 M186 18 L162 42 M168 36 L188 64", at: 1.35, dur: 0.5 },
  // I: pionowa kreska
  { d: "M202 18 V64", at: 1.8, dur: 0.3 },
];

const UNDERLINE = "M14 92 C80 89 150 89 212 92";
const WRITING_END = 2.1;

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
      aria-label="NOTKI"
      className={cn("w-64 max-w-full h-auto", className)}
    >
      {/* Napis */}
      <g
        fill="none"
        stroke="var(--foreground)"
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
        stroke="var(--primary)"
        strokeWidth="3.5"
        strokeLinecap="round"
        {...draw(WRITING_END, 0.42)}
      />

      {/* Kursor tekstowy — mruga dopiero, gdy pióro skończyło. */}
      {!reduce && (
        <motion.rect
          x="218"
          y="34"
          width="2.5"
          height="32"
          rx="1.25"
          fill="var(--primary)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0, 0, 1] }}
          transition={{ delay: WRITING_END + 0.3, duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
      )}
    </svg>
  );
}
