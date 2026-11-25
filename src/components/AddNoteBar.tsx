import { useState, useReducer, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useSyncExternalStore, lazy, Suspense, type ReactNode, type SetStateAction, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { m as motion, AnimatePresence } from "framer-motion";
import { useDictation } from "@/hooks/useDictation";
import { useOverlayHistory } from "@/hooks/useOverlayHistory";
import { useSlashMenu } from "@/hooks/useSlashMenu";
import { AudioLines, Plus, Bell, Mic, ImagePlus, Paperclip, X, PenTool, ListChecks, Palette, CopyPlus, Lock } from "lucide-react";
import { privateNotes } from "@/lib/privateNotes";
import { vaultUi } from "@/lib/vaultUi";
import { yjsStore } from "@/lib/yjsStore";
import { format as formatDate } from "date-fns";
import { pl as plLocale } from "date-fns/locale";
import { ColorPicker, colorClasses } from "./ColorPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/imagePrepare";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { IconButton } from "@/components/ui/icon-button";
import type { NoteColor, ChecklistItem } from "@/hooks/useNotes";
import { imageStore } from "@/lib/imageStore";
import { TitleField } from "./TitleField";
import { AttachmentsPanel, type AttachmentsPanelHandle } from "./AttachmentsPanel";
import { canRecordVoice } from "@/lib/voiceSupport";
import type { Attachment } from "@/lib/attachments";
// Płótno ładowane przy pierwszym „Rysuj” — nie wchodzi do paczki startowej.
const DrawingCanvas = lazy(() => import("./DrawingCanvas").then((m) => ({ default: m.DrawingCanvas })));
import { ChecklistConvertButtons, ChecklistEditor } from "./ChecklistEditor";
import { FormatToolbar } from "./MarkdownRenderer";
import { PriorityPicker } from "./PriorityPicker";
import type { NotePriority } from "@/lib/notePriority";
import { applyCapture, extractCapture, toggledSet, type CaptureToken } from "@/lib/quickCapture";
import { CaptureChips } from "./CaptureChips";
import { isChecklistShortcut, selectionToChecklist } from "@/lib/checklistPaste";
import { ReminderPicker } from "./ReminderPicker";
import { useWikiAutocomplete } from "@/hooks/useWikiAutocomplete";
import { repeatUpdate } from "@/lib/reminderRepeat";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { toast } from "sonner";
import { addParked, parkedLabel, removeParked, type Parked } from "@/lib/parkedDrafts";
import { toastWithUndo } from "@/lib/undoToast";
import { pluralPl } from "@/lib/plural";
import { parsePastedUrl } from "@/lib/urlTitle";
import { handleEditorKey } from "@/lib/editorKeysDom";
import { EditorStats } from "./EditorStats";
import { ComposerChipsRow, ComposerImages, ComposerLabelPicker, ComposerParentPicker } from "./composer/ComposerPickers";
import { haptic } from "@/lib/haptics";
import { pulseSkinSignal } from "@/lib/skinSignal";
import { useLatch } from "@/hooks/useLatch";
import { clearDraft, composerReducer, draftFromFields, fieldsFromDraft, isTextEmpty, readDraft, readParked, writeDraft, writeParked, type ComposerFields, type Draft, type FieldsAction } from "@/lib/noteDraft";
import type { ComposerAction, ComposerExtras } from "@/lib/composerTypes";

export type { ComposerAction, ComposerExtras };

interface AddNoteBarProps {
  onAdd: (title: string, content: string, color: NoteColor, labels: string[], reminder: number | null, images: string[], checklist: ChecklistItem[], priority: NotePriority, folderId?: string | null, attachments?: Attachment[], extras?: ComposerExtras) => void;
  /** Tytuły do podpowiedzi `[[` i `@` (od ostatnio edytowanych). */
  wikiTitles?: string[];
  /** Notatki, pod którymi można założyć podstronę. */
  parentOptions?: { id: string; title: string }[];
  /** Foldery, do których można wskazać `@folder` w treści. */
  folders?: { id: string; name: string }[];
  allLabels: string[];
  onCreateLabel: (label: string) => void;
  /** Gdzie trafi notatka, gdy tworzona jest w folderze albo etykiecie (np. „Praca”, „#pomysły”). */
  destination?: string | null;
  /** Szablony pokazywane w rozwiniętym, pustym szkicu. `done` zwija composer po wyborze. */
  templates?: (done: () => void) => ReactNode;
  /** Plan Notatek 3.5: istniejąca notatka o tym samym tytule (podpowiedź „Otwórz istniejącą”). */
  findDuplicate?: (title: string) => { id: string; title: string } | null;
  onOpenDuplicate?: (id: string) => void;
}

/** Migawka pustego szkicu (patrz blokada podwójnego zapisu w `commit`). */
const EMPTY_DRAFT_KEY = JSON.stringify({ title: "", content: "", images: [], attachments: [], checklist: [] });

export const AddNoteBar = forwardRef<{ expand: (action?: ComposerAction, prefill?: string) => void }, AddNoteBarProps>(function AddNoteBar({ onAdd, folders, allLabels, onCreateLabel, destination, templates, wikiTitles, parentOptions, findDuplicate, onOpenDuplicate }, ref) {
  // Szkic przeżywa przeładowanie i zamknięcie karty: tytuł, treść i pozycje listy wracają po powrocie.
  const [draft0] = useState(readDraft);
  const [expanded, setExpanded] = useState(draft0 !== null);
  // Data i czas utworzenia: moment otwarcia formularza (tak zapisze się notatka, gdy nie ma innej daty).
  const [openedAt, setOpenedAt] = useState(Date.now);
  useEffect(() => { if (expanded) setOpenedAt(Date.now()); }, [expanded]);
  // Pola szkicu w jednym reduktorze (A3.2): settery mają sygnaturę `useState`, „wyczyść” i wznowienie to jedna akcja.
  const [fields, dispatch] = useReducer(composerReducer, draft0, fieldsFromDraft);
  const { title, content, color, labels, reminder, priority, reminderRepeat, reminderRule, reminderUntil, reminderAllDay, reminderLead, parentId, images, attachments, checklist } = fields;
  const { setTitle, setContent, setColor, setLabels, setReminder, setPriority, setReminderRepeat, setReminderRule, setReminderUntil, setReminderAllDay, setReminderLead, setParentId, setImages, setAttachments, setChecklist } = useMemo(() => {
    const set = <K extends keyof ComposerFields>(key: K) => (value: SetStateAction<ComposerFields[K]>) => dispatch({ type: "set", key, value } as FieldsAction);
    return {
      setTitle: set("title"), setContent: set("content"), setColor: set("color"), setLabels: set("labels"), setReminder: set("reminder"),
      setPriority: set("priority"), setReminderRepeat: set("reminderRepeat"), setReminderRule: set("reminderRule"), setReminderUntil: set("reminderUntil"),
      setReminderAllDay: set("reminderAllDay"), setReminderLead: set("reminderLead"), setParentId: set("parentId"), setImages: set("images"),
      setAttachments: set("attachments"), setChecklist: set("checklist"),
    };
  }, []);
  // 3.5: podpowiedź duplikatu liczona odroczonym tytułem — pisanie nie czeka na przejrzenie wszystkich tytułów.
  const deferredTitle = useDeferredValue(title);
  const duplicate = useMemo(() => findDuplicate?.(deferredTitle) ?? null, [findDuplicate, deferredTitle]);
  /** Szkic z poprzedniej sesji — pokazujemy to wprost, z możliwością odrzucenia. */
  const [restored, setRestored] = useState(draft0 !== null);
  const [reminderOpenSignal, setReminderOpenSignal] = useState(0);
  const attachmentsRef = useRef<AttachmentsPanelHandle>(null);
  const [showChecklist, setShowChecklist] = useState((draft0?.checklist.length ?? 0) > 0);
  const [showDrawing, setShowDrawing] = useState(false);
  const drawingMounted = useLatch(showDrawing);
  /** Klucze tokenów, które użytkownik odrzucił chipem — zostają w tekście jak były. */
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingAction, setPendingAction] = useState<ComposerAction | null>(null);
  useImperativeHandle(ref, () => ({
    expand: (action, prefill) => {
      setExpanded(true);
      // „Utwórz notatkę „X”” z palety: wpisany tekst staje się tytułem, o ile tytuł jest jeszcze pusty.
      if (prefill) setTitle((t) => t || prefill);
      // Handlery zdarzeń potrafią podać tu obiekt zdarzenia — przyjmujemy tylko znane akcje.
      if (action === "list" || action === "dictate" || action === "image" || action === "draw" || action === "reminder") setPendingAction(action);
    },
  }));

  // Notatka prywatna (2.2): od pierwszego znaku zapisuje się szyfrogramem w skarbcu, a szkic nie trafia do localStorage.
  // `reset` zawsze zeruje ten stan, żeby kolejna notatka nie dopisała się do poprzedniej prywatnej.
  const [isPrivate, setIsPrivate] = useState(false);
  const [privateId, setPrivateId] = useState<string | null>(null);
  const creatingPrivateRef = useRef(false);
  const closeAfterCreateRef = useRef(false);
  /** Rośnie przy każdym `reset` — szyfrowanie, które skończy się po odrzuceniu szkicu, sprząta po sobie. */
  const privateGenRef = useRef(0);

  const reset = useCallback(() => {
    setIsPrivate(false); setPrivateId(null); closeAfterCreateRef.current = false; privateGenRef.current++;
    dispatch({ type: "reset" }); setShowChecklist(false); setIgnored(new Set()); setRestored(false); setExpanded(false);
  }, []);

  const [privateTick, setPrivateTick] = useState(0);
  /** Ostatni tekst notatki prywatnej — czyta go wywołanie po zakończonym szyfrowaniu, gdy zamknięcie przyszło w trakcie. */
  const latestPrivateRef = useRef({ title, content, checklist, labels });
  const privateConflict = images.length > 0 || attachments.length > 0 || reminder !== null || priority !== "none" || parentId !== null || color !== "default";

  const enablePrivate = () => {
    const phase = privateNotes.phase();
    if (phase === "none") { vaultUi.open("setup", enablePrivate); return; }
    if (phase !== "unlocked") { vaultUi.open("unlock", enablePrivate); return; }
    if (privateConflict) {
      toast.error("Notatka prywatna nie ma plików, przypomnień, priorytetu, koloru ani rodzica", { description: "Usuń je z tej notatki i włącz „Prywatna” ponownie." });
      return;
    }
    clearDraft();
    setIsPrivate(true);
  };

  /**
   * Zamyka kompozytor po notatce prywatnej: dopisuje ostatni tekst do skarbca i czyści formularz.
   * Notatka, z której wszystko skasowano, znika — nie zostaje po niej sama kłódka.
   */
  const finishPrivate = useCallback((id: string | null, fields: { title: string; content: string; checklist: typeof checklist; labels: string[] }) => {
    if (id) {
      if (isTextEmpty(fields)) yjsStore.removeNote(id);
      else yjsStore.patchNote(id, fields);
    }
    void privateNotes.flush();
    reset();
  }, [reset]);

  /** „Odrzuć” i szablon nad pustym szkicem: zaczęta notatka prywatna znika razem ze szkicem. */
  const discardDraft = useCallback(() => {
    if (privateId) yjsStore.removeNote(privateId);
    reset();
  }, [privateId, reset]);

  // Lista robocza: odłożone szkice nowych notatek (wznawiane z rzędu nad tytułem).
  const [parked, setParked] = useState<Parked<Draft>[]>(readParked);

  // Szkic zmienia się tylko z polami, które do niego wchodzą — zdjęcia, pliki i dodatki terminu nie zapisują go od nowa.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draft = useMemo(() => draftFromFields(fields), [title, content, checklist, color, labels, reminder, reminderRepeat, reminderRule, reminderUntil, parentId, priority]);
  const currentDraft = (): Draft => draft;

  /** Ładuje szkic do kompozytora (wznowienie z listy). */
  const applyDraft = (d: Draft) => {
    dispatch({ type: "load", draft: d });
    setShowChecklist(d.checklist.length > 0); setIgnored(new Set()); setRestored(false); setExpanded(true);
  };

  /** Zdjęć i plików nie ma w szkicu (nie są zapisywane przy odkładaniu) — wtedy nie odkładamy. */
  const hasUnsavedMedia = images.length > 0 || attachments.length > 0;

  /** „Odłóż”: bieżący szkic idzie na listę, kompozytor zostaje otwarty i pusty. */
  const parkCurrent = () => {
    if (isDraftEmpty) return;
    if (hasUnsavedMedia) {
      toast.error("Zdjęć i plików nie da się odłożyć", { description: "Zapisz notatkę albo usuń załączniki." });
      return;
    }
    const draft = currentDraft();
    const next = addParked(parked, draft, crypto.randomUUID(), Date.now());
    writeParked(next);
    setParked(next);
    reset();
    setExpanded(true);
    requestAnimationFrame(() => titleRef.current?.focus());
    toast(`Odłożono: „${parkedLabel(draft)}”`, { duration: 3000 });
  };

  /** Wznowienie z listy: bieżący niepusty szkic najpierw zostaje odłożony, żeby nic nie przepadło. */
  const resumeParked = (id: string) => {
    // Wznowienie odkłada bieżący szkic jawnie do localStorage — w notatce prywatnej to wyciek.
    if (isPrivate) return;
    const entry = parked.find((p) => p.id === id);
    if (!entry) return;
    if (!isDraftEmpty && hasUnsavedMedia) {
      toast.error("Zdjęć i plików nie da się odłożyć", { description: "Zapisz notatkę albo usuń załączniki." });
      return;
    }
    const base = isDraftEmpty ? parked : addParked(parked, currentDraft(), crypto.randomUUID(), Date.now());
    const next = removeParked(base, id);
    writeParked(next);
    setParked(next);
    applyDraft(entry.draft);
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  /** Usunięcie z listy z „Cofnij”, które przywraca całą listę sprzed usunięcia. */
  const deleteParked = (id: string) => {
    const entry = parked.find((p) => p.id === id);
    if (!entry) return;
    const before = parked;
    const next = removeParked(before, id);
    writeParked(next);
    setParked(next);
    toastWithUndo(`Usunięto szkic „${parkedLabel(entry.draft)}”`, () => { writeParked(before); setParked(before); });
  };

  // Tokeny z tekstu (`#etykieta`, `@folder`, `!`, „jutro 9:00”) — pokazywane jako chipy, zanim cokolwiek się zapisze.
  const capture = useMemo<CaptureToken[]>(() => {
    if (!expanded || (!title && !content)) return [];
    return extractCapture({ title, content }, {
      labels: allLabels,
      folders: folders ?? [],
      hasReminder: reminder !== null,
      hasPriority: priority !== "none",
    });
  }, [expanded, title, content, allLabels, folders, reminder, priority]);

  // Blokada podwójnego zapisu: dwa szybkie wywołania (np. Ctrl+Enter i klik poza edytorem) widzą jeszcze ten sam, stary szkic.
  // Migawka zapisanego szkicu pomija powtórne zapisanie tej samej treści. Kasuje ją pojawienie się niepustego szkicu
  // (pisanie, prefill z palety, wznowienie, dyktowanie), a nie samo wyczyszczenie po zapisie, więc stare domknięcia
  // z tego samego zdarzenia klawisza nie zapisują drugi raz. Zwykły timer tego nie łapał: dwa Ctrl+Enter oddalone
  // o kilka ms (np. pod obciążeniem) tworzyły dwie notatki.
  const draftKey = useMemo(() => JSON.stringify({ title, content, images, attachments, checklist }), [title, content, images, attachments, checklist]);
  const committedRef = useRef<string | null>(null);
  useEffect(() => { if (draftKey !== EMPTY_DRAFT_KEY) committedRef.current = null; }, [draftKey]);
  // Prywatna notatka nie ma `onAdd` — jej zapis to dopisanie do skarbca, a nie nowa notatka w dokumencie.
  const commit = useCallback(() => {
    if (isPrivate) {
      if (creatingPrivateRef.current) { closeAfterCreateRef.current = true; return; }
      const empty = isTextEmpty({ title, content, checklist });
      // Zapis musi dojść do skarbca, zanim formularz się wyczyści — inaczej tekst przepadłby po cichu.
      if (!empty && !privateNotes.isUnlocked()) {
        toast.info("Odblokuj skarbiec, żeby zapisać notatkę prywatną", { id: "private-composer-locked", description: "Tekst zostaje w edytorze." });
        vaultUi.open("unlock", () => setPrivateTick((t) => t + 1));
        return;
      }
      if (!empty && (!privateId || !yjsStore.isLocked(privateId) || privateNotes.peek(privateId) === undefined)) {
        toast.error("Notatka prywatna nie jest jeszcze zapisana", { id: "private-composer-pending", description: "Spróbuj jeszcze raz za chwilę. Tekst zostaje w edytorze." });
        setPrivateTick((t) => t + 1);
        return;
      }
      finishPrivate(privateId, { title, content, checklist, labels });
      return;
    }
    if (committedRef.current === draftKey) return;
    if (title.trim() || content.trim() || images.length > 0 || attachments.length > 0 || checklist.length > 0) {
      committedRef.current = draftKey;
      const r = applyCapture({ title, content }, capture, ignored, images.length > 0 || attachments.length > 0 || checklist.length > 0);
      r.newLabels.forEach((l) => onCreateLabel(l));
      const allNoteLabels = [...labels];
      for (const l of r.labels) if (!allNoteLabels.includes(l)) allNoteLabels.push(l);
      const remindAt = r.reminder ? r.reminder.getTime() : reminder;
      if (r.reminder) requestNotificationPermissionOnIntent();
      haptic("success");
      pulseSkinSignal("save");
      const extras: ComposerExtras = {
        ...(remindAt !== null && reminderRepeat !== "none" ? { reminderRepeat, ...(reminderRule ? { reminderRule } : {}), ...(reminderUntil !== undefined ? { reminderRepeatUntil: reminderUntil } : {}) } : {}),
        ...(remindAt !== null && reminderAllDay ? { reminderAllDay: true } : {}),
        ...(remindAt !== null && reminderLead !== undefined ? { reminderLead } : {}),
        ...(parentId && (!parentOptions || parentOptions.some((o) => o.id === parentId)) ? { parentId } : {}),
      };
      onAdd(r.title, r.content, color, allNoteLabels, remindAt, images, checklist, r.priority ?? priority, r.folderId, attachments, extras);
    }
    reset();
  }, [isPrivate, privateId, title, content, checklist, labels, finishPrivate, draftKey, images, attachments, color, reminder, reminderRepeat, reminderRule, reminderUntil, reminderAllDay, reminderLead, parentId, parentOptions, priority, capture, ignored, onAdd, onCreateLabel, reset]);

  const handleClose = commit;

  // Sync notatki prywatnej: pierwsza zmiana tworzy szyfrogram, każda następna dopisuje się do skarbca.
  // Gdy skarbiec jest zablokowany, zapis nie idzie w próżnię — prosimy o odblokowanie i wracamy tą samą zmianą.
  useEffect(() => {
    latestPrivateRef.current = { title, content, checklist, labels };
  }, [title, content, checklist, labels]);
  // Blokada skarbca przy otwartej notatce prywatnej: jawny tekst nie może zostać na ekranie.
  // `lock()` ogłasza „locking” przed zapisaniem kolejki — wtedy dopisujemy ostatni tekst, a po blokadzie czyścimy edytor.
  const vaultPhase = useSyncExternalStore(privateNotes.subscribe, () => privateNotes.getSnapshot().phase);
  useEffect(() => {
    if (!isPrivate || !privateId || vaultPhase === "unlocked") return;
    if (vaultPhase === "locking") { yjsStore.patchNote(privateId, latestPrivateRef.current); return; }
    reset();
    toast.info("Skarbiec zablokowany — notatka prywatna jest zapisana", { id: "private-composer-closed" });
  }, [isPrivate, privateId, vaultPhase, reset]);
  useEffect(() => {
    if (!isPrivate) return;
    if (!privateNotes.isUnlocked()) {
      if (!privateId && draftKey !== EMPTY_DRAFT_KEY) vaultUi.open("unlock", () => setPrivateTick((t) => t + 1));
      return;
    }
    if (privateId) {
      // Notatkę usunięto (tu albo na innym urządzeniu) — tekst z edytora trafi do nowej, zamiast przepaść.
      if (!yjsStore.isLocked(privateId)) { setPrivateId(null); return; }
      // Po ponownym odblokowaniu treści nie ma w pamięci skarbca — sink odrzuciłby zapis. Najpierw odszyfrowanie.
      if (privateNotes.peek(privateId) === undefined) {
        if (privateNotes.isUndecryptable(privateId)) {
          toast.error("Tej notatki prywatnej nie da się odszyfrować bieżącym hasłem", { id: "private-composer-undecryptable", description: "Skopiuj tekst z edytora, zanim go zamkniesz." });
          return;
        }
        const vault = yjsStore.getVault(privateId);
        if (vault) void privateNotes.ensureDecrypted({ id: privateId, vault }).then(() => setPrivateTick((t) => t + 1));
        return;
      }
      // Jedna transakcja dokumentu na chwilę pisania, nie na każdy znak. Zamknięcie i blokada dopisują ostatni tekst same.
      const timer = setTimeout(() => yjsStore.patchNote(privateId, { title, content, checklist, labels }), 250);
      return () => clearTimeout(timer);
    }
    if (draftKey === EMPTY_DRAFT_KEY || creatingPrivateRef.current) return;
    creatingPrivateRef.current = true;
    const gen = privateGenRef.current;
    void privateNotes.createNote({ title, content, checklist, labels }).then((id) => {
      creatingPrivateRef.current = false;
      // Szkic odrzucony w trakcie szyfrowania: notatka nie zostaje jako sierota.
      if (gen !== privateGenRef.current) { if (id) yjsStore.removeNote(id); return; }
      if (!id) {
        closeAfterCreateRef.current = false;
        toast.error("Nie udało się zapisać notatki prywatnej", { description: "Odblokuj skarbiec i spróbuj ponownie." });
        return;
      }
      setPrivateId(id);
      if (closeAfterCreateRef.current) {
        closeAfterCreateRef.current = false;
        finishPrivate(id, latestPrivateRef.current);
      }
    });
    // `draftKey` i `privateTick` ponawiają zapis po odblokowaniu skarbca; `draftKey` nie zawiera etykiet, więc są osobno.
  }, [isPrivate, privateId, privateTick, vaultPhase, draftKey, title, content, checklist, labels, finishPrivate]);

  /** Zapisuje i od razu otwiera pusty szkic — do seryjnego wpisywania wielu notatek. */
  const saveAndNext = useCallback(() => {
    commit();
    setExpanded(true);
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [commit]);

  useEffect(() => {
    if (expanded && titleRef.current) titleRef.current.focus();
  }, [expanded]);

  // Szkic prywatny nie trafia do localStorage: jego treść żyje w skarbcu (patrz `privateSync` niżej).
  useEffect(() => {
    if (isPrivate) return;
    writeDraft(draft);
  }, [isPrivate, draft]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      // Okno skarbca (portal) otwarte z kompozytora — klik w nie nie zamyka edytora, bo to on czeka na hasło.
      if (vaultUi.get()) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Kliknięcie w dymek (np. „Cofnij” po usunięciu ukończonych) nie jest kliknięciem „poza” edytorem.
        // Arkusz terminu (F2.1) to portal poza kompozytorem — jego dotknięcie to nie „poza” edytorem.
        const popover = (e.target as Element)?.closest?.('[data-radix-popper-content-wrapper], [data-sonner-toaster], [data-reminder-sheet]');
        if (!popover) handleClose();
      }
    }
    if (expanded) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded, handleClose]);

  function toggleLabel(l: string) {
    setLabels((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);
  }

  function createLabel(name: string) {
    if (!allLabels.includes(name)) onCreateLabel(name);
    setLabels((p) => p.includes(name) ? p : [...p, name]);
  }

  const isDraftEmpty = !title.trim() && !content.trim() && images.length === 0 && attachments.length === 0 && checklist.length === 0;

  const slash = useSlashMenu({ textareaRef, value: content });
  // `@nazwa` pasująca do folderu to token przechwytywania, nie wzmianka — folder ma pierwszeństwo.
  const skipMention = useCallback((q: string) => {
    const lq = q.toLowerCase();
    return lq.length > 0 && (folders ?? []).some((f) => f.name.toLowerCase().startsWith(lq));
  }, [folders]);
  const wiki = useWikiAutocomplete({ textareaRef, value: content, onChange: setContent, titles: wikiTitles ?? [], exclude: title, skipMention });

  /** Ctrl+Shift+L: zaznaczone linie (albo bieżąca) przechodzą na listę zadań. */
  function handleContentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Menu „/” przejmuje strzałki, Enter, Tab i Esc, dopóki jest otwarte.
    if (wiki.isOpen && !e.ctrlKey && !e.metaKey && !e.altKey) { wiki.textareaProps.onKeyDown(e); return; }
    if (slash.isOpen && !e.ctrlKey && !e.metaKey && !e.altKey) { slash.onKeyDown(e); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") { e.preventDefault(); saveAndNext(); return; }
    // Ctrl+B/I/K, Ctrl+Enter (zapis), listy, Tab, Alt+↑/↓ — zob. editorKeys.ts.
    if (!isChecklistShortcut(e)) { const ta = textareaRef.current; if (ta) handleEditorKey(e, ta, { onSave: handleClose }); return; }
    e.preventDefault();
    const ta = e.currentTarget;
    const r = selectionToChecklist(content, ta.selectionStart, ta.selectionEnd, checklist);
    if (!r) return;
    setContent(r.content);
    setChecklist(r.checklist);
    setShowChecklist(true);
  }

  function toggleIgnored(key: string) {
    setIgnored((prev) => toggledSet(prev, key));
  }

  /** Sam URL wklejony w pusty szkic: tytuł z domeny (bez sieci), adres w treści. */
  function handleContentPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // Zrzut ekranu / skopiowany obraz: trafia do załączników szkicu zamiast do pola tekstu.
    const pastedImages = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (pastedImages.length > 0) {
      e.preventDefault();
      void addImageFiles(pastedImages);
      return;
    }
    // Pusty szkic: sam adres z tytułem strony (istniejąca obsługa). Inaczej — formatowanie z HTML.
    if (!title.trim() && !content.trim()) {
      const parsed = parsePastedUrl(e.clipboardData.getData("text/plain"));
      if (parsed) {
        e.preventDefault();
        setTitle(parsed.title);
        setContent(parsed.url);
        return;
      }
    }
    pasteHtmlAsMarkdown(e);
  }

  /**
   * Wklejenie z HTML (strona, dokument) zamienia formatowanie na Markdown i wstawia w miejscu kursora.
   * Zwykły tekst bez formatowania zostaje przy domyślnym wklejaniu — różnica nie ma sensu.
   */
  function pasteHtmlAsMarkdown(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html");
    if (!html.trim()) return;
    const md = htmlToMarkdown(html);
    if (!md || md === e.clipboardData.getData("text/plain").trim()) return;
    e.preventDefault();
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    setContent(content.slice(0, start) + md + content.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + md.length, start + md.length);
    });
  }

  // Dyktowanie dopisuje rozpoznane zdanie na końcu treści.
  const dictation = useDictation((text) => {
    if (!text) return;
    setContent((c) => (c && !/\s$/.test(c) ? `${c} ${text}` : `${c}${text}`));
  });

  // Akcja z długiego przytrzymania „+”: wykonujemy ją, gdy edytor już się otworzył.
  useEffect(() => {
    if (!pendingAction || !expanded) return;
    const a = pendingAction;
    setPendingAction(null);
    if (a === "list") setShowChecklist(true);
    // Rysunek i obraz nie są szyfrowane — w notatce prywatnej ich nie otwieramy.
    else if (a === "draw") { if (!isPrivate) setShowDrawing(true); }
    else if (a === "image") { if (!isPrivate) fileInputRef.current?.click(); }
    else if (a === "dictate" && dictation.supported && !dictation.listening) dictation.toggle();
    else if (a === "reminder") setReminderOpenSignal((n) => n + 1);
  }, [pendingAction, expanded, dictation, isPrivate]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    await addImageFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function addImageFiles(files: File[]) {
    // Obrazy nie są szyfrowane (3.3): w notatce prywatnej nie zapisujemy ich bajtów w IndexedDB.
    if (isPrivate) {
      toast.error("Notatka prywatna nie przyjmuje obrazów", { description: "Obrazy i pliki nie są szyfrowane. Dodaj je do zwykłej notatki." });
      return;
    }
    let skipped = 0;
    try {
      for (const file of files) {
        const prepared = await prepareImage(file);
        if (!prepared) { skipped++; continue; }
        const ref = await imageStore.putBlob(prepared);
        setImages((prev) => [...prev, ref]);
      }
    } catch {
      toast.error("Nie udało się zapisać obrazka", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare notatki z obrazkami i spróbuj ponownie." });
    }
    if (skipped > 0) {
      toast.error(skipped === 1 ? "Nie udało się zmniejszyć obrazka do 2 MB" : `${skipped} ${pluralPl(skipped, ["obrazka", "obrazków", "obrazków"])} nie udało się zmniejszyć do 2 MB`);
    }
  }

  // Edycja istniejącej notatki na telefonie jest na pełnym ekranie (NoteCard) — nowa też, zamiast pola w środku listy.
  const fullScreen = expanded && typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  // „Wstecz” zwija pełnoekranowy edytor (szkic zostaje), tak jak Esc.
  useOverlayHistory(fullScreen, () => setExpanded(false));

  const composer = (
    <motion.div ref={containerRef} layout={!fullScreen} data-composer-open={expanded || undefined}
      role={fullScreen ? "dialog" : undefined} aria-modal={fullScreen || undefined} aria-label={fullScreen ? "Nowa notatka" : undefined}
      onKeyDown={(e) => {
        // Esc zapisuje i zamyka edytor — tak samo jak Ctrl+Enter i klik poza edytorem (puste szkice nic nie tworzą). Zdarzenia z okienek w portalach (przypomnienie, etykiety) nie liczą się.
        if (e.key !== "Escape" || e.defaultPrevented || !expanded) return;
        if (!containerRef.current?.contains(e.target as Node)) return;
        if (wiki.isOpen || slash.isOpen) return;
        e.stopPropagation();
        handleClose();
      }} data-note-color={expanded && color !== "default" ? color : undefined}
      className={cn("w-full max-w-(--page-form) rounded-card note-shadow border border-border overflow-hidden transition-[box-shadow,background-color] focus-ring-gradient hover:shadow-elevation-3",
        // Kolor schowany pod ikoną palety — edytor przyjmuje go od razu, żeby było widać wybór.
        expanded && color !== "default" ? colorClasses[color] : "bg-card", !expanded && "max-md:hidden",
        fullScreen && "fixed inset-x-0 top-0 bottom-(--kb-inset,0px) z-modal max-w-none rounded-none border-0 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]")}>
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button key="collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setExpanded(true)}
            className="group w-full flex items-center gap-3.5 px-4 py-3.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {/* Kafelek z bursztynowym plusem — jak zakładka w zeszycie; reaguje na najechanie i fokus. */}
            <span aria-hidden className="grid place-items-center size-9 rounded-card bg-primary/12 text-primary-ink ring-1 ring-primary/20 transition-[background-color,transform] duration-(--dur-fast) group-hover:bg-primary/20 group-active:scale-95">
              <Plus className="size-5" />
            </span>
            <span className="font-medium font-display text-base tracking-tight">Zapisz notatkę...</span>
            {destination && <span className="ml-auto text-xs truncate max-w-[45%]">trafi do: {destination}</span>}
          </motion.button>
        ) : (
          <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={cn("p-4 space-y-3", fullScreen && "flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col space-y-0 gap-3 bg-inherit")}>
            {destination && !isPrivate && <p className="ui-hint">Trafi do: <span className="font-medium text-foreground">{destination}</span></p>}
            {restored && (
              <div role="status" className="flex items-center gap-2 rounded-field bg-primary/10 px-2.5 py-1.5 text-xs text-primary-ink" data-draft-restored="">
                <span>Szkic przywrócony z poprzedniej sesji</span>
                <button type="button" onClick={discardDraft} className="ml-auto rounded px-1.5 py-0.5 font-medium hover:bg-primary/10 outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                  Odrzuć
                </button>
              </div>
            )}
            {parked.length > 0 && !isPrivate && (
              <div role="group" aria-label="Odłożone szkice" className="flex flex-wrap items-center gap-1.5 text-xs" data-parked-count={parked.length}>
                <span className="text-muted-foreground">Odłożone:</span>
                {parked.map((p) => {
                  const label = parkedLabel(p.draft);
                  return (
                    <span key={p.id} className="inline-flex max-w-full items-center rounded-full border border-border bg-muted/40">
                      <button type="button" onClick={() => resumeParked(p.id)} aria-label={`Wznów szkic: ${label}`}
                        className="min-w-0 truncate px-2.5 py-1 hover:text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11 coarse:px-3">
                        {label}
                      </button>
                      <button type="button" onClick={() => deleteParked(p.id)} aria-label={`Usuń odłożony szkic: ${label}`}
                        className="pr-2 pl-0.5 text-muted-foreground hover:text-destructive-ink outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11">
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <TitleField ref={titleRef} value={title} onChange={setTitle} placeholder="Tytuł"
              onEnter={(e) => {
                if (e.ctrlKey || e.metaKey) { if (e.shiftKey) saveAndNext(); else handleClose(); }
                else textareaRef.current?.focus();
              }}
              className="w-full bg-transparent text-lg font-display font-semibold text-foreground placeholder:text-muted-foreground outline-hidden" />
            {duplicate && (
              <p className="ui-hint flex flex-wrap items-center gap-x-2" role="status" data-testid="composer-duplicate">
                Masz już notatkę „{duplicate.title}”.
                {onOpenDuplicate && (
                  <button type="button" onClick={() => onOpenDuplicate(duplicate.id)} className="font-medium text-primary-ink underline-offset-2 hover:underline coarse:min-h-11">
                    Otwórz istniejącą
                  </button>
                )}
                <span>Albo zapisz tę jako nową.</span>
              </p>
            )}
            <FormatToolbar onInsert={(before, after) => {
              const ta = textareaRef.current;
              if (!ta) return;
              const s = ta.selectionStart, e2 = ta.selectionEnd;
              const sel = content.slice(s, e2);
              setContent(content.slice(0, s) + before + sel + after + content.slice(e2));
            }} />
            <div className={cn("relative", fullScreen && "flex-1")}>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} onPaste={handleContentPaste} aria-autocomplete="list" aria-expanded={wiki.isOpen} onSelect={() => { wiki.textareaProps.onSelect(); slash.refresh(); }} onKeyDown={handleContentKeyDown} placeholder="Treść notatki..." rows={3}
                className="w-full max-sm:min-h-[35dvh] bg-transparent text-sm max-sm:text-base text-foreground placeholder:text-muted-foreground outline-hidden resize-none" />
              {wiki.popup()}{slash.popup()}
            </div>
            {content.length > 0 && <EditorStats textareaRef={textareaRef} value={content} className="block text-2xs text-muted-foreground" />}

            {/* `#etykieta`, daty i `@folder` nie działają w notatce prywatnej — chipy obiecywałyby coś, czego zapis nie zrobi. */}
            {!isPrivate && <CaptureChips tokens={capture} ignored={ignored} onToggle={toggleIgnored} />}

            {/* Szablony tylko nad pustym szkicem — wybór tworzy osobną notatkę, więc nic by nie zastąpił. */}
            {templates && isDraftEmpty && templates(discardDraft)}

            {(content.trim() || checklist.length > 0) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <ChecklistConvertButtons
                  content={content}
                  checklist={checklist}
                  onConvert={(r, toList) => { setContent(r.content); setChecklist(r.checklist); setShowChecklist(toList); }}
                />
              </div>
            )}
            {showChecklist && <ChecklistEditor items={checklist} onChange={setChecklist} />}

            <ComposerImages images={images} onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))} />

            {!isPrivate && <AttachmentsPanel ref={attachmentsRef} attachments={attachments} onChange={setAttachments} />}

            <ComposerChipsRow
              labels={labels} onToggleLabel={toggleLabel} reminder={reminder} reminderRepeat={reminderRepeat}
              onClearReminder={() => { setReminder(null); setReminderRepeat("none"); setReminderUntil(undefined); setReminderAllDay(false); setReminderLead(undefined); }}
            />

            {isPrivate && (
              <p className="flex items-center gap-1 text-2xs text-primary-ink">
                <Lock className="size-3.5" aria-hidden />
                Zapisuje się zaszyfrowana hasłem skarbca, poza folderem. Obrazy, przypomnienia i odłożenie szkicu są wyłączone.
              </p>
            )}
            <time dateTime={new Date(openedAt).toISOString()} className="block text-2xs text-muted-foreground tabular-nums">
              Data i czas: {formatDate(openedAt, "d MMM yyyy, HH:mm", { locale: plLocale })}
            </time>

            {/* Jeden rząd narzędzi z „Zamknij” — kolory pod ikoną palety, lista zadań jako przełącznik. */}
            <div className={cn("flex gap-2 pt-1", fullScreen ? "items-center sticky bottom-0 z-raised -mx-4 mt-auto border-t border-border/60 bg-inherit px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2" : "items-end")}>
              {/* Na telefonie narzędzia przewijają się w jednym rzędzie, a „Zapisz” stoi po prawej, pod kciukiem. */}
              <div className={cn("flex min-w-0 flex-1 items-center gap-1", fullScreen ? "flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden *:shrink-0" : "flex-wrap")}>
                <IconButton size="sm" tone={showChecklist ? "active" : "muted"} onClick={() => setShowChecklist(!showChecklist)}
                  title="Lista zadań" aria-label="Lista zadań" aria-pressed={showChecklist}>
                  <ListChecks className="size-4" />
                </IconButton>
                {!isPrivate && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <IconButton size="sm" tone={color !== "default" ? "active" : "muted"} title="Kolor" aria-label="Kolor">
                        <Palette className="size-4" />
                      </IconButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2.5" align="start">
                      <ColorPicker selected={color} onSelect={setColor} />
                    </PopoverContent>
                  </Popover>
                )}
                <IconButton size="sm" tone={isPrivate ? "active" : "muted"}
                  onClick={() => {
                    // Wyłączenie tylko przed pierwszym zapisem; w trakcie szyfrowania powstałaby sierota i jawna kopia.
                    if (!isPrivate) enablePrivate();
                    else if (!privateId && !creatingPrivateRef.current) setIsPrivate(false);
                  }}
                  disabled={isPrivate && privateId !== null}
                  title={isPrivate ? "Notatka prywatna — zaszyfrowana hasłem skarbca" : "Notatka prywatna (zaszyfrowana)"}
                  aria-label="Notatka prywatna" aria-pressed={isPrivate}>
                  <Lock className="size-4" />
                </IconButton>
                {dictation.supported && (
                  <IconButton size="sm" tone={dictation.listening ? "active" : "muted"} onClick={dictation.toggle}
                    title={dictation.listening ? "Zakończ dyktowanie" : "Dyktuj"} aria-label={dictation.listening ? "Zakończ dyktowanie" : "Dyktuj"} aria-pressed={dictation.listening}>
                    <Mic className={cn("size-4", dictation.listening && "animate-pulse")} />
                  </IconButton>
                )}
                {/* Pliki, rysunki i przypomnienia nie wchodzą do notatki prywatnej (patrz `enablePrivate`). */}
                {!isPrivate && (
                  <>
                    {/* Image upload */}
                    <IconButton size="sm" onClick={() => fileInputRef.current?.click()} title="Dodaj obrazek" aria-label="Dodaj obrazek">
                      <ImagePlus className="size-4" />
                    </IconButton>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                    {/* Attachments: PDF, tekst, dokumenty */}
                    <IconButton size="sm" onClick={() => attachmentsRef.current?.pick()} title="Dodaj plik" aria-label="Dodaj plik">
                      <Paperclip className="size-4" />
                    </IconButton>
                    {/* Notatka głosowa jako załącznik (dyktowanie to osobny przycisk z mikrofonem). */}
                    {canRecordVoice() && (
                      <IconButton size="sm" onClick={() => attachmentsRef.current?.record()} title="Nagraj notatkę głosową (do 3 min)" aria-label="Nagraj notatkę głosową">
                        <AudioLines className="size-4" />
                      </IconButton>
                    )}
                    {/* Drawing */}
                    <IconButton size="sm" onClick={() => setShowDrawing(true)} title="Rysuj" aria-label="Rysuj">
                      <PenTool className="size-4" />
                    </IconButton>
                  </>
                )}
                <ComposerLabelPicker allLabels={allLabels} labels={labels} onToggle={toggleLabel} onCreate={createLabel} isPrivate={isPrivate} />
                {/* Reminder picker: ten sam co na kaflu — powtarzanie, koniec serii, szybkie terminy */}
                {!isPrivate && <ReminderPicker
                  reminder={reminder}
                  reminderRepeat={reminderRepeat}
                  reminderRule={reminderRule}
                  reminderRepeatUntil={reminderUntil}
                  reminderAllDay={reminderAllDay}
                  reminderLead={reminderLead}
                  onSet={(ts, repeat, until, allDay, lead) => { setReminderLead(ts === null ? undefined : lead); setReminder(ts); const u = ts === null ? { reminderRepeat: "none" as const, reminderRule: undefined } : repeatUpdate(repeat); setReminderRepeat(u.reminderRepeat); setReminderRule(u.reminderRule); setReminderUntil(ts === null ? undefined : until); setReminderAllDay(ts !== null && allDay === true); }}
                  openSignal={reminderOpenSignal}
                  trigger={
                    <IconButton size="sm" tone={reminder ? "active" : "muted"} title="Przypomnienie" aria-label="Przypomnienie">
                      <Bell className={cn("size-4", reminder && "fill-current")} />
                    </IconButton>
                  }
                />}
                {/* Podstrona: notatka powstaje pod wybraną */}
                {!isPrivate && parentOptions && parentOptions.length > 0 && (
                  <ComposerParentPicker parentId={parentId} options={parentOptions} onChange={setParentId} />
                )}
                {/* Priority picker */}
                {!isPrivate && <PriorityPicker priority={priority} onSet={setPriority} />}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!isDraftEmpty && !isPrivate && (
                  <button type="button" onClick={parkCurrent} title="Odłóż szkic na listę roboczą — wrócisz do niego z rzędu „Odłożone”"
                    className="pressable px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-field transition-colors shrink-0 coarse:min-h-11">
                    Odłóż
                  </button>
                )}
                {!isDraftEmpty && (fullScreen ? (
                  <IconButton onClick={saveAndNext} title="Zapisz i dodaj kolejną (Ctrl+Shift+Enter)" aria-label="Zapisz i dodaj kolejną">
                    <CopyPlus className="size-4" />
                  </IconButton>
                ) : (
                  <button type="button" onClick={saveAndNext}
                    title="Zapisz i otwórz pusty szkic (Ctrl+Shift+Enter)"
                    className="pressable px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-field transition-colors shrink-0">
                    Zapisz i dodaj kolejną
                  </button>
                ))}
                <button onClick={handleClose}
                  title={isDraftEmpty ? "Zamknij" : "Zapisz notatkę (Ctrl+Enter)"}
                  className={cn("pressable px-4 py-1.5 text-sm font-medium font-display text-primary-ink hover:bg-primary/10 rounded-field transition-colors shrink-0", isDraftEmpty && "ml-auto",
                    fullScreen && !isDraftEmpty && "h-11 rounded-full bg-primary px-6 text-primary-foreground shadow-glow-primary hover:bg-primary/90")}>
                  {isDraftEmpty ? "Zamknij" : "Zapisz"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return (
    <>
    {/* Na telefonie zwinięty pasek dublował „+” z dolnej nawigacji i zabierał ~90 px nad notatkami — „+” rozwija ten sam edytor. */}
    {fullScreen ? createPortal(composer, document.body) : composer}

    {drawingMounted && <Suspense fallback={null}><DrawingCanvas
      open={showDrawing}
      onOpenChange={setShowDrawing}
      onSave={(dataUrl) => {
        if (isPrivate) { toast.error("Notatka prywatna nie przyjmuje rysunków", { description: "Rysunki nie są szyfrowane. Dodaj go do zwykłej notatki." }); return; }
        imageStore.putDataUrl(dataUrl)
          .then((ref) => setImages((prev) => [...prev, ref]))
          .catch(() => toast.error("Nie udało się zapisać rysunku", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare obrazy albo zrób kopię zapasową i spróbuj ponownie." }));
      }}
    /></Suspense>}
    </>
  );
});
