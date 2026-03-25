import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Users, ClipboardCheck, Clock, School, BookOpen, TrendingUp, PenLine, LayoutDashboard } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
   SHARED RULE (used across ALL dashboard views):
   A student is ASSESSED only when writing_level OR reading_level is filled.
   Empty / null records (e.g. absences) are treated as PENDING.
───────────────────────────────────────────────────────────────────────── */
const isValidAssessment = (a: { writing_level: string | null; reading_level: string | null }) =>
  !!(a.writing_level || a.reading_level);

/**
 * Fetches ALL assessments for the given student IDs in batches of 250,
 * each batch limited to 1000 rows, to avoid Supabase's default row cap.
 */
async function fetchAllAssessments(studentIds: string[]) {
  if (studentIds.length === 0) return [];
  const BATCH = 250;
  const results: { student_id: string; bimestre: string; writing_level: string | null; reading_level: string | null }[] = [];
  for (let i = 0; i < studentIds.length; i += BATCH) {
    const chunk = studentIds.slice(i, i + BATCH);
    const { data } = await supabase
      .from('assessments')
      .select('student_id, bimestre, writing_level, reading_level')
      .in('student_id', chunk)
      .limit(1000);
    if (data) results.push(...data);
  }
  return results;
}

const WRITING_LEVELS = {
  PS: { label: 'Pré-silábico',    color: '#ef4444', short: 'PS' },
  S:  { label: 'Silábico',        color: '#f59e0b', short: 'S'  },
  SA: { label: 'Sil. Alfabético', color: '#3b82f6', short: 'SA' },
  A:  { label: 'Alfabético',      color: '#22c55e', short: 'A'  },
};

const READING_LEVELS = {
  NL: { label: 'Não Leu',      color: '#ef4444', short: 'NL' },
  LP: { label: 'Leu Palavras', color: '#f59e0b', short: 'LP' },
  LF: { label: 'Leu Frases',   color: '#3b82f6', short: 'LF' },
  LT: { label: 'Leu Texto',    color: '#22c55e', short: 'LT' },
};

const GRADE_YEARS = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'];

