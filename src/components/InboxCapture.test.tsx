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

  it("za długa pierwsza linia nie ginie: początek to tytuł, reszta idzie do treści", () => {
    const got: [string, string][] = [];
    render(<InboxCapture onCapture={(t, c) => got.push([t, c])} />);
    const input = screen.getByLabelText("Przechwyć do skrzynki");
    const long = "a".repeat(120) + " koniec zdania";
    fireEvent.change(input, { target: { value: long } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(got).toEqual([["a".repeat(120), "koniec zdania"]]);
  });

  it("Shift+Enter dodaje linię, Enter zapisuje", () => {
    const got: [string, string][] = [];
    render(<InboxCapture onCapture={(t, c) => got.push([t, c])} />);
    const input = screen.getByLabelText("Przechwyć do skrzynki");
    fireEvent.change(input, { target: { value: "Tytuł" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(got).toHaveLength(0);
    fireEvent.change(input, { target: { value: "Tytuł\nTreść" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(got).toEqual([["Tytuł", "Treść"]]);
  });
});

describe("InboxCapture — przycisk „Zapisz” (Skrzynka 1.1)", () => {
  it("pojawia się przy niepustym polu i zapisuje", () => {
    const got: [string, string][] = [];
    render(<InboxCapture onCapture={(t, c) => got.push([t, c])} />);
    expect(screen.queryByRole("button", { name: "Zapisz do skrzynki" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Przechwyć do skrzynki"), { target: { value: "Kupić klej" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz do skrzynki" }));
    expect(got).toEqual([["Kupić klej", ""]]);
    expect(screen.queryByRole("button", { name: "Zapisz do skrzynki" })).toBeNull();
  });
});

describe("InboxCapture — frazy (2.1)", () => {
  it("#etykieta, @folder, ! i data idą w extras i znikają z tytułu", () => {
    const got: [string, string, unknown][] = [];
    render(<InboxCapture onCapture={(t, c, e) => got.push([t, c, e])} labels={["budowa"]} folders={[{ id: "f1", name: "Lipowa" }]} />);
    const input = screen.getByLabelText("Przechwyć do skrzynki");
    fireEvent.change(input, { target: { value: "Zamówić kolana #budowa #pilne @Lipowa !" } });
    expect(screen.getByRole("group", { name: "Rozpoznane w tekście" })).toBeTruthy();
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(got).toEqual([["Zamówić kolana", "", { labels: ["budowa", "pilne"], newLabels: ["pilne"], folderId: "f1", priority: "medium", reminder: null }]]);
  });

  it("zignorowany chip zostawia tekst bez zmian", () => {
    const got: [string, unknown][] = [];
    render(<InboxCapture onCapture={(t, _c, e) => got.push([t, e])} labels={["budowa"]} />);
    const input = screen.getByLabelText("Przechwyć do skrzynki");
    fireEvent.change(input, { target: { value: "Zamówić kolana #budowa" } });
    fireEvent.click(screen.getByRole("button", { name: "Zignoruj: Etykieta budowa" }));
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(got).toEqual([["Zamówić kolana #budowa", { labels: [], newLabels: [], folderId: null, priority: null, reminder: null }]]);
    expect(screen.queryByRole("group", { name: "Rozpoznane w tekście" })).toBeNull();
  });
});

describe("InboxCapture — wklejony link (2.4)", () => {
  it("sam adres daje tytuł z domeny i adres w treści", () => {
    const got: [string, string][] = [];
    render(<InboxCapture onCapture={(t, c) => got.push([t, c])} />);
    const input = screen.getByLabelText("Przechwyć do skrzynki");
    fireEvent.change(input, { target: { value: "https://www.example.com/oferta/" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(got).toEqual([["example.com/oferta", "https://www.example.com/oferta/"]]);
  });
});
