'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Download, FileSpreadsheet, FileText, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getAll as getAllUsuarios,
  listarAuditoriaPermissoes,
  type UsuarioPermAuditItem,
} from '@/services/usuariosService'
import type { Usuario } from '@/types/Usuario'
import type { UsuarioAgrupadoPorLogin } from '@/lib/usuarioPermissoesRelatorio'
import {
  COLUNAS_PERMISSAO,
  UNIDADES_RELATORIO,
  type FiltroPermissaoRelatorio,
  agruparUsuariosPorLogin,
  basesAgrupadasLabel,
  buscarColaboradoresAgrupados,
  filtrarUsuariosPorPermissao,
  formatarDetalheAuditoria,
  labelMesReferencia,
  labelPermissaoRelatorio,
  limitesMesReferencia,
  mesReferenciaAtual,
  resolverCadastrosDoUsuario,
} from '@/lib/usuarioPermissoesRelatorio'
import {
  gerarPdfAlteracoesMes,
  gerarPdfMatrizPermissoes,
  gerarPdfRelatorioUsuario,
  gerarPdfUsuariosComPermissao,
  salvarPdf,
  slugArquivo,
  usuarioCorrespondeBusca,
} from '@/lib/usuarioPermissoesRelatorioPdf'

function labelAcao(acao: string) {
  switch ((acao || '').toUpperCase()) {
    case 'CRIACAO':
      return 'Criação'
    case 'ALTERACAO':
      return 'Alteração'
    case 'COPIA':
      return 'Cópia'
    case 'COPIA_ATUALIZA':
      return 'Cópia (atualização)'
    case 'UNIFICACAO':
      return 'Unificação'
    default:
      return acao
  }
}

function formatDataHora(raw: string) {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('pt-BR')
}

