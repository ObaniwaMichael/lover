import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin } from "vite";

/** Noise to skip unless VITE_DEV_TERMINAL_VERBOSE=1 */
function shouldSilenceRequestUrl(url: string): boolean {
  if (process.env.VITE_DEV_TERMINAL_VERBOSE === "1") return false;
  if (url.startsWith("/__lover_dev")) return true;
  if (url.includes("/@vite/")) return true;
  if (url.includes("@react-refresh")) return true;
  if (url.includes("/node_modules/")) return true;
  if (url.endsWith(".map")) return true;
  if (/\?t=\d+/.test(url) && url.includes("/src/")) return true;
  if (url.startsWith("/@fs/") || url.startsWith("/@id/")) return true;
  return false;
}

function handleAppReport(req: IncomingMessage, res: ServerResponse): boolean {
  if (!req.url?.startsWith("/__lover_dev") || req.method !== "POST") {
    return false;
  }

  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      const j = JSON.parse(raw || "{}") as { type?: string; detail?: unknown };
      const label = j.type ?? "message";
      if (j.detail !== undefined) {
        console.log(`[app] ${label}`, j.detail);
      } else {
        console.log(`[app] ${label}`, j);
      }
    } catch {
      console.log("[app]", raw);
    }
    res.statusCode = 204;
    res.end();
  });
  return true;
}

export function devTerminalWatchPlugin(): Plugin {
  return {
    name: "lover-dev-terminal-watch",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (handleAppReport(req, res)) {
          return;
        }
        next();
      });

      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const start = Date.now();
        res.on("finish", () => {
          if (shouldSilenceRequestUrl(url)) return;
          const pathOnly = url.split("?")[0];
          const ms = Date.now() - start;
          console.log(`[vite] ${req.method} ${pathOnly} → ${res.statusCode} ${ms}ms`);
        });
        next();
      });
    },
  };
}
