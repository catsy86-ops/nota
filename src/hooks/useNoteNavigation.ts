import { useState, useCallback, useEffect } from "react";
import { setViewPref } from "@/lib/viewPrefs";
import type { View } from "@/hooks/useFilteredNotes";
import { setGridNavFocus } from "@/lib/gridKeyboardNav";
import { whenNotesReady, isNoteTextEditOpen } from "@/hooks/useNotes";
import { DAILY_LABEL, DAILY_TEMPLATE, appendTimestamp, dailyKey, dailyTitle, findDailyNote } from "@/lib/dailyNote";
import { PERIOD_LABEL, PERIOD_TEMPLATE, findPeriodNote, periodKey, periodTitle, type PeriodKind } from "@/lib/periodNote";
import type { SavedView } from "@/lib/savedViews";
import { toast } from "sonner";
import type { MutableRefObject } from "react";
import type { Note, useNotes } from "@/hooks/useNotes";
import type { useViewRoute } from "@/hooks/useViewRoute";

type Notes = ReturnType<typeof useNotes>;
type Route = ReturnType<typeof useViewRoute>;

interface Args {
  route: Route;
  folders: Notes["folders"];
  notes: Note[];
  archivedNotes: Note[];
  notesRef: MutableRefObject<Note[]>;
  archivedRef: MutableRefObject<Note[]>;
  trashedRef: MutableRefObject<Note[]>;
  /** Hooki wołane wcześniej w stronie (powiadomienia) sięgają po najnowsze `openNote` przez ten ref. */
  openNoteRef: MutableRefObject<(id: string) => void>;
  addNote: Notes["addNote"];
  updateNote: Notes["updateNote"];
  addLabel: Notes["addLabel"];
  isMobile: boolean;
  setSearch: (q: string) => void;
  setSidebarOpen: (open: boolean) => void;
}

/**
 * Nawigacja po notatkach i widokach: „pokaż tę notatkę” (`revealNote`), zapisane widoki i filtry, otwieranie notatki
 * (też z adresu `/notatka/:id`), notatka dnia i okresu. Wyciągnięte z `Index.tsx` bez zmiany zachowania.
 */
