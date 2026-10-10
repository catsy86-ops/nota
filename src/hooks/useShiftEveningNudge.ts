import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLatestRef } from "@/hooks/useLatestRef";
import { showSystemNotification } from "@/lib/systemNotification";
import {
  EVENING_NUDGED_KEY, eveningNudgeFor, readEveningNudgeTime, useShifts, useShiftsReady,
} from "@/lib/shifts";

/**
 * Wieczorem (o godzinie z ustawień Grafiku) przypomina o jutrzejszej zmianie:
 * dymek w aplikacji i — jeśli jest zgoda — powiadomienie systemowe. Jak reszta
 * przypomnień działa tylko przy otwartej aplikacji (bez serwera push).
 */
export function useShiftEveningNudge(onOpenShifts: () => void) {
  const ready = useShiftsReady();
  const data = useShifts();
  const typesById = useMemo(() => new Map(data.types.map((t) => [t.id, t])), [data.types]);
  // Dane i callback z refów: edycja dnia w Grafiku nie może co chwilę restartować timerów.
  const daysRef = useLatestRef(data.days);
  const typesRef = useLatestRef(typesById);
  const openRef = useLatestRef(onOpenShifts);

  useEffect(() => {
    if (!ready) return;

    function check() {
      let last: string | null = null;
      try { last = localStorage.getItem(EVENING_NUDGED_KEY); } catch { /* bez localStorage */ }
      const nudge = eveningNudgeFor(new Date(), readEveningNudgeTime(), last, daysRef.current, typesRef.current);
      if (!nudge) return;
      try { localStorage.setItem(EVENING_NUDGED_KEY, nudge.forKey); } catch { /* ignore */ }

      toast(`🌙 ${nudge.title}`, {
        id: "shift-evening-nudge",
        description: nudge.description,
        duration: 15000,
        action: { label: "Grafik", onClick: () => openRef.current() },
      });

      showSystemNotification(nudge.title, { body: nudge.description ?? "Grafik na jutro.", tag: "shift-evening-nudge", url: "/grafik" });
    }

    const first = window.setTimeout(check, 7000);
    const poll = window.setInterval(check, 60_000);
    return () => { clearTimeout(first); clearInterval(poll); };
  }, [ready, daysRef, typesRef, openRef]);
}
