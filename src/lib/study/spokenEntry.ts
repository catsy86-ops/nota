import type { Fitting } from "./fittings";
import type { JournalKind } from "./yStudy";
import { fold, parseSpokenFittings, QTY_WORD, SINGULAR, TENS, UNITS } from "./spokenFittings";

/**
 * Cały wpis z jednej wypowiedzi: „Lipowa, problem, przeciek przy trójniku, kolano 16 cztery sztuki”
 * → budowa „Lipowa 5”, rodzaj „Problem”, tekst „przeciek przy trójniku”, kształtka Kolano 16 × 4.
 *
 * Rozpoznawanie mowy zwykle nie stawia przecinków, więc reguły są ostrożne — co nie pasuje, zostaje
 * tekstem dokładnie tak, jak padło:
 * - budowa tylko na początku: pełna nazwa znanej budowy („lipowa pięć”) albo jej pierwsze słowo,
 *   jeśli jest jednoznaczne i stoi za nim przecinek albo słowo rodzaju („lipowa problem …”);
 *   opcjonalnie poprzedzona słowem „budowa”;
 * - rodzaj tylko jako pierwsze słowo po budowie: problem/usterka/awaria, notatka/uwaga, zrobione/gotowe;
 * - kształtka: nazwa kształtki (albo znana nazwa wielowyrazowa) i za nią co najmniej jedna liczba;
 *   „trójniki rozsunięte trzydzieści centymetrów” to tekst, „trójnik 16 dwa” — kształtka.
 * Czysta funkcja, testy w `spokenEntry.test.ts`.
 */

export interface SpokenEntry {
  /** Nazwa znanej budowy, jak w karcie; brak = nie padła. */
  site?: string;
  kind?: JournalKind;
  fittings: Fitting[];
  /** Tekst wpisu bez rozpoznanych części; bez struktury — cała wypowiedź bez zmian. */
  text: string;
  /** Braki materiału („brakuje …”, „do zamówienia …”) — trafiają do karty budowy, nie do wpisu. */
  shortages: SpokenShortage[];
  /** Nazwa zakończonego etapu, jak padła („etap próba szczelności zrobiony”) — dopasowuje ją `matchStage`. */
  stage?: string;
  /** Rozpoznano budowę, rodzaj, kształtki albo braki. */
  structured: boolean;
}

export interface SpokenShortage {
  /** Co: „Klej do PCV” (tak, jak padło — „brakuje kleju” zostaje w dopełniaczu). */
  text: string;
  /** Ilość z jednostką („50 m”, „2 worki”); pusta, gdy nie padła liczba z jednostką. */
  qty: string;
}

/**
 * Po „brakuje” materiał pada w dopełniaczu („brakuje kleju”). Pierwsze słowo pozycji wraca do mianownika
 * dla częstych materiałów instalatora; reszta zostaje, jak padła. Klucze bez ogonków (`fold`).
 */
const GENITIVE_TO_NOMINATIVE: Record<string, string> = {
  kleju: "klej", rury: "rura", rur: "rury", rurki: "rurka", rurek: "rurki", otuliny: "otulina", otulin: "otuliny",
  syfonu: "syfon", syfonow: "syfony", zaworu: "zawór", zaworow: "zawory", tasmy: "taśma", silikonu: "silikon",
  pianki: "pianka", ksztaltek: "kształtki", uszczelek: "uszczelki", obejmy: "obejma", obejm: "obejmy",
  hakow: "haki", kolkow: "kołki", wkretow: "wkręty", pakul: "pakuły", pasty: "pasta", mufy: "mufa", muf: "mufy",
  trojnika: "trójnik", trojnikow: "trójniki", kolana: "kolano", kolan: "kolana", kolanka: "kolanko",
  zlaczki: "złączka", zlaczek: "złączki", redukcji: "redukcja", korka: "korek", korkow: "korki",
  rewizji: "rewizja", kielicha: "kielich", nypla: "nypel", srubunku: "śrubunek", cementu: "cement",
  gipsu: "gips", zaprawy: "zaprawa", folii: "folia", grzejnika: "grzejnik", grzejnikow: "grzejniki",
  baterii: "bateria", odplywu: "odpływ", kratki: "kratka", stelaza: "stelaż", miski: "miska",
};

