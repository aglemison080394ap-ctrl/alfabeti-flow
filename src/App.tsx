import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";

import Dashboard from "@/pages/Dashboard";
import TeachersPage from "@/pages/TeachersPage";
import ClassesPage from "@/pages/ClassesPage";
import StudentsPage from "@/pages/StudentsPage";
import AssessmentsPage from "@/pages/AssessmentsPage";
import ReportsPage from "@/pages/ReportsPage";
import SettingsPage from "@/pages/SettingsPage";
import TeacherProfilePage from "@/pages/TeacherProfilePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

/** Wrapper que isola cada página em seu próprio ErrorBoundary */
const PageBoundary = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>{children}</ErrorBoundary>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          {/* ErrorBoundary global — captura apenas crashes totais do router/auth */}
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <AppLayout>
                    <PageBoundary><Dashboard /></PageBoundary>
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/professores" element={
                <ProtectedRoute adminOnly>
                  <AppLayout>
                    <PageBoundary><TeachersPage /></PageBoundary>
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/turmas" element={
                <ProtectedRoute>
                  <AppLayout>
                    <PageBoundary><ClassesPage /></PageBoundary>
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/alunos" element={
                <ProtectedRoute>
                  <AppLayout>
                    <PageBoundary><StudentsPage /></PageBoundary>
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/sondagens" element={
                <ProtectedRoute>
                  <AppLayout>
                    <PageBoundary><AssessmentsPage /></PageBoundary>
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/relatorios" element={
                <ProtectedRoute>
                  <AppLayout>
                    <PageBoundary><ReportsPage /></PageBoundary>
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/configuracoes" element={
                <ProtectedRoute adminOnly>
                  <AppLayout>
                    <PageBoundary><SettingsPage /></PageBoundary>
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/meu-perfil" element={
                <ProtectedRoute>
                  <AppLayout>
                    <PageBoundary><TeacherProfilePage /></PageBoundary>
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
