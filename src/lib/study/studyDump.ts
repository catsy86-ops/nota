import { addDaysToKey } from "@/lib/week";
import { cleanSite, type SiteCard } from "./sites";
import { cleanEntry, DAY_RE, SITE_MAX, type JournalEntry } from "./journalEntry";
import { cleanCard, type ReviewCard } from "./srs";
import { cleanBoss, cleanGroup, type Boss, type WaGroup } from "./boss";
import { cleanExam, keepLatestExams, type ExamResult } from "./exam";
import { cleanCustomList, type CustomEntry } from "./custom";

/**
 * Nauka i dziennik jako zwykły obiekt: stan widoku (`StudyState`), zrzut kopii (`StudyDump`)
 * i czyszczenie zrzutu z dowolnego wejścia (plik kopii, peer, dawny zapis). Kontrakt kopii v2 —
 * kształtu nie zmieniać bez migracji. Bez `yjs`; `yStudy.ts` re-eksportuje (H0.2).
 */

export type Column = "todo" | "doing" | "done";
export const COLUMNS: Column[] = ["todo", "doing", "done"];


export interface StudyState {
  /** Pochodne (nie zapisywane): ile braków każdej budowy nie weszło przez limit i nie jest widoczne. */
  shortagesDropped?: Record<string, number>;
  /** Kolumna tablicy per temat; brak wpisu = „Do nauki”. */
  board: Record<string, Column>;
  /** Odhaczone punkty listy do nauki. */
  checked: Record<string, true>;
  /** Najlepszy wynik quizu w procentach (0–100) albo `null`. */
  bestPercent: number | null;
  rounds: number;
  /** Pytania, na które ostatnio odpowiedziano błędnie — materiał do „Powtórki błędów”. */
  missed: Record<string, true>;
  /** Dziennik z budowy, od najstarszego do najnowszego. */
  journal: JournalEntry[];
  /** Bieżąca inwestycja — podpowiada się przy kolejnych wpisach. */
  site: string;
  /** Karty budów po id. */
  sites: Record<string, SiteCard>;
  /** Seria kolejnych dni z co najmniej jedną rundą quizu (stan na `lastDay`). */
  streak: number;
  /** Dzień ostatniej rundy („2026-10-12”) albo `null`. */
  lastDay: string | null;
  /** Powtórki pytań (SM-2 lite, `srs.ts`) po id pytania. */
  review: Record<string, ReviewCard>;
  /** Szef, któremu idzie raport (WhatsApp); `null` = nieustawiony. */
  boss: Boss | null;
  /** Grupa WhatsApp na raporty; `null` = nieustawiona. */
  group: WaGroup | null;
  /** Dni z co najmniej jedną rundą quizu, rosnąco (statystyki). */
  days: string[];
  /** Własne pytania i punkty listy (`custom.ts`), od najstarszego. */
  custom: CustomEntry[];
  /** Wyniki egzaminów próbnych (P-3), od najstarszego; trzymane ostatnie `EXAM_KEEP`. */
  exams?: ExamResult[];
}

/** Rundy i najlepszy wynik jednego urządzenia. */
export interface DeviceRounds {
  rounds: number;
  best: number | null;
}

/** Cała Nauka jako zwykły obiekt — sekcja `study` pełnej kopii. */
export interface StudyDump {
  /** 2: `images` i `fittings` wpisu to uporządkowane listy Yjs (`Y.Array`); kształt kopii bez zmian. */
  version: 1 | 2;
  board: Record<string, Column>;
  checked: Record<string, true>;
  missed: Record<string, true>;
  journal: JournalEntry[];
  /** Dni z co najmniej jedną rundą quizu. */
  days: string[];
  rounds: Record<string, DeviceRounds>;
  site: string;
  sites: Record<string, SiteCard>;
  /** Powtórki pytań; brak w kopiach sprzed N3. */
  review: Record<string, ReviewCard>;
  boss: Boss | null;
  group: WaGroup | null;
  /** Egzaminy próbne po id (P-3); brak w kopiach sprzed P-3. */
  exams?: Record<string, ExamResult>;
  /** Własne pytania i punkty listy po id; brak w kopiach sprzed N5. */
  custom: Record<string, CustomEntry>;
}

const isColumn = (v: unknown): v is Column => v === "todo" || v === "doing" || v === "done";
const isPercent = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 100;


const trueKeys = (v: unknown): string[] =>
  v && typeof v === "object" ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x === true).map(([k]) => k) : [];

