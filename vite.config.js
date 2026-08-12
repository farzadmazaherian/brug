import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  // Tauri expects a relative base so the built app works from file:// too
  base: "./",
  build: {
    outDir: "dist",
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});
