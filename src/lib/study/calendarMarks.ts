import { pluralPl } from "@/lib/plural";
import { dueDayValue } from "./shortages";
import type { SiteCard } from "./sites";

/**
 * Znaczniki Pracy w kalendarzu (K2): ile wizyt serwisowych i dostaw wypada danego dnia.
 * Tylko odczyt — bez edycji i bez wpisywania czegokolwiek w kalendarz. Klucz dnia `yyyy-MM-dd`.
 * Budowy w archiwum pomijane, jak w przypomnieniach o zamówieniach.
 */
export interface StudyDayMarks {
  /** Zgłoszenia serwisowe z terminem tego dnia, jeszcze otwarte. */
  service: number;
  /** Zamówione pozycje z datą dostawy tego dnia, jeszcze niedostarczone. */
  delivery: number;
}

/** „Praca: 2 wizyty, 1 dostawa” albo `null`, gdy dzień jest czysty. Wspólne dla komórki i panelu dnia. */
export function studySummary(study: StudyDayMarks | undefined): string | null {
  if (!study || (study.service === 0 && study.delivery === 0)) return null;
  const parts: string[] = [];
  if (study.service > 0) parts.push(`${study.service} ${pluralPl(study.service, ["wizyta", "wizyty", "wizyt"])}`);
  if (study.delivery > 0) parts.push(`${study.delivery} ${pluralPl(study.delivery, ["dostawa", "dostawy", "dostaw"])}`);
  return `Praca: ${parts.join(", ")}`;
}

export function studyDayMarks(
  sites: Readonly<Record<string, Pick<SiteCard, "archived" | "service" | "shortages">>>,
): Map<string, StudyDayMarks> {
  const out = new Map<string, StudyDayMarks>();
  const bump = (key: string, field: keyof StudyDayMarks) => {
    const cur = out.get(key) ?? { service: 0, delivery: 0 };
    cur[field] += 1;
    out.set(key, cur);
  };
  for (const card of Object.values(sites)) {
    if (card.archived !== undefined) continue;
    for (const call of card.service ?? []) {
      if (call.done === undefined && call.due) bump(call.due, "service");
    }
    for (const s of card.shortages ?? []) {
      if (s.status === "ordered" && s.due !== undefined) bump(dueDayValue(s.due), "delivery");
    }
  }
  return out;
}
