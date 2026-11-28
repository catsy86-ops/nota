/**
 * K2 (wariant minimalny KR-5 + KR-6): reset kodem awaryjnym dopisuje stary klucz do łańcucha i go przepakowuje,
 * zwykła zmiana hasła usuwa wpisy `rekey` (działa jak „hasło mogło wyciec”). Zapis w jednej transakcji z nowym kluczem.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createYjsStore } from "@/lib/yjsStore";
import { createPrivateNotes } from "@/lib/privateNotes";
import { createVersionsStore } from "@/lib/versionsStore";
import { parseRetired, metaFingerprint, type VaultMeta } from "@/lib/vault";

const IT = 1000;
const PW = "hasło-do-testów-12345";
const PW2 = "nowe-hasło-98765-abc";
const PW3 = "trzecie-hasło-55555-x";

function fresh() {
  const store = createYjsStore(`vault-k2-${crypto.randomUUID()}`);
  const versions = createVersionsStore(`vault.k2.${crypto.randomUUID()}.`);
  const pn = createPrivateNotes(store, { iterations: IT, minIterations: IT, writeDelayMs: 5, versions });
  return { store, pn };
}

const local = () => JSON.parse(localStorage.getItem("kaczy.vault.retired.v1") ?? "[]") as unknown[];

beforeEach(() => { localStorage.clear(); });

describe("K2 — łańcuch przy zmianie klucza", () => {
  it("reset kodem: wpis rekey z epoką i odciskiem starego skarbca, kopia lokalna; drugi reset przepakowuje i dopisuje", async () => {
    const d = fresh();
    const { recoveryCode } = await d.pn.setup(PW);
    const m1 = d.store.getVaultMeta() as VaultMeta;
    const r1 = await d.pn.resetPasswordWithRecovery(recoveryCode!, PW2);
    const m2 = d.store.getVaultMeta() as VaultMeta;
    const fp2 = await metaFingerprint(m2);
    const chain1 = d.store.getRetiredEntries();
    expect(chain1).toHaveLength(1);
    const e1 = parseRetired(chain1[0][0], chain1[0][1], fp2)!;
    expect(e1).toMatchObject({ src: "rekey", epoch: m1.epoch, fp: await metaFingerprint(m1) });
    expect(local()).toHaveLength(1);

    await d.pn.resetPasswordWithRecovery(r1.recoveryCode!, PW3);
    const chain2 = d.store.getRetiredEntries();
    expect(chain2.map(([k]) => k)).toContain(chain1[0][0]);
    expect(chain2).toHaveLength(2);
    const moved = chain2.find(([k]) => k === chain1[0][0])![1] as { iv: string };
    expect(moved.iv).not.toBe(e1.iv);
  });

  it("zwykła zmiana hasła: bez nowego wpisu, wpisy rekey usunięte z dokumentu i kopii lokalnej", async () => {
    const d = fresh();
    const { recoveryCode } = await d.pn.setup(PW);
    await d.pn.resetPasswordWithRecovery(recoveryCode!, PW2);
    expect(d.store.getRetiredEntries()).toHaveLength(1);
    await d.pn.changePassword(PW2, PW3);
    expect(d.store.getRetiredEntries()).toHaveLength(0);
    expect(local()).toHaveLength(0);
    expect(d.pn.phase()).toBe("unlocked");
  });

  it("łańcuch zmieniony w trakcie przerywa zapis (warunek obejmuje klucze retired:*)", async () => {
    const d = fresh();
    const { recoveryCode } = await d.pn.setup(PW);
    const original = d.store.rekeyVault;
    d.store.rekeyVault = (meta, next, check, trash, retired) => { d.store.doc.getMap("vault").set("retired:5:wtrakcie", { v: 1 }); return original(meta, next, check, trash, retired); };
    await expect(d.pn.resetPasswordWithRecovery(recoveryCode!, PW2)).rejects.toThrow(/zmieniły się/);
  });

  it("wartość bigint pod kluczem retired:* nie blokuje zmiany hasła ani resetu (przegląd M-1)", async () => {
    const d = fresh();
    const { recoveryCode } = await d.pn.setup(PW);
    d.store.doc.getMap("vault").set("retired:1:smiec", 1n);
    const r = await d.pn.resetPasswordWithRecovery(recoveryCode!, PW2);
    expect(d.store.getRetiredEntries().map(([k]) => k)).not.toContain("retired:1:smiec");
    d.store.doc.getMap("vault").set("retired:2:smiec", { x: 2n });
    await d.pn.changePassword(PW2, PW3);
    expect(d.store.getRetiredEntries()).toHaveLength(0);
    expect(r.recoveryCode).toBeTruthy();
  });

  it("zegar spóźniony: właśnie wycofany klucz jest najnowszy i zostaje w limicie (przegląd L-1)", async () => {
    const d = fresh();
    let { recoveryCode } = await d.pn.setup(PW);
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 10 * 86_400_000;
      for (const pw of [PW2, PW3, PW]) ({ recoveryCode } = await d.pn.resetPasswordWithRecovery(recoveryCode!, pw));
      Date.now = () => realNow() - 10 * 86_400_000;
      const before = d.store.getVaultMeta() as VaultMeta;
      await d.pn.resetPasswordWithRecovery(recoveryCode!, PW2);
      const chain = d.store.getRetiredEntries();
      expect(chain).toHaveLength(3);
      expect(chain.map(([k]) => k)).toContain(`retired:${before.epoch}:${await metaFingerprint(before)}`);
    } finally { Date.now = realNow; }
  });

  it("reset kodem przy podmienionej samej epoce: odmowa przed zapisem (przegląd L-2)", async () => {
    const d = fresh();
    const { recoveryCode } = await d.pn.setup(PW);
    await d.pn.lock();
    const m = d.store.getVaultMeta() as VaultMeta;
    d.store.setVaultMeta({ ...m, epoch: m.epoch + 1 });
    await expect(d.pn.resetPasswordWithRecovery(recoveryCode!, PW2)).rejects.toMatchObject({ code: "bad-format" });
    expect(d.store.getRetiredEntries()).toHaveLength(0);
  });
});