export function useNoteNavigation({ route, folders, notes, archivedNotes, notesRef, archivedRef, trashedRef, openNoteRef, addNote, updateNote, addLabel, isMobile, setSearch, setSidebarOpen }: Args) {
  const { go, replaceWith } = route;
  /**
   * Jedno miejsce „pokaż tę notatkę”: przełącza na widok, w którym notatka
   * faktycznie jest (Notatki / Archiwum / Kosz), zdejmuje filtry, które mogłyby
   * ją ukryć, przewija do karty i na chwilę ją podświetla.
   */
  const revealNote = useCallback((id: string, target: View, viaLink: boolean, edit: boolean) => {
    setSearch("");
    if (viaLink) replaceWith(target); else go(target, { search: "" });
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-note-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Pierścień fokusu idzie za notatką — inaczej zostaje na kaflu z linkiem i świecą dwa naraz.
      setGridNavFocus(id);
      el.classList.add("note-flash");
      setTimeout(() => el.classList.remove("note-flash"), 1600);
      // Ta sama ścieżka co klik w kartę (patrz `NoteGrid` → `openNote`).
      if (edit) document.querySelector<HTMLElement>(`[data-note-id-wrap="${id}"] .cursor-pointer`)?.click();
    }, 150);
  }, [go, replaceWith, setSearch]);
  /** Zapisany widok (6.1): ustawienia widoku, potem źródło z zapytaniem. Folder, którego nie ma, = komunikat. */
  const openSavedView = useCallback((v: SavedView) => {
    const src = v.source;
    if (src.kind === "folder" && !folders.some((f) => f.id === src.id)) {
      toast.info(`Folderu z widoku „${v.name}” już nie ma`);
      return;
    }
    setViewPref("layout", v.layout);
    setViewPref("sortKey", v.sortKey);
    setViewPref("sortDir", v.sortDir);
    setViewPref("groupBy", v.groupBy);
    setViewPref("filterColor", v.filterColor);
    setViewPref("filterLabel", v.filterLabel);
    setViewPref("filterHasReminder", v.filterHasReminder);
    setViewPref("filterPriority", v.filterPriority);
    setViewPref("tableHidden", v.tableHidden);
    setSearch(v.query);
    if (src.kind === "folder") go("folder", { folder: src.id, search: v.query });
    else if (src.kind === "label") go("label", { label: src.label, search: v.query });
    else go("notes", { search: v.query });
    if (isMobile) setSidebarOpen(false);
  }, [folders, go, isMobile, setSearch, setSidebarOpen]);
  /** Zapisany filtr: widok Notatki z jego zapytaniem w polu wyszukiwania. */
  const goFilter = useCallback((query: string) => {
    setSearch(query);
    go("notes", { search: query });
    if (isMobile) setSidebarOpen(false);
  }, [go, isMobile, setSearch, setSidebarOpen]);
  const openNote = useCallback((id: string, viaLink = false, edit = false) => {
    const note = [...notesRef.current, ...archivedRef.current, ...trashedRef.current].find((n) => n.id === id);
    if (!note) {
      toast.info("Tej notatki już nie ma");
      if (viaLink) replaceWith("notes");
      return;
    }
    const target: View = note.trashed ? "trash" : note.archived ? "archive" : "notes";
    if (target !== "notes") toast.info(target === "trash" ? "Notatka jest w Koszu" : "Notatka jest w Archiwum");
    revealNote(id, target, viaLink, edit && target !== "trash");
  }, [notesRef, archivedRef, trashedRef, replaceWith, revealNote]);
  // Hooki wołane wyżej w komponencie (powiadomienia) sięgają po najnowsze `openNote` przez ref.
  openNoteRef.current = openNote;

  /**
   * Notatka dnia: jest → otwórz ją w edytorze ze znacznikiem godziny na końcu;
   * nie ma → utwórz z szablonem dziennika. Rozpoznanie po `dailyDate`, nie tytule.
   */
  const openDailyNote = useCallback(() => {
    const now = Date.now();
    const key = dailyKey(now);
    const existing = findDailyNote([...notes, ...archivedNotes], key);
    if (existing) {
      // Przy otwartym edytorze szkic ma pierwszeństwo — nie dopisujemy mu pod ręką.
      // Notatka dnia zablokowana: nie dopisujemy do niej z jawnej (pustej) projekcji.
      if (!existing.locked && !isNoteTextEditOpen(existing.id)) updateNote(existing.id, { content: appendTimestamp(existing.content, now) });
      openNote(existing.id, false, true);
      return;
    }
    addLabel(DAILY_LABEL);
    const id = addNote(dailyTitle(now), DAILY_TEMPLATE, "lavender", [DAILY_LABEL]);
    updateNote(id, { dailyDate: key });
    revealNote(id, "notes", false, true);
  }, [notes, archivedNotes, updateNote, openNote, addLabel, addNote, revealNote]);

  /**
   * Notatka tygodnia / miesiąca: jest → otwórz; nie ma → utwórz z szablonem.
   * Rozpoznanie po `periodKey`, nie tytule (patrz `lib/periodNote.ts`).
   */
  const openPeriodNote = useCallback((kind: PeriodKind) => {
    const now = Date.now();
    const key = periodKey(kind, now);
    const existing = findPeriodNote([...notes, ...archivedNotes], key);
    if (existing) {
      openNote(existing.id, false, true);
      return;
    }
    addLabel(PERIOD_LABEL[kind]);
    const id = addNote(periodTitle(kind, now), PERIOD_TEMPLATE[kind], "lavender", [PERIOD_LABEL[kind]]);
    updateNote(id, { periodKey: key });
    revealNote(id, "notes", false, true);
  }, [notes, archivedNotes, updateNote, openNote, addLabel, addNote, revealNote]);

  // `/notatka/:id` (link, klik w powiadomienie): otwieramy dopiero po
  // wczytaniu bazy — wcześniej każda notatka wyglądałaby na usuniętą.
  const [notesLoaded, setNotesLoaded] = useState(false);
  useEffect(() => { whenNotesReady().then(() => setNotesLoaded(true)); }, []);
  useEffect(() => {
    if (route.noteId && notesLoaded) openNote(route.noteId, true);
  }, [route.noteId, notesLoaded, openNote]);

  return { revealNote, openSavedView, goFilter, openNote, openDailyNote, openPeriodNote };
}
