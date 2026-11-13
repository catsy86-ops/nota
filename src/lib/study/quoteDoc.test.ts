import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addDaysKey } from "@/lib/shifts/pattern";
import { VAT_RATES } from "@/lib/ksef/invoice";
import { applyQuoteDoc, CONTENT_FIELDS, META_FIELDS, QUOTE_VAT_RATES, cleanDiscount, cleanNotes, cleanQuoteDoc, effectiveValidUntil, nextQuoteNumber, parseQuoteNumber, quoteState } from "./quoteDoc";
import { quoteSummary, signatureValidFor, unpaidTotal, type Job } from "./jobs";
import { createYJobs } from "./yJobs";
import type { QuoteDoc } from "./quoteDoc";

const job = (over: Partial<Job> = {}): Job => ({ status: "done", statusAt: 1, created: 1, items: [], ...over });
const item = (price: number, over = {}) => ({ id: "a", kind: "labor" as const, name: "Montaż", qty: 1, unit: "usł.", price, order: 0, ...over });

describe("cleanQuoteDoc", () => {
  it("pusty albo śmieciowy dokument to null", () => {
    expect(cleanQuoteDoc(null)).toBeNull();
    expect(cleanQuoteDoc({})).toBeNull();
    expect(cleanQuoteDoc({ number: "X/1", issued: "wczoraj", discount: 500, vatMode: "zły", sentAt: -1 })).toBeNull();
  });

  it("zostawia poprawne pola; VAT bez stawki dostaje 23, zła stawka też", () => {
    expect(cleanQuoteDoc({ number: "W/A/2026/001", issued: "2026-11-13", validUntil: "2026-11-27", vatMode: "net", discount: 10.555, notes: " Zaliczka 30% ", sentAt: 5 }))
      .toEqual({ number: "W/A/2026/001", issued: "2026-11-13", validUntil: "2026-11-27", vatMode: "net", vatRate: 23, discount: 10.56, notes: "Zaliczka 30%", sentAt: 5 });
    expect(cleanQuoteDoc({ vatMode: "gross", vatRate: 8 })).toEqual({ vatMode: "gross", vatRate: 8 });
    expect(cleanQuoteDoc({ vatMode: "gross", vatRate: 7 })).toEqual({ vatMode: "gross", vatRate: 23 });
    // Stawka bez trybu VAT nie włącza VAT-u.
    expect(cleanQuoteDoc({ vatRate: 8, notes: "x" })).toEqual({ notes: "x" });
  });

  it("uwagi: wiele linii zostaje, znaki sterujące i przełączniki kierunku znikają, limit 500", () => {
    expect(cleanNotes("a\r\n\r\n\r\n\r\nb\u0007‮ c")).toBe("a\n\nb c");
    expect(cleanNotes("x".repeat(900))).toHaveLength(500);
    expect(cleanNotes(5)).toBe("");
    expect(cleanDiscount(0)).toBeUndefined();
    expect(cleanDiscount(100.1)).toBeUndefined();
    expect(cleanDiscount(100)).toBe(100);
  });
});

describe("applyQuoteDoc i quoteSummary", () => {
  it("bez dokumentu kwota do zapłaty to suma pozycji", () => {
    expect(applyQuoteDoc(500)).toEqual({ discount: 0, payable: 500 });
    expect(quoteSummary(job({ items: [item(500)] }))).toMatchObject({ subtotal: 500, payable: 500, discount: 0 });
  });

  it("rabat liczony od całości, potem VAT: ceny netto + 23%", () => {
    const t = applyQuoteDoc(1000, { discount: 10, vatMode: "net", vatRate: 23 });
    expect(t).toEqual({ discount: 100, net: 900, vat: 207, vatRate: 23, payable: 1107 });
  });

  it("ceny brutto: VAT wyciągany z kwoty, do zapłaty tyle co po rabacie", () => {
    const t = applyQuoteDoc(1230, { vatMode: "gross", vatRate: 23 });
    expect(t).toEqual({ discount: 0, net: 1000, vat: 230, vatRate: 23, payable: 1230 });
    const rounded = applyQuoteDoc(100, { vatMode: "gross", vatRate: 8 });
    expect(rounded.net).toBe(92.59);
    expect(rounded.vat).toBe(7.41);
    expect(Math.round(((rounded.net ?? 0) + (rounded.vat ?? 0)) * 100)).toBe(10000);
  });

  it("marża materiału liczy się przed rabatem; „Niezapłacone” bierze kwotę do zapłaty", () => {
    const j = job({ margin: 20, items: [item(100), item(100, { id: "b", kind: "material" })], doc: { discount: 50 } });
    // 100 robocizna + 120 materiał z marżą = 220, rabat 50% → 110.
    expect(quoteSummary(j)).toMatchObject({ subtotal: 220, discount: 110, payable: 110 });
    expect(unpaidTotal([j, job({ status: "paid", items: [item(999)] })])).toBe(110);
  });
});

