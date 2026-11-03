import { addAttachmentFiles, type Attachment, type AddAttachmentsResult } from "@/lib/attachments";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore, type ImageStore } from "@/lib/imageStore";

/**
 * Odbiór udostępnień z plikami (Web Share Target, POST). Zapis po stronie
 * service workera jest w `public/sw-share.js` — klucze i nazwa cache muszą
 * się zgadzać. Tu: odczyt wpisu, kasowanie go i rozdzielenie plików na
 * obrazy (→ `imageStore`, jak w pasku dodawania) i załączniki (PDF → `addAttachmentFiles`).
 */

export const SHARE_INBOX_CACHE = "share-inbox-v1";
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Więcej plików w jednym udostępnieniu niż to nie ma sensu — obrona przed zapchaniem cache. */
const MAX_SHARE_FILES = 30;

export interface SharedInbox {
  /** Pola tekstowe w formie adresu, żeby przejść przez `parseShare` jak zwykłe udostępnienie. */
  query: string;
  files: File[];
  /** Pliki, które service worker pominął (ponad 30 albo za duże) — do komunikatu. */
  skipped: number;
}

interface Meta { title?: unknown; text?: unknown; url?: unknown; files?: unknown; skipped?: unknown }

/** Wpis starszy niż to został porzucony (błąd odbioru, zamknięta karta) — `sweepShareInbox` go kasuje. */
const STALE_MS = 60 * 60_000;

/**
 * Sprząta `share-inbox-v1`: kasuje wpisy starsze niż godzina albo bez znacznika `x-at`
 * (sprzed limitu w SW). Świeże zostają, bo mogą właśnie czekać na odbiór w innej karcie.
 * Zwraca liczbę skasowanych wpisów.
 */
export async function sweepShareInbox(openCache: (name: string) => Promise<Cache> = (n) => caches.open(n), now = Date.now()): Promise<number> {
  let removed = 0;
  try {
    const cache = await openCache(SHARE_INBOX_CACHE);
    for (const req of await cache.keys()) {
      const at = Number((await cache.match(req))?.headers.get("x-at"));
      if (at > 0 && now - at < STALE_MS) continue;
      if (await cache.delete(req)) removed++;
    }
  } catch {
    // Cache Storage niedostępny albo zamknięty w trakcie — sprzątanie spróbuje przy następnym starcie.
  }
  return removed;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Odbiera udostępnienie `id` i kasuje jego wpisy. `null`, gdy wpisu nie ma
 * (odświeżenie po odebraniu, błąd zapisu w SW) albo cache jest niedostępny.
 */
export async function takeShareInbox(id: string, openCache: (name: string) => Promise<Cache> = (n) => caches.open(n)): Promise<SharedInbox | null> {
  if (!ID_RE.test(id)) return null;
  let cache: Cache;
  try {
    cache = await openCache(SHARE_INBOX_CACHE);
  } catch {
    return null;
  }
  const base = `/share-inbox/${id}`;
  const metaRes = await cache.match(`${base}/meta`);
  if (!metaRes) return null;
  let meta: Meta;
  try {
    meta = (await metaRes.json()) as Meta;
  } catch {
    meta = {};
  }
  const count = typeof meta.files === "number" ? Math.min(Math.max(0, Math.floor(meta.files)), MAX_SHARE_FILES) : 0;

  const files: File[] = [];
  for (let i = 0; i < count; i++) {
    const res = await cache.match(`${base}/f${i}`);
    if (!res) continue;
    const blob = await res.blob();
    let name = "plik";
    try { name = decodeURIComponent(res.headers.get("x-name") ?? "") || name; } catch { /* zła koduje nazwa — zostaje domyślna */ }
    files.push(new File([blob], name, { type: res.headers.get("content-type") ?? "" }));
  }

  // Kasujemy zawsze — także gdy plików brakuje, żeby wpis nie wisiał w cache.
  await Promise.all([
    cache.delete(`${base}/meta`),
    ...Array.from({ length: count }, (_, i) => cache.delete(`${base}/f${i}`)),
  ]);

  const params = new URLSearchParams();
  const title = str(meta.title);
  const text = str(meta.text);
  const url = str(meta.url);
  if (title) params.set("title", title);
  if (text) params.set("text", text);
  if (url) params.set("url", url);
  const skipped = typeof meta.skipped === "number" && meta.skipped > 0 ? Math.floor(meta.skipped) : 0;
  return { query: params.toString() ? `?${params}` : "", files, skipped };
}

export interface ImportedFiles {
  images: string[];
  attachments: Attachment[];
  /** Pliki, których nie wolno przyjąć (inny typ niż obraz i PDF), nazwy. */
  unsupported: string[];
  /** Obrazy, których nie udało się zmniejszyć do limitu. */
  skippedImages: number;
  /** Odrzucone załączniki (limit, duplikat, quota) — do komunikatu. */
  rejected: AddAttachmentsResult["rejected"];
}

export function isShareableImage(type: string): boolean {
  return type.startsWith("image/");
}

export function isShareableAttachment(type: string): boolean {
  return type === "application/pdf";
}

/**
 * Rozdziela udostępnione pliki: obrazy przechodzą przez `prepareImage` i
 * `imageStore` (jak w pasku dodawania), PDF jako załącznik. `used` to
 * rozmiary załączników już obecnych w aplikacji — do limitu łącznego.
 */
export async function importSharedFiles(files: File[], used: Map<string, number>, store: ImageStore = imageStore): Promise<ImportedFiles> {
  const images: string[] = [];
  const attachFiles: File[] = [];
  const unsupported: string[] = [];
  let skippedImages = 0;

  for (const file of files) {
    if (isShareableAttachment(file.type)) {
      attachFiles.push(file);
    } else if (isShareableImage(file.type)) {
      const prepared = await prepareImage(file);
      if (!prepared) { skippedImages++; continue; }
      images.push(await store.putBlob(prepared));
    } else {
      unsupported.push(file.name || "plik");
    }
  }

  const { added, rejected } = attachFiles.length
    ? await addAttachmentFiles(attachFiles, { current: [], used, store })
    : { added: [], rejected: [] };
  return { images, attachments: added, unsupported, skippedImages, rejected };
}
