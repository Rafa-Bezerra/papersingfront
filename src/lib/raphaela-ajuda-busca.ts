import type { RaphaelaAjudaArtigo } from '@/lib/raphaela-ajuda-permissoes'

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Palavras que aparecem em qualquer pergunta e não ajudam a achar o tema. */
const PALAVRAS_VAZIAS = new Set(
  (
    'a o as os um uma uns umas de do da dos das no na nos nas em e ou se com por pra para ao aos sobre ' +
    'como que qual quais onde quando fica ficam faco fazer faz posso pode podemos consigo quero queria preciso gostaria ' +
    'ver vejo veja vemos acho achar encontro encontrar saber sei mostra mostrar ' +
    'eu meu minha meus minhas me te voce aqui la isso esse essa este esta estou tem ter ser sao vai ' +
    'oi ola bom boa dia tarde noite tudo bem obrigado obrigada valeu ajuda duvida sistema papersign tela'
  ).split(' ')
)

function palavras(texto: string): string[] {
  return normalizar(texto).split(/[^a-z0-9]+/).filter((t) => t.length >= 2)
}

function tokensConsulta(q: string): string[] {
  return palavras(q).filter((t) => !PALAVRAS_VAZIAS.has(t))
}

/** "assinar" e "assinatura", "documento" e "documentos" caem na mesma raiz. */
function raiz(p: string): string {
  return p.length > 5 ? p.slice(0, 5) : p
}

function contem(texto: string, token: string): boolean {
  const r = raiz(token)
  return palavras(texto).some((w) => w === token || raiz(w) === r || (token.length >= 3 && w.startsWith(token)))
}

const SO_CUMPRIMENTO = /^(oi+|ola|opa|bom dia|boa tarde|boa noite|tudo bem|e ai|obrigad[oa]|valeu)[\s!.?,]*$/

/** Mensagem só de cumprimento/agradecimento ("oi", "bom dia", "obrigada"). */
export function ehCumprimento(q: string): boolean {
  return SO_CUMPRIMENTO.test(normalizar(q))
}

export type ResultadoBuscaAjuda = {
  artigo: RaphaelaAjudaArtigo
  score: number
}

export function buscarArtigosAjuda(artigos: RaphaelaAjudaArtigo[], consulta: string, limite = 5): ResultadoBuscaAjuda[] {
  const tokens = tokensConsulta(consulta)
  if (tokens.length === 0) return []

  const scored: ResultadoBuscaAjuda[] = []

  for (const artigo of artigos) {
    const titulo = artigo.titulo ?? ''
    const resumo = artigo.resumo ?? ''
    const mensagem = artigo.mensagem ?? ''
    const chaves = artigo.palavrasChave ?? ''

    let score = 0
    let fortes = 0
    let achados = 0
    for (const t of tokens) {
      const emChaves = contem(chaves, t)
      const emTitulo = contem(titulo, t)
      const emResumo = contem(resumo, t)
      const emMensagem = contem(mensagem, t)
      if (emChaves) score += 12
      if (emTitulo) score += 8
      if (emResumo) score += 4
      if (emMensagem) score += 2
      if (emChaves || emTitulo || emResumo) fortes++
      if (emChaves || emTitulo || emResumo || emMensagem) achados++
    }
    // A maioria das palavras da pergunta precisa bater, e uma delas no título, resumo ou palavras-chave.
    if (fortes > 0 && achados * 2 > tokens.length) scored.push({ artigo, score })
  }

  scored.sort((a, b) => b.score - a.score || a.artigo.ordem - b.artigo.ordem)
  const melhor = scored[0]?.score ?? 0
  return scored.filter((s) => s.score * 2 >= melhor).slice(0, limite)
}

/** Quebra **negrito** simples em linhas para exibir. */
export function formatarMensagemAjuda(mensagem: string): string[] {
  return (mensagem ?? '').split(/\r?\n/).filter((l) => l.trim().length > 0)
}
