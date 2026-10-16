import { imageStore } from "@/lib/imageStore";
import { buildZip, safeFileName, type ZipEntry } from "@/lib/exportZip";
import { reportText, type JournalReport } from "./report";

/**
 * Paczka budowy: `raport.md` (ten sam tekst co „Kopiuj”) i zdjęcia z raportu w katalogu `zdjecia/`,
 * numerowane w kolejności raportu (od najstarszego). PDF nie wchodzi — wydruk raportu daje PDF w przeglądarce.
 */

const TEXT = new TextEncoder();

export interface SiteZip {
  bytes: Uint8Array;
  /** Ile zdjęć trafiło do paczki. */
  photos: number;
  /** Zdjęć z raportu, których bajty nie są na tym urządzeniu (synchronizacja jeszcze ich nie dostarczyła). */
  missingPhotos: number;
}

type ReadImage = (ref: string) => Promise<{ bytes: ArrayBuffer; type: string } | undefined>;

/** Rozszerzenie z typu MIME, tylko litery i cyfry (`image/jpeg` → `jpg`). */
function extOf(type: string): string {
  const ext = (type.split("/")[1] ?? "").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ext || "jpg";
}

/** Składa ZIP z raportu i jego zdjęć. `read` domyślnie czyta `imageStore`; w testach podstawiany. */
export async function buildSiteZip(report: JournalReport, read: ReadImage = (ref) => imageStore.get(ref), now: Date = new Date()): Promise<SiteZip> {
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
  return { bytes: buildZip(entries, now), photos, missingPhotos };
}

/** Pobranie paczki jako `.zip`, nazwa z tytułu raportu (np. „Raport: Lipowa — 7–14 października 2026”). */
export async function downloadSiteZip(report: JournalReport): Promise<SiteZip> {
  const zip = await buildSiteZip(report);
  const url = URL.createObjectURL(new Blob([zip.bytes as unknown as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(report.title, "Paczka budowy")}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return zip;
}
