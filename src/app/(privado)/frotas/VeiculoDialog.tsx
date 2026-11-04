'use client';

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Download, ExternalLink, Loader2, Phone, Trash2, Undo2, Upload, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  abrirDocumentoFrota,
  baixarDocumentoFrota,
  definirResponsavelFrota,
  devolverVeiculoFrota,
  enviarDocumentoFrota,
  excluirDocumentoFrota,
  FrotaDocumento,
  FrotaResponsavel,
  listarDocumentosFrota,
  listarResponsaveisFrota,
  TIPOS_DOCUMENTO_FROTA,
} from '@/services/frotasService';

const MAX_MB = 10;

const FORM_RESPONSAVEL_VAZIO = { nome: '', matricula: '', setor: '', telefone: '', observacao: '' };

function rotuloTipo(tipo: string) {
  return TIPOS_DOCUMENTO_FROTA.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

function hojeIso() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

export function vencido(validade?: string | null) {
  return !!validade && validade.slice(0, 10) < hojeIso();
}

export function dataBr(iso?: string | null) {
  return iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
}

function soDigitos(v: string) {
  return v.replace(/\D/g, '');
}

type Props = {
  unidade: string;
  placa: string | null;
  onClose: () => void;
  onAlterado: () => void;
};

export default function VeiculoDialog({ unidade, placa, onClose, onAlterado }: Props) {
  const [documentos, setDocumentos] = useState<FrotaDocumento[]>([]);
  const [responsaveis, setResponsaveis] = useState<FrotaResponsavel[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [formResp, setFormResp] = useState(FORM_RESPONSAVEL_VAZIO);
  const [editandoResp, setEditandoResp] = useState(false);
  const [salvandoResp, startSalvarResp] = useTransition();
  const [devolvendo, setDevolvendo] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState('');
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);

  const [tipo, setTipo] = useState('CRLV');
  const [descricao, setDescricao] = useState('');
  const [condutor, setCondutor] = useState('');
  const [validade, setValidade] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, startEnviar] = useTransition();
  const [excluindo, setExcluindo] = useState<FrotaDocumento | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [salvandoExclusao, startExcluir] = useTransition();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const atual = responsaveis.find((r) => !r.data_fim) ?? null;
  const anteriores = responsaveis.filter((r) => r.data_fim);
  const ocupado = enviando || salvandoExclusao || salvandoResp;

  const carregar = useCallback(async () => {
    if (!placa) return;
    setCarregando(true);
    try {
      const [docs, resps] = await Promise.all([
        listarDocumentosFrota(unidade, placa),
        listarResponsaveisFrota(unidade, placa),
      ]);
      setDocumentos(docs);
      setResponsaveis(resps);
    } catch (e) {
      setDocumentos([]);
      setResponsaveis([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar os dados do veículo.');
    } finally {
      setCarregando(false);
    }
  }, [unidade, placa]);

  useEffect(() => {
    setTipo('CRLV');
    setDescricao('');
    setCondutor('');
    setValidade('');
    setArquivo(null);
    setExcluindo(null);
    setEditandoResp(false);
    setDevolvendo(false);
    setMostrarAnteriores(false);
    void carregar();
  }, [carregar]);

  function handleSalvarResponsavel() {
    if (!placa) return;
    if (formResp.nome.trim().length < 3) {
      toast.error('Informe o nome de quem está com o veículo.');
      return;
    }
    startSalvarResp(async () => {
      try {
        await definirResponsavelFrota({
          unidade,
          placa,
          nome: formResp.nome.trim(),
          matricula: formResp.matricula.trim() || undefined,
          setor: formResp.setor.trim() || undefined,
          telefone: formResp.telefone.trim() || undefined,
          observacao: formResp.observacao.trim() || undefined,
        });
        toast.success(`Veículo ${placa} agora está com ${formResp.nome.trim()}.`);
        setEditandoResp(false);
        setFormResp(FORM_RESPONSAVEL_VAZIO);
        await carregar();
        onAlterado();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao salvar o responsável.');
      }
    });
  }

  function handleDevolver() {
    if (!placa) return;
    const motivo = motivoDevolucao.trim();
    if (motivo.length < 3) {
      toast.error('Informe o motivo da devolução (mínimo 3 caracteres).');
      return;
    }
    startSalvarResp(async () => {
      try {
        await devolverVeiculoFrota(unidade, placa, motivo);
        toast.success(`Devolução do veículo ${placa} registrada.`);
        setDevolvendo(false);
        setMotivoDevolucao('');
        await carregar();
        onAlterado();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao registrar a devolução.');
      }
    });
  }

  function handleEnviar() {
    if (!placa) return;
    if (!arquivo) {
      toast.error('Selecione o arquivo (PDF, JPG ou PNG).');
      return;
    }
    if (arquivo.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_MB} MB.`);
      return;
    }
    const novoCondutor = tipo === 'CNH' && !atual ? condutor.trim() : '';
    if (tipo === 'CNH' && !atual && novoCondutor.length < 3) {
      toast.error('Informe o nome do condutor (com quem está o veículo).');
      return;
    }
    startEnviar(async () => {
      try {
        // A CNH fica ligada a quem está com o veículo: sem responsável, o condutor informado passa a ser.
        if (novoCondutor) {
          await definirResponsavelFrota({ unidade, placa, nome: novoCondutor });
          setCondutor('');
        }
        await enviarDocumentoFrota({
          unidade,
          placa,
          tipo,
          descricao: tipo === 'CNH' ? undefined : descricao.trim() || undefined,
          validade: validade || undefined,
          arquivo,
        });
        toast.success(`${rotuloTipo(tipo)} anexado à placa ${placa}.`);
        setDescricao('');
        setValidade('');
        setArquivo(null);
        if (inputArquivo.current) inputArquivo.current.value = '';
        await carregar();
        onAlterado();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao enviar o documento.');
        if (novoCondutor) await carregar();
      }
    });
  }

  function handleExcluir() {
    if (!excluindo) return;
    const motivo = motivoExclusao.trim();
    if (motivo.length < 3) {
      toast.error('Informe o motivo da exclusão (mínimo 3 caracteres).');
      return;
    }
    const doc = excluindo;
    startExcluir(async () => {
      try {
        await excluirDocumentoFrota(doc.id, motivo);
        toast.success('Documento excluído.');
        setExcluindo(null);
        setMotivoExclusao('');
        await carregar();
        onAlterado();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao excluir o documento.');
      }
    });
  }

  return (
    <Dialog
      open={placa !== null}
      onOpenChange={(aberto) => {
        if (!aberto && !ocupado) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Veículo {placa}</DialogTitle>
          <DialogDescription>
            Com quem está, CNH e documentos ({unidade}). Fica só no PaperSign; o RM continua só com a placa.
          </DialogDescription>
        </DialogHeader>

        {/* Com quem está */}
        <section className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserRound className="h-4 w-4" /> Com quem está
            </h3>
            {!editandoResp && !devolvendo && !carregando && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={atual ? 'outline' : 'default'}
                  onClick={() => {
                    setFormResp(FORM_RESPONSAVEL_VAZIO);
                    setEditandoResp(true);
                  }}
                >
                  {atual ? 'Trocar responsável' : 'Informar com quem está'}
                </Button>
                {atual && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMotivoDevolucao('');
                      setDevolvendo(true);
                    }}
                  >
                    <Undo2 className="h-4 w-4 mr-1" /> Devolução
                  </Button>
                )}
              </div>
            )}
          </div>

          {carregando ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </p>
          ) : atual ? (
            <div className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Nome: </span>
                <strong>{atual.nome}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Telefone: </span>
                {atual.telefone ? (
                  <a className="underline inline-flex items-center gap-1" href={`tel:${soDigitos(atual.telefone)}`}>
                    <Phone className="h-3 w-3" />
                    {atual.telefone}
                  </a>
                ) : (
                  '—'
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Setor: </span>
                {atual.setor || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Matrícula: </span>
                {atual.matricula || '—'}
              </p>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Desde {new Date(atual.data_inicio).toLocaleString('pt-BR')} · registrado por{' '}
                {atual.usuario_nome || atual.usuario}
                {atual.observacao ? ` · ${atual.observacao}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">O veículo não está com ninguém no momento.</p>
          )}

          {editandoResp && (
            <div className="grid gap-2 sm:grid-cols-2 border-t pt-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input
                  maxLength={150}
                  placeholder="Quem vai ficar com o veículo"
                  value={formResp.nome}
                  onChange={(e) => setFormResp({ ...formResp, nome: e.target.value })}
                  disabled={salvandoResp}
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input
                  maxLength={30}
                  inputMode="tel"
                  placeholder="(67) 99999-9999"
                  value={formResp.telefone}
                  onChange={(e) => setFormResp({ ...formResp, telefone: e.target.value })}
                  disabled={salvandoResp}
                />
              </div>
              <div className="space-y-1">
                <Label>Setor</Label>
                <Input
                  maxLength={100}
                  placeholder="Ex.: Conserva"
                  value={formResp.setor}
                  onChange={(e) => setFormResp({ ...formResp, setor: e.target.value })}
                  disabled={salvandoResp}
                />
              </div>
              <div className="space-y-1">
                <Label>Matrícula (opcional)</Label>
                <Input
                  maxLength={30}
                  value={formResp.matricula}
                  onChange={(e) => setFormResp({ ...formResp, matricula: e.target.value })}
                  disabled={salvandoResp}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Observação (opcional)</Label>
                <Input
                  maxLength={300}
                  placeholder="Ex.: entregue com tanque cheio, km 45.210"
                  value={formResp.observacao}
                  onChange={(e) => setFormResp({ ...formResp, observacao: e.target.value })}
                  disabled={salvandoResp}
                />
              </div>
              {atual && (
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  {atual.nome} sai como responsável e fica no histórico. A CNH dele deixa de valer para este veículo.
                </p>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditandoResp(false)}
                  disabled={salvandoResp}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSalvarResponsavel}
                  disabled={salvandoResp || formResp.nome.trim().length < 3}
                >
                  {salvandoResp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {devolvendo && atual && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm">
                Registrar que <strong>{atual.nome}</strong> devolveu o veículo?
              </p>
              <Input
                placeholder="Motivo / observação da devolução"
                maxLength={500}
                value={motivoDevolucao}
                onChange={(e) => setMotivoDevolucao(e.target.value)}
                disabled={salvandoResp}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDevolvendo(false)}
                  disabled={salvandoResp}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDevolver}
                  disabled={salvandoResp || motivoDevolucao.trim().length < 3}
                >
                  {salvandoResp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Registrar devolução
                </Button>
              </div>
            </div>
          )}

          {anteriores.length > 0 && (
            <div className="border-t pt-2">
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => setMostrarAnteriores((v) => !v)}
              >
                {mostrarAnteriores ? 'Ocultar' : 'Ver'} quem já esteve com o veículo ({anteriores.length})
              </button>
              {mostrarAnteriores && (
                <ul className="mt-2 space-y-1 text-xs">
                  {anteriores.map((r) => (
                    <li key={r.id}>
                      <strong>{r.nome}</strong>
                      {r.setor ? ` (${r.setor})` : ''} · {dataBr(r.data_inicio)} até {dataBr(r.data_fim)}
                      {r.motivo_fim ? ` · ${r.motivo_fim}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Documentos */}
        <section className="rounded-md border p-3 space-y-3">
          <h3 className="text-sm font-semibold">Documentos</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo} disabled={enviando}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO_FROTA.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Validade (opcional)</Label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} disabled={enviando} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              {tipo === 'CNH' ? (
                atual ? (
                  <p className="text-sm">
                    CNH de <strong>{atual.nome}</strong> (responsável atual).
                  </p>
                ) : (
                  <>
                    <Label>Nome do condutor</Label>
                    <Input
                      maxLength={150}
                      placeholder="Quem está com o veículo"
                      value={condutor}
                      onChange={(e) => setCondutor(e.target.value)}
                      disabled={enviando}
                    />
                    <p className="text-xs text-muted-foreground">
                      O condutor também fica registrado em &quot;Com quem está&quot;.
                    </p>
                  </>
                )
              ) : (
                <>
                  <Label>Descrição (opcional)</Label>
                  <Input
                    maxLength={200}
                    placeholder="Ex.: exercício 2026"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    disabled={enviando}
                  />
                </>
              )}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Arquivo (PDF, JPG ou PNG até {MAX_MB} MB)</Label>
              <Input
                ref={inputArquivo}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                disabled={enviando}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleEnviar}
              disabled={enviando || !arquivo || (tipo === 'CNH' && !atual && condutor.trim().length < 3)}
            >
              {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Anexar
            </Button>
          </div>

          <div className="space-y-2 border-t pt-3">
            {carregando ? null : documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
            ) : (
              documentos.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                  <Badge variant="secondary">{d.tipo}</Badge>
                  <div className="flex-1 min-w-48">
                    <p className="font-medium truncate" title={d.nome_arquivo}>
                      {d.descricao || d.nome_arquivo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.usuario_nome || d.usuario} · {new Date(d.data_hora).toLocaleString('pt-BR')}
                      {d.validade && (
                        <>
                          {' · '}
                          <span className={vencido(d.validade) ? 'text-destructive font-medium' : ''}>
                            validade {dataBr(d.validade)}
                            {vencido(d.validade) ? ' (vencido)' : ''}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title="Abrir"
                    onClick={() =>
                      abrirDocumentoFrota(d.id).catch((e) =>
                        toast.error(e instanceof Error ? e.message : 'Falha ao abrir o documento.')
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title="Baixar"
                    onClick={() =>
                      baixarDocumentoFrota(d.id, d.nome_arquivo).catch((e) =>
                        toast.error(e instanceof Error ? e.message : 'Falha ao baixar o documento.')
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    title="Excluir"
                    onClick={() => {
                      setMotivoExclusao('');
                      setExcluindo(d);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {excluindo && (
            <div className="rounded-md border border-destructive/50 p-3 space-y-2">
              <p className="text-sm font-medium">
                Excluir {excluindo.tipo} ({excluindo.descricao || excluindo.nome_arquivo})?
              </p>
              <Input
                placeholder="Motivo da exclusão"
                maxLength={500}
                value={motivoExclusao}
                onChange={(e) => setMotivoExclusao(e.target.value)}
                disabled={salvandoExclusao}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExcluindo(null)}
                  disabled={salvandoExclusao}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleExcluir}
                  disabled={salvandoExclusao || motivoExclusao.trim().length < 3}
                >
                  {salvandoExclusao && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
