/**
 * Długi — kto ile pożyczył i ile już oddał. Czysty model bez Yjs i bez DOM:
 * kształt wpisu, czyszczenie danych z zewnątrz, kwoty i salda.
 *
 * Kwoty trzymamy w groszach (liczba całkowita), żeby suma nie gubiła centów.
 * Znak salda: dodatni = ta osoba jest nam winna, ujemny = my jesteśmy winni.
 */

/**
 * Cztery rodzaje wpisu. Saldo osoby to: pożyczyłem (+), oddał mi (−), pożyczyłem od (−), oddałem (+).
 * Dzięki temu jedna osoba może mieć długi w obie strony.
 */
export type DebtKind = "lent" | "repaid" | "borrowed" | "returned";
export const DEBT_KINDS: readonly DebtKind[] = ["lent", "repaid", "borrowed", "returned"];
/** Nazwa rodzaju na ekranie, w wiadomości i w CSV. */
export const DEBT_KIND_LABEL: Record<DebtKind, string> = { lent: "Pożyczyłem", repaid: "Oddał mi", borrowed: "Pożyczyłem od", returned: "Oddałem" };

/** Znak wpływu wpisu na saldo: dodatni = ta osoba jest nam winna więcej. */
export const KIND_SIGN: Record<DebtKind, 1 | -1> = { lent: 1, repaid: -1, borrowed: -1, returned: 1 };

export interface DebtEntry {
  id: string;
  /** Imię albo nazwa, tak jak wpisano przy pierwszym wpisie tej osoby. */
  person: string;
  kind: DebtKind;
  /** Grosze, > 0. */
  amount: number;
  /** Dzień zdarzenia, `YYYY-MM-DD`. */
  at: string;
  note: string;
  /** Kiedy wpis dodano (ms) — tie-break przy tym samym dniu. */
  created: number;
  /** Notatka z przypomnieniem o zwrocie (termin ustawiony przy dodawaniu). Brak = bez terminu. */
  dueNoteId?: string;
  /** Wpis z „Oddał całość / Oddałem całość” (1.6) — do wykrycia podwójnego rozliczenia z dwóch telefonów. */
  settle?: true;
}

/** Etykieta notatki z terminem zwrotu (1.2) — notatka nie ląduje w Skrzynce. */
export const DEBT_NOTE_LABEL = "długi";

export const DEBT_PERSON_MAX = 40;
export const DEBT_NOTE_MAX = 200;
/** Limit jednej kwoty: 1 000 000 zł. */
export const DEBT_MAX_AMOUNT = 100_000_000;
export const DEBT_MAX_ENTRIES = 2000;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_MAX = 64;

/** Dowolne wejście (peer, kopia, uszkodzony zapis) → poprawny wpis albo `null`. */
export function cleanDebt(raw: unknown): DebtEntry | null {
  const e = raw as Partial<DebtEntry> | null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.id !== "string" || !e.id || e.id.length > ID_MAX) return null;
  if (!DEBT_KINDS.includes(e.kind as DebtKind)) return null;
  const person = typeof e.person === "string" ? normalizeName(e.person).slice(0, DEBT_PERSON_MAX) : "";
  if (!person) return null;
  if (typeof e.amount !== "number" || !Number.isInteger(e.amount) || e.amount <= 0 || e.amount > DEBT_MAX_AMOUNT) return null;
  if (typeof e.at !== "string" || !DAY_RE.test(e.at)) return null;
  const created = typeof e.created === "number" && Number.isFinite(e.created) ? e.created : 0;
  const note = typeof e.note === "string" ? e.note.trim().slice(0, DEBT_NOTE_MAX) : "";
  const dueNoteId = typeof e.dueNoteId === "string" && e.dueNoteId && e.dueNoteId.length <= ID_MAX ? e.dueNoteId : undefined;
  return { id: e.id, person, kind: e.kind as DebtKind, amount: e.amount, at: e.at, note, created, ...(dueNoteId ? { dueNoteId } : {}), ...(e.settle === true ? { settle: true as const } : {}) };
}

