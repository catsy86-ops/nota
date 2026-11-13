import * as Y from "yjs";
import { cleanJobMeta, cleanQuoteItem, QUOTE_ITEMS_MAX, type Job, type JobMeta, type QuoteItem } from "./jobs";
import { CONTENT_FIELDS, cleanQuoteDoc, QUOTE_DOC_FIELDS, type QuoteDoc } from "./quoteDoc";

/**
 * Zlecenia własne (H3.4) w Y.Doc notatek — synchronizacja i kopia jak reszta danych. Mapa `studyJobs`:
 * `j␁budowa` wpis zlecenia (status, zakres, termin, marża), `i␁budowa␁id` pozycja wyceny, `c␁budowa` znacznik zmiany
 * treści wyceny (osobny klucz, żeby zmiana pozycji nie przepisywała statusu zmienionego na drugim telefonie),
 * `q␁budowa␁pole` pole dokumentu wyceny (numer, daty, VAT, rabat, uwagi, stan — `quoteDoc.ts`; osobne klucze, bo starsza wersja
 * przepisuje wpis `j` i zgubiłaby nieznane pola, a edycje różnych pól na dwóch telefonach mają się scalać, nie nadpisywać). Dwa telefony
 * dopisujące różne pozycje scalają się bez strat. Osobno od karty budowy (pieniądze — zasada 4 planu)
 * i od `yStudy.ts` (paczka startowa).
 */

export const JOBS_ORIGIN = "jobs";
const SEP = "\u0001";
const key = (...parts: string[]) => parts.join(SEP);
const isId = (v: string) => v.length > 0 && v.length <= 64;

export interface JobsDump {
  jobs: Record<string, Job>;
}

