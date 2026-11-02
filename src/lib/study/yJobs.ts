import * as Y from "yjs";
import { cleanJobMeta, cleanQuoteItem, QUOTE_ITEMS_MAX, type Job, type JobMeta, type QuoteItem } from "./jobs";

/**
 * Zlecenia własne (H3.4) w Y.Doc notatek — synchronizacja i kopia jak reszta danych. Mapa `studyJobs`:
 * `j␁budowa` wpis zlecenia (status, zakres, termin, marża), `i␁budowa␁id` pozycja wyceny. Dwa telefony
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
    for (const [k, v] of map.entries()) {
      const [kind, site, id] = k.split(SEP);
      if (!site || !isId(site)) continue;
      if (kind === "j") { const m = cleanJobMeta(v); if (m) metas.set(site, m); continue; }
      if (kind === "i" && id && isId(id)) {
        const it = cleanQuoteItem(v, id);
        if (it) { const list = items.get(site) ?? []; list.push(it); items.set(site, list); }
      }
    }
    const out = new Map<string, Job>();
    // Pozycje bez wpisu zlecenia (usunięte na innym telefonie) nie robią z budowy fuchy.
    for (const [site, meta] of metas) {
      const list = (items.get(site) ?? []).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      out.set(site, { ...meta, items: list });
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
    const base: Partial<JobMeta> = prev ? { status: prev.status, statusAt: prev.statusAt, scope: prev.scope, term: prev.term, margin: prev.margin, created: prev.created } : { status: "quote", statusAt: now, created: now };
    const next = { ...base, ...patch };
    if (patch.status && patch.status !== prev?.status && patch.statusAt === undefined) next.statusAt = now;
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
    doc.transact(() => map.set(key("i", site, id), value), JOBS_ORIGIN);
    return true;
  }

  function removeItem(site: string, id: string): QuoteItem | null {
    const k = key("i", site, id);
    const prev = get(site)?.items.find((i) => i.id === id) ?? null;
    if (map.has(k)) doc.transact(() => map.delete(k), JOBS_ORIGIN);
    return prev;
  }

  /** Zdejmuje zlecenie z karty (karta zostaje zwykłą budową); zwraca je do „Cofnij”. */
  function remove(site: string): Job | null {
    const prev = get(site) ?? null;
    if (!prev) return null;
    doc.transact(() => {
      map.delete(key("j", site));
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
      for (const [site, data] of Object.entries(jobs)) {
        if (!isId(site) || !data || typeof data !== "object") continue;
        const meta = cleanJobMeta(data);
        if (!meta) continue;
        if (!map.has(key("j", site))) map.set(key("j", site), meta);
        const list = (data as Partial<Job>).items;
        for (const v of Array.isArray(list) ? list.slice(0, QUOTE_ITEMS_MAX) : []) {
          const id = (v as Partial<QuoteItem> | null)?.id;
          const it = typeof id === "string" && isId(id) ? cleanQuoteItem(v, id) : null;
          if (it && !map.has(key("i", site, it.id))) { const { id: _, ...value } = it; map.set(key("i", site, it.id), value); }
        }
      }
    }, JOBS_ORIGIN);
  }

  return { all, get, subscribe, setMeta, saveItem, removeItem, remove, restore, dump, mergeDump };
}
