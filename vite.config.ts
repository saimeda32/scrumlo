import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The web app builds to ./dist, which the Worker serves via its ASSETS binding.
// The Worker (worker/index.ts) is built/served separately by wrangler.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Keep the stable React runtime in its own chunk so an app deploy doesn't
        // bust its cache for returning visitors.
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-net": ["partysocket", "zustand", "wouter"],
        },
      },
    },
  },
});