/** Słowa kończące nazwę etapu („etap próba szczelności zrobiony”). */
const STAGE_DONE = new Set(["zrobiony", "zrobiona", "zrobione", "gotowy", "gotowa", "gotowe", "skonczony", "skonczona", "skonczone", "zakonczony", "zakonczona", "zakonczone"]);

/** Słowa przełączające resztę wypowiedzi w listę braków. */
const SHORTAGE_MARKERS = new Set(["brakuje", "zamowic"]);
/** Jednostki: skrót albo `null` = zostaw słowo, jak padło („2 worki”). */
const UNIT_SHORT = new Map<string, string | null>([
  ...["metr", "metry", "metrow", "metra", "m", "mb"].map((u) => [u, "m"] as const),
  ...["sztuka", "sztuki", "sztuk", "szt", "szt."].map((u) => [u, "szt."] as const),
  ...["opakowanie", "opakowania", "opakowan", "op", "op."].map((u) => [u, "op."] as const),
  ...["litr", "litry", "litrow", "litra", "l"].map((u) => [u, "l"] as const),
  ...["kilogram", "kilogramy", "kilogramow", "kilo", "kg"].map((u) => [u, "kg"] as const),
  ...["worek", "worki", "workow", "rolka", "rolki", "rolek", "karton", "kartony", "kartonow", "paczka", "paczki", "paczek", "puszka", "puszki", "puszek", "tuba", "tuby", "tub"]
    .map((u) => [u, null] as const),
]);

const KIND_MARKERS = new Map<string, JournalKind>([
  ["problem", "problem"], ["usterka", "problem"], ["awaria", "problem"],
  ["notatka", "note"], ["uwaga", "note"],
  ["zrobione", "ok"], ["zrobiony", "ok"], ["gotowe", "ok"], ["skonczone", "ok"],
]);

const FITTING_WORDS = new Set<string>([...Object.keys(SINGULAR), ...Object.values(SINGULAR).map(fold)]);
const NUM_WORDS = new Map<string, string>(
  [...Object.entries(UNITS), ...Object.entries(TENS)].map(([w, n]) => [fold(w), String(n)] as const),
);
const CONJ = new Set(["i", "oraz", "plus", "a"]);
const LEAD_WORDS = new Set(["ksztaltki", "ksztaltek", "material"]);

const isSep = (t: string) => /^[,;.:!?]$/.test(t);
/** Ile słów zajmuje zapowiedź braków od pozycji `at` („brakuje” — 1, „do zamówienia” — 2); 0 = nie ma. */
const shortageMarker = (tokens: string[], at: number): number => {
  const f = fold(tokens[at] ?? "");
  if (SHORTAGE_MARKERS.has(f)) return 1;
  return f === "do" && fold(tokens[at + 1] ?? "") === "zamowienia" ? 2 : 0;
};
const norm = (t: string) => { const f = fold(t); return NUM_WORDS.get(f) ?? f; };
const isNumeric = (t: string) => /^\d+(?:[/.,]\d+)?$/.test(t) || NUM_WORDS.has(fold(t));

/** Słowa nazwy przed pierwszą liczbą („Kolano naścienne 16” → kolano, nascienne). */
const namePrefix = (name: string) => {
  const out: string[] = [];
  for (const w of fold(name).split(/\s+/)) { if (/\d/.test(w)) break; out.push(w); }
  return out;
};

