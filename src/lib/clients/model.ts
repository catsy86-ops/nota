import { isValidNip, normalizeNip } from "@/lib/ksef/nip";
import { safeLine } from "@/lib/safeText";
import { foldName } from "@/lib/study/siteKey";

/**
 * Kartoteka klientów (plan wycen i klientów, Etap 1). Czysty model: kształt klienta, czyszczenie danych z zewnątrz
 * (Yjs, kopia, peer) i wyszukiwanie. Zapis w Yjs w `yClients.ts`. Klient to dane osobowe — nie trafia do paczki
 * `.budowa`, diagnostyki ani raportu dla szefa (zasada 1 planu).
 */

export const CLIENT_KINDS = ["person", "company"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];
export const CLIENT_KIND_LABEL: Readonly<Record<ClientKind, string>> = { person: "Osoba", company: "Firma" };

export const CLIENT_NAME_MAX = 120;
export const CLIENT_ADDRESS_MAX = 200;
export const CLIENT_PHONE_MAX = 40;
export const CLIENT_EMAIL_MAX = 120;
export const CLIENT_NOTE_MAX = 500;
export const CLIENTS_MAX = 2000;

export interface Client {
  id: string;
  name: string;
  kind: ClientKind;
  /** NIP bez kresek; pusty u osoby prywatnej. Tylko poprawny (suma kontrolna) — zły NIP odrzuca `cleanClient`. */
  nip: string;
  address1: string;
  address2: string;
  phone: string;
  email: string;
  note: string;
  /** Moment założenia (ms). */
  created: number;
  /** W archiwum od (ms); znika z listy podpowiedzi, powiązania z budowami zostają. */
  archived?: number;
}

/** Pola edytowalne pojedynczo — w Yjs każde ma własny klucz, więc edycja telefonu i adresu na dwóch urządzeniach się scala. */
export const CLIENT_FIELDS = ["name", "kind", "nip", "address1", "address2", "phone", "email", "note", "archived"] as const;
export type ClientField = (typeof CLIENT_FIELDS)[number];

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const line = (v: unknown, max: number) => (typeof v === "string" ? safeLine(v).slice(0, max) : "");
const time = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);

/** NIP z pola: pusty → `""`, poprawny → cyfry, zły → `undefined` (UI pokazuje błąd zamiast zapisać). */
export function parseClientNip(raw: string): string | undefined {
  const n = normalizeNip(raw.trim());
  if (n === "") return "";
  return isValidNip(n) ? n : undefined;
}

/** E-mail z pola: bardzo luźna kontrola (jedno „@”, kropka w domenie); pusty jest dozwolony. */
export const isPlausibleEmail = (v: string): boolean => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Klient z dowolnego wejścia albo `null` (bez id, nazwy albo czasu założenia). Zły NIP i e-mail zostają puste. */
export function cleanClient(raw: unknown): Client | null {
  const c = raw as Partial<Record<keyof Client, unknown>> | null;
  if (!c || typeof c !== "object" || !isId(c.id)) return null;
  const name = line(c.name, CLIENT_NAME_MAX);
  const created = time(c.created);
  if (!name || created === undefined) return null;
  const nip = typeof c.nip === "string" ? parseClientNip(c.nip) ?? "" : "";
  const email = line(c.email, CLIENT_EMAIL_MAX);
  const archived = time(c.archived);
  return {
    id: c.id,
    name,
    kind: c.kind === "company" ? "company" : "person",
    nip,
    address1: line(c.address1, CLIENT_ADDRESS_MAX),
    address2: line(c.address2, CLIENT_ADDRESS_MAX),
    phone: line(c.phone, CLIENT_PHONE_MAX),
    email: isPlausibleEmail(email) ? email : "",
    note: line(c.note, CLIENT_NOTE_MAX),
    created,
    ...(archived !== undefined ? { archived } : {}),
  };
}

/** Wartość jednego pola przed zapisem w Yjs; `undefined` = odrzucone (np. zły NIP). */
export function cleanClientField(field: ClientField, value: unknown): string | number | undefined {
  switch (field) {
    case "name": { const v = line(value, CLIENT_NAME_MAX); return v || undefined; }
    case "kind": return value === "company" ? "company" : value === "person" ? "person" : undefined;
    case "nip": return typeof value === "string" ? parseClientNip(value) : undefined;
    case "address1": case "address2": return line(value, CLIENT_ADDRESS_MAX);
    case "phone": return line(value, CLIENT_PHONE_MAX);
    case "email": { const v = line(value, CLIENT_EMAIL_MAX); return isPlausibleEmail(v) ? v : undefined; }
    case "note": return line(value, CLIENT_NOTE_MAX);
    case "archived": return time(value) ?? 0;
  }
}

/** Adres w jednym wierszu: „ulica numer, kod miasto”; puste wiersze pomijane. */
export const clientAddress = (c: Pick<Client, "address1" | "address2">): string => [c.address1, c.address2].filter(Boolean).join(", ");

/** Najpierw aktywni po nazwie (bez polskich znaków i wielkości liter), potem archiwalni. */
/**
 * Nazwa klienta złożona (bez ogonków i wielkości liter) — liczona raz na obiekt klienta. Migawka kartoteki jest budowana od
 * nowa po każdej zmianie, a sortowanie, szukanie i dopasowanie nazw wołają to wielokrotnie na tych samych klientach.
 */
const folded = new WeakMap<Client, string>();
export function foldedName(c: Client): string {
  let k = folded.get(c);
  if (k === undefined) { k = foldName(c.name); folded.set(c, k); }
  return k;
}

export const byName = (a: Client, b: Client): number =>
  Number(!!a.archived) - Number(!!b.archived) || foldedName(a).localeCompare(foldedName(b)) || a.id.localeCompare(b.id);

/** Tekst do szukania (nazwa, adresy, e-mail) złożony raz na obiekt klienta. */
const haystacks = new WeakMap<Client, string>();
const haystack = (c: Client): string => {
  let h = haystacks.get(c);
  if (h === undefined) { h = foldName(`${c.name} ${c.address1} ${c.address2} ${c.email}`); haystacks.set(c, h); }
  return h;
};

const digits = (s: string) => s.replace(/\D/g, "");

/** Wyszukiwanie po nazwie, adresie, telefonie (same cyfry), NIP-ie i e-mailu; każde słowo musi pasować. Pusta fraza = wszyscy. */
export function searchClients(list: readonly Client[], query: string): Client[] {
  const words = foldName(query).split(" ").filter(Boolean);
  if (words.length === 0) return [...list];
  return list.filter((c) => {
    const hay = haystack(c);
    const nums = `${digits(c.phone)} ${c.nip}`;
    return words.every((w) => hay.includes(w) || (/^\d+$/.test(w) && nums.includes(w)));
  });
}

/** Klienci o tej samej nazwie (po złożeniu) albo tym samym NIP-ie — kandydaci do scalenia (Etap 2.6) i ostrzeżenie przy dodawaniu. */
export function findDuplicates(list: readonly Client[], probe: Pick<Client, "name" | "nip">, exceptId?: string): Client[] {
  const key = foldName(probe.name);
  return list.filter((c) => c.id !== exceptId && ((!!key && foldedName(c) === key) || (!!probe.nip && c.nip === probe.nip)));
}
