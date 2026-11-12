import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { Note } from "@/hooks/useNotes";

// Karta zastąpiona prostym znacznikiem: test sprawdza, ile kart siatka montuje, a nie samą kartę.
vi.mock("@/components/vault/PrivateNoteGate", () => ({
  PrivateNoteGate: ({ note }: { note: Note }) => <div data-note-id={note.id}>{note.title}</div>,
}));

import { NoteGrid } from "./NoteGrid";
import { requestNoteRender } from "@/lib/gridReveal";

/** Sterowany `IntersectionObserver`: test decyduje, kiedy strażnik „dochodzi” do ekranu. */
class FakeIO {
  static instances: FakeIO[] = [];
  constructor(public cb: IntersectionObserverCallback) { FakeIO.instances.push(this); }
  observe() {}
  disconnect() { FakeIO.instances = FakeIO.instances.filter((i) => i !== this); }
  unobserve() {}
  takeRecords() { return []; }
  fire(visible: boolean) { this.cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
}

const note = (i: number): Note => ({
  id: `n${i}`, title: `Notatka ${i}`, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: i, createdAt: i, updatedAt: i,
} as Note);

const noop = () => {};
const mount = (notes: Note[]) => render(<NoteGrid notes={notes} onDelete={noop} getVersions={() => []} onSaveVersion={noop} onRestoreVersion={noop} />);
const cards = () => document.querySelectorAll("[data-note-id]").length;
const fireLatest = (visible: boolean) => act(() => { FakeIO.instances.at(-1)?.fire(visible); });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); FakeIO.instances = []; });

describe("NoteGrid — render przy przewijaniu", () => {
  it("montuje pierwszą paczkę, a kolejne dopiero, gdy strażnik zbliża się do ekranu", () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    mount(Array.from({ length: 3000 }, (_, i) => note(i)));
    expect(cards()).toBe(24);
    fireLatest(false);
    expect(cards()).toBe(24); // strażnik daleko — nic nie dochodzi
    fireLatest(true);
    expect(cards()).toBe(72);
    fireLatest(true);
    expect(cards()).toBe(120);
    expect(document.querySelector("[data-grid-sentinel]")).not.toBeNull();
  });

  it("prośba o dorysowanie karty (pokaż notatkę, klawiatura) montuje zakres do niej", () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    mount(Array.from({ length: 3000 }, (_, i) => note(i)));
    act(() => requestNoteRender("n500"));
    expect(document.querySelector('[data-note-id="n500"]')).not.toBeNull();
    expect(cards()).toBe(525); // do notatki i paczka za nią
    act(() => requestNoteRender("nie-ma-takiej"));
    expect(cards()).toBe(525);
  });

  it("krótka lista: wszystkie karty od razu i bez strażnika", () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    mount(Array.from({ length: 10 }, (_, i) => note(i)));
    expect(cards()).toBe(10);
    expect(document.querySelector("[data-grid-sentinel]")).toBeNull();
  });
});
