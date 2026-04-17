import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import { DevTerminalReporter } from "./components/DevTerminalReporter";
import logger from "./lib/logger";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const SoloPage = lazy(() => import("./pages/SoloPage"));
const MultiplayerPage = lazy(() => import("./pages/MultiplayerPage"));
const AICompanionPage = lazy(() => import("./pages/AICompanionPage"));
const AICompanionOnboarding = lazy(() => import("./pages/AICompanionOnboarding"));
const UserOnboarding = lazy(() => import("./pages/UserOnboarding"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const ConversationHistory = lazy(() => import("./pages/ConversationHistory"));
const MultiplayerHistory = lazy(() => import("./pages/MultiplayerHistory"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});


const App = () => {
  logger.log('App component rendering...');
  
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <BrowserRouter>
                {import.meta.env.DEV ? <DevTerminalReporter /> : null}
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/onboarding" element={<UserOnboarding />} />
                    <Route path="/profile" element={<UserProfile />} />
                    <Route path="/solo" element={<SoloPage />} />
                    <Route path="/multiplayer" element={<MultiplayerPage />} />
                    <Route path="/ai-companion" element={<AICompanionPage />} />
                    <Route path="/ai-companion-onboarding" element={<AICompanionOnboarding />} />
                    <Route path="/conversations" element={<ConversationHistory />} />
                    <Route path="/multiplayer-history" element={<MultiplayerHistory />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
