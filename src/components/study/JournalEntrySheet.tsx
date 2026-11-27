import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { TriangleAlert, CircleCheck, NotebookPen, Trash } from "lucide-react";
import { EntryPhotoSection } from "./entry/EntryPhotoSection";
import { pastedImageFiles } from "@/lib/clipboardPaste";
import { usePhotoUi } from "./entry/usePhotoUi";
import { EntryStageSection } from "./entry/EntryStageSection";
import { EntryTextField } from "./entry/EntryTextField";
import { EntryToolsSection } from "./entry/EntryToolsSection";
import { EntryWhereWhen } from "./entry/EntryWhereWhen";
import { useEntryPhotos } from "./entry/useEntryPhotos";
import { useEntrySite } from "./entry/useEntrySite";
import { useLocate } from "./entry/useLocate";
import type { FormFields } from "./entry/entryForm";
import { isRunning } from "@/lib/study/pressureTest";
import { CLOSED_PANELS, panelsReducer } from "@/lib/study/entryPanels";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toastWithUndo } from "@/lib/undoToast";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDictation } from "@/hooks/useDictation";
import { addJournalEntry, columnOf, removeJournalEntry, restoreJournalEntry, setSiteGeo, setSiteStages, updateJournalEntry, useSiteDirectory, useStudy, type JournalKind } from "@/lib/study/store";
import { clearJournalDraft, EMPTY_DRAFT, getJournalDraft, patchJournalDraft, useJournalDraft } from "@/lib/study/draft";
import { closeJournalSheet, freshEntry, getJournalEditBase, getJournalEditForm, patchJournalEditForm, takeVoiceRequest, useJournalEditForm, useJournalSheet } from "@/lib/study/entrySheet";
import { KIND_LABEL, recentSiteTexts, yesterdaySiteText } from "@/lib/study/journalView";
import { findSiteByName, siteKey } from "@/lib/study/sites";
import { setSiteSupply, useVan } from "@/lib/study/vanStore";
import { nearestSite } from "@/lib/study/geo";
import { suggestFittingNames } from "@/lib/study/fittings";
import { editDemotesTopic, editSavedMessage, newEntryMessage, shouldOfferSiteGeo } from "@/lib/study/entrySheetRules";
import { applySpokenEntry } from "@/lib/study/spokenEntryApply";
import { siteStages, toggleStage } from "@/lib/study/stages";
import { DelayedSpinner } from "@/components/DelayedSpinner";
import { useTrackUse } from "@/lib/study/usage";
import { cardVariant } from "@/components/ui/card";

