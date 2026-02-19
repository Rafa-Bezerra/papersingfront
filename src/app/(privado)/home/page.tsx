'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, CheckCircle, CheckSquare, Package, Receipt, PenLine } from 'lucide-react';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardStats, getDashboardStats } from '@/services/dashboardService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import './home.css';

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAdmin, setUserAdmin] = useState(false)
  const [userDocumentos, setUserDocumentos] = useState(false)
  const [userBordero, setUserBordero] = useState(false)
  const [userExterno, setUserExterno] = useState(false)
  const [userComunicados, setUserComunicados] = useState(false)
  const [userFiscal, setUserFiscal] = useState(false)
  const [userPagamentoRh, setPagamentoRh] = useState(false)
  const [userPagamentoImpostos, setPagamentoImpostos] = useState(false)
  const [userRestrito, setUserRestrito] = useState(false)
  const [userRdv, setUserRdv] = useState(false)

  useEffect(() => {
    const storedUser = sessionStorage.getItem("userData");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserAdmin(user.admin);
        setUserDocumentos(user.documentos);
        setUserRestrito(user.restrito);
        setUserBordero(user.bordero);
        setUserExterno(user.externo);
        setUserComunicados(user.comunicados);
        setUserFiscal(user.fiscal);
        setPagamentoRh(user.pagamento_rh);
        setPagamentoImpostos(user.pagamento_impostos);
        setUserRdv(user.rdv);
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      }
    }
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getDashboardStats();
        console.log(data);

        setStats(data);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <header className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="home-page space-y-6 sm:space-y-8 w-full p-4 sm:p-6">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel Principal</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o status dos seus documentos e processos em tempo real.
        </p>
      </header>

      {/* Seção Pendentes do Gestor - em destaque */}
      {stats && (<section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Pendentes do Gestor</h2>
          <p className="text-xs text-muted-foreground">
            Documentos aguardando sua aprovação por tipo
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            title="Movimentos"
            count={stats.quantidade_movimentos}
            icon={Package}
            color="red"
            description="Movimentações em andamento"
            href="/geral?status=pendentes"
          />
          {(userRestrito || userAdmin) && (<DashboardCard
            title="Gestão de Pessoas"
            count={stats.quantidade_restritos}
            icon={PenLine}
            color="purple"
            description="Movimentos restritos"
            href="/gestao-pessoas?filtro=pendentes"
          />)}
          {(userPagamentoRh || userAdmin) && (<DashboardCard
            title="Pag. RH"
            count={stats.quantidade_pagamentos_rh}
            icon={PenLine}
            color="purple"
            description="Pagamentos RH"
            href="/pagamentos-rh?filtro=pendentes"
          />)}
          {(userPagamentoImpostos || userAdmin) && (<DashboardCard
            title="Pag. Impostos"
            count={stats.quantidade_pagamentos_impostos}
            icon={PenLine}
            color="purple"
            description="Pagamentos Impostos"
            href="/pagamentos-impostos?filtro=pendentes"
          />)}
          {(userBordero || userAdmin) && (<DashboardCard
            title="Borderô"
            count={stats.quantidade_bordero}
            icon={PenLine}
            color="purple"
            description="Autorização de Borderôs"
            href="/bordero?filtro=pendentes"
          />)}
          {(userComunicados || userAdmin) && (<DashboardCard
            title="C.I."
            count={stats.quantidade_comunicados}
            icon={Receipt}
            color="yellow"
            description="Pagamentos CI"
            href="/comunicados"
          />)}
          {(userRdv || userAdmin) && (<DashboardCard
            title="RDV"
            count={stats.quantidade_rdv}
            icon={PenLine}
            color="purple"
            description="Assinatura de RDVs"
            href="/aprovacaordv"
          />)}
          {(userFiscal || userAdmin) && (<DashboardCard
            title="Fiscal"
            count={stats.quantidade_fiscal}
            icon={PenLine}
            color="purple"
            description="Assinatura de Fiscal"
            href="/fiscal"
          />)}
          {(userExterno || userAdmin) && (<DashboardCard
            title="RDV"
            count={stats.quantidade_externo}
            icon={PenLine}
            color="purple"
            description="Assinatura de Externos"
            href="/documentos-externos"
          />)}
          {(userDocumentos || userAdmin) && (<DashboardCard
            title="Pendentes Documentos"
            count={stats.quantidade_documentos}
            icon={FileText}
            color="blue"
            description="Documentos para assinatura"
            href="/documentos"
          />)}
        </div>
      </section>)}

      {/* Cards de Acesso Rápido */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${userAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4 sm:gap-6`} >
        <Link href="/carrinho/">
          <Card className="cursor-pointer hover:shadow-md transition-shadow w-full h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Solicitações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl sm:text-2xl font-bold">Nova</div>
                  <p className="text-xs text-muted-foreground">
                    Criar solicitação de compra
                  </p>
                </div>
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/requisicoes/">
          <Card className="cursor-pointer hover:shadow-md transition-shadow w-full h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recebimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl sm:text-2xl font-bold">Ver</div>
                  <p className="text-xs text-muted-foreground">
                    Gerenciar recebimentos
                  </p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* <Card 
          className="cursor-pointer hover:shadow-md transition-shadow w-full"
          onClick={() => router.push('/assinatura')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl sm:text-2xl font-bold">Config</div>
                <p className="text-xs text-muted-foreground">
                  Configurar assinatura
                </p>
              </div>
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card> */}

        {userAdmin && (
          <Link href="/usuarios/">
            <Card className="cursor-pointer hover:shadow-md transition-shadow w-full h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Usuários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl sm:text-2xl font-bold">Admin</div>
                    <p className="text-xs text-muted-foreground">
                      Gerenciar usuários
                    </p>
                  </div>
                  <CheckSquare className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Resumo de Atividades */}
      {stats && stats.movimentos?.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Resumo de Atividades
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-2 sm:space-y-3">
              {stats.movimentos.map((mov, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <span className="text-sm font-medium">
                    {mov.status_movimento}
                  </span>

                  <span className="text-sm text-muted-foreground">
                    {mov.quantidade ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
