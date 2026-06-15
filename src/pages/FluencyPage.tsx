import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateFluency, FluencyCounts, FluencyResult, PROFILE_LABELS } from '@/lib/fluency';
import { exportFluencyExcel, exportFluencyPDF } from '@/lib/fluencyExport';
import FluencyDashboard from '@/components/fluency/FluencyDashboard';
import { Calculator, Save, FileSpreadsheet, FileText, BarChart3, BookOpenCheck, Users2, School as SchoolIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface ClassRow {
  id: string;
  grade_year: string;
  class_letter: string;
  school_year: number;
  teacher_id: string | null;
  teachers?: { id: string; name: string } | null;
}

const empty: FluencyCounts = { pl1: 0, pl2: 0, pl3: 0, pl4: 0, li: 0, lf: 0 };

const FluencyPage: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [counts, setCounts] = useState<FluencyCounts>(empty);
  const [result, setResult] = useState<FluencyResult | null>(null);
  const [school, setSchool] = useState<{ name: string; year: number }>({ name: 'Escola', year: new Date().getFullYear() });
  const [teacherName, setTeacherName] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('school_info').select('name, active_school_year').limit(1).maybeSingle();
      if (s) setSchool({ name: s.name, year: s.active_school_year || new Date().getFullYear() });

      let q = supabase.from('classes').select('id, grade_year, class_letter, school_year, teacher_id, teachers(id, name)').order('grade_year');
      if (!isAdmin && user) {
        const { data: t } = await supabase.from('teachers').select('id, name').eq('user_id', user.id).maybeSingle();
        if (t) {
          setTeacherName(t.name);
          q = q.eq('teacher_id', t.id);
        }
      } else {
        setTeacherName(profile?.name || 'Administrador');
      }
      const { data: c } = await q;
      if (c) setClasses(c as any);
    })();
  }, [user, isAdmin, profile]);

  const currentClass = useMemo(() => classes.find(c => c.id === selectedClass), [classes, selectedClass]);
  const classLabel = currentClass ? `${currentClass.grade_year} ${currentClass.class_letter}` : '';
  const displayedTeacher = currentClass?.teachers?.name || teacherName;

  const handleCalc = () => {
    const r = calculateFluency(counts);
    if (r.total === 0) { toast.error('Informe a quantidade de estudantes em pelo menos um perfil'); return; }
    setResult(r);
  };

  const handleSave = async () => {
    if (!result) { toast.error('Calcule os indicadores primeiro'); return; }
    if (!currentClass) { toast.error('Selecione uma turma'); return; }
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('fluency_simulations').insert({
      created_by: user.id,
      teacher_id: currentClass.teacher_id,
      class_id: currentClass.id,
      teacher_name: displayedTeacher,
      class_label: classLabel,
      school_name: school.name,
      school_year: currentClass.school_year || school.year,
      pl1: result.pl1, pl2: result.pl2, pl3: result.pl3, pl4: result.pl4, li: result.li, lf: result.lf,
      total: result.total,
      ifl: result.ifl,
      taxa_leitores: result.taxaLeitores,
      classification: result.classification,
      diagnostico: result.diagnostico,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Simulação salva com sucesso');
  };

  const exportCtx = {
    teacher: displayedTeacher || 'Professor',
    className: classLabel || 'Turma',
    school: school.name,
    schoolYear: currentClass?.school_year || school.year,
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <BookOpenCheck className="w-7 h-7 text-primary" /> Simulador de Fluência Leitora
          </h1>
          <p className="text-sm text-muted-foreground">Calcule o IFL e a Taxa de Leitores da sua turma</p>
        </div>
        {isAdmin && (
          <Button asChild variant="outline">
            <Link to="/fluencia/painel"><BarChart3 className="w-4 h-4 mr-2" /> Painel Geral</Link>
          </Button>
        )}
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <InfoTile icon={<Users2 className="w-4 h-4" />} label="Professor" value={displayedTeacher || '—'} />
          <InfoTile icon={<SchoolIcon className="w-4 h-4" />} label="Escola" value={school.name} />
          <InfoTile icon={<BookOpenCheck className="w-4 h-4" />} label="Turma" value={classLabel || 'Selecione'} />
          <InfoTile icon={<BarChart3 className="w-4 h-4" />} label="Ano Letivo" value={String(currentClass?.school_year || school.year)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quantidade de Estudantes por Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Turma</Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.grade_year} {c.class_letter}{c.teachers?.name ? ` — ${c.teachers.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(Object.keys(PROFILE_LABELS) as Array<keyof FluencyCounts>).map(k => (
              <div key={k}>
                <Label className="text-xs">{PROFILE_LABELS[k]}</Label>
                <Input
                  type="number" min={0} step={1} inputMode="numeric"
                  value={counts[k] || ''}
                  onChange={(e) => setCounts({ ...counts, [k]: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCalc} className="bg-primary"><Calculator className="w-4 h-4 mr-2" /> Calcular Indicadores</Button>
            <Button onClick={handleSave} disabled={!result || saving || !selectedClass} variant="secondary">
              <Save className="w-4 h-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button onClick={() => exportFluencyPDF('fluency-report', exportCtx)} disabled={!result} variant="outline">
              <FileText className="w-4 h-4 mr-2" /> Exportar PDF
            </Button>
            <Button onClick={() => result && exportFluencyExcel(exportCtx, result)} disabled={!result} variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div id="fluency-report" className="bg-background p-2 space-y-4">
          <Card className="bg-gradient-to-r from-[#0f2d55] to-[#1e4a8c] text-white">
            <CardContent className="p-4">
              <h2 className="font-bold text-lg">Relatório de Fluência Leitora</h2>
              <p className="text-xs opacity-90">{school.name} • {classLabel} • Prof. {displayedTeacher} • {currentClass?.school_year || school.year}</p>
            </CardContent>
          </Card>
          <FluencyDashboard result={result} />
        </div>
      )}
    </div>
  );
};

const InfoTile: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2">
    <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground truncate">{value}</p>
    </div>
  </div>
);

export default FluencyPage;
