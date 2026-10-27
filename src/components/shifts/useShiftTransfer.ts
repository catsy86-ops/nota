import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { dayKey } from "@/lib/reminderOccurrences";
import { pasteDay, restoreDays, shiftStore, swapDays, transferDay, type DayEntry } from "@/lib/shifts";
import { modShortcut } from "@/lib/platform";
import { toastWithUndo } from "@/lib/undoToast";
import type { DropChoice } from "./TransferChooser";
import type { DayActions, DropMode } from "./ShiftDnd";
import { shortDate } from "./useShiftPaint";

export interface PendingTransfer {
  from: string;
  to: string;
}

/**
 * Przenoszenie, zamiana, kopiowanie i schowek wpisów Grafiku (G3.2). Jedna ścieżka
 * dla myszy, dotyku i klawiatury. `onAsk` otwiera wybór trybu, gdy upuszczenie nie wskazuje trybu.
 */
export function useShiftTransfer(onAsk: (pending: PendingTransfer) => void) {
  const [clip, setClip] = useState<DayEntry | null>(null);
  const clipRef = useRef<DayEntry | null>(null);

  const transfer = useCallback((from: string, to: string, mode: DropChoice) => {
    if (mode === "swap") {
      const before = swapDays(from, to, dayKey(new Date()));
      if (!before) { toast("Nie ma czego zamienić", { description: "Zamienić można dwa dni, w których są zmiany." }); return; }
      toastWithUndo(`Zamieniono: ${shortDate(from)} ⇄ ${shortDate(to)}`, () => restoreDays(before));
      return;
    }
    const days = shiftStore.get().days;
    const src = days[from];
    if (!src) { toast("Ten dzień nie ma zmiany", { description: "Nie ma czego przenosić ani kopiować." }); return; }
    const replaced = !!days[to];
    const before = transferDay(from, to, mode, dayKey(new Date()));
    if (!before) { toast("Bez zmian", { description: "W dniu docelowym jest już taki sam wpis." }); return; }
    const name = shiftStore.get().types.find((t) => t.id === src.type)?.name ?? "Zmiana";
    toastWithUndo(`${mode === "move" ? "Przeniesiono" : "Skopiowano"} ${name}: ${shortDate(from)} → ${shortDate(to)}`, () => restoreDays(before), {
      description: replaced ? "Zastąpiono wpis w dniu docelowym" : undefined,
    });
  }, []);

  const actions = useMemo<DayActions>(() => ({
    transfer,
    copyEntry: (key) => {
      const entry = shiftStore.get().days[key];
      if (!entry) { toast("Ten dzień nie ma zmiany do skopiowania"); return; }
      clipRef.current = entry;
      setClip(entry);
      const name = shiftStore.get().types.find((t) => t.id === entry.type)?.name ?? "Zmiana";
      toast(`Skopiowano wpis: ${name}, ${shortDate(key)}`, { description: `${modShortcut("V")} na innym dniu go wklei.` });
    },
    paste: (key) => {
      const entry = clipRef.current;
      if (!entry) { toast("Schowek jest pusty", { description: `Na dniu ze zmianą naciśnij ${modShortcut("C")}.` }); return; }
      const before = pasteDay(entry, key, dayKey(new Date()));
      if (!before) { toast("Bez zmian", { description: "Ten dzień ma już taki wpis." }); return; }
      const name = shiftStore.get().types.find((t) => t.id === entry.type)?.name ?? "Zmiana";
      toastWithUndo(`Wklejono ${name}: ${shortDate(key)}`, () => restoreDays(before));
    },
  }), [transfer]);

  const onDrop = useCallback((from: string, to: string, mode: DropMode) => {
    if (mode === "ask") onAsk({ from, to });
    else transfer(from, to, mode);
  }, [transfer, onAsk]);

  const clearClip = useCallback(() => {
    clipRef.current = null;
    setClip(null);
  }, []);

  return { clip, clearClip, transfer, actions, onDrop };
}
