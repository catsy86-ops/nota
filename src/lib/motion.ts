import type { Transition } from "framer-motion";

// Tokeny ruchu dla framer-motion — lustro zmiennych `--dur-*` / `--ease-*` z index.css.
// Zamiast wpisywać sprężyny i czasy w każdym komponencie, sięgamy tutaj.

export const ease = {
  out: [0.22, 1, 0.36, 1],
  in: [0.4, 0, 1, 1],
  std: [0.2, 0, 0, 1],
} as const;

export const dur = {
  press: 0.09,
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
} as const;

export const spring = {
  /** Szybkie, bez odbicia — pigułki aktywnej pozycji, przełączniki. */
  snap: { type: "spring", stiffness: 500, damping: 38 },
  /** Miększe — panele i paski wjeżdżające z krawędzi. */
  soft: { type: "spring", stiffness: 320, damping: 30 },
} satisfies Record<string, Transition>;

export const tween = {
  /** Wejście: osiada bez odbicia. */
  enter: { duration: dur.base, ease: ease.out },
  /** Wyjście: krótsze od wejścia (~0.75×). */
  exit: { duration: dur.fast, ease: ease.in },
} satisfies Record<string, Transition>;
