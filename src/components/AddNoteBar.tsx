import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Tag, Bell, ImagePlus, Wand2, X, PenTool, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ColorPicker } from "./ColorPicker";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NoteColor, ChecklistItem } from "@/hooks/useNotes";
import { fileToBase64 } from "@/hooks/useNotes";
import { DrawingCanvas } from "./DrawingCanvas";
import { ChecklistEditor } from "./ChecklistEditor";
import { FormatToolbar } from "./MarkdownRenderer";
import { PriorityPicker } from "./PriorityPicker";
import type { NotePriority } from "@/lib/notePriority";
import { parseNaturalDate } from "@/lib/parseNaturalDate";

interface AddNoteBarProps {
  onAdd: (title: string, content: string, color: NoteColor, labels: string[], reminder: number | null, images: string[], checklist: ChecklistItem[], priority: NotePriority) => void;
  allLabels: string[];
  onCreateLabel: (label: string) => void;
}

export const AddNoteBar = forwardRef<{ expand: () => void }, AddNoteBarProps>(function AddNoteBar({ onAdd, allLabels, onCreateLabel }, ref) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<NoteColor>("default");
  const [labels, setLabels] = useState<string[]>([]);
  const [reminder, setReminder] = useState<number | null>(null);
  const [priority, setPriority] = useState<NotePriority>("none");
  const [reminderDate, setReminderDate] = useState<Date | undefined>();
  const [reminderTime, setReminderTime] = useState("09:00");
  const [quickReminderText, setQuickReminderText] = useState("");
  const [quickReminderError, setQuickReminderError] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ expand: () => setExpanded(true) }));

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
  }, [expanded, title, content, color, labels, reminder, images]);

  function handleClose() {
    if (title.trim() || content.trim() || images.length > 0 || checklist.length > 0) {
      onAdd(title.trim(), content.trim(), color, labels, reminder, images, checklist, priority);
    }
    reset();
  }

  function reset() {
    setTitle(""); setContent(""); setColor("default"); setLabels([]); setReminder(null); setReminderDate(undefined); setReminderTime("09:00"); setPriority("none"); setImages([]); setChecklist([]); setShowChecklist(false); setExpanded(false);
  }

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

  function handleSetReminder() {
    if (reminderDate) {
      const [h, m] = reminderTime.split(":").map(Number);
      const d = new Date(reminderDate);
      d.setHours(h, m, 0, 0);
      setReminder(d.getTime());
    }
  }

  function handleQuickReminderParse() {
    const parsed = parseNaturalDate(quickReminderText);
    if (!parsed) {
      setQuickReminderError(true);
      return;
    }
    setQuickReminderError(false);
    setReminderDate(parsed);
    setReminderTime(format(parsed, "HH:mm"));
    setQuickReminderText("");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 2 * 1024 * 1024) continue;
      const base64 = await fileToBase64(file);
      setImages((prev) => [...prev, base64]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <>
    <motion.div ref={containerRef} layout className="w-full max-w-xl mx-auto rounded-2xl note-shadow bg-card border border-border overflow-hidden transition-shadow focus-ring-gradient hover:shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.25)]">
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button key="collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-3 px-5 py-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium font-display">Zapisz notatkę...</span>
          </motion.button>
        ) : (
          <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
            <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł"
              className="w-full bg-transparent text-lg font-display font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none" />
            <FormatToolbar onInsert={(before, after) => {
              const ta = textareaRef.current;
              if (!ta) return;
              const s = ta.selectionStart, e2 = ta.selectionEnd;
              const sel = content.slice(s, e2);
              setContent(content.slice(0, s) + before + sel + after + content.slice(e2));
            }} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Zapisz notatkę (obsługuje **Markdown**)..." rows={3}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none" />

            {/* Checklist */}
            <button
              onClick={() => setShowChecklist(!showChecklist)}
              className={cn("flex items-center gap-1.5 text-xs transition-colors", showChecklist ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              <ListChecks className="w-3.5 h-3.5" />
              {showChecklist ? "Lista zadań" : "Dodaj listę"}
            </button>
            {showChecklist && <ChecklistEditor items={checklist} onChange={setChecklist} />}

            {/* Image previews */}
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative group/img">
                    <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/img:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Labels display */}
            {labels.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {labels.map((l) => (
                  <Badge key={l} variant="secondary" className="text-[10px] cursor-pointer" onClick={() => toggleLabel(l)}>{l} ×</Badge>
                ))}
              </div>
            )}

            {/* Reminder display */}
            {reminder && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <Bell className="w-3 h-3" />
                {format(new Date(reminder), "d MMM, HH:mm", { locale: pl })}
                <button onClick={() => setReminder(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 gap-2">
              <div className="flex items-center gap-1 flex-wrap flex-1">
                <ColorPicker selected={color} onSelect={setColor} />
                {/* Image upload */}
                <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5" title="Dodaj obrazek">
                  <ImagePlus className="w-4 h-4" />
                </motion.button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                {/* Drawing */}
                <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowDrawing(true)}
                  className="p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5" title="Rysuj">
                  <PenTool className="w-4 h-4" />
                </motion.button>
                {/* Label picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} className="p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5" title="Etykiety">
                      <Tag className="w-4 h-4" />
                    </motion.button>
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
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleCreateLabel} className="p-1.5 rounded-lg bg-primary text-primary-foreground">
                        <Plus className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Reminder picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} className={cn("p-1.5 rounded-full hover:bg-foreground/5", reminder ? "text-primary" : "text-muted-foreground")} title="Przypomnienie">
                      <Bell className={cn("w-4 h-4", reminder && "fill-current")} />
                    </motion.button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 space-y-3" align="start">
                    <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Przypomnienie</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={quickReminderText}
                          onChange={(e) => { setQuickReminderText(e.target.value); setQuickReminderError(false); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleQuickReminderParse(); } }}
                          placeholder="np. jutro 15:00, za 2h"
                          className={cn(
                            "flex-1 text-xs bg-muted/60 border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/70",
                            quickReminderError ? "border-destructive" : "border-border"
                          )}
                        />
                        <Button size="sm" variant="outline" className="px-2" onClick={handleQuickReminderParse} title="Rozpoznaj datę">
                          <Wand2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {quickReminderError && (
                        <p className="text-[10px] text-destructive">Nie rozpoznano daty. Spróbuj np. "jutro 15:00" lub "za 2h".</p>
                      )}
                    </div>
                    <Calendar mode="single" selected={reminderDate} onSelect={setReminderDate}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      className={cn("p-3 pointer-events-auto")} />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Godzina:</label>
                      <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
                        className="text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground" />
                    </div>
                    <Button size="sm" onClick={handleSetReminder} disabled={!reminderDate} className="w-full">Ustaw</Button>
                  </PopoverContent>
                </Popover>
                {/* Priority picker */}
                <PriorityPicker priority={priority} onSet={setPriority} />
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleClose}
                className="px-4 py-1.5 text-sm font-medium font-display text-primary hover:bg-primary/10 rounded-lg transition-colors shrink-0">
                Zamknij
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    <DrawingCanvas
      open={showDrawing}
      onOpenChange={setShowDrawing}
      onSave={(dataUrl) => setImages((prev) => [...prev, dataUrl])}
    />
    </>
  );
});
