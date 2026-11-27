import { createStore, get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, type UseStore } from "idb-keyval";
import { logDiag } from "@/lib/diagnostics";

/**
 * Content-addressed store obrazów: klucz = SHA-256 bajtów obrazu (hex),
 * wartość = bajty + typ MIME. `Note.images` to lista takich kluczy — ten sam
 * obraz w dwóch notatkach (duplikat, przywrócony backup) zajmuje miejsce raz,
 * a referencje w `Y.Doc` są małe i synchronizują się razem z notatką.
 *
 * Bajty jako `ArrayBuffer`, nie `Blob`: Blob w IndexedDB bywał zawodny
 * w Safari, a `ArrayBuffer` klonuje się wszędzie. Bez narzutu base64.
 *
 * Wpisy nie są kasowane przy usuwaniu notatki (cofnij, szkic w pasku
 * dodawania, notatka w drodze od peera) — sprząta `collectGarbage` przy
 * starcie, tylko nieużywane i starsze niż karencja.
 */

export interface StoredImage {
  bytes: ArrayBuffer;
  type: string;
  addedAt: number;
}

const REF_RE = /^[0-9a-f]{64}$/;

/** Czy napis to klucz tego store'a (a nie data URL czy stary hash FNV). */
export function isImageRef(s: string): boolean {
  return REF_RE.test(s);
}

export function isDataUrl(s: string): boolean {
  return s.startsWith("data:");
}

/** Bajty od peera większe niż to są odrzucane, zanim trafią na dysk (obrona przed zapchaniem IndexedDB). */
export const MAX_PEER_BLOB_BYTES = 20 * 1024 * 1024;

const MIME_RE = /^[a-z0-9][a-z0-9.+-]{0,60}\/[a-z0-9][a-z0-9.+-]{0,100}$/;

/**
 * Typ MIME trafia potem do `Blob`, do data URL-a w eksporcie HTML i do
 * atrybutów `src`. Z pliku/peera jest niezaufany: cokolwiek poza `typ/podtyp`
 * (cudzysłów, spacje, `;`, `,`) zamieniamy na typ binarny.
 */
export function safeMime(type: unknown): string {
  const t = typeof type === "string" ? type.trim().toLowerCase() : "";
  return MIME_RE.test(t) ? t : "application/octet-stream";
}

/** Data URL obrazu, który wolno osadzić w eksporcie (HTML/Markdown/PDF): tylko `image/*` w base64. */
export function isEmbeddableImageDataUrl(s: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]*={0,2}$/.test(s);
}

/**
 * Data URL (np. z `canvas.toDataURL`) → Blob bez `fetch`: egzekwowane CSP (`connect-src`) nie zezwala
 * na `fetch("data:…")` (Plan-nowy 1.11).
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const { bytes, type } = dataUrlToBytes(dataUrl);
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: string } {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) throw new Error("Nieprawidłowy data URL");
  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const type = safeMime(header.split(";")[0]);
  if (header.endsWith(";base64")) {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), type };
}

export function bytesToDataUrl(bytes: ArrayBuffer, type: string): string {
  const view = new Uint8Array(bytes);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) bin += String.fromCharCode(...view.subarray(i, i + CHUNK));
  return `data:${type};base64,${btoa(bin)}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Karencja GC: nieużywany obraz młodszy niż to zostaje (szkic, cofnij, sync w drodze). */
export const GC_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** Ponowne dodanie obrazu starszego niż to odnawia jego datę — karencja liczy się od ostatniego użycia. */
const TOUCH_REFRESH_MS = 24 * 60 * 60 * 1000;
/** Bezpiecznik odśmiecania: tylu kandydatów naraz, stanowiących ponad połowę magazynu, to raczej błąd listy używanych. */
const GC_SUSPICIOUS_MIN = 20;

type TabMessage = { t: "add" | "del"; hash: string };

