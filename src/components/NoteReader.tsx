import { splitWikiTarget } from "@/lib/wikiLinks";
import { onHeadingRequest, requestHeading, scrollToHeading, takePendingHeading } from "@/lib/wikiHeading";
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOriginFromTile } from "@/hooks/useOriginFromTile";
import { m as motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Copy, CornerDownRight, FilePlusCorner, Link2, Maximize2, Minimize2, Minus, Pencil, Plus, X } from "lucide-react";
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
import { PropCell } from "@/components/NoteTable";
import type { PropDef } from "@/lib/noteProps";

// Lokalny graf ładujemy dopiero przy czytaniu (osobny kawałek bundla).
const NoteGraph = lazy(() => import("@/components/NoteGraph"));

/** Zakładki bocznego panelu na szerokim ekranie (3.6). */
type SideTab = "links" | "props" | "graph" | "split";
const SIDE_TABS: { id: SideTab; label: string }[] = [
  { id: "links", label: "Linki" },
  { id: "props", label: "Pola" },
  { id: "graph", label: "Graf" },
  { id: "split", label: "Obok" },
];

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
  /** Krok do sąsiedniej notatki z listy (←/→ i przyciski); brak = czytnik bez kroku. */
  onStep?: (dir: -1 | 1) => void;
  canPrev?: boolean;
  canNext?: boolean;
  onEdit: (id: string) => void;
  /** Przejście do innej notatki (wikilink, „Linkują tutaj”, przełączenie trybu). */
  onShow: (id: string, mode: ReaderMode) => void;
  /** Notatka w panelu „Obok” (3.7) i zmiana tej notatki; działa tylko na szerokim ekranie. */
  splitNote?: Note | null;
  onSplit?: (id: string | null) => void;
  /** Wikilink → id notatki o tym tytule, jeśli istnieje. */
  resolveTitle: (title: string) => string | undefined;
  /** Odhaczenie pozycji listy prosto w czytniku; brak = lista tylko do odczytu. */
  onToggleChecklist?: (noteId: string, itemId: string) => void;
  /** Własne pola notatki (sekcja „Pola” pod załącznikami). */
  propDefs?: PropDef[];
  /** Zmiana wartości pola prosto w czytniku; brak = pola tylko do odczytu. */
  onUpdateProps?: (id: string, updates: Partial<Pick<Note, "props">>) => void;
}

const ZOOM_DEFAULT = 1.1;

/** Skala wejścia/wyjścia — przy origin w kaflu daje kilkadziesiąt px drogi „z kafla”. */
const ENTER_SCALE = 0.94;

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

