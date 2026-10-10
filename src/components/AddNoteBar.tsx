import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Tag, Bell, ImagePlus, Paperclip, X, PenTool, ListChecks, Palette, Folder, Flag, Hash } from "lucide-react";
import { formatReminderShort } from "@/lib/reminderTime";
import { ColorPicker, colorClasses } from "./ColorPicker";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LazyCalendar as Calendar } from "@/components/ui/lazy-calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import type { NoteColor, ChecklistItem } from "@/hooks/useNotes";
import { imageStore } from "@/lib/imageStore";
import { NoteImage } from "./NoteImage";
import { AttachmentsPanel, type AttachmentsPanelHandle } from "./AttachmentsPanel";
import type { Attachment } from "@/lib/attachments";
import { DrawingCanvas } from "./DrawingCanvas";
import { ChecklistConvertButtons, ChecklistEditor } from "./ChecklistEditor";
import { FormatToolbar } from "./MarkdownRenderer";
import { PriorityPicker } from "./PriorityPicker";
import type { NotePriority } from "@/lib/notePriority";
import { applyCapture, describeToken, extractCapture, type CaptureToken } from "@/lib/quickCapture";
import { isChecklistShortcut, selectionToChecklist } from "@/lib/checklistPaste";
import { QuickReminderInput } from "./QuickReminderInput";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { composeReminderTimestamp, toTimeInputValue, DEFAULT_REMINDER_TIME } from "@/lib/reminderTime";
import { toast } from "sonner";
import { pluralPl } from "@/lib/plural";
import { parsePastedUrl } from "@/lib/urlTitle";
import { handleEditorKey } from "@/lib/editorKeysDom";
import { EditorStats } from "./EditorStats";
import { haptic } from "@/lib/haptics";

interface AddNoteBarProps {
  onAdd: (title: string, content: string, color: NoteColor, labels: string[], reminder: number | null, images: string[], checklist: ChecklistItem[], priority: NotePriority, folderId?: string | null, attachments?: Attachment[]) => void;
  /** Foldery, do których można wskazać `@folder` w treści. */
  folders?: { id: string; name: string }[];
  allLabels: string[];
  onCreateLabel: (label: string) => void;
  /** Gdzie trafi notatka, gdy tworzona jest w folderze albo etykiecie (np. „Praca”, „#pomysły”). */
  destination?: string | null;
  /** Szablony pokazywane w rozwiniętym, pustym szkicu. `done` zwija composer po wyborze. */
  templates?: (done: () => void) => ReactNode;
}

