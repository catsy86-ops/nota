import { pluralPl } from "@/lib/plural";
import { REMINDER_ORDER_DAYS, REMINDER_PROBLEM_DAYS, type StudyReminder } from "./reminders";

/**
 * Terminy z Praca na Dziś i w Terminach — tylko do odczytu, z odnośnikiem do Pracy.
 * Bierze gotowe przypomnienia z `studyReminders` i zostawia to, co ma termin:
 * serwis, zamówienia bez dostawy, otwarte problemy. Protokół próby (`no-test`)
 * to przypomnienie do dziennika, nie termin, więc tu go nie ma.
 */

export interface StudyDueRow {
  key: string;
  kind: "service" | "order" | "problems";
  title: string;
  /** Pozycje (np. nazwy kształtek) albo krótki opis; pusty, gdy nie ma czego podać. */
  detail: string;
  /** Budowa, której dotyczy wiersz; `null` dla problemów (są w całym dzienniku). */
  siteId: string | null;
}

export function studyDueRows(reminders: readonly StudyReminder[]): StudyDueRow[] {
  const rows: StudyDueRow[] = [];
  for (const r of reminders) {
    if (r.kind === "service-due") {
      rows.push({ key: `service:${r.siteId}`, kind: "service", title: `Serwis: ${r.site}`, detail: r.items.join(", "), siteId: r.siteId });
    } else if (r.kind === "late-order") {
      rows.push({
        key: `order:${r.siteId}`,
        kind: "order",
        title: `Zamówienie bez dostawy: ${r.site}`,
        detail: `${r.items.join(", ")} — zamówione ponad ${REMINDER_ORDER_DAYS} dni temu`,
        siteId: r.siteId,
      });
    } else if (r.kind === "stale-problems") {
      rows.push({
        key: "problems",
        kind: "problems",
        title: `${r.count} ${pluralPl(r.count, ["otwarty problem", "otwarte problemy", "otwartych problemów"])}`,
        detail: `dłużej niż ${REMINDER_PROBLEM_DAYS} dni — w Dzienniku`,
        siteId: null,
      });
    }
  }
  return rows;
}
