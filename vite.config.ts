import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { devTerminalWatchPlugin } from "./vite/devTerminalWatchPlugin";

// Dev server port: set VITE_DEV_PORT or FRONTEND_PORT in .env (default 5729 to avoid clashes with 5173/3000)
// Align backend CORS_ORIGIN with this origin, e.g. CORS_ORIGIN=http://localhost:5729

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devPort = Number(
    env.VITE_DEV_PORT || env.FRONTEND_PORT || 5729
  );

  return {
  server: {
    host: env.VITE_DEV_HOST || "localhost",
    port: devPort,
    strictPort: false,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    // Vite 8: use rolldownOptions (rollupOptions is a deprecated alias)
    rolldownOptions: {
      output: {
        ...(mode === "production"
          ? {
              // Replaces top-level `esbuild: { drop: ['console', 'debugger'] }` (Oxc minifier; see Vite 8 migration)
              minify: {
                compress: {
                  dropConsole: true,
                },
              },
            }
          : {}),
        manualChunks(id: string) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom")) {
            return "vendor";
          }
          if (
            id.includes("@radix-ui/react-dialog") ||
            id.includes("@radix-ui/react-dropdown-menu") ||
            id.includes("@radix-ui/react-toast")
          ) {
            return "ui";
          }
          if (id.includes("node_modules/react-router")) {
            return "router";
          }
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && devTerminalWatchPlugin(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
