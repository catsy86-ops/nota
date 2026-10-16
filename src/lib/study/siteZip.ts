import { imageStore } from "@/lib/imageStore";
import { buildZip, safeFileName, type ZipEntry } from "@/lib/exportZip";
import { reportText, type JournalReport } from "./report";
import type { SiteDoc } from "./siteDocs";

/**
 * Paczka budowy: `raport.md` (ten sam tekst co „Kopiuj”) i zdjęcia z raportu w katalogu `zdjecia/`,
 * numerowane w kolejności raportu (od najstarszego), oraz plany i dokumenty karty budowy w `dokumenty/`
 * pod własnymi nazwami. PDF raportu nie wchodzi — wydruk raportu daje PDF w przeglądarce.
 */

const TEXT = new TextEncoder();

export interface SiteZip {
  bytes: Uint8Array;
  /** Ile zdjęć trafiło do paczki. */
  photos: number;
  /** Zdjęć z raportu, których bajty nie są na tym urządzeniu (synchronizacja jeszcze ich nie dostarczyła). */
  missingPhotos: number;
  /** Plany i dokumenty w paczce oraz te, których bajtów nie ma na tym urządzeniu. */
  docs: number;
  missingDocs: number;
}

type ReadImage = (ref: string) => Promise<{ bytes: ArrayBuffer; type: string } | undefined>;

/** Rozszerzenie z typu MIME, tylko litery i cyfry (`image/jpeg` → `jpg`). */
function extOf(type: string): string {
  const ext = (type.split("/")[1] ?? "").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ext || "jpg";
}

/** Składa ZIP z raportu i jego zdjęć. `read` domyślnie czyta `imageStore`; w testach podstawiany. */
export async function buildSiteZip(
  report: JournalReport,
  read: ReadImage = (ref) => imageStore.get(ref),
  now: Date = new Date(),
  siteDocs: readonly SiteDoc[] = [],
): Promise<SiteZip> {
  const entries: ZipEntry[] = [{ name: "raport.md", data: TEXT.encode(reportText(report)) }];
  // Numer z zerami wiodącymi, żeby zdjęcia sortowały się jak w raporcie.
  const width = Math.max(2, String(report.images.length).length);
  let photos = 0;
  let missingPhotos = 0;
  for (const [i, ref] of report.images.entries()) {
    const rec = await read(ref).catch(() => undefined);
    if (!rec) { missingPhotos++; continue; }
    const num = String(i + 1).padStart(width, "0");
    entries.push({ name: `zdjecia/${num}.${extOf(rec.type)}`, data: new Uint8Array(rec.bytes) });
    photos++;
  }
  let docs = 0;
  let missingDocs = 0;
  const used = new Set<string>();
  for (const d of siteDocs) {
    const rec = await read(d.id).catch(() => undefined);
    if (!rec) { missingDocs++; continue; }
    // Dwa pliki o tej samej nazwie — drugi z numerem, żeby nie nadpisał pierwszego w archiwum.
    const dot = d.name.lastIndexOf(".");
    const base = safeFileName(dot > 0 ? d.name.slice(0, dot) : d.name, "dokument");
    const ext = dot > 0 ? d.name.slice(dot + 1).replace(/[^a-z0-9]/gi, "").toLowerCase() || extOf(d.type) : extOf(d.type);
    let name = `${base}.${ext}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n}).${ext}`;
    used.add(name.toLowerCase());
    entries.push({ name: `dokumenty/${name}`, data: new Uint8Array(rec.bytes) });
    docs++;
  }
  return { bytes: buildZip(entries, now), photos, missingPhotos, docs, missingDocs };
}

/** Pobranie paczki jako `.zip`, nazwa z tytułu raportu (np. „Raport: Lipowa — 7–14 października 2026”). */
export async function downloadSiteZip(report: JournalReport, docs: readonly SiteDoc[] = []): Promise<SiteZip> {
  const zip = await buildSiteZip(report, undefined, undefined, docs);
  const url = URL.createObjectURL(new Blob([zip.bytes as unknown as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(report.title, "Paczka budowy")}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return zip;
}
