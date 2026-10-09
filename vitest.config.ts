import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Grafik liczy dni i zmianę czasu w strefie lokalnej — testy mają ją stałą,
// także na CI w UTC.
process.env.TZ = "Europe/Warsaw";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/components/ui/**",
        "src/test/**",
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/vite-env.d.ts",
        "src/main.tsx",
        "*.config.ts",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
