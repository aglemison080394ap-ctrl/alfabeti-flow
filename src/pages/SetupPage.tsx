import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Shield, Loader2 } from 'lucide-react';

const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data, error } = await supabase.rpc('has_any_admin');
      if (!error && data === true) {
        // Admin already exists — redirect immediately, don't show setup form
        navigate('/login', { replace: true });
        return;
      }
      setAdminExists(false);
      setChecking(false);
    };
    check();
  }, [navigate]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'admin' } },
    });
    if (error) {
      toast({ title: 'Erro ao criar administrador', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Administrador criado!', description: 'Faça login com as credenciais cadastradas.' });
      navigate('/login');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 max-w-sm w-full text-center space-y-4 shadow-card">
          <Shield className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-xl font-display font-bold text-foreground">Sistema já configurado</h1>
          <p className="text-muted-foreground text-sm">Um administrador já foi cadastrado. Faça login para acessar o sistema.</p>
          <Button className="w-full gradient-primary text-primary-foreground rounded-xl" onClick={() => navigate('/login')}>
            Ir para o Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg mx-auto">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Primeiro Acesso</h1>
            <p className="text-muted-foreground text-sm mt-1">Crie a conta de administrador para começar</p>
          </div>
        </div>

        <Card className="p-6 shadow-card">
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-foreground">Criar Administrador</h2>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@escola.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full gap-2 gradient-primary text-primary-foreground rounded-xl h-11">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><Shield className="w-4 h-4" /> Criar Administrador</>}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Já possui uma conta?{' '}
          <button onClick={() => navigate('/login')} className="text-primary hover:underline font-medium">
            Fazer login
          </button>
        </p>
      </div>
    </div>
  );
};

export default SetupPage;
