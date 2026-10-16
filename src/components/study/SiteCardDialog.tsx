import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ClipboardCheck, FileText, ListFilter, MapPin, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { haptic } from "@/lib/haptics";
import { useShifts } from "@/lib/shifts";
import { pluralPl } from "@/lib/plural";
import { TOPICS } from "@/lib/study/content";
import { saveSiteCard, setSiteArchived, useStudy } from "@/lib/study/store";
import { findSiteByName, siteDirectory, SITE_FIELD_MAX, SITE_NAME_MAX } from "@/lib/study/sites";
import { entriesPl, problemsPl } from "@/lib/study/journalView";
import { buildJournalReport, periodLabel, dayKeyOf } from "@/lib/study/report";
import { downloadSiteZip } from "@/lib/study/siteZip";
import { SiteOrderPanel } from "./SiteOrderPanel";
import { SiteStagesPanel } from "./SiteStagesPanel";
import { SiteShortagesPanel } from "./SiteShortagesPanel";
import { PrintRoot } from "./PrintRoot";
import { HandoverPaper } from "./HandoverPaper";
import { buildHandover, type Handover } from "@/lib/study/handover";

const topicTitle = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? null;

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm";

/**
 * Karta budowy: nazwa, adres i inwestor (trafiają do raportu), ile wpisów i otwartych
 * problemów, od kiedy do kiedy. Z karty prosto do wpisów tej budowy albo raportu.
 * Archiwum chowa budowę z pigułek — wpisy zostają na osi czasu.
 */
