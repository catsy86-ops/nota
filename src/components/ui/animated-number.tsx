import { useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { animate } from "framer-motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { recentUserAction } from "@/lib/inputModality";
import { dur, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Liczba, która przelicza się do nowej wartości krótkim tweenem (~0,4 s) zamiast przeskakiwać (M5.4).
 * Liczy tylko po akcji użytkownika (`recentUserAction`) — zmiana z synchronizacji, pierwszy render
 * i ograniczony ruch od razu pokazują wynik. Tekst zapisujemy wprost w węźle (ref), bez setState
 * na klatkę, więc rodzic się nie przerysowuje. Bez `format` zaokrągla do liczby całkowitej;
 * z `format` dostaje też wartości pośrednie (np. minuty, złotówki).
 */
export function AnimatedNumber({ value, format, className, ...rest }: {
  value: number;
  /** Zapis liczby (np. kwota z groszy, czas z minut); domyślnie zaokrąglona liczba. */
  format?: (n: number) => string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">) {
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
    const write = (v: number) => { el.textContent = fmt.current ? fmt.current(v) : String(Math.round(v)); };
    const from = shown.current;
    if (reduced || from === value || !recentUserAction()) {
      shown.current = value;
      write(value);
      return;
    }
    const controls = animate(from, value, {
      duration: dur.slow + 0.1,
      ease: ease.out,
      onUpdate: (v) => { shown.current = v; write(v); },
      onComplete: () => { shown.current = value; write(value); },
    });
    return () => controls.stop();
  }, [value, reduced]);

  // Treść wpisuje efekt: React nie zna tego węzła tekstowego, więc go nie nadpisze.
  return <span ref={ref} className={cn("tabular-nums", className)} {...rest} />;
}
