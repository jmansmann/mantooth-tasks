import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/web",
    emptyOutDir: false,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/healthz": "http://127.0.0.1:8080",
      "/readyz": "http://127.0.0.1:8080",
    },
  },
  test: {
    environment: "node",
    include: ["apps/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["apps/web/test/setup.ts"],
    restoreMocks: true,
  },
});
