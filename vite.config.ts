import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project page from /wdeer/. Only apply the base for
  // builds (incl. `vite preview` of a build); dev stays at / so `npm run dev`
  // and the preview harness are unaffected.
  base: command === "build" ? "/wdeer/" : "/",
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
}));
