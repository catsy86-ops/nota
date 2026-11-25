import { DANE } from "@/lib/storage/names";
/**
 * Lokalny dziennik diagnostyczny — bez telemetrii i bez sieci.
 *
 * Aplikacja celowo łyka wiele wyjątków (brak miejsca, tryb prywatny, zerwane
 * połączenie P2P), żeby nie wywracać UI. Tutaj te wyjątki zostawiają ślad:
 * bufor 200 ostatnich wpisów w pamięci, z którego użytkownik może na żądanie
 * pobrać raport. Nic nie trafia do sieci; do `localStorage` idą tylko zdarzenia
 * bezpieczeństwa i nieobsłużone błędy (oba niżej, oczyszczone).
 *
 * Prywatność: wpis zawiera tylko źródło, komunikat i nazwę błędu — nigdy
 * treści notatek. Raport dodatkowo wycina kod parowania (patrz `redact`).
 */

export type DiagLevel = "info" | "warn" | "error";

export interface DiagEntry {
  at: number;
  level: DiagLevel;
  /** Moduł, np. "yjsSync", "imagesStore". */
  source: string;
  message: string;
}

const MAX = 200;
let entries: DiagEntry[] = [];

function describe(err: unknown): string {
  if (typeof err === "string") return err;
  // Duck typing zamiast `instanceof Error`: `DOMException` (np. QuotaExceededError)
  // nie wszędzie dziedziczy po `Error`, a to właśnie ten błąd najczęściej łykamy.
  if (err && typeof err === "object" && "message" in err) {
    const { name, message } = err as { name?: unknown; message?: unknown };
    return `${typeof name === "string" ? name : "Error"}: ${String(message)}`;
  }
  return "unknown error";
}

/** Zapisuje wpis. `err` jest opcjonalny i sprowadzany do `Nazwa: komunikat`. */
export function logDiag(level: DiagLevel, source: string, message: string, err?: unknown): void {
  const text = err === undefined ? message : `${message} — ${describe(err)}`;
  entries.push({ at: Date.now(), level, source, message: text.slice(0, 500) });
  if (entries.length > MAX) entries = entries.slice(-MAX);
}

export function getDiagEntries(): readonly DiagEntry[] {
  return entries;
}

// ── zdarzenia bezpieczeństwa ─────────────────────────────────────────────────
//
// Osobny, trwały (localStorage) i mały dziennik: zwykły bufor diagnostyczny
// żyje tylko do przeładowania karty i jest wypierany przez szum, a próby
// odblokowania skarbca czy naruszenia CSP warto zobaczyć też po restarcie.
// Wpis to rodzaj + krótki opis techniczny — nigdy treść notatki, hasło, kod
// parowania ani pełny adres (patrz `sanitizeDetail`).

export type SecurityEventKind =
  | "csp-violation"
  | "vault-unlock-failed"
  | "vault-recovery-failed"
  | "vault-throttled"
  | "vault-meta-rejected"
  | "rejected-peer-blob"
  | "rejected-share-link"
  | "rejected-import"
  | "rejected-sync-file"
  | "relay-rollback"
  | "relay-reset-loop"
  | "relay-split"
  | "peer-limit"
  | "doc-format-claim";

export interface SecurityEvent {
  at: number;
  kind: SecurityEventKind;
  detail: string;
  /** Ile razy z rzędu wystąpiło dokładnie to samo zdarzenie. */
  count: number;
}

const SECURITY_KEY = DANE.securityLog;
export const SECURITY_LOG_MAX = 50;
const SECURITY_DETAIL_MAX = 160;
let securityEvents: SecurityEvent[] | null = null;

