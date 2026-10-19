import { addAttachmentFiles, describeRejections, type Attachment } from "@/lib/attachments";
import { yjsStore } from "@/lib/yjsStore";
import { getStudy } from "./store";
import { JOURNAL_MAX_RECORDINGS } from "./yStudy";

/**
 * Nagranie głosowe z budowy (U8): jeden plik audio jako osobny załącznik wpisu, nie zdjęcie.
 * Bajty idą przez `addAttachmentFiles` — te same limity, hash i zapis co w notatkach. Łączny limit
 * liczy załączniki notatek, pliki budów i nagrania wszystkich wpisów (wszystkie w jednym magazynie).
 */
export async function addRecording(file: File, current: Attachment[]): Promise<{ added: Attachment | null; message: string | null }> {
  if (current.length >= JOURNAL_MAX_RECORDINGS) {
    return { added: null, message: `Jeden wpis ma najwyżej ${JOURNAL_MAX_RECORDINGS} nagrania.` };
  }
  const used = new Map<string, number>();
  yjsStore.referencedAttachments().forEach((a, hash) => used.set(hash, a.size));
  for (const e of getStudy().journal) for (const r of e.recordings ?? []) used.set(r.hash, r.size);
  const res = await addAttachmentFiles([file], { current, used });
  return { added: res.added[0] ?? null, message: describeRejections(res.rejected) };
}
