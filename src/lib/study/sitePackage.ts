import { cleanEntry, type JournalEntry } from "./journalEntry";
import { cleanShortages, SHORTAGES_MAX, type Shortage } from "./shortages";
import { cleanStages, STAGES_MAX, type SiteStage } from "./stages";
import { cleanPlanItems, type PlanItem } from "./planItems";
import { cleanPoint, cleanRoom, POINT_STEPS, POINTS_MAX, ROOMS_MAX, type Room, type WaterPoint } from "./points";
import { AUTHOR_MAX, cleanAuthor } from "./companyPrefs";
import { safeLine } from "@/lib/safeText";

/**
 * H5.2 Paczka budowy `.budowa` — wymiana jednej budowy z pomocnikiem bez serwera (WhatsApp, plik).
 * Czyste funkcje: budowa paczki, odczyt (dane niezaufane — wszystko przez `clean*`) i plan scalenia.
 * Zapis do danych i zdjęcia: `sitePackageIo.ts`. Przegląd `security-reviewer` 2026-11-02 przed kodem.
 * W pliku nie ma pieniędzy (stawki, rozliczenia, fuchy), kontaktów i telefonów (H-7), podpisu klienta,
 * lokalizacji wpisów, nagrań, oryginałów narysowanych zdjęć, danych Nauki (temat, odhaczenia) ani
 * odpowiedzialnego za usterkę. Kod dostępu (brama, klucze) tylko na wyraźny wybór.
 */

export const SITE_PACKAGE_FORMAT = "notki-budowa";
export const SITE_PACKAGE_VERSION = 1;
export const SITE_PACKAGE_MAX_BYTES = 40 * 1024 * 1024;
/** Wpisy z jednego pliku — każdy zostaje na stałe w dokumencie Yjs i jedzie na wszystkie urządzenia. */
export const SITE_PACKAGE_ENTRIES_MAX = 500;
export const SITE_PACKAGE_IMAGES_MAX = 200;
/** Zdjęcie z pliku: jak zdjęcia zapisywane na urządzeniu (`MAX_IMAGE_BYTES`), base64 to ~4/3 bajtów. */
export const SITE_PACKAGE_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_B64_MAX = Math.ceil(SITE_PACKAGE_IMAGE_BYTES * 4 / 3) + 64;
const PLAN_MAX = 5;
const FIELD_MAX = 200;
const ACCESS_MAX = 300;
const SITE_NAME_MAX = 120;
const DAY = 24 * 60 * 60 * 1000;

export interface SitePackage {
  format: typeof SITE_PACKAGE_FORMAT;
  version: number;
  exportedAt: number;
  /** Kto wysłał (imię z urządzenia, H5.1) — niezweryfikowane. */
  by?: string;
  site: { id: string; name: string; address: string; access?: string };
  stages: SiteStage[];
  shortages: Shortage[];
  plan: PlanItem[];
  rooms: Room[];
  points: WaterPoint[];
  entries: JournalEntry[];
  /** Klucz zdjęcia (SHA-256) → data URL; brak = paczka bez zdjęć. */
  images?: Record<string, string>;
  /** Tylko po wczytaniu (nie jest częścią pliku): ile wpisów z pliku pominięto ponad limit — pokazywane przed wczytaniem. */
  entriesSkipped?: number;
}

/** Wpis w paczce: bez lokalizacji, nagrań, oryginałów rysunków, danych Nauki i odpowiedzialnego. */
function packageEntry(e: JournalEntry): JournalEntry {
  const { geo: _g, recordings: _r, drawnFrom: _d, owner: _o, siteId: _s, ...rest } = e;
  return { ...rest, topic: null, checked: [] };
}

