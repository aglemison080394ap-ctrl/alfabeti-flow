import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Eye, EyeOff, GraduationCap, Lock, Mail, User, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Tab = 'admin' | 'professor';

const LoginPage: React.FC = () => {
  const { signIn, user, loading, setSessionFromTokens } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('professor');

  // Admin fields
  const [email, setEmail] = useState('');

  // Shared
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: 'E-mail ou senha incorretos.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await supabase.functions.invoke('teacher-login', {
        body: { name: name.trim(), password },
      });

      if (res.error || res.data?.error) {
        const msg = res.data?.error || res.error?.message || 'Erro ao entrar';
        toast({ title: 'Erro ao entrar', description: msg, variant: 'destructive' });
      } else {
        const { access_token, refresh_token } = res.data;
        await setSessionFromTokens(access_token, refresh_token);
      }
    } catch (err) {
      toast({ title: 'Erro inesperado', description: String(err), variant: 'destructive' });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-primary-light blur-3xl" />
          <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-accent blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-display font-bold text-xl leading-tight">Sistema de Sondagem</h1>
              <p className="text-sidebar-foreground text-sm">Leitura e Escrita</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-white font-display font-bold text-4xl leading-tight mb-4">
              Monitore a<br />
              <span className="text-accent">alfabetização</span><br />
              dos seus alunos
            </h2>
            <p className="text-sidebar-foreground text-lg leading-relaxed">
              Registre sondagens, acompanhe a evolução e gere relatórios pedagógicos completos.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: '📚', label: 'Sondagens', desc: 'Por bimestre' },
              { icon: '📊', label: 'Gráficos', desc: 'Pedagógicos' },
              { icon: '📄', label: 'Relatórios', desc: 'PDF e PNG' },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-white font-display font-bold text-sm">{item.label}</div>
                <div className="text-sidebar-foreground text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-sidebar-foreground text-sm">
            <GraduationCap className="w-4 h-4" />
            <span>Sistema de Monitoramento da Alfabetização Escolar</span>
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-foreground font-display font-bold text-lg">Sistema de Sondagem</h1>
              <p className="text-muted-foreground text-sm">Leitura e Escrita</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-foreground font-display font-bold text-3xl mb-2">Bem-vindo!</h2>
            <p className="text-muted-foreground">Selecione seu perfil para entrar.</p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl border border-border bg-muted p-1 mb-6">
            <button
              type="button"
              onClick={() => setTab('professor')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'professor'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Professor
            </button>
            <button
              type="button"
              onClick={() => setTab('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'admin'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="w-4 h-4" />
              Administrador
            </button>
          </div>

          {/* Professor login */}
          {tab === 'professor' && (
            <form onSubmit={handleTeacherSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="teacher-name" className="text-foreground font-medium">Nome do Professor</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="teacher-name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-12 bg-card border-border"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="teacher-password" className="text-foreground font-medium">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="teacher-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-card border-border"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 gradient-primary text-primary-foreground font-display font-bold text-base rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </div>
                ) : 'Entrar como Professor'}
              </Button>
            </form>
          )}

          {/* Admin login */}
          {tab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@escola.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-card border-border"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-foreground font-medium">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-card border-border"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 gradient-primary text-primary-foreground font-display font-bold text-base rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </div>
                ) : 'Entrar como Admin'}
              </Button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
