import { beforeEach, describe, expect, it } from "vitest";
import { comparePin, PREV_HARD_LIMIT, PREV_MAX_AGE_MS, PREV_TTL_MS, readPrevHeaders, readVaultPin, rememberPrevHeader, trimPrevHeaders, withPinnedIter, writeVaultPin } from "./vaultPin";
import { isValidMeta } from "./vault";
import type { VaultMeta } from "./vault";

const meta = (over: Partial<VaultMeta> = {}): VaultMeta => ({ v: 1, salt: "S", iter: 600000, wrapped: "W", check: "C", epoch: 1, ...over });

describe("pin skarbca (W-1)", () => {
  beforeEach(() => localStorage.clear());

  it("bez pinu: none; zapisany pin wraca przez odczyt", () => {
    expect(comparePin(readVaultPin(), meta())).toBe("none");
    writeVaultPin(meta());
    expect(readVaultPin()).toEqual({ epoch: 1, salt: "S", wrapped: "W", check: "C", extra: '{"passkeys":null,"recovery":null}', iter: 600000 });
    expect(comparePin(readVaultPin(), meta())).toBe("same");
  });

  it("zmiana listy passkeyów albo kodu awaryjnego przy tym samym kluczu to changed (M-1)", () => {
    writeVaultPin(meta());
    const pk = { salt: "P", entries: [{ id: "a", wrapped: "x" }] };
    expect(comparePin(readVaultPin(), meta({ passkeys: pk }))).toBe("changed");
    expect(comparePin(readVaultPin(), meta({ recovery: "R-code" }))).toBe("changed");
    writeVaultPin(meta({ passkeys: pk }));
    expect(comparePin(readVaultPin(), meta({ passkeys: pk }))).toBe("same");
    expect(comparePin(readVaultPin(), meta({ passkeys: { salt: "P", entries: [] } }))).toBe("changed");
  });

  it("ta sama lista passkeyów z inną kolejnością pól to nadal same (kanoniczna postać)", () => {
    writeVaultPin(meta({ passkeys: { salt: "P", entries: [{ id: "a", wrapped: "x" }] } }));
    const reordered = { entries: [{ wrapped: "x", id: "a" }], salt: "P" } as unknown as VaultMeta["passkeys"];
    expect(comparePin(readVaultPin(), meta({ passkeys: reordered }))).toBe("same");
  });

  it("pin sprzed pola extra wymusza przyjęcie zmiany hasłem (changed), nie cichą zgodność", () => {
    localStorage.setItem("kaczy.vault.pin.v1", JSON.stringify({ epoch: 1, salt: "S", wrapped: "W", check: "C" }));
    expect(readVaultPin()?.extra).toBe("");
    expect(comparePin(readVaultPin(), meta())).toBe("changed");
  });

  it("ten sam klucz z innym numerem epoki to epoch-only (odrzucane), a zmiana opakowania to changed", () => {
    writeVaultPin(meta());
    expect(comparePin(readVaultPin(), meta({ epoch: 999 }))).toBe("epoch-only");
    expect(comparePin(readVaultPin(), meta({ wrapped: "X", epoch: 2 }))).toBe("changed");
  });

  it("uszkodzony pin w pamięci jest traktowany jak brak pinu", () => {
    localStorage.setItem("kaczy.vault.pin.v1", "{nie json");
    expect(readVaultPin()).toBeNull();
    localStorage.setItem("kaczy.vault.pin.v1", JSON.stringify({ epoch: "x" }));
    expect(readVaultPin()).toBeNull();
  });
});

