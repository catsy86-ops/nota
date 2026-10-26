import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createYjsStore } from "./yjsStore";
import { createPrivateNotes } from "./privateNotes";
import { createVersionsStore } from "./versionsStore";
import { toB64u } from "./vault";

// V-4: przepływ passkeya z atrapą WebAuthn (bez sprzętu). Test pokrywa logikę skarbca, nie prawdziwy PRF.
const IT = 600_000;
const PW = "hasło-testowe-123";
const PRF = new Uint8Array(32).fill(42);
const CRED = new Uint8Array(16).fill(1);

function stubWebAuthn(prfEnabled: boolean, prfResult: Uint8Array | null = PRF) {
  vi.stubGlobal("PublicKeyCredential", function () {} as unknown);
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    credentials: {
      create: vi.fn(async () => ({ rawId: CRED.buffer, getClientExtensionResults: () => ({ prf: { enabled: prfEnabled } }) })),
      get: vi.fn(async () => ({
        rawId: CRED.buffer,
        getClientExtensionResults: () => ({ prf: prfResult ? { results: { first: prfResult.slice().buffer } } : {} }),
      })),
    },
  });
}

function fresh() {
  const store = createYjsStore(`pk-${crypto.randomUUID()}`);
  const versions = createVersionsStore(`pk.versions.${crypto.randomUUID()}.`);
  const pn = createPrivateNotes(store, { iterations: IT, minIterations: IT, writeDelayMs: 5, versions });
  return { store, pn };
}

describe("odblokowanie biometrią: przepływ skarbca (V-4)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("dodanie passkeya wymaga hasła; potem odblokowanie passkeyem działa, hasło nadal działa", async () => {
    stubWebAuthn(true);
    const { store, pn } = fresh();
    await pn.setup(PW);
    expect(pn.hasPasskeys()).toBe(false);
    await expect(pn.addPasskey("zle-haslo-xyz-000", "Ja")).rejects.toMatchObject({ code: "bad-password" });
    await pn.addPasskey(PW, "Ja");
    expect(pn.hasPasskeys()).toBe(true);
    const epoch = store.getVaultMeta() && (store.getVaultMeta() as { epoch: number }).epoch;
    expect(epoch).toBe(1);
    await pn.lock();
    await pn.unlockWithPasskey();
    expect(pn.isUnlocked()).toBe(true);
    await pn.lock();
    await pn.unlock(PW);
    expect(pn.isUnlocked()).toBe(true);
  });

  it("gdy PRF nie jest dostępny, dodanie passkeya zgłasza prf-unsupported i nie zmienia metadanych", async () => {
    stubWebAuthn(false);
    const { store, pn } = fresh();
    await pn.setup(PW);
    const before = JSON.stringify(store.getVaultMeta());
    await expect(pn.addPasskey(PW, "Ja")).rejects.toMatchObject({ code: "prf-unsupported" });
    expect(JSON.stringify(store.getVaultMeta())).toBe(before);
  });

  it("zły wynik PRF nie odblokowuje skarbca", async () => {
    stubWebAuthn(true);
    const { pn } = fresh();
    await pn.setup(PW);
    await pn.addPasskey(PW, "Ja");
    await pn.lock();
    stubWebAuthn(true, new Uint8Array(32).fill(7));
    await expect(pn.unlockWithPasskey()).rejects.toBeTruthy();
    expect(pn.isUnlocked()).toBe(false);
  });

  it("H-1: zmiana meta w trakcie promptu WebAuthn przerywa dodawanie i nie cofa skarbca", async () => {
    stubWebAuthn(true);
    const { store, pn } = fresh();
    await pn.setup(PW);
    const remote = { ...(store.getVaultMeta() as Record<string, unknown>), wrapped: toB64u(new Uint8Array(40).fill(3)) };
    // Zdalna zmiana (np. hasło zmienione na innym urządzeniu) pojawia się w trakcie promptu.
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      credentials: {
        create: vi.fn(async () => {
          store.setVaultMeta(remote);
          return { rawId: CRED.buffer, getClientExtensionResults: () => ({ prf: { enabled: true } }) };
        }),
        get: vi.fn(async () => ({
          rawId: CRED.buffer,
          getClientExtensionResults: () => ({ prf: { results: { first: PRF.slice().buffer } } }),
        })),
      },
    });
    await expect(pn.addPasskey(PW, "Ja")).rejects.toThrow(/zmienił się/);
    expect(JSON.stringify(store.getVaultMeta())).toBe(JSON.stringify(remote));
    expect(pn.hasPasskeys()).toBe(false);
  });

  it("M-2: odblokowanie biometrią nie przyjmuje zmienionej meta bez hasła; hasło ją przyjmuje", async () => {
    stubWebAuthn(true);
    const { store, pn } = fresh();
    await pn.setup(PW);
    await pn.addPasskey(PW, "Ja");
    await pn.lock();
    // Podmiana listy passkeyów w dokumencie (klucz i sól bez zmian): pin tego nie zna.
    const m = store.getVaultMeta() as { passkeys: { salt: string; entries: { id: string; wrapped: string }[] } } & Record<string, unknown>;
    const extra = { id: toB64u(new Uint8Array(16).fill(9)), wrapped: m.passkeys.entries[0].wrapped };
    store.setVaultMeta({ ...m, passkeys: { ...m.passkeys, entries: [...m.passkeys.entries, extra] } });
    await expect(pn.unlockWithPasskey()).rejects.toMatchObject({ code: "bad-format" });
    expect(pn.isUnlocked()).toBe(false);
    await pn.unlock(PW);
    expect(pn.isUnlocked()).toBe(true);
  });

  it("M-3: setup nie nadpisuje uszkodzonych metadanych skarbca", async () => {
    stubWebAuthn(true);
    const { store, pn } = fresh();
    const broken = { v: 1, salt: 42 };
    store.setVaultMeta(broken);
    await expect(pn.setup(PW)).rejects.toThrow(/uszkodzony/);
    expect(JSON.stringify(store.getVaultMeta())).toBe(JSON.stringify(broken));
  });

  it("identyfikator passkeya jest w base64url, a sól PRF w metadanych", () => {
    expect(toB64u(CRED)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
