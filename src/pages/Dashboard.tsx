import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Users, ClipboardCheck, Clock, School, BookOpen, TrendingUp } from 'lucide-react';

const WRITING_LEVELS = {
  PS: { label: 'Pré-silábico', color: '#ef4444' },
  S: { label: 'Silábico', color: '#f59e0b' },
  SA: { label: 'Silábico-Alfabético', color: '#3b82f6' },
  A: { label: 'Alfabético', color: '#22c55e' },
};

const READING_LEVELS = {
  NL: { label: 'Não leu', color: '#ef4444' },
  LP: { label: 'Leu palavras', color: '#f59e0b' },
  LF: { label: 'Leu frase', color: '#3b82f6' },
  LT: { label: 'Leu texto', color: '#22c55e' },
};

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedBimestre, setSelectedBimestre] = useState<string>('1');
  const [stats, setStats] = useState({ totalStudents: 0, assessed: 0, pending: 0, totalClasses: 0 });
  const [writingData, setWritingData] = useState<any[]>([]);
  const [readingData, setReadingData] = useState<any[]>([]);
  const [evolutionData, setEvolutionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('classes')
      .select('id, grade_year, class_letter')
      .order('grade_year')
      .then(({ data }) => { if (data) setClasses(data); });
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedClass, selectedBimestre]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Single query for students filtered by class
      let studentsQuery = supabase.from('students').select('id, class_id');
      if (selectedClass !== 'all') {
        studentsQuery = studentsQuery.eq('class_id', selectedClass);
      }
      const { data: students } = await studentsQuery;
      const studentIds = students?.map(s => s.id) ?? [];
      const totalStudents = studentIds.length;

      if (totalStudents === 0) {
        setStats({ totalStudents: 0, assessed: 0, pending: 0, totalClasses: classes.length });
        setWritingData([]);
        setReadingData([]);
        setEvolutionData([{ name: '1º Bim', Alfabéticos: 0, Total: 0, Porcentagem: 0 },
          { name: '2º Bim', Alfabéticos: 0, Total: 0, Porcentagem: 0 },
          { name: '3º Bim', Alfabéticos: 0, Total: 0, Porcentagem: 0 },
          { name: '4º Bim', Alfabéticos: 0, Total: 0, Porcentagem: 0 }]);
        setLoading(false);
        return;
      }

      // All assessments in one query (all bimestres at once)
      const { data: allAssessments } = await supabase
        .from('assessments')
        .select('student_id, bimestre, writing_level, reading_level')
        .in('student_id', studentIds.slice(0, 500)); // safety limit

      // Filter for selected bimestre
      const currentBimAssessments = allAssessments?.filter(a => a.bimestre === selectedBimestre) ?? [];
      const assessed = currentBimAssessments.length;

      setStats({
        totalStudents,
        assessed,
        pending: totalStudents - assessed,
        totalClasses: classes.length,
      });

      // Writing distribution
      const wCounts: Record<string, number> = { PS: 0, S: 0, SA: 0, A: 0 };
      currentBimAssessments.forEach(a => { if (a.writing_level) wCounts[a.writing_level]++; });
      setWritingData(
        Object.entries(wCounts)
          .filter(([, v]) => v > 0)
          .map(([key, value]) => ({
            name: WRITING_LEVELS[key as keyof typeof WRITING_LEVELS].label,
            value,
            color: WRITING_LEVELS[key as keyof typeof WRITING_LEVELS].color,
            pct: assessed > 0 ? Math.round((value / assessed) * 100) : 0,
          }))
      );

      // Reading distribution
      const rCounts: Record<string, number> = { NL: 0, LP: 0, LF: 0, LT: 0 };
      currentBimAssessments.forEach(a => { if (a.reading_level) rCounts[a.reading_level]++; });
      setReadingData(
        Object.entries(rCounts)
          .filter(([, v]) => v > 0)
          .map(([key, value]) => ({
            name: READING_LEVELS[key as keyof typeof READING_LEVELS].label,
            value,
            color: READING_LEVELS[key as keyof typeof READING_LEVELS].color,
            pct: assessed > 0 ? Math.round((value / assessed) * 100) : 0,
          }))
      );

      // Evolution — computed from already-loaded allAssessments (no extra queries!)
      const evo = (['1', '2', '3', '4'] as const).map(b => {
        const bData = allAssessments?.filter(a => a.bimestre === b) ?? [];
        const alfa = bData.filter(a => a.writing_level === 'A').length;
        const total = bData.length;
        return {
          name: `${b}º Bim`,
          Alfabéticos: alfa,
          Total: total,
          Porcentagem: total > 0 ? Math.round((alfa / total) * 100) : 0,
        };
      });
      setEvolutionData(evo);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-card">
          <p className="font-display font-bold text-foreground">{payload[0].name}</p>
          <p className="text-muted-foreground text-sm">
            {payload[0].value} alunos ({payload[0].payload?.pct ?? 0}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Pedagógico</h1>
          <p className="text-muted-foreground mt-0.5">
            Bem-vindo(a), {profile?.name?.split(' ')[0]}! Aqui está o panorama atual.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-48 bg-card">
              <SelectValue placeholder="Todas as turmas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Escola toda</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.grade_year} {c.class_letter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedBimestre} onValueChange={setSelectedBimestre}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['1', '2', '3', '4'].map(b => (
                <SelectItem key={b} value={b}>{b}º Bimestre</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total de Alunos', value: stats.totalStudents, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: ClipboardCheck, label: 'Avaliados', value: stats.assessed, color: 'text-success', bg: 'bg-success/10' },
          { icon: Clock, label: 'Pendentes', value: stats.pending, color: 'text-warning', bg: 'bg-warning/10' },
          { icon: School, label: 'Turmas', value: stats.totalClasses, color: 'text-accent', bg: 'bg-accent/10' },
        ].map((stat) => (
          <Card key={stat.label} className="p-5 shadow-card hover:shadow-hover transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{stat.label}</p>
                <p className={`text-3xl font-display font-bold mt-1 ${stat.color}`}>
                  {loading ? '...' : stat.value}
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

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold text-foreground">Níveis de Escrita</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {selectedBimestre}º Bimestre
            </span>
          </div>
          {writingData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={writingData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {writingData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {writingData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-foreground truncate">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground ml-2">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma sondagem registrada
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold text-foreground">Níveis de Leitura</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {selectedBimestre}º Bimestre
            </span>
          </div>
          {readingData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={readingData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {readingData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {readingData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-foreground truncate">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground ml-2">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma sondagem registrada
            </div>
          )}
        </Card>
      </div>

      {/* Evolution chart */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-foreground">Evolução da Alfabetização</h3>
          <span className="text-xs text-muted-foreground ml-auto">Alunos no nível Alfabético por bimestre</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={evolutionData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.75rem',
              }}
            />
            <Bar dataKey="Alfabéticos" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} opacity={0.4} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Dashboard;
