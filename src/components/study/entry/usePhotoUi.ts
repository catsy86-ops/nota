import { useState } from "react";

/**
 * Stan widoku zdjęć, który ma przeżyć zamknięcie arkusza (treść arkusza się odmontowuje): podpis w trakcie
 * pisania i otwarty rejestrator. Wywoływany w zawsze zamontowanym `JournalEntrySheet`.
 */
export function usePhotoUi() {
  /** Zdjęcie, któremu wpisujesz podpis („przed zakryciem”); `null` = pole schowane. */
  const [captioning, setCaptioning] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  /** Nagrywanie w toku (pasek z licznikiem zamiast przycisku); nagranie trafia do załączników wpisu. */
  const [recording, setRecording] = useState(false);
  return { captioning, setCaptioning, captionDraft, setCaptionDraft, recording, setRecording };
}