export function createYJobs(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyJobs");
  let snapshot: Map<string, Job> | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  /** Wszystkie zlecenia: id budowy → zlecenie z pozycjami. Ten sam obiekt do następnej zmiany. */
  function all(): Map<string, Job> {
    if (snapshot) return snapshot;
    const metas = new Map<string, JobMeta>();
    const items = new Map<string, QuoteItem[]>();
    const changed = new Map<string, number>();
    const rawDocs = new Map<string, Record<string, unknown>>();
    for (const [k, v] of map.entries()) {
      const [kind, site, id] = k.split(SEP);
      if (!site || !isId(site)) continue;
      if (kind === "j") { const m = cleanJobMeta(v); if (m) metas.set(site, m); continue; }
      if (kind === "q") { if (id) rawDocs.set(site, { ...rawDocs.get(site), [id]: v }); continue; }
      if (kind === "c") { if (typeof v === "number" && Number.isFinite(v) && v > 0) changed.set(site, v); continue; }
      if (kind === "i" && id && isId(id)) {
        const it = cleanQuoteItem(v, id);
        if (it) { const list = items.get(site) ?? []; list.push(it); items.set(site, list); }
      }
    }
    const out = new Map<string, Job>();
    // Pozycje bez wpisu zlecenia (usunięte na innym telefonie) nie robią z budowy fuchy.
    for (const [site, meta] of metas) {
      const list = (items.get(site) ?? []).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      const changedAt = Math.max(meta.changedAt ?? 0, changed.get(site) ?? 0);
      const doc = cleanQuoteDoc(rawDocs.get(site)) ?? undefined;
      out.set(site, { ...meta, ...(changedAt > 0 ? { changedAt } : {}), items: list, ...(doc ? { doc } : {}) });
    }
    snapshot = out;
    return out;
  }

  const get = (site: string): Job | undefined => all().get(site);

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Zakłada albo zmienia wpis zlecenia; `patch` scalany z obecnym. `false` = złe dane. */
  function setMeta(site: string, patch: Partial<JobMeta>, now = Date.now()): boolean {
    if (!isId(site)) return false;
    const prev = get(site);
    const base: Partial<JobMeta> = prev
      ? { status: prev.status, statusAt: prev.statusAt, scope: prev.scope, term: prev.term, margin: prev.margin, created: prev.created, changedAt: prev.changedAt }
      : { status: "quote", statusAt: now, created: now };
    const next = { ...base, ...patch };
    if (patch.status && patch.status !== prev?.status && patch.statusAt === undefined) next.statusAt = now;
    // Zmiana treści dla klienta unieważnia wcześniejszy podpis na potwierdzeniu (H3.5).
    if (prev && (("scope" in patch && patch.scope !== prev.scope) || ("margin" in patch && patch.margin !== prev.margin))) next.changedAt = now;
    const clean = cleanJobMeta(next);
    if (!clean) return false;
    doc.transact(() => map.set(key("j", site), clean), JOBS_ORIGIN);
    return true;
  }

  /** Nowa albo zmieniona pozycja wyceny; `false` = zła pozycja albo za dużo pozycji. */
  function saveItem(site: string, item: QuoteItem): boolean {
    if (!isId(site) || !isId(item.id) || !get(site)) return false;
    const clean = cleanQuoteItem(item, item.id);
    const exists = map.has(key("i", site, item.id));
    if (!clean || (!exists && (get(site)?.items.length ?? 0) >= QUOTE_ITEMS_MAX)) return false;
    const { id, ...value } = clean;
    doc.transact(() => {
      map.set(key("i", site, id), value);
      touch(site);
    }, JOBS_ORIGIN);
    return true;
  }

  /**
   * Zmiana dokumentu wyceny (numer, daty, VAT, rabat, uwagi, stan): `patch` scalany z obecnym, pole `undefined` je zdejmuje.
   * Zmiana treści widocznej dla klienta (`CONTENT_FIELDS`) unieważnia wcześniejszy podpis, jak zmiana pozycji.
   * `false` = brak zlecenia albo dokument po zmianie jest nieprawidłowy.
   */
  function setDoc(site: string, patch: Partial<QuoteDoc>, now = Date.now()): boolean {
    const prev = get(site);
    if (!prev) return false;
    const next: Record<string, unknown> = { ...prev.doc, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k];
    const clean = cleanQuoteDoc(next);
    // Walidacja przed jakimkolwiek zapisem: pole z patcha, które czyszczenie odrzuciło (np. rabat 150), unieważnia całą zmianę —
    // błędna zmiana nie może skasować poprzedniej, poprawnej wartości.
    for (const [k, v] of Object.entries(patch)) if (v !== undefined && clean?.[k as keyof QuoteDoc] === undefined) return false;
    // Zapisujemy tylko pola, które się zmieniły: edycje różnych pól na dwóch telefonach scalają się, a nie nadpisują całości.
    const changed = QUOTE_DOC_FIELDS.filter((f) => JSON.stringify(prev.doc?.[f]) !== JSON.stringify(clean?.[f]));
    if (changed.length === 0) return true;
    doc.transact(() => {
      for (const f of changed) {
        const v = clean?.[f];
        if (v === undefined) map.delete(key("q", site, f));
        else map.set(key("q", site, f), v);
      }
      if (changed.some((f) => CONTENT_FIELDS.includes(f))) touch(site, now);
    }, JOBS_ORIGIN);
    return true;
  }

  /** Znacznik zmiany treści wyceny (H3.5) — w tej samej transakcji co zmiana pozycji. */
  function touch(site: string, now = Date.now()): void {
    if (!get(site)) return;
    // Osobny klucz: wcześniej `touch` przepisywał cały wpis zlecenia ze stanu tego telefonu i mógł cofnąć status
    // zmieniony w tym czasie na drugim (W16).
    map.set(key("c", site), now);
  }

  function removeItem(site: string, id: string): QuoteItem | null {
    const k = key("i", site, id);
    const prev = get(site)?.items.find((i) => i.id === id) ?? null;
    if (map.has(k)) doc.transact(() => { map.delete(k); touch(site); }, JOBS_ORIGIN);
    return prev;
  }

  /** Zdejmuje zlecenie z karty (karta zostaje zwykłą budową); zwraca je do „Cofnij”. */
  function remove(site: string): Job | null {
    const prev = get(site) ?? null;
    if (!prev) return null;
    doc.transact(() => {
      map.delete(key("j", site));
      map.delete(key("c", site));
      for (const k of [...map.keys()]) if (k.startsWith(key("q", site, ""))) map.delete(k);
      for (const i of prev.items) map.delete(key("i", site, i.id));
    }, JOBS_ORIGIN);
    return prev;
  }

  function restore(site: string, job: Job): void {
    if (!isId(site)) return;
    const meta = cleanJobMeta(job);
    if (!meta) return;
    doc.transact(() => {
      map.set(key("j", site), meta);
      for (const [f, v] of Object.entries(cleanQuoteDoc(job.doc) ?? {})) map.set(key("q", site, f), v);
      for (const i of job.items) {
        const it = isId(i.id) ? cleanQuoteItem(i, i.id) : null;
        if (it) { const { id, ...value } = it; map.set(key("i", site, id), value); }
      }
    }, JOBS_ORIGIN);
  }

  function dump(): JobsDump {
    return { jobs: Object.fromEntries(all()) };
  }

  /** Scala kopię: zlecenia i pozycje, których tu nie ma, dochodzą; istniejące zostają. */
  function mergeDump(raw: unknown): void {
    const jobs = (raw as Partial<JobsDump> | null)?.jobs;
    if (!jobs || typeof jobs !== "object") return;
    doc.transact(() => {
      for (const [site, data] of Object.entries(jobs).slice(0, 500)) {
        if (!isId(site) || !data || typeof data !== "object") continue;
        const meta = cleanJobMeta(data);
        if (!meta) continue;
        if (!map.has(key("j", site))) map.set(key("j", site), meta);
        for (const [f, v] of Object.entries(cleanQuoteDoc((data as Partial<Job>).doc) ?? {})) if (!map.has(key("q", site, f))) map.set(key("q", site, f), v);
        const list = (data as Partial<Job>).items;
        for (const v of Array.isArray(list) ? list.slice(0, QUOTE_ITEMS_MAX) : []) {
          const id = (v as Partial<QuoteItem> | null)?.id;
          const it = typeof id === "string" && isId(id) ? cleanQuoteItem(v, id) : null;
          if (it && !map.has(key("i", site, it.id))) { const { id: _, ...value } = it; map.set(key("i", site, it.id), value); }
        }
      }
    }, JOBS_ORIGIN);
  }

  return { all, get, subscribe, setMeta, setDoc, saveItem, removeItem, remove, restore, dump, mergeDump };
}
