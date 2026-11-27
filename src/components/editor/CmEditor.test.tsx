import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
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

  it("Q3.6: adres wklejony na zaznaczenie robi link", () => {
    const onChange = vi.fn();
    const { container } = render(<CmEditor value="kup złączki dziś" onChange={onChange} />);
    const content = container.querySelector(".cm-content") as HTMLElement;
    const view = EditorView.findFromDOM(content)!;
    act(() => view.dispatch({ selection: { anchor: 4, head: 11 } }));
    const data = { getData: (t: string) => (t === "text/plain" ? "https://hurtownia.pl/zlaczki" : ""), files: [] };
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    Object.defineProperty(event, "clipboardData", { value: data });
    act(() => { content.dispatchEvent(event); });
    expect(onChange).toHaveBeenLastCalledWith("kup [złączki](https://hurtownia.pl/zlaczki) dziś");
  });
});