export function SiteCardDialog({
  siteId, onOpenChange, onShowEntries, onReport,
}: {
  /** Otwarta karta; `null` = zamknięta. */
  siteId: string | null;
  onOpenChange: (open: boolean) => void;
  onShowEntries: (siteId: string) => void;
  onReport: (siteId: string) => void;
}) {
  const study = useStudy();
  const shifts = useShifts();
  const dir = useMemo(() => siteDirectory(study.sites, study.journal), [study.sites, study.journal]);
  const site = siteId ? dir.find((s) => s.id === siteId) ?? null : null;
  const [form, setForm] = useState({ name: "", address: "", investor: "" });
  const [zipping, setZipping] = useState(false);
  /** Protokół odbioru w trakcie drukowania; `null` = nie drukujemy. */
  const [handover, setHandover] = useState<Handover | null>(null);
  const endHandover = useCallback(() => setHandover(null), []);

  useEffect(() => {
    if (site) setForm({ name: site.name, address: site.address, investor: site.investor });
    // Tylko przy otwarciu innej karty — zmiany z drugiego telefonu nie kasują pisanego tekstu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const name = form.name.trim();
  const clash = name ? findSiteByName(dir.filter((s) => s.id !== siteId), name) : undefined;
  const dirty = !!site && (name !== site.name || form.address.trim() !== site.address || form.investor.trim() !== site.investor);
  const error = !name ? "Podaj nazwę budowy" : clash ? `Jest już budowa „${clash.name}”` : null;

  function save() {
    if (!site || error) return;
    if (saveSiteCard(site.id, form)) {
      haptic("success");
      toast.success("Zapisano kartę budowy");
    }
  }

  /** Cała budowa (od pierwszego do ostatniego wpisu) w jednym ZIP: raport.md i zdjęcia. */
  async function zip() {
    if (!site || site.first == null || site.last == null) return;
    setZipping(true);
    try {
      const report = buildJournalReport(study.journal, {
        siteId: site.id,
        siteCard: site,
        from: dayKeyOf(site.first),
        to: dayKeyOf(site.last),
        shifts,
        topicTitle,
      });
      const res = await downloadSiteZip(report);
      haptic("success");
      const photos = `${res.photos} ${pluralPl(res.photos, ["zdjęcie", "zdjęcia", "zdjęć"])}`;
      toast.success(
        res.missingPhotos > 0
          ? `Paczka gotowa: raport i ${photos}. ${res.missingPhotos} bez bajtów na tym urządzeniu — pominięte.`
          : `Paczka gotowa: raport i ${photos}`,
      );
    } catch {
      toast.error("Nie udało się przygotować paczki");
    } finally {
      setZipping(false);
    }
  }

  function toggleArchive() {
    if (!site) return;
    if (dirty && !error) saveSiteCard(site.id, form);
    const archive = site.archived === undefined;
    setSiteArchived(site.id, archive);
    haptic("tap");
    toast.success(archive ? `„${site.name}” w archiwum — wpisy zostają` : `„${site.name}” znów na liście budów`);
    if (archive) onOpenChange(false);
  }

  const period = site?.first != null && site.last != null ? periodLabel(dayKeyOf(site.first), dayKeyOf(site.last)) : null;

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-md" data-testid="site-card">
        {site && (
          <>
            <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
              <DialogTitle className="flex items-center gap-1.5 font-display text-lg">
                <MapPin className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
                <span className="truncate">{site.name}</span>
              </DialogTitle>
              <DialogDescription className="font-mono text-xs tabular-nums" data-testid="site-card-stats">
                {[
                  entriesPl(site.count),
                  site.open > 0 && `otwarte: ${problemsPl(site.open)}`,
                  period,
                  site.archived !== undefined && "w archiwum",
                ].filter(Boolean).join(" · ")}
              </DialogDescription>
            </div>

            <form
              className="space-y-3 px-5 py-4"
              onSubmit={(e) => { e.preventDefault(); save(); }}
            >
              <label className="block space-y-1 text-xs text-muted-foreground">
                Nazwa
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  maxLength={SITE_NAME_MAX}
                  aria-invalid={!!error}
                  aria-describedby={error ? "site-card-error" : undefined}
                  className={fieldClass}
                />
              </label>
              {error && <p id="site-card-error" className="text-xs text-destructive" role="alert">{error}</p>}
              <label className="block space-y-1 text-xs text-muted-foreground">
                Adres
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
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
                  onChange={(e) => setForm((f) => ({ ...f, investor: e.target.value }))}
                  maxLength={SITE_FIELD_MAX}
                  placeholder="np. Jan Kowalski"
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
              <Button type="submit" disabled={!dirty || !!error} className="w-full coarse:h-11">Zapisz kartę</Button>
            </form>

            <div className="space-y-3 px-5 pb-4">
              <SiteStagesPanel site={site} />
              <SiteOrderPanel site={site} />
              <SiteShortagesPanel site={site} />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button variant="outline" onClick={() => onShowEntries(site.id)} disabled={site.count === 0} className="coarse:h-11">
                <ListFilter className="mr-1.5 h-4 w-4" aria-hidden />Pokaż wpisy
              </Button>
              <Button variant="outline" onClick={() => onReport(site.id)} disabled={site.count === 0} className="coarse:h-11">
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
              <Button
                variant="outline"
                onClick={() => setHandover(buildHandover(study.journal, site))}
                disabled={site.count === 0 && !site.stages}
                title="Etapy, próby szczelności, uwagi i zdjęcia na jednej kartce z miejscem na podpisy — wydruk albo PDF"
                className="col-span-2 coarse:h-11"
              >
                <ClipboardCheck className="mr-1.5 h-4 w-4" aria-hidden />Protokół odbioru
              </Button>
              <Button variant="ghost" onClick={toggleArchive} className="col-span-2 text-muted-foreground coarse:h-11">
                {site.archived === undefined
                  ? <><Archive className="mr-1.5 h-4 w-4" aria-hidden />Do archiwum</>
                  : <><ArchiveRestore className="mr-1.5 h-4 w-4" aria-hidden />Przywróć z archiwum</>}
              </Button>
            </div>
          </>
        )}
      </ResponsiveDialogContent>
      {handover && (
        <PrintRoot testId="handover-print" onDone={endHandover}>
          <HandoverPaper handover={handover} />
        </PrintRoot>
      )}
    </Dialog>
  );
}
