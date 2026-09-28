import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNoteVersions } from "./useNoteVersions";
import { createVersionsStore, LEGACY_VERSIONS_KEY, MAX_VERSIONS_PER_NOTE, type NoteVersion } from "@/lib/versionsStore";

const fresh = () => createVersionsStore(`test.versions.${crypto.randomUUID()}.`);

beforeEach(() => {
  localStorage.clear();
});

describe("versionsStore", () => {
  it("records versions newest first and skips an unchanged one", () => {
    const s = fresh();
    s.add("n1", "T1", "C1");
    s.add("n1", "T1", "C1");
    s.add("n1", "T2", "C1");
    expect(s.get("n1").map((v) => v.title)).toEqual(["T2", "T1"]);
  });

  it("keeps notes separate and caps each note", () => {
    const s = fresh();
    for (let i = 0; i < MAX_VERSIONS_PER_NOTE + 5; i++) s.add("n1", `T${i}`, "");
    s.add("n2", "X", "");
    expect(s.get("n1")).toHaveLength(MAX_VERSIONS_PER_NOTE);
    expect(s.get("n1")[0].title).toBe(`T${MAX_VERSIONS_PER_NOTE + 4}`);
    expect(s.get("n2")).toHaveLength(1);
  });

  it("persists per note to IndexedDB and reloads in a new instance", async () => {
    const prefix = `test.versions.${crypto.randomUUID()}.`;
    const a = createVersionsStore(prefix);
    await a.load();
    a.add("n1", "T1", "C1");
    a.add("n2", "T2", "C2");
    a.remove("n2");
    await a.flush();

    const b = createVersionsStore(prefix);
    await b.load();
    expect(b.get("n1").map((v) => v.title)).toEqual(["T1"]);
    expect(b.get("n2")).toEqual([]);
  });

  it("migrates the old localStorage array and removes it after writing", async () => {
    const old: NoteVersion[] = [
      { id: "a", noteId: "n1", title: "stara", content: "", timestamp: 1 },
      { id: "b", noteId: "n1", title: "nowsza", content: "", timestamp: 2 },
    ];
    localStorage.setItem(LEGACY_VERSIONS_KEY, JSON.stringify(old));
    const prefix = `test.versions.${crypto.randomUUID()}.`;
    const s = createVersionsStore(prefix);
    await s.load();
    await s.flush();
    expect(s.get("n1").map((v) => v.title)).toEqual(["nowsza", "stara"]);
    expect(localStorage.getItem(LEGACY_VERSIONS_KEY)).toBeNull();

    const again = createVersionsStore(prefix);
    await again.load();
    expect(again.get("n1")).toHaveLength(2);
  });

  it("replaceAll swaps the whole history (restore from backup)", () => {
    const s = fresh();
    s.add("gone", "x", "");
    s.replaceAll([{ id: "v", noteId: "n", title: "z backupu", content: "", timestamp: 5 }]);
    expect(s.get("gone")).toEqual([]);
    expect(s.all().map((v) => v.title)).toEqual(["z backupu"]);
  });
});

describe("useNoteVersions", () => {
  it("re-renders with a new getVersions after a version is added or deleted", () => {
    const { result } = renderHook(() => useNoteVersions());
    const id = `hook-${crypto.randomUUID()}`;
    const before = result.current.getVersions;
    act(() => result.current.addVersion(id, "T", "C"));
    expect(result.current.getVersions).not.toBe(before);
    expect(result.current.getVersions(id)).toHaveLength(1);
    act(() => result.current.deleteVersions(id));
    expect(result.current.getVersions(id)).toEqual([]);
  });
});