export function buildSitePackage(
  card: { id: string; name: string; address: string; access?: string; stages?: SiteStage[]; shortages?: Shortage[]; plan?: PlanItem[] },
  data: { entries: readonly JournalEntry[]; rooms: readonly Room[]; points: readonly WaterPoint[] },
  opts: { by?: string; now: number; access: boolean },
): SitePackage {
  return {
    format: SITE_PACKAGE_FORMAT,
    version: SITE_PACKAGE_VERSION,
    exportedAt: opts.now,
    ...(opts.by ? { by: opts.by } : {}),
    site: { id: card.id, name: card.name, address: card.address, ...(opts.access && card.access ? { access: card.access } : {}) },
    stages: card.stages ?? [],
    shortages: card.shortages ?? [],
    plan: card.plan ?? [],
    rooms: [...data.rooms],
    points: [...data.points],
    entries: data.entries.map(packageEntry),
  };
}

/** Klucze zdjęć wpisów (przed i po naprawie) — tylko te mogą przyjść w `images`. */
export function packageImageRefs(entries: readonly JournalEntry[]): Set<string> {
  const refs = new Set<string>();
  for (const e of entries) for (const r of [...e.images, ...(e.after ?? [])]) refs.add(r);
  return refs;
}

export type ParseResult = { ok: true; pkg: SitePackage } | { ok: false; error: string };

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const text = (v: unknown, max: number) => (typeof v === "string" ? safeLine(v).slice(0, max) : "");

/** Czas z pliku: poza zakresem 0…teraz+1 dzień = śmieć (np. `9e15` wygrywałby każde scalenie). */
const timeOk = (t: unknown, now: number) => typeof t === "number" && Number.isFinite(t) && t >= 0 && t <= now + DAY;

/**
 * Plik od innej osoby → paczka po czyszczeniu albo błąd po ludzku. Format i wersja dokładnie, każda lista
 * przez swoje `clean*` z limitem, czasy z przyszłości odrzucone, zdjęcia tylko te, do których odwołują
 * się wpisy, jako base64 obrazu do 2 MB. Rodzaj bajtów obrazu sprawdza zapis (`sitePackageIo.ts`).
 */
export function parseSitePackage(raw: string, now: number): ParseResult {
  if (raw.length > SITE_PACKAGE_MAX_BYTES * 1.4) return { ok: false, error: "Plik jest za duży (limit 40 MB)." };
  let d: Partial<SitePackage> | null;
  try { d = JSON.parse(raw); } catch { return { ok: false, error: "To nie jest plik budowy." }; }
  if (!d || typeof d !== "object" || d.format !== SITE_PACKAGE_FORMAT) return { ok: false, error: "To nie jest plik budowy." };
  if (d.version !== SITE_PACKAGE_VERSION) return { ok: false, error: "Plik z innej wersji aplikacji — zaktualizuj aplikację u obu osób." };
  const s = d.site as Partial<SitePackage["site"]> | undefined;
  const name = text(s?.name, SITE_NAME_MAX);
  if (!s || !isId(s.id) || !name) return { ok: false, error: "W pliku brakuje danych budowy." };

  // Ponad limit zostają najnowsze wpisy (nie pierwsze z pliku), a liczba pominiętych trafia do podsumowania (W2).
  const rawEntries: unknown[] = Array.isArray(d.entries) ? d.entries : [];
  const atOf = (e: unknown) => { const t = (e as { at?: unknown } | null)?.at; return typeof t === "number" ? t : 0; };
  const kept = rawEntries.length > SITE_PACKAGE_ENTRIES_MAX
    ? [...rawEntries].sort((a, b) => atOf(b) - atOf(a)).slice(0, SITE_PACKAGE_ENTRIES_MAX)
    : rawEntries;
  const entriesSkipped = rawEntries.length - kept.length;
  const entries = kept
    .map(cleanEntry)
    .filter((e): e is JournalEntry => !!e && timeOk(e.at, now) && (e.resolved === undefined || timeOk(e.resolved, now)))
    .map(packageEntry);
  const stages = (cleanStages(d.stages) ?? []).filter((x) => x.done === undefined || timeOk(x.done, now));
  const shortages = (cleanShortages(d.shortages) ?? []).filter((x) => timeOk(x.at, now) && (x.changed === undefined || timeOk(x.changed, now)));
  const plan = cleanPlanItems(d.plan).filter((x) => timeOk(x.at, now) && (x.doneAt === undefined || timeOk(x.doneAt, now)));
  const rooms = (Array.isArray(d.rooms) ? d.rooms.slice(0, ROOMS_MAX) : []).map(cleanRoom).filter((r): r is Room => !!r);
  const points = (Array.isArray(d.points) ? d.points.slice(0, POINTS_MAX) : [])
    .map(cleanPoint)
    .filter((p): p is WaterPoint => !!p && POINT_STEPS.every((st) => p.steps[st] === undefined || timeOk(p.steps[st], now)));

  const refs = packageImageRefs(entries);
  const images: Record<string, string> = {};
  if (d.images && typeof d.images === "object") {
    const src = new Map(Object.entries(d.images as Record<string, unknown>));
    let n = 0;
    for (const ref of refs) {
      const url = src.get(ref);
      if (n >= SITE_PACKAGE_IMAGES_MAX) break;
      if (typeof url === "string" && url.length <= IMAGE_B64_MAX && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) { images[ref] = url; n++; }
    }
  }
  const access = text(s.access, ACCESS_MAX);
  const by = cleanAuthor(d.by);
  return {
    ok: true,
    pkg: {
      format: SITE_PACKAGE_FORMAT,
      version: SITE_PACKAGE_VERSION,
      exportedAt: timeOk(d.exportedAt, now) ? d.exportedAt! : 0,
      ...(by ? { by } : {}),
      site: { id: s.id, name, address: text(s.address, FIELD_MAX), ...(access ? { access } : {}) },
      stages, shortages, plan, rooms, points, entries,
      ...(Object.keys(images).length ? { images } : {}),
      ...(entriesSkipped > 0 ? { entriesSkipped } : {}),
    },
  };
}

