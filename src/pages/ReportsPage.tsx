import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { FileImage, BarChart3, Printer, PenLine, BookOpen, TrendingUp, Table2, Download, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/* ── Level config ─────────────────────────────────────────────────── */
const WRITING_LEVELS: Record<string, { label: string; color: string; short: string }> = {
  PS: { label: 'Pré-silábico',    color: '#ef4444', short: 'PS' },
  S:  { label: 'Silábico',        color: '#f59e0b', short: 'S'  },
  SA: { label: 'Sil. Alfabético', color: '#3b82f6', short: 'SA' },
  A:  { label: 'Alfabético',      color: '#22c55e', short: 'A'  },
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

/* ── Helper ───────────────────────────────────────────────────────── */
function absenceTotal(assessMap: Record<string, any>, students: any[], b: string) {
  let sum = 0;
  students.forEach(s => { const a = assessMap[s.id]?.[b]; if (a?.absences) sum += a.absences; });
  return sum || 0;
}

/* ── Fat Donut for reports ────────────────────────────────────────── */
const DonutSection: React.FC<{
  title: string; icon: React.ElementType; data: any[]; total: number;
}> = ({ title, icon: Icon, data, total }) => {
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * R);
    const y = cy + r * Math.sin(-midAngle * R);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="bold">
        {`${Math.round(percent * 100)}%`}
      </text>
    );
  };
  return (
    <div className="flex gap-3">
      {/* Left stat cards */}
      <div className="flex flex-col gap-1.5 w-28 shrink-0">
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
          <p className="text-base font-bold text-gray-800">{total}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Avaliados</p>
        </div>
        {data.map(item => (
          <div key={item.short} className="rounded-lg px-2 py-1 flex items-center justify-between"
            style={{ backgroundColor: item.color + '18', border: `1px solid ${item.color}50` }}>
            <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.short}</span>
            <span className="text-xs font-bold text-gray-800">{item.value}</span>
          </div>
        ))}
      </div>
      {/* Right donut */}
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="w-4 h-4 text-green-700" />
          <p className="text-sm font-bold text-gray-700">{title}</p>
        </div>
        {total > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={175}>
              <PieChart>
                <Pie
                  data={data.filter(d => d.value > 0)}
                  cx="50%" cy="50%"
                  innerRadius={42}
                  outerRadius={78}
                  dataKey="value"
                  paddingAngle={2}
                  labelLine={false}
                  label={renderLabel}
                >
                  {data.filter(d => d.value > 0).map((e: any, i: number) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct}%)`, p.payload.name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
              {data.map(item => (
                <div key={item.short} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[9px] text-gray-500">{item.short} – {item.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-36 flex items-center justify-center text-gray-400 text-xs">Sem dados</div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
const ReportsPage: React.FC = () => {
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);
  const dashRef  = useRef<HTMLDivElement>(null);

  const [classes, setClasses]       = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState({
    name: 'E.M.E.F Roseli Paiva',
    city: 'Anajás-PA',
    coordinator: '',
    active_school_year: new Date().getFullYear(),
  });
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [reportData, setReportData]       = useState<any>(null);
  const [loading, setLoading]             = useState(false);
  const [generating, setGenerating]       = useState<string | null>(null);

  useEffect(() => {
    supabase.from('classes').select('*, teachers(name)').order('grade_year').then(({ data }) => {
      if (data) setClasses(data);
    });
    supabase.from('school_info').select('name, city, coordinator, active_school_year').single().then(({ data }) => {
      if (data) setSchoolInfo({
        name:               (data as any).name              || 'E.M.E.F Roseli Paiva',
        city:               (data as any).city              || 'Anajás-PA',
        coordinator:        (data as any).coordinator       || '',
        active_school_year: (data as any).active_school_year || new Date().getFullYear(),
      });
    });
  }, []);

  /* ── Generate ─────────────────────────────────────────────────── */
  const generateReport = async () => {
    if (!selectedClass) {
      toast({ title: 'Selecione uma turma', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const classData = classes.find(c => c.id === selectedClass);
    const { data: students } = await supabase
      .from('students').select('*').eq('class_id', selectedClass).order('name');

    const studentIds = students?.map(s => s.id) || [];
    const { data: allAssessments } = await supabase
      .from('assessments').select('*').in('student_id', studentIds);

    const assessMap: Record<string, Record<string, any>> = {};
    allAssessments?.forEach(a => {
      if (!assessMap[a.student_id]) assessMap[a.student_id] = {};
      assessMap[a.student_id][a.bimestre] = a;
    });

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

    const latestB = [...bimestreStats].reverse().find(b => b.total > 0) || bimestreStats[0];

    const writingChartData = Object.entries(latestB.wC).map(([key, value]) => ({
      name: WRITING_LEVELS[key].label, short: WRITING_LEVELS[key].short,
      value, color: WRITING_LEVELS[key].color,
      pct: latestB.total > 0 ? Math.round((value / latestB.total) * 100) : 0,
    }));

    const readingChartData = Object.entries(latestB.rC).map(([key, value]) => ({
      name: READING_LEVELS[key].label, short: READING_LEVELS[key].short,
      value, color: READING_LEVELS[key].color,
      pct: latestB.total > 0 ? Math.round((value / latestB.total) * 100) : 0,
    }));

    const evolutionData = bimestreStats.map(b => ({
      name: `${b.bimestre}º Bim`,
      'Alfabético': b.total > 0 ? Math.round((b.wC.A  / b.total) * 100) : 0,
      'Leu Texto':  b.total > 0 ? Math.round((b.rC.LT / b.total) * 100) : 0,
    }));

    // Coordinator: class-level overrides school-level
    const coordinatorName = (classData as any)?.coordinator_name
      || schoolInfo.coordinator
      || '___________________';

    setReportData({
      classData, students: students || [], assessMap,
      bimestreStats, writingChartData, readingChartData,
      evolutionData, latestTotal: latestB.total, latestBimestre: latestB.bimestre,
      coordinatorName,
    });
    setLoading(false);
  };

  /* ── Print helper ─────────────────────────────────────────────── */
  const printSection = (sectionId: string) => {
    const style = document.createElement('style');
    style.id = '__print_override';
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        #app-root { display: block !important; }
        .no-print { display: none !important; }
        .print-section { display: none !important; }
        #${sectionId} { display: block !important; }
        @page { size: A4 landscape; margin: 10mm; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  /* ── High-quality capture helper ─────────────────────────────── */
  const captureElement = async (el: HTMLDivElement, scale = 3): Promise<HTMLCanvasElement> => {
    const html2canvas = (await import('html2canvas')).default;

    // Save original styles
    const prevWidth    = el.style.width;
    const prevOverflow = el.style.overflow;
    const prevPosition = el.style.position;

    // Fix element width so Recharts renders at exact pixel size
    const fixedWidth = 1200;
    el.style.width    = `${fixedWidth}px`;
    el.style.overflow = 'visible';
    el.style.position = 'relative';

    // Wait one tick for Recharts to re-render at new size
    await new Promise(r => setTimeout(r, 400));

    const canvas = await html2canvas(el, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      allowTaint: false,
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth + 40,
      windowHeight: el.scrollHeight + 40,
      onclone: (doc) => {
        // Force all SVG elements to have explicit width/height so they render correctly
        doc.querySelectorAll('svg').forEach((svg: SVGElement) => {
          const box = svg.getBoundingClientRect();
          if (box.width > 0) {
            svg.setAttribute('width',  String(box.width));
            svg.setAttribute('height', String(box.height));
          }
        });
      },
    });

    // Restore original styles
    el.style.width    = prevWidth;
    el.style.overflow = prevOverflow;
    el.style.position = prevPosition;

    return canvas;
  };

  /* ── PNG Export ───────────────────────────────────────────────── */
  const handleDownloadPNG = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    setGenerating(filename);
    try {
      const canvas = await captureElement(ref.current, 3);
      const link   = document.createElement('a');
      link.download = filename.replace(/\.(jpg|jpeg)$/i, '.png');
      link.href     = canvas.toDataURL('image/png');
      link.click();
      toast({ title: 'PNG exportado com sucesso!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao exportar PNG', variant: 'destructive' });
    }
    setGenerating(null);
  };

  /* ── PDF Export ───────────────────────────────────────────────── */
  const handleDownloadPDF = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    setGenerating(filename);
    try {
      const canvas   = await captureElement(ref.current, 2);
      const { jsPDF } = await import('jspdf');

      const imgW  = canvas.width;
      const imgH  = canvas.height;
      const ratio = imgH / imgW;

      // A4 landscape: 297 × 210 mm  |  portrait: 210 × 297 mm
      const landscape = imgW >= imgH;
      const pdfW = landscape ? 297 : 210;
      const pdfH = landscape ? 210 : 297;

      const pdf = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Fit image inside page with margins
      const margin   = 8; // mm
      const maxW     = pdfW - margin * 2;
      const maxH     = pdfH - margin * 2;
      const drawW    = Math.min(maxW, maxH / ratio);
      const drawH    = drawW * ratio;
      const offsetX  = margin + (maxW - drawW) / 2;
      const offsetY  = margin + (maxH - drawH) / 2;

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', offsetX, offsetY, drawW, drawH);
      pdf.save(filename.replace(/\.(jpg|jpeg|png)$/i, '.pdf'));
      toast({ title: 'PDF exportado com sucesso!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao exportar PDF', variant: 'destructive' });
    }
    setGenerating(null);
  };

  /* ── JPG Export (legacy, kept for backward compat) ───────────── */
  const handleDownloadJPG = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    setGenerating(filename);
    try {
      const canvas = await captureElement(ref.current, 3);
      const link   = document.createElement('a');
      link.download = filename;
      link.href     = canvas.toDataURL('image/jpeg', 0.97);
      link.click();
      toast({ title: 'Imagem exportada com sucesso!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao exportar imagem', variant: 'destructive' });
    }
    setGenerating(null);
  };

  /* ── Green table header ────────────────────────────────────────── */
  const TableHeader = () => {
    const coordinatorName = reportData?.coordinatorName || schoolInfo.coordinator || '___________________';
    return (
      <div className="px-6 py-4 border-b-4 border-green-800"
        style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)' }}>
        <div className="flex items-center justify-between">
          {/* School logo badge */}
          <div className="w-16 h-16 rounded-xl bg-white/20 border-2 border-white/40 flex flex-col items-center justify-center shrink-0 text-center px-1">
            <div className="text-white text-[7px] font-bold leading-tight">E.M.E.F</div>
            <div className="text-green-200 text-[6px] leading-tight">ROSELI</div>
            <div className="text-green-200 text-[6px] leading-tight">PAIVA</div>
            <div className="text-green-300 text-[5px] leading-tight mt-0.5">Anajás-PA</div>
          </div>
          <div className="text-center flex-1 px-4">
            <p className="text-green-200 text-xs uppercase tracking-widest">SECRETARIA MUNICIPAL DE EDUCAÇÃO</p>
            <h1 className="text-white font-bold text-xl leading-tight mt-0.5" style={{ fontFamily: 'Nunito, sans-serif' }}>
              {schoolInfo.name}
            </h1>
            <p className="text-green-200 text-sm">{schoolInfo.city}</p>
            <p className="text-white font-bold text-sm mt-1 uppercase tracking-wide">
              PLANILHA DE RESULTADOS DA SONDAGEM
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-green-200 text-xs">ANO LETIVO</p>
            <p className="text-white text-2xl font-bold" style={{ fontFamily: 'Nunito, sans-serif' }}>
              {reportData?.classData?.school_year || schoolInfo.active_school_year}
            </p>
            <p className="text-green-200 text-xs mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
        {/* Meta row */}
        <div className="mt-3 flex flex-wrap gap-4 bg-white/10 rounded-xl px-4 py-2 text-sm">
          <div>
            <span className="text-green-200 text-xs uppercase tracking-wide">Turma: </span>
            <span className="text-white font-bold">
              {reportData?.classData?.grade_year} {reportData?.classData?.class_letter}
            </span>
          </div>
          <div>
            <span className="text-green-200 text-xs uppercase tracking-wide">Professor(a): </span>
            <span className="text-white font-bold">{reportData?.classData?.teachers?.name || '___________________'}</span>
          </div>
          <div>
            <span className="text-green-200 text-xs uppercase tracking-wide">Coordenador(a): </span>
            <span className="text-white font-bold">{coordinatorName}</span>
          </div>
          <div>
            <span className="text-green-200 text-xs uppercase tracking-wide">Total de Alunos: </span>
            <span className="text-white font-bold">{reportData?.students?.length}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ── Clean dashboard header (title + class + bimestre only) ─────── */
  const DashHeader = () => (
    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Dashboard de Resultados</p>
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Nunito, sans-serif' }}>
          {reportData?.classData?.grade_year} {reportData?.classData?.class_letter}
        </h2>
      </div>
      <div className="text-right">
        <span className="inline-block bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">
          {reportData?.latestBimestre}º Bimestre
        </span>
        <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
      </div>
    </div>
  );

  /* ── JSX ─────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-0.5">Gere e exporte a planilha de resultados da sondagem</p>
      </div>

      {/* Controls */}
      <Card className="p-5 shadow-card no-print">
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
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <BarChart3 className="w-4 h-4" />}
            Gerar Relatório
          </Button>
        </div>
      </Card>

      {reportData && (
        <>
          {/* ── Action buttons ── */}
          <div className="flex flex-wrap gap-3 no-print">
            {/* Table actions */}
            <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-muted/50 border border-border">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wide w-full mb-1">📋 Planilha</span>
              <Button variant="outline" size="sm" onClick={() => printSection('print-table-section')} className="gap-1.5 h-8 text-xs">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={!!generating}
                onClick={() => handleDownloadPNG(tableRef,
                  `planilha-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}.png`)}
                className="gap-1.5 h-8 text-xs"
              >
                {generating?.includes('planilha') && generating?.endsWith('.png')
                  ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <FileImage className="w-3.5 h-3.5" />}
                PNG
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={!!generating}
                onClick={() => handleDownloadPDF(tableRef,
                  `planilha-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}.pdf`)}
                className="gap-1.5 h-8 text-xs text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
              >
                {generating?.includes('planilha') && generating?.endsWith('.pdf')
                  ? <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                  : <FileDown className="w-3.5 h-3.5" />}
                PDF
              </Button>
            </div>

            {/* Dashboard actions */}
            <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-muted/50 border border-border">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wide w-full mb-1">📊 Gráficos</span>
              <Button variant="outline" size="sm" onClick={() => printSection('print-dashboard-section')} className="gap-1.5 h-8 text-xs">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={!!generating}
                onClick={() => handleDownloadPNG(dashRef,
                  `graficos-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}.png`)}
                className="gap-1.5 h-8 text-xs"
              >
                {generating?.includes('graficos') && generating?.endsWith('.png')
                  ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <FileImage className="w-3.5 h-3.5" />}
                PNG
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={!!generating}
                onClick={() => handleDownloadPDF(dashRef,
                  `graficos-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}.pdf`)}
                className="gap-1.5 h-8 text-xs text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
              >
                {generating?.includes('graficos') && generating?.endsWith('.pdf')
                  ? <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                  : <FileDown className="w-3.5 h-3.5" />}
                PDF
              </Button>
            </div>
          </div>

          {/* ════════════════════════════════════════════════
              SECTION 1 — PRINTABLE TABLE (green theme)
          ════════════════════════════════════════════════ */}
          <div
            id="print-table-section"
            className="print-section bg-white rounded-2xl overflow-hidden border border-border shadow-card"
            ref={tableRef}
          >
            <TableHeader />
            <div className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} className="border border-gray-300 bg-green-900 text-white p-2 text-center w-8">Nº</th>
                      <th rowSpan={2} className="border border-gray-300 bg-green-900 text-white p-2 text-left w-48">Nome do Aluno</th>
                      <th rowSpan={2} className="border border-gray-300 bg-green-900 text-white p-2 text-center w-10">Ida.</th>
                      {['1º Bimestre','2º Bimestre','3º Bimestre','4º Bimestre'].map(b => (
                        <th key={b} colSpan={3} className="border border-gray-300 bg-green-700 text-white p-2 text-center">{b}</th>
                      ))}
                    </tr>
                    <tr>
                      {['1','2','3','4'].map(b => (
                        <React.Fragment key={b}>
                          <th className="border border-gray-300 bg-green-600 text-white p-1.5 text-center">Escrita</th>
                          <th className="border border-gray-300 bg-green-600 text-white p-1.5 text-center">Leitura</th>
                          <th className="border border-gray-300 bg-green-600 text-white p-1.5 text-center">Faltas</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.students.map((student: any, idx: number) => (
                      <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-green-50/40'}>
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
                                {a ? (a.absences ?? 0) : <span className="text-gray-300">—</span>}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Totals row */}
                    <tr className="bg-green-50 font-bold">
                      <td colSpan={3} className="border border-gray-300 p-2 text-right text-gray-700 text-xs">
                        TOTAIS POR BIMESTRE →
                      </td>
                      {(['1','2','3','4'] as const).map(b => {
                        const s = reportData.bimestreStats.find((x: any) => x.bimestre === b);
                        return (
                          <React.Fragment key={b}>
                            <td className="border border-gray-300 p-1.5 text-center">
                              <div className="flex flex-col gap-0.5">
                                {Object.entries(s?.wC || {}).map(([k, v]) => (v as number) > 0 ? (
                                  <span key={k} className={cn('text-[9px] font-bold px-1 rounded border', LEVEL_CSS[k])}>{k}:{v as number}</span>
                                ) : null)}
                              </div>
                            </td>
                            <td className="border border-gray-300 p-1.5 text-center">
                              <div className="flex flex-col gap-0.5">
                                {Object.entries(s?.rC || {}).map(([k, v]) => (v as number) > 0 ? (
                                  <span key={k} className={cn('text-[9px] font-bold px-1 rounded border', LEVEL_CSS[k])}>{k}:{v as number}</span>
                                ) : null)}
                              </div>
                            </td>
                            <td className="border border-gray-300 p-1.5 text-center text-gray-500 text-[10px]">
                              {absenceTotal(reportData.assessMap, reportData.students, b)}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legend */}
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

          {/* ════════════════════════════════════════════════
              SECTION 2 — CLEAN DASHBOARD (charts only)
          ════════════════════════════════════════════════ */}
          <div
            id="print-dashboard-section"
            className="print-section bg-white rounded-2xl overflow-hidden border border-border shadow-card"
            ref={dashRef}
          >
            {/* Clean minimal header — no school/secretary info */}
            <DashHeader />
            <div className="p-6">
              <div className="grid grid-cols-3 gap-6">
                <DonutSection
                  title="Níveis de Escrita" icon={PenLine}
                  data={reportData.writingChartData} total={reportData.latestTotal}
                />
                <DonutSection
                  title="Níveis de Leitura" icon={BookOpen}
                  data={reportData.readingChartData} total={reportData.latestTotal}
                />
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-bold text-gray-700">Evolução da Alfabetização</p>
                  </div>
                  <ResponsiveContainer width="100%" height={195}>
                    <LineChart data={reportData.evolutionData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        formatter={(v: any, n: any) => [`${v}%`, n]}
                        contentStyle={{ fontSize: '10px', borderRadius: '6px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="Alfabético" stroke="#22c55e" strokeWidth={2.5}
                        dot={{ r: 4, fill: '#22c55e', stroke: '#fff', strokeWidth: 1.5 }} />
                      <Line type="monotone" dataKey="Leu Texto"  stroke="#3b82f6" strokeWidth={2.5}
                        dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 1.5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Compact legend */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-6 text-[11px] text-gray-500">
                <span><strong className="text-gray-700">Escrita:</strong> PS=Pré-silábico · S=Silábico · SA=Sil.-Alfabético · A=Alfabético</span>
                <span><strong className="text-gray-700">Leitura:</strong> NL=Não Leu · LP=Leu Palavras · LF=Leu Frases · LT=Leu Texto</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
