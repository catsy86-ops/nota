import { entrySiteId, type SiteCard } from "./sites";
import { testLine } from "./pressureTest";
import { dayKeyOf, periodLabel } from "./report";
import { siteStages, type SiteStage } from "./stages";
import type { JournalEntry } from "./journalEntry";
import type { SiteSignature } from "./signature";
import { pointsProgress, pointType, POINT_STEPS, sidesLabel, STEP_LABEL, type Room, type WaterPoint } from "./points";

/**
 * Protokół odbioru dla inwestora — jedna kartka na koniec budowy: dane budowy, etapy z datami,
 * próby szczelności z wpisów, uwagi (otwarte problemy), zdjęcia i miejsca na podpisy.
 * Czysta funkcja; wydruk (PDF przez „Zapisz jako PDF”) w `HandoverPaper.tsx`.
 */

/** Ile zdjęć mieści się na wydruku; reszta jest w paczce ZIP budowy. */
export const HANDOVER_PHOTOS_MAX = 12;

export interface HandoverTest {
  at: number;
  line: string;
  ok: boolean;
}

export interface HandoverRemark {
  at: number;
  text: string;
  /** Odpowiedzialny za naprawę (P2.3), jeśli wpisano. */
  owner?: string;
  /** Termin naprawy (`YYYY-MM-DD`), jeśli wpisano. */
  due?: string;
  /** Zdjęcia przed (wpis) i po naprawie. */
  photosBefore: number;
  photosAfter: number;
}

/** Zdjęcia jednego etapu (wpisy przypięte do etapu) albo pozostałe (`stage: null`). */
export interface HandoverPhotoGroup {
  stage: string | null;
  photos: string[];
  /** Data wpisu każdego zdjęcia (ms, w kolejności `photos`): protokół podpisuje zdjęcie datą (P2.2). */
  dates: number[];
}

/** Punkt w protokole (H2.4): typ, strony, wysokość, zrobione kroki z datami i liczba zdjęć punktu. */
export interface HandoverPoint {
  label: string;
  /** „Z C K”; pusty = bez stron. */
  sides: string;
  height?: number;
  /** Zrobione kroki od początku: „podejście”, „próba”, „biały montaż” z datą (ms). */
  steps: { label: string; at: number }[];
  photos: number;
}

export interface HandoverRoom {
  name: string;
  points: HandoverPoint[];
}

export interface Handover {
  site: string;
  address: string;
  investor: string;
  /** „1–14 października 2026”; `null` = budowa bez wpisów. */
  period: string | null;
  /** Data protokołu („16 października 2026”). */
  date: string;
  /** Etapy z karty; `null` = karta bez etapów. */
  stages: SiteStage[] | null;
  tests: HandoverTest[];
  /** Otwarte problemy — uwagi do odbioru. */
  remarks: HandoverRemark[];
  /** Zdjęcia od najstarszego (przed zakryciem są zwykle pierwsze), do `HANDOVER_PHOTOS_MAX`. */
  photos: string[];
  /** Te same zdjęcia po etapach (kolejność listy etapów), na końcu pozostałe; bez przypiętych — jedna grupa `null`. */
  photoGroups: HandoverPhotoGroup[];
  /** Zdjęcia, które się nie zmieściły. */
  morePhotos: number;
  /** Punkty w pomieszczeniach (H2.4); `null` = budowa bez punktów. */
  rooms: HandoverRoom[] | null;
  /** Gotowe punkty (po białym montażu) z wszystkich; `null` bez punktów. */
  pointsDone: { done: number; total: number } | null;
  /** P2.4: podpis klienta z karty (klucz obrazu, imię, moment); `null` = puste pole na podpis. */
  signature: SiteSignature | null;
}

