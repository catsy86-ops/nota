import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { logDiag } from "@/lib/diagnostics";
import { toast } from "@/lib/notify";

/**
 * Pliki w powłoce Androida (Z-13.4, F1.4). WebView nie ma `navigator.share` ani pobierania przez `<a download>`,
 * więc plik trafia do katalogu pamięci podręcznej aplikacji (`Directory.Cache`, udostępniany przez FileProvider —
 * `cache-path` w `res/xml/file_paths.xml`) i otwiera systemowy arkusz udostępniania; stamtąd „Zapisz w plikach”,
 * Dysk, poczta itd. Moduł ładuje się dynamicznie tylko w powłoce (`isNativeShell`) — PWA go nie pobiera.
 */

const OUT_DIR = "out";
/**
 * Po tylu ms od zamknięcia arkusza pliki udostępnienia są kasowane: aplikacja docelowa czyta adres asynchronicznie,
 * ale kopia danych czy eksport skarbca w postaci jawnej nie może leżeć w pamięci podręcznej do następnego startu.
 */
export const SHARE_CLEANUP_MS = 60_000;

/** Nazwa pliku bez ukośników i znaków sterujących (trafia do ścieżki w katalogu aplikacji). */
export function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = name.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, "_").replace(/^\.+/, "").trim().slice(0, 120);
  return clean || "plik";
}

export async function blobToBase64(blob: Blob): Promise<string> {
  // `FileReader`, nie `blob.arrayBuffer()`: starsze WebView (i jsdom) go nie mają.
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
  const bytes = new Uint8Array(buf);
  let bin = "";
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) bin += String.fromCharCode(...bytes.subarray(i, i + STEP));
  return btoa(bin);
}

/** Zapis do pamięci podręcznej; zwraca adres `file://` dla wtyczki udostępniania. */
async function writeCacheFile(dir: string, blob: Blob, name: string, index: number): Promise<string> {
  const { uri } = await Filesystem.writeFile({
    // Podkatalog na plik: dwie rzeczy o tej samej nazwie w jednym udostępnieniu się nie nadpisują.
    path: `${dir}/${index}/${safeFileName(name)}`,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  return uri;
}

/** Anulowanie arkusza ma wyglądać jak w przeglądarce (`AbortError`) — wywołujący już to obsługują. */
function asWebError(err: unknown): unknown {
  const msg = err instanceof Error ? err.message : String(err);
  return /cancel/i.test(msg) ? new DOMException("Udostępnianie anulowane", "AbortError") : err;
}

/** Tylko adres http(s): obcy `file://` albo `content://` nie może trafić do intencji udostępniania. */
export function webUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

let shareSeq = 0;

export async function nativeShare(data: ShareData): Promise<void> {
  const files = data.files ?? [];
  const dir = `${OUT_DIR}/${Date.now()}-${++shareSeq}`;
  try {
    const uris = await Promise.all(files.map((f, i) => writeCacheFile(dir, f, f.name, i)));
    await Share.share({
      title: data.title,
      text: data.text,
      url: webUrl(data.url),
      ...(uris.length ? { files: uris } : {}),
      dialogTitle: data.title,
    });
  } catch (err) {
    throw asWebError(err);
  } finally {
    if (files.length) {
      setTimeout(() => { void Filesystem.rmdir({ path: dir, directory: Directory.Cache, recursive: true }).catch(() => undefined); }, SHARE_CLEANUP_MS);
    }
  }
}

/** Jak w przeglądarce: coś do udostępnienia musi być. */
export function canShareData(d?: ShareData): boolean {
  return !!d && !!(d.title || d.text || webUrl(d.url) || d.files?.length);
}

/** Odpowiednik `downloadBlob` w powłoce: arkusz udostępniania z jednym plikiem. Błąd kończy się komunikatem, nie wyjątkiem. */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  try {
    await nativeShare({ title: filename, files: [new File([blob], filename, { type: blob.type })] });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return;
    logDiag("error", "fileShare", "nie udało się zapisać pliku", err);
    toast.error("Nie udało się zapisać pliku", { description: "Brakuje miejsca albo system odmówił udostępnienia." });
  }
}

/**
 * Zakłada `navigator.share`/`canShare` na wtyczce — wszystkie miejsca udostępniania działają bez zmian. Przy starcie
 * czyści pliki z poprzednich sesji (pamięć podręczna i tak bywa czyszczona przez system).
 */
export function installShareShim(nav: Navigator = navigator): void {
  const n = nav as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d?: ShareData) => boolean };
  n.share = (d: ShareData) => nativeShare(d);
  n.canShare = (d?: ShareData) => canShareData(d);
  void Filesystem.rmdir({ path: OUT_DIR, directory: Directory.Cache, recursive: true }).catch(() => undefined);
}
