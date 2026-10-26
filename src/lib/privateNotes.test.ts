import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createYjsStore, yjsStore } from "@/lib/yjsStore";
import { createPrivateNotes, privateNotes, throttleDelayMs, VaultThrottledError } from "@/lib/privateNotes";
import { createVersionsStore, versionsStore } from "@/lib/versionsStore";
import { searchNotes, loadSearchIndex } from "@/lib/searchNotes";
import { buildGraph } from "@/lib/noteGraph";
import { findUnlinkedMentions } from "@/lib/unlinkedMentions";
import { buildWeeklyReview } from "@/lib/weeklyReview";
import { buildFullBackup, exportToHTML, exportToJSON, exportToMarkdown } from "@/lib/exportNotes";
import { noteSchema } from "@/lib/noteSchema";
import { VaultError, looksLikeVaultToken } from "@/lib/vault";
import type { Note } from "@/hooks/useNotes";

// MiniSearch ładuje się osobno — wyszukiwanie w testach ma być rozmyte jak w aplikacji.
beforeAll(() => loadSearchIndex());

const IT = 1000;
const PW = "hasło-do-testów-12345";

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "Tytuł", content: "Treść", color: "default", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
    order: 0, createdAt: 1_000, updatedAt: 1_000, ...over,
  };
}

function fresh() {
  const store = createYjsStore(`vault-test-${crypto.randomUUID()}`);
  const versions = createVersionsStore(`vault.versions.${crypto.randomUUID()}.`);
  const pn = createPrivateNotes(store, { iterations: IT, minIterations: IT, writeDelayMs: 5, versions });
  return { store, versions, pn };
}

/** Bajty dokumentu jako tekst — do szukania jawnych fragmentów. */
function docText(store: ReturnType<typeof createYjsStore>): string {
  return new TextDecoder("latin1").decode(store.encodeSyncState());
}

beforeEach(() => { localStorage.clear(); });

/** jsdom nie ma `Blob.text()`. */
function readBlob(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(b);
  });
}

