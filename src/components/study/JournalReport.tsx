import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Copy, FilePlusCorner, MapPin, Printer, Share2 } from "lucide-react";
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
import type { JournalEntry, SiteInfo } from "@/lib/study/store";
import { entrySiteId } from "@/lib/study/sites";
import { buildJournalReport, dayKeyOf, reportSummary, reportText, shiftKey, type JournalReport as Report } from "@/lib/study/report";
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
  open, onOpenChange, journal, sites, initialSite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journal: readonly JournalEntry[];
  /** Budowy od ostatnio używanej (`siteDirectory`). */
  sites: SiteInfo[];
  /** Id budowy na start; `null` = ostatnia. */
  initialSite: string | null;
}) {
  const shifts = useShifts();
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
    const s = initialSite ?? sites.find((x) => x.count > 0)?.id ?? null;
    const last = journal.filter((e) => s === null || entrySiteId(e) === s).reduce((m, e) => Math.max(m, e.at), 0);
    const day = last ? dayKeyOf(last) : dayKeyOf(Date.now());
    setSite(s);
    setRange([day, day]);
    setCustom(false);
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

          <div className="bg-muted/30 px-3 py-4 sm:px-6">
            <ReportPaper report={report} />
          </div>

          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-border bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:px-6">
            {canShare ? (
              <Button onClick={share} disabled={empty} className="col-span-2 coarse:h-11 sm:order-last">
                <Share2 className="mr-1.5 h-4 w-4" aria-hidden />Udostępnij{files.length > 0 ? ` (${files.length} zdj.)` : ""}
              </Button>
            ) : null}
            <Button variant={canShare ? "outline" : "default"} onClick={copy} disabled={empty} className={cn("coarse:h-11", !canShare && "col-span-2 sm:order-last")}>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden />Kopiuj tekst
            </Button>
            <Button variant="outline" onClick={toNote} disabled={empty} className="coarse:h-11">
              <FilePlusCorner className="mr-1.5 h-4 w-4" aria-hidden />Do notatki
            </Button>
            <Button variant="outline" onClick={() => setPrinting(true)} disabled={empty} className={cn("coarse:h-11", canShare && "col-span-2 sm:col-span-1")}>
              <Printer className="mr-1.5 h-4 w-4" aria-hidden />Drukuj / PDF
            </Button>
          </div>
        </ResponsiveDialogContent>
      </Dialog>
      {printing && <ReportPrint report={report} onDone={() => setPrinting(false)} />}
    </>
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
    </article>
  );
}

/**
 * Wydruk: raport w osobnym korzeniu pod `body`, a reszta strony schowana stylem
 * `html.printing-report` (index.css). Drukujemy dopiero po wczytaniu zdjęć.
 */
function ReportPrint({ report, onDone }: { report: Report; onDone: () => void }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!root) return;
    let alive = true;
    const html = document.documentElement;
    const finish = () => {
      html.classList.remove("printing-report");
      window.removeEventListener("afterprint", finish);
      if (alive) onDone();
    };
    const loaded = () => [...root.querySelectorAll("img")].every((img) => img.complete) && !root.querySelector('[aria-label="Wczytywanie obrazu"]');
    const started = Date.now();
    const tick = () => {
      if (!alive) return;
      if (!loaded() && Date.now() - started < 3000) { setTimeout(tick, 100); return; }
      html.classList.add("printing-report");
      window.addEventListener("afterprint", finish);
      window.print();
      // Część przeglądarek (Android, Safari) nie wysyła `afterprint` albo `print()` nie czeka
      // na zamknięcie okna — sprzątamy przy pierwszym dotknięciu po powrocie. Klasa działa
      // tylko w `@media print`, więc na ekranie niczego nie zmienia.
      setTimeout(() => { if (alive) window.addEventListener("pointerdown", finish, { once: true }); }, 500);
    };
    tick();
    return () => {
      alive = false;
      html.classList.remove("printing-report");
      window.removeEventListener("afterprint", finish);
      window.removeEventListener("pointerdown", finish);
    };
  }, [root, onDone]);

  return createPortal(
    <div id="report-print" ref={setRoot} data-testid="report-print">
      <ReportPaper report={report} print />
    </div>,
    document.body,
  );
}
