import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBump } from "./useBump";

describe("useBump", () => {
  it("nie pulsuje przy pierwszym renderze", () => {
    const { result } = renderHook(({ v }) => useBump(v), { initialProps: { v: 3 } });
    expect(result.current).toBe(0);
  });

  it("rośnie przy każdej zmianie wartości, nie przy tej samej", () => {
    const { result, rerender } = renderHook(({ v }) => useBump(v), { initialProps: { v: 3 } });
    rerender({ v: 4 });
    expect(result.current).toBe(1);
    rerender({ v: 4 });
    expect(result.current).toBe(1);
    rerender({ v: 2 });
    expect(result.current).toBe(2);
  });
});
