import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDark, type ThemeMode } from "@/hooks/useTheme";
import { SKINS, SKIN_SCHEME, SKIN_THEME_COLOR, SKIN_THEME_COLOR_ALT, type Skin } from "@/lib/skins";

// `public/prepaint.js` ustawia styl i jasność przed pierwszym malowaniem (plan motywów 2026-10-30, 0.5).
// Musi liczyć to samo co aplikacja po starcie, inaczej zamiast mignięcia Zeszytu byłoby mignięcie złego stylu.

const source = readFileSync(resolve(process.cwd(), "public/prepaint.js"), "utf8");

function run(store: Record<string, string>, systemDark: boolean) {
  const classes = new Set<string>();
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string>, classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) } };
  let color = "";
  const window = {
    localStorage: { getItem: (k: string) => store[k] ?? null },
    matchMedia: () => ({ matches: systemDark }),
  };
  const document = { documentElement: root, querySelector: () => ({ setAttribute: (_: string, v: string) => { color = v; } }) };
  new Function("window", "document", source)(window, document);
  return { skin: root.dataset.skin, dark: classes.has("dark"), color };
}

const expectedColor = (skin: Skin, dark: boolean) => skin === "zeszyt" ? (dark ? "#15110e" : SKIN_THEME_COLOR.zeszyt)
  : dark === (SKIN_SCHEME[skin] === "dark") ? SKIN_THEME_COLOR[skin] : SKIN_THEME_COLOR_ALT[skin];

describe("prepaint.js: ten sam wygląd co po starcie", () => {
  const modes: (ThemeMode | undefined)[] = [undefined, "system", "light", "dark"];
  for (const skin of SKINS) {
    it(`${skin}: każda jasność i tryb systemu`, () => {
      for (const pref of modes) for (const sys of [false, true]) {
        const store: Record<string, string> = { "kaczy.skin.v1": JSON.stringify(skin) };
        if (skin === "zeszyt") { if (pref) store["kaczy-theme"] = pref; }
        else if (pref) store["kaczy.skinScheme.v1"] = JSON.stringify({ [skin]: pref });
        const dark = resolveDark(pref ?? "system", skin, sys, skin === "zeszyt" || !pref ? {} : { [skin]: pref });
        expect(run(store, sys), `${skin} ${pref} sys=${sys}`).toEqual({ skin, dark, color: expectedColor(skin, dark) });
      }
    });
  }

  it("bez zapisu i przy śmieciach: Zeszyt, bez wyjątku", () => {
    expect(run({}, true)).toMatchObject({ skin: "zeszyt", dark: true });
    expect(run({ "kaczy.skin.v1": "\"nieznany\"" }, false)).toMatchObject({ skin: "zeszyt", dark: false });
    expect(() => run({ "kaczy.skin.v1": "{zepsute" }, false)).not.toThrow();
  });
});