/** Spacje na brzegach i w środku → jedna spacja. */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** Do szukania osoby (2.5): małe litery, bez polskich znaków („Łukasz” = „lukasz”). */
export function foldName(name: string): string {
  return personKey(name).replace(/ł/g, "l").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Barwy kółka z inicjałem (4.2) — te same nazwy co kolory notatek (`--note-ink` w `index.css`). */
export const AVATAR_HUES = ["coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"] as const;

/** Stała barwa osoby: ta sama nazwa (bez wielkości liter) zawsze daje ten sam kolor. */
export function avatarHue(name: string): (typeof AVATAR_HUES)[number] {
  let h = 0;
  for (const ch of personKey(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

/** Pierwsza litera nazwy (wielka) do kółka. */
export const initialOf = (name: string) => (normalizeName(name).charAt(0) || "?").toLocaleUpperCase("pl");

/** Klucz grupowania: ta sama osoba, niezależnie od wielkości liter („Anna” = „anna”). */
export function personKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase("pl");
}

/**
 * Kwota wpisana przez użytkownika („1 234,5”, „1234.50”, „80”) → grosze.
 * Więcej niż dwa miejsca po przecinku, zero, litery → `null`.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [zl, gr = ""] = s.split(".");
  const grosze = Number(zl) * 100 + Number(gr.padEnd(2, "0"));
  if (!Number.isSafeInteger(grosze) || grosze <= 0 || grosze > DEBT_MAX_AMOUNT) return null;
  return grosze;
}

const moneyFmt = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123450 → „1 234,50 zł” (Intl daje twardą spację jako separator tysięcy). */
export function formatAmount(grosze: number): string {
  return `${moneyFmt.format(grosze / 100)} zł`;
}

export interface PersonDebts {
  key: string;
  name: string;
  /** Dodatnie: nam winna. Ujemne: my winni. Zero: rozliczone. */
  balance: number;
  /** Wpisy tej osoby, najnowsze pierwsze. */
  entries: DebtEntry[];
}

/** Najnowsze pierwsze: dzień, potem kolejność dodania. */
export const byNewest = (a: DebtEntry, b: DebtEntry) => (a.at === b.at ? b.created - a.created : a.at < b.at ? 1 : -1);

/**
 * Salda po osobach. Najpierw ci, którzy są nam winni (największa kwota pierwsza),
 * potem ci, których my jesteśmy winni, na końcu rozliczeni.
 */
export function balances(entries: readonly DebtEntry[]): PersonDebts[] {
  const groups = new Map<string, PersonDebts>();
  for (const e of [...entries].sort(byNewest)) {
    const key = personKey(e.person);
    let g = groups.get(key);
    if (!g) { g = { key, name: e.person, balance: 0, entries: [] }; groups.set(key, g); }
    g.balance += KIND_SIGN[e.kind] * e.amount;
    g.entries.push(e);
  }
  const rank = (b: number) => (b > 0 ? 0 : b < 0 ? 1 : 2);
  return [...groups.values()].sort((a, b) => rank(a.balance) - rank(b.balance) || Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name, "pl"));
}

/**
 * Strona salda, która jest winna (1.3). Kwoty „nam winna” (lent, returned) zwiększają saldo, kwoty
 * „my winni” (repaid, borrowed) je zmniejszają. `side` — suma strony winnej (przy dodatnim saldzie
 * to, co ta osoba pożyczyła od nas, przy ujemnym — to, co my od niej), `done` — ile z tego oddano.
 * Przy zerowym saldzie obie strony są równe, `side` = obrót jednej strony.
 */
export function debtSide(entries: readonly DebtEntry[]): { side: number; done: number; balance: number } {
  let owed = 0; // kwoty, które zwiększają saldo (nam winna)
  let settled = 0; // kwoty, które je zmniejszają (spłaty / zaciągnięte przez nas)
  for (const e of entries) {
    if (KIND_SIGN[e.kind] > 0) owed += e.amount; else settled += e.amount;
  }
  const balance = owed - settled;
  return balance >= 0 ? { side: owed, done: settled, balance } : { side: settled, done: owed, balance };
}

/**
 * Procent rozliczenia strony winnej (`debtSide`). 100 tylko przy zerowym saldzie; `floor` i maks. 99,
 * żeby 99,6% nie wyglądało na zamknięte.
 */
export function repaidShare(entries: readonly DebtEntry[]): number {
  const { side, done, balance } = debtSide(entries);
  if (balance === 0) return 100;
  if (side <= 0) return 0;
  return Math.min(99, Math.floor((done / side) * 100));
}

/** Dwa „całość” w ciągu minuty (dwa telefony naraz) — ten sam rodzaj i kwota. */
export const DOUBLE_SETTLE_MS = 60_000;

/**
 * Podwójne rozliczenie (1.6): dwa wpisy „całość” tej osoby w ciągu minuty, ten sam rodzaj i kwota,
 * a saldo przeszło na drugą stronę dokładnie o tę kwotę. Zwraca nowszy (do usunięcia) albo `null`.
 */
export function doubleSettle(entries: readonly DebtEntry[]): DebtEntry | null {
  const balance = entries.reduce((s, e) => s + KIND_SIGN[e.kind] * e.amount, 0);
  const settles = entries.filter((e) => e.settle).sort((a, b) => a.created - b.created);
  for (let i = 1; i < settles.length; i++) {
    const a = settles[i - 1];
    const b = settles[i];
    if (b.created - a.created <= DOUBLE_SETTLE_MS && a.kind === b.kind && a.amount === b.amount && balance === KIND_SIGN[b.kind] * b.amount) return b;
  }
  return null;
}

/**
 * Saldo po każdym wpisie osoby (`entries` najnowsze pierwsze, jak w `balances`). Wynik ma tę samą
 * kolejność: saldo „po tym wpisie” to suma tego wpisu i wszystkich starszych.
 */
export function runningBalances(entries: readonly DebtEntry[]): number[] {
  const out = new Array<number>(entries.length);
  let acc = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    acc += KIND_SIGN[entries[i].kind] * entries[i].amount;
    out[i] = acc;
  }
  return out;
}

/** Podsumowanie: ile ludzie są nam winni i ile my im. */
export function totals(people: readonly PersonDebts[]): { owedToMe: number; iOwe: number } {
  let owedToMe = 0;
  let iOwe = 0;
  for (const p of people) {
    if (p.balance > 0) owedToMe += p.balance;
    else iOwe -= p.balance;
  }
  return { owedToMe, iOwe };
}

/** Nazwy znanych osób do podpowiedzi przy dodawaniu, bez powtórek. */
export function knownPeople(entries: readonly DebtEntry[]): string[] {
  const seen = new Map<string, string>();
  for (const e of [...entries].sort(byNewest)) if (!seen.has(personKey(e.person))) seen.set(personKey(e.person), e.person);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pl"));
}

/** „2026-10-14” → „14.10.2026”. */
const plDate = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

/**
 * 3.2 Wiadomość do osoby: saldo i wpisy (od najnowszego), głosem wysyłającego. Kwoty zawsze widoczne —
 * wysyłka to wyraźne stuknięcie, a ukrywanie kwot chroni tylko ekran.
 */
export function personStatement(p: PersonDebts): string {
  const head = p.balance === 0 ? "Rozliczone." : p.balance > 0 ? `Do oddania: ${formatAmount(p.balance)}` : `Jestem winien: ${formatAmount(-p.balance)}`;
  const lines = p.entries.map((e) => `${plDate(e.at)} · ${DEBT_KIND_LABEL[e.kind]} · ${formatAmount(e.amount)}${e.note ? ` · ${e.note}` : ""}`);
  return [`${p.name} — rozliczenie`, head, "", ...lines].join(String.fromCharCode(10));
}

const CRLF = String.fromCharCode(13, 10);
const BOM = String.fromCharCode(0xfeff);

/**
 * Pole tekstowe CSV: początek `=`, `+`, `-`, `@`, tabulator albo CR dostaje apostrof (bez wstrzykiwania formuł
 * w Excelu), średnik, cudzysłów albo nowa linia — cudzysłowy.
 */
function textCell(v: string): string {
  const c = v.charCodeAt(0);
  // Pusty tekst: `"=+-@".includes("")` to `true` — bez sprawdzenia długości puste pole dostawało apostrof.
  const s = v.length > 0 && ("=+-@".includes(v.charAt(0)) || c === 9 || c === 13) ? `'${v}` : v;
  return /[;"]/.test(s) || s.includes(String.fromCharCode(10)) || s.includes(String.fromCharCode(13)) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Grosze → „-12,50” (liczba w polskim Excelu; bez apostrofu, to nie tekst). */
const moneyCell = (grosze: number) => (grosze / 100).toFixed(2).replace(".", ",");

/**
 * 3.4 Wszystkie wpisy jako CSV pod polski Excel (separator „;”, BOM, CRLF, przecinek dziesiętny), od
 * najstarszego. Saldo osoby: plus — ta osoba jest nam winna, minus — my jej.
 */
export function debtsCsv(entries: readonly DebtEntry[]): string {
  const balance = new Map(balances(entries).map((p) => [p.key, p.balance]));
  const rows = [["Data", "Osoba", "Rodzaj", "Kwota [zł]", "Za co", "Saldo osoby [zł] (+ nam winna)"].map(textCell).join(";")];
  for (const e of [...entries].sort(byNewest).reverse()) {
    rows.push([textCell(e.at), textCell(e.person), textCell(DEBT_KIND_LABEL[e.kind]), moneyCell(e.amount), textCell(e.note), moneyCell(balance.get(personKey(e.person)) ?? 0)].join(";"));
  }
  return BOM + rows.join(CRLF) + CRLF;
}
