import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Akcje widoku w główce kartki (nowy plan 2026-11-05, 1.1): główka (`ViewTitle`) jest jedna dla wszystkich działów
 * i stoi w `Index`, a akcje („Nowy termin”, „Drukuj”…) należą do widoków. Widok wstawia je przez `<PageActions>`
 * (portal do miejsca w główce), więc stan i logika zostają w widoku.
 */
interface Slot {
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
}

const SlotContext = createContext<Slot | null>(null);

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ el, setEl }), [el]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/** Miejsce na akcje w główce (`ViewTitle`); poza dostawcą nie renderuje się wcale. Puste jest ukryte (`empty:hidden`). */
export function PageActionsSlot({ className }: { className?: string }) {
  const slot = useContext(SlotContext);
  return slot ? <div ref={slot.setEl} data-page-actions className={className} /> : null;
}

/**
 * Akcje widoku w główce. Bez dostawcy (testy komponentu, widok poza `Index`) renderują się w miejscu;
 * z dostawcą — dopiero gdy główka jest na ekranie.
 */
export function PageActions({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  if (!slot) return <>{children}</>;
  return slot.el ? createPortal(children, slot.el) : null;
}
