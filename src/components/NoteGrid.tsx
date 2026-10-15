import { useRef, useEffect, useCallback, memo, useMemo, useState, forwardRef } from "react";
import type { CardExitIntent } from "@/lib/cardMotion";
import { AnimatePresence } from "framer-motion";
import { useSortable, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useViewPrefs, type Layout } from "@/lib/viewPrefs";
import { PrivateNoteGate } from "@/components/vault/PrivateNoteGate";
import { NoteViewActionsProvider, type NoteViewActions } from "@/hooks/NoteViewActionsContext";
import type { useNotes } from "@/hooks/useNotes";
import { registerGridNavSection, useIsGridNavFocused, setGridNavFocus } from "@/lib/gridKeyboardNav";
import { useMasonrySpans } from "@/hooks/useMasonrySpans";
import { getPendingAnchorId } from "@/lib/viewChange";


interface SortableNoteCardProps {
  note: ReturnType<typeof useNotes>["notes"][number];
  index: number;
  layout: Layout;
  selected: boolean;
}

const SortableNoteCard = memo(function SortableNoteCard({ layout, note, index, selected }: SortableNoteCardProps) {
  // Odłożenie karty (i przesuwanie sąsiadów) z łagodnym, papierowym przeskokiem:
  // krzywa z minimalnym przestrzałem daje mikro-odbicie zamiast sztywnego dojazdu.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: note.id,
    transition: { duration: 240, easing: "cubic-bezier(0.22, 1.15, 0.36, 1)" },
  });
  const baseTransform = CSS.Transform.toString(transform);
  const style = {
    // „Uniesienie”: lekki obrót i skala dopisane do transformu dnd-kit; po upuszczeniu
    // wracają przez to samo przejście, co daje odłożenie z odbiciem.
    transform: isDragging ? `${baseTransform ?? ""} scale(1.02) rotate(1.2deg)`.trim() : baseTransform,
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-2xl transition-[box-shadow,opacity,outline-color] duration-fast outline-solid outline-2 outline-offset-2 outline-transparent",
        // Siatka: kafel wypełnia wysokość wiersza — bez tego niższe kafle zostawiały dziury pod sobą.
        layout === "grid" && "h-full [&>div]:h-full [&>div>.note-card]:h-full",
        isDragging && "opacity-90 shadow-elevation-3",
        // Miękki wskaźnik miejsca docelowego pod kartą, nad którą jest przeciągana.
        isOver && !isDragging && "outline-dashed outline-primary/40",
      )}
    >
      <PrivateNoteGate note={note} index={index} selected={selected} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
});

/**
 * Render progresywny: pierwszy ekran od razu, reszta paczkami w wolnych chwilach.
 * 300 kafli w jednym zadaniu blokowało telefon na 2–3 s (pomiar CPU 4×) — teraz lista
 * jest widoczna po pierwszej paczce, a dociąganie nie zabiera dotyku.
 */
const FIRST_BATCH = 24;
const NEXT_BATCH = 48;
type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

