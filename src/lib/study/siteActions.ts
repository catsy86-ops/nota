import { yStudy } from "./data";
import { cleanGeo, type GeoPoint } from "./geo";
import { cleanSite, SITE_NAME_MAX, type SiteCard, type SiteInfo } from "./sites";
import { cleanStages, type SiteStage } from "./stages";
import { cleanShortages, logOrder, markMissingOrdered, type OrderLogEntry, type Shortage } from "./shortages";
import { siteOrder } from "./order";
import { cleanSiteHours, type SiteHours } from "./siteHours";
import { cleanSiteDocs, type SiteDoc } from "./siteDocs";
import { cleanServiceCalls, type ServiceCall } from "./service";
import { cleanPlanItems, type PlanItem } from "./planItems";
import { SITE_MAX, type StudyState } from "./yStudy";
import { getStudy, siteDirectoryOf } from "./studyProjection";

/** Akcje kart budów (H0.2, z `store.ts`): dane karty, listy (etapy, braki, zamówienia, godziny, dokumenty, serwis, plan) i pola. */

export function setSite(site: string) {
  yStudy.setSite(site.slice(0, SITE_MAX));
}

export interface SiteCardInput {
  name: string;
  address: string;
  investor: string;
  phone?: string;
  manager?: string;
  managerPhone?: string;
  supplierPhone?: string;
  access?: string;
}

/**
 * Zapisuje kartę budowy (też budowy znanej tylko z nazw we wpisach — wtedy karta powstaje).
 * Pusta nazwa → `false`, nic się nie zmienia.
 */
/** Karta budowy o tym id wraz z jej listami (z dziennika, gdy karty nie ma). */
function findSite(s: StudyState, id: string) {
  return siteDirectoryOf(s).find((x) => x.id === id);
}

export function saveSiteCard(id: string, input: SiteCardInput, now: number = Date.now()): boolean {
  const name = input.name.trim().slice(0, SITE_NAME_MAX);
  if (!name) return false;
  const s = getStudy();
  const prev = findSite(s, id);
  // Reszta karty (archiwum, zamówienia, etapy, braki…) zostaje — edycja zmienia tylko pola formularza.
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, phone: _p, manager: _m, managerPhone: _mp, supplierPhone: _sp, access: _a, ...rest } =
    prev ?? ({} as Partial<SiteInfo>);
  // Pola kontaktu z formularza; pole pominięte w `input` zostaje takie, jak było.
  const keep = (k: "phone" | "manager" | "managerPhone" | "supplierPhone" | "access") => input[k] ?? prev?.[k];
  const card = cleanSite({
    ...rest,
    id, name,
    address: input.address,
    investor: input.investor,
    phone: keep("phone"), manager: keep("manager"), managerPhone: keep("managerPhone"), access: keep("access"),
    created: prev?.created ?? now,
  });
  if (!card) return false;
  // `cleanSite` przepuszcza listy karty tylko w znanym kształcie — zostają takie, jak były.
  yStudy.saveSite({ ...rest, ...card, id }, prev?.name);
  return true;
}

/**
 * Zmienia pola karty budowy, zachowując resztę. Budowa znana tylko z nazw we wpisach dostaje
 * przy tym kartę w dokumencie. Nieznana budowa — nic.
 */
function patchSiteCard(id: string, patch: Partial<Pick<SiteCard, "orderedAt">>) {
  const s = getStudy();
  const prev = findSite(s, id);
  if (!prev) return;
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, ...card } = prev;
  const next: SiteCard = { ...card, ...patch };
  // `orderedAt: undefined` (cofnięcie pierwszego zamówienia) zdejmuje pole, zamiast zapisywać pusty klucz.
  if ("orderedAt" in patch && patch.orderedAt === undefined) delete next.orderedAt;
  yStudy.saveSite(next);
}

/**
 * Lista karty budowy przed zmianą — punkt wyjścia zapisu różnicy (`yStudy.setSiteList`). Lista jeszcze
 * nie zapisana (np. domyślne etapy) to pusta baza: wtedy zapisują się wszystkie pozycje, nie tylko zmienione.
 * Budowa znana tylko z nazw we wpisach dostaje przy tym kartę w dokumencie.
 */
function siteListBase<T>(id: string, field: "stages" | "shortages" | "orders" | "hours" | "docs" | "service" | "plan", uiBase: readonly T[] | undefined): readonly T[] | null {
  const s = getStudy();
  const prev = findSite(s, id);
  if (!prev) return null;
  if (!prev.stored) patchSiteCard(id, {});
  const stored = prev[field] as T[] | undefined;
  if (stored === undefined) return [];
  return uiBase ?? stored;
}

/** Zaznacza zamówienie kształtek na teraz: od tej chwili lista „do zamówienia” zaczyna się od zera. */
/** Stan sprzed „Oznacz jako zamówione” — do „Cofnij” w toaście (`undoSiteOrdered`). */
export interface SiteOrderUndo {
  id: string;
  orderedAt?: number;
  ordersBefore: OrderLogEntry[];
  ordersAfter: OrderLogEntry[];
  shortagesBefore: Shortage[];
  shortagesAfter: Shortage[];
}

/**
 * Zaznacza zamówienie na teraz: od tej chwili lista „do zamówienia” zaczyna się od zera, kształtki idą do
 * historii, a braki „Brakuje” przechodzą na „Zamówione” (1.7). Zwraca stan do cofnięcia.
 */
