import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore, del, set } from "idb-keyval";
import type { IndexDoc } from "@/lib/noteSearchCore";

// Plan Notatek 3.2: zrzut indeksu w IndexedDB. „Start Workera” to świeży import handlerów (`vi.resetModules`),
// a baza jest wspólna (fake-indexeddb), więc drugi start widzi zrzut zapisany przez pierwszy.

const doc = (id: string, title: string, content = ""): IndexDoc => ({ id, title, aliases: "", labels: "", checklist: "", content });

async function startWorker() {
  vi.resetModules();
  return import("./noteSearchHandlers");
}

beforeEach(async () => {
  // Bez `deleteDatabase`: połączenia poprzednich „Workerów” zostają otwarte i blokowałyby usunięcie bazy.
  const mod = await startWorker();
  await del("snapshot", createStore(mod.INDEX_DB, "index"));
});

describe("zrzut indeksu notatek", () => {
  it("drugi start wczytuje zrzut i nie indeksuje niezmienionych notatek od nowa", async () => {
    const first = await startWorker();
    await first.noteSearchHandlers.noteSync([doc("a", "Zawór kulowy"), doc("b", "Pralka")], [], true);
    await first.flushNoteIndexSnapshot();

    const second = await startWorker();
    // Przed synchronizacją wyniki są puste (zrzut mógł mieć już usunięte notatki).
    expect(second.noteSearchHandlers.noteSearch("zawor").ids).toEqual([]);
    const r = await second.noteSearchHandlers.noteSync([doc("a", "Zawór kulowy"), doc("b", "Pralka")], [], true);
    expect(r.size).toBe(2);
    expect(second.noteSearchHandlers.noteSearch("zawor").ids).toEqual(["a"]);
    expect(second.noteSearchHandlers.noteSearch("pralka").ids).toEqual(["b"]);
  });

  it("pełna synchronizacja usuwa notatki, których strona już nie ma, i podmienia zmienione", async () => {
    const first = await startWorker();
    await first.noteSearchHandlers.noteSync([doc("a", "Zawór"), doc("b", "Pralka"), doc("c", "Kocioł")], [], true);
    await first.flushNoteIndexSnapshot();

    const second = await startWorker();
    const r = await second.noteSearchHandlers.noteSync([doc("a", "Zawór"), doc("b", "Zmywarka")], [], true);
    expect(r.size).toBe(2);
    expect(second.noteSearchHandlers.noteSearch("kociol").ids).toEqual([]);
    expect(second.noteSearchHandlers.noteSearch("pralka").ids).toEqual([]);
    expect(second.noteSearchHandlers.noteSearch("zmywarka").ids).toEqual(["b"]);
  });

  it("zrzut w starym formacie albo uszkodzony jest ignorowany", async () => {
    const mod = await startWorker();
    const store = createStore(mod.INDEX_DB, "index");
    await set("snapshot", { format: "stary", index: {}, fingerprints: [["x", "1"]] }, store);
    const w1 = await startWorker();
    expect((await w1.noteSearchHandlers.noteSync([doc("a", "Zawór")], [], true)).size).toBe(1);

    await set("snapshot", { format: (await import("@/lib/noteSearchCore")).INDEX_FORMAT, index: { zly: true }, fingerprints: [] }, store);
    const w2 = await startWorker();
    expect((await w2.noteSearchHandlers.noteSync([doc("a", "Zawór")], [], true)).size).toBe(1);
    expect(w2.noteSearchHandlers.noteSearch("zawor").ids).toEqual(["a"]);
  });

  it("zwykła synchronizacja (bez full) nie rusza dokumentów spoza przesyłki", async () => {
    const w = await startWorker();
    await w.noteSearchHandlers.noteSync([doc("a", "Zawór"), doc("b", "Pralka")], [], true);
    await w.noteSearchHandlers.noteSync([doc("c", "Kocioł")], ["b"]);
    expect(w.noteSearchHandlers.noteSearch("zawor").ids).toEqual(["a"]);
    expect(w.noteSearchHandlers.noteSearch("kociol").ids).toEqual(["c"]);
    expect(w.noteSearchHandlers.noteSearch("pralka").ids).toEqual([]);
  });
});
