import { useRef } from "react";

/**
 * Przytrzymanie (domyślnie 500 ms) albo prawy przycisk myszy → `onLong`. Zwykłe stuknięcie idzie dalej
 * do `onClick` elementu; po przytrzymaniu kliknięcie jest pomijane (`shouldSkipClick`).
 */
export function useLongPress(onLong: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const cancel = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; } };
  return {
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        fired.current = false;
        cancel();
        timer.current = window.setTimeout(() => { fired.current = true; timer.current = null; onLong(); }, ms);
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      // Android przy przytrzymaniu palcem wysyła też `contextmenu` — wtedy timer już zadziałał, drugi raz nie.
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); if (fired.current) return; cancel(); fired.current = true; onLong(); },
    },
    /** `true` raz po przytrzymaniu — wywołujący pomija wtedy swoje kliknięcie. */
    shouldSkipClick: () => { const f = fired.current; fired.current = false; return f; },
  };
}
