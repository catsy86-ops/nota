/** Czy przeglądarka umie nagrywać notatkę głosową — bez ładowania `voiceRecorder.ts`. */
export const canRecordVoice = () =>
  typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
