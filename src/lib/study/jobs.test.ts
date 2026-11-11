import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { cleanJobMeta, cleanQuoteItem, itemClientTotal, parseMargin, parseQty, quoteTotals, signatureValidFor, sortJobs, unpaidTotal, type Job } from "./jobs";
import { signatureImageType } from "./pdfWriter";
import { safeLine } from "@/lib/safeText";
import { createYJobs } from "./yJobs";

const job = (over: Partial<Job> = {}): Job => ({ status: "quote", statusAt: 1, created: 1, items: [], ...over });

describe("zlecenia własne — model (H3.4)", () => {
  it("czyści wpis zlecenia: zły status albo brak daty = null, zły termin i marża znikają", () => {
    expect(cleanJobMeta({ status: "faktura", created: 1 })).toBeNull();
    expect(cleanJobMeta({ status: "quote" })).toBeNull();
    expect(cleanJobMeta({ status: "booked", created: 5, term: "jutro", margin: 900, scope: "  Kran\u0007 " })).toEqual({ status: "booked", statusAt: 5, scope: "Kran", created: 5 });
    expect(cleanJobMeta({ status: "booked", created: 5, term: "2026-11-05T14:00", margin: 15 })).toMatchObject({ term: "2026-11-05T14:00", margin: 15 });
  });

  it("czyści pozycję wyceny: bez nazwy albo ilości = null, cena 0 dozwolona, jednostka domyślna", () => {
    expect(cleanQuoteItem({ kind: "labor", name: "", qty: 1, price: 10 }, "a")).toBeNull();
    expect(cleanQuoteItem({ kind: "labor", name: "X", qty: 0, price: 10 }, "a")).toBeNull();
    expect(cleanQuoteItem({ kind: "material", name: "Uszczelka", qty: 2, price: 0 }, "a")).toMatchObject({ unit: "szt.", price: 0 });
    expect(cleanQuoteItem({ kind: "inne", name: "Dojazd", qty: 1, price: 30 }, "a")).toMatchObject({ kind: "labor", unit: "usł." });
  });

  it("sumy: marża tylko na materiał, kwoty dla klienta z marżą", () => {
    const j = job({
      margin: 20,
      items: [
        { id: "a", kind: "labor", name: "Montaż", qty: 2, unit: "h", price: 100, order: 0 },
        { id: "b", kind: "material", name: "Bateria", qty: 1, unit: "szt.", price: 250, order: 1 },
      ],
    });
    expect(quoteTotals(j)).toEqual({ labor: 200, material: 250, marginAmount: 50, total: 500 });
    expect(itemClientTotal(j.items[1], j.margin)).toBe(300);
    expect(itemClientTotal(j.items[0], j.margin)).toBe(200);
  });

  it("„Niezapłacone” liczy tylko zrobione; lista: umówione po terminie, potem wyceny, zrobione, zapłacone", () => {
    const item = { id: "a", kind: "labor" as const, name: "X", qty: 1, unit: "usł.", price: 100, order: 0 };
    expect(unpaidTotal([job({ status: "done", items: [item] }), job({ status: "paid", items: [item] }), job({ status: "quote", items: [item] })])).toBe(100);
    const list = sortJobs([
      job({ status: "paid", statusAt: 9 }),
      job({ status: "booked", term: "2026-11-07T08:00" }),
      job({ status: "quote", statusAt: 3 }),
      job({ status: "booked", term: "2026-11-05T08:00" }),
    ]);
    expect(list.map((j) => j.term ?? j.status)).toEqual(["2026-11-05T08:00", "2026-11-07T08:00", "quote", "paid"]);
  });

  it("pola tekstowe: ilość i marża z przecinkiem", () => {
    expect(parseQty("2,5")).toBe(2.5);
    expect(parseQty("0")).toBeUndefined();
    expect(parseMargin("12,5%")).toBe(12.5);
    expect(parseMargin("")).toBeNull();
    expect(parseMargin("abc")).toBeUndefined();
  });
});

