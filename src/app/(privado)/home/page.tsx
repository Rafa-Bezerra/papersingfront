'use client'

import { useEffect, useState } from 'react';
import { FileText, CheckCircle, Clock, CheckSquare, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardCard } from '@/components/DashboardCard';
import { getDashboardStats } from '@/services/dashboardService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import './home.css';

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<{
    documentos: number;
    aprovados: number;
    aprovados_hoje: number;
    em_andamento: number;
    concluidos: number;
    pendentes: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getDashboardStats();
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

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
        <DashboardCard
          title="Documentos"
          count={stats?.documentos || 0}
          icon={FileText}
          color="blue"
          description="Total de documentos"
          href="/geral"
          className="w-full"
        />
        
        <DashboardCard
          title="Aprovados"
          count={stats?.aprovados || 0}
          icon={CheckCircle}
          color="green"
          description="Documentos aprovados"
          href="/geral?status=Aprovados"
          className="w-full"
        />
        
        <DashboardCard
          title="Em Andamento"
          count={stats?.em_andamento || 0}
          icon={Clock}
          color="yellow"
          description="Processos em análise"
          href="/geral?status=Andamento"
          className="w-full"
        />
        
        <DashboardCard
          title="Concluídos"
          count={stats?.concluidos || 0}
          icon={CheckSquare}
          color="purple"
          description="Processos finalizados"
          href="/geral?status=Finalizados"
          className="w-full"
        />
        
        <DashboardCard
          title="Pendentes"
          count={stats?.pendentes || 0}
          icon={AlertCircle}
          color="red"
          description="Aguardando ação"
          href="/geral?status=Pendentes"
          className="w-full"
        />
      </div>

      {/* Cards de Acesso Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow w-full"
          onClick={() => router.push('/solicitacoes')}
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

        <Card 
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
        </Card>

        <Card 
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
        </Card>
      </div>

      {/* Resumo de Atividades */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Resumo de Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Documentos aprovados hoje</span>
              </div>
              <span className="text-sm text-muted-foreground">{stats?.aprovados_hoje || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium">Aguardando sua aprovação</span>
              </div>
              <span className="text-sm text-muted-foreground">{stats?.pendentes || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">Total de documentos</span>
              </div>
              <span className="text-sm text-muted-foreground">{stats?.documentos || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