/** CSC: relatório mensal + PDF por usuário (permissões atuais e histórico). */
export default function RelatorioPermissoesUsuariosPanel() {
  const [mesRef, setMesRef] = useState(mesReferenciaAtual)
  const [unidade, setUnidade] = useState<string>('todas')
  const [q, setQ] = useState('')
  const [usuarioPdf, setUsuarioPdf] = useState('')
  const [permissaoFiltro, setPermissaoFiltro] = useState<FiltroPermissaoRelatorio>('todas')
  const [buscaCadastro, setBuscaCadastro] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [alteracoes, setAlteracoes] = useState<UsuarioPermAuditItem[]>([])
  const [matriz, setMatriz] = useState<Usuario[]>([])
  const [catalogoColaboradores, setCatalogoColaboradores] = useState<Usuario[]>([])
  const [loadingBuscaColab, setLoadingBuscaColab] = useState(false)
  const [colabBuscaAberta, setColabBuscaAberta] = useState(false)
  const [colabSelecionado, setColabSelecionado] = useState<UsuarioAgrupadoPorLogin | null>(null)
  const colabBuscaRef = useRef<HTMLDivElement>(null)

  const limites = useMemo(() => limitesMesReferencia(mesRef), [mesRef])

  const sugestoesColaborador = useMemo(
    () => buscarColaboradoresAgrupados(catalogoColaboradores, usuarioPdf),
    [catalogoColaboradores, usuarioPdf]
  )

  const carregarCatalogoColaboradores = useCallback(async () => {
    if (catalogoColaboradores.length > 0) return catalogoColaboradores
    setLoadingBuscaColab(true)
    try {
      const users = await getAllUsuarios(undefined)
      setCatalogoColaboradores(users)
      return users
    } catch (err) {
      toast.error((err as Error).message)
      return []
    } finally {
      setLoadingBuscaColab(false)
    }
  }, [catalogoColaboradores.length])

  useEffect(() => {
    void carregarCatalogoColaboradores()
  }, [carregarCatalogoColaboradores])

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (colabBuscaRef.current && !colabBuscaRef.current.contains(e.target as Node)) {
        setColabBuscaAberta(false)
      }
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  async function executarBuscaColaborador() {
    const termo = usuarioPdf.trim()
    if (termo.length < 2) {
      toast.error('Digite pelo menos 2 caracteres para buscar.')
      return
    }
    const users = await carregarCatalogoColaboradores()
    const lista = buscarColaboradoresAgrupados(users, termo)
    setColabBuscaAberta(true)
    if (lista.length === 0) {
      toast.error('Nenhum colaborador encontrado com esse texto.')
      setColabSelecionado(null)
      return
    }
    if (lista.length === 1) {
      selecionarColaborador(lista[0])
      toast.success(`Selecionado: ${lista[0].nome} (${lista[0].codusuario})`)
    } else {
      setColabSelecionado(null)
      toast.message(`${lista.length} resultado(s). Clique na pessoa correta na lista.`)
    }
  }

  function selecionarColaborador(g: UsuarioAgrupadoPorLogin) {
    setUsuarioPdf(g.codusuario)
    setColabSelecionado(g)
    setColabBuscaAberta(false)
  }

  const usuariosComPermissaoCadastro = useMemo((): UsuarioAgrupadoPorLogin[] => {
    if (permissaoFiltro === 'todas') return []
    return agruparUsuariosPorLogin(filtrarUsuariosPorPermissao(matriz, permissaoFiltro))
  }, [matriz, permissaoFiltro])

  const usuariosPorPermissao = useMemo(() => {
    const t = buscaCadastro.trim()
    if (!t) return usuariosComPermissaoCadastro
    return usuariosComPermissaoCadastro.filter(g =>
      g.cadastros.some(u => usuarioCorrespondeBusca(u, t))
    )
  }, [usuariosComPermissaoCadastro, buscaCadastro])

  async function carregar() {
    if (!limites) {
      toast.error('Selecione um mês válido.')
      return
    }
    setLoading(true)
    try {
      const [aud, users] = await Promise.all([
        listarAuditoriaPermissoes({
          de: limites.de,
          ate: limites.ate,
          unidade: unidade === 'todas' ? undefined : unidade,
          q: q.trim() || undefined,
          top: 5000,
        }),
        getAllUsuarios(unidade === 'todas' ? undefined : unidade),
      ])
      setAlteracoes(aud)
      setMatriz(users)
    } catch (err) {
      toast.error((err as Error).message)
      setAlteracoes([])
      setMatriz([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesRef, unidade])

  function unidadeLabel() {
    return unidade === 'todas' ? 'Todas as bases' : unidade
  }

  async function baixarPdfUsuario(loginInformado?: string) {
    const termo = (loginInformado ?? colabSelecionado?.codusuario ?? usuarioPdf).trim()
    if (!termo) {
      toast.error('Busque e selecione o colaborador (ex.: eubertson).')
      return
    }
    if (!limites) return

    setLoadingPdf(true)
    try {
      const users =
        catalogoColaboradores.length > 0
          ? catalogoColaboradores
          : await getAllUsuarios(undefined)
      if (!catalogoColaboradores.length) setCatalogoColaboradores(users)
      const resolvido = resolverCadastrosDoUsuario(users, termo)
      if (!resolvido.ok) {
        if (resolvido.motivo === 'ambiguo') {
          toast.error(
            `Vários logins encontrados. Use o login exato: ${(resolvido.logins ?? []).slice(0, 5).join(', ')}`
          )
        } else {
          toast.error('Usuário não encontrado em nenhuma base. Confira o login.')
        }
        return
      }

      const { login, nome, cadastros } = resolvido

      const [historicoUsuario, alteracoesMes] = await Promise.all([
        listarAuditoriaPermissoes({ q: login, top: 5000 }),
        listarAuditoriaPermissoes({
          de: limites.de,
          ate: limites.ate,
          q: login,
          top: 5000,
        }),
      ])

      const doc = gerarPdfRelatorioUsuario({
        login,
        nome,
        mesRef,
        periodoDe: limites.de,
        periodoAte: limites.ate,
        cadastrosPorBase: cadastros,
        alteracoesNoMes: alteracoesMes,
        historicoUsuario,
      })

      salvarPdf(doc, `papersign-usuario-${slugArquivo(login)}-${mesRef}.pdf`)
      toast.success(
        `PDF de ${nome}: ${cadastros.length} base(s) e histórico de permissões incluído.`
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingPdf(false)
    }
  }

  async function baixarPdfMatriz() {
    if (!limites) return
    setLoadingPdf(true)
    try {
      const users = await getAllUsuarios(unidade === 'todas' ? undefined : unidade)
      setMatriz(users)
      const doc = gerarPdfMatrizPermissoes({
        mesRef,
        unidadeLabel: unidadeLabel(),
        usuarios: users,
      })
      const slug = unidade === 'todas' ? 'todas-bases' : slugArquivo(unidade)
      salvarPdf(doc, `papersign-matriz-permissoes-${slug}-${mesRef}.pdf`)
      toast.success(`PDF com ${users.length} usuários.`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingPdf(false)
    }
  }

  async function baixarPdfPorPermissao() {
    if (permissaoFiltro === 'todas') {
      toast.error('Selecione uma permissão (ex.: Admin) antes de baixar o PDF.')
      return
    }
    if (!limites) return

    const label = labelPermissaoRelatorio(permissaoFiltro)
    setLoadingPdf(true)
    try {
      const users =
        matriz.length > 0
          ? matriz
          : await getAllUsuarios(unidade === 'todas' ? undefined : unidade)
      if (!matriz.length) setMatriz(users)

      const cadastros = filtrarUsuariosPorPermissao(users, permissaoFiltro)
      const grupos = agruparUsuariosPorLogin(cadastros)

      if (grupos.length === 0) {
        toast.error(`Nenhum usuário com permissão ${label} na base selecionada.`)
        return
      }

      const doc = gerarPdfUsuariosComPermissao({
        mesRef,
        unidadeLabel: unidadeLabel(),
        permissaoLabel: label,
        permissaoSlug: permissaoFiltro,
        usuarios: cadastros,
      })
      const slugBase = unidade === 'todas' ? 'todas-bases' : slugArquivo(unidade)
      salvarPdf(doc, `papersign-todos-${slugArquivo(permissaoFiltro)}-${slugBase}-${mesRef}.pdf`)
      toast.success(`PDF baixado: ${grupos.length} pessoa(s) com ${label}.`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingPdf(false)
    }
  }

  const labelBotaoPdfPermissao =
    permissaoFiltro === 'todas'
      ? 'Baixar PDF da lista'
      : `Baixar PDF — todos com ${labelPermissaoRelatorio(permissaoFiltro)}`

  function baixarPdfAlteracoesMes() {
    if (!limites || alteracoes.length === 0) {
      toast.error('Nenhuma alteração no período. Atualize a lista.')
      return
    }
    const doc = gerarPdfAlteracoesMes({
      mesRef,
      periodoDe: limites.de,
      periodoAte: limites.ate,
      unidadeLabel: unidadeLabel(),
      itens: alteracoes,
    })
    const slug = unidade === 'todas' ? 'todas-bases' : slugArquivo(unidade)
    salvarPdf(doc, `papersign-alteracoes-${slug}-${mesRef}.pdf`)
    toast.success('PDF das alterações do mês baixado.')
  }

  const colunasCadastro = useMemo<ColumnDef<UsuarioAgrupadoPorLogin>[]>(
    () => [
      {
        accessorKey: 'codusuario',
        header: 'Login',
      },
      {
        accessorKey: 'nome',
        header: 'Nome',
      },
      {
        id: 'bases',
        header: 'Bases com a permissão',
        cell: ({ row }) => (
          <div className="max-w-md text-sm text-muted-foreground">
            {basesAgrupadasLabel(row.original.bases)}
          </div>
        ),
      },
      {
        accessorKey: 'ativoLabel',
        header: 'Ativo',
      },
      {
        id: 'qtdBases',
        header: 'Qtd. bases',
        cell: ({ row }) => row.original.bases.length,
      },
    ],
    []
  )

  const colunas = useMemo<ColumnDef<UsuarioPermAuditItem>[]>(
    () => [
      {
        accessorKey: 'dataHora',
        header: 'Quando',
        cell: ({ row }) => formatDataHora(row.original.dataHora),
      },
      {
        accessorKey: 'acao',
        header: 'Ação',
        cell: ({ row }) => labelAcao(row.original.acao),
      },
      {
        id: 'quem',
        header: 'Quem fez',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="text-sm">
              <div className="font-medium">{r.actorNome || r.actorCodusuario}</div>
              <div className="text-muted-foreground text-xs">{r.actorCodusuario}</div>
            </div>
          )
        },
      },
      {
        id: 'alvo',
        header: 'Usuário alterado',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="text-sm">
              <div className="font-medium">{r.targetNome || r.targetCodusuario}</div>
              <div className="text-muted-foreground text-xs">
                {r.targetCodusuario} · {r.targetUnidade}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'detalhe',
        header: 'Permissões / detalhe',
        cell: ({ row }) => (
          <div className="max-w-lg whitespace-pre-wrap text-sm text-muted-foreground">
            {formatarDetalheAuditoria(row.original.detalhe).join('\n')}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Relatório de permissões
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            PDF individual por login (bases + permissões) ou lista em PDF de quem tem Admin, Fiscal, etc.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void baixarPdfUsuario()} disabled={loadingPdf}>
            <FileText className="mr-2 h-4 w-4" />
            {loadingPdf ? 'Gerando PDF…' : 'PDF — bases do login'}
          </Button>
          <Button
            onClick={() => void baixarPdfPorPermissao()}
            disabled={loadingPdf || permissaoFiltro === 'todas'}
          >
            <Download className="mr-2 h-4 w-4" />
            {loadingPdf ? 'Gerando PDF…' : labelBotaoPdfPermissao}
          </Button>
          <Button variant="outline" onClick={() => void baixarPdfMatriz()} disabled={loadingPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF matriz (todos)
          </Button>
          <Button
            variant="outline"
            onClick={baixarPdfAlteracoesMes}
            disabled={loading || alteracoes.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            PDF alterações do mês
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mês de referência</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{labelMesReferencia(mesRef)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alterações no mês</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{loading ? '…' : alteracoes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cadastros na base</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{loading ? '…' : matriz.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {permissaoFiltro === 'todas' ? 'Filtro por permissão' : labelPermissaoRelatorio(permissaoFiltro)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {loading ? '…' : permissaoFiltro === 'todas' ? '—' : usuariosComPermissaoCadastro.length}
            </p>
            <CardDescription className="mt-1 text-xs">
              {permissaoFiltro === 'todas'
                ? 'Escolha uma permissão abaixo para ver a lista.'
                : 'Pessoas (login único); bases listadas na tabela.'}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF de um colaborador (bases + permissões + histórico)
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Exemplo: login <strong>eubertson</strong> — o PDF traz <strong>uma pessoa só</strong>: em quais bases ele
            tem cadastro, quais permissões em cada base e todo o histórico na auditoria (quem alterou e o que mudou).
            O mês acima só entra no resumo de quantas alterações houve no período.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative flex flex-col gap-1 min-w-[240px] flex-1" ref={colabBuscaRef}>
              <Label htmlFor="relUsuarioPdfColab">Buscar colaborador (login ou nome)</Label>
              <div className="flex gap-2">
                <Input
                  id="relUsuarioPdfColab"
                  placeholder="Digite e busque — ex.: eubers, eubertson"
                  value={usuarioPdf}
                  autoComplete="off"
                  onChange={e => {
                    setUsuarioPdf(e.target.value)
                    setColabSelecionado(null)
                    setColabBuscaAberta(e.target.value.trim().length >= 2)
                  }}
                  onFocus={() => {
                    if (usuarioPdf.trim().length >= 2) setColabBuscaAberta(true)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (colabSelecionado) void baixarPdfUsuario()
                      else void executarBuscaColaborador()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void executarBuscaColaborador()}
                  disabled={loadingBuscaColab}
                >
                  <SearchIcon className="mr-1 h-4 w-4" />
                  {loadingBuscaColab ? '…' : 'Buscar'}
                </Button>
              </div>
              {colabBuscaAberta && usuarioPdf.trim().length >= 2 && (
                <ul
                  className="absolute z-50 top-full mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
                  role="listbox"
                >
                  {sugestoesColaborador.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum resultado. Ajuste o texto e clique em Buscar.
                    </li>
                  ) : (
                    sugestoesColaborador.map(g => (
                      <li key={g.codusuario}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => selecionarColaborador(g)}
                        >
                          <span className="font-medium">{g.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {g.codusuario} · {g.bases.length} base(s): {basesAgrupadasLabel(g.bases)}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <Button
              size="lg"
              onClick={() => void baixarPdfUsuario()}
              disabled={loadingPdf || usuarioPdf.trim().length < 2}
            >
              <FileText className="mr-2 h-4 w-4" />
              {loadingPdf ? 'Gerando PDF…' : 'Baixar PDF do colaborador'}
            </Button>
          </div>
          {colabSelecionado && (
            <p className="text-sm text-muted-foreground border rounded-md bg-muted/40 px-3 py-2">
              Selecionado: <strong>{colabSelecionado.nome}</strong> ({colabSelecionado.codusuario}) — bases:{' '}
              {basesAgrupadasLabel(colabSelecionado.bases)}. Clique em Baixar PDF.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lista em PDF por permissão</CardTitle>
          <CardDescription>
            Vários usuários de uma vez (ex.: todos com <strong>Admin</strong>). Não use para um colaborador
            específico — use o card acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <Label>Permissão</Label>
            <Select
              value={permissaoFiltro}
              onValueChange={v => setPermissaoFiltro(v as FiltroPermissaoRelatorio)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione (ex.: Admin)" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todas">— Selecione uma permissão —</SelectItem>
                {COLUNAS_PERMISSAO.map(c => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <Label>Base</Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as bases</SelectItem>
                {UNIDADES_RELATORIO.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="lg"
            className="sm:mb-0"
            onClick={() => void baixarPdfPorPermissao()}
            disabled={loadingPdf || permissaoFiltro === 'todas'}
          >
            <Download className="mr-2 h-4 w-4" />
            {loadingPdf ? 'Gerando…' : labelBotaoPdfPermissao}
          </Button>
          {permissaoFiltro !== 'todas' && !loading && (
            <p className="text-sm text-muted-foreground sm:mb-2">
              {usuariosComPermissaoCadastro.length} usuário(s) com{' '}
              {labelPermissaoRelatorio(permissaoFiltro)} em {unidadeLabel()}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="relMes">Mês</Label>
            <Input
              id="relMes"
              type="month"
              value={mesRef}
              onChange={e => setMesRef(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <Label>Base</Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {UNIDADES_RELATORIO.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 min-w-[200px]">
            <Label htmlFor="relBuscaCadastro">Buscar no cadastro</Label>
            <Input
              id="relBuscaCadastro"
              placeholder="Nome ou login na lista…"
              value={buscaCadastro}
              onChange={e => setBuscaCadastro(e.target.value)}
            />
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Label htmlFor="relQ">Busca na tabela</Label>
            <Input
              id="relQ"
              placeholder="Filtrar alterações na tela…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void carregar()
                }
              }}
            />
          </div>
          <Button onClick={() => void carregar()} disabled={loading}>
            <SearchIcon className="mr-1 h-4 w-4" />
            {loading ? 'Atualizando…' : 'Atualizar'}
          </Button>
        </CardContent>
      </Card>

      {permissaoFiltro !== 'todas' && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                Usuários com permissão: {labelPermissaoRelatorio(permissaoFiltro)}
              </CardTitle>
              <CardDescription>
                Cadastro atual em {unidadeLabel()}
                {buscaCadastro.trim() ? ` · filtro “${buscaCadastro.trim()}”` : ''}.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => void baixarPdfPorPermissao()} disabled={loadingPdf}>
              <Download className="mr-2 h-4 w-4" />
              PDF ({usuariosComPermissaoCadastro.length} no total)
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable columns={colunasCadastro} data={usuariosPorPermissao} loading={loading} />
            {!loading && usuariosPorPermissao.length === 0 && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Nenhum usuário com essa permissão na base selecionada.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alterações de permissão no mês</CardTitle>
          <CardDescription>
            Criação, edição, cópia entre bases e unificação registradas em{' '}
            {limites ? `${limites.de} a ${limites.ate}` : '—'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={colunas} data={alteracoes} loading={loading} />
          {!loading && alteracoes.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Nenhuma alteração registrada neste mês para os filtros escolhidos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
