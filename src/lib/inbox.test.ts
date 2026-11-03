import { describe, it, expect } from "vitest";
import { captureParts, inboxAgeDays, inboxAgeLabel, INBOX_TITLE_MAX, isInboxNote, linkCapture, triageHeadline } from "./inbox";

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

describe("odłożenie ze Skrzynki (S-1)", () => {
  const base = { labels: [] as string[], folderId: null, parentId: null };
  it("odłożona notatka nie jest w Skrzynce do swojego terminu, potem wraca", () => {
    const now = Date.now();
    expect(isInboxNote({ ...base, snoozedUntil: now + 60_000 })).toBe(false);
    expect(isInboxNote({ ...base, snoozedUntil: now - 1 })).toBe(true);
    expect(isInboxNote({ ...base, snoozedUntil: 0 })).toBe(true);
    expect(isInboxNote(base)).toBe(true);
  });
});

describe("triageHeadline (Skrzynka 1.3)", () => {
  const NL = String.fromCharCode(10);
  it("z tytułem — tytuł i treść jako podgląd", () => {
    expect(triageHeadline({ title: " Rury ", content: "50 m" })).toEqual({ title: "Rury", preview: "50 m" });
  });
  it("bez tytułu — pierwsza niepusta linia, reszta w podglądzie", () => {
    expect(triageHeadline({ title: "", content: `${NL}  Zadzwonić do hurtowni ${NL}o rabat${NL}jutro` })).toEqual({ title: "Zadzwonić do hurtowni", preview: `o rabat${NL}jutro` });
  });
  it("bez tytułu i treści — „Bez tytułu”", () => {
    expect(triageHeadline({ title: " ", content: " " })).toEqual({ title: "Bez tytułu", preview: "" });
  });
});

describe("linkCapture (2.4)", () => {
  it("sam adres: tytuł z domeny i ścieżki, adres w treści", () => {
    expect(linkCapture(" https://www.castorama.pl/kolano-16mm/ ")).toEqual({ title: "castorama.pl/kolano-16mm", content: "https://www.castorama.pl/kolano-16mm/" });
    expect(linkCapture("https://pl.wikipedia.org/wiki/Mied%C5%BA?x=1")).toEqual({ title: "pl.wikipedia.org/wiki/Miedź", content: "https://pl.wikipedia.org/wiki/Mied%C5%BA?x=1" });
    expect(linkCapture("http://example.com")).toEqual({ title: "example.com", content: "http://example.com" });
  });

  it("tekst z linkiem, inne schematy i zwykły tekst to nie link", () => {
    expect(linkCapture("zobacz https://example.com")).toBeNull();
    expect(linkCapture("javascript:alert(1)")).toBeNull();
    expect(linkCapture("Kupić rury")).toBeNull();
  });
});

describe("wiek notatki w Skrzynce (4.3)", () => {
  const now = new Date(2026, 10, 3, 8, 0).getTime();
  it("liczy dni kalendarzowe: dziś, od wczoraj, od N dni", () => {
    expect(inboxAgeLabel(new Date(2026, 10, 3, 0, 5).getTime(), now)).toBe("dziś");
    expect(inboxAgeLabel(new Date(2026, 10, 2, 23, 50).getTime(), now)).toBe("od wczoraj");
    expect(inboxAgeLabel(new Date(2026, 9, 31, 9, 0).getTime(), now)).toBe("od 3 dni");
    expect(inboxAgeLabel(new Date(2026, 9, 12, 9, 0).getTime(), now)).toBe("od 22 dni");
  });
  it("zmiana czasu (koniec października) nie gubi dnia, przyszłość to 0", () => {
    expect(inboxAgeDays(new Date(2026, 9, 24, 12).getTime(), new Date(2026, 9, 26, 12).getTime())).toBe(2);
    expect(inboxAgeDays(now + 86_400_000, now)).toBe(0);
  });
});
