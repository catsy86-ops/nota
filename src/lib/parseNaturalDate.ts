const WEEKDAYS: Record<string, number> = {
  "niedziela": 0, "niedziele": 0,
  "poniedzialek": 1,
  "wtorek": 2,
  "sroda": 3, "srode": 3,
  "czwartek": 4,
  "piatek": 5,
  "sobota": 6, "sobote": 6,
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function withTime(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Parsuje proste, polskojęzyczne wyrażenia czasu ("jutro 15:00", "za 2h",
 * "za 30 min", "poniedziałek 9:00", "15:30") na konkretną datę.
 * Zwraca null, jeśli wyrażenie nie zostało rozpoznane.
 */
export function parseNaturalDate(input: string, now: Date = new Date()): Date | null {
  const raw = stripDiacritics(input.trim().toLowerCase());
  if (!raw) return null;

  const timeMatch = raw.match(/(\d{1,2})[:.](\d{2})/);
  const hours = timeMatch ? Number(timeMatch[1]) : null;
  const minutes = timeMatch ? Number(timeMatch[2]) : null;
  if (hours !== null && (hours > 23 || (minutes as number) > 59)) return null;

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
    return withTime(now, hours ?? now.getHours(), minutes ?? 0);
  }

  // "jutro"
  if (/^jutro\b/.test(raw)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return withTime(d, hours ?? 9, minutes ?? 0);
  }

  // "pojutrze"
  if (/^pojutrze\b/.test(raw)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return withTime(d, hours ?? 9, minutes ?? 0);
  }

  // nazwa dnia tygodnia, np. "poniedzialek 9:00" — najbliższe wystąpienie (jeśli dziś, to za tydzień)
  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (raw.startsWith(name)) {
      const d = new Date(now);
      let diff = (weekday - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return withTime(d, hours ?? 9, minutes ?? 0);
    }
  }

  // sama godzina, np. "15:30" — dziś, jeśli jeszcze nie minęła, inaczej jutro
  if (timeMatch && raw.replace(timeMatch[0], "").trim() === "") {
    const d = withTime(now, hours as number, minutes as number);
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  return null;
}
