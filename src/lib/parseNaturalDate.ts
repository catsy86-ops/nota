const WEEKDAYS: Record<string, number> = {
  "niedziela": 0, "niedziele": 0,
  "poniedzialek": 1,
  "wtorek": 2,
  "sroda": 3, "srode": 3,
  "czwartek": 4,
  "piatek": 5,
  "sobota": 6, "sobote": 6,
};

/** Miesiące w dopełniaczu („12 listopada”), bez polskich znaków (tekst już je zdejmuje). */
const MONTHS: Record<string, number> = {
  "stycznia": 1, "lutego": 2, "marca": 3, "kwietnia": 4, "maja": 5, "czerwca": 6,
  "lipca": 7, "sierpnia": 8, "wrzesnia": 9, "pazdziernika": 10, "listopada": 11, "grudnia": 12,
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
}

function withTime(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** Pora dnia bez godziny: „rano” 9:00, „po południu” 15:00, „wieczorem” 18:00. */
function partOfDayHour(raw: string): number | null {
  if (/\brano\b/.test(raw)) return 9;
  if (/\bpo poludniu\b/.test(raw)) return 15;
  if (/\bwieczor(em)?\b/.test(raw)) return 18;
  return null;
}

/**
 * Data zapisana wprost: `2026-11-12`, `12.11`, `12.11.2026`, `12/11`, `12 listopada`.
 * Zwraca datę i resztę tekstu bez niej, żeby godzina nie wzięła dnia miesiąca („12” z „12.11”).
 * Dzień i miesiąc muszą istnieć; brak roku = najbliższy termin w przyszłości.
 */
function takeExplicitDate(raw: string, now: Date): { date: Date | null; rest: string; invalid: boolean } {
  const iso = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  const dotted = raw.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2}))?\b/);
  const named = raw.match(/\b(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|wrzesnia|pazdziernika|listopada|grudnia)\b/);

  let year: number | undefined;
  let month: number;
  let day: number;
  let whole: string;
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); whole = iso[0];
  } else if (named) {
    day = Number(named[1]); month = MONTHS[named[2]]; whole = named[0];
  } else if (dotted) {
    day = Number(dotted[1]); month = Number(dotted[2]); whole = dotted[0];
    if (dotted[3]) year = dotted[3].length === 2 ? 2000 + Number(dotted[3]) : Number(dotted[3]);
  } else {
    return { date: null, rest: raw, invalid: false };
  }
  const rest = raw.replace(whole, " ");
  if (month < 1 || month > 12 || day < 1 || day > 31) return { date: null, rest, invalid: true };

  let y = year ?? now.getFullYear();
  let d = new Date(y, month - 1, day, 0, 0, 0, 0);
  if (d.getDate() !== day) return { date: null, rest, invalid: true };
  if (year === undefined && d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    y += 1;
    d = new Date(y, month - 1, day, 0, 0, 0, 0);
  }
  return { date: d, rest, invalid: false };
}

/**
 * Parsuje proste, polskojęzyczne wyrażenia czasu ("jutro 15:00", "za 2h", "za godzinę",
 * "w piątek 10:00", "12.11 9:00", "12 listopada", "w przyszły poniedziałek", "jutro rano")
 * na konkretną datę. Zwraca null, jeśli wyrażenie nie zostało rozpoznane albo data jest nieistniejąca.
 */
