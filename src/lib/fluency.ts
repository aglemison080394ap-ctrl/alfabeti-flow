export interface FluencyCounts {
  pl1: number;
  pl2: number;
  pl3: number;
  pl4: number;
  li: number;
  lf: number;
}

export interface FluencyResult extends FluencyCounts {
  total: number;
  matriculados: number;
  participacao: number;
  pPL1: number;
  pPL2: number;
  pPL3: number;
  pPL4: number;
  pLI: number;
  pLF: number;
  ifl: number;
  taxaLeitores: number;
  classification: string;
  classificationColor: string;
  predominante: string;
  diagnostico: string;
}

export const PROFILE_LABELS: Record<keyof FluencyCounts, string> = {
  pl1: 'Pré-Leitor 1',
  pl2: 'Pré-Leitor 2',
  pl3: 'Pré-Leitor 3',
  pl4: 'Pré-Leitor 4',
  li: 'Leitor Iniciante',
  lf: 'Leitor Fluente',
};

export const PROFILE_COLORS: Record<keyof FluencyCounts, string> = {
  pl1: '#dc2626',
  pl2: '#f97316',
  pl3: '#eab308',
  pl4: '#3b82f6',
  li: '#0ea5e9',
  lf: '#16a34a',
};

export function classifyIFL(ifl: number): { label: string; color: string } {
  if (ifl < 2) return { label: 'Situação Crítica', color: '#dc2626' };
  if (ifl < 4) return { label: 'Situação de Atenção', color: '#f97316' };
  if (ifl < 6) return { label: 'Situação Intermediária', color: '#eab308' };
  if (ifl < 8) return { label: 'Situação Adequada', color: '#3b82f6' };
  return { label: 'Situação Avançada', color: '#16a34a' };
}

export function calculateFluency(counts: FluencyCounts, matriculados = 0): FluencyResult {
  const { pl1, pl2, pl3, pl4, li, lf } = counts;
  const total = pl1 + pl2 + pl3 + pl4 + li + lf;
  const safe = total > 0 ? total : 1;
  const pPL1 = pl1 / safe;
  const pPL2 = pl2 / safe;
  const pPL3 = pl3 / safe;
  const pPL4 = pl4 / safe;
  const pLI = li / safe;
  const pLF = lf / safe;
  const ifl = total > 0
    ? pPL1 * 0 + pPL2 * 1 + pPL3 * 2.5 + pPL4 * 4 + pLI * 6 + pLF * 10
    : 0;
  const taxaLeitores = total > 0 ? ((li + lf) / total) * 100 : 0;
  const participacao = matriculados > 0 ? Math.min(100, (total / matriculados) * 100) : 0;
  const { label: classification, color: classificationColor } = classifyIFL(ifl);

  const entries: Array<[keyof FluencyCounts, number]> = [
    ['pl1', pl1], ['pl2', pl2], ['pl3', pl3], ['pl4', pl4], ['li', li], ['lf', lf],
  ];
  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const predominante = total > 0 ? PROFILE_LABELS[top[0]] : '—';

  const diagnostico = total === 0
    ? 'Informe a quantidade de estudantes em cada perfil para gerar o diagnóstico.'
    : `Foram avaliados ${total} estudante(s)${matriculados > 0 ? ` de ${matriculados} matriculado(s) (participação de ${participacao.toFixed(1)}%)` : ''}. ` +
      `O Índice de Fluência Leitora (IFL) obtido foi ${ifl.toFixed(2)}, classificado como ${classification}. ` +
      `A taxa de leitores corresponde a ${taxaLeitores.toFixed(1)}%. O perfil predominante da turma é ${predominante}. ` +
      (ifl < 4
        ? 'Recomenda-se intervenção pedagógica intensiva e individualizada, com foco em consciência fonológica e decodificação.'
        : ifl < 6
          ? 'Recomenda-se o fortalecimento das ações pedagógicas para avanço da fluência leitora, ampliando práticas de leitura compartilhada.'
          : ifl < 8
            ? 'Os resultados indicam bom desenvolvimento. Recomenda-se manter as ações e ampliar atividades de compreensão textual.'
            : 'Excelente desempenho. Recomenda-se desafiar a turma com leituras mais complexas e produção textual avançada.');

  return {
    pl1, pl2, pl3, pl4, li, lf,
    total,
    matriculados,
    participacao: Number(participacao.toFixed(2)),
    pPL1, pPL2, pPL3, pPL4, pLI, pLF,
    ifl: Number(ifl.toFixed(2)),
    taxaLeitores: Number(taxaLeitores.toFixed(2)),
    classification,
    classificationColor,
    predominante,
    diagnostico,
  };
}
