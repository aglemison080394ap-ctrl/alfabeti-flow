import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Save, School, User, Shield } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolCity, setSchoolCity] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    supabase.from('school_info').select('*').single().then(({ data }) => {
      if (data) {
        setSchoolId(data.id);
        setSchoolName(data.name);
        setSchoolAddress(data.address || '');
        setSchoolCity(data.city || '');
      }
    });
  }, []);

  const handleSaveSchool = async () => {
    setLoading(true);
    const { error } = schoolId
      ? await supabase.from('school_info').update({ name: schoolName, address: schoolAddress, city: schoolCity }).eq('id', schoolId)
      : await supabase.from('school_info').insert({ name: schoolName, address: schoolAddress, city: schoolCity });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configurações salvas!' });
    }
    setLoading(false);
  };

  const handleCreateAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword || !newAdminName) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setCreatingAdmin(true);
    const { data, error } = await supabase.auth.signUp({
      email: newAdminEmail,
      password: newAdminPassword,
      options: { data: { name: newAdminName, role: 'admin' } },
    });
    if (error) {
      toast({ title: 'Erro ao criar administrador', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Administrador criado!', description: `${newAdminName} foi cadastrado como administrador.` });
      setNewAdminEmail(''); setNewAdminName(''); setNewAdminPassword('');
    }
    setCreatingAdmin(false);
  };

  const handleCreateTeacher = async () => {
    if (!newAdminEmail || !newAdminPassword || !newAdminName) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setCreatingAdmin(true);
    const { error } = await supabase.auth.signUp({
      email: newAdminEmail,
      password: newAdminPassword,
      options: { data: { name: newAdminName, role: 'teacher' } },
    });
    if (error) {
      toast({ title: 'Erro ao criar usuário', description: error.message, variant: 'destructive' });
    } else {
      // Also add to teachers table
      await supabase.from('teachers').insert({ name: newAdminName, email: newAdminEmail });
      toast({ title: 'Professor criado!', description: `${newAdminName} foi cadastrado e pode fazer login.` });
      setNewAdminEmail(''); setNewAdminName(''); setNewAdminPassword('');
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
            <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Ex: Escola Municipal João da Silva" />
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={schoolAddress} onChange={e => setSchoolAddress(e.target.value)} placeholder="Rua, número, bairro" />
          </div>
          <div className="space-y-2">
            <Label>Cidade / Estado</Label>
            <Input value={schoolCity} onChange={e => setSchoolCity(e.target.value)} placeholder="Ex: São Paulo - SP" />
          </div>
          <Button onClick={handleSaveSchool} disabled={loading} className="gap-2 gradient-primary text-primary-foreground rounded-xl">
            <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar Dados'}
          </Button>
        </div>
      </Card>

      {/* Create Users */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Criar Usuário</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={newAdminName} onChange={e => setNewAdminName(e.target.value)} placeholder="Nome do usuário" />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="email@escola.com" />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCreateTeacher} disabled={creatingAdmin} variant="outline" className="flex-1 gap-2">
              <User className="w-4 h-4" /> Criar Professor
            </Button>
            <Button onClick={handleCreateAdmin} disabled={creatingAdmin} className="flex-1 gap-2 gradient-primary text-primary-foreground rounded-xl">
              <Shield className="w-4 h-4" /> Criar Admin
            </Button>
          </div>
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
