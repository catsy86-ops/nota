import { describe, it, expect } from "vitest";
import { EMPTY_SHIFT_DATA, type ShiftData } from "@/lib/shifts/model";
import { buildJournalReport, periodLabel, reportBody, reportText, reportWhatsApp, shiftKey, workOn } from "./report";
import type { JournalEntry } from "./yStudy";
import { siteKey } from "./sites";

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const e = (id: string, when: number, kind: JournalEntry["kind"], site: string, text: string, extra: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id, at: when, kind, topic: null, text, site, checked: [], images: [], ...extra });

const IMG = (c: string) => c.repeat(64);

const journal: JournalEntry[] = [
  e("a", at(14, 8, 15), "ok", "Lipowa 5", "Próba szczelności pionu", { topic: "t1", images: [IMG("a"), IMG("b")] }),
  e("b", at(14, 10, 20), "problem", "Lipowa 5", "Żółta rura przecieka\nprzy trójniku"),
  e("c", at(14, 12), "problem", "Lipowa 5", "Brak kształtek", { resolved: at(15, 9) }),
  e("d", at(14, 13), "note", "Polna 2", "Inwestor chce zmian"),
  e("e", at(15, 7, 5), "note", "Lipowa 5", "Dostawa rur"),
  e("f", at(20, 9), "ok", "Lipowa 5", "Poza zakresem"),
];

const shifts: ShiftData = {
  ...EMPTY_SHIFT_DATA,
  days: {
    "2026-10-14": { type: "b", extraMin: 30 },
    "2026-10-15": { type: "u" },
    "2026-10-16": { type: "b" },
  },
};

