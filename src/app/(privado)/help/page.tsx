/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, PlayCircle, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type TrainingModule = {
  id: string;
  url: string;
  title: string;
  description: string;
  status: "Em breve" | "Disponível";
  videoUrl?: string;
};

const MODULES: TrainingModule[] = [
  { id: "solicitacao-compra", url: "/solicitacoes", title: "Solicitação de compra", description: "Como criar, acompanhar e aprovar solicitações.", status: "Em breve" },
  { id: "recebimento-materiais", url: "/requisicoes", title: "Recebimento de materiais", description: "Fluxo de recebimento e conferência.", status: "Em breve" },
  { id: "controle-imobilizado", url: "/controle", title: "Controle imobilizado", description: "Cadastro e movimentação de ativos.", status: "Em breve" },
  { id: "ordem-compra", url: "/ordens", title: "Ordem de compra", description: "Listagem, filtros e ações (documento, anexos, itens).", status: "Em breve" },
  { id: "aquisicao-servicos", url: "/aquisicoes", title: "Aquisição de serviços", description: "Processo de contratação e aprovações.", status: "Em breve" },
  { id: "outras-movimentacoes", url: "/outras", title: "Outras movimentações", description: "Movimentos adicionais e suas etapas.", status: "Em breve" },
  { id: "documentos", url: "/documentos", title: "Documentos", description: "Consulta, assinatura e histórico.", status: "Disponível", videoUrl: "/trainings/documentos.mp4" },
  { id: "pagamentos-ci", url: "/comunicados", title: "Pagamentos CI", description: "Cadastro e validações de pagamentos.", status: "Em breve" },
  { id: "bordero", url: "/bordero", title: "Borderô", description: "Envio, acompanhamento e aprovação.", status: "Em breve" },
  { id: "carrinho", url: "/carrinho", title: "Carrinho", description: "Montagem e envio de requisições.", status: "Em breve" },
  { id: "rdv", url: "/rdv", title: "RDV", description: "Reembolso/Despesas de viagem: fluxo completo.", status: "Disponível", videoUrl: "/trainings/RDV%20-%20TREINAMENTO%20.mp4" },
  { id: "aprovacao-rdv", url: "/aprovacaordv", title: "Aprovação RDV", description: "Aprovar, reprovar e notificar aprovadores.", status: "Em breve" },
  { id: "gestao-pessoas", url: "/gestao-pessoas", title: "Gestão de Pessoas", description: "Rotinas e consultas do módulo.", status: "Em breve" },
  { id: "pagamentos-gp", url: "/pagamentos-rh", title: "Pagamentos G. Pessoas", description: "Fluxos e validações de pagamento.", status: "Em breve" },
  { id: "pagamentos-impostos", url: "/pagamentos-impostos", title: "Pagamentos Impostos", description: "Fluxos, aprovações e pendências.", status: "Em breve" },
  { id: "documentos-externos", url: "/documentos-externos", title: "Documentos Externos", description: "Upload, assinatura e controle.", status: "Em breve" },
  { id: "painel-fiscal", url: "/fiscal", title: "Painel Fiscal", description: "Visão fiscal e movimentações.", status: "Em breve" },
  // itens de Configurações só aparecem para admin (igual menu)
  { id: "configuracoes", url: "/centros-custos", title: "Configurações", description: "Alçadas, centros de custos, usuários e cadastros.", status: "Em breve" },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeVideo, setActiveVideo] = useState<TrainingModule | null>(null);
  const [userPerms, setUserPerms] = useState<{
    admin: boolean;
    documentos: boolean;
    bordero: boolean;
    externo: boolean;
    comunicados: boolean;
    fiscal: boolean;
    pagamento_rh: boolean;
    pagamento_impostos: boolean;
    restrito: boolean;
    rdv: boolean;
    centros_custos: boolean;
  } | null>(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem("userData");
    if (!storedUser) return;
    try {
      const u = JSON.parse(storedUser);
      setUserPerms({
        admin: Boolean(u?.admin),
        documentos: Boolean(u?.documentos),
        bordero: Boolean(u?.bordero),
        externo: Boolean(u?.externo),
        comunicados: Boolean(u?.comunicados),
        fiscal: Boolean(u?.fiscal),
        pagamento_rh: Boolean(u?.pagamento_rh),
        pagamento_impostos: Boolean(u?.pagamento_impostos),
        restrito: Boolean(u?.restrito),
        rdv: Boolean(u?.rdv),
        centros_custos: Boolean(u?.centros_custos),
      });
    } catch {
      setUserPerms(null);
    }
  }, []);

  const canSeeModule = (url: string) => {
    if (!userPerms) return true;
    if (userPerms.admin) return true;

    if (url === "/documentos" && !userPerms.documentos) return false;
    if (url === "/comunicados" && !userPerms.comunicados) return false;
    if (url === "/bordero" && !userPerms.bordero) return false;
    if (url === "/aprovacaordv" && !userPerms.rdv) return false;
    if (url === "/gestao-pessoas" && !userPerms.restrito) return false;
    if (url === "/documentos-externos" && !userPerms.externo) return false;
    if (url === "/pagamentos-rh" && !userPerms.pagamento_rh) return false;
    if (url === "/pagamentos-impostos" && !userPerms.pagamento_impostos) return false;
    if (url === "/fiscal" && !userPerms.fiscal) return false;
    if (url === "/centros-custos") return false;
    return true;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = MODULES.filter((m) => canSeeModule(m.url));
    if (!q) return visible;
    return visible.filter((m) => (m.title + " " + m.description).toLowerCase().includes(q));
  }, [query, userPerms]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Ajuda e Treinamentos</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Aqui você encontra os treinamentos por módulo. Os conteúdos serão publicados em breve.
            </p>
          </div>

          <Badge variant="secondary" className="border border-border bg-muted text-muted-foreground">
            Em construção
          </Badge>
        </div>

        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulo..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((m) => (
          <Card key={m.id} className="border-border bg-background">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base font-semibold">{m.title}</CardTitle>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {m.status}
                </Badge>
              </div>
              <CardDescription className="text-sm">{m.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">Vídeos e materiais do módulo</div>
              <Button
                variant="secondary"
                size="sm"
                disabled={!m.videoUrl}
                onClick={() => setActiveVideo(m)}
                className="gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                Ver vídeos
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-10 text-center text-sm text-muted-foreground">Nenhum módulo encontrado.</div>
      )}

      <Dialog open={Boolean(activeVideo)} onOpenChange={(open) => (!open ? setActiveVideo(null) : undefined)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{activeVideo?.title ?? "Treinamento"}</DialogTitle>
          </DialogHeader>
          {activeVideo?.videoUrl ? (
            <div className="w-full">
              <video
                className="w-full rounded-md border border-border bg-black"
                src={activeVideo.videoUrl}
                controls
                preload="metadata"
              />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Vídeo ainda não disponível.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

