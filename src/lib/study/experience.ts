import { pluralPl } from "@/lib/plural";
import type { ReviewCard } from "./srs";
import { overallAccuracy } from "./stats";
import type { JournalEntry } from "./yStudy";

/**
 * Karta doświadczenia: co instalator ma za sobą, w jednym kawałku tekstu do pokazania albo wysłania.
 * Czysta funkcja nad stanem Nauki — liczby z dziennika, kart powtórek i kolumny „Umiem”.
 */

export interface ExperienceInput {
  journal: readonly JournalEntry[];
  review: Readonly<Record<string, ReviewCard>>;
  /** Budowy z wpisami (`siteDirectory`, `count > 0`); archiwalne też — to dalej były budowy. */
  sites: readonly { name: string; count: number }[];
  /** Tytuły tematów w kolumnie „Umiem”. */
  doneTopics: readonly string[];
  /** Ile tematów jest w sumie (18). */
  totalTopics: number;
}

export interface ExperienceCard {
  sites: string[];
  tests: number;
  testsOk: number;
  doneTopics: string[];
  totalTopics: number;
  accuracy: { seen: number; right: number; percent: number | null };
}

export function buildExperience(input: ExperienceInput): ExperienceCard {
  const tests = input.journal.filter((e) => e.test);
  return {
    sites: input.sites.filter((s) => s.count > 0).map((s) => s.name),
    tests: tests.length,
    testsOk: tests.filter((e) => e.test?.ok).length,
    doneTopics: [...input.doneTopics],
    totalTopics: input.totalTopics,
    accuracy: overallAccuracy(input.review),
  };
}

/** Tekst Markdown. `today` — dzień lokalny „2026-10-16”, do nagłówka i nazwy pliku. */
export function experienceText(card: ExperienceCard, today: string): string {
  const lines = [`# Karta doświadczenia`, "", `Stan na ${today}.`, ""];
  const sites = card.sites.length;
  lines.push(`- Budowy: ${sites}${sites > 0 ? ` (${card.sites.join(", ")})` : ""}`);
  lines.push(`- Próby szczelności: ${card.tests}${card.tests > 0 ? `, w tym pozytywne: ${card.testsOk}` : ""}`);
  lines.push(`- Opanowane tematy: ${card.doneTopics.length} z ${card.totalTopics}`);
  for (const t of card.doneTopics) lines.push(`  - ${t}`);
  const { seen, right, percent } = card.accuracy;
  lines.push(
    percent === null
      ? "- Trafność quizu: jeszcze bez rund"
      : `- Trafność quizu: ${percent}% (${right} z ${seen} ${pluralPl(seen, ["odpowiedź", "odpowiedzi", "odpowiedzi"])})`,
  );
  return lines.join("\n") + "\n";
}
