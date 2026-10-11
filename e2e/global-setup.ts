import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ochrona przed cichym testowaniem starego kodu: przy `reuseExistingServer` Playwright
 * pomija `npm run build`, a `vite preview` serwuje to, co leży w `dist/`. Jeśli źródła są
 * nowsze niż build, wyniki dotyczą poprzedniej wersji — lepiej przerwać z jasnym komunikatem.
 * Obejście: `PW_ALLOW_STALE=1`.
 */
const WATCHED = ["src", "public", "index.html", "vite.config.ts", "tailwind.config.ts", "package.json"];

function newestMtime(path: string): number {
  if (!existsSync(path)) return 0;
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  let newest = st.mtimeMs;
  for (const name of readdirSync(path)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    newest = Math.max(newest, newestMtime(join(path, name)));
  }
  return newest;
}

export default function globalSetup() {
  if (process.env.PW_ALLOW_STALE) return;
  const dist = join(process.cwd(), "dist", "index.html");
  if (!existsSync(dist)) return; // brak buildu — webServer zbuduje
  const built = statSync(dist).mtimeMs;
  const source = Math.max(...WATCHED.map((p) => newestMtime(join(process.cwd(), p))));
  // 2 s zapasu: `vite build` kończy po ostatniej edycji źródeł, ale zegary plików bywają zgrubne.
  if (source > built + 2000) {
    throw new Error(
      "dist/ jest starszy niż źródła — testy uruchomiłyby się na starym buildzie.\n" +
        "Uruchom `npm run build` (albo zatrzymaj serwer na porcie 4173, żeby Playwright zbudował sam). " +
        "Obejście: PW_ALLOW_STALE=1.",
    );
  }
}
