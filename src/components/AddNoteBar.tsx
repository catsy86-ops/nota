import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, lazy, Suspense, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { m as motion, AnimatePresence } from "framer-motion";
import { useDictation } from "@/hooks/useDictation";
import { useOverlayHistory } from "@/hooks/useOverlayHistory";
import { useSlashMenu } from "@/hooks/useSlashMenu";
import { AudioLines, Plus, Tag, Bell, Mic, ImagePlus, Paperclip, X, PenTool, ListChecks, Palette, Folder, Flag, Hash, CornerDownRight, Repeat, CopyPlus } from "lucide-react";
import { formatReminderShort } from "@/lib/reminderTime";
import { format as formatDate } from "date-fns";
import { pl as plLocale } from "date-fns/locale";
import { ColorPicker, colorClasses } from "./ColorPicker";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/imagePrepare";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { IconButton } from "@/components/ui/icon-button";
import type { NoteColor, ChecklistItem } from "@/hooks/useNotes";
import { imageStore } from "@/lib/imageStore";
import { NoteImage } from "./NoteImage";
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
import { applyCapture, describeToken, extractCapture, type CaptureToken } from "@/lib/quickCapture";
import { isChecklistShortcut, selectionToChecklist } from "@/lib/checklistPaste";
import { ReminderPicker } from "./ReminderPicker";
import { useWikiAutocomplete } from "@/hooks/useWikiAutocomplete";
import { fallbackRepeat, repeatUpdate, type ReminderRepeat, type RepeatRule } from "@/lib/reminderRepeat";
import { readRule } from "@/lib/reminderSpec";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { toast } from "sonner";
import { addParked, parkedLabel, PARKED_MAX, removeParked, type Parked } from "@/lib/parkedDrafts";
import { toastWithUndo } from "@/lib/undoToast";
import { pluralPl } from "@/lib/plural";
import { parsePastedUrl } from "@/lib/urlTitle";
import { handleEditorKey } from "@/lib/editorKeysDom";
import { EditorStats } from "./EditorStats";
import { haptic } from "@/lib/haptics";
import { pulseSkinSignal } from "@/lib/skinSignal";
import { useLatch } from "@/hooks/useLatch";

/** Od czego zaczyna się nowa notatka (długie przytrzymanie „+” na telefonie). */
export type ComposerAction = "note" | "list" | "dictate" | "image" | "draw" | "reminder";

/** Pola, których nie niesie lista pozycyjna `onAdd` — seria przypomnienia i rodzic. */
export interface ComposerExtras {
  reminderAllDay?: boolean;
  reminderRepeat?: ReminderRepeat;
  reminderRule?: RepeatRule;
  reminderRepeatUntil?: number;
  parentId?: string;
}

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
}

const DRAFT_KEY = "kaczy.draft.v1";
const PARKED_KEY = "kaczy.drafts.v1";

interface Draft {
  title: string;
  content: string;
  checklist: ChecklistItem[];
  /** Metadane szkicu: przywracane razem z tekstem, ale same nie czynią szkicu wartym zachowania. */
  color: NoteColor;
  labels: string[];
  reminder: number | null;
  reminderRepeat: ReminderRepeat;
  reminderRule?: RepeatRule;
  reminderRepeatUntil?: number;
  parentId?: string;
  priority: NotePriority;
}

const DRAFT_REPEATS: ReminderRepeat[] = ["none", "daily", "weekly", "monthly"];
const DRAFT_PRIORITIES: NotePriority[] = ["none", "low", "medium", "high"];

