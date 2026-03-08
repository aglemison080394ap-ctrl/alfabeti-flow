import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, School, Users } from 'lucide-react';

// Only 1º–5º Ano (Ensino Fundamental I)
const GRADES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const ClassesPage: React.FC = () => {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [form, setForm] = useState({
    grade_year: '',
    class_letter: '',
    teacher_id: '',
    coordinator_name: '',
  });

  const fetchAll = async () => {
    const [{ data: classesData }, { data: teachersData }, { data: studentsData }] = await Promise.all([
      supabase.from('classes').select('*, teachers(name)').order('grade_year'),
      supabase.from('teachers').select('id, name').order('name'),
      supabase.from('students').select('class_id'),
    ]);
    if (classesData) setClasses(classesData);
    if (teachersData) setTeachers(teachersData);

    if (studentsData) {
      const counts: Record<string, number> = {};
      studentsData.forEach(s => {
        counts[s.class_id] = (counts[s.class_id] || 0) + 1;
      });
      setStudentCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingClass(null);
    setForm({ grade_year: '', class_letter: '', teacher_id: '', coordinator_name: '' });
    setDialogOpen(true);
  };

  const openEdit = (cls: any) => {
    setEditingClass(cls);
    setForm({
      grade_year: cls.grade_year,
      class_letter: cls.class_letter,
      teacher_id: cls.teacher_id || '',
      coordinator_name: (cls as any).coordinator_name || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.grade_year || !form.class_letter) {
      toast({ title: 'Campos obrigatórios', description: 'Informe o ano e a letra da turma.', variant: 'destructive' });
      return;
    }
    const payload = {
      grade_year: form.grade_year,
      class_letter: form.class_letter,
      teacher_id: form.teacher_id || null,
      coordinator_name: form.coordinator_name || null,
    };

    const { error } = editingClass
      ? await supabase.from('classes').update(payload).eq('id', editingClass.id)
      : await supabase.from('classes').insert(payload);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingClass ? 'Turma atualizada!' : 'Turma criada!' });
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (cls: any) => {
    if (!confirm(`Deseja excluir a turma ${cls.grade_year} ${cls.class_letter}? Todos os alunos serão excluídos.`)) return;
    const { error } = await supabase.from('classes').delete().eq('id', cls.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Turma excluída!' });
    fetchAll();
  };

  const gradeColors: Record<string, string> = {
    '1': 'bg-red-100 text-red-700 border-red-200',
    '2': 'bg-orange-100 text-orange-700 border-orange-200',
    '3': 'bg-amber-100 text-amber-700 border-amber-200',
    '4': 'bg-blue-100 text-blue-700 border-blue-200',
    '5': 'bg-purple-100 text-purple-700 border-purple-200',
  };
  const getGradeColor = (grade: string) => gradeColors[grade[0]] || 'bg-muted text-muted-foreground border-border';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Turmas</h1>
          <p className="text-muted-foreground mt-0.5">{classes.length} turma(s) cadastrada(s)</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="gap-2 gradient-primary text-primary-foreground rounded-xl">
                <Plus className="w-4 h-4" /> Nova Turma
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display font-bold">
                  {editingClass ? 'Editar Turma' : 'Nova Turma'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Série/Ano Escolar *</Label>
                  <Select value={form.grade_year} onValueChange={v => setForm(f => ({ ...f, grade_year: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Letra da Turma *</Label>
                  <Select value={form.class_letter} onValueChange={v => setForm(f => ({ ...f, class_letter: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a letra" />
                    </SelectTrigger>
                    <SelectContent>
                      {LETTERS.map(l => <SelectItem key={l} value={l}>Turma {l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Professor Responsável</Label>
                  <Select value={form.teacher_id || 'none'} onValueChange={v => setForm(f => ({ ...f, teacher_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o professor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem professor</SelectItem>
                      {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome do(a) Coordenador(a)</Label>
                  <Input
                    value={form.coordinator_name}
                    onChange={e => setForm(f => ({ ...f, coordinator_name: e.target.value }))}
                    placeholder="Ex: Maria da Silva"
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparecerá no cabeçalho do relatório dessa turma.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="flex-1 gradient-primary text-primary-foreground">
                    {editingClass ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4].map(i => <Card key={i} className="p-5 animate-pulse h-36 bg-muted" />)}
        </div>
      ) : classes.length === 0 ? (
        <Card className="p-12 text-center">
          <School className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Nenhuma turma cadastrada</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(cls => (
            <Card key={cls.id} className="p-5 shadow-card hover:shadow-hover transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className={`px-3 py-1 rounded-lg border text-sm font-display font-bold ${getGradeColor(cls.grade_year)}`}>
                  {cls.grade_year} {cls.class_letter}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cls)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(cls)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{studentCounts[cls.id] || 0}</strong> aluno(s)
                </span>
              </div>
              {cls.teachers && (
                <div className="mt-2 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground truncate">{cls.teachers.name}</span>
                </div>
              )}
              {!cls.teachers && (
                <div className="mt-2 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Sem professor vinculado</span>
                </div>
              )}
              {(cls as any).coordinator_name && (
                <div className="mt-1 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-xs text-muted-foreground truncate">Coord: {(cls as any).coordinator_name}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassesPage;
