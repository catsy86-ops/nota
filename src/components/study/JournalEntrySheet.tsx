import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { TriangleAlert, Camera, CircleCheck, ChevronDown, Clock, ImagePlus, ListChecks, LoaderCircle, LocateFixed, MapPin, Mic, NotebookPen, Pencil, PenTool, Play, Trash, Type, X } from "lucide-react";
import { formatFileSize } from "@/lib/attachments";
import { addRecording } from "@/lib/study/recordings";
import { JOURNAL_MAX_RECORDINGS } from "@/lib/study/yStudy";
import { HeightsButton } from "./HeightsSheet";
import { PressureTestFields } from "./PressureTestFields";
import { FittingsFields } from "./FittingsFields";
import { TEST_TOPICS } from "@/lib/study/pressureTest";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NoteImage } from "@/components/NoteImage";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { toastWithUndo } from "@/lib/undoToast";
import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import { haptic } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDictation } from "@/hooks/useDictation";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import { CAPTION_MAX, captionPhoto, captionText } from "@/lib/study/photoCaption";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import { MODULES, TOPICS } from "@/lib/study/content";
import { addJournalEntry, columnOf, JOURNAL_MAX_IMAGES, removeJournalEntry, restoreJournalEntry, setSite, setSiteGeo, setSiteShortages, setSiteStages, updateJournalEntry, useSiteDirectory, useStudy, useStudyLists, type JournalKind } from "@/lib/study/store";
import { clearJournalDraft, EMPTY_DRAFT, getJournalDraft, patchJournalDraft, useJournalDraft, type JournalDraft } from "@/lib/study/draft";
import { closeJournalSheet, getJournalEditForm, patchJournalEditForm, takeVoiceRequest, useJournalEditForm, useJournalSheet } from "@/lib/study/entrySheet";
import { fromLocalInput, KIND_LABEL, recentSiteTexts, suggestSites, toLocalInput, whenLabel, yesterdaySiteText } from "@/lib/study/journalView";
import { findSiteByName } from "@/lib/study/sites";
import { accuracyLabel, cleanGeo, mapsUrl, nearestSite } from "@/lib/study/geo";
import { fittingsLine, suggestFittingNames } from "@/lib/study/fittings";
import { mergeFittings } from "@/lib/study/spokenFittings";
import { addShortagesFromDictation, SHORTAGES_MAX } from "@/lib/study/shortages";
import { editDemotesTopic, editSavedMessage, newEntryMessage, shouldOfferSiteGeo } from "@/lib/study/entrySheetRules";
import { parseSpokenEntry } from "@/lib/study/spokenEntry";
import { matchStage, siteStages, toggleStage } from "@/lib/study/stages";

export function KindIcon({ kind, className = "h-4 w-4" }: { kind: JournalKind; className?: string }) {
  if (kind === "ok") return <CircleCheck className={cn(className, "shrink-0 text-success-ink")} aria-hidden />;
  if (kind === "problem") return <TriangleAlert className={cn(className, "shrink-0 text-warning-ink")} aria-hidden />;
  return <NotebookPen className={cn(className, "shrink-0 text-muted-foreground")} aria-hidden />;
}

/** Zaznaczony rodzaj: kolor rodzaju na ramce i tle — na budowie widać go kątem oka. */
const KIND_ON: Record<JournalKind, string> = {
  ok: "border-success-ink/70 bg-success/10",
  problem: "border-warning bg-warning/10",
  note: "border-foreground/40 bg-muted",
};

// Prośba o trwały zapis przy pierwszym zdjęciu: zdjęcia z budowy to najcięższe i najcenniejsze
// dane w przeglądarce, a Chrome chętniej przyznaje trwałość przy wyraźnym zaangażowaniu.
let persistAsked = false;

/** Pola wspólne dla szkicu nowego wpisu i edycji zapisanego. */
type FormFields = Pick<JournalDraft, "topic" | "kind" | "text" | "checked" | "images" | "recordings" | "test" | "fittings" | "stage" | "geo">;

/** Odtwarzacz i nagrywanie leniwie, poza główną paczką (jak w notatkach). */
const VoiceRecorder = lazy(() => import("@/components/VoiceAttachmentParts").then((m) => ({ default: m.VoiceRecorder })));
const AudioPreview = lazy(() => import("@/components/VoiceAttachmentParts").then((m) => ({ default: m.AudioPreview })));

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
 * kontrolną jest zwinięty, chyba że wpis zaczyna się z karty tematu. Nowy wpis to szkic
 * (`draft.ts`): zamknięcie nie gubi tekstu ani zdjęć. Ten sam arkusz poprawia zapisany wpis
 * (`openJournalEdit`) — wtedy na formularzu edycji, a w stopce jest też „Usuń”.
 */
