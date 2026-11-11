/**
 * Odczytanie tagu NFC do numeru inwentarza, seryjnego, itd.
 * Web NFC API (Chrome Android 89+). (B3.11)
 */

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  data?: BufferSource;
  encoding?: string;
  lang?: string;
  textContent?: string;
}

interface NDEFReader {
  scan(options?: { signal?: AbortSignal }): Promise<NDEFMessage>;
}

interface NFCNavigator extends Navigator {
  nfc?: {
    NDEFReader: new () => NDEFReader;
  };
}

export const hasNFC = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const nfc = (navigator as unknown as { nfc?: { NDEFReader?: new () => { scan(): Promise<unknown> } } }).nfc;
  return nfc?.NDEFReader !== undefined;
};

/** Czyta tag NFC, zwraca tekstową wartość. */
export async function readNFCTag(): Promise<string | null> {
  try {
    if (!hasNFC()) return null;

    const nfc = (navigator as unknown as { nfc?: { NDEFReader?: new () => { scan(): Promise<unknown> } } }).nfc;
    if (!nfc?.NDEFReader) return null;

    const reader = new nfc.NDEFReader();
    const message = await reader.scan();

    if (!message?.records || message.records.length === 0) return null;

    for (const record of message.records) {
      if (record.recordType === "text" && record.data) {
        const decoder = new TextDecoder();
        const text = decoder.decode(record.data);
        // Pomijamy pierwszy bajt (flagi kodowania)
        return text.substring(1);
      } else if (record.recordType === "url" && record.data) {
        const decoder = new TextDecoder();
        return decoder.decode(record.data);
      } else if (record.textContent) {
        return record.textContent;
      }
    }

    return null;
  } catch {
    return null;
  }
}
