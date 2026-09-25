/// <reference types="vite/client" />

// lib.dom.d.ts bundled with TypeScript lags the real Notifications API spec —
// `renotify` is a real, widely-supported NotificationOptions member it doesn't declare.
interface NotificationOptions {
  renotify?: boolean;
}