export function KindIcon({ kind, className = "size-4" }: { kind: JournalKind; className?: string }) {
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

/**
 * Wpis z budowy w arkuszu: na telefonie od dołu (nad klawiaturą, kciukiem), na komputerze
 * z boku. Najpierw to, co na budowie robi się zawsze — rodzaj, tekst, zdjęcie; temat z listą
 * kontrolną jest zwinięty, chyba że wpis zaczyna się z karty tematu. Nowy wpis to szkic
 * (`draft.ts`): zamknięcie nie gubi tekstu ani zdjęć. Ten sam arkusz poprawia zapisany wpis
 * (`openJournalEdit`) — wtedy na formularzu edycji, a w stopce jest też „Usuń”.
 * Części: miejsce i czas, etap, tekst, zdjęcia i nagrania, „Dodaj do wpisu” (`entry/`); tu zostaje zapis.
 */
export function JournalEntrySheet({ onPractice }: { onPractice: (topicId: string) => void }) {
  // Fokus po otwarciu idzie na tytuł, nie na pole tekstu: na telefonie pole od razu wywołałoby klawiaturę.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { open, topicFirst, editing } = useJournalSheet();
  useTrackUse("wpis", open);
  const isMobile = useIsMobile();
  const study = useStudy();
  const draft = useJournalDraft();
  const editForm = useJournalEditForm();
  const isEdit = editing !== null && editForm !== null;
  const form: FormFields = isEdit ? editForm : draft;
  const { topic, kind, text, images } = form;
  // Czytane na świeżo (zdjęcia obrabiają się asynchronicznie); edycja zamknięta w trakcie → pusty formularz.
  const getForm = (): FormFields => (isEdit ? getJournalEditForm() ?? EMPTY_DRAFT : getJournalDraft());
  const patch: (p: Partial<FormFields>) => void = isEdit ? patchJournalEditForm : patchJournalDraft;
  const site = isEdit ? editForm.site : study.site;
  /** Moment wpisu; `null` = chwila zapisu (tylko nowy wpis). */
  const at = isEdit ? editForm.at : draft.at;
  const photos = useEntryPhotos({ getForm, patch });
  const { processing } = photos;
  // Pusty wpis: komunikat przy polu (czytany przez czytnik), nie tylko dymek. Znika przy pisaniu.
  const [emptyAttempt, setEmptyAttempt] = useState(false);
  // Ochrona przed podwójnym zapisem (dwa szybkie stuknięcia przy zamykaniu arkusza).
  const submittingRef = useRef(false);
  /** Kształtki i rury z poprzednich wpisów — podpowiedzi nazw (H1.1). */
  const fittingHistory = useMemo(() => study.journal.map((e) => e.fittings), [study.journal]);
  const pipeHistory = useMemo(() => study.journal.map((e) => e.pipes), [study.journal]);
  const [editingWhen, setEditingWhen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const setText = (next: string | ((prev: string) => string)) =>
    patch({ text: typeof next === "function" ? next(getForm().text) : next });

  /** Klucz sesji arkusza: otwarcie, zamknięcie albo inny wpis zamyka pola w trakcie edycji (budowa, „Kiedy”, temat). */
  const session = `${open}|${topicFirst}|${editing}`;
  useEffect(() => { setEditingWhen(false); }, [session]);
  // Panele „Dodaj do wpisu” i widok zdjęć żyją tu, nie w sekcjach: treść arkusza odmontowuje się przy zamknięciu,
  // a otwarta sekcja i podpis w trakcie pisania mają przeżyć zamknięcie szkicu.
  const [panels, dispatchPanels] = useReducer(panelsReducer, CLOSED_PANELS);
  const photoUi = usePhotoUi();
  // Arkusz otwarty z karty tematu rozwija temat; zwykłe otwarcie go zwija.
  useEffect(() => { if (open) dispatchPanels({ type: "set", panel: "topic", open: topicFirst }); }, [session, open, topicFirst]);

  const dir = useSiteDirectory();
  const recentSites = useMemo(() => dir.filter((s) => s.archived === undefined).map((s) => s.name), [dir]);
  const siteEditor = useEntrySite({ site, studySite: study.site, isEdit, recentSites, reset: session, getForm, patch });
  const { commitSite, pickSite, siteChips } = siteEditor;
  /** Karta budowy wybranej w polu (brak = bez budowy albo nieznana nazwa) — dla podpowiedzi tekstu i etapów. */
  const siteCard = useMemo(() => findSiteByName(dir, site), [dir, site]);
  const siteId = siteCard?.id ?? "";
  // H1.3: skąd materiał — „z auta” (domyślnie, H-1) albo dostawa na budowę; karta pamięta ostatni wybór.
  const van = useVan();
  const supplySiteId = siteCard?.id ?? (site.trim() ? siteKey(site) : "");
  const [supplyChoice, setSupplyChoice] = useState<"site" | "van" | null>(null);
  useEffect(() => { setSupplyChoice(null); }, [open, editing]);
  const editedEntry = isEdit ? study.journal.find((e) => e.id === editing) : undefined;
  const supply: "site" | "van" = supplyChoice ?? (isEdit ? editedEntry?.supply ?? "van" : van.siteSupply[supplySiteId] ?? "van");
  const hasMaterial = (form.fittings?.length ?? 0) > 0 || (form.pipes?.length ?? 0) > 0;
  const rememberSupply = () => { if (hasMaterial && supplySiteId) setSiteSupply(supplySiteId, supply); };
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

  const geo = form.geo ?? null;
  const { locating, locate } = useLocate((g) => patch({ geo: g }));
  /** Budowa z zapisaną lokalizacją w promieniu 300 m — jeden dotyk zamiast wybierania. */
  const nearby = useMemo(() => (geo ? nearestSite(dir, geo) : null), [geo, dir]);

  /** Nazwy kształtek do dopasowania dyktowania (historia i podpowiedzi). */
  const knownFittings = useMemo(() => suggestFittingNames(fittingHistory, []), [fittingHistory]);
  // Ręce zajęte robotą: dyktowanie dopisuje rozpoznane zdanie na końcu wpisu. Gdy w wypowiedzi padnie
  // budowa, rodzaj albo kształtki („Lipowa, problem, przeciek przy trójniku, kolano 16 cztery sztuki”),
  // trafiają do swoich pól, a do tekstu idzie reszta (`spokenEntry.ts`).
  const dictation = useDictation((spoken) => applySpokenEntry(spoken, { setText, recentSites, knownFittings, site, dir, pickSite, patch, getForm }));
  // Skrót „Wpis głosowy” (`?wpis=1&glos=1`): arkusz otwarty z żądaniem startuje dyktowanie od razu.
  // Bez zgody na usługę mowy pokaże się zwykłe pytanie o zgodę — zgodę zawsze daje kliknięcie.
  const { supported: dictationSupported, toggle: toggleDictation, stop: stopDictation, listening: dictating } = dictation;
  // Zamknięcie arkusza (zapis, Esc, tło) kończy nasłuch: arkusz jest zamontowany cały czas, więc bez tego mikrofon
  // działał dalej i dopisywał mowę do szkicu następnego wpisu.
  useEffect(() => { if (!open && dictating) stopDictation(); }, [open, dictating, stopDictation]);
  useEffect(() => {
    if (!open) return;
    const voice = takeVoiceRequest();
    if (voice && dictationSupported) toggleDictation();
  }, [open, dictationSupported, toggleDictation]);

  function setAt(next: number | null) {
    if (isEdit) patchJournalEditForm({ at: next ?? Date.now() });
    else patchJournalDraft({ at: next });
  }

  function submit() {
    if (processing > 0 || submittingRef.current) return;
    submittingRef.current = true;
    try { submitOnce(); } finally { submittingRef.current = false; }
  }

  function submitOnce() {
    // B3.1: trwająca próba nie przechodzi do wpisu w połowie — najpierw wynik albo przerwanie.
    const live = (isEdit ? getJournalEditForm() : getJournalDraft())?.test;
    if (live && isRunning(live)) {
      toast.error("Próba szczelności trwa", { description: "Zakończ ją w Minutniku (wpisz ciśnienie końcowe) albo ją przerwij, potem zapisz wpis." });
      return;
    }
    commitSite();
    if (isEdit) { saveEdit(); return; }
    const wasDone = topic && columnOf(study, topic) === "done";
    const entry = addJournalEntry({ kind, topic: topic || null, text, checked: [...new Set(form.checked)], images, captions: form.captions, drawnFrom: form.drawnFrom, recordings: form.recordings, at, test: form.test, fittings: form.fittings, pipes: form.pipes, supply, stage: form.stage, geo: form.geo ?? null, level: form.level, barcode: form.barcode, summary: form.summary, dimensions: form.dimensions, ...(form.point ? { point: form.point } : {}) });
    if (!entry) {
      haptic("warn");
      setEmptyAttempt(true);
      textRef.current?.focus();
      return;
    }
    freshEntry.id = entry.id;
    rememberSupply();
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
      base: getJournalEditBase() ?? undefined,
      kind: f.kind, topic: f.topic || null, text: f.text, checked: f.checked, images: f.images, captions: f.captions, drawnFrom: f.drawnFrom, recordings: f.recordings, at: f.at, site: f.site, resolved: f.resolved, test: f.test, fittings: f.fittings, pipes: f.pipes, supply, stage: f.stage, geo: f.geo ?? null, level: f.level, barcode: f.barcode, summary: f.summary, dimensions: f.dimensions,
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

  const entryForm = { form, getForm, patch };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) closeJournalSheet(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("flex flex-col gap-0 overflow-hidden p-0", isMobile ? "max-h-sheet rounded-t-3xl pb-0" : "w-full sm:max-w-md")}
        data-testid="journal-entry-sheet"
        onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus(); }}
        // Q3.6: wklejony zrzut ekranu albo skopiowane zdjęcie trafia do zdjęć wpisu, nie do pola tekstu.
        onPaste={(e) => {
          const images = pastedImageFiles(e.clipboardData);
          if (images.length === 0) return;
          e.preventDefault();
          void photos.addPhotos(images);
        }}
      >
        <SheetHeader className="shrink-0 px-5 pb-2 pt-5 text-left">
          <SheetTitle ref={titleRef} tabIndex={-1} className="font-display outline-hidden">{isEdit ? "Edytuj wpis" : "Wpis z budowy"}</SheetTitle>
          <SheetDescription className="sr-only">
            {isEdit ? "Popraw rodzaj, opis, zdjęcia, temat albo datę wpisu." : "Rodzaj, opis, zdjęcia i temat z materiału. Szkic zostaje po zamknięciu."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4">
          <EntryWhereWhen
            site={site}
            editingSite={siteEditor.editingSite}
            siteText={siteEditor.siteText}
            onSiteText={siteEditor.onSiteText}
            onOpenSiteEditor={siteEditor.openSiteEditor}
            onCommitSite={commitSite}
            siteChips={siteChips}
            geo={geo}
            onClearGeo={() => patch({ geo: null })}
            locating={locating}
            onLocate={locate}
            nearbyName={nearby?.name ?? null}
            onPickSite={pickSite}
            saveSiteGeoFor={siteCard && !siteCard.geo ? siteCard.id : null}
            onSaveSiteGeo={() => { if (!siteCard || !geo) return; setSiteGeo(siteCard.id, geo); haptic("success"); toast.success(`Zapisano lokalizację budowy „${siteCard.name}”`); }}
            editingWhen={editingWhen}
            onEditingWhen={setEditingWhen}
            at={at}
            onAt={setAt}
          />

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
                  "flex flex-col items-center justify-center gap-1 rounded-card border-2 py-2.5 text-sm transition-colors duration-fast coarse:min-h-16",
                  kind === k ? cn(KIND_ON[k], "font-semibold text-foreground") : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <KindIcon kind={k} className="size-5" />
                {KIND_LABEL[k]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <EntryStageSection
            entryStage={entryStage}
            text={text}
            onText={setText}
            isEdit={isEdit}
            kind={kind}
            nextStages={nextStages}
            onMarkStage={markStage}
            siteCard={siteCard ?? null}
            onStage={(id) => patch({ stage: id })}
          />

          {isEdit && kind === "problem" && (
            <label className={cn(cardVariant(), "flex items-center gap-2.5 px-3 py-2.5 text-sm coarse:min-h-12")}>
              <Checkbox
                checked={editForm.resolved !== null}
                onCheckedChange={(on) => patchJournalEditForm({ resolved: on === true ? editForm.resolved ?? Date.now() : null })}
              />
              Problem rozwiązany
            </label>
          )}

          <EntryTextField
            textRef={textRef}
            text={text}
            onText={(t) => { setText(t); setEmptyAttempt(false); }}
            kind={kind}
            emptyAttempt={emptyAttempt}
            onSubmit={submit}
            dictation={dictation}
            yesterdayText={yesterdayText}
            suggestions={textSuggestions}
          />

          <EntryPhotoSection
            {...entryForm}
            isEdit={isEdit}
            siteId={siteId}
            photos={photos}
            ui={photoUi}
            onTranscript={(t) => setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${t}` : t))}
          />

          <EntryToolsSection
            {...entryForm}
            fittingHistory={fittingHistory}
            pipeHistory={pipeHistory}
            supply={supply}
            onSupply={setSupplyChoice}
            showSupply={hasMaterial && van.items.length > 0}
            onPractice={onPractice}
            panels={panels}
            dispatch={dispatchPanels}
          />
        </div>

        {/* Przycisk poza przewijaną treścią: z klawiaturą na ekranie (`resizes-content`) wisi tuż nad nią. */}
        <div className="shrink-0 border-t border-border bg-background px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {emptyAttempt && (
            <p id="journal-empty-hint" role="alert" className="text-xs text-destructive-ink">
              Wpisz, co się dzieje, albo dodaj zdjęcie, nagranie, próbę, kształtki, etap, pomiar spadku albo kod.
            </p>
          )}
          <div className="flex gap-2">
            {isEdit && (
              <Button type="button" variant="outline" onClick={remove} className="h-12 shrink-0 text-destructive-ink hover:text-destructive-ink">
                <Trash className="mr-1.5 size-4" aria-hidden />Usuń
              </Button>
            )}
            <Button onClick={submit} disabled={processing > 0} className="h-12 min-w-0 flex-1 text-base">
              {processing > 0
                ? <><DelayedSpinner active className="mr-1.5 size-4" />Przygotowuję zdjęcia…</>
                : isEdit ? "Zapisz zmiany" : "Zapisz wpis"}
            </Button>
          </div>
          <p className="ui-hint mt-1.5 text-center coarse:hidden">Ctrl+Enter zapisuje {isEdit ? "zmiany" : "wpis"}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
