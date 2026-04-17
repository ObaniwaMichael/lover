/**
 * Browser logging: only when Vite `import.meta.env.DEV` is true.
 * Production builds also strip `console`/`debugger` via `vite.config.ts` so
 * stray `console.*` in dependencies or missed call sites stay out of users' DevTools.
 */
const dev = import.meta.env.DEV;

const logger = {
  log: (...args: unknown[]) => {
    if (dev) console.log(...args);
  },
  error: (...args: unknown[]) => {
    if (dev) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (dev) console.warn(...args);
  },
  info: (...args: unknown[]) => {
    if (dev) console.info(...args);
  },
};

export default logger;
