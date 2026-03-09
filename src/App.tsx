import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout><Dashboard /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/professores" element={
              <ProtectedRoute adminOnly>
                <AppLayout><TeachersPage /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/turmas" element={
              <ProtectedRoute>
                <AppLayout><ClassesPage /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/alunos" element={
              <ProtectedRoute>
                <AppLayout><StudentsPage /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/sondagens" element={
              <ProtectedRoute>
                <AppLayout><AssessmentsPage /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/relatorios" element={
              <ProtectedRoute>
                <AppLayout><ReportsPage /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/configuracoes" element={
              <ProtectedRoute adminOnly>
                <AppLayout><SettingsPage /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/meu-perfil" element={
              <ProtectedRoute>
                <AppLayout><TeacherProfilePage /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
