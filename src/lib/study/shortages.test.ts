import { describe, expect, it } from "vitest";
import {
  addShortage, cleanOrderLog, cleanShortages, clearDelivered, dueDayValue, dueFromDayValue, logOrder, nextStatus, openShortages,
  orderLateFrom, orderLogLine, ORDER_LATE_DAYS, ORDER_LOG_MAX, removeShortage, setShortageDue, setShortageStatus, shortageLine,
  shortagesText, SHORTAGES_MAX, spokenShortageLabel, cleanShortagesCounted, addShortagesFromDictation,
} from "./shortages";
import { cleanSite } from "./sites";

const day = (d: number) => new Date(2026, 9, d, 12).getTime();
let n = 0;
const id = () => `b-${++n}`;

describe("braki materiału", () => {
  it("dopisanie z ilością; ta sama nazwa niedostarczona nie robi duplikatu, tylko podmienia ilość", () => {
    let list = addShortage([], "  Rura   PEX 16 ", "50 m", day(1), id);
    expect(list).toEqual([{ id: "b-1", text: "Rura PEX 16", qty: "50 m", status: "missing", at: day(1) }]);
    list = addShortage(list, "rura pex 16", "80 m", day(2), id);
    expect(list).toHaveLength(1);
    expect(list[0].qty).toBe("80 m");
    expect(addShortage(list, "   ", "", day(2), id)).toHaveLength(1);
  });

  it("dostarczona pozycja nie blokuje nowego braku o tej samej nazwie", () => {
    let list = addShortage([], "Klej PCV", "", day(1), id);
    list = setShortageStatus(list, list[0].id, "delivered", day(2));
    expect(addShortage(list, "Klej PCV", "", day(3), id)).toHaveLength(2);
  });

  it("status w kółko: brakuje → zamówione → dostarczone → brakuje; zmiana zapisuje datę", () => {
    expect(nextStatus("missing")).toBe("ordered");
    expect(nextStatus("ordered")).toBe("delivered");
    expect(nextStatus("delivered")).toBe("missing");
    const list = setShortageStatus(addShortage([], "Otulina", "", day(1), id), `b-${n}`, "ordered", day(4));
    expect(list[0]).toMatchObject({ status: "ordered", changed: day(4) });
  });

  it("otwarte: bez dostarczonych, najpierw brakujące; czyszczenie i usuwanie", () => {
    let list = addShortage([], "A", "", day(1), id);
    list = addShortage(list, "B", "", day(2), id);
    list = addShortage(list, "C", "", day(3), id);
    list = setShortageStatus(list, list[0].id, "ordered", day(4));
    list = setShortageStatus(list, list[2].id, "delivered", day(5));
    expect(openShortages(list).map((s) => s.text)).toEqual(["B", "A"]);
    expect(clearDelivered(list).map((s) => s.text)).toEqual(["A", "B"]);
    expect(removeShortage(list, list[1].id).map((s) => s.text)).toEqual(["A", "C"]);
  });

  it("limit pozycji", () => {
    let list = addShortage([], "x0", "", 0, id);
    for (let i = 1; i < 60; i++) list = addShortage(list, `x${i}`, "", 0, id);
    expect(list).toHaveLength(SHORTAGES_MAX);
  });

  it("linia i tekst do wysłania", () => {
    const ordered = { id: "1", text: "Klej PCV", qty: "", status: "ordered" as const, at: day(1), changed: day(14) };
    expect(shortageLine({ id: "2", text: "Rura PEX 16", qty: "50 m", status: "missing", at: day(1) })).toBe("Rura PEX 16: 50 m — brakuje");
    expect(shortageLine(ordered)).toBe("Klej PCV — zamówione 14.10");
    expect(shortagesText("Lipowa 5", [ordered])).toBe("Braki materiału — Lipowa 5\n- Klej PCV — zamówione 14.10");
    expect(shortagesText("Lipowa 5", [])).toBe("Braki materiału — Lipowa 5\nNiczego nie brakuje.");
  });

  it("cleanShortages: zły status → brakuje, śmieci i duplikaty id odpadają", () => {
    expect(cleanShortages(null)).toBeUndefined();
    expect(cleanShortages([
      { id: "a", text: "Rura", qty: 5, status: "zgubione", at: "x" },
      { id: "a", text: "Duplikat" },
      { id: "b", text: "" },
    ])).toEqual([{ id: "a", text: "Rura", qty: "", status: "missing", at: 0 }]);
  });
});

