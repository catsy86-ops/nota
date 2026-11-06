import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLatestRef } from "@/hooks/useLatestRef";
import { shiftOccurrenceOn, useShifts, useShiftsReady } from "@/lib/shifts";
import { finishShiftNow } from "@/lib/shifts/finishNow";

/**
 * „Skończyłem” z powiadomienia o końcu zmiany (G4.1). Przy otwartej aplikacji przychodzi wiadomość
 * z workera (`public/sw-notifications.js`); przy zamkniętej worker otwiera `/grafik?akcja=shift-done&dzien=…`.
 * Akcja czeka, aż dane Grafiku się wczytają, i zapisuje koniec tak jak przycisk „Skończyłem teraz”.
 */
export function useShiftEndAction() {
  const ready = useShiftsReady();
  const readyRef = useLatestRef(ready);
  const data = useShifts();
  const dataRef = useLatestRef(data);
  const queued = useRef<string[]>([]);

  function finish(dayKey: string) {
    const occ = shiftOccurrenceOn(dataRef.current, dayKey);
    if (!occ) { toast("Tej zmiany nie ma już w Grafiku"); return; }
    finishShiftNow(occ);
  }
  const finishRef = useLatestRef(finish);

  // Zamknięta aplikacja: odczytujemy adres raz i zdejmujemy parametry, żeby odświeżenie nie powtórzyło akcji.
  useEffect(() => {
    const url = new URL(window.location.href);
    const dayKey = url.searchParams.get("dzien");
    if (url.searchParams.get("akcja") !== "shift-done" || !dayKey) return;
    queued.current.push(dayKey);
    url.searchParams.delete("akcja");
    url.searchParams.delete("dzien");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }, []);

  // Dane gotowe: wykonujemy to, co czekało.
  useEffect(() => {
    if (!ready) return;
    for (const dayKey of queued.current.splice(0)) finishRef.current(dayKey);
  }, [ready, finishRef]);

  // Otwarta aplikacja: akcja z powiadomienia przychodzi jako wiadomość z workera.
  useEffect(() => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; action?: string; dayKey?: string } | null;
      if (d?.type !== "shift-action" || d.action !== "shift-done" || typeof d.dayKey !== "string") return;
      if (readyRef.current) finishRef.current(d.dayKey);
      else queued.current.push(d.dayKey);
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, [readyRef, finishRef]);
}
