import type { ReactElement } from "react";
import { FileJson, FileText, NotebookPen, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNotesContext } from "@/hooks/NotesProvider";
import { exportToJSON, exportToMarkdown, exportToHTML } from "@/lib/exportNotes";
import { markBackup } from "@/lib/backupReminder";
import { downloadNotesZip } from "@/lib/exportZip";
import { toast } from "sonner";
import { OPEN_EXTERNAL_IMPORT_EVENT } from "@/hooks/useImportExport";

interface ImportExportMenuProps {
  /** Przycisk otwierający menu (musi przyjmować `ref`). */
  children: ReactElement;
  onImport: () => void;
  /** Po wybraniu pozycji — np. zamknięcie arkusza „Więcej”. */
  onDone?: () => void;
  align?: "start" | "end";
}

/** Eksport notatek (JSON, PDF, Markdown, HTML) import z JSON oraz z Google Keep / Markdown — w nagłówku i w „Więcej” na telefonie. */
export function ImportExportMenu({ children, onImport, onDone, align = "end" }: ImportExportMenuProps) {
  const { notes, archivedNotes, folders } = useNotesContext();
  const all = () => [...notes, ...archivedNotes];
  const run = (fn: () => void) => () => { fn(); onDone?.(); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuItem onClick={run(() => { void exportToJSON(all()).then(markBackup); })}>
          <FileJson className="w-4 h-4 mr-2" />
          Eksportuj jako JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={run(() => { import("@/lib/exportPdf").then((m) => m.exportToPDF(all())); })}>
          <FileText className="w-4 h-4 mr-2" />
          Eksportuj jako PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={run(() => exportToMarkdown(all()))}>
          <FileText className="w-4 h-4 mr-2" />
          Eksportuj jako Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={run(() => {
          const zip = downloadNotesZip(all(), folders, `notatki-${new Date().toISOString().slice(0, 10)}.zip`);
          toast.success(`Pobrano ${zip.count} notatek (ZIP z plikami .md)`, {
            description: zip.skippedPrivate ? `Pominięto ${zip.skippedPrivate} prywatnych — ich treść jest zaszyfrowana.` : "Foldery jako katalogi; bez obrazów i załączników.",
          });
        })}>
          <FileText className="w-4 h-4 mr-2" />
          Eksportuj jako ZIP z plikami .md
        </DropdownMenuItem>
        <DropdownMenuItem onClick={run(() => exportToHTML(all()))}>
          <FileText className="w-4 h-4 mr-2" />
          Eksportuj jako HTML
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={run(onImport)}>
          <Upload className="w-4 h-4 mr-2" />
          Importuj z JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={run(() => window.dispatchEvent(new Event(OPEN_EXTERNAL_IMPORT_EVENT)))}>
          <NotebookPen className="w-4 h-4 mr-2" />
          Z Google Keep / Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
