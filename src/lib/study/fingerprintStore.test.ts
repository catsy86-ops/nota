import { beforeEach, describe, expect, it } from "vitest";
import { fingerprintCode, normalizeFingerprintInput } from "./documentFingerprint";
import { cleanFingerprints, fingerprintStore, lookupFingerprint, registerFingerprint, FINGERPRINTS_MAX, type StoredFingerprint } from "./fingerprintStore";

const H1 = "3f2a91c077ddb1e45a60c2d9" + "0".repeat(40);
const H2 = "aaaabbbbccccdddd11112222" + "1".repeat(40);
const entry = (hash: string, at = 1_700_000_000_000): StoredFingerprint => ({ hash, site: "Lipowa 5", kind: "protokół odbioru", at });

beforeEach(() => { fingerprintStore.set([]); });

describe("kod odcisku", () => {
  it("fingerprintCode: 24 znaki hex wielkimi literami w grupach po 4", () => {
    expect(fingerprintCode(H1)).toBe("3F2A-91C0-77DD-B1E4-5A60-C2D9");
  });
  it("normalizeFingerprintInput: myślniki, spacje i małe litery nie przeszkadzają", () => {
    expect(normalizeFingerprintInput(" 3f2a 91c0-77dd ")).toBe("3F2A91C077DD");
  });
});

describe("zapis i sprawdzanie odcisków", () => {
  it("znajduje dokument po kodzie ze stopki, także wpisanym luźno", () => {
    registerFingerprint(entry(H1));
    registerFingerprint(entry(H2));
    const list = fingerprintStore.get();
    const hit = lookupFingerprint("3f2a-91c0-77dd-b1e4-5a60-c2d9", list);
    expect(hit.state).toBe("found");
    expect(lookupFingerprint("3F2A91C077DD", list).state).toBe("found"); // 12 znaków wystarcza
  });

  it("za krótki wpis, pusty wpis i nieznany kod dają osobne wyniki", () => {
    registerFingerprint(entry(H1));
    const list = fingerprintStore.get();
    expect(lookupFingerprint("", list).state).toBe("empty");
    expect(lookupFingerprint("3F2A-91C0", list).state).toBe("short");
    expect(lookupFingerprint("3F2A-91C0-77DD-0000", list).state).toBe("missing"); // zmieniony dokument = inny kod
  });

  it("ten sam skrót nie dubluje wpisu, a lista ma limit", () => {
    registerFingerprint(entry(H1));
    registerFingerprint(entry(H1, 2));
    expect(fingerprintStore.get()).toHaveLength(1);
    const many = Array.from({ length: FINGERPRINTS_MAX + 20 }, (_, i) => entry(i.toString(16).padStart(64, "0"), i + 1));
    expect(cleanFingerprints(many)).toHaveLength(FINGERPRINTS_MAX);
  });

  it("cleanFingerprints: odrzuca śmieci i skróty o złym kształcie", () => {
    expect(cleanFingerprints([null, "x", { hash: "abc", at: 1 }, { hash: H1, at: -5 }, entry(H1)])).toEqual([entry(H1)]);
    expect(cleanFingerprints("nie lista")).toEqual([]);
  });
});
