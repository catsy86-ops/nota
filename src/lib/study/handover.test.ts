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
    expect(h.remarks).toEqual([{ at: at(3), text: "Brak rewizji w łazience", photosBefore: 0, photosAfter: 0 }]);
  });

  it("odczyty z minutnika trafiają do protokołu (B3.1); próba bez odczytów ich nie ma", () => {
    const withReadings = e("r", at(2), { test: { medium: "air", bar: 6, minutes: 30, drop: 0.1, ok: false, readings: [{ at: 0, bar: 6 }, { at: 900, bar: 5.95 }, { at: 1800, bar: 5.9 }] } });
    const h = buildHandover([...journal, withReadings], card, at(16));
    expect(h.tests.find((t) => t.readings)?.readings).toBe("0 min 6 bar → 15 min 5,95 bar → 30 min 5,9 bar");
    expect(h.tests.filter((t) => !t.readings)).toHaveLength(1);
  });

  it("spadki z poziomicy trafiają do protokołu z opisem wpisu (B3.4); bez pomiarów sekcji nie ma", () => {
    const withSlope = e("s", at(2), { text: "Pion w łazience\nszczegóły", level: 1.2 });
    const h = buildHandover([...journal, withSlope], card, at(16));
    expect(h.slopes).toEqual([{ at: at(2), line: "Spadek 2,1% (1,2°) — Pion w łazience" }]);
    expect(handoverText(h)).toContain("## Spadki rur (pomiar orientacyjny z telefonu)");
    expect(handoverText(h)).toContain("Spadek 2,1% (1,2°) — Pion w łazience");
    const none = buildHandover(journal, card, at(16));
    expect(none.slopes).toEqual([]);
    expect(handoverText(none)).not.toContain("Spadki rur");
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

describe("protokół odbioru — zdjęcia przy etapach", () => {
  const stages = [{ id: "kan-pod", name: "Kanalizacja podposadzkowa", done: at(1) }, { id: "proba", name: "Próba szczelności", done: at(3) }];

  it("grupy w kolejności etapów, pozostałe na końcu; tekst liczy zdjęcia etapów", () => {
    const journal = [
      e("x", at(1), { images: [IMG(1)] }),
      e("p", at(3), { images: [IMG(2), IMG(3)], stage: "proba" }),
      e("k", at(2), { images: [IMG(4)], stage: "kan-pod" }),
      e("usuniety", at(4), { images: [IMG(5)], stage: "nie-ma" }),
    ];
    const h = buildHandover(journal, { ...card, stages }, at(16));
    expect(h.photoGroups).toEqual([
      { stage: "Kanalizacja podposadzkowa", photos: [IMG(4)], dates: [at(2)] },
      { stage: "Próba szczelności", photos: [IMG(2), IMG(3)], dates: [at(3), at(3)] },
      { stage: null, photos: [IMG(1), IMG(5)], dates: [at(1), at(4)] },
    ]);
    expect(h.photos).toEqual([IMG(4), IMG(2), IMG(3), IMG(1), IMG(5)]);
    expect(handoverText(h)).toContain("Dokumentacja zdjęciowa: 5 zdjęć (Kanalizacja podposadzkowa: 1, Próba szczelności: 2).");
  });

  it("limit wydruku tnie od końca — etapy mają pierwszeństwo przed resztą", () => {
    const journal = [
      ...Array.from({ length: 10 }, (_, i) => e(`r${i}`, at(1) + i, { images: [IMG(i)] })),
      e("p", at(5), { images: [IMG(1), IMG(2), IMG(3), IMG(4), IMG(5)], stage: "proba" }),
    ];
    const h = buildHandover(journal, { ...card, stages }, at(16));
    expect(h.photoGroups.map((g) => [g.stage, g.photos.length])).toEqual([["Próba szczelności", 5], [null, 7]]);
    expect(h.morePhotos).toBe(3);
  });

  it("karta bez własnej listy — grupuje po domyślnych etapach", () => {
    const h = buildHandover([e("p", at(1), { images: [IMG(1)], stage: "kan-pion" })], card, at(16));
    expect(h.stages).toBeNull();
    expect(h.photoGroups).toEqual([{ stage: "Piony i podejścia kanalizacji", photos: [IMG(1)], dates: [at(1)] }]);
  });

  it("bez przypiętych — jedna grupa bez etapu", () => {
    const h = buildHandover([e("x", at(1), { images: [IMG(1)] })], card, at(16));
    expect(h.photoGroups).toEqual([{ stage: null, photos: [IMG(1)], dates: [at(1)] }]);
  });
});

describe("punkty w protokole (H2.4)", () => {
  const site = { id: "s1", name: "Lipowa 5", address: "", investor: "", stages: undefined };
  const day = (d: number) => new Date(2026, 9, d, 10).getTime();
  const rooms = [{ id: "r1", name: "Łazienka", order: 1 }, { id: "r2", name: "Pusta", order: 2 }];
  const points = [
    { id: "p1", room: "r1", type: "umywalka", sides: ["z", "c", "k"] as ("z" | "c" | "k")[], height: 58, steps: { podejscie: day(12), proba: day(14) }, order: 1 },
    { id: "p2", room: "r1", type: "zmywarka", sides: ["z", "k"] as ("z" | "c" | "k")[], steps: {}, order: 2 },
  ];
  const journal = [{ id: "e1", at: day(13), kind: "ok" as const, topic: null, text: "", site: "Lipowa 5", siteId: "s1", checked: [], images: ["a".repeat(64)], point: "p1" }];

  it("sekcja z pomieszczeniami, krokami z datami i zdjęciami; puste pomieszczenie pomijane", () => {
    const h = buildHandover(journal, site, day(20), { rooms, points });
    expect(h.pointsDone).toEqual({ done: 0, total: 2 });
    expect(h.rooms?.map((r) => r.name)).toEqual(["Łazienka"]);
    const text = handoverText(h);
    expect(text).toContain("## Punkty (0/2 gotowe)\n### Łazienka");
    expect(text).toContain("- Umywalka · Z C K · 58 cm — podejście 12.10.2026, próba 14.10.2026 · 1 zdj.");
    expect(text).toContain("- Zmywarka · Z K — do zrobienia");
  });

  it("bez punktów — bez sekcji", () => {
    const h = buildHandover(journal, site, day(20));
    expect(h.rooms).toBeNull();
    expect(handoverText(h)).not.toContain("## Punkty");
  });
});

describe("protokół odbioru: podpis", () => {
  const sig = (name: string) => ({ ...card, signature: { image: "a".repeat(64), name, at: at(10) } });

  it("podpisany protokół ma linię z podpisującym i datą", () => {
    const text = handoverText(buildHandover([e("a", at(1))], sig("Jan Kowalski"), at(16)));
    expect(text).toContain("Odbiór podpisał: Jan Kowalski, ");
  });

  it("bez nazwiska podpisuje „inwestor”, bez podpisu nie ma linii", () => {
    expect(handoverText(buildHandover([e("a", at(1))], sig(""), at(16)))).toContain("Odbiór podpisał: inwestor, ");
    expect(handoverText(buildHandover([e("a", at(1))], card, at(16)))).not.toContain("Odbiór podpisał");
  });
});

