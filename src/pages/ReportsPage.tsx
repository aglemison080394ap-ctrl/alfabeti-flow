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
  const [selectedClass, setSelectedClass]       = useState<string>('');
  const [selectedBimestre, setSelectedBimestre] = useState<string>('auto');
  const [reportData, setReportData]             = useState<any>(null);
  const [loading, setLoading]                   = useState(false);
  const [generating, setGenerating]             = useState<string | null>(null);

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

    const totalStudents = (students || []).length;

    const bimestreStats = (['1','2','3','4'] as const).map(b => {
      const bData = finalAssessments.filter(a => a.bimestre === b);
      // assessed = alunos COM nível de escrita OU leitura preenchido (faltosos não contam)
      const assessed = bData.filter(a => a.writing_level || a.reading_level).length;
      const wC = { PS: 0, S: 0, SA: 0, A: 0 };
      const rC = { NL: 0, LP: 0, LF: 0, LT: 0 };
      bData.forEach(a => {
        if (a.writing_level) wC[a.writing_level as keyof typeof wC]++;
        if (a.reading_level) rC[a.reading_level as keyof typeof rC]++;
      });
      // total = todos os alunos da turma
      return { bimestre: b, total: totalStudents, assessed, wC, rC };
    });

    const evolutionData = bimestreStats.map(b => ({
      name: `${b.bimestre}º Bim`,
      'Alfabético': b.assessed > 0 ? Math.round((b.wC.A  / b.assessed) * 100) : 0,
      'Leu Texto':  b.assessed > 0 ? Math.round((b.rC.LT / b.assessed) * 100) : 0,
    }));

    setReportData({
      classData, students: students || [], assessMap,
      bimestreStats,
      evolutionData,
      coordinatorName,
    });
    setSelectedBimestre('auto');
    setLoading(false);
  };

  /* ── Compute chart data for selected bimestre ──────────────────── */
  const activeBimestreData = React.useMemo(() => {
    if (!reportData) return null;
    const { bimestreStats } = reportData;
    let activeB;
    if (selectedBimestre === 'auto') {
      activeB = [...bimestreStats].reverse().find((b: any) => b.assessed > 0) || bimestreStats[0];
    } else {
      activeB = bimestreStats.find((b: any) => b.bimestre === selectedBimestre) || bimestreStats[0];
    }
    // pct calculado sobre os avaliados (assessed), não o total da turma
    const writingChartData = Object.entries(activeB.wC).map(([key, value]: [string, any]) => ({
      name: WRITING_LEVELS[key].label, short: WRITING_LEVELS[key].short,
      value, color: WRITING_LEVELS[key].color,
      pct: activeB.assessed > 0 ? Math.round((value / activeB.assessed) * 100) : 0,
    }));
    const readingChartData = Object.entries(activeB.rC).map(([key, value]: [string, any]) => ({
      name: READING_LEVELS[key].label, short: READING_LEVELS[key].short,
      value, color: READING_LEVELS[key].color,
      pct: activeB.assessed > 0 ? Math.round((value / activeB.assessed) * 100) : 0,
    }));
    return { activeB, writingChartData, readingChartData };
  }, [reportData, selectedBimestre]);

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

    const prev = {
      width: el.style.width, maxWidth: el.style.maxWidth,
      overflow: el.style.overflow, position: el.style.position,
      transform: el.style.transform, left: el.style.left, top: el.style.top,
    };

    // Force layout at export width so Recharts re-renders at correct size
    el.style.width     = `${exportWidth}px`;
    el.style.maxWidth  = 'none';
    el.style.overflow  = 'visible';
    el.style.position  = 'relative';
    el.style.transform = 'none';
    el.style.left      = '0';
    el.style.top       = '0';

    // Wait for Recharts SVGs to resize at new container width
    await new Promise(r => setTimeout(r, 1200));

    // Snapshot actual SVG dimensions AFTER reflow
    const svgSizeMap = new Map<SVGElement, { w: number; h: number }>();
    el.querySelectorAll<SVGElement>('svg').forEach(svg => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0)
        svgSizeMap.set(svg, { w: Math.ceil(rect.width), h: Math.ceil(rect.height) });
    });

    // Force explicit width/height on each SVG so html2canvas captures them fully
    el.querySelectorAll<SVGElement>('svg').forEach(svg => {
      const dims = svgSizeMap.get(svg);
      if (dims) {
        svg.setAttribute('width',  String(dims.w));
        svg.setAttribute('height', String(dims.h));
        svg.style.width  = `${dims.w}px`;
        svg.style.height = `${dims.h}px`;
        svg.style.overflow = 'visible';
      }
    });

    // Also ensure ResponsiveContainer wrappers don't clip
    el.querySelectorAll<HTMLElement>('.recharts-responsive-container').forEach(rc => {
      rc.style.overflow = 'visible';
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
      windowWidth:  W + 120,
      windowHeight: H + 120,
      x: 0,
      y: 0,
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        // Apply captured dimensions to all SVGs in the cloned document
        const clonedSvgs = clonedEl.querySelectorAll<SVGElement>('svg');
        const origSvgs   = el.querySelectorAll<SVGElement>('svg');
        clonedSvgs.forEach((clonedSvg, i) => {
          const origSvg = origSvgs[i];
          if (!origSvg) return;
          const dims = svgSizeMap.get(origSvg);
          if (dims) {
            clonedSvg.setAttribute('width',  String(dims.w));
            clonedSvg.setAttribute('height', String(dims.h));
            clonedSvg.style.width    = `${dims.w}px`;
            clonedSvg.style.height   = `${dims.h}px`;
            clonedSvg.style.overflow = 'visible';
          }
        });
        // Remove any clipping transforms
        clonedEl.querySelectorAll<HTMLElement>('*').forEach(node => {
          const s = node.style;
          if (s.transform && s.transform !== 'none') s.transform = 'none';
          if (s.overflow === 'hidden') s.overflow = 'visible';
        });
        clonedEl.querySelectorAll<HTMLElement>('.recharts-responsive-container').forEach(rc => {
          rc.style.overflow = 'visible';
        });
        (clonedEl as HTMLElement).style.setProperty('-webkit-font-smoothing', 'antialiased');
      },
    });

    Object.assign(el.style, prev);
    // Restore SVG attributes to avoid visual glitch in screen
    el.querySelectorAll<SVGElement>('svg').forEach(svg => {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.width  = '';
      svg.style.height = '';
      svg.style.overflow = '';
    });
    el.querySelectorAll<HTMLElement>('.recharts-responsive-container').forEach(rc => {
      rc.style.overflow = '';
    });
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
        // A4 portrait com margem de 5mm em todos os lados
        const m = 5;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', m, m, pdfW - m * 2, pdfH - m * 2);
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

  /* ── Professional Dashboard Export Header ─────────────────────── */
  const DashHeader = () => {
    const turma    = `${reportData?.classData?.grade_year || ''} ${reportData?.classData?.class_letter || ''}`.trim();
    const teacher  = reportData?.classData?.teachers?.name || '';
    const today    = new Date().toLocaleDateString('pt-BR');
    const schoolYr = schoolInfo.active_school_year || new Date().getFullYear();
    const activeAssessed = activeBimestreData?.activeB?.assessed ?? 0;
    const totalStudents  = reportData?.students?.length ?? 0;
    const activeBim      = activeBimestreData?.activeB?.bimestre ?? '?';

    const statsCards = [
      { label: 'Total de Alunos',    value: totalStudents,                        color: '#0f2d55', bg: '#e8f0fb' },
      { label: 'Avaliados',          value: activeAssessed,                       color: '#15803d', bg: '#dcfce7' },
      { label: 'Não Avaliados',      value: totalStudents - activeAssessed,       color: '#b45309', bg: '#fef3c7' },
      { label: `${activeBim}º Bimestre`, value: 'Selecionado', color: '#1d4ed8', bg: '#dbeafe' },
    ];

    return (
      <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {/* ── Top gradient band ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f2d55 0%, #1a4a7a 60%, #1e5799 100%)',
          padding: '20px 28px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          <img
            src={schoolLogo}
            alt="Logo"
            style={{ width: 80, height: 80, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8.5, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>
              Secretaria Municipal de Educação
            </div>
            <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.2 }}>
              {schoolInfo.name || 'E.M.E.F Roseli Paiva'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 9.5, marginTop: 3 }}>
              {schoolInfo.city || ''} &nbsp;·&nbsp; Ano Letivo: {schoolYr}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 8,
            padding: '10px 16px',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>Documento Oficial</div>
            <div style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>Dashboard de Resultados</div>
            <div style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>Sondagem</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8, marginTop: 4 }}>{today}</div>
          </div>
        </div>

        {/* ── Meta row ── */}
        <div style={{
          display: 'flex',
          borderBottom: '3px solid #0f2d55',
          background: '#f0f5fc',
        }}>
          {[
            { label: 'PROFESSOR(A)',       value: teacher },
            { label: 'TURMA',              value: turma },
            { label: 'COORDENADOR(A)',     value: reportData?.coordinatorName || '' },
            { label: 'DATA DE EMISSÃO',    value: today },
          ].map((item, i) => (
            <div key={i} style={{
              flex: i === 0 || i === 2 ? 2 : 1,
              padding: '8px 14px',
              borderRight: i < 3 ? '1px solid #c8d8ec' : 'none',
            }}>
              <div style={{ color: '#4a6fa5', fontSize: 7.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{item.label}</div>
              <div style={{ color: '#0f2d55', fontSize: 11, fontWeight: 600 }}>
                {item.value || <span style={{ color: '#aaa', fontStyle: 'italic', fontWeight: 400 }}>Não informado</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── Stats cards row ── */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #dde6f0', padding: '14px 20px', gap: 12 }}>
          {statsCards.map((s, i) => (
            <div key={i} style={{
              flex: 1,
              background: s.bg,
              border: `1px solid ${s.color}30`,
              borderRadius: 8,
              padding: '10px 14px',
              textAlign: 'center',
            }}>
              <div style={{ color: s.color, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ color: s.color, fontSize: 8.5, fontWeight: 600, marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
              {/* Bimestre selector */}
              <div className="w-full mb-1">
                <p className="text-xs text-muted-foreground mb-1">Bimestre dos gráficos:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { value: 'auto', label: 'Automático' },
                    { value: '1', label: '1º Bim' },
                    { value: '2', label: '2º Bim' },
                    { value: '3', label: '3º Bim' },
                    { value: '4', label: '4º Bim' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedBimestre(opt.value)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-semibold border transition-colors',
                        selectedBimestre === opt.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-muted'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => printSection('print-dashboard-section')} className="gap-1.5 h-8 text-xs">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={!!generating}
                onClick={() => handleDownloadPNG(dashRef,
                  `graficos-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}-${activeBimestreData?.activeB?.bimestre}bim.png`)}
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
                  `graficos-${reportData.classData?.grade_year}-${reportData.classData?.class_letter}-${activeBimestreData?.activeB?.bimestre}bim.pdf`, false)}
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
              SECTION 2 — PROFESSIONAL DASHBOARD (charts)
          ════════════════════════════════════════════════ */}
          <div
            id="print-dashboard-section"
            className="print-section bg-white rounded-2xl overflow-hidden border border-border shadow-card"
            ref={dashRef}
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            {/* Professional header with logo + meta + stats */}
            <DashHeader />

            {/* Charts area */}
            <div style={{ padding: '20px 24px 0', background: '#f8fafc' }}>
              {/* Section title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 4, height: 22, background: '#0f2d55', borderRadius: 2 }} />
                <span style={{ color: '#0f2d55', fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>
                  Análise de Resultados — {activeBimestreData?.activeB?.bimestre}º Bimestre
                </span>
              </div>

              {/* 3-column chart grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: 16, marginBottom: 16 }}>

                {/* ── Writing Donut ── */}
                <div style={{ background: '#fff', border: '1px solid #dde6f0', borderRadius: 10, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,45,85,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: '#e8f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f2d55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </div>
                    <span style={{ color: '#0f2d55', fontSize: 12, fontWeight: 700 }}>Níveis de Escrita</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
                      {activeBimestreData?.writingChartData.map((item: any) => (
                        <div key={item.short} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 6, background: item.color + '15', border: `1px solid ${item.color}35` }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: item.color }}>{item.short}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{item.value}</span>
                          <span style={{ fontSize: 9, color: '#64748b' }}>{item.pct}%</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={activeBimestreData?.writingChartData.filter((d: any) => d.value > 0)} cx="50%" cy="50%"
                            innerRadius={38} outerRadius={72} dataKey="value" paddingAngle={2} labelLine={false}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                              if (percent < 0.05) return null;
                              const R = Math.PI / 180;
                              const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                              return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">{`${Math.round(percent * 100)}%`}</text>;
                            }}
                          >
                            {activeBimestreData?.writingChartData.filter((d: any) => d.value > 0).map((e: any, i: number) => (
                              <Cell key={i} fill={e.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct}%)`, p.payload.name]} contentStyle={{ fontSize: '10px', borderRadius: '6px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* ── Reading Donut ── */}
                <div style={{ background: '#fff', border: '1px solid #dde6f0', borderRadius: 10, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,45,85,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: '#e8f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f2d55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    </div>
                    <span style={{ color: '#0f2d55', fontSize: 12, fontWeight: 700 }}>Níveis de Leitura</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
                      {activeBimestreData?.readingChartData.map((item: any) => (
                        <div key={item.short} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 6, background: item.color + '15', border: `1px solid ${item.color}35` }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: item.color }}>{item.short}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{item.value}</span>
                          <span style={{ fontSize: 9, color: '#64748b' }}>{item.pct}%</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={activeBimestreData?.readingChartData.filter((d: any) => d.value > 0)} cx="50%" cy="50%"
                            innerRadius={38} outerRadius={72} dataKey="value" paddingAngle={2} labelLine={false}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                              if (percent < 0.05) return null;
                              const R = Math.PI / 180;
                              const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                              return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">{`${Math.round(percent * 100)}%`}</text>;
                            }}
                          >
                            {activeBimestreData?.readingChartData.filter((d: any) => d.value > 0).map((e: any, i: number) => (
                              <Cell key={i} fill={e.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct}%)`, p.payload.name]} contentStyle={{ fontSize: '10px', borderRadius: '6px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* ── Evolution Line Chart ── */}
                <div style={{ background: '#fff', border: '1px solid #dde6f0', borderRadius: 10, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,45,85,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: '#e8f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f2d55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                    </div>
                    <span style={{ color: '#0f2d55', fontSize: 12, fontWeight: 700 }}>Evolução da Alfabetização</span>
                  </div>
                  <ResponsiveContainer width="100%" height={195}>
                    <LineChart data={reportData.evolutionData} margin={{ top: 5, right: 14, left: -18, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        formatter={(v: any, n: any) => [`${v}%`, n]}
                        contentStyle={{ fontSize: '10px', borderRadius: '8px', border: '1px solid #dde6f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="Alfabético" stroke="#22c55e" strokeWidth={2.5}
                        dot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="Leu Texto" stroke="#3b82f6" strokeWidth={2.5}
                        dot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Legend + Footer ── */}
            <div style={{ padding: '14px 24px 20px', background: '#f8fafc', borderTop: '1px solid #dde6f0' }}>
              {/* Legend pills */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: '#4a6fa5', letterSpacing: 0.8, textTransform: 'uppercase', marginRight: 6 }}>Escrita:</span>
                  {[['PS','Pré-silábico','#fee2e2','#b91c1c'],['S','Silábico','#fef3c7','#92400e'],['SA','Sil.-Alfabético','#dbeafe','#1d4ed8'],['A','Alfabético','#dcfce7','#15803d']].map(([code,name,bg,color]) => (
                    <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 8 }}>
                      <span style={{ background: bg, color, fontSize: 8, fontWeight: 800, padding: '1px 4px', borderRadius: 3 }}>{code}</span>
                      <span style={{ fontSize: 8.5, color: '#475569' }}>{name}</span>
                    </span>
                  ))}
                </div>
                <div>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: '#4a6fa5', letterSpacing: 0.8, textTransform: 'uppercase', marginRight: 6 }}>Leitura:</span>
                  {[['NL','Não Leu','#fee2e2','#b91c1c'],['LP','Leu Palavras','#fef3c7','#92400e'],['LF','Leu Frases','#dbeafe','#1d4ed8'],['LT','Leu Texto','#dcfce7','#15803d']].map(([code,name,bg,color]) => (
                    <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 8 }}>
                      <span style={{ background: bg, color, fontSize: 8, fontWeight: 800, padding: '1px 4px', borderRadius: 3 }}>{code}</span>
                      <span style={{ fontSize: 8.5, color: '#475569' }}>{name}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid #c8d8ec', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 8, color: '#94a3b8' }}>
                  Documento gerado automaticamente pelo Sistema de Sondagem · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div style={{ display: 'flex', gap: 28 }}>
                  {['Professor(a)', 'Coordenador(a) Pedagógico(a)', 'Diretor(a)'].map(role => (
                    <div key={role} style={{ textAlign: 'center' }}>
                      <div style={{ borderBottom: '1.5px solid #0f2d55', marginBottom: 5, width: 120 }} />
                      <div style={{ fontSize: 8.5, color: '#0f2d55', fontWeight: 700 }}>{role}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
