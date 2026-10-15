import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, ChevronDown, ImagePlus, Loader2, MapPin, Mic, NotebookPen, Pencil, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NoteImage } from "@/components/NoteImage";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDictation } from "@/hooks/useDictation";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import { CHECKLIST, MODULES, TOPICS } from "@/lib/study/content";
import { addJournalEntry, columnOf, JOURNAL_MAX_IMAGES, setSite, useStudy, type JournalKind } from "@/lib/study/store";
import { clearJournalDraft, getJournalDraft, patchJournalDraft, setJournalDraftTopic, useJournalDraft } from "@/lib/study/draft";
import { closeJournalSheet, useJournalSheet } from "@/lib/study/entrySheet";
import { KIND_LABEL } from "@/lib/study/journalView";

export function KindIcon({ kind, className = "h-4 w-4" }: { kind: JournalKind; className?: string }) {
  if (kind === "ok") return <CheckCircle2 className={cn(className, "shrink-0 text-emerald-600")} aria-hidden />;
  if (kind === "problem") return <AlertTriangle className={cn(className, "shrink-0 text-warning")} aria-hidden />;
  return <NotebookPen className={cn(className, "shrink-0 text-muted-foreground")} aria-hidden />;
}

/** Zaznaczony rodzaj: kolor rodzaju na ramce i tle — na budowie widać go kątem oka. */
const KIND_ON: Record<JournalKind, string> = {
  ok: "border-emerald-600/70 bg-emerald-600/10",
  problem: "border-warning bg-warning/10",
  note: "border-foreground/40 bg-muted",
};

// Prośba o trwały zapis przy pierwszym zdjęciu: zdjęcia z budowy to najcięższe i najcenniejsze
// dane w przeglądarce, a Chrome chętniej przyznaje trwałość przy wyraźnym zaangażowaniu.
let persistAsked = false;

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

/**
 * Wpis z budowy w arkuszu: na telefonie od dołu (nad klawiaturą, kciukiem), na komputerze
 * z boku. Najpierw to, co na budowie robi się zawsze — rodzaj, tekst, zdjęcie; temat z listą
 * kontrolną jest zwinięty, chyba że wpis zaczyna się z karty tematu. Arkusz pokazuje szkic
 * (`draft.ts`): zamknięcie nie gubi tekstu ani zdjęć.
 */
