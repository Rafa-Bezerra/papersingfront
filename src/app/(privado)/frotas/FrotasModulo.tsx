'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, Car, CarFront, ReceiptText, ShieldAlert, Users, Wrench } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import CondutoresPage from './CondutoresPage';
import DashboardPage from './DashboardPage';
import FrotasPage from './FrotasPage';
import GestaoFrotasPage from './GestaoFrotasPage';
import ManutencaoPage from './ManutencaoPage';
import MultasPage from './MultasPage';
import SinistrosPage from './SinistrosPage';

const ABAS = ['cadastro', 'gestao', 'condutores', 'manutencao', 'multas', 'sinistros', 'dashboard'] as const;
type Aba = (typeof ABAS)[number];

/** Módulo Frotas no modelo do WaySign: abas na mesma tela (?aba=gestao, ?aba=manutencao, ?aba=multas). */
export default function FrotasModulo() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pedida = params.get('aba') as Aba | null;
  const aba: Aba = pedida && ABAS.includes(pedida) ? pedida : 'cadastro';

  // Cada aba só carrega na primeira vez que é aberta; depois fica montada (não perde o que foi digitado).
  const [abertas, setAbertas] = useState<Set<Aba>>(() => new Set([aba]));
  useEffect(() => {
    setAbertas((s) => (s.has(aba) ? s : new Set(s).add(aba)));
  }, [aba]);

  function trocarAba(valor: string) {
    router.replace(valor === 'cadastro' ? pathname : `${pathname}?aba=${valor}`, { scroll: false });
  }

  const conteudo = (valor: Aba, pagina: ReactNode) => (
    <TabsContent value={valor} forceMount className="data-[state=inactive]:hidden">
      {abertas.has(valor) ? pagina : null}
    </TabsContent>
  );

  return (
    <div className="p-4 md:p-6">
      <Tabs value={aba} onValueChange={trocarAba} className="space-y-4">
        <TabsList className="flex-wrap h-auto w-fit">
          <TabsTrigger value="cadastro">
            <Car className="w-4 h-4" /> Cadastro no RM
          </TabsTrigger>
          <TabsTrigger value="gestao">
            <CarFront className="w-4 h-4" /> Gestão de frotas
          </TabsTrigger>
          <TabsTrigger value="condutores">
            <Users className="w-4 h-4" /> Condutores
          </TabsTrigger>
          <TabsTrigger value="manutencao">
            <Wrench className="w-4 h-4" /> Manutenção
          </TabsTrigger>
          <TabsTrigger value="multas">
            <ReceiptText className="w-4 h-4" /> Multas
          </TabsTrigger>
          <TabsTrigger value="sinistros">
            <ShieldAlert className="w-4 h-4" /> Sinistros
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </TabsTrigger>
        </TabsList>
        {conteudo('cadastro', <FrotasPage />)}
        {conteudo('gestao', <GestaoFrotasPage />)}
        {conteudo('condutores', <CondutoresPage />)}
        {conteudo('manutencao', <ManutencaoPage />)}
        {conteudo('multas', <MultasPage />)}
        {conteudo('sinistros', <SinistrosPage />)}
        {conteudo('dashboard', <DashboardPage />)}
      </Tabs>
    </div>
  );
}