/** Szkic z dowolnego zapisu (localStorage, lista robocza): pola sprawdzone; `null`, gdy nie ma niczego wartego zachowania. */
function sanitizeDraft(p: Partial<Draft>): Draft | null {
  {
    const title = typeof p.title === "string" ? p.title : "";
    const content = typeof p.content === "string" ? p.content : "";
    const checklist = Array.isArray(p.checklist)
      ? p.checklist.filter((i): i is ChecklistItem => !!i && typeof i.id === "string" && typeof i.text === "string").map((i) => ({ id: i.id, text: i.text, checked: !!i.checked, ...(i.indent === 1 ? { indent: 1 as const } : {}) }))
      : [];
    if (!title.trim() && !content.trim() && !checklist.length) return null;
    const color = typeof p.color === "string" && p.color in colorClasses ? (p.color as NoteColor) : "default";
    const labels = Array.isArray(p.labels) ? p.labels.filter((l): l is string => typeof l === "string" && l.length > 0).slice(0, 20) : [];
    // Termin z przeszłości wystrzeliłby zaraz po zapisie — lepiej go nie przywracać.
    const reminder = typeof p.reminder === "number" && Number.isFinite(p.reminder) && p.reminder > Date.now() ? p.reminder : null;
    const priority = DRAFT_PRIORITIES.includes(p.priority as NotePriority) ? (p.priority as NotePriority) : "none";
    // Reguła z nowszej wersji (3.1) ma pierwszeństwo; zapasowy rodzaj z niej wynika.
    const rule = reminder !== null ? readRule(p.reminderRule) : undefined;
    const reminderRepeat = rule ? fallbackRepeat(rule) : reminder !== null && DRAFT_REPEATS.includes(p.reminderRepeat as ReminderRepeat) ? (p.reminderRepeat as ReminderRepeat) : "none";
    const until = typeof p.reminderRepeatUntil === "number" && Number.isFinite(p.reminderRepeatUntil) && reminderRepeat !== "none" ? p.reminderRepeatUntil : undefined;
    const parentId = typeof p.parentId === "string" && p.parentId.length > 0 && p.parentId.length <= 200 ? p.parentId : undefined;
    return { title, content, checklist, color, labels, reminder, reminderRepeat, reminderRule: rule, ...(until !== undefined ? { reminderRepeatUntil: until } : {}), ...(parentId ? { parentId } : {}), priority };
  }
}

/** Szkic nowej notatki z poprzedniej sesji; `null`, gdy nie ma niczego wartego przywrócenia. */
function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return sanitizeDraft(JSON.parse(raw) as Partial<Draft>);
  } catch { return null; }
}

