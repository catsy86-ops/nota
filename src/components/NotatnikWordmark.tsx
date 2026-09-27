import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Wordmark „Notatnik” — słowo wypisuje się odręcznie, litera po literze,
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

// Litery jako osobne pociągnięcia pióra, w kolejności pisania.
// Baseline y=64, wysokość x-ów od y=40, wysokość liter górnych od y=18.
const LETTERS: Stroke[] = [
  // N
  { d: "M18 66 L18 22", at: 0.0, dur: 0.22 },
  { d: "M18 22 L50 62", at: 0.2, dur: 0.24 },
  { d: "M50 62 L50 22", at: 0.42, dur: 0.22 },
  // o
  { d: "M78 41 C63 38 57 50 61 59 C65 68 79 69 83 59 C87 50 83 41 75 40", at: 0.62, dur: 0.34 },
  // t
  { d: "M100 20 C100 40 98 54 102 62 C104 66 108 64 110 60", at: 0.94, dur: 0.3 },
  { d: "M91 37 L113 34", at: 1.2, dur: 0.14 },
  // a
  { d: "M138 43 C129 37 119 41 117 51 C115 61 123 69 131 65 C136 62 138 53 137 43 C136 53 136 61 139 65", at: 1.32, dur: 0.38 },
  // t
  { d: "M154 20 C154 40 152 54 156 62 C158 66 162 64 164 60", at: 1.68, dur: 0.3 },
  { d: "M145 37 L167 34", at: 1.94, dur: 0.14 },
  // n
  { d: "M172 65 C171 55 171 47 172 42 C178 37 188 37 192 45 C194 53 193 59 194 65", at: 2.06, dur: 0.34 },
  // i (kreska; kropka dochodzi osobno)
  { d: "M206 65 C205 56 205 49 206 42", at: 2.38, dur: 0.16 },
  // k
  { d: "M224 67 C223 51 223 35 224 19", at: 2.6, dur: 0.26 },
  { d: "M242 43 C236 49 232 53 228 56 C233 58 238 61 242 67", at: 2.84, dur: 0.26 },
];

const UNDERLINE = "M16 80 C70 74 150 73 246 78";
const WRITING_END = 3.12;

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
      aria-label="Notatnik"
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

      {/* Kropka nad „i” — stawiana stuknięciem, nie rysowana. */}
      <motion.circle
        cx="206"
        cy="31"
        r="2.6"
        fill="hsl(var(--foreground))"
        initial={reduce ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduce ? undefined : { delay: 2.5, type: "spring", stiffness: 600, damping: 14 }}
      />

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
          x="252"
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
