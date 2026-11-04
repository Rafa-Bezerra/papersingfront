'use client';

import React, { useEffect, useState } from 'react';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  buscarFornecedoresRm,
  CLASSIFICACOES_MANUTENCAO,
  FornecedorRm,
  FrotaManutencao,
  SERVICOS_MANUTENCAO,
} from '@/services/frotasService';

/** Peças comuns da aba Manutenção (lançamentos, notas e comparativos). */

export function rotuloClassificacao(c: string) {
  return CLASSIFICACOES_MANUTENCAO.find((x) => x.valor === c)?.rotulo ?? c;
}

export function rotuloServico(s?: string | null) {
  return s ? (SERVICOS_MANUTENCAO.find((x) => x.valor === s)?.rotulo ?? s) : '';
}

export const qtd = (m: Pick<FrotaManutencao, 'quantidade'>) => (m.quantidade && m.quantidade > 0 ? m.quantidade : 1);
export const numeroBr = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function formatarDocumento(v?: string | null) {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}

/** Busca o fornecedor no FCFO do RM da unidade; o nome e o CNPJ gravados vêm do cadastro escolhido. */
export function SeletorFornecedorRm({ unidade, nome, disabled, onEscolher, textoVazio = 'Buscar fornecedor no RM' }: {
  unidade: string;
  nome: string;
  disabled?: boolean;
  onEscolher: (f: { nome: string; cnpj: string; codcfo: string }) => void;
  textoVazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<FornecedorRm[]>([]);
  const [buscando, setBuscando] = useState(false);
  const termo = busca.trim();

  useEffect(() => {
    if (!aberto || termo.length < 2) {
      setItens([]);
      return;
    }
    let cancelado = false;
    const espera = setTimeout(() => {
      setBuscando(true);
      buscarFornecedoresRm(unidade, termo)
        .then((r) => !cancelado && setItens(r))
        .catch((e) => !cancelado && toast.error(e instanceof Error ? e.message : 'Falha ao buscar fornecedores no RM.'))
        .finally(() => !cancelado && setBuscando(false));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [aberto, termo, unidade]);

  const nomeExibido = (f: FornecedorRm) => f.nome_fantasia?.trim() || f.nome;

  return (
    <Popover modal open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={disabled}>
          <span className={`truncate ${nome ? '' : 'text-muted-foreground'}`}>{nome || textoVazio}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-(--radix-popover-trigger-width) min-w-80 pointer-events-auto z-[9999]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nome, código ou CNPJ" value={busca} onValueChange={setBusca} />
          <CommandList>
            {buscando && itens.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>
                {termo.length < 2 ? 'Digite pelo menos 2 letras.' : 'Nenhum fornecedor ativo encontrado no RM.'}
              </CommandEmpty>
            )}
            <CommandGroup>
              {itens.map((f) => (
                <CommandItem
                  key={f.codcfo}
                  value={f.codcfo}
                  onSelect={() => {
                    onEscolher({ nome: nomeExibido(f), cnpj: f.cnpj, codcfo: f.codcfo });
                    setAberto(false);
                  }}
                >
                  <div className="min-w-0 leading-tight">
                    <p className="truncate">{nomeExibido(f)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[f.codcfo, nomeExibido(f) !== f.nome && f.nome, formatarDocumento(f.cnpj), f.cidade].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