describe("privateNotes — model i sesja", () => {
  it("blokada usuwa jawną treść z dokumentu i redaguje projekcję", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ title: "SEKRETNYTYTUL", content: "SEKRETNATRESC", labels: ["SEKRETNAETYKIETA"], checklist: [{ id: "c1", text: "SEKRETNYPUNKT", checked: false }] }));
    expect(docText(store)).toContain("SEKRETNATRESC");

    await pn.setup(PW);
    expect(await pn.lockNote("n1")).toEqual({ ok: true });

    const [note] = store.projectNotes();
    expect(note.locked).toBe(true);
    expect(looksLikeVaultToken(note.vault)).toBe(true);
    expect(note).toMatchObject({ title: "", content: "", labels: [], checklist: [], images: [] });
    const dump = docText(store);
    for (const s of ["SEKRETNYTYTUL", "SEKRETNATRESC", "SEKRETNAETYKIETA", "SEKRETNYPUNKT"]) expect(dump).not.toContain(s);
    // Metadane układu zostają.
    expect(note.createdAt).toBe(1_000);
  });

  it("odblokowana sesja widzi treść, zablokowana nie; edycja zapisuje tylko szyfrogram", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ content: "pierwsza wersja" }));
    await pn.setup(PW);
    await pn.lockNote("n1");
    expect(pn.peek("n1")?.content).toBe("pierwsza wersja");

    // Ścieżka edytora: patchNote z polami treści trafia do sesji, nie do dokumentu.
    store.patchNote("n1", { content: "zmieniona UNIKATOWAWERSJA", title: "Nowy" });
    expect(docText(store)).not.toContain("UNIKATOWAWERSJA");
    expect(pn.peek("n1")?.content).toBe("zmieniona UNIKATOWAWERSJA");
    await pn.flush();
    expect(docText(store)).not.toContain("UNIKATOWAWERSJA");
    const token = store.getVault("n1")!;

    await pn.lock();
    expect(pn.phase()).toBe("locked");
    expect(pn.peek("n1")).toBeUndefined();

    // Po zablokowaniu zapis treści jest odrzucany (nie ląduje jawnie w dokumencie).
    store.patchNote("n1", { content: "PO BLOKADZIE" });
    expect(docText(store)).not.toContain("PO BLOKADZIE");
    expect(store.getVault("n1")).toBe(token);

    await pn.unlock(PW);
    expect(pn.peek("n1")).toMatchObject({ title: "Nowy", content: "zmieniona UNIKATOWAWERSJA" });
  });

  it("drugie urządzenie: to samo hasło + metadane z dokumentu odszyfrowują notatkę", async () => {
    const a = fresh();
    a.store.upsertNote(makeNote({ title: "Z A", content: "tekst z urządzenia A" }));
    await a.pn.setup(PW);
    await a.pn.lockNote("n1");

    const b = fresh();
    b.store.mergeSyncState(a.store.encodeSyncState());
    expect(b.pn.phase()).toBe("locked");
    await expect(b.pn.unlock("zle-haslo-xyz")).rejects.toMatchObject({ code: "bad-password" });
    await b.pn.unlock(PW);
    expect(b.pn.peek("n1")).toMatchObject({ title: "Z A", content: "tekst z urządzenia A" });
  });

  it("dwa skarbce założone offline (oba epoch 1): po synchronizacji tylko jedna sesja zostaje odblokowana", async () => {
    const a = fresh();
    a.store.upsertNote(makeNote({ title: "Z A", content: "tekst A" }));
    await a.pn.setup(PW);
    expect(a.pn.phase()).toBe("unlocked");

    const b = fresh();
    await b.pn.setup("inne-haslo-do-testow-999");
    expect(b.pn.phase()).toBe("unlocked");

    // Dokument scala się w obie strony: wygrywają jedne metadane, klucz drugiego urządzenia przestaje pasować.
    a.store.mergeSyncState(b.store.encodeSyncState());
    b.store.mergeSyncState(a.store.encodeSyncState());
    await vi.waitFor(() => expect([a.pn.phase(), b.pn.phase()].sort()).toEqual(["locked", "unlocked"]));
  });

  it("szyfrogram przeniesiony na inną notatkę nie daje się odszyfrować (AAD)", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ id: "a", content: "AAA" }));
    store.upsertNote(makeNote({ id: "b", content: "BBB" }));
    await pn.setup(PW);
    await pn.lockNote("a");
    await pn.lockNote("b");
    const tokenA = store.getVault("a")!;
    store.setVault("b", tokenA, false);
    await pn.lock();
    await pn.unlock(PW);
    expect(pn.peek("a")?.content).toBe("AAA");
    expect(pn.peek("b")).toBeUndefined();
    expect(pn.isUndecryptable("b")).toBe(true);
  });

  it("starszy peer z jawną wersją nie przywraca tekstu po scaleniu", async () => {
    const a = fresh();
    a.store.upsertNote(makeNote({ content: "STARYTEKSTPEERA" }));
    const b = fresh();
    b.store.mergeSyncState(a.store.encodeSyncState());
    await a.pn.setup(PW);
    await a.pn.lockNote("n1");
    // `b` nie wie o blokadzie; jego pełny stan (z jawnym tekstem) trafia do `a`.
    a.store.mergeSyncState(b.store.encodeSyncState());
    expect(docText(a.store)).not.toContain("STARYTEKSTPEERA");
    expect(a.store.projectNotes()[0]).toMatchObject({ locked: true, content: "" });
    // I odwrotnie: `b` po scaleniu stanu `a` też widzi tylko kłódkę.
    b.store.mergeSyncState(a.store.encodeSyncState());
    expect(b.store.projectNotes()[0]).toMatchObject({ locked: true, content: "" });
  });

  it("zdjęcie blokady przywraca jawną notatkę i usuwa szyfrogram", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ title: "T", content: "C", checklist: [{ id: "c", text: "x", checked: true }], labels: ["L"] }));
    await pn.setup(PW);
    await pn.lockNote("n1");
    expect(await pn.removeLock("n1")).toBe(true);
    const [note] = store.projectNotes();
    expect(note.locked).toBeUndefined();
    expect(note.vault).toBeUndefined();
    expect(note).toMatchObject({ title: "T", content: "C", labels: ["L"], checklist: [{ id: "c", text: "x", checked: true }] });
  });

  it("odmawia blokowania notatki z obrazami lub załącznikami", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ images: ["sha256:abc"] }));
    await pn.setup(PW);
    expect(await pn.lockNote("n1")).toEqual({ ok: false, reason: "has-files" });
    expect(store.projectNotes()[0].locked).toBeUndefined();
  });

  it("blokowanie nie działa bez odblokowanego skarbca", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote());
    expect(await pn.lockNote("n1")).toEqual({ ok: false, reason: "session-locked" });
  });

  it("nie zostawia wersji notatki prywatnej (historia jest czyszczona i blokowana)", async () => {
    const { store, pn, versions } = fresh();
    store.upsertNote(makeNote({ content: "WERSJATEKST" }));
    versions.add("n1", "T", "WERSJATEKST");
    expect(versions.get("n1")).toHaveLength(1);
    await pn.setup(PW);
    await pn.lockNote("n1");
    expect(versions.get("n1")).toHaveLength(0);
    versions.add("n1", "T", "NOWA WERSJATEKST");
    expect(versions.get("n1")).toHaveLength(0);
    expect(JSON.stringify(versions.all())).not.toContain("WERSJATEKST");
  });

  it("duplikat notatki prywatnej jest zaszyfrowany pod nowym id", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ title: "Orig", content: "kopiowana treść" }));
    await pn.setup(PW);
    await pn.lockNote("n1");
    const id = await pn.duplicate("n1");
    expect(id).toBeTruthy();
    const copy = store.projectNotes().find((n) => n.id === id)!;
    expect(copy.locked).toBe(true);
    expect(copy.title).toBe("");
    expect(pn.peek(id!)).toMatchObject({ title: "Orig (kopia)", content: "kopiowana treść" });
    await pn.lock();
    await pn.unlock(PW);
    expect(pn.peek(id!)?.content).toBe("kopiowana treść");
  });

  it("import notatki z `locked` bez poprawnego szyfrogramu nie wpuszcza jawnego tekstu", () => {
    const { store } = fresh();
    store.upsertNote(makeNote({ id: "x", locked: true, vault: "v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBB", title: "JAWNY IMPORT", content: "JAWNY IMPORT" }));
    expect(docText(store)).not.toContain("JAWNY IMPORT");
    store.upsertNote(makeNote({ id: "y", locked: true, vault: "nie-szyfrogram", title: "T", content: "C" }));
    expect(store.projectNotes().find((n) => n.id === "y")?.locked).toBeUndefined();
  });

  it("schemat importu zachowuje `locked` i `vault`", () => {
    const parsed = noteSchema.parse({ id: "q", title: "", content: "", locked: true, vault: "v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBB" });
    expect(parsed.locked).toBe(true);
    expect(parsed.vault).toMatch(/^v[12]\./);
  });
});

