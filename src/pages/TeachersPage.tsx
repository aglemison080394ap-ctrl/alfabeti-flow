import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, UserCheck } from 'lucide-react';

const TeachersPage: React.FC = () => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [name, setName] = useState('');

  const fetchTeachers = async () => {
    const { data } = await supabase.from('teachers').select('*').order('name');
    if (data) setTeachers(data);
    setLoading(false);
  };

  useEffect(() => { fetchTeachers(); }, []);

  const openCreate = () => {
    setEditingTeacher(null);
    setName('');
    setDialogOpen(true);
  };

  const openEdit = (teacher: any) => {
    setEditingTeacher(teacher);
    setName(teacher.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Campo obrigatório', description: 'Informe o nome do professor.', variant: 'destructive' });
      return;
    }

    if (editingTeacher) {
      const { error } = await supabase
        .from('teachers')
        .update({ name })
        .eq('id', editingTeacher.id);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Professor atualizado!', description: `${name} foi atualizado com sucesso.` });
    } else {
      const { error } = await supabase
        .from('teachers')
        .insert({ name });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Professor cadastrado!', description: `${name} foi adicionado com sucesso.` });
    }

    setDialogOpen(false);
    fetchTeachers();
  };

  const handleDelete = async (teacher: any) => {
    if (!confirm(`Deseja excluir ${teacher.name}? Todas as turmas vinculadas serão desvinculadas.`)) return;
    const { error } = await supabase.from('teachers').delete().eq('id', teacher.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Professor excluído!' });
    fetchTeachers();
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Professores</h1>
          <p className="text-muted-foreground mt-0.5">{teachers.length} professor(es) cadastrado(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2 gradient-primary text-primary-foreground rounded-xl">
              <Plus className="w-4 h-4" /> Novo Professor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold">
                {editingTeacher ? 'Editar Professor' : 'Novo Professor'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="flex-1 gradient-primary text-primary-foreground">
                  {editingTeacher ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 animate-pulse h-24 bg-muted" />
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <Card className="p-12 text-center">
          <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Nenhum professor cadastrado</p>
          <p className="text-muted-foreground text-sm mt-1">Clique em "Novo Professor" para começar.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map(teacher => (
            <Card key={teacher.id} className="p-5 shadow-card hover:shadow-hover transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-display font-bold text-lg flex-shrink-0">
                  {getInitials(teacher.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-foreground truncate">{teacher.name}</h3>
                </div>
              </div>
              <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => openEdit(teacher)}
                >
                  <Pencil className="w-3 h-3" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDelete(teacher)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeachersPage;