describe("data dostawy braku", () => {
  const ordered = { id: "1", text: "Klej PCV", qty: "", status: "ordered" as const, at: day(1), changed: day(14) };

  it("ustawia datę tylko przy zamówionym, czyści ją undefined", () => {
    const withDue = setShortageDue([ordered, { ...ordered, id: "2", status: "missing" }], "1", day(20));
    expect(withDue[0].due).toBe(day(20));
    expect(setShortageDue([ordered], "1", undefined)[0]).not.toHaveProperty("due");
    expect(setShortageDue([{ ...ordered, id: "2", status: "missing" }], "2", day(20))[0]).not.toHaveProperty("due");
  });

  it("termin z datą dostawy to koniec tego dnia, bez niej — ponad ORDER_LATE_DAYS od zmiany", () => {
    expect(orderLateFrom({ ...ordered, due: day(20) })).toBe(new Date(2026, 9, 20, 23, 59, 59, 999).getTime());
    expect(orderLateFrom(ordered)).toBe(day(14) + ORDER_LATE_DAYS * 24 * 60 * 60 * 1000);
    expect(orderLateFrom({ ...ordered, status: "delivered" })).toBeNull();
  });

  it("wartość pola daty przechodzi w obie strony bez przesunięcia dnia", () => {
    expect(dueDayValue(day(20))).toBe("2026-10-20");
    expect(dueFromDayValue("2026-10-20")).toBe(new Date(2026, 9, 20).getTime());
    expect(dueFromDayValue("")).toBeUndefined();
    expect(dueFromDayValue("20.10.2026")).toBeUndefined();
  });

  it("dostawa w linii do wysłania, a czyszczenie zachowuje ją w zapisie", () => {
    expect(shortageLine({ ...ordered, due: day(20) })).toBe("Klej PCV — zamówione 14.10, dostawa 20.10");
    expect(cleanShortages([{ ...ordered, due: day(20) }])?.[0].due).toBe(day(20));
    expect(cleanShortages([{ ...ordered, due: NaN }])?.[0]).not.toHaveProperty("due");
  });
});

describe("historia zamówień kształtek", () => {
  it("dopisuje zamówienie, pomija puste, trzyma ostatnie", () => {
    let log = logOrder(undefined, [{ name: "Kolano 16", qty: 5 }], day(1));
    log = logOrder(log, [], day(2));
    expect(log).toEqual([{ at: day(1), items: [{ name: "Kolano 16", qty: 5 }] }]);
    for (let i = 0; i < 30; i++) log = logOrder(log, [{ name: "Mufa 32", qty: 1 }], day(3) + i);
    expect(log).toHaveLength(ORDER_LOG_MAX);
    expect(orderLogLine({ at: day(14), items: [{ name: "Kolano 16", qty: 5 }, { name: "Trójnik 16", qty: 1 }] })).toBe("14.10 — Kolano 16 × 5, Trójnik 16 × 1");
  });

  it("cleanOrderLog: sortuje, odrzuca wpisy bez dat i bez pozycji", () => {
    expect(cleanOrderLog([
      { at: day(5), items: [{ name: "Kolano 16", qty: 2 }] },
      { at: "x", items: [{ name: "A", qty: 1 }] },
      { at: day(1), items: [] },
      { at: day(2), items: [{ name: "Złączka 20", qty: 1 }] },
    ])?.map((o) => o.at)).toEqual([day(2), day(5)]);
  });

  it("cleanSite zachowuje braki i historię, a bez nich nie dopisuje pól", () => {
    const base = { id: "k1", name: "Dom", address: "", investor: "", created: 1 };
    const card = cleanSite({ ...base, shortages: [{ id: "a", text: "Rura", qty: "5 m", status: "ordered", at: 1 }], orders: [{ at: 2, items: [{ name: "Kolano 16", qty: 1 }] }] });
    expect(card?.shortages).toHaveLength(1);
    expect(card?.orders).toHaveLength(1);
    expect(cleanSite(base)).not.toHaveProperty("shortages");
    expect(cleanSite(base)).not.toHaveProperty("orders");
  });
});

