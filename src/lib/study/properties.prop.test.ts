import { describe, expect, it } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { createYStudy, type JournalEntry } from "./yStudy";
import { billingStatement, type SiteBilling } from "./billing";
import { buildSitePackage, parseSitePackage } from "./sitePackage";
import { vanStock, type UsageEntry, type VanEvent, type VanItem } from "./van";

/**
 * Testy własności (plan Pracy na budowie, B1.4): zamiast kilku przykładów — setki losowych przebiegów,
 * z kurczeniem przy porażce. Dotyczą miejsc, gdzie błąd kosztuje utratę danych albo złą kwotę.
 */

const RUNS = { numRuns: 200 };

const entryArb = (prefix: string) =>
  fc.record({
    n: fc.integer({ min: 0, max: 30 }),
    at: fc.integer({ min: 1, max: 1_000_000 }),
    kind: fc.constantFrom<JournalEntry["kind"]>("ok", "problem", "note"),
    // Pusty wpis (bez tekstu, zdjęć i kształtek) `dump()` świadomie odrzuca — tekst ma być niepusty.
    text: fc.stringMatching(/^[a-z]{1,20}$/),
  }).map(({ n, at, kind, text }): JournalEntry => ({ id: `${prefix}${n}`, at, kind, topic: null, text, site: "", checked: [], images: [] }));

/** Wymiana stanu między dokumentami w zadanej kolejności (każdy z każdym, kilka kolejek). */
function mergeInOrder(docs: Y.Doc[], order: number[]) {
  for (const i of order) for (const j of order) {
    if (i !== j) Y.applyUpdate(docs[j], Y.encodeStateAsUpdate(docs[i]));
  }
}

describe("scalanie Pracy z kilku telefonów", () => {
  it("wynik nie zależy od kolejności wymiany i niczego nie gubi", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(entryArb("e"), { maxLength: 8 }), { minLength: 2, maxLength: 3 }),
        fc.shuffledSubarray([0, 1, 2], { minLength: 3, maxLength: 3 }),
        (perPhone, order) => {
          const docs = perPhone.map(() => new Y.Doc());
          const ys = docs.map(createYStudy);
          // Każdy telefon ma własne id wpisów, więc zbiór oczekiwany to suma wszystkich.
          perPhone.forEach((list, p) => list.forEach((e) => ys[p].addEntry({ ...e, id: `p${p}-${e.id}` })));
          const expected = new Set(perPhone.flatMap((list, p) => list.map((e) => `p${p}-${e.id}`)));
          const ord = order.filter((i) => i < docs.length);
          mergeInOrder(docs, ord);
          mergeInOrder(docs, ord);
          const dumps = ys.map((y) => JSON.stringify(y.dump().journal.map((e) => e.id).sort()));
          expect(new Set(dumps).size).toBe(1);
          expect(new Set(ys[0].dump().journal.map((e) => e.id))).toEqual(expected);
        },
      ),
      RUNS,
    );
  });

  it("dwa telefony piszą to samo pole wpisu: oba kończą z tą samą wartością", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,20}$/), fc.stringMatching(/^[a-z]{1,20}$/), (ta, tb) => {
        const docA = new Y.Doc();
        const docB = new Y.Doc();
        const a = createYStudy(docA);
        const b = createYStudy(docB);
        const base: JournalEntry = { id: "x", at: 5, kind: "note", topic: null, text: "start", site: "", checked: [], images: [] };
        a.addEntry(base);
        mergeInOrder([docA, docB], [0, 1]);
        a.updateEntry({ ...base, text: ta });
        b.updateEntry({ ...base, text: tb });
        mergeInOrder([docA, docB], [0, 1]);
        const t = (y: ReturnType<typeof createYStudy>) => y.dump().journal.find((e) => e.id === "x")?.text;
        expect(t(a)).toBe(t(b));
        expect([ta, tb]).toContain(t(a));
      }),
      RUNS,
    );
  });
});

const money = fc.integer({ min: 0, max: 5_000_000 }).map((c) => c / 100);

