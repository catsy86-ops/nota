import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { cleanClient, cleanClientField, findDuplicates, parseClientNip, searchClients, type Client } from "./model";
import { createYClients } from "./yClients";

// 5260250274 to poprawny NIP (suma kontrolna), 5260250275 — nie.
const NIP = "5260250274";

const client = (id: string, over: Partial<Client> = {}): Client => ({
  id, name: "Anna Kowalska", kind: "person", nip: "", address1: "ul. Długa 5, Kraków", address2: "", phone: "600 100 200", email: "", note: "", created: 1000, ...over,
});

describe("cleanClient", () => {
  it("odrzuca wpis bez id, nazwy albo czasu założenia", () => {
    expect(cleanClient(null)).toBeNull();
    expect(cleanClient({ ...client("a"), id: "" })).toBeNull();
    expect(cleanClient({ ...client("a"), name: "  " })).toBeNull();
    expect(cleanClient({ ...client("a"), created: 0 })).toBeNull();
  });

  it("zły NIP i e-mail zostają puste, poprawny NIP jest bez kresek", () => {
    expect(cleanClient({ ...client("a"), nip: "526-025-02-75" })?.nip).toBe("");
    expect(cleanClient({ ...client("a"), nip: "PL 526-025-02-74" })?.nip).toBe(NIP);
    expect(cleanClient({ ...client("a"), email: "to nie mail" })?.email).toBe("");
    expect(cleanClient({ ...client("a"), email: "ania@example.pl" })?.email).toBe("ania@example.pl");
  });

  it("obcina za długie pola i usuwa znaki sterujące z nazwy", () => {
    const c = cleanClient({ ...client("a"), name: `Ania\u0000\n${"x".repeat(300)}`, note: "n".repeat(900) });
    expect(c?.name.length).toBeLessThanOrEqual(120);
    expect(c?.name.startsWith("Ania x")).toBe(true);
    expect(c?.note.length).toBe(500);
  });

  it("nieznany rodzaj to osoba; archived tylko dodatnie", () => {
    expect(cleanClient({ ...client("a"), kind: "x" })?.kind).toBe("person");
    expect(cleanClient({ ...client("a"), kind: "company" })?.kind).toBe("company");
    expect(cleanClient({ ...client("a"), archived: -5 })?.archived).toBeUndefined();
    expect(cleanClient({ ...client("a"), archived: 77 })?.archived).toBe(77);
  });
});

describe("cleanClientField i parseClientNip", () => {
  it("pusta nazwa i zły NIP są odrzucane, pusty NIP czyści pole", () => {
    expect(cleanClientField("name", "   ")).toBeUndefined();
    expect(cleanClientField("nip", "123")).toBeUndefined();
    expect(cleanClientField("nip", "")).toBe("");
    expect(cleanClientField("nip", NIP)).toBe(NIP);
    expect(cleanClientField("email", "zle")).toBeUndefined();
    expect(cleanClientField("archived", 0)).toBe(0);
    expect(parseClientNip(" 526 025 02 74 ")).toBe(NIP);
  });
});

describe("searchClients i findDuplicates", () => {
  const list = [client("a"), client("b", { name: "Łukasz Żółć", phone: "+48 512-333-444", nip: NIP, kind: "company", address1: "ul. Krótka 1, Gdańsk" })];

  it("szuka bez polskich znaków, po telefonie (same cyfry) i NIP-ie", () => {
    expect(searchClients(list, "lukasz zolc").map((c) => c.id)).toEqual(["b"]);
    expect(searchClients(list, "512333").map((c) => c.id)).toEqual(["b"]);
    expect(searchClients(list, NIP.slice(0, 5)).map((c) => c.id)).toEqual(["b"]);
    expect(searchClients(list, "dluga krakow").map((c) => c.id)).toEqual(["a"]);
    expect(searchClients(list, "")).toHaveLength(2);
    expect(searchClients(list, "nikt")).toEqual([]);
  });

  it("duplikaty: ta sama nazwa po złożeniu albo ten sam NIP, z pominięciem siebie", () => {
    expect(findDuplicates(list, { name: "ANNA  kowalska", nip: "" }).map((c) => c.id)).toEqual(["a"]);
    expect(findDuplicates(list, { name: "Ktoś", nip: NIP }).map((c) => c.id)).toEqual(["b"]);
    expect(findDuplicates(list, { name: "Anna Kowalska", nip: "" }, "a")).toEqual([]);
  });
});

