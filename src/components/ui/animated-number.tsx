import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * Liczba, która przelicza się do nowej wartości zamiast przeskakiwać (mikrointerakcja liczników).
 * Przy `prefers-reduced-motion` od razu pokazuje wynik. Zaokrągla do liczby całkowitej.
 */
export function AnimatedNumber({ value, className, ...rest }: { value: number } & HTMLAttributes<HTMLSpanElement>) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.45,
      ease: "easeOut",
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={className} {...rest}>{shown}</span>;
}
