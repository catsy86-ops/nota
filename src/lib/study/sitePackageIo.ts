import { imageStore, isImageRef, sha256Hex } from "@/lib/imageStore";
import { yjsStore } from "@/lib/yjsStore";
import { sniffImage } from "@/lib/plans/imageSniff";
import { canCompress, compressBudowa, COMPRESS_MIN_BYTES, decompressBudowa } from "./budowaCompression";
import { currentAuthor } from "./companyPrefs";
import { entrySiteId, findSiteByName, siteKey, type SiteInfo } from "./sites";
import { getStudy, restoreJournalEntry, saveSiteCard, setSitePlan, setSiteShortages, setSiteStages, siteDirectoryOf } from "./store";
import type { JournalEntry } from "./journalEntry";
import { getSitePoints, restoreRoom, savePoint } from "./pointsStore";
import {
  buildSitePackage, collisionName, packageImageRefs, parseSitePackage, planImport, SITE_PACKAGE_IMAGE_BYTES, SITE_PACKAGE_MAX_BYTES,
  sitePackageName, type ImportPlan, type ParseResult, type SitePackage,
} from "./sitePackage";

/**
 * H5.2 Paczka budowy — zapis i odczyt na danych. Eksport: zdjęcia kodowane od nowa przez canvas (bez EXIF,
 * czyli bez GPS z aparatu). Import (przegląd `security-reviewer` 2026-11-02): obraz rozpoznany po bajtach
 * (`sniffImage`: tylko JPEG/PNG/WebP do 40 MP i 2 MB), zgodny z kluczem (SHA-256, `putBytes`), budowę
 * docelową wybiera użytkownik, najpierw zdjęcia, potem karta (gdy nowa) i dane w jednej transakcji Yjs.
 */

const IMAGE_PIXELS_MAX = 40_000_000;

/** Zdjęcie bez metadanych: dekodowanie i ponowne kodowanie (JPEG 0,9; PNG zostaje PNG). */
async function reencode(blob: Blob): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0);
    bmp.close();
    const type = blob.type === "image/png" ? "image/png" : "image/jpeg";
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, 0.9));
  } catch {
    return null;
  }
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/**
 * Plik `.budowa` dla budowy `siteId`. `images` dokłada zdjęcia wpisów (bez EXIF); po ponownym kodowaniu
 * zdjęcie ma nowy klucz, więc wpisy w paczce wskazują na nowe klucze. `access` — kod do bramy, klucze.
 */
/**
 * Wpis do paczki ze zdjęciami pod nowymi kluczami (kopia bez EXIF ma inny hash): `images`, `after`, podpisy i wymiary
 * (W3) przechodzą na nowe klucze, a wszystko, czego zdjęcia nie trafiły do paczki, odpada. Pusta mapa = paczka bez zdjęć.
 */
export function remapEntryImages(e: JournalEntry, renamed: ReadonlyMap<string, string>): JournalEntry {
  const { captions, dimensions, after, ...rest } = e;
  const list = (refs: readonly string[]) => refs.filter((r) => renamed.has(r)).map((r) => renamed.get(r)!);
  const rekey = <T,>(rec: Record<string, T> | undefined): Record<string, T> | undefined => {
    if (!rec) return undefined;
    const out = Object.fromEntries(Object.entries(rec).filter(([r]) => renamed.has(r)).map(([r, v]) => [renamed.get(r)!, v]));
    return Object.keys(out).length ? out : undefined;
  };
  const caps = rekey(captions);
  const dims = rekey(dimensions);
  const afterList = after ? list(after) : [];
  return {
    ...rest,
    images: list(e.images),
    ...(afterList.length ? { after: afterList } : {}),
    ...(caps ? { captions: caps } : {}),
    ...(dims ? { dimensions: dims } : {}),
  };
}

