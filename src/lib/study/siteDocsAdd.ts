import { addAttachmentFiles, describeRejections, MAX_ATTACHMENT_BYTES, formatFileSize } from "@/lib/attachments";
import { imageStore } from "@/lib/imageStore";
import { prepareImage } from "@/lib/imagePrepare";
import { yjsStore } from "@/lib/yjsStore";
import { SITE_DOCS_MAX, type SiteDoc } from "./siteDocs";

/**
 * Dodaje pliki do dokumentów budowy: obrazy zmniejszone (`prepareImage`) do `imageStore`,
 * PDF-y przez `addAttachmentFiles` (limit 10 MB na plik i łączny limit załączników). Inne typy
 * są pomijane. Zwraca nowe pozycje i komunikat o pominiętych (albo `null`).
 */
export async function addSiteDocFiles(files: File[], current: readonly SiteDoc[], now: number = Date.now()): Promise<{ added: SiteDoc[]; message: string | null }> {
  const added: SiteDoc[] = [];
  const skipped: string[] = [];
  const have = new Set(current.map((d) => d.id));
  const room = () => SITE_DOCS_MAX - current.length - added.length;
  const pdfs: File[] = [];

  for (const file of files) {
    if (file.type.startsWith("image/")) {
      if (room() <= 0) { skipped.push(`${file.name} (limit ${SITE_DOCS_MAX} plików)`); continue; }
      try {
        const prepared = await prepareImage(file);
        if (!prepared) { skipped.push(file.name); continue; }
        const id = await imageStore.putBlob(prepared);
        if (have.has(id)) continue;
        have.add(id);
        added.push({ id, name: file.name, size: prepared.size, type: prepared.type || "image/jpeg", at: now + added.length });
      } catch {
        skipped.push(file.name);
      }
    } else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      pdfs.push(file);
    } else {
      skipped.push(`${file.name} (tylko zdjęcia i PDF)`);
    }
  }

  let pdfMessage: string | null = null;
  if (pdfs.length > 0) {
    // Łączny limit liczy załączniki notatek i PDF-y budów (te same bajty w magazynie).
    const used = new Map<string, number>();
    yjsStore.referencedAttachments().forEach((a, h) => used.set(h, a.size));
    for (const d of current) if (!d.type.startsWith("image/")) used.set(d.id, d.size);
    const pdfRoom = Math.max(0, room());
    if (pdfs.length > pdfRoom) skipped.push(`${pdfs.length - pdfRoom} PDF (limit ${SITE_DOCS_MAX} plików)`);
    const res = await addAttachmentFiles(pdfs.slice(0, pdfRoom), {
      current: current.filter((d) => !d.type.startsWith("image/")).map((d) => ({ hash: d.id, name: d.name, size: d.size, type: d.type })),
      used,
    });
    for (const a of res.added) added.push({ id: a.hash, name: a.name, size: a.size, type: "application/pdf", at: now + added.length });
    pdfMessage = describeRejections(res.rejected);
  }

  const parts = [skipped.length > 0 ? `Pominięte: ${skipped.join(", ")}.` : null, pdfMessage].filter(Boolean);
  return { added, message: parts.length ? parts.join(" ") : null };
}

export const SITE_DOC_LIMIT_TEXT = `zdjęcia i PDF do ${formatFileSize(MAX_ATTACHMENT_BYTES)}`;
