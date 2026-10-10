import { imageStore as defaultStore, isImageRef, sha256Hex, type ImageStore } from "@/lib/imageStore";

/**
 * Załączniki notatek (PDF, tekst, dokumenty — cokolwiek poza obrazami).
 *
 * Mechanizm jest ten sam co dla obrazów: bajty leżą w content-addressed
 * `imageStore` (klucz = SHA-256), a w dokumencie Yjs jest tylko manifest
 * `attachments: { hash, name, size, type }[]` obok `imageHashes`. Dzięki
 * temu zachowują się tak samo: deduplikacja po treści, GC po odniesieniach
 * (`yjsStore.referencedImages()` obejmuje też załączniki), backup, plik sync
 * i transport P2P. Ten plik to czysta logika (limity, nazwy, MIME, walidacja)
 * plus cienkie operacje na store'ie wstrzykiwanym w testach.
 *
 * PUNKT ROZSZERZENIA (prywatne notatki): szyfrowanie bajtów należy wpiąć
 * w `addAttachmentFiles` (przed `putBytes`) i `readAttachment` (po `get`) —
 * hash musi wtedy liczyć się z szyfrogramu albo z osobnego klucza treści.
 */

export interface Attachment {
  /** SHA-256 bajtów (klucz w `imageStore`). */
  hash: string;
  /** Oryginalna nazwa pliku — tylko etykieta, nigdy ścieżka. */
  name: string;
  size: number;
  /** MIME zadeklarowany przy dodaniu (może być pusty → `application/octet-stream`). */
  type: string;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Łącznie, po deduplikacji treści, we wszystkich notatkach. */
export const MAX_ATTACHMENTS_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_NOTE = 20;
/** Powyżej tego rozmiaru plik nie jedzie przez P2P ani plik sync — zostaje na urządzeniu. */
export const ATTACHMENT_SYNC_MAX_BYTES = 2 * 1024 * 1024;
/** Budżet załączników (surowe bajty) w pojedynczym pełnym backupie JSON. */
export const BACKUP_ATTACHMENTS_BUDGET_BYTES = 40 * 1024 * 1024;

const NAME_MAX = 120;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/** „1,2 MB” — przecinek dziesiętny, jedna cyfra po przecinku od KB wzwyż. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  const rounded = Math.round(v * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[i]}`;
}

/**
 * Nazwa bezpieczna dla systemu plików: bez separatorów ścieżek, znaków
 * sterujących i zastrzeżonych znaków Windows, bez kropek na początku/końcu,
 * z zachowanym rozszerzeniem przy skracaniu.
 */
export function sanitizeFileName(raw: string, fallback = "plik"): string {
  // Tylko ostatni segment: katalogi z podanej ścieżki nie mają tu czego szukać.
  let s = (raw ?? "").normalize("NFC").split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "");
  s = s.replace(/[\\/:*?"<>|]+/g, "_");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^\.+/, "").replace(/[. ]+$/, "");
  if (!s) return fallback;
  if (WINDOWS_RESERVED.test(s)) s = `_${s}`;
  if (s.length > NAME_MAX) {
    const dot = s.lastIndexOf(".");
    const ext = dot > 0 && s.length - dot <= 12 ? s.slice(dot) : "";
    s = s.slice(0, NAME_MAX - ext.length) + ext;
  }
  return s;
}

const EXT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  log: "text/plain",
  rtf: "application/rtf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  html: "text/html",
  svg: "image/svg+xml",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** MIME z pliku albo, gdy przeglądarka go nie podała, z rozszerzenia. */
export function resolveMimeType(name: string, declared: string): string {
  const d = (declared || "").split(";")[0].trim().toLowerCase();
  if (d && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(d)) return d;
  return EXT_TYPES[extensionOf(name)] ?? "application/octet-stream";
}

/** Typy, które przeglądarka potrafi wykonać/wyrenderować (skrypty!) — pobieramy je tylko jako binarium. */
const ACTIVE_TYPES = new Set([
  "text/html", "application/xhtml+xml", "image/svg+xml", "text/xml", "application/xml",
  "text/javascript", "application/javascript", "application/x-javascript", "text/css",
]);

/** MIME użyty przy pobraniu: aktywne treści zawsze jako `application/octet-stream`. */
export function safeDownloadType(type: string): string {
  const t = resolveMimeType("", type);
  if (ACTIVE_TYPES.has(t) || t.endsWith("+xml")) return "application/octet-stream";
  return t;
}

export type AttachmentKind = "pdf" | "text" | "image" | "sheet" | "archive" | "doc" | "other";

export function attachmentKind(a: Pick<Attachment, "name" | "type">): AttachmentKind {
  const type = resolveMimeType(a.name, a.type);
  const ext = extensionOf(a.name);
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type === "text/csv" || type.includes("spreadsheet") || type === "application/vnd.ms-excel") return "sheet";
  if (type === "application/zip" || type.includes("compressed") || ["zip", "rar", "7z", "gz", "tar"].includes(ext)) return "archive";
  if (type.startsWith("text/") || type === "application/json" || ["txt", "md", "log"].includes(ext)) return "text";
  if (type.includes("word") || type.includes("presentation") || type.includes("opendocument") || type === "application/rtf") return "doc";
  return "other";
}

/** Podgląd tekstu w czytniku: tylko zwykły tekst/Markdown/CSV/JSON — nigdy HTML. */
export function isTextPreviewable(a: Pick<Attachment, "name" | "type">): boolean {
  const type = resolveMimeType(a.name, a.type);
  if (ACTIVE_TYPES.has(type)) return false;
  return ["text/plain", "text/markdown", "text/csv", "application/json"].includes(type) || ["txt", "md", "markdown", "log", "csv"].includes(extensionOf(a.name));
}

/** Pierwsze `maxLines` linii tekstu (z `maxChars` jako bezpiecznikiem). */
export function textPreview(text: string, maxLines = 20, maxChars = 4000): { text: string; truncated: boolean } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let out = lines.slice(0, maxLines).join("\n");
  let truncated = lines.length > maxLines;
  if (out.length > maxChars) { out = out.slice(0, maxChars); truncated = true; }
  return { text: out, truncated };
}