export function NoteReader({ note, mode, searchQuery, knownTitles, wikiIndex, onClose, onStep, canPrev = false, canNext = false, onEdit, onShow, resolveTitle, onToggleChecklist, propDefs = [], onUpdateProps, splitNote = null, onSplit }: Props) {
  useOverlayHistory(true, onClose);
  const present = mode === "present";
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useOriginFromTile(panelRef, note.id);
  const { showBacklinks } = useViewPrefs();
  // Czy ostatni klik w treści miał Ctrl/Cmd — `handleWiki` to czyta, bo sama obsługa linku nie dostaje zdarzenia.
  const splitClickRef = useRef(false);
  // Od xl (1280 px) linki, pola i graf idą do bocznego panelu; węższy ekran zostawia je pod treścią.
  // Bloki renderuje się w jednym miejscu, a na szerokim ekranie przenosi je portal do panelu.
  const wide = useMediaQuery("(min-width: 1280px)") && !present;
  const [sideTab, setSideTab] = useState<SideTab>("links");
  const [sideEl, setSideEl] = useState<HTMLDivElement | null>(null);
  const sideSlot = (tab: SideTab, node: ReactNode) => (!wide ? node : sideEl && sideTab === tab ? createPortal(node, sideEl) : null);
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

  // ←/→ przechodzą do sąsiedniej notatki w obu trybach (podgląd i prezentacja).
  useEffect(() => {
    if (!onStep) return;
    function onArrow(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") onStep?.(-1);
      else if (e.key === "ArrowRight") onStep?.(1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onArrow);
    return () => window.removeEventListener("keydown", onArrow);
  }, [onStep]);

  const tokens = highlightTokens(searchQuery);
  const snippets = buildSnippets(note.content || "", tokens);
  const titleHits = tokens.some((t) => note.title.toLowerCase().includes(t.toLowerCase())) ? 1 : 0;
  const backlinks = showBacklinks ? backlinksOf(note, wikiIndex) : [];
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const { notes: liveNotes, archivedNotes, updateNote, addSubpage, folders } = useNotesContext();
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
    // Ctrl+klik na szerokim ekranie: notatka trafia do panelu „Obok”, czytana notatka zostaje.
    if (splitClickRef.current && wide && onSplit && id !== note.id) {
      splitClickRef.current = false;
      onSplit(id);
      setSideTab("split");
      return;
    }
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
        className={cn("fixed inset-0 z-modal", present ? "bg-background/70 backdrop-blur-xs" : "bg-background/20 backdrop-blur-[2px]")}
        onClick={onClose}
      />
      {/* Centrowanie flexem, nie translate — framer-motion nadpisuje `transform`. */}
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4 pointer-events-none">
      <motion.div
        ref={panelRef}
        layout
        // Osiada bez odbicia (wcześniej sprężyna z lekkim przestrzeleniem).
        initial={{ opacity: 0, scale: ENTER_SCALE }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: ENTER_SCALE, transition: tween.exit }}
        transition={tween.enter}
        role="dialog"
        // Podgląd jest niemodalny: siatka pod spodem zostaje w drzewie dostępności (strzałki
        // przewijają ją przez gridKeyboardNav). Modalna jest tylko prezentacja.
        aria-modal={present ? "true" : "false"}
        aria-label={note.title || "Notatka bez tytułu"}
        data-state={present ? "open" : undefined}
        data-reader-mode={mode}
        className={cn(
          "pointer-events-auto flex flex-col rounded-card border border-border/60 bg-card/95 backdrop-blur-md shadow-elevation-3",
          present ? "w-[min(56rem,95vw)] h-[90dvh]" : wide ? "w-full max-w-5xl max-h-[80dvh]" : "w-full max-w-2xl max-h-[80dvh]",
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
            {/* Na telefonie Kopiuj, Edytuj i kroki przechodzą do dolnego paska — tytuł ma miejsce. */}
            <Button
              size="icon" variant="ghost" className="h-8 w-8 phone:hidden"
              onClick={(e) => { void copyNoteToClipboard(note, e.shiftKey ? "text" : "markdown"); }}
              title="Kopiuj jako Markdown (Shift — jako tekst)"
              aria-label="Kopiuj jako Markdown"
            >
              <Copy className="w-4 h-4" />
            </Button>
            {canEdit && (
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs phone:hidden" onClick={() => onEdit(note.id)} title="Edytuj (Enter)">
                <Pencil className="w-3.5 h-3.5" /> Edytuj
              </Button>
            )}
            {onStep && (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8 phone:hidden" onClick={() => onStep(-1)} disabled={!canPrev} title="Poprzednia notatka (←)" aria-label="Poprzednia notatka">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 phone:hidden" onClick={() => onStep(1)} disabled={!canNext} title="Następna notatka (→)" aria-label="Następna notatka">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
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

        <div className="flex min-h-0 flex-1">
        <div ref={setScrollEl} tabIndex={-1} className={cn("min-w-0 flex-1 overflow-y-auto overscroll-contain outline-hidden", present ? "px-6 sm:px-12 py-8" : "px-6 py-4")}>
          {/* Pasek postępu czytania (plan 2.5): wzrasta z przewijaniem, bez JS. */}
          <div aria-hidden="true" className="reader-progress" />
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
                  <div key={i} className="text-xs text-foreground/80 bg-muted/40 rounded-field px-2.5 py-1.5 leading-relaxed">
                    {s.before}<mark className="bg-primary/30 text-foreground rounded px-0.5">{s.match}</mark>{s.after}
                  </div>
                ))}
              </div>
            )}

            {note.content ? (
              <>
              <ReaderToc rootRef={contentRef} resetKey={note.id} />
              <div ref={contentRef} onClickCapture={(e) => { splitClickRef.current = e.ctrlKey || e.metaKey; }} className={cn(!present && "prose prose-sm dark:prose-invert max-w-none")}>
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
                  <NoteImage key={i} imageRef={img} alt={`Obraz ${i + 1} z ${note.images.length}`} className="w-full rounded-field" placeholderClassName="aspect-video" />
                ))}
              </div>
            )}

            <AttachmentsReadOnlyList attachments={note.attachments} />

            {propDefs.length > 0 && sideSlot("props", (
              <section aria-label="Pola notatki" className="mt-6 pt-3 border-t border-border/50" style={present ? { fontSize: "0.95rem" } : undefined}>
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pola</p>
                <dl>
                  {[...propDefs].sort((a, b) => a.order - b.order).map((d) => (
                    <div key={d.id} className="grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] items-center gap-3 border-b border-dashed border-border/60 py-1.5 last:border-0">
                      <dt className="truncate text-xs text-muted-foreground">{d.name}</dt>
                      <dd className="min-w-0">
                        <PropCell def={d} note={note} onUpdate={onUpdateProps} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}

            {backlinks.length > 0 && sideSlot("links", (
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
            ))}

            {!present && !note.trashed && !note.locked && sideSlot("graph", (
              <section aria-label="Lokalny graf" className={cn(!wide && "mt-8 pt-4 border-t border-border/50")} data-local-graph="">
                {!wide && <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Lokalny graf</p>}
                <Suspense fallback={<div className="h-40 rounded-card bg-muted/30" />}>
                  <NoteGraph notes={treeNotes} centerId={note.id} folders={folders} compact={wide} onOpenNote={(id) => onShow(id, mode)} />
                </Suspense>
              </section>
            ))}

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
                          className="flex w-full items-center gap-2 rounded-field bg-muted/30 px-2.5 py-1.5 text-left text-sm hover:bg-muted/60"
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
                      className="min-w-0 max-w-56 flex-1 truncate rounded-control border border-border bg-background px-2 py-1 text-xs text-foreground"
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

            {mentions.length > 0 && sideSlot("links", (
              <div className={cn("pt-4 border-t border-border/50", backlinks.length > 0 ? "mt-4" : "mt-8")} data-unlinked-mentions="" style={present ? { fontSize: "0.95rem" } : undefined}>
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Niepołączone wzmianki ({mentions.length})
                </p>
                <ul className="space-y-1.5">
                  {mentions.map((m) => (
                    <li key={m.id} className="flex items-start gap-2 rounded-field bg-muted/30 px-2.5 py-1.5">
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
            ))}
          </div>
        </div>
        {wide && (
          <aside aria-label="Panel notatki" className="flex w-80 shrink-0 flex-col border-l border-border/40 min-h-0" data-reader-side="">
            <div role="tablist" aria-label="Sekcje panelu" className="flex gap-1 border-b border-border/40 px-3 py-2">
              {SIDE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`reader-side-tab-${t.id}`}
                  aria-selected={sideTab === t.id}
                  aria-controls="reader-side-panel"
                  onClick={() => setSideTab(t.id)}
                  className={cn(
                    "rounded-control px-2.5 py-1 text-xs font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    sideTab === t.id ? "bg-primary/15 text-primary-ink" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div
              id="reader-side-panel"
              role="tabpanel"
              aria-labelledby={`reader-side-tab-${sideTab}`}
              ref={setSideEl}
              className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
            >
              {sideTab === "links" && !backlinks.length && !mentions.length && (
                <p className="text-xs text-muted-foreground">Nic tu nie linkuje i nie ma niepołączonych wzmianek.</p>
              )}
              {sideTab === "props" && propDefs.length === 0 && <p className="text-xs text-muted-foreground">Ta notatka nie ma pól.</p>}
              {sideTab === "split" && (splitNote ? (
                <div data-split-note={splitNote.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onShow(splitNote.id, mode)}
                      className="min-w-0 flex-1 truncate text-left font-display text-sm font-semibold hover:underline"
                    >
                      {splitNote.title.trim() || "Bez tytułu"}
                    </button>
                    {onSplit && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onSplit(null)} aria-label="Zamknij panel obok" title="Zamknij panel obok">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none" onClickCapture={(e) => { splitClickRef.current = e.ctrlKey || e.metaKey; }}>
                    <MarkdownRenderer content={splitNote.content} knownTitles={knownTitles} onWikiClick={handleWiki} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Ctrl+klik na [[link]] w treści otwiera tu notatkę obok, a czytana zostaje na miejscu.</p>
              ))}
            </div>
          </aside>
        )}
        </div>

        {/* Telefon: dolny pasek 44 px zamiast podpowiedzi klawiszy (klawiatury tam nie ma). */}
        <div className="hidden phone:flex items-stretch gap-1 border-t border-border/40 px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
          {onStep && (
            <Button variant="ghost" className="h-11 flex-1 gap-1 text-xs" onClick={() => onStep(-1)} disabled={!canPrev} aria-label="Poprzednia notatka">
              <ChevronLeft className="w-4 h-4" /> Poprzednia
            </Button>
          )}
          <Button variant="ghost" className="h-11 flex-1 gap-1 text-xs" onClick={() => { void copyNoteToClipboard(note, "markdown"); }} aria-label="Kopiuj jako Markdown">
            <Copy className="w-4 h-4" /> Kopiuj
          </Button>
          {canEdit && (
            <Button variant="ghost" className="h-11 flex-1 gap-1 text-xs" onClick={() => onEdit(note.id)} aria-label="Edytuj">
              <Pencil className="w-4 h-4" /> Edytuj
            </Button>
          )}
          {onStep && (
            <Button variant="ghost" className="h-11 flex-1 gap-1 text-xs" onClick={() => onStep(1)} disabled={!canNext} aria-label="Następna notatka">
              Następna <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="border-t border-border/40 px-4 py-1.5 text-2xs text-center text-muted-foreground phone:hidden">
          {present
            ? <><kbd className="font-mono">+</kbd>/<kbd className="font-mono">-</kbd> czcionka · <kbd className="font-mono">0</kbd> reset · <kbd className="font-mono">Enter</kbd> edytuj · <kbd className="font-mono">Esc</kbd> zamknij</>
            : <><kbd className="font-mono">↑</kbd>/<kbd className="font-mono">↓</kbd> PgUp/PgDn przewiń · <kbd className="font-mono">Enter</kbd> edytuj · Spacja/<kbd className="font-mono">Esc</kbd> zamknij</>}
        </div>
      </motion.div>
      </div>
    </>
  );
}
