import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Download, FileText, BarChart3, Printer, PenLine, BookOpen, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const WRITING_LEVELS: Record<string, { label: string; color: string; short: string }> = {
  PS: { label: 'Pré-silábico',        color: '#ef4444', short: 'PS' },
  S:  { label: 'Silábico',            color: '#f59e0b', short: 'S'  },
  SA: { label: 'Sil. Alfabético',     color: '#3b82f6', short: 'SA' },
  A:  { label: 'Alfabético',          color: '#22c55e', short: 'A'  },
};

const READING_LEVELS: Record<string, { label: string; color: string; short: string }> = {
  NL: { label: 'Não Leu',      color: '#ef4444', short: 'NL' },
  LP: { label: 'Leu Palavras', color: '#f59e0b', short: 'LP' },
  LF: { label: 'Leu Frases',   color: '#3b82f6', short: 'LF' },
  LT: { label: 'Leu Texto',    color: '#22c55e', short: 'LT' },
};

const LEVEL_CSS: Record<string, string> = {
  PS: 'bg-red-50 text-red-700 border-red-300',
  S:  'bg-amber-50 text-amber-700 border-amber-300',
  SA: 'bg-blue-50 text-blue-700 border-blue-300',
  A:  'bg-green-50 text-green-700 border-green-300',
  NL: 'bg-red-50 text-red-700 border-red-300',
  LP: 'bg-amber-50 text-amber-700 border-amber-300',
  LF: 'bg-blue-50 text-blue-700 border-blue-300',
  LT: 'bg-green-50 text-green-700 border-green-300',
};

