// lib/patient-data.ts
export interface NavItem {
  title: string;
  url: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const data = {
  navMain: [
    {
      title: "Módulos",
      items: [
        { title: "Inicio", url: "/home" },
        { title: "Solicitação de compra", url: "/solicitacoes" },
        { title: "Recebimento de materiais", url: "/requisicoes" },
        { title: "Controle imobilizado", url: "/controle" },
        { title: "Ordem de compra", url: "/ordens" },
        { title: "Aquisição de serviços", url: "/aquisicoes" },
        { title: "Outras movimentações", url: "/outras" },
        { title: "Documentos", url: "/documentos" },
        { title: "Pagamentos CI", url: "/comunicados" },
        { title: "Borderô", url: "/bordero" },
        { title: "Carrinho", url: "/carrinho" },
        { title: "RDV", url: "/rdv" },
        { title: "Aprovação RDV", url: "/aprovacaordv" },
        { title: "Gestão de Pessoas", url: "/gestao-pessoas" },
        { title: "Pagamentos G. Pessoas", url: "/pagamentos-rh" },
        { title: "Pagamentos Impostos", url: "/pagamentos-impostos" },
        { title: "Documentos Externos", url: "/documentos-externos" },
        { title: "Aprovadores Borderô", url: "/borderoaprovadores" },
        { title: "Aprovadores Restritos", url: "/restritoaprovadores" },
        { title: "Alçadas", url: "/alcadas" },
        { title: "Painel Fiscal", url: "/fiscal" },
        { title: "Centros de custos", url: "/centros-custos" },
        { title: "Usuários", url: "/usuarios" },
      ],
    },
  ] as NavSection[],
};
