import { isImageRef } from "@/lib/imageStore";
import { sanitizeFileName } from "@/lib/attachments";

/**
 * Plany i dokumenty budowy (H3): rzuty, projekt, zdjęcia tablic — przypięte do karty budowy.
 * Pozycja listy karty (`SiteCard.docs`, w mapie `studySiteItems` jako rodzaj `docs`), id = klucz
 * bajtów w `imageStore` (SHA-256). Obraz przechodzi przez `prepareImage` (jak zdjęcie wpisu), PDF —
 * przez `addAttachmentFiles` (limity załączników). Sprzątanie, kopia i synchronizacja widzą te klucze
 * przez `journalRefsIn`. Czysta logika; dodawanie plików w `siteDocsAdd.ts`.
 */

export interface SiteDoc {
  /** Klucz bajtów w `imageStore`. */
  id: string;
  name: string;
  /** Rozmiar bajtów (po zmniejszeniu obrazu). */
  size: number;
  /** MIME: `image/*` albo `application/pdf`. */
  type: string;
  /** Moment dodania (ms). */
  at: number;
}

export const SITE_DOCS_MAX = 30;
export const SITE_DOC_TYPES = "image/*,application/pdf";

export const isImageDoc = (d: Pick<SiteDoc, "type">) => d.type.startsWith("image/");

export function cleanSiteDocs(raw: unknown): SiteDoc[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: SiteDoc[] = [];
  for (const d of raw as Partial<SiteDoc>[]) {
    if (!d || typeof d.id !== "string" || !isImageRef(d.id) || seen.has(d.id)) continue;
    const type = typeof d.type === "string" && (d.type.startsWith("image/") || d.type === "application/pdf") ? d.type : null;
    if (!type) continue;
    seen.add(d.id);
    out.push({
      id: d.id,
      name: sanitizeFileName(typeof d.name === "string" ? d.name : "", isImageDoc({ type }) ? "plan.jpg" : "dokument.pdf"),
      size: typeof d.size === "number" && Number.isFinite(d.size) && d.size >= 0 ? d.size : 0,
      type,
      at: typeof d.at === "number" && Number.isFinite(d.at) ? d.at : 0,
    });
    if (out.length >= SITE_DOCS_MAX) break;
  }
  return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

/** Nazwa bez rozszerzenia — podpis pod miniaturą („Rzut parteru”). */
export const docLabel = (d: Pick<SiteDoc, "name">) => d.name.replace(/\.[a-z0-9]{1,5}$/i, "");
