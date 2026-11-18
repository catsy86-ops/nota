import type { Note } from "@/lib/types/note";
import { EXERCISE_LABEL } from "@/lib/exerciseLabel";

/**
 * Wspólny punkt „po Gotowe” (C1.4, `docs/plan-zgodnosc-i-obieg.md` §2.4) dla kafla terminu i akcji z powiadomienia (także
 * natywnego — idzie tą samą drogą). Rozdziela po etykiecie i ładuje dział leniwie, więc paczka startowa nie rośnie.
 * Wołać **po** zapisaniu łatki „Gotowe”; zwraca cofnięcie skutków albo nic.
 */

/** Notatka terminu zwrotu długu: etykieta albo stary tytuł sprzed etykiety. */
export const isDebtNote = (note: Pick<Note, "labels" | "title">) => note.labels.includes("długi") || /^(Zwrot od|Oddać) /.test(note.title);

export async function afterReminderDone(note: Note, occurrence: number, _source: "tile" | "notification"): Promise<(() => void) | void> {
  if (isDebtNote(note)) {
    const m = await import("@/lib/debts/settleFromNote");
    m.offerSettleFromNote(note.id);
    return;
  }
  if (note.labels.includes(EXERCISE_LABEL)) {
    const [{ takenFromReminder }, { supplementTakeDeps }] = await Promise.all([import("@/lib/supplements/takeFlow"), import("@/lib/supplements/store")]);
    const r = takenFromReminder(supplementTakeDeps(), note.id, occurrence);
    return r.changed ? r.undo : undefined;
  }
}
