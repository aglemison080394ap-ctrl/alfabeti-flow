import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Download, FileText, BarChart3, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const WRITING_LEVELS: Record<string, { label: string; color: string; shortLabel: string }> = {
  PS: { label: 'Pré-silábico', color: '#ef4444', shortLabel: 'PS' },
  S: { label: 'Silábico', color: '#f59e0b', shortLabel: 'S' },
  SA: { label: 'Silábico-Alfabético', color: '#3b82f6', shortLabel: 'SA' },
  A: { label: 'Alfabético', color: '#22c55e', shortLabel: 'A' },
};

const READING_LEVELS: Record<string, { label: string; color: string }> = {
  NL: { label: 'Não leu', color: '#ef4444' },
  LP: { label: 'Leu palavras', color: '#f59e0b' },
  LF: { label: 'Leu frase', color: '#3b82f6' },
  LT: { label: 'Leu texto', color: '#22c55e' },
};

const LEVEL_BADGE_MAP: Record<string, string> = {
  PS: 'level-ps', S: 'level-s', SA: 'level-sa', A: 'level-a',
  NL: 'level-nl', LP: 'level-lp', LF: 'level-lf', LT: 'level-lt',
};

const ReportsPage: React.FC = () => {
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolName, setSchoolName] = useState('Escola Municipal');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedBimestre, setSelectedBimestre] = useState<string>('1');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase.from('classes').select('*, teachers(name)').order('grade_year').then(({ data }) => {
      if (data) setClasses(data);
    });
    supabase.from('school_info').select('name').single().then(({ data }) => {
      if (data) setSchoolName(data.name);
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
    const { data: assessments } = await supabase
      .from('assessments')
      .select('*')
      .in('student_id', studentIds)
      .eq('bimestre', selectedBimestre as any);

    const assessmentsMap: Record<string, any> = {};
    assessments?.forEach(a => { assessmentsMap[a.student_id] = a; });

    // Writing counts
    const writingCounts: Record<string, number> = { PS: 0, S: 0, SA: 0, A: 0 };
    const readingCounts: Record<string, number> = { NL: 0, LP: 0, LF: 0, LT: 0 };
    assessments?.forEach(a => {
      if (a.writing_level) writingCounts[a.writing_level]++;
      if (a.reading_level) readingCounts[a.reading_level]++;
    });

    const total = assessments?.length || 0;

    const writingChartData = Object.entries(writingCounts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: WRITING_LEVELS[key].label,
        value,
        color: WRITING_LEVELS[key].color,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));

    const readingChartData = Object.entries(readingCounts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: READING_LEVELS[key].label,
        value,
        color: READING_LEVELS[key].color,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));

    // Evolution
    const evolutionData = await Promise.all(['1', '2', '3', '4'].map(async b => {
      const { data: bData } = await supabase
        .from('assessments')
        .select('writing_level')
        .in('student_id', studentIds)
        .eq('bimestre', b as any);
      return {
        name: `${b}º Bim`,
        PS: bData?.filter(a => a.writing_level === 'PS').length || 0,
        S: bData?.filter(a => a.writing_level === 'S').length || 0,
        SA: bData?.filter(a => a.writing_level === 'SA').length || 0,
        A: bData?.filter(a => a.writing_level === 'A').length || 0,
      };
    }));

    setReportData({
      classData,
      students: students || [],
      assessmentsMap,
      writingCounts,
      readingCounts,
      writingChartData,
      readingChartData,
      evolutionData,
      total,
    });
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `relatorio-${reportData?.classData?.grade_year}-${reportData?.classData?.class_letter}-${selectedBimestre}bim.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: 'Relatório exportado como PNG!' });
    } catch (err) {
      toast({ title: 'Erro ao exportar', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      } else {
        let position = 0;
        let remaining = pdfHeight;
        let first = true;
        while (remaining > 0) {
          if (!first) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, pdfHeight);
          position += pageHeight;
          remaining -= pageHeight;
          first = false;
        }
      }
      pdf.save(`relatorio-${reportData?.classData?.grade_year}-${reportData?.classData?.class_letter}-${selectedBimestre}bim.pdf`);
      toast({ title: 'Relatório exportado como PDF!' });
    } catch (err) {
      toast({ title: 'Erro ao exportar', variant: 'destructive' });
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-0.5">Gere e exporte relatórios pedagógicos completos</p>
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
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Bimestre</p>
            <Select value={selectedBimestre} onValueChange={setSelectedBimestre}>
              <SelectTrigger className="w-40 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['1', '2', '3', '4'].map(b => (
                  <SelectItem key={b} value={b}>{b}º Bimestre</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={generateReport}
            disabled={loading || !selectedClass}
            className="gap-2 gradient-primary text-primary-foreground rounded-xl h-10"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : <BarChart3 className="w-4 h-4" />}
            Gerar Relatório
          </Button>
        </div>
      </Card>

      {/* Report */}
      {reportData && (
        <>
          {/* Export buttons */}
          <div className="flex flex-wrap gap-3 print:hidden">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={generating}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              {generating ? 'Gerando...' : 'Exportar PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPNG}
              disabled={generating}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {generating ? 'Gerando...' : 'Exportar PNG'}
            </Button>
          </div>

          {/* Report content */}
          <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden border border-border shadow-card print:shadow-none print:border-none">
            {/* Header */}
            <div className="p-8 border-b border-border" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0891b2 100%)' }}>
              <div className="text-center">
                <p className="text-blue-100 text-sm font-medium uppercase tracking-widest mb-1">Relatório Pedagógico</p>
                <h1 className="text-white font-display font-bold text-3xl mb-1">{schoolName}</h1>
                <p className="text-blue-100 text-lg">
                  {reportData.classData?.grade_year} {reportData.classData?.class_letter} — {selectedBimestre}º Bimestre
                </p>
                {reportData.classData?.teachers?.name && (
                  <p className="text-blue-200 text-sm mt-1">Prof. {reportData.classData.teachers.name}</p>
                )}
                <p className="text-blue-200 text-xs mt-2">
                  Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total de Alunos', value: reportData.students.length, color: 'text-blue-600' },
                  { label: 'Avaliados', value: reportData.total, color: 'text-green-600' },
                  { label: 'Pendentes', value: reportData.students.length - reportData.total, color: 'text-amber-600' },
                ].map(s => (
                  <div key={s.label} className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className={`text-3xl font-display font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-gray-500 text-sm mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-2 gap-6">
                {/* Writing chart */}
                <div>
                  <h3 className="font-display font-bold text-gray-800 mb-3">Níveis de Escrita</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={reportData.writingChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                        {reportData.writingChartData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any, p: any) => [`${v} (${p.payload.pct}%)`, n]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Reading chart */}
                <div>
                  <h3 className="font-display font-bold text-gray-800 mb-3">Níveis de Leitura</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={reportData.readingChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                        {reportData.readingChartData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any, p: any) => [`${v} (${p.payload.pct}%)`, n]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Evolution chart */}
              <div>
                <h3 className="font-display font-bold text-gray-800 mb-3">Evolução da Alfabetização por Bimestre</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reportData.evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="PS" fill="#ef4444" radius={[4, 4, 0, 0]} name="Pré-silábico" />
                    <Bar dataKey="S" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Silábico" />
                    <Bar dataKey="SA" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Sil. Alfabético" />
                    <Bar dataKey="A" fill="#22c55e" radius={[4, 4, 0, 0]} name="Alfabético" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Students table */}
              <div>
                <h3 className="font-display font-bold text-gray-800 mb-3">Lista de Alunos e Resultados</h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 border border-gray-200 font-medium text-gray-700">#</th>
                      <th className="text-left p-3 border border-gray-200 font-medium text-gray-700">Nome</th>
                      <th className="text-center p-3 border border-gray-200 font-medium text-gray-700">Escrita</th>
                      <th className="text-center p-3 border border-gray-200 font-medium text-gray-700">Leitura</th>
                      <th className="text-center p-3 border border-gray-200 font-medium text-gray-700">Faltas</th>
                      <th className="text-left p-3 border border-gray-200 font-medium text-gray-700">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.students.map((student: any, idx: number) => {
                      const a = reportData.assessmentsMap[student.id];
                      return (
                        <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="p-3 border border-gray-200 text-gray-500">{idx + 1}</td>
                          <td className="p-3 border border-gray-200 font-medium text-gray-800">{student.name}</td>
                          <td className="p-3 border border-gray-200 text-center">
                            {a?.writing_level ? (
                              <span className={cn(
                                "inline-block px-2 py-0.5 rounded text-xs font-bold border",
                                LEVEL_BADGE_MAP[a.writing_level]
                              )}>{a.writing_level}</span>
                            ) : '—'}
                          </td>
                          <td className="p-3 border border-gray-200 text-center">
                            {a?.reading_level ? (
                              <span className={cn(
                                "inline-block px-2 py-0.5 rounded text-xs font-bold border",
                                LEVEL_BADGE_MAP[a.reading_level]
                              )}>{a.reading_level}</span>
                            ) : '—'}
                          </td>
                          <td className="p-3 border border-gray-200 text-center text-gray-600">{a?.absences ?? '—'}</td>
                          <td className="p-3 border border-gray-200 text-gray-500 text-xs">{a?.notes || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
                Sistema de Sondagem de Leitura e Escrita • {schoolName} • {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
