import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Minus, Plus, X, Maximize2 } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import { findBacklinks, resolveWikiTarget } from "@/lib/wikiLinks";
import { readingTimeMin } from "@/lib/viewPrefs";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface Props {
  noteId: string | null;
  notes: Note[];
  onOpenChange: (v: boolean) => void;
  onNavigate: (id: string) => void;
}

export function NotePresentation({ noteId, notes, onOpenChange, onNavigate }: Props) {
  const note = notes.find((n) => n.id === noteId) || null;
  const [zoom, setZoom] = useState(1.1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!note) return;
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(2.4, z + 0.1));
      if (e.key === "-") setZoom((z) => Math.max(0.7, z - 0.1));
      if (e.key === "0") setZoom(1.1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [note]);

  if (!note) return null;

  const known = new Set(notes.filter((n) => n.title.trim()).map((n) => n.title.trim().toLowerCase()));
  const backlinks = findBacklinks(note, notes);
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const minutes = readingTimeMin(note.content);

  function handleWiki(title: string) {
    const target = resolveWikiTarget(title, notes);
    if (target) onNavigate(target.id);
  }

  return (
    <Dialog open={!!noteId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2 min-w-0">
            <Maximize2 className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              {format(new Date(note.updatedAt), "d MMM yyyy, HH:mm", { locale: pl })}
              {" · "}
              {words} słów · ~{minutes} min czytania
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))} title="Mniej (-)">
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-xs font-mono w-12 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(2.4, z + 0.1))} title="Więcej (+)">
              <Plus className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenChange(false)} title="Zamknij (Esc)">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8">
          <div style={{ fontSize: `${zoom}rem`, lineHeight: 1.65 }} className="max-w-3xl mx-auto">
            {note.title && (
              <h1 className="font-display font-extrabold text-foreground mb-4" style={{ fontSize: `${zoom * 2.2}rem` }}>
                {note.title}
              </h1>
            )}
            {note.content ? (
              <MarkdownRenderer content={note.content} onWikiClick={handleWiki} knownTitles={known} />
            ) : (
              <p className="text-muted-foreground italic">Pusta notatka.</p>
            )}

            {(note.checklist || []).length > 0 && (
              <div className="mt-6 space-y-1.5">
                {note.checklist.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <span>{c.checked ? "☑" : "☐"}</span>
                    <span className={c.checked ? "line-through opacity-60" : ""}>{c.text}</span>
                  </div>
                ))}
              </div>
            )}

            {backlinks.length > 0 && (
              <div className="mt-10 pt-6 border-t border-border/50" style={{ fontSize: "0.95rem" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  🔗 Linkują tutaj ({backlinks.length})
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {backlinks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onNavigate(b.id)}
                      className="text-left rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 px-3 py-2 transition-colors"
                    >
                      <p className="font-semibold text-sm text-foreground truncate">{b.title || "Bez tytułu"}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{b.content.slice(0, 120)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/50 bg-muted/20 px-4 py-1.5 text-[10px] text-center text-muted-foreground">
          <kbd className="font-mono">+</kbd>/<kbd className="font-mono">-</kbd> zoom · <kbd className="font-mono">0</kbd> reset · <kbd className="font-mono">Esc</kbd> zamknij
        </div>
      </DialogContent>
    </Dialog>
  );
}
