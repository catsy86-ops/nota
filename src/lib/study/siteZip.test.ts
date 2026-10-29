import { describe, expect, it } from "vitest";
import { buildSiteZip } from "./siteZip";
import type { JournalReport } from "./report";

const REF_A = "a".repeat(64);
const REF_B = "b".repeat(64);
const REF_C = "c".repeat(64);

const report: JournalReport = {
  title: "Raport: Lipowa — 14 października 2026",
  period: "14 października 2026",
  site: "Lipowa",
  address: "",
  investor: "",
  days: [],
  count: 0,
  workMinutes: 0,
  open: [],
  images: [REF_A, REF_B, REF_C],
  captions: {},
  fittings: [], pipes: [],
  toOrder: [],
  stages: null,
  shortages: [],
  recordings: [],
};

const bytes = (...b: number[]) => new Uint8Array(b).buffer;

/** Nazwy plików i treść są w archiwum bez kompresji, więc można je odczytać wprost. */
const text = (zip: Uint8Array) => new TextDecoder("utf-8").decode(zip);

describe("buildSiteZip", () => {
  it("zapisuje raport i zdjęcia z numerami w kolejności raportu", async () => {
    const read = async (ref: string) => {
      if (ref === REF_A) return { bytes: bytes(1, 2, 3), type: "image/jpeg" };
      if (ref === REF_C) return { bytes: bytes(4, 5), type: "image/png" };
      return undefined;
    };
    const zip = await buildSiteZip(report, read, new Date(2026, 9, 16));
    const names = text(zip.bytes);
    expect(names).toContain("raport.md");
    expect(names).toContain("zdjecia/01.jpg");
    expect(names).toContain("zdjecia/03.png");
    expect(names).not.toContain("zdjecia/02");
    expect(names).toContain("Raport: Lipowa");
    expect(zip.photos).toBe(2);
    expect(zip.missingPhotos).toBe(1);
  });

  it("bez zdjęć zostaje sam raport", async () => {
    const zip = await buildSiteZip({ ...report, images: [] }, async () => undefined, new Date(2026, 9, 16));
    expect(text(zip.bytes)).toContain("raport.md");
    expect(text(zip.bytes)).not.toContain("zdjecia/");
    expect(zip.photos).toBe(0);
    expect(zip.missingPhotos).toBe(0);
  });

  it("błąd odczytu zdjęcia liczy się jak brak bajtów i nie przerywa paczki", async () => {
    const read = async (ref: string) => {
      if (ref === REF_A) throw new Error("idb");
      return { bytes: bytes(9), type: "image/jpeg" };
    };
    const zip = await buildSiteZip(report, read, new Date(2026, 9, 16));
    expect(zip.missingPhotos).toBe(1);
    expect(zip.photos).toBe(2);
    expect(text(zip.bytes)).toContain("zdjecia/02.jpg");
  });
});

describe("buildSiteZip — dokumenty budowy", () => {
  it("plany i dokumenty w katalogu dokumenty/ pod własnymi nazwami, bez nadpisań", async () => {
    const read = async (ref: string) => (ref === REF_B ? undefined : { bytes: bytes(9), type: ref === REF_A ? "application/pdf" : "image/jpeg" });
    const docs = [
      { id: REF_A, name: "Rzut parteru.pdf", size: 1, type: "application/pdf", at: 1 },
      { id: REF_C, name: "Rzut parteru.pdf", size: 1, type: "image/jpeg", at: 2 },
      { id: REF_B, name: "brak.jpg", size: 1, type: "image/jpeg", at: 3 },
    ];
    const zip = await buildSiteZip({ ...report, images: [] }, read, new Date(2026, 9, 16), docs);
    const names = text(zip.bytes);
    expect(names).toContain("dokumenty/Rzut parteru.pdf");
    expect(names).toContain("dokumenty/Rzut parteru (2).pdf");
    expect(zip).toMatchObject({ docs: 2, missingDocs: 1, photos: 0 });
  });
});

describe("nagrania w paczce (1.10 planu Praca 2026-10-24)", () => {
  it("nagrania idą do `nagrania/` pod własnymi nazwami; brak bajtów liczy się osobno", async () => {
    const withAudio: JournalReport = {
      ...report,
      images: [],
      captions: {},
      recordings: [
        { hash: "h1", name: "Nagranie 2026-10-14 08-15.webm", size: 3, type: "audio/webm" },
        { hash: "h2", name: "Nagranie 2026-10-14 08-15.webm", size: 3, type: "audio/webm" },
        { hash: "h3", name: "Nagranie 2026-10-14 09-00.webm", size: 3, type: "audio/webm" },
      ],
    };
    const read = async (ref: string) => (ref === "h3" ? undefined : { bytes: bytes(1, 2, 3), type: "audio/webm" });
    const zip = await buildSiteZip(withAudio, read, new Date(2026, 9, 14));
    expect([zip.recordings, zip.missingRecordings]).toEqual([2, 1]);
    expect(text(zip.bytes)).toContain("nagrania/Nagranie 2026-10-14 08-15.webm");
    expect(text(zip.bytes)).toContain("nagrania/Nagranie 2026-10-14 08-15 (2).webm");
  });
});
