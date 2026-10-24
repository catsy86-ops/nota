import { useCallback, useEffect, useState } from "react";
import { Archive, ArchiveRestore, ClipboardCheck, FileText, KeyRound, ListFilter, MapPin, MessageSquare, Navigation, Package, Phone, Share2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { haptic } from "@/lib/haptics";
import { useShifts } from "@/lib/shifts";
import { pluralPl } from "@/lib/plural";
import { topicTitle } from "@/lib/study/content";
import { saveSiteCard, setSiteArchived, useSiteDirectory, useStudy } from "@/lib/study/store";
import { findSiteByName, SITE_FIELD_MAX, SITE_NAME_MAX } from "@/lib/study/sites";
import { entriesPl, problemsPl } from "@/lib/study/journalView";
import { buildJournalReport, periodLabel, dayKeyOf } from "@/lib/study/report";
import { downloadSiteZip } from "@/lib/study/siteZip";
import { SiteOrderPanel } from "./SiteOrderPanel";
import { SiteStagesPanel } from "./SiteStagesPanel";
import { SiteShortagesPanel } from "./SiteShortagesPanel";
import { SiteDocsPanel } from "./SiteDocsPanel";
import { SiteServicePanel } from "./SiteServicePanel";
import { PrintRoot } from "./PrintRoot";
import { HandoverPaper } from "./HandoverPaper";
import { buildHandover, handoverText, type Handover } from "@/lib/study/handover";
import { mapsHref, prettyPhone, smsHref, SITE_ACCESS_MAX, SITE_PHONE_MAX, telHref } from "@/lib/study/contact";


const EMPTY_FORM = { name: "", address: "", investor: "", phone: "", manager: "", managerPhone: "", supplierPhone: "", access: "" };
type SiteForm = typeof EMPTY_FORM;
const formOf = (s: Partial<SiteForm>): SiteForm => ({ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(s).filter(([k, v]) => k in EMPTY_FORM && typeof v === "string")) });

/** Szybka akcja w karcie: link (telefon, SMS, Mapy) wyglądający jak przycisk. */
function QuickLink({ href, icon: Icon, children, label }: { href: string; icon: typeof Phone; children: React.ReactNode; label?: string }) {
  const external = href.startsWith("https:");
  return (
    <Button asChild variant="outline" size="sm" className="pressable h-10 min-w-0 justify-start gap-1.5 coarse:h-11">
      <a href={href} aria-label={label} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        <Icon className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
        <span className="truncate">{children}</span>
      </a>
    </Button>
  );
}

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm";

/**
 * Karta budowy: nazwa, adres i inwestor (trafiają do raportu), ile wpisów i otwartych
 * problemów, od kiedy do kiedy. Z karty prosto do wpisów tej budowy albo raportu.
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
  const [zipping, setZipping] = useState(false);
  /** Protokół odbioru w trakcie drukowania; `null` = nie drukujemy. */
  const [handover, setHandover] = useState<Handover | null>(null);
  const endHandover = useCallback(() => setHandover(null), []);

  useEffect(() => {
    if (site) setForm(formOf(site));
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

  /** Cała budowa (od pierwszego do ostatniego wpisu) w jednym ZIP: raport.md i zdjęcia. */
  async function zip() {
    if (!site || site.first == null || site.last == null) return;
    setZipping(true);
    try {
      const report = buildJournalReport(study.journal, {
        siteId: site.id,
        siteCard: site,
        sites: Object.fromEntries(dir.map((x) => [x.id, x])),
        from: dayKeyOf(site.first),
        to: dayKeyOf(site.last),
        shifts,
        topicTitle,
      });
      const res = await downloadSiteZip(report, site.docs ?? []);
      haptic("success");
      const photos = `${res.photos} ${pluralPl(res.photos, ["zdjęcie", "zdjęcia", "zdjęć"])}`;
      const docs = res.docs > 0 ? `, ${res.docs} ${pluralPl(res.docs, ["dokument", "dokumenty", "dokumentów"])}` : "";
      const missing = res.missingPhotos + res.missingDocs;
      toast.success(
        missing > 0
          ? `Paczka gotowa: raport i ${photos}${docs}. ${missing} bez bajtów na tym urządzeniu — pominięte.`
          : `Paczka gotowa: raport i ${photos}${docs}`,
      );
    } catch {
      toast.error("Nie udało się przygotować paczki");
    } finally {
      setZipping(false);
    }
  }

  /** Tekst protokołu (bez zdjęć): udostępnianie z telefonu, a bez niego — schowek. */
  async function shareHandover() {
    if (!site) return;
    const text = handoverText(buildHandover(study.journal, site));
    const copy = async () => {
      try { await navigator.clipboard.writeText(text); toast.success("Skopiowano tekst protokołu"); } catch { toast.error("Nie udało się skopiować"); }
    };
    if (typeof navigator.share !== "function") { await copy(); return; }
    try {
      await navigator.share({ title: `Protokół odbioru — ${site.name}`, text });
    } catch (e) {
      // Anulowanie okna udostępniania to nie błąd; inny problem — kopia do schowka.
      if ((e as { name?: string } | null)?.name !== "AbortError") await copy();
    }
  }

  /** Niezapisana zmiana idzie do karty przed każdym wyjściem z okna — nie gubimy wpisanych danych po cichu. */
  function persistDirty(): boolean {
    if (!site || !dirty || error) return false;
    saveSiteCard(site.id, form);
    return true;
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

  function toggleArchive() {
    if (!site) return;
    persistDirty();
    const archive = site.archived === undefined;
    setSiteArchived(site.id, archive);
    haptic("tap");
    toast.success(archive ? `„${site.name}” w archiwum — wpisy zostają` : `„${site.name}” znów na liście budów`);
    if (archive) onOpenChange(false);
  }

  // Szybkie akcje z zapisanej karty (nie z pisanego formularza) — numer przed zapisem nie dzwoni.
  const nav = site ? mapsHref(site.address) : null;
  const call = site?.phone ? telHref(site.phone) : null;
  const sms = site?.phone ? smsHref(site.phone) : null;
  const callManager = site?.managerPhone ? telHref(site.managerPhone) : null;
  const setField = (k: keyof SiteForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const period = site?.first != null && site.last != null ? periodLabel(dayKeyOf(site.first), dayKeyOf(site.last)) : null;

  return (
    <Dialog open={!!site} onOpenChange={close}>
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
                  <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground" data-testid="site-access">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
                    <span className="min-w-0 whitespace-pre-line break-words"><span className="sr-only">Dostęp: </span>{site.access}</span>
                  </p>
                )}
              </div>
            )}

            <form
              className="space-y-3 px-5 py-4"
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

            <div className="space-y-3 px-5 pb-4">
              <SiteStagesPanel site={site} />
              <SiteOrderPanel site={site} />
              <SiteShortagesPanel site={site} />
              <SiteDocsPanel site={site} />
              <SiteServicePanel site={site} />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button onClick={() => leaveTo(onNewEntry)} className="col-span-2 coarse:h-11">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />Wpis tutaj
              </Button>
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
