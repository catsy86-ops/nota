import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArrowUpRight, History, RotateCcw, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { canUndo, clearActions, relativeTime, undoAction, useActionHistory, type ActionKind } from "@/lib/actionHistory";

const META: Record<ActionKind, { icon: typeof Trash2; verb: string; tone: string }> = {
  trash: { icon: Trash2, verb: "Do kosza", tone: "text-destructive" },
  archive: { icon: Archive, verb: "Do archiwum", tone: "text-primary" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Pokazuje notatkę z wpisu tam, gdzie teraz jest (Notatki / Archiwum / Kosz).
   * Panel nie ma własnego edytora — edycja dzieje się w karcie, jak wszędzie.
   */
  onOpenNote?: (noteIds: string[]) => void;
}

export function RecentActionsPanel({ open, onOpenChange, onOpenNote }: Props) {
  const entries = useActionHistory();
  const [, setTick] = useState(0);

  // refresh relative timestamps while the panel is open
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, [open]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ActionKind>("all");

  useEffect(() => {
    if (!open) { setQuery(""); setFilter("all"); }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "all" && e.kind !== filter) return false;
      if (!q) return true;
      return (
        e.label.toLowerCase().includes(q) ||
        (e.preview || "").toLowerCase().includes(q) ||
        META[e.kind].verb.toLowerCase().includes(q)
      );
    });
  }, [entries, query, filter]);

  const pending = entries.filter((e) => canUndo(e)).length;

  function showNote(noteIds: string[]) {
    if (!onOpenNote) return;
    onOpenChange(false);
    onOpenNote(noteIds);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <History className="w-4 h-4 text-primary" />
            Ostatnie akcje
          </SheetTitle>
          <SheetDescription>
            {entries.length === 0
              ? "Tu pojawią się przeniesienia do kosza i archiwum z tej sesji."
              : `${pending} do cofnięcia • ${entries.length} w historii`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj po treści notatki…"
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {([
              { k: "all" as const, l: "Wszystkie" },
              { k: "trash" as const, l: "Kosz" },
              { k: "archive" as const, l: "Archiwum" },
            ]).map((o) => (
              <Button
                key={o.k}
                size="sm"
                variant={filter === o.k ? "secondary" : "ghost"}
                className="h-7 px-3 text-xs rounded-full"
                onClick={() => setFilter(o.k)}
              >
                {o.l}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2 space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((e) => {
              const meta = META[e.kind];
              const Icon = meta.icon;
              return (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5"
                >
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${meta.tone}`} />
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => showNote(e.noteIds)}
                    onKeyDown={(ev) => { if (ev.key === "Enter") showNote(e.noteIds); }}
                    title="Pokaż notatkę"
                  >
                    <p className="text-sm font-medium truncate">{e.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {meta.verb} • {relativeTime(e.at)}
                      {e.count > 1 ? ` • ${e.count} notatek` : ""}
                    </p>
                    {e.preview && (
                      <p className="mt-1 text-xs text-muted-foreground/90 line-clamp-2">{e.preview}</p>
                    )}
                  </div>
                  {onOpenNote && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-8 w-8 p-0"
                      title="Pokaż notatkę"
                      aria-label="Pokaż notatkę"
                      onClick={() => showNote(e.noteIds)}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {!canUndo(e) ? (
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {e.undone ? "Cofnięto" : "—"}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-8 gap-1.5 text-xs"
                      onClick={() => {
                        if (undoAction(e.id)) toast.success("Cofnięto");
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Cofnij
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-16">
              {entries.length === 0 ? "Brak akcji do pokazania" : "Nic nie pasuje do wyszukiwania"}
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-3 text-xs text-muted-foreground" onClick={clearActions}>
            Wyczyść historię
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
