import { useEffect, useMemo, useReducer } from "react";
import { useInvoices } from "@/lib/ksef/invoicesStore";
import { useShifts } from "@/lib/shifts/store";
import { localDayKey } from "@/lib/dayDone";
import { useDayClock } from "@/lib/dayClock";
import { billingStatement, type BillingStatement } from "./billing";
import { getSiteBilling, subscribeBilling } from "./billingStore";
import { useJobs } from "./jobsStore";
import { pointStage, pointType, POINT_STEPS } from "./points";
import { getSitePoints, subscribePoints } from "./pointsStore";
import { receivables, type Receivables } from "./receivables";
import { dayKeyOf, workOn } from "./report";
import { siteMinutesInRange } from "./siteHours";
import { siteStages } from "./stages";
import { siteDirectoryOf, useStudy } from "./studyProjection";

/**
 * R3.1 „Należności” dla widoku: zestawienia budów (jak w `SiteBillingDues` — godziny do dziś z dziennika i Grafiku,
 * punkty, etapy, wpłaty), zlecenia i faktury złożone w `receivables`. Liczone raz na zmianę danych; budowy
 * w archiwum i bez wybranego sposobu rozliczenia są pomijane.
 */
export function useReceivables(): Receivables {
  const study = useStudy();
  const shifts = useShifts();
  const jobs = useJobs();
  const invoices = useInvoices();
  const dayTick = useDayClock();
  // Rozliczenia i punkty to osobne mapy dokumentu bez stabilnego zrzutu całości — licznik wersji przelicza je przy zmianie.
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const offBilling = subscribeBilling(bump);
    const offPoints = subscribePoints(bump);
    return () => { offBilling(); offPoints(); };
  }, []);

  return useMemo(() => {
    void dayTick;
    void version;
    const dir = siteDirectoryOf(study);
    const cards = Object.fromEntries(dir.map((s) => [s.id, s]));
    const today = localDayKey();
    const workOf = (key: string) => workOn(shifts, key)?.minutes ?? 0;
    const statements = new Map<string, BillingStatement>();
    for (const site of dir) {
      if (site.archived) continue;
      const billing = getSiteBilling(site.id);
      if (billing.modes.length === 0) continue;
      const hours = siteMinutesInRange(study.journal, cards, site.id, "0000-01-01", today, workOf, dayKeyOf);
      statements.set(site.id, billingStatement({
        billing, rate: site.rate, minutes: hours.minutes, unsplit: hours.unsplit,
        points: getSitePoints(site.id).points.map((p) => ({ type: p.type, done: pointStage(p) === POINT_STEPS.length, rate: p.rate })),
        stages: siteStages(site), typeLabel: (id) => pointType(id).label,
      }));
    }
    const created = new Map(dir.map((s) => [s.id, s.created]));
    return receivables({ now: Date.now(), statements, siteCreated: (id) => created.get(id), jobs, invoices });
  }, [study, shifts, jobs, invoices, dayTick, version]);
}
