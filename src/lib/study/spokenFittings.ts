import { FITTING_NAME_MAX, FITTING_QTY_MAX, FITTINGS_MAX, fittingKey, type Fitting } from "./fittings";

/**
 * Kształtki z dyktowania: „kolano 16 cztery sztuki, trójnik 16 dwa, 3 złączki 20” → lista
 * pozycji. Rozpoznawanie mowy w Chrome zwraca raz cyfry, raz słowa — oba warianty działają.
 * Czysta funkcja: bez Web Speech, testowana w `spokenFittings.test.ts`.
 *
 * Zasady:
 * - pozycje rozdziela przecinek, kropka, średnik, „i”, „oraz”, „plus”;
 * - liczba sztuk: liczba przed „sztuk/sztuki/sztuka/szt/razy/x” albo liczba na początku
 *   („4 kolana 16”) albo ostatnia z dwóch liczb („kolano 16 4”); bez liczby = 1 sztuka;
 * - pierwsze słowo w liczbie mnogiej wraca do pojedynczej („kolana” → „Kolano”);
 * - nazwa znana z poprzednich wpisów albo podpowiedzi przyjmuje jej pisownię.
 */

const UNITS: Record<string, number> = {
  jeden: 1, jedna: 1, jedno: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, pięć: 5, sześć: 6, siedem: 7, osiem: 8,
  dziewięć: 9, dziesięć: 10, jedenaście: 11, dwanaście: 12, trzynaście: 13, czternaście: 14, piętnaście: 15,
  szesnaście: 16, siedemnaście: 17, osiemnaście: 18, dziewiętnaście: 19,
};
const TENS: Record<string, number> = {
  dwadzieścia: 20, trzydzieści: 30, czterdzieści: 40, pięćdziesiąt: 50, sześćdziesiąt: 60,
  siedemdziesiąt: 70, osiemdziesiąt: 80, dziewięćdziesiąt: 90,
};

/** Liczba mnoga → pojedyncza dla częstych kształtek instalatora (porównanie bez ogonków). */
const SINGULAR: Record<string, string> = {
  kolana: "kolano", kolan: "kolano",
  trojniki: "trójnik", trojnikow: "trójnik",
  zlaczki: "złączka", zlaczek: "złączka",
  mufy: "mufa", muf: "mufa",
  redukcje: "redukcja", redukcji: "redukcja",
  zawory: "zawór", zaworow: "zawór",
  korki: "korek", korkow: "korek",
  nyple: "nypel", nypli: "nypel",
  srubunki: "śrubunek", srubunkow: "śrubunek",
  przejscia: "przejście", przejsc: "przejście",
  kielichy: "kielich", kielichow: "kielich",
  rewizje: "rewizja", rewizji: "rewizja",
  syfony: "syfon", syfonow: "syfon",
};

const QTY_WORD = /^(sztuk[ai]?|szt\.?|razy|x)$/;

const fold = (s: string) => s.toLocaleLowerCase("pl").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

/** Słowa liczebników → cyfry („dwadzieścia pięć” → „25”); reszta bez zmian. */
export function wordsToDigits(text: string): string {
  const words = text.toLocaleLowerCase("pl").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in TENS) {
      const next = words[i + 1];
      if (next !== undefined && next in UNITS && UNITS[next] < 10) { out.push(String(TENS[w] + UNITS[next])); i++; }
      else out.push(String(TENS[w]));
    } else if (w in UNITS) out.push(String(UNITS[w]));
    else out.push(w);
  }
  return out.join(" ");
}

const isNum = (w: string) => /^\d+$/.test(w);

