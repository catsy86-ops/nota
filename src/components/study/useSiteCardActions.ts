import { useState } from "react";
import { toast } from "sonner";
import { shareOrCopy } from "@/lib/shareOrCopy";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import { topicTitle } from "@/lib/study/content";
import { setSiteArchived, useSiteDirectory, useStudy } from "@/lib/study/store";
import type { SiteInfo } from "@/lib/study/sites";
import { buildJournalReport, dayKeyOf } from "@/lib/study/report";
import { downloadSiteZip } from "@/lib/study/siteZip";
import { shrinkSitePhotos } from "@/lib/study/photoShrink";
import { buildHandover, handoverText } from "@/lib/study/handover";
import { getSitePoints } from "@/lib/study/pointsStore";
import type { HandoverPdfPhoto } from "@/lib/study/handoverPdf";
import { companyNameStore } from "@/lib/study/companyPrefs";
import { imageStore } from "@/lib/imageStore";
import { useShifts } from "@/lib/shifts";

type Dir = ReturnType<typeof useSiteDirectory>;

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/**
 * Akcje z karty budowy, które nie są formularzem (P6.2): paczka ZIP, protokół,
 * archiwizacja z pytaniem i zmniejszaniem zdjęć. Zapis niezapisanych zmian robi
 * okno (`persistDirty`), a po archiwizacji zamyka je `onArchived`.
 */
export function useSiteCardActions({
  site, study, dir, shifts, persistDirty, onArchived,
}: {
  site: SiteInfo | null;
  study: ReturnType<typeof useStudy>;
  dir: Dir;
  shifts: ReturnType<typeof useShifts>;
  persistDirty: () => boolean;
  onArchived: () => void;
}) {
  const [zipping, setZipping] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  // P-4 (plan Pracy 3.3): archiwizacja pyta; „zapisz ZIP i zmniejsz zdjęcia” jest domyślnie wyłączone.
  const [archiveAsk, setArchiveAsk] = useState(false);
  const [shrinkWithZip, setShrinkWithZip] = useState(false);
  const [archiving, setArchiving] = useState(false);

  /** Cała budowa (od pierwszego do ostatniego wpisu) w jednym ZIP: raport.md i zdjęcia. */
  async function zip(): Promise<boolean> {
    if (!site || site.first == null || site.last == null) return false;
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
      const audio = res.recordings > 0 ? `, ${res.recordings} ${pluralPl(res.recordings, ["nagranie", "nagrania", "nagrań"])}` : "";
      const missing = res.missingPhotos + res.missingDocs + res.missingRecordings;
      toast.success(
        missing > 0
          ? `Paczka gotowa: raport i ${photos}${docs}${audio}. ${missing} bez bajtów na tym urządzeniu — pominięte.`
          : `Paczka gotowa: raport i ${photos}${docs}${audio}`,
      );
      return true;
    } catch {
      toast.error("Nie udało się przygotować paczki");
      return false;
    } finally {
      setZipping(false);
    }
  }

  /** Tekst protokołu (bez zdjęć): udostępnianie z telefonu, a bez niego — schowek. */
  async function shareHandover() {
    if (!site) return;
    const text = handoverText(buildHandover(study.journal, site, Date.now(), getSitePoints(site.id)));
    const outcome = await shareOrCopy({ title: `Protokół odbioru — ${site.name}`, text });
    if (outcome === "copied") toast.success("Skopiowano tekst protokołu");
    else if (outcome === "failed") toast.error("Nie udało się skopiować");
  }

  /** P2.5: protokół jako PDF — zdjęcia z magazynu, podpis z wpisu, nazwa firmy z Ustawień; udostępnia albo pobiera. */
  async function pdfHandover() {
    if (!site) return;
    setPdfBusy(true);
    try {
      const h = buildHandover(study.journal, site, Date.now(), getSitePoints(site.id));
      const photos: HandoverPdfPhoto[] = [];
      for (const ref of h.photos) {
        const rec = await imageStore.get(ref);
        if (!rec) continue;
        const entry = study.journal.find((e) => e.images.includes(ref));
        const dataUrl = await blobToDataUrl(new Blob([rec.bytes], { type: rec.type }));
        photos.push({ dataUrl, caption: entry?.captions?.[ref] ?? (entry ? new Date(entry.at).toLocaleDateString("pl-PL") : "") });
      }
      // Generator PDF leniwie: rzadko używany, poza precache (jak sam jsPDF).
      const { buildHandoverPdf, handoverPdfName, sharePdf } = await import("@/lib/study/handoverPdf");
      const blob = await buildHandoverPdf(h, { company: companyNameStore.get(), photos });
      const outcome = await sharePdf(blob, handoverPdfName(site.name));
      if (outcome === "downloaded") toast.success("Zapisano protokół PDF");
    } catch {
      toast.error("Nie udało się przygotować PDF protokołu");
    } finally {
      setPdfBusy(false);
    }
  }

  function toggleArchive() {
    if (!site) return;
    if (site.archived !== undefined) { void doArchive(false, false); return; }
    setShrinkWithZip(false);
    setArchiveAsk(true);
  }

  async function doArchive(archive: boolean, shrink: boolean) {
    if (!site) return;
    setArchiving(true);
    try {
      if (archive && shrink) {
        // Najpierw ZIP: bez zapisanej paczki zdjęcia zostają w pełnym rozmiarze.
        if (!(await zip())) return;
        const { shrunk, skipped } = await shrinkSitePhotos(study.journal.filter((en) => en.siteId === site.id));
        if (skipped > 0) toast.info(`${skipped} zdjęć zostało w pełnym rozmiarze — tej przeglądarki nie umie ich zmniejszyć`);
        haptic("success");
        toast.success(`Zmniejszono ${shrunk} zdjęć do miniatur — oryginały są w paczce`);
      }
      persistDirty();
      setSiteArchived(site.id, archive);
      haptic("tap");
      toast.success(archive ? `„${site.name}” w archiwum — wpisy zostają` : `„${site.name}” znów na liście budów`);
      if (archive) onArchived();
    } finally {
      setArchiving(false);
      setArchiveAsk(false);
    }
  }

  return {
    zipping, zip, shareHandover, pdfHandover, pdfBusy,
    archiveAsk, setArchiveAsk, shrinkWithZip, setShrinkWithZip, archiving, toggleArchive, doArchive,
  };
}
