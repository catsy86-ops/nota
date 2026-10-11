import * as React from "react";
import { useOverlayHistory } from "@/hooks/useOverlayHistory";

/**
 * Montowany wewnątrz treści okna/arkusza (istnieje tylko, gdy okno jest otwarte):
 * „wstecz” przeglądarki zamyka okno tak samo jak przycisk ×.
 */
export function OverlayBack({ closeRef }: { closeRef: React.RefObject<HTMLElement> }) {
  useOverlayHistory(true, () => closeRef.current?.click());
  return null;
}

/** Wariant dla okien bez przycisku ×: Radix zamyka je po Escape, więc „wstecz” wysyła Escape. */
export function OverlayBackEscape() {
  useOverlayHistory(true, () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  return null;
}
