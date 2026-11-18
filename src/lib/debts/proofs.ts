import { isImageRef } from "@/lib/imageStore";

/**
 * Zdjęcie dowodu przy wpisie długu (L4.3, Z-17.6). Osobna mapa `debtProofs` (id wpisu → `{ ref, at }`), nie pole
 * wpisu: zmiana dowodu nie przepisuje kwoty, a zdjęcie zmienione na jednym telefonie i kwota na drugim scalają się
 * bez strat. Bajty leżą w `imageStore` (ten sam magazyn i ta sama synchronizacja co obrazy notatek, do 2 MB po
 * `prepareImage`); odwołanie czyta odśmiecanie (`yjsStore.referencedImages`) i transport (`syncableRefs`).
 *
 * Czyste funkcje bez `yjs` — `yjsStore` czyta mapę przez strukturalny `MapLike`.
 */

export const DEBT_PROOFS_MAP = "debtProofs";

export interface DebtProof {
  /** SHA-256 bajtów w `imageStore`. */
  ref: string;
  /** Moment dodania (ms) — przy dwóch telefonach wygrywa późniejszy zapis klucza (zwykłe LWW mapy). */
  at: number;
}

type MapLike = { forEach(cb: (value: unknown, key: string) => void): void };

const isEntryId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

export function cleanProof(raw: unknown): DebtProof | null {
  const p = raw as Partial<DebtProof> | null;
  if (!p || typeof p !== "object" || typeof p.ref !== "string" || !isImageRef(p.ref)) return null;
  if (typeof p.at !== "number" || !Number.isFinite(p.at) || p.at <= 0) return null;
  return { ref: p.ref, at: p.at };
}

/**
 * Klucze zdjęć dowodów — dla odśmiecania i transportu obrazów. Tylko dowody wpisów, które istnieją: sierota (wpis
 * usunięty na innym telefonie albo id podrzucone przez obcego) nie trzyma pliku przy życiu i nie jedzie do innych urządzeń.
 * „Cofnij” usunięcia wpisu zdąży przed odśmiecaniem (karencja 7 dni).
 */
export function debtProofRefsIn(doc: { getMap(name: string): MapLike & { has?(key: string): boolean } }): Set<string> {
  const refs = new Set<string>();
  const debts = doc.getMap("debts");
  doc.getMap(DEBT_PROOFS_MAP).forEach((v, key) => {
    if (!isEntryId(key) || (debts.has && !debts.has(key))) return;
    const p = cleanProof(v);
    if (p) refs.add(p.ref);
  });
  return refs;
}