describe("spokenShortageLabel", () => {
  it("nie rusza liter w środku słów i wielkość pierwszej litery", () => {
    expect(spokenShortageLabel("dokupić stalowe kolano")).toBe("Dokupić stalowe kolano");
    expect(spokenShortageLabel("  rura   pex  16 ")).toBe("Rura pex 16");
  });
  it("pusty wynik zostaje pusty", () => {
    expect(spokenShortageLabel("   ")).toBe("");
  });
});

describe("cleanShortages — limit 40 zostawia najnowsze (1.12 planu Praca 2026-10-24)", () => {
  const item = (i: number, extra: Record<string, unknown> = {}) => ({ id: `b${i}`, text: `Brak ${i}`, qty: "", status: "missing", at: i, ...extra });

  it("przy 41 brakujących odpada najstarszy, kolejność zostaje", () => {
    const out = cleanShortages(Array.from({ length: 41 }, (_, i) => item(i + 1))) ?? [];
    expect(out).toHaveLength(40);
    expect(out[0].id).toBe("b2");
    expect(out.at(-1)?.id).toBe("b41");
  });

  it("najpierw odpadają dostarczone — od najdawniej zmienionych — dopiero potem najstarsze", () => {
    const raw = Array.from({ length: 42 }, (_, i) => item(i + 1));
    raw[29] = item(30, { status: "delivered", changed: 500 });
    raw[39] = item(40, { status: "delivered", changed: 100 });
    raw[40] = item(41, { status: "delivered", changed: 900 });
    const { list, dropped } = cleanShortagesCounted(raw);
    expect(dropped).toBe(2);
    const ids = (list ?? []).map((x) => x.id);
    expect(ids).not.toContain("b40");
    expect(ids).not.toContain("b30");
    expect(ids).toContain("b41");
    expect(ids).toContain("b1");
  });
});

describe("cleanShortagesCounted", () => {
  it("liczy pozycje poprawne, które nie weszły przez limit", () => {
    const raw = Array.from({ length: 43 }, (_, i) => ({ id: `c${i + 1}`, text: `Brak ${i + 1}`, qty: "", status: "missing", at: i + 1 }));
    const { list, dropped } = cleanShortagesCounted(raw);
    expect(list).toHaveLength(40);
    expect(dropped).toBe(3);
  });
  it("śmieci i duplikaty nie są liczone jako odrzucone", () => {
    const { dropped } = cleanShortagesCounted([{ id: "x", text: "A" }, { id: "x", text: "A" }, null, { text: "bez id" }]);
    expect(dropped).toBe(0);
  });
});

describe("addShortagesFromDictation", () => {
  const item = (i: number) => ({ id: `d${i}`, text: `Brak ${i}`, qty: "", status: "missing" as const, at: i });
  it("przy pełnej liście liczy tylko nowe pozycje, nie duplikaty", () => {
    const full = Array.from({ length: 40 }, (_, i) => item(i + 1));
    const { list, rejected } = addShortagesFromDictation(full, [{ text: "Brak 1", qty: "" }, { text: "Nowy", qty: "" }], 99, () => "n1");
    expect(list).toHaveLength(40);
    expect(rejected).toBe(1);
  });
  it("przy wolnym miejscu nic nie odrzuca", () => {
    const { list, rejected } = addShortagesFromDictation([], [{ text: "Rura", qty: "2" }], 5, () => "r1");
    expect(list.map((s) => s.text)).toEqual(["Rura"]);
    expect(rejected).toBe(0);
  });
});
