/**
 * Lokalny dziennik diagnostyczny — bez telemetrii i bez sieci.
 *
 * Aplikacja celowo łyka wiele wyjątków (brak miejsca, tryb prywatny, zerwane
 * połączenie P2P), żeby nie wywracać UI. Tutaj te wyjątki zostawiają ślad:
 * bufor 200 ostatnich wpisów w pamięci, z którego użytkownik może na żądanie
 * pobrać raport. Nic nie trafia do `localStorage` ani do sieci.
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
  | "rejected-sync-file";

export interface SecurityEvent {
  at: number;
  kind: SecurityEventKind;
  detail: string;
  /** Ile razy z rzędu wystąpiło dokładnie to samo zdarzenie. */
  count: number;
}

const SECURITY_KEY = "kaczy.security.log.v1";
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

/** Test-only. */
export function clearDiagForTests(): void {
  entries = [];
}

let globalHandlersInstalled = false;

/** Łapie nieobsłużone błędy i odrzucone obietnice do dziennika. */
export function installGlobalDiagHandlers(): void {
  if (globalHandlersInstalled || typeof window === "undefined") return;
  globalHandlersInstalled = true;
  window.addEventListener("error", (e) => logDiag("error", "window", "uncaught", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => logDiag("error", "window", "unhandled rejection", e.reason));
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
export function buildDiagReport(snapshot: DiagSnapshot, log: readonly DiagEntry[], secrets: string[] = [], security: readonly SecurityEvent[] = []): string {
  const lines = [
    "hydra — raport diagnostyczny",
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
