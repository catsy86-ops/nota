/**
 * K0 cz. 4 (plan `docs/plan-skarbiec-krypto-2026-11-15.md`, §0.5):
 * (a) czy własna zmiana hasła nie blokuje skarbca przez obserwator metadanych
 *     i czy zapis tuż po niej idzie nowym kluczem;
 * (b) kiedy sesja oznacza dosłany synchronizacją szyfrogram jako nieczytelny.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createYjsStore } from "@/lib/yjsStore";
import { createPrivateNotes } from "@/lib/privateNotes";
import { createVersionsStore } from "@/lib/versionsStore";
import type { Note } from "@/lib/types/note";

const IT = 1000;
const PW = "hasło-do-testów-12345";
const PW2 = "nowe-hasło-98765";

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "Tytuł", content: "Treść", color: "default", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
    order: 0, createdAt: 1_000, updatedAt: 1_000, ...over,
  };
}

function fresh(clientID: number) {
  const store = createYjsStore(`vault-k04-${crypto.randomUUID()}`);
  store.doc.clientID = clientID;
  const versions = createVersionsStore(`vault.k04.${crypto.randomUUID()}.`);
  const pn = createPrivateNotes(store, { iterations: IT, minIterations: IT, writeDelayMs: 5, versions });
  return { store, pn };
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => { localStorage.clear(); });

describe("K0 cz. 4 — własna zmiana hasła a blokada skarbca", () => {
  it("skarbiec zostaje odblokowany po zmianie hasła (obserwator nie blokuje własnego zapisu metadanych)", async () => {
    const d = fresh(1);
    d.store.upsertNote(makeNote({ content: "pierwotna" }));
    await d.pn.setup(PW);
    await d.pn.lockNote("n1");

    await d.pn.changePassword(PW, PW2);
    expect(d.pn.phase()).toBe("unlocked");
    await tick(120); // dłużej niż 40 ms opóźnienia w lock()
    expect(d.pn.phase()).toBe("unlocked");
    expect(d.pn.peek("n1")?.content).toBe("pierwotna");
  });

  it("edycja tuż po zmianie hasła jest zapisana nowym kluczem (czytelna po ponownym odblokowaniu nowym hasłem)", async () => {
    const d = fresh(1);
    d.store.upsertNote(makeNote({ content: "pierwotna" }));
    await d.pn.setup(PW);
    await d.pn.lockNote("n1");

    await d.pn.changePassword(PW, PW2);
    d.store.patchNote("n1", { content: "po zmianie hasła" });
    await tick(120);
    await d.pn.flush();
    await d.pn.lock();
    await d.pn.unlock(PW2);
    expect(d.pn.isUndecryptable("n1")).toBe(false);
    expect(d.pn.peek("n1")?.content).toBe("po zmianie hasła");
  });
});

describe("K0 cz. 4 — dosłany szyfrogram obcego skarbca", () => {
  async function twoVaults() {
    const winner = fresh(2);
    winner.store.upsertNote(makeNote({ id: "w", content: "notatka zwycięzcy" }));
    await winner.pn.setup(PW);
    await winner.pn.lockNote("w");
    const loser = fresh(1);
    loser.store.upsertNote(makeNote({ id: "l", content: "notatka przegranego" }));
    await loser.pn.setup(PW2);
    await loser.pn.lockNote("l");
    winner.store.mergeSyncState(loser.store.encodeSyncState());
    return winner;
  }

  it("odszyfrowanie jest leniwe: przed pierwszym odczytem notatka nie jest oznaczona (zamierzone, nie luka)", async () => {
    const winner = await twoVaults();
    expect(winner.pn.phase()).toBe("unlocked");
    expect(winner.pn.isUndecryptable("l")).toBe(false);
    expect(winner.pn.peek("l")).toBeUndefined(); // treść i tak niedostępna
  });

  it("pierwsza próba odczytu (ensureDecrypted, jak w karcie) oznacza ją jako nieczytelną bez ponownego odblokowania", async () => {
    const winner = await twoVaults();
    await winner.pn.ensureDecrypted({ id: "l", vault: winner.store.getVault("l")! });
    expect(winner.pn.isUndecryptable("l")).toBe(true);
    expect(winner.pn.peek("l")).toBeUndefined();
    expect(winner.pn.peek("w")?.content).toBe("notatka zwycięzcy");
  });
});
