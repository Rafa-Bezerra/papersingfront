import { API_BASE, headers } from "@/utils/constants";
import { Usuario, CreateUsuarioResultado, CopiarUsuarioResultado, UnidadeResultado } from "@/types/Usuario";
const caminho = "Usuarios";
const elemento_singular = "usuário";
const elemento_plural = "usuários";

export async function getAll(unidadeFiltro?: string): Promise<Usuario[]> {
    const qs = unidadeFiltro ? `?unidadeFiltro=${encodeURIComponent(unidadeFiltro)}` : "";
    const res = await fetch(`${API_BASE}/api/${caminho}${qs}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: unknown[] = await res.json();
    return list.map((raw) => {
        const apiData = raw as Record<string, unknown>;
        return {
            sequencial: (apiData.sequencial ?? apiData.SEQUENCIAL) as number,
            codusuario: String(apiData.codusuario ?? apiData.CODUSUARIO ?? ""),
            nome: String(apiData.nome ?? apiData.NOME ?? ""),
            empresa: String(apiData.empresa ?? apiData.EMPRESA ?? ""),
            unidade: String(apiData.unidade ?? apiData.UNIDADE ?? ""),
            codperfil: String(apiData.codperfil ?? apiData.CODPERFIL ?? ""),
            diretoria: String(apiData.diretoria ?? apiData.DIRETORIA ?? ""),
            email: String(apiData.email ?? apiData.EMAIL ?? ""),
            ativo: Boolean(apiData.ativo ?? apiData.ATIVO),
            datacriacao: String(apiData.datacriacao ?? apiData.DATACRIACAO ?? ""),
            codsistema: String(apiData.codsistema ?? apiData.CODSISTEMA ?? ""),
            admin: Boolean(apiData.admin ?? apiData.ADMIN),
            documentos: Boolean(apiData.documentos ?? apiData.DOCUMENTOS),
            bordero: Boolean(apiData.bordero ?? apiData.BORDERO),
            comunicados: Boolean(apiData.comunicados ?? apiData.COMUNICADOS),
            rdv: Boolean(apiData.rdv ?? apiData.RDV),
            externo: Boolean(apiData.externo ?? apiData.EXTERNO),
            restrito: Boolean(apiData.restrito ?? apiData.RESTRITO),
            ccusto: Boolean(apiData.ccusto ?? apiData.CCUSTO),
            administrativo: Boolean(apiData.administrativo ?? apiData.ADMINISTRATIVO),
            solicitante: Boolean(apiData.solicitante ?? apiData.SOLICITANTE),
            fiscal: Boolean(apiData.fiscal ?? apiData.FISCAL),
            pagamento_impostos: Boolean(
                apiData.pagamento_impostos ?? apiData.PAGAMENTO_IMPOSTOS ?? apiData.pagamentO_IMPOSTOS
            ),
            pagamento_rh: Boolean(
                apiData.pagamento_rh ?? apiData.PAGAMENTO_RH ?? apiData.pagamentO_RH
            ),
            gestao_pessoas: Boolean(
                apiData.gestao_pessoas ?? apiData.GESTAO_PESSOAS ?? apiData.gestaO_PESSOAS
            ),
            financeiro: Boolean(apiData.financeiro ?? apiData.FINANCEIRO ?? false),
            docusign: Boolean(apiData.docusign ?? apiData.DOCUSIGN ?? false),
            projetos: Boolean(apiData.projetos ?? apiData.PROJETOS ?? false),
            contratos: Boolean(apiData.contratos ?? apiData.CONTRATOS ?? false),
            financeiro_totvs: Boolean(
                apiData.financeiro_totvs ?? apiData.FINANCEIRO_TOTVS ?? apiData.financeirO_TOTVS ?? false
            ),
            receitas: Boolean(apiData.receitas ?? apiData.RECEITAS ?? false),
            extrato_gestor: Boolean(apiData.extrato_gestor ?? apiData.EXTRATO_GESTOR ?? false),
            controle_medicao: Boolean(apiData.controle_medicao ?? apiData.CONTROLE_MEDICAO ?? false),
        } as Usuario;
    });
}

export async function getElementById(id: number): Promise<Usuario> {
    const res = await fetch(
      `${API_BASE}/api/${caminho}/${id}`,
      { headers: headers() }
    )
  
    if (!res.ok) {
      const msg = await res.text()
      throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`)
    }
  
    const apiData = await res.json()
  
    const normalized: Usuario = {
      sequencial: apiData.sequencial ?? apiData.SEQUENCIAL,
      codusuario: apiData.codusuario ?? apiData.CODUSUARIO,
      nome: apiData.nome ?? apiData.NOME,
      empresa: apiData.empresa ?? apiData.EMPRESA,
      unidade: apiData.unidade ?? apiData.UNIDADE ?? "",
      codperfil: apiData.codperfil ?? apiData.CODPERFIL,
      diretoria: apiData.diretoria ?? apiData.DIRETORIA,
      email: apiData.email ?? apiData.EMAIL,
      ativo: apiData.ativo ?? apiData.ATIVO,
      datacriacao: apiData.datacriacao ?? apiData.DATACRIACAO,
      codsistema: apiData.codsistema ?? apiData.CODSISTEMA,
  
      admin: apiData.admin ?? apiData.ADMIN,
      documentos: apiData.documentos ?? apiData.DOCUMENTOS,
      bordero: apiData.bordero ?? apiData.BORDERO,
      comunicados: apiData.comunicados ?? apiData.COMUNICADOS,
      rdv: apiData.rdv ?? apiData.RDV,
      externo: apiData.externo ?? apiData.EXTERNO,
      restrito: apiData.restrito ?? apiData.RESTRITO,
      ccusto: apiData.ccusto ?? apiData.CCUSTO,
      administrativo: apiData.administrativo ?? apiData.ADMINISTRATIVO,
      solicitante: apiData.solicitante ?? apiData.SOLICITANTE,
      fiscal: apiData.fiscal ?? apiData.FISCAL,
  
      pagamento_impostos:
        apiData.pagamento_impostos ??
        apiData.PAGAMENTO_IMPOSTOS ??
        apiData.pagamentO_IMPOSTOS,
  
      pagamento_rh:
        apiData.pagamento_rh ??
        apiData.PAGAMENTO_RH ??
        apiData.pagamentO_RH,
  
      gestao_pessoas:
        apiData.gestao_pessoas ??
        apiData.GESTAO_PESSOAS ??
        apiData.gestaO_PESSOAS,

      financeiro: apiData.financeiro ?? apiData.FINANCEIRO ?? false,
      docusign: apiData.docusign ?? apiData.DOCUSIGN ?? false,
      projetos: apiData.projetos ?? apiData.PROJETOS ?? false,
      contratos: apiData.contratos ?? apiData.CONTRATOS ?? false,
      financeiro_totvs: apiData.financeiro_totvs ?? apiData.FINANCEIRO_TOTVS ?? apiData.financeirO_TOTVS ?? false,
      receitas: apiData.receitas ?? apiData.RECEITAS ?? false,
      extrato_gestor: apiData.extrato_gestor ?? apiData.EXTRATO_GESTOR ?? false,
      controle_medicao: apiData.controle_medicao ?? apiData.CONTROLE_MEDICAO ?? false,
    }

    return normalized
  }
  

