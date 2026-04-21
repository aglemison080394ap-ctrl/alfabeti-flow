import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

        // Build table body
        const body: any[] = [];
        // Writing section
        WRITING_ROWS.forEach((r, i) => {
          body.push([
            i === 0 ? { content: 'ESCRITA', rowSpan: WRITING_ROWS.length, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: [219, 234, 254] } } : null,
            r.tipo,
            r.sigla,
            String(writeCounts['1'][r.sigla] || 0),
            String(writeCounts['2'][r.sigla] || 0),
            String(writeCounts['3'][r.sigla] || 0),
            String(writeCounts['4'][r.sigla] || 0),
          ].filter(c => c !== null));
        });
        // Reading section
        READING_ROWS.forEach((r, i) => {
          body.push([
            i === 0 ? { content: 'LEITURA', rowSpan: READING_ROWS.length, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: [220, 252, 231] } } : null,
            r.tipo,
            r.sigla,
            String(readCounts['1'][r.sigla] || 0),
            String(readCounts['2'][r.sigla] || 0),
            String(readCounts['3'][r.sigla] || 0),
            String(readCounts['4'][r.sigla] || 0),
          ].filter(c => c !== null));
        });
        // Total row
        body.push([
          { content: 'Total avaliados', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [243, 244, 246] } },
          { content: String(assessedByBim['1'].size), styles: { fontStyle: 'bold', halign: 'center', fillColor: [243, 244, 246] } },
          { content: String(assessedByBim['2'].size), styles: { fontStyle: 'bold', halign: 'center', fillColor: [243, 244, 246] } },
          { content: String(assessedByBim['3'].size), styles: { fontStyle: 'bold', halign: 'center', fillColor: [243, 244, 246] } },
          { content: String(assessedByBim['4'].size), styles: { fontStyle: 'bold', halign: 'center', fillColor: [243, 244, 246] } },
        ]);

        autoTable(doc, {
          startY: tableStartY,
          head: [['Categoria', 'Tipo', 'Sigla', '1º Bim', '2º Bim', '3º Bim', '4º Bim']],
          body,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 1.5, halign: 'center' },
          headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 42, halign: 'left' },
            2: { cellWidth: 14 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 'auto' },
            6: { cellWidth: 'auto' },
          },
          margin: { left: 10, right: 10 },
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
