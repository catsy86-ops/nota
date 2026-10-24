import { imageStore } from "@/lib/imageStore";
import { buildZip, safeFileName, type ZipEntry } from "@/lib/exportZip";
import { reportText, type JournalReport } from "./report";
import type { SiteDoc } from "./siteDocs";
import { downloadBlob } from "@/lib/downloadBlob";

/**
 * Paczka budowy: `raport.md` (ten sam tekst co „Kopiuj”) i zdjęcia z raportu w katalogu `zdjecia/`,
 * numerowane w kolejności raportu (od najstarszego), nagrania głosowe wpisów w `nagrania/` (1.10 planu
 * Praca 2026-10-24) oraz plany i dokumenty karty budowy w `dokumenty/` — jedne i drugie pod własnymi
 * nazwami. PDF raportu nie wchodzi — wydruk raportu daje PDF w przeglądarce.
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
  /** Nagrania w paczce oraz te, których bajtów nie ma na tym urządzeniu. */
  recordings: number;
  missingRecordings: number;
}

/**
 * Nazwa pliku w katalogu paczki: bezpieczna, z rozszerzeniem z nazwy albo typu; powtórzona nazwa dostaje
 * numer, żeby drugi plik nie nadpisał pierwszego w archiwum. `used` — nazwy już zajęte w tym katalogu.
 */
function uniqueName(used: Set<string>, original: string, type: string, fallback: string): string {
  const dot = original.lastIndexOf(".");
  const base = safeFileName(dot > 0 ? original.slice(0, dot) : original, fallback);
  const ext = dot > 0 ? original.slice(dot + 1).replace(/[^a-z0-9]/gi, "").toLowerCase() || extOf(type) : extOf(type);
  let name = `${base}.${ext}`;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n}).${ext}`;
  used.add(name.toLowerCase());
  return name;
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
    entries.push({ name: `dokumenty/${uniqueName(used, d.name, d.type, "dokument")}`, data: new Uint8Array(rec.bytes) });
    docs++;
  }
  let recordings = 0;
  let missingRecordings = 0;
  const usedAudio = new Set<string>();
  for (const a of report.recordings ?? []) {
    const rec = await read(a.hash).catch(() => undefined);
    if (!rec) { missingRecordings++; continue; }
    entries.push({ name: `nagrania/${uniqueName(usedAudio, a.name, a.type || rec.type, "nagranie")}`, data: new Uint8Array(rec.bytes) });
    recordings++;
  }
  return { bytes: buildZip(entries, now), photos, missingPhotos, docs, missingDocs, recordings, missingRecordings };
}

/** Pobranie paczki jako `.zip`, nazwa z tytułu raportu (np. „Raport: Lipowa — 7–14 października 2026”). */
export async function downloadSiteZip(report: JournalReport, docs: readonly SiteDoc[] = []): Promise<SiteZip> {
  const zip = await buildSiteZip(report, undefined, undefined, docs);
  downloadBlob(new Blob([zip.bytes as unknown as BlobPart], { type: "application/zip" }), `${safeFileName(report.title, "Paczka budowy")}.zip`);
  return zip;
}
