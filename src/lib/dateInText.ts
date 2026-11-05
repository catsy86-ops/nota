import { parseNaturalDate } from "@/lib/parseNaturalDate";

/** Termin znaleziony w treści notatki (Terminy 3.4): tylko podpowiedź, nic nie ustawia się samo. */
export interface DateInText {
  /** Fraza dokładnie tak, jak stoi w tekście („w piątek o 10”). */
  phrase: string;
  date: Date;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").toLowerCase();
const clean = (w: string) => fold(w).replace(/^[([„"']+|[)\].,;:!?”"']+$/g, "");

const WEEKDAYS = /^(poniedzialek|poniedzialku|wtorek|sroda|srode|czwartek|piatek|sobota|sobote|niedziela|niedziele)$/;
const MONTHS = /^(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|wrzesnia|pazdziernika|listopada|grudnia)$/;

/**
 * Czy od tego słowa może zaczynać się termin. Ostrożnie: parser jest wyrozumiały (np. bierze dowolną liczbę
 * za godzinę), więc w zwykłym tekście szukamy tylko od wyraźnych słów — „jutro”, „w piątek”, „za 2 h”, „12.11”.
 */
function startsDate(words: string[], i: number): boolean {
  const w = clean(words[i]);
  const next = clean(words[i + 1] ?? "");
  if (/^(jutro|pojutrze|dzis|dzisiaj)$/.test(w)) return true;
  if (WEEKDAYS.test(w)) return true;
  if ((w === "w" || w === "we") && (WEEKDAYS.test(next) || next === "przyszly" || next === "przyszla" || next === "przyszlym")) return true;
  if (w === "za" && (/^\d+$/.test(next) || /^(godzine|tydzien)$/.test(next))) return true;
  if (/^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(w)) return true;
  if (/^\d{1,2}$/.test(w) && MONTHS.test(next)) return true;
  return false;
}

/**
 * Pierwszy termin w przyszłości zapisany w tekście („odbiór w piątek o 10”). Bierzemy najkrótszą frazę, którą
 * parser rozumie (jak szybkie dodawanie w Kalendarzu), i dokładamy godzinę zaraz po niej („o 10”, „15:30”) —
 * samotna liczba bez „o” nie jest godziną.
 */
export function findDateInText(text: string, now: Date = new Date()): DateInText | null {
  const words = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (!startsDate(words, i)) continue;
    for (let take = 1; take <= Math.min(3, words.length - i); take++) {
      let end = i + take;
      const head = words.slice(i, end).map(clean).join(" ");
      if (!parseNaturalDate(head, now)) continue;
      const withO = /^o$/i.test(clean(words[end] ?? ""));
      const at = withO ? end + 1 : end;
      const m = at < words.length ? /^(\d{1,2})(?::(\d{2}))?$/.exec(clean(words[at])) : null;
      if (m && Number(m[1]) <= 23 && (m[2] !== undefined || withO)) end = at + 1;
      const phraseWords = words.slice(i, end);
      const date = parseNaturalDate(phraseWords.map(clean).join(" "), now);
      if (date && date.getTime() > now.getTime()) {
        return { phrase: phraseWords.join(" ").replace(/[.,;:!?]+$/, ""), date };
      }
      break;
    }
  }
  return null;
}
