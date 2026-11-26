import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { convergenceProperty, convergenceRuns, runScript, type ConvergenceDomain, type Step } from "@/test/convergence";
import { createYDebts } from "./yDebts";
import { balances, KIND_SIGN, personKey, type DebtEntry, type DebtKind } from "./model";

/**
 * Z-17.9 §3.2: zbieżność Długów. Projekcja = `get()` (kolejność `byNewest`, jak lista w interfejsie) i salda
 * `balances()` — z nich użytkownik czyta kwoty. Generator daje często ten sam dzień i ten sam `created`, żeby
 * sprawdzić remis w kolejności.
 */

type Store = { y: ReturnType<typeof createYDebts>; removed: DebtEntry[] };
type Op =
  | { k: "add"; e: DebtEntry }
  | { k: "replace"; id: string; amount: number; note: string }
  | { k: "rename"; from: string; to: string }
  | { k: "remove"; id: string }
  | { k: "restore" }
  | { k: "merge"; list: DebtEntry[] };

const PEOPLE = ["Ania", "Marek", "ania"];
const KINDS: DebtKind[] = ["lent", "repaid", "borrowed", "returned"];
const AMOUNTS = [100, 250, 1000, 2550, 10_000, 40_000];
const DAYS = ["2026-11-01", "2026-11-02", "2026-11-02"];
const ids = (device: number) => [0, 1, 2, 3].map((k) => `d${device}-${k}`);
const ALL_IDS = [0, 1, 2].flatMap(ids);

const entry = (id: string) => fc.record({
  id: fc.constant(id), person: fc.constantFrom(...PEOPLE), kind: fc.constantFrom(...KINDS), amount: fc.constantFrom(...AMOUNTS),
  at: fc.constantFrom(...DAYS), note: fc.constantFrom("", "obiad"), created: fc.constantFrom(1, 2, 2, 3),
});

const debts: ConvergenceDomain<Store, Op> = {
  name: "Długi",
  create: (doc) => ({ y: createYDebts(doc), removed: [] }),
  // Nowe wpisy mają id urządzenia (jak `crypto.randomUUID`); zmiany i usunięcia celują we wszystkie id — także cudze i usunięte.
  ops: (device) => fc.oneof(
    { weight: 4, arbitrary: fc.constantFrom(...ids(device)).chain(entry).map((e): Op => ({ k: "add", e })) },
    { weight: 2, arbitrary: fc.record({ k: fc.constant("replace" as const), id: fc.constantFrom(...ALL_IDS), amount: fc.constantFrom(...AMOUNTS), note: fc.constantFrom("", "zmiana") }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("rename" as const), from: fc.constantFrom(...PEOPLE), to: fc.constantFrom("Ania", "Ola") }) },
    { weight: 2, arbitrary: fc.record({ k: fc.constant("remove" as const), id: fc.constantFrom(...ALL_IDS) }) },
    { weight: 1, arbitrary: fc.constant({ k: "restore" } as Op) },
    { weight: 1, arbitrary: fc.array(fc.constantFrom("m-1", "m-2").chain(entry), { maxLength: 2 }).map((list): Op => ({ k: "merge", list })) },
  ),
  apply: (s, op) => {
    switch (op.k) {
      case "add": s.y.add(op.e); break;
      case "replace": { const cur = s.y.get().find((e) => e.id === op.id); if (cur) s.y.replace({ ...cur, amount: op.amount, note: op.note }); break; }
      // Jak `renamePeople` w `store.ts`: wszystkie wpisy osoby tego urządzenia jedną transakcją.
      case "rename": { const prev = s.y.get().filter((e) => personKey(e.person) === personKey(op.from)); if (prev.length) s.y.replaceMany(prev.map((e) => ({ ...e, person: op.to }))); break; }
      case "remove": { const gone = s.y.remove(op.id); if (gone) s.removed.push(gone); break; }
      // „Cofnij” po usunięciu: stos tylko na tym urządzeniu (po ponownym otwarciu pusty).
      case "restore": { const e = s.removed.pop(); if (e) s.y.restore(e); break; }
      case "merge": s.y.mergeDump(op.list); break;
    }
  },
  project: (s) => {
    const list = s.y.get(true);
    return { list, balances: balances(list).map((p) => ({ key: p.key, name: p.name, balance: p.balance, ids: p.entries.map((e) => e.id) })) };
  },
  invariants: (p) => {
    const { list, balances: bs } = p as { list: DebtEntry[]; balances: { balance: number }[] };
    const out: string[] = [];
    if (new Set(list.map((e) => e.id)).size !== list.length) out.push("zdublowany id wpisu");
    if (list.some((e) => !Number.isInteger(e.amount) || e.amount <= 0)) out.push("kwota spoza zakresu");
    const sum = list.reduce((s, e) => s + KIND_SIGN[e.kind] * e.amount, 0);
    if (bs.reduce((s, b) => s + b.balance, 0) !== sum) out.push("suma sald ≠ suma wpisów");
    return out;
  },
  // W5: wpis dodany swoim id i przez nikogo nieusunięty istnieje (zmiana i usunięcie równolegle to legalne „wskrzeszenie” — §2).
  losses: (history, p) => {
    const present = new Set((p as { list: DebtEntry[] }).list.map((e) => e.id));
    const removed = new Set(history.flatMap((h) => (h.op.k === "remove" ? [h.op.id] : [])));
    return history.flatMap((h) => (h.op.k === "add" && !removed.has(h.op.e.id) && !present.has(h.op.e.id) ? [`zniknął wpis ${h.op.e.id}`] : []));
  },
};

describe("zbieżność Długów (Z-17.9)", () => {
  // §6.2 specyfikacji: remis w `byNewest` (ten sam dzień i `created`) dawał różną kolejność na telefonach (W1) —
  // znalezione tym zestawem 2026-11-26, poprawione rozstrzygnięciem po id.
  it("losowe przebiegi na 2–3 telefonach: projekcja, zimny start, spokój, niezmienniki, nic nie ginie", () => {
    fc.assert(convergenceProperty(debts), { numRuns: convergenceRuns() });
  });

  it("przypadek obowiązkowy: dwa telefony dodają wpisy z tym samym dniem i `created` — kolejność wszędzie ta sama", () => {
    const e = (id: string): DebtEntry => ({ id, person: "Ania", kind: "lent", amount: 100, at: "2026-11-02", note: "", created: 2 });
    const steps: Step<Op>[] = [
      { k: "op", d: 0, op: { k: "add", e: e("d0-0") } },
      { k: "op", d: 1, op: { k: "add", e: e("d1-0") } },
    ];
    expect(runScript(debts, steps)).toEqual({ ok: true });
  });
});
