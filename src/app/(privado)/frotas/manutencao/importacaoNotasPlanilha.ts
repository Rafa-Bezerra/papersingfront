import {
  ArquivoImportacaoNotas,
  NotaPlanilha,
  STATUS_NOTA,
  TIPOS_NOTA,
} from '@/services/frotasService';

/** Colunas internas (API e JSON técnico). */
export const COLUNAS_IMPORTACAO_NOTAS = [
  'linha',
  'numero_nf',
  'tipo_nota',
  'pedido',
  'data_entrada',
  'data_emissao',
  'data_vencimento',
  'valor_total',
  'fornecedor_planilha',
  'responsavel',
  'status',
  'motivo_status',
  'classificacao',
  'servico',
  'placas',
  'descricao',
  'observacao',
] as const;

type ChaveColuna = (typeof COLUNAS_IMPORTACAO_NOTAS)[number];

/** Cabeçalhos do modelo para o Excel (mesma ordem do JSON importar-notas-WAY-xxx). */
const COLUNAS_MODELO: { chave: ChaveColuna; rotulo: string }[] = [
  { chave: 'linha', rotulo: 'Linha' },
  { chave: 'numero_nf', rotulo: 'Nº NF' },
  { chave: 'tipo_nota', rotulo: 'Tipo (SERVICO ou PRODUTO)' },
  { chave: 'pedido', rotulo: 'Nº pedido' },
  { chave: 'data_entrada', rotulo: 'Data entrada' },
  { chave: 'data_emissao', rotulo: 'Data emissão NF' },
  { chave: 'data_vencimento', rotulo: 'Data vencimento' },
  { chave: 'valor_total', rotulo: 'Valor total' },
  { chave: 'fornecedor_planilha', rotulo: 'Fornecedor (nome na planilha)' },
  { chave: 'responsavel', rotulo: 'Responsável' },
  { chave: 'status', rotulo: 'Status' },
  { chave: 'motivo_status', rotulo: 'Motivo do status' },
  { chave: 'classificacao', rotulo: 'Classificação' },
  { chave: 'servico', rotulo: 'Serviço' },
  { chave: 'placas', rotulo: 'Placas' },
  { chave: 'descricao', rotulo: 'Descrição do item' },
  { chave: 'observacao', rotulo: 'Observação' },
];

const SEP = ';';

