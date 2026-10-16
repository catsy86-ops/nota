import { describe, expect, it } from "vitest";
import {
  addShortage, cleanOrderLog, cleanShortages, clearDelivered, logOrder, nextStatus, openShortages, orderLogLine,
  ORDER_LOG_MAX, removeShortage, setShortageStatus, shortageLine, shortagesText, SHORTAGES_MAX,
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
