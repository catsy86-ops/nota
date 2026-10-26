import { describe, expect, it } from "vitest";
import { createVault, isValidMeta, unlockWithPasskey, unwrapRawWithPassword, wrapDataKeyForPasskey, MAX_PASSKEYS, isValidPasskeyMeta, VaultError } from "./vault";

const IT = 600_000;
const prfA = new Uint8Array(32).fill(7);
const prfB = new Uint8Array(32).fill(9);

describe("odblokowanie biometrią: opakowanie PRF (V-4)", () => {
  it("klucz danych owinięty wynikiem PRF odblokowuje skarbiec; zły PRF nie", async () => {
    const { meta, dataKey } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    const raw = await unwrapRawWithPassword(meta, "hasło-testowe-123", IT);
    const wrapped = await wrapDataKeyForPasskey(raw, prfA);
    raw.fill(0);
    const withPasskey = { ...meta, passkeys: { salt: "AAAAAAAAAAAAAAAAAAAAAA", entries: [{ id: "cred-1", wrapped }] } };
    expect(isValidMeta(withPasskey)).toBe(true);
    const k = await unlockWithPasskey(withPasskey, "cred-1", prfA);
    expect(k).toBeTruthy();
    expect(dataKey).toBeTruthy();
    await expect(unlockWithPasskey(withPasskey, "cred-1", prfB)).rejects.toMatchObject({ code: "decrypt-failed" });
  });

  it("nieznany identyfikator passkeya daje błąd", async () => {
    const { meta } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    await expect(unlockWithPasskey({ ...meta, passkeys: { salt: "A", entries: [] } }, "nope", prfA)).rejects.toBeInstanceOf(VaultError);
  });

  it("złe hasło nie odsłania klucza do zapisu passkeya", async () => {
    const { meta } = await createVault("hasło-testowe-123", { iterations: IT, withRecovery: false });
    await expect(unwrapRawWithPassword(meta, "zle-haslo-xyz-000", IT)).rejects.toMatchObject({ code: "bad-password" });
  });

  it("walidacja metadanych passkeya: limit wpisów i kształt", () => {
    expect(isValidPasskeyMeta({ salt: "A", entries: [{ id: "x", wrapped: "y" }] })).toBe(true);
    expect(isValidPasskeyMeta({ salt: "A", entries: Array.from({ length: MAX_PASSKEYS + 1 }, (_, i) => ({ id: `${i}`, wrapped: "y" })) })).toBe(false);
    expect(isValidPasskeyMeta({ salt: "A", entries: [{ id: "", wrapped: "y" }] })).toBe(false);
    expect(isValidPasskeyMeta("nie-obiekt")).toBe(false);
  });
});
