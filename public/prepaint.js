/* Styl i jasność przed pierwszym malowaniem (plan motywów 2026-10-30, 0.5). Bez tego karta mignie jasnym
   Zeszytem, zanim moduł JS ustawi `data-skin`. Ta sama decyzja co `resolveDark` w src/hooks/useTheme.ts,
   kolory paska z src/lib/skinList.ts — zgodność pilnuje src/lib/prepaint.test.ts. Harmonogram „Styl na noc”
   dochodzi dopiero w JS. */
(function () {
  try {
    var S = { zeszyt: [null, "#f0b429", "#15110e"], plan: ["dark", "#10304f", "#eef4fa"], neon: ["dark", "#130a1b", "#f5f0f5"],
      zorza: ["dark", "#060a17", "#f6f0f6"], miedz: ["light", "#ae5a28", "#26221f"], matrix: ["dark", "#020a03", "#eef7ee"],
      hydraulika: ["dark", "#0b1e2b", "#f2f6f9"], odblask: ["light", "#e1f23a", "#1a1a1a"], kafle: ["light", "#f4f6f9", "#2b2e33"],
      tablica: ["light", "#f6f7f8", "#2f4a3c"] };
    var ls = window.localStorage, sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var skin = JSON.parse(ls.getItem("kaczy.skin.v1") || "null");
    if (!Object.prototype.hasOwnProperty.call(S, skin)) skin = "zeszyt";
    var pref;
    if (skin === "zeszyt") pref = ls.getItem("kaczy-theme");
    else { var map = JSON.parse(ls.getItem("kaczy.skinScheme.v1") || "{}") || {}; pref = map[skin] || S[skin][0]; }
    var dark = pref === "dark" || (pref !== "light" && sys);
    var root = document.documentElement;
    root.dataset.skin = skin;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
    var color = skin === "zeszyt" ? (dark ? S.zeszyt[2] : S.zeszyt[1]) : (dark === (S[skin][0] === "dark") ? S[skin][1] : S[skin][2]);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", color);
  } catch (e) { /* prywatne okno albo zepsuty zapis — JS ustawi wygląd po starcie */ }
})();
