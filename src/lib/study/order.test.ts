import { describe, expect, it } from "vitest";
import type { JournalEntry } from "./yStudy";
import { orderText, siteOrder, whatsappOrderUrl } from "./order";
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
      items: [{ name: "Kolano 16", qty: 6 }, { name: "Trójnik 16", qty: 1 }],
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
    const text = orderText("Dom", { items: [{ name: "Kolano 16", qty: 1 }], entries: 3, since: day(3) });
    expect(text).toContain(`Liczone od ${new Date(day(3)).toLocaleDateString("pl-PL")} (3 wpisów).`);
  });

  it("bez pozycji mówi wprost, że nic nie trzeba zamawiać", () => {
    expect(orderText("Dom", { items: [], entries: 0, since: null })).toBe(
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
