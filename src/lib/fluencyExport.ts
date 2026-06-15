import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FluencyResult, PROFILE_LABELS } from './fluency';

export interface ExportContext {
  teacher: string;
  className: string;
  school: string;
  schoolYear: number;
  date?: string;
}

export async function exportFluencyPDF(elementId: string, ctx: ExportContext) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW - 20;
  const imgH = (canvas.height * imgW) / canvas.width;

  // Header
  pdf.setFillColor(15, 45, 85);
  pdf.rect(0, 0, pageW, 22, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Relatório de Fluência Leitora (IFL)', pageW / 2, 10, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${ctx.school} — ${ctx.className} — Prof. ${ctx.teacher} — ${ctx.schoolYear}`, pageW / 2, 17, { align: 'center' });

  let y = 26;
  if (imgH < pageH - y - 10) {
    pdf.addImage(img, 'PNG', 10, y, imgW, imgH);
  } else {
    // paginate
    let position = 0;
    const ratio = imgW / canvas.width;
    const sliceH = (pageH - y - 10) / ratio;
    while (position < canvas.height) {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.min(sliceH, canvas.height - position);
      const ctx2 = sliceCanvas.getContext('2d');
      if (ctx2) {
        ctx2.fillStyle = '#fff';
        ctx2.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx2.drawImage(canvas, 0, position, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        const sImg = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sImg, 'PNG', 10, y, imgW, sliceCanvas.height * ratio);
      }
      position += sliceH;
      if (position < canvas.height) { pdf.addPage(); y = 10; }
    }
  }
  pdf.save(`Fluencia_${ctx.className.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

export function exportFluencyExcel(ctx: ExportContext, r: FluencyResult) {
  const wb = XLSX.utils.book_new();
  const info = [
    ['RELATÓRIO DE FLUÊNCIA LEITORA (IFL)'],
    [],
    ['Escola', ctx.school],
    ['Professor', ctx.teacher],
    ['Turma', ctx.className],
    ['Ano Letivo', ctx.schoolYear],
    ['Data', ctx.date || new Date().toLocaleString('pt-BR')],
    [],
    ['Perfil', 'Quantidade', 'Percentual'],
    [PROFILE_LABELS.pl1, r.pl1, `${(r.pPL1 * 100).toFixed(1)}%`],
    [PROFILE_LABELS.pl2, r.pl2, `${(r.pPL2 * 100).toFixed(1)}%`],
    [PROFILE_LABELS.pl3, r.pl3, `${(r.pPL3 * 100).toFixed(1)}%`],
    [PROFILE_LABELS.pl4, r.pl4, `${(r.pPL4 * 100).toFixed(1)}%`],
    [PROFILE_LABELS.li, r.li, `${(r.pLI * 100).toFixed(1)}%`],
    [PROFILE_LABELS.lf, r.lf, `${(r.pLF * 100).toFixed(1)}%`],
    ['TOTAL', r.total, '100%'],
    [],
    ['Taxa de Leitores', `${r.taxaLeitores.toFixed(2)}%`],
    ['Índice de Fluência Leitora (IFL)', r.ifl.toFixed(2)],
    ['Classificação', r.classification],
    ['Perfil Predominante', r.predominante],
    [],
    ['Diagnóstico', r.diagnostico],
  ];
  const ws = XLSX.utils.aoa_to_sheet(info);
  ws['!cols'] = [{ wch: 38 }, { wch: 20 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Fluência');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf]), `Fluencia_${ctx.className.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
}

export function exportGeneralExcel(rows: any[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Geral');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf]), `Fluencia_Geral_${Date.now()}.xlsx`);
}
