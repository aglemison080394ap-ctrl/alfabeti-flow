import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, FileSpreadsheet, Trophy, School as SchoolIcon, Users2, BookOpen } from 'lucide-react';
import { PROFILE_LABELS, PROFILE_COLORS, classifyIFL } from '@/lib/fluency';
import { exportGeneralExcel } from '@/lib/fluencyExport';
import { Link } from 'react-router-dom';

interface Sim {
  id: string; teacher_name: string; class_label: string; school_name: string;
  school_year: number; pl1: number; pl2: number; pl3: number; pl4: number; li: number; lf: number;
  total: number; ifl: number; taxa_leitores: number; classification: string; created_at: string;
}

const FluencyAdminPage: React.FC = () => {
  const [sims, setSims] = useState<Sim[]>([]);
  const [loading, setLoading] = useState(true);
  const [fSchool, setFSchool] = useState('all');
  const [fTeacher, setFTeacher] = useState('all');
  const [fClass, setFClass] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('fluency_simulations').select('*').order('created_at', { ascending: false });
      if (data) setSims(data as any);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => sims.filter(s =>
    (fSchool === 'all' || s.school_name === fSchool) &&
    (fTeacher === 'all' || s.teacher_name === fTeacher) &&
    (fClass === 'all' || s.class_label === fClass) &&
    (!fFrom || s.created_at >= fFrom) &&
    (!fTo || s.created_at <= fTo + 'T23:59:59')
  ), [sims, fSchool, fTeacher, fClass, fFrom, fTo]);

  const totals = useMemo(() => {
    const totalStudents = filtered.reduce((a, s) => a + s.total, 0);
    const avgIFL = filtered.length ? filtered.reduce((a, s) => a + Number(s.ifl), 0) / filtered.length : 0;
    const avgTL = filtered.length ? filtered.reduce((a, s) => a + Number(s.taxa_leitores), 0) / filtered.length : 0;
    const profiles = (['pl1','pl2','pl3','pl4','li','lf'] as const).map(k => ({
      name: PROFILE_LABELS[k], value: filtered.reduce((a, s) => a + s[k], 0), color: PROFILE_COLORS[k],
    }));
    return { totalStudents, avgIFL, avgTL, profiles };
  }, [filtered]);

  const rankClasses = useMemo(() => [...filtered].sort((a, b) => Number(b.ifl) - Number(a.ifl)).slice(0, 10)
    .map(s => ({ name: s.class_label, ifl: Number(s.ifl), school: s.school_name })), [filtered]);

  const rankSchools = useMemo(() => {
    const grp: Record<string, { sum: number; n: number; students: number }> = {};
    filtered.forEach(s => {
      if (!grp[s.school_name]) grp[s.school_name] = { sum: 0, n: 0, students: 0 };
      grp[s.school_name].sum += Number(s.ifl);
      grp[s.school_name].n += 1;
      grp[s.school_name].students += s.total;
    });
    return Object.entries(grp).map(([name, v]) => ({ name, ifl: v.sum / v.n, turmas: v.n, students: v.students }))
      .sort((a, b) => b.ifl - a.ifl);
  }, [filtered]);

  const uniq = (k: keyof Sim) => Array.from(new Set(sims.map(s => s[k] as string))).filter(Boolean);

  const handleExport = () => {
    exportGeneralExcel(filtered.map(s => ({
      Data: new Date(s.created_at).toLocaleString('pt-BR'),
      Escola: s.school_name, Professor: s.teacher_name, Turma: s.class_label, Ano: s.school_year,
      Total: s.total, PL1: s.pl1, PL2: s.pl2, PL3: s.pl3, PL4: s.pl4, LI: s.li, LF: s.lf,
      IFL: s.ifl, 'Taxa Leitores (%)': s.taxa_leitores, Classificação: s.classification,
    })));
  };

  if (loading) return <div className="p-6 text-muted-foreground">Carregando painel...</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" /> Painel Geral de Fluência Leitora
          </h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de todas as turmas e escolas</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/fluencia">Simulador</Link></Button>
          <Button onClick={handleExport}><FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Geral</Button>
        </div>
      </div>

      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <Filter label="Escola" value={fSchool} onChange={setFSchool} options={uniq('school_name')} />
        <Filter label="Professor" value={fTeacher} onChange={setFTeacher} options={uniq('teacher_name')} />
        <Filter label="Turma" value={fClass} onChange={setFClass} options={uniq('class_label')} />
        <div><Label className="text-xs">De</Label><Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} /></div>
      </CardContent></Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<SchoolIcon />} label="Turmas Avaliadas" value={String(filtered.length)} color="bg-blue-600" />
        <Stat icon={<Users2 />} label="Estudantes Avaliados" value={String(totals.totalStudents)} color="bg-emerald-600" />
        <Stat icon={<BarChart3 />} label="IFL Médio" value={totals.avgIFL.toFixed(2)} color="bg-amber-500" />
        <Stat icon={<BookOpen />} label="Taxa Média Leitores" value={`${totals.avgTL.toFixed(1)}%`} color="bg-violet-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Ranking de Turmas por IFL</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rankClasses} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 10]} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                <Tooltip />
                <Bar dataKey="ifl" radius={[0, 6, 6, 0]}>
                  {rankClasses.map((c, i) => <Cell key={i} fill={classifyIFL(c.ifl).color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><SchoolIcon className="w-4 h-4 text-primary" /> Ranking de Escolas por IFL</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rankSchools} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 10]} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                <Tooltip />
                <Bar dataKey="ifl" radius={[0, 6, 6, 0]}>
                  {rankSchools.map((c, i) => <Cell key={i} fill={classifyIFL(c.ifl).color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição Geral dos Perfis</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={totals.profiles.filter(p => p.value > 0)} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${((e.percent || 0) * 100).toFixed(0)}%`}>
                  {totals.profiles.map((p, i) => <Cell key={i} fill={p.color} />)}
                </Pie>
                <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Comparativo IFL × Taxa de Leitores por Turma</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={filtered.slice(0, 12).map(s => ({ name: s.class_label, IFL: Number(s.ifl), 'Taxa %': Number(s.taxa_leitores) / 10 }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} angle={-25} textAnchor="end" height={60} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="IFL" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Taxa %" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de Simulações</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {['Data', 'Escola', 'Turma', 'Professor', 'Total', 'IFL', 'Taxa', 'Classificação'].map(h =>
                  <th key={h} className="text-left p-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhuma simulação encontrada</td></tr>}
              {filtered.map(s => (
                <tr key={s.id} className="border-t hover:bg-muted/40">
                  <td className="p-2">{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="p-2">{s.school_name}</td>
                  <td className="p-2 font-medium">{s.class_label}</td>
                  <td className="p-2">{s.teacher_name}</td>
                  <td className="p-2">{s.total}</td>
                  <td className="p-2 font-bold" style={{ color: classifyIFL(Number(s.ifl)).color }}>{Number(s.ifl).toFixed(2)}</td>
                  <td className="p-2">{Number(s.taxa_leitores).toFixed(1)}%</td>
                  <td className="p-2"><span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ background: classifyIFL(Number(s.ifl)).color }}>{s.classification}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <Card><CardContent className="p-4 flex items-center gap-3">
    <div className={`${color} text-white p-3 rounded-xl`}>{icon}</div>
    <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
  </CardContent></Card>
);

const Filter: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[] }> = ({ label, value, onChange, options }) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

export default FluencyAdminPage;
