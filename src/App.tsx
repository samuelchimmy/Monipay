import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";

import { useTranslation } from "react-i18next";
import { isRTL } from "@/i18n/config";
import { Loader2 } from "lucide-react";

import Index from "./pages/Index";
import MiniPayPage from "./pages/MiniPay";
import Pay from "./pages/Pay";

const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Support = lazy(() => import("./pages/Support"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const UseCases = lazy(() => import("./pages/UseCases"));
const MoniBotPage = lazy(() => import("./pages/MoniBot"));
const Docs = lazy(() => import("./pages/Docs"));
const Deck = lazy(() => import("./pages/Deck"));
const Install = lazy(() => import("./pages/Install"));
const DiscordCallback = lazy(() => import("./pages/DiscordCallback"));
const TelegramCallback = lazy(() => import("./pages/TelegramCallback"));
const XCallback = lazy(() => import("./pages/x-callback"));
const Store = lazy(() => import("./pages/Store"));
const ClaimIOU = lazy(() => import("./pages/ClaimIOU"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Stats = lazy(() => import("./pages/Stats"));

import { AdminRoute } from "./components/AdminRoute";
import { MoniBotLanding } from "./components/MoniBotLanding";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { SportsPromoToast } from "@/components/SportsPromoToast";


const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RTLHandler() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const rtl = isRTL(i18n.language);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  return null;
}

const App = () => (
  <HelmetProvider>
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <ScrollToTop />
            <RTLHandler />
            <div className="min-h-screen pt-[var(--safe-area-top)] pb-[var(--safe-area-bottom)] ps-[var(--safe-area-left)] pe-[var(--safe-area-right)]">
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-background">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              }>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/use-cases" element={<UseCases />} />
                  {/* Payment Gateway Routes */}
                  <Route path="/pay" element={<Pay />} />
                  <Route path="/pay/:linkCode" element={<Pay />} />
                  {/* MoniBot Admin Dashboard */}
                  <Route
                    path="/m0n1b0t-cmd"
                    element={
                      <AdminRoute>
                        <MoniBotPage />
                      </AdminRoute>
                    }
                  />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/deck" element={<Deck />} />
                  <Route path="/install" element={<Install />} />
                  <Route path="/discord-callback" element={<DiscordCallback />} />
                  <Route path="/telegram-callback" element={<TelegramCallback />} />
                  {/* X OAuth Callback */}
                  <Route path="/x-callback" element={<XCallback />} />
                  {/* Public Merchant Storefront */}
                  <Route path="/store/:payTag" element={<Store />} />
                  {/* MiniPay / Celo entry point */}
                  <Route path="/minipay" element={<MiniPayPage />} />
                  {/* MoniBot public landing page */}
                  <Route path="/monibot" element={<MoniBotLanding />} />
                  {/* Email unsubscribe (one per recipient address) */}
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  {/* IOU Claim Page */}
                  <Route path="/claim" element={<ClaimIOU />} />
                  <Route path="/app/claim" element={<ClaimIOU />} />
                  <Route path="/stats" element={<Stats />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <PWAInstallPrompt />
              <NetworkStatusBanner />
              <SportsPromoToast />
            </div>
          </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  </HelmetProvider>
);

export default App;
