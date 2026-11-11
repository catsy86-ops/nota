import { useEffect } from "react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { pushKey } from "@/lib/push/shown";
import { showSystemNotification } from "@/lib/systemNotification";
import { useJournalDraft } from "@/lib/study/draft";
import { runEndsAt } from "@/lib/study/pressureTest";

/**
 * B3.1 Alert na koniec próby szczelności. Działa, gdy karta Pracy jest otwarta (także schowana w tle, bo ekran
 * trzyma Wake Lock); po zamknięciu aplikacji koniec zgłasza serwer push (`lib/push/schedule.ts`, ten sam klucz),
 * a przy powrocie alert pojawia się od razu. Klucz `showSystemNotification` pilnuje, żeby nie było dwóch powiadomień.
 */
export function PressureRunWatcher() {
  const { test } = useJournalDraft();
  const startedAt = test?.startedAt;
  const endsAt = test ? runEndsAt(test) : null;

  useEffect(() => {
    if (startedAt === undefined || endsAt === null) return;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      haptic("success");
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* bez wibracji */ }
      toast.success("Próba szczelności: czas minął", { description: "Odczytaj manometr i wpisz ciśnienie końcowe.", duration: 15_000, id: `pressure-${startedAt}` });
      showSystemNotification("Próba szczelności: czas minął", {
        body: "Odczytaj manometr i wpisz ciśnienie końcowe.", tag: `pressure-${startedAt}`, url: "/praca", key: pushKey.pressure(startedAt), requireInteraction: true,
      });
    };
    const left = endsAt - Date.now();
    if (left <= 0) { fire(); return; }
    // Timery w tle bywają opóźniane, więc przy powrocie na kartę sprawdzamy czas jeszcze raz.
    const id = window.setTimeout(fire, left);
    const onVisible = () => { if (document.visibilityState === "visible" && Date.now() >= endsAt) fire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearTimeout(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [startedAt, endsAt]);

  return null;
}
