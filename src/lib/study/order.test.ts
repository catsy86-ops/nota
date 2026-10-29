import { describe, expect, it } from "vitest";
import type { JournalEntry } from "./yStudy";
import { orderText, siteOrder, supplierOrderText, whatsappOrderUrl } from "./order";
import { markMissingOrdered, type Shortage } from "./shortages";
import { cleanSite, siteKey } from "./sites";

const day = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
const entry = (id: string, at: number, fittings: JournalEntry["fittings"], site = "Dom Kowalski", siteId?: string): JournalEntry => ({
  id, at, kind: "ok", topic: null, text: "montaż", site, siteId, checked: [], images: [], fittings,
});

const SITE = siteKey("Dom Kowalski");

describe("siteOrder — kształtki do zamówienia", () => {
  it("sumuje kształtki wszystkich wpisów budowy, od największej liczby", () => {
    const journal = [
      entry("a", day(1), [{ name: "Kolano 16", qty: 4 }, { name: "Trójnik 16", qty: 1 }]),
      entry("b", day(2), [{ name: "kolano 16", qty: 2 }]),
    ];
    const o = siteOrder(journal, SITE);
    expect(o.items).toEqual([{ name: "Kolano 16", qty: 6 }, { name: "Trójnik 16", qty: 1 }]);
    expect(o.entries).toBe(2);
    expect(o.since).toBeNull();
  });

  it("nie liczy wpisów sprzed ostatniego zamówienia", () => {
    const journal = [
      entry("stary", day(1), [{ name: "Kolano 16", qty: 10 }]),
      entry("nowy", day(5), [{ name: "Kolano 16", qty: 3 }]),
    ];
    const o = siteOrder(journal, SITE, day(3));
    expect(o.items).toEqual([{ name: "Kolano 16", qty: 3 }]);
    expect(o.entries).toBe(1);
    expect(o.since).toBe(day(3));
  });

  it("wpis dokładnie w chwili zamówienia już jest zamówiony (liczymy tylko nowsze)", () => {
    const o = siteOrder([entry("x", day(3), [{ name: "Kolano 16", qty: 2 }])], SITE, day(3));
    expect(o.items).toEqual([]);
    expect(o.entries).toBe(0);
  });

  it("pomija inne budowy i wpisy bez kształtek", () => {
    const journal = [
      entry("inna", day(1), [{ name: "Kolano 16", qty: 9 }], "Blok 4", siteKey("Blok 4")),
      entry("bez", day(2), undefined),
      entry("pusta", day(2), []),
      entry("ta", day(3), [{ name: "Złączka 20", qty: 2 }]),
    ];
    const o = siteOrder(journal, SITE);
    expect(o.items).toEqual([{ name: "Złączka 20", qty: 2 }]);
    expect(o.entries).toBe(1);
  });

  it("wpis z siteId wskazuje budowę, nawet gdy nazwa się różni", () => {
    const o = siteOrder([entry("x", day(1), [{ name: "Trójnik 20", qty: 1 }], "Stara nazwa", "karta-1")], "karta-1");
    expect(o.items).toEqual([{ name: "Trójnik 20", qty: 1 }]);
  });
});

describe("orderText — tekst do wysłania", () => {
  it("wypisuje pozycje i od kiedy liczymy", () => {
    const text = orderText("Dom Kowalski", {
      items: [{ name: "Kolano 16", qty: 6 }, { name: "Trójnik 16", qty: 1 }], pipes: [],
      entries: 2,
      since: null,
    });
    expect(text.split("\n")).toEqual([
      "Zamówienie kształtek — Dom Kowalski",
      "- Kolano 16: 6 szt.",
      "- Trójnik 16: 1 szt.",
      "Liczone od początku budowy.",
    ]);
  });

  it("przy zamówieniu podaje datę i liczbę wpisów w liczbie mnogiej", () => {
    const text = orderText("Dom", { items: [{ name: "Kolano 16", qty: 1 }], pipes: [], entries: 3, since: day(3) });
    expect(text).toContain(`Liczone od ${new Date(day(3)).toLocaleDateString("pl-PL")} (3 wpisów).`);
  });

  it("bez pozycji mówi wprost, że nic nie trzeba zamawiać", () => {
    expect(orderText("Dom", { items: [], pipes: [], entries: 0, since: null })).toBe(
      "Zamówienie kształtek — Dom\nNic do zamówienia od ostatniego zamówienia.",
    );
  });
});

