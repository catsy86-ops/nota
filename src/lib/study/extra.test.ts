import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYJobs } from "./yJobs";
import { createYBilling } from "./yBilling";
import { JOB_ENTRY_V } from "./jobs";

// Z-17.3 (`docs/plan-zgodnosc-i-obieg.md` §1.6, pozycja 4): nieznane pola zlecenia, pozycji wyceny i wpłaty przeżywają zapis.

const SEP = "\u0001";

describe("nieznane pola — zlecenia", () => {
  it("wpis zlecenia: zmiana statusu, „Cofnij” po zdjęciu i kopia zachowują pole", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>("studyJobs");
    const y = createYJobs(doc);
    expect(y.setMeta("s1", { status: "quote" }, 1_000)).toBe(true);
    map.set(`j${SEP}s1`, { ...(map.get(`j${SEP}s1`) as object), invoiceRef: "f-1" });
    expect(y.get("s1")?.extra).toEqual({ invoiceRef: "f-1" });
    y.setMeta("s1", { status: "booked" }, 2_000);
    expect(map.get(`j${SEP}s1`)).toMatchObject({ status: "booked", invoiceRef: "f-1" });
    y.restore("s1", y.remove("s1")!);
    expect(map.get(`j${SEP}s1`)).toMatchObject({ invoiceRef: "f-1" });
    const dump = JSON.parse(JSON.stringify(y.dump()));
    expect(dump.jobs.s1).toMatchObject({ invoiceRef: "f-1" });
    expect(dump.jobs.s1).not.toHaveProperty("extra");
  });

  it("pozycja wyceny: zapis po edycji i kopia zachowują pole", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>("studyJobs");
    const y = createYJobs(doc);
    y.setMeta("s1", { status: "quote" }, 1_000);
    y.saveItem("s1", { id: "i1", kind: "labor", name: "Montaż", qty: 1, unit: "szt.", price: 10_000, order: 0 });
    map.set(`i${SEP}s1${SEP}i1`, { ...(map.get(`i${SEP}s1${SEP}i1`) as object), vatRate: 8 });
    const item = y.get("s1")!.items[0];
    y.saveItem("s1", { ...item, qty: 2 });
    expect(map.get(`i${SEP}s1${SEP}i1`)).toMatchObject({ qty: 2, vatRate: 8 });
    const other = createYJobs(new Y.Doc());
    other.mergeDump(JSON.parse(JSON.stringify(y.dump())));
    expect(other.get("s1")?.items[0].extra).toEqual({ vatRate: 8 });
  });

  it("`v` większe niż obsługiwane — zlecenie niewidoczne", () => {
    const doc = new Y.Doc();
    doc.getMap<unknown>("studyJobs").set(`j${SEP}s1`, { status: "quote", statusAt: 1, created: 1, v: JOB_ENTRY_V + 1 });
    expect(createYJobs(doc).get("s1")).toBeUndefined();
  });
});

describe("nieznane pola — wpłaty", () => {
  it("wpłata z polem z nowszej wersji przechodzi przez kopię", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>("studyBilling");
    map.set(`p${SEP}s1${SEP}p1`, { day: "2026-11-01", amount: 50_000, method: "przelew" });
    const y = createYBilling(doc);
    expect(y.get("s1").payments[0].extra).toEqual({ method: "przelew" });
    const dump = JSON.parse(JSON.stringify(y.dump()));
    expect(dump.sites.s1.payments[0]).toMatchObject({ id: "p1", method: "przelew" });
    const other = new Y.Doc();
    createYBilling(other).mergeDump(dump);
    expect(other.getMap("studyBilling").get(`p${SEP}s1${SEP}p1`)).toMatchObject({ method: "przelew" });
  });
});
