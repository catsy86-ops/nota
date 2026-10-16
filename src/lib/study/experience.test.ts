import { describe, expect, it } from "vitest";
import { buildExperience, experienceText } from "./experience";
import type { ReviewCard } from "./srs";
import type { JournalEntry } from "./yStudy";
import type { PressureTest } from "./pressureTest";

const entry = (over: Partial<JournalEntry>): JournalEntry =>
  ({ id: "x", at: 0, kind: "ok", topic: null, text: "", site: "", checked: [], images: [], ...over }) as JournalEntry;

const card = (seen: number, right: number) => ({ seen, right }) as ReviewCard;

describe("buildExperience", () => {
  it("liczy budowy z wpisami, próby i pozytywne próby", () => {
    const journal = [
      entry({ id: "1", test: { ok: true } as PressureTest }),
      entry({ id: "2", test: { ok: false } as PressureTest }),
      entry({ id: "3" }),
    ];
    const c = buildExperience({
      journal,
      review: { q1: card(4, 3), q2: card(6, 3) },
      sites: [{ name: "Lipowa 5", count: 2 }, { name: "Stara", count: 0 }],
      doneTopics: ["Spadki kanalizacji"],
      totalTopics: 18,
    });
    expect(c.sites).toEqual(["Lipowa 5"]);
    expect(c.tests).toBe(2);
    expect(c.testsOk).toBe(1);
    expect(c.doneTopics).toEqual(["Spadki kanalizacji"]);
    expect(c.accuracy).toEqual({ seen: 10, right: 6, percent: 60 });
  });

  it("bez danych: zera i trafność „brak”", () => {
    const c = buildExperience({ journal: [], review: {}, sites: [], doneTopics: [], totalTopics: 18 });
    expect(c.sites).toEqual([]);
    expect(c.tests).toBe(0);
    expect(c.accuracy.percent).toBeNull();
  });
});

describe("experienceText", () => {
  it("składa tekst z liczbami, listą tematów i odmianą odpowiedzi", () => {
    const text = experienceText(
      buildExperience({
        journal: [entry({ id: "1", test: { ok: true } as PressureTest })],
        review: { q1: card(1, 1) },
        sites: [{ name: "Lipowa 5", count: 1 }],
        doneTopics: ["Spadki kanalizacji", "Płukanie i próba szczelności"],
        totalTopics: 18,
      }),
      "2026-10-16",
    );
    expect(text).toContain("# Karta doświadczenia");
    expect(text).toContain("Stan na 2026-10-16.");
    expect(text).toContain("- Budowy: 1 (Lipowa 5)");
    expect(text).toContain("- Próby szczelności: 1, w tym pozytywne: 1");
    expect(text).toContain("- Opanowane tematy: 2 z 18");
    expect(text).toContain("  - Spadki kanalizacji");
    expect(text).toContain("- Trafność quizu: 100% (1 z 1 odpowiedź)");
  });

  it("bez rund pisze „jeszcze bez rund”, a odpowiedzi w liczbie mnogiej", () => {
    const empty = experienceText(buildExperience({ journal: [], review: {}, sites: [], doneTopics: [], totalTopics: 18 }), "2026-10-16");
    expect(empty).toContain("- Trafność quizu: jeszcze bez rund");
    expect(empty).toContain("- Budowy: 0\n");
    const many = experienceText(buildExperience({ journal: [], review: { q: card(5, 4) }, sites: [], doneTopics: [], totalTopics: 18 }), "2026-10-16");
    expect(many).toContain("(4 z 5 odpowiedzi)");
  });
});