export function parseNaturalDate(input: string, now: Date = new Date()): Date | null {
  let raw = stripDiacritics(input.trim().toLowerCase());
  if (!raw) return null;

  // Data wprost wychodzi z tekstu najpierw, żeby „12.11” czy „12 listopada” nie były godziną.
  const explicit = takeExplicitDate(raw, now);
  if (explicit.invalid) return null;
  raw = explicit.rest.replace(/\s+/g, " ").trim();

  // Godzina tylko z dwukropkiem („15:30”) albo sama liczba („jutro 15”, „o 15”).
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
  const bareHour = !timeMatch && !/^za\s/.test(raw) ? raw.match(/(?:^|\s)(\d{1,2})(?:\s|$)/) : null;
  const hours = timeMatch ? Number(timeMatch[1]) : bareHour ? Number(bareHour[1]) : null;
  const minutes = timeMatch ? Number(timeMatch[2]) : bareHour ? 0 : null;
  if (hours !== null && (hours > 23 || (minutes as number) > 59)) return null;
  const part = partOfDayHour(raw);
  // Godzina z liczby, a jeśli jej brak — pora dnia, a jeśli i jej brak — domyślna.
  const hourFor = (fallback: number) => ({ h: hours ?? part ?? fallback, m: minutes ?? 0 });

  if (explicit.date) {
    const { h, m } = hourFor(9);
    return withTime(explicit.date, h, m);
  }

  // "za tydzień" — siedem dni później, o tej samej godzinie, jeśli została podana.
  if (/^za\s+tydzien\b/.test(raw)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return hours !== null ? withTime(d, hours, minutes ?? 0) : d;
  }

  // "za godzinę" (bez liczby) — godzina od teraz.
  if (/^za\s+godzine\b/.test(raw)) {
    const d = new Date(now);
    d.setHours(d.getHours() + 1);
    return d;
  }

  // "za X h/godz/min/dni"
  const relMatch = raw.match(/^za\s+(\d+)\s*(godz(?:in[aey]?)?|h|min(?:ut[aey]?)?|m|dni|dzien|dzi[ae]n)/);
  if (relMatch) {
    const amount = Number(relMatch[1]);
    const unit = relMatch[2];
    const d = new Date(now);
    if (unit.startsWith("godz") || unit === "h") {
      d.setHours(d.getHours() + amount);
    } else if (unit.startsWith("min") || unit === "m") {
      d.setMinutes(d.getMinutes() + amount);
    } else {
      d.setDate(d.getDate() + amount);
    }
    return d;
  }

  // "dzis", "dzisiaj"
  if (/^dzis(iaj)?\b/.test(raw)) {
    if (hours !== null) return withTime(now, hours, minutes ?? 0);
    if (part !== null) return withTime(now, part, 0);
    // Bez godziny: najbliższa pełna godzina w przyszłości (nie termin w przeszłości), najwyżej 23:00.
    return withTime(now, Math.min(now.getHours() + 1, 23), 0);
  }

  // "jutro"
  if (/^jutro\b/.test(raw)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    const { h, m } = hourFor(9);
    return withTime(d, h, m);
  }

  // "pojutrze"
  if (/^pojutrze\b/.test(raw)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    const { h, m } = hourFor(9);
    return withTime(d, h, m);
  }

  // "w piątek", "we środę", "w przyszły poniedziałek": przyimek nie wpływa na dzień.
  let dayText = raw.replace(/^(w|we)\s+/, "");
  let nextWeek = false;
  const nextWeekMatch = dayText.match(/^przyszl[ya]\s+(.+)$/);
  if (nextWeekMatch) {
    nextWeek = true;
    dayText = nextWeekMatch[1];
  }

  // nazwa dnia tygodnia, np. "poniedzialek 9:00" — najbliższe wystąpienie (jeśli dziś, to za tydzień)
  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (dayText.startsWith(name)) {
      const d = new Date(now);
      const { h, m } = hourFor(9);
      if (nextWeek) {
        // Poniedziałek następnego tygodnia kalendarzowego (tydzień zaczyna się w poniedziałek).
        const monIdx = (d.getDay() + 6) % 7;
        const targetIdx = (weekday + 6) % 7;
        d.setDate(d.getDate() + (7 - monIdx) + targetIdx);
      } else {
        let diff = (weekday - d.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        d.setDate(d.getDate() + diff);
      }
      return withTime(d, h, m);
    }
  }

  // sama godzina, np. "15:30" albo "o 15" — dziś, jeśli jeszcze nie minęła, inaczej jutro
  const onlyTime = timeMatch ? raw.replace(timeMatch[0], "").trim() === "" : /^(o\s+)?\d{1,2}$/.test(raw);
  if (onlyTime && hours !== null) {
    const d = withTime(now, hours, minutes ?? 0);
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  return null;
}
