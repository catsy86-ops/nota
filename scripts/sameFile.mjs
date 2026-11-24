// S5.5: wspólne porównanie plików dla copy-ocr i copy-mermaid. Sam rozmiar przepuszczał podmieniony plik tej samej
// długości; teraz rozmiar, a przy zgodności SHA-256. Zgodny plik dalej nie jest przepisywany (OneDrive go nie synchronizuje).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";

export const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

export function sameFile(src, dst) {
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) return false;
  return sha256File(dst) === sha256File(src);
}
