import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { reportToDevTerminal } from "@/lib/devTerminal";

/**
 * Logs client-side route changes to the terminal running `npm run dev`.
 */
export function DevTerminalReporter() {
  const location = useLocation();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    reportToDevTerminal("route", {
      path: location.pathname + location.search,
      key: location.key,
    });
  }, [location.pathname, location.search, location.key]);

  return null;
}
