/**
 * B4.4: Odcisk dokumentu — skrót SHA-256 + data w stopce PDF.
 * To suma kontrolna: wykrywa przypadkowe zmiany treści względem odcisku podanego osobnym kanałem.
 * NIE uwierzytelnia dokumentu — kto zmieni PDF, przeliczy skrót i podmieni odcisk. Autentyczność
 * wymagałaby klucza (HMAC albo podpis z kluczem publicznym przekazanym osobno).
 */

export interface DocumentFingerprint {
  hash: string;   // SHA-256 (hex)
  date: number;   // timestamp
}

export async function computeDocumentHash(content: string): Promise<string> {
  // `crypto.subtle` bywa niedostępne w niezabezpieczonym kontekście (HTTP) — wtedy odmawiamy, zamiast zgadywać.
  if (!globalThis.crypto?.subtle) throw new Error("Brak Web Crypto (crypto.subtle) — nie można policzyć odcisku");

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Konwersja na hex
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatFingerprint(fp: DocumentFingerprint): string {
  const date = new Date(fp.date).toLocaleDateString("pl-PL");
  const shortHash = fp.hash.substring(0, 16).toUpperCase();
  return `${date} • ${shortHash}…`;
}

export async function generateDocumentFingerprint(content: string): Promise<DocumentFingerprint> {
  return {
    hash: await computeDocumentHash(content),
    date: Date.now(),
  };
}

export function verifyDocumentFingerprint(content: string, fp: DocumentFingerprint): Promise<boolean> {
  return computeDocumentHash(content).then(
    (newHash) => newHash === fp.hash.toLowerCase(),
    () => false,
  );
}