export const AddNoteBar = forwardRef<{ expand: () => void }, AddNoteBarProps>(function AddNoteBar({ onAdd, folders, allLabels, onCreateLabel, destination, templates }, ref) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<NoteColor>("default");
  const [labels, setLabels] = useState<string[]>([]);
  const [reminder, setReminder] = useState<number | null>(null);
  const [priority, setPriority] = useState<NotePriority>("none");
  const [reminderDate, setReminderDate] = useState<Date | undefined>();
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [newLabel, setNewLabel] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<AttachmentsPanelHandle>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  /** Klucze tokenów, które użytkownik odrzucił chipem — zostają w tekście jak były. */
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ expand: () => setExpanded(true) }));

  const reset = useCallback(() => {
    setTitle(""); setContent(""); setColor("default"); setLabels([]); setReminder(null); setReminderDate(undefined); setReminderTime(DEFAULT_REMINDER_TIME); setPriority("none"); setImages([]); setAttachments([]); setChecklist([]); setShowChecklist(false); setIgnored(new Set()); setExpanded(false);
  }, []);

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

  const handleClose = useCallback(() => {
    if (title.trim() || content.trim() || images.length > 0 || attachments.length > 0 || checklist.length > 0) {
      const r = applyCapture({ title, content }, capture, ignored, images.length > 0 || attachments.length > 0 || checklist.length > 0);
      r.newLabels.forEach((l) => onCreateLabel(l));
      const allNoteLabels = [...labels];
      for (const l of r.labels) if (!allNoteLabels.includes(l)) allNoteLabels.push(l);
      const remindAt = r.reminder ? r.reminder.getTime() : reminder;
      if (r.reminder) requestNotificationPermissionOnIntent();
      haptic("success");
      onAdd(r.title, r.content, color, allNoteLabels, remindAt, images, checklist, r.priority ?? priority, r.folderId, attachments);
    }
    reset();
  }, [title, content, images, attachments, checklist, color, labels, reminder, priority, capture, ignored, onAdd, onCreateLabel, reset]);

  useEffect(() => {
    if (expanded && titleRef.current) titleRef.current.focus();
  }, [expanded]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const popover = (e.target as Element)?.closest?.('[data-radix-popper-content-wrapper]');
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

  const reminderTimestamp = reminderDate ? composeReminderTimestamp(reminderDate, reminderTime) : null;

  function handleSetReminder() {
    if (reminderTimestamp !== null) {
      requestNotificationPermissionOnIntent();
      setReminder(reminderTimestamp);
    }
  }

  function handleQuickReminderParsed(parsed: Date) {
    setReminderDate(parsed);
    setReminderTime(toTimeInputValue(parsed.getTime()));
  }

  /** Ctrl+Shift+L: zaznaczone linie (albo bieżąca) przechodzą na listę zadań. */
  function handleContentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+B/I/K, Ctrl+Enter (zapis), listy, Tab, Alt+↑/↓ — zob. editorKeys.ts.
    if (!isChecklistShortcut(e)) { handleEditorKey(e, { onSave: handleClose }); return; }
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
    if (title.trim() || content.trim()) return;
    const parsed = parsePastedUrl(e.clipboardData.getData("text/plain"));
    if (!parsed) return;
    e.preventDefault();
    setTitle(parsed.title);
    setContent(parsed.url);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    let skipped = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 2 * 1024 * 1024) { skipped++; continue; }
        const ref = await imageStore.putBlob(file);
        setImages((prev) => [...prev, ref]);
      }
    } catch {
      toast.error("Nie udało się zapisać obrazka", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare notatki z obrazkami i spróbuj ponownie." });
    }
    if (skipped > 0) {
      toast.error(skipped === 1 ? "Obrazek jest za duży (max 2 MB)" : `${skipped} ${pluralPl(skipped, ["obrazek jest za duży", "obrazki są za duże", "obrazków jest za dużych"])} (max 2 MB)`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Edycja istniejącej notatki na telefonie jest na pełnym ekranie (NoteCard) — nowa też, zamiast pola w środku listy.
  const fullScreen = expanded && typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

  const composer = (
    <motion.div ref={containerRef} layout={!fullScreen} data-composer-open={expanded || undefined} data-note-color={expanded && color !== "default" ? color : undefined}
      className={cn("w-full max-w-xl rounded-2xl note-shadow border border-border overflow-hidden transition-[box-shadow,background-color] focus-ring-gradient hover:shadow-elevation-3",
        // Kolor schowany pod ikoną palety — edytor przyjmuje go od razu, żeby było widać wybór.
        expanded && color !== "default" ? colorClasses[color] : "bg-card", !expanded && "max-md:hidden",
        fullScreen && "fixed inset-0 z-50 max-w-none rounded-none border-0 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]")}>
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button key="collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-3 px-5 py-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium font-display">Zapisz notatkę...</span>
            {destination && <span className="ml-auto text-xs truncate max-w-[45%]">trafi do: {destination}</span>}
          </motion.button>
        ) : (
          <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
            {destination && <p className="text-xs text-muted-foreground">Trafi do: <span className="font-medium text-foreground">{destination}</span></p>}
            <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł"
              className="w-full bg-transparent text-lg font-display font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none" />
            <FormatToolbar onInsert={(before, after) => {
              const ta = textareaRef.current;
              if (!ta) return;
              const s = ta.selectionStart, e2 = ta.selectionEnd;
              const sel = content.slice(s, e2);
              setContent(content.slice(0, s) + before + sel + after + content.slice(e2));
            }} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} onPaste={handleContentPaste} onKeyDown={handleContentKeyDown} placeholder="Treść notatki..." rows={3}
              className="w-full max-sm:min-h-[35dvh] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none" />
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
                      className={cn("pressable inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        off ? "border-border text-muted-foreground line-through" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15")}>
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
                    <NoteImage imageRef={img} className="w-16 h-16 object-cover rounded-lg" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Usuń obrazek"
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/img:opacity-100 transition-opacity"
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
                  <Badge key={l} variant="secondary" className="text-2xs cursor-pointer" onClick={() => toggleLabel(l)}>{l} ×</Badge>
                ))}
              </div>
            )}

            {/* Reminder display */}
            {reminder && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <Bell className="w-3 h-3" />
                {formatReminderShort(reminder)}
                <button onClick={() => setReminder(null)} aria-label="Usuń przypomnienie" className="ml-1 text-muted-foreground hover:text-foreground">×</button>
              </div>
            )}

            {/* Jeden rząd narzędzi z „Zamknij” — kolory pod ikoną palety, lista zadań jako przełącznik. */}
            <div className="pt-1">
              <div className="flex items-center gap-1 flex-wrap flex-1">
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
                {/* Image upload */}
                <IconButton size="sm" onClick={() => fileInputRef.current?.click()} title="Dodaj obrazek" aria-label="Dodaj obrazek">
                  <ImagePlus className="w-4 h-4" />
                </IconButton>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                {/* Attachments: PDF, tekst, dokumenty */}
                <IconButton size="sm" onClick={() => attachmentsRef.current?.pick()} title="Dodaj plik" aria-label="Dodaj plik">
                  <Paperclip className="w-4 h-4" />
                </IconButton>
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
                        <Badge key={l} variant={labels.includes(l) ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleLabel(l)}>{l}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                        placeholder="Nowa etykieta..." className="flex-1 text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground" />
                      <IconButton size="sm" tone="primary" onClick={handleCreateLabel} aria-label="Dodaj etykietę">
                        <Plus className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Reminder picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <IconButton size="sm" tone={reminder ? "active" : "muted"} title="Przypomnienie" aria-label="Przypomnienie">
                      <Bell className={cn("w-4 h-4", reminder && "fill-current")} />
                    </IconButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 space-y-3" align="start">
                    <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Przypomnienie</p>
                    <QuickReminderInput onParsed={handleQuickReminderParsed} />
                    <Calendar mode="single" selected={reminderDate} onSelect={setReminderDate}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      className={cn("p-3 pointer-events-auto")} />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Godzina:</label>
                      <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
                        className="text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground" />
                    </div>
                    <Button size="sm" onClick={handleSetReminder} disabled={reminderTimestamp === null} className="w-full">Ustaw</Button>
                  </PopoverContent>
                </Popover>
                {/* Priority picker */}
                <PriorityPicker priority={priority} onSet={setPriority} />
                <button onClick={handleClose}
                  className="pressable ml-auto px-4 py-1.5 text-sm font-medium font-display text-primary hover:bg-primary/10 rounded-lg transition-colors shrink-0">
                  Zamknij
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

    <DrawingCanvas
      open={showDrawing}
      onOpenChange={setShowDrawing}
      onSave={(dataUrl) => {
        imageStore.putDataUrl(dataUrl)
          .then((ref) => setImages((prev) => [...prev, ref]))
          .catch(() => toast.error("Nie udało się zapisać rysunku", { description: "Brakuje miejsca w pamięci przeglądarki." }));
      }}
    />
    </>
  );
});
