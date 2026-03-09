import React, { useEffect, useRef, useState } from 'react';
import schoolLogo from '@/assets/school-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { FileImage, BarChart3, Printer, PenLine, BookOpen, TrendingUp, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  const { isAdmin, profile } = useAuth();
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

  // Load only teacher's own classes (or all for admin)
  useEffect(() => {
    if (!profile) return;
    const loadClasses = async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from('classes')
          .select('*, teachers(name)')
          .order('grade_year');
        if (data) setClasses(data);
      } else {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', profile.user_id)
          .maybeSingle();
        if (teacherData) {
          const { data } = await supabase
            .from('classes')
            .select('*, teachers(name)')
            .eq('teacher_id', teacherData.id)
            .order('grade_year');
          if (data) {
            setClasses(data);
            if (data.length > 0) setSelectedClass(data[0].id);
          }
        }
      }
    };
    loadClasses();
    supabase.from('school_info').select('name, city, coordinator, active_school_year').single().then(({ data }) => {
      if (data) setSchoolInfo({
        name:               (data as any).name              || 'E.M.E.F Roseli Paiva',
        city:               (data as any).city              || 'Anajás-PA',
        coordinator:        (data as any).coordinator       || '',
        active_school_year: (data as any).active_school_year || new Date().getFullYear(),
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isAdmin]);

  /* ── Generate ─────────────────────────────────────────────────── */
  const generateReport = async () => {
    if (!selectedClass) {
      toast({ title: 'Selecione uma turma', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const classData = classes.find(c => c.id === selectedClass);

    // Fetch coordinator name directly from teachers table (set by teacher in their profile)
    let coordinatorName = '___________________';
    if (classData?.teacher_id) {
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('coordinator_name')
        .eq('id', classData.teacher_id)
        .maybeSingle();
      if (teacherRow?.coordinator_name) {
        coordinatorName = teacherRow.coordinator_name;
      }
    }

    const { data: students } = await supabase
      .from('students').select('*').eq('class_id', selectedClass).order('name');

    const studentIds = students?.map(s => s.id) || [];
    const { data: rawAssessments } = studentIds.length > 0
      ? await supabase.from('assessments').select('*').in('student_id', studentIds)
      : { data: [] };
    const finalAssessments = rawAssessments || [];

    const assessMap: Record<string, Record<string, any>> = {};
    finalAssessments.forEach(a => {
      if (!assessMap[a.student_id]) assessMap[a.student_id] = {};
      assessMap[a.student_id][a.bimestre] = a;
    });

    const bimestreStats = (['1','2','3','4'] as const).map(b => {
      const bData = finalAssessments.filter(a => a.bimestre === b);
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
  // exportWidth: px width used to render (portrait ≈ 900, landscape ≈ 1440)
  const captureElement = async (
    el: HTMLDivElement,
    exportWidth = 1440,
  ): Promise<HTMLCanvasElement> => {
    const html2canvas = (await import('html2canvas')).default;

    const svgSizeMap = new Map<SVGElement, { w: number; h: number }>();
    el.querySelectorAll<SVGElement>('svg').forEach(svg => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0)
        svgSizeMap.set(svg, { w: Math.ceil(r.width), h: Math.ceil(r.height) });
    });

    const prev = {
      width: el.style.width, maxWidth: el.style.maxWidth,
      overflow: el.style.overflow, position: el.style.position,
      transform: el.style.transform,
    };

    el.style.width     = `${exportWidth}px`;
    el.style.maxWidth  = 'none';
    el.style.overflow  = 'visible';
    el.style.position  = 'relative';
    el.style.transform = 'none';

    await new Promise(r => setTimeout(r, 800));

    el.querySelectorAll<SVGElement>('svg').forEach(svg => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0)
        svgSizeMap.set(svg, { w: Math.ceil(r.width), h: Math.ceil(r.height) });
    });

    const W = el.scrollWidth;
    const H = el.scrollHeight;

    const canvas = await html2canvas(el, {
      scale: 4,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      allowTaint: false,
      width: W,
      height: H,
      windowWidth:  W + 80,
      windowHeight: H + 80,
      x: 0,
      y: 0,
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        const clonedSvgs = clonedEl.querySelectorAll<SVGElement>('svg');
        const origSvgs   = el.querySelectorAll<SVGElement>('svg');
        clonedSvgs.forEach((clonedSvg, i) => {
          const origSvg = origSvgs[i];
          if (!origSvg) return;
          const dims = svgSizeMap.get(origSvg);
          if (dims) {
            clonedSvg.setAttribute('width',  String(dims.w));
            clonedSvg.setAttribute('height', String(dims.h));
            clonedSvg.style.width  = `${dims.w}px`;
            clonedSvg.style.height = `${dims.h}px`;
          }
        });
        clonedEl.querySelectorAll<HTMLElement>('[style*="transform"]').forEach(node => {
          node.style.transform = 'none';
        });
        (clonedEl as any).style['font-smooth'] = 'always';
        (clonedEl as any).style['-webkit-font-smoothing'] = 'antialiased';
      },
    });

    Object.assign(el.style, prev);
    return canvas;
  };

  /* ── PNG Export ───────────────────────────────────────────────── */
  const handleDownloadPNG = async (ref: React.RefObject<HTMLDivElement>, filename: string, isSpreadsheet = false) => {
    if (!ref.current) return;
    setGenerating(filename);
    try {
      // Portrait spreadsheet captured at A4-proportional width (~900px)
      const canvas = await captureElement(ref.current, isSpreadsheet ? 900 : 1440);
      const link   = document.createElement('a');
      link.download = filename.replace(/\.(jpg|jpeg|pdf)$/i, '.png');
      link.href     = canvas.toDataURL('image/png');
      link.click();
      toast({ title: '✅ PNG exportado em alta qualidade!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao exportar PNG', variant: 'destructive' });
    }
    setGenerating(null);
  };

  /* ── PDF Export ───────────────────────────────────────────────── */
  // isSpreadsheet=true → A4 retrato (preenche a página toda)
  // isSpreadsheet=false → A4 paisagem
  const handleDownloadPDF = async (
    ref: React.RefObject<HTMLDivElement>,
    filename: string,
    isSpreadsheet = false,
  ) => {
    if (!ref.current) return;
    setGenerating(filename);
    try {
      // For portrait spreadsheet, capture at ~900px width (A4 portrait proportions)
      // so the image ratio naturally fits a portrait page
      const exportWidth = isSpreadsheet ? 900 : 1440;
      const canvas    = await captureElement(ref.current, exportWidth);
      const { jsPDF } = await import('jspdf');

      const landscape = !isSpreadsheet;
      const pdfW = landscape ? 297 : 210;
      const pdfH = landscape ? 210 : 297;

      const pdf = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: false,
      });

      // For spreadsheet: stretch to fill the FULL page (no margins, no gaps)
      // For charts: 5mm margin, contain within page
      if (isSpreadsheet) {
        // Fill entire A4 portrait page edge-to-edge
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);
      } else {
        const margin   = 5;
        const maxW     = pdfW - margin * 2;
        const maxH     = pdfH - margin * 2;
        const imgRatio = canvas.height / canvas.width;
        const drawW    = Math.min(maxW, maxH / imgRatio);
        const drawH    = drawW * imgRatio;
        const offsetX  = margin + (maxW - drawW) / 2;
        const offsetY  = margin + (maxH - drawH) / 2;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', offsetX, offsetY, drawW, drawH);
      }

      pdf.save(filename.replace(/\.(jpg|jpeg|png)$/i, '.pdf'));
      toast({ title: '✅ PDF exportado em alta qualidade!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao exportar PDF', variant: 'destructive' });
    }
    setGenerating(null);
  };

  /* ── Spreadsheet table section ─────────────────────────────────── */
  const SpreadsheetTable = () => {
    const coordinatorName = reportData?.coordinatorName || '';
    const teacherName     = reportData?.classData?.teachers?.name || '';
    const turma           = `${reportData?.classData?.grade_year || ''} ${reportData?.classData?.class_letter || ''}`.trim();
    const schoolYear      = schoolInfo.active_school_year || new Date().getFullYear();
    const today           = new Date().toLocaleDateString('pt-BR');

    // Always show at least 35 rows
    const rows = [...(reportData?.students || [])];
    while (rows.length < 35) rows.push(null);

    // Color maps for level cells
    const writingColors: Record<string, { bg: string; color: string }> = {
      PS: { bg: '#fee2e2', color: '#b91c1c' },
      S:  { bg: '#fef3c7', color: '#92400e' },
      SA: { bg: '#dbeafe', color: '#1d4ed8' },
      A:  { bg: '#dcfce7', color: '#15803d' },
    };
    const readingColors: Record<string, { bg: string; color: string }> = {
      NL: { bg: '#fee2e2', color: '#b91c1c' },
      LP: { bg: '#fef3c7', color: '#92400e' },
      LF: { bg: '#dbeafe', color: '#1d4ed8' },
      LT: { bg: '#dcfce7', color: '#15803d' },
    };

    // Header colors per bimestre
    const bimColors = ['#1e3a5f', '#1e4d6b', '#1a5276', '#154360'];
    const bimLight  = ['#e8f0f9', '#e3eff7', '#ddeef8', '#d8ecf5'];

    return (
      <div style={{
        background: '#fff',
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        padding: '0',
        width: '100%',
      }}>

        {/* ── Header band ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f2d55 0%, #1a4a7a 60%, #1e5799 100%)',
          padding: '20px 28px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          {/* School Logo — PNG sem fundo */}
          <img
            src={schoolLogo}
            alt="Logo E.M.E.F Roseli Paiva"
            style={{
              width: 96, height: 96,
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
            }}
          />

          {/* School info */}
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>
              Secretaria Municipal de Educação
            </div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.2 }}>
              {schoolInfo.name || 'E.M.E.F Roseli Paiva'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9.5, marginTop: 2 }}>
              {schoolInfo.city || ''} &nbsp;·&nbsp; Ano Letivo: {schoolYear}
            </div>
          </div>

          {/* Document title badge */}
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 8,
            padding: '8px 14px',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>Documento Oficial</div>
            <div style={{ color: '#fff', fontSize: 10, fontWeight: 800, marginTop: 2 }}>Sondagem de Leitura</div>
            <div style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>e Escrita</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8, marginTop: 3 }}>{today}</div>
          </div>
        </div>

        {/* ── Meta row ── */}
        <div style={{
          display: 'flex',
          borderBottom: '3px solid #0f2d55',
          background: '#f0f5fc',
        }}>
          {[
            { label: 'PROFESSOR(A)', value: teacherName },
            { label: 'COORDENADOR(A)', value: coordinatorName },
            { label: 'TURMA', value: turma },
            { label: 'ANO LETIVO', value: String(schoolYear) },
          ].map((item, i) => (
            <div key={i} style={{
              flex: i === 0 || i === 1 ? 2 : 1,
              padding: '8px 14px',
              borderRight: i < 3 ? '1px solid #c8d8ec' : 'none',
            }}>
              <div style={{ color: '#4a6fa5', fontSize: 7.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{item.label}</div>
              <div style={{ color: '#0f2d55', fontSize: 11, fontWeight: 600 }}>{item.value || <span style={{ color: '#aaa', fontStyle: 'italic', fontWeight: 400 }}>Não informado</span>}</div>
            </div>
          ))}
        </div>

        {/* ── Main table ── */}
        <div style={{ padding: '0 0 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              {/* Row 1: column groups */}
              <tr>
                <th rowSpan={3} style={{
                  background: '#0f2d55', color: '#fff',
                  border: '1px solid #1a4a7a',
                  padding: '6px 4px', textAlign: 'center',
                  width: 28, verticalAlign: 'middle',
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                }}>Nº</th>
                <th rowSpan={3} style={{
                  background: '#0f2d55', color: '#fff',
                  border: '1px solid #1a4a7a',
                  padding: '6px 10px', textAlign: 'left',
                  minWidth: 160, verticalAlign: 'middle',
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                }}>NOME DO ALUNO(A)</th>
                <th rowSpan={3} style={{
                  background: '#0f2d55', color: '#fff',
                  border: '1px solid #1a4a7a',
                  padding: '6px 4px', textAlign: 'center',
                  width: 40, verticalAlign: 'middle',
                  fontSize: 9, fontWeight: 700,
                }}>IDADE</th>
                {['1º BIMESTRE','2º BIMESTRE','3º BIMESTRE','4º BIMESTRE'].map((b, i) => (
                  <th key={b} colSpan={3} style={{
                    background: bimColors[i], color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '6px 4px', textAlign: 'center',
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                  }}>{b}</th>
                ))}
              </tr>
              {/* Row 2: sub-columns per bimestre */}
              <tr>
                {[0,1,2,3].map(i => (
                  <React.Fragment key={i}>
                    <th style={{ background: bimLight[i], color: bimColors[i], border: '1px solid #c8d8ec', padding: '4px 3px', textAlign: 'center', fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3 }}>ESCRITA</th>
                    <th style={{ background: bimLight[i], color: bimColors[i], border: '1px solid #c8d8ec', padding: '4px 3px', textAlign: 'center', fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3 }}>LEITURA</th>
                    <th style={{ background: bimLight[i], color: bimColors[i], border: '1px solid #c8d8ec', padding: '4px 3px', textAlign: 'center', fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3 }}>FALTAS</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((student: any, idx: number) => {
                const isEven = idx % 2 === 0;
                const rowBg  = isEven ? '#ffffff' : '#f4f8fd';
                return (
                  <tr key={idx} style={{ background: rowBg }}>
                    {/* Nº */}
                    <td style={{
                      border: '1px solid #dde6f0', padding: '4px 3px',
                      textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: '#4a6fa5',
                    }}>{String(idx + 1).padStart(2, '0')}</td>
                    {/* Name */}
                    <td style={{
                      border: '1px solid #dde6f0', padding: '4px 10px',
                      fontSize: 10, color: '#0f2d55', fontWeight: student ? 500 : 400,
                      borderLeft: '3px solid #0f2d55',
                    }}>{student?.name || ''}</td>
                    {/* Age */}
                    <td style={{
                      border: '1px solid #dde6f0', padding: '4px 3px',
                      textAlign: 'center', fontSize: 10, color: '#374151',
                    }}>{student?.age || ''}</td>
                    {/* Bimestres */}
                    {(['1','2','3','4'] as const).map((b, bi) => {
                      const a  = student ? reportData?.assessMap[student.id]?.[b] : null;
                      const wl = a?.writing_level || '';
                      const rl = a?.reading_level || '';
                      const wStyle = wl ? writingColors[wl] : null;
                      const rStyle = rl ? readingColors[rl] : null;
                      return (
                        <React.Fragment key={b}>
                          <td style={{
                            border: '1px solid #dde6f0',
                            borderLeft: `2px solid ${bimColors[bi]}40`,
                            padding: '3px 2px', textAlign: 'center', fontSize: 9.5, fontWeight: 700,
                            background: wStyle ? wStyle.bg : rowBg,
                            color: wStyle ? wStyle.color : '#9ca3af',
                          }}>{wl}</td>
                          <td style={{
                            border: '1px solid #dde6f0', padding: '3px 2px', textAlign: 'center', fontSize: 9.5, fontWeight: 700,
                            background: rStyle ? rStyle.bg : rowBg,
                            color: rStyle ? rStyle.color : '#9ca3af',
                          }}>{rl}</td>
                          <td style={{
                            border: '1px solid #dde6f0',
                            borderRight: `2px solid ${bimColors[bi]}40`,
                            padding: '3px 2px', textAlign: 'center', fontSize: 10, color: '#374151',
                            background: a?.absences > 0 ? '#fff7ed' : rowBg,
                            fontWeight: a?.absences > 0 ? 700 : 400,
                          }}>{a != null ? (a.absences ?? 0) : ''}</td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Legend + Signatures ── */}
        <div style={{ padding: '0 0 24px', margin: '0 0 0 0' }}>
          {/* Legend box */}
          <div style={{
            margin: '0 0 20px',
            background: '#f0f5fc',
            border: '1px solid #c8d8ec',
            borderRadius: 6,
            padding: '10px 14px',
            display: 'flex',
            gap: 32,
            flexWrap: 'wrap' as const,
          }}>
            <div>
              <div style={{ color: '#4a6fa5', fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Níveis de Escrita</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['PS','Pré-silábico','#fee2e2','#b91c1c'],['S','Silábico','#fef3c7','#92400e'],['SA','Sil.-Alfabético','#dbeafe','#1d4ed8'],['A','Alfabético','#dcfce7','#15803d']].map(([code,name,bg,color]) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ background: bg, color, fontSize: 8.5, fontWeight: 800, padding: '2px 5px', borderRadius: 3 }}>{code}</span>
                    <span style={{ fontSize: 8.5, color: '#374151' }}>{name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: '#4a6fa5', fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Níveis de Leitura</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['NL','Não Leu','#fee2e2','#b91c1c'],['LP','Leu Palavras','#fef3c7','#92400e'],['LF','Leu Frases','#dbeafe','#1d4ed8'],['LT','Leu Texto','#dcfce7','#15803d']].map(([code,name,bg,color]) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ background: bg, color, fontSize: 8.5, fontWeight: 800, padding: '2px 5px', borderRadius: 3 }}>{code}</span>
                    <span style={{ fontSize: 8.5, color: '#374151' }}>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', gap: 32, padding: '0 4px' }}>
            {['Professor(a)', 'Coordenador(a) Pedagógico(a)', 'Diretor(a)'].map(role => (
              <div key={role} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ borderBottom: '1.5px solid #0f2d55', marginBottom: 6, height: 32 }} />
                <div style={{ fontSize: 9, color: '#0f2d55', fontWeight: 700, letterSpacing: 0.3 }}>{role}</div>
                <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 1 }}>Assinatura / Carimbo</div>
              </div>
            ))}
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
                  `planilha-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}.png`, true)}
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
                  `planilha-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}.pdf`, true)}
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
                  `graficos-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}.pdf`, false)}
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
              SECTION 1 — PRINTABLE TABLE (reference layout)
          ════════════════════════════════════════════════ */}
          <div
            id="print-table-section"
            className="print-section bg-white rounded-2xl overflow-hidden border border-border shadow-card"
            ref={tableRef}
          >
            <SpreadsheetTable />
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
