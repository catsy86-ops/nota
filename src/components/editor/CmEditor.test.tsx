import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { CmEditor } from "./CmEditor";

describe("CmEditor", () => {
  it("pokazuje wartość i zgłasza zmianę z klawiatury", () => {
    const onChange = vi.fn();
    const { container } = render(<CmEditor value="start" onChange={onChange} />);
    const content = container.querySelector(".cm-content") as HTMLElement;
    expect(content.textContent).toBe("start");
    expect(content.getAttribute("contenteditable")).toBe("true");
  });

  it("nadpisuje dokument, gdy wartość zmieni się z zewnątrz", () => {
    const { container, rerender } = render(<CmEditor value="a" onChange={() => {}} />);
    act(() => rerender(<CmEditor value="zdalnie zmienione" onChange={() => {}} />));
    expect((container.querySelector(".cm-content") as HTMLElement).textContent).toBe("zdalnie zmienione");
  });
});