export async function exportSitePackage(siteId: string, opts: { images: boolean; access: boolean }): Promise<{ file: File; entries: number; images: number; missingImages: number; compressed: boolean }> {
  const s = getStudy();
  const card = siteDirectoryOf(s).find((x) => x.id === siteId);
  if (!card) throw new Error("Nie ma takiej budowy");
  const entries = s.journal.filter((e) => entrySiteId(e) === siteId);
  const { rooms, points } = getSitePoints(siteId);
  const pkg: SitePackage = buildSitePackage(card, { entries, rooms, points }, { by: currentAuthor(), now: Date.now(), access: opts.access });
  let images = 0, missingImages = 0;
  if (opts.images) {
    const out: Record<string, string> = {};
    const renamed = new Map<string, string>();
    for (const ref of packageImageRefs(pkg.entries)) {
      const rec = await imageStore.get(ref);
      const clean = rec ? await reencode(new Blob([rec.bytes], { type: rec.type })) : null;
      if (!clean || clean.size > SITE_PACKAGE_IMAGE_BYTES) { missingImages++; continue; }
      // Sam hash, bez zapisu: kopia bez EXIF jest tylko w pliku (inaczej każde wysłanie dubluje zdjęcia na urządzeniu).
      const hash = await sha256Hex(new Uint8Array(await clean.arrayBuffer()));
      renamed.set(ref, hash);
      out[hash] = await blobToDataUrl(clean);
      images++;
    }
    pkg.entries = pkg.entries.map((e) => remapEntryImages(e, renamed));
    pkg.images = out;
  } else {
    // Bez zdjęć: klucze zdjęć nie wychodzą z urządzenia (nic by nie wskazywały u odbiorcy).
    pkg.entries = pkg.entries.map((e) => remapEntryImages(e, new Map()));
  }
  const json = JSON.stringify(pkg);
  // Duża paczka (zdjęcia) idzie skompresowana; mała zostaje JSON-em, który czyta też starsza wersja aplikacji (B5.2).
  if (json.length > COMPRESS_MIN_BYTES && canCompress()) {
    try {
      const blob = await compressBudowa(json);
      return { file: new File([blob], sitePackageName(card.name), { type: "application/octet-stream" }), entries: entries.length, images, missingImages, compressed: true };
    } catch { /* bez kompresji: wysyłamy zwykły JSON */ }
  }
  const file = new File([json], sitePackageName(card.name), { type: "application/json" });
  return { file, entries: entries.length, images, missingImages, compressed: false };
}

/**
 * Czyta plik `.budowa` z dysku: rozmiar przed odczytem, rozpakowanie (jeśli plik jest skompresowany, z limitem
 * rozmiaru po rozpakowaniu), potem czyszczenie (`parseSitePackage`) — jedyna droga do danych z pliku.
 */
export async function readSitePackageFile(file: File): Promise<ParseResult> {
  if (file.size > SITE_PACKAGE_MAX_BYTES) return { ok: false, error: "Plik jest za duży (limit 40 MB)." };
  const text = await decompressBudowa(file);
  if (text === null) return { ok: false, error: "Nie udało się rozpakować pliku — jest uszkodzony albo po rozpakowaniu za duży." };
  return parseSitePackage(text, Date.now());
}

export interface ImportTarget { id: string; name: string; exists: boolean }

/**
 * Propozycje budowy docelowej: istniejąca o tym samym id i nazwie (domyślna), istniejąca o tej samej
 * nazwie albo id (do wyboru, nie po cichu) i zawsze „nowa budowa”. Id budowy wynika z nazwy, więc samo
 * id z pliku nie wystarcza do scalenia bez pytania.
 */
export function importTargets(pkg: SitePackage): { options: ImportTarget[]; preferred: number } {
  const all: SiteInfo[] = siteDirectoryOf(getStudy());
  const dir = all.filter((x) => x.stored);
  const byId = dir.find((x) => x.id === pkg.site.id);
  const byName = findSiteByName(dir, pkg.site.name);
  const options: ImportTarget[] = [];
  for (const s of [byId, byName]) if (s && !options.some((o) => o.id === s.id)) options.push({ id: s.id, name: s.name, exists: true });
  options.push(freeSite(all, pkg));
  const exact = byId && byId.name === pkg.site.name ? 0 : options.length - 1;
  return { options, preferred: exact };
}

/**
 * „Nowa budowa” z nazwą i id, których nie ma żadna budowa (także znana tylko z wpisów) — `saveSiteCard`
 * na zajętym id nadpisałby cudzą kartę. Kolejno: nazwa z pliku, „(od …)”, „(od …) 2”, „… 3”.
 */
