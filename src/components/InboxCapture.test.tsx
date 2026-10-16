import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InboxCapture } from "./InboxCapture";

afterEach(cleanup);

describe("InboxCapture", () => {
  it("Enter przekazuje tytuł i treść, a pole się czyści", () => {
    const got: [string, string][] = [];
    render(<InboxCapture onCapture={(t, c) => got.push([t, c])} />);
    const input = screen.getByLabelText("Przechwyć do skrzynki") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Kupić rury" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(got).toEqual([["Kupić rury", ""]]);
    expect(input.value).toBe("");
  });

  it("pusty tekst nic nie zapisuje", () => {
    const got: unknown[] = [];
    render(<InboxCapture onCapture={() => got.push(1)} />);
    const input = screen.getByLabelText("Przechwyć do skrzynki");
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(got).toHaveLength(0);
  });
});