describe("createYClients", () => {
  const sync = (a: Y.Doc, b: Y.Doc) => {
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  };

  it("dodaje, czyta po nazwie i odmawia istniejącego id", () => {
    const y = createYClients(new Y.Doc());
    expect(y.add(client("b", { name: "Zenon" }))).toBe(true);
    expect(y.add(client("a", { name: "Adam" }))).toBe(true);
    expect(y.add(client("a", { name: "Inny" }))).toBe(false);
    expect(y.all().map((c) => c.name)).toEqual(["Adam", "Zenon"]);
  });

  it("dwa urządzenia edytujące różne pola tego samego klienta scalają się bez strat", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYClients(a);
    const yb = createYClients(b);
    ya.add(client("x"));
    sync(a, b);
    ya.setField("x", "phone", "700 000 000");
    yb.setField("x", "address1", "ul. Nowa 1");
    sync(a, b);
    for (const y of [ya, yb]) {
      expect(y.get("x")?.phone).toBe("700 000 000");
      expect(y.get("x")?.address1).toBe("ul. Nowa 1");
    }
  });

  it("odrzuca złą wartość pola i edycję nieistniejącego klienta", () => {
    const y = createYClients(new Y.Doc());
    y.add(client("x"));
    expect(y.setField("x", "name", " ")).toBe(false);
    expect(y.setField("x", "nip", "123")).toBe(false);
    expect(y.setField("nie-ma", "phone", "1")).toBe(false);
    expect(y.get("x")?.name).toBe("Anna Kowalska");
  });

  it("archiwizacja i cofnięcie archiwizacji", () => {
    const y = createYClients(new Y.Doc());
    y.add(client("x"));
    y.setField("x", "archived", 55);
    expect(y.get("x")?.archived).toBe(55);
    y.setField("x", "archived", 0);
    expect(y.get("x")?.archived).toBeUndefined();
  });

  it("powiązanie budowy z klientem znika razem z klientem, a „Cofnij” je przywraca", () => {
    const y = createYClients(new Y.Doc());
    y.add(client("x"));
    expect(y.linkSite("budowa-1", "x")).toBe(true);
    expect(y.linkSite("budowa-2", "nie-ma")).toBe(false);
    expect(y.clientOfSite("budowa-1")?.id).toBe("x");
    const removed = y.remove("x");
    expect(removed?.siteIds).toEqual(["budowa-1"]);
    expect(y.all()).toEqual([]);
    expect(y.clientOfSite("budowa-1")).toBeUndefined();
    y.restore(removed!.client, removed!.siteIds);
    expect(y.get("x")?.created).toBe(1000);
    expect(y.clientOfSite("budowa-1")?.id).toBe("x");
  });

  it("pole zapisane na drugim urządzeniu po usunięciu klienta nie wskrzesza go", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYClients(a);
    const yb = createYClients(b);
    ya.add(client("x"));
    sync(a, b);
    ya.remove("x");
    yb.setField("x", "phone", "999");
    sync(a, b);
    expect(ya.all()).toEqual([]);
    expect(yb.all()).toEqual([]);
  });

  it("zrzut i scalanie: dodaje brakujących, niczego nie nadpisuje ani nie kasuje", () => {
    const src = createYClients(new Y.Doc());
    src.add(client("x", { name: "Z kopii" }));
    src.add(client("y", { name: "Tylko w kopii" }));
    src.linkSite("b1", "x");
    src.linkSite("b2", "y");
    const dump = JSON.parse(JSON.stringify(src.dump()));

    const dst = createYClients(new Y.Doc());
    dst.add(client("x", { name: "Lokalny" }));
    dst.add(client("z", { name: "Lokalny dodatkowy" }));
    dst.linkSite("b1", "z");
    dst.mergeDump(dump);
    expect(dst.get("x")?.name).toBe("Lokalny");
    expect(dst.get("y")?.name).toBe("Tylko w kopii");
    expect(dst.get("z")).toBeDefined();
    expect(dst.clientOfSite("b1")?.id).toBe("z");
    expect(dst.clientOfSite("b2")?.id).toBe("y");
  });

  it("scalanie ignoruje śmieci i nie zakłada klienta dla powiązania bez klienta", () => {
    const y = createYClients(new Y.Doc());
    y.mergeDump(null);
    y.mergeDump({ clients: "nie tablica", sites: 5 });
    y.mergeDump({ clients: [{ id: "q" }, null, 7], sites: { b: "brak", "": "x" } });
    expect(y.all()).toEqual([]);
    expect(y.links().size).toBe(0);
  });
});
