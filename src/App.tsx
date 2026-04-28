import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { ProtectedRoute } from "@/components/app/AppLayout";
import Overview from "./pages/app/Overview.tsx";
import Agents from "./pages/app/Agents.tsx";
import NewAgent from "./pages/app/NewAgent.tsx";
import AgentDetail from "./pages/app/AgentDetail.tsx";
import PhoneNumbers from "./pages/app/PhoneNumbers.tsx";
import Settings from "./pages/app/Settings.tsx";
import Transcriptions from "./pages/app/Transcriptions.tsx";
import Feedback from "./pages/app/Feedback.tsx";
import Organisation from "./pages/app/Organisation.tsx";
import Integrations from "./pages/app/Integrations.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/app" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
            <Route path="/app/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
            <Route path="/app/agents/new" element={<ProtectedRoute><NewAgent /></ProtectedRoute>} />
            <Route path="/app/agents/:id" element={<ProtectedRoute><AgentDetail /></ProtectedRoute>} />
            <Route path="/app/phone-numbers" element={<ProtectedRoute><PhoneNumbers /></ProtectedRoute>} />
            <Route path="/app/transcriptions" element={<ProtectedRoute><Transcriptions /></ProtectedRoute>} />
            <Route path="/app/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
            <Route path="/app/organisation" element={<ProtectedRoute><Organisation /></ProtectedRoute>} />
            <Route path="/app/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
