/**
 * K0 cz. 3 (plan `docs/plan-skarbiec-krypto-2026-11-15.md`, §1 tabela P1/P2, §3.4, §3.5):
 * testy charakteryzujące DZISIEJSZE zachowanie. Mają przechodzić teraz; po K3/K4
 * (wpisy `retired:*`, `pin.prev`) oczekiwania oznaczone „PO K3/K4” trzeba odwrócić.
 *
 * Wynik równoległego zapisu tego samego klucza Yjs rozstrzyga identyfikator klienta
 * (wyższy wygrywa), więc ustawiamy go jawnie, zanim urządzenie cokolwiek zapisze.
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
  const store = createYjsStore(`vault-p1p2-${crypto.randomUUID()}`);
  store.doc.clientID = clientID;
  const versions = createVersionsStore(`vault.p1p2.${crypto.randomUUID()}.`);
  const pn = createPrivateNotes(store, { iterations: IT, minIterations: IT, writeDelayMs: 5, versions });
  return { store, pn };
}
type Dev = ReturnType<typeof fresh>;

function syncBoth(a: Dev, b: Dev) {
  a.store.mergeSyncState(b.store.encodeSyncState());
  b.store.mergeSyncState(a.store.encodeSyncState());
}

beforeEach(() => { localStorage.clear(); });

/**
 * P1 — spóźniony zapis: telefon offline edytuje notatkę starym DK, laptop w tym czasie zmienia hasło.
 */
async function lateWrite(laptopId: number, phoneId: number) {
  const laptop = fresh(laptopId);
  laptop.store.upsertNote(makeNote({ content: "pierwotna" }));
  await laptop.pn.setup(PW);
  await laptop.pn.lockNote("n1");

  const phone = fresh(phoneId);
  phone.store.mergeSyncState(laptop.store.encodeSyncState());
  await phone.pn.unlock(PW);
  expect(phone.pn.peek("n1")?.content).toBe("pierwotna");

  // Offline: obie strony piszą ten sam klucz `vault` notatki n1.
  phone.store.patchNote("n1", { content: "edycja z telefonu" });
  await phone.pn.flush();
  await laptop.pn.changePassword(PW, PW2);

  syncBoth(laptop, phone);
  // Telefon widzi nowe metadane i się blokuje.
  await vi.waitFor(() => expect(phone.pn.phase()).toBe("locked"));
  await laptop.pn.lock();
  await laptop.pn.unlock(PW2);
  await phone.pn.unlock(PW2);
  return { laptop, phone };
}

describe("K0 cz. 3 — P1 spóźniony zapis (stan sprzed K3/K4)", () => {
  it("szyfrogram telefonu wygrywa (wyższy clientID): notatka nieodszyfrowywalna na obu urządzeniach — PO K3/K4: odzyskana kluczem `retired:*` z treścią „edycja z telefonu” i znacznikiem `recovered`", async () => {
    const { laptop, phone } = await lateWrite(1, 2);
    for (const d of [laptop, phone]) {
      expect(d.pn.isUndecryptable("n1")).toBe(true);
      expect(d.pn.peek("n1")).toBeUndefined();
    }
  });

  it("szyfrogram laptopa wygrywa (wyższy clientID): edycja telefonu ginie bez śladu — PO K3/K4: bez zmian (projekt tego nie naprawia, C-4)", async () => {
    const { laptop, phone } = await lateWrite(2, 1);
    for (const d of [laptop, phone]) {
      expect(d.pn.isUndecryptable("n1")).toBe(false);
      expect(d.pn.peek("n1")?.content).toBe("pierwotna");
    }
  });
});

describe("K0 cz. 3 — P2 dwa skarbce offline (stan sprzed K3/K4)", () => {
  it("notatki przegranego skarbca są nieodszyfrowywalne, a jego hasło nie działa — PO K4: propozycja odzysku z `pin.prev` (hasło przegranego) odzyskuje notatkę", async () => {
    const winner = fresh(2);
    winner.store.upsertNote(makeNote({ id: "w", content: "notatka zwycięzcy" }));
    await winner.pn.setup(PW);
    await winner.pn.lockNote("w");

    const loser = fresh(1);
    loser.store.upsertNote(makeNote({ id: "l", content: "notatka przegranego" }));
    await loser.pn.setup(PW2);
    await loser.pn.lockNote("l");

    syncBoth(winner, loser);
    await vi.waitFor(() => expect(loser.pn.phase()).toBe("locked"));
    expect(winner.pn.phase()).toBe("unlocked");

    // Hasło przegranego skarbca nie pasuje do metadanych w dokumencie.
    await expect(loser.pn.unlock(PW2)).rejects.toMatchObject({ code: "bad-password" });
    await loser.pn.unlock(PW);
    // Bez ponownego odblokowania sesja zwycięzcy nie oznacza dosłanej notatki „l” jako nieczytelnej (stan na 2026-11-20).
    await winner.pn.lock();
    await winner.pn.unlock(PW);
    for (const d of [winner, loser]) {
      await vi.waitFor(() => expect(d.pn.isUndecryptable("l")).toBe(true));
      expect(d.pn.peek("l")).toBeUndefined();
      expect(d.pn.peek("w")?.content).toBe("notatka zwycięzcy");
    }
  });
});
