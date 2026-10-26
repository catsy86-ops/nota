// D-1: zamiana odwołań hsl(var(--x)) na var(--x) i hsl(var(--x) / a) na color-mix(in srgb, …) w CSS, konfiguracji i kodzie.
// Tryb dry (domyślny) tylko liczy; --apply zapisuje.
const fs = require("fs");
const path = require("path");
const ROOT = "C:/Users/catsy/OneDrive/Pulpit/Notatnik/";
const APPLY = process.argv.includes("--apply");

const SKIP = /[\\/](node_modules|dist|e2e)[\\/]|\.test\.|\.spec\./;
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(css|ts|tsx)$/.test(e.name) && !SKIP.test(p)) out.push(p);
  }
  return out;
}
const files = [...walk(ROOT + "src"), ROOT + "tailwind.config.ts"].filter((f) => fs.existsSync(f));

const ALPHA = /hsl\(var\((--[\w-]+)\)\s*\/\s*(\d*\.?\d+)\)/g;
const PLAIN = /hsl\(var\((--[\w-]+)\)\)/g;

let total = { alpha: 0, plain: 0 };
let changed = 0;
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  let a = 0, p = 0;
  const out = text
    .replace(ALPHA, (_m, name, alpha) => {
      a++;
      const pct = Math.round(parseFloat(alpha) * 1000) / 10; // 0.45 → 45
      return `color-mix(in srgb, var(${name}) ${pct}%, transparent)`;
    })
    .replace(PLAIN, (_m, name) => {
      p++;
      return `var(${name})`;
    });
  if (a + p > 0) {
    changed++;
    total.alpha += a;
    total.plain += p;
    if (APPLY) fs.writeFileSync(f, out, "utf8");
  }
}
const leftover = files.reduce((n, f) => n + ((fs.readFileSync(f, "utf8").match(/hsl\(var\(/g) || []).length), 0);
console.log(`plików: ${changed}, z przezroczystością: ${total.alpha}, zwykłych: ${total.plain}, pozostałe hsl(var(: ${leftover}`);
console.log(APPLY ? "zapisano" : "dry-run: nic nie zapisano");