export function buildHandover(
  journal: readonly JournalEntry[],
  site: Pick<SiteCard, "id" | "name" | "address" | "investor" | "stages" | "signature">,
  now: number = Date.now(),
  /** Pomieszczenia i punkty budowy (`pointsStore.ts`); brak = protokół bez sekcji punktów. */
  sitePoints?: { rooms: readonly Room[]; points: readonly WaterPoint[] },
): Handover {
  const entries = journal.filter((e) => entrySiteId(e) === site.id).sort((a, b) => a.at - b.at);
  // Najpierw zdjęcia przypięte do etapów (w kolejności etapów), potem reszta — limit wydruku tnie od końca.
  // Karta bez własnej listy ma domyślne etapy — wpis mógł zostać przypięty do jednego z nich.
  const stageList = siteStages(site);
  // Każde zdjęcie niesie czas swojego wpisu (wpisy są posortowane), żeby protokół mógł podpisać je datą.
  const shots = (list: readonly JournalEntry[]) => list.flatMap((e) => e.images.map((ref) => ({ ref, at: e.at })));
  const groups: { stage: string | null; shots: { ref: string; at: number }[] }[] = stageList
    .map((s) => ({ stage: s.name, shots: shots(entries.filter((e) => e.stage === s.id)) }))
    .filter((g) => g.shots.length > 0);
  const known = new Set(stageList.map((s) => s.id));
  const rest = shots(entries.filter((e) => !e.stage || !known.has(e.stage)));
  if (rest.length > 0) groups.push({ stage: null, shots: rest });
  const photos = groups.flatMap((g) => g.shots.map((x) => x.ref));
  let left = HANDOVER_PHOTOS_MAX;
  const photoGroups: HandoverPhotoGroup[] = groups
    .map((g) => {
      const taken = g.shots.slice(0, Math.max(0, left));
      left -= taken.length;
      return { stage: g.stage, photos: taken.map((x) => x.ref), dates: taken.map((x) => x.at) };
    })
    .filter((g) => g.photos.length > 0);
  const first = entries[0]?.at;
  const last = entries[entries.length - 1]?.at;
  return {
    site: site.name,
    address: site.address,
    investor: site.investor,
    period: first !== undefined && last !== undefined ? periodLabel(dayKeyOf(first), dayKeyOf(last)) : null,
    date: periodLabel(dayKeyOf(now), dayKeyOf(now)),
    stages: site.stages ? site.stages.map((s) => ({ ...s })) : null,
    tests: entries.filter((e) => e.test).map((e) => ({ at: e.at, line: testLine(e.test!), ok: e.test!.ok })),
    remarks: entries
      .filter((e) => e.kind === "problem" && e.resolved === undefined)
      .map((e) => ({ at: e.at, text: e.text.trim().split("\n")[0] || "bez opisu", owner: e.owner, due: e.due, photosBefore: e.images.length, photosAfter: e.after?.length ?? 0 })),
    photos: photos.slice(0, HANDOVER_PHOTOS_MAX),
    photoGroups,
    morePhotos: Math.max(0, photos.length - HANDOVER_PHOTOS_MAX),
    ...handoverPoints(entries, sitePoints),
    signature: site.signature ? { ...site.signature } : null,
  };
}

/** Sekcja punktów: pomieszczenia w kolejności karty, w nich punkty; zdjęcia liczone z wpisów z `point`. */
function handoverPoints(entries: readonly JournalEntry[], sp?: { rooms: readonly Room[]; points: readonly WaterPoint[] }): Pick<Handover, "rooms" | "pointsDone"> {
  if (!sp || sp.points.length === 0) return { rooms: null, pointsDone: null };
  const photos = new Map<string, number>();
  for (const e of entries) if (e.point) photos.set(e.point, (photos.get(e.point) ?? 0) + e.images.length);
  const rooms = sp.rooms
    .map((r) => ({
      name: r.name,
      points: sp.points.filter((p) => p.room === r.id).map((p) => ({
        label: pointType(p.type).label,
        sides: sidesLabel(p.sides),
        ...(p.height !== undefined ? { height: p.height } : {}),
        steps: POINT_STEPS.filter((s) => p.steps[s] !== undefined).map((s) => ({ label: STEP_LABEL[s], at: p.steps[s]! })),
        photos: photos.get(p.id) ?? 0,
      })),
    }))
    .filter((r) => r.points.length > 0);
  return { rooms, pointsDone: pointsProgress(sp.points) };
}

