import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { tween } from "@/lib/motion";

/**
 * Liczba, która przy zmianie przewija się jak licznik: nowa wartość wjeżdża z dołu,
 * gdy rośnie, i z góry, gdy maleje. Tylko `transform` i `opacity`; przy ograniczonym
 * ruchu MotionConfig (App.tsx) zamienia to w zwykłą podmianę. Czytnik ekranu dostaje
 * samą liczbę, bez dublowania wychodzącej wartości.
 */
export function RollingNumber({ value }: { value: number }) {
  // Kierunek z poprzedniej wartości — stan pochodny ustawiany w renderze (wzorzec z dokumentacji
  // Reacta), nie ref: podwójny render w StrictMode nie gubi kierunku.
  const [last, setLast] = useState({ value, dir: 1 });
  if (last.value !== value) setLast({ value, dir: value > last.value ? 1 : -1 });
  const dir = last.value !== value ? (value > last.value ? 1 : -1) : last.dir;
  return (
    <span className="relative inline-flex overflow-hidden align-bottom tabular-nums">
      <span className="sr-only">{value}</span>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.span
          key={value}
          custom={dir}
          variants={{
            enter: (d: number) => ({ y: `${d * 70}%`, opacity: 0 }),
            center: { y: "0%", opacity: 1 },
            exit: (d: number) => ({ y: `${d * -70}%`, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={tween.enter}
          className="inline-block"
          aria-hidden
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