describe("rozliczenie budowy", () => {
  const billingArb: fc.Arbitrary<SiteBilling> = fc.record({
    modes: fc.subarray(["hours", "points", "lump"] as const),
    pointRate: fc.option(money, { nil: undefined }),
    typeRates: fc.dictionary(fc.constantFrom("umywalka", "wc", "prysznic"), money),
    lump: fc.option(money, { nil: undefined }),
    stageAmounts: fc.dictionary(fc.constantFrom("s1", "s2", "s3"), money),
    payments: fc.array(fc.record({ id: fc.uuid(), day: fc.constant("2026-10-01"), amount: money }), { maxLength: 10 }),
  }).map((b) => ({ ...b, modes: [...b.modes] }));

  it("zostało = naliczone − otrzymane, wszystko skończone i bez NaN", () => {
    fc.assert(
      fc.property(
        billingArb,
        fc.option(money, { nil: undefined }),
        fc.integer({ min: 0, max: 60_000 }),
        fc.array(fc.record({ type: fc.constantFrom("umywalka", "wc", "prysznic"), done: fc.boolean() }), { maxLength: 30 }),
        fc.array(fc.record({ id: fc.constantFrom("s1", "s2", "s3"), name: fc.constant("Etap"), done: fc.option(fc.integer({ min: 1, max: 2e12 }), { nil: undefined }) }), { maxLength: 3 }),
        (billing, rate, minutes, points, stages) => {
          const st = billingStatement({ billing, rate, minutes, unsplit: 0, points, stages, typeLabel: (id) => id });
          for (const n of [st.accrued, st.paid, st.due, ...st.lines.map((l) => l.amount)]) expect(Number.isFinite(n)).toBe(true);
          expect(st.due).toBeCloseTo(st.accrued - st.paid, 2);
          expect(st.accrued).toBeCloseTo(st.lines.reduce((s, l) => s + l.amount, 0), 2);
          expect(st.paid).toBeCloseTo(billing.payments.reduce((s, p) => s + p.amount, 0), 2);
        },
      ),
      RUNS,
    );
  });

  it("wyłączony sposób nie dolicza pozycji, wpłaty liczą się zawsze", () => {
    fc.assert(
      fc.property(billingArb, (billing) => {
        const off = { ...billing, modes: [] };
        const st = billingStatement({ billing: off, rate: 50, minutes: 600, unsplit: 0, points: [{ type: "wc", done: true }], stages: [], typeLabel: (id) => id });
        expect(st.lines).toHaveLength(0);
        expect(st.accrued).toBe(0);
        expect(st.paid).toBeCloseTo(billing.payments.reduce((s, p) => s + p.amount, 0), 2);
      }),
      RUNS,
    );
  });
});

describe("materiał w aucie", () => {
  const item: VanItem = { id: "i1", name: "Kolano 16", unit: "szt.", at: 100, order: 0 };
  const eventArb: fc.Arbitrary<VanEvent> = fc.record({
    id: fc.uuid(),
    item: fc.constant("i1"),
    kind: fc.constantFrom<VanEvent["kind"]>("count", "in"),
    qty: fc.integer({ min: 0, max: 500 }),
    at: fc.integer({ min: 1, max: 10_000 }),
  });
  const usageArb: fc.Arbitrary<UsageEntry> = fc.record({
    at: fc.integer({ min: 1, max: 10_000 }),
    supply: fc.option(fc.constant("site" as const), { nil: undefined }),
    fittings: fc.array(fc.record({ name: fc.constantFrom("Kolano 16", "kolano 16", "Trójnik 16"), qty: fc.integer({ min: 1, max: 20 }) }), { maxLength: 3 }),
  });

  it("stan nie zależy od kolejności zdarzeń ani wpisów, a jest skończony", () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 12 }), fc.array(usageArb, { maxLength: 12 }), fc.nat(), (events, journal, seed) => {
        const rot = <T,>(a: T[]) => (a.length ? [...a.slice(seed % a.length), ...a.slice(0, seed % a.length)].reverse() : a);
        const a = vanStock(item, events, journal);
        const b = vanStock(item, rot(events), rot(journal));
        expect(Number.isFinite(a.qty)).toBe(true);
        expect(b.qty).toBe(a.qty);
        expect(b.toBuy).toBe(a.toBuy);
      }),
      RUNS,
    );
  });

  it("dostawa na budowę nie zmienia stanu auta", () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 8 }), fc.array(usageArb, { maxLength: 8 }), (events, journal) => {
        const base = vanStock(item, events, journal).qty;
        const extra: UsageEntry[] = [...journal, { at: 9_999, supply: "site", fittings: [{ name: "Kolano 16", qty: 50 }] }];
        expect(vanStock(item, events, extra).qty).toBe(base);
      }),
      RUNS,
    );
  });
});

describe("paczka budowy z zewnątrz (plik od pomocnika)", () => {
  const NOW = 1_800_000_000_000;

  it("parser nie rzuca wyjątku na żadnym tekście ani na losowym JSON-ie", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json(), fc.jsonValue().map((v) => JSON.stringify(v))), (raw) => {
        const r = parseSitePackage(raw, NOW);
        expect(typeof r.ok).toBe("boolean");
      }),
      { numRuns: 500 },
    );
  });

  it("paczka zbudowana i odczytana zachowuje wpisy, a każdy wpis jest oczyszczony z danych prywatnych", () => {
    fc.assert(
      fc.property(fc.array(entryArb("e"), { maxLength: 10 }), (list) => {
        const entries = [...new Map(list.map((e) => [e.id, { ...e, at: Math.min(e.at, NOW - 1), geo: { lat: 52, lng: 21, acc: 5, at: 1 } } as JournalEntry])).values()];
        const pkg = buildSitePackage({ id: "s1", name: "Lipowa", address: "x" }, { entries, rooms: [], points: [] }, { now: NOW, access: false });
        const back = parseSitePackage(JSON.stringify(pkg), NOW);
        expect(back.ok).toBe(true);
        if (!back.ok) return;
        expect(new Set(back.pkg.entries.map((e) => e.id))).toEqual(new Set(entries.map((e) => e.id)));
        for (const e of back.pkg.entries) { expect(e.geo).toBeUndefined(); expect(e.topic).toBeNull(); }
      }),
      RUNS,
    );
  });
});