export function markSiteOrdered(id: string, now: number = Date.now()): SiteOrderUndo | null {
  const s = getStudy();
  const prev = findSite(s, id);
  if (!prev) return null;
  // Co właśnie zamówiono — do historii zamówień w karcie.
  const items = siteOrder(s.journal, id, prev.orderedAt).items;
  const ordersBefore = prev.orders ?? [];
  const ordersAfter = logOrder(prev.orders, items, now);
  const shortagesBefore = prev.shortages ?? [];
  const shortagesAfter = markMissingOrdered(shortagesBefore, now);
  patchSiteCard(id, { orderedAt: now });
  const base = siteListBase<OrderLogEntry>(id, "orders", undefined) ?? [];
  yStudy.setSiteList(id, "order", ordersAfter, base);
  if (shortagesBefore.some((x) => x.status === "missing")) setSiteShortages(id, shortagesAfter, shortagesBefore);
  return { id, ...(prev.orderedAt !== undefined ? { orderedAt: prev.orderedAt } : {}), ordersBefore, ordersAfter, shortagesBefore, shortagesAfter };
}

/** „Cofnij” po zamówieniu: poprzednia data zamówienia, historia i statusy braków (zapis różnicy — zmiany z drugiego telefonu w innych pozycjach zostają). */
export function undoSiteOrdered(u: SiteOrderUndo) {
  patchSiteCard(u.id, { orderedAt: u.orderedAt });
  yStudy.setSiteList(u.id, "order", u.ordersBefore, u.ordersAfter);
  if (u.shortagesBefore.some((x) => x.status === "missing")) setSiteShortages(u.id, u.shortagesBefore, u.shortagesAfter);
}

/**
 * Lista braków materiału po zmianie (dopisanie, status, usunięcie). `base` — lista, od której zaczął
 * użytkownik (z ekranu); zapisuje się tylko różnica, więc zmiany z drugiego telefonu nie giną.
 */
export function setSiteShortages(id: string, shortages: Shortage[], base?: readonly Shortage[]) {
  const from = siteListBase(id, "shortages", base);
  if (from === null) return;
  yStudy.setSiteList(id, "short", cleanShortages(shortages) ?? [], from);
}

/** Lista etapów budowy po zmianie (odhaczenie, dodanie, usunięcie); `base` jak przy brakach. */
export function setSiteStages(id: string, stages: SiteStage[], base?: readonly SiteStage[]) {
  const from = siteListBase(id, "stages", base);
  if (from === null) return;
  yStudy.setSiteList(id, "stage", cleanStages(stages) ?? [], from);
}

/**
 * Podział godzin dnia `day` między budowy (minuty; 0 = bez godzin na tej budowie). Każda budowa
 * zmienia tylko pozycję tego dnia — inne dni i zmiany z drugiego telefonu zostają.
 */
export function setDayHours(day: string, minutes: Readonly<Record<string, number>>) {
  for (const [id, min] of Object.entries(minutes)) {
    const from = siteListBase<SiteHours>(id, "hours", undefined);
    if (from === null) continue;
    const others = from.filter((h) => h.id !== day);
    const next = min > 0 ? [...others, { id: day, minutes: min }] : others;
    yStudy.setSiteList(id, "hours", cleanSiteHours(next) ?? [], from);
  }
}

/** Plany i dokumenty budowy po zmianie (dodanie, usunięcie); `base` jak przy brakach. */
export function setSiteDocs(id: string, docs: SiteDoc[], base?: readonly SiteDoc[]) {
  const from = siteListBase(id, "docs", base);
  if (from === null) return;
  yStudy.setSiteList(id, "docs", cleanSiteDocs(docs) ?? [], from);
}

/** Zgłoszenia serwisowe po zmianie (dodanie, zamknięcie, usunięcie); `base` jak przy brakach. */
/** Plan na dziś budowy (P-5): cała lista, zapis per pozycja (`todo`). */
export function setSitePlan(id: string, items: readonly PlanItem[], base?: readonly PlanItem[]) {
  const from = siteListBase(id, "plan", base);
  if (from === null) return;
  yStudy.setSiteList(id, "todo", cleanPlanItems(items), from);
}

export function setSiteService(id: string, calls: ServiceCall[], base?: readonly ServiceCall[]) {
  const from = siteListBase(id, "service", base);
  if (from === null) return;
  yStudy.setSiteList(id, "service", cleanServiceCalls(calls) ?? [], from);
}

/** Koniec gwarancji („2028-10-16”) albo `null` — bez gwarancji. */
export function setSiteWarranty(id: string, warranty: string | null) {
  const s = getStudy();
  const prev = findSite(s, id);
  if (!prev) return;
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, warranty: _w, ...card } = prev;
  yStudy.saveSite(warranty ? { ...card, warranty } : card);
}

/** Lokalizacja budowy zapisana na miejscu („Zapisz lokalizację budowy”); `null` usuwa. */
/** P2.8: stawka godzinowa budowy (zł/h); `null` albo 0 usuwa stawkę. */
export function setSiteRate(id: string, rate: number | null) {
  const s = getStudy();
  const prev = findSite(s, id);
  if (!prev) return;
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, rate: _r, ...card } = prev;
  yStudy.saveSite(rate && rate > 0 ? { ...card, rate } : card);
}

export function setSiteGeo(id: string, geo: GeoPoint | null) {
  const s = getStudy();
  const prev = findSite(s, id);
  if (!prev) return;
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, geo: _g, ...card } = prev;
  const clean = cleanGeo(geo);
  yStudy.saveSite(clean ? { ...card, geo: clean } : card);
}

/** Budowa do archiwum (`true`) albo z powrotem czynna. */
export function setSiteArchived(id: string, archived: boolean, now: number = Date.now()) {
  const s = getStudy();
  const prev = findSite(s, id);
  if (!prev) return;
  const { archived: _, stored: _s, count: _c, open: _o, first: _f, last: _l, ...card } = prev;
  yStudy.saveSite(archived ? { ...card, archived: now } : card);
}
