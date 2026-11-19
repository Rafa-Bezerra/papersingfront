// lib/patient-data.ts
export interface NavItem {
  title: string;
  url: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Enquanto true: só Admin vê o Frotas (a permissão Frotas ainda não libera). Igual a GusuarioFrotas.SoAdminNaImplantacao na API. */
export const FROTAS_SO_ADMIN = false;
/** Enquanto true: Frotas fora do menu e da rota (código fica no repo; deploy use prepare-publish.ps1 -SemFrotas). */
export const FROTAS_FORA_DO_DEPLOY = false;
/** Enquanto true: Raphaela assistente e tour guiado fora do build de produção; no `npm run dev` continuam para testes. */
export const RAPHAELA_FORA_DO_DEPLOY = true;

export const data = {
  navMain: [
    {
      title: "Módulos",
      items: [
        { title: "Inicio", url: "/home" },
        { title: "Pendências", url: "/pendencias" },
        { title: "Solicitação de compra", url: "/solicitacoes" },
        { title: "Recebimento de materiais", url: "/requisicoes" },
        { title: "Controle imobilizado", url: "/controle" },
        { title: "Ordem de compra", url: "/ordens" },
        // "Aquisição de serviços" (/aquisicoes) oculto do menu por decisão em reunião; a rota continua existindo.
        // "Documentos" fica dentro do WaySign (aba Documentos internos); a rota /documentos continua para links e pendências.
        { title: "WaySign", url: "/docusign" },
        { title: "Projetos", url: "/projetos" },
        { title: "Receitas", url: "/receitas" },
        { title: "Extrato gestor", url: "/extrato-gestor" },
        { title: "Controle medição", url: "/controle-medicao" },
        { title: "Contratos", url: "/contratos" },
        { title: "Frotas", url: "/frotas" },
        { title: "Pagamentos CI", url: "/comunicados" },
        { title: "Borderô", url: "/bordero" },
        { title: "Carrinho", url: "/carrinho" },
        { title: "RDV", url: "/rdv" },
        { title: "Aprovação RDV", url: "/aprovacaordv" },
        { title: "Restritos", url: "/gestao-pessoas" },
        { title: "Pagamentos G. Pessoas", url: "/pagamentos-rh" },
        { title: "Pagamentos Impostos", url: "/pagamentos-impostos" },
        { title: "Documentos Externos", url: "/documentos-externos" },
        { title: "Aprovadores Borderô", url: "/borderoaprovadores" },
        { title: "Aprovadores Restritos", url: "/restritoaprovadores" },
        { title: "Alçadas", url: "/alcadas" },
        { title: "Disparos", url: "/disparos" },
        { title: "Painel Fiscal", url: "/fiscal" },
        { title: "Centros de custos", url: "/centros-custos" },
        { title: "Usuários", url: "/usuarios" },
      ],
    },
  ] as NavSection[],
};
