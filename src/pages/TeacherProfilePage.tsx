import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, User, UserCog } from 'lucide-react';

const TeacherProfilePage: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [teacherId, setTeacherId]               = useState('');
  const [coordinatorName, setCoordinatorName]   = useState('');
  const [loading, setLoading]                   = useState(true);
  const [saving, setSaving]                     = useState(false);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const { data } = await supabase
        .from('teachers')
        .select('id, coordinator_name')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      if (data) {
        setTeacherId(data.id);
        setCoordinatorName((data as any).coordinator_name || '');
      }
      setLoading(false);
    };
    load();
  }, [profile]);

  const handleSave = async () => {
    if (!teacherId) {
      toast({ title: 'Perfil não encontrado', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('teachers')
      .update({ coordinator_name: coordinatorName } as any)
      .eq('id', teacherId);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Coordenador(a) salvo!', description: 'O nome aparecerá no cabeçalho dos relatórios.' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground mt-0.5">Informações do seu perfil de professor</p>
      </div>

      {/* Dados do perfil */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Dados Pessoais</h2>
        </div>
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={profile?.name || ''} disabled className="bg-muted/50 cursor-not-allowed" />
          <p className="text-xs text-muted-foreground">Para alterar seu nome, contacte o administrador.</p>
        </div>
      </Card>

      {/* Coordenador */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <UserCog className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Coordenador(a) Pedagógico(a)</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Informe o nome do(a) seu(sua) coordenador(a). Esse nome será exibido automaticamente no cabeçalho dos relatórios das suas turmas.
        </p>
        {loading ? (
          <div className="h-10 bg-muted animate-pulse rounded-md" />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do(a) Coordenador(a)</Label>
              <Input
                value={coordinatorName}
                onChange={e => setCoordinatorName(e.target.value)}
                placeholder="Ex: Ana Paula Ferreira"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco se não desejar exibir um coordenador no relatório.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 gradient-primary text-primary-foreground rounded-xl"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TeacherProfilePage;
