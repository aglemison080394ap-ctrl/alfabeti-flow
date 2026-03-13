import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ClipboardList, Search, Save, AlertCircle, RefreshCw } from 'lucide-react';

const WRITING_LEVELS = [
  { value: 'PS', label: 'PS — Pré-silábico', desc: 'Não estabelece relação letra-som', className: 'level-ps' },
  { value: 'S', label: 'S — Silábico', desc: 'Uma letra para cada sílaba', className: 'level-s' },
  { value: 'SA', label: 'SA — Silábico-Alfabético', desc: 'Transição silábico para alfabético', className: 'level-sa' },
  { value: 'A', label: 'A — Alfabético', desc: 'Compreende a representação fonética', className: 'level-a' },
];

const READING_LEVELS = [
  { value: 'NL', label: 'NL — Não leu', className: 'level-nl' },
  { value: 'LP', label: 'LP — Leu palavras', className: 'level-lp' },
  { value: 'LF', label: 'LF — Leu frase', className: 'level-lf' },
  { value: 'LT', label: 'LT — Leu texto', className: 'level-lt' },
];

const AssessmentsPage: React.FC = () => {
  const { toast } = useToast();
  const { isAdmin, profile } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<Record<string, any>>({});
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedBimestre, setSelectedBimestre] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    if (!profile) return;
    setLoadingClasses(true);
    setClassesError(null);
    try {
      if (isAdmin) {
        const { data, error } = await supabase.from('classes').select('*, teachers(name)').order('grade_year');
        if (error) throw error;
        setClasses(data || []);
      } else {
        const { data: teacherData, error: tErr } = await supabase
          .from('teachers').select('id').eq('user_id', profile.user_id).maybeSingle();
        if (tErr) throw tErr;
        if (teacherData) {
          const { data, error } = await supabase
            .from('classes').select('*, teachers(name)').eq('teacher_id', teacherData.id).order('grade_year');
          if (error) throw error;
          const classList = data || [];
          setClasses(classList);
          if (classList.length > 0 && !selectedClass) setSelectedClass(classList[0].id);
        }
      }
    } catch (err: any) {
      console.error('[AssessmentsPage] loadClasses:', err);
      setClassesError(err?.message || 'Erro ao carregar turmas.');
    } finally {
      setLoadingClasses(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isAdmin]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const fetchStudentsAndAssessments = useCallback(async () => {
    if (!selectedClass) return;
    setLoadingStudents(true);
    setStudentsError(null);
    try {
      const { data: studentsData, error: sErr } = await supabase
        .from('students').select('*').eq('class_id', selectedClass).order('name');
      if (sErr) throw sErr;

      const studentList = studentsData || [];
      setStudents(studentList);

      if (studentList.length > 0) {
        const ids = studentList.map(s => s.id);
        const { data: assessmentsData, error: aErr } = await supabase
          .from('assessments').select('*').in('student_id', ids).eq('bimestre', selectedBimestre as any);
        if (aErr) throw aErr;

        const assessmentsMap: Record<string, any> = {};
        assessmentsData?.forEach(a => { assessmentsMap[a.student_id] = a; });
        setAssessments(assessmentsMap);
      } else {
        setAssessments({});
      }
    } catch (err: any) {
      console.error('[AssessmentsPage] fetchStudentsAndAssessments:', err);
      setStudentsError(err?.message || 'Erro ao carregar alunos.');
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass, selectedBimestre]);

  useEffect(() => { fetchStudentsAndAssessments(); }, [fetchStudentsAndAssessments]);

  const openEdit = (student: any) => {
    const existing = assessments[student.id];
    setEditingStudent(student);
    setEditForm({
      writing_level: existing?.writing_level || '',
      reading_level: existing?.reading_level || '',
      absences: existing?.absences?.toString() || '0',
      notes: existing?.notes || '',
    });
  };

  const handleSave = async () => {
    if (!editingStudent) return;
    setSaving(editingStudent.id);
    try {
      const payload = {
        student_id: editingStudent.id,
        bimestre: selectedBimestre as '1' | '2' | '3' | '4',
        writing_level: editForm.writing_level || null,
        reading_level: editForm.reading_level || null,
        absences: parseInt(editForm.absences) || 0,
        notes: editForm.notes || null,
      };
      const existing = assessments[editingStudent.id];
      const { error } = existing
        ? await supabase.from('assessments').update(payload).eq('id', existing.id)
        : await supabase.from('assessments').insert(payload);
      if (error) throw error;
      toast({ title: 'Sondagem salva!', description: `${editingStudent.name} — ${selectedBimestre}º Bimestre` });
      setEditingStudent(null);
      fetchStudentsAndAssessments();
    } catch (err: any) {
      console.error('[AssessmentsPage] handleSave:', err);
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const getWritingBadge = (level: string | null) => {
    if (!level) return <span className="text-xs text-muted-foreground italic">—</span>;
    const l = WRITING_LEVELS.find(x => x.value === level);
    return <Badge variant="outline" className={cn("text-xs font-bold", l?.className)}>{level}</Badge>;
  };

  const getReadingBadge = (level: string | null) => {
    if (!level) return <span className="text-xs text-muted-foreground italic">—</span>;
    const l = READING_LEVELS.find(x => x.value === level);
    return <Badge variant="outline" className={cn("text-xs font-bold", l?.className)}>{level}</Badge>;
  };

  const filteredStudents = students.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedClassData = classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Sondagens</h1>
        <p className="text-muted-foreground mt-0.5">Registre os níveis de leitura e escrita por bimestre</p>
      </div>

      {classesError ? (
        <Card className="p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto opacity-70" />
          <p className="text-destructive font-medium text-sm">{classesError}</p>
          <Button variant="outline" size="sm" onClick={loadClasses} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
          </Button>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={loadingClasses}>
              <SelectTrigger className="w-full sm:w-56 bg-card">
                <SelectValue placeholder={loadingClasses ? 'Carregando...' : 'Selecione a turma'} />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.grade_year} {c.class_letter}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedBimestre} onValueChange={setSelectedBimestre}>
              <SelectTrigger className="w-full sm:w-44 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['1', '2', '3', '4'].map(b => (
                  <SelectItem key={b} value={b}>{b}º Bimestre</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClass && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar aluno..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 bg-card"
                />
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground font-medium">Escrita:</span>
              {WRITING_LEVELS.map(l => (
                <Badge key={l.value} variant="outline" className={cn("text-xs", l.className)}>{l.value}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground font-medium">Leitura:</span>
              {READING_LEVELS.map(l => (
                <Badge key={l.value} variant="outline" className={cn("text-xs", l.className)}>{l.value}</Badge>
              ))}
            </div>
          </div>

          {!selectedClass ? (
            <Card className="p-12 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground font-medium">Selecione uma turma para começar</p>
            </Card>
          ) : studentsError ? (
            <Card className="p-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto opacity-70" />
              <p className="text-destructive font-medium text-sm">{studentsError}</p>
              <Button variant="outline" size="sm" onClick={fetchStudentsAndAssessments} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
            </Card>
          ) : loadingStudents ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Card key={i} className="p-4 animate-pulse h-16 bg-muted" />)}
            </div>
          ) : filteredStudents.length === 0 ? (
            <Card className="p-12 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground font-medium">Nenhum aluno nesta turma</p>
              <p className="text-muted-foreground text-sm mt-1">Cadastre alunos na seção "Alunos".</p>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-bold text-foreground">
                    {selectedClassData?.grade_year} {selectedClassData?.class_letter}
                  </h2>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {selectedBimestre}º Bimestre
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(assessments).length}/{students.length} avaliados
                </p>
              </div>

              <Card className="overflow-hidden shadow-card">
                <div className="hidden sm:grid grid-cols-[2rem_1fr_7rem_7rem_5rem_6rem] gap-3 px-5 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <div>#</div><div>Nome</div><div>Escrita</div><div>Leitura</div><div>Faltas</div><div></div>
                </div>
                <div className="divide-y divide-border">
                  {filteredStudents.map((student, idx) => {
                    const assessment = assessments[student.id];
                    return (
                      <div key={student.id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-sm text-muted-foreground font-mono flex-shrink-0">{idx + 1}</span>
                          <span className="flex-1 font-medium text-foreground truncate">{student.name}</span>
                          <div className="hidden sm:flex items-center gap-3">
                            <div className="w-28">{getWritingBadge(assessment?.writing_level)}</div>
                            <div className="w-28">{getReadingBadge(assessment?.reading_level)}</div>
                            <div className="w-20 text-sm text-muted-foreground">
                              {assessment?.absences ?? '—'} faltas
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={assessment ? 'outline' : 'default'}
                            onClick={() => openEdit(student)}
                            className={cn(
                              "gap-1 flex-shrink-0 rounded-lg",
                              !assessment && "gradient-primary text-primary-foreground"
                            )}
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{assessment ? 'Editar' : 'Registrar'}</span>
                          </Button>
                        </div>
                        <div className="flex sm:hidden items-center gap-2 mt-2 ml-11">
                          {getWritingBadge(assessment?.writing_level)}
                          {getReadingBadge(assessment?.reading_level)}
                          {assessment?.absences !== undefined && (
                            <span className="text-xs text-muted-foreground">{assessment.absences} faltas</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={open => !open && setEditingStudent(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">
              Sondagem — {editingStudent?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{selectedBimestre}º Bimestre</p>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="font-medium">Nível de Escrita</Label>
              <div className="grid grid-cols-2 gap-2">
                {WRITING_LEVELS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setEditForm((f: any) => ({ ...f, writing_level: editForm.writing_level === l.value ? '' : l.value }))}
                    className={cn(
                      "p-3 rounded-xl border-2 text-left transition-all",
                      editForm.writing_level === l.value
                        ? cn("border-primary bg-primary/10", l.className)
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="font-display font-bold text-sm">{l.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Nível de Leitura</Label>
              <div className="grid grid-cols-2 gap-2">
                {READING_LEVELS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setEditForm((f: any) => ({ ...f, reading_level: editForm.reading_level === l.value ? '' : l.value }))}
                    className={cn(
                      "p-3 rounded-xl border-2 text-left transition-all",
                      editForm.reading_level === l.value
                        ? cn("border-primary bg-primary/10", l.className)
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="font-display font-bold text-sm">{l.value}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="absences" className="font-medium">Faltas no Bimestre</Label>
              <Input
                id="absences"
                type="number"
                min="0"
                value={editForm.absences}
                onChange={e => setEditForm((f: any) => ({ ...f, absences: e.target.value }))}
                className="w-32"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="font-medium">Observações</Label>
              <Textarea
                id="notes"
                value={editForm.notes}
                onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                placeholder="Anotações adicionais sobre o aluno..."
                className="h-20"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditingStudent(null)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                className="flex-1 gradient-primary text-primary-foreground gap-2"
                disabled={saving === editingStudent?.id}
              >
                {saving === editingStudent?.id ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : <Save className="w-4 h-4" />}
                Salvar Sondagem
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssessmentsPage;
