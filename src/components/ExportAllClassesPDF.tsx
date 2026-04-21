import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Institutional navy — slightly darker than the softened version, but lighter than the original
const INSTITUTIONAL: [number, number, number] = [36, 73, 125];        // deeper navy blue
const INSTITUTIONAL_SOFT: [number, number, number] = [226, 235, 247]; // very light blue tint
const INSTITUTIONAL_TEXT: [number, number, number] = [22, 48, 90];    // readable on soft tint

// Institutional level colors (light tints for cell fill, dark for sigla badge)
// Red (PS/NL), Yellow (S/LP), Blue (SA/LF), Green (A/LT)
const LEVEL_COLORS: Record<string, { fill: [number, number, number]; sigla: [number, number, number]; text: [number, number, number] }> = {
  PS: { fill: [254, 226, 226], sigla: [220, 38, 38],  text: [127, 29, 29]  },
  S:  { fill: [254, 243, 199], sigla: [217, 119, 6],  text: [120, 53, 15]  },
  SA: { fill: [219, 234, 254], sigla: [37, 99, 235],  text: [30, 58, 138]  },
  A:  { fill: [220, 252, 231], sigla: [22, 163, 74],  text: [20, 83, 45]   },
  NL: { fill: [254, 226, 226], sigla: [220, 38, 38],  text: [127, 29, 29]  },
  LP: { fill: [254, 243, 199], sigla: [217, 119, 6],  text: [120, 53, 15]  },
  LF: { fill: [219, 234, 254], sigla: [37, 99, 235],  text: [30, 58, 138]  },
  LT: { fill: [220, 252, 231], sigla: [22, 163, 74],  text: [20, 83, 45]   },
};

const WRITING_ROWS: { sigla: 'PS' | 'S' | 'SA' | 'A'; tipo: string }[] = [
  { sigla: 'PS', tipo: 'Pré-silábico' },
  { sigla: 'S',  tipo: 'Silábico' },
  { sigla: 'SA', tipo: 'Silábico-Alfabético' },
  { sigla: 'A',  tipo: 'Alfabético' },
];

const READING_ROWS: { sigla: 'NL' | 'LP' | 'LF' | 'LT'; tipo: string }[] = [
  { sigla: 'NL', tipo: 'Não Leu' },
  { sigla: 'LP', tipo: 'Leu Palavras' },
  { sigla: 'LF', tipo: 'Leu Frases' },
  { sigla: 'LT', tipo: 'Leu Texto' },
];

const BIMESTRES = ['1', '2', '3', '4'] as const;

// Approx height of one class block in mm (header + table). Used to decide page breaks.
const BLOCK_HEIGHT_MM = 88;
const PAGE_TOP_MM = 14;
const PAGE_BOTTOM_MM = 14;
const PAGE_HEIGHT_A4 = 297;

