import { describe, expect, it } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { createYDebts } from "./yDebts";
import { balances, personKey, type DebtEntry, type DebtKind } from "./model";

/**
 * L1.2 (`docs/plan-dlugi-2026-11-15.md`): saldo nie zależy od kolejności wpisów, a „Cofnij” po usunięciu i po zmianie
 * nazwy osoby przywraca stan co do wpisu. Scalenie dwóch dokumentów w obie strony sprawdza zestaw zbieżności
 * (`convergence.prop.test.ts`).
 */

const KINDS: DebtKind[] = ["lent", "repaid", "borrowed", "returned"];
const entries = fc.uniqueArray(
  fc.record({
    id: fc.stringMatching(/^[a-z]{1,6}$/), person: fc.constantFrom("Ania", "Marek", "ania"), kind: fc.constantFrom(...KINDS),
    amount: fc.integer({ min: 1, max: 1_000_000 }), at: fc.constantFrom("2026-11-01", "2026-11-02"), note: fc.constant(""), created: fc.integer({ min: 0, max: 5 }),
  }),
  { selector: (e) => e.id, maxLength: 12 },
);
const saldo = (list: readonly DebtEntry[]) => balances(list).map((p) => [p.key, p.balance] as const).sort(([a], [b]) => (a < b ? -1 : 1));

describe("Długi: własności (L1.2)", () => {
  it("saldo po osobach nie zależy od kolejności wpisów", () => {
    fc.assert(fc.property(entries, fc.integer(), (list, seed) => {
      const shuffled = [...list].sort((a, b) => ((a.id.charCodeAt(0) * 31 + seed) % 7) - ((b.id.charCodeAt(0) * 31 + seed) % 7));
      expect(saldo(shuffled)).toEqual(saldo(list));
      expect(balances(shuffled).map((p) => p.entries.map((e) => e.id))).toEqual(balances(list).map((p) => p.entries.map((e) => e.id)));
    }), { numRuns: 300 });
  });

  it("„Cofnij” po usunięciu przywraca wpis co do pola, a listę co do kolejności", () => {
    fc.assert(fc.property(entries.filter((l) => l.length > 0), fc.nat(), (list, pick) => {
      const y = createYDebts(new Y.Doc());
      list.forEach((e) => y.add(e));
      const before = JSON.stringify(y.get(true));
      const gone = y.remove(list[pick % list.length].id)!;
      y.restore(gone);
      expect(JSON.stringify(y.get(true))).toBe(before);
    }), { numRuns: 200 });
  });

  it("„Cofnij” po zmianie nazwy osoby przywraca wszystkie jej wpisy, a cudzych nie rusza", () => {
    fc.assert(fc.property(entries.filter((l) => l.length > 0), fc.constantFrom("Ola", "Marek"), (list, to) => {
      const y = createYDebts(new Y.Doc());
      list.forEach((e) => y.add(e));
      const before = JSON.stringify(y.get(true));
      // Jak `renamePeople` i jego „Cofnij” (`restoreDebts`): poprzednie wersje wpisów osoby wracają jedną transakcją.
      const prev = y.get(true).filter((e) => personKey(e.person) === personKey(list[0].person));
      y.replaceMany(prev.map((e) => ({ ...e, person: to })));
      y.replaceMany(prev);
      expect(JSON.stringify(y.get(true))).toBe(before);
    }), { numRuns: 200 });
  });
});
