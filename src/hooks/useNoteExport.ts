import { toast } from "sonner";
import type { Folder, Note } from "@/hooks/useNotes";
import type { PropDef } from "@/lib/noteProps";
import { downloadNotesZip } from "@/lib/exportZip";

interface Args {
  notes: Note[];
  archivedNotes: Note[];
  trashedNotes: Note[];
  selectedIds: ReadonlySet<string>;
  folders: Folder[];
  propDefs: PropDef[];
}

/**
 * Eksport zaznaczonych notatek z paska zbiorczego: HTML i PDF (biblioteki ładowane leniwie, prywatne pomijane, bo ich
 * treść jest zaszyfrowana) oraz ZIP z plikami `.md`. Wyciągnięte z `Index.tsx` bez zmiany zachowania.
 */
export function useNoteExport({ notes, archivedNotes, trashedNotes, selectedIds, folders, propDefs }: Args) {
  async function exportSelectedAs(kind: "html" | "pdf") {
    const chosen = [...notes, ...archivedNotes, ...trashedNotes].filter((n) => selectedIds.has(n.id) && !n.locked);
    if (chosen.length === 0) { toast.info("Nic do eksportu", { description: "Zaznaczone notatki są prywatne." }); return; }
    if (kind === "html") (await import("@/lib/exportNotes")).exportToHTML(chosen);
    else (await import("@/lib/exportPdf")).exportToPDF(chosen);
  }

  function exportSelectedZip() {
    const ids = selectedIds;
    const chosen = [...notes, ...archivedNotes, ...trashedNotes].filter((n) => ids.has(n.id));
    const zip = downloadNotesZip(chosen, folders, `notatki-${new Date().toISOString().slice(0, 10)}.zip`, propDefs);
    toast.success(`Pobrano ${zip.count} ${zip.count === 1 ? "notatkę" : "notatek"} (ZIP z plikami .md)`, {
      description: zip.skippedPrivate ? `Pominięto ${zip.skippedPrivate} prywatnych — ich treść jest zaszyfrowana.` : "Bez obrazów i załączników. Da się je wczytać z powrotem przez Importuj → Markdown.",
    });
  }

  return { exportSelectedAs, exportSelectedZip };
}
