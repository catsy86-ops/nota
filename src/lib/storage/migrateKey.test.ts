import { beforeEach, describe, expect, it } from "vitest";
import { dropOldKey, migrateKey, migrateKeySync } from "./migrateKey";

const OLD = "kaczy.test.v1";
const NEW = "kaczy.test.v2";
const toV2 = (raw: string) => { const v = JSON.parse(raw); return typeof v === "number" ? JSON.stringify({ n: v }) : null; };

describe("migrateKey (D6.3)", () => {
  beforeEach(() => localStorage.clear());

  it("przenosi stary klucz i zostawia go do następnego wydania", async () => {
    localStorage.setItem(OLD, "5");
    expect(await migrateKey(OLD, NEW, toV2)).toBe("migrated");
    expect(localStorage.getItem(NEW)).toBe('{"n":5}');
    expect(localStorage.getItem(OLD)).toBe("5");
  });

  it("nie nadpisuje istniejącego nowego klucza (drugi przebieg, druga karta)", () => {
    localStorage.setItem(OLD, "5");
    localStorage.setItem(NEW, '{"n":9}');
    expect(migrateKeySync(OLD, NEW, toV2)).toBe("already");
    expect(localStorage.getItem(NEW)).toBe('{"n":9}');
  });

  it("bez źródła nic nie robi", () => {
    expect(migrateKeySync(OLD, NEW, toV2)).toBe("no-source");
    expect(localStorage.getItem(NEW)).toBeNull();
  });

  it("zły kształt: nowy nie powstaje, stary zostaje", () => {
    localStorage.setItem(OLD, "{zepsute");
    expect(migrateKeySync(OLD, NEW, toV2)).toBe("rejected");
    expect(localStorage.getItem(NEW)).toBeNull();
    expect(localStorage.getItem(OLD)).toBe("{zepsute");
  });

  it("dropOldKey usuwa stary tylko, gdy nowy istnieje", () => {
    localStorage.setItem(OLD, "5");
    expect(dropOldKey(OLD, NEW)).toBe(false);
    expect(localStorage.getItem(OLD)).toBe("5");
    localStorage.setItem(NEW, '{"n":5}');
    expect(dropOldKey(OLD, NEW)).toBe(true);
    expect(localStorage.getItem(OLD)).toBeNull();
  });
});
