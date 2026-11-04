'use client';

import React, { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CorPdf, GraficoPdf } from '@/lib/frotasDashboardPdf';

export type FatiaGrafico = { chave: string; rotulo: string; valor: number; texto: string; cor: CorPdf };

const FATIAS = 6;
export const PALETA_GRAFICO: CorPdf[] = [
  [37, 99, 235], [245, 158, 11], [16, 185, 129], [239, 68, 68], [139, 92, 246], [6, 182, 212], [236, 72, 153], [148, 163, 184],
];
const COR_OUTROS: CorPdf = [100, 116, 139];

export const rgbGrafico = (c: CorPdf) => `rgb(${c.join(',')})`;

/** Primeiras fatias com cor própria; o resto vira "Outros". */
export function montarFatiasGrafico<T>(
  itens: T[],
  chave: (x: T) => string,
  rotulo: (x: T) => string,
  valor: (x: T) => number,
  texto: (v: number) => string
): FatiaGrafico[] {
  const comValor = itens.filter((x) => valor(x) > 0);
  const fatias: FatiaGrafico[] = comValor.slice(0, FATIAS).map((x, i) => ({
    chave: chave(x), rotulo: rotulo(x), valor: valor(x), texto: texto(valor(x)), cor: PALETA_GRAFICO[i % PALETA_GRAFICO.length],
  }));
  const resto = comValor.slice(FATIAS);
  if (resto.length) {
    const soma = resto.reduce((s, x) => s + valor(x), 0);
    fatias.push({ chave: '', rotulo: `Outros (${resto.length})`, valor: soma, texto: texto(soma), cor: COR_OUTROS });
  }
  return fatias;
}

/** Fatias da tela → gráfico de pizza no PDF (mesmo padrão do Dashboard). */
export function graficoPdf(titulo: string, fatias: FatiaGrafico[]): GraficoPdf {
  return {
    titulo,
    fatias: fatias.map(({ rotulo, valor, texto, cor }) => ({ rotulo, valor, texto, cor })),
  };
}

export function graficoPdfLista<T>(
  titulo: string,
  itens: T[],
  chave: (x: T) => string,
  rotulo: (x: T) => string,
  valor: (x: T) => number,
  texto: (v: number) => string
): GraficoPdf {
  return graficoPdf(titulo, montarFatiasGrafico(itens, chave, rotulo, valor, texto));
}

function arco(r: number, ri: number, a0: number, a1: number) {
  const fim = Math.min(a1, a0 + Math.PI * 2 - 0.0001);
  const grande = fim - a0 > Math.PI ? 1 : 0;
  const p = (raio: number, a: number) => `${60 + raio * Math.cos(a)} ${60 + raio * Math.sin(a)}`;
  return `M${p(r, a0)} A${r} ${r} 0 ${grande} 1 ${p(r, fim)} L${p(ri, fim)} A${ri} ${ri} 0 ${grande} 0 ${p(ri, a0)}Z`;
}

