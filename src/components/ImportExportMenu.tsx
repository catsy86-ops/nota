import type { ReactElement } from "react";
import { FileJson, FileText, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNotesContext } from "@/hooks/NotesProvider";
import { exportToJSON, exportToMarkdown, exportToHTML } from "@/lib/exportNotes";
import { markBackup } from "@/lib/backupReminder";

interface ImportExportMenuProps {
  /** Przycisk otwierający menu (musi przyjmować `ref`). */
  children: ReactElement;
  onImport: () => void;
  /** Po wybraniu pozycji — np. zamknięcie arkusza „Więcej”. */
  onDone?: () => void;
  align?: "start" | "end";
}

/** Eksport notatek (JSON, PDF, Markdown, HTML) i import z JSON — w nagłówku i w „Więcej” na telefonie. */
export function ImportExportMenu({ children, onImport, onDone, align = "end" }: ImportExportMenuProps) {
  const { notes, archivedNotes } = useNotesContext();
  const all = () => [...notes, ...archivedNotes];
  const run = (fn: () => void) => () => { fn(); onDone?.(); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
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
        <DropdownMenuItem onClick={run(() => exportToHTML(all()))}>
          <FileText className="w-4 h-4 mr-2" />
          Eksportuj jako HTML
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={run(onImport)}>
          <Upload className="w-4 h-4 mr-2" />
          Importuj z JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
