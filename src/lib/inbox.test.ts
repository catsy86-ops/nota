import { describe, it, expect } from "vitest";
import { captureParts, INBOX_TITLE_MAX, isInboxNote } from "./inbox";

describe("isInboxNote", () => {
  it("skrzynka to notatki bez folderu, bez etykiet i nie będące podnotatką", () => {
    expect(isInboxNote({ folderId: null, labels: [], parentId: null })).toBe(true);
  });

  it("posortowana notatka (folder, etykieta albo rodzic) nie jest w skrzynce", () => {
    expect(isInboxNote({ folderId: "f1", labels: [], parentId: null })).toBe(false);
    expect(isInboxNote({ folderId: null, labels: ["praca"], parentId: null })).toBe(false);
    expect(isInboxNote({ folderId: null, labels: [], parentId: "n1" })).toBe(false);
  });
});

describe("isInboxNote — prywatność", () => {
  it("zablokowana (prywatna) notatka bez folderu nie trafia do skrzynki ani do licznika", () => {
    expect(isInboxNote({ folderId: null, labels: [], parentId: null, locked: true })).toBe(false);
    expect(isInboxNote({ folderId: null, labels: [], parentId: null, locked: false })).toBe(true);
  });
});

describe("captureParts", () => {
  it("jednolinijkowy wpis staje się tytułem, bez dublowania w treści", () => {
    expect(captureParts("Kupić rury")).toEqual({ title: "Kupić rury", content: "" });
  });

  it("pierwsza linia to tytuł, reszta treść", () => {
    expect(captureParts("Zebranie\nagenda\nkoszt")).toEqual({ title: "Zebranie", content: "agenda\nkoszt" });
  });

  it("obcina tytuł do limitu", () => {
    const got = captureParts("x".repeat(INBOX_TITLE_MAX + 50));
    expect(got?.title).toHaveLength(INBOX_TITLE_MAX);
  });

  it("pusty tekst i same białe znaki nie tworzą notatki", () => {
    expect(captureParts("")).toBeNull();
    expect(captureParts("   \n  ")).toBeNull();
  });

  it("gdy pierwsza linia jest pusta, tytułem jest pierwsza niepusta linia", () => {
    expect(captureParts("\n\nTreść")).toEqual({ title: "Treść", content: "" });
  });

  it("normalizuje końce linii CRLF", () => {
    expect(captureParts("A\r\nB")).toEqual({ title: "A", content: "B" });
  });
});