export function createImageStore(dbName: string) {
  const db: UseStore = createStore(dbName, "images");
  /** Miniatury obok oryginałów (B5.5): osobna baza, więc oryginały i ich migracje zostają nietknięte. Dane pochodne —
   *  zawsze do odtworzenia z oryginału, dlatego bez kopii i bez synchronizacji. */
  const thumbDb: UseStore = createStore(`${dbName}-thumbs`, "thumbs");
  /** Klucze obecne na dysku — synchroniczne `has` dla projekcji i P2P. */
  const known = new Set<string>();
  let loadPromise: Promise<void> | null = null;
  const listeners = new Set<(hash: string) => void>();
  /** Zdjęcia dodane (lub dodane ponownie) od startu bieżącego odśmiecania — GC ich nie usuwa (W10). */
  let touched = new Set<string>();
  /** Usunięcia w toku: zapis tego samego hasha czeka, żeby nie uznać zdjęcia za obecne tuż przed jego skasowaniem. */
  const deleting = new Map<string, Promise<void>>();
  const urls = new Map<string, { url: string; refs: number }>();
  const pendingUrls = new Map<string, Promise<string | null>>();

  /**
   * Inne karty tej przeglądarki mają tę samą bazę, ale własne `known`. Bez tego kanału obraz pobrany
   * przez kartę prowadzącą przekaźnik byłby w pozostałych „nieobecny” do przeładowania, a plik
   * odśmiecony w jednej karcie — „obecny” w drugiej.
   */
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(`kaczy-images:${dbName}`);
      // Node (testy): otwarty kanał nie może trzymać procesu.
      (channel as { unref?: () => void }).unref?.();
      channel.onmessage = (e: MessageEvent<TabMessage>) => {
        const m = e.data;
        if (!m || typeof m.hash !== "string" || !isImageRef(m.hash)) return;
        if (m.t === "add") {
          touched.add(m.hash);
          if (known.has(m.hash)) return;
          known.add(m.hash);
          listeners.forEach((l) => l(m.hash));
        } else if (m.t === "del") {
          known.delete(m.hash);
        }
      };
    }
  } catch { /* bez kanału każda karta zna tylko własne zapisy — jak dawniej */ }
  const announce = (m: TabMessage) => {
    try { channel?.postMessage(m); } catch { /* kanał zamknięty */ }
  };

  function load(): Promise<void> {
    if (!loadPromise) {
      loadPromise = idbKeys(db)
        .then((ks) => { for (const k of ks) if (typeof k === "string") known.add(k); })
        .catch((err) => { logDiag("error", "imageStore", "cannot list images", err); });
    }
    return loadPromise;
  }

  function has(hash: string): boolean {
    return known.has(hash);
  }

  /**
   * Zapisuje bajty, zwraca klucz. Idempotentne — ten sam obraz drugi raz nic nie pisze.
   * `expected` (bajty od peera): niezgodny hash = odrzucenie, nic nie trafia na dysk.
   */
  async function putBytes(bytes: Uint8Array, type: string, expected?: string): Promise<string> {
    await load();
    type = safeMime(type);
    if (expected !== undefined && bytes.length > MAX_PEER_BLOB_BYTES) throw new Error("Obraz od peera jest zbyt duży");
    const hash = await sha256Hex(bytes);
    if (expected !== undefined && hash !== expected) throw new Error("Obraz nie pasuje do swojego hasha");
    touched.add(hash);
    await deleting.get(hash);
    let fresh = true;
    if (known.has(hash)) {
      // „Znany” to stan tej karty: inna mogła plik odśmiecić, a stary sierota (np. po usuniętej notatce)
      // dodany ponownie do szkicu ma karencję liczoną od pierwszego zapisu. Brak → zapis od nowa;
      // stary → nowa data, żeby odśmiecanie go nie zabrało, zanim trafi do notatki.
      let rec: StoredImage | undefined;
      try { rec = await idbGet<StoredImage>(hash, db); }
      catch { return hash; }
      if (rec && Date.now() - rec.addedAt < TOUCH_REFRESH_MS) return hash;
      fresh = !rec;
    }
    const value: StoredImage = { bytes: bytes.slice().buffer, type, addedAt: Date.now() };
    await idbSet(hash, value, db);
    known.add(hash);
    if (fresh) {
      listeners.forEach((l) => l(hash));
      announce({ t: "add", hash });
    }
    return hash;
  }

  function putDataUrl(dataUrl: string): Promise<string> {
    const { bytes, type } = dataUrlToBytes(dataUrl);
    return putBytes(bytes, type);
  }

  async function putBlob(blob: Blob): Promise<string> {
    return putBytes(new Uint8Array(await blob.arrayBuffer()), blob.type || "application/octet-stream");
  }

  /**
   * Zamienia data URL-e na klucze, resztę (klucze, stare hashe FNV) zostawia.
   * Granica dla wszystkiego, co przychodzi z zewnątrz: backup, import, plik sync.
   * Uszkodzony data URL jest pomijany; błąd zapisu (np. brak miejsca) leci
   * dalej — wołający przerywa, zanim cokolwiek nadpisze.
   */
  async function ingest(images: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const img of images) {
      if (!isDataUrl(img)) { out.push(img); continue; }
      let parsed: ReturnType<typeof dataUrlToBytes>;
      try { parsed = dataUrlToBytes(img); }
      catch (err) { logDiag("warn", "imageStore", "skipping malformed image", err); continue; }
      out.push(await putBytes(parsed.bytes, parsed.type));
    }
    return out;
  }

  async function getRecord(hash: string): Promise<StoredImage | undefined> {
    if (!known.has(hash)) await load();
    try { return await idbGet<StoredImage>(hash, db); }
    catch (err) { logDiag("error", "imageStore", "cannot read image", err); return undefined; }
  }

  async function getDataUrl(hash: string): Promise<string | undefined> {
    const rec = await getRecord(hash);
    return rec ? bytesToDataUrl(rec.bytes, rec.type) : undefined;
  }

  /** Klucze → data URL-e (eksporty, backup). Brakujących obrazów nie da się
   *  osadzić — zostają jako klucz, żeby referencja nie zginęła. */
  async function resolve(images: string[]): Promise<string[]> {
    return Promise.all(images.map(async (img) => (isImageRef(img) ? (await getDataUrl(img)) ?? img : img)));
  }

  /**
   * Object URL współdzielony przez wszystkie miejsca pokazujące ten obraz,
   * zwalniany, gdy ostatnie przestanie. `null` = obrazu nie ma na tym urządzeniu.
   */
  async function acquireUrl(hash: string): Promise<string | null> {
    const cached = urls.get(hash);
    if (cached) { cached.refs++; return cached.url; }
    let pending = pendingUrls.get(hash);
    if (!pending) {
      pending = getRecord(hash).then((rec) => {
        pendingUrls.delete(hash);
        if (!rec) return null;
        const url = URL.createObjectURL(new Blob([rec.bytes], { type: rec.type }));
        urls.set(hash, { url, refs: 0 });
        return url;
      });
      pendingUrls.set(hash, pending);
    }
    const url = await pending;
    const entry = urls.get(hash);
    if (url && entry) entry.refs++;
    return url;
  }

  function releaseKey(key: string): void {
    const entry = urls.get(key);
    if (!entry) return;
    entry.refs--;
    if (entry.refs <= 0) {
      urls.delete(key);
      URL.revokeObjectURL(entry.url);
    }
  }

  const releaseUrl = releaseKey;

  /** Powiadamia, gdy obraz pojawi się w store (np. dociągnięty od peera). */
  function onAdded(listener: (hash: string) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  /**
   * Kasuje obrazy, do których nie odwołuje się żadna notatka i które leżą
   * dłużej niż karencja. Zwraca liczbę usuniętych.
   */
  async function collectGarbage(referenced: Set<string>, now = Date.now(), graceMs = GC_GRACE_MS, opts: { force?: boolean } = {}): Promise<number> {
    await load();
    const candidates = [...known].filter((h) => !referenced.has(h));
    if (!candidates.length) return 0;
    // Nagle większość magazynu bez właściciela to prawie na pewno niepełna lista używanych (dokument
    // wczytany w połowie, pominięty dział), nie porządki użytkownika. Wolimy zostawić śmieci niż skasować zdjęcia.
    // `force` — Z-6.6: użytkownik sam zlecił sprzątanie po obejrzeniu liczby plików (Ustawienia → Kopia i dane).
    if (!opts.force && candidates.length > GC_SUSPICIOUS_MIN && candidates.length > known.size / 2) {
      logDiag("warn", "imageStore", `garbage collection skipped: ${candidates.length} of ${known.size} files unreferenced`);
      return 0;
    }
    touched = new Set();
    let removed = 0;
    try {
      for (const hash of candidates) {
        if (touched.has(hash) || referenced.has(hash)) continue; // dodane ponownie w trakcie sprzątania
        const del = (async () => {
          if (!(await deleteIfStale(hash, now, graceMs))) return false;
          await idbDel(hash, thumbDb).catch(() => undefined);
          known.delete(hash);
          announce({ t: "del", hash });
          return true;
        })();
        const settled = del.then(() => undefined, () => undefined);
        deleting.set(hash, settled);
        try { if (await del) removed++; } finally { deleting.delete(hash); }
      }
    } catch (err) { logDiag("error", "imageStore", "garbage collection failed", err); }
    return removed;
  }

  /**
   * Z-6.6: ile plików bez odwołania usunęłoby sprzątanie (starszych niż karencja) i ile zajmują. Czyta rekordy
   * po jednym — wołać na żądanie (przycisk w Ustawieniach), nie przy starcie.
   */
  async function unusedFiles(referenced: Set<string>, now = Date.now(), graceMs = GC_GRACE_MS): Promise<{ count: number; bytes: number }> {
    await load();
    let count = 0, bytes = 0;
    for (const hash of known) {
      if (referenced.has(hash)) continue;
      const rec = await getRecord(hash).catch(() => undefined);
      if (!rec || now - rec.addedAt < graceMs) continue;
      count++;
      bytes += rec.bytes.byteLength;
    }
    return { count, bytes };
  }

  /** U3.3: bajty wszystkich plików w magazynie (do podziału zajętego miejsca). Czyta każdy wpis — tylko na żądanie. */
  async function totalBytes(): Promise<{ count: number; bytes: number }> {
    await load();
    let count = 0, bytes = 0;
    for (const hash of known) {
      const rec = await getRecord(hash).catch(() => undefined);
      if (!rec) continue;
      count++;
      bytes += rec.bytes.byteLength;
    }
    return { count, bytes };
  }

  /**
   * Z-6.5: nowa data zapisu istniejących plików — karencja odśmiecania liczy się od teraz. Trwałe usunięcie notatki
   * z „Cofnij” przy starym pliku (> 7 dni) inaczej oddałoby notatkę bez obrazu, gdy odśmiecanie zdąży pobiec.
   * Błąd bazy jest pomijany (co najwyżej stara karencja, jak dotąd).
   */
  async function touch(hashes: readonly string[]): Promise<void> {
    if (hashes.length === 0) return;
    const now = Date.now();
    try {
      await db("readwrite", (s) => new Promise<void>((resolve, reject) => {
        for (const hash of hashes) {
          const req = s.get(hash) as IDBRequest<StoredImage | undefined>;
          req.onsuccess = () => { if (req.result) s.put({ ...req.result, addedAt: now }, hash); };
        }
        s.transaction.oncomplete = () => resolve();
        s.transaction.onabort = s.transaction.onerror = () => reject(s.transaction.error);
      }));
    } catch (err) { logDiag("warn", "imageStore", "touch failed", err); }
  }

  /**
   * Sprawdzenie daty i usunięcie w jednej transakcji: inna karta, która właśnie odnowiła datę pliku
   * (ponowne dodanie), wygrywa z odśmiecaniem — między odczytem a `delete` nic się nie wciśnie.
   * Plik po kolei, więc bajty kandydatów nie leżą wszystkie naraz w pamięci.
   */
  function deleteIfStale(hash: string, now: number, graceMs: number): Promise<boolean> {
    return db("readwrite", (s) => new Promise<boolean>((resolve, reject) => {
      let stale = false;
      const req = s.get(hash) as IDBRequest<StoredImage | undefined>;
      req.onsuccess = () => {
        const rec = req.result;
        if (rec && now - rec.addedAt < graceMs) return;
        stale = true;
        s.delete(hash);
      };
      s.transaction.oncomplete = () => resolve(stale);
      s.transaction.onabort = s.transaction.onerror = () => reject(s.transaction.error);
    }));
  }

  /**
   * Adres miniatury (do siatek, pasków, list). Pierwszy raz tworzy ją z oryginału i zapisuje obok (`false` = obraz za
   * mały albo się nie da — wtedy zawsze oryginał). Odczyt miniatury nie dotyka pełnych bajtów, więc lista kilkudziesięciu
   * zdjęć nie czyta dziesiątek megabajtów. Zwalniać `releaseThumbUrl`.
   */
  async function acquireThumbUrl(hash: string): Promise<string | null> {
    const key = `t:${hash}`;
    const cached = urls.get(key);
    if (cached) { cached.refs++; return cached.url; }
    let pending = pendingUrls.get(key);
    if (!pending) {
      pending = (async () => {
        try {
          let thumb = await idbGet<Blob | false>(hash, thumbDb).catch(() => undefined);
          if (thumb === undefined) {
            const rec = await getRecord(hash);
            if (!rec) return null;
            const { makeThumbBlob } = await import("./imageThumb");
            thumb = (await makeThumbBlob(rec.bytes, rec.type).catch(() => null)) ?? false;
            await idbSet(hash, thumb, thumbDb).catch(() => undefined);
          }
          if (!thumb) return null;
          const url = URL.createObjectURL(thumb);
          urls.set(key, { url, refs: 0 });
          return url;
        } finally { pendingUrls.delete(key); }
      })();
      pendingUrls.set(key, pending);
    }
    const thumbUrl = await pending;
    if (thumbUrl) { const entry = urls.get(key); if (entry) entry.refs++; return thumbUrl; }
    return acquireUrl(hash); // brak miniatury: oryginał
  }

  function releaseThumbUrl(hash: string): void {
    if (urls.has(`t:${hash}`)) releaseKey(`t:${hash}`);
    else releaseUrl(hash);
  }

  /** Test-only. */
  async function resetForTests(): Promise<void> {
    for (const k of await idbKeys(db)) await idbDel(k, db);
    for (const k of await idbKeys(thumbDb)) await idbDel(k, thumbDb);
    known.clear();
    urls.forEach((e) => URL.revokeObjectURL(e.url));
    urls.clear();
    pendingUrls.clear();
    loadPromise = null;
  }

  return {
    load, has, putBytes, putDataUrl, putBlob, ingest, get: getRecord, getDataUrl, resolve,
    acquireUrl, releaseUrl, acquireThumbUrl, releaseThumbUrl, onAdded, collectGarbage, unusedFiles, totalBytes, touch, resetForTests,
  };
}

export type ImageStore = ReturnType<typeof createImageStore>;

export const IMAGE_DB_NAME = "kaczy-images-v1";
export const imageStore = createImageStore(IMAGE_DB_NAME);