/**
 * Lista po scaleniu: ta sama pozycja — nowsza zmiana wygrywa; pozycje z pliku, których nie ma, dochodzą
 * tylko do limitu listy (lokalne zajmują miejsca pierwsze, nadmiar z pliku odpada i jest liczony).
 */
function mergeById<T extends { id: string }>(local: readonly T[], incoming: readonly T[], stamp: (x: T) => number, max: number, mark: (x: T) => T) {
  const next = local.map((x) => ({ ...x }));
  let added = 0, updated = 0, dropped = 0;
  for (const inc of incoming) {
    const i = next.findIndex((x) => x.id === inc.id);
    if (i >= 0) {
      if (stamp(inc) > stamp(next[i])) { next[i] = mark(inc); updated++; }
      continue;
    }
    if (next.length >= max) { dropped++; continue; }
    next.push(mark(inc));
    added++;
  }
  return { next, added, updated, dropped };
}

const pointStamp = (p: WaterPoint) => Math.max(0, ...POINT_STEPS.map((s) => p.steps[s] ?? 0));

/** Podpis pozycji z pliku: zawsze „… · z pliku”, także gdy imię w pliku jest takie jak Twoje (H5.1 + przegląd). */
export function fromFileAuthor(by: string | undefined): string {
  return `${(by ?? "pomocnik").slice(0, AUTHOR_MAX - 10)} · z pliku`;
}

export interface ImportPlan {
  entries: JournalEntry[];
  stages: SiteStage[];
  shortages: Shortage[];
  plan: PlanItem[];
  rooms: Room[];
  points: WaterPoint[];
  counts: { entries: number; stages: number; shortages: number; plan: number; points: number; images: number; dropped: number };
  listsChanged: { stages: boolean; shortages: boolean; plan: boolean };
}

/**
 * Plan scalenia paczki z lokalną budową `target`. Wpisy: tylko nowe id, z budową docelową (nie z pliku),
 * etap i punkt tylko, gdy istnieją w budowie docelowej. Istniejący wpis zostaje (wpisy nie mają czasu
 * zmiany). Punkt tylko do istniejącego (albo dochodzącego) pomieszczenia. Usunięcia nie przechodzą.
 */
