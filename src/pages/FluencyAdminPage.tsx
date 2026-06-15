import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, FileSpreadsheet, FileText, Trophy, School as SchoolIcon, Users2, BookOpen, Sparkles } from 'lucide-react';
import { PROFILE_LABELS, PROFILE_COLORS, classifyIFL, calculateFluency } from '@/lib/fluency';
import { exportFluencyPDF, exportGeneralExcel } from '@/lib/fluencyExport';
import Gauge from '@/components/fluency/Gauge';

interface Sim {
  id: string; teacher_name: string; class_label: string; school_name: string;
  school_year: number; pl1: number; pl2: number; pl3: number; pl4: number; li: number; lf: number;
  total: number; matriculados?: number; participacao?: number;
  ifl: number; taxa_leitores: number; classification: string; diagnostico?: string; created_at: string;
}

const FluencyAdminPage: React.FC = () => {
  const [sims, setSims] = useState<Sim[]>([]);
  const [loading, setLoading] = useState(true);
  const [fSchool, setFSchool] = useState('all');
  const [fTeacher, setFTeacher] = useState('all');
  const [fClass, setFClass] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [schoolName, setSchoolName] = useState('Escola');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('fluency_simulations').select('*').order('created_at', { ascending: false });
      if (data) setSims(data as any);
      const { data: s } = await supabase.from('school_info').select('name').limit(1).maybeSingle();
      if (s?.name) setSchoolName(s.name);
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

  // Aggregate counts -> recompute via shared formula to get unified IFL / Participação / Taxa
  const aggregate = (rows: Sim[]) => {
    const sum = rows.reduce((a, s) => ({
      pl1: a.pl1 + s.pl1, pl2: a.pl2 + s.pl2, pl3: a.pl3 + s.pl3, pl4: a.pl4 + s.pl4,
      li: a.li + s.li, lf: a.lf + s.lf,
      matriculados: a.matriculados + (s.matriculados || 0),
    }), { pl1: 0, pl2: 0, pl3: 0, pl4: 0, li: 0, lf: 0, matriculados: 0 });
    return calculateFluency(
      { pl1: sum.pl1, pl2: sum.pl2, pl3: sum.pl3, pl4: sum.pl4, li: sum.li, lf: sum.lf },
      sum.matriculados,
    );
  };

  const totals = useMemo(() => aggregate(filtered), [filtered]);

  // Class-specific view
  const classSims = useMemo(() => fClass === 'all' ? [] : filtered, [filtered, fClass]);
  const classView = useMemo(() => fClass === 'all' ? null : aggregate(classSims), [classSims, fClass]);

  const profilesPie = useMemo(() => (['pl1','pl2','pl3','pl4','li','lf'] as const)
    .map(k => ({ name: PROFILE_LABELS[k], value: totals[k], color: PROFILE_COLORS[k] }))
    .filter(p => p.value > 0), [totals]);

  const classRows = useMemo(() => {
    const grp: Record<string, Sim[]> = {};
    filtered.forEach(s => { (grp[s.class_label] = grp[s.class_label] || []).push(s); });
    return Object.entries(grp).map(([name, rows]) => {
      const r = aggregate(rows);
      return { name, ifl: r.ifl, participacao: r.participacao, taxa: r.taxaLeitores, total: r.total };
    });
  }, [filtered]);

  const rankClasses = useMemo(() => [...classRows].sort((a, b) => b.ifl - a.ifl).slice(0, 10), [classRows]);

  const uniq = (k: keyof Sim) => Array.from(new Set(sims.map(s => s[k] as string))).filter(Boolean);

  const handleExportExcel = () => {
    exportGeneralExcel(filtered.map(s => ({
      Data: new Date(s.created_at).toLocaleString('pt-BR'),
      Escola: s.school_name, Professor: s.teacher_name, Turma: s.class_label, Ano: s.school_year,
      Matriculados: s.matriculados || 0, Avaliados: s.total,
      PL1: s.pl1, PL2: s.pl2, PL3: s.pl3, PL4: s.pl4, LI: s.li, LF: s.lf,
      IFL: s.ifl, 'Participação (%)': s.participacao || 0, 'Taxa Leitores (%)': s.taxa_leitores, Classificação: s.classification,
    })));
  };

  const handleExportPDF = () => {
    exportFluencyPDF('admin-fluency-report', {
      teacher: 'Painel Administrativo', className: fClass === 'all' ? 'Todas as turmas' : fClass,
      school: fSchool === 'all' ? schoolName : fSchool, schoolYear: new Date().getFullYear(),
    });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Carregando painel...</div>;

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" /> Painel de Fluência Leitora — 2º Ano
          </h1>
          <p className="text-sm text-muted-foreground">Visão consolidada das simulações lançadas pelos professores</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportPDF} variant="outline"><FileText className="w-4 h-4 mr-2" /> Exportar PDF</Button>
          <Button onClick={handleExportExcel}><FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel</Button>
        </div>
      </div>

      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <Filter label="Escola" value={fSchool} onChange={setFSchool} options={uniq('school_name')} />
        <Filter label="Professor" value={fTeacher} onChange={setFTeacher} options={uniq('teacher_name')} />
        <Filter label="Turma" value={fClass} onChange={setFClass} options={uniq('class_label')} />
        <div><Label className="text-xs">De</Label><Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} /></div>
      </CardContent></Card>

      <div id="admin-fluency-report" className="space-y-4 bg-background p-2">
        {/* CONSOLIDATED PANEL */}
        <Card className="bg-gradient-to-r from-[#0f2d55] to-[#1e4a8c] text-white">
          <CardContent className="p-4">
            <h2 className="font-bold text-lg">{fClass === 'all' ? 'Painel Geral Consolidado' : `Painel da Turma — ${fClass}`}</h2>
            <p className="text-xs opacity-90">{fSchool === 'all' ? schoolName : fSchool} • {filtered.length} simulação(ões)</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={<SchoolIcon />} label="Turmas Avaliadas" value={String(classRows.length)} color="bg-blue-600" />
          <Stat icon={<Users2 />} label="Estudantes Avaliados" value={String(totals.total)} color="bg-emerald-600" />
          <Stat icon={<Users2 />} label="Participação Geral" value={`${totals.participacao.toFixed(1)}%`} color="bg-indigo-600" />
          <Stat icon={<BookOpen />} label="Taxa Geral Leitores" value={`${totals.taxaLeitores.toFixed(1)}%`} color="bg-violet-600" />
          <Stat icon={<BarChart3 />} label="IFL Geral" value={totals.ifl.toFixed(2)} color="bg-amber-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-center">Velocímetro de Participação</CardTitle></CardHeader>
            <CardContent><Gauge value={totals.participacao} max={100} label="% participação" suffix="%" color="#6366f1" /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-center">Velocímetro Taxa de Leitores</CardTitle></CardHeader>
            <CardContent><Gauge value={totals.taxaLeitores} max={100} label="% de leitores" suffix="%" color="#16a34a" /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-center">Velocímetro IFL (0 a 10)</CardTitle></CardHeader>
            <CardContent><Gauge value={totals.ifl} max={10} label={totals.classification} color={totals.classificationColor} /></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição Geral dos Perfis</CardTitle></CardHeader>
            <CardContent>
              {profilesPie.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={profilesPie} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${((e.percent || 0) * 100).toFixed(0)}%`}>
                      {profilesPie.map((p, i) => <Cell key={i} fill={p.color} />)}
                    </Pie>
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Ranking de Turmas por IFL</CardTitle></CardHeader>
            <CardContent>
              {rankClasses.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
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
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-l-4" style={{ borderLeftColor: totals.classificationColor }}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> Diagnóstico {fClass === 'all' ? 'Geral' : 'da Turma'}</CardTitle></CardHeader>
          <CardContent><p className="text-sm leading-relaxed">{totals.diagnostico}</p></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de Simulações</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {['Data', 'Escola', 'Turma', 'Professor', 'Matric.', 'Avaliados', 'Particip.', 'Taxa', 'IFL', 'Classificação'].map(h =>
                    <th key={h} className="text-left p-2 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Nenhuma simulação encontrada</td></tr>}
                {filtered.map(s => (
                  <tr key={s.id} className="border-t hover:bg-muted/40">
                    <td className="p-2 whitespace-nowrap">{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-2">{s.school_name}</td>
                    <td className="p-2 font-medium">{s.class_label}</td>
                    <td className="p-2">{s.teacher_name}</td>
                    <td className="p-2">{s.matriculados || 0}</td>
                    <td className="p-2">{s.total}</td>
                    <td className="p-2">{Number(s.participacao || 0).toFixed(1)}%</td>
                    <td className="p-2">{Number(s.taxa_leitores).toFixed(1)}%</td>
                    <td className="p-2 font-bold" style={{ color: classifyIFL(Number(s.ifl)).color }}>{Number(s.ifl).toFixed(2)}</td>
                    <td className="p-2"><span className="px-2 py-0.5 rounded-full text-xs text-white whitespace-nowrap" style={{ background: classifyIFL(Number(s.ifl)).color }}>{s.classification}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <Card><CardContent className="p-3 flex items-center gap-3">
    <div className={`${color} text-white p-2.5 rounded-xl`}>{icon}</div>
    <div className="min-w-0"><p className="text-[11px] text-muted-foreground truncate">{label}</p><p className="text-lg font-bold">{value}</p></div>
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
