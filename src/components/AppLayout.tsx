import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  BookOpen, LayoutDashboard, Users, School, GraduationCap,
  ClipboardList, BarChart3, Settings, LogOut, Menu, ChevronRight, UserCog
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',     path: '/',              roles: ['admin', 'teacher'] },
  { icon: Users,           label: 'Professores',   path: '/professores',   roles: ['admin'] },
  { icon: School,          label: 'Turmas',        path: '/turmas',        roles: ['admin', 'teacher'] },
  { icon: GraduationCap,   label: 'Alunos',        path: '/alunos',        roles: ['admin', 'teacher'] },
  { icon: ClipboardList,   label: 'Sondagens',     path: '/sondagens',     roles: ['admin', 'teacher'] },
  { icon: BarChart3,       label: 'Relatórios',    path: '/relatorios',    roles: ['admin', 'teacher'] },
  { icon: UserCog,         label: 'Meu Perfil',    path: '/meu-perfil',    roles: ['teacher'] },
  { icon: Settings,        label: 'Configurações', path: '/configuracoes', roles: ['admin'] },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = navItems.filter(item =>
    item.roles.includes(isAdmin ? 'admin' : 'teacher')
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sidebar-foreground font-display font-bold text-sm leading-tight truncate">
              Sondagem
            </h1>
            <p className="text-sidebar-foreground/60 text-xs truncate">Leitura e Escrita</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group",
                isActive
                  ? "bg-primary text-white shadow-lg"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0",
                isActive ? "text-white" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground"
              )} />
              <span className="font-medium text-sm truncate">{item.label}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto text-white/70 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50">
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarFallback className="bg-primary text-white text-sm font-bold">
              {profile?.name ? getInitials(profile.name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground font-medium text-sm truncate">
              {profile?.name || 'Usuário'}
            </p>
            <p className="text-sidebar-foreground/60 text-xs capitalize">
              {profile?.role === 'admin' ? '👑 Administrador' : '🎓 Professor'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="flex-shrink-0 text-sidebar-foreground/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-sidebar shadow-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 flex-shrink-0 flex flex-col bg-sidebar shadow-sidebar animate-slide-in-left">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 p-4 bg-card border-b border-border shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-foreground text-sm">Sondagem</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border px-6 py-2.5 flex items-center justify-end">
          <p className="text-xs text-muted-foreground/60">
            Desenvolvido por{' '}
            <span className="font-medium text-muted-foreground">Aglemison Paixão Lobato</span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;