/** Lista robocza z localStorage: każdy wpis przechodzi przez `sanitizeDraft`; uszkodzone pozycje odpadają. */
function readParked(): Parked<Draft>[] {
  try {
    const raw = localStorage.getItem(PARKED_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    const out: Parked<Draft>[] = [];
    for (const e of list) {
      const x = e as { id?: unknown; at?: unknown; draft?: unknown } | null;
      if (!x || typeof x.id !== "string" || typeof x.at !== "number" || !x.draft || typeof x.draft !== "object") continue;
      const draft = sanitizeDraft(x.draft as Partial<Draft>);
      if (draft) out.push({ id: x.id, at: x.at, draft });
    }
    return out.slice(0, PARKED_MAX);
  } catch { return []; }
}

function writeParked(list: Parked<Draft>[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(PARKED_KEY);
    else localStorage.setItem(PARKED_KEY, JSON.stringify(list));
  } catch { /* brak miejsca — lista robocza nie przeżyje przeładowania */ }
}

function writeDraft(d: Draft): void {
  try {
    if (!d.title.trim() && !d.content.trim() && d.checklist.length === 0) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch { /* brak miejsca albo localStorage — szkic po prostu nie przeżyje przeładowania */ }
}

/** Migawka pustego szkicu (patrz blokada podwójnego zapisu w `commit`). */
const EMPTY_DRAFT_KEY = JSON.stringify({ title: "", content: "", images: [], attachments: [], checklist: [] });

export const AddNoteBar = forwardRef<{ expand: (action?: ComposerAction, prefill?: string) => void }, AddNoteBarProps>(function AddNoteBar({ onAdd, folders, allLabels, onCreateLabel, destination, templates, wikiTitles, parentOptions }, ref) {
  // Szkic przeżywa przeładowanie i zamknięcie karty: tytuł, treść i pozycje listy wracają po powrocie.
  const [draft0] = useState(readDraft);
  const [expanded, setExpanded] = useState(draft0 !== null);
  // Data i czas utworzenia: moment otwarcia formularza (tak zapisze się notatka, gdy nie ma innej daty).
  const [openedAt, setOpenedAt] = useState(Date.now);
  useEffect(() => { if (expanded) setOpenedAt(Date.now()); }, [expanded]);
  const [title, setTitle] = useState(draft0?.title ?? "");
  const [content, setContent] = useState(draft0?.content ?? "");
  const [color, setColor] = useState<NoteColor>(draft0?.color ?? "default");
  const [labels, setLabels] = useState<string[]>(draft0?.labels ?? []);
  const [reminder, setReminder] = useState<number | null>(draft0?.reminder ?? null);
  const [priority, setPriority] = useState<NotePriority>(draft0?.priority ?? "none");
  /** Szkic z poprzedniej sesji — pokazujemy to wprost, z możliwością odrzucenia. */
  const [restored, setRestored] = useState(draft0 !== null);
  const [reminderRepeat, setReminderRepeat] = useState<ReminderRepeat>(draft0?.reminderRepeat ?? "none");
  const [reminderRule, setReminderRule] = useState<RepeatRule | undefined>(draft0?.reminderRule);
  const [reminderUntil, setReminderUntil] = useState<number | undefined>(draft0?.reminderRepeatUntil);
  // 2.5: „Cały dzień” z wyboru terminu (termin 9:00 tego dnia, pokazywany jako sama data).
  const [reminderAllDay, setReminderAllDay] = useState(false);
  const [reminderOpenSignal, setReminderOpenSignal] = useState(0);
  const [parentId, setParentId] = useState<string | null>(draft0?.parentId ?? null);
  const [newLabel, setNewLabel] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<AttachmentsPanelHandle>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(draft0?.checklist ?? []);
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

  const reset = useCallback(() => {
    setTitle(""); setContent(""); setColor("default"); setLabels([]); setReminder(null); setReminderRepeat("none"); setReminderRule(undefined); setReminderUntil(undefined); setReminderAllDay(false); setParentId(null); setPriority("none"); setImages([]); setAttachments([]); setChecklist([]); setShowChecklist(false); setIgnored(new Set()); setRestored(false); setExpanded(false);
  }, []);

  // Lista robocza: odłożone szkice nowych notatek (wznawiane z rzędu nad tytułem).
  const [parked, setParked] = useState<Parked<Draft>[]>(readParked);

  const currentDraft = (): Draft => ({
    title, content, checklist, color, labels, reminder, reminderRepeat, reminderRule,
    ...(reminderUntil !== undefined ? { reminderRepeatUntil: reminderUntil } : {}),
    ...(parentId ? { parentId } : {}),
    priority,
  });

  /** Ładuje szkic do kompozytora (wznowienie z listy). */
  const applyDraft = (d: Draft) => {
    setTitle(d.title); setContent(d.content); setColor(d.color); setLabels(d.labels);
    setReminder(d.reminder); setReminderRepeat(d.reminderRepeat); setReminderRule(d.reminderRule); setReminderUntil(d.reminderRepeatUntil);
    setParentId(d.parentId ?? null); setPriority(d.priority); setChecklist(d.checklist);
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
  const commit = useCallback(() => {
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
        ...(parentId && (!parentOptions || parentOptions.some((o) => o.id === parentId)) ? { parentId } : {}),
      };
      onAdd(r.title, r.content, color, allNoteLabels, remindAt, images, checklist, r.priority ?? priority, r.folderId, attachments, extras);
    }
    reset();
  }, [draftKey, title, content, images, attachments, checklist, color, labels, reminder, reminderRepeat, reminderRule, reminderUntil, reminderAllDay, parentId, parentOptions, priority, capture, ignored, onAdd, onCreateLabel, reset]);

  const handleClose = commit;

  /** Zapisuje i od razu otwiera pusty szkic — do seryjnego wpisywania wielu notatek. */
  const saveAndNext = useCallback(() => {
    commit();
    setExpanded(true);
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [commit]);

  useEffect(() => {
    if (expanded && titleRef.current) titleRef.current.focus();
  }, [expanded]);

  useEffect(() => {
    writeDraft({ title, content, checklist, color, labels, reminder, reminderRepeat, reminderRule, reminderRepeatUntil: reminderUntil, ...(parentId ? { parentId } : {}), priority });
  }, [title, content, checklist, color, labels, reminder, reminderRepeat, reminderRule, reminderUntil, parentId, priority]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Kliknięcie w dymek (np. „Cofnij” po usunięciu ukończonych) nie jest kliknięciem „poza” edytorem.
        const popover = (e.target as Element)?.closest?.('[data-radix-popper-content-wrapper], [data-sonner-toaster]');
        if (!popover) handleClose();
      }
    }
    if (expanded) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded, handleClose]);

  function toggleLabel(l: string) {
    setLabels((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);
  }

  function handleCreateLabel() {
    const trimmed = newLabel.trim();
    if (trimmed) {
      if (!allLabels.includes(trimmed)) onCreateLabel(trimmed);
      if (!labels.includes(trimmed)) setLabels((p) => [...p, trimmed]);
      setNewLabel("");
    }
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
    setIgnored((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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
    else if (a === "draw") setShowDrawing(true);
    else if (a === "image") fileInputRef.current?.click();
    else if (a === "dictate" && dictation.supported && !dictation.listening) dictation.toggle();
    else if (a === "reminder") setReminderOpenSignal((n) => n + 1);
  }, [pendingAction, expanded, dictation]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    await addImageFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function addImageFiles(files: File[]) {
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
      className={cn("w-full max-w-xl rounded-card note-shadow border border-border overflow-hidden transition-[box-shadow,background-color] focus-ring-gradient hover:shadow-elevation-3",
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
            <span aria-hidden className="grid place-items-center w-9 h-9 rounded-card bg-primary/12 text-primary-ink ring-1 ring-primary/20 transition-[background-color,transform] duration-(--dur-fast) group-hover:bg-primary/20 group-active:scale-95">
              <Plus className="w-5 h-5" />
            </span>
            <span className="font-medium font-display text-[0.95rem] tracking-tight">Zapisz notatkę...</span>
            {destination && <span className="ml-auto text-xs truncate max-w-[45%]">trafi do: {destination}</span>}
          </motion.button>
        ) : (
          <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={cn("p-4 space-y-3", fullScreen && "flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col space-y-0 gap-3 bg-inherit")}>
            {destination && <p className="text-xs text-muted-foreground">Trafi do: <span className="font-medium text-foreground">{destination}</span></p>}
            {restored && (
              <div role="status" className="flex items-center gap-2 rounded-field bg-primary/10 px-2.5 py-1.5 text-xs text-primary-ink" data-draft-restored="">
                <span>Szkic przywrócony z poprzedniej sesji</span>
                <button type="button" onClick={reset} className="ml-auto rounded px-1.5 py-0.5 font-medium hover:bg-primary/10 outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                  Odrzuć
                </button>
              </div>
            )}
            {parked.length > 0 && (
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
                        <X className="h-3 w-3" aria-hidden />
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

            {capture.length > 0 && (
              <div role="group" aria-label="Rozpoznane w tekście" aria-live="polite" className="flex flex-wrap items-center gap-1.5">
                {capture.map((t) => {
                  const off = ignored.has(t.key);
                  const d = describeToken(t, (date) => formatReminderShort(date.getTime()));
                  const Icon = t.kind === "label" ? Hash : t.kind === "folder" ? Folder : t.kind === "priority" ? Flag : Bell;
                  return (
                    <button key={`${t.field}-${t.start}-${t.key}`} type="button"
                      aria-label={off ? `Przywróć: ${d.aria}` : `Zignoruj: ${d.aria}`}
                      title={off ? "Przywróć rozpoznanie" : "Zignoruj — tekst zostanie bez zmian"}
                      onClick={() => toggleIgnored(t.key)}
                      onKeyDown={(e) => { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); toggleIgnored(t.key); } }}
                      className={cn("pressable inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                        off ? "border-border text-muted-foreground line-through" : "border-primary/40 bg-primary/10 text-primary-ink hover:bg-primary/15")}>
                      <Icon className="w-3 h-3 shrink-0" aria-hidden />
                      <span>{d.label}</span>
                      {t.kind === "label" && t.isNew && !off && <span className="text-2xs opacity-70">nowa</span>}
                      <X className="w-3 h-3 shrink-0 opacity-70" aria-hidden />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Szablony tylko nad pustym szkicem — wybór tworzy osobną notatkę, więc nic by nie zastąpił. */}
            {templates && isDraftEmpty && templates(reset)}

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

            {/* Image previews */}
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative group/img">
                    <NoteImage imageRef={img} className="w-16 h-16 object-cover rounded-field" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Usuń obrazek"
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/img:opacity-100 focus-visible:opacity-100 coarse:opacity-100 coarse:p-2 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <AttachmentsPanel ref={attachmentsRef} attachments={attachments} onChange={setAttachments} />

            {/* Labels display */}
            {labels.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {labels.map((l) => (
                  <button key={l} type="button" onClick={() => toggleLabel(l)} aria-label={`Usuń etykietę ${l}`} className="rounded-control outline-hidden focus-visible:ring-2 focus-visible:ring-ring"><Badge variant="secondary" className="text-2xs cursor-pointer">{l} ×</Badge></button>
                ))}
              </div>
            )}

            {/* Reminder display */}
            {reminder && (
              <div className="flex items-center gap-1 text-xs text-primary-ink">
                <Bell className="w-3 h-3" />
                {formatReminderShort(reminder)}
                {reminderRepeat !== "none" && <Repeat className="w-3 h-3" aria-label="Powtarzane" />}
                <button onClick={() => { setReminder(null); setReminderRepeat("none"); setReminderUntil(undefined); setReminderAllDay(false); }} aria-label="Usuń przypomnienie" className="ml-1 text-muted-foreground hover:text-foreground coarse:inline-flex coarse:h-11 coarse:w-11 coarse:items-center coarse:justify-center">×</button>
              </div>
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
                  <ListChecks className="w-4 h-4" />
                </IconButton>
                <Popover>
                  <PopoverTrigger asChild>
                    <IconButton size="sm" tone={color !== "default" ? "active" : "muted"} title="Kolor" aria-label="Kolor">
                      <Palette className="w-4 h-4" />
                    </IconButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2.5" align="start">
                    <ColorPicker selected={color} onSelect={setColor} />
                  </PopoverContent>
                </Popover>
                {dictation.supported && (
                  <IconButton size="sm" tone={dictation.listening ? "active" : "muted"} onClick={dictation.toggle}
                    title={dictation.listening ? "Zakończ dyktowanie" : "Dyktuj"} aria-label={dictation.listening ? "Zakończ dyktowanie" : "Dyktuj"} aria-pressed={dictation.listening}>
                    <Mic className={cn("w-4 h-4", dictation.listening && "animate-pulse")} />
                  </IconButton>
                )}
                {/* Image upload */}
                <IconButton size="sm" onClick={() => fileInputRef.current?.click()} title="Dodaj obrazek" aria-label="Dodaj obrazek">
                  <ImagePlus className="w-4 h-4" />
                </IconButton>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                {/* Attachments: PDF, tekst, dokumenty */}
                <IconButton size="sm" onClick={() => attachmentsRef.current?.pick()} title="Dodaj plik" aria-label="Dodaj plik">
                  <Paperclip className="w-4 h-4" />
                </IconButton>
                {/* Notatka głosowa jako załącznik (dyktowanie to osobny przycisk z mikrofonem). */}
                {canRecordVoice() && (
                  <IconButton size="sm" onClick={() => attachmentsRef.current?.record()} title="Nagraj notatkę głosową (do 3 min)" aria-label="Nagraj notatkę głosową">
                    <AudioLines className="w-4 h-4" />
                  </IconButton>
                )}
                {/* Drawing */}
                <IconButton size="sm" onClick={() => setShowDrawing(true)} title="Rysuj" aria-label="Rysuj">
                  <PenTool className="w-4 h-4" />
                </IconButton>
                {/* Label picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <IconButton size="sm" title="Etykiety" aria-label="Etykiety">
                      <Tag className="w-4 h-4" />
                    </IconButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3 space-y-3" align="start">
                    <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Etykiety</p>
                    <div className="flex gap-1 flex-wrap">
                      {allLabels.map((l) => (
                        <button key={l} type="button" onClick={() => toggleLabel(l)} aria-pressed={labels.includes(l)} className="rounded-control outline-hidden focus-visible:ring-2 focus-visible:ring-ring"><Badge variant={labels.includes(l) ? "default" : "outline"} className="cursor-pointer text-xs">{l}</Badge></button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input enterKeyHint="done" autoComplete="off" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                        placeholder="Nowa etykieta..." className="flex-1 text-xs max-sm:text-base bg-muted/60 border border-border rounded-field px-2.5 py-1.5 outline-hidden focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                      <IconButton size="sm" tone="primary" onClick={handleCreateLabel} aria-label="Dodaj etykietę">
                        <Plus className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Reminder picker: ten sam co na kaflu — powtarzanie, koniec serii, szybkie terminy */}
                <ReminderPicker
                  reminder={reminder}
                  reminderRepeat={reminderRepeat}
                  reminderRule={reminderRule}
                  reminderRepeatUntil={reminderUntil}
                  reminderAllDay={reminderAllDay}
                  onSet={(ts, repeat, until, allDay) => { setReminder(ts); const u = ts === null ? { reminderRepeat: "none" as const, reminderRule: undefined } : repeatUpdate(repeat); setReminderRepeat(u.reminderRepeat); setReminderRule(u.reminderRule); setReminderUntil(ts === null ? undefined : until); setReminderAllDay(ts !== null && allDay === true); }}
                  openSignal={reminderOpenSignal}
                  trigger={
                    <IconButton size="sm" tone={reminder ? "active" : "muted"} title="Przypomnienie" aria-label="Przypomnienie">
                      <Bell className={cn("w-4 h-4", reminder && "fill-current")} />
                    </IconButton>
                  }
                />
                {/* Podstrona: notatka powstaje pod wybraną */}
                {parentOptions && parentOptions.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <IconButton size="sm" tone={parentId ? "active" : "muted"} title="Podstrona w…" aria-label="Podstrona w…">
                        <CornerDownRight className="w-4 h-4" />
                      </IconButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 space-y-2" align="start">
                      <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Podstrona w</p>
                      <select
                        value={parentId ?? ""}
                        onChange={(e) => setParentId(e.target.value || null)}
                        aria-label="Notatka nadrzędna"
                        className="w-full rounded-field border border-border bg-muted/60 px-2 py-1.5 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Poziom główny</option>
                        {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.title.trim() || "Bez tytułu"}</option>)}
                      </select>
                    </PopoverContent>
                  </Popover>
                )}
                {/* Priority picker */}
                <PriorityPicker priority={priority} onSet={setPriority} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!isDraftEmpty && (
                  <button type="button" onClick={parkCurrent} title="Odłóż szkic na listę roboczą — wrócisz do niego z rzędu „Odłożone”"
                    className="pressable px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-field transition-colors shrink-0 coarse:min-h-11">
                    Odłóż
                  </button>
                )}
                {!isDraftEmpty && (fullScreen ? (
                  <IconButton onClick={saveAndNext} title="Zapisz i dodaj kolejną (Ctrl+Shift+Enter)" aria-label="Zapisz i dodaj kolejną">
                    <CopyPlus className="w-4 h-4" />
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
        imageStore.putDataUrl(dataUrl)
          .then((ref) => setImages((prev) => [...prev, ref]))
          .catch(() => toast.error("Nie udało się zapisać rysunku", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare obrazy albo zrób kopię zapasową i spróbuj ponownie." }));
      }}
    /></Suspense>}
    </>
  );
});
