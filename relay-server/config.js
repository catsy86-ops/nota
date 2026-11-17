// Konfiguracja przekaźnika ze zmiennych środowiska (S4.3, S4.4 z `docs/plan-security-2026-11-15.md`). Czysta funkcja:
// błędy konfiguracji nie są zgadywane ani poprawiane po cichu — serwer z błędną konfiguracją nie startuje.

const MIB = 1024 * 1024;

/** Adres bez przedrostka IPv4 zapisanego jako IPv6 (`::ffff:1.2.3.4` → `1.2.3.4`). */
export function normIp(ip) {
  const s = String(ip ?? "").trim();
  return s.startsWith("::ffff:") ? s.slice(7) : s;
}

/**
 * Klucz limitów na adres: IPv4 bez zmian, IPv6 — prefiks /64 (jedno łącze dostaje zwykle całą /64, więc limit na
 * pojedynczy adres IPv6 dałby 2^64 tożsamości i obejście limitu zapytań oraz nowych pokoi).
 */
export function limitKey(ip) {
  const s = normIp(ip).split("%")[0].toLowerCase();
  if (!s.includes(":")) return s;
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = s.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

const list = (raw) => String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * `limits` nadpisują `LIMITS` z `core.js` (S4.4: 300 MB blobów × 5000 pokoi może przekroczyć dysk serwera).
 * Liczba musi być całkowita i dodatnia — inna wartość to błąd, nie cicha wartość domyślna.
 */
export function readConfig(env) {
  const errors = [];
  const prod = env.NODE_ENV === "production";

  const num = (name, fallback) => {
    if (env[name] === undefined || env[name] === "") return fallback;
    const n = Number(env[name]);
    if (!Number.isSafeInteger(n) || n <= 0) {
      errors.push(`${name} musi być dodatnią liczbą całkowitą (jest: ${env[name]})`);
      return fallback;
    }
    return n;
  };

  const origins = list(env.ALLOWED_ORIGINS);
  // Poza produkcją brak listy = „*” (lokalne testy); w produkcji to błąd: przekaźnik przyjmowałby żądania z każdej strony.
  if (prod && (origins.length === 0 || origins.includes("*"))) {
    errors.push("NODE_ENV=production wymaga ALLOWED_ORIGINS z adresami aplikacji (bez „*”)");
  }

  const trustProxy = env.TRUST_PROXY === "1";
  const trustedProxies = list(env.TRUSTED_PROXY).map(normIp);
  // Bez adresu pośrednika każdy klient podałby sobie X-Forwarded-For i ominął limity na adres.
  if (trustProxy && trustedProxies.length === 0) errors.push("TRUST_PROXY=1 wymaga TRUSTED_PROXY z adresem zaufanego pośrednika");

  const limits = {};
  const maxRooms = num("MAX_ROOMS", undefined);
  if (maxRooms !== undefined) limits.MAX_ROOMS = maxRooms;
  const maxRoomBlob = num("MAX_ROOM_BLOB_BYTES", undefined);
  if (maxRoomBlob !== undefined) limits.MAX_ROOM_BLOB_BYTES = maxRoomBlob;

  return {
    errors,
    prod,
    port: num("PORT", 4466),
    dataDir: env.DATA_DIR || "./data",
    origins: origins.length ? origins : ["*"],
    trustProxy,
    trustedProxies,
    ratePerMin: num("RATE_PER_MIN", 300),
    roomsPerIpPerDay: num("ROOMS_PER_IP_PER_DAY", 20),
    cacheBytes: num("CACHE_BYTES", 256 * MIB),
    maxTotalBytes: num("MAX_TOTAL_BYTES", 20 * 1024 * MIB),
    minFreeBytes: num("MIN_FREE_BYTES", 512 * MIB),
    limits,
  };
}

/**
 * Adres klienta: X-Forwarded-For tylko od zaufanego pośrednika, i wtedy ostatni wpis (dopisany przez pośrednika;
 * pierwszy dałoby się podrobić). `forwardedIgnored` — nagłówek był, ale nie zaufany (ostrzeżenie w logu, S4.3).
 */
export function clientIpOf(cfg, remoteAddress, forwardedFor) {
  const remote = normIp(remoteAddress) || "?";
  if (!forwardedFor) return { ip: remote, forwardedIgnored: false };
  if (!cfg.trustProxy || !cfg.trustedProxies.includes(remote)) return { ip: remote, forwardedIgnored: !cfg.trustProxy };
  const last = list(forwardedFor).pop();
  return { ip: normIp(last) || remote, forwardedIgnored: false };
}