describe("zlecenia własne — Yjs (H3.4)", () => {
  it("zakłada zlecenie, zmienia status z datą i dopisuje pozycje", () => {
    const y = createYJobs(new Y.Doc());
    expect(y.saveItem("s", { id: "a", kind: "labor", name: "X", qty: 1, unit: "usł.", price: 1, order: 0 })).toBe(false);
    expect(y.setMeta("s", { scope: "Kran" }, 100)).toBe(true);
    expect(y.get("s")).toMatchObject({ status: "quote", statusAt: 100, created: 100, scope: "Kran", items: [] });
    y.setMeta("s", { status: "booked", term: "2026-11-05T14:00" }, 200);
    expect(y.get("s")).toMatchObject({ status: "booked", statusAt: 200, created: 100, scope: "Kran", term: "2026-11-05T14:00" });
    y.saveItem("s", { id: "b", kind: "material", name: "Bateria", qty: 1, unit: "szt.", price: 250, order: 1 });
    y.saveItem("s", { id: "a", kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 150, order: 0 });
    expect(y.get("s")!.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(y.removeItem("s", "b")?.name).toBe("Bateria");
    expect(y.get("s")!.items).toHaveLength(1);
  });

  it("dwa telefony dopisujące różne pozycje scalają się bez strat", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYJobs(a);
    const yb = createYJobs(b);
    ya.setMeta("s", {}, 1);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    ya.saveItem("s", { id: "a", kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 150, order: 0 });
    yb.saveItem("s", { id: "b", kind: "material", name: "Bateria", qty: 1, unit: "szt.", price: 250, order: 1 });
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(ya.get("s")!.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(yb.get("s")!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("dopisanie pozycji na jednym telefonie nie cofa statusu zmienionego na drugim (W16)", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYJobs(a);
    const yb = createYJobs(b);
    ya.setMeta("s", {}, 1);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    yb.setMeta("s", { status: "paid" }, 5); // drugi telefon: zapłacone
    ya.saveItem("s", { id: "a", kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 150, order: 0 }); // pierwszy: nowa pozycja
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    for (const y of [ya, yb]) {
      expect(y.get("s")!.status).toBe("paid");
      expect(y.get("s")!.items.map((i) => i.id)).toEqual(["a"]);
      expect(y.get("s")!.changedAt).toBeGreaterThan(0);
    }
  });

  it("usunięcie zdejmuje zlecenie z pozycjami, „Cofnij” je przywraca; kopia scala bez nadpisywania", () => {
    const y = createYJobs(new Y.Doc());
    y.setMeta("s", { status: "done" }, 1);
    y.saveItem("s", { id: "a", kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 150, order: 0 });
    const dump = y.dump();
    const removed = y.remove("s")!;
    expect(y.get("s")).toBeUndefined();
    y.restore("s", removed);
    expect(y.get("s")!.items).toHaveLength(1);

    const other = createYJobs(new Y.Doc());
    other.setMeta("s", { status: "paid" }, 5);
    other.mergeDump(JSON.parse(JSON.stringify(dump)));
    expect(other.get("s")).toMatchObject({ status: "paid", items: [{ id: "a" }] });
  });
});

describe("potwierdzenie wykonania — poprawki po przeglądzie bezpieczeństwa (H3.5)", () => {
  it("M1: podpis ważny tylko, gdy złożony po ostatniej zmianie wyceny; zmiana pozycji albo zakresu go unieważnia", () => {
    const y = createYJobs(new Y.Doc());
    y.setMeta("s", { status: "done" }, 100);
    expect(signatureValidFor(y.get("s")!, { at: 150 })).toBe(true);
    expect(signatureValidFor(y.get("s")!, { at: 50 })).toBe(false);
    expect(signatureValidFor(y.get("s")!, null)).toBe(false);
    y.saveItem("s", { id: "a", kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 150, order: 0 });
    const after = y.get("s")!.changedAt!;
    expect(after).toBeGreaterThan(150);
    expect(signatureValidFor(y.get("s")!, { at: 150 })).toBe(false);
    // Sama zmiana statusu treści nie zmienia.
    y.setMeta("s", { status: "paid" }, after + 10);
    expect(y.get("s")!.changedAt).toBe(after);
    y.setMeta("s", { scope: "Inny zakres" }, after + 20);
    expect(y.get("s")!.changedAt).toBe(after + 20);
  });

  it("L1/L2: znaki sterujące i przełączniki kierunku znikają z tekstu do PDF", () => {
    expect(safeLine("Jan\nZapłacono: 0 zł")).toBe("Jan Zapłacono: 0 zł");
    expect(safeLine("plik\u202Efdp.exe")).toBe("plik fdp.exe");
    expect(cleanQuoteItem({ kind: "labor", name: "A\u2066B", qty: 1, price: 1 }, "a")?.name).toBe("A B");
  });

  it("L3: obraz podpisu rozpoznany po bajtach; za duże wymiary PNG odpadają", () => {
    const png = (w: number, h: number) => {
      const b = new Uint8Array(64);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      new DataView(b.buffer).setUint32(16, w);
      new DataView(b.buffer).setUint32(20, h);
      return b;
    };
    expect(signatureImageType(png(1200, 400))).toBe("image/png");
    expect(signatureImageType(png(50_000, 50_000))).toBeNull();
    expect(signatureImageType(new Uint8Array(64).fill(0x41))).toBeNull();
    const jpg = new Uint8Array(64); jpg.set([0xff, 0xd8, 0xff]);
    expect(signatureImageType(jpg)).toBe("image/jpeg");
  });
});
