import { shareOrCopy } from "@/lib/shareOrCopy";
import { useEffect, useMemo, useState } from "react";
import { Copy, Ellipsis, FilePlusCorner, MessageCircle, Printer, Share2, UserPen, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useShifts } from "@/lib/shifts";
import { imageStore } from "@/lib/imageStore";
import { yjsStore } from "@/lib/yjsStore";
import { topicTitle } from "@/lib/study/content";
import { useStudy, type JournalEntry, type SiteInfo } from "@/lib/study/store";
import { whatsappUrl } from "@/lib/study/boss";
import { entrySiteId } from "@/lib/study/sites";
import { buildJournalReport, dayKeyOf, reportText, reportWhatsApp } from "@/lib/study/report";
import { presetOf, presetRange, REPORT_PRESETS } from "@/lib/study/reportPresets";
import type { JournalReportRequest } from "@/lib/study/reportLink";
import { reportToNote } from "@/lib/study/toNote";
import { RecipientsForm } from "./RecipientsForm";
import { ReportPaper, ReportPrint } from "./ReportPaper";

/** Ile zdjęć dołączać do „Udostępnij” — komunikatory i tak tną więcej. */
const SHARE_MAX_FILES = 10;

const fieldClass =
  "h-9 min-w-0 w-full rounded-control border border-input bg-background px-2 text-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 md:text-sm";

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

  // Karty wszystkich budów — podział godzin dnia między budowy (`siteHours.ts`).
  const cards = useMemo(() => Object.fromEntries(sites.map((x) => [x.id, x])), [sites]);
  const report = useMemo(
    () => buildJournalReport(journal, { siteId: site, siteCard: card, sites: cards, from: range[0], to: range[1], shifts, topicTitle }),
    [journal, site, card, cards, range, shifts],
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
    const outcome = await shareOrCopy({ text, files });
    if (outcome === "shared") { haptic("success"); return; }
    if (outcome === "cancelled") return;
    if (outcome === "failed") { toast.error("Nie udało się skopiować — zaznacz tekst w podglądzie"); return; }
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
  const empty = report.days.length === 0;

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
              {REPORT_PRESETS.map((p) => {
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