function normalizarCabecalho(h: string): string {
  return h
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ALIAS_CABECALHO: Record<string, ChaveColuna> = {
  'no nf': 'numero_nf',
  'numero nf': 'numero_nf',
  'n nf': 'numero_nf',
  fornecedor: 'fornecedor_planilha',
  'fornecedor nome na planilha': 'fornecedor_planilha',
  'no pedido': 'pedido',
  'numero pedido': 'pedido',
  'data emissao': 'data_emissao',
  'data emissao nf': 'data_emissao',
  'descricao do item': 'descricao',
  'motivo do status': 'motivo_status',
  'tipo servico ou produto': 'tipo_nota',
};

function chaveDaColuna(cabecalho: string): ChaveColuna | null {
  const n = normalizarCabecalho(cabecalho);
  if (!n) return null;
  for (const c of COLUNAS_MODELO) {
    if (normalizarCabecalho(c.chave) === n || normalizarCabecalho(c.rotulo) === n) return c.chave;
  }
  return ALIAS_CABECALHO[n] ?? null;
}

function parseCsvLinha(linha: string): string[] {
  const out: string[] = [];
  let cur = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') aspas = false;
      else cur += c;
    } else if (c === '"') aspas = true;
    else if (c === SEP) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseNumero(v: string): number | null {
  const t = v.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseData(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function parsePlacas(v: string): string[] {
  if (!v.trim()) return [];
  return v
    .split(/[;,|]/)
    .map((p) => p.trim().replace(/[\s-]/g, '').toUpperCase())
    .filter(Boolean);
}

function baixarTexto(nome: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Linhas de exemplo no mesmo formato da planilha histórica (Controle de NFs e pedidos). */
function linhasExemploModelo(): Record<ChaveColuna, string>[] {
  return [
    {
      linha: '1',
      numero_nf: '8015971',
      tipo_nota: '',
      pedido: '1178',
      data_entrada: '16/02/2026',
      data_emissao: '09/03/2026',
      data_vencimento: '18/03/2026',
      valor_total: '3918,97',
      fornecedor_planilha: 'Movida Participações S.A. / UAS3E19',
      responsavel: '',
      status: 'CONCLUIDA',
      motivo_status: '',
      classificacao: '',
      servico: '',
      placas: '',
      descricao: '',
      observacao: '',
    },
    {
      linha: '2',
      numero_nf: '24255',
      tipo_nota: 'PRODUTO',
      pedido: '1995',
      data_entrada: '03/08/2026',
      data_emissao: '03/08/2026',
      data_vencimento: '13/08/2026',
      valor_total: '546,00',
      fornecedor_planilha: 'BORRACHAS E PLASTICOS UBERABA LTDA',
      responsavel: 'Luis',
      status: 'CONCLUIDA',
      motivo_status: '',
      classificacao: 'COMPRA_EMERGENCIAL',
      servico: 'OUTRO',
      placas: 'ABC1D23',
      descricao: 'Lencol de borracha — exemplo com placa e classificação',
      observacao: '',
    },
    {
      linha: '3',
      numero_nf: '69238397',
      tipo_nota: '',
      pedido: '',
      data_entrada: '26/01/2026',
      data_emissao: '',
      data_vencimento: '25/02/2026',
      valor_total: '12727,15',
      fornecedor_planilha: 'TICKET SOLUCOES HDFGT S.A (MEDIÇÃO)',
      responsavel: '',
      status: 'LANCADA',
      motivo_status: '',
      classificacao: '',
      servico: '',
      placas: '',
      descricao: '',
      observacao: 'Nota só cabeçalho — itens podem vir depois do pedido RM',
    },
  ];
}

/**
 * Gera planilha Excel (.xls) só com cabeçalho + exemplos (sem linhas de comentário).
 * Ao importar, salve como CSV UTF-8 com separador ; ou use o JSON técnico.
 */
export function baixarModeloImportacaoNotas(unidade: string) {
  const slug = unidade.replace(/\s+/g, '-');
  const exemplos = linhasExemploModelo();
  const rotulos = COLUNAS_MODELO.map((c) => c.rotulo);

  const statusRotulos = STATUS_NOTA.map((s) => `${s.valor} (${s.rotulo})`).join(', ');
  const tiposRotulos = TIPOS_NOTA.map((t) => t.valor).join(' ou ');

  const linhasTabela = exemplos
    .map((ex) => {
      const tds = COLUNAS_MODELO.map((c) => `<td>${escHtml(ex[c.chave] ?? '')}</td>`).join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  const ths = rotulos.map((r) => `<th>${escHtml(r)}</th>`).join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/>
<style>
  table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  th { background: #4472C4; color: #fff; font-weight: bold; text-align: left; padding: 6px 8px; border: 1px solid #2F5597; white-space: nowrap; }
  td { padding: 4px 8px; border: 1px solid #D9D9D9; vertical-align: top; }
  .meta { font-size: 10pt; color: #404040; margin-bottom: 8px; max-width: 900px; line-height: 1.4; }
</style></head>
<body>
<p class="meta"><strong>Controle de NFs e pedidos — ${escHtml(unidade)}</strong><br/>
Uma linha por nota. Não apague nem renomeie a linha azul (cabeçalho).<br/>
<strong>Linha:</strong> número único (não repetir; linhas já importadas são ignoradas).<br/>
<strong>Fornecedor:</strong> texto como na planilha antiga; o sistema casa com o RM (FCFO).<br/>
<strong>Status:</strong> ${escHtml(statusRotulos)}.<br/>
<strong>Tipo:</strong> ${escHtml(tiposRotulos)} ou vazio.<br/>
<strong>Classificação + placas + valor:</strong> se preencher os três, cria itens por placa (placas separadas por ;).<br/>
<strong>Datas:</strong> DD/MM/AAAA. <strong>Valor:</strong> vírgula decimal (ex.: 1500,50).<br/>
Para importar no Frotas: apague estas linhas de texto e as linhas de exemplo, preencha suas notas e <em>Salvar como → CSV UTF-8 (delimitado por ponto e vírgula)</em>.</p>
<table>
<thead><tr>${ths}</tr></thead>
<tbody>${linhasTabela}</tbody>
</table>
</body></html>`;

  baixarTexto(`modelo-controle-nfs-pedidos-${slug}.xls`, `\uFEFF${html}`, 'application/vnd.ms-excel;charset=utf-8');
}

function csvParaArquivo(texto: string, unidade: string): ArquivoImportacaoNotas {
  const linhas = texto
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith('#') && !/^sep\s*=/i.test(t);
    });
  if (linhas.length < 2) throw new Error('O CSV está vazio ou só tem cabeçalho.');

  const cab = parseCsvLinha(linhas[0]);
  const colMap = new Map<ChaveColuna, number>();
  cab.forEach((h, i) => {
    const chave = chaveDaColuna(h);
    if (chave) colMap.set(chave, i);
  });
  if (!colMap.has('linha') || !colMap.has('numero_nf')) {
    throw new Error(
      'Cabeçalho não reconhecido. Use o modelo baixado na tela (colunas Linha e Nº NF) ou salve o Excel como CSV com separador ;.'
    );
  }

  const notas: NotaPlanilha[] = [];
  for (let r = 1; r < linhas.length; r++) {
    const cols = parseCsvLinha(linhas[r]);
    if (cols.every((c) => !c)) continue;
    const get = (nome: ChaveColuna) => cols[colMap.get(nome) ?? -1] ?? '';

    const linhaStr = get('linha');
    const linha = linhaStr ? Number(linhaStr.replace(/\D/g, '')) : r;
    if (!Number.isFinite(linha) || linha <= 0) throw new Error(`Linha ${r + 1}: coluna "Linha" inválida.`);

    const valor = parseNumero(get('valor_total'));
    const entrada = parseData(get('data_entrada'));
    const emissao = parseData(get('data_emissao'));
    const venc = parseData(get('data_vencimento'));

    notas.push({
      linha,
      numero_nf: get('numero_nf') || 'S/N',
      tipo_nota: get('tipo_nota') || null,
      pedido: get('pedido') || null,
      data_entrada: entrada,
      data_emissao: emissao,
      data_vencimento: venc,
      valor_total: valor,
      fornecedor_planilha: get('fornecedor_planilha') || null,
      responsavel: get('responsavel') || null,
      status: get('status') || null,
      motivo_status: get('motivo_status') || null,
      classificacao: get('classificacao') || null,
      servico: get('servico') || null,
      descricao: get('descricao') || null,
      placas: parsePlacas(get('placas')),
      observacao: get('observacao') || null,
    });
  }

  if (notas.length === 0) throw new Error('Nenhuma linha de nota no CSV.');
  return {
    unidade,
    origem: 'MODELO CSV',
    gerado_em: new Date().toISOString().slice(0, 10),
    notas,
  };
}

/** Lê JSON (formato do sistema) ou CSV (modelo baixado na tela). */
export function parseArquivoImportacaoNotas(conteudo: string, nomeArquivo: string, unidade: string): ArquivoImportacaoNotas {
  const lower = nomeArquivo.toLowerCase();
  if (lower.endsWith('.csv')) return csvParaArquivo(conteudo, unidade);

  const dados = JSON.parse(conteudo) as ArquivoImportacaoNotas;
  if (!Array.isArray(dados.notas)) throw new Error('Arquivo sem a lista de notas.');
  return dados;
}
