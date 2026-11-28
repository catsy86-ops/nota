/** K2 planu Skarbca krypto (§3.1–3.2, testy z §6 pkt 2 i 4): format, walidacja i przepakowanie łańcucha wycofanych kluczy. */
import { describe, expect, it } from "vitest";
import {
  cleanRetired, importDataKey, metaFingerprint, parseRetired, randomBytes, retiredMapKey, rewrapRetired, unwrapRetired, wrapRetired,
  RETIRED_MAX_RAW, type RetiredKey,
} from "./vault";

const key = () => importDataKey(randomBytes(32));
const FP = "A".repeat(22);
const head = (over: Partial<RetiredKey> = {}) => ({ epoch: 1, fp: FP, src: "rekey" as const, retiredAt: 1000, ...over });
const asEntry = (e: RetiredKey): [string, unknown] => [retiredMapKey(e.epoch, e.fp), e];

describe("łańcuch wycofanych kluczy (K2)", () => {
  it("odcisk: 22 znaki base64url, zależny od metadanych", async () => {
    const a = await metaFingerprint({ epoch: 1, salt: "s", wrapped: "w", check: "c" });
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await metaFingerprint({ epoch: 2, salt: "s", wrapped: "w", check: "c" })).not.toBe(a);
  });

  it("opakowanie i odpakowanie; zmienione src albo retiredAt (AAD) i obcy klucz nie odpakowują", async () => {
    const cur = await key();
    const raw = randomBytes(32);
    const e = await wrapRetired(cur, raw, head());
    expect(Array.from(await unwrapRetired(cur, e))).toEqual(Array.from(raw));
    await expect(unwrapRetired(cur, { ...e, src: "foreign" })).rejects.toMatchObject({ code: "decrypt-failed" });
    await expect(unwrapRetired(cur, { ...e, retiredAt: 9999 })).rejects.toMatchObject({ code: "decrypt-failed" });
    await expect(unwrapRetired(await key(), e)).rejects.toMatchObject({ code: "decrypt-failed" });
  });

  it("kształt: dokładnie znane pola, klucz mapy zgodny, odcisk różny od bieżącego", async () => {
    const e = await wrapRetired(await key(), randomBytes(32), head());
    const k = retiredMapKey(1, FP);
    expect(parseRetired(k, e, "B".repeat(22))).toEqual(e);
    expect(parseRetired(k, e, FP)).toBeNull();
    expect(parseRetired(retiredMapKey(2, FP), e, "B".repeat(22))).toBeNull();
    expect(parseRetired(k, { ...e, extra: 1 }, "B".repeat(22))).toBeNull();
    expect(parseRetired(k, { ...e, epoch: 1.5 }, "B".repeat(22))).toBeNull();
    expect(parseRetired(k, { ...e, iv: "krótkie" }, "B".repeat(22))).toBeNull();
  });

  it("walidacja: 17 wpisów odrzuca łańcuch; śmieć obok dobrych nie wyłącza łańcucha; 3 rekey + 1 foreign, najnowsze", async () => {
    const cur = await key();
    const tooMany = Array.from({ length: RETIRED_MAX_RAW + 1 }, (_, i) => [`retired:${i}:x`, {}] as [string, unknown]);
    expect((await cleanRetired(tooMany, cur, "C".repeat(22))).overflow).toBe(true);
    const fp = (i: number) => String.fromCharCode(65 + i).repeat(22);
    const rekeys = await Promise.all([1, 2, 3, 4].map((i) => wrapRetired(cur, randomBytes(32), head({ epoch: i, fp: fp(i), retiredAt: i * 100 }))));
    const foreign = await wrapRetired(cur, randomBytes(32), head({ epoch: 1, fp: fp(9), src: "foreign", retiredAt: 1 }));
    const alien = await wrapRetired(await key(), randomBytes(32), head({ epoch: 7, fp: fp(7) }));
    const res = await cleanRetired([...rekeys.map(asEntry), asEntry(foreign), asEntry(alien), ["retired:1:zly", { v: 1 }]], cur, "Z".repeat(22));
    expect(res.overflow).toBe(false);
    expect(res.valid.map((e) => `${e.src}:${e.epoch}`)).toEqual(["rekey:4", "rekey:3", "rekey:2", "foreign:1"]);
    expect(res.bad.sort()).toEqual([retiredMapKey(1, fp(1)), retiredMapKey(7, fp(7)), "retired:1:zly"].sort());
  });

  it("przepakowanie: ten sam klucz mapy i surowy klucz, nowe iv, odpakowuje się tylko nowym kluczem", async () => {
    const oldK = await key();
    const newK = await key();
    const raw = randomBytes(32);
    const e = await wrapRetired(oldK, raw, head());
    const r = await rewrapRetired(oldK, newK, e);
    expect(retiredMapKey(r.epoch, r.fp)).toBe(retiredMapKey(e.epoch, e.fp));
    expect(r.iv).not.toBe(e.iv);
    expect(Array.from(await unwrapRetired(newK, r))).toEqual(Array.from(raw));
    await expect(unwrapRetired(oldK, r)).rejects.toMatchObject({ code: "decrypt-failed" });
  });
});
