import { isAttachmentSyncable, type Attachment } from "@/lib/attachments";
import { journalRefsIn } from "@/lib/study/journalRefs";
import { planRefsIn } from "@/lib/plans/planRefs";
import { debtProofRefsIn } from "@/lib/debts/proofs";
import { plainAttachments } from "./codec";
import type { StoreCtx } from "./context";

/**
 * Odwołania do bajtów w `imageStore` (F3): obrazy i załączniki notatek, zdjęcia dziennika budowy, plany i dowody
 * długów. Wejście dla GC (co jest używane) i synchronizacji plików (co wolno wysłać).
 */

export function createFileRefsApi(ctx: StoreCtx) {
  const { doc, notesMap } = ctx;

  /**
   * Wszystkie klucze bajtów w `imageStore`, do których odwołuje się jakakolwiek
   * notatka (także w Koszu) albo wpis dziennika z budowy: obrazy ORAZ załączniki. To wejście dla GC — blob
   * używany przez inną notatkę (ten sam hash) nigdy nie jest kandydatem.
   */
  function referencedImages(): Set<string> {
    const refs = new Set<string>();
    notesMap.forEach((y) => {
      const list = y.get("imageHashes");
      if (Array.isArray(list)) for (const r of list) if (typeof r === "string") refs.add(r);
      for (const a of plainAttachments(y.get("attachments"))) refs.add(a.hash);
    });
    // Zdjęcia dziennika z budowy (Nauka) — te same bajty w `imageStore`.
    for (const r of journalRefsIn(doc)) refs.add(r);
    // Obrazy analiz planów (oryginał i kopia robocza).
    for (const r of planRefsIn(doc)) refs.add(r);
    // Zdjęcia dowodów długów (L4.3).
    for (const r of debtProofRefsIn(doc)) refs.add(r);
    return refs;
  }

  /** Obrazy i załączniki podanych notatek (Z-6.5: odnowienie karencji przy trwałym usunięciu). */
  function noteFileRefs(ids: readonly string[]): string[] {
    const refs = new Set<string>();
    for (const id of ids) {
      const y = notesMap.get(id);
      if (!y) continue;
      const list = y.get("imageHashes");
      if (Array.isArray(list)) for (const r of list) if (typeof r === "string") refs.add(r);
      for (const a of plainAttachments(y.get("attachments"))) refs.add(a.hash);
    }
    return [...refs];
  }

  /** Załączniki wszystkich notatek: hash → manifest (rozmiar do limitu łącznego i backupu). */
  function referencedAttachments(): Map<string, Attachment> {
    const out = new Map<string, Attachment>();
    notesMap.forEach((y) => {
      for (const a of plainAttachments(y.get("attachments"))) if (!out.has(a.hash)) out.set(a.hash, a);
    });
    return out;
  }

  /**
   * Klucze, które wolno wysłać innemu urządzeniu (P2P, plik sync): wszystkie
   * obrazy (także zdjęcia dziennika z budowy) i załączniki do `ATTACHMENT_SYNC_MAX_BYTES`. Większe pliki są
   * lokalne dla urządzenia (UI mówi o tym wprost).
   */
  function syncableRefs(): Set<string> {
    const refs = new Set<string>();
    notesMap.forEach((y) => {
      const list = y.get("imageHashes");
      if (Array.isArray(list)) for (const r of list) if (typeof r === "string") refs.add(r);
    });
    referencedAttachments().forEach((a, hash) => { if (isAttachmentSyncable(a)) refs.add(hash); });
    for (const r of journalRefsIn(doc, true)) refs.add(r);
    // Plany: kopia robocza zawsze, oryginał tylko do 2 MB (D3).
    for (const r of planRefsIn(doc, true)) refs.add(r);
    // Dowody długów: po `prepareImage` (do 2 MB), więc jadą zawsze.
    for (const r of debtProofRefsIn(doc)) refs.add(r);
    return refs;
  }

  return { referencedImages, noteFileRefs, referencedAttachments, syncableRefs };
}
