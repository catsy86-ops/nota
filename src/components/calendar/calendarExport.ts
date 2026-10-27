import { format } from "date-fns";
import { toast } from "sonner";
import { pluralPl } from "@/lib/plural";
import { buildIcs, exportableReminders } from "@/lib/icsExport";
import { download } from "@/lib/exportNotes";
import type { Note } from "@/hooks/useNotes";

/** Eksport kalendarza do pliku .ics (K5.2): jedno wystąpienie i wszystkie nadchodzące terminy. */
function exportIcs(list: Note[], filename: string) {
  download(buildIcs(list), filename, "text/calendar;charset=utf-8");
}

/** Pobranie jednej notatki z terminem (menu wystąpienia). `at` — termin w pliku nazwy. */
export function exportOneReminder(note: Note, at: number) {
  exportIcs([note], `przypomnienie-${format(new Date(at), "yyyy-MM-dd")}.ics`);
  toast("Pobrano plik .ics", { description: "Otwórz go, żeby dodać termin do kalendarza systemowego." });
}

/** Pobranie wszystkich nadchodzących terminów (bez notatek prywatnych, zob. `exportableReminders`). */
export function exportAllReminders(notes: Note[]) {
  const list = exportableReminders(notes);
  if (list.length === 0) { toast.info("Brak nadchodzących terminów do eksportu"); return; }
  exportIcs(list, `przypomnienia-${format(new Date(), "yyyy-MM-dd")}.ics`);
  const n = list.length;
  toast(`Pobrano ${n} ${pluralPl(n, ["termin", "terminy", "terminów"])} (.ics)`, {
    description: "Ponowny import zaktualizuje wpisy zamiast je dublować.",
  });
}
