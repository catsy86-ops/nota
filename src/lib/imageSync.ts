import * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import { yjsStore } from "@/lib/yjsStore";
import { providerOptions, roomNamesFor } from "@/lib/yjsSync";
import { logDiag } from "@/lib/diagnostics";

/**
 * P2P image sync (follow-up to yjsSync.ts's Phase 2 text/metadata sync — see
 * roadmap.md). Image bytes are deliberately kept OUT of the main Yjs doc (see
 * yjsStore.ts): that doc is persisted to disk via y-indexeddb for every user,
 * sync-enabled or not. Instead this module owns a SEPARATE, in-memory-only
 * Y.Doc used purely as a sync transport buffer — it exists only while P2P
 * sync is connected and is never written to IndexedDB.
 *
 * Each note's Y.Map (in the MAIN doc) carries `imageHashes` — the SHA-256
 * keys of its images, synced unconditionally with the note. That's the
 * manifest: it tells a device an image is expected even before the bytes
 * arrive. This module bridges the gap:
 *  - mirrors every referenced image this device has in `imageStore` into the
 *    transport doc's `blobs` map (hash -> {t: type, b: bytes}), so identical
 *    images already known to a peer are never resent.
 *  - watches `blobs` for hashes a manifest expects but `imageStore` lacks,
 *    verifies the bytes against the hash and stores them. The UI picks them up
 *    through `imageStore.onAdded` — notes themselves don't change.
 *
 * Room suffix `-img2`: the v1 transport carried base64 under FNV hashes; a
 * peer still running it must not read binary values it doesn't understand.
 *
 * Known limitation: only two devices online with sync connected AT THE SAME
 * TIME exchange images live — same requirement SyncSettings.tsx states for text.
 */

interface WireImage { t: string; b: Uint8Array }

let imagesDoc: Y.Doc | null = null;
let providers: WebrtcProvider[] = [];
let blobs: Y.Map<WireImage> | null = null;
let cleanups: (() => void)[] = [];
// Bumped on every startImageSync()/stopImageSync() so a dynamic
// import("y-webrtc") still in flight from a superseded call backs off.
let startToken = 0;
/** Jeden przebieg naraz; zmiana w trakcie = jeszcze jeden przebieg po nim. */
let running: Promise<void> | null = null;
let rerun = false;

function isWireImage(v: unknown): v is WireImage {
  return !!v && typeof v === "object" && typeof (v as WireImage).t === "string" && (v as WireImage).b instanceof Uint8Array;
}

async function mirrorLocalImages(map: Y.Map<WireImage>, token: number): Promise<void> {
  const images = yjsStore.images;
  for (const ref of yjsStore.referencedImages()) {
    if (token !== startToken) return;
    if (map.has(ref) || !images.has(ref)) continue;
    const rec = await images.get(ref);
    if (rec && token === startToken && !map.has(ref)) map.set(ref, { t: rec.type, b: new Uint8Array(rec.bytes) });
  }
}

/** Fills in images a manifest expects, this device lacks and a connected peer already sent. */
async function reconcileMissingImages(map: Y.Map<WireImage>, token: number): Promise<void> {
  const images = yjsStore.images;
  for (const ref of yjsStore.referencedImages()) {
    if (token !== startToken) return;
    if (images.has(ref)) continue;
    const wire = map.get(ref);
    if (!isWireImage(wire)) continue;
    try { await images.putBytes(wire.b, wire.t, ref); }
    catch (err) { logDiag("warn", "imageSync", "rejected image from peer", err); }
  }
}

function sync(): void {
  const map = blobs;
  if (!map) return;
  if (running) { rerun = true; return; }
  const token = startToken;
  running = (async () => {
    await mirrorLocalImages(map, token);
    await reconcileMissingImages(map, token);
  })().finally(() => {
    running = null;
    if (rerun) { rerun = false; sync(); }
  });
}

/** Starts the image transport for a pairing code; safe to call if already started (restarts). */
export function startImageSync(code: string): void {
  stopImageSync();
  const token = ++startToken;
  const doc = new Y.Doc();
  imagesDoc = doc;
  const blobsMap = doc.getMap<WireImage>("blobs");
  blobs = blobsMap;

  const onChange = () => sync();
  blobsMap.observe(onChange);
  yjsStore.notesMap.observeDeep(onChange);
  const offAdded = yjsStore.images.onAdded(onChange);
  cleanups = [
    () => blobsMap.unobserve(onChange),
    () => yjsStore.notesMap.unobserveDeep(onChange),
    offAdded,
  ];

  void yjsStore.images.load().then(() => { if (token === startToken) sync(); });

  // Same eager-bundle concern as yjsSync.ts's connect() — defer y-webrtc
  // itself until a sync session is actually starting.
  // Te same pokoje co tekst (nowy + stary w okresie przejściowym), z sufiksem „-img2”.
  Promise.all([import("y-webrtc"), roomNamesFor(code)]).then(([{ WebrtcProvider }, rooms]) => {
    if (token !== startToken) return; // superseded by a later start/stop
    providers = rooms.map((room) => {
      const p = new WebrtcProvider(`${room}-img2`, doc, providerOptions(code));
      // A peer (re)joined — offer our images and check for ones we're missing.
      p.on("peers", onChange);
      return p;
    });
  });
}

export function stopImageSync(): void {
  startToken++;
  cleanups.forEach((c) => c());
  cleanups = [];
  providers.forEach((p) => p.destroy());
  providers = [];
  imagesDoc?.destroy();
  imagesDoc = null;
  blobs = null;
}

/** Test-only: czeka na bieżący przebieg mirror/reconcile. */
export async function imageSyncSettledForTests(): Promise<void> {
  while (running) await running;
}
