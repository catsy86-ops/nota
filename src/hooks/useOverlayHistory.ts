import { useEffect, useRef } from "react";
import { registerOverlay } from "@/lib/overlayHistory";

/** Dopóki `active`, „wstecz” wywołuje `close` (zamiast zmieniać widok pod warstwą). */
export function useOverlayHistory(active: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    return registerOverlay(() => closeRef.current());
  }, [active]);
}
