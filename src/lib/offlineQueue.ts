import type { Note } from "@/hooks/useNotes";

/**
 * Offline change queue.
 *
 * Every note mutation is written *synchronously* to localStorage before the
 * async IndexedDB write happens. If the browser is offline, crashes, or the
 * tab is closed mid-write, the queued ops are replayed on the next load so no
 * edit is ever lost.
 *
 * Ops are confirmed (dropped) only once the IndexedDB write for that sequence
 * number has actually resolved.
 */

const QUEUE_KEY = "kaczy.offline.queue.v1";
const MAX_OPS = 500;

export type QueuedOp =
  | { seq: number; ts: number; label?: string; type: "upsert"; noteId: string; note: Note }
  | { seq: number; ts: number; label?: string; type: "patch"; noteId: string; patch: Partial<Note> }
  | { seq: number; ts: number; label?: string; type: "delete"; noteId: string };

let seqCounter = 0;

export const QUEUE_EVENT = "kaczy:offline-queue";
/** Dispatched by the queue panel to ask the store to retry persisting now. */
export const RETRY_EVENT = "kaczy:offline-retry";
/** Dispatched when queued-but-unsynced changes had to be dropped (storage quota). */
export const QUEUE_DATA_LOST_EVENT = "kaczy:offline-queue-data-lost";

export function requestRetry() {
  try { window.dispatchEvent(new CustomEvent(RETRY_EVENT)); } catch { /* ignore */ }
}
const SYNC_KEY = "kaczy.offline.lastSync.v1";

export type QueueEventDetail = {
  /** Ops still waiting to be persisted. */
  pending: number;
  /** Ops confirmed as persisted by this event (empty when the queue only grew). */
  confirmed: QueuedOp[];
  /** Timestamp of the last fully-synced queue, or null if never synced. */
  lastSyncAt: number | null;
};

/** Human label for a queued op, e.g. "Lista zakupów". */
export function opLabel(op: QueuedOp): string {
  if (op.label) return op.label;
  if (op.type === "upsert") return noteLabel(op.note);
  return "Notatka";
}

export function noteLabel(note: Partial<Note> | undefined): string {
  const title = (note?.title || "").trim();
  if (title) return title.length > 40 ? `${title.slice(0, 40)}…` : title;
  const body = (note?.content || "").replace(/\s+/g, " ").trim();
  if (body) return body.length > 40 ? `${body.slice(0, 40)}…` : body;
  return "Notatka bez tytułu";
}

export function getLastSyncAt(): number | null {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function setLastSyncAt(ts: number) {
  try { localStorage.setItem(SYNC_KEY, String(ts)); } catch { /* ignore */ }
}

function emit(confirmed: QueuedOp[] = []) {
  try {
    const detail: QueueEventDetail = {
      pending: getQueue().length,
      confirmed,
      lastSyncAt: getLastSyncAt(),
    };
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail }));
  } catch {
    /* ignore */
  }
}

export function getQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const ops: QueuedOp[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(ops) ? ops : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: QueuedOp[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch {
    // Quota exceeded (usually image-heavy notes): drop payload-heavy fields and retry.
    const slim = ops.slice(-Math.ceil(MAX_OPS / 5)).map((op) =>
      op.type === "upsert" ? { ...op, note: { ...op.note, images: [] } } : op
    );
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(slim));
    } catch {
      const droppedCount = ops.length;
      try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
      try {
        window.dispatchEvent(new CustomEvent(QUEUE_DATA_LOST_EVENT, { detail: { droppedCount } }));
      } catch { /* ignore */ }
    }
  }
}

function nextSeq(): number {
  const q = getQueue();
  const max = q.length ? q[q.length - 1].seq : 0;
  seqCounter = Math.max(seqCounter, max) + 1;
  return seqCounter;
}

type NewOp = QueuedOp extends infer T ? (T extends QueuedOp ? Omit<T, "seq" | "ts"> : never) : never;

export function enqueue(op: NewOp): number {
  const ops = getQueue();
  const full = { ...op, seq: nextSeq(), ts: Date.now() } as QueuedOp;
  ops.push(full);
  writeQueue(ops.slice(-MAX_OPS));
  emit();
  return full.seq;
}

/** Drop every op confirmed as persisted (seq <= confirmedSeq). */
export function confirmUpTo(confirmedSeq: number) {
  const ops = getQueue();
  if (!ops.length) return;
  const confirmed = ops.filter((o) => o.seq <= confirmedSeq);
  const remaining = ops.filter((o) => o.seq > confirmedSeq);
  if (!confirmed.length) return;
  if (remaining.length) writeQueue(remaining);
  else {
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    setLastSyncAt(Date.now());
  }
  emit(confirmed);
}

export function clearQueue() {
  try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
  setLastSyncAt(Date.now());
  emit();
}

/** Replay pending ops on top of a persisted snapshot. */
export function applyQueue(base: Note[], ops: QueuedOp[] = getQueue()): Note[] {
  if (!ops.length) return base;
  const map = new Map(base.map((n) => [n.id, n]));
  for (const op of ops) {
    if (op.type === "delete") {
      map.delete(op.noteId);
    } else if (op.type === "upsert") {
      const existing = map.get(op.noteId);
      // Keep already-persisted images if the queued copy was slimmed on quota.
      const images = op.note.images?.length ? op.note.images : existing?.images ?? [];
      map.set(op.noteId, { ...existing, ...op.note, images });
    } else {
      const existing = map.get(op.noteId);
      if (existing) map.set(op.noteId, { ...existing, ...op.patch });
    }
  }
  return [...map.values()];
}

export function pendingCount(): number {
  return getQueue().length;
}

/**
 * Diff two note lists and queue the resulting ops.
 * Returns the highest sequence number queued (0 when nothing changed).
 */
export function enqueueDiff(prev: Note[], next: Note[]): number {
  const prevMap = new Map(prev.map((n) => [n.id, n]));
  const nextMap = new Map(next.map((n) => [n.id, n]));
  let last = 0;

  for (const [id, note] of nextMap) {
    const before = prevMap.get(id);
    if (!before || before !== note) {
      last = enqueue({ type: "upsert", noteId: id, note, label: noteLabel(note) });
    }
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) {
      last = enqueue({ type: "delete", noteId: id, label: noteLabel(prevMap.get(id)) });
    }
  }
  return last;
}
