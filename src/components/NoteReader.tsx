import { Fragment, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Minimize2, Minus, Pencil, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { Note } from "@/hooks/useNotes";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { backlinksOf, type WikiIndex } from "@/lib/wikiLinks";
import { readingTimeMin, useViewPrefs } from "@/lib/viewPrefs";
import { setGridNavPreviewScrollEl } from "@/lib/gridKeyboardNav";
import { cn } from "@/lib/utils";

/**
 * Jedno miejsce czytania notatki (wcześniej: szybki podgląd w `NoteGrid`
 * i osobne `NotePresentation`, każde z inną połową funkcji).
 *
 * - `preview` — Spacja na kaflu. Klawisze obsługuje `gridKeyboardNav`
 *   (przewijanie, Enter = edycja, Spacja/Esc = zamknij), bo to on otwiera podgląd.
 * - `present` — przycisk „Prezentacja” albo „Pełny ekran” z podglądu. Klawisze
 *   obsługuje sam czytnik (zoom, Enter, Esc); `data-state="open"` przy
 *   `role="dialog"` wyłącza w tym czasie nawigację po siatce pod spodem.
 *
 * Edycja zawsze dzieje się w karcie — czytnik tylko do niej prowadzi.
 */
export type ReaderMode = "preview" | "present";

interface Props {
  note: Note;
  mode: ReaderMode;
  searchQuery?: string;
  knownTitles: Set<string>;
  wikiIndex: WikiIndex;
  onClose: () => void;
  onEdit: (id: string) => void;
  /** Przejście do innej notatki (wikilink, „Linkują tutaj”, przełączenie trybu). */
  onShow: (id: string, mode: ReaderMode) => void;
  /** Wikilink → id notatki o tym tytule, jeśli istnieje. */
  resolveTitle: (title: string) => string | undefined;
}

const ZOOM_DEFAULT = 1.1;

function escRx(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Słowa z wyszukiwania warte podświetlenia (bez filtrów `label:` itp.). */
function searchTokens(query: string | undefined): string[] {
  const q = (query || "").trim();
  if (!q) return [];
  return q.split(/\s+/).filter((tok) => !/^(label|color|has):/i.test(tok) && tok.length >= 2);
}

function buildSnippets(text: string, tokens: string[], max = 3) {
  if (!tokens.length || !text) return [];
  const rx = new RegExp(tokens.map(escRx).join("|"), "gi");
  const out: { before: string; match: string; after: string }[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) && out.length < max) {
    const start = Math.max(0, m.index - 40);
    if (seen.has(start)) continue;
    seen.add(start);
    const end = m.index + m[0].length;
    out.push({
      before: (start > 0 ? "…" : "") + text.slice(start, m.index),
      match: m[0],
      after: text.slice(end, end + 60) + (end + 60 < text.length ? "…" : ""),
    });
  }
  return out;
}

export function NoteReader({ note, mode, searchQuery, knownTitles, wikiIndex, onClose, onEdit, onShow, resolveTitle }: Props) {
  const present = mode === "present";
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { showBacklinks } = useViewPrefs();
  const canEdit = !note.trashed;

  // Nowa notatka zaczyna czytanie od góry.
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [note.id]);

  useEffect(() => {
    if (!present) return;
    scrollRef.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(2.4, z + 0.1));
      else if (e.key === "-") setZoom((z) => Math.max(0.7, z - 0.1));
      else if (e.key === "0") setZoom(ZOOM_DEFAULT);
      else if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && canEdit && !(t instanceof HTMLButtonElement)) onEdit(note.id);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, note.id, canEdit, onClose, onEdit]);

  const tokens = searchTokens(searchQuery);
  const snippets = buildSnippets(note.content || "", tokens);
  const titleHits = tokens.some((t) => note.title.toLowerCase().includes(t.toLowerCase())) ? 1 : 0;
  const backlinks = showBacklinks ? backlinksOf(note, wikiIndex) : [];
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;

  function highlight(text: string) {
    if (!tokens.length || !text) return text;
    const rx = new RegExp(`(${tokens.map(escRx).join("|")})`, "gi");
    return text.split(rx).map((p, i) =>
      tokens.some((t) => t.toLowerCase() === p.toLowerCase())
        ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{p}</mark>
        : <Fragment key={i}>{p}</Fragment>
    );
  }

  function handleWiki(title: string) {
    const id = resolveTitle(title);
    if (id) onShow(id, mode);
  }

  function setScrollEl(el: HTMLDivElement | null) {
    scrollRef.current = el;
    // W podglądzie strzałki i PgUp/PgDn przewijają przez `gridKeyboardNav`.
    setGridNavPreviewScrollEl(present ? null : el);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn("fixed inset-0 z-50", present ? "bg-background/70 backdrop-blur-sm" : "bg-background/20 backdrop-blur-[2px]")}
        onClick={onClose}
      />
      {/* Centrowanie flexem, nie translate — framer-motion nadpisuje `transform`. */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        role="dialog"
        aria-modal="true"
        aria-label={note.title || "Notatka bez tytułu"}
        data-state={present ? "open" : undefined}
        data-reader-mode={mode}
        className={cn(
          "pointer-events-auto flex flex-col rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl",
          present ? "w-[min(56rem,95vw)] h-[90dvh]" : "w-full max-w-2xl max-h-[80dvh]",
        )}
        onClick={(e) => e.stopPropagation()}
        onWheelCapture={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 px-5 pt-4 pb-3 border-b border-border/40">
          <div className="min-w-0 flex-1">
            {!present && (
              <h2 className="font-display text-lg font-semibold leading-tight">
                {note.title ? highlight(note.title) : "Bez tytułu"}
              </h2>
            )}
            <p className={cn("text-xs text-muted-foreground", !present && "mt-1")}>
              {format(new Date(note.updatedAt), "d MMM yyyy, HH:mm", { locale: pl })}
              {" · "}{words} słów · ~{readingTimeMin(note.content)} min czytania
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {present && (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))} title="Mniejsza czcionka (-)" aria-label="Mniejsza czcionka">
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono w-10 text-center text-muted-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(2.4, z + 0.1))} title="Większa czcionka (+)" aria-label="Większa czcionka">
                  <Plus className="w-4 h-4" />
                </Button>
              </>
            )}
            {canEdit && (
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => onEdit(note.id)} title="Edytuj (Enter)">
                <Pencil className="w-3.5 h-3.5" /> Edytuj
              </Button>
            )}
            <Button
              size="icon" variant="ghost" className="h-8 w-8"
              onClick={() => onShow(note.id, present ? "preview" : "present")}
              title={present ? "Zwiń do podglądu" : "Pełny ekran"}
              aria-label={present ? "Zwiń do podglądu" : "Pełny ekran"}
            >
              {present ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} title="Zamknij (Esc)" aria-label="Zamknij">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div ref={setScrollEl} tabIndex={-1} className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain outline-none", present ? "px-6 sm:px-12 py-8" : "px-6 py-4")}>
          <div className={cn(present && "max-w-3xl mx-auto")} style={present ? { fontSize: `${zoom}rem`, lineHeight: 1.65 } : undefined}>
            {present && note.title && (
              <h1 className="font-display font-extrabold text-foreground mb-4" style={{ fontSize: `${zoom * 2.2}rem`, lineHeight: 1.15 }}>
                {highlight(note.title)}
              </h1>
            )}

            {tokens.length > 0 && (
              <div className="mb-4 space-y-1.5" style={present ? { fontSize: "0.875rem" } : undefined}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs uppercase tracking-wider text-muted-foreground">Pasuje do:</span>
                  {tokens.map((t) => (
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">{t}</span>
                  ))}
                  <span className="text-2xs text-muted-foreground ml-1">
                    {snippets.length + titleHits} trafień{snippets.length >= 3 ? "+" : ""}
                  </span>
                </div>
                {snippets.map((s, i) => (
                  <div key={i} className="text-xs text-foreground/80 bg-muted/40 rounded-lg px-2.5 py-1.5 leading-relaxed">
                    {s.before}<mark className="bg-primary/30 text-foreground rounded px-0.5">{s.match}</mark>{s.after}
                  </div>
                ))}
              </div>
            )}

            {note.content ? (
              <div className={cn(!present && "prose prose-sm dark:prose-invert max-w-none")}>
                <MarkdownRenderer content={note.content} knownTitles={knownTitles} onWikiClick={handleWiki} />
              </div>
            ) : (
              !note.checklist?.length && !note.images?.length && <p className="text-muted-foreground italic text-sm">Pusta notatka.</p>
            )}

            {note.checklist && note.checklist.length > 0 && (
              <ul className={cn("space-y-1", present ? "mt-6" : "mt-2 text-sm")}>
                {note.checklist.map((c) => (
                  <li key={c.id} className={cn("flex gap-2", c.checked && "line-through text-muted-foreground")}>
                    <span aria-hidden>{c.checked ? "☑" : "☐"}</span><span>{highlight(c.text)}</span>
                  </li>
                ))}
              </ul>
            )}

            {note.images && note.images.length > 0 && (
              <div className={cn("grid gap-2 mt-4", present ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2")}>
                {note.images.map((img, i) => (
                  <img key={i} src={img} alt="" className="w-full rounded-lg" loading="lazy" />
                ))}
              </div>
            )}

            {backlinks.length > 0 && (
              <div className="mt-8 pt-4 border-t border-border/50" style={present ? { fontSize: "0.95rem" } : undefined}>
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Linkują tutaj ({backlinks.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {backlinks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onShow(b.id, mode)}
                      className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {b.title || "Bez tytułu"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/40 px-4 py-1.5 text-2xs text-center text-muted-foreground">
          {present
            ? <><kbd className="font-mono">+</kbd>/<kbd className="font-mono">-</kbd> czcionka · <kbd className="font-mono">0</kbd> reset · <kbd className="font-mono">Enter</kbd> edytuj · <kbd className="font-mono">Esc</kbd> zamknij</>
            : <><kbd className="font-mono">↑</kbd>/<kbd className="font-mono">↓</kbd> PgUp/PgDn przewiń · <kbd className="font-mono">Enter</kbd> edytuj · Spacja/<kbd className="font-mono">Esc</kbd> zamknij</>}
        </div>
      </motion.div>
      </div>
    </>
  );
}
