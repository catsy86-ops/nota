import { describe, it, expect } from "vitest";
import {
  KDF_ITERATIONS, VaultError, createVault, decodeRecoveryCode, decryptString, deriveKek, encodeRecoveryCode, encryptString,
  fromB64u, importDataKey, isValidMeta, looksLikeVaultToken, noteAad, passwordStrength, randomBytes, toB64u,
  unlockWithPassword, unlockWithRecovery,
} from "./vault";

// Niska liczba iteracji tylko po to, by testy były szybkie; stała produkcyjna jest sprawdzana osobno.
const IT = 1000;

async function code(p: Promise<unknown>): Promise<string | undefined> {
  try { await p; return undefined; } catch (e) { return e instanceof VaultError ? e.code : "other"; }
}

describe("vault — stałe i kodowanie", () => {
  it("domyślnie PBKDF2 ma co najmniej 600 000 iteracji", () => {
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it("base64url: roundtrip bez dopełnienia i znaków +/", () => {
    for (let n = 0; n < 40; n++) {
      const bytes = randomBytes(n);
      const s = toB64u(bytes);
      expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(fromB64u(s))).toEqual(Array.from(bytes));
    }
  });

  it("kod awaryjny: roundtrip i tolerancja formatowania", () => {
    const bytes = randomBytes(20);
    const c = encodeRecoveryCode(bytes);
    expect(c).toMatch(/^([A-Z2-7]{4}-){7}[A-Z2-7]{4}$/);
    expect(Array.from(decodeRecoveryCode(c.toLowerCase().replace(/-/g, " ")))).toEqual(Array.from(bytes));
    expect(() => decodeRecoveryCode("ABC")).toThrow(VaultError);
  });
});

describe("vault — szyfrowanie notatek", () => {
  it("roundtrip z polskimi znakami i emoji", async () => {
    const { dataKey } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const plain = JSON.stringify({ title: "Zażółć gęślą jaźń 🍺", content: "linia 1\nlinia 2" });
    const token = await encryptString(dataKey, plain, noteAad("n1"));
    expect(looksLikeVaultToken(token)).toBe(true);
    expect(token.startsWith("v1.")).toBe(true);
    expect(token).not.toContain("gęślą");
    expect(await decryptString(dataKey, token, noteAad("n1"))).toBe(plain);
  });

  it("każdy zapis ma inny IV i inny szyfrogram", async () => {
    const { dataKey } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const a = await encryptString(dataKey, "to samo", noteAad("n1"));
    const b = await encryptString(dataKey, "to samo", noteAad("n1"));
    expect(a).not.toBe(b);
    expect(a.split(".")[1]).not.toBe(b.split(".")[1]);
  });

  it("zły klucz → decrypt-failed", async () => {
    const a = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const b = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const token = await encryptString(a.dataKey, "sekret", noteAad("n1"));
    expect(await code(decryptString(b.dataKey, token, noteAad("n1")))).toBe("decrypt-failed");
  });

  it("modyfikacja szyfrogramu (jeden bit) → decrypt-failed", async () => {
    const { dataKey } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const token = await encryptString(dataKey, "sekret sekret sekret", noteAad("n1"));
    const [v, iv, ct] = token.split(".");
    const bytes = fromB64u(ct);
    bytes[0] ^= 1;
    expect(await code(decryptString(dataKey, `${v}.${iv}.${toB64u(bytes)}`, noteAad("n1")))).toBe("decrypt-failed");
    // Zmieniony IV też.
    const ivBytes = fromB64u(iv);
    ivBytes[0] ^= 1;
    expect(await code(decryptString(dataKey, `${v}.${toB64u(ivBytes)}.${ct}`, noteAad("n1")))).toBe("decrypt-failed");
  });

  it("AAD: szyfrogram jednej notatki nie odszyfruje się pod id innej", async () => {
    const { dataKey } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const token = await encryptString(dataKey, "sekret", noteAad("n1"));
    expect(await code(decryptString(dataKey, token, noteAad("n2")))).toBe("decrypt-failed");
    expect(await decryptString(dataKey, token, noteAad("n1"))).toBe("sekret");
  });

  it("wersje i format: nieznana wersja i śmieci dają czytelne błędy", async () => {
    const { dataKey } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const token = await encryptString(dataKey, "x", noteAad("n1"));
    expect(await code(decryptString(dataKey, token.replace(/^v1\./, "v9."), noteAad("n1")))).toBe("unsupported-version");
    expect(await code(decryptString(dataKey, "nie-token", noteAad("n1")))).toBe("bad-format");
    expect(await code(decryptString(dataKey, "v1.AAAA.BBBB", noteAad("n1")))).toBe("bad-format");
    expect(await code(decryptString(dataKey, "v1.%%%.###", noteAad("n1")))).toBe("bad-format");
  });

  it("klucz danych jest niewyodrębnialny", async () => {
    const { dataKey } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    expect(dataKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", dataKey)).rejects.toThrow();
    const kek = await deriveKek("a", randomBytes(16), IT);
    expect(kek.extractable).toBe(false);
    expect((await importDataKey(randomBytes(32))).extractable).toBe(false);
  });
});

describe("vault — hasło, metadane, kod awaryjny", () => {
  it("to samo hasło + sól z metadanych daje ten sam klucz (drugie urządzenie)", async () => {
    const { meta, dataKey } = await createVault("wspólne-hasło-1", { iterations: IT });
    const token = await encryptString(dataKey, "z urządzenia A", noteAad("n1"));
    // „Drugie urządzenie” ma tylko meta (z dokumentu) i hasło.
    const copy = JSON.parse(JSON.stringify(meta));
    const key2 = await unlockWithPassword(copy, "wspólne-hasło-1", IT);
    expect(await decryptString(key2, token, noteAad("n1"))).toBe("z urządzenia A");
  });

  it("zły hasło → bad-password; meta nie zawiera hasła ani klucza", async () => {
    const { meta } = await createVault("poprawne-hasło-1", { iterations: IT });
    expect(await code(unlockWithPassword(meta, "zle-haslo-xyz", IT))).toBe("bad-password");
    const json = JSON.stringify(meta);
    expect(json).not.toContain("poprawne-hasło-1");
    expect(isValidMeta(JSON.parse(json))).toBe(true);
  });

  it("sól jest losowa, 16 B, i różna między skarbcami", async () => {
    const a = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const b = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    expect(fromB64u(a.meta.salt)).toHaveLength(16);
    expect(a.meta.salt).not.toBe(b.meta.salt);
  });

  it("kod awaryjny odblokowuje ten sam klucz; błędny kod nie", async () => {
    const { meta, dataKey, recoveryCode } = await createVault("poprawne-hasło-1", { iterations: IT });
    expect(recoveryCode).toBeTruthy();
    const token = await encryptString(dataKey, "x", noteAad("n1"));
    const k = await unlockWithRecovery(meta, recoveryCode!);
    expect(await decryptString(k, token, noteAad("n1"))).toBe("x");
    expect(await code(unlockWithRecovery(meta, encodeRecoveryCode(randomBytes(20))))).toBe("bad-recovery");
    const noRec = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    expect(noRec.recoveryCode).toBeNull();
    expect(await code(unlockWithRecovery(noRec.meta, recoveryCode!))).toBe("bad-recovery");
  });

  it("metadane z obniżoną liczbą iteracji są odrzucane", async () => {
    const { meta } = await createVault("poprawne-hasło-1", { iterations: IT });
    expect(await code(unlockWithPassword(meta, "poprawne-hasło-1"))).toBe("weak-params");
  });

  it("miernik hasła: krótkie odrzuca, długie ocenia wyżej", () => {
    expect(passwordStrength("").ok).toBe(false);
    expect(passwordStrength("abc").ok).toBe(false);
    expect(passwordStrength("kwiatek7").ok).toBe(false);
    expect(passwordStrength("kwiatekwiatek").score).toBe(1);
    expect(passwordStrength("kwiatekwiatek").ok).toBe(false);
    expect(passwordStrength("kwiatek7-lampa").ok).toBe(true);
    expect(passwordStrength("Zażółć-gęślą-jaźń-2026!").score).toBe(4);
  });
});

describe("hasło i metadane z zewnątrz (A07/A04)", () => {
  it("odrzuca hasła trywialne mimo długości", async () => {
    const { isTrivialPassword } = await import("./vault");
    for (const pw of ["abcdefgh", "12345678", "87654321", "aaaaaaaa", "abababab", "password", "Password1", "qwertyuiop", "zaq12wsx", "haslo123", "notatnik2026"]) {
      expect(isTrivialPassword(pw), pw).toBe(true);
      expect(passwordStrength(pw).ok, pw).toBe(false);
    }
    for (const pw of ["stol-krzeslo-lampa-2026", "kwiatek7-lampa", "Zażółć-gęślą-jaźń-2026!"]) {
      expect(isTrivialPassword(pw), pw).toBe(false);
      expect(passwordStrength(pw).ok, pw).toBe(true);
    }
  });

  it("isValidMeta odrzuca iter powyżej limitu (DoS na odblokowaniu) i rozdęte pola", async () => {
    const { MAX_KDF_ITERATIONS } = await import("./vault");
    const base = { v: 1, salt: "AAAAAAAAAAAAAAAAAAAAAA", iter: 600_000, wrapped: "v1.a.b", check: "v1.a.b", epoch: 1 };
    expect(isValidMeta(base)).toBe(true);
    expect(isValidMeta({ ...base, iter: MAX_KDF_ITERATIONS + 1 })).toBe(false);
    expect(isValidMeta({ ...base, iter: 2_000_000_000 })).toBe(false);
    expect(isValidMeta({ ...base, wrapped: "x".repeat(10_000) })).toBe(false);
    expect(isValidMeta({ ...base, epoch: Infinity })).toBe(false);
  });
});