/** „Umywalka · Z C K · 58 cm — podejście 12.10.2026, próba 14.10.2026 · 2 zdj.” — linia punktu w tekście i PDF. */
export function handoverPointLine(p: HandoverPoint, date: (at: number) => string): string {
  const head = [p.label, p.sides, p.height !== undefined ? `${p.height} cm` : ""].filter(Boolean).join(" · ");
  const steps = p.steps.length ? p.steps.map((s) => `${s.label} ${date(s.at)}`).join(", ") : "do zrobienia";
  return `${head} — ${steps}${p.photos ? ` · ${p.photos} zdj.` : ""}`;
}

/** „Jan Kowalski” albo „inwestor”, gdy imienia nie wpisano. */
export const signerLabel = (s: Pick<SiteSignature, "name">) => s.name || "inwestor";

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Protokół jako tekst (do notatki albo wiadomości) — ta sama treść co wydruk, bez zdjęć. */
export function handoverText(h: Handover): string {
  const lines = [`# Protokół odbioru instalacji wod-kan — ${h.site}`, ""];
  if (h.address) lines.push(`Adres: ${h.address}`);
  if (h.investor) lines.push(`Inwestor: ${h.investor}`);
  if (h.period) lines.push(`Okres prac: ${h.period}`);
  lines.push(`Data protokołu: ${h.date}`);
  if (h.stages && h.stages.length > 0) {
    lines.push("", "## Zakres prac (etapy)");
    for (const s of h.stages) lines.push(s.done !== undefined ? `- [x] ${s.name} (${shortDate(s.done)})` : `- [ ] ${s.name}`);
  }
  if (h.rooms && h.pointsDone) {
    lines.push("", `## Punkty (${h.pointsDone.done}/${h.pointsDone.total} gotowe)`);
    for (const r of h.rooms) {
      lines.push(`### ${r.name}`);
      for (const p of r.points) lines.push(`- ${handoverPointLine(p, shortDate)}`);
    }
  }
  lines.push("", "## Próby szczelności");
  if (h.tests.length === 0) lines.push("Brak protokołów prób w dzienniku.");
  for (const t of h.tests) lines.push(`- ${shortDate(t.at)} ${t.line}`);
  lines.push("", "## Uwagi");
  if (h.remarks.length === 0) lines.push("Brak uwag — wszystkie zgłoszone problemy rozwiązane.");
  for (const r of h.remarks) {
    const meta = [r.owner ? `odpowiedzialny: ${r.owner}` : null, r.due ? `termin: ${r.due.split("-").reverse().join(".")}` : null, r.photosAfter ? `po naprawie: ${r.photosAfter} zdj.` : null].filter(Boolean);
    lines.push(`- ${shortDate(r.at)} ${r.text}${meta.length ? ` (${meta.join(", ")})` : ""}`);
  }
  if (h.photos.length > 0) {
    const byStage = h.photoGroups.filter((g) => g.stage).map((g) => `${g.stage}: ${g.photos.length}`);
    lines.push("", `Dokumentacja zdjęciowa: ${h.photos.length + h.morePhotos} zdjęć${byStage.length ? ` (${byStage.join(", ")})` : ""}.`);
  }
  // Sam fakt podpisu — obraz podpisu nie wychodzi w tekście (dane osobowe, wiadomość idzie dalej).
  if (h.signature) lines.push("", `Odbiór podpisał: ${signerLabel(h.signature)}, ${shortDate(h.signature.at)}`);
  return lines.join("\n");
}