function matchSite(tokens: string[], at: number, sites: readonly string[]): { name: string; len: number } | null {
  const words = tokens.slice(at).map(norm);
  // Pełna nazwa — najdłuższa wygrywa („Dom Kowalski 2” przed „Dom Kowalski”).
  const full = sites
    .map((name) => ({ name, parts: fold(name).split(/\s+/).filter(Boolean) }))
    .filter((s) => s.parts.length > 0 && s.parts.every((p, i) => words[i] === p))
    .sort((a, b) => b.parts.length - a.parts.length)[0];
  if (full) return { name: full.name, len: full.parts.length };
  // Samo pierwsze słowo: jednoznaczne i zaraz za nim przecinek, słowo rodzaju albo koniec wypowiedzi.
  const first = words[0];
  if (!first || first.length < 3) return null;
  const same = sites.filter((n) => fold(n).split(/\s+/)[0] === first);
  if (same.length !== 1) return null;
  const after = tokens[at + 1];
  if (after !== undefined && !isSep(after) && !KIND_MARKERS.has(fold(after)) && fold(after) !== "etap" && shortageMarker(tokens, at + 1) === 0) return null;
  return { name: same[0], len: 1 };
}

export function parseSpokenEntry(
  spoken: string,
  { sites = [], fittings: knownFittings = [] }: { sites?: readonly string[]; fittings?: readonly string[] } = {},
): SpokenEntry {
  const raw = spoken.trim();
  // Interpunkcja jako osobne słowa — ale nie kropka w „1.5” ani ukośnik w „20/16”.
  const tokens = raw.replace(/([,;.:!?])(?=\s|$)/g, " $1").split(/\s+/).filter(Boolean);
  let i = 0;
  const skipSeps = () => { while (i < tokens.length && isSep(tokens[i])) i++; };

  let site: string | undefined;
  skipSeps();
  const withWord = i < tokens.length && fold(tokens[i]) === "budowa";
  const m = matchSite(tokens, withWord ? i + 1 : i, sites);
  if (m) { site = m.name; i += m.len + (withWord ? 1 : 0); skipSeps(); }

  let kind: JournalKind | undefined;
  const marker = i < tokens.length ? KIND_MARKERS.get(fold(tokens[i])) : undefined;
  if (marker) { kind = marker; i++; skipSeps(); }

  // „Lipowa, etap próba szczelności zrobiony, …” — etap do odhaczenia; dalej zwykły wpis.
  let stage: string | undefined;
  if (i < tokens.length && fold(tokens[i]) === "etap") {
    const words: string[] = [];
    let j = i + 1;
    while (j < tokens.length && !isSep(tokens[j]) && !STAGE_DONE.has(fold(tokens[j]))) words.push(tokens[j++]);
    if (j < tokens.length && STAGE_DONE.has(fold(tokens[j]))) j++;
    if (words.length > 0) { stage = words.join(" "); kind ??= "ok"; i = j; skipSeps(); }
  }

  // „Lipowa, brakuje kleju do PCV i rury PEX 16 50 metrów” — reszta to braki materiału, nie wpis.
  const lead = shortageMarker(tokens, i);
  if (lead > 0) {
    // Po „brakuje” / „zamówić” — dopełniacz („brakuje kleju”, „zamówić rurę” ma biernik, tu nie ruszamy).
    const shortages = parseShortages(tokens.slice(i + lead), fold(tokens[i]) === "brakuje");
    return { ...(site ? { site } : {}), ...(kind ? { kind } : {}), ...(stage ? { stage } : {}), fittings: [], text: "", shortages, structured: true };
  }

  const phrases = [...new Set(knownFittings.map((n) => namePrefix(n).join(" ")))]
    .map((p) => p.split(" "))
    .filter((p) => p.length > 1)
    .sort((a, b) => b.length - a.length);
  const fittingStart = (rest: string[], j: number): number => {
    for (const p of phrases) if (p.every((w, k) => rest[j + k] !== undefined && fold(rest[j + k]) === w)) return p.length;
    return FITTING_WORDS.has(fold(rest[j])) ? 1 : 0;
  };

  const rest = tokens.slice(i);
  const text: string[] = [];
  const spans: string[] = [];
  for (let j = 0; j < rest.length;) {
    const start = fittingStart(rest, j);
    if (start > 0) {
      let k = j + start;
      let nums = 0;
      while (k < rest.length) {
        const t = rest[k];
        const f = fold(t);
        if (isNumeric(t)) { nums++; k++; continue; }
        if (f === "na" && nums > 0 && k + 1 < rest.length && isNumeric(rest[k + 1])) { k++; continue; }
        if (f === "x" || f === "razy") { k++; continue; }
        if (QTY_WORD.test(f)) { k++; break; }
        break;
      }
      if (nums > 0) {
        // „…, i kształtki: kolano 16” — spójnik, przecinek i słowo-zapowiedź przed kształtką nie zostają w tekście.
        while (text.length > 0 && (isSep(text[text.length - 1]) || CONJ.has(fold(text[text.length - 1])) || LEAD_WORDS.has(fold(text[text.length - 1])))) text.pop();
        spans.push(rest.slice(j, k).join(" "));
        j = k;
        continue;
      }
    }
    text.push(rest[j]);
    j++;
  }

  const fittings = spans.length > 0 ? parseSpokenFittings(spans.join(", "), knownFittings) : [];
  const structured = site !== undefined || kind !== undefined || fittings.length > 0 || stage !== undefined;
  if (!structured) return { fittings: [], text: raw, shortages: [], structured: false };

  while (text.length > 0 && (isSep(text[0]) || CONJ.has(fold(text[0])))) text.shift();
  while (text.length > 0 && (isSep(text[text.length - 1]) || CONJ.has(fold(text[text.length - 1])))) text.pop();
  const joined = text.join(" ").replace(/\s+([,;.:!?])/g, "$1");
  return { ...(site ? { site } : {}), ...(kind ? { kind } : {}), ...(stage ? { stage } : {}), fittings, text: joined, shortages: [], structured };
}

