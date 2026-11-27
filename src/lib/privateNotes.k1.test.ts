/**
 * K1 (plan `docs/plan-skarbiec-krypto-2026-11-15.md`, §3.5.1, P4): `iter` podmienione w dokumencie przy kluczu zgodnym
 * z pinem nie daje fałszywego „złego hasła” — KDF liczy się z `iter` z pinu, z wpisem bezpieczeństwa, bez dławienia.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createYjsStore } from "@/lib/yjsStore";
import { createPrivateNotes } from "@/lib/privateNotes";
import { createVersionsStore } from "@/lib/versionsStore";
import { clearSecurityForTests, getSecurityEvents } from "@/lib/diagnostics";
import { readVaultPin } from "@/lib/vaultPin";
import type { VaultMeta } from "@/lib/vault";

const IT = 1000;
const PW = "hasło-do-testów-12345";

function fresh() {
  const store = createYjsStore(`vault-k1-${crypto.randomUUID()}`);
  const versions = createVersionsStore(`vault.k1.${crypto.randomUUID()}.`);
  const pn = createPrivateNotes(store, { iterations: IT, minIterations: IT, writeDelayMs: 5, versions });
  return { store, pn };
}

beforeEach(() => { localStorage.clear(); clearSecurityForTests(); });

describe("K1 — pin v2 i iter z pinu", () => {
  it("dobre hasło przy podmienionym iter odblokowuje; zdarzenie bezpieczeństwa; pin zachowuje prawdziwe iter", async () => {
    const d = fresh();
    await d.pn.setup(PW);
    await d.pn.lock();
    const m = d.store.getVaultMeta() as VaultMeta;
    d.store.setVaultMeta({ ...m, iter: IT + 7 });
    await d.pn.unlock(PW);
    expect(d.pn.phase()).toBe("unlocked");
    expect(getSecurityEvents().some((e) => e.kind === "vault-meta-rejected")).toBe(true);
    expect(getSecurityEvents().some((e) => e.kind === "vault-unlock-failed")).toBe(false);
    expect(readVaultPin()?.iter).toBe(IT);
  });

  it("epoka zmieniona razem z iter: odmowa przed KDF, bez nabijania licznika prób (przegląd M-1)", async () => {
    const d = fresh();
    await d.pn.setup(PW);
    await d.pn.lock();
    const m = d.store.getVaultMeta() as VaultMeta;
    d.store.setVaultMeta({ ...m, epoch: m.epoch + 1, iter: IT + 7 });
    await expect(d.pn.unlock(PW)).rejects.toMatchObject({ code: "bad-format" });
    expect(getSecurityEvents().some((e) => e.kind === "vault-unlock-failed")).toBe(false);
  });

  it("pin sprzed K1: odblokowanie kodem awaryjnym nie wpisuje do pinu iter, którego nie sprawdziło (przegląd M-2)", async () => {
    const d = fresh();
    const { recoveryCode } = await d.pn.setup(PW);
    await d.pn.lock();
    const pin = JSON.parse(localStorage.getItem("kaczy.vault.pin.v1")!);
    delete pin.iter;
    localStorage.setItem("kaczy.vault.pin.v1", JSON.stringify(pin));
    const m = d.store.getVaultMeta() as VaultMeta;
    d.store.setVaultMeta({ ...m, iter: IT + 7 });
    await d.pn.unlockWithRecoveryCode(recoveryCode!);
    expect(d.pn.phase()).toBe("unlocked");
    expect(readVaultPin()?.iter).toBeUndefined();
  });
});

