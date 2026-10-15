import { ArrowDown, ArrowUp, Bell, Flag, Pin } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Folder, Note } from "@/hooks/useNotes";
import { PRIORITY_COLOR_CLASS, PRIORITY_LABELS } from "@/lib/notePriority";
import { setViewPref, type SortDir, type SortKey } from "@/lib/viewPrefs";

interface NoteTableProps {
  notes: Note[];
  folders: Folder[];
  sortKey: SortKey;
  sortDir: SortDir;
  onOpen: (id: string) => void;
  selectedIds?: Set<string>;
}

/** Kolumny, po których da się sortować — pozostałe nagłówki są tylko opisem. */
const COLUMNS: { key: string; label: string; sort?: SortKey; className?: string }[] = [
  { key: "title", label: "Tytuł", sort: "title" },
  { key: "folder", label: "Folder", className: "hidden md:table-cell" },
  { key: "labels", label: "Etykiety", className: "hidden lg:table-cell" },
  { key: "priority", label: "Priorytet", sort: "priority", className: "hidden sm:table-cell" },
  { key: "reminder", label: "Termin", className: "hidden sm:table-cell" },
  { key: "updated", label: "Zmieniono", sort: "updated" },
];

function noteLabel(n: Note): string {
  if (n.locked) return "Notatka prywatna";
  const first = n.content.split("\n").find((l) => l.trim());
  return n.title.trim() || first?.trim().slice(0, 80) || "Bez tytułu";
}

/**
 * Przegląd wszystkich notatek jako tabela: jeden wiersz = jedna notatka. Nagłówki z
 * sortowaniem korzystają z tych samych preferencji co menu „Sortowanie”. Wiersz otwiera czytnik.
 */
export function NoteTable({ notes, folders, sortKey, sortDir, onOpen, selectedIds }: NoteTableProps) {
  const folderName = (id: string | null) => (id ? folders.find((f) => f.id === id)?.name ?? "" : "");

  const sortBy = (key: SortKey) => {
    if (sortKey === key) setViewPref("sortDir", sortDir === "asc" ? "desc" : "asc");
    else { setViewPref("sortKey", key); setViewPref("sortDir", key === "title" ? "asc" : "desc"); }
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/60">
      <table className="w-full text-sm" data-note-table>
        <thead>
          <tr className="border-b border-border/60 text-left text-2xs uppercase tracking-wider text-muted-foreground">
            {COLUMNS.map((c) => {
              const active = c.sort !== undefined && c.sort === sortKey;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("px-3 py-2 font-semibold", c.className)}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => sortBy(c.sort!)}
                      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                    >
                      {c.label}
                      {active && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" aria-hidden /> : <ArrowDown className="w-3 h-3" aria-hidden />)}
                    </button>
                  ) : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {notes.map((n) => (
            <tr
              key={n.id}
              data-note-row={n.id}
              tabIndex={0}
              role="button"
              aria-label={`Otwórz notatkę: ${noteLabel(n)}`}
              onClick={() => onOpen(n.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(n.id); } }}
              className={cn(
                "cursor-pointer border-b border-border/40 last:border-0 transition-colors duration-fast hover:bg-muted/50",
                "focus-visible:outline-hidden focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
                selectedIds?.has(n.id) && "bg-primary/10",
              )}
            >
              {/* Telefon: tytuł bierze resztę szerokości i się skraca — wcześniej 18rem wypychało datę poza ekran. */}
              <td className="px-3 py-2 coarse:py-3 w-full max-w-0 sm:w-auto sm:max-w-[18rem]">
                <span className="flex items-center gap-1.5">
                  {n.pinned && <Pin className="w-3 h-3 shrink-0 text-primary-ink" aria-label="Przypięta" />}
                  {n.icon && <span aria-hidden>{n.icon}</span>}
                  <span className="truncate font-medium">{noteLabel(n)}</span>
                </span>
              </td>
              <td className="hidden md:table-cell px-3 py-2 text-muted-foreground truncate max-w-40">{folderName(n.folderId)}</td>
              <td className="hidden lg:table-cell px-3 py-2">
                <span className="flex flex-wrap gap-1">
                  {n.labels.slice(0, 3).map((l) => (
                    <span key={l} className="rounded-full bg-muted px-1.5 text-2xs text-muted-foreground">#{l}</span>
                  ))}
                  {n.labels.length > 3 && <span className="text-2xs text-muted-foreground">+{n.labels.length - 3}</span>}
                </span>
              </td>
              <td className="hidden sm:table-cell px-3 py-2">
                {n.priority !== "none" && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Flag className={cn("w-3 h-3 fill-current", PRIORITY_COLOR_CLASS[n.priority])} aria-hidden />
                    {PRIORITY_LABELS[n.priority]}
                  </span>
                )}
              </td>
              <td className="hidden sm:table-cell px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                {n.reminder !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Bell className="w-3 h-3" aria-hidden />
                    {format(n.reminder, "d MMM, HH:mm", { locale: pl })}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                <span className="sm:hidden">{format(n.updatedAt, "d MMM", { locale: pl })}</span>
                <span className="hidden sm:inline">{format(n.updatedAt, "d MMM yyyy", { locale: pl })}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
