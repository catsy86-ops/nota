/**
 * Serwis i gwarancja (H4): zgłoszenia po odbiorze („cieknie syfon w łazience”) przy karcie budowy —
 * także budowy w archiwum, bo serwis przychodzi zwykle po zakończeniu. Pozycja listy karty
 * (`SiteCard.service`, w mapie `studySiteItems` jako rodzaj `service`). Termin wizyty to dzień;
 * zgłoszenie z terminem na dziś albo zaległe trafia do przypomnień (`reminders.ts`, push).
 * Czysta logika — zapis w `store.ts` (`setSiteService`), widok w `SiteServicePanel.tsx`.
 */

export interface ServiceCall {
  id: string;
  text: string;
  /** Zgłoszenie (ms). */
  at: number;
  /** Termin wizyty — dzień „2026-10-20”; brak = bez terminu. */
  due?: string;
  /** Zamknięte (ms); brak = otwarte. */
  done?: number;
  /** Co zrobiono — krótko, trafia do historii karty. */
  solution?: string;
}

export const SERVICE_TEXT_MAX = 200;
export const SERVICE_MAX = 50;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pad = (n: number) => String(n).padStart(2, "0");
/** Dzień lokalny „2026-10-14” (jak `dayKeyOf` w raporcie — bez importu, żeby nie robić cyklu). */
export const serviceDayKey = (at: number) => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function cleanServiceCalls(raw: unknown): ServiceCall[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: ServiceCall[] = [];
  for (const c of raw as Partial<ServiceCall>[]) {
    if (!c || typeof c.id !== "string" || !c.id || c.id.length > 64 || seen.has(c.id)) continue;
    const text = str(c.text, SERVICE_TEXT_MAX);
    if (!text || typeof c.at !== "number" || !Number.isFinite(c.at)) continue;
    seen.add(c.id);
    const solution = str(c.solution, SERVICE_TEXT_MAX);
    out.push({
      id: c.id, text, at: c.at,
      ...(typeof c.due === "string" && DAY_RE.test(c.due) ? { due: c.due } : {}),
      ...(typeof c.done === "number" && Number.isFinite(c.done) ? { done: c.done } : {}),
      ...(solution ? { solution } : {}),
    });
    if (out.length >= SERVICE_MAX) break;
  }
  return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

export function addServiceCall(list: readonly ServiceCall[], text: string, due: string | undefined, now: number, id: string = `v-${crypto.randomUUID().slice(0, 13)}`): ServiceCall[] {
  const t = text.trim().slice(0, SERVICE_TEXT_MAX);
  if (!t || list.length >= SERVICE_MAX) return [...list];
  return [...list, { id, text: t, at: now, ...(due && DAY_RE.test(due) ? { due } : {}) }];
}

/** Zamknięcie z opisem, co zrobiono; ponowne otwarcie zdejmuje datę zamknięcia (opis zostaje). */
export function closeServiceCall(list: readonly ServiceCall[], id: string, solution: string, now: number): ServiceCall[] {
  const s = solution.trim().slice(0, SERVICE_TEXT_MAX);
  return list.map((c) => (c.id === id ? { ...c, done: now, ...(s ? { solution: s } : {}) } : { ...c }));
}

export function reopenServiceCall(list: readonly ServiceCall[], id: string): ServiceCall[] {
  return list.map((c) => {
    if (c.id !== id) return { ...c };
    const { done: _d, ...rest } = c;
    return rest;
  });
}

/** Otwarte: najpierw z terminem (najbliższy pierwszy), potem bez terminu, od najstarszego. */
export function openServiceCalls(list: readonly ServiceCall[]): ServiceCall[] {
  return list
    .filter((c) => c.done === undefined)
    .sort((a, b) => (a.due && b.due ? (a.due < b.due ? -1 : a.due > b.due ? 1 : a.at - b.at) : a.due ? -1 : b.due ? 1 : a.at - b.at));
}

/** Otwarte z terminem dziś albo wcześniej — do przypomnień. */
export const dueServiceCalls = (list: readonly ServiceCall[], today: string) =>
  openServiceCalls(list).filter((c) => c.due !== undefined && c.due <= today);

/** Dni do końca gwarancji (`warranty` = ostatni dzień); ujemne = po gwarancji. */
export function warrantyDaysLeft(warranty: string, today: string): number {
  const toUtc = (k: string) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(warranty) - toUtc(today)) / 86_400_000);
}

export const isDayKey = (s: unknown): s is string => typeof s === "string" && DAY_RE.test(s);
