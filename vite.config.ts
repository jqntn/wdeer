import { defineConfig } from "vitest/config";

export default defineConfig({
  // Havok ships a .wasm that Vite's dep optimizer mishandles; exclude it so the
  // package's own `new URL(..., import.meta.url)` wasm resolution works.
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  server: {
    port: 5173,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