/** Walidacja manifestu z dokumentu/pliku/peera: zły wpis jest pomijany, duplikaty hashy scalane. */
export function normalizeAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Attachment[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.hash !== "string" || !isImageRef(r.hash) || seen.has(r.hash)) continue;
    const size = typeof r.size === "number" && Number.isFinite(r.size) && r.size >= 0 ? Math.floor(r.size) : 0;
    const name = sanitizeFileName(typeof r.name === "string" ? r.name : "");
    const type = typeof r.type === "string" ? r.type.slice(0, 120) : "";
    seen.add(r.hash);
    out.push({ hash: r.hash, name, size, type });
  }
  return out;
}

/** Suma po unikalnych hashach (ta sama treść w dwóch notatkach liczy się raz). */
export function uniqueAttachmentBytes(lists: Iterable<Attachment[] | undefined>): { bytes: number; sizes: Map<string, number> } {
  const sizes = new Map<string, number>();
  for (const list of lists) for (const a of list ?? []) if (!sizes.has(a.hash)) sizes.set(a.hash, a.size);
  let bytes = 0;
  sizes.forEach((s) => { bytes += s; });
  return { bytes, sizes };
}

/** Czy plik o tym rozmiarze jedzie przez P2P / plik sync. */
export function isAttachmentSyncable(a: Pick<Attachment, "size">): boolean {
  return a.size <= ATTACHMENT_SYNC_MAX_BYTES;
}

export type RejectReason = "too-big" | "total-limit" | "too-many" | "empty" | "duplicate" | "storage" | "quota";

export interface AddAttachmentsResult {
  added: Attachment[];
  rejected: { name: string; reason: RejectReason }[];
}

export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number };
  return e.name === "QuotaExceededError" || e.code === 22 || e.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

export interface AddContext {
  /** Załączniki, które notatka (lub szkic) już ma. */
  current: Attachment[];
  /** Wszystkie załączniki w aplikacji: hash → rozmiar (do limitu łącznego). */
  used: Map<string, number>;
  store?: ImageStore;
}

/** `Blob.arrayBuffer()` z zapasem dla środowisk bez niego (starsze WebView, jsdom). */
function readFileBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Nie udało się odczytać pliku"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Dodaje pliki: walidacja → hash → zapis → manifest. Nic nie trafia do
 * manifestu, dopóki bajty nie są na dysku; błąd zapisu (np. QuotaExceededError)
 * kończy się odrzuceniem pliku, bez utraty już zapisanych danych.
 */