function freeSite(all: readonly SiteInfo[], pkg: SitePackage): ImportTarget {
  const taken = (name: string) => all.some((x) => x.id === siteKey(name)) || !!findSiteByName(all, name);
  const base = collisionName(pkg.site.name, pkg.by);
  let name = taken(pkg.site.name) ? base : pkg.site.name;
  for (let n = 2; taken(name) && n < 100; n++) name = `${base} ${n}`;
  return { id: siteKey(name), name, exists: false };
}

/** Podgląd scalenia bez zapisu. */
export function previewSitePackage(pkg: SitePackage, target: ImportTarget): ImportPlan {
  const s = getStudy();
  const card = target.exists ? siteDirectoryOf(s).find((x) => x.id === target.id) : undefined;
  const { rooms, points } = target.exists ? getSitePoints(target.id) : { rooms: [], points: [] };
  return planImport(pkg, target, {
    journalIds: new Set(s.journal.map((e) => e.id)),
    stages: card?.stages ?? [],
    shortages: card?.shortages ?? [],
    plan: card?.plan ?? [],
    rooms,
    points,
    hasImage: (ref) => imageStore.has(ref),
  });
}

/** Bajty data URL; tylko base64 (inne kodowanie pliku → `null`). */
function base64Bytes(dataUrl: string): Uint8Array | null {
  const i = dataUrl.indexOf(";base64,");
  if (i < 0) return null;
  try {
    const bin = atob(dataUrl.slice(i + 8));
    const out = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
    return out;
  } catch {
    return null;
  }
}

/** Scala paczkę z wybraną budową: najpierw zdjęcia (sprawdzone), potem karta nowej budowy, potem dane w jednej transakcji Yjs. */
export async function applySitePackage(pkg: SitePackage, target: ImportTarget): Promise<{ counts: ImportPlan["counts"]; rejectedImages: number }> {
  const plan = previewSitePackage(pkg, target);
  let rejectedImages = 0;
  for (const ref of packageImageRefs(plan.entries)) {
    const url = pkg.images?.[ref];
    if (!url || !isImageRef(ref) || imageStore.has(ref)) continue;
    const bytes = base64Bytes(url);
    const sniffed = bytes && bytes.length <= SITE_PACKAGE_IMAGE_BYTES ? sniffImage(bytes.subarray(0, 64 * 1024)) : null;
    if (!bytes || !sniffed || sniffed.w * sniffed.h > IMAGE_PIXELS_MAX) { rejectedImages++; continue; }
    try { await imageStore.putBytes(bytes, sniffed.type, ref); } catch { rejectedImages++; }
  }
  // Nowa karta osobno: listy karty czytają projekcję (`getStudy`), która widzi kartę dopiero po transakcji.
  if (!target.exists) saveSiteCard(target.id, { name: target.name, address: pkg.site.address, investor: "", ...(pkg.site.access ? { access: pkg.site.access } : {}) });
  yjsStore.doc.transact(() => {
    const card = siteDirectoryOf(getStudy()).find((x) => x.id === target.id);
    if (plan.listsChanged.stages) setSiteStages(target.id, plan.stages, card?.stages ?? []);
    if (plan.listsChanged.shortages) setSiteShortages(target.id, plan.shortages, card?.shortages ?? []);
    if (plan.listsChanged.plan) setSitePlan(target.id, plan.plan, card?.plan ?? []);
    // Migawka punktów odświeża się dopiero po transakcji, więc `savePoint` nie widziałby pomieszczenia dodanego chwilę
    // wcześniej i po cichu odrzucał punkt (W1). Punkty nowych pomieszczeń idą razem z pomieszczeniem; reszta (pomieszczenia
    // już istniejące) pojedynczo.
    const newRooms = new Set(plan.rooms.map((r) => r.id));
    for (const room of plan.rooms) restoreRoom(target.id, { room, points: plan.points.filter((p) => p.room === room.id) });
    for (const p of plan.points) if (!newRooms.has(p.room)) savePoint(target.id, p);
    for (const e of plan.entries) restoreJournalEntry(e);
  });
  return { counts: plan.counts, rejectedImages };
}
