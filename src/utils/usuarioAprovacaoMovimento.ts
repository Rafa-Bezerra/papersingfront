import { normalizeUserCode } from '@/utils/functions';
import type { Requisicao_aprovacao } from '@/types/Requisicao';

export type SessionUsuarioAprovacao = {
  codusuario?: string;
  nome?: string;
  codusuarios_vinculados?: string[];
};

/** Códigos do usuário logado (login, nome e chapas com o mesmo e-mail em GUSUARIO). */
export function codigosUsuarioParaAprovacao(session: SessionUsuarioAprovacao): Set<string> {
  const codes = new Set<string>();
  const add = (v?: string | null) => {
    const n = normalizeUserCode(v);
    if (n) codes.add(n);
  };
  add(session.codusuario);
  add(session.nome);
  if (Array.isArray(session.codusuarios_vinculados)) {
    for (const c of session.codusuarios_vinculados) add(c);
  }
  return codes;
}

export function buildCodigosAprovacaoFromSession(): Set<string> {
  try {
    const raw = sessionStorage.getItem('userData');
    if (!raw) return new Set();
    const user = JSON.parse(raw) as Record<string, unknown>;
    return codigosUsuarioParaAprovacao({
      codusuario: String(user.codusuario ?? user.CODUSUARIO ?? ''),
      nome: String(user.nome ?? user.NOME ?? ''),
      codusuarios_vinculados: Array.isArray(user.codusuarios_vinculados)
        ? (user.codusuarios_vinculados as string[])
        : undefined,
    });
  } catch {
    return new Set();
  }
}

/** Compara login da alçada, nome exibido na grade e vínculos (e-mail/chapa). */
export function aprovadorEhUsuarioLogado(
  ap: Pick<Requisicao_aprovacao, 'usuario' | 'nome'> | string | undefined,
  logados: Set<string>
): boolean {
  if (!ap) return false;
  if (typeof ap === 'string') {
    const u = normalizeUserCode(ap);
    return u.length > 0 && logados.has(u);
  }
  const u = normalizeUserCode(ap.usuario);
  const n = normalizeUserCode(ap.nome);
  return (u.length > 0 && logados.has(u)) || (n.length > 0 && logados.has(n));
}

export function usuarioEhAprovadorNaLista(
  aprovacoes: Requisicao_aprovacao[],
  logados: Set<string>
): boolean {
  return aprovacoes.some((ap) => aprovadorEhUsuarioLogado(ap, logados));
}

export function nivelUsuarioNaLista(
  aprovacoes: Requisicao_aprovacao[],
  logados: Set<string>
): number {
  return aprovacoes.find((ap) => aprovadorEhUsuarioLogado(ap, logados))?.nivel ?? 1;
}
