import type { Note } from "@/hooks/useNotes";

/**
 * Cross-context note sync.
 *
 * The app has no server: the same notes can still be edited in several places
 * at once (two tabs, two windows, an installed PWA + the browser). Each context
 * broadcasts the notes it just saved; receivers either fast-forward silently
 * (when their copy was untouched) or raise an edit conflict for the user.
 */

const CHANNEL = "kaczy.notes.sync.v1";

export const CONTEXT_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

export type SyncMessage = {
  from: string;
  at: number;
  changed: Note[];
  deleted: string[];
};

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    try { channel = new BroadcastChannel(CHANNEL); } catch { return null; }
  }
  return channel;
}

export function broadcastChanges(changed: Note[], deleted: string[]) {
  if (!changed.length && !deleted.length) return;
  const ch = getChannel();
  if (!ch) return;
  const msg: SyncMessage = { from: CONTEXT_ID, at: Date.now(), changed, deleted };
  try { ch.postMessage(msg); } catch { /* ignore */ }
}

export function subscribeToChanges(handler: (msg: SyncMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (e: MessageEvent<SyncMessage>) => {
    const msg = e.data;
    if (!msg || msg.from === CONTEXT_ID) return;
    handler(msg);
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}

/** Fields whose divergence counts as a real edit conflict. */
const FIELDS: (keyof Note)[] = [
  "title", "content", "color", "pinned", "archived", "trashed",
  "labels", "reminder", "images", "checklist", "folderId",
];

export function notesDiffer(a: Note, b: Note): boolean {
  return FIELDS.some((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
}

/** Short human summary of what differs between two versions. */
export function describeDifference(local: Note, remote: Note): string[] {
  const out: string[] = [];
  if (local.title !== remote.title) out.push("tytuł");
  if (local.content !== remote.content) out.push("treść");
  if (JSON.stringify(local.checklist) !== JSON.stringify(remote.checklist)) out.push("lista zadań");
  if (JSON.stringify(local.labels) !== JSON.stringify(remote.labels)) out.push("etykiety");
  if (local.color !== remote.color) out.push("kolor");
  if (local.folderId !== remote.folderId) out.push("folder");
  if (local.pinned !== remote.pinned) out.push("przypięcie");
  if (local.archived !== remote.archived) out.push("archiwum");
  if (local.trashed !== remote.trashed) out.push("kosz");
  if (local.reminder !== remote.reminder) out.push("przypomnienie");
  if (JSON.stringify(local.images) !== JSON.stringify(remote.images)) out.push("zdjęcia");
  return out;
}

export interface NoteConflict {
  id: string;
  local: Note;
  remote: Note;
  detectedAt: number;
}
