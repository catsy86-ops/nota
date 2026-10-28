import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useLatestRef } from "@/hooks/useLatestRef";
import { dayKey } from "@/lib/reminderOccurrences";
import { useStudyReady, yStudy } from "@/lib/study/data";
import { arrivalSite } from "@/lib/study/siteArrival";
import { siteArrivalStore } from "@/lib/study/siteArrivalPrefs";
import { enterEntryCheck, useEntryCheck } from "@/lib/study/entryCheckStore";

/** Dzień, w którym już zapytano o położenie — raz dziennie, także po odświeżeniu. */
const ASKED_KEY = "kaczy.study.siteArrivalAsked.v1";
/** Po ile ms dajemy GPS na odpowiedź; dłużej nie czekamy przy otwarciu. */
const LOCATE_TIMEOUT_MS = 8000;

/**
 * P2.10: przy otwarciu aplikacji, gdy włączone w Ustawieniach, jedno odczytanie położenia
 * (`getCurrentPosition`, bez śledzenia). Jeśli stoisz przy budowie bez wejścia dziś — dymek
 * „Jesteś przy budowie X — Wchodzę?”. Położenie zostaje w przeglądarce i nie idzie na serwer.
 */
export default function SiteArrivalPrompt() {
  const studyReady = useStudyReady();
  const enabled = siteArrivalStore.use();
  const study = useSyncExternalStore(yStudy.subscribe, yStudy.get);
  const entryCheck = useEntryCheck();
  const studyRef = useLatestRef(study);
  const recordsRef = useLatestRef(entryCheck.records);

  useEffect(() => {
    if (!studyReady || !enabled || typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const today = dayKey(new Date());
    try {
      if (localStorage.getItem(ASKED_KEY) === today) return;
      localStorage.setItem(ASKED_KEY, today);
    } catch {
      // bez localStorage pytamy przy każdym otwarciu — to tylko przypomnienie
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        const site = arrivalSite(Object.values(studyRef.current.sites), at, today, recordsRef.current);
        if (!site) return;
        toast(`Jesteś przy budowie „${site.name}”`, {
          id: "site-arrival",
          description: "Wchodzę?",
          duration: 20000,
          action: {
            label: "Wchodzę",
            onClick: () => { enterEntryCheck(site.id, today); toast.success(`Zapisano wejście: ${site.name}`); },
          },
        });
      },
      () => { /* odmowa albo brak sygnału — po prostu bez podpowiedzi */ },
      { enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    );
  }, [studyReady, enabled, studyRef, recordsRef]);

  return null;
}
