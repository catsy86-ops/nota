/**
 * Prośba o zgodę na powiadomienia — wołana przy ustawianiu terminu, nie na
 * starcie aplikacji. Prompt bez widocznej intencji to najpewniejsza droga do
 * trwałego „Zablokuj”; przy zapisie przypomnienia powód jest oczywisty.
 * Musi być wywołana synchronicznie w obsłudze kliknięcia (gest użytkownika).
 */
export function requestNotificationPermissionOnIntent(): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  void Notification.requestPermission();
}

export type NotificationPermissionState = NotificationPermission | "unsupported";

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
