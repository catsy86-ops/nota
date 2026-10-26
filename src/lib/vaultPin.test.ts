import { beforeEach, describe, expect, it } from "vitest";
import { comparePin, readVaultPin, writeVaultPin } from "./vaultPin";
import type { VaultMeta } from "./vault";

const meta = (over: Partial<VaultMeta> = {}): VaultMeta => ({ v: 1, salt: "S", iter: 600000, wrapped: "W", check: "C", epoch: 1, ...over });

describe("pin skarbca (W-1)", () => {
  beforeEach(() => localStorage.clear());

  it("bez pinu: none; zapisany pin wraca przez odczyt", () => {
    expect(comparePin(readVaultPin(), meta())).toBe("none");
    writeVaultPin(meta());
    expect(readVaultPin()).toEqual({ epoch: 1, salt: "S", wrapped: "W", check: "C" });
    expect(comparePin(readVaultPin(), meta())).toBe("same");
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
