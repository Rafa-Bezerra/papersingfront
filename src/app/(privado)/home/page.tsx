'use client'

import { useEffect, useState } from 'react';
import { FileText, CheckCircle, Clock, CheckSquare, Bell, CalendarCheck, CalendarClock, Star, Users, XCircle, Zap, Package, Receipt, PenLine, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardStats, getDashboardStats } from '@/services/dashboardService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import './home.css';

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAdmin, setUserAdmin] = useState(false)

  useEffect(() => {
    const storedUser = sessionStorage.getItem("userData");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserAdmin(user.admin);
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
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Pendentes do Gestor</h2>
          <p className="text-xs text-muted-foreground">
            Documentos aguardando sua aprovação por tipo
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            title="Pendentes Movimentos"
            count={stats?.pendentes_movimentos ?? stats?.pendentes ?? 0}
            icon={Package}
            color="red"
            description="Movimentações em andamento"
            href="/geral?status=pendentes"
          />
          <DashboardCard
            title="Pendentes C.I."
            count={stats?.pendentes_ci ?? 0}
            icon={Receipt}
            color="yellow"
            description="Pagamentos CI"
            href="/comunicados"
          />
          <DashboardCard
            title="Pendentes Documentos"
            count={stats?.pendentes_documentos ?? 0}
            icon={FileText}
            color="blue"
            description="Documentos para assinatura"
            href="/documentos"
          />
          <DashboardCard
            title="Pendentes RDV"
            count={stats?.pendentes_rdv ?? 0}
            icon={PenLine}
            color="purple"
            description="Assinatura de RDVs"
            href="/aprovacaordv"
          />
        </div>
      </section>

      {/* Cards de Estatísticas - Status dos Processos */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Status dos Processos</h2>
          <p className="text-xs text-muted-foreground">
            Visão geral de todos os status
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <DashboardCard
          title="Documentos"
          count={stats?.documentos || 0}
          icon={FileText}
          color="blue"
          description="Total de documentos"
          href="/geral?status=todos"
        />

        <DashboardCard
          title="Concluído a responder"
          count={stats?.concluido_a_responder || 0}
          icon={FileText}
          color="green"
          description="Aguardando resposta"
          href="/geral?status=concluido_a_responder"
        />

        <DashboardCard
          title="Concluído respondido"
          count={stats?.concluido_respondido || 0}
          icon={CheckCircle}
          color="purple"
          description="Respondidos"
          href="/geral?status=concluido_respondido"
        />

        <DashboardCard
          title="Concluído confirmado"
          count={stats?.concluido_confirmado || 0}
          icon={CheckSquare}
          color="blue"
          description="Confirmados"
          href="/geral?status=concluido_confirmado"
        />

        <DashboardCard
          title="Concluído automático"
          count={stats?.concluido_automatico || 0}
          icon={Zap}
          color="yellow"
          description="Finalizado pelo sistema"
          href="/geral?status=concluido_automatico"
        />

        <DashboardCard
          title="Avaliado"
          count={stats?.avaliado || 0}
          icon={Star}
          color="yellow"
          description="Processos avaliados"
          href="/geral?status=avaliado"
        />

        <DashboardCard
          title="Agendado a responder"
          count={stats?.agendado_a_responder || 0}
          icon={CalendarClock}
          color="purple"
          description="Resposta agendada"
          href="/geral?status=agendado_a_responder"
        />

        <DashboardCard
          title="Agendado respondido"
          count={stats?.agendado_respondido || 0}
          icon={CalendarCheck}
          color="blue"
          description="Agendados respondidos"
          href="/geral?status=agendado_respondido"
        />

        <DashboardCard
          title="Aguardando terceiros"
          count={stats?.aguardando_terceiros || 0}
          icon={Users}
          color="yellow"
          description="Dependência externa"
          href="/geral?status=aguardando_terceiros"
        />

        <DashboardCard
          title="Cancelado"
          count={stats?.cancelado || 0}
          icon={XCircle}
          color="red"
          description="Processos cancelados"
          href="/geral?status=cancelado"
        />

        <DashboardCard
          title="Em andamento"
          count={stats?.em_andamento || 0}
          icon={Bell}
          color="purple"
          description="Em andamento"
          href="/geral?status=em_andamento"
        />

        {/* <DashboardCard
          title="Despertado"
          count={stats?.despertado || 0}
          icon={Bell}
          color="purple"
          description="Processos despertados"
          href="/geral?status=despertado"
        /> */}
        </div>
      </section>

      {/* Cards de Acesso Rápido */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${userAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4 sm:gap-6`} >
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow w-full"
          onClick={() => router.push('/carrinho')}
        >
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

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow w-full"
          onClick={() => router.push('/requisicoes')}
        >
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

        {userAdmin && (<Card
          className="cursor-pointer hover:shadow-md transition-shadow w-full"
          onClick={() => router.push('/usuarios')}
        >
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
        </Card>)}
      </div>

      {/* Resumo de Atividades */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Resumo de Atividades</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Clique em um item para ver os detalhes</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 sm:space-y-3">
            <div
              role="button"
              tabIndex={0}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
              onClick={() => router.push('/geral?status=concluido_confirmado')}
              onKeyDown={(e) => e.key === 'Enter' && router.push('/geral?status=concluido_confirmado')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Documentos aprovados hoje</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{stats?.aprovados_hoje || 0}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
              onClick={() => router.push('/geral?status=pendentes')}
              onKeyDown={(e) => e.key === 'Enter' && router.push('/geral?status=pendentes')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium">Pendentes movimentos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{stats?.pendentes_movimentos ?? stats?.pendentes ?? 0}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
              onClick={() => router.push('/comunicados')}
              onKeyDown={(e) => e.key === 'Enter' && router.push('/comunicados')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium">Pendentes C.I.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{stats?.pendentes_ci ?? 0}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
              onClick={() => router.push('/documentos')}
              onKeyDown={(e) => e.key === 'Enter' && router.push('/documentos')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">Pendentes documentos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{stats?.pendentes_documentos ?? 0}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
              onClick={() => router.push('/aprovacaordv')}
              onKeyDown={(e) => e.key === 'Enter' && router.push('/aprovacaordv')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium">Pendentes RDV</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{stats?.pendentes_rdv ?? 0}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
              onClick={() => router.push('/geral?status=todos')}
              onKeyDown={(e) => e.key === 'Enter' && router.push('/geral?status=todos')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                <span className="text-sm font-medium">Total de documentos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{stats?.documentos || 0}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
