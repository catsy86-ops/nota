import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getSaveStatus, hasUnsavedWork, setDraftDirty, trackPersistence } from "@/lib/saveStatus";

/** Minimalny dokument: `change()` emituje zdarzenie `update` jak Y.Doc przy lokalnej zmianie. */
function fakeDoc() {
  let handler: ((u: Uint8Array, origin: unknown) => void) | null = null;
  return {
    on: (_e: "update", fn: (u: Uint8Array, origin: unknown) => void) => { handler = fn; },
    change: () => handler?.(new Uint8Array(), "local"),
  };
}

/** Minimalny dublet IndexeddbPersistence: transakcję kończymy ręcznie. */
function fakePersistence() {
  const txs: { oncomplete?: () => void; onerror?: () => void; onabort?: () => void; error?: Error }[] = [];
  const persistence = {
    db: { transaction: () => { const tx = {}; txs.push(tx); return tx as IDBTransaction; } },
    whenSynced: Promise.resolve(),
  };
  return { persistence, txs };
}

const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe("saveStatus", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
  afterEach(() => { vi.useRealTimers(); setDraftDirty("d1", false); });

  it("zapis przechodzi saving → saved → idle", async () => {
    const doc = fakeDoc();
    const { persistence, txs } = fakePersistence();
    trackPersistence(doc, () => persistence);

    doc.change();
    expect(getSaveStatus().phase).toBe("saving");
    expect(hasUnsavedWork()).toBe(true);

    txs[0].oncomplete?.();
    await Promise.resolve();
    expect(getSaveStatus().phase).toBe("saved");
    expect(hasUnsavedWork()).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(getSaveStatus().phase).toBe("idle");
  });

  it("błąd transakcji ustawia error i blokuje zamknięcie karty", async () => {
    const doc = fakeDoc();
    const { persistence, txs } = fakePersistence();
    trackPersistence(doc, () => persistence);

    doc.change();
    txs[0].error = new Error("QuotaExceededError");
    txs[0].onerror?.();
    await tick();
    expect(getSaveStatus().phase).toBe("error");
    expect(hasUnsavedWork()).toBe(true);

    // Błąd jest lepki: późniejszy udany zapis go nie zdejmuje.
    doc.change();
    txs[1].oncomplete?.();
    await Promise.resolve();
    expect(getSaveStatus().phase).toBe("error");
  });

  it("niezatwierdzony szkic liczy się jako praca do zapisania", () => {
    expect(hasUnsavedWork()).toBe(getSaveStatus().phase === "error");
    setDraftDirty("d1", true);
    expect(getSaveStatus().dirtyDrafts).toBe(1);
    setDraftDirty("d1", false);
    expect(getSaveStatus().dirtyDrafts).toBe(0);
  });
});
