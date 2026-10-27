import { describe, expect, it } from "vitest";
import { blobAad, blobIdOf, deriveRelayKeys, openBytes, relayAad, sealBytes } from "./relayKeys";

// Testy na niskiej liczbie iteracji KDF, żeby były szybkie; to ta sama ścieżka kodu co w produkcji.
const ITER = 1000;
const plain = new TextEncoder().encode("treść notatki");

describe("klucze przekaźnika", () => {
  it("ten sam kod daje ten sam pokój i te same klucze, inny kod inne", async () => {
    const a = await deriveRelayKeys("kod-jeden-dwa-trzy", ITER);
    const b = await deriveRelayKeys("kod-jeden-dwa-trzy", ITER);
    const c = await deriveRelayKeys("inny-kod-cztery", ITER);
    expect(a.roomId).toBe(b.roomId);
    expect(a.token).toBe(b.token);
    expect(a.roomId).not.toBe(c.roomId);
    expect(a.token).not.toBe(c.token);
  });

  it("serwer nie dostaje kodu: token i pokój nie są jego fragmentem", async () => {
    const keys = await deriveRelayKeys("kod-jeden-dwa-trzy", ITER);
    expect(keys.token).not.toContain("kod-jeden-dwa-trzy");
    expect(keys.roomId).not.toContain("kod-jeden-dwa-trzy");
  });

  it("identyfikator bloba zależy od klucza i treści", async () => {
    const a = await deriveRelayKeys("kod-jeden-dwa-trzy", ITER);
    const c = await deriveRelayKeys("inny-kod-cztery", ITER);
    expect(await blobIdOf(a, "hash1")).toBe(await blobIdOf(a, "hash1"));
    expect(await blobIdOf(a, "hash1")).not.toBe(await blobIdOf(a, "hash2"));
    expect(await blobIdOf(a, "hash1")).not.toBe(await blobIdOf(c, "hash1"));
  });

  it("AAD dla pokoju i bloba wiąże wpis z właściwym miejscem", () => {
    expect(relayAad("pokoj")).toBe("notki:relay:v1:pokoj");
    expect(blobAad("pokoj", "b1")).toBe("notki:relay:blob:v1:pokoj:b1");
    expect(blobAad("pokoj", "b1")).not.toBe(blobAad("pokoj", "b2"));
  });
});

describe("szyfrowanie wpisów przekaźnika", () => {
  it("odszyfrowuje to, co zaszyfrowano tym samym kluczem i AAD", async () => {
    const keys = await deriveRelayKeys("kod-jeden-dwa-trzy", ITER);
    const token = await sealBytes(keys.dataKey, plain, relayAad(keys.roomId));
    const back = await openBytes(keys.dataKey, token, relayAad(keys.roomId));
    expect(new TextDecoder().decode(back)).toBe("treść notatki");
  });

  it("odrzuca zły klucz, zły AAD i zmieniony szyfrogram", async () => {
    const a = await deriveRelayKeys("kod-jeden-dwa-trzy", ITER);
    const c = await deriveRelayKeys("inny-kod-cztery", ITER);
    const token = await sealBytes(a.dataKey, plain, relayAad(a.roomId));
    await expect(openBytes(c.dataKey, token, relayAad(a.roomId))).rejects.toThrow();
    await expect(openBytes(a.dataKey, token, relayAad("inny-pokoj"))).rejects.toThrow();
    const tampered = token.slice(0, -2) + (token.slice(-2) === "AA" ? "BB" : "AA");
    await expect(openBytes(a.dataKey, tampered, relayAad(a.roomId))).rejects.toThrow();
  });

  it("odrzuca zbyt krótki wpis", async () => {
    const a = await deriveRelayKeys("kod-jeden-dwa-trzy", ITER);
    await expect(openBytes(a.dataKey, "AAAA", relayAad(a.roomId))).rejects.toThrow("za krótki");
  });
});