describe("privateNotes — zmiana hasła i próby", () => {
  it("zmiana hasła przeszyfrowuje wszystko; stare hasło przestaje działać", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ id: "a", content: "AAA" }));
    store.upsertNote(makeNote({ id: "b", content: "BBB" }));
    await pn.setup(PW);
    await pn.lockNote("a");
    await pn.lockNote("b");
    const before = { a: store.getVault("a"), b: store.getVault("b") };

    const res = await pn.changePassword(PW, "nowe-hasło-98765");
    expect(res.skipped).toEqual([]);
    expect(res.recoveryCode).toBeTruthy();
    expect(store.getVault("a")).not.toBe(before.a);
    expect(store.getVault("b")).not.toBe(before.b);
    expect(pn.peek("a")?.content).toBe("AAA");

    await pn.lock();
    await expect(pn.unlock(PW)).rejects.toMatchObject({ code: "bad-password" });
    await pn.unlock("nowe-hasło-98765");
    expect(pn.peek("b")?.content).toBe("BBB");
  });

  it("błędne stare hasło nie zmienia niczego", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ content: "AAA" }));
    await pn.setup(PW);
    await pn.lockNote("n1");
    const token = store.getVault("n1");
    const meta = JSON.stringify(store.getVaultMeta());
    await expect(pn.changePassword("zle-stare-haslo", "nowe-hasło-98765")).rejects.toBeInstanceOf(VaultError);
    expect(store.getVault("n1")).toBe(token);
    expect(JSON.stringify(store.getVaultMeta())).toBe(meta);
  });

  it("transakcja zmiany klucza jest wszystko-albo-nic (zmiana szyfrogramu w trakcie)", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ id: "a", content: "AAA" }));
    await pn.setup(PW);
    await pn.lockNote("a");
    const meta = JSON.stringify(store.getVaultMeta());
    const token = store.getVault("a")!;
    const ok = store.rekeyVault({ v: 1 }, new Map([["a", { expected: "v1.inny.szyfrogram", vault: "v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBB" }]]));
    expect(ok).toBe(false);
    expect(store.getVault("a")).toBe(token);
    expect(JSON.stringify(store.getVaultMeta())).toBe(meta);
  });

  it("kod awaryjny pozwala ustawić nowe hasło", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ content: "ODZYSKANA" }));
    const { recoveryCode } = await pn.setup(PW);
    await pn.lockNote("n1");
    await pn.lock();
    const res = await pn.resetPasswordWithRecovery(recoveryCode!, "zupelnie-nowe-haslo-1");
    expect(res.recoveryCode).toBeTruthy();
    expect(pn.peek("n1")?.content).toBe("ODZYSKANA");
    await pn.lock();
    await pn.unlock("zupelnie-nowe-haslo-1");
    expect(pn.peek("n1")?.content).toBe("ODZYSKANA");
  });

  it("limit prób: po kilku błędach rosnące opóźnienie, zapisane w localStorage", async () => {
    const { pn } = fresh();
    await pn.setup(PW);
    await pn.lock();
    expect(throttleDelayMs(2)).toBe(0);
    expect(throttleDelayMs(3)).toBe(2000);
    expect(throttleDelayMs(4)).toBe(4000);
    expect(throttleDelayMs(40)).toBe(300_000);
    await expect(pn.unlock("zle-1-zle-1")).rejects.toMatchObject({ code: "bad-password" });
    await expect(pn.unlock("zle-2-zle-2")).rejects.toMatchObject({ code: "bad-password" });
    await expect(pn.unlock("zle-3-zle-3")).rejects.toMatchObject({ code: "bad-password" });
    // Czwarta próba — nawet z dobrym hasłem — jest wstrzymana.
    await expect(pn.unlock(PW)).rejects.toBeInstanceOf(VaultThrottledError);
    expect(pn.retryInMs()).toBeGreaterThan(0);
    expect(localStorage.getItem("kaczy.vault.attempts.v1")).toContain("fails");
  });
});

