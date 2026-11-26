import { describe, expect, it, vi } from "vitest";
import { requestContextMenu, shouldOpenContextMenu, subscribeContextMenu } from "./contextMenu";

// Q5.3: kiedy prawy przycisk otwiera menu „⋯”, a kiedy zostaje menu przeglądarki.

const target = (html: string, pick = "#t") => { document.body.innerHTML = html; return document.querySelector(pick); };

describe("shouldOpenContextMenu", () => {
  it("zwykły wiersz — przejmujemy", () => {
    expect(shouldOpenContextMenu({ target: target('<div><span id="t">Wpis</span></div>'), shiftKey: false }, "")).toBe(true);
  });

  it("pole tekstowe, edytor, link — menu przeglądarki", () => {
    expect(shouldOpenContextMenu({ target: target('<input id="t">'), shiftKey: false }, "")).toBe(false);
    expect(shouldOpenContextMenu({ target: target('<textarea id="t"></textarea>'), shiftKey: false }, "")).toBe(false);
    expect(shouldOpenContextMenu({ target: target('<div class="cm-editor"><span id="t">x</span></div>'), shiftKey: false }, "")).toBe(false);
    expect(shouldOpenContextMenu({ target: target('<a href="/x"><b id="t">link</b></a>'), shiftKey: false }, "")).toBe(false);
  });

  it("zaznaczony tekst albo Shift — menu przeglądarki", () => {
    const t = target('<span id="t">Wpis</span>');
    expect(shouldOpenContextMenu({ target: t, shiftKey: false }, "wpis")).toBe(false);
    expect(shouldOpenContextMenu({ target: t, shiftKey: true }, "")).toBe(false);
  });
});

describe("requestContextMenu", () => {
  it("trafia do słuchaczy z id; wypisanie kończy", () => {
    const l = vi.fn();
    const off = subscribeContextMenu(l);
    requestContextMenu("journal:p");
    expect(l).toHaveBeenCalledWith("journal:p");
    off();
    requestContextMenu("journal:q");
    expect(l).toHaveBeenCalledTimes(1);
  });
});
