import { beforeEach, describe, expect, it } from "vitest";
import { mergeClients, mergePatch } from "./merge";
import { addClient, getClient, getClientLinks, getClients, linkSiteToClient } from "./store";
import type { Client } from "./model";
import { yjsStore } from "@/lib/yjsStore";

const NIP = "5260250274";
const base = (over: Partial<Client> = {}): Client =>
  ({ id: "k", name: "Jan", kind: "person", nip: "", address1: "", address2: "", phone: "", email: "", note: "", created: 1, ...over });

beforeEach(async () => {
  await yjsStore.resetForTests();
});

describe("mergePatch", () => {
  it("uzupełnia tylko puste pola; adres w całości, gdy keep nie ma żadnego wiersza", () => {
    const patch = mergePatch(
      base({ phone: "600", address2: "30-001 Kraków" }),
      base({ id: "d", phone: "700", email: "a@b.pl", nip: NIP, address1: "Lipowa 5", address2: "80-001 Gdańsk" }),
    );
    expect(patch).toEqual({ email: "a@b.pl", nip: NIP });
  });

  it("notatki: różna jest doklejana, identyczna i pusta nie zmieniają nic, wynik mieści się w limicie", () => {
    expect(mergePatch(base({ note: "a" }), base({ note: "b" })).note).toBe("a · b");
    expect(mergePatch(base({ note: "a" }), base({ note: "a" })).note).toBeUndefined();
    expect(mergePatch(base({ note: "a" }), base({ note: "" })).note).toBeUndefined();
    expect(mergePatch(base(), base({ note: "x".repeat(400) })).note).toHaveLength(400);
    expect(mergePatch(base({ note: "y".repeat(400) }), base({ note: "x".repeat(400) })).note).toHaveLength(500);
  });
});

describe("mergeClients", () => {
  it("przenosi budowy, uzupełnia pola i usuwa duplikat", () => {
    const keep = addClient({ name: "Jan Kowalski", phone: "600" })!;
    const drop = addClient({ name: "Jan Kowalski", email: "j@k.pl", nip: NIP, kind: "company" })!;
    linkSiteToClient("b1", keep.id);
    linkSiteToClient("b2", drop.id);
    linkSiteToClient("b3", drop.id);
    const r = mergeClients(keep.id, drop.id)!;
    expect(r).toMatchObject({ moved: 2, filled: 2 });
    expect(getClients().map((c) => c.id)).toEqual([keep.id]);
    expect(getClient(keep.id)).toMatchObject({ phone: "600", email: "j@k.pl", nip: NIP });
    expect(Object.fromEntries(getClientLinks())).toEqual({ b1: keep.id, b2: keep.id, b3: keep.id });
  });

  it("cofnięcie przywraca duplikat z budowami i pola klienta sprzed scalenia", () => {
    const keep = addClient({ name: "Jan", note: "stary" })!;
    const drop = addClient({ name: "Jan", email: "j@k.pl", note: "inny" })!;
    linkSiteToClient("b2", drop.id);
    const r = mergeClients(keep.id, drop.id)!;
    expect(getClient(keep.id)).toMatchObject({ email: "j@k.pl", note: "stary · inny" });
    r.undo();
    expect(getClients()).toHaveLength(2);
    expect(getClient(drop.id)).toMatchObject({ email: "j@k.pl", note: "inny" });
    expect(getClient(keep.id)).toMatchObject({ email: "", note: "stary" });
    expect(Object.fromEntries(getClientLinks())).toEqual({ b2: drop.id });
  });

  it("ten sam klient i nieistniejący klient: null, nic się nie zmienia", () => {
    const a = addClient({ name: "A" })!;
    expect(mergeClients(a.id, a.id)).toBeNull();
    expect(mergeClients(a.id, "nie-ma")).toBeNull();
    expect(mergeClients("nie-ma", a.id)).toBeNull();
    expect(getClients()).toHaveLength(1);
  });
});