export async function createElement(data: Usuario): Promise<CreateUsuarioResultado> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
    return res.json();
}

export async function updateElement(data: Usuario): Promise<void> {
    const payload = {
        NOME: data.nome,
        EMPRESA: data.empresa,
        CODPERFIL: data.codperfil,
        DIRETORIA: data.diretoria,
        EMAIL: data.email,
        ATIVO: data.ativo,
        CODSISTEMA: data.codsistema,

        ADMIN: data.admin,
        DOCUMENTOS: data.documentos,
        BORDERO: data.bordero,
        COMUNICADOS: data.comunicados,
        RDV: data.rdv,
        EXTERNO: data.externo,
        RESTRITO: data.restrito,
        CCUSTO: data.ccusto,
        ADMINISTRATIVO: data.administrativo,
        SOLICITANTE: data.solicitante,
        FISCAL: data.fiscal,

        PAGAMENTO_IMPOSTOS: data.pagamento_impostos,
        PAGAMENTO_RH: data.pagamento_rh,
        GESTAO_PESSOAS: data.gestao_pessoas,
        FINANCEIRO: data.financeiro,
        DOCUSIGN: data.docusign,
        PROJETOS: data.projetos,
        CONTRATOS: data.contratos,
        FINANCEIRO_TOTVS: data.financeiro_totvs,
        RECEITAS: data.receitas,
        EXTRATO_GESTOR: data.extrato_gestor,
        CONTROLE_MEDICAO: data.controle_medicao,
    }

    const res = await fetch(`${API_BASE}/api/${caminho}/editar/${data.sequencial}`, { method: "POST", headers: headers(), body: JSON.stringify(payload) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
export async function resetPassword(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/resetar_senha/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function copiarUsuario(sequencial: number, empresas: string[]): Promise<CopiarUsuarioResultado> {
    const res = await fetch(`${API_BASE}/api/${caminho}/copiar/${sequencial}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ empresas }),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao copiar ${elemento_singular}: ${msg}`);
    }
    const data = await res.json();
    return {
        codusuario: data.codusuario ?? data.Codusuario ?? "",
        nome: data.nome ?? data.Nome ?? "",
        unidadeOrigem: data.unidadeOrigem ?? data.UnidadeOrigem ?? "",
        resultados: (data.resultados ?? data.Resultados ?? []).map((r: Record<string, unknown>) => ({
            unidade: String(r.unidade ?? r.Unidade ?? ""),
            status: (r.status ?? r.Status ?? "erro") as UnidadeResultado["status"],
            sequencial: (r.sequencial ?? r.Sequencial) as number | undefined,
            mensagem: (r.mensagem ?? r.Mensagem) as string | undefined,
        })),
    };
}

export type UsuarioPermAuditItem = {
    id: number;
    dataHora: string;
    acao: string;
    actorCodusuario: string;
    actorNome?: string;
    actorUnidade?: string;
    targetCodusuario: string;
    targetNome?: string;
    targetUnidade: string;
    targetEmpresa?: string;
    targetSequencial?: number;
    detalhe?: string;
    ipOrigem?: string;
};

export async function listarAuditoriaPermissoes(params?: {
    de?: string;
    ate?: string;
    unidade?: string;
    q?: string;
    top?: number;
}): Promise<UsuarioPermAuditItem[]> {
    const qs = new URLSearchParams();
    if (params?.de) qs.set("de", params.de);
    if (params?.ate) qs.set("ate", params.ate);
    if (params?.unidade) qs.set("unidade", params.unidade);
    if (params?.q) qs.set("q", params.q);
    if (params?.top) qs.set("top", String(params.top));
    const url = `${API_BASE}/api/${caminho}/auditoria-permissoes${qs.toString() ? `?${qs}` : ""}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar auditoria: ${msg}`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    return list.map((r: Record<string, unknown>) => ({
        id: Number(r.id ?? r.Id ?? 0),
        dataHora: String(r.dataHora ?? r.DataHora ?? ""),
        acao: String(r.acao ?? r.Acao ?? ""),
        actorCodusuario: String(r.actorCodusuario ?? r.ActorCodusuario ?? ""),
        actorNome: (r.actorNome ?? r.ActorNome) as string | undefined,
        actorUnidade: (r.actorUnidade ?? r.ActorUnidade) as string | undefined,
        targetCodusuario: String(r.targetCodusuario ?? r.TargetCodusuario ?? ""),
        targetNome: (r.targetNome ?? r.TargetNome) as string | undefined,
        targetUnidade: String(r.targetUnidade ?? r.TargetUnidade ?? ""),
        targetEmpresa: (r.targetEmpresa ?? r.TargetEmpresa) as string | undefined,
        targetSequencial: (r.targetSequencial ?? r.TargetSequencial) as number | undefined,
        detalhe: (r.detalhe ?? r.Detalhe) as string | undefined,
        ipOrigem: (r.ipOrigem ?? r.IpOrigem) as string | undefined,
    }));
}

export type { Usuario }
export type { CopiarUsuarioResultado, CreateUsuarioResultado, UnidadeResultado } from "@/types/Usuario";