export function JournalEntrySheet({ onPractice }: { onPractice: (topicId: string) => void }) {
  // Fokus po otwarciu idzie na tytuł, nie na pole tekstu: na telefonie pole od razu wywołałoby klawiaturę.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { open, topicFirst, editing } = useJournalSheet();
  const isMobile = useIsMobile();
  const study = useStudy();
  const draft = useJournalDraft();
  const editForm = useJournalEditForm();
  const isEdit = editing !== null && editForm !== null;
  const form: FormFields = isEdit ? editForm : draft;
  const { topic, kind, text, images, recordings } = form;
  const checked = useMemo(() => new Set(form.checked), [form.checked]);
  // Czytane na świeżo (zdjęcia obrabiają się asynchronicznie); edycja zamknięta w trakcie → pusty formularz.
  const getForm = (): FormFields => (isEdit ? getJournalEditForm() ?? EMPTY_DRAFT : getJournalDraft());
  const patch: (p: Partial<FormFields>) => void = isEdit ? patchJournalEditForm : patchJournalDraft;
  const site = isEdit ? editForm.site : study.site;
  /** Moment wpisu; `null` = chwila zapisu (tylko nowy wpis). */
  const at = isEdit ? editForm.at : draft.at;
  const [processing, setProcessing] = useState(0);
  /** Kształtki z poprzednich wpisów — podpowiedzi nazw. */
  const fittingHistory = useMemo(() => study.journal.map((e) => e.fittings), [study.journal]);
  /** Zdjęcie, któremu wpisujesz podpis („przed zakryciem”); `null` = pole schowane. */
  const [captioning, setCaptioning] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [topicOpen, setTopicOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(false);
  /** Budowa w chwili otwarcia pola — dopóki jej nie zmienisz, pigułki pokazują wszystkie ostatnie. */
  const [siteAtOpen, setSiteAtOpen] = useState("");
  /** Tekst pola budowy w trakcie pisania — do Yjs (albo formularza edycji) trafia dopiero przy zatwierdzeniu. */
  const [siteText, setSiteText] = useState("");
  /** Niezatwierdzona budowa i tryb, w którym ją wpisano; `null` = pole zamknięte albo już zapisane. */
  const pendingSite = useRef<{ text: string; edit: boolean } | null>(null);
  const [editingWhen, setEditingWhen] = useState(false);
  /** Nagrywanie w toku (pasek z licznikiem zamiast przycisku); nagranie trafia do załączników wpisu. */
  const [recording, setRecording] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const online = useOnline();

  const setText = (next: string | ((prev: string) => string)) =>
    patch({ text: typeof next === "function" ? next(getForm().text) : next });

  useEffect(() => {
    // Arkusz zamknięty albo przełączony w trakcie pisania budowy: nowy wpis zachowuje wpisaną budowę
    // (jak szkic), a niezapisana poprawka wpisu przepada razem z całą edycją.
    const pending = pendingSite.current;
    pendingSite.current = null;
    if (pending && !pending.edit) setSite(pending.text);
    setEditingSite(false);
    setEditingWhen(false);
    if (open) setTopicOpen(topicFirst);
  }, [open, topicFirst, editing]);

  const dir = useSiteDirectory();
  const recentSites = useMemo(() => dir.filter((s) => s.archived === undefined).map((s) => s.name), [dir]);
  /** Id budowy wybranej w polu (`""` = bez budowy albo nieznana nazwa) — dla podpowiedzi tekstu. */
  const siteCard = useMemo(() => findSiteByName(dir, site), [dir, site]);
  const siteId = siteCard?.id ?? "";
  /** Najbliższe nieodhaczone etapy budowy — przy „Zrobione” do odhaczenia jednym stuknięciem. */
  const nextStages = useMemo(() => (siteCard ? siteStages(siteCard).filter((s) => s.done === undefined).slice(0, 3) : []), [siteCard]);

  /** Etap zamknięty tym wpisem (nazwa z karty); `null` = bez etapu albo etap usunięty z karty. */
  const entryStage = form.stage && siteCard ? siteStages(siteCard).find((s) => s.id === form.stage) ?? null : null;

  /** Odhacza etap w karcie od razu i przypina do niego wpis (jego zdjęcia idą do protokołu przy etapie). */
  function markStage(id: string) {
    if (!siteCard) return;
    const before = siteStages(siteCard);
    const after = toggleStage(before, id, Date.now());
    const label = before.find((s) => s.id === id)?.name ?? "etap";
    haptic("success");
    setSiteStages(siteCard.id, after, before);
    patch({ stage: id });
    toastWithUndo(`Etap zrobiony: ${label}`, () => {
      setSiteStages(siteCard.id, before, after);
      if (getForm().stage === id) patch({ stage: null });
    });
  }
  /** Podpowiedzi tekstu tylko dla nowego, pustego wpisu z wybraną budową. */
  const textSuggestions = useMemo(() => (isEdit ? [] : recentSiteTexts(study.journal, siteId)), [isEdit, study.journal, siteId]);
  const yesterdayText = useMemo(() => (isEdit ? null : yesterdaySiteText(study.journal, siteId)), [isEdit, study.journal, siteId]);
  const siteChips = editingSite
    ? suggestSites(recentSites, siteText === siteAtOpen ? "" : siteText, siteText)
    : !site ? suggestSites(recentSites, "", "", 3) : [];

  function openSiteEditor() {
    setSiteAtOpen(site);
    setSiteText(site);
    pendingSite.current = { text: site, edit: isEdit };
    setEditingSite(true);
  }

  function writeSite(next: string) {
    pendingSite.current = null;
    if (isEdit) patchJournalEditForm({ site: next }); else if (next !== study.site) setSite(next);
  }

  /** Zatwierdza wpisaną budowę (blur, Enter, zapis wpisu) — jeden zapis zamiast zapisu przy każdym klawiszu. */
  function commitSite() {
    if (pendingSite.current) writeSite(pendingSite.current.text);
    setEditingSite(false);
  }

  function pickSite(next: string) {
    writeSite(next);
    haptic("selection");
    setEditingSite(false);
  }

  // „Tu jestem”: pozycja tylko po stuknięciu, nigdy w tle; widać ją w aplikacji, raport jej nie zawiera.
  const [locating, setLocating] = useState(false);
  const geo = form.geo ?? null;
  /** Budowa z zapisaną lokalizacją w promieniu 300 m — jeden dotyk zamiast wybierania. */
  const nearby = useMemo(() => (geo ? nearestSite(dir, geo) : null), [geo, dir]);
  function locate() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast.error("Ta przeglądarka nie udostępnia lokalizacji");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const g = cleanGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        if (!g) return;
        patch({ geo: g });
        haptic("success");
      },
      (err) => {
        setLocating(false);
        haptic("warn");
        toast.error(err.code === err.PERMISSION_DENIED
          ? "Brak zgody na lokalizację — włącz ją w ustawieniach przeglądarki"
          : "Nie udało się ustalić lokalizacji — spróbuj bliżej okna albo na zewnątrz");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  /** Nazwy kształtek do dopasowania dyktowania (historia i podpowiedzi). */
  const knownFittings = useMemo(() => suggestFittingNames(fittingHistory, []), [fittingHistory]);
  // Ręce zajęte robotą: dyktowanie dopisuje rozpoznane zdanie na końcu wpisu. Gdy w wypowiedzi padnie
  // budowa, rodzaj albo kształtki („Lipowa, problem, przeciek przy trójniku, kolano 16 cztery sztuki”),
  // trafiają do swoich pól, a do tekstu idzie reszta (`spokenEntry.ts`).
  const dictation = useDictation((spoken) => {
    if (!spoken) return;
    const append = (part: string) => {
      if (part) setText((t) => (t && !/\s$/.test(t) ? `${t} ${part}` : `${t}${part}`));
    };
    const parsed = parseSpokenEntry(spoken, { sites: recentSites, fittings: knownFittings });
    if (!parsed.structured) { append(spoken); return; }
    const done: string[] = [];
    if (parsed.site) { if (parsed.site !== site) pickSite(parsed.site); done.push(`budowa ${parsed.site}`); }
    if (parsed.kind) { patch({ kind: parsed.kind }); done.push(KIND_LABEL[parsed.kind]); }
    if (parsed.fittings.length > 0) {
      patch({ fittings: mergeFittings(getForm().fittings ?? [], parsed.fittings) });
      done.push(`kształtki: ${fittingsLine(parsed.fittings)}`);
    }
    const name = parsed.site ?? site;
    const card = name ? findSiteByName(dir, name) : undefined;
    // „etap próba szczelności zrobiony” — odhacza etap w karcie budowy (już odhaczony zostaje z pierwszą datą).
    if (parsed.stage) {
      const stages = siteStages(card);
      const hit = card ? matchStage(stages, parsed.stage) : null;
      if (!card || !hit) {
        toast.error(card ? `Nie ma takiego etapu: „${parsed.stage}”` : "Etapy są w karcie budowy", {
          description: card ? "Powiedz nazwę jak na liście etapów, np. „etap próba szczelności zrobiony”." : "Najpierw wybierz budowę wpisu albo powiedz jej nazwę na początku.",
        });
      } else {
        if (hit.done === undefined) setSiteStages(card.id, toggleStage(stages, hit.id, Date.now()), stages);
        patch({ stage: hit.id });
        done.push(`etap zrobiony: ${hit.name}`);
      }
    }
    // „brakuje …” — braki idą od razu do karty budowy (wskazanej w wypowiedzi albo bieżącej), nie do wpisu.
    // Bez budowy braki się nie zapiszą, ale treść wpisu ma się dopisać — błąd pokazujemy dopiero po niej.
    let shortageError = false;
    if (parsed.shortages.length > 0 && !card) shortageError = true;
    else if (parsed.shortages.length > 0 && card) {
      const now = Date.now();
      const base = card.shortages ?? [];
      // Pełna lista (SHORTAGES_MAX) odrzuca nowe pozycje — helper liczy je, żeby komunikat mówił prawdę.
      const { list: result, rejected } = addShortagesFromDictation(base, parsed.shortages, now);
      setSiteShortages(card.id, result, base);
      if (rejected > 0) toast.error(`Nie dodano ${rejected} ${rejected === 1 ? "braku" : "braków"}: lista braków budowy jest pełna (${SHORTAGES_MAX})`, { id: "entry-dictation-full" });
      done.push(`braki (${card.name}): ${parsed.shortages.map((x) => (x.qty ? `${x.text} ${x.qty}` : x.text)).join(", ")}`);
    }
    append(parsed.text);
    if (shortageError) toast.error("Braki zapisują się w karcie budowy", { description: "Najpierw wybierz budowę wpisu albo powiedz jej nazwę na początku.", id: "entry-dictation" });
    else toast.success(`Z wypowiedzi: ${done.join(" · ")}`, { id: "entry-dictation" });
  });
  // Skrót „Wpis głosowy” (`?wpis=1&glos=1`): arkusz otwarty z żądaniem startuje dyktowanie od razu.
  // Bez zgody na usługę mowy pokaże się zwykłe pytanie o zgodę — zgodę zawsze daje kliknięcie.
  const { supported: dictationSupported, toggle: toggleDictation } = dictation;
  useEffect(() => {
    if (!open) return;
    const voice = takeVoiceRequest();
    if (voice && dictationSupported) toggleDictation();
  }, [open, dictationSupported, toggleDictation]);

  const lists = useStudyLists();
  const items = useMemo(() => lists.checklist.filter((c) => c.topic === topic), [lists, topic]);
  const current = TOPICS.find((t) => t.id === topic) ?? null;

  function toggle(id: string) {
    const prev = getForm().checked;
    patch({ checked: prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id] });
  }

  /** Inny temat = inna lista kontrolna, więc zaznaczone punkty się zerują; tekst i zdjęcia zostają. */
  function setTopic(next: string) {
    if (next !== getForm().topic) patch({ topic: next, checked: [] });
  }

  function setAt(next: number | null) {
    if (isEdit) patchJournalEditForm({ at: next ?? Date.now() });
    else patchJournalDraft({ at: next });
  }

  /**
   * Wtapia podpis (tekst + data wpisu) w zdjęcie i podmienia je we wpisie na nowe —
   * opis jedzie z plikiem do szefa i inwestora. Oryginał zostaje w magazynie do odśmiecenia.
   */
  async function burnCaption(ref: string) {
    setProcessing((n) => n + 1);
    try {
      const rec = await imageStore.get(ref);
      const out = rec ? await captionPhoto(new Blob([rec.bytes], { type: rec.type }), captionText(captionDraft, at ?? Date.now())) : null;
      const fitted = out ? await prepareImage(new File([out], "podpis.jpg", { type: "image/jpeg" })) : null;
      if (!fitted) { toast.error("Nie udało się dodać podpisu do zdjęcia"); return; }
      const next = await imageStore.putBlob(fitted);
      const now = getForm().images;
      if (now.includes(ref)) patch({ images: now.map((r) => (r === ref ? next : r)) });
      haptic("success");
      setCaptioning(null);
      setCaptionDraft("");
    } catch {
      toast.error("Nie udało się zapisać zdjęcia", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare zdjęcia albo zrób kopię zapasową i spróbuj ponownie." });
    } finally {
      setProcessing((n) => n - 1);
    }
  }

  /** Zdjęcie otwarte do rysowania (strzałka, wymiar „przed zakryciem”); `null` = płótno zamknięte. */
  const [drawing, setDrawing] = useState<{ ref: string; url: string } | null>(null);
  useEffect(() => () => { if (drawing) URL.revokeObjectURL(drawing.url); }, [drawing]);

  async function openDrawing(ref: string) {
    const rec = await imageStore.get(ref);
    if (!rec) { toast.error("Tego zdjęcia nie ma na tym urządzeniu"); return; }
    setDrawing({ ref, url: URL.createObjectURL(new Blob([rec.bytes], { type: rec.type })) });
  }

  /** Rysunek na zdjęciu podmienia zdjęcie we wpisie (jak podpis) — oryginał zostaje do odśmiecenia. */
  async function saveDrawing(dataUrl: string) {
    const ref = drawing?.ref;
    if (!ref) return;
    setProcessing((n) => n + 1);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fitted = await prepareImage(new File([blob], "rysunek.jpg", { type: blob.type || "image/jpeg" }));
      if (!fitted) { toast.error("Nie udało się zapisać rysunku na zdjęciu"); return; }
      const next = await imageStore.putBlob(fitted);
      const now = getForm().images;
      if (now.includes(ref)) patch({ images: now.map((r) => (r === ref ? next : r)) });
      haptic("success");
    } catch {
      toast.error("Nie udało się zapisać zdjęcia", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare zdjęcia albo zrób kopię zapasową i spróbuj ponownie." });
    } finally {
      setProcessing((n) => n - 1);
    }
  }

  async function addPhotos(files: File[]) {
    let skipped = 0;
    // Miejsca liczone z góry: dwa szybkie wybory zdjęć nie przekroczą limitu wpisu.
    const room = JOURNAL_MAX_IMAGES - getForm().images.length - processing;
    if (files.length > room) toast(`Wpis mieści maksymalnie ${JOURNAL_MAX_IMAGES} ${pluralPl(JOURNAL_MAX_IMAGES, ["zdjęcie", "zdjęcia", "zdjęć"])}`);
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
          const now = getForm().images;
          if (now.length < JOURNAL_MAX_IMAGES && !now.includes(ref)) { patch({ images: [...now, ref] }); haptic("tap"); }
        } finally {
          setProcessing((n) => n - 1);
        }
      }
    } catch {
      toast.error("Nie udało się zapisać zdjęcia", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare zdjęcia albo zrób kopię zapasową i spróbuj ponownie." });
    }
    if (skipped > 0) toast.error("Nie udało się zmniejszyć zdjęcia do 2 MB");
  }

  function submit() {
    if (processing > 0) return;
    commitSite();
    if (isEdit) { saveEdit(); return; }
    const wasDone = topic && columnOf(study, topic) === "done";
    const entry = addJournalEntry({ kind, topic: topic || null, text, checked: [...checked], images, recordings: form.recordings, at, test: form.test, fittings: form.fittings, stage: form.stage, geo: form.geo ?? null });
    if (!entry) {
      haptic("warn");
      toast("Wpisz, co się dzieje, dodaj zdjęcie albo zaznacz sprawdzone punkty");
      textRef.current?.focus();
      return;
    }
    haptic("success");
    clearJournalDraft();
    closeJournalSheet();
    const message = newEntryMessage(kind, !!wasDone);
    // Nowa budowa ma kartę dopiero po zapisie — lokalizację budowy proponujemy w toaście, jawnie.
    const savedGeo = form.geo ?? null;
    const siteForGeo = entry.siteId;
    if (savedGeo && siteForGeo && shouldOfferSiteGeo(savedGeo, siteForGeo, !!siteCard?.geo)) {
      toast.success(message, {
        action: { label: "Zapisz lokalizację budowy", onClick: () => { setSiteGeo(siteForGeo, savedGeo); toast.success(`Zapisano lokalizację budowy „${entry.site}”`); } },
      });
    } else {
      toast.success(message);
    }
  }

  function saveEdit() {
    const f = getJournalEditForm();
    if (!f) return;
    const prev = study.journal.find((e) => e.id === f.id);
    const demotes = editDemotesTopic({ kind: f.kind, topic: f.topic }, prev, !!f.topic && columnOf(study, f.topic) === "done");
    const saved = updateJournalEntry(f.id, {
      kind: f.kind, topic: f.topic || null, text: f.text, checked: f.checked, images: f.images, recordings: f.recordings, at: f.at, site: f.site, resolved: f.resolved, test: f.test, fittings: f.fittings, stage: f.stage, geo: f.geo ?? null,
    });
    if (!saved) {
      haptic("warn");
      toast("Wpis nie może być pusty — opisz, co się dzieje, albo usuń wpis");
      textRef.current?.focus();
      return;
    }
    haptic("success");
    closeJournalSheet();
    toast.success(editSavedMessage(demotes));
  }

  function remove() {
    if (!editing) return;
    const entry = removeJournalEntry(editing);
    closeJournalSheet();
    if (entry) toastWithUndo("Usunięto wpis", () => restoreJournalEntry(entry), { id: "journal-removed" });
  }

  /** Gotowe nagranie z `VoiceRecorder`: przypinamy do szkicu albo edytowanego wpisu. */
  async function addRecordingFile(file: File) {
    const { added, message } = await addRecording(file, getForm().recordings);
    if (added) {
      patch({ recordings: [...getForm().recordings, added] });
      haptic("success");
    }
    if (message) toast.error(message);
  }

  const fileInput = (props: { ref: React.RefObject<HTMLInputElement | null>; testId: string; capture?: boolean }) => (
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

  /** Ostatnie budowy: jeden dotyk zamiast pisania adresu na rusztowaniu. */
  const siteChipsRow = siteChips.length > 0 && (
    <div className="flex w-full flex-wrap gap-1.5" role="group" aria-label="Ostatnie budowy" data-testid="journal-site-chips">
      {siteChips.map((s) => (
        <button
          key={s}
          type="button"
          // Bez utraty fokusu: pole nie zamyka się przed kliknięciem pigułki.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => pickSite(s)}
          className="pressable inline-flex max-w-full items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground coarse:min-h-11 coarse:px-3 coarse:text-sm"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{s}</span>
        </button>
      ))}
    </div>
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
        onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus(); }}
      >
        <SheetHeader className="shrink-0 px-5 pb-2 pt-5 text-left">
          <SheetTitle ref={titleRef} tabIndex={-1} className="font-display outline-hidden">{isEdit ? "Edytuj wpis" : "Wpis z budowy"}</SheetTitle>
          <SheetDescription className="sr-only">
            {isEdit ? "Popraw rodzaj, opis, zdjęcia, temat albo datę wpisu." : "Rodzaj, opis, zdjęcia i temat z materiału. Szkic zostaje po zamknięciu."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4">
          <div className="flex flex-wrap gap-2">
            {editingSite ? (
              <label className="block w-full space-y-1 text-xs text-muted-foreground">
                Inwestycja / adres
                <input
                  autoFocus
                  value={siteText}
                  onChange={(e) => { setSiteText(e.target.value); pendingSite.current = { text: e.target.value, edit: isEdit }; }}
                  onBlur={commitSite}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitSite(); } }}
                  placeholder="np. Dom Kowalskich, ul. Leśna 4"
                  enterKeyHint="done"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={openSiteEditor}
                aria-label={site ? `Budowa: ${site}. Zmień` : "Dodaj budowę"}
                className="pressable inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm coarse:min-h-11"
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
                <span className={cn("truncate", !site && "text-muted-foreground")}>{site || "Dodaj budowę"}</span>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            )}
            {editingSite && siteChipsRow}
            {!editingSite && (geo ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 pl-3 text-sm coarse:min-h-11" data-testid="journal-geo">
                <LocateFixed className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
                <a href={mapsUrl(geo)} target="_blank" rel="noopener noreferrer" className="truncate underline-offset-2 hover:underline">Tu ({accuracyLabel(geo)})</a>
                <button type="button" onClick={() => patch({ geo: null })} aria-label="Usuń lokalizację wpisu" className="pressable rounded-full p-1.5 text-muted-foreground hover:text-foreground coarse:-my-2.5 coarse:-mr-1 coarse:inline-flex coarse:size-11 coarse:items-center coarse:justify-center">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={locate}
                disabled={locating}
                className="pressable inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60 coarse:min-h-11"
              >
                {locating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <LocateFixed className="h-4 w-4" aria-hidden />}
                {locating ? "Szukam…" : "Tu jestem"}
              </button>
            ))}
            {/* Lokalizacja wpisu obok zapisanej budowy: jeden dotyk zamiast wybierania. */}
            {!editingSite && nearby && nearby.name !== site && (
              <button type="button" onClick={() => pickSite(nearby.name)} data-testid="journal-nearby-site" className="pressable inline-flex max-w-full items-center gap-1 rounded-full border border-primary/40 px-3 py-1.5 text-sm text-primary-ink hover:bg-primary/10 coarse:min-h-11">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">Budowa obok: {nearby.name}</span>
              </button>
            )}
            {/* Pierwszy raz na tej budowie: zapisz jej lokalizację, następne wpisy podpowiedzą ją same. */}
            {!editingSite && geo && siteCard && !siteCard.geo && (
              <button type="button" onClick={() => { setSiteGeo(siteCard.id, geo); haptic("success"); toast.success(`Zapisano lokalizację budowy „${siteCard.name}”`); }} data-testid="journal-save-site-geo" className="pressable inline-flex max-w-full items-center gap-1 rounded-full border border-dashed border-primary/40 px-3 py-1.5 text-sm text-primary-ink hover:bg-primary/10 coarse:min-h-11">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">Zapisz jako lokalizację budowy</span>
              </button>
            )}
            {/* Wpis „za wczoraj”: data i godzina zwinięte w pigułkę, domyślnie chwila zapisu. */}
            {editingWhen ? (
              <div className="flex w-full items-end gap-2">
                <label className="block min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
                  Kiedy
                  <input
                    type="datetime-local"
                    autoFocus
                    value={toLocalInput(at ?? Date.now())}
                    max={toLocalInput(Date.now())}
                    onChange={(e) => { const next = fromLocalInput(e.target.value); if (next !== null) setAt(next); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditingWhen(false); } }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
                  />
                </label>
                <Button type="button" variant="outline" onClick={() => { setAt(null); setEditingWhen(false); }} className="coarse:h-11">Teraz</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingWhen(true)}
                aria-label={`Kiedy: ${at === null ? "teraz" : whenLabel(at)}. Zmień`}
                className="pressable inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm coarse:min-h-11"
              >
                <Clock className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
                <span className={cn("truncate tabular-nums", at === null && "text-muted-foreground")}>{at === null ? "Teraz" : whenLabel(at)}</span>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            )}
            {!editingSite && siteChipsRow}
          </div>

          <ToggleGroup
            variant="plain"
            aria-label="Rodzaj wpisu"
            value={kind}
            onValueChange={(v) => { haptic("selection"); patch({ kind: v as JournalKind }); }}
            className="grid grid-cols-3 gap-2"
          >
            {(Object.keys(KIND_LABEL) as JournalKind[]).map((k) => (
              <ToggleGroupItem
                key={k}
                value={k}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2.5 text-sm transition-colors duration-fast coarse:min-h-16",
                  kind === k ? cn(KIND_ON[k], "font-semibold text-foreground") : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <KindIcon kind={k} className="h-5 w-5" />
                {KIND_LABEL[k]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {entryStage && (
            <div className="flex items-center gap-2 rounded-xl border border-success-ink/40 bg-success/10 px-3 py-1.5 text-sm" data-testid="journal-entry-stage">
              <ListChecks className="h-4 w-4 shrink-0 text-success-ink" aria-hidden />
              <span className="min-w-0 flex-1 truncate">Etap: <span className="font-medium">{entryStage.name}</span></span>
              <button
                type="button"
                onClick={() => { haptic("tap"); patch({ stage: null }); }}
                aria-label={`Odepnij wpis od etapu: ${entryStage.name}`}
                title="Odepnij od etapu (etap zostaje odhaczony w karcie)"
                className="pressable grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          )}

          {!isEdit && !entryStage && kind === "ok" && nextStages.length > 0 && (
            <div className="space-y-1" data-testid="journal-stage-chips">
              <p className="text-xs text-muted-foreground">Skończony etap? Odhacz go — zdjęcia z wpisu trafią do protokołu przy nim:</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Następne etapy budowy">
                {nextStages.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => markStage(s.id)}
                    aria-label={`Odhacz etap: ${s.name}`}
                    className="pressable inline-flex max-w-full items-center gap-1 rounded-full border border-success-ink/40 px-2.5 py-1 text-xs text-success-ink hover:bg-success/10 coarse:min-h-11 coarse:px-3 coarse:text-sm"
                  >
                    <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEdit && !entryStage && siteCard && (
            // Zapisany wpis (np. zdjęcia „przed zakryciem” sprzed odhaczenia) — przypięcie bez ruszania stanu etapu w karcie.
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
              <span className="shrink-0">Zdjęcia do protokołu przy etapie:</span>
              <select
                value=""
                onChange={(e) => { if (e.target.value) { haptic("selection"); patch({ stage: e.target.value }); } }}
                aria-label="Przypnij wpis do etapu"
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11"
              >
                <option value="">— bez etapu —</option>
                {siteStages(siteCard).map((s) => <option key={s.id} value={s.id}>{s.done !== undefined ? `✓ ${s.name}` : s.name}</option>)}
              </select>
            </label>
          )}

          {isEdit && kind === "problem" && (
            <label className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-sm coarse:min-h-12">
              <Checkbox
                checked={editForm.resolved !== null}
                onCheckedChange={(on) => patchJournalEditForm({ resolved: on === true ? editForm.resolved ?? Date.now() : null })}
              />
              Problem rozwiązany
            </label>
          )}

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
                    "w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring",
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
            {!text.trim() && (yesterdayText || textSuggestions.length > 0) && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Podpowiedzi tekstu z tej budowy" data-testid="journal-text-suggestions">
                {yesterdayText && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => { haptic("selection"); setText(yesterdayText); }}
                    title={yesterdayText}
                    className="pressable inline-flex max-w-full items-center gap-1 rounded-full border border-primary/40 px-2.5 py-1 text-xs text-primary-ink hover:bg-primary/10 coarse:min-h-11 coarse:px-3 coarse:text-sm"
                  >
                    Jak wczoraj
                  </button>
                )}
                {textSuggestions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => { haptic("selection"); setText(t); }}
                    title={t}
                    className="pressable inline-flex max-w-full items-center rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground coarse:min-h-11 coarse:px-3 coarse:text-sm"
                  >
                    <span className="truncate">{t}</span>
                  </button>
                ))}
              </div>
            )}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setRecording(true)}
                disabled={recording || recordings.length >= JOURNAL_MAX_RECORDINGS}
                className="coarse:h-12"
              >
                <Mic className="mr-1.5 h-4 w-4 coarse:h-5 coarse:w-5" />Nagraj
              </Button>
            </div>
            {recording && (
              <Suspense fallback={null}>
                <VoiceRecorder onFile={(f) => void addRecordingFile(f)} onClose={() => setRecording(false)} />
              </Suspense>
            )}
            {recordings.length > 0 && (
              <ul className="space-y-2" aria-label="Nagrania we wpisie">
                {recordings.map((a) => (
                  <li key={a.hash} className="rounded-lg border border-border px-2.5 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mic className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">{formatFileSize(a.size)}</span>
                      <button
                        type="button"
                        onClick={() => patch({ recordings: getForm().recordings.filter((x) => x.hash !== a.hash) })}
                        aria-label={`Usuń nagranie: ${a.name}`}
                        className="pressable grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    <Suspense fallback={null}><AudioPreview attachment={a} /></Suspense>
                  </li>
                ))}
              </ul>
            )}
            {(images.length > 0 || processing > 0) && (
              <ul className="flex flex-wrap gap-2" aria-label="Zdjęcia we wpisie">
                {images.map((ref, i) => (
                  <li key={ref} className="relative">
                    <NoteImage imageRef={ref} alt={`Zdjęcie ${i + 1} z ${images.length} we wpisie`} className="h-20 w-20 rounded-lg object-cover" placeholderClassName="h-20 w-20 rounded-lg" />
                    <button
                      type="button"
                      onClick={() => {
                        const before = getForm().images;
                        patch({ images: before.filter((r) => r !== ref) });
                        // Cofnij: zdjęcie wraca na swoje miejsce (zapisane dopiero przy „Zapisz wpis”).
                        const at = before.indexOf(ref);
                        toastWithUndo("Usunięto zdjęcie z wpisu", () => {
                          const cur = getForm().images;
                          if (!cur.includes(ref)) patch({ images: [...cur.slice(0, at), ref, ...cur.slice(at)] });
                        }, { id: `photo-remove-${ref}` });
                      }}
                      aria-label="Usuń zdjęcie z wpisu"
                      className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground coarse:h-6 coarse:w-6 relative coarse:after:absolute coarse:after:-inset-2.5 coarse:after:content-['']"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCaptioning(captioning === ref ? null : ref); setCaptionDraft(""); }}
                      aria-label="Podpis na zdjęciu"
                      aria-pressed={captioning === ref}
                      className={cn(
                        "absolute -bottom-1.5 -left-1.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm coarse:h-6 coarse:w-6 relative coarse:after:absolute coarse:after:-inset-2.5 coarse:after:content-['']",
                        captioning === ref && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      <Type className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void openDrawing(ref)}
                      aria-label="Rysuj na zdjęciu"
                      title="Strzałka, wymiar, zaznaczenie — rysunek zostaje na zdjęciu"
                      className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm coarse:h-6 coarse:w-6 relative coarse:after:absolute coarse:after:-inset-2.5 coarse:after:content-['']"
                    >
                      <PenTool className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
                {Array.from({ length: processing }, (_, i) => (
                  <li key={`processing-${i}`} className="grid h-20 w-20 place-items-center rounded-lg bg-muted" data-testid="journal-photo-processing">
                    <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                    <span className="sr-only">Przygotowuję zdjęcie</span>
                  </li>
                ))}
              </ul>
            )}
            {captioning && images.includes(captioning) && (
              <form
                className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3"
                onSubmit={(ev) => { ev.preventDefault(); void burnCaption(captioning); }}
                aria-label="Podpis na zdjęciu"
              >
                <label className="block space-y-1 text-xs text-muted-foreground">
                  Podpis na zdjęciu — dopiszę datę wpisu
                  <input
                    autoFocus
                    value={captionDraft}
                    maxLength={CAPTION_MAX}
                    onChange={(ev) => setCaptionDraft(ev.target.value)}
                    placeholder="np. Łazienka, pion 58 cm od posadzki"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {["Przed zakryciem", "Łazienka", "Kuchnia", "Kotłownia"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setCaptionDraft((d) => (d.trim() ? d.trim() + ", " + chip.toLowerCase() : chip))}
                      className="pressable rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted coarse:min-h-11 coarse:px-3 coarse:text-sm"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={processing > 0} className="coarse:h-11">Wtop podpis</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCaptioning(null)} className="coarse:h-11">Anuluj</Button>
                </div>
              </form>
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
            {topic === "punkty" && <div className="border-t border-border px-2 py-1"><HeightsButton variant="link" /></div>}
            {/* Przy tematach prób protokół od razu pod ręką; przy innych — gdy już jest we wpisie. */}
            {(TEST_TOPICS.has(topic) || form.test) && (
              <div className="border-t border-border p-2">
                <PressureTestFields value={form.test} topic={topic} onChange={(t) => patch({ test: t })} />
              </div>
            )}
            <div className="border-t border-border p-2">
              <FittingsFields value={form.fittings ?? []} history={fittingHistory} onChange={(f) => patch({ fittings: f })} />
            </div>
            {topicOpen && (
              <div id="journal-topic" className="space-y-3 border-t border-border p-3" data-testid="journal-topic-panel">
                <label className="block space-y-1 text-xs text-muted-foreground">
                  Czego dotyczy
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
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
                            {item.critical && <span className="mr-1 inline-flex align-[-2px]" role="img" aria-label="Punkt krytyczny"><TriangleAlert className="h-3.5 w-3.5 text-warning-ink" aria-hidden /></span>}
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
          <div className="flex gap-2">
            {isEdit && (
              <Button type="button" variant="outline" onClick={remove} className="h-12 shrink-0 text-destructive-ink hover:text-destructive-ink">
                <Trash className="mr-1.5 h-4 w-4" aria-hidden />Usuń
              </Button>
            )}
            <Button onClick={submit} disabled={processing > 0} className="h-12 min-w-0 flex-1 text-base">
              {processing > 0
                ? <><LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />Przygotowuję zdjęcia…</>
                : isEdit ? "Zapisz zmiany" : "Zapisz wpis"}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-xs text-muted-foreground coarse:hidden">Ctrl+Enter zapisuje {isEdit ? "zmiany" : "wpis"}</p>
        </div>
        {/* Rysowanie po zdjęciu — okno nad arkuszem; zamknięcie bez zapisu zostawia zdjęcie bez zmian. */}
        <DrawingCanvas
          open={drawing !== null}
          onOpenChange={(o) => { if (!o) setDrawing(null); }}
          initialImage={drawing?.url ?? null}
          onSave={(dataUrl) => void saveDrawing(dataUrl)}
        />
      </SheetContent>
    </Sheet>
  );
}