const Dashboard: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [allClasses, setAllClasses] = useState<any[]>([]);

  // Admin filters: selectedYear, selectedLetter, isOverallView (Visão Geral da Escola)
  const [selectedYear, setSelectedYear]         = useState<string>('1º Ano');
  const [selectedLetter, setSelectedLetter]     = useState<string>('A');
  const [selectedBimestre, setSelectedBimestre] = useState<string>('1');
  const [isOverallView, setIsOverallView]       = useState<boolean>(false);

  // For teacher: just which of their classes
  const [selectedClass, setSelectedClass] = useState<string>('all');

  const [stats, setStats]             = useState({ totalStudents: 0, assessed: 0, pending: 0, totalClasses: 0 });
  const [writingData, setWritingData] = useState<any[]>([]);
  const [readingData, setReadingData] = useState<any[]>([]);
  const [evolutionData, setEvolutionData] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  // Load classes
  useEffect(() => {
    if (!profile) return;
    const loadClasses = async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from('classes')
          .select('id, grade_year, class_letter, school_year')
          .order('grade_year');
        if (data) setAllClasses(data);
      } else {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', profile.user_id)
          .maybeSingle();
        if (teacherData) {
          const { data } = await supabase
            .from('classes')
            .select('id, grade_year, class_letter, school_year')
            .eq('teacher_id', teacherData.id)
            .order('grade_year');
          if (data) {
            setAllClasses(data);
            if (data.length > 0) setSelectedClass(data[0].id);
          }
        }
      }
    };
    loadClasses();
  }, [profile, isAdmin]);

  // Reset letter when year changes (admin)
  useEffect(() => {
    setSelectedLetter('A');
  }, [selectedYear]);

  // Compute which class IDs to query (admin)
  const adminClassIds = (() => {
    if (isOverallView) return allClasses.map(c => c.id);
    let filtered = allClasses.filter(c => c.grade_year === selectedYear);
    if (selectedLetter !== 'all') filtered = filtered.filter(c => c.class_letter === selectedLetter);
    return filtered.map(c => c.id);
  })();

  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedLetter, selectedBimestre, selectedClass, allClasses, isOverallView]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let classFilter: string[];
      if (isAdmin) {
        classFilter = adminClassIds;
      } else {
        if (selectedClass === 'all') {
          classFilter = allClasses.map(c => c.id);
        } else {
          classFilter = [selectedClass];
        }
      }

      if (classFilter.length === 0 && allClasses.length === 0) {
        setStats({ totalStudents: 0, assessed: 0, pending: 0, totalClasses: 0 });
        setWritingData(Object.entries(WRITING_LEVELS).map(([, v]) => ({ ...v, value: 0, pct: 0 })));
        setReadingData(Object.entries(READING_LEVELS).map(([, v]) => ({ ...v, value: 0, pct: 0 })));
        setEvolutionData(['1','2','3','4'].map(b => ({ name: `${b}º Bim`, Alfabético: 0, 'Leu Texto': 0 })));
        setLoading(false);
        return;
      }

      let studentsQuery = supabase
        .from('students')
        .select('id, class_id')
        .limit(2000); // explicit high limit for large schools
      if (classFilter.length > 0) {
        studentsQuery = studentsQuery.in('class_id', classFilter);
      }
      const { data: students } = await studentsQuery;
      const studentIds    = students?.map(s => s.id) ?? [];
      const totalStudents = studentIds.length;
      const totalClasses  = classFilter.length;

      if (totalStudents === 0) {
        setStats({ totalStudents: 0, assessed: 0, pending: 0, totalClasses });
        setWritingData(Object.entries(WRITING_LEVELS).map(([, v]) => ({ ...v, value: 0, pct: 0 })));
        setReadingData(Object.entries(READING_LEVELS).map(([, v]) => ({ ...v, value: 0, pct: 0 })));
        setEvolutionData(['1','2','3','4'].map(b => ({ name: `${b}º Bim`, Alfabético: 0, 'Leu Texto': 0 })));
        setLoading(false);
        return;
      }

      // ── Fetch ALL assessments (batched to bypass Supabase row caps) ──────────
      // Rule: a student is ASSESSED only if writing_level OR reading_level is set.
      // Records with both null = absent/blank → treated as PENDING.
      const allAssessments = await fetchAllAssessments(studentIds);

      // ── VISÃO GERAL DA ESCOLA: respeita o bimestre selecionado ──────────────
      // Valid assessments filtered to the selected bimestre
      if (isOverallView) {
        const bimValid = allAssessments.filter(
          a => a.bimestre === selectedBimestre && isValidAssessment(a)
        );
        const assessedCount = bimValid.length;

        setStats({ totalStudents, assessed: assessedCount, pending: totalStudents - assessedCount, totalClasses });

        // Writing distribution — selected bimestre only
        const wC: Record<string, number> = { PS: 0, S: 0, SA: 0, A: 0 };
        bimValid.forEach(a => { if (a.writing_level) wC[a.writing_level]++; });
        const writingAssessed = Object.values(wC).reduce((s, v) => s + v, 0);
        setWritingData(
          Object.entries(wC).map(([key, value]) => ({
            name:  WRITING_LEVELS[key as keyof typeof WRITING_LEVELS].label,
            short: WRITING_LEVELS[key as keyof typeof WRITING_LEVELS].short,
            value,
            color: WRITING_LEVELS[key as keyof typeof WRITING_LEVELS].color,
            pct:   writingAssessed > 0 ? Math.round((value / writingAssessed) * 100) : 0,
          }))
        );

        // Reading distribution — selected bimestre only
        const rC: Record<string, number> = { NL: 0, LP: 0, LF: 0, LT: 0 };
        bimValid.forEach(a => { if (a.reading_level) rC[a.reading_level]++; });
        const readingAssessed = Object.values(rC).reduce((s, v) => s + v, 0);
        setReadingData(
          Object.entries(rC).map(([key, value]) => ({
            name:  READING_LEVELS[key as keyof typeof READING_LEVELS].label,
            short: READING_LEVELS[key as keyof typeof READING_LEVELS].short,
            value,
            color: READING_LEVELS[key as keyof typeof READING_LEVELS].color,
            pct:   readingAssessed > 0 ? Math.round((value / readingAssessed) * 100) : 0,
          }))
        );

        // Evolution — all 4 bimestres, all classes
        const evo = (['1','2','3','4'] as const).map(b => {
          const bData = allAssessments.filter(a => a.bimestre === b && isValidAssessment(a));
          const total = bData.length;
          return {
            name: `${b}º Bim`,
            'Alfabético': total > 0 ? Math.round((bData.filter(a => a.writing_level === 'A').length  / total) * 100) : 0,
            'Leu Texto':  total > 0 ? Math.round((bData.filter(a => a.reading_level === 'LT').length / total) * 100) : 0,
          };
        });
        setEvolutionData(evo);
        return;
      }

      // ── VISÃO POR TURMA / ANO: aplica filtro de bimestre ──────────────────────
      // Current bimestre — only valid assessments
      const currentBim = allAssessments.filter(
        a => a.bimestre === selectedBimestre && isValidAssessment(a)
      );
      const assessed = currentBim.length;

      setStats({ totalStudents, assessed, pending: totalStudents - assessed, totalClasses });

      // Writing counts (current bimestre, valid only)
      const wC: Record<string, number> = { PS: 0, S: 0, SA: 0, A: 0 };
      currentBim.forEach(a => { if (a.writing_level) wC[a.writing_level]++; });
      setWritingData(
        Object.entries(wC).map(([key, value]) => ({
          name:  WRITING_LEVELS[key as keyof typeof WRITING_LEVELS].label,
          short: WRITING_LEVELS[key as keyof typeof WRITING_LEVELS].short,
          value,
          color: WRITING_LEVELS[key as keyof typeof WRITING_LEVELS].color,
          pct:   assessed > 0 ? Math.round((value / assessed) * 100) : 0,
        }))
      );

      // Reading counts (current bimestre, valid only)
      const rC: Record<string, number> = { NL: 0, LP: 0, LF: 0, LT: 0 };
      currentBim.forEach(a => { if (a.reading_level) rC[a.reading_level]++; });
      setReadingData(
        Object.entries(rC).map(([key, value]) => ({
          name:  READING_LEVELS[key as keyof typeof READING_LEVELS].label,
          short: READING_LEVELS[key as keyof typeof READING_LEVELS].short,
          value,
          color: READING_LEVELS[key as keyof typeof READING_LEVELS].color,
          pct:   assessed > 0 ? Math.round((value / assessed) * 100) : 0,
        }))
      );

      // Evolution chart — each bimestre uses only valid assessments
      const evo = (['1','2','3','4'] as const).map(b => {
        const bData = allAssessments.filter(a => a.bimestre === b && isValidAssessment(a));
        const total = bData.length;
        return {
          name: `${b}º Bim`,
          'Alfabético': total > 0 ? Math.round((bData.filter(a => a.writing_level === 'A').length  / total) * 100) : 0,
          'Leu Texto':  total > 0 ? Math.round((bData.filter(a => a.reading_level === 'LT').length / total) * 100) : 0,
        };
      });
      setEvolutionData(evo);
    } finally {
      setLoading(false);
    }
  };

  // ── Donut Card ─────────────────────────────────────────────────────────────
  const DonutCard = ({
    title, icon: Icon, data, assessed,
  }: {
    title: string; icon: React.ElementType; data: any[]; assessed: number;
  }) => {
    const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
      if (percent < 0.05) return null;
      const RADIAN = Math.PI / 180;
      const r = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + r * Math.cos(-midAngle * RADIAN);
      const y = cy + r * Math.sin(-midAngle * RADIAN);
      return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="bold">
          {`${Math.round(percent * 100)}%`}
        </text>
      );
    };

    return (
      <Card className="p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-foreground">{title}</h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {selectedBimestre}º Bimestre
          </span>
        </div>
        <div className="flex gap-4 items-center">
          {/* Left: stat cards */}
          <div className="flex flex-col gap-2 w-36 shrink-0">
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-center">
              <p className="text-xl font-display font-bold text-foreground">{loading ? '…' : assessed}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Avaliados</p>
            </div>
            {data.map(item => (
              <div key={item.short} className="rounded-lg px-3 py-1.5 flex items-center justify-between"
                style={{ backgroundColor: item.color + '18', border: `1px solid ${item.color}40` }}>
                <span className="text-xs font-bold" style={{ color: item.color }}>{item.short}</span>
                <span className="text-sm font-display font-bold text-foreground">{loading ? '…' : item.value}</span>
              </div>
            ))}
          </div>
          {/* Right: fat donut */}
          <div className="flex-1 flex flex-col items-center">
            {assessed > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.filter(d => d.value > 0)}
                      cx="50%" cy="50%"
                      innerRadius={50}
                      outerRadius={98}
                      dataKey="value"
                      paddingAngle={2}
                      labelLine={false}
                      label={renderLabel}
                    >
                      {data.filter(d => d.value > 0).map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, _n: any, p: any) => [`${v} alunos (${p.payload.pct}%)`, p.payload.name]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 -mt-2">
                  {data.map(item => (
                    <div key={item.short} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-muted-foreground">{item.short} – {item.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                <div className="w-16 h-16 rounded-full border-4 border-dashed border-border flex items-center justify-center">
                  <span className="text-2xl font-display font-bold text-muted-foreground/40">0</span>
                </div>
                <p>Sem dados</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // Context label
  const contextLabel = (() => {
    if (isAdmin) {
      if (isOverallView) return 'Escola Toda';
      return `${selectedYear} · Turma ${selectedLetter}`;
    }
    if (selectedClass === 'all') return 'Todas as Turmas';
    const c = allClasses.find(x => x.id === selectedClass);
    return c ? `${c.grade_year} ${c.class_letter}` : '';
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Pedagógico</h1>
            <p className="text-muted-foreground mt-0.5">
              Bem-vindo(a), {profile?.name?.split(' ')[0]}! Aqui está o panorama atual.
            </p>
          </div>
        </div>

        {/* ─── Filter Bar ─── */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            {/* LEFT: Série + Turma + Bimestre */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* 1º Filtro: Série/Ano */}
              <Select
                value={selectedYear}
                onValueChange={v => { setSelectedYear(v); setIsOverallView(false); }}
                disabled={isOverallView}
              >
                <SelectTrigger className="w-40 bg-background border border-input rounded-lg shadow-sm disabled:opacity-40">
                  <SelectValue placeholder="Série/Ano" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_YEARS.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 2º Filtro: Turma */}
              <Select
                value={selectedLetter}
                onValueChange={v => { setSelectedLetter(v); setIsOverallView(false); }}
                disabled={isOverallView}
              >
                <SelectTrigger className="w-32 bg-background border border-input rounded-lg shadow-sm disabled:opacity-40">
                  <SelectValue placeholder="Turma" />
                </SelectTrigger>
                <SelectContent>
                  {['A','B','C','D','E','F','G','H','I'].map(l => (
                    <SelectItem key={l} value={l}>Turma {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 3º Filtro: Bimestre — global */}
              <Select value={selectedBimestre} onValueChange={setSelectedBimestre}>
                <SelectTrigger className="w-40 bg-background border border-input rounded-lg shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['1','2','3','4'].map(b => (
                    <SelectItem key={b} value={b}>{b}º Bimestre</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* RIGHT: Visão Geral */}
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <Button
                variant={isOverallView ? 'default' : 'outline'}
                size="sm"
                className="gap-2 rounded-lg"
                onClick={() => setIsOverallView(prev => !prev)}
              >
                <LayoutDashboard className="w-4 h-4" />
                Visão Geral da Escola
              </Button>
            </div>
          </div>
        )}

        {/* ─── TEACHER filter bar ─── */}
        {!isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            {allClasses.length > 0 && (
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-48 bg-background border border-input rounded-lg shadow-sm">
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {allClasses.length > 1 && (
                    <SelectItem value="all">Todas as minhas turmas</SelectItem>
                  )}
                  {allClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.grade_year} {c.class_letter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedBimestre} onValueChange={setSelectedBimestre}>
              <SelectTrigger className="w-40 bg-background border border-input rounded-lg shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['1','2','3','4'].map(b => (
                  <SelectItem key={b} value={b}>{b}º Bimestre</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Context badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border">
          Exibindo: <strong className="text-foreground">{contextLabel}</strong>
          {!isOverallView && <> · {selectedBimestre}º Bimestre</>}
          {isOverallView && <span className="text-primary font-medium"> · Todos os Bimestres</span>}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users,          label: 'Total de Alunos', value: stats.totalStudents, color: 'text-primary',   bg: 'bg-primary/10'   },
          { icon: ClipboardCheck, label: 'Avaliados',        value: stats.assessed,      color: 'text-success',   bg: 'bg-success/10'   },
          { icon: Clock,          label: 'Pendentes',        value: stats.pending,        color: 'text-warning',   bg: 'bg-warning/10'   },
          { icon: School,         label: 'Turmas',           value: stats.totalClasses,   color: 'text-accent',    bg: 'bg-accent/10'    },
        ].map((stat) => (
          <Card key={stat.label} className="p-5 shadow-card hover:shadow-hover transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{stat.label}</p>
                <p className={`text-3xl font-display font-bold mt-1 ${stat.color}`}>
                  {loading ? '…' : stat.value}
                </p>
              </div>
              <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            {stat.label === 'Avaliados' && stats.totalStudents > 0 && (
              <div className="mt-3">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${Math.round((stats.assessed / stats.totalStudents) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((stats.assessed / stats.totalStudents) * 100)}% avaliados
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Donut Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <DonutCard title="Níveis de Escrita" icon={PenLine}  data={writingData} assessed={stats.assessed} />
        <DonutCard title="Níveis de Leitura" icon={BookOpen} data={readingData} assessed={stats.assessed} />
      </div>

      {/* Evolution Line Chart */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-foreground">Evolução da Alfabetização por Bimestre</h3>
          <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded-full">% do total avaliado</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={evolutionData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} unit="%" domain={[0, 100]} />
            <Tooltip
              formatter={(v: any, n: any) => [`${v}%`, n]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.75rem',
                fontSize: '12px',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="Alfabético" stroke="#22c55e" strokeWidth={3}
              dot={{ r: 5, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
            <Line type="monotone" dataKey="Leu Texto"  stroke="#3b82f6" strokeWidth={3}
              dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Dashboard;
