import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { beginNoteTextEdit, endNoteTextEdit, getNoteYText, type ChecklistItem, type Note } from "@/hooks/useNotes";
import type { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import { useLiveNoteText } from "@/hooks/useLiveNoteText";
import { useWikiAutocomplete } from "@/hooks/useWikiAutocomplete";
import { useSlashMenu } from "@/hooks/useSlashMenu";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { replaceSelectionWithLink } from "@/lib/extractNote";
import { createNoteFromSelection } from "@/lib/wikiNoteActions";
import { pulseSkinSignal } from "@/lib/skinSignal";
import { isChecklistShortcut, selectionToChecklist } from "@/lib/checklistPaste";
import { applyEdit, handleEditorKey } from "@/lib/editorKeysDom";
import { useFeatureFlags } from "@/lib/featureFlags";
import type { TextControl } from "@/lib/textControl";

/**
 * Sesja edycji tekstu w kaflu: tytuł, treść, lista, tryb pełnego edytora i podgląd.
 * Szkic żyje tu, a zapis (`commitDraft`) idzie do `onUpdate` — jako autozapis co
 * `autosaveSeconds`, przy „Zapisz” i przy odmontowaniu. Tu też klawisze w polu treści
 * (`handleEditKeyDown`), podpowiedzi `[[` i `/` oraz wstawianie formatowania.
 * Wyciągnięte z `NoteCard` bez zmiany zachowania; testy: `e2e/editing.spec.ts`,
 * `e2e/editor-keys.spec.ts`, `e2e/composer-draft.spec.ts`.
 */
export function useNoteEditSession({
  note,
  autosaveSeconds,
  onUpdate,
  onSaveVersion,
  wikiTitles,
}: {
  note: Note;
  autosaveSeconds: number;
  /** Tytuły do podpowiedzi `[[` (z indeksu wikilinków; pusta lista, gdy brak indeksu). */
  wikiTitles: string[];
} & Pick<ReturnType<typeof useNoteViewActions>, "onUpdate" | "onSaveVersion">) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>(note.checklist || []);
  const [showChecklist, setShowChecklist] = useState((note.checklist || []).length > 0);
  const [showPreview, setShowPreview] = useState(false);
  const [fullEditor, setFullEditor] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  /** Pole treści: `textarea` albo adapter CM (`TextControl`), zależnie od flagi `cmEditor`. */
  const textareaRef = useRef<TextControl | null>(null);
  const cmOn = useFeatureFlags().cmEditor;
  // Faza 1b: w edytorze CM treść wiąże się z `Y.Text` notatki — zmiany idą od razu do dokumentu
  // i nie przechodzą przez szkic. Notatki prywatne (bez `Y.Text`) i textarea zostają przy szkicu.
  const collabText = cmOn && isEditing ? getNoteYText(note.id) : null;
  const collab = collabText !== null;
  /** Treść z chwili otwarcia sesji — do wersji historii (w trybie wiązania `note.content` jest już na bieżąco). */
  const openContentRef = useRef(note.content);
  /** Ostatnio zapisana treść w trybie wiązania — zapis tytułu nie ponawia przesłania treści co autozapis. */
  const savedContentRef = useRef(note.content);

  // Edycja w kaflu rośnie z treścią (do ~60% ekranu), zamiast pokazywać 2 linie.
  // Pełny ekran bez listy ma własną wysokość (`h-full`), tam nie ruszamy;
  // z listą treść rośnie do ~35% ekranu, a resztę dostaje lista.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!isEditing || (fullEditor && !showChecklist) || !(ta instanceof HTMLTextAreaElement)) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight + 2, Math.round(window.innerHeight * (fullEditor ? 0.35 : 0.6)))}px`;
  }, [isEditing, fullEditor, showChecklist, showPreview, editContent]);

  // Szkic trzymamy też w refie: `commitDraft` jest wołane z cleanupu efektu
  // przy odmontowaniu, gdzie zwykłe domknięcie byłoby już zestarzałe.
  const draftRef = useRef({ title: editTitle, content: editContent, checklist: editChecklist });
  draftRef.current = { title: editTitle, content: editContent, checklist: editChecklist };
  // Wersję zapisujemy raz na sesję edycji — inaczej autosave co 5 s wyczerpałby
  // limit 20 wersji na notatkę w ciągu dwóch minut pisania.
  const versionSavedRef = useRef(false);

  const commitDraft = useCallback(() => {
    const draft = draftRef.current;
    const title = draft.title.trim();
    const content = draft.content.trim();
    const checklistChanged = JSON.stringify(draft.checklist) !== JSON.stringify(note.checklist || []);
    // W trybie wiązania treść już jest w dokumencie: porównujemy z chwilą otwarcia, a zapisu treści nie ponawiamy
    // (obcięcie spacji na końcu cofnęłoby pisanie w trakcie edycji).
    const contentChanged = collab ? draft.content !== savedContentRef.current : note.content !== content;
    if (note.title === title && !contentChanged && !checklistChanged) return;

    if (onSaveVersion && !versionSavedRef.current) {
      onSaveVersion(note.id, note.title, collab ? openContentRef.current : note.content);
      versionSavedRef.current = true;
    }
    if (collab) {
      savedContentRef.current = draft.content;
      onUpdate?.(note.id, { title, checklist: draft.checklist });
    }
    else onUpdate?.(note.id, { title, content, checklist: draft.checklist });
  }, [note.id, note.title, note.content, note.checklist, onSaveVersion, onUpdate, collab]);

  useDraftAutosave({
    active: isEditing,
    draftKey: `${editTitle}\u0000${editContent}\u0000${JSON.stringify(editChecklist)}`,
    intervalSeconds: autosaveSeconds,
    onSave: commitDraft,
  });

  useLiveNoteText({
    noteId: note.id,
    // W trybie wiązania zmiany peera wchodzą do edytora przez yCollab, bez scalania szkicu.
    active: isEditing && !collab,
    textareaRef,
    getDraft: () => draftRef.current.content,
    setDraft: setEditContent,
  });

  const wiki = useWikiAutocomplete({
    textareaRef,
    value: editContent,
    // Wybór podpowiedzi wstawia przez `writeContent` — w trybie wiązania to dokument Yjs, nie szkic.
    onChange: (text) => writeContent(text),
    titles: wikiTitles,
    exclude: editTitle,
  });
  const slash = useSlashMenu({ textareaRef, value: editContent, disabled: wiki.isOpen });
  function handleEditSelect() { wiki.textareaProps.onSelect(); slash.refresh(); }

  // Sesję zamykamy po zapisie przy odmontowaniu — cleanupy efektów idą
  // w kolejności deklaracji, więc `useDraftAutosave` zdąży zapisać pierwszy.
  useEffect(() => () => endNoteTextEdit(note.id), [note.id]);

  function handleSave() {
    haptic("success");
    pulseSkinSignal("save");
    commitDraft();
    endNoteTextEdit(note.id);
    setIsEditing(false);
    setShowPreview(false);
    setFullEditor(false);
  }

  /** Ctrl+Shift+L zamienia zaznaczone linie (albo bieżącą) na pozycje listy zadań; reszta klawiszy trafia do podpowiedzi wikilinków. */
  function handleEditKeyDown(e: React.KeyboardEvent<Element>) {
    const ta = textareaRef.current;
    if (!ta) return;
    if (isChecklistShortcut(e)) {
      e.preventDefault();
      const r = selectionToChecklist(editContent, ta.selectionStart, ta.selectionEnd, editChecklist);
      if (r) { writeContent(r.content); setEditChecklist(r.checklist); setShowChecklist(true); }
      return;
    }
    // Ctrl+F / Ctrl+H w treści: znajdź i zamień w tej notatce (zamiast wyszukiwania przeglądarki).
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "h")) {
      e.preventDefault();
      setFindOpen(true);
      return;
    }
    // Menu „/” przejmuje strzałki, Enter, Tab i Esc, dopóki jest otwarte.
    if (slash.isOpen && !e.ctrlKey && !e.metaKey && !e.altKey) { slash.onKeyDown(e); return; }
    // Otwarta lista `[[` ma pierwszeństwo dla Enter/Tab/strzałek/Esc; Ctrl/Alt jej nie dotyczą.
    if (wiki.isOpen && !e.ctrlKey && !e.metaKey && !e.altKey) { wiki.textareaProps.onKeyDown(e); return; }
    if (handleEditorKey(e, ta, { onSave: handleSave })) return;
    wiki.textareaProps.onKeyDown(e);
  }

  /**
   * Zapis treści z paska, listy czy Znajdź/Zamień. W trybie wiązania idzie przez edytor
   * (dokument Yjs i historia Ctrl+Z), a stan `editContent` nadąża przez `onChange` edytora.
   * Poza wiązaniem — przez szkic, jak dotąd.
   */
  function writeContent(next: string, sel?: [number, number]) {
    const ta = textareaRef.current;
    if (collab && ta) {
      applyEdit(ta, {
        value: next,
        selStart: sel?.[0] ?? Math.min(ta.selectionStart, next.length),
        selEnd: sel?.[1] ?? Math.min(ta.selectionEnd, next.length),
      });
      return;
    }
    if (collabText) {
      // Edytor CM jeszcze się nie zamontował (lazy chunk): piszemy do dokumentu, a on wejdzie przy montażu.
      const apply = () => { collabText.delete(0, collabText.length); collabText.insert(0, next); };
      if (collabText.doc) collabText.doc.transact(apply);
      else apply();
    }
    setEditContent(next);
  }

  /** Start sesji: kopia treści z `beginNoteTextEdit` (ta sama, którą widzi peer), a nie surowy `note`. */
  function begin() {
    versionSavedRef.current = false;
    setIsEditing(true);
    setEditTitle(note.title);
    const base = beginNoteTextEdit(note.id) ?? note.content;
    openContentRef.current = base;
    savedContentRef.current = base;
    setEditContent(base);
    setEditChecklist(note.checklist || []);
    setShowChecklist((note.checklist || []).length > 0);
  }

  /** Pogrubienie, kursywa itd. z paska: otacza zaznaczenie i ustawia kursor w środku. */
  function handleFormatInsert(before: string, after: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editContent.slice(start, end);
    const newContent = editContent.slice(0, start) + before + selected + after + editContent.slice(end);
    writeContent(newContent, [start + before.length, end + before.length]);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }

  /**
   * „Wyodrębnij”: zaznaczenie idzie do nowej notatki, a w tej zostaje `[[tytuł]]` na jego miejscu.
   * Nową notatkę zapisujemy od razu; bieżąca treść idzie szkicem jak każda edycja (autozapis / odmontowanie).
   */
  function handleExtractSelection() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = Math.min(ta.selectionStart, ta.selectionEnd);
    const end = Math.max(ta.selectionStart, ta.selectionEnd);
    const selected = editContent.slice(start, end);
    if (!selected.trim()) {
      toast("Zaznacz tekst, który chcesz wyodrębnić");
      return;
    }
    const created = createNoteFromSelection(selected);
    const { content, caret } = replaceSelectionWithLink(editContent, start, end, created.title);
    writeContent(content, [caret, caret]);
    toast.success(`Wyodrębniono do notatki „${created.title}”`);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    }, 0);
  }

  return {
    isEditing,
    editTitle, setEditTitle,
    editContent, setEditContent,
    editChecklist, setEditChecklist,
    showChecklist, setShowChecklist,
    showPreview, setShowPreview,
    fullEditor, setFullEditor,
    findOpen, setFindOpen,
    textareaRef,
    wiki,
    slash,
    handleEditSelect,
    handleEditKeyDown,
    handleFormatInsert,
    handleExtractSelection,
    writeContent,
    /** Tryb wiązania z `Y.Text` (Faza 1b); `null` poza nim. */
    collabText,
    commitDraft,
    handleSave,
    begin,
  };
}

/** Wynik `useNoteEditSession` — to samo przekazuje się edytorowi kafla (`NoteEditor`). */
export type NoteEditSession = ReturnType<typeof useNoteEditSession>;
