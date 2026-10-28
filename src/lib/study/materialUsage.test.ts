import { describe, expect, it } from "vitest";
import { costOf, materialCsv, materialText, materialUsage } from "./materialUsage";
import { fittingKey } from "./fittings";
import type { Shortage } from "./shortages";
import type { JournalEntry } from "./yStudy";

const at = (m: number, d: number) => new Date(2026, m - 1, d, 10).getTime();
const e = (id: string, when: number, fittings: { name: string; qty: number }[], siteId = "lipowa"): JournalEntry =>
  ({ id, at: when, kind: "ok", topic: null, text: "x", site: "Lipowa 5", siteId, checked: [], images: [], fittings }) as JournalEntry;

const journal = [
  e("a", at(9, 20), [{ name: "Kolano 16", qty: 10 }]),
  e("b", at(10, 2), [{ name: "Kolano 16", qty: 4 }, { name: "Trójnik 16", qty: 2 }]),
  e("c", at(10, 9), [{ name: "kolano 16", qty: 1 }]),
  e("x", at(10, 9), [{ name: "Kolano 16", qty: 99 }], "inna"),
];
const shortages: Shortage[] = [
  { id: "s1", text: "Rura PEX 16", qty: "50 m", status: "delivered", at: at(10, 1), changed: at(10, 5) },
  { id: "s2", text: "Klej", qty: "", status: "ordered", at: at(10, 1) },
];

describe("zużycie materiału (P2.6)", () => {
  it("sumuje kształtki tej budowy per miesiąc (od najnowszego), bez innych budów", () => {
    const u = materialUsage(journal, "lipowa", shortages, {});
    expect(u.months.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
    expect(u.months[0].fittings).toEqual(expect.arrayContaining([{ name: "Kolano 16", qty: 5 }, { name: "Trójnik 16", qty: 2 }]));
    expect(u.months[1].fittings).toEqual([{ name: "Kolano 16", qty: 10 }]);
    expect(u.total.find((f) => f.name === "Kolano 16")?.qty).toBe(15);
  });

  it("dostarczone braki wpadają do miesiąca zmiany statusu; zamówione nie", () => {
    const u = materialUsage(journal, "lipowa", shortages, {});
    expect(u.months[0].delivered).toEqual([{ text: "Rura PEX 16", qty: "50 m" }]);
  });

  it("wartość tylko z wycenionych pozycji, z liczbą pozycji bez ceny", () => {
    const prices = { [fittingKey("Kolano 16")]: 4.5 };
    expect(costOf([{ name: "Kolano 16", qty: 2 }, { name: "Trójnik 16", qty: 1 }], prices)).toEqual({ cost: 9, unpriced: 1 });
    expect(costOf([{ name: "Trójnik 16", qty: 1 }], prices)).toEqual({ cost: null, unpriced: 1 });
  });

  it("tekst i CSV: cena × ilość, dostawy, BOM i separator średnik", () => {
    const prices = { [fittingKey("Kolano 16")]: 4.5 };
    const u = materialUsage(journal, "lipowa", shortages, prices);
    const text = materialText(u, "Lipowa 5", prices);
    expect(text).toContain("- Kolano 16: 5 szt. × 4,50 zł = 22,50 zł");
    expect(text).toContain("- Dostarczone: Rura PEX 16 — 50 m");
    expect(text).toContain("Razem: 67,50 zł (1 poz. bez ceny)");
    const csv = materialCsv(u, prices);
    expect(csv.startsWith("\uFEFFMiesiąc;Rodzaj;Pozycja")).toBe(true);
    expect(csv).toContain("2026-09;kształtka;Kolano 16;10;4,50;45,00");
    expect(csv).toContain("2026-10;dostawa;Rura PEX 16;50 m;;");
  });
});