/** Jedna linia, bez znaków sterujących, przycięta; adresy http(s) sprowadzone do `schemat://host`. */
export function sanitizeDetail(text: string): string {
  const noUrlPaths = text.replace(/\b([a-z][a-z0-9+.-]*:\/\/[^\s/?#]+)[^\s]*/gi, "$1");
  // eslint-disable-next-line no-control-regex
  return noUrlPaths.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, SECURITY_DETAIL_MAX);
}

function loadSecurity(): SecurityEvent[] {
  if (securityEvents) return securityEvents;
  securityEvents = [];
  try {
    const raw = JSON.parse(localStorage.getItem(SECURITY_KEY) || "[]");
    if (Array.isArray(raw)) {
      for (const e of raw) {
        if (e && typeof e === "object" && typeof e.at === "number" && typeof e.kind === "string" && typeof e.detail === "string") {
          securityEvents.push({ at: e.at, kind: e.kind, detail: sanitizeDetail(e.detail), count: typeof e.count === "number" && e.count > 0 ? Math.floor(e.count) : 1 });
        }
      }
      securityEvents = securityEvents.slice(-SECURITY_LOG_MAX);
    }
  } catch { /* uszkodzone albo brak localStorage — zaczynamy od pustego */ }
  return securityEvents;
}

/** Zapisuje zdarzenie bezpieczeństwa (lokalnie; nic nie wychodzi z urządzenia). */
export function logSecurity(kind: SecurityEventKind, detail = ""): void {
  const list = loadSecurity();
  const clean = sanitizeDetail(detail);
  const last = list[list.length - 1];
  if (last && last.kind === kind && last.detail === clean) {
    last.count++;
    last.at = Date.now();
  } else {
    list.push({ at: Date.now(), kind, detail: clean, count: 1 });
    if (list.length > SECURITY_LOG_MAX) list.splice(0, list.length - SECURITY_LOG_MAX);
  }
  try { localStorage.setItem(SECURITY_KEY, JSON.stringify(list)); } catch { /* brak miejsca — zostaje w pamięci */ }
  logDiag("warn", "security", `${kind}${clean ? `: ${clean}` : ""}`);
}

export function getSecurityEvents(): readonly SecurityEvent[] {
  return loadSecurity();
}

/** Test-only. */
export function clearSecurityForTests(): void {
  securityEvents = null;
  try { localStorage.removeItem(SECURITY_KEY); } catch { /* ignore */ }
}

// ── błędy z tego urządzenia (Q1.6) ───────────────────────────────────────────
//
// Nieobsłużone błędy i odrzucone obietnice (`installGlobalDiagHandlers`) w trwałym pierścieniu 50 wpisów — przeżywają
// przeładowanie, więc błąd z telefonu da się skopiować i zgłosić później. Tekst czyszczony jak w zdarzeniach
// bezpieczeństwa (`sanitizeDetail`: jedna linia, adresy bez ścieżek, 160 znaków); ten sam błąd pod rząd zwiększa `count`.

export interface ErrorLogEntry {
  at: number;
  source: string;
  message: string;
  count: number;
}

const ERROR_KEY = DANE.errorLog;
export const ERROR_LOG_MAX = 50;
let errorLog: ErrorLogEntry[] | null = null;

function loadErrors(): ErrorLogEntry[] {
  if (errorLog) return errorLog;
  errorLog = [];
  try {
    const raw = JSON.parse(localStorage.getItem(ERROR_KEY) || "[]");
    if (Array.isArray(raw)) {
      for (const e of raw) {
        if (e && typeof e === "object" && typeof e.at === "number" && typeof e.source === "string" && typeof e.message === "string") {
          errorLog.push({ at: e.at, source: sanitizeDetail(e.source).slice(0, 40), message: sanitizeDetail(e.message), count: typeof e.count === "number" && e.count > 0 ? Math.floor(e.count) : 1 });
        }
      }
      errorLog = errorLog.slice(-ERROR_LOG_MAX);
    }
  } catch { /* uszkodzone albo brak localStorage — zaczynamy od pustego */ }
  return errorLog;
}

function saveErrors(list: ErrorLogEntry[]): void {
  try {
    if (list.length) localStorage.setItem(ERROR_KEY, JSON.stringify(list));
    else localStorage.removeItem(ERROR_KEY);
  } catch { /* brak miejsca — zostaje w pamięci karty */ }
}

/**
 * Komunikat błędu bez cytowanych danych: silnik wkleja do niektórych komunikatów fragment wartości
 * (`Unexpected token 'x', "<początek tekstu>"... is not valid JSON`), a to mógłby być tekst notatki.
 * Cytaty (w `"…"`, `'…'`, `` `…` ``) zastępujemy `…`; zostaje sam rodzaj błędu.
 */
export function redactErrorText(text: string): string {
  return text.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, "…");
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Zapisuje błąd w trwałym dzienniku urządzenia (i w zwykłym buforze diagnostycznym). */
export function logDeviceError(source: string, err: unknown): void {
  const message = sanitizeDetail(redactErrorText(describe(err)));
  logDiag("error", source, message);
  const list = loadErrors();
  const last = list[list.length - 1];
  if (last && last.source === source && last.message === message) {
    last.count++;
    last.at = Date.now();
  } else {
    list.push({ at: Date.now(), source, message, count: 1 });
    if (list.length > ERROR_LOG_MAX) list.splice(0, list.length - ERROR_LOG_MAX);
  }
  // Błąd w pętli klatek potrafi przyjść 60 razy na sekundę — zapis zbiorczo, najwyżej raz na pół sekundy.
  saveTimer ??= setTimeout(() => { saveTimer = null; saveErrors(loadErrors()); }, 500);
}

/** Test-only: natychmiastowy zapis odłożonego dziennika. */
export function flushErrorLogForTests(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  saveErrors(loadErrors());
}

export function getErrorLog(): readonly ErrorLogEntry[] {
  return loadErrors();
}

export function clearErrorLog(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  errorLog = [];
  saveErrors(errorLog);
}

/** Dziennik błędów jako tekst do schowka: od najnowszego, czas ISO, liczba powtórzeń. */
export function errorLogText(list: readonly ErrorLogEntry[]): string {
  return [...list].reverse().map((e) => `${new Date(e.at).toISOString()} [${e.source}]${e.count > 1 ? ` x${e.count}` : ""} ${e.message}`).join("\n");
}

/** Test-only. */
export function clearErrorLogForTests(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  errorLog = null;
  try { localStorage.removeItem(ERROR_KEY); } catch { /* ignore */ }
}

/** Test-only. */
export function clearDiagForTests(): void {
  entries = [];
}

let globalHandlersInstalled = false;

/** Łapie nieobsłużone błędy i odrzucone obietnice do dziennika. */
export function installGlobalDiagHandlers(): void {
  if (globalHandlersInstalled || typeof window === "undefined") return;
  globalHandlersInstalled = true;
  window.addEventListener("error", (e) => logDeviceError("uncaught", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => logDeviceError("rejection", e.reason));
  // Naruszenie CSP = coś próbowało załadować/wykonać to, czego polityka nie zezwala.
  document.addEventListener("securitypolicyviolation", (e) => {
    logSecurity("csp-violation", `${e.violatedDirective} ${e.blockedURI || "inline"}`);
  });
}

export interface DiagSnapshot {
  build: string;
  generatedAt: string;
  userAgent: string;
  online: boolean;
  serviceWorker: string;
  storage: { usage: number | null; quota: number | null; persisted: boolean | null };
  counts: { notes: number; archived: number; trashed: number; folders: number; labels: number };
  stateVectorBytes: number;
  sync: {
    status: string;
    peerCount: number;
    paired: boolean;
    lastSyncedAt: number | null;
    lastError: string | null;
    /** Własne serwery sygnalizacyjne (adresy to konfiguracja, nie sekret); puste = domyślne. */
    signaling?: string[];
  };
}

/** Usuwa kod parowania wszędzie, gdzie mógłby trafić do tekstu. */
function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (s) out = out.split(s).join("[kod]");
  }
  return out;
}

/**
 * Czysta funkcja: snapshot + wpisy → tekst raportu.
 * `secrets` to wartości, które nie mogą się w nim pojawić (kod parowania).
 */
export function buildDiagReport(snapshot: DiagSnapshot, log: readonly DiagEntry[], secrets: string[] = [], security: readonly SecurityEvent[] = [], deviceErrors: readonly ErrorLogEntry[] = []): string {
  const lines = [
    "NOTKI — raport diagnostyczny",
    "(bez treści notatek i bez kodu parowania)",
    "",
    `build: ${snapshot.build}`,
    `wygenerowano: ${snapshot.generatedAt}`,
    `przeglądarka: ${snapshot.userAgent}`,
    `online: ${snapshot.online}`,
    `service worker: ${snapshot.serviceWorker}`,
    `pamięć: ${fmtBytes(snapshot.storage.usage)} z ${fmtBytes(snapshot.storage.quota)}, trwała: ${snapshot.storage.persisted ?? "?"}`,
    `notatki: ${snapshot.counts.notes}, archiwum: ${snapshot.counts.archived}, kosz: ${snapshot.counts.trashed}, foldery: ${snapshot.counts.folders}, etykiety: ${snapshot.counts.labels}`,
    `wektor stanu Yjs: ${snapshot.stateVectorBytes} B`,
    `sync: ${snapshot.sync.status}, urządzenia: ${snapshot.sync.peerCount}, sparowano: ${snapshot.sync.paired}`,
    `ostatnia synchronizacja: ${snapshot.sync.lastSyncedAt ? new Date(snapshot.sync.lastSyncedAt).toISOString() : "nigdy"}`,
    `ostatni błąd sync: ${snapshot.sync.lastError ?? "brak"}`,
    `serwery sygnalizacyjne: ${snapshot.sync.signaling?.length ? snapshot.sync.signaling.join(", ") : "domyślne"}`,
    "",
    `zdarzenia bezpieczeństwa (${security.length}; bez haseł i treści):`,
    ...(security.length
      ? security.map((e) => `${new Date(e.at).toISOString()} ${e.kind}${e.count > 1 ? ` x${e.count}` : ""}${e.detail ? ` — ${e.detail}` : ""}`)
      : ["brak"]),
    "",
    `błędy z tego urządzenia, także z poprzednich sesji (${deviceErrors.length}):`,
    ...(deviceErrors.length ? errorLogText(deviceErrors).split("\n") : ["brak"]),
    "",
    `dziennik (${log.length} ostatnich wpisów):`,
    ...log.map((e) => `${new Date(e.at).toISOString()} ${e.level.toUpperCase().padEnd(5)} [${e.source}] ${e.message}`),
  ];
  return redact(lines.join("\n"), secrets);
}

function fmtBytes(n: number | null): string {
  if (n == null) return "?";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
