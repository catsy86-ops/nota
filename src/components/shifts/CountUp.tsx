import { useLayoutEffect, useRef } from "react";
import { animate } from "framer-motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { dur, ease } from "@/lib/motion";

interface CountUpProps {
  value: number;
  /** Zamienia liczbę (także pośrednią) na tekst — np. `formatDuration`. */
  format: (n: number) => string;
  className?: string;
}

/**
 * Liczba, która przelicza się do nowej wartości krótkim tweenem (~0,4 s).
 * Tekst zapisujemy wprost w węźle (ref), bez setState na klatkę — rodzic
 * się nie przerysowuje. Pierwszy render i reduced motion od razu pokazują
 * wartość docelową. Cyfry o stałej szerokości (`tabular-nums`) zapobiegają
 * migotaniu szerokości w trakcie liczenia.
 */
export function CountUp({ value, format, className }: CountUpProps) {
  const { reduced } = useMotionPref();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const fmt = useRef(format);

  useLayoutEffect(() => {
    fmt.current = format;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    if (reduced || from === value) {
      shown.current = value;
      el.textContent = fmt.current(value);
      return;
    }
    const controls = animate(from, value, {
      duration: dur.slow + 0.1,
      ease: ease.out,
      onUpdate: (v) => { shown.current = v; el.textContent = fmt.current(v); },
      onComplete: () => { shown.current = value; el.textContent = fmt.current(value); },
    });
    return () => controls.stop();
  }, [value, reduced]);

  // Treść wpisuje efekt: React nie zna tego węzła tekstowego, więc go nie nadpisze.
  return <span ref={ref} className={className} />;
}
