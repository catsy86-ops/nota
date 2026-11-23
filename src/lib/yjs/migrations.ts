import { get as idbGet, del as idbDel, keys as idbKeys, getMany as idbGetMany } from "idb-keyval";
import { loadAll as loadLegacySnapshot } from "@/lib/notesStore";
import { hashImage } from "@/lib/imageHash";
import { isDataUrl } from "@/lib/imageStore";
import { logDiag } from "@/lib/diagnostics";
import { type ImagesById, yNoteFromPlain, yFolderFromPlain } from "./codec";
import type { StoreCtx } from "./context";
import { DANE } from "@/lib/storage/names";

/** Stare formaty obrazów (data URL-e per notatka) — tylko do migracji. */
const LEGACY_IMAGES_KEY = DANE.images;
const IMAGES_PREFIX = DANE.imagesV2Prefix;

/**
 * Jednorazowe migracje przy starcie (F3, krok 5): obrazy ze starych kluczy idb do `imageStore` (manifesty FNV →
 * SHA-256) i notatki z `notesStore.ts` sprzed Yjs. Woła je `ready()` pod blokadą jednej karty.
 */

export function createMigrations(ctx: StoreCtx, migratedKey: string) {
  const { doc, notesMap, foldersMap, labelsMap, images } = ctx;

  /**
   * Podmienia klucze w manifestach (np. stary hash FNV → SHA-256), bez ruszania
   * `updatedAt` — to nie jest zmiana użytkownika. Zwraca liczbę notatek.
   */
  function remapImageRefs(map: Map<string, string>): number {
    if (!map.size) return 0;
    let changed = 0;
    doc.transact(() => {
      notesMap.forEach((y) => {
        const refs = y.get("imageHashes");
        if (!Array.isArray(refs)) return;
        const next = (refs as string[]).map((r) => map.get(r) ?? r);
        if (next.some((r, i) => r !== refs[i])) { y.set("imageHashes", next); changed++; }
      });
    }, "image-migration");
    return changed;
  }

  /**
   * Data URL-e z `kaczy.images.v1`/`v2:*` → `imageStore`, manifesty FNV → SHA-256.
   * Notatka bez manifestu (sprzed jego istnienia) dostaje go z lokalnych obrazów.
   * Klucze FNV, których to urządzenie nie ma, zostają — peer, który ma obraz,
   * podmieni je u siebie. Stare klucze kasowane dopiero po zapisaniu wszystkich
   * obrazów; przerwana migracja powtórzy się przy następnym starcie.
   */
  async function migrateImagesToStore(): Promise<void> {
    const oldKeys = (await idbKeys()).filter((k): k is string => typeof k === "string" && k.startsWith(IMAGES_PREFIX));
    const legacy = await idbGet<ImagesById>(LEGACY_IMAGES_KEY);
    if (!oldKeys.length && !legacy) return;

    const byNote: ImagesById = { ...(legacy ?? {}) };
    const values = await idbGetMany<string[] | undefined>(oldKeys);
    oldKeys.forEach((k, i) => { if (values[i]?.length) byNote[k.slice(IMAGES_PREFIX.length)] = values[i]!; });

    const fnvToSha = new Map<string, string>();
    const localRefs: ImagesById = {};
    try {
      for (const [id, imgs] of Object.entries(byNote)) {
        const refs: string[] = [];
        for (const img of imgs ?? []) {
          if (!isDataUrl(img)) continue;
          const [ref] = await images.ingest([img]);
          if (!ref) continue;
          fnvToSha.set(hashImage(img), ref);
          refs.push(ref);
        }
        localRefs[id] = refs;
      }
    } catch (err) {
      logDiag("error", "yjsStore", "image migration failed — old images kept, will retry", err);
      return;
    }

    doc.transact(() => {
      for (const [id, refs] of Object.entries(localRefs)) {
        const y = notesMap.get(id);
        if (y && !Array.isArray(y.get("imageHashes")) && refs.length) y.set("imageHashes", refs);
      }
    }, "image-migration");
    remapImageRefs(fnvToSha);

    try {
      for (const k of oldKeys) await idbDel(k);
      if (legacy) await idbDel(LEGACY_IMAGES_KEY);
    } catch (err) { logDiag("warn", "yjsStore", "cannot delete migrated image keys", err); }
  }

  async function migrateFromLegacyIfNeeded(): Promise<void> {
    let migrated = false;
    try { migrated = Boolean(localStorage.getItem(migratedKey)); } catch { /* ignore */ }
    if (migrated) return;

    if (notesMap.size > 0 || foldersMap.size > 0 || labelsMap.size > 0) {
      // Doc already has content (e.g. persisted before the flag existed) — nothing to migrate.
      try { localStorage.setItem(migratedKey, "1"); } catch { /* ignore */ }
      return;
    }

    const snapshot = await loadLegacySnapshot();
    if (snapshot.notes.length || snapshot.folders.length || snapshot.labels.length) {
      const notes = await Promise.all(snapshot.notes.map(async (n) => ({ ...n, images: await images.ingest(n.images ?? []) })));
      doc.transact(() => {
        for (const note of notes) notesMap.set(note.id, yNoteFromPlain(note));
        for (const folder of snapshot.folders) foldersMap.set(folder.id, yFolderFromPlain(folder));
        for (const label of snapshot.labels) labelsMap.set(label, true);
      });
    }
    try { localStorage.setItem(migratedKey, "1"); } catch { /* ignore */ }
  }

  return { remapImageRefs, migrateImagesToStore, migrateFromLegacyIfNeeded };
}