const ExportAllClassesPDF: React.FC = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Hard guard — never render for non-admins
  if (!isAdmin) return null;

  const handleExport = async () => {
    setLoading(true);
    try {
      // Backend permission check (defense in depth)
      const { data: isAdminData, error: rpcErr } = await supabase.rpc('is_admin');
      if (rpcErr || !isAdminData) {
        toast({
          title: 'Acesso negado',
          description: 'Apenas administradores podem exportar este relatório.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Fetch school info
      const { data: schoolInfo } = await supabase
        .from('school_info')
        .select('name')
        .maybeSingle();
      const schoolName = schoolInfo?.name || 'Escola Municipal';

      // Fetch all classes + teacher
      const { data: classes } = await supabase
        .from('classes')
        .select('id, grade_year, class_letter, school_year, teacher_id')
        .order('grade_year')
        .order('class_letter');

      if (!classes || classes.length === 0) {
        toast({ title: 'Nenhuma turma encontrada', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Fetch teachers (name) for mapping
      const teacherIds = Array.from(
        new Set(classes.map(c => c.teacher_id).filter(Boolean))
      ) as string[];
      const teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from('teachers')
          .select('id, name')
          .in('id', teacherIds);
        teachers?.forEach(t => { teacherMap[t.id] = t.name; });
      }

      // Fetch students for all classes
      const classIds = classes.map(c => c.id);
      const { data: students } = await supabase
        .from('students')
        .select('id, class_id')
        .in('class_id', classIds)
        .limit(5000);

      const studentsByClass: Record<string, string[]> = {};
      students?.forEach(s => {
        if (!studentsByClass[s.class_id]) studentsByClass[s.class_id] = [];
        studentsByClass[s.class_id].push(s.id);
      });

      // Fetch all assessments in batches
      const studentIds = students?.map(s => s.id) ?? [];
      const allAssessments: { student_id: string; bimestre: string; writing_level: string | null; reading_level: string | null }[] = [];
      const BATCH = 250;
      for (let i = 0; i < studentIds.length; i += BATCH) {
        const chunk = studentIds.slice(i, i + BATCH);
        const { data } = await supabase
          .from('assessments')
          .select('student_id, bimestre, writing_level, reading_level')
          .in('student_id', chunk)
          .limit(1000);
        if (data) allAssessments.push(...data);
      }

      // Index assessments by student+bimestre (latest wins)
      const assessIdx: Record<string, { writing_level: string | null; reading_level: string | null }> = {};
      allAssessments.forEach(a => {
        assessIdx[`${a.student_id}|${a.bimestre}`] = {
          writing_level: a.writing_level,
          reading_level: a.reading_level,
        };
      });

      // Build PDF
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let cursorY = PAGE_TOP_MM;
      let firstPage = true;

      // Document title (only once at top)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('SÍNTESE DA SONDAGEM — TODAS AS TURMAS', pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(schoolName, pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 6;

      classes.forEach((cls, idx) => {
        // Page break if not enough room
        if (cursorY + BLOCK_HEIGHT_MM > PAGE_HEIGHT_A4 - PAGE_BOTTOM_MM) {
          doc.addPage();
          cursorY = PAGE_TOP_MM;
          firstPage = false;
        }

        const teacherName = cls.teacher_id ? (teacherMap[cls.teacher_id] || '—') : '—';
        const classStudentIds = studentsByClass[cls.id] || [];

        // Compute counts per bimestre
        const writeCounts: Record<string, Record<string, number>> = { '1': {}, '2': {}, '3': {}, '4': {} };
        const readCounts: Record<string, Record<string, number>> = { '1': {}, '2': {}, '3': {}, '4': {} };
        const assessedByBim: Record<string, Set<string>> = { '1': new Set(), '2': new Set(), '3': new Set(), '4': new Set() };

        WRITING_ROWS.forEach(r => BIMESTRES.forEach(b => { writeCounts[b][r.sigla] = 0; }));
        READING_ROWS.forEach(r => BIMESTRES.forEach(b => { readCounts[b][r.sigla] = 0; }));

        classStudentIds.forEach(sid => {
          BIMESTRES.forEach(b => {
            const a = assessIdx[`${sid}|${b}`];
            if (!a) return;
            if (a.writing_level || a.reading_level) assessedByBim[b].add(sid);
            if (a.writing_level && writeCounts[b][a.writing_level] !== undefined) {
              writeCounts[b][a.writing_level]++;
            }
            if (a.reading_level && readCounts[b][a.reading_level] !== undefined) {
              readCounts[b][a.reading_level]++;
            }
          });
        });

        // Header block
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${cls.grade_year} — Turma ${cls.class_letter}`, 10, cursorY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Escola: ${schoolName}`, 10, cursorY + 4);
        doc.text(`Professor(a): ${teacherName}`, 10, cursorY + 8);
        doc.text(`Ano Letivo: ${cls.school_year}`, pageWidth - 10, cursorY + 4, { align: 'right' });
        doc.text(`Total de alunos: ${classStudentIds.length}`, pageWidth - 10, cursorY + 8, { align: 'right' });

        const tableStartY = cursorY + 11;

        // Build table body — each level row tinted with its institutional color
        const body: any[] = [];

        const buildLevelRow = (
          category: 'ESCRITA' | 'LEITURA',
          isFirst: boolean,
          rowSpan: number,
          sigla: string,
          tipo: string,
          counts: Record<string, number>,
        ) => {
          const c = LEVEL_COLORS[sigla];
          const tint = c.fill;
          const dark = c.sigla;
          const txt = c.text;
          const cells: any[] = [];
          if (isFirst) {
            cells.push({
              content: category,
              rowSpan,
              styles: {
                valign: 'middle',
                halign: 'center',
                fontStyle: 'bold',
                fillColor: INSTITUTIONAL,
                textColor: 255,
                fontSize: 9,
                cellPadding: { top: 2, right: 2, bottom: 2, left: 6 },
              },
            });
          }
          cells.push({ content: tipo,  styles: { halign: 'left',  fillColor: tint, textColor: txt, fontStyle: 'bold' } });
          cells.push({ content: sigla, styles: { halign: 'center', fillColor: dark, textColor: 255, fontStyle: 'bold' } });
          (['1','2','3','4'] as const).forEach(b => {
            cells.push({ content: String(counts[b] || 0), styles: { halign: 'center', fillColor: tint, textColor: txt, fontStyle: 'bold' } });
          });
          return cells;
        };

        WRITING_ROWS.forEach((r, i) => {
          body.push(buildLevelRow('ESCRITA', i === 0, WRITING_ROWS.length, r.sigla, r.tipo, {
            '1': writeCounts['1'][r.sigla], '2': writeCounts['2'][r.sigla],
            '3': writeCounts['3'][r.sigla], '4': writeCounts['4'][r.sigla],
          }));
        });
        READING_ROWS.forEach((r, i) => {
          body.push(buildLevelRow('LEITURA', i === 0, READING_ROWS.length, r.sigla, r.tipo, {
            '1': readCounts['1'][r.sigla], '2': readCounts['2'][r.sigla],
            '3': readCounts['3'][r.sigla], '4': readCounts['4'][r.sigla],
          }));
        });

        // Total row
        body.push([
          { content: 'Total de alunos avaliados', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: INSTITUTIONAL, textColor: 255 } },
          { content: String(assessedByBim['1'].size), styles: { fontStyle: 'bold', halign: 'center', fillColor: INSTITUTIONAL_SOFT, textColor: INSTITUTIONAL_TEXT } },
          { content: String(assessedByBim['2'].size), styles: { fontStyle: 'bold', halign: 'center', fillColor: INSTITUTIONAL_SOFT, textColor: INSTITUTIONAL_TEXT } },
          { content: String(assessedByBim['3'].size), styles: { fontStyle: 'bold', halign: 'center', fillColor: INSTITUTIONAL_SOFT, textColor: INSTITUTIONAL_TEXT } },
          { content: String(assessedByBim['4'].size), styles: { fontStyle: 'bold', halign: 'center', fillColor: INSTITUTIONAL_SOFT, textColor: INSTITUTIONAL_TEXT } },
        ]);

        // Helpers to draw small white vector icons inside the Categoria cell
        const drawPencil = (cx: number, cy: number) => {
          doc.setDrawColor(255, 255, 255);
          doc.setFillColor(255, 255, 255);
          doc.setLineWidth(0.5);
          // Pencil shaft (diagonal)
          doc.line(cx - 1.8, cy + 1.8, cx + 1.4, cy - 1.4);
          doc.line(cx - 1.4, cy + 2.2, cx + 1.8, cy - 1.0);
          // Tip
          doc.triangle(cx + 1.4, cy - 1.4, cx + 1.8, cy - 1.0, cx + 2.5, cy - 2.1, 'F');
          // Eraser end
          doc.circle(cx - 1.8, cy + 2.0, 0.55, 'F');
        };
        const drawBook = (cx: number, cy: number) => {
          doc.setDrawColor(255, 255, 255);
          doc.setFillColor(255, 255, 255);
          doc.setLineWidth(0.5);
          // Two pages
          doc.rect(cx - 2.4, cy - 1.8, 2.2, 3.6, 'S');
          doc.rect(cx + 0.2, cy - 1.8, 2.2, 3.6, 'S');
          // Page lines
          doc.setLineWidth(0.25);
          doc.line(cx - 2.0, cy - 0.7, cx - 0.6, cy - 0.7);
          doc.line(cx - 2.0, cy + 0.2, cx - 0.6, cy + 0.2);
          doc.line(cx + 0.6, cy - 0.7, cx + 2.0, cy - 0.7);
          doc.line(cx + 0.6, cy + 0.2, cx + 2.0, cy + 0.2);
        };

        autoTable(doc, {
          startY: tableStartY,
          head: [['Categoria', 'Tipo', 'Sigla', '1º Bim', '2º Bim', '3º Bim', '4º Bim']],
          body,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2, halign: 'center', lineColor: [226, 232, 240], lineWidth: 0.1, textColor: [40, 50, 70] },
          headStyles: { fillColor: INSTITUTIONAL, textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'center', cellPadding: 2.5 },
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: 42, halign: 'left' },
            2: { cellWidth: 14 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 'auto' },
            6: { cellWidth: 'auto' },
          },
          margin: { left: 10, right: 10 },
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0 && data.cell.raw && (data.cell.raw as any).rowSpan) {
              const txt = String((data.cell.raw as any).content || '');
              const { x, y, height } = data.cell;
              const iconX = x + 4.5;
              const iconY = y + height / 2;
              if (txt === 'ESCRITA') drawPencil(iconX, iconY);
              else if (txt === 'LEITURA') drawBook(iconX, iconY);
            }
          },
        });

        const finalY = (doc as any).lastAutoTable.finalY ?? tableStartY + 60;
        cursorY = finalY + 6;
      });

      // Footer page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120);
        doc.text(
          `Página ${i} de ${pageCount} • Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
          pageWidth / 2,
          PAGE_HEIGHT_A4 - 6,
          { align: 'center' }
        );
        doc.setTextColor(0);
      }

      const fname = `sintese-sondagem-todas-turmas-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fname);

      toast({ title: 'PDF gerado com sucesso', description: `${classes.length} turma(s) exportada(s).` });
    } catch (err: any) {
      console.error('Export error:', err);
      toast({ title: 'Erro ao gerar PDF', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 rounded-lg"
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      {loading ? 'Gerando PDF...' : 'Exportar PDF (Todas as Turmas)'}
    </Button>
  );
};

export default ExportAllClassesPDF;