const ReportsPage: React.FC = () => {
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState({ name: 'E.M.E.F Roseli Paiva', city: 'Anajás-PA' });
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase.from('classes').select('*, teachers(name)').order('grade_year').then(({ data }) => {
      if (data) setClasses(data);
    });
    supabase.from('school_info').select('name, city').single().then(({ data }) => {
      if (data) setSchoolInfo({
        name: data.name || 'E.M.E.F Roseli Paiva',
        city: data.city || 'Anajás-PA',
      });
    });
  }, []);

  const generateReport = async () => {
    if (!selectedClass) {
      toast({ title: 'Selecione uma turma', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const classData = classes.find(c => c.id === selectedClass);
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', selectedClass)
      .order('name');

    const studentIds = students?.map(s => s.id) || [];

    // Single query — all bimestres at once
    const { data: allAssessments } = await supabase
      .from('assessments')
      .select('*')
      .in('student_id', studentIds);

    // Map by studentId + bimestre
    const assessMap: Record<string, Record<string, any>> = {};
    allAssessments?.forEach(a => {
      if (!assessMap[a.student_id]) assessMap[a.student_id] = {};
      assessMap[a.student_id][a.bimestre] = a;
    });

    // Per-bimestre stats for charts (all 4 bimestres)
    const bimestreStats = (['1','2','3','4'] as const).map(b => {
      const bData = allAssessments?.filter(a => a.bimestre === b) || [];
      const total = bData.length;
      const wC = { PS: 0, S: 0, SA: 0, A: 0 };
      const rC = { NL: 0, LP: 0, LF: 0, LT: 0 };
      bData.forEach(a => {
        if (a.writing_level) wC[a.writing_level as keyof typeof wC]++;
        if (a.reading_level) rC[a.reading_level as keyof typeof rC]++;
      });
      return { bimestre: b, total, wC, rC };
    });

    // Latest bimestre with data (for pie charts)
    const latestB = [...bimestreStats].reverse().find(b => b.total > 0) || bimestreStats[0];

    const writingChartData = Object.entries(latestB.wC)
      .map(([key, value]) => ({
        name: WRITING_LEVELS[key].label,
        short: WRITING_LEVELS[key].short,
        value,
        color: WRITING_LEVELS[key].color,
        pct: latestB.total > 0 ? Math.round((value / latestB.total) * 100) : 0,
      }));

    const readingChartData = Object.entries(latestB.rC)
      .map(([key, value]) => ({
        name: READING_LEVELS[key].label,
        short: READING_LEVELS[key].short,
        value,
        color: READING_LEVELS[key].color,
        pct: latestB.total > 0 ? Math.round((value / latestB.total) * 100) : 0,
      }));

    // Evolution line chart
    const evolutionData = bimestreStats.map(b => ({
      name: `${b.bimestre}º Bim`,
      'Alfabético': b.total > 0 ? Math.round((b.wC.A / b.total) * 100) : 0,
      'Leu Texto':  b.total > 0 ? Math.round((b.rC.LT / b.total) * 100) : 0,
    }));

    setReportData({
      classData,
      students: students || [],
      assessMap,
      bimestreStats,
      writingChartData,
      readingChartData,
      evolutionData,
      latestTotal: latestB.total,
      latestBimestre: latestB.bimestre,
    });
    setLoading(false);
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      if (pdfH <= pageH) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      } else {
        let position = 0; let remaining = pdfH; let first = true;
        while (remaining > 0) {
          if (!first) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -position, pdfW, pdfH);
          position += pageH; remaining -= pageH; first = false;
        }
      }
      pdf.save(`relatorio-${reportData?.classData?.grade_year}-${reportData?.classData?.class_letter}.pdf`);
      toast({ title: 'PDF exportado!' });
    } catch { toast({ title: 'Erro ao exportar', variant: 'destructive' }); }
    setGenerating(false);
  };

  const DonutSection = ({ title, icon: Icon, data, total }: {
    title: string; icon: React.ElementType; data: any[]; total: number;
  }) => {
    const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
      if (percent < 0.06) return null;
      const RADIAN = Math.PI / 180;
      const r = innerRadius + (outerRadius - innerRadius) * 0.6;
      const x = cx + r * Math.cos(-midAngle * RADIAN);
      const y = cy + r * Math.sin(-midAngle * RADIAN);
      return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">{`${Math.round(percent * 100)}%`}</text>;
    };
    return (
      <div className="flex gap-3">
        {/* Cards */}
        <div className="flex flex-col gap-1.5 w-32 shrink-0">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
            <p className="text-base font-bold text-gray-800">{total}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Avaliados</p>
          </div>
          {data.map(item => (
            <div key={item.short} className="rounded-lg px-2 py-1 flex items-center justify-between"
              style={{ backgroundColor: item.color + '15', border: `1px solid ${item.color}50` }}>
              <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.short}</span>
              <span className="text-xs font-bold text-gray-800">{item.value}</span>
            </div>
          ))}
        </div>
        {/* Donut */}
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-bold text-gray-700">{title}</p>
          </div>
          {total > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={data.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                    dataKey="value" paddingAngle={2} labelLine={false} label={renderLabel}>
                    {data.filter(d => d.value > 0).map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct}%)`, p.payload.name]}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                {data.map(item => (
                  <div key={item.short} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[9px] text-gray-500">{item.short}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400 text-xs">Sem dados</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-0.5">Gere e exporte a planilha de resultados da sondagem</p>
      </div>

      {/* Controls */}
      <Card className="p-5 shadow-card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <p className="text-sm font-medium text-foreground mb-2">Turma</p>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.grade_year} {c.class_letter}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={generateReport}
            disabled={loading || !selectedClass}
            className="gap-2 gradient-primary text-primary-foreground rounded-xl h-10"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Gerar Relatório
          </Button>
        </div>
      </Card>

      {reportData && (
        <>
          {/* Export buttons */}
          <div className="flex flex-wrap gap-3 print:hidden">
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} disabled={generating} className="gap-2">
              <FileText className="w-4 h-4" />
              {generating ? 'Gerando…' : 'Exportar PDF (Paisagem)'}
            </Button>
          </div>

          {/* ========= PRINTABLE REPORT ========= */}
          <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden border border-border shadow-card print:shadow-none print:border-none print:rounded-none">

            {/* ---- Header ---- */}
            <div className="px-6 py-4 border-b-2 border-blue-700" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #0891b2 100%)' }}>
              <div className="flex items-center justify-between">
                {/* Logo placeholder */}
                <div className="w-14 h-14 rounded-xl bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <div className="text-center">
                    <div className="text-white text-[8px] font-bold leading-tight">E.M.E.F</div>
                    <div className="text-white/80 text-[6px] leading-tight">ROSELI</div>
                    <div className="text-white/80 text-[6px] leading-tight">PAIVA</div>
                  </div>
                </div>
                <div className="text-center flex-1 px-4">
                  <p className="text-blue-200 text-xs uppercase tracking-widest">SECRETARIA MUNICIPAL DE EDUCAÇÃO</p>
                  <h1 className="text-white font-display font-bold text-xl leading-tight mt-0.5">{schoolInfo.name}</h1>
                  <p className="text-blue-200 text-sm">{schoolInfo.city}</p>
                  <p className="text-white font-bold text-sm mt-1 uppercase tracking-wide">
                    PLANILHA DE RESULTADOS DA SONDAGEM
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-blue-200 text-xs">ANO LETIVO</p>
                  <p className="text-white text-2xl font-display font-bold">{reportData.classData?.school_year || new Date().getFullYear()}</p>
                  <p className="text-blue-200 text-xs mt-1">
                    {new Date().toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              {/* Class meta */}
              <div className="mt-3 flex gap-6 bg-white/10 rounded-xl px-4 py-2 text-sm">
                <div>
                  <span className="text-blue-200 text-xs uppercase tracking-wide">Turma: </span>
                  <span className="text-white font-bold">{reportData.classData?.grade_year} {reportData.classData?.class_letter}</span>
                </div>
                <div>
                  <span className="text-blue-200 text-xs uppercase tracking-wide">Professor(a): </span>
                  <span className="text-white font-bold">{reportData.classData?.teachers?.name || '___________________'}</span>
                </div>
                <div>
                  <span className="text-blue-200 text-xs uppercase tracking-wide">Coordenador(a): </span>
                  <span className="text-white font-bold">___________________</span>
                </div>
                <div>
                  <span className="text-blue-200 text-xs uppercase tracking-wide">Total de Alunos: </span>
                  <span className="text-white font-bold">{reportData.students.length}</span>
                </div>
              </div>
            </div>

            <div className="p-5">
              {/* ---- MAIN TABLE: all 4 bimestres ---- */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
                  <thead>
                    {/* Row 1: group headers */}
                    <tr>
                      <th rowSpan={2} className="border border-gray-300 bg-blue-900 text-white p-2 text-center w-8">Nº</th>
                      <th rowSpan={2} className="border border-gray-300 bg-blue-900 text-white p-2 text-left w-48">Nome do Aluno</th>
                      <th rowSpan={2} className="border border-gray-300 bg-blue-900 text-white p-2 text-center w-10">Ida.</th>
                      {['1º Bimestre','2º Bimestre','3º Bimestre','4º Bimestre'].map(b => (
                        <th key={b} colSpan={3} className="border border-gray-300 bg-blue-700 text-white p-2 text-center">{b}</th>
                      ))}
                    </tr>
                    {/* Row 2: subcolumns */}
                    <tr>
                      {['1','2','3','4'].map(b => (
                        <React.Fragment key={b}>
                          <th className="border border-gray-300 bg-blue-600 text-white p-1.5 text-center">Escrita</th>
                          <th className="border border-gray-300 bg-blue-600 text-white p-1.5 text-center">Leitura</th>
                          <th className="border border-gray-300 bg-blue-600 text-white p-1.5 text-center">Faltas</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.students.map((student: any, idx: number) => (
                      <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}>
                        <td className="border border-gray-200 p-1.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                        <td className="border border-gray-200 p-1.5 font-medium text-gray-800">{student.name}</td>
                        <td className="border border-gray-200 p-1.5 text-center text-gray-600">{student.age || '—'}</td>
                        {(['1','2','3','4'] as const).map(b => {
                          const a = reportData.assessMap[student.id]?.[b];
                          return (
                            <React.Fragment key={b}>
                              <td className="border border-gray-200 p-1.5 text-center">
                                {a?.writing_level ? (
                                  <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border', LEVEL_CSS[a.writing_level])}>
                                    {a.writing_level}
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="border border-gray-200 p-1.5 text-center">
                                {a?.reading_level ? (
                                  <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border', LEVEL_CSS[a.reading_level])}>
                                    {a.reading_level}
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="border border-gray-200 p-1.5 text-center text-gray-600">
                                {a?.absences ?? <span className="text-gray-300">—</span>}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-blue-50 font-bold">
                      <td colSpan={3} className="border border-gray-300 p-2 text-right text-gray-700 text-xs">TOTAIS POR BIMESTRE →</td>
                      {(['1','2','3','4'] as const).map(b => {
                        const s = reportData.bimestreStats.find((x: any) => x.bimestre === b);
                        return (
                          <React.Fragment key={b}>
                            <td className="border border-gray-300 p-1.5 text-center">
                              <div className="flex flex-col gap-0.5">
                                {Object.entries(s?.wC || {}).map(([k, v]) => v as number > 0 ? (
                                  <span key={k} className={cn('text-[9px] font-bold px-1 rounded border', LEVEL_CSS[k])}>{k}:{v as number}</span>
                                ) : null)}
                              </div>
                            </td>
                            <td className="border border-gray-300 p-1.5 text-center">
                              <div className="flex flex-col gap-0.5">
                                {Object.entries(s?.rC || {}).map(([k, v]) => v as number > 0 ? (
                                  <span key={k} className={cn('text-[9px] font-bold px-1 rounded border', LEVEL_CSS[k])}>{k}:{v as number}</span>
                                ) : null)}
                              </div>
                            </td>
                            <td className="border border-gray-300 p-1.5 text-center text-gray-500 text-[10px]">
                              {allAssessmentsAbsenceTotal(reportData.assessMap, reportData.students, b)}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ---- CHARTS SECTION ---- */}
              <div className="mt-6 grid grid-cols-3 gap-5">
                {/* Writing Donut */}
                <DonutSection
                  title="Níveis de Escrita"
                  icon={PenLine}
                  data={reportData.writingChartData}
                  total={reportData.latestTotal}
                />
                {/* Reading Donut */}
                <DonutSection
                  title="Níveis de Leitura"
                  icon={BookOpen}
                  data={reportData.readingChartData}
                  total={reportData.latestTotal}
                />
                {/* Evolution line chart */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-bold text-gray-700">Evolução da Alfabetização</p>
                  </div>
                  <ResponsiveContainer width="100%" height={175}>
                    <LineChart data={reportData.evolutionData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} unit="%" domain={[0, 100]} />
                      <Tooltip formatter={(v: any, n: any) => [`${v}%`, n]} contentStyle={{ fontSize: '10px', borderRadius: '6px' }} />
                      <Legend wrapperStyle={{ fontSize: '9px' }} />
                      <Line type="monotone" dataKey="Alfabético" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Leu Texto" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ---- LEGEND ---- */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-6 text-xs text-gray-600">
                <div>
                  <span className="font-bold text-gray-700">Escrita: </span>
                  PS = Pré-silábico &nbsp;|&nbsp; S = Silábico &nbsp;|&nbsp; SA = Silábico-Alfabético &nbsp;|&nbsp; A = Alfabético
                </div>
                <div>
                  <span className="font-bold text-gray-700">Leitura: </span>
                  NL = Não Leu &nbsp;|&nbsp; LP = Leu Palavras &nbsp;|&nbsp; LF = Leu Frases &nbsp;|&nbsp; LT = Leu Texto
                </div>
              </div>

              {/* Signatures */}
              <div className="mt-6 flex gap-12 text-xs text-gray-600">
                {['Professor(a)','Coordenador(a) Pedagógico(a)','Diretor(a)'].map(r => (
                  <div key={r} className="flex-1">
                    <div className="border-b border-gray-400 mb-1 pt-6" />
                    <p className="text-center">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper to sum absences for a given bimestre
function allAssessmentsAbsenceTotal(assessMap: Record<string, any>, students: any[], b: string): number {
  let sum = 0;
  students.forEach(s => {
    const a = assessMap[s.id]?.[b];
    if (a?.absences) sum += a.absences;
  });
  return sum || 0;
}

// Inline DonutSection component (used in report)
const DonutSection: React.FC<{ title: string; icon: React.ElementType; data: any[]; total: number }> = ({
  title, icon: Icon, data, total
}) => {
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">{`${Math.round(percent * 100)}%`}</text>;
  };
  return (
    <div className="flex gap-3">
      <div className="flex flex-col gap-1.5 w-28 shrink-0">
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
          <p className="text-base font-bold text-gray-800">{total}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Avaliados</p>
        </div>
        {data.map(item => (
          <div key={item.short} className="rounded-lg px-2 py-1 flex items-center justify-between"
            style={{ backgroundColor: item.color + '15', border: `1px solid ${item.color}50` }}>
            <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.short}</span>
            <span className="text-xs font-bold text-gray-800">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className="w-4 h-4 text-blue-600" />
          <p className="text-sm font-bold text-gray-700">{title}</p>
        </div>
        {total > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={data.filter((d: any) => d.value > 0)} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                  dataKey="value" paddingAngle={2} labelLine={false} label={renderLabel}>
                  {data.filter((d: any) => d.value > 0).map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct}%)`, p.payload.name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
              {data.map((item: any) => (
                <div key={item.short} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[9px] text-gray-500">{item.short}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-400 text-xs">Sem dados</div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
