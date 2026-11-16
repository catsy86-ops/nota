/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Powłoka Androida (F1, ADR-8): ta sama aplikacja z `dist/` w WebView, z alarmami systemowymi.
 * Adres w powłoce to `https://localhost` — inne pochodzenie niż PWA, więc osobna baza danych
 * (dane przenosi kopia zapasowa albo synchronizacja).
 */
const config: CapacitorConfig = {
  appId: "pl.kaczy.notki",
  appName: "NOTKI",
  webDir: "dist",
  server: { androidScheme: "https", hostname: "localhost" },
  android: { allowMixedContent: false },
  plugins: {
    LocalNotifications: { smallIcon: "ic_stat_notki", iconColor: "#F0B429" },
  },
};

export default config;
