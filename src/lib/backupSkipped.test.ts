import { describe, it, expect } from "vitest";
import { describeBackupSkipped } from "./backupSkipped";

describe("describeBackupSkipped — nagrania osobno od zdjęć", () => {
  it("nagrania są nazwane jako nagrania, nie jako zdjęcia", () => {
    const text = describeBackupSkipped({ tooLarge: 0, missing: 0, journalPhotos: 0, siteDocs: 0, recordings: 2 });
    expect(text).toContain("nagrania głosowe z wpisów: 2");
    expect(text).not.toContain("zdjęcia dziennika");
    expect(text).toContain("Zdjęcia, nagrania i pliki budów");
  });

  it("starsza kopia bez pola recordings działa jak dotąd", () => {
    expect(describeBackupSkipped({ tooLarge: 0, missing: 0, journalPhotos: 1, siteDocs: 0 })).toContain("zdjęcia dziennika z budowy: 1");
  });

  it("kompletna kopia nie ma opisu", () => {
    expect(describeBackupSkipped({ tooLarge: 0, missing: 0, journalPhotos: 0, siteDocs: 0, recordings: 0 })).toBeNull();
  });
});
