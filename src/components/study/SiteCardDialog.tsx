import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, Clock, ClipboardCheck, FileText, KeyRound, ListFilter, MapPin, MessageSquare, Navigation, Package, Pencil, Phone, Send, Share2, Plus, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { haptic } from "@/lib/haptics";
import { useShifts } from "@/lib/shifts";
import { pluralPl } from "@/lib/plural";
import { addJournalEntry, saveSiteCard, setSite, useSiteDirectory, useStudy } from "@/lib/study/store";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import { photoSaveFailed } from "@/components/study/useJournalPhotoEdits";
import { findSiteByName, SITE_FIELD_MAX, SITE_NAME_MAX } from "@/lib/study/sites";
import { entriesPl, problemsPl } from "@/lib/study/journalView";
import { periodLabel, dayKeyOf, workOn } from "@/lib/study/report";
import { siteMinutesByDay, siteMinutesInRange } from "@/lib/study/siteHours";
import { formatHoursShort } from "@/lib/shifts/time";
import { localDayKey } from "@/lib/dayDone";
import { useDayClock } from "@/lib/dayClock";
import { siteTally } from "@/lib/study/siteTally";
import { SiteTallyBar } from "./SiteTallyBar";
import { useSiteCardActions } from "./useSiteCardActions";
import { cn } from "@/lib/utils";
import { SiteOrderPanel } from "./SiteOrderPanel";
import { SiteStagesPanel } from "./SiteStagesPanel";
import { SiteShortagesPanel } from "./SiteShortagesPanel";
import { SiteFaultsPanel } from "./SiteFaultsPanel";
import { SiteMaterialPanel } from "./SiteMaterialPanel";
import { SiteTimePanel } from "./SiteTimePanel";
import { SiteStorageLine } from "./SiteStorageLine";
import { StageDots } from "./StageDots";
import { NoteImage } from "@/components/NoteImage";
import { siteStages } from "@/lib/study/stages";
import { siteCoverRef } from "@/lib/study/siteCover";
import { SiteDocsPanel } from "./SiteDocsPanel";
import { SiteServicePanel } from "./SiteServicePanel";
import { PrintRoot } from "./PrintRoot";
import { HandoverPaper } from "./HandoverPaper";
import { QuickLink } from "./QuickLink";
import { DayHoursDialog } from "./DayHoursDialog";
import { RecipientsForm } from "./RecipientsForm";
import { buildHandover, type Handover } from "@/lib/study/handover";
import { mapsHref, prettyPhone, smsHref, SITE_ACCESS_MAX, SITE_PHONE_MAX, telHref } from "@/lib/study/contact";
import { useWakeLock } from "@/hooks/useWakeLock";


const EMPTY_FORM = { name: "", address: "", investor: "", phone: "", manager: "", managerPhone: "", supplierPhone: "", access: "" };
type SiteForm = typeof EMPTY_FORM;
const formOf = (s: Partial<SiteForm>): SiteForm => ({ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(s).filter(([k, v]) => k in EMPTY_FORM && typeof v === "string")) });

const fieldClass =
  "w-full rounded-field border border-border bg-background px-3 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm";

/**
 * Karta budowy: na górze to, co na budowie się zmienia — „+ Wpis tutaj”, liczniki i panele etapów,
 * braków i zamówienia; dane (nazwa, adres, inwestor, telefony) zwinięte za „Edytuj dane”, bo
 * wpisuje się je raz (1.3 planu Praca 2026-10-24). Z karty prosto do wpisów tej budowy albo raportu.
 * Archiwum chowa budowę z pigułek — wpisy zostają na osi czasu.
 */
