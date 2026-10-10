import { useState } from "react";
import { dayType, type DayEntry, type ShiftType } from "@/lib/shifts";

interface Snap {
  monthKey: string;
  days: Record<string, DayEntry>;
  /** Dni, w których zmiana została naniesiona lub podmieniona — chip gra „pieczątkę”. */
  stamped: ReadonlySet<string>;
  /** Dni, z których zmiana zniknęła — rodzaj sprzed czyszczenia (do zgaszenia). */
  cleared: ReadonlyMap<string, ShiftType>;
}

const NONE: ReadonlySet<string> = new Set();
const NONE_MAP: ReadonlyMap<string, ShiftType> = new Map();

/** Więcej zmienionych dni naraz to wczytanie lub nałożenie cyklu — bez pieczątek. */
const MAX_STAMPS = 6;

const signature = (e: DayEntry | undefined) => (e ? `${e.type}|${e.hours ? JSON.stringify(e.hours) : ""}` : "");

/** Klucz chipa: zmiana rodzaju lub godzin remontuje chip i restartuje animację. */
export const stampKey = (e: DayEntry) => signature(e);

/**
 * Które dni zmieniły się od poprzedniego renderu tego samego miesiąca.
 * Przełączenie miesiąca i pierwszy render nic nie animują — pieczątka jest
 * reakcją na pędzel, nie na każde narysowanie siatki. Wzorzec „stan z
 * poprzedniego renderu” (jak `useMonthDirection`): render zostaje czysty.
 */
export function useStampedDays(monthKey: string, days: Record<string, DayEntry>, typesById: Map<string, ShiftType>) {
  const [snap, setSnap] = useState<Snap>({ monthKey, days, stamped: NONE, cleared: NONE_MAP });
  if (snap.days === days && snap.monthKey === monthKey) return snap;

  let next: Snap = { monthKey, days, stamped: NONE, cleared: NONE_MAP };
  if (snap.monthKey === monthKey) {
    const stamped = new Set<string>();
    const cleared = new Map<string, ShiftType>();
    const keys = new Set([...Object.keys(snap.days), ...Object.keys(days)]);
    for (const key of keys) {
      const before = snap.days[key];
      const after = days[key];
      if (signature(before) === signature(after)) continue;
      if (after) stamped.add(key);
      else {
        const base = before && typesById.get(before.type);
        if (base) cleared.set(key, dayType(base, before));
        else stamped.add(key); // brak rodzaju — policz do limitu, bez animacji
      }
    }
    if (stamped.size + cleared.size <= MAX_STAMPS) next = { monthKey, days, stamped, cleared };
  }
  setSnap(next);
  return next;
}
