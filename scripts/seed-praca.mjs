// Generator danych do pomiaru wydajności Pracy (plan B0.4).
// Użycie: node scripts/seed-praca.mjs [plik.json] [wpisy=3000] [budowy=40]
// Wynik to kopia pełna (Ustawienia → Kopia i dane → Przywróć), bez zdjęć i bez prawdziwych danych.
import { writeFileSync } from "node:fs";

const out = process.argv[2] ?? "seed-praca.json";
const entries = Number(process.argv[3] ?? 3000);
const sitesCount = Number(process.argv[4] ?? 40);

let seed = 20261110;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const NAMES = ["Lipowa", "Polna", "Słoneczna", "Leśna", "Krótka", "Długa", "Ogrodowa", "Szkolna"];
const sites = {};
const siteList = [];
const now = Date.now();
for (let i = 0; i < sitesCount; i++) {
  const id = `s${i}`;
  const name = `${pick(NAMES)} ${i + 1}`;
  sites[id] = { id, name, address: `ul. ${name}`, investor: `Inwestor ${i + 1}`, created: now - (sitesCount - i) * 5 * 86_400_000 };
  siteList.push({ id, name });
}

const TEXTS = ["Podejścia w łazience", "Próba szczelności 6 bar", "Kanalizacja do pionu", "Brak złączek 16", "Montaż stelaża", "Zawór główny", "Pion CWU", "Wymiana baterii"];
const FIT = ["Kolanko ścienne 16×½", "Trójnik 16", "Złączka 20", "Nypel ½"];
const journal = [];
for (let i = 0; i < entries; i++) {
  const s = pick(siteList);
  const kind = rnd() < 0.12 ? "problem" : "ok";
  journal.push({
    id: `e${i}`,
    at: now - Math.floor(rnd() * 730) * 86_400_000 - Math.floor(rnd() * 86_400_000),
    kind,
    topic: null,
    text: `${pick(TEXTS)} (${i})`,
    site: s.name,
    siteId: s.id,
    checked: [],
    images: [],
    fittings: rnd() < 0.5 ? [{ name: pick(FIT), qty: 1 + Math.floor(rnd() * 6) }] : undefined,
    ...(kind === "problem" && rnd() < 0.5 ? { resolved: now } : {}),
  });
}

const dump = { version: 2, board: {}, checked: {}, missed: {}, journal, days: [], rounds: {}, site: "", sites, review: {}, boss: null, group: null, custom: {} };
const backup = { version: 3, exportedAt: now, notes: [], labels: [], folders: [], study: JSON.stringify(dump) };
writeFileSync(out, JSON.stringify(backup));
console.log(`${out}: ${entries} wpisów, ${sitesCount} budów`);
