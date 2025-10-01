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
        { title: "Usuários", url: "/usuarios" },
      ],
    },
  ] as NavSection[],
};
