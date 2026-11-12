import { useMemo, useState } from "react";
import { RotateCcwClock, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { m as motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { diffWords, paragraphHunks, restoreHunk, wordChanges } from "@/lib/wordDiff";
import { cn } from "@/lib/utils";

type Look = "content" | "inline" | "side";

/** Słowa dopisane i usunięte między wersją a bieżącą treścią — kolory z tokenów, plus przekreślenie/podkreślenie dla czytelności bez koloru. */
function InlineDiff({ before, after }: { before: string; after: string }) {
  const ops = useMemo(() => diffWords(before, after), [before, after]);
  return (
    <p className="whitespace-pre-wrap wrap-break-word text-xs leading-relaxed" data-testid="version-diff-inline">
      {ops.map((o, i) =>
        o.type === "eq" ? <span key={i}>{o.text}</span>
          : o.type === "del" ? <del key={i} className="mr-0.5 rounded-control bg-destructive/15 text-destructive-ink decoration-destructive/60">{o.text}</del>
          : <ins key={i} className="rounded-control bg-success/15 text-foreground underline decoration-success decoration-2 underline-offset-2">{o.text}</ins>,
      )}
    </p>
  );
}

/** Akapity wersji i bieżącej treści obok siebie; zmieniony blok można przywrócić osobno. */
function SideBySide({ version, current, onRestore }: { version: string; current: string; onRestore?: (content: string) => void }) {
  const hunks = useMemo(() => paragraphHunks(current, version), [current, version]);
  if (!hunks.some((h) => h.kind === "changed")) return <p className="ui-hint">Treść jest taka sama jak teraz.</p>;
  return (
    <div className="space-y-1.5 text-xs" data-testid="version-diff-side">
      <div className="hidden grid-cols-2 gap-2 font-medium text-muted-foreground sm:grid"><span>Ta wersja</span><span>Teraz</span></div>
      {hunks.map((h, i) => h.kind === "same" ? (
        <p key={i} className="truncate text-muted-foreground" title={h.text}>{h.text || " "}</p>
      ) : (
        <div key={i} className="rounded-field border border-border/60 p-2 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-control bg-destructive/10 p-1.5 whitespace-pre-wrap wrap-break-word"><span className="sr-only">Ta wersja: </span>{h.version.join("\n\n") || <em className="text-muted-foreground">brak</em>}</div>
            <div className="rounded-control bg-success/10 p-1.5 whitespace-pre-wrap wrap-break-word"><span className="sr-only">Teraz: </span>{h.current.join("\n\n") || <em className="text-muted-foreground">brak</em>}</div>
          </div>
          {onRestore && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs coarse:h-11" onClick={() => onRestore(restoreHunk(hunks, i))}>
              <RotateCcw className="w-3 h-3" aria-hidden />Przywróć tylko ten akapit
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

interface VersionHistoryDialogProps {
  versions: NoteVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: NoteVersion) => void;
  /** Bieżąca treść notatki — do porównania (6.2). Brak = tylko podgląd wersji. */
  current?: string;
  /** „Przywróć tylko ten akapit”: nowa treść notatki. */
  onRestoreContent?: (content: string) => void;
}

/** Okno „Historia wersji” z „Więcej”. Ładowane leniwie przez `VersionHistory.tsx`. */
export default function VersionHistoryDialog({ versions, open, onOpenChange, onRestore, current, onRestoreContent }: VersionHistoryDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [look, setLook] = useState<Look>("content");
  // 4.8: zmiana każdej wersji względem stanu nowszego (wersji wyżej na osi albo bieżącej treści). Lista jest od najnowszej.
  const changes = useMemo(() => (open ? versions.map((v, i) => {
    const newer = i === 0 ? current : versions[i - 1].content;
    return newer === undefined ? null : wordChanges(v.content, newer);
  }) : []), [open, versions, current]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <RotateCcwClock className="w-5 h-5" />
            Historia wersji
          </DialogTitle>
        </DialogHeader>
        {/* Oś czasu (4.8): pionowa linia jak margines zeszytu, kropka przy każdej wersji. */}
        <div className="relative space-y-2 pt-2 pl-5" data-testid="version-timeline">
          <span aria-hidden className="absolute left-[7px] top-4 bottom-4 w-px bg-border" />
          {versions.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative border border-border/50 rounded-card"
            >
              <span aria-hidden className={cn("absolute -left-[17px] top-4 size-2.5 rounded-full border-2 bg-card", i === 0 ? "border-primary" : "border-muted-foreground/50")} />
              <button
                type="button"
                aria-expanded={expandedId === v.id}
                onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">
                    {v.title || <span className="text-muted-foreground italic">Bez tytułu</span>}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    <time dateTime={new Date(v.timestamp).toISOString()} title={format(new Date(v.timestamp), "d MMM yyyy, HH:mm", { locale: pl })}>
                      {formatDistanceToNow(new Date(v.timestamp), { addSuffix: true, locale: pl })}
                    </time>
                    {changes[i] && (changes[i]!.added > 0 || changes[i]!.removed > 0) && (
                      <span className="ml-2 font-mono tabular-nums" aria-label={`Później dopisano ${changes[i]!.added}, usunięto ${changes[i]!.removed} słów`}>
                        <span className="text-success-ink">+{changes[i]!.added}</span> <span className="text-destructive-ink">−{changes[i]!.removed}</span> sł.
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {expandedId === v.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
              <AnimatePresence>
                {expandedId === v.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2">
                      {current !== undefined && (
                        <ToggleGroup value={look} onValueChange={(x) => x && setLook(x as Look)} aria-label="Jak pokazać wersję" className="inline-grid">
                          <ToggleGroupItem value="content" className="px-2.5 text-xs">Treść</ToggleGroupItem>
                          <ToggleGroupItem value="inline" className="px-2.5 text-xs">Zmiany w tekście</ToggleGroupItem>
                          <ToggleGroupItem value="side" className="px-2.5 text-xs">Obok</ToggleGroupItem>
                        </ToggleGroup>
                      )}
                      <div className={cn("bg-muted/30 rounded-field p-2 overflow-y-auto", look === "side" ? "max-h-80" : "max-h-48")}>
                        {current !== undefined && look === "inline" ? (
                          <InlineDiff before={v.content} after={current} />
                        ) : current !== undefined && look === "side" ? (
                          <SideBySide version={v.content} current={current} onRestore={onRestoreContent ? (c) => { onRestoreContent(c); onOpenChange(false); } : undefined} />
                        ) : v.content ? (
                          <MarkdownRenderer content={v.content} className="text-xs" />
                        ) : (
                          <p className="ui-hint italic">Brak treści</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); onRestore(v); onOpenChange(false); }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Przywróć tę wersję
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
