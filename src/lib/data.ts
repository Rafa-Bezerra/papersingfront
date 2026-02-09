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
        // === MÓDULOS GESTÃO DE PESSOAS (3 novos - ver comentários nos services e páginas) ===
        // { title: "Gestão de Pessoas", url: "/gestao-pessoas" },           // Contratos com STATUS_RESTRICAO = RESTRITO
        // { title: "Pagamentos G. Pessoas", url: "/pagamentos-gestao-pessoas" }, // Pagamentos folha (PAGAMENTO_RH, em aberto)
        // { title: "Pagamentos Impostos", url: "/pagamentos-impostos" },    // Pagamentos impostos (IRF, ISS, PIS, COFINS, em aberto)
        { title: "Aprovadores Borderô", url: "/borderoaprovadores" },
        { title: "Alçadas", url: "/alcadas" },
        // Novo módulo de administração de centros de custos.
        { title: "Centros de custos", url: "/centros-custos" },
        { title: "Usuários", url: "/usuarios" },
      ],
    },
  ] as NavSection[],
};
