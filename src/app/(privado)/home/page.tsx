'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  CheckCircle,
  CheckSquare,
  Package,
  Receipt,
  Inbox,
  FileSignature,
  FolderKanban,
  ShieldAlert,
  Users,
  Percent,
  Landmark,
  MessageSquare,
  Wallet,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { DashboardCard } from '@/components/DashboardCard';
import PendenciasGestorHomeCard from '@/components/PendenciasGestorHomeCard';
import { DashboardStats, getDashboardStats } from '@/services/dashboardService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import './home.css';

function hrefResumoMovimento(status: string): string {
  const map: Record<string, string> = {
    'Em Andamento': 'em_andamento',
    'Pendente': 'pendentes',
    'Concluído a responder': 'concluido_a_responder',
    'Concluído respondido': 'concluido_respondido',
    'Concluído confirmado': 'concluido_confirmado',
    'Concluído automático(pelo sistema)': 'concluido_automatico',
    'Avaliado': 'avaliado',
    'Agendado a responder': 'agendado_a_responder',
    'Agendado respondido': 'agendado_respondido',
    'Aguardando terceiros': 'aguardando_terceiros',
    'Cancelado': 'cancelado',
    'Despertado': 'despertado',
  };
  const slug = map[status];
  return slug ? `/geral/?status=${slug}` : '/geral/';
}

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
  const [userProjetos, setUserProjetos] = useState(false)
  const [userUnidade, setUserUnidade] = useState("")
  const [userDocusign, setUserDocusign] = useState(false)

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
        setUserProjetos(Boolean(user.projetos || user.financeiro));
        setUserUnidade(String(user.unidade ?? ""));
        setUserDocusign(Boolean(user.docusign || user.financeiro));
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
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Pendentes do Gestor</h2>
            <p className="text-xs text-muted-foreground">
              Todas as WAY — movimentos, documentos, projetos, WaySign, RDV, fiscal e C.I.
            </p>
          </div>
          <Link
            href="/pendencias"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Inbox className="h-4 w-4" />
            Página completa
          </Link>
        </div>

        <PendenciasGestorHomeCard />

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
          Unidade atual
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            title="Movimentos"
            count={stats.quantidade_movimentos}
            icon={Package}
            color="orange"
            description="Movimentações em andamento"
            href="/geral?status=pendentes"
          />
          {(userRestrito || userAdmin) && (<DashboardCard
            title="Gestão de Pessoas"
            count={stats.quantidade_restritos}
            icon={ShieldAlert}
            color="rose"
            description="Movimentos restritos"
            href="/gestao-pessoas?status=pendentes"
          />)}
          {(userPagamentoRh || userAdmin) && (<DashboardCard
            title="Pag. RH"
            count={stats.quantidade_pagamentos_rh}
            icon={Users}
            color="pink"
            description="Pagamentos RH"
            href="/pagamentos-rh?filtro=pendentes"
          />)}
          {(userPagamentoImpostos || userAdmin) && (<DashboardCard
            title="Pag. Impostos"
            count={stats.quantidade_pagamentos_impostos}
            icon={Percent}
            color="lime"
            description="Pagamentos Impostos"
            href="/pagamentos-impostos?filtro=pendentes"
          />)}
          {(userBordero || userAdmin) && (<DashboardCard
            title="Borderô"
            count={stats.quantidade_bordero}
            icon={Landmark}
            color="slate"
            description="Autorização de Borderôs"
            href="/bordero?filtro=pendentes"
          />)}
          {(userComunicados || userAdmin) && (<DashboardCard
            title="C.I."
            count={stats.quantidade_comunicados}
            icon={MessageSquare}
            color="amber"
            description="Pagamentos CI"
            href="/comunicados"
          />)}
          {(userRdv || userAdmin) && (<DashboardCard
            title="RDV"
            count={stats.quantidade_rdv}
            icon={Wallet}
            color="violet"
            description="Assinatura de RDVs"
            href="/aprovacaordv"
          />)}
          {(userFiscal || userAdmin) && (<DashboardCard
            title="Fiscal"
            count={stats.quantidade_fiscal}
            icon={Receipt}
            color="cyan"
            description="Assinatura de Fiscal"
            href="/fiscal?filtro=pendentes"
          />)}
          {(userExterno || userAdmin) && (<DashboardCard
            title="Doc. Externos"
            count={stats.quantidade_externo}
            icon={Globe}
            color="sky"
            description="Assinatura de documentos externos"
            href="/documentos-externos?filtro=pendentes"
          />)}
          {(userDocumentos || userAdmin) && (<DashboardCard
            title="Pendentes Documentos"
            count={stats.quantidade_documentos}
            icon={FileText}
            color="blue"
            description="Documentos para assinatura"
            href="/documentos?filtro=pendentes"
          />)}
          {(userProjetos || userAdmin) && userUnidade.trim().toUpperCase() === "WAY CSC" && (<DashboardCard
            title="Projetos"
            count={stats.quantidade_projetos ?? 0}
            icon={FolderKanban}
            color="indigo"
            description="Projetos para assinatura"
            href="/projetos?filtro=pendentes"
          />)}
          {(userDocusign || userAdmin) && (<DashboardCard
            title="WaySign"
            count={stats.quantidade_plugsign ?? 0}
            icon={FileSignature}
            color="teal"
            description="Documentos WaySign pendentes"
            href="/docusign?filtro=pendentes"
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
                <Link
                  key={index}
                  href={hrefResumoMovimento(mov.status_movimento)}
                  className="group flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted hover:shadow-sm"
                >
                  <span className="text-sm font-medium">
                    {mov.status_movimento}
                  </span>

                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">
                      {mov.quantidade ?? 0}
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
