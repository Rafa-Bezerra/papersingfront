'use client';

import React, { useEffect, useState } from 'react';
import { Download, Eye, FileDown, Loader2, Upload, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CorPdf, KpiPdf, SecaoPdf } from '@/lib/frotasDashboardPdf';
import { FrotaPlaca, listarPlacas, unidadeDaSessao, UNIDADES_FROTAS } from '@/services/frotasService';

/** Unidade da tela: a da sessão; só a WAY CSC pode trocar (mesma regra da API). */
export function useUnidadeFrotas() {
  const [unidade, setUnidade] = useState('');
  const [podeTrocarUnidade, setPodeTrocarUnidade] = useState(false);
  useEffect(() => {
    const propria = unidadeDaSessao();
    setPodeTrocarUnidade(propria === 'WAY CSC');
    setUnidade((UNIDADES_FROTAS as readonly string[]).includes(propria) ? propria : '');
  }, []);
  return { unidade, setUnidade, podeTrocarUnidade };
}

/** Nome do usuário logado (vai no rodapé "gerado por" dos PDFs). */
export function nomeDaSessao(): string {
  try {
    const u = JSON.parse(sessionStorage.getItem('userData') ?? '{}') as Record<string, unknown>;
    return String(u.nome ?? u.NOME ?? u.codusuario ?? '').trim();
  } catch {
    return '';
  }
}

export const COR_PDF: Record<'muted' | 'perigo' | 'alerta' | 'ok', CorPdf> = {
  muted: [100, 116, 139],
  perigo: [185, 28, 28],
  alerta: [180, 83, 9],
  ok: [22, 163, 74],
};

export function textoPeriodo(de: string, ate: string) {
  return `${de ? dataIsoBr(de) : 'início'} a ${ate ? dataIsoBr(ate) : 'hoje'}`;
}

