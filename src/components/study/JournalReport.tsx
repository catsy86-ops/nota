import { useEffect, useMemo, useState } from "react";
import { Clock, Copy, Ellipsis, FilePlusCorner, Gauge, MapPin, MessageCircle, Printer, Share2, UserPen, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { testLine } from "@/lib/study/pressureTest";
import { fittingsLine } from "@/lib/study/fittings";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPanel } from "@/components/StatusPanel";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { NoteImage } from "@/components/NoteImage";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { formatDuration } from "@/lib/shifts/time";
import { useShifts } from "@/lib/shifts";
import { imageStore } from "@/lib/imageStore";
import { yjsStore } from "@/lib/yjsStore";
import { TOPICS } from "@/lib/study/content";
import { saveBoss, saveGroup, useStudy, type Boss, type JournalEntry, type SiteInfo, type WaGroup } from "@/lib/study/store";
import { formatPhone, whatsappUrl } from "@/lib/study/boss";
import { entrySiteId } from "@/lib/study/sites";
import { buildJournalReport, dayKeyOf, reportSummary, reportText, reportWhatsApp, shiftKey, type JournalReport as Report } from "@/lib/study/report";
import { shortageLine } from "@/lib/study/shortages";
import { PrintRoot } from "./PrintRoot";
import type { JournalReportRequest } from "@/lib/study/reportLink";
import { reportToNote } from "@/lib/study/toNote";
import { KindIcon } from "./JournalEntrySheet";

const topicTitle = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? null;
/** Ile zdjęć dołączać do „Udostępnij” — komunikatory i tak tną więcej. */
const SHARE_MAX_FILES = 10;

type Preset = "today" | "yesterday" | "week" | "month" | "custom";
const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Dziś" },
  { value: "yesterday", label: "Wczoraj" },
  { value: "week", label: "7 dni" },
  { value: "month", label: "Ten miesiąc" },
  { value: "custom", label: "Wybierz" },
];

function presetRange(p: Exclude<Preset, "custom">, today: string): [string, string] {
  if (p === "today") return [today, today];
  if (p === "yesterday") { const y = shiftKey(today, -1); return [y, y]; }
  if (p === "week") return [shiftKey(today, -6), today];
  return [`${today.slice(0, 8)}01`, today];
}

function presetOf(from: string, to: string, today: string): Preset {
  for (const p of ["today", "yesterday", "week", "month"] as const) {
    const [a, b] = presetRange(p, today);
    if (a === from && b === to) return p;
  }
  return "custom";
}

const fieldClass =
  "h-9 min-w-0 w-full rounded-md border border-input bg-background px-2 text-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 md:text-sm";

/**
 * Raport z dziennika: budowa i okres → podgląd jak kartka z zeszytu, a z niego tekst do
 * udostępnienia (z zdjęciami, gdy telefon pozwala), notatka z etykietą „budowa” i wydruk
 * (PDF przez „Zapisz jako PDF” w oknie drukowania). Godziny pracy z Grafiku.
 */