describe("prywatne notatki — nic z jawnej treści nie wycieka", () => {
  const MARK = "ZNACZNIKTAJNY8472";

  it("wyszukiwanie, graf, wzmianki, przegląd, eksporty, backup, dokument, IDB i localStorage", async () => {
    await yjsStore.ready();
    // Notatka z treścią-znacznikiem w każdym polu + zwykłe notatki, które ją linkują / wspominają.
    const secret = makeNote({
      id: "secret", title: `Plan ${MARK}`, content: `Treść ${MARK} oraz [[Inna]]`, labels: [`etykieta-${MARK}`],
      checklist: [{ id: "c1", text: `punkt ${MARK}`, checked: false }], reminder: Date.now() - 86_400_000,
    });
    const other = makeNote({ id: "other", title: "Inna", content: "zwykła notatka, którą linkuje prywatna", createdAt: 5, updatedAt: 5 });
    yjsStore.upsertNote(secret);
    yjsStore.upsertNote(other);
    versionsStore.add("secret", secret.title, secret.content);

    await privateNotes.setup(PW);
    expect(await privateNotes.lockNote("secret")).toEqual({ ok: true });
    // Odblokowana sesja w trakcie skanu: nawet wtedy nic nie może wyciec poza kafel.
    expect(privateNotes.isUnlocked()).toBe(true);
    await privateNotes.flush();

    const notes = yjsStore.projectNotes();
    const dumps: Record<string, string> = {};
    dumps.projection = JSON.stringify(notes);
    dumps.search = JSON.stringify([
      searchNotes(notes, MARK), searchNotes(notes, "Plan"), searchNotes(notes, `label:etykieta-${MARK}`), searchNotes(notes, "is:open"),
    ]);
    dumps.searchHit = String(searchNotes(notes, MARK).length);
    dumps.graph = JSON.stringify(buildGraph(notes));
    dumps.mentions = JSON.stringify(findUnlinkedMentions({ id: "other", title: "Inna" }, notes));
    dumps.review = JSON.stringify(buildWeeklyReview(notes, Date.now()));
    dumps.versions = JSON.stringify(versionsStore.all());
    dumps.backup = JSON.stringify(await buildFullBackup());
    dumps.syncState = new TextDecoder("latin1").decode(yjsStore.encodeSyncState());
    dumps.localStorage = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));

    // Eksporty zapisują plik przez Blob — przechwytujemy go.
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => { blobs.push(b); return "blob:test"; });
    Object.defineProperty(URL, "createObjectURL", { value: create, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await exportToJSON(notes);
    await exportToMarkdown(notes);
    await exportToHTML(notes);
    const exported = await Promise.all(blobs.map(readBlob));
    expect(exported).toHaveLength(3);
    dumps.exportJson = exported[0];
    dumps.exportMd = exported[1];
    dumps.exportHtml = exported[2];

    // Zrzut IndexedDB dokumentu po zagęszczeniu dziennika aktualizacji.
    const dumpIdb = () => new Promise<string>((resolve, reject) => {
      const open = indexedDB.open("kaczy-yjs-v1");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const req = db.transaction("updates").objectStore("updates").getAll();
        req.onsuccess = () => {
          const parts = (req.result as Uint8Array[]).map((u) => new TextDecoder("latin1").decode(u));
          db.close();
          resolve(parts.join("\n"));
        };
        req.onerror = () => reject(req.error);
      };
    });
    // Przed zagęszczeniem dziennik trzyma jeszcze jawny tekst z chwili sprzed blokady — to właśnie ma usunąć.
    expect(await dumpIdb()).toContain(MARK);
    expect(await yjsStore.compactPersistence()).toBe(true);
    dumps.idb = await dumpIdb();

    expect(dumps.searchHit).toBe("0");
    for (const [name, text] of Object.entries(dumps)) {
      expect(text, `zrzut „${name}” zawiera jawny znacznik`).not.toContain(MARK);
    }
    // Backup niesie szyfrogram i metadane skarbca — i nic więcej.
    const backup = JSON.parse(dumps.backup);
    expect(backup.notes.find((n: Note) => n.id === "secret").vault).toMatch(/^v[12]\./);
    expect(backup.vault).toBeTruthy();
    // Markdown/HTML mówią tylko, że coś pominięto.
    expect(dumps.exportMd).toContain("Pominięto notatki prywatne: 1");
  });
});