describe("raport z dziennika", () => {
  it("okres: dzień, zakres w miesiącu, przez miesiące i lata", () => {
    expect(periodLabel("2026-10-14", "2026-10-14")).toBe("14 października 2026");
    expect(periodLabel("2026-10-07", "2026-10-14")).toBe("7–14 października 2026");
    expect(periodLabel("2026-09-28", "2026-10-03")).toBe("28 września – 3 października 2026");
    expect(periodLabel("2025-12-30", "2026-01-02")).toBe("30 grudnia 2025 – 2 stycznia 2026");
    expect(shiftKey("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("godziny z Grafiku: zmiana z odchyleniem, nieobecność, dzień bez wpisu", () => {
    expect(workOn(shifts, "2026-10-14")).toEqual({ label: "Budowa 07:00–17:00", minutes: 630 });
    expect(workOn(shifts, "2026-10-15")).toEqual({ label: "Urlop", minutes: 0 });
    expect(workOn(shifts, "2026-10-17")).toBeNull();
    expect(workOn(null, "2026-10-14")).toBeNull();
  });

  it("jedna budowa w zakresie: dni od najstarszego, dzień na dwóch budowach bez podziału godzin, otwarte problemy, zdjęcia", () => {
    const r = buildJournalReport(journal, { siteId: siteKey("Lipowa 5"), from: "2026-10-14", to: "2026-10-16", shifts, topicTitle: () => "Próby szczelności" });
    expect(r.title).toBe("Raport: Lipowa 5 — 14–16 października 2026");
    expect(r.count).toBe(4);
    expect(r.days.map((d) => d.key)).toEqual(["2026-10-14", "2026-10-15"]);
    expect(r.days[0].entries.map((x) => x.entry.id)).toEqual(["a", "b", "c"]);
    // 14.10 to też Polna 2 — bez podziału godzin dzień nie liczy się w całości do Lipowej.
    expect(r.days[0].work?.site).toBeNull();
    expect(r.workMinutes).toBe(0);
    expect(r.open.map((x) => x.entry.id)).toEqual(["b"]);
    expect(r.images).toEqual([IMG("a"), IMG("b")]);
    expect(r.days[0].entries[2].status).toBe("Problem rozwiązany 15.10");

    const body = reportBody(r);
    expect(body).toContain("4 wpisy · otwarte problemy: 1");
    expect(body).toContain("Praca: Budowa 07:00–17:00 · 10 h 30 min — dzień na kilku budowach, godziny nierozdzielone");
    expect(body).toContain("Grafik: Urlop");
    expect(body).toContain("- 08:15 Zrobione: Próba szczelności pionu (temat: Próby szczelności, 2 zdjęcia)");
    expect(body).toContain("- 10:20 Problem otwarty: Żółta rura przecieka\n  przy trójniku");
    expect(body).toContain("## Otwarte problemy\n- 14.10 Żółta rura przecieka");
    expect(body).not.toContain("Polna");
  });

  it("wszystkie budowy: budowa przy wpisie; zakres odwrócony działa; pusty raport", () => {
    const r = buildJournalReport(journal, { siteId: null, from: "2026-10-14", to: "2026-10-14" });
    expect(r.title).toBe("Raport — 14 października 2026");
    expect(r.count).toBe(4);
    expect(reportBody(r)).toContain("Notatka: Inwestor chce zmian (Polna 2)");

    expect(buildJournalReport(journal, { siteId: null, from: "2026-10-15", to: "2026-10-14" }).count).toBe(5);

    const card = { name: "Lipowa 5", address: "", investor: "" };
    const empty = buildJournalReport(journal, { siteId: siteKey("Lipowa 5"), siteCard: card, from: "2026-10-01", to: "2026-10-02" });
    expect(reportText(empty)).toBe("# Raport: Lipowa 5 — 1–2 października 2026\n\n0 wpisów\n");
  });

  it("karta budowy: nazwa z karty, adres i inwestor na początku; wpis z siteId po zmianie nazwy", () => {
    const moved = [...journal, e("z", at(14, 18), "ok", "Dom Nowaków", "Odbiór", { siteId: siteKey("Lipowa 5") })];
    const r = buildJournalReport(moved, {
      siteId: siteKey("Lipowa 5"), siteCard: { name: "Dom Nowaków", address: "ul. Lipowa 5, Kraków", investor: "Jan Nowak" },
      from: "2026-10-14", to: "2026-10-14",
    });
    expect(r.title).toBe("Raport: Dom Nowaków — 14 października 2026");
    expect(r.count).toBe(4);
    expect(reportBody(r).split("\n").slice(0, 3)).toEqual(["Adres: ul. Lipowa 5, Kraków", "Inwestor: Jan Nowak", "4 wpisy · otwarte problemy: 1"]);
    expect(buildJournalReport(moved, { siteId: null, siteCard: null, from: "2026-10-14", to: "2026-10-14" }).address).toBe("");
  });

  it("reportWhatsApp: tytuł i dni pogrubione zamiast nagłówków markdown", () => {
    const r = buildJournalReport(journal, { siteId: siteKey("Lipowa 5"), siteCard: null, from: "2026-10-14", to: "2026-10-15", shifts, topicTitle: () => null });
    const text = reportWhatsApp(r);
    expect(text.startsWith(`*${r.title}*\n\n`)).toBe(true);
    expect(text).not.toMatch(/^#/m);
    expect(text).toMatch(/^\*[^*\n]+\*$/m);
    expect(text).toContain("- ");
  });
});

describe("raport — materiał do zamówienia", () => {
  const withFittings: JournalEntry[] = [
    e("p1", at(10, 8), "ok", "Lipowa 5", "Piony", { fittings: [{ name: "Kolano 16", qty: 4 }] }),
    e("p2", at(14, 9), "ok", "Lipowa 5", "Podejścia", { fittings: [{ name: "Kolano 16", qty: 2 }, { name: "Trójnik 16", qty: 1 }] }),
    e("p3", at(14, 10), "ok", "Polna 2", "Inna budowa", { fittings: [{ name: "Kolano 16", qty: 9 }] }),
  ];
  const site = siteKey("Lipowa 5");

  it("raport budowy liczy materiał od ostatniego zamówienia, niezależnie od okresu raportu", () => {
    const r = buildJournalReport(withFittings, { siteId: site, siteCard: { name: "Lipowa 5", address: "", investor: "", orderedAt: at(12, 0) }, from: "2026-10-14", to: "2026-10-14" });
    expect(r.toOrder).toEqual([{ name: "Kolano 16", qty: 2 }, { name: "Trójnik 16", qty: 1 }]);
    expect(reportBody(r)).toContain("## Do zamówienia\n- Kolano 16: 2 szt.\n- Trójnik 16: 1 szt.");
    expect(reportWhatsApp(r)).toContain("*Do zamówienia*");
  });

  it("bez zamówienia liczy całą budowę, a raport wszystkich budów nie ma sekcji", () => {
    const r = buildJournalReport(withFittings, { siteId: site, from: "2026-10-14", to: "2026-10-14" });
    expect(r.toOrder).toEqual([{ name: "Kolano 16", qty: 6 }, { name: "Trójnik 16", qty: 1 }]);
    const all = buildJournalReport(withFittings, { siteId: null, from: "2026-10-14", to: "2026-10-14" });
    expect(all.toOrder).toEqual([]);
    expect(reportBody(all)).not.toContain("Do zamówienia");
  });
});

describe("raport — etapy budowy", () => {
  const site = siteKey("Lipowa 5");
  const stages = [
    { id: "kan-pod", name: "Kanalizacja podposadzkowa", done: at(10, 15) },
    { id: "proba", name: "Próba szczelności" },
  ];

  it("raport budowy z własną listą: postęp w podsumowaniu, sekcja z datami, znaczki w WhatsAppie", () => {
    const r = buildJournalReport(journal, { siteId: site, siteCard: { name: "Lipowa 5", address: "", investor: "", stages }, from: "2026-10-14", to: "2026-10-14" });
    expect(r.stages).toHaveLength(2);
    const body = reportBody(r);
    expect(body).toContain("postęp: 1/2 etapy");
    expect(body).toContain("## Etapy (1/2)\n- [x] Kanalizacja podposadzkowa (10.10)\n- [ ] Próba szczelności");
    const wa = reportWhatsApp(r);
    expect(wa).toContain("✅ Kanalizacja podposadzkowa (10.10)");
    expect(wa).toContain("⬜ Próba szczelności");
    expect(wa).not.toContain("- [");
  });

  it("bez własnej listy w karcie i w raporcie wszystkich budów — bez sekcji", () => {
    const plain = buildJournalReport(journal, { siteId: site, siteCard: { name: "Lipowa 5", address: "", investor: "" }, from: "2026-10-14", to: "2026-10-14" });
    expect(plain.stages).toBeNull();
    expect(reportBody(plain)).not.toContain("Etapy");
    const all = buildJournalReport(journal, { siteId: null, siteCard: { name: "x", address: "", investor: "", stages }, from: "2026-10-14", to: "2026-10-14" });
    expect(all.stages).toBeNull();
  });
});

describe("raport — braki materiału", () => {
  const site = siteKey("Lipowa 5");
  const shortages = [
    { id: "1", text: "Rura PEX 16", qty: "50 m", status: "missing" as const, at: at(10, 8) },
    { id: "2", text: "Klej PCV", qty: "", status: "ordered" as const, at: at(10, 9), changed: at(13, 9) },
    { id: "3", text: "Otulina", qty: "", status: "delivered" as const, at: at(10, 9), changed: at(14, 9) },
  ];

  it("raport budowy: niedostarczone braki w podsumowaniu i w sekcji, dostarczone pominięte", () => {
    const r = buildJournalReport(journal, { siteId: site, siteCard: { name: "Lipowa 5", address: "", investor: "", shortages }, from: "2026-10-14", to: "2026-10-14" });
    expect(r.shortages.map((s) => s.text)).toEqual(["Rura PEX 16", "Klej PCV"]);
    const body = reportBody(r);
    expect(body).toContain("braki materiału: 2");
    expect(body).toContain("## Braki materiału\n- Rura PEX 16: 50 m — brakuje\n- Klej PCV — zamówione 13.10");
    expect(body).not.toContain("Otulina");
  });

  it("raport wszystkich budów — bez braków", () => {
    const all = buildJournalReport(journal, { siteId: null, siteCard: { name: "x", address: "", investor: "", shortages }, from: "2026-10-14", to: "2026-10-14" });
    expect(all.shortages).toEqual([]);
  });
});

describe("raport — rozwiązanie problemu", () => {
  it("wpis rozwiązanego problemu ma linię „Rozwiązanie:”", () => {
    const j = [e("p", at(14, 9), "problem", "Lipowa 5", "Przeciek przy pionie", { resolved: at(14, 15), solution: "Wymieniona złączka" })];
    const body = reportBody(buildJournalReport(j, { siteId: null, from: "2026-10-14", to: "2026-10-14" }));
    expect(body).toContain("Przeciek przy pionie");
    expect(body).toContain("\n  Rozwiązanie: Wymieniona złączka");
  });
});

describe("raport: „Tu jestem” w treści", () => {
  it("wpis z lokalizacją ma link do map w punkcie listy, wpis bez lokalizacji nie", () => {
    const geo = { lat: 52.22977, lng: 21.01178, acc: 12 };
    const withGeo = [e("g", at(14, 9), "ok", "Lipowa 5", "Pion w łazience", { geo })];
    const body = reportBody(buildJournalReport(withGeo, { siteId: null, from: "2026-10-14", to: "2026-10-14" }));
    expect(body).toContain("Mapa (±12 m): https://www.google.com/maps/search/?api=1&query=52.22977,21.01178");
    expect(reportWhatsApp(buildJournalReport(withGeo, { siteId: null, from: "2026-10-14", to: "2026-10-14" }))).toContain("Mapa (±12 m)");

    const plain = reportBody(buildJournalReport(journal, { siteId: null, from: "2026-10-14", to: "2026-10-14" }));
    expect(plain).not.toContain("Mapa (");
  });
});

describe("raport: wpis bez tekstu (Etap 0.3)", () => {
  it("nagłówek mówi, co wpis zawiera — jak na osi dziennika", () => {
    const j = [
      e("z", at(14, 9), "ok", "Lipowa 5", "", { images: [IMG("z")] }),
      e("n", at(14, 10), "note", "Lipowa 5", "  ", { recordings: ["r1"] } as unknown as Partial<JournalEntry>),
      e("c", at(14, 11), "ok", "Lipowa 5", "", { checked: ["x"] }),
    ];
    const body = reportBody(buildJournalReport(j, { siteId: null, from: "2026-10-14", to: "2026-10-14" }));
    expect(body).toContain("Zrobione: Zdjęcie");
    expect(body).toContain("Notatka: Nagranie");
    expect(body).toContain("Zrobione: Sprawdzone punkty listy");
    expect(body.match(/Sprawdzone punkty listy/g)).toHaveLength(1);
  });
});
