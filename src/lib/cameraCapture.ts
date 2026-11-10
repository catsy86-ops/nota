/**
 * Live preview kamery i zrzut zdjęcia. Camera API dostępny na Chrome, Firefox, Safari.
 * Zdjęcie zwracane jako blob do zapisu w imageStore. (B3.9)
 */

export const hasCamera = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return navigator.mediaDevices?.getUserMedia !== undefined;
};

/** Żąda dostępu do kamery przedniej (selfie) lub tylnej (domyślnie). */
export async function requestCamera(facingMode: "user" | "environment" = "environment"): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1440 },
      },
      audio: false,
    });
  } catch {
    return null;
  }
}

/** Zrzut kadru z wideo do canvas, zwraca blob zdjęcia. */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg", 0.9);
    });
  } catch {
    return null;
  }
}

/** Zatrzymuje stream kamery. */
export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