describe("klasyfikacja pól dokumentu", () => {
  it("każde pole QuoteDoc jest treścią dla klienta albo metadanymi, żadne nie jest w obu", () => {
    const full: Required<QuoteDoc> = {
      number: "", issued: "", validUntil: "", vatMode: "net", vatRate: 23, discount: 1, notes: "", deposit: 1, depositPaid: 1, sentAt: 1, acceptedAt: 1, rejectedAt: 1,
    };
    const classified = [...CONTENT_FIELDS, ...META_FIELDS];
    expect([...classified].sort()).toEqual(Object.keys(full).sort());
    expect(new Set(classified).size).toBe(classified.length);
  });

  it("stawki VAT wyceny to te same stawki co na fakturze", () => {
    expect([...QUOTE_VAT_RATES]).toEqual([...VAT_RATES]);
  });
});

describe("numeracja i stan", () => {
  it("następny numer serii w roku to największy + 1, obce serie i lata nie liczą się", () => {
    expect(nextQuoteNumber("a", 2026, [])).toBe("W/A/2026/001");
    expect(nextQuoteNumber("A", 2026, ["W/A/2026/001", "W/A/2026/007", "W/B/2026/050", "W/A/2025/090", "FV/A/2026/099", "śmieć"])).toBe("W/A/2026/008");
    expect(parseQuoteNumber("W/A/2026/008")).toEqual({ series: "A", year: 2026, seq: 8 });
    expect(parseQuoteNumber("W/A/26/8")).toBeNull();
  });

  it("ważność domyślnie 14 dni od wystawienia, także przez koniec miesiąca i roku", () => {
    expect(addDaysKey("2026-11-20", 14)).toBe("2026-12-04");
    expect(addDaysKey("2026-12-25", 14)).toBe("2027-01-08");
    expect(effectiveValidUntil({ issued: "2026-11-13" })).toBe("2026-11-27");
    expect(effectiveValidUntil({ issued: "2026-11-13", validUntil: "2026-12-31" })).toBe("2026-12-31");
    expect(effectiveValidUntil({})).toBeUndefined();
  });

  it("stan: późniejsze rozstrzygnięcie wygrywa, wysłana tylko bez rozstrzygnięcia", () => {
    expect(quoteState(undefined)).toBe("draft");
    expect(quoteState({ sentAt: 1 })).toBe("sent");
    expect(quoteState({ sentAt: 1, acceptedAt: 5 })).toBe("accepted");
    expect(quoteState({ sentAt: 1, acceptedAt: 5, rejectedAt: 9 })).toBe("rejected");
    expect(quoteState({ acceptedAt: 9, rejectedAt: 5 })).toBe("accepted");
    // Ponowne wysłanie po odrzuceniu albo przyjęciu to znowu „wysłana”.
    expect(quoteState({ sentAt: 10, rejectedAt: 5 })).toBe("sent");
    expect(quoteState({ sentAt: 10, acceptedAt: 5 })).toBe("sent");
  });
});

describe("dokument wyceny w Yjs (yJobs)", () => {
  const withJob = () => {
    const doc = new Y.Doc();
    const y = createYJobs(doc);
    y.setMeta("s1", { status: "quote" }, 100);
    return { doc, y };
  };

  it("zapisuje, scala z poprzednim, zdejmuje pole przez undefined i odrzuca budowę bez zlecenia", () => {
    const { y } = withJob();
    expect(y.setDoc("brak", { notes: "x" })).toBe(false);
    y.setDoc("s1", { number: "W/A/2026/001", issued: "2026-11-13" });
    y.setDoc("s1", { discount: 10 });
    expect(y.get("s1")?.doc).toEqual({ number: "W/A/2026/001", issued: "2026-11-13", discount: 10 });
    y.setDoc("s1", { discount: undefined });
    expect(y.get("s1")?.doc).toEqual({ number: "W/A/2026/001", issued: "2026-11-13" });
  });

  it("zmiana treści dla klienta unieważnia podpis, zmiana numeru czy stanu — nie", () => {
    const { y } = withJob();
    const sig = { at: 500 };
    y.setDoc("s1", { number: "W/A/2026/001", issued: "2026-11-13", sentAt: 400 }, 300);
    expect(signatureValidFor(y.get("s1")!, sig)).toBe(true);
    y.setDoc("s1", { acceptedAt: 600 }, 700);
    expect(signatureValidFor(y.get("s1")!, sig)).toBe(true);
    y.setDoc("s1", { discount: 5 }, 800);
    expect(signatureValidFor(y.get("s1")!, sig)).toBe(false);
  });

  it("dwa urządzenia zmieniające różne pola dokumentu: wygrywa ostatnia synchronizacja całego dokumentu, zlecenie zostaje", () => {
    const a = withJob();
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a.doc));
    const yb = createYJobs(b);
    a.y.setDoc("s1", { notes: "z telefonu A" });
    yb.setMeta("s1", { status: "paid" }, 200);
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a.doc));
    for (const y of [a.y, yb]) {
      expect(y.get("s1")?.status).toBe("paid");
      expect(y.get("s1")?.doc?.notes).toBe("z telefonu A");
    }
  });

  it("starsza wersja przepisująca wpis zlecenia nie gubi dokumentu wyceny", () => {
    const { doc, y } = withJob();
    y.setDoc("s1", { number: "W/A/2026/001", discount: 10 });
    // Starsza wersja zna tylko klucze `j`, `i`, `c`: zmiana statusu przepisuje `j` i nie dotyka `q`.
    const map = doc.getMap<unknown>("studyJobs");
    const j = map.get("j\u0001s1") as Record<string, unknown>;
    map.set("j\u0001s1", { ...j, status: "paid" });
    expect(y.get("s1")?.status).toBe("paid");
    expect(y.get("s1")?.doc).toMatchObject({ number: "W/A/2026/001", discount: 10 });
  });

  it("usunięcie zlecenia zabiera dokument, „Cofnij” go przywraca, a kopia scala bez nadpisywania", () => {
    const { y } = withJob();
    y.setDoc("s1", { number: "W/A/2026/001", notes: "A" });
    const removed = y.remove("s1")!;
    expect(y.get("s1")).toBeUndefined();
    y.restore("s1", removed);
    expect(y.get("s1")?.doc).toMatchObject({ number: "W/A/2026/001", notes: "A" });

    const dump = JSON.parse(JSON.stringify(y.dump()));
    const other = createYJobs(new Y.Doc());
    other.mergeDump(dump);
    expect(other.get("s1")?.doc?.notes).toBe("A");
    other.setDoc("s1", { notes: "lokalna" });
    other.mergeDump(dump);
    expect(other.get("s1")?.doc?.notes).toBe("lokalna");
  });
});

