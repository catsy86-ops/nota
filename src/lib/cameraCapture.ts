/**
 * Aparat w aplikacji: podgląd na żywo, seria zdjęć i latarka (B3.9). Zdjęcie po zrzucie klatki idzie tą samą drogą co
 * zdjęcie z galerii (`prepareImage` w arkuszu wpisu: zmniejszenie do limitu, magazyn zdjęć). Latarka to ograniczenie
 * `torch` ścieżki wideo — niektóre telefony (głównie Android/Chrome) je mają, inne nie; bez niego zostaje aparat systemowy.
 */

export type CameraError = "denied" | "notfound" | "unsupported" | "error";

export const hasCamera = (): boolean => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

/** Kamera (tylna domyślnie); w razie błędu powód, żeby okno mogło powiedzieć, co zrobić. */
export async function openCamera(facingMode: "user" | "environment" = "environment"): Promise<{ stream: MediaStream } | { error: CameraError }> {
  if (!hasCamera()) return { error: "unsupported" };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    return { stream };
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return { error: "denied" };
    if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return { error: "notfound" };
    return { error: "error" };
  }
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/** Czy ta kamera udostępnia latarkę (ograniczenie `torch`). */
export function hasTorch(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
  return caps?.torch === true;
}

/** Włącza albo gasi latarkę; `false`, gdy system odmówił (wtedy przycisk wraca do stanu wyłączonej). */
export async function setTorch(stream: MediaStream, on: boolean): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

/** Zrzut klatki z wideo jako JPEG; `null`, gdy kamera jeszcze nie dała obrazu. */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
  try {
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9));
  } catch {
    return null;
  }
}

/** Zatrzymuje stream kamery (gasi też latarkę i diodę kamery). */
export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
