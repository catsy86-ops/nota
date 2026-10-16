import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";
import { useAchievementTracker } from "@/lib/achievements";
import { showAchievementStamp, stampAllowed } from "@/lib/achievementStamp";
import { useLatestRef } from "@/hooks/useLatestRef";

/**
 * Powiadomienia o odznakach w głównym widoku: pieczątka (przy włączonych efektach) albo
 * jeden cichy toast na paczkę. Wyciągnięte z `Index.tsx` bez zmiany zachowania. Logika odznak
 * jest testowana w `src/lib/achievements.test.ts`, pieczątka w `achievementStamp.test.ts`; sam hook
 * nie ma osobnego testu e2e (zachowanie toastów nie jest pokryte przez e2e).
 */
export function useAchievementToasts({
  notes,
  archivedNotes,
  allLabels,
  folders,
  onOpenStats,
}: {
  notes: Note[];
  archivedNotes: Note[];
  allLabels: Parameters<typeof useAchievementTracker>[2];
  folders: Parameters<typeof useAchievementTracker>[3];
  onOpenStats: () => void;
}) {
  // Stały odnośnik do najnowszego callbacku: toast z dawnym `onOpenStats` nie ma się czym przejmować.
  const openStatsRef = useLatestRef(onOpenStats);
  // Odznaki w głównym widoku: jeden cichy toast na paczkę (import potrafi odblokować
  // kilka naraz), stałe `id` podmienia go zamiast piętrzyć. Szczegóły są w Statystykach.
  // Nad otwartym oknem (edytor nowej notatki) odznaka by go zasłaniała — czeka, aż okno się zamknie.
  // Czeka też na inne dymki: przy starcie „N przypomnień czeka” u góry i odznaki u dołu zasłaniały naraz nagłówek i ostatni kafel.
  const unlockedBatchRef = useRef<{ titles: string[]; description: string }>({ titles: [], description: "" });
  const badgeTimerRef = useRef<number | null>(null);
  const showBadgeToast = useCallback(() => {
    if (document.querySelector('[role="dialog"][data-state="open"], [data-sonner-toast]:not([data-removed="true"]):not(.toast-achievements)')) {
      badgeTimerRef.current = window.setTimeout(showBadgeToast, 1000);
      return;
    }
    badgeTimerRef.current = null;
    const { titles, description } = unlockedBatchRef.current;
    const reset = () => { unlockedBatchRef.current = { titles: [], description: "" }; };
    toast(titles.length === 1 ? `Nowa odznaka: ${titles[0]}` : `Nowe odznaki: ${titles.length}`, {
      id: "achievements",
      className: "toast-achievements",
      description: titles.length === 1 ? description : titles.join(", "),
      duration: 4000,
      action: { label: "Zobacz", onClick: () => openStatsRef.current() },
      onAutoClose: reset,
      onDismiss: reset,
    });
  }, [openStatsRef]);
  useEffect(() => () => { if (badgeTimerRef.current !== null) clearTimeout(badgeTimerRef.current); }, []);

  useAchievementTracker(notes, archivedNotes, allLabels, folders, (a) => {
    // Pieczątka zastępuje dymek (przy wyłączonym efekcie / reduced motion zostaje dymek).
    // Nad otwartym oknem lub edytorem nowej notatki zasłaniałaby pisany tekst — czeka na zamknięcie.
    if (stampAllowed()) {
      const attempt = (left: number) => {
        const busy = document.querySelector('[role="dialog"][data-state="open"], [data-composer-open]');
        if (busy && left > 0) { window.setTimeout(() => attempt(left - 1), 800); return; }
        showAchievementStamp(a);
      };
      attempt(40);
      return;
    }
    unlockedBatchRef.current.titles.push(a.title);
    unlockedBatchRef.current.description = a.description;
    if (badgeTimerRef.current === null) showBadgeToast();
  });
}
