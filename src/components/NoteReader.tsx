import { splitWikiTarget } from "@/lib/wikiLinks";
import { onHeadingRequest, requestHeading, scrollToHeading, takePendingHeading } from "@/lib/wikiHeading";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { m as motion } from "framer-motion";
import { ChevronRight, Copy, CornerDownRight, FilePlusCorner, Link2, Maximize2, Minimize2, Minus, Pencil, Plus, X } from "lucide-react";
import { ancestorsOf, canSetParent, childrenOf, parentIdOf } from "@/lib/subpages";
import { setParent } from "@/lib/subpageActions";
import { useNotesContext } from "@/hooks/NotesProvider";
import { findUnlinkedMentions, linkFirstMention, type UnlinkedMention } from "@/lib/unlinkedMentions";
import { toastWithUndo } from "@/lib/undoToast";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { Note } from "@/hooks/useNotes";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { backlinksOf, type WikiIndex } from "@/lib/wikiLinks";
import { readingTimeMin, useViewPrefs } from "@/lib/viewPrefs";
import { setGridNavPreviewScrollEl } from "@/lib/gridKeyboardNav";
import { cn } from "@/lib/utils";
import { tween } from "@/lib/motion";
import { wordsPl } from "@/lib/plural";
import { NoteImage } from "./NoteImage";
import { ReaderToc } from "./ReaderToc";
import { AttachmentsReadOnlyList } from "./AttachmentsList";
import { useWakeLock } from "@/hooks/useWakeLock";
import { copyNoteToClipboard } from "@/lib/noteMarkdown";
import { highlightTokens } from "@/lib/searchQuery";
import { useOverlayHistory } from "@/hooks/useOverlayHistory";

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
  /** Odhaczenie pozycji listy prosto w czytniku; brak = lista tylko do odczytu. */
  onToggleChecklist?: (noteId: string, itemId: string) => void;
}

const ZOOM_DEFAULT = 1.1;

/** Skala wejścia/wyjścia — przy origin w kaflu daje kilkadziesiąt px drogi „z kafla”. */
const ENTER_SCALE = 0.94;

/**
 * Czytnik rośnie z kafla, z którego go otwarto, i do niego wraca: origin
 * transformacji = środek kafla we współrzędnych panelu. Tylko transform
 * (bez `layoutId` — wspólny układ z kartą gryzłby się z dnd-kit i kosztował
 * pomiar przy każdym otwarciu). Kafel poza ekranem lub brak kafla (paleta,
 * inny widok) — zostaje środek panelu.
 */
