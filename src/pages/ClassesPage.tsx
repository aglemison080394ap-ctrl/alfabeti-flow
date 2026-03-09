import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, School, Users, Search } from 'lucide-react';

const GRADES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

const ClassesPage: React.FC = () => {
  const { toast } = useToast();
  const { isAdmin, profile } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [form, setForm] = useState({
    grade_year: '',
    class_letter: '',
    teacher_id: '',
    coordinator_name: '',
  });

  const fetchAll = async () => {
    if (!profile) return;

    let classesQuery = supabase.from('classes').select('*, teachers(name)').order('grade_year').order('class_letter');

    if (!isAdmin) {
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      if (teacherData) {
        classesQuery = classesQuery.eq('teacher_id', teacherData.id);
      } else {
        setClasses([]);
        setLoading(false);
        return;
      }
    }

    const [{ data: classesData }, { data: teachersData }, { data: studentsData }] = await Promise.all([
      classesQuery,
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

  useEffect(() => { fetchAll(); }, [profile]);

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
      coordinator_name: cls.coordinator_name || '',
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
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingClass ? 'Turma atualizada com sucesso!' : 'Turma criada com sucesso!' });
    setDialogOpen(false);
    fetchAll();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('classes').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Turma excluída', description: `${deleteTarget.grade_year} ${deleteTarget.class_letter} foi removida do sistema.` });
      fetchAll();
    }
    setDeleteTarget(null);
  };

  const gradeColors: Record<string, string> = {
    '1': 'bg-red-100 text-red-700 border-red-200',
    '2': 'bg-orange-100 text-orange-700 border-orange-200',
    '3': 'bg-amber-100 text-amber-700 border-amber-200',
    '4': 'bg-blue-100 text-blue-700 border-blue-200',
    '5': 'bg-purple-100 text-purple-700 border-purple-200',
  };
  const getGradeColor = (grade: string) => gradeColors[grade[0]] || 'bg-muted text-muted-foreground border-border';

  const filtered = classes.filter(cls => {
    const matchesGrade = filterGrade === 'all' || cls.grade_year === filterGrade;
    const matchesSearch = search === '' ||
      `${cls.grade_year} ${cls.class_letter}`.toLowerCase().includes(search.toLowerCase()) ||
      (cls.teachers?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesGrade && matchesSearch;
  });

  // Group by grade for better readability with many classes
  const grouped = GRADES.reduce<Record<string, any[]>>((acc, grade) => {
    const items = filtered.filter(c => c.grade_year === grade);
    if (items.length > 0) acc[grade] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
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
                    <SelectTrigger><SelectValue placeholder="Selecione o ano" /></SelectTrigger>
                    <SelectContent>
                      {GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Letra da Turma *</Label>
                  <Select value={form.class_letter} onValueChange={v => setForm(f => ({ ...f, class_letter: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a letra" /></SelectTrigger>
                    <SelectContent>
                      {LETTERS.map(l => <SelectItem key={l} value={l}>Turma {l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Professor Responsável</Label>
                  <Select value={form.teacher_id || 'none'} onValueChange={v => setForm(f => ({ ...f, teacher_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o professor" /></SelectTrigger>
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
                  <p className="text-xs text-muted-foreground">Aparecerá no cabeçalho do relatório dessa turma.</p>
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

      {/* Filters */}
      {classes.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar turma ou professor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Todos os anos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <Card key={i} className="p-5 animate-pulse h-32 bg-muted" />)}
        </div>
      ) : classes.length === 0 ? (
        <Card className="p-12 text-center">
          <School className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Nenhuma turma cadastrada</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhuma turma encontrada para os filtros selecionados.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([grade, items]) => (
            <div key={grade}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${getGradeColor(grade)}`}>{grade}</span>
                <span>{items.length} turma(s)</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(cls => (
                  <Card key={cls.id} className="p-4 shadow-card hover:shadow-hover transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <div className={`px-2.5 py-1 rounded-lg border text-sm font-display font-bold ${getGradeColor(cls.grade_year)}`}>
                        {cls.grade_year} – {cls.class_letter}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cls)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(cls)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-3">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        <strong className="text-foreground">{studentCounts[cls.id] || 0}</strong> aluno(s)
                      </span>
                    </div>

                    {cls.teachers && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-xs text-muted-foreground truncate">{cls.teachers.name}</span>
                      </div>
                    )}
                    {!cls.teachers && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                        <span className="text-xs text-muted-foreground">Sem professor</span>
                      </div>
                    )}
                    {cls.coordinator_name && (
                      <div className="mt-1 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                        <span className="text-xs text-muted-foreground truncate">Coord: {cls.coordinator_name}</span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold">
              Excluir turma {deleteTarget?.grade_year} {deleteTarget?.class_letter}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação é permanente e não poderá ser desfeita. Todos os alunos e sondagens vinculados a esta turma também serão removidos do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, excluir turma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClassesPage;