describe("cleanSite — zamówienie w karcie", () => {
  const base = { id: "k1", name: "Dom", address: "", investor: "", created: 1 };

  it("zachowuje orderedAt, gdy jest liczbą", () => {
    expect(cleanSite({ ...base, orderedAt: day(4) })?.orderedAt).toBe(day(4));
  });

  it("odrzuca orderedAt, który nie jest liczbą, i nie dopisuje pola", () => {
    const card = cleanSite({ ...base, orderedAt: "wczoraj" });
    expect(card).not.toBeNull();
    expect(card).not.toHaveProperty("orderedAt");
  });
});

describe("whatsappOrderUrl (U7)", () => {
  it("koduje tekst zamówienia w parametrze text, bez numeru odbiorcy", () => {
    const url = whatsappOrderUrl("Zamówienie: kolano 16 — 2 szt.\nTrójnik");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("Zamówienie: kolano 16 — 2 szt.\nTrójnik");
  });
});

describe("wiadomość do hurtowni: braki i kształtki (1.7 planu Praca 2026-10-24)", () => {
  const list: Shortage[] = [
    { id: "a", text: "Klej PCV", qty: "2 opak.", status: "missing", at: 1 },
    { id: "b", text: "Rura PEX 16", qty: "", status: "missing", at: 2 },
    { id: "c", text: "Zawór", qty: "1", status: "ordered", at: 3 },
  ];

  it("braki „Brakuje” i kształtki w jednym tekście; zamówione braki się nie powtarzają", () => {
    const order = siteOrder([entry("1", day(14), [{ name: "kolano 16", qty: 4 }], "Dom Kowalski", SITE)], SITE);
    expect(supplierOrderText("Dom Kowalski", order, list).split(String.fromCharCode(10))).toEqual([
      "Zamówienie — Dom Kowalski", "Braki:", "- Klej PCV: 2 opak.", "- Rura PEX 16",
      "Kształtki:", "- kolano 16: 4 szt.", "Kształtki liczone od początku budowy.",
    ]);
  });

  it("bez braków — dotychczasowy tekst zamówienia kształtek", () => {
    const order = siteOrder([entry("1", day(14), [{ name: "kolano 16", qty: 4 }], "Dom Kowalski", SITE)], SITE);
    expect(supplierOrderText("Dom Kowalski", order, [])).toBe(orderText("Dom Kowalski", order));
  });

  it("markMissingOrdered zmienia tylko „Brakuje”, z datą zmiany", () => {
    expect(markMissingOrdered(list, 9).map((s) => [s.status, s.changed])).toEqual([["ordered", 9], ["ordered", 9], ["ordered", undefined]]);
  });
});

describe("rury w zamówieniu (H1.1)", () => {
  it("siteOrder sumuje rury od ostatniego zamówienia; wpis z samymi rurami się liczy", () => {
    const journal = [
      { ...entry("a", day(10), undefined), pipes: [{ name: "Rura PEX 16×2", cm: 2000 }] },
      { ...entry("b", day(12), [{ name: "Kolano 16", qty: 2 }]), pipes: [{ name: "rura pex 16×2", cm: 450 }] },
      { ...entry("c", day(5), undefined), pipes: [{ name: "Rura PVC 110", cm: 300 }] },
    ];
    const order = siteOrder(journal, SITE, day(8));
    expect(order.pipes).toEqual([{ name: "Rura PEX 16×2", cm: 2450 }]);
    expect(order.entries).toBe(2);
  });

  it("tekst do hurtowni ma rury w metrach, także bez kształtek i braków", () => {
    const order = { items: [], pipes: [{ name: "Rura PEX 16×2", cm: 2450 }], entries: 1, since: null };
    expect(orderText("Dom", order)).toContain("- Rura PEX 16×2: 24,5 m");
    const missing: Shortage[] = [{ id: "s1", text: "Klej", qty: "1", status: "missing", at: day(1) } as Shortage];
    expect(supplierOrderText("Dom", order, missing).split("\n")).toEqual(["Zamówienie — Dom", "Braki:", "- Klej: 1", "Rury:", "- Rura PEX 16×2: 24,5 m"]);
  });
});