export function GraficoPizza({ titulo, subtitulo, fatias, centro, onClicar }: {
  titulo?: string;
  subtitulo?: string;
  fatias: FatiaGrafico[];
  centro: string;
  onClicar?: (chave: string) => void;
}) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  let a0 = -Math.PI / 2;
  const caminhos = fatias.map((f) => {
    const a1 = a0 + (total > 0 ? f.valor / total : 0) * Math.PI * 2;
    const d = arco(56, 40, a0, a1);
    a0 = a1;
    return d;
  });
  const clicavel = (f: FatiaGrafico) => !!(f.chave && onClicar);
  const pct = (f: FatiaGrafico) => (total > 0 ? Math.round((f.valor / total) * 100) : 0);
  const destaque = ativa !== null ? fatias[ativa] : undefined;

  return (
    <Card className="flex flex-col h-full">
      {(titulo || subtitulo) && (
        <CardHeader className="pb-0">
          {titulo && <CardTitle className="text-sm font-semibold">{titulo}</CardTitle>}
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </CardHeader>
      )}
      <CardContent className={`flex flex-1 flex-col gap-4 ${titulo || subtitulo ? 'pt-4' : 'pt-3'}`}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="relative mx-auto h-44 w-44 shrink-0 sm:mx-0">
          <svg viewBox="0 0 120 120" className="h-full w-full" onMouseLeave={() => setAtiva(null)}>
            {total <= 0 ? (
              <path d={arco(56, 40, 0, Math.PI * 2)} className="fill-muted" />
            ) : (
              fatias.map((f, i) => (
                <path
                  key={`${f.rotulo}-${i}`}
                  d={caminhos[i]}
                  fill={rgbGrafico(f.cor)}
                  strokeWidth={fatias.length > 1 ? 1 : 0}
                  opacity={ativa !== null && ativa !== i ? 0.35 : 1}
                  className={`stroke-card transition-opacity ${clicavel(f) ? 'cursor-pointer' : ''}`}
                  onMouseEnter={() => setAtiva(i)}
                  onClick={() => clicavel(f) && onClicar!(f.chave)}
                >
                  <title>{`${f.rotulo}: ${f.texto}`}</title>
                </path>
              ))
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="text-sm font-bold leading-tight tabular-nums">{destaque ? destaque.texto : centro}</span>
            <span className="text-[11px] text-muted-foreground">{destaque ? `${pct(destaque)}%` : 'total'}</span>
          </div>
        </div>
        {fatias.length === 0 ? (
          <p className="flex-1 text-center text-sm text-muted-foreground sm:text-left">Sem dados.</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 text-xs sm:max-h-52 sm:overflow-y-auto sm:pr-1">
            {fatias.map((f, i) => (
              <li
                key={`${f.rotulo}-${i}`}
                className={`flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors ${clicavel(f) ? 'cursor-pointer hover:bg-muted/60' : ''} ${ativa === i ? 'bg-muted/60' : ''}`}
                onMouseEnter={() => setAtiva(i)}
                onMouseLeave={() => setAtiva(null)}
                onClick={() => clicavel(f) && onClicar!(f.chave)}
              >
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: rgbGrafico(f.cor) }} />
                <div className="min-w-0 flex-1">
                  <p className="leading-snug line-clamp-2" title={f.rotulo}>{f.rotulo}</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">{f.texto} · {pct(f)}%</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>
      </CardContent>
    </Card>
  );
}

export type ItemBarraGrafico = {
  rotulo: string;
  sub?: string;
  valor: number;
  texto: string;
  /** Tamanho da fatia no gráfico pizza (padrão = valor). Ex.: preço/un. usa valor, pizza usa gasto total. */
  pizzaValor?: number;
  /** Classe Tailwind da barra (ex.: bg-emerald-500). */
  corBarra?: string;
};

export function GraficoBarrasHorizontais({ titulo, subtitulo, itens, maximo }: {
  titulo?: string;
  subtitulo?: string;
  itens: ItemBarraGrafico[];
  maximo?: number;
}) {
  const max = maximo ?? Math.max(...itens.map((i) => i.valor), 1);

  return (
    <Card className="flex flex-col h-full">
      {(titulo || subtitulo) && (
        <CardHeader className="pb-0">
          {titulo && <CardTitle className="text-sm font-semibold">{titulo}</CardTitle>}
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </CardHeader>
      )}
      <CardContent className={`flex-1 ${titulo || subtitulo ? 'pt-4' : 'pt-3'}`}>
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="max-h-[min(28rem,70vh)] space-y-3 overflow-y-auto pr-1">
            {itens.map((item, i) => {
              const pct = max > 0 ? Math.max(2, Math.round((item.valor / max) * 100)) : 0;
              return (
                <div key={`${item.rotulo}-${i}`} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 font-medium leading-snug line-clamp-2" title={item.rotulo}>{item.rotulo}</span>
                    <span className="shrink-0 text-right tabular-nums font-semibold">{item.texto}</span>
                  </div>
                  {item.sub && <p className="text-[11px] text-muted-foreground">{item.sub}</p>}
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div className={`h-2 rounded-full transition-all ${item.corBarra ?? 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
