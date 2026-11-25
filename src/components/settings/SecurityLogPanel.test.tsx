import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SecurityLogPanel, SECURITY_KIND_TEXT } from "./SecurityLogPanel";
import type { SecurityEvent } from "@/lib/diagnostics";

describe("SecurityLogPanel (S6.3)", () => {
  it("pusty dziennik ma czytelny komunikat", () => {
    render(<SecurityLogPanel events={[]} />);
    expect(screen.getByTestId("security-log-empty")).toBeInTheDocument();
  });

  it("najnowsze na górze, opis po polsku, licznik powtórzeń, rozwijanie ponad 5", () => {
    const events: SecurityEvent[] = Array.from({ length: 7 }, (_, i) => ({ at: 1_700_000_000_000 + i * 60_000, kind: i === 6 ? "relay-rollback" : "vault-unlock-failed", detail: i === 6 ? "https://relay.example" : "", count: i === 6 ? 3 : 1 }));
    render(<SecurityLogPanel events={events} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent(SECURITY_KIND_TEXT["relay-rollback"]);
    expect(items[0]).toHaveTextContent("× 3");
    fireEvent.click(screen.getByRole("button", { name: "Pokaż wszystkie (7)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});