describe("metadane notatki prywatnej w szyfrogramie (V-3, krok 3)", () => {
  it("po zablokowaniu kolor i folder nie są jawne w dokumencie; po zdjęciu blokady wracają", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ title: "T", content: "C", color: "rose", folderId: "f1", icon: "🔒" }));
    await pn.setup(PW);
    await pn.lockNote("n1");
    const locked = store.projectNotes().find((n) => n.id === "n1")!;
    expect(locked.locked).toBe(true);
    expect(locked.folderId ?? null).toBeNull();
    expect(locked.color).toBe("default");
    expect(locked.icon).toBeUndefined();
    expect(await pn.removeLock("n1")).toBe(true);
    const back = store.projectNotes().find((n) => n.id === "n1")!;
    expect(back.folderId).toBe("f1");
    expect(back.color).toBe("rose");
    expect(back.icon).toBe("🔒");
  });

  it("zmiana koloru w odblokowanym skarbcu idzie do szyfrogramu, nie do dokumentu", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ title: "T", content: "C", color: "default", folderId: null }));
    await pn.setup(PW);
    await pn.lockNote("n1");
    store.patchNote("n1", { color: "mint", folderId: "f2" } as never);
    await pn.lock();
    await pn.unlock(PW);
    expect(pn.peek("n1")).toMatchObject({ title: "T", content: "C" });
    const doc = store.projectNotes().find((n) => n.id === "n1")!;
    expect(doc.color).toBe("default");
    expect(doc.folderId ?? null).toBeNull();
  });
});

describe("metadane przy zablokowanym skarbcu (V-3, krok 3)", () => {
  it("zmiana koloru bez odblokowanego skarbca nie ginie: zostaje jawna do najbliższej blokady", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ title: "T", content: "C", color: "default" }));
    await pn.setup(PW);
    await pn.lockNote("n1");
    await pn.lock();
    store.patchNote("n1", { color: "sky" } as never);
    expect(store.projectNotes().find((n) => n.id === "n1")!.color).toBe("sky");
    await pn.unlock(PW);
    await pn.removeLock("n1");
    expect(store.projectNotes().find((n) => n.id === "n1")!.color).toBe("sky");
  });
});

describe("przegląd V-3: metadane z szyfrogramu", () => {
  it("poprawny kolor wraca z szyfrogramu (odrzucenie spoza listy: bez bezpośredniego testu)", async () => {
    const { store, pn } = fresh();
    store.upsertNote(makeNote({ title: "T", content: "C", color: "mint" }));
    await pn.setup(PW);
    await pn.lockNote("n1");
    await pn.removeLock("n1");
    const back = store.projectNotes().find((n) => n.id === "n1")!;
    expect(back.color).toBe("mint");
  });
});
