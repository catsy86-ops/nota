import { useEffect, useLayoutEffect, useRef } from "react";
import { readViewMemoryRaw, writeViewMemory } from "@/lib/viewMemory";

/**
 * Przewinięcie strony per dział (plan UI/UX 3.6): wracając do działu, stoi się w miejscu,
 * w którym się z niego wyszło. Zapis w `viewMemory` (localStorage, w try/catch — bez niego
 * dział otwiera się od góry jak dotąd).
 *
 * Przywrócenie czeka, aż treść będzie dość wysoka (listy renderują się partiami), a nie
 * przewija przy każdej zmianie. Stuknięcie w aktywną zakładkę dalej wraca na górę (`BottomNav`).
 */

const KEY_PREFIX = "scroll:";
/** Ile klatek czekamy, aż strona urośnie do zapamiętanej wysokości (≈ 1,5 s przy 60 Hz). */
const MAX_RESTORE_FRAMES = 90;
/** Zapis po zatrzymaniu przewijania, nie przy każdym zdarzeniu. */
const SAVE_DEBOUNCE_MS = 150;

/** Zapamiętane przewinięcie działu; `0` gdy brak albo wartość nie jest liczbą dodatnią. */
export function readViewScroll(view: string): number {
  const raw = readViewMemoryRaw(KEY_PREFIX + view);
  const y = raw === null ? NaN : Number(raw);
  return Number.isFinite(y) && y > 0 ? Math.round(y) : 0;
}

export function writeViewScroll(view: string, y: number): void {
  writeViewMemory(KEY_PREFIX + view, String(Math.max(0, Math.round(y))));
}

export function useViewScroll(view: string): void {
  // Ostatnia pozycja z własnego zdarzenia przewijania. Przy zmianie widoku bierzemy ją stąd,
  // a nie z `scrollY`: wtedy strona ma już układ nowego działu i pozycja może być obcięta.
  const lastY = useRef<number | null>(null);
  const restoring = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    // Sprzątanie poprzedniego działu: zapis jego ostatniej pozycji, zanim ruszy układ nowego.
    const prev = view;
    return () => {
      window.clearTimeout(timer.current);
      if (lastY.current !== null && !restoring.current) writeViewScroll(prev, lastY.current);
      lastY.current = null;
    };
  }, [view]);

  useLayoutEffect(() => {
    const target = readViewScroll(view);
    if (target <= 0) return;
    restoring.current = true;
    let frames = 0;
    let raf = 0;
    const tryRestore = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll >= target || frames >= MAX_RESTORE_FRAMES) {
        window.scrollTo({ top: Math.min(target, Math.max(0, maxScroll)), behavior: "instant" as ScrollBehavior });
        lastY.current = window.scrollY;
        restoring.current = false;
        return;
      }
      frames += 1;
      raf = requestAnimationFrame(tryRestore);
    };
    raf = requestAnimationFrame(tryRestore);
    return () => {
      cancelAnimationFrame(raf);
      restoring.current = false;
    };
  }, [view]);

  useEffect(() => {
    const onScroll = () => {
      if (restoring.current) return;
      lastY.current = window.scrollY;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => writeViewScroll(view, window.scrollY), SAVE_DEBOUNCE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [view]);
}
