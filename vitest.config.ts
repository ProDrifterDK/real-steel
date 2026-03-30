import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
    extendDefaultAlias: true,
  },
  test: {
    globals: true,
    environment: "node",
  },
});