export function planImport(
  pkg: SitePackage,
  target: { id: string; name: string },
  local: { journalIds: ReadonlySet<string>; stages: readonly SiteStage[]; shortages: readonly Shortage[]; plan: readonly PlanItem[]; rooms: readonly Room[]; points: readonly WaterPoint[]; hasImage?: (ref: string) => boolean },
): ImportPlan {
  const by = fromFileAuthor(pkg.by);
  const st = mergeById(local.stages, pkg.stages, (x) => x.done ?? 0, STAGES_MAX, (x) => ({ ...x }));
  const sh = mergeById(local.shortages, pkg.shortages, (x) => x.changed ?? x.at, SHORTAGES_MAX, (x) => ({ ...x, by }));
  const pl = mergeById(local.plan, pkg.plan, (x) => x.doneAt ?? x.at, PLAN_MAX, (x) => ({ ...x }));

  const localRooms = new Set(local.rooms.map((r) => r.id));
  const room = mergeById(local.rooms, pkg.rooms, () => 0, ROOMS_MAX, (x) => ({ ...x }));
  const rooms = room.next.filter((r) => !localRooms.has(r.id));
  const roomIds = new Set(room.next.map((r) => r.id));
  const localPoints = new Map(local.points.map((p) => [p.id, p]));
  let pointSlots = POINTS_MAX - local.points.length;
  let pointsDropped = 0;
  const points: WaterPoint[] = [];
  for (const p of pkg.points) {
    if (!roomIds.has(p.room)) { pointsDropped++; continue; }
    const l = localPoints.get(p.id);
    if (l) { if (pointStamp(p) > pointStamp(l)) points.push({ ...p, room: l.room, by }); continue; }
    if (pointSlots <= 0) { pointsDropped++; continue; }
    pointSlots--;
    points.push({ ...p, by });
  }

  const stageIds = new Set(st.next.map((x) => x.id));
  const pointIds = new Set([...local.points.map((p) => p.id), ...points.map((p) => p.id)]);
  const entries = pkg.entries
    .filter((e) => !local.journalIds.has(e.id))
    .map((e) => {
      const { stage, point, ...rest } = e;
      return {
        ...rest,
        site: target.name,
        siteId: target.id,
        by,
        ...(stage && stageIds.has(stage) ? { stage } : {}),
        ...(point && pointIds.has(point) ? { point } : {}),
      };
    });
  const imageRefs = packageImageRefs(entries);
  return {
    entries,
    stages: st.next,
    shortages: sh.next,
    plan: pl.next,
    rooms,
    points,
    counts: {
      entries: entries.length,
      stages: st.added + st.updated,
      shortages: sh.added + sh.updated,
      plan: pl.added + pl.updated,
      points: points.length,
      images: [...imageRefs].filter((r) => pkg.images?.[r] && !local.hasImage?.(r)).length,
      dropped: st.dropped + sh.dropped + pl.dropped + room.dropped + pointsDropped + (pkg.entriesSkipped ?? 0),
    },
    listsChanged: { stages: st.added + st.updated > 0, shortages: sh.added + sh.updated > 0, plan: pl.added + pl.updated > 0 },
  };
}

/** „Lipowa 5.budowa” — nazwa pliku bez znaków, których nie znoszą systemy plików. */
export const sitePackageName = (site: string) => `${safeLine(site.replace(/[\\/:*?"<>|]+/g, " ")).slice(0, 60) || "budowa"}.budowa`;

/** Nazwa nowej budowy, gdy nazwa z pliku jest zajęta: „Lipowa 5 (od Marka)”. */
export const collisionName = (name: string, by: string | undefined) => safeLine(`${name} (od ${by ?? "pomocnika"})`).slice(0, SITE_NAME_MAX);
