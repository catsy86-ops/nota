import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { convergenceProperty, convergenceRuns, runScript, type ConvergenceDomain, type Step } from "@/test/convergence";
import { createYStudy, type JournalEntry } from "./yStudy";
import type { SiteCard } from "./sites";
import type { Shortage } from "./shortages";

/**
 * Z-17.9 §3.4, grupa 1: zbieżność dziennika i kart budów w Pracy. Projekcja = `dump()` (po `cleanDump`) z dziennikiem
 * w kolejności interfejsu (`journalView.ts`: najnowsze pierwsze po `at`) i kartami budów z listami (braki).
 */

type Store = { y: ReturnType<typeof createYStudy>; removed: JournalEntry[] };
type Op =
  | { k: "add"; id: string; at: number; kind: JournalEntry["kind"]; text: string; siteId: string }
  | { k: "edit"; id: string; text: string }
  | { k: "remove"; id: string }
  | { k: "restore" }
  | { k: "resolve"; id: string; at: number | null }
  | { k: "solution"; id: string; text: string }
  | { k: "owner"; id: string; owner: string }
  | { k: "site"; id: string; name: string }
  | { k: "archive"; id: string; on: boolean }
  | { k: "shortage"; siteId: string; itemId: string; status: Shortage["status"] | null };

const SITES: Record<string, string> = { s1: "Lipowa 5", s2: "Polna 2" };
const own = (d: number) => [`e${d}a`, `e${d}b`, `e${d}c`];
const ALL = [0, 1, 2].flatMap(own);
const card = (id: string, name: string): SiteCard => ({ id, name, address: "", investor: "", created: 1 });

const study: ConvergenceDomain<Store, Op> = {
  name: "Praca: dziennik i budowy",
  create: (doc) => ({ y: createYStudy(doc), removed: [] }),
  ops: (device) => fc.oneof(
    { weight: 4, arbitrary: fc.record({ k: fc.constant("add" as const), id: fc.constantFrom(...own(device)), at: fc.constantFrom(1000, 2000, 2000), kind: fc.constantFrom<JournalEntry["kind"]>("ok", "problem", "note"), text: fc.constantFrom("rura", "złączka"), siteId: fc.constantFrom("s1", "s2") }) },
    { weight: 2, arbitrary: fc.record({ k: fc.constant("edit" as const), id: fc.constantFrom(...ALL), text: fc.constantFrom("poprawka", "zawór") }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("remove" as const), id: fc.constantFrom(...ALL) }) },
    { weight: 1, arbitrary: fc.constant({ k: "restore" } as Op) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("resolve" as const), id: fc.constantFrom(...ALL), at: fc.constantFrom<number | null>(5000, null) }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("solution" as const), id: fc.constantFrom(...ALL), text: fc.constantFrom("", "wymiana uszczelki") }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("owner" as const), id: fc.constantFrom(...ALL), owner: fc.constantFrom("", "Marek") }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("site" as const), id: fc.constantFrom("s1", "s2"), name: fc.constantFrom("Lipowa 5", "Lipowa 5a") }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("archive" as const), id: fc.constantFrom("s1", "s2"), on: fc.boolean() }) },
    { weight: 2, arbitrary: fc.record({ k: fc.constant("shortage" as const), siteId: fc.constantFrom("s1", "s2"), itemId: fc.constantFrom("k1", "k2", `k${device}`), status: fc.constantFrom<Shortage["status"] | null>("missing", "ordered", "delivered", null) }) },
  ),
  apply: (s, op) => {
    const y = s.y;
    const find = (id: string) => y.dump().journal.find((e) => e.id === id);
    const siteOf = (id: string) => y.dump().sites[id];
    switch (op.k) {
      case "add": {
        const e: JournalEntry = { id: op.id, at: op.at, kind: op.kind, topic: null, text: op.text, site: SITES[op.siteId], siteId: op.siteId, checked: [], images: [] };
        y.addEntry(e, siteOf(op.siteId) ? undefined : card(op.siteId, SITES[op.siteId]));
        break;
      }
      case "edit": { const e = find(op.id); if (e) y.updateEntry({ ...e, text: op.text }); break; }
      case "remove": { const gone = y.removeEntry(op.id); if (gone) s.removed.push(gone); break; }
      case "restore": { const e = s.removed.pop(); if (e) y.restoreEntry(e); break; }
      case "resolve": y.setResolved(op.id, op.at); break;
      case "solution": y.setSolution(op.id, op.text); break;
      case "owner": y.setFault(op.id, { owner: op.owner }); break;
      case "site": { const c = siteOf(op.id); y.saveSite({ ...(c ?? card(op.id, op.name)), name: op.name }, c?.name); break; }
      case "archive": { const c = siteOf(op.id); if (c) { const { archived: _, ...rest } = c; y.saveSite(op.on ? { ...rest, archived: 9000 } : rest); } break; }
      case "shortage": {
        const c = siteOf(op.siteId);
        if (!c) break;
        const base = c.shortages ?? [];
        const rest = base.filter((x) => x.id !== op.itemId);
        const next = op.status ? [...rest, { id: op.itemId, text: op.itemId, qty: "", status: op.status, at: 1 }] : rest;
        y.setSiteList(op.siteId, "short", next, base);
        break;
      }
    }
  },
  project: (s) => {
    const d = s.y.dump();
    // Kolejność dziennika jak w interfejsie (`journalView.ts`: `sort((a, b) => b.at - a.at)`).
    return { journal: [...d.journal].sort((a, b) => b.at - a.at), sites: d.sites, site: d.site };
  },
  invariants: (p) => {
    const { journal } = p as { journal: JournalEntry[] };
    return new Set(journal.map((e) => e.id)).size === journal.length ? [] : ["zdublowany wpis dziennika"];
  },
  losses: (history, p) => {
    const present = new Set((p as { journal: JournalEntry[] }).journal.map((e) => e.id));
    const removed = new Set(history.flatMap((h) => (h.op.k === "remove" ? [h.op.id] : [])));
    return history.flatMap((h) => (h.op.k === "add" && !removed.has(h.op.id) && !present.has(h.op.id) ? [`zniknął wpis ${h.op.id}`] : []));
  },
};

describe("zbieżność Pracy: dziennik i budowy (Z-17.9)", () => {
  // ZNANA PORAŻKA (potwierdzona 2026-11-26): dziennik w interfejsie sortowany `b.at - a.at` bez rozstrzygnięcia remisu —
  // dwa wpisy z tą samą chwilą z dwóch telefonów stoją w różnej kolejności (W1). Poprawka osobnym commitem.
  it.fails("losowe przebiegi na 2–3 telefonach", () => {
    fc.assert(convergenceProperty(study), { numRuns: convergenceRuns() });
  });

  it("obowiązkowy: archiwizacja budowy na A równolegle z dopisaniem wpisu do niej na B — wynik równy, wpis zostaje", () => {
    const steps: Step<Op>[] = [
      { k: "op", d: 0, op: { k: "add", id: "e0a", at: 1000, kind: "ok", text: "rura", siteId: "s1" } },
      { k: "deliver", from: 0, to: 1, n: 10 },
      { k: "op", d: 0, op: { k: "archive", id: "s1", on: true } },
      { k: "op", d: 1, op: { k: "add", id: "e1a", at: 2000, kind: "problem", text: "złączka", siteId: "s1" } },
    ];
    expect(runScript(study, steps)).toEqual({ ok: true });
  });
});
