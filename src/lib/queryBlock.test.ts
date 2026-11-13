import { describe, expect, it } from "vitest";
import type { Note } from "@/hooks/useNotes";
import type { PropDef } from "@/lib/noteProps";
import { isQueryBlockLanguage, parseQueryBlock, runQueryBlock } from "./queryBlock";

const note = (id: string, title: string, over: Partial<Note> = {}): Note => ({
  id, title, content: "", labels: [], color: "default", pinned: false, archived: false, trashed: false, createdAt: 1, updatedAt: 1, images: [], checklist: [], reminder: null, ...over,
} as unknown as Note);

const defs: PropDef[] = [
  { id: "st", name: "Status", type: "select", options: ["Nowe", "Gotowe"], order: 0 },
  { id: "kw", name: "Kwota", type: "number", order: 1 },
  { id: "kl", name: "Klient", type: "text", order: 2 },
  { id: "x4", name: "Czwarte", type: "text", order: 3 },
];

describe("parseQueryBlock", () => {
  it("wyciąga sortuj, kolumny i limit, reszta to zapytanie", () => {
    const s = parseQueryBlock('etykieta:budowa pole:Status=Nowe sortuj:-termin kolumny:"Status,Klient" limit:5');
    expect(s.query).toBe("etykieta:budowa pole:Status=Nowe");
    expect(s.sortKey).toBe("termin");
    expect(s.dir).toBe(-1);
    expect(s.columns).toEqual(["Status", "Klient"]);
    expect(s.limit).toBe(5);
  });
  it("błędny limit jest pomijany, a za duży ucinany", () => {
    expect(parseQueryBlock("limit:abc").limit).toBe(25);
    expect(parseQueryBlock("limit:0").limit).toBe(25);
    expect(parseQueryBlock("limit:5000").limit).toBe(100);
  });
  it("obsługuje wiele linii i angielskie nazwy operatorów", () => {
    const s = parseQueryBlock("label:a\nsort:title\ncolumns:Status");
    expect(s.query).toBe("label:a");
    expect(s.sortKey).toBe("title");
    expect(s.columns).toEqual(["Status"]);
  });
  it("rozpoznaje języki bloku", () => {
    expect(isQueryBlockLanguage("zapytanie")).toBe(true);
    expect(isQueryBlockLanguage("Query")).toBe(true);
    expect(isQueryBlockLanguage("ts")).toBe(false);
  });
});

describe("runQueryBlock", () => {
  const notes = [
    note("a", "Alfa", { labels: ["budowa"], updatedAt: 10, props: { st: "Nowe", kw: 300 }, reminder: 500 }),
    note("b", "Beta", { labels: ["budowa"], updatedAt: 30, props: { st: "Gotowe", kw: 100 } }),
    note("c", "Gamma", { labels: ["dom"], updatedAt: 20, props: { st: "Nowe", kw: 200 }, reminder: 100 }),
    note("p", "Prywatna", { labels: ["budowa"], locked: true } as Partial<Note>),
    note("t", "Kosz", { labels: ["budowa"], trashed: true }),
  ];
  const run = (src: string) => runQueryBlock(parseQueryBlock(src), notes, { propDefs: defs });

  it("filtruje składnią wyszukiwarki, pomija prywatne, kosz i archiwum", () => {
    expect(run("etykieta:budowa").rows.map((n) => n.id)).toEqual(["b", "a"]); // domyślnie najnowsze zmiany na górze
    expect(run("etykieta:budowa").total).toBe(2);
  });
  it("filtruje po polu", () => {
    expect(run("pole:Status=Nowe sortuj:tytul").rows.map((n) => n.id)).toEqual(["a", "c"]);
  });
  it("sortuje po polu, po terminie (puste na końcu) i malejąco", () => {
    expect(run("sortuj:kwota").rows.map((n) => n.id)).toEqual(["b", "c", "a"]);
    expect(run("sortuj:-kwota").rows.map((n) => n.id)).toEqual(["a", "c", "b"]);
    expect(run("sortuj:termin").rows.map((n) => n.id)).toEqual(["c", "a", "b"]);
    expect(run("sortuj:-termin").rows.map((n) => n.id)).toEqual(["a", "c", "b"]);
  });
  it("nieznane sortowanie wraca do domyślnego i jest zgłoszone", () => {
    const r = run("sortuj:nieistnieje");
    expect(r.unknownSort).toBe("nieistnieje");
    expect(r.rows[0].id).toBe("b");
  });
  it("limit ucina wiersze, ale total liczy wszystkie", () => {
    const r = run("limit:1");
    expect(r.rows).toHaveLength(1);
    expect(r.total).toBe(3);
  });
  it("kolumny: domyślnie pierwsze trzy pola, własne w podanej kolejności, nieznane zgłoszone", () => {
    expect(run("").columns.map((d) => d.name)).toEqual(["Status", "Kwota", "Klient"]);
    const r = run("kolumny:Klient,Status,Brak");
    expect(r.columns.map((d) => d.name)).toEqual(["Klient", "Status"]);
    expect(r.unknownColumns).toEqual(["Brak"]);
  });
});
