import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
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
  // Strip console/debugger from production client bundle (Rolldown/Vite 8: prefer top-level esbuild).
  esbuild:
    mode === "production"
      ? { drop: ["console", "debugger"] as ("console" | "debugger")[] }
      : undefined,
  server: {
    host: env.VITE_DEV_HOST || "localhost",
    port: devPort,
    strictPort: false,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
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
