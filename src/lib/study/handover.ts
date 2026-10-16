import { entrySiteId, type SiteCard } from "./sites";
import { testLine } from "./pressureTest";
import { dayKeyOf, periodLabel } from "./report";
import { siteStages, type SiteStage } from "./stages";
import type { JournalEntry } from "./yStudy";

/**
 * Protokół odbioru dla inwestora — jedna kartka na koniec budowy: dane budowy, etapy z datami,
 * próby szczelności z wpisów, uwagi (otwarte problemy), zdjęcia i miejsca na podpisy.
 * Czysta funkcja; wydruk (PDF przez „Zapisz jako PDF”) w `HandoverPrint.tsx`.
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
}

/** Zdjęcia jednego etapu (wpisy przypięte do etapu) albo pozostałe (`stage: null`). */
export interface HandoverPhotoGroup {
  stage: string | null;
  photos: string[];
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
}

export function buildHandover(
  journal: readonly JournalEntry[],
  site: Pick<SiteCard, "id" | "name" | "address" | "investor" | "stages">,
  now: number = Date.now(),
): Handover {
  const entries = journal.filter((e) => entrySiteId(e) === site.id).sort((a, b) => a.at - b.at);
  // Najpierw zdjęcia przypięte do etapów (w kolejności etapów), potem reszta — limit wydruku tnie od końca.
  // Karta bez własnej listy ma domyślne etapy — wpis mógł zostać przypięty do jednego z nich.
  const stageList = siteStages(site);
  const groups: HandoverPhotoGroup[] = stageList
    .map((s) => ({ stage: s.name, photos: entries.filter((e) => e.stage === s.id).flatMap((e) => e.images) }))
    .filter((g) => g.photos.length > 0);
  const known = new Set(stageList.map((s) => s.id));
  const rest = entries.filter((e) => !e.stage || !known.has(e.stage)).flatMap((e) => e.images);
  if (rest.length > 0) groups.push({ stage: null, photos: rest });
  const photos = groups.flatMap((g) => g.photos);
  let left = HANDOVER_PHOTOS_MAX;
  const photoGroups = groups
    .map((g) => { const taken = g.photos.slice(0, Math.max(0, left)); left -= taken.length; return { stage: g.stage, photos: taken }; })
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
      .map((e) => ({ at: e.at, text: e.text.trim().split("\n")[0] || "bez opisu" })),
    photos: photos.slice(0, HANDOVER_PHOTOS_MAX),
    photoGroups,
    morePhotos: Math.max(0, photos.length - HANDOVER_PHOTOS_MAX),
  };
}

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
  lines.push("", "## Próby szczelności");
  if (h.tests.length === 0) lines.push("Brak protokołów prób w dzienniku.");
  for (const t of h.tests) lines.push(`- ${shortDate(t.at)} ${t.line}`);
  lines.push("", "## Uwagi");
  if (h.remarks.length === 0) lines.push("Brak uwag — wszystkie zgłoszone problemy rozwiązane.");
  for (const r of h.remarks) lines.push(`- ${shortDate(r.at)} ${r.text}`);
  if (h.photos.length > 0) {
    const byStage = h.photoGroups.filter((g) => g.stage).map((g) => `${g.stage}: ${g.photos.length}`);
    lines.push("", `Dokumentacja zdjęciowa: ${h.photos.length + h.morePhotos} zdjęć${byStage.length ? ` (${byStage.join(", ")})` : ""}.`);
  }
  return lines.join("\n");
}
