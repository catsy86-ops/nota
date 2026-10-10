import { useEffect, useMemo } from "react";
import { toast } from "sonner";
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

  useEffect(() => {
    if (!ready) return;

    function check() {
      let last: string | null = null;
      try { last = localStorage.getItem(EVENING_NUDGED_KEY); } catch { /* bez localStorage */ }
      const nudge = eveningNudgeFor(new Date(), readEveningNudgeTime(), last, data.days, typesById);
      if (!nudge) return;
      try { localStorage.setItem(EVENING_NUDGED_KEY, nudge.forKey); } catch { /* ignore */ }

      toast(`🌙 ${nudge.title}`, {
        id: "shift-evening-nudge",
        description: nudge.description,
        duration: 15000,
        action: { label: "Grafik", onClick: onOpenShifts },
      });

      if ("Notification" in window && Notification.permission === "granted") {
        const options: NotificationOptions = {
          body: nudge.description ?? "Grafik na jutro.",
          icon: "/pwa-192.png",
          badge: "/pwa-192.png",
          tag: "shift-evening-nudge",
          data: { url: "/grafik" },
        };
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready
            .then((r) => r.showNotification(nudge.title, options))
            .catch(() => new Notification(nudge.title, options));
        } else {
          new Notification(nudge.title, options);
        }
      }
    }

    const first = window.setTimeout(check, 7000);
    const poll = window.setInterval(check, 60_000);
    return () => { clearTimeout(first); clearInterval(poll); };
  }, [ready, data.days, typesById, onOpenShifts]);
}
