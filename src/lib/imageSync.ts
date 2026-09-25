import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { yjsStore } from "@/lib/yjsStore";
import { roomNameFor } from "@/lib/yjsSync";

/**
 * P2P image sync (follow-up to yjsSync.ts's Phase 2 text/metadata sync — see
 * roadmap.md). Images are deliberately kept OUT of the main Yjs doc (see the
 * big comment in yjsStore.ts): that doc is persisted to disk via y-indexeddb
 * for every user, sync-enabled or not, so eagerly mirroring every image's
 * binary data into it would bloat local storage for people who never turn
 * sync on. Instead this module owns a SEPARATE, in-memory-only Y.Doc used
 * purely as a sync transport buffer — it exists only while P2P sync is
 * connected and is never written to IndexedDB, so it can't accumulate
 * unbounded local storage the way the main doc eventually will (that's the
 * separate "kompresja/GC doc-a Yjs" backlog item).
 *
 * Each note's Y.Map (in the MAIN doc) already carries `imageHashes` — a tiny
 * list of content hashes, cheap to sync unconditionally (see yjsStore.ts).
 * That's the "manifest": it tells a device an image is expected even before
 * the actual bytes arrive. This module bridges the gap:
 *  - mirrors this device's own images into the transport doc's `blobs` map
 *    (hash -> base64), keyed by content hash so identical images already
 *    known to a peer are never resent (Yjs diffs by state vector anyway).
 *  - watches `blobs` for hashes appearing that a local note's manifest
 *    expects but this device doesn't have yet, and copies them in.
 *
 * Known limitation (documented, not silently swallowed): only two devices
 * that are online with sync connected AT THE SAME TIME exchange images live.
 * A device that was offline when a peer added an image gets it on next
 * reconnect via the full local mirror `connect()` does — same requirement
 * SyncSettings.tsx already states for text/metadata sync.
 */

let imagesDoc: Y.Doc | null = null;
let provider: WebrtcProvider | null = null;
let blobs: Y.Map<string> | null = null;
let unobserveBlobs: (() => void) | null = null;
let unobserveNotes: (() => void) | null = null;

function mirrorLocalImages() {
  if (!blobs) return;
  const doc = imagesDoc;
  if (!doc) return;
  doc.transact(() => {
    for (const note of yjsStore.projectNotes()) {
      const hashes = yjsStore.getImageHashes(note.id);
      const local = yjsStore.getLocalImages(note.id);
      hashes.forEach((hash, i) => {
        const base64 = local[i];
        if (base64 && !blobs!.has(hash)) blobs!.set(hash, base64);
      });
    }
  });
}

/** Fills in any images this device is missing but a connected peer already sent. */
function reconcileMissingImages() {
  if (!blobs) return;
  for (const note of yjsStore.projectNotes()) {
    const hashes = yjsStore.getImageHashes(note.id);
    if (hashes.length === 0) continue;
    const local = yjsStore.getLocalImages(note.id);
    if (local.length >= hashes.length) continue; // nothing missing (position-level drift is a known v1 limitation)
    const next = local.slice();
    let changed = false;
    for (let i = local.length; i < hashes.length; i++) {
      const found = blobs.get(hashes[i]);
      if (found) { next[i] = found; changed = true; }
    }
    if (changed) yjsStore.setImagesLocal(note.id, next.filter(Boolean));
  }
}

/** Starts the image transport for a pairing code; safe to call if already started (restarts). */
export function startImageSync(code: string): void {
  stopImageSync();
  imagesDoc = new Y.Doc();
  blobs = imagesDoc.getMap<string>("blobs");
  provider = new WebrtcProvider(`${roomNameFor(code)}-img`, imagesDoc, { password: code });

  const onBlobsChange = () => reconcileMissingImages();
  blobs.observe(onBlobsChange);
  unobserveBlobs = () => blobs?.unobserve(onBlobsChange);

  const onNotesChange = () => { mirrorLocalImages(); reconcileMissingImages(); };
  yjsStore.notesMap.observeDeep(onNotesChange);
  unobserveNotes = () => yjsStore.notesMap.unobserveDeep(onNotesChange);

  provider.on("peers", () => {
    // A peer (re)joined — resend our full local set so it can backfill
    // images it missed while offline, and check if it has ones we're missing.
    mirrorLocalImages();
    reconcileMissingImages();
  });

  mirrorLocalImages();
  reconcileMissingImages();
}

export function stopImageSync(): void {
  unobserveBlobs?.();
  unobserveBlobs = null;
  unobserveNotes?.();
  unobserveNotes = null;
  provider?.destroy();
  provider = null;
  imagesDoc?.destroy();
  imagesDoc = null;
  blobs = null;
}