describe("pin v2 i poprzednie nagłówki (K1)", () => {
  beforeEach(() => localStorage.clear());

  it("iter podmienione w dokumencie przy tym samym kluczu: iter-only, KDF z iter z pinu", () => {
    writeVaultPin(meta());
    const tampered = meta({ iter: 2_900_000 });
    expect(comparePin(readVaultPin(), tampered)).toBe("iter-only");
    expect(withPinnedIter(tampered)).toEqual({ meta: meta(), rejected: true });
    expect(withPinnedIter(meta())).toEqual({ meta: meta(), rejected: false });
  });

  it("pin sprzed K1 (bez iter): zgodny przy odczycie, iter uzupełnia następny zapis", () => {
    localStorage.setItem("kaczy.vault.pin.v1", JSON.stringify({ epoch: 1, salt: "S", wrapped: "W", check: "C", extra: '{"passkeys":null,"recovery":null}' }));
    expect(comparePin(readVaultPin(), meta({ iter: 700_000 }))).toBe("same");
    writeVaultPin(meta({ iter: 700_000 }));
    expect(readVaultPin()?.iter).toBe(700_000);
  });

  it("poprzedni nagłówek: tylko przy zmianie klucza, bez duplikatów, twardy limit 4, przycinanie do 2 i 30 dni", () => {
    writeVaultPin(meta());
    // Sam dopisany passkey nie zapisuje nagłówka.
    expect(rememberPrevHeader(readVaultPin(), meta({ passkeys: { salt: "P", entries: [] } }))).toBe(true);
    expect(readPrevHeaders()).toHaveLength(0);
    const now = Date.now();
    for (let i = 0; i < PREV_HARD_LIMIT; i++) {
      writeVaultPin(meta({ salt: `S${i}` }));
      expect(rememberPrevHeader(readVaultPin(), meta({ salt: `N${i}` }), now - i * 1000)).toBe(true);
    }
    expect(rememberPrevHeader(readVaultPin(), meta({ salt: "N0" }), now)).toBe(true); // duplikat
    writeVaultPin(meta({ salt: "piaty" }));
    expect(rememberPrevHeader(readVaultPin(), meta({ salt: "inny" }), now)).toBe(false);
    expect(readPrevHeaders()).toHaveLength(PREV_HARD_LIMIT);
    trimPrevHeaders(false, now);
    expect(readPrevHeaders()).toHaveLength(PREV_HARD_LIMIT);
    trimPrevHeaders(true, now);
    expect(readPrevHeaders().map((h) => h.salt)).toEqual(["S0", "S1"]);
    trimPrevHeaders(true, now + PREV_TTL_MS + 1);
    expect(readPrevHeaders()).toHaveLength(0);
  });

  it("iter z pinu także przy zmienionej epoce albo passkeyach; nagłówki ponad 180 dni znikają mimo failed", () => {
    writeVaultPin(meta());
    expect(withPinnedIter(meta({ iter: 9, epoch: 2 })).meta.iter).toBe(600000);
    const now = Date.now();
    writeVaultPin(meta({ salt: "A" }));
    rememberPrevHeader(readVaultPin(), meta({ salt: "B" }), now - PREV_MAX_AGE_MS - 1);
    trimPrevHeaders(false, now);
    expect(readPrevHeaders()).toHaveLength(0);
  });

  it("zapis bez potwierdzonego iter: stare iter tylko przy tym samym kluczu (przegląd N-1)", () => {
    writeVaultPin(meta());
    writeVaultPin(meta({ iter: 9 }), { iterVerified: false });
    expect(readVaultPin()?.iter).toBe(600000);
    writeVaultPin(meta({ salt: "NOWA", iter: 800000 }), { iterVerified: false });
    expect(readVaultPin()?.iter).toBeUndefined();
    expect(withPinnedIter(meta({ salt: "NOWA", iter: 800000 })).meta.iter).toBe(800000);
  });

  it("epoka w metadanych: całkowita 1…1 000 000", () => {
    for (const epoch of [1.5, -3, 1e300, 0, Number.NaN]) expect(isValidMeta(meta({ epoch })), String(epoch)).toBe(false);
    for (const epoch of [1, 7, 1_000_000]) expect(isValidMeta(meta({ epoch }))).toBe(true);
  });
});