function useProgressiveCount(total: number, initial = FIRST_BATCH): number {
  const [count, setCount] = useState(() => Math.min(total, Math.max(FIRST_BATCH, initial)));
  useEffect(() => {
    if (count >= total) return;
    const w = window as IdleWindow;
    const grow = () => setCount((c) => Math.min(total, c + NEXT_BATCH));
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(grow, { timeout: 200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(grow, 16);
    return () => window.clearTimeout(id);
  }, [count, total]);
  return Math.min(count, total);
}

/** Powyżej tylu kart siatka nie animuje przesunięć — pomiar każdej karty kosztuje więcej, niż daje płynność. */
const LAYOUT_ANIMATION_LIMIT = 40;

interface NoteGridProps extends Omit<NoteViewActions, "selectionMode" | "onToggleSelect"> {
  notes: ReturnType<typeof useNotes>["notes"];
  selectedIds?: Set<string>;
  selectionMode?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
  /**
   * Pozycja tej siatki w nawigacji klawiaturą, gdy strona renderuje kilka
   * (widok „Notatki”: 0 = Przypięte, 1 = Inne). Strzałki przechodzą między
   * sekcjami w tej kolejności, jak po jednej liście.
   */
  navOrder?: number;
}

export function NoteGrid({
  notes, onUpdate, onDelete: onDeleteProp, onTogglePin, onDuplicate, onArchive: onArchiveProp, onUnarchive, isArchived, onMoveToFolder, getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, wikiIndex, onOpenNote, selectedIds, selectionMode, onToggleSelect, navOrder = 0,
}: NoteGridProps) {
  // Zapamiętujemy, co użytkownik zrobił z kartą, żeby jej wyjście (AnimatePresence `custom`)
  // „leciało” w stronę celu: kosz albo archiwum. Dotyczy też skrótów i przesunięcia palcem.
  const [exitIntent, setExitIntent] = useState<CardExitIntent | undefined>();
  const onDelete = useCallback((id: string) => {
    setExitIntent({ id, kind: "trash" });
    onDeleteProp(id);
  }, [onDeleteProp]);
  const onArchive = useMemo(() => (onArchiveProp ? (id: string) => {
    setExitIntent({ id, kind: "archive" });
    onArchiveProp(id);
  } : undefined), [onArchiveProp]);
  // Stabilna wartość kontekstu — inaczej każdy render siatki przerysowuje wszystkie karty mimo `memo`.
  const animateLayout = notes.length <= LAYOUT_ANIMATION_LIMIT;
  const noteViewActions = useMemo<NoteViewActions>(() => ({
    onUpdate, onDelete, onTogglePin, onDuplicate, onArchive, onUnarchive, isArchived, onMoveToFolder,
    getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, wikiIndex, onOpenNote, selectionMode, onToggleSelect, animateLayout,
  }), [onUpdate, onDelete, onTogglePin, onDuplicate, onArchive, onUnarchive, isArchived, onMoveToFolder,
    getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, wikiIndex, onOpenNote, selectionMode, onToggleSelect, animateLayout]);
  const storedPrefs = useViewPrefs();
  // Tablica renderuje każdą kolumnę jako jednokolumnową listę; tabela nie używa siatki.
  const prefs = useMemo(
    () => (storedPrefs.layout === "board" || storedPrefs.layout === "table" ? { ...storedPrefs, layout: "list" as const } : storedPrefs),
    [storedPrefs],
  );
  const boardColumn = storedPrefs.layout === "board";
  const noteIds = useMemo(() => notes.map((n) => n.id), [notes]);
  // Zmiana widoku z zachowaniem miejsca (`changeView`): od razu do kafla u góry ekranu i ekran pod nim.
  const [anchorCount] = useState(() => {
    const id = getPendingAnchorId();
    const idx = id ? notes.findIndex((n) => n.id === id) : -1;
    return idx < 0 ? 0 : idx + 1 + FIRST_BATCH;
  });
  const renderedCount = useProgressiveCount(notes.length, anchorCount);
  const renderedNotes = renderedCount >= notes.length ? notes : notes.slice(0, renderedCount);
  const renderedIds = renderedCount >= notes.length ? noteIds : noteIds.slice(0, renderedCount);
  const gridRef = useRef<HTMLDivElement>(null);

  const colsCount = useCallback(() => {
    if (prefs.layout === "list") return 1;
    if (!gridRef.current) return 1;
    // Siatka i mozaika to siatki CSS — liczba kolumn wprost z wyliczonego szablonu.
    return Math.max(1, getComputedStyle(gridRef.current).gridTemplateColumns.split(" ").filter(Boolean).length);
  }, [prefs.layout]);

  useMasonrySpans(gridRef, prefs.layout === "masonry", "[data-note-id-wrap]");

  // Ta siatka tylko zgłasza swoje notatki i akcje; klawiszy nasłuchuje jeden
  // globalny właściciel w `gridKeyboardNav` — patrz komentarz w tym module.
  const noteIdsKey = noteIds.join(",");
  useEffect(() => {
    return registerGridNavSection(navOrder, noteIdsKey ? noteIdsKey.split(",") : [], {
      onDelete,
      onArchive: isArchived ? undefined : onArchive,
      onTogglePin,
      onDuplicate,
      openNote: (id) => {
        const target = gridRef.current?.querySelector(`[data-note-id-wrap="${id}"] .cursor-pointer`) as HTMLElement | null;
        target?.click();
      },
      scrollToNote: (id) => {
        const el = gridRef.current?.querySelector(`[data-note-id-wrap="${id}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      },
      colsCount,
    });
  }, [navOrder, noteIdsKey, onDelete, onArchive, onTogglePin, onDuplicate, isArchived, colsCount]);

  const gap = prefs.density === "compact" ? "gap-2" : prefs.density === "comfy" ? "gap-5" : "gap-2.5 sm:gap-3";
  const listGap = prefs.density === "compact" ? "space-y-2" : prefs.density === "comfy" ? "space-y-5" : "space-y-2.5 sm:space-y-3";
  const columnGap = prefs.density === "compact" ? "gap-x-2" : prefs.density === "comfy" ? "gap-x-5" : "gap-x-2.5 sm:gap-x-3";
  const rowGap = prefs.density === "compact" ? "mb-2" : prefs.density === "comfy" ? "mb-5" : "mb-2.5 sm:mb-3";

  let containerClass: string;
  if (prefs.layout === "list") {
    // Lista przy lewej krawędzi, jak pasek „Zapisz notatkę” i nagłówki sekcji (wyśrodkowana rozjeżdżała się z nimi).
    containerClass = `${boardColumn ? "w-full" : "max-w-2xl"} ${listGap}`;
  } else {
    // Na telefonie 3–4 kolumny się nie mieszczą — ręczny wybór 2+ daje tam 2, jak „Auto” (wcześniej spadał do 1).
    const cols = prefs.autoColumns
      ? "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]"
      : prefs.columns === 1 ? "grid-cols-1"
      : prefs.columns === 2 ? "grid-cols-2"
      : prefs.columns === 3 ? "grid-cols-2 lg:grid-cols-3"
      : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    // Mozaika: ta sama siatka kolumn, wiersze po 4 px i odstęp pionowy jako margines karty (`useMasonrySpans`).
    containerClass = prefs.layout === "grid"
      // Wiersz ma wysokość swojego najwyższego kafla (nie najwyższego w całej siatce, jak przy `auto-rows-fr`).
      ? `grid ${cols} ${gap} note-grid-fill`
      : `grid ${cols} ${columnGap} auto-rows-[4px] items-start`;
  }

  // Edycja w kaflu ma ~210 px w wąskiej kolumnie — przy 2+ kolumnach zajmuje dwie (jedna kolumna: bez niejawnej drugiej).
  const wideEditing = prefs.layout !== "list" && (prefs.autoColumns || prefs.columns !== 1);

  return (
    <NoteViewActionsProvider value={noteViewActions}>
    <SortableContext items={renderedIds} strategy={rectSortingStrategy}>
      {/* Bez `key` = układ: zmiana widoku nie remontuje kafli (fokus, edycja w kaflu, przewinięcie) —
          przejście i zachowanie miejsca robi `changeView`. */}
      {/* `data-cv`: kafle poza ekranem bez stylów i układu (`content-visibility`, index.css) — mozaika
          potrzebuje prawdziwych wysokości do rozpiętości, więc tylko lista, siatka i tablica. */}
      <div ref={gridRef} data-cv={prefs.layout !== "masonry" || undefined} className={cn(containerClass, "animate-in fade-in-0 duration-base")}>
        <AnimatePresence mode="popLayout" custom={exitIntent}>
          {renderedNotes.map((note, i) => (
            <GridItem key={note.id} note={note} index={i} layout={prefs.layout} rowGap={rowGap} wideEditing={wideEditing} selected={selectedIds?.has(note.id) ?? false} />
          ))}
        </AnimatePresence>
      </div>

    </SortableContext>
    </NoteViewActionsProvider>
  );
}

/**
 * Kafel w siatce z pierścieniem fokusu klawiatury. Sam pyta, czy ma fokus —
 * strzałka przerysowuje tylko kafel, który go stracił, i ten, który dostał.
 */
// forwardRef: `AnimatePresence mode="popLayout"` mierzy bezpośrednie dziecko przez ref.
const GridItem = memo(forwardRef<HTMLDivElement, SortableNoteCardProps & { rowGap: string; wideEditing: boolean }>(function GridItem({ note, index, layout, rowGap, wideEditing, selected }, ref) {
  const focused = useIsGridNavFocused(note.id);
  return (
    <div
      ref={ref}
      data-note-idx={index}
      data-note-id-wrap={note.id}
      onClickCapture={() => setGridNavFocus(note.id)}
      className={cn(
        "note-lift rounded-2xl transition-shadow",
        note.wide && layout !== "list" && "sm:col-span-2",
        wideEditing && "sm:has-data-tile-editing:col-span-2",
        // Odstęp pionowy mozaiki jako margines opakowania — `useMasonrySpans` wlicza go w wysokość.
        layout === "masonry" ? rowGap : layout === "grid" ? "h-full" : "",
        focused && "ring-2 ring-ring ring-offset-2 ring-offset-background"
      )}
    >
      <SortableNoteCard note={note} index={index} layout={layout} selected={selected} />
    </div>
  );
}));
