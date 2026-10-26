import { beforeEach, describe, expect, it } from "vitest";
import { comparePin, readVaultPin, writeVaultPin } from "./vaultPin";
import type { VaultMeta } from "./vault";

const meta = (over: Partial<VaultMeta> = {}): VaultMeta => ({ v: 1, salt: "S", iter: 600000, wrapped: "W", check: "C", epoch: 1, ...over });

describe("pin skarbca (W-1)", () => {
  beforeEach(() => localStorage.clear());

  it("bez pinu: none; zapisany pin wraca przez odczyt", () => {
    expect(comparePin(readVaultPin(), meta())).toBe("none");
    writeVaultPin(meta());
    expect(readVaultPin()).toEqual({ epoch: 1, salt: "S", wrapped: "W", check: "C", extra: '{"passkeys":null,"recovery":null}' });
    expect(comparePin(readVaultPin(), meta())).toBe("same");
  });

  it("zmiana listy passkeyów albo kodu awaryjnego przy tym samym kluczu to changed (M-1)", () => {
    writeVaultPin(meta());
    const pk = { salt: "P", entries: [{ id: "a", wrapped: "x" }] };
    expect(comparePin(readVaultPin(), meta({ passkeys: pk }))).toBe("changed");
    expect(comparePin(readVaultPin(), meta({ recovery: { salt: "R", wrapped: "y" } as VaultMeta["recovery"] }))).toBe("changed");
    writeVaultPin(meta({ passkeys: pk }));
    expect(comparePin(readVaultPin(), meta({ passkeys: pk }))).toBe("same");
    expect(comparePin(readVaultPin(), meta({ passkeys: { salt: "P", entries: [] } }))).toBe("changed");
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
