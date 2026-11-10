/**
 * Sekcje karty budowy (plan Pracy na budowie, B2.2): zamiast kilkunastu paneli pod sobą — pięć segmentów.
 * Dziś (etapy, plan, usterki, godziny) · Materiał (braki, zużycie, zamówienie) · Punkty · Pieniądze · Papiery
 * (dane, odbiorcy, dokumenty, serwis, protokół, paczki). Czysta logika; widok w `SiteCardDialog`.
 */
export const CARD_SECTIONS = ["dzis", "material", "punkty", "pieniadze", "papiery"] as const;
export type CardSection = (typeof CARD_SECTIONS)[number];

export const SECTION_LABEL: Record<CardSection, string> = {
  dzis: "Dziś", material: "Materiał", punkty: "Punkty", pieniadze: "Pieniądze", papiery: "Papiery",
};

export const isCardSection = (v: unknown): v is CardSection => typeof v === "string" && (CARD_SECTIONS as readonly string[]).includes(v);

/** Segment, w którym leży panel z paska liczników (`data-testid` panelu). */
export function sectionOfPanel(panelId: string): CardSection | null {
  switch (panelId) {
    case "site-stages": case "site-plan": case "site-faults": case "site-time": return "dzis";
    case "site-shortages": case "site-material": case "site-order": return "material";
    case "site-points": return "punkty";
    case "site-billing": return "pieniadze";
    default: return null;
  }
}

/** Fucha rozlicza się wyceną (panel zlecenia), więc nie ma segmentu „Pieniądze”. */
export const visibleSections = (isJob: boolean): CardSection[] => CARD_SECTIONS.filter((s) => !(isJob && s === "pieniadze"));

// Ostatni segment per budowa, w tej sesji: powrót do karty zaczyna tam, gdzie skończyłeś (nie w localStorage —
// to wygoda, nie dane). Żądanie z zewnątrz (`requestCardSection`) wygrywa raz.
const memory = new Map<string, CardSection>();
let requested: CardSection | null = null;

export const rememberSection = (siteId: string, section: CardSection): void => { memory.set(siteId, section); };
export const requestCardSection = (section: CardSection): void => { requested = section; };

/** Segment startowy karty: jednorazowe żądanie, potem zapamiętany, potem „Dziś”. Zawsze z listy widocznych. */
export function startSection(siteId: string, visible: readonly CardSection[]): CardSection {
  const want = requested ?? memory.get(siteId) ?? "dzis";
  requested = null;
  return visible.includes(want) ? want : "dzis";
}

export function resetCardSectionsForTests(): void { memory.clear(); requested = null; }
