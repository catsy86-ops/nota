import { describe, it, expect } from "vitest";
import { readTextFile } from "./readTextFile";

describe("readTextFile (Plan-nowy 1.10)", () => {
  it("czyta plik w limicie", async () => {
    // jsdom nie ma `Blob.text()` — atrapa z rozmiarem i odczytem.
    const file = { name: "a.ics", size: 15, text: async () => "BEGIN:VCALENDAR" } as unknown as File;
    expect(await readTextFile(file)).toBe("BEGIN:VCALENDAR");
  });

  it("za duży plik odrzuca przed czytaniem, z nazwą w komunikacie", async () => {
    const big = new File(["x".repeat(2048)], "duzy.ics");
    await expect(readTextFile(big, 1024)).rejects.toThrow("Plik „duzy.ics” jest za duży");
  });
});
