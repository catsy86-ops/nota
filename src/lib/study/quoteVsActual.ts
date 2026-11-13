import { round2 } from "./billing";
import { quoteTotals, type Job } from "./jobs";
import type { MaterialUsage } from "./materialUsage";
import type { SiteHours } from "./siteHours";

/**
 * Wycena a wykonanie (plan wycen i klientów, 5.2): ile wyceniono materiału i robocizny, a ile poszło w praktyce. Materiał
 * porównuje się w cenach zakupu (bez marży): wycena `quoteTotals(...).material` kontra koszt zużytych kształtek i rur
 * z cennika (`materialUsage`). Robocizna: wyceniona kwota kontra godziny wpisane w karcie budowy × stawka godzinowa karty.
 * Dodatnia różnica = wyszło drożej niż w wycenie. Czyste funkcje, nic nie jest zapisywane.
 */

export interface QuoteVsActual {
  quotedMaterial: number;
  /** Koszt zużytego materiału z cennika; `null` = żadna pozycja nie ma ceny. */
  usedMaterial: number | null;
  /** Ile zużytych pozycji nie ma ceny (koszt jest wtedy zaniżony). */
  unpriced: number;
  /** `usedMaterial − quotedMaterial`; `null`, gdy nie ma kosztu. */
  materialDiff: number | null;
  quotedLabor: number;
  /** Godziny wpisane w karcie budowy (dziesiętnie). */
  hours: number;
  /** Stawka godzinowa karty budowy; `null` = nie wpisano. */
  rate: number | null;
  /** `godziny × stawka`; `null`, gdy brak godzin albo stawki. */
  actualLabor: number | null;
  laborDiff: number | null;
  /** Suma różnic z tego, co dało się policzyć; `null`, gdy nic. */
  totalDiff: number | null;
  /** Czy jest cokolwiek do pokazania (zużyty materiał z ceną albo godziny). */
  hasData: boolean;
}

export function quoteVsActual(
  job: Pick<Job, "items" | "margin">,
  usage: Pick<MaterialUsage, "cost" | "unpriced">,
  hoursList: readonly SiteHours[] | undefined,
  rate: number | undefined,
): QuoteVsActual {
  const totals = quoteTotals(job);
  const minutes = (hoursList ?? []).reduce((s, h) => s + h.minutes, 0);
  const hours = round2(minutes / 60);
  const usedMaterial = usage.cost;
  const materialDiff = usedMaterial === null ? null : round2(usedMaterial - totals.material);
  const actualLabor = rate !== undefined && minutes > 0 ? round2((minutes / 60) * rate) : null;
  const laborDiff = actualLabor === null ? null : round2(actualLabor - totals.labor);
  const diffs = [materialDiff, laborDiff].filter((d): d is number => d !== null);
  return {
    quotedMaterial: totals.material,
    usedMaterial,
    unpriced: usage.unpriced,
    materialDiff,
    quotedLabor: totals.labor,
    hours,
    rate: rate ?? null,
    actualLabor,
    laborDiff,
    totalDiff: diffs.length > 0 ? round2(diffs.reduce((a, b) => a + b, 0)) : null,
    hasData: usedMaterial !== null || minutes > 0,
  };
}

/** „3 h 30 min” z godzin dziesiętnych (godziny wpisywane są co do minuty). */
export function hoursLabel(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h > 0 && `${h} h`, m > 0 && `${m} min`].filter(Boolean).join(" ") || "0 h";
}
