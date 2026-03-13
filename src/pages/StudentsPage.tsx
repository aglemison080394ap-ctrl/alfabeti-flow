import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, GraduationCap, Upload, Search } from 'lucide-react';

const StudentsPage: React.FC = () => {
  const { toast } = useToast();
  const { isAdmin, profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({ name: '', age: '', class_id: '' });
  const [bulkText, setBulkText] = useState('');
  const [bulkClassId, setBulkClassId] = useState('');

  const fetchAll = async () => {
    if (!profile) return;

    let classesQuery = supabase.from('classes').select('id, grade_year, class_letter').order('grade_year');
    let studentsQuery = supabase.from('students').select('*, classes(grade_year, class_letter)').order('name');

    // Teachers only see their own classes and students
    if (!isAdmin) {
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (teacherData) {
        classesQuery = classesQuery.eq('teacher_id', teacherData.id);
        // Fetch teacher's class IDs first, then filter students
        const { data: teacherClasses } = await classesQuery;
        if (teacherClasses && teacherClasses.length > 0) {
          setClasses(teacherClasses);
          const classIds = teacherClasses.map(c => c.id);
          const { data: studentsData } = await studentsQuery.in('class_id', classIds);
          if (studentsData) setStudents(studentsData);
        } else {
          setClasses([]);
          setStudents([]);
        }
        setLoading(false);
        return;
      }
    }

    const [{ data: studentsData }, { data: classesData }] = await Promise.all([
      studentsQuery,
      classesQuery,
    ]);
    if (studentsData) setStudents(studentsData);
    if (classesData) setClasses(classesData);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [profile]);

  const openCreate = () => {
    setEditingStudent(null);
    setForm({ name: '', age: '', class_id: '' });
    setDialogOpen(true);
  };

  const openEdit = (student: any) => {
    setEditingStudent(student);
    setForm({ name: student.name, age: student.age?.toString() || '', class_id: student.class_id });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.class_id) {
      toast({ title: 'Campos obrigatórios', description: 'Informe o nome e a turma.', variant: 'destructive' });
      return;
    }
    const payload = {
      name: form.name.trim(),
      age: form.age ? parseInt(form.age) : null,
      class_id: form.class_id,
    };
    const { error } = editingStudent
      ? await supabase.from('students').update(payload).eq('id', editingStudent.id)
      : await supabase.from('students').insert(payload);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingStudent ? 'Aluno atualizado!' : 'Aluno cadastrado!' });
    setDialogOpen(false);
    fetchAll();
  };

  const handleBulkImport = async () => {
    if (!bulkClassId) {
      toast({ title: 'Selecione a turma', description: 'Escolha a turma antes de importar.', variant: 'destructive' });
      return;
    }
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast({ title: 'Nenhum aluno', description: 'Cole a lista de alunos no campo de texto.', variant: 'destructive' });
      return;
    }

    const insertData = lines.map(line => ({
      name: line.replace(/^\d+[.)-\s]+/, '').trim(),
      class_id: bulkClassId,
    }));

    const { error } = await supabase.from('students').insert(insertData);
    if (error) {
      toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `${lines.length} alunos importados!`, description: 'Lista importada com sucesso.' });
    setBulkText('');
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (student: any) => {
    if (!confirm(`Deseja excluir ${student.name}?`)) return;
    const { error } = await supabase.from('students').delete().eq('id', student.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Aluno excluído!' });
    fetchAll();
  };

  const filteredStudents = students.filter(s => {
    const matchClass = selectedClass === 'all' || s.class_id === selectedClass;
    const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Alunos</h1>
          <p className="text-muted-foreground mt-0.5">{filteredStudents.length} aluno(s) encontrado(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2 gradient-primary text-primary-foreground rounded-xl">
              <Plus className="w-4 h-4" /> Novo Aluno
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display font-bold">
                {editingStudent ? 'Editar Aluno' : 'Cadastrar Aluno(s)'}
              </DialogTitle>
            </DialogHeader>
            {editingStudent ? (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Idade</Label>
                  <Input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} min="4" max="20" />
                </div>
                <div className="space-y-2">
                  <Label>Turma *</Label>
                  <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.grade_year} {c.class_letter}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="flex-1 gradient-primary text-primary-foreground">Salvar</Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="manual" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="manual" className="flex-1">Cadastro Manual</TabsTrigger>
                  <TabsTrigger value="bulk" className="flex-1 gap-1">
                    <Upload className="w-3.5 h-3.5" /> Importação Rápida
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="manual" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome completo *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: João da Silva" />
                  </div>
                  <div className="space-y-2">
                    <Label>Idade</Label>
                    <Input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} min="4" max="20" placeholder="Ex: 7" />
                  </div>
                  <div className="space-y-2">
                    <Label>Turma *</Label>
                    <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.grade_year} {c.class_letter}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} className="flex-1 gradient-primary text-primary-foreground">Cadastrar</Button>
                  </div>
                </TabsContent>
                <TabsContent value="bulk" className="space-y-4 pt-4">
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-primary">
                    💡 Cole a lista de alunos do Excel ou Google Sheets. Cada linha vira um aluno automaticamente.
                  </div>
                  <div className="space-y-2">
                    <Label>Turma de destino *</Label>
                    <Select value={bulkClassId} onValueChange={setBulkClassId}>
                      <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.grade_year} {c.class_letter}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lista de alunos (um por linha)</Label>
                    <Textarea
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder={"1. Ana Paula Santos\n2. João Henrique Silva\n3. Maria Fernanda Costa\n..."}
                      className="h-40 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {bulkText.split('\n').filter(l => l.trim()).length} aluno(s) detectado(s)
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleBulkImport} className="flex-1 gradient-primary text-primary-foreground gap-2">
                      <Upload className="w-4 h-4" /> Importar
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-full sm:w-52 bg-card">
            <SelectValue placeholder="Filtrar por turma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            {classes.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.grade_year} {c.class_letter}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Card key={i} className="p-4 animate-pulse h-16 bg-muted" />)}
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Nenhum aluno encontrado</p>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-card">
          <div className="divide-y divide-border">
            {filteredStudents.map((student, idx) => (
              <div key={student.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-sm flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{student.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {student.classes?.grade_year} {student.classes?.class_letter}
                    {student.age && ` • ${student.age} anos`}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(student)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(student)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default StudentsPage;