export async function addAttachmentFiles(files: File[], ctx: AddContext): Promise<AddAttachmentsResult> {
  const store = ctx.store ?? defaultStore;
  const added: Attachment[] = [];
  const rejected: AddAttachmentsResult["rejected"] = [];
  const have = new Set(ctx.current.map((a) => a.hash));
  const used = new Map(ctx.used);
  let usedBytes = 0;
  used.forEach((s) => { usedBytes += s; });
  let count = ctx.current.length;

  for (const file of files) {
    const name = sanitizeFileName(file.name);
    if (count >= MAX_ATTACHMENTS_PER_NOTE) { rejected.push({ name, reason: "too-many" }); continue; }
    if (file.size === 0) { rejected.push({ name, reason: "empty" }); continue; }
    if (file.size > MAX_ATTACHMENT_BYTES) { rejected.push({ name, reason: "too-big" }); continue; }
    try {
      const bytes = new Uint8Array(await readFileBuffer(file));
      const hash = await sha256Hex(bytes);
      if (have.has(hash)) { rejected.push({ name, reason: "duplicate" }); continue; }
      const isNewBlob = !used.has(hash);
      if (isNewBlob && usedBytes + bytes.length > MAX_ATTACHMENTS_TOTAL_BYTES) {
        rejected.push({ name, reason: "total-limit" });
        continue;
      }
      const type = resolveMimeType(file.name, file.type);
      await store.putBytes(bytes, type, hash);
      if (isNewBlob) { used.set(hash, bytes.length); usedBytes += bytes.length; }
      have.add(hash);
      count++;
      added.push({ hash, name, size: bytes.length, type });
    } catch (err) {
      rejected.push({ name, reason: isQuotaError(err) ? "quota" : "storage" });
    }
  }
  return { added, rejected };
}

/** Polski komunikat o odrzuconych plikach (jeden toast, pogrupowany po powodzie). */
export function describeRejections(rejected: AddAttachmentsResult["rejected"]): string | null {
  if (!rejected.length) return null;
  const by = (r: RejectReason) => rejected.filter((x) => x.reason === r).map((x) => x.name);
  const parts: string[] = [];
  const list = (names: string[]) => names.slice(0, 3).join(", ") + (names.length > 3 ? ` i ${names.length - 3} więcej` : "");
  const tooBig = by("too-big");
  if (tooBig.length) parts.push(`Za duże (max ${formatFileSize(MAX_ATTACHMENT_BYTES)} na plik): ${list(tooBig)}.`);
  const total = by("total-limit");
  if (total.length) parts.push(`Przekroczono łączny limit załączników (${formatFileSize(MAX_ATTACHMENTS_TOTAL_BYTES)}): ${list(total)}. Usuń niepotrzebne pliki.`);
  const many = by("too-many");
  if (many.length) parts.push(`Notatka może mieć najwyżej ${MAX_ATTACHMENTS_PER_NOTE} załączników: ${list(many)}.`);
  const empty = by("empty");
  if (empty.length) parts.push(`Pusty plik: ${list(empty)}.`);
  const dup = by("duplicate");
  if (dup.length) parts.push(`Już dołączone: ${list(dup)}.`);
  const quota = by("quota");
  if (quota.length) parts.push(`Brakuje miejsca w pamięci przeglądarki (${list(quota)}). Usuń stare załączniki lub obrazy albo zrób backup.`);
  const storage = by("storage");
  if (storage.length) parts.push(`Nie udało się zapisać: ${list(storage)}.`);
  return parts.join(" ");
}

/** Bajty załącznika z lokalnego store'a (`undefined` = pliku nie ma na tym urządzeniu). */
export async function readAttachment(hash: string, store: ImageStore = defaultStore): Promise<ArrayBuffer | undefined> {
  const rec = await store.get(hash);
  return rec?.bytes;
}

/**
 * Pobranie jako plik: Blob z bezpiecznym MIME, `download` z oczyszczoną nazwą,
 * bez `target=_blank` i bez nawigacji — aplikacja nigdy nie renderuje treści załącznika.
 */
export async function downloadAttachment(a: Attachment, store: ImageStore = defaultStore): Promise<boolean> {
  const bytes = await readAttachment(a.hash, store);
  if (!bytes) return false;
  const url = URL.createObjectURL(new Blob([bytes], { type: safeDownloadType(a.type) }));
  const link = document.createElement("a");
  link.href = url;
  link.download = sanitizeFileName(a.name);
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