/** Liczebniki słownie → cyfry, z zachowaniem wielkości liter pozostałych słów („dwadzieścia pięć” → „25”). */
function numberize(tokens: string[]): string[] {
  const out: string[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const f = fold(tokens[k]);
    const tens = Object.entries(TENS).find(([w]) => fold(w) === f)?.[1];
    if (tens !== undefined) {
      const unit = Object.entries(UNITS).find(([w]) => fold(w) === fold(tokens[k + 1] ?? ""))?.[1];
      if (unit !== undefined && unit < 10) { out.push(String(tens + unit)); k++; } else out.push(String(tens));
      continue;
    }
    const n = NUM_WORDS.get(f);
    out.push(n ?? tokens[k]);
  }
  return out;
}

/** Pozycje braków: rozdzielone przecinkiem albo „i/oraz/plus”; ilość = liczba z jednostką. */
function parseShortages(tokens: string[], genitive = false): SpokenShortage[] {
  const groups: string[][] = [[]];
  for (const t of tokens) {
    if (isSep(t) || CONJ.has(fold(t))) { if (groups[groups.length - 1].length > 0) groups.push([]); continue; }
    groups[groups.length - 1].push(t);
  }
  const out: SpokenShortage[] = [];
  for (const g of groups) {
    const words = numberize(g);
    let qty = "";
    for (let k = 0; k < words.length - 1; k++) {
      const unit = UNIT_SHORT.get(fold(words[k + 1]));
      if (/^\d+(?:[.,]\d+)?$/.test(words[k]) && unit !== undefined) {
        qty = `${words[k]} ${unit ?? words[k + 1]}`;
        words.splice(k, 2);
        break;
      }
    }
    if (genitive && words.length > 0) {
      const nominative = GENITIVE_TO_NOMINATIVE[fold(words[0])];
      if (nominative) words[0] = nominative;
    }
    const text = words.join(" ").trim();
    if (!text || !/\p{L}/u.test(text)) continue;
    out.push({ text: text.charAt(0).toLocaleUpperCase("pl") + text.slice(1), qty });
  }
  return out;
}
