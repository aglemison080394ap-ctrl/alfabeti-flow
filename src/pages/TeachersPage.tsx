import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, UserCheck, Mail } from 'lucide-react';

const TeachersPage: React.FC = () => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const fetchTeachers = async () => {
    const { data } = await supabase.from('teachers').select('*').order('name');
    if (data) setTeachers(data);
    setLoading(false);
  };

  useEffect(() => { fetchTeachers(); }, []);

  const openCreate = () => {
    setEditingTeacher(null);
    setForm({ name: '', email: '', password: '' });
    setDialogOpen(true);
  };

  const openEdit = (teacher: any) => {
    setEditingTeacher(teacher);
    setForm({ name: teacher.name, email: teacher.email || '', password: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Campo obrigatório', description: 'Informe o nome do professor.', variant: 'destructive' });
      return;
    }

    if (editingTeacher) {
      const { error } = await supabase
        .from('teachers')
        .update({ name: form.name, email: form.email || null })
        .eq('id', editingTeacher.id);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Professor atualizado!', description: `${form.name} foi atualizado com sucesso.` });
    } else {
      // Create auth user for teacher
      let userId: string | null = null;
      if (form.email && form.password) {
        const { data: authData, error: authError } = await supabase.auth.admin
          ? await (supabase.auth as any).signUp({
            email: form.email,
            password: form.password,
            options: { data: { name: form.name, role: 'teacher' } }
          })
          : { data: null, error: new Error('No admin access') };

        if (authData?.user) userId = authData.user.id;
      }

      const { error } = await supabase
        .from('teachers')
        .insert({ name: form.name, email: form.email || null, user_id: userId });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Professor cadastrado!', description: `${form.name} foi adicionado com sucesso.` });
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
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display font-bold">
                {editingTeacher ? 'Editar Professor' : 'Novo Professor'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="professor@escola.com"
                />
              </div>
              {!editingTeacher && (
                <div className="space-y-2">
                  <Label>Senha de acesso</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco se não precisar de acesso ao sistema.
                  </p>
                </div>
              )}
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
          {[1,2,3].map(i => (
            <Card key={i} className="p-5 animate-pulse h-28 bg-muted" />
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
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-display font-bold text-lg flex-shrink-0">
                  {getInitials(teacher.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-foreground truncate">{teacher.name}</h3>
                  {teacher.email && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <p className="text-muted-foreground text-xs truncate">{teacher.email}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <div className={`w-2 h-2 rounded-full ${teacher.user_id ? 'bg-success' : 'bg-muted-foreground'}`} />
                    <span className="text-xs text-muted-foreground">
                      {teacher.user_id ? 'Com acesso ao sistema' : 'Sem acesso ao sistema'}
                    </span>
                  </div>
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
