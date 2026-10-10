import { describe, it, expect } from "vitest";
import { looksLikeKeepJson, mapKeepColor, parseKeepHeadingDate, parseKeepHtml, parseKeepJson } from "./keep";
import { KEEP_IMAGE_JSON, KEEP_LIST_HTML, KEEP_LIST_JSON, KEEP_TEXT_HTML, KEEP_TEXT_JSON, KEEP_TRASHED_JSON } from "./__fixtures__/samples";

describe("parseKeepJson", () => {
  it("mapuje notatkę tekstową: kolor, przypięcie, etykiety, czasy i link", () => {
    const n = parseKeepJson(KEEP_TEXT_JSON, "Keep/Urodziny.json")!;
    expect(n.title).toBe("Urodziny");
    expect(n.content).toBe("Kupić prezent dla mamy\nsprawdzić godziny otwarcia\n\n[Sklep](https://example.com/sklep)");
    expect(n.color).toBe("sand");
    expect(n.pinned).toBe(true);
    expect(n.archived).toBe(false);
    expect(n.labels).toEqual(["Rodzina", "Ważne"]);
    expect(n.createdAt).toBe(1615982591000);
    expect(n.updatedAt).toBe(1616000000000);
  });

  it("mapuje listę na checklistę i pomija puste pozycje", () => {
    const n = parseKeepJson(KEEP_LIST_JSON, "Keep/Zakupy.json")!;
    expect(n.checklist).toEqual([{ text: "mleko", checked: true }, { text: "chleb", checked: false }]);
    expect(n.archived).toBe(true);
    expect(n.color).toBe("mint");
  });

  it("oznacza kosz i zbiera załączniki", () => {
    expect(parseKeepJson(KEEP_TRASHED_JSON, "k.json")!.trashed).toBe(true);
    const n = parseKeepJson(KEEP_IMAGE_JSON, "k.json")!;
    expect(n.attachments).toEqual([
      { filePath: "paragon.jpg", mimeType: "image/jpeg" },
      { filePath: "nagranie.3gp", mimeType: "audio/3gpp" },
    ]);
  });

  it("zwraca null dla obcego JSON-a i rzuca dla uszkodzonego", () => {
    expect(parseKeepJson(JSON.stringify({ theme: "dark" }), "x.json")).toBeNull();
    expect(parseKeepJson("[]", "x.json")).toBeNull();
    expect(() => parseKeepJson("{nie json", "x.json")).toThrow();
  });

  it("nie ufa typom: pola o złym typie dają bezpieczne wartości", () => {
    const n = parseKeepJson(JSON.stringify({
      title: 5, textContent: { a: 1 }, color: 7, isPinned: "tak", createdTimestampUsec: "abc",
      labels: [null, { name: 3 }, "Str"], listContent: "x", attachments: [1, { filePath: 4 }],
      annotations: [{ url: "javascript:alert(1)", title: "zły" }], isTrashed: false,
    }), "x.json")!;
    expect(n.title).toBe("");
    expect(n.content).toBe("");
    expect(n.color).toBe("default");
    expect(n.pinned).toBe(false);
    expect(n.createdAt).toBeNull();
    expect(n.labels).toEqual(["Str"]);
    expect(n.checklist).toEqual([]);
    expect(n.attachments).toEqual([]);
  });

  it("looksLikeKeepJson wymaga treści i metadanych", () => {
    expect(looksLikeKeepJson({ title: "a" })).toBe(false);
    expect(looksLikeKeepJson({ title: "a", color: "RED" })).toBe(true);
  });
});

describe("mapKeepColor", () => {
  it("mapuje znane kolory i ignoruje nieznane", () => {
    expect(mapKeepColor("RED")).toBe("coral");
    expect(mapKeepColor("CERULEAN")).toBe("sky");
    expect(mapKeepColor("PINK")).toBe("rose");
    expect(mapKeepColor("NIEZNANY")).toBe("default");
    expect(mapKeepColor(undefined)).toBe("default");
  });
});

describe("parseKeepHtml", () => {
  it("czyta tytuł, treść z <br>, etykiety, kolor, archiwum i datę — bez skryptów", () => {
    const n = parseKeepHtml(KEEP_TEXT_HTML, "Keep/Urodziny.html")!;
    expect(n.title).toBe("Urodziny");
    expect(n.content).toBe("Kupić prezent\nsprawdzić godziny & ceny");
    expect(n.content).not.toContain("alert");
    expect(n.labels).toEqual(["Rodzina"]);
    expect(n.color).toBe("sand");
    expect(n.archived).toBe(true);
    expect(n.createdAt).toBe(new Date(2021, 2, 17, 12, 3, 11).getTime());
  });

  it("czyta listę z odhaczeniami", () => {
    const n = parseKeepHtml(KEEP_LIST_HTML, "Keep/Zakupy.html")!;
    expect(n.checklist).toEqual([{ text: "chleb", checked: false }, { text: "mleko", checked: true }]);
    expect(n.color).toBe("coral");
    expect(n.archived).toBe(false);
  });

  it("odrzuca HTML, który nie jest z Keep", () => {
    expect(parseKeepHtml("<html><body><p>Strona</p></body></html>", "a.html")).toBeNull();
  });
});

describe("parseKeepHeadingDate", () => {
  it("rozumie polski i angielski zapis oraz ISO", () => {
    expect(parseKeepHeadingDate("5 paź 2022, 08:09:10")).toBe(new Date(2022, 9, 5, 8, 9, 10).getTime());
    expect(parseKeepHeadingDate("3 Jan 2020, 01:02")).toBe(new Date(2020, 0, 3, 1, 2, 0).getTime());
    expect(parseKeepHeadingDate("2021-03-17T10:00:00Z")).toBe(Date.UTC(2021, 2, 17, 10));
    expect(parseKeepHeadingDate("wczoraj")).toBeNull();
  });
});
