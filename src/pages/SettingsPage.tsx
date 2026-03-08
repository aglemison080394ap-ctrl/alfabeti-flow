import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Save, School, Shield, CalendarDays } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [schoolName, setSchoolName]               = useState('');
  const [schoolAddress, setSchoolAddress]         = useState('');
  const [schoolCity, setSchoolCity]               = useState('');
  const [schoolCoordinator, setSchoolCoordinator] = useState('');
  const [activeSchoolYear, setActiveSchoolYear]   = useState<string>(String(new Date().getFullYear()));
  const [schoolId, setSchoolId]                   = useState('');
  const [loading, setLoading]                     = useState(false);
  const [adminEmail, setAdminEmail]               = useState('');
  const [adminName, setAdminName]                 = useState('');
  const [adminPassword, setAdminPassword]         = useState('');
  const [creatingAdmin, setCreatingAdmin]         = useState(false);

  useEffect(() => {
    supabase.from('school_info').select('*').single().then(({ data }) => {
      if (data) {
        setSchoolId(data.id);
        setSchoolName(data.name);
        setSchoolAddress(data.address || '');
        setSchoolCity(data.city || '');
        setSchoolCoordinator((data as any).coordinator || '');
        setActiveSchoolYear(String((data as any).active_school_year || new Date().getFullYear()));
      }
    });
  }, []);

  const handleSaveSchool = async () => {
    const yearNum = parseInt(activeSchoolYear);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      toast({ title: 'Ano letivo inválido', description: 'Informe um ano válido (ex: 2026)', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const payload = {
      name:               schoolName,
      address:            schoolAddress,
      city:               schoolCity,
      coordinator:        schoolCoordinator,
      active_school_year: yearNum,
    };
    const { error } = schoolId
      ? await supabase.from('school_info').update(payload).eq('id', schoolId)
      : await supabase.from('school_info').insert(payload);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configurações salvas!' });
    }
    setLoading(false);
  };

  const createAdmin = async () => {
    if (!adminEmail || !adminPassword || !adminName) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (adminPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setCreatingAdmin(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-user', {
        body: { email: adminEmail, password: adminPassword, name: adminName, role: 'admin' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error || res.data?.error) {
        const msg = res.data?.error || res.error?.message || 'Erro desconhecido';
        toast({ title: 'Erro ao criar administrador', description: msg, variant: 'destructive' });
      } else {
        toast({ title: 'Administrador criado!', description: `${adminName} pode fazer login com o e-mail e senha definidos.` });
        setAdminEmail(''); setAdminName(''); setAdminPassword('');
      }
    } catch (err) {
      toast({ title: 'Erro inesperado', description: String(err), variant: 'destructive' });
    }
    setCreatingAdmin(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-0.5">Gerencie as configurações do sistema</p>
      </div>

      {/* School Info */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <School className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Dados da Escola</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Escola</Label>
            <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Ex: E.M.E.F Roseli Paiva" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={schoolAddress} onChange={e => setSchoolAddress(e.target.value)} placeholder="Rua, número, bairro" />
            </div>
            <div className="space-y-2">
              <Label>Cidade / Estado</Label>
              <Input value={schoolCity} onChange={e => setSchoolCity(e.target.value)} placeholder="Ex: Anajás - PA" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Coordenador(a) Pedagógico(a) — padrão geral</Label>
            <Input
              value={schoolCoordinator}
              onChange={e => setSchoolCoordinator(e.target.value)}
              placeholder="Digite o nome do(a) coordenador(a)"
            />
            <p className="text-xs text-muted-foreground">
              Usado como padrão nos relatórios. Pode ser substituído pelo coordenador definido em cada turma.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Ano Letivo Vigente
            </Label>
            <Input
              value={activeSchoolYear}
              onChange={e => setActiveSchoolYear(e.target.value)}
              placeholder="Ex: 2026"
              className="w-32"
              maxLength={4}
            />
            <p className="text-xs text-muted-foreground">
              Informe o ano letivo atual (ex: 2026). Aparece nos cabeçalhos dos relatórios.
            </p>
          </div>

          <Button onClick={handleSaveSchool} disabled={loading} className="gap-2 gradient-primary text-primary-foreground rounded-xl">
            <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </Card>

      {/* Create Admin */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Criar Administrador</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Para cadastrar professores, acesse a página <strong>Professores</strong> no menu lateral.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Nome do administrador" />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@escola.com" />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <Button onClick={createAdmin} disabled={creatingAdmin} className="gap-2 gradient-primary text-primary-foreground rounded-xl">
            <Shield className="w-4 h-4" /> {creatingAdmin ? 'Criando...' : 'Criar Administrador'}
          </Button>
        </div>
      </Card>

      {/* Current user info */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Usuário Atual</h2>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-foreground"><span className="text-muted-foreground">Nome: </span>{profile?.name}</p>
          <p className="text-foreground"><span className="text-muted-foreground">Perfil: </span>
            <span className="capitalize">{profile?.role === 'admin' ? '👑 Administrador' : '🎓 Professor'}</span>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
