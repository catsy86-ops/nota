import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { beginNoteTextEdit, endNoteTextEdit, type ChecklistItem, type Note } from "@/hooks/useNotes";
import type { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import { useLiveNoteText } from "@/hooks/useLiveNoteText";
import { haptic } from "@/lib/haptics";

/**
 * Sesja edycji tekstu w kaflu: tytuł, treść, lista, tryb pełnego edytora i podgląd.
 * Szkic żyje tu, a zapis (`commitDraft`) idzie do `onUpdate` — jako autozapis co
 * `autosaveSeconds`, przy „Zapisz” i przy odmontowaniu. Wyciągnięte z `NoteCard`
 * bez zmiany zachowania; testy: `e2e/editing.spec.ts`, `e2e/composer-draft.spec.ts`.
 */
export function useNoteEditSession({
  note,
  autosaveSeconds,
  onUpdate,
  onSaveVersion,
}: {
  note: Note;
  autosaveSeconds: number;
} & Pick<ReturnType<typeof useNoteViewActions>, "onUpdate" | "onSaveVersion">) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>(note.checklist || []);
  const [showChecklist, setShowChecklist] = useState((note.checklist || []).length > 0);
  const [showPreview, setShowPreview] = useState(false);
  const [fullEditor, setFullEditor] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Edycja w kaflu rośnie z treścią (do ~60% ekranu), zamiast pokazywać 2 linie.
  // Pełny ekran bez listy ma własną wysokość (`h-full`), tam nie ruszamy;
  // z listą treść rośnie do ~35% ekranu, a resztę dostaje lista.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!isEditing || (fullEditor && !showChecklist) || !ta) return;
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
    if (note.title === title && note.content === content && !checklistChanged) return;

    if (onSaveVersion && !versionSavedRef.current) {
      onSaveVersion(note.id, note.title, note.content);
      versionSavedRef.current = true;
    }
    onUpdate?.(note.id, { title, content, checklist: draft.checklist });
  }, [note.id, note.title, note.content, note.checklist, onSaveVersion, onUpdate]);

  useDraftAutosave({
    active: isEditing,
    draftKey: `${editTitle}\u0000${editContent}\u0000${JSON.stringify(editChecklist)}`,
    intervalSeconds: autosaveSeconds,
    onSave: commitDraft,
  });

  useLiveNoteText({
    noteId: note.id,
    active: isEditing,
    textareaRef,
    getDraft: () => draftRef.current.content,
    setDraft: setEditContent,
  });

  // Sesję zamykamy po zapisie przy odmontowaniu — cleanupy efektów idą
  // w kolejności deklaracji, więc `useDraftAutosave` zdąży zapisać pierwszy.
  useEffect(() => () => endNoteTextEdit(note.id), [note.id]);

  function handleSave() {
    haptic("success");
    commitDraft();
    endNoteTextEdit(note.id);
    setIsEditing(false);
    setShowPreview(false);
    setFullEditor(false);
  }

  /** Start sesji: kopia treści z `beginNoteTextEdit` (ta sama, którą widzi peer), a nie surowy `note`. */
  function begin() {
    versionSavedRef.current = false;
    setIsEditing(true);
    setEditTitle(note.title);
    setEditContent(beginNoteTextEdit(note.id) ?? note.content);
    setEditChecklist(note.checklist || []);
    setShowChecklist((note.checklist || []).length > 0);
  }

  return {
    isEditing,
    editTitle, setEditTitle,
    editContent, setEditContent,
    editChecklist, setEditChecklist,
    showChecklist, setShowChecklist,
    showPreview, setShowPreview,
    fullEditor, setFullEditor,
    textareaRef,
    commitDraft,
    handleSave,
    begin,
  };
}
