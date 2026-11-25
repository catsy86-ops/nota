import { writeFormatAllowed } from "@/lib/formatSchema";
import { encryptNoteStringV2, encryptString, noteAad } from "@/lib/vault";

/** Najniższy numer formatu, który wymaga zapisu v2 (V-3): dopiero gdy wszystkie widziane urządzenia go znają. */
export const NOTE_FORMAT_V2_SCHEMA = 2;

/** Zapis notatki skarbca: v2 (z epoką w AAD), gdy bramka wersji na to pozwala; inaczej v1 dla starszych urządzeń. */
export function encryptNoteWrite(key: CryptoKey, json: string, id: string, epoch: number): Promise<string> {
  return writeFormatAllowed(NOTE_FORMAT_V2_SCHEMA) ? encryptNoteStringV2(key, json, id, epoch) : encryptString(key, json, noteAad(id));
}
