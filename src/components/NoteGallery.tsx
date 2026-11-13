import { Pin, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/hooks/useNotes";
import { useImageUrl } from "@/hooks/useImageUrl";
import { formatPropValue, type PropDef } from "@/lib/noteProps";

/** Ile pól z wartością pokazuje karta galerii pod tytułem (plan Notatek 6.3). */
const GALLERY_FIELDS = 3;

function noteLabel(n: Note): string {
  if (n.locked) return "Notatka prywatna";
  const first = n.content.split("\n").find((l) => l.trim());
  return n.title.trim() || first?.trim().slice(0, 80) || "Bez tytułu";
}

/** Okładka: pierwszy obraz notatki (miniatura); bez obrazu — spokojne pole z ikoną. */
function Cover({ note }: { note: Note }) {
  const ref = !note.locked ? note.images?.[0] : undefined;
  const url = useImageUrl(ref ?? "", true);
  if (ref && url) {
    return <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" draggable={false} />;
  }
  return (
    <span className="flex size-full items-center justify-center bg-muted/50 text-muted-foreground" aria-hidden>
      {note.icon ? <span className="text-3xl">{note.icon}</span> : <ImageOff className="h-6 w-6 opacity-50" />}
    </span>
  );
}

export interface NoteGalleryProps {
  notes: Note[];
  onOpen: (id: string) => void;
  selectedIds?: Set<string>;
  propDefs?: PropDef[];
}

/**
 * Galeria (plan Notatek 6.3): układ widoku z okładkami. Karta to obraz z notatki, tytuł i do trzech pól z wartością.
 * Siatka wypełnia szerokość kolumnami po co najmniej 11 rem (telefon: dwie kolumny). Jak tabela jest tylko do przeglądania:
 * kliknięcie albo Enter/Spacja otwiera czytnik, edycja pól zostaje w tabeli i czytniku.
 */
export function NoteGallery({ notes, onOpen, selectedIds, propDefs = [] }: NoteGalleryProps) {
  const defs = [...propDefs].sort((a, b) => a.order - b.order);
  return (
    <ul data-note-gallery className="grid grid-cols-[repeat(auto-fill,minmax(min(11rem,100%),1fr))] gap-3 max-sm:grid-cols-2">
      {notes.map((n) => {
        const fields = n.locked
          ? []
          : defs
              .map((d) => [d.name, formatPropValue(d, n.props, n)] as const)
              .filter(([, text]) => text !== "")
              .slice(0, GALLERY_FIELDS);
        return (
          <li key={n.id} className="min-w-0">
            <div
              data-note-card-gallery={n.id}
              role="button"
              tabIndex={0}
              aria-label={`Otwórz notatkę: ${noteLabel(n)}`}
              onClick={() => onOpen(n.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(n.id); } }}
              className={cn(
                "group flex h-full cursor-pointer flex-col overflow-hidden rounded-card border border-border/60 bg-card/70 transition-colors duration-fast hover:bg-muted/40",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50",
                selectedIds?.has(n.id) && "border-primary bg-primary/10",
              )}
            >
              <div className="aspect-4/3 w-full overflow-hidden bg-muted/30"><Cover note={n} /></div>
              <div className="min-w-0 space-y-0.5 p-2.5">
                <p className="flex items-center gap-1 text-sm font-medium">
                  {n.pinned && <Pin className="h-3 w-3 shrink-0 text-primary-ink" aria-label="Przypięta" />}
                  <span className="truncate">{noteLabel(n)}</span>
                </p>
                {fields.map(([name, text]) => (
                  <p key={name} className="truncate text-2xs text-muted-foreground"><span className="font-medium">{name}:</span> {text}</p>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
