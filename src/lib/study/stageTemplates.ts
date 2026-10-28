import { foldName } from "./siteKey";
import type { SiteStage } from "./stages";

/**
 * P2.9 Szablony wpisu per etap: lista kontrolna i podpowiedzi zdjęć, np. przy próbie szczelności
 * „ciśnienie, czas, wynik” i „manometr na początku / po próbie”. Wbudowane dla etapów domyślnych;
 * etap własny dostaje szablon po słowie w nazwie („próba”, „zakrycie”…), inaczej — żadnego.
 */

export interface StageTemplate {
  /** Punkty do potwierdzenia w opisie wpisu. */
  checklist: string[];
  /** Co sfotografować na tym etapie. */
  photos: string[];
}

const TEMPLATES: Record<string, StageTemplate> = {
  "kan-pod": { checklist: ["Spadek przewodów min. 2%", "Rewizje w dostępnych miejscach", "Obsypka piaskiem"], photos: ["Przebieg rur przed zasypaniem", "Spadek na poziomicy"] },
  woda: { checklist: ["Mocowania co 0,5–1 m", "Izolacja na przejściach przez ściany", "Zawory odcinające"], photos: ["Rozprowadzenie przed zakryciem", "Rozdzielacz"] },
  "kan-pion": { checklist: ["Rewizja na pionie", "Odpowietrzenie pionu", "Mocowania pionu"], photos: ["Pion z rewizją", "Podejścia z wymiarami"] },
  proba: { checklist: ["Ciśnienie próby (bar)", "Czas trwania", "Spadek ciśnienia i wynik"], photos: ["Manometr na początku", "Manometr po próbie"] },
  zakrycie: { checklist: ["Próba szczelności zaliczona", "Zdjęcia każdego pomieszczenia"], photos: ["Instalacja przed zakryciem — każde pomieszczenie"] },
  bialy: { checklist: ["Szczelność połączeń", "Silikon przy urządzeniach", "Działanie odpływów"], photos: ["Zamontowana armatura i urządzenia"] },
  odbior: { checklist: ["Protokół odbioru podpisany", "Instrukcje i karty gwarancyjne przekazane"], photos: ["Stan końcowy instalacji"] },
};

/** Słowa w nazwie etapu własnego → szablon wbudowany (pierwsze trafienie wygrywa). */
const BY_WORD: [string, string][] = [
  ["prob", "proba"], ["szczeln", "proba"], ["zakry", "zakrycie"], ["bial", "bialy"], ["odbior", "odbior"],
  ["pion", "kan-pion"], ["podejsc", "kan-pion"], ["podposadz", "kan-pod"], ["wod", "woda"],
];

export function stageTemplate(stage: Pick<SiteStage, "id" | "name">): StageTemplate | null {
  if (TEMPLATES[stage.id]) return TEMPLATES[stage.id];
  const name = foldName(stage.name);
  for (const [word, id] of BY_WORD) if (name.includes(word)) return TEMPLATES[id];
  return null;
}

/** Linia punktu w opisie wpisu. */
export const checkLine = (item: string) => `✓ ${item}`;

/** Dopisuje punkt jako osobną linię albo go usuwa, gdy już jest (przełącznik). */
export function toggleCheckLine(text: string, item: string): string {
  const line = checkLine(item);
  const lines = text.split("\n");
  if (lines.includes(line)) return lines.filter((l) => l !== line).join("\n").replace(/\n+$/, "");
  return text.trim() ? `${text.replace(/\n+$/, "")}\n${line}` : line;
}

export const hasCheckLine = (text: string, item: string) => text.split("\n").includes(checkLine(item));