export function SiteCardDialog({
  siteId, onOpenChange, onShowEntries, onReport, onNewEntry,
}: {
  /** Otwarta karta; `null` = zamknięta. */
  siteId: string | null;
  onOpenChange: (open: boolean) => void;
  onShowEntries: (siteId: string) => void;
  onReport: (siteId: string) => void;
  /** „+ Wpis tutaj” — arkusz nowego wpisu z tą budową. */
  onNewEntry: (siteId: string) => void;
}) {
  const study = useStudy();
  const shifts = useShifts();
  const dir = useSiteDirectory();
  const site = siteId ? dir.find((s) => s.id === siteId) ?? null : null;
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  /** Formularz danych rozwinięty; każda karta otwiera się zwinięta. */
  const [editing, setEditing] = useState(false);
  /** Formularz odbiorców raportu (1.11) rozwinięty; każda karta otwiera się zwinięta. */
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  /** Okno „Godziny na budowach” nad kartą — dzień do zmiany w oknie, ta budowa zawsze na liście. */
  const [hoursOpen, setHoursOpen] = useState(false);
  /** Protokół odbioru w trakcie drukowania; `null` = nie drukujemy. */
  const [handover, setHandover] = useState<Handover | null>(null);
  const endHandover = useCallback(() => setHandover(null), []);

  useEffect(() => {
    if (site) setForm(formOf(site));
    setEditing(false);
    setRecipientsOpen(false);
    // Tylko przy otwarciu innej karty — zmiany z drugiego telefonu nie kasują pisanego tekstu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const name = form.name.trim();
  const clash = name ? findSiteByName(dir.filter((s) => s.id !== siteId), name) : undefined;
  const saved = site ? formOf(site) : EMPTY_FORM;
  const dirty = !!site && (Object.keys(EMPTY_FORM) as (keyof SiteForm)[]).some((k) => form[k].trim() !== saved[k]);
  const error = !name ? "Podaj nazwę budowy" : clash ? `Jest już budowa „${clash.name}”` : null;

  function save() {
    if (!site || error) return;
    if (saveSiteCard(site.id, form)) {
      haptic("success");
      toast.success("Zapisano kartę budowy");
    }
  }

  // ZIP, protokół i archiwizacja — w `useSiteCardActions` (P6.2).
  const { zipping, zip, shareHandover, pdfHandover, pdfBusy, archiveAsk, setArchiveAsk, shrinkWithZip, setShrinkWithZip, archiving, toggleArchive, doArchive } = useSiteCardActions({
    site, study, dir, shifts, persistDirty, onArchived: () => onOpenChange(false),
  });

  /** Niezapisana zmiana idzie do karty przed każdym wyjściem z okna — nie gubimy wpisanych danych po cichu. */
  function persistDirty(): boolean {
    if (!site || !dirty || error) return false;
    saveSiteCard(site.id, form);
    return true;
  }

  // B1: w karcie budowy ekran nie gaśnie (zdjęcia, zapisy w terenie).
  useWakeLock(!!site);

  // B2: zdjęcie jednym stuknięciem — nowy wpis tej budowy z samym zdjęciem (bez tekstu i etapu).
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  async function addPhotoEntry(file: File) {
    if (!site) return;
    setPhotoBusy(true);
    try {
      const prepared = await prepareImage(file);
      if (!prepared) { toast.error("Nie udało się zmniejszyć zdjęcia do 2 MB"); return; }
      const ref = await imageStore.putBlob(prepared);
      setSite(site.name);
      if (!addJournalEntry({ kind: "ok", topic: null, text: "", images: [ref] })) { toast.error("Nie zapisano zdjęcia"); return; }
      haptic("tap");
      toast.success("Zdjęcie dodane jako wpis budowy");
    } catch {
      photoSaveFailed();
    } finally {
      setPhotoBusy(false);
    }
  }

  function close(open: boolean) {
    if (!open && persistDirty()) toast.success("Zapisano kartę budowy");
    onOpenChange(open);
  }

  /** „Pokaż wpisy”, „Raport” i „+ Wpis tutaj” zamykają kartę w rodzicu — najpierw zapis, potem przejście. */
  function leaveTo(go: (siteId: string) => void) {
    if (!site) return;
    persistDirty();
    go(site.id);
  }

  // Szybkie akcje z zapisanej karty (nie z pisanego formularza) — numer przed zapisem nie dzwoni.
  const nav = site ? mapsHref(site.address) : null;
  const call = site?.phone ? telHref(site.phone) : null;
  const sms = site?.phone ? smsHref(site.phone) : null;
  const callManager = site?.managerPhone ? telHref(site.managerPhone) : null;
  const setField = (k: keyof SiteForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const period = site?.first != null && site.last != null ? periodLabel(dayKeyOf(site.first), dayKeyOf(site.last)) : null;
  const tally = useMemo(() => (site ? siteTally(site, study.journal) : null), [site, study.journal]);
  // P5.1: okładka karty — pierwszy plan albo najnowsze zdjęcie budowy; bez zdjęcia nagłówek jak dawniej.
  const cover = useMemo(() => (site ? siteCoverRef(study.journal, site) : null), [site, study.journal]);
  // Godziny budowy (1.4): łącznie i w bieżącym miesiącu, do dziś — Grafik ma zmiany zaplanowane naprzód.
  const dayTick = useDayClock();
  const hours = useMemo(() => {
    void dayTick;
    if (!site) return null;
    const today = localDayKey();
    const cards = Object.fromEntries(dir.map((x) => [x.id, x]));
    const workOf = (key: string) => workOn(shifts, key)?.minutes ?? 0;
    return {
      total: siteMinutesInRange(study.journal, cards, site.id, "0000-01-01", today, workOf, dayKeyOf),
      month: siteMinutesInRange(study.journal, cards, site.id, `${today.slice(0, 8)}01`, today, workOf, dayKeyOf),
      // P2.8: dni miesiąca dla panelu czasu (licznik, stawka, CSV).
      today,
      monthDays: siteMinutesByDay(study.journal, cards, site.id, `${today.slice(0, 8)}01`, today, workOf, dayKeyOf),
    };
  }, [site, dir, study.journal, shifts, dayTick]);
  /** Zwinięte dane w jednej linijce — widać, co jest w karcie, bez rozwijania. */
  const summary = site ? [site.address, site.investor, site.manager && `kier. ${site.manager}`].filter(Boolean).join(" · ") : "";
  /** Odbiorcy raportu w jednej linijce — widać, kto dostanie raport, bez rozwijania. */
  const recipients = [study.boss && (study.boss.name || "szef"), study.group && `„${study.group.name}”`].filter(Boolean).join(" · ");

  return (
    <Dialog open={!!site} onOpenChange={close}>
      <ResponsiveDialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-md" data-testid="site-card">
        {site && (
          <>
            <div className={cover ? "space-y-2 border-b border-border px-5 pb-4 pt-12" : "space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12"}>
              {cover ? (
                // P5.1: okładka ze zdjęcia budowy — pod rzędem z przyciskiem zamknięcia, żeby „×” był czytelny.
                <div className="relative -mx-1 aspect-[16/7] overflow-hidden rounded-card bg-muted" data-testid="site-cover">
                  <NoteImage imageRef={cover} alt="" className="absolute inset-0 h-full w-full object-cover" placeholderClassName="absolute inset-0 h-full w-full" />
                  <div className="absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-3 pt-12 text-white">
                    <DialogTitle className="truncate font-display text-xl leading-tight text-white">{site.name}</DialogTitle>
                    {site.address && <p className="truncate text-xs text-white/85">{site.address}</p>}
                    {site.stages && <StageDots stages={siteStages(site)} onDark />}
                  </div>
                </div>
              ) : (
                <DialogTitle className="flex items-center gap-1.5 font-display text-lg">
                  <MapPin className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
                  <span className="truncate">{site.name}</span>
                </DialogTitle>
              )}
              {!cover && site.stages && <div className="pt-1"><StageDots stages={siteStages(site)} /></div>}
              <DialogDescription className="font-mono text-xs tabular-nums" data-testid="site-card-stats">
                {[
                  entriesPl(site.count),
                  site.open > 0 && `otwarte: ${problemsPl(site.open)}`,
                  period,
                  site.archived !== undefined && "w archiwum",
                ].filter(Boolean).join(" · ")}
              </DialogDescription>
              <div className="flex items-start justify-between gap-2">
              {hours && (hours.total.minutes > 0 || hours.total.unsplit > 0) ? (
                <p className="min-w-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground" data-testid="site-card-hours">
                  <Clock className="mr-1.5 inline h-3.5 w-3.5 align-[-2px] text-primary-ink" aria-hidden />
                  <span className="text-foreground">{formatHoursShort(hours.total.minutes)} h</span> łącznie
                  {" · "}<span className="text-foreground">{formatHoursShort(hours.month.minutes)} h</span> w tym miesiącu
                  {hours.total.unsplit > 0 && (
                    <span className="text-warning-ink">{` · ${hours.total.unsplit} ${pluralPl(hours.total.unsplit, ["dzień", "dni", "dni"])} do podziału`}</span>
                  )}
                </p>
              ) : (
                <p className="pt-0.5 font-mono text-xs text-muted-foreground">Bez godzin</p>
              )}
                <button
                  type="button"
                  onClick={() => setHoursOpen(true)}
                  className="pressable -my-1 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-primary-ink hover:bg-primary/10 coarse:min-h-11"
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden />Wpisz godziny
                </button>
              </div>
            </div>

            {(nav || call || callManager || site.access) && (
              <div className="space-y-2 border-b border-border px-5 py-3" data-testid="site-quick">
                {(nav || call || callManager) && (
                  <div className="grid grid-cols-2 gap-2">
                    {nav && <QuickLink href={nav} icon={Navigation}>Nawiguj</QuickLink>}
                    {call && <QuickLink href={call} icon={Phone} label={`Zadzwoń do inwestora: ${prettyPhone(site.phone!)}`}>{site.investor || "Inwestor"}</QuickLink>}
                    {sms && <QuickLink href={sms} icon={MessageSquare} label={`SMS do inwestora: ${prettyPhone(site.phone!)}`}>SMS</QuickLink>}
                    {callManager && <QuickLink href={callManager} icon={Phone} label={`Zadzwoń do kierownika: ${prettyPhone(site.managerPhone!)}`}>{site.manager || "Kierownik"}</QuickLink>}
                  </div>
                )}
                {site.access && (
                  <p className="flex items-start gap-2 rounded-field bg-warning/10 px-3 py-2 text-sm text-foreground" data-testid="site-access">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
                    <span className="min-w-0 whitespace-pre-line break-words"><span className="sr-only">Dostęp: </span>{site.access}</span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3 px-5 pt-4">
              {/* B2: zdjęcie obok „Wpis tutaj”, nie na dole karty — pod panelami na telefonie nikt go nie szuka. */}
              <div className="flex gap-2">
                <Button onClick={() => leaveTo(onNewEntry)} className="min-w-0 flex-1 coarse:h-11">
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />Wpis tutaj
                </Button>
                <Button variant="outline" onClick={() => photoInput.current?.click()} disabled={photoBusy} aria-label={photoBusy ? "Zapisuję zdjęcie" : "Zdjęcie do wpisu"} className="shrink-0 coarse:h-11">
                  <Camera className="h-4 w-4" aria-hidden />{photoBusy ? "…" : <span className="max-[380px]:sr-only">Zdjęcie</span>}
                </Button>
                <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void addPhotoEntry(file); }} />
              </div>
              {tally && <SiteTallyBar tally={tally} />}
              <SiteStagesPanel site={site} />
              <SiteShortagesPanel site={site} />
              <SiteFaultsPanel site={site} journal={study.journal} />
              <SiteMaterialPanel site={site} journal={study.journal} />
              {hours && <SiteTimePanel site={site} today={hours.today} monthLabel={new Date(`${hours.today}T12:00`).toLocaleDateString("pl-PL", { month: "long", year: "numeric" })} monthDays={hours.monthDays} />}
              <SiteOrderPanel site={site} />
            </div>

            <div className="mx-5 mt-3 rounded-card border border-border bg-card" data-testid="site-data">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-expanded={editing}
                aria-controls="site-card-form"
                className="pressable flex w-full items-center gap-2 rounded-card px-3 py-2.5 text-left coarse:min-h-11"
              >
                <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edytuj dane</span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", !summary && "text-muted-foreground")}>
                  {editing ? "" : summary || "bez adresu i kontaktów"}
                </span>
                {dirty && !editing && <span className="shrink-0 text-xs text-warning-ink">niezapisane</span>}
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", editing && "rotate-180")} aria-hidden />
              </button>
              {editing && (
            <form
              id="site-card-form"
              className="space-y-3 border-t border-border px-3 py-3"
              onSubmit={(e) => { e.preventDefault(); save(); }}
            >
              <label className="block space-y-1 text-xs text-muted-foreground">
                Nazwa
                <input
                  value={form.name}
                  onChange={setField("name")}
                  maxLength={SITE_NAME_MAX}
                  aria-invalid={!!error}
                  aria-describedby={error ? "site-card-error" : undefined}
                  className={fieldClass}
                />
              </label>
              {error && <p id="site-card-error" className="text-xs text-destructive-ink" role="alert">{error}</p>}
              <label className="block space-y-1 text-xs text-muted-foreground">
                Adres
                <input
                  value={form.address}
                  onChange={setField("address")}
                  maxLength={SITE_FIELD_MAX}
                  placeholder="ul. Lipowa 5, Kraków"
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1 text-xs text-muted-foreground">
                Inwestor
                <input
                  value={form.investor}
                  onChange={setField("investor")}
                  maxLength={SITE_FIELD_MAX}
                  placeholder="np. Jan Kowalski"
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1 text-xs text-muted-foreground">
                Telefon inwestora
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={setField("phone")}
                  maxLength={SITE_PHONE_MAX}
                  placeholder="600 100 200"
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block min-w-0 space-y-1 text-xs text-muted-foreground">
                  Kierownik budowy
                  <input
                    value={form.manager}
                    onChange={setField("manager")}
                    maxLength={SITE_FIELD_MAX}
                    placeholder="imię"
                    autoComplete="off"
                    className={fieldClass}
                  />
                </label>
                <label className="block min-w-0 space-y-1 text-xs text-muted-foreground">
                  Telefon kierownika
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.managerPhone}
                    onChange={setField("managerPhone")}
                    maxLength={SITE_PHONE_MAX}
                    placeholder="600 100 200"
                    autoComplete="off"
                    className={fieldClass}
                  />
                </label>
                <label className="block min-w-0 space-y-1 text-xs text-muted-foreground">
                  Telefon hurtowni (WhatsApp zamówień)
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.supplierPhone}
                    onChange={setField("supplierPhone")}
                    maxLength={SITE_PHONE_MAX}
                    placeholder="np. hurtownia 22 000 00 00"
                    autoComplete="off"
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="block space-y-1 text-xs text-muted-foreground">
                Dostęp do budowy
                <textarea
                  value={form.access}
                  onChange={setField("access")}
                  maxLength={SITE_ACCESS_MAX}
                  rows={2}
                  placeholder="np. kod do bramy 1234#, klucze u sąsiada spod 7"
                  className={`${fieldClass} resize-none`}
                />
              </label>
              <Button type="submit" disabled={!dirty || !!error} className="w-full coarse:h-11">Zapisz kartę</Button>
            </form>
              )}
            </div>

            {/* Odbiorcy raportu (1.11) — te same dla wszystkich budów, więc formularz jest ten sam co w oknie raportu. */}
            <div className="mx-5 mt-3 rounded-card border border-border bg-card" data-testid="site-recipients">
              <button
                type="button"
                onClick={() => setRecipientsOpen((v) => !v)}
                aria-expanded={recipientsOpen}
                aria-controls="site-card-recipients"
                className="pressable flex w-full items-center gap-2 rounded-card px-3 py-2.5 text-left coarse:min-h-11"
              >
                <Send className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Odbiorcy raportu</span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", !recipients && "text-muted-foreground")}>
                  {recipientsOpen ? "" : recipients || "nie ustawieni"}
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", recipientsOpen && "rotate-180")} aria-hidden />
              </button>
              {recipientsOpen && (
                <div id="site-card-recipients" className="border-t border-border px-3 py-3">
                  <RecipientsForm boss={study.boss} group={study.group} onDone={() => setRecipientsOpen(false)} className="" />
                </div>
              )}
            </div>

            <div className="space-y-3 px-5 py-3">
              <SiteDocsPanel site={site} />
              <SiteServicePanel site={site} />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button variant="outline" onClick={() => leaveTo(onShowEntries)} disabled={site.count === 0} className="coarse:h-11">
                <ListFilter className="mr-1.5 h-4 w-4" aria-hidden />Pokaż wpisy
              </Button>
              <Button variant="outline" onClick={() => leaveTo(onReport)} disabled={site.count === 0} className="coarse:h-11">
                <FileText className="mr-1.5 h-4 w-4" aria-hidden />Raport
              </Button>
              <Button
                variant="outline"
                onClick={zip}
                disabled={site.count === 0 || zipping}
                title="Raport i zdjęcia całej budowy w jednym pliku ZIP"
                className="col-span-2 coarse:h-11"
              >
                <Package className="mr-1.5 h-4 w-4" aria-hidden />{zipping ? "Pakuję…" : "Paczka ZIP"}
              </Button>
              <SiteStorageLine site={site} journal={study.journal} />
              <Button
                variant="outline"
                onClick={() => setHandover(buildHandover(study.journal, site))}
                disabled={site.count === 0 && !site.stages}
                title="Etapy, próby szczelności, uwagi i zdjęcia na jednej kartce z miejscem na podpisy — wydruk albo PDF"
                className="coarse:h-11"
              >
                <ClipboardCheck className="mr-1.5 h-4 w-4" aria-hidden />Protokół odbioru
              </Button>
              <Button
                variant="outline"
                onClick={() => void shareHandover()}
                disabled={site.count === 0 && !site.stages}
                title="Ten sam protokół jako tekst — do wiadomości dla inwestora albo szefa"
                className="coarse:h-11"
              >
                <Share2 className="mr-1.5 h-4 w-4" aria-hidden />Tekst protokołu
              </Button>
              <Button
                variant="outline"
                onClick={() => void pdfHandover()}
                disabled={(site.count === 0 && !site.stages) || pdfBusy}
                title="Protokół jako plik PDF z nagłówkiem firmy, zdjęciami i numerami stron — do wysłania albo wydruku"
                className="coarse:h-11"
              >
                <FileText className="mr-1.5 h-4 w-4" aria-hidden />{pdfBusy ? "Przygotowuję…" : "PDF protokołu"}
              </Button>
              <Button variant="ghost" onClick={toggleArchive} className="col-span-2 text-muted-foreground coarse:h-11">
                {site.archived === undefined
                  ? <><Archive className="mr-1.5 h-4 w-4" aria-hidden />Do archiwum</>
                  : <><ArchiveRestore className="mr-1.5 h-4 w-4" aria-hidden />Przywróć z archiwum</>}
              </Button>
              <AlertDialog open={archiveAsk} onOpenChange={(o) => { if (!archiving) setArchiveAsk(o); }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Zarchiwizować „{site.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>Wpisy zostają. Archiwum nie jest na liście budów; cofnąć można przyciskiem „Przywróć z archiwum”.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={shrinkWithZip} onCheckedChange={(v) => setShrinkWithZip(v === true)} className="mt-0.5" />
                    <span>Zapisz paczkę ZIP i zmniejsz zdjęcia do miniatur (800 px)<span className="block text-xs text-muted-foreground">Oryginały zostaną tylko w paczce. Tej zmiany nie da się cofnąć, dlatego najpierw powstaje ZIP.</span></span>
                  </label>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={archiving}>Anuluj</AlertDialogCancel>
                    <AlertDialogAction disabled={archiving} onClick={(e) => { e.preventDefault(); void doArchive(true, shrinkWithZip); }}>{shrinkWithZip ? "Zapisz ZIP i zarchiwizuj" : "Zarchiwizuj"}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </ResponsiveDialogContent>
      {site && (
        <DayHoursDialog day={hoursOpen ? localDayKey() : null} siteId={site.id} onOpenChange={(o) => { if (!o) setHoursOpen(false); }} />
      )}
      {handover && (
        <PrintRoot testId="handover-print" onDone={endHandover}>
          <HandoverPaper handover={handover} />
        </PrintRoot>
      )}
    </Dialog>
  );
}