describe("dokument wyceny w Yjs: osobne klucze pól (code-review)", () => {
  const sync = (a: Y.Doc, b: Y.Doc) => { Y.applyUpdate(a, Y.encodeStateAsUpdate(b)); Y.applyUpdate(b, Y.encodeStateAsUpdate(a)); };
  const setup = () => {
    const a = new Y.Doc();
    const ya = createYJobs(a);
    ya.setMeta("s1", { status: "quote" }, 100);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    return { a, b, ya, yb: createYJobs(b) };
  };

  it("klient przyjmuje na jednym telefonie, a drugi (offline) zmienia uwagi — po synchronizacji są obie zmiany", () => {
    const { a, b, ya, yb } = setup();
    ya.setDoc("s1", { acceptedAt: 500 });
    yb.setDoc("s1", { notes: "Termin: 5 dni.", discount: 10 });
    sync(a, b);
    for (const y of [ya, yb]) expect(y.get("s1")?.doc).toEqual({ acceptedAt: 500, notes: "Termin: 5 dni.", discount: 10 });
  });

  it("zapisuje tylko zmienione pola: zmiana jednego nie przepisuje pozostałych", () => {
    const doc = new Y.Doc();
    const y = createYJobs(doc);
    y.setMeta("s1", { status: "quote" }, 1);
    y.setDoc("s1", { number: "W/A/2026/001", discount: 10 });
    const map = doc.getMap<unknown>("studyJobs");
    const keys = [...map.keys()].filter((k) => k.startsWith("qs1")).map((k) => k.split("")[2]).sort();
    expect(keys).toEqual(["discount", "number"]);
    const seen: string[] = [];
    // Znacznik zmiany treści `c␁budowa` (unieważnia podpis) jest osobnym kluczem — liczymy tylko pola dokumentu.
    map.observe((e) => e.changes.keys.forEach((_c, k) => { if (k.startsWith("q")) seen.push(k.split("")[2]); }));
    y.setDoc("s1", { discount: 15 });
    expect(seen).toEqual(["discount"]);
    // To samo wartości: bez zapisu.
    seen.length = 0;
    y.setDoc("s1", { discount: 15 });
    expect(seen).toEqual([]);
  });

  it("błędna zmiana nie kasuje poprzedniej wartości i niczego nie zapisuje", () => {
    const { ya } = setup();
    ya.setDoc("s1", { discount: 10, notes: "ok" });
    expect(ya.setDoc("s1", { discount: 150 })).toBe(false);
    expect(ya.setDoc("s1", { number: "zły numer" })).toBe(false);
    expect(ya.setDoc("s1", { discount: 20, number: "zły numer" })).toBe(false);
    expect(ya.get("s1")?.doc).toEqual({ discount: 10, notes: "ok" });
  });

  it("zdjęcie pola usuwa jego klucz, a usunięcie zlecenia — wszystkie klucze dokumentu", () => {
    const doc = new Y.Doc();
    const y = createYJobs(doc);
    y.setMeta("s1", { status: "quote" }, 1);
    y.setDoc("s1", { vatMode: "net", vatRate: 8, notes: "x" });
    const q = () => [...doc.getMap<unknown>("studyJobs").keys()].filter((k) => k.startsWith("q")).length;
    expect(q()).toBe(3);
    y.setDoc("s1", { vatMode: undefined, vatRate: undefined });
    expect(q()).toBe(1);
    y.remove("s1");
    expect(q()).toBe(0);
  });
});
