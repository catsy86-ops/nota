import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNoteVersions } from "./useNoteVersions";

beforeEach(() => {
  localStorage.clear();
});

describe("useNoteVersions", () => {
  it("records a version and returns it via getVersions, newest first", () => {
    const { result } = renderHook(() => useNoteVersions());

    act(() => result.current.addVersion("n1", "T1", "C1"));
    act(() => result.current.addVersion("n1", "T2", "C2"));

    const versions = result.current.getVersions("n1");
    expect(versions).toHaveLength(2);
    expect(versions[0].title).toBe("T2");
    expect(versions[1].title).toBe("T1");
  });

  it("does not record a version identical to the latest (title and content unchanged)", () => {
    const { result } = renderHook(() => useNoteVersions());

    act(() => result.current.addVersion("n1", "T1", "C1"));
    act(() => result.current.addVersion("n1", "T1", "C1"));

    expect(result.current.getVersions("n1")).toHaveLength(1);
  });

  it("records a new version when either title or content changes", () => {
    const { result } = renderHook(() => useNoteVersions());

    act(() => result.current.addVersion("n1", "T1", "C1"));
    act(() => result.current.addVersion("n1", "T1 changed", "C1"));

    expect(result.current.getVersions("n1")).toHaveLength(2);
  });

  it("keeps versions of different notes separate", () => {
    const { result } = renderHook(() => useNoteVersions());

    act(() => result.current.addVersion("n1", "A", "A"));
    act(() => result.current.addVersion("n2", "B", "B"));

    expect(result.current.getVersions("n1")).toHaveLength(1);
    expect(result.current.getVersions("n2")).toHaveLength(1);
    expect(result.current.getVersions("n1")[0].title).toBe("A");
  });

  it("caps stored versions per note at 20, dropping the oldest", () => {
    const { result } = renderHook(() => useNoteVersions());

    for (let i = 0; i < 25; i++) {
      act(() => result.current.addVersion("n1", `T${i}`, `C${i}`));
    }

    const versions = result.current.getVersions("n1");
    expect(versions).toHaveLength(20);
    expect(versions[0].title).toBe("T24"); // newest kept
    expect(versions.some((v) => v.title === "T0")).toBe(false); // oldest dropped
  });

  it("deleteVersions removes all versions for a note", () => {
    const { result } = renderHook(() => useNoteVersions());

    act(() => result.current.addVersion("n1", "A", "A"));
    act(() => result.current.addVersion("n2", "B", "B"));
    act(() => result.current.deleteVersions("n1"));

    expect(result.current.getVersions("n1")).toHaveLength(0);
    expect(result.current.getVersions("n2")).toHaveLength(1);
  });

  it("persists versions to localStorage and reloads them in a fresh hook instance", () => {
    const { result, unmount } = renderHook(() => useNoteVersions());
    act(() => result.current.addVersion("n1", "Persisted", "Body"));
    unmount();

    const { result: second } = renderHook(() => useNoteVersions());
    expect(second.current.getVersions("n1")).toHaveLength(1);
    expect(second.current.getVersions("n1")[0].title).toBe("Persisted");
  });
});
