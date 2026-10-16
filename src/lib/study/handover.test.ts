import { describe, expect, it } from "vitest";
import { buildHandover, handoverText, HANDOVER_PHOTOS_MAX } from "./handover";
import { siteKey } from "./sites";
import type { JournalEntry } from "./yStudy";

const at = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
const e = (id: string, when: number, extra: Partial<JournalEntry> = {}, site = "Lipowa 5"): JournalEntry =>
  ({ id, at: when, kind: "ok", topic: null, text: "Montaż", site, checked: [], images: [], ...extra });
const IMG = (n: number) => String(n % 10).repeat(64);

const card = { id: siteKey("Lipowa 5"), name: "Lipowa 5", address: "ul. Lipowa 5, Kraków", investor: "Jan Kowalski" };

describe("protokół odbioru", () => {
  const journal = [
    e("a", at(1), { test: { medium: "water", bar: 9, minutes: 30, drop: 0, ok: true } }),
    e("b", at(3), { kind: "problem", text: "Brak rewizji w łazience\nszczegóły" }),
    e("c", at(4), { kind: "problem", text: "Przeciek", resolved: at(5) }),
    e("inna", at(2), { test: { medium: "water", bar: 9, minutes: 30, drop: 0, ok: false } }, "Polna 2"),
  ];

  it("dane budowy, okres prac, próby i uwagi tylko z tej budowy", () => {
    const h = buildHandover(journal, card, at(16));
    expect(h).toMatchObject({ site: "Lipowa 5", address: "ul. Lipowa 5, Kraków", investor: "Jan Kowalski", period: "1–4 października 2026", date: "16 października 2026", stages: null });
    expect(h.tests).toHaveLength(1);
    expect(h.tests[0].ok).toBe(true);
    expect(h.tests[0].line).toContain("Próba szczelności");
    expect(h.remarks).toEqual([{ at: at(3), text: "Brak rewizji w łazience" }]);
  });

  it("etapy z karty, zdjęcia od najstarszych do limitu", () => {
    const many = Array.from({ length: 15 }, (_, i) => e(`p${i}`, at(1) + i, { images: [IMG(i)] }));
    const h = buildHandover(many, { ...card, stages: [{ id: "woda", name: "Rozprowadzenie wody", done: at(2) }] }, at(16));
    expect(h.stages).toEqual([{ id: "woda", name: "Rozprowadzenie wody", done: at(2) }]);
    expect(h.photos).toHaveLength(HANDOVER_PHOTOS_MAX);
    expect(h.photos[0]).toBe(IMG(0));
    expect(h.morePhotos).toBe(3);
  });

  it("budowa bez wpisów — bez okresu, bez prób, bez uwag", () => {
    const h = buildHandover([], card, at(16));
    expect(h.period).toBeNull();
    const text = handoverText(h);
    expect(text).toContain("Brak protokołów prób w dzienniku.");
    expect(text).toContain("Brak uwag");
  });

  it("tekst protokołu: nagłówek, dane, etapy, próby i uwagi", () => {
    const text = handoverText(buildHandover(journal, { ...card, stages: [{ id: "proba", name: "Próba szczelności", done: at(1) }, { id: "odbior", name: "Odbiór" }] }, at(16)));
    expect(text.startsWith("# Protokół odbioru instalacji wod-kan — Lipowa 5")).toBe(true);
    expect(text).toContain("Inwestor: Jan Kowalski");
    expect(text).toContain("- [x] Próba szczelności (01.10.2026)\n- [ ] Odbiór");
    expect(text).toContain("## Uwagi\n- 03.10.2026 Brak rewizji w łazience");
  });
});