function parseSegment(segment: string): Fitting | null {
  // „x4”, „4x”, „4szt” — rozdzielamy liczbę od jednostki, żeby dalej działały same słowa.
  const words = wordsToDigits(segment)
    // „redukcja 20 na 16” to wymiar „20/16”, nie 16 sztuk.
    .replace(/(\d+)\s+na\s+(\d+)/g, "$1/$2")
    .replace(/(\d)(szt|x)\b/g, "$1 $2")
    .replace(/\bx(\d)/g, "x $1")
    .split(/\s+/)
    .filter((w) => w && w !== "fi" && w !== "po");
  let qty: number | null = null;

  // 1a) „mufa 32 x 3” — mnożnik z liczbą po nim ma pierwszeństwo (inaczej 32 wyszłoby sztukami).
  for (let i = 0; i < words.length - 1; i++) {
    if ((words[i] === "x" || words[i] === "razy") && isNum(words[i + 1])) { qty = Number(words[i + 1]); words.splice(i, 2); break; }
  }
  // 1b) „… 4 sztuki” / „… 4 razy” / „… 4x”.
  if (qty === null) {
    for (let i = 0; i < words.length - 1; i++) {
      if (isNum(words[i]) && QTY_WORD.test(words[i + 1])) { qty = Number(words[i]); words.splice(i, 2); break; }
    }
  }
  // 2) „4 kolana 16” — liczba na początku, dalej nazwa.
  if (qty === null && words.length > 1 && isNum(words[0]) && !isNum(words[1])) qty = Number(words.shift());
  // 3) „kolano 16 4” — ostatnia z co najmniej dwóch liczb to sztuki.
  if (qty === null && words.length > 2 && isNum(words[words.length - 1]) && words.slice(0, -1).some(isNum)) qty = Number(words.pop());

  const rest = words.filter((w) => !QTY_WORD.test(w));
  if (rest.length === 0 || !rest.some((w) => /\p{L}/u.test(w))) return null;
  const first = SINGULAR[fold(rest[0])] ?? rest[0];
  const name = [first, ...rest.slice(1)].join(" ").slice(0, FITTING_NAME_MAX).trim();
  const n = qty === null ? 1 : Math.trunc(qty);
  if (!name || n < 1) return null;
  return { name: name.charAt(0).toLocaleUpperCase("pl") + name.slice(1), qty: Math.min(FITTING_QTY_MAX, n) };
}

/**
 * Tekst z dyktowania → kształtki. `known` to nazwy już używane (podpowiedzi, historia):
 * rozpoznana nazwa o tym samym kluczu przyjmuje ich pisownię („kolano 16” → „Kolano 16”).
 */
export function parseSpokenFittings(text: string, known: readonly string[] = []): Fitting[] {
  const byKey = new Map(known.map((n) => [fittingKey(n), n] as const));
  const out: Fitting[] = [];
  for (const raw of text.split(/[,;.\n]+|\s+(?:i|oraz|plus|a także)\s+/i)) {
    const f = parseSegment(raw.trim());
    if (!f) continue;
    const name = byKey.get(fittingKey(f.name)) ?? f.name;
    const same = out.find((x) => fittingKey(x.name) === fittingKey(name));
    if (same) same.qty = Math.min(FITTING_QTY_MAX, same.qty + f.qty);
    else out.push({ name, qty: f.qty });
  }
  return out;
}

/**
 * Dokłada podyktowane kształtki do listy wpisu: ta sama nazwa sumuje sztuki, nowe idą na koniec
 * (do limitu `FITTINGS_MAX`). Puste wiersze w trakcie pisania zostają, gdzie były.
 */
export function mergeFittings(current: readonly Fitting[], added: readonly Fitting[]): Fitting[] {
  const out = current.map((f) => ({ ...f }));
  for (const a of added) {
    const same = out.find((f) => f.name.trim() && fittingKey(f.name) === fittingKey(a.name));
    if (same) same.qty = Math.min(FITTING_QTY_MAX, same.qty + a.qty);
    else if (out.length < FITTINGS_MAX) {
      // Pusty wiersz „Kolejna” bierze pierwszą nową pozycję, zamiast zostawać pusty nad nią.
      const blank = out.find((f) => !f.name.trim());
      if (blank) { blank.name = a.name; blank.qty = a.qty; } else out.push({ ...a });
    }
  }
  return out;
}
