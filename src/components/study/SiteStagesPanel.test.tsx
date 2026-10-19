import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { SiteInfo } from "@/lib/study/sites";
import { DEFAULT_STAGES, type SiteStage } from "@/lib/study/stages";

const setSiteStages = vi.fn();
const toastWithUndo = vi.fn();
vi.mock("@/lib/study/store", () => ({ setSiteStages: (...a: unknown[]) => setSiteStages(...a) }));
vi.mock("@/lib/undoToast", () => ({ toastWithUndo: (...a: unknown[]) => toastWithUndo(...a) }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));

const { SiteStagesPanel } = await import("./SiteStagesPanel");

const siteWith = (stages?: SiteStage[]) => ({ id: "dom", name: "Dom", stages }) as unknown as SiteInfo;

beforeEach(() => {
  setSiteStages.mockReset();
  toastWithUndo.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("SiteStagesPanel — etapy budowy", () => {
  it("bez własnej listy pokazuje domyślne etapy i postęp 0/n", () => {
    render(<SiteStagesPanel site={siteWith(undefined)} />);
    expect(screen.getByTestId("site-stages-progress")).toHaveTextContent(`0/${DEFAULT_STAGES.length}`);
    expect(screen.getAllByRole("checkbox")).toHaveLength(DEFAULT_STAGES.length);
    expect(screen.getByText(/Następny:/)).toHaveTextContent(DEFAULT_STAGES[0].name);
  });

  it("odhaczenie zapisuje datę zakończenia etapu", () => {
    render(<SiteStagesPanel site={siteWith(undefined)} />);
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(DEFAULT_STAGES[0].name) }));

    const [siteId, next, before] = setSiteStages.mock.calls[0];
    expect(siteId).toBe("dom");
    expect(typeof next[0].done).toBe("number");
    expect(before[0].done).toBeUndefined();
  });

  it("zakończony etap ma aria-checked=true i pokazuje postęp", () => {
    const stages: SiteStage[] = [
      { id: "a", name: "Fundament", done: 1 },
      { id: "b", name: "Dach" },
    ];
    render(<SiteStagesPanel site={siteWith(stages)} />);
    expect(screen.getByRole("checkbox", { name: /Fundament/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("site-stages-progress")).toHaveTextContent("1/2");
    expect(screen.getByRole("progressbar", { name: "Postęp budowy" })).toHaveAttribute("aria-valuenow", "1");
  });

  it("własny etap dopisuje się na końcu", () => {
    render(<SiteStagesPanel site={siteWith([{ id: "a", name: "Fundament" }])} />);
    fireEvent.change(screen.getByLabelText("Nowy etap"), { target: { value: "Kocioł" } });
    fireEvent.click(screen.getByRole("button", { name: /Dodaj/ }));

    const [, next] = setSiteStages.mock.calls[0];
    expect(next.map((s: SiteStage) => s.name)).toEqual(["Fundament", "Kocioł"]);
  });

  it("usunięcie etapu idzie przez „Cofnij”", () => {
    render(<SiteStagesPanel site={siteWith([{ id: "a", name: "Fundament" }, { id: "b", name: "Dach" }])} />);
    fireEvent.click(screen.getByRole("button", { name: "Usuń etap: Dach" }));

    const [, after, before] = setSiteStages.mock.calls[0];
    expect(after.map((s: SiteStage) => s.name)).toEqual(["Fundament"]);
    expect(before).toHaveLength(2);
    expect(toastWithUndo).toHaveBeenCalledTimes(1);
  });

  it("pusta nazwa nie dodaje etapu", () => {
    render(<SiteStagesPanel site={siteWith([{ id: "a", name: "Fundament" }])} />);
    const add = screen.getByRole("button", { name: /Dodaj/ });
    expect(add).toBeDisabled();
    expect(within(screen.getByRole("list")).getAllByRole("checkbox")).toHaveLength(1);
  });
});