function dataIsoBr(v: string) {
  const [a, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** "Placa: X · Situação: Y" com os filtros preenchidos, ou "sem filtros". */
export function textoFiltros(filtros: [string, string | false | null | undefined][]) {
  const ativos = filtros.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  return ativos.length ? `Filtros: ${ativos.join(' · ')}` : 'Sem filtros';
}

export type RelatorioFrotaPdf = {
  titulo: string;
  subtitulo: string;
  unidade: string;
  periodo: string;
  kpis: KpiPdf[];
  secoes: SecaoPdf[];
  arquivo: string;
};

/** Gera o PDF do que está na tela; o conteúdo só é montado no clique (respeita os filtros do momento). */
export function BotaoPdf({ montar, disabled, rotulo = 'Gerar PDF' }: {
  montar: () => RelatorioFrotaPdf;
  disabled?: boolean;
  rotulo?: string;
}) {
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    try {
      const [{ gerarPdfDetalheFrota }, { salvarPdf, slugArquivo }] = await Promise.all([
        import('@/lib/frotasDashboardPdf'),
        import('@/lib/usuarioPermissoesRelatorioPdf'),
      ]);
      const r = montar();
      const doc = gerarPdfDetalheFrota({ ...r, geradoPor: nomeDaSessao() });
      await salvarPdf(doc, slugArquivo(r.arquivo));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar o PDF.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={() => void gerar()} disabled={disabled || gerando}>
      {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
      {rotulo}
    </Button>
  );
}

const TONS_INDICADOR = {
  azul: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  ambar: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  laranja: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  roxo: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  vermelho: 'bg-red-500/15 text-red-600 dark:text-red-400',
  verde: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  cinza: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
} as const;
export type TomIndicador = keyof typeof TONS_INDICADOR;

/** Quadro de indicador no padrão do Dashboard; com onClick vira filtro (ativo = filtro aplicado). */
export function CartaoIndicador({ icone: Icone, tom = 'cinza', rotulo, valor, detalhe, corValor = '', ativo, destaque, onClick }: {
  icone: LucideIcon;
  tom?: TomIndicador;
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  corValor?: string;
  ativo?: boolean;
  destaque?: boolean;
  onClick?: () => void;
}) {
  const classe = `flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
    destaque ? 'border-primary/40 bg-primary/5' : 'bg-card'
  } ${onClick ? 'hover:bg-muted/50' : ''} ${ativo ? 'ring-2 ring-primary' : ''}`;
  const conteudo = (
    <>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONS_INDICADOR[tom]}`}>
          <Icone className="h-4 w-4" />
        </span>
        <p className="text-xs leading-tight text-muted-foreground">{rotulo}</p>
      </div>
      <p className={`text-xl font-bold tabular-nums ${corValor}`}>{valor}</p>
      {detalhe && <p className="line-clamp-2 text-xs text-muted-foreground">{detalhe}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={classe}>
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** Placas da unidade (para sugerir no formulário e filtrar). */
export function usePlacasFrota(unidade: string) {
  const [placas, setPlacas] = useState<FrotaPlaca[]>([]);
  useEffect(() => {
    if (!unidade) return;
    listarPlacas(unidade)
      .then(setPlacas)
      .catch(() => setPlacas([]));
  }, [unidade]);
  return placas;
}

export function SeletorUnidade({ unidade, setUnidade, podeTrocarUnidade }: ReturnType<typeof useUnidadeFrotas>) {
  return (
    <div className="w-48 space-y-1">
      <Label>Unidade</Label>
      {podeTrocarUnidade ? (
        <Select value={unidade} onValueChange={setUnidade}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            {UNIDADES_FROTAS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="h-9 rounded-md border px-3 flex items-center text-sm">{unidade || '—'}</div>
      )}
    </div>
  );
}

export function isoHoje(deslocDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + deslocDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function inicioDoAno() {
  return `${new Date().getFullYear()}-01-01`;
}

export function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "1.234,56" ou "1234.56" → "1234.56" (formato que a API lê); vazio se não for número. */
export function valorParaApi(texto: string): string {
  let t = texto.replace(/R\$|\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n.toFixed(2) : '';
}

/** 1234.5 → "1.234,50" para preencher o campo na edição. */
export function valorParaCampo(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** true/false/null da API → "SIM" | "NAO" | "" do formulário. */
export function simNaoCampo(v?: boolean | null) {
  return v == null ? '' : v ? 'SIM' : 'NAO';
}

export function rotuloSimNao(v?: boolean | null) {
  return v == null ? '—' : v ? 'Sim' : 'Não';
}

const SEM_RESPOSTA = '-';

/** Sim / Não / Não informado; `extras` acrescenta opções (ex.: seguro de terceiros). */
export function SelectSimNao({ valor, onChange, disabled, extras = [] }: {
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  extras?: { valor: string; rotulo: string }[];
}) {
  return (
    <Select value={valor || SEM_RESPOSTA} onValueChange={(v) => onChange(v === SEM_RESPOSTA ? '' : v)} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SEM_RESPOSTA}>Não informado</SelectItem>
        <SelectItem value="SIM">Sim</SelectItem>
        <SelectItem value="NAO">Não</SelectItem>
        {extras.map((x) => (
          <SelectItem key={x.valor} value={x.valor}>
            {x.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FiltroPeriodo({ de, ate, setDe, setAte, rotulo }: {
  de: string;
  ate: string;
  setDe: (v: string) => void;
  setAte: (v: string) => void;
  rotulo: string;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label>{rotulo} de</Label>
        <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
      </div>
      <div className="space-y-1">
        <Label>até</Label>
        <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
      </div>
    </>
  );
}

/** Visualizar/baixar um anexo; os dois acessos ficam no histórico (API). */
export function BotoesAnexo({ nome, abrir, baixar }: {
  nome?: string | null;
  abrir: () => Promise<void>;
  baixar: () => Promise<void>;
}) {
  if (!nome) return <span className="text-muted-foreground">—</span>;
  const falha = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao abrir o anexo.');
  return (
    <div className="flex items-center">
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={`Visualizar ${nome}`}
        onClick={() => abrir().catch(falha)}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={`Baixar ${nome}`}
        onClick={() => baixar().catch(falha)}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Botão que abre o seletor de arquivo e envia (PDF, JPG ou PNG até 10 MB). */
export function BotaoEnviarAnexo({ temArquivo, enviar }: { temArquivo: boolean; enviar: (arquivo: File) => Promise<void> }) {
  const entrada = React.useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function escolher(arquivo?: File) {
    if (entrada.current) entrada.current.value = '';
    if (!arquivo) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(arquivo.name)) return void toast.error('Formato não aceito. Envie PDF, JPG ou PNG.');
    if (arquivo.size > 10 * 1024 * 1024) return void toast.error('Arquivo maior que 10 MB.');
    setEnviando(true);
    try {
      await enviar(arquivo);
      toast.success(temArquivo ? 'Anexo substituído.' : 'Anexo enviado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar o anexo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <input ref={entrada} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => void escolher(e.target.files?.[0])} />
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={enviando}
        title={temArquivo ? 'Substituir anexo' : 'Enviar anexo'} onClick={() => entrada.current?.click()}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </Button>
    </>
  );
}

/** Confirmação de exclusão com motivo obrigatório (o registro fica guardado e a exclusão no histórico). */
export function DialogExclusao({ titulo, descricao, aberto, onCancelar, onConfirmar }: {
  titulo: string;
  descricao: string;
  aberto: boolean;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (aberto) setMotivo('');
  }, [aberto]);

  async function confirmar() {
    if (motivo.trim().length < 3) {
      toast.error('Informe o motivo da exclusão (mínimo 3 caracteres).');
      return;
    }
    setSalvando(true);
    try {
      await onConfirmar(motivo.trim());
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !salvando && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Motivo da exclusão</Label>
          <Input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} disabled={salvando} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirmar()} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
