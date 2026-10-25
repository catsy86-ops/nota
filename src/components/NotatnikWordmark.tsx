import { m as motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Wordmark „hydra” — litery wypisują się odręcznie, jedna po drugiej,
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

// Każda litera to jedno pociągnięcie pióra. Baseline y=64, wysokość liter górnych od y=18, „y” schodzi do y=84.
const LETTERS: Stroke[] = [
  // h: słupek, łuk i prawa noga
  { d: "M30 18 V64 M30 46 C30 37 37 33 46 33 C56 33 60 40 60 50 V64", at: 0.0, dur: 0.45 },
  // y: dwa skosy schodzące w ogonek
  { d: "M72 34 L84 66 L96 34 M84 66 Q80 80 70 84", at: 0.5, dur: 0.5 },
  // d: pętla i słupek z prawej
  { d: "M146 18 V66 M146 48 C146 39 139 33 129 33 C118 33 111 41 111 50 C111 59 118 66 129 66 C139 66 146 60 146 50", at: 0.95, dur: 0.5 },
  // r: słupek i łuk ramienia
  { d: "M160 34 V64 M160 48 C160 39 166 34 176 34", at: 1.4, dur: 0.35 },
  // a: pętla i prawy słupek
  { d: "M206 34 V64 M206 46 C206 38 200 33 193 33 C186 33 182 40 182 48 C182 58 188 64 196 64 C202 64 206 59 206 52", at: 1.7, dur: 0.5 },
];

const UNDERLINE = "M30 92 C90 89 160 89 224 92";
const WRITING_END = 2.25;

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
      aria-label="hydra"
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
          x="214"
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