export function JournalReportDialog({
  open, onOpenChange, journal, sites, initialSite, initialRequest = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journal: readonly JournalEntry[];
  /** Budowy od ostatnio używanej (`siteDirectory`). */
  sites: SiteInfo[];
  /** Id budowy na start; `null` = ostatnia. */
  initialSite: string | null;
  /** Otwarcie z przypomnienia: wszystkie budowy i/lub 7 dni zamiast dnia ostatniego wpisu. */
  initialRequest?: JournalReportRequest | null;
}) {
  const shifts = useShifts();
  const { boss, group } = useStudy();
  const [bossEdit, setBossEdit] = useState(false);
  const [site, setSite] = useState<string | null>(null);
  const card = site ? sites.find((x) => x.id === site) ?? null : null;
  const [range, setRange] = useState<[string, string]>(() => { const t = dayKeyOf(Date.now()); return [t, t]; });
  const [printing, setPrinting] = useState(false);
  const [custom, setCustom] = useState(false);
  const today = dayKeyOf(Date.now());
  const hasUnsited = journal.some((e) => !e.site.trim());

  // Przy otwarciu: budowa z filtra albo ostatnia, dzień jej ostatniego wpisu.
  useEffect(() => {
    if (!open) return;
    const s = initialRequest?.allSites ? null : initialSite ?? sites.find((x) => x.count > 0)?.id ?? null;
    const last = journal.filter((e) => s === null || entrySiteId(e) === s).reduce((m, e) => Math.max(m, e.at), 0);
    const day = last ? dayKeyOf(last) : dayKeyOf(Date.now());
    setSite(s);
    setRange(initialRequest?.range === "week" ? presetRange("week", dayKeyOf(Date.now())) : [day, day]);
    setCustom(false);
    setBossEdit(false);
    // Tylko przy otwarciu — później wybiera użytkownik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const report = useMemo(
    () => buildJournalReport(journal, { siteId: site, siteCard: card, from: range[0], to: range[1], shifts, topicTitle }),
    [journal, site, card, range, shifts],
  );
  const preset = presetOf(range[0], range[1], today);
  const showDates = custom || preset === "custom";

  // Zdjęcia do „Udostępnij” wczytane z góry: po kliknięciu przeglądarka daje kilka sekund
  // na `navigator.share`, a wczytanie bajtów z IndexedDB mogłoby je zjeść.
  const files = useShareFiles(open ? report.images : [], report.title);

  async function share() {
    const text = reportText(report);
    const withFiles = files.length > 0 && navigator.canShare?.({ files, text });
    try {
      await navigator.share(withFiles ? { title: report.title, text, files } : { title: report.title, text });
      haptic("success");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") await copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(reportText(report));
      haptic("success");
      toast.success("Skopiowano raport");
    } catch {
      toast.error("Nie udało się skopiować — zaznacz tekst w podglądzie");
    }
  }

  /** Czat WhatsApp z szefem i gotowym tekstem — wysyła użytkownik w komunikatorze. */
  function sendToBoss() {
    if (!boss) { setBossEdit(true); return; }
    window.open(whatsappUrl(boss.phone, reportWhatsApp(report)), "_blank", "noopener,noreferrer");
    haptic("success");
    toast.success(`Otwieram WhatsApp — ${boss.name || "szef"}`, {
      description: report.images.length > 0 ? "Zdjęcia dołączysz w czacie albo przez „Udostępnij”." : undefined,
    });
  }

  /**
   * Do grupy: systemowe „Udostępnij” z tekstem i zdjęciami — w WhatsApp wybierasz grupę
   * (`wa.me` nie otwiera grup z gotowym tekstem). Bez udostępniania: tekst do schowka
   * i otwarcie grupy z linku zaproszenia — wklejasz w czacie.
   */
  async function sendToGroup() {
    if (!group) { setBossEdit(true); return; }
    const text = reportWhatsApp(report);
    if (canShare) {
      const withFiles = files.length > 0 && navigator.canShare?.({ files, text });
      try {
        await navigator.share(withFiles ? { text, files } : { text });
        haptic("success");
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error("Nie udało się skopiować — zaznacz tekst w podglądzie");
      return;
    }
    haptic("success");
    if (group.link) window.open(group.link, "_blank", "noopener,noreferrer");
    toast.success(`Skopiowano raport — wklej w grupie „${group.name}”`);
  }

  function toNote() {
    const note = reportToNote(report);
    yjsStore.upsertNote(note);
    haptic("success");
    toast.success(`Dodano notatkę „${note.title}”`);
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const empty = report.count === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl" data-testid="journal-report">
          <div className="space-y-3 border-b border-border px-5 pb-4 pt-5 sm:px-6">
            <div className="pr-8">
              <DialogTitle className="font-display text-lg">Raport z budowy</DialogTitle>
              <DialogDescription className="text-xs">Godziny pracy z Grafiku. PDF: „Drukuj”, potem „Zapisz jako PDF”.</DialogDescription>
            </div>
            <label className="block">
              <span className="sr-only">Budowa</span>
              <select
                aria-label="Budowa raportu"
                value={site === null ? "all" : `s:${site}`}
                onChange={(ev) => setSite(ev.target.value === "all" ? null : ev.target.value.slice(2))}
                className={fieldClass}
              >
                <option value="all">Wszystkie budowy</option>
                {sites.filter((s) => s.count > 0 || s.id === site).map((s) => (
                  <option key={s.id} value={`s:${s.id}`}>{s.archived !== undefined ? `${s.name} (archiwum)` : s.name}</option>
                ))}
                {hasUnsited && <option value="s:">Bez budowy</option>}
              </select>
            </label>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Okres raportu">
              {PRESETS.map((p) => {
                const on = p.value === "custom" ? showDates : !custom && preset === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      if (p.value === "custom") { setCustom(true); return; }
                      setCustom(false);
                      setRange(presetRange(p.value, today));
                    }}
                    className={cn(
                      "pressable shrink-0 rounded-full border px-3 py-1 text-xs coarse:min-h-11 coarse:px-4 coarse:text-sm",
                      on ? "border-primary bg-primary/10 font-medium text-primary-ink" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {showDates && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Od
                  <input type="date" value={range[0]} max={today} onChange={(ev) => ev.target.value && setRange(([, b]) => [ev.target.value, b])} className={cn(fieldClass, "mt-1 font-mono tabular-nums")} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Do
                  <input type="date" value={range[1]} max={today} onChange={(ev) => ev.target.value && setRange(([a]) => [a, ev.target.value])} className={cn(fieldClass, "mt-1 font-mono tabular-nums")} />
                </label>
              </div>
            )}
          </div>

          {bossEdit && <RecipientsForm boss={boss} group={group} onDone={() => setBossEdit(false)} />}

          <div className="bg-muted/30 px-3 py-4 sm:px-6">
            <ReportPaper report={report} />
          </div>

          {/* Jedna główna akcja — wysłanie przez WhatsApp; „Udostępnij” obok, reszta w „Więcej”. */}
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row-reverse sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 sm:justify-end" data-testid="whatsapp-row">
              {boss || group ? (
                <>
                  {boss && (
                    // Na telefonie sam „Szefowi” — imię nie mieści się obok drugiego przycisku; zostaje w nazwie dla czytnika.
                    <Button onClick={sendToBoss} disabled={empty} aria-label={`Szefowi${boss.name ? ` (${boss.name})` : ""}`} className="min-w-0 flex-1 coarse:h-11 sm:flex-none">
                      <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">Szefowi{boss.name && <span className="max-sm:hidden"> ({boss.name})</span>}</span>
                    </Button>
                  )}
                  {group && (
                    <Button variant={boss ? "outline" : "default"} onClick={sendToGroup} disabled={empty} aria-label={`Do grupy „${group.name}”`} className="min-w-0 flex-1 coarse:h-11 sm:flex-none">
                      <Users className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">Do grupy<span className={cn(boss && "max-sm:hidden")}> „{group.name}”</span></span>
                    </Button>
                  )}
                  {!bossEdit && (
                    <Button variant="ghost" size="sm" onClick={() => setBossEdit(true)} aria-label="Odbiorcy" title="Odbiorcy" className="shrink-0 text-muted-foreground coarse:h-11 coarse:w-11 max-sm:px-0">
                      <UserPen className="h-4 w-4 sm:mr-1.5" aria-hidden /><span className="max-sm:hidden">Odbiorcy</span>
                    </Button>
                  )}
                </>
              ) : (
                <Button onClick={() => setBossEdit(true)} className="min-w-0 flex-1 coarse:h-11 sm:flex-none">
                  <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">WhatsApp: dodaj szefa lub grupę</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {canShare && (
                <Button variant="outline" onClick={share} disabled={empty} className="min-w-0 flex-1 coarse:h-11 sm:flex-none">
                  <Share2 className="mr-1.5 h-4 w-4" aria-hidden />Udostępnij{files.length > 0 ? ` (${files.length} zdj.)` : ""}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={empty} className={cn("coarse:h-11", !canShare && "flex-1 sm:flex-none")}>
                    <Ellipsis className="mr-1.5 h-4 w-4" aria-hidden />Więcej
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="min-w-48">
                  <DropdownMenuItem onSelect={() => void copy()} className="coarse:min-h-11">
                    <Copy className="mr-2 h-4 w-4" aria-hidden />Kopiuj tekst
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={toNote} className="coarse:min-h-11">
                    <FilePlusCorner className="mr-2 h-4 w-4" aria-hidden />Do notatki
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPrinting(true)} className="coarse:min-h-11">
                    <Printer className="mr-2 h-4 w-4" aria-hidden />Drukuj / PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </ResponsiveDialogContent>
      </Dialog>
      {printing && <ReportPrint report={report} onDone={() => setPrinting(false)} />}
    </>
  );
}

/** Odbiorcy raportu w WhatsApp — szef (numer) i grupa; zapisani w danych Pracy, więc są na każdym sparowanym telefonie. */
function RecipientsForm({ boss, group, onDone }: { boss: Boss | null; group: WaGroup | null; onDone: () => void }) {
  const [name, setName] = useState(boss?.name ?? "");
  const [phone, setPhone] = useState(boss ? formatPhone(boss.phone) : "");
  const [groupName, setGroupName] = useState(group?.name ?? "");
  const [groupLink, setGroupLink] = useState(group?.link ?? "");
  const [phoneError, setPhoneError] = useState(false);
  const [linkError, setLinkError] = useState(false);
  function save() {
    const phoneOk = saveBoss(name, phone);
    const linkOk = saveGroup(groupName, groupLink);
    setPhoneError(!phoneOk);
    setLinkError(!linkOk);
    if (!phoneOk || !linkOk) return;
    haptic("success");
    toast.success("Zapisano odbiorców");
    onDone();
  }
  return (
    <form
      className="space-y-4 border-b border-border px-5 py-4 sm:px-6"
      aria-label="Odbiorcy raportu w WhatsApp"
      onSubmit={(ev) => { ev.preventDefault(); save(); }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Szef</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Imię
            <input value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="name" placeholder="np. Marek" className={cn(fieldClass, "mt-1")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Numer WhatsApp
            <input
              value={phone}
              onChange={(ev) => { setPhone(ev.target.value); setPhoneError(false); }}
              type="tel" inputMode="tel" autoComplete="tel" placeholder="600 100 200"
              aria-invalid={phoneError}
              aria-describedby="boss-phone-hint"
              className={cn(fieldClass, "mt-1 font-mono tabular-nums", phoneError && "border-destructive")}
            />
          </label>
        </div>
        <p id="boss-phone-hint" className={cn("text-xs", phoneError ? "text-destructive" : "text-muted-foreground")}>
          {phoneError
            ? "To nie wygląda na numer — 9 cyfr albo z kierunkowym, np. +48 600 100 200."
            : "Raport otworzy się w czacie z szefem — wysyłasz Ty. Pusty numer usuwa szefa."}
        </p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Grupa</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Nazwa grupy
            <input value={groupName} onChange={(ev) => setGroupName(ev.target.value)} placeholder="np. Brygada Lipowa" className={cn(fieldClass, "mt-1")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Link zaproszenia (opcjonalnie)
            <input
              value={groupLink}
              onChange={(ev) => { setGroupLink(ev.target.value); setLinkError(false); }}
              // Bez `type="url"`: link bez „https://” zatrzymałaby walidacja przeglądarki — `normalizeGroupLink` go przyjmuje.
              inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="chat.whatsapp.com/…"
              aria-invalid={linkError}
              aria-describedby="group-link-hint"
              className={cn(fieldClass, "mt-1", linkError && "border-destructive")}
            />
          </label>
        </div>
        <p id="group-link-hint" className={cn("text-xs", linkError ? "text-destructive" : "text-muted-foreground")}>
          {linkError
            ? "To nie jest link grupy — w WhatsApp: grupa → Zaproś przez link → Kopiuj."
            : "Raport ze zdjęciami idzie przez „Udostępnij” — w WhatsApp wybierz tę grupę. Link przydaje się, gdy telefon nie ma udostępniania. Pusta nazwa usuwa grupę."}
        </p>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="coarse:h-11">Zapisz</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} className="coarse:h-11">Anuluj</Button>
      </div>
    </form>
  );
}

/** Pliki zdjęć do `navigator.share`; brakujące na tym urządzeniu pomija. */
function useShareFiles(refs: string[], title: string): File[] {
  const [files, setFiles] = useState<File[]>([]);
  const key = refs.slice(0, SHARE_MAX_FILES).join(",");
  useEffect(() => {
    let alive = true;
    if (!key || typeof navigator.canShare !== "function") { setFiles([]); return; }
    const base = title.replace(/[\\/:*?"<>|—]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "raport";
    void Promise.all(key.split(",").map((ref) => imageStore.get(ref).catch(() => undefined))).then((recs) => {
      if (!alive) return;
      const out: File[] = [];
      recs.forEach((rec, i) => {
        if (!rec) return;
        const ext = rec.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
        out.push(new File([rec.bytes], `${base} ${i + 1}.${ext}`, { type: rec.type }));
      });
      setFiles(out);
    });
    return () => { alive = false; };
  }, [key, title]);
  return files;
}

/** Raport jak kartka: ten sam układ w podglądzie i na wydruku. */
function ReportPaper({ report, print = false }: { report: Report; print?: boolean }) {
  const tests = report.days.flatMap((d) => d.entries).filter((r) => r.entry.test);
  return (
    <article className={cn("report-paper rounded-xl border border-border bg-card px-4 py-4 sm:px-6", print && "border-0 px-0")} aria-label="Podgląd raportu">
      <header className="border-b-2 border-foreground/80 pb-2">
        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
          {report.site === null ? "Wszystkie budowy" : report.site || "Bez budowy"}
        </p>
        {(report.address || report.investor) && (
          <p className="text-xs text-muted-foreground" data-testid="report-site-card">
            {[report.address, report.investor && `inwestor: ${report.investor}`].filter(Boolean).join(" · ")}
          </p>
        )}
        <h2 className="font-display text-xl leading-tight">{report.period}</h2>
        <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground" data-testid="report-summary">{reportSummary(report)}</p>
      </header>

      {report.days.length > 1 && <DaysTable report={report} />}

      {report.count === 0 ? (
        <StatusPanel size="inline" tone="no-results" title="Brak wpisów z tej budowy w tym okresie." description="Zmień budowę albo okres." className="my-4" />
      ) : (
        <div className="divide-y divide-border/70">
          {report.days.map((d) => (
            <section key={d.key} className="break-inside-avoid-page py-3" data-report-day={d.key}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h3 className="text-sm font-semibold first-letter:uppercase">{d.label}</h3>
                {d.work && (
                  <p className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground" data-report-work>
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {d.work.minutes > 0 ? `${d.work.label} · ${formatDuration(d.work.minutes)}` : d.work.label}
                  </p>
                )}
              </div>
              <ul className="space-y-2">
                {d.entries.map((r) => (
                  <li key={r.entry.id} className="grid grid-cols-[2.75rem_1rem_minmax(0,1fr)] gap-x-2 text-sm" data-report-entry={r.entry.kind}>
                    <span className="pt-px font-mono text-xs tabular-nums text-muted-foreground">{r.time}</span>
                    <KindIcon kind={r.entry.kind} className="mt-0.5 h-4 w-4" />
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap wrap-break-word leading-snug">{r.entry.text.trim() || "Sprawdzone punkty listy"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className={cn(r.status === "Problem otwarty" && "font-medium text-foreground")}>{r.status}</span>
                        {r.site && <> · {r.site}</>}
                        {r.topic && <> · {r.topic}</>}
                      </p>
                      {r.entry.fittings && r.entry.fittings.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground" data-report-fittings>Kształtki: {fittingsLine(r.entry.fittings)}</p>
                      )}
                      {r.entry.test && (
                        <p className={cn("mt-0.5 inline-flex items-start gap-1 text-xs font-medium", r.entry.test.ok ? "text-success-ink" : "text-destructive")} data-report-test>
                          <Gauge className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{testLine(r.entry.test)}
                        </p>
                      )}
                      {r.entry.images.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Zdjęcia wpisu">
                          {r.entry.images.map((ref) => (
                            <li key={ref}>
                              <NoteImage
                                imageRef={ref}
                                alt=""
                                loading="eager"
                                className={cn("rounded-md object-cover", print ? "h-32 w-32" : "h-14 w-14")}
                                placeholderClassName={print ? "h-32 w-32" : "h-14 w-14"}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {tests.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-tests>
              <h3 className="mb-1.5 text-sm font-semibold">Próby szczelności</h3>
              <ul className="space-y-0.5 text-sm">
                {tests.map((r) => (
                  <li key={r.entry.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{shortDay(r.entry.at)} {r.time}</span>
                    <span className={cn(!r.entry.test!.ok && "font-medium text-destructive")}>{testLine(r.entry.test!)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.fittings.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-fittings-sum>
              <h3 className="mb-1.5 text-sm font-semibold">Kształtki (suma)</h3>
              <table className="w-full max-w-sm text-sm">
                <tbody>
                  {report.fittings.map((f) => (
                    <tr key={f.name} className="border-t border-border/60 first:border-t-0">
                      <td className="py-0.5 pr-3">{f.name}</td>
                      <td className="py-0.5 text-right font-mono tabular-nums">{f.qty} szt.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {report.stages && report.stages.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-stages>
              <h3 className="mb-1.5 text-sm font-semibold">
                Etapy ({report.stages.filter((s) => s.done !== undefined).length}/{report.stages.length})
              </h3>
              <ul className="space-y-0.5 text-sm">
                {report.stages.map((s) => (
                  <li key={s.id} className="flex items-baseline gap-2" data-stage-done={s.done !== undefined || undefined}>
                    <span aria-hidden className={s.done !== undefined ? "text-success-ink" : "text-muted-foreground"}>{s.done !== undefined ? "✓" : "○"}</span>
                    <span className={s.done !== undefined ? "" : "text-muted-foreground"}>{s.name}</span>
                    {s.done !== undefined && (
                      <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                        {new Date(s.done).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}
                      </span>
                    )}
                    <span className="sr-only">{s.done !== undefined ? "zrobione" : "do zrobienia"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.shortages.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-shortages>
              <h3 className="mb-1.5 text-sm font-semibold">Braki materiału</h3>
              <ul className="space-y-0.5 text-sm">
                {report.shortages.map((s) => <li key={s.id}>{shortageLine(s)}</li>)}
              </ul>
            </section>
          )}
          {report.toOrder.length > 0 && (
            <section className="break-inside-avoid-page pt-3" data-report-to-order>
              <h3 className="mb-1.5 text-sm font-semibold">Do zamówienia</h3>
              <table className="w-full max-w-sm text-sm">
                <tbody>
                  {report.toOrder.map((f) => (
                    <tr key={f.name} className="border-t border-border/60 first:border-t-0">
                      <td className="py-0.5 pr-3">{f.name}</td>
                      <td className="py-0.5 text-right font-mono tabular-nums">{f.qty} szt.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {report.open.length > 0 && (
            <section className="break-inside-avoid-page pt-3">
              <h3 className="mb-1.5 text-sm font-semibold">Otwarte problemy</h3>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {report.open.map((r) => <li key={r.entry.id} className="wrap-break-word">{r.entry.text.trim().split("\n")[0] || "bez opisu"}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Druk firmowy: miejsce na podpisy i datę sporządzenia — raport jako dokument odbioru. */}
      {report.count > 0 && (
        <footer className="mt-4 grid grid-cols-2 gap-6 border-t border-border pt-6 text-xs text-muted-foreground break-inside-avoid-page" data-report-signatures>
          <div>
            <div className="h-10 border-b border-dashed border-foreground/50" />
            <p className="mt-1">Wykonawca (podpis)</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-foreground/50" />
            <p className="mt-1">Odbierający / kierownik (podpis)</p>
          </div>
          <p className="col-span-2 font-mono tabular-nums">Sporządzono: {new Date().toLocaleDateString("pl-PL")}</p>
        </footer>
      )}
    </article>
  );
}

const shortDay = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });

/** Zestawienie dni na górze raportu (od dwóch dni): dzień, praca z Grafiku, wpisy, problemy. */
function DaysTable({ report }: { report: Report }) {
  return (
    <table className="mt-3 w-full text-left text-xs" data-report-days-table>
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 pr-2 font-medium">Dzień</th>
          <th className="py-1 pr-2 font-medium">Praca</th>
          <th className="py-1 pr-2 text-right font-medium">Wpisy</th>
          <th className="py-1 text-right font-medium">Problemy</th>
        </tr>
      </thead>
      <tbody className="font-mono tabular-nums">
        {report.days.map((d) => (
          <tr key={d.key} className="border-t border-border/60">
            <td className="py-1 pr-2">{d.key.slice(8, 10)}.{d.key.slice(5, 7)}</td>
            <td className="py-1 pr-2 font-sans">{d.work ? (d.work.minutes > 0 ? formatDuration(d.work.minutes) : d.work.label) : "—"}</td>
            <td className="py-1 pr-2 text-right">{d.entries.length}</td>
            <td className="py-1 text-right">{d.entries.filter((r) => r.entry.kind === "problem").length || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Wydruk raportu: wspólny mechanizm z protokołem odbioru (`PrintRoot`). */
function ReportPrint({ report, onDone }: { report: Report; onDone: () => void }) {
  return (
    <PrintRoot onDone={onDone}>
      <ReportPaper report={report} print />
    </PrintRoot>
  );
}
