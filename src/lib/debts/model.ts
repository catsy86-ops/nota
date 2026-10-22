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
}

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
  return { id: e.id, person, kind: e.kind as DebtKind, amount: e.amount, at: e.at, note, created };
}

/** Spacje na brzegach i w środku → jedna spacja. */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

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
 * Procent rozliczenia z jednej strony salda. Kwoty „nam winna” (lent, returned) zwiększają saldo,
 * kwoty „my winni” (repaid, borrowed) je zmniejszają. Liczymy spłaconą część tej strony, która
 * jest winna: przy dodatnim saldzie — spłaty od niej, przy ujemnym — nasze spłaty jej.
 * 100 tylko przy zerowym saldzie; `floor` i maks. 99, żeby 99,6% nie wyglądało na zamknięte.
 */
export function repaidShare(entries: readonly DebtEntry[]): number {
  let owed = 0; // kwoty, które zwiększają saldo (nam winna)
  let settled = 0; // kwoty, które je zmniejszają (spłaty / zaciągnięte przez nas)
  for (const e of entries) {
    if (KIND_SIGN[e.kind] > 0) owed += e.amount; else settled += e.amount;
  }
  const balance = owed - settled;
  if (balance === 0) return 100;
  const side = balance > 0 ? owed : settled;
  if (side <= 0) return 0;
  const done = balance > 0 ? settled : owed;
  return Math.min(99, Math.floor((done / side) * 100));
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