function useOriginFromTile(panelRef: React.RefObject<HTMLDivElement | null>, noteId: string) {
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const tile = document.querySelector(`[data-note-id-wrap="${CSS.escape(noteId)}"]`);
    if (!panel) return;
    const t = tile?.getBoundingClientRect();
    if (!t || t.bottom < 0 || t.top > window.innerHeight) {
      panel.style.transformOrigin = "";
      return;
    }
    // Środek panelu nie zależy od skali wokół środka, więc pomiar w trakcie wejścia jest wierny.
    const p = panel.getBoundingClientRect();
    const x = t.left + t.width / 2 - (p.left + p.width / 2) + panel.offsetWidth / 2;
    const y = t.top + t.height / 2 - (p.top + p.height / 2) + panel.offsetHeight / 2;
    panel.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`;
  }, [panelRef, noteId]);
}

function escRx(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

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

export function NoteReader({ note, mode, searchQuery, knownTitles, wikiIndex, onClose, onEdit, onShow, resolveTitle, onToggleChecklist }: Props) {
  useOverlayHistory(true, onClose);
  const present = mode === "present";
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useOriginFromTile(panelRef, note.id);
  const { showBacklinks } = useViewPrefs();
  const canEdit = !note.trashed;
  // Prezentacja (często na stojaku, bez dotykania ekranu) nie może zgasnąć.
  useWakeLock(present);

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

  const tokens = highlightTokens(searchQuery);
  const snippets = buildSnippets(note.content || "", tokens);
  const titleHits = tokens.some((t) => note.title.toLowerCase().includes(t.toLowerCase())) ? 1 : 0;
  const backlinks = showBacklinks ? backlinksOf(note, wikiIndex) : [];
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const { notes: liveNotes, archivedNotes, updateNote, addSubpage } = useNotesContext();
  // Drzewo podstron: okruszki nad tytułem i lista dzieci pod treścią.
  const treeNotes = useMemo(() => [...liveNotes, ...archivedNotes], [liveNotes, archivedNotes]);
  const crumbs = useMemo(() => {
    const byId = new Map(treeNotes.map((n) => [n.id, n] as const));
    return ancestorsOf(note.id, byId).map((id) => byId.get(id)!).filter(Boolean);
  }, [treeNotes, note.id]);
  const subpages = useMemo(() => childrenOf(note.id, treeNotes), [treeNotes, note.id]);
  const currentParent = useMemo(
    () => parentIdOf(note, new Map(treeNotes.map((n) => [n.id, n] as const))) ?? "",
    [treeNotes, note],
  );
  /** Kandydaci na rodzica: żywe, jawne notatki poza nią samą i jej potomkami. */
  const parentOptions = useMemo(
    () => liveNotes
      .filter((n) => !n.locked && n.id !== note.id && canSetParent(note.id, n.id, treeNotes))
      .sort((a, b) => a.title.localeCompare(b.title, "pl"))
      .slice(0, 300),
    [liveNotes, treeNotes, note.id],
  );
  const mentions = useMemo(
    () => (showBacklinks ? findUnlinkedMentions(note, [...liveNotes, ...archivedNotes], 20) : []),
    [showBacklinks, note, liveNotes, archivedNotes],
  );

  function linkMention(m: UnlinkedMention) {
    const src = [...liveNotes, ...archivedNotes].find((n) => n.id === m.id);
    const next = src ? linkFirstMention(src.content, note.title) : null;
    if (!src || next === null) return;
    const previous = src.content;
    updateNote(src.id, { content: next });
    toastWithUndo(`Połączono „${note.title.trim()}” w „${src.title.trim() || "Bez tytułu"}”`, () => updateNote(src.id, { content: previous }));
  }

  function highlight(text: string) {
    if (!tokens.length || !text) return text;
    const rx = new RegExp(`(${tokens.map(escRx).join("|")})`, "gi");
    return text.split(rx).map((p, i) =>
      tokens.some((t) => t.toLowerCase() === p.toLowerCase())
        ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{p}</mark>
        : <Fragment key={i}>{p}</Fragment>
    );
  }

  function handleWiki(raw: string) {
    const { title, heading } = splitWikiTarget(raw);
    const id = title ? resolveTitle(title) : note.id;
    if (!id) return;
    if (id === note.id && heading) { scrollToHeading(contentRef.current, heading); return; }
    if (heading) requestHeading(heading);
    onShow(id, mode);
  }

  // `[[tytuł#nagłówek]]`: nagłówek bywa renderowany z opóźnieniem (leniwy Markdown), więc kilka prób.
  useEffect(() => {
    let timer: number | undefined;
    const attempt = (heading: string, left: number) => {
      if (scrollToHeading(contentRef.current, heading) || left <= 0) return;
      timer = window.setTimeout(() => attempt(heading, left - 1), 80);
    };
    const run = () => { const h = takePendingHeading(); if (h) attempt(h, 12); };
    run();
    const off = onHeadingRequest(run);
    return () => { off(); window.clearTimeout(timer); };
  }, [note.id]);

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
        exit={{ opacity: 0, transition: tween.exit }}
        transition={tween.enter}
        className={cn("fixed inset-0 z-50", present ? "bg-background/70 backdrop-blur-xs" : "bg-background/20 backdrop-blur-[2px]")}
        onClick={onClose}
      />
      {/* Centrowanie flexem, nie translate — framer-motion nadpisuje `transform`. */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <motion.div
        ref={panelRef}
        layout
        // Osiada bez odbicia (wcześniej sprężyna z lekkim przestrzeleniem).
        initial={{ opacity: 0, scale: ENTER_SCALE }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: ENTER_SCALE, transition: tween.exit }}
        transition={tween.enter}
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
            {!present && crumbs.length > 0 && (
              <nav aria-label="Ścieżka podstrony" className="mb-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                {crumbs.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => onShow(c.id, mode)} className="max-w-40 truncate hover:text-foreground hover:underline">
                      {c.title.trim() || "Bez tytułu"}
                    </button>
                    <ChevronRight className="w-3 h-3 shrink-0" aria-hidden />
                  </span>
                ))}
              </nav>
            )}
            {!present && (
              <h2 className="font-display text-lg font-semibold leading-tight">
                {note.title ? highlight(note.title) : "Bez tytułu"}
              </h2>
            )}
            <p className={cn("text-xs text-muted-foreground", !present && "mt-1")}>
              {format(new Date(note.updatedAt), "d MMM yyyy, HH:mm", { locale: pl })}
              {" · "}{wordsPl(words)} · ~{readingTimeMin(note.content)} min czytania
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
            <Button
              size="icon" variant="ghost" className="h-8 w-8"
              onClick={(e) => { void copyNoteToClipboard(note, e.shiftKey ? "text" : "markdown"); }}
              title="Kopiuj jako Markdown (Shift — jako tekst)"
              aria-label="Kopiuj jako Markdown"
            >
              <Copy className="w-4 h-4" />
            </Button>
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

        <div ref={setScrollEl} tabIndex={-1} className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain outline-hidden", present ? "px-6 sm:px-12 py-8" : "px-6 py-4")}>
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
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary-ink font-medium">{t}</span>
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
              <>
              <ReaderToc rootRef={contentRef} resetKey={note.id} />
              <div ref={contentRef} className={cn(!present && "prose prose-sm dark:prose-invert max-w-none")}>
                <MarkdownRenderer content={note.content} knownTitles={knownTitles} onWikiClick={handleWiki} />
              </div>
              </>
            ) : (
              !note.checklist?.length && !note.images?.length && !note.attachments?.length && <p className="text-muted-foreground italic text-sm">Pusta notatka.</p>
            )}

            {note.checklist && note.checklist.length > 0 && (
              <ul className={cn("space-y-1", present ? "mt-6" : "mt-2 text-sm")}>
                {note.checklist.map((c) => (
                  <li key={c.id} className={cn("flex gap-2", c.indent === 1 && "ml-6", c.checked && "line-through text-muted-foreground")}>
                    {onToggleChecklist && !note.locked ? (
                      <button type="button" role="checkbox" aria-checked={c.checked}
                        aria-label={`${c.checked ? "Odznacz" : "Odhacz"}: ${c.text || "element"}`}
                        onClick={() => onToggleChecklist(note.id, c.id)}
                        className="shrink-0 rounded outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-8 coarse:min-w-8">
                        <span aria-hidden>{c.checked ? "☑" : "☐"}</span>
                      </button>
                    ) : (
                      <span aria-hidden>{c.checked ? "☑" : "☐"}</span>
                    )}
                    <span>{highlight(c.text)}</span>
                  </li>
                ))}
              </ul>
            )}

            {note.images && note.images.length > 0 && (
              <div className={cn("grid gap-2 mt-4", present ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2")}>
                {note.images.map((img, i) => (
                  <NoteImage key={i} imageRef={img} alt={`Obraz ${i + 1} z ${note.images.length}`} className="w-full rounded-lg" placeholderClassName="aspect-video" />
                ))}
              </div>
            )}

            <AttachmentsReadOnlyList attachments={note.attachments} />

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
                      className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary-ink hover:bg-primary/20 transition-colors"
                    >
                      {b.title || "Bez tytułu"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(subpages.length > 0 || (canEdit && !note.locked)) && (
              <div className="mt-8 pt-4 border-t border-border/50" data-subpages="" style={present ? { fontSize: "0.95rem" } : undefined}>
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Podstrony{subpages.length > 0 ? ` (${subpages.length})` : ""}
                </p>
                {subpages.length > 0 && (
                  <ul className="space-y-1">
                    {subpages.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => onShow(s.id, mode)}
                          className="flex w-full items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-left text-sm hover:bg-muted/60"
                        >
                          <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{s.icon ? `${s.icon} ` : ""}{s.title.trim() || "Bez tytułu"}</span>
                          {s.trashed && <span className="ml-auto text-2xs text-muted-foreground">w koszu</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {canEdit && !note.locked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 h-8 gap-1.5 px-2 text-xs"
                    onClick={() => { const id = addSubpage(note.id); if (id) onEdit(id); }}
                  >
                    <FilePlusCorner className="w-3.5 h-3.5" />Dodaj podstronę
                  </Button>
                )}
                {canEdit && !note.locked && !present && (parentOptions.length > 0 || currentParent) && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    Notatka nadrzędna
                    <select
                      value={currentParent}
                      onChange={(e) => setParent(note.id, e.target.value || null)}
                      className="min-w-0 max-w-56 flex-1 truncate rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value="">Brak (poziom główny)</option>
                      {currentParent && !parentOptions.some((o) => o.id === currentParent) && (
                        <option value={currentParent}>{treeNotes.find((n) => n.id === currentParent)?.title.trim() || "Bez tytułu"}</option>
                      )}
                      {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.title.trim() || "Bez tytułu"}</option>)}
                    </select>
                  </label>
                )}
              </div>
            )}

            {mentions.length > 0 && (
              <div className={cn("pt-4 border-t border-border/50", backlinks.length > 0 ? "mt-4" : "mt-8")} data-unlinked-mentions="" style={present ? { fontSize: "0.95rem" } : undefined}>
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Niepołączone wzmianki ({mentions.length})
                </p>
                <ul className="space-y-1.5">
                  {mentions.map((m) => (
                    <li key={m.id} className="flex items-start gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onShow(m.id, mode)}
                          className="block max-w-full truncate text-xs font-medium text-primary-ink hover:underline"
                        >
                          {m.title || "Bez tytułu"}
                        </button>
                        <p className="mt-0.5 text-xs leading-snug text-foreground/70 wrap-break-word">
                          {m.before}<mark className="rounded bg-primary/25 px-0.5 text-foreground">{m.match}</mark>{m.after}
                        </p>
                      </div>
                      {canEdit && (
                        <Button size="sm" variant="ghost" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => linkMention(m)} title={`Zamień pierwsze wystąpienie na [[${note.title.trim()}]]`}>
                          <Link2 className="h-3 w-3" aria-hidden /> Połącz
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
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