export function JournalEntrySheet({ onPractice }: { onPractice: (topicId: string) => void }) {
  const { open, topicFirst } = useJournalSheet();
  const isMobile = useIsMobile();
  const study = useStudy();
  const draft = useJournalDraft();
  const { topic, kind, text, images } = draft;
  const checked = useMemo(() => new Set(draft.checked), [draft.checked]);
  const [processing, setProcessing] = useState(0);
  const [topicOpen, setTopicOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const online = useOnline();

  const setText = (next: string | ((prev: string) => string)) =>
    patchJournalDraft({ text: typeof next === "function" ? next(getJournalDraft().text) : next });
  // Ręce zajęte robotą: dyktowanie dopisuje rozpoznane zdanie na końcu wpisu.
  const dictation = useDictation((spoken) => {
    if (!spoken) return;
    setText((t) => (t && !/\s$/.test(t) ? `${t} ${spoken}` : `${t}${spoken}`));
  });

  useEffect(() => {
    if (!open) { setEditingSite(false); return; }
    setTopicOpen(topicFirst);
  }, [open, topicFirst]);

  const items = useMemo(() => CHECKLIST.filter((c) => c.topic === topic), [topic]);
  const current = TOPICS.find((t) => t.id === topic) ?? null;

  function toggle(id: string) {
    const prev = getJournalDraft().checked;
    patchJournalDraft({ checked: prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id] });
  }

  async function addPhotos(files: File[]) {
    let skipped = 0;
    // Miejsca liczone z góry: dwa szybkie wybory zdjęć nie przekroczą limitu wpisu.
    const room = JOURNAL_MAX_IMAGES - getJournalDraft().images.length - processing;
    if (files.length > room) toast(`Wpis mieści maksymalnie ${JOURNAL_MAX_IMAGES} zdjęcia`);
    const batch = files.slice(0, Math.max(0, room));
    if (batch.length === 0) return;
    if (!persistAsked) { persistAsked = true; void requestPersistentStorage(); }
    setProcessing((n) => n + batch.length);
    try {
      for (const file of batch) {
        try {
          const prepared = await prepareImage(file);
          if (!prepared) { skipped += 1; continue; }
          const ref = await imageStore.putBlob(prepared);
          // Szkic czytany na świeżo: w trakcie obróbki mogło zniknąć inne zdjęcie albo zmienić się tekst.
          const now = getJournalDraft().images;
          if (now.length < JOURNAL_MAX_IMAGES && !now.includes(ref)) { patchJournalDraft({ images: [...now, ref] }); haptic("tap"); }
        } finally {
          setProcessing((n) => n - 1);
        }
      }
    } catch {
      toast.error("Nie udało się zapisać zdjęcia", { description: "Brakuje miejsca w pamięci przeglądarki." });
    }
    if (skipped > 0) toast.error("Nie udało się zmniejszyć zdjęcia do 2 MB");
  }

  function submit() {
    if (processing > 0) return;
    const wasDone = topic && columnOf(study, topic) === "done";
    const entry = addJournalEntry({ kind, topic: topic || null, text, checked: [...checked], images });
    if (!entry) {
      haptic("warn");
      toast("Wpisz, co się dzieje, dodaj zdjęcie albo zaznacz sprawdzone punkty");
      textRef.current?.focus();
      return;
    }
    haptic("success");
    clearJournalDraft();
    closeJournalSheet();
    toast.success(kind === "problem" && wasDone ? "Zapisano problem — temat wraca do powtórki" : "Zapisano wpis");
  }

  const fileInput = (props: { ref: React.RefObject<HTMLInputElement>; testId: string; capture?: boolean }) => (
    <input
      ref={props.ref}
      type="file"
      accept="image/*"
      multiple={!props.capture}
      capture={props.capture ? "environment" : undefined}
      className="hidden"
      data-testid={props.testId}
      onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void addPhotos(f); }}
    />
  );

  const dictationHint = !dictation.supported
    ? "Dyktuj mikrofonem na klawiaturze telefonu."
    : !online ? "Bez internetu dyktuj mikrofonem na klawiaturze telefonu — przycisk obok działa tylko online." : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) closeJournalSheet(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("flex flex-col gap-0 overflow-hidden p-0", isMobile ? "max-h-[94dvh] rounded-t-3xl pb-0" : "w-full sm:max-w-md")}
        data-testid="journal-entry-sheet"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="shrink-0 px-5 pb-2 pt-5 text-left">
          <SheetTitle className="font-display">Wpis z budowy</SheetTitle>
          <SheetDescription className="sr-only">Rodzaj, opis, zdjęcia i temat z materiału. Szkic zostaje po zamknięciu.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4">
          {editingSite ? (
            <label className="block space-y-1 text-xs text-muted-foreground">
              Inwestycja / adres
              <input
                autoFocus
                value={study.site}
                onChange={(e) => setSite(e.target.value)}
                onBlur={() => setEditingSite(false)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditingSite(false); } }}
                placeholder="np. Dom Kowalskich, ul. Leśna 4"
                enterKeyHint="done"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setEditingSite(true)}
              aria-label={study.site ? `Budowa: ${study.site}. Zmień` : "Dodaj budowę"}
              className="pressable inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm coarse:min-h-11"
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
              <span className={cn("truncate", !study.site && "text-muted-foreground")}>{study.site || "Dodaj budowę"}</span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          )}

          <div role="radiogroup" aria-label="Rodzaj wpisu" className="grid grid-cols-3 gap-2">
            {(Object.keys(KIND_LABEL) as JournalKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => { haptic("selection"); patchJournalDraft({ kind: k }); }}
                className={cn(
                  "pressable flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2.5 text-sm transition-colors duration-fast coarse:min-h-16",
                  kind === k ? cn(KIND_ON[k], "font-semibold text-foreground") : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <KindIcon kind={k} className="h-5 w-5" />
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="block space-y-1 text-xs text-muted-foreground">
              Co się dzieje?
              <span className="relative block">
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
                  rows={4}
                  placeholder={kind === "problem" ? "Co poszło nie tak i co z tym zrobisz?" : "Krótko: gdzie, co zrobione, co zauważyłeś"}
                  className={cn(
                    "w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-ring",
                    dictation.supported && "pr-14",
                  )}
                />
                {dictation.supported && (
                  <button
                    type="button"
                    onClick={() => { haptic("tap"); dictation.toggle(); }}
                    aria-pressed={dictation.listening}
                    aria-label={dictation.listening ? "Zakończ dyktowanie" : "Dyktuj"}
                    title={dictation.listening ? "Zakończ dyktowanie" : "Dyktuj wpis"}
                    className={cn(
                      "absolute right-1.5 top-1.5 grid h-10 w-10 place-items-center rounded-full transition-colors coarse:h-12 coarse:w-12",
                      dictation.listening ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Mic className={cn("h-5 w-5", dictation.listening && "animate-pulse")} />
                  </button>
                )}
              </span>
            </label>
            {dictationHint && <p className="hidden text-xs text-muted-foreground coarse:block" data-testid="dictation-hint">{dictationHint}</p>}
          </div>

          <div className="space-y-2">
            {fileInput({ ref: cameraRef, testId: "journal-camera-input", capture: true })}
            {fileInput({ ref: galleryRef, testId: "journal-photo-input" })}
            <div className="flex gap-2 coarse:grid coarse:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()} className="hidden coarse:inline-flex coarse:h-12">
                <Camera className="mr-1.5 h-5 w-5" />Aparat
              </Button>
              <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()} className="coarse:h-12">
                <ImagePlus className="mr-1.5 h-4 w-4 coarse:h-5 coarse:w-5" /><span className="coarse:hidden">Dodaj zdjęcie</span><span className="hidden coarse:inline">Galeria</span>
              </Button>
            </div>
            {(images.length > 0 || processing > 0) && (
              <ul className="flex flex-wrap gap-2" aria-label="Zdjęcia we wpisie">
                {images.map((ref) => (
                  <li key={ref} className="relative">
                    <NoteImage imageRef={ref} alt="Zdjęcie z budowy" className="h-20 w-20 rounded-lg object-cover" placeholderClassName="h-20 w-20 rounded-lg" />
                    <button
                      type="button"
                      onClick={() => patchJournalDraft({ images: getJournalDraft().images.filter((r) => r !== ref) })}
                      aria-label="Usuń zdjęcie z wpisu"
                      className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground coarse:h-8 coarse:w-8"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
                {Array.from({ length: processing }, (_, i) => (
                  <li key={`processing-${i}`} className="grid h-20 w-20 place-items-center rounded-lg bg-muted" data-testid="journal-photo-processing">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                    <span className="sr-only">Przygotowuję zdjęcie</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border">
            <button
              type="button"
              aria-expanded={topicOpen}
              aria-controls="journal-topic"
              onClick={() => setTopicOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm coarse:min-h-12"
            >
              <span className="text-muted-foreground">Temat:</span>
              <span className="min-w-0 flex-1 truncate font-medium">{current?.title ?? "Ogólnie"}</span>
              {checked.size > 0 && <span className="font-mono text-xs tabular-nums text-muted-foreground">{checked.size}/{items.length}</span>}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast", topicOpen && "rotate-180")} aria-hidden />
            </button>
            {topicOpen && (
              <div id="journal-topic" className="space-y-3 border-t border-border p-3" data-testid="journal-topic-panel">
                <label className="block space-y-1 text-xs text-muted-foreground">
                  Czego dotyczy
                  <select
                    value={topic}
                    onChange={(e) => setJournalDraftTopic(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Ogólnie (bez tematu)</option>
                    {MODULES.map((m) => (
                      <optgroup key={m.id} label={m.label}>
                        {TOPICS.filter((t) => t.module === m.id).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                {current && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm leading-snug text-muted-foreground">{current.summary}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => { closeJournalSheet(); onPractice(current.id); }}>
                        <Play className="mr-1.5 h-3.5 w-3.5" />Ćwicz pytania
                      </Button>
                    </div>
                    <p className="text-xs font-medium text-foreground">Sprawdź przed przejściem dalej</p>
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-start gap-2.5">
                          <Checkbox id={`journal-${item.id}`} checked={checked.has(item.id)} onCheckedChange={() => toggle(item.id)} className="mt-0.5" />
                          <label htmlFor={`journal-${item.id}`} className="cursor-pointer text-sm leading-snug">
                            {item.critical && <span className="mr-1 text-warning" aria-label="Punkt krytyczny">⚠</span>}
                            {item.text}
                            {item.risk && <span className="mt-0.5 block text-xs text-muted-foreground">Ryzyko: {item.risk.replace(/^[^=]*= ?/, "")}</span>}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Przycisk poza przewijaną treścią: z klawiaturą na ekranie (`resizes-content`) wisi tuż nad nią. */}
        <div className="shrink-0 border-t border-border bg-background px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <Button onClick={submit} disabled={processing > 0} className="h-12 w-full text-base">
            {processing > 0 ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />Przygotowuję zdjęcia…</> : "Zapisz wpis"}
          </Button>
          <p className="mt-1.5 text-center text-xs text-muted-foreground coarse:hidden">Ctrl+Enter zapisuje wpis</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
