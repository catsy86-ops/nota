import { afterEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { createNoteSearchEngine, type NoteSearchEngine } from "./noteSearchEngine";
import { searchNotes, setNoteSearchEngine } from "./searchNotes";
import { serveRpc, type RpcTransport } from "@/workers/rpc";

// Plan 3.2: wyszukiwanie notatek w Workerze. Worker jest sprawdzony przez prawdziwe RPC nad kanałem w pamięci
// (jsdom nie ma Workerów); handlery ładujemy świeżo na każdy „start Workera”, żeby odtworzyć jego restart.

const note = (id: string, title: string, over: Partial<Note> = {}): Note => ({
  id, title, content: "", labels: [], color: "default", pinned: false, archived: false, trashed: false, createdAt: 1, updatedAt: 1, ...over,
} as unknown as Note);

function channelPair(): { client: RpcTransport; server: RpcTransport } {
  const toServer = new Set<(m: unknown) => void>();
  const toClient = new Set<(m: unknown) => void>();
  const make = (inbox: Set<(m: unknown) => void>, outbox: Set<(m: unknown) => void>): RpcTransport => ({
    send: (m) => queueMicrotask(() => outbox.forEach((l) => l(structuredClone(m)))),
    onMessage: (l) => { inbox.add(l); return () => inbox.delete(l); },
    close: () => undefined,
  });
  return { client: make(toClient, toServer), server: make(toServer, toClient) };
}

/** Każde otwarcie transportu to „nowy Worker” ze świeżym indeksem (jak po zwolnieniu przy bezczynności). */
function freshWorkerTransport(starts: { n: number }) {
  return async () => {
    vi.resetModules();
    const { noteSearchHandlers } = await import("@/workers/noteSearchHandlers");
    const pair = channelPair();
    serveRpc(noteSearchHandlers, pair.server);
    starts.n++;
    return pair.client;
  };
}

/** `open` w silniku jest synchroniczny — przygotowany transport podajemy z kolejki. */
async function makeEngine(opts: { idleMs?: number } = {}) {
  const starts = { n: 0 };
  const boot = freshWorkerTransport(starts);
  const queue: RpcTransport[] = [];
  queue.push(await boot());
  const engine = createNoteSearchEngine(() => {
    const t = queue.shift();
    if (!t) throw new Error("brak transportu");
    return t;
  }, opts);
  return { engine, starts, boot, queue };
}

const changed = (e: NoteSearchEngine) => new Promise<void>((res) => { const off = e.subscribe(() => { off(); res(); }); });

async function lookupSettled(e: NoteSearchEngine, source: Note[], free: string): Promise<Note[]> {
  for (let i = 0; i < 5; i++) {
    const wait = changed(e);
    const hit = e.lookup(source, free);
    if (hit) return hit;
    await wait;
  }
  throw new Error("brak wyniku");
}

afterEach(() => { setNoteSearchEngine(null); vi.useRealTimers(); });

describe("silnik wyszukiwania w Workerze", () => {
  it("pierwsze zapytanie idzie do Workera (null), potem wynik z pamięci podręcznej, uszeregowany po trafności", async () => {
    const { engine } = await makeEngine();
    const notes = [note("a", "Zawór kulowy"), note("b", "Zlew", { content: "wymiana zaworu" }), note("c", "Pralka")];
    expect(engine.lookup(notes, "zawor")).toBeNull();
    const hits = await lookupSettled(engine, notes, "zawor");
    expect(hits.map((n) => n.id)).toEqual(["a", "b"]); // tytuł waży więcej niż treść
    expect(engine.lookup(notes, "zawor")?.map((n) => n.id)).toEqual(["a", "b"]);
    engine.dispose();
  });

  it("zmieniona notatka (nowy obiekt) odświeża wynik; zablokowana znika z indeksu; wynik jest zawężany do tablicy wywołania", async () => {
    const { engine } = await makeEngine();
    const notes = [note("a", "Zawór kulowy"), note("b", "Pralka")];
    await lookupSettled(engine, notes, "zawor");
    const edited = [notes[0], note("b", "Zawór zwrotny")];
    const hits = await lookupSettled(engine, edited, "zawor");
    expect(hits.map((n) => n.id).sort()).toEqual(["a", "b"]);
    const locked = [{ ...edited[0], locked: true } as Note, edited[1]];
    expect((await lookupSettled(engine, locked, "zawor")).map((n) => n.id)).toEqual(["b"]);
    // Ten sam indeks, ale tablica bez „b” (np. widok archiwum) — „b” nie wypływa.
    expect((await lookupSettled(engine, [note("a", "Zawór kulowy")], "zawor")).map((n) => n.id)).toEqual(["a"]);
    engine.dispose();
  });

  it("po restarcie Workera (zwolnienie przy bezczynności) indeks jest wysyłany od nowa i wyniki dalej są pełne", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { engine, starts, boot, queue } = await makeEngine({ idleMs: 50 });
    const notes = [note("a", "Zawór kulowy"), note("b", "Zawór zwrotny"), note("c", "Pralka")];
    await lookupSettled(engine, notes, "zawor");
    expect(starts.n).toBe(1);
    // Bezczynność zamyka transport; następne zapytanie otwiera nowy z pustym indeksem.
    await vi.advanceTimersByTimeAsync(100);
    queue.push(await boot());
    const hits = await lookupSettled(engine, notes, "pralka");
    expect(starts.n).toBe(2);
    expect(hits.map((n) => n.id)).toEqual(["c"]);
    const again = await lookupSettled(engine, notes, "zawor");
    expect(again.map((n) => n.id).sort()).toEqual(["a", "b"]);
    engine.dispose();
  });

  it("błąd Workera: silnik zgłasza failed() i przestaje odpowiadać", async () => {
    const engine = createNoteSearchEngine(() => { throw new Error("Worker niedostępny"); });
    const notes = [note("a", "Zawór")];
    const wait = changed(engine);
    expect(engine.lookup(notes, "zawor")).toBeNull();
    await wait;
    expect(engine.failed()).toBe(true);
    expect(engine.lookup(notes, "zawor")).toBeNull();
    engine.dispose();
  });
});

describe("searchNotes z silnikiem w Workerze", () => {
  it("do czasu odpowiedzi daje dokładne trafienia, potem wynik rozmyty z Workera; operatory działają jak dawniej", async () => {
    const { engine } = await makeEngine();
    setNoteSearchEngine(engine);
    const notes = [note("a", "Zawór kulowy", { labels: ["woda"] }), note("b", "Zaworek zwrotny"), note("c", "Pralka", { labels: ["woda"] })];
    // Pierwsze wywołanie: dokładne dopasowanie „zawór” (bez ogonków) → tylko „a” i „b” (zawór/zaworek zawierają „zawor”).
    const first = searchNotes(notes, "zawor", {}, notes).map((n) => n.id);
    expect(first).toEqual(expect.arrayContaining(["a", "b"]));
    await lookupSettled(engine, notes, "zawor");
    const after = searchNotes(notes, "zawor", {}, notes).map((n) => n.id);
    expect(after).toEqual(["a", "b"]);
    // Operator etykiety zawęża pulę, a wynik z Workera jest przecięty z pulą.
    await lookupSettled(engine, notes, "zawor");
    expect(searchNotes(notes, "etykieta:woda zawor", {}, notes).map((n) => n.id)).toEqual(["a"]);
    engine.dispose();
  });
});
