import { imageStore, isImageRef, sha256Hex } from "@/lib/imageStore";
import { yjsStore } from "@/lib/yjsStore";
import { sniffImage } from "@/lib/plans/imageSniff";
import { currentAuthor } from "./companyPrefs";
import { entrySiteId, findSiteByName, siteKey, type SiteInfo } from "./sites";
import { getStudy, restoreJournalEntry, saveSiteCard, setSitePlan, setSiteShortages, setSiteStages, siteDirectoryOf } from "./store";
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
export async function exportSitePackage(siteId: string, opts: { images: boolean; access: boolean }): Promise<{ file: File; entries: number; images: number; missingImages: number }> {
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
    const map = (list: readonly string[]) => list.filter((r) => renamed.has(r)).map((r) => renamed.get(r)!);
    pkg.entries = pkg.entries.map((e) => {
      const { captions, ...rest } = e;
      const caps = captions ? Object.fromEntries(Object.entries(captions).filter(([r]) => renamed.has(r)).map(([r, c]) => [renamed.get(r)!, c])) : undefined;
      return { ...rest, images: map(e.images), ...(e.after ? { after: map(e.after) } : {}), ...(caps && Object.keys(caps).length ? { captions: caps } : {}) };
    });
    pkg.images = out;
  } else {
    // Bez zdjęć: klucze zdjęć nie wychodzą z urządzenia (nic by nie wskazywały u odbiorcy).
    pkg.entries = pkg.entries.map((e) => { const { captions: _c, after: _a, ...rest } = e; return { ...rest, images: [] }; });
  }
  const file = new File([JSON.stringify(pkg)], sitePackageName(card.name), { type: "application/json" });
  return { file, entries: entries.length, images, missingImages };
}

/** Czyta plik `.budowa` z dysku: rozmiar przed odczytem, potem czyszczenie (`parseSitePackage`). */
export async function readSitePackageFile(file: File): Promise<ParseResult> {
  if (file.size > SITE_PACKAGE_MAX_BYTES) return { ok: false, error: "Plik jest za duży (limit 40 MB)." };
  return parseSitePackage(await file.text(), Date.now());
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
    for (const room of plan.rooms) restoreRoom(target.id, { room, points: [] });
    for (const p of plan.points) savePoint(target.id, p);
    for (const e of plan.entries) restoreJournalEntry(e);
  });
  return { counts: plan.counts, rejectedImages };
}