/** Dowolne wejście (plik kopii, peer) → poprawny kształt zrzutu. */
/** Wyniki egzaminów po id; zostają najwyżej `EXAM_KEEP` najnowszych. */
function cleanExamRecord(raw: unknown): Record<string, ExamResult> {
  const list = raw && typeof raw === "object"
    ? Object.values(raw as Record<string, unknown>).map(cleanExam).filter((e): e is ExamResult => e !== null)
    : [];
  return Object.fromEntries(keepLatestExams(list).map((e) => [e.id, e]));
}

export function cleanDump(raw: unknown): StudyDump {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof StudyDump, unknown>>;
  const board: Record<string, Column> = {};
  if (s.board && typeof s.board === "object") {
    for (const [k, v] of Object.entries(s.board)) if (isColumn(v) && v !== "todo") board[k] = v;
  }
  const rounds: Record<string, DeviceRounds> = {};
  if (s.rounds && typeof s.rounds === "object") {
    for (const [k, v] of Object.entries(s.rounds as Record<string, Partial<DeviceRounds>>)) {
      if (!v || typeof v !== "object" || typeof v.rounds !== "number" || !(v.rounds >= 0)) continue;
      rounds[k] = { rounds: Math.floor(v.rounds), best: isPercent(v.best) ? Math.round(v.best) : null };
    }
  }
  return {
    version: 2,
    board,
    checked: Object.fromEntries(trueKeys(s.checked).map((k) => [k, true as const])),
    missed: Object.fromEntries(trueKeys(s.missed).map((k) => [k, true as const])),
    journal: (Array.isArray(s.journal) ? s.journal : []).map(cleanEntry).filter((e): e is JournalEntry => !!e),
    days: Array.isArray(s.days) ? s.days.filter((d): d is string => typeof d === "string" && DAY_RE.test(d)) : [],
    rounds,
    site: typeof s.site === "string" ? s.site.slice(0, SITE_MAX) : "",
    sites: cleanSites(s.sites),
    review: cleanReviews(s.review),
    boss: cleanBoss(s.boss),
    exams: cleanExamRecord(s.exams),
    group: cleanGroup(s.group),
    custom: Object.fromEntries(cleanCustomList(s.custom).map((e) => [e.id, e])),
  };
}

function cleanReviews(raw: unknown): Record<string, ReviewCard> {
  const out: Record<string, ReviewCard> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    const card = k.length <= 64 ? cleanCard(v) : null;
    if (card) out[k] = card;
  }
  return out;
}

function cleanSites(raw: unknown): Record<string, SiteCard> {
  const out: Record<string, SiteCard> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    const card = cleanSite(v);
    if (card && card.id === k) out[k] = card;
  }
  return out;
}

/**
 * Dawny zapis z localStorage (`kaczy.study.v1`) → zrzut. Seria wraca jako dni
 * (`lastDay` i `streak − 1` dni przed nim), rundy — jako licznik `device`.
 */
export function dumpFromLegacy(raw: unknown, device: string): StudyDump {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<StudyState>;
  const dump = cleanDump({ board: s.board, checked: s.checked, missed: s.missed, journal: s.journal, site: s.site });
  if (typeof s.lastDay === "string" && DAY_RE.test(s.lastDay)) {
    const streak = typeof s.streak === "number" && s.streak >= 1 ? Math.min(Math.floor(s.streak), 3660) : 1;
    for (let i = 0; i < streak; i++) dump.days.push(addDaysToKey(s.lastDay, -i));
  }
  const rounds = typeof s.rounds === "number" && s.rounds >= 0 ? Math.floor(s.rounds) : 0;
  const best = isPercent(s.bestPercent) ? Math.round(s.bestPercent) : null;
  if (rounds > 0 || best !== null) dump.rounds[device] = { rounds, best };
  return dump;
}

/** Zrzut → dawny kształt `StudyState` (projekcja i zapis dla starszych wersji aplikacji). */
export function stateFromDump(d: StudyDump): StudyState {
  const devices = Object.values(d.rounds);
  const bests = devices.map((r) => r.best).filter((b): b is number => b !== null);
  const days = new Set(d.days);
  const lastDay = d.days.length ? d.days.reduce((a, b) => (b > a ? b : a)) : null;
  let streak = 0;
  for (let day = lastDay; day && days.has(day); day = addDaysToKey(day, -1)) streak++;
  return {
    board: d.board,
    checked: d.checked,
    missed: d.missed,
    journal: [...d.journal].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)),
    site: d.site,
    sites: d.sites,
    rounds: devices.reduce((n, r) => n + r.rounds, 0),
    bestPercent: bests.length ? Math.max(...bests) : null,
    streak,
    lastDay,
    review: d.review,
    exams: keepLatestExams(Object.values(d.exams ?? {})),
    boss: d.boss,
    group: d.group,
    days: [...d.days].sort(),
    custom: Object.values(d.custom),
  };
}
