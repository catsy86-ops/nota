import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocalServerNote } from "./LocalServerNote";

describe("LocalServerNote — znacznik „serwer lokalny” (S1.2)", () => {
  it.each(["http://localhost:8787", "https://192.168.1.20", "wss://nas.local/sig", "ws://127.0.0.1:4444"])("pokazuje dla %s", (url) => {
    render(<LocalServerNote urls={[url]} />);
    expect(screen.getByTestId("local-server-note")).toHaveTextContent("Serwer lokalny");
  });

  it("nie pokazuje dla serwera publicznego, pustego i nieprawidłowego adresu", () => {
    const { container } = render(<LocalServerNote urls={["https://sync.example.com", "", "nie adres"]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("wystarczy jeden lokalny adres na liście", () => {
    render(<LocalServerNote urls={["wss://signaling.example.com", "ws://localhost:4444"]} />);
    expect(screen.getByTestId("local-server-note")).toBeInTheDocument();
  });
});
