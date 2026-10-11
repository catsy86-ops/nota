import { describe, it, expect, vi } from "vitest";
import { buildClipperBookmarklet } from "./clipperBookmarklet";
import { parseShare } from "./shareTarget";

function run(code: string, page: { title: string; href: string; selection: string }) {
  const open = vi.fn();
  const win = { getSelection: () => page.selection, open };
  new Function("window", "document", "location", code.replace(/^javascript:/, ""))(
    win, { title: page.title }, { href: page.href },
  );
  return open.mock.calls[0] as [string, string, string];
}

describe("buildClipperBookmarklet", () => {
  it("otwiera /share z tytułem, adresem i zaznaczeniem, które parseShare odczytuje", () => {
    const [url, target, features] = run(buildClipperBookmarklet("https://notki.app/"), {
      title: "Artykuł & więcej", href: "https://example.com/a?b=1", selection: "ważny fragment",
    });
    expect(target).toBe("_blank");
    expect(features).toBe("noopener");
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://notki.app/share");
    expect(parseShare(u.pathname, u.search)).toEqual({
      title: "Artykuł & więcej",
      content: "ważny fragment\n\nhttps://example.com/a?b=1",
    });
  });

  it("ucina bardzo długie zaznaczenie", () => {
    const [url] = run(buildClipperBookmarklet("https://x.test"), { title: "t", href: "https://e.com", selection: "a".repeat(9000) });
    expect(new URL(url).searchParams.get("text")).toHaveLength(5000);
  });
});
