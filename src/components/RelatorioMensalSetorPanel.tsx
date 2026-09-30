'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { Bookmark, Download, FileText, Mail, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAll as getAllUsuarios } from '@/services/usuariosService'
import {
  atualizarReferenciaRelatorioMensal,
  criarReferenciaRelatorioMensal,
  enviarRelatorioMensalEmail,
  obterReferenciaRelatorioMensal,
  type RelatorioMensalRef,
} from '@/services/relatorioMensalSetorService'
import type { Usuario } from '@/types/Usuario'
import {
  UNIDADES_RELATORIO,
  agruparUsuariosPorLogin,
  basesAgrupadasLabel,
  buscarColaboradoresAgrupados,
  labelMesReferencia,
  limitesMesReferencia,
  mesReferenciaAtual,
  resolverCadastrosDoUsuario,
  type UsuarioAgrupadoPorLogin,
} from '@/lib/usuarioPermissoesRelatorio'
import {
  gerarPdfRelatorioMensalSetor,
  pdfParaBase64,
  salvarPdf,
  slugArquivo,
  usuarioCorrespondeBusca,
} from '@/lib/usuarioPermissoesRelatorioPdf'
import { stripDiacritics } from '@/utils/functions'

function normLogin(s: string) {
  return stripDiacritics(s.toLowerCase().trim())
}

/** Job mensal usa dia fixo; 28 evita falha em fevereiro. */
function clampDiaEnvioAutomatico(n: number) {
  if (!Number.isFinite(n)) return 1
  return Math.min(28, Math.max(1, Math.round(n)))
}

type ColaboradorPdf = {
  login: string
  nome: string
  email: string
  cadastros: Usuario[]
}

type RelatorioMensalSetorPanelProps = {
  /** ID vindo de ?pref= na URL (aba Preferências de envio → Abrir no relatório). */
  prefCarregarId?: number | null
}

export default function RelatorioMensalSetorPanel({ prefCarregarId = null }: RelatorioMensalSetorPanelProps) {
  const router = useRouter()
  const [mesRef, setMesRef] = useState(mesReferenciaAtual)
  const [nomeSetor, setNomeSetor] = useState('')
  const [assinanteNome, setAssinanteNome] = useState('')
  const [assinanteLogin, setAssinanteLogin] = useState('')
  const [assinanteUnidade, setAssinanteUnidade] = useState('')
  const [assinanteCargo, setAssinanteCargo] = useState('Gestor(a) da área')
  const [emailDestino, setEmailDestino] = useState('')
  const [emailCopia, setEmailCopia] = useState('')
  const [unidade, setUnidade] = useState<string>('todas')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [catalogo, setCatalogo] = useState<Awaited<ReturnType<typeof getAllUsuarios>>>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const [gestorBusca, setGestorBusca] = useState('')
  const [gestorAberta, setGestorAberta] = useState(false)
  const gestorRef = useRef<HTMLDivElement>(null)

  const [tituloRef, setTituloRef] = useState('')
  const [envioAutomatico, setEnvioAutomatico] = useState(false)
  const [diaEnvio, setDiaEnvio] = useState(1)
  const [refEditId, setRefEditId] = useState<number | null>(null)
  const [prefCarregadoId, setPrefCarregadoId] = useState<number | null>(null)

  const limites = useMemo(() => limitesMesReferencia(mesRef), [mesRef])

  const aplicarReferencia = useCallback((ref: RelatorioMensalRef) => {
    setRefEditId(ref.id)
    setTituloRef(ref.titulo)
    setNomeSetor(ref.nomeSetor)
    setAssinanteNome(ref.assinanteNome)
    setAssinanteLogin(ref.assinanteLogin ?? '')
    setAssinanteUnidade(ref.assinanteUnidade ?? '')
    setGestorBusca(ref.assinanteLogin ? `${ref.assinanteNome} (${ref.assinanteLogin})` : ref.assinanteNome)
    setAssinanteCargo(ref.assinanteCargo ?? 'Gestor(a) da área')
    setEmailDestino(ref.emailDestino)
    setEmailCopia(ref.emailCopia ?? '')
    setEnvioAutomatico(ref.envioAutomatico)
    setDiaEnvio(clampDiaEnvioAutomatico(ref.diaEnvio))
    setSelecionados(
      new Set(
        (ref.colaboradores.length > 0
          ? ref.colaboradores.map(c => c.codusuario)
          : ref.logins
        ).map(normLogin)
      )
    )
  }, [])

  useEffect(() => {
    if (!prefCarregarId) {
      setPrefCarregadoId(null)
      return
    }
    if (prefCarregadoId === prefCarregarId) return
    void (async () => {
      try {
        const ref = await obterReferenciaRelatorioMensal(prefCarregarId)
        aplicarReferencia(ref)
        setPrefCarregadoId(prefCarregarId)
        toast.success(`Modelo “${ref.titulo}” carregado.`)
      } catch (err) {
        toast.error((err as Error).message)
      }
    })()
  }, [prefCarregarId, prefCarregadoId, aplicarReferencia])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const users = await getAllUsuarios(unidade === 'todas' ? undefined : unidade)
      setCatalogo(users)
    } catch (err) {
      toast.error((err as Error).message)
      setCatalogo([])
    } finally {
      setLoading(false)
    }
  }, [unidade])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (gestorRef.current && !gestorRef.current.contains(e.target as Node)) {
        setGestorAberta(false)
      }
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const gruposVisiveis = useMemo(() => {
    const todos = agruparUsuariosPorLogin(catalogo)
    const q = busca.trim()
    if (!q) return todos
    return todos.filter(g => g.cadastros.some(u => usuarioCorrespondeBusca(u, q)))
  }, [catalogo, busca])

  const sugestoesGestor = useMemo(
    () => buscarColaboradoresAgrupados(catalogo, gestorBusca, 12),
    [catalogo, gestorBusca]
  )

  const todosVisiveisSelecionados =
    gruposVisiveis.length > 0 &&
    gruposVisiveis.every(g => selecionados.has(normLogin(g.codusuario)))

  function toggleLogin(login: string, checked: boolean) {
    const k = normLogin(login)
    setSelecionados(prev => {
      const next = new Set(prev)
      if (checked) next.add(k)
      else next.delete(k)
      return next
    })
  }

  function toggleTodosVisiveis(checked: boolean) {
    if (!checked) {
      setSelecionados(prev => {
        const next = new Set(prev)
        gruposVisiveis.forEach(g => next.delete(normLogin(g.codusuario)))
        return next
      })
      return
    }
    setSelecionados(prev => {
      const next = new Set(prev)
      gruposVisiveis.forEach(g => next.add(normLogin(g.codusuario)))
      return next
    })
  }

  function selecionarGestor(g: UsuarioAgrupadoPorLogin) {
    setAssinanteNome(g.nome)
    setAssinanteLogin(g.codusuario)
    const un =
      g.cadastros.find(c => (c.unidade ?? '').toUpperCase() === 'WAY CSC')?.unidade ??
      g.cadastros[0]?.unidade ??
      g.bases[0] ??
      ''
    setAssinanteUnidade(un)
    setGestorBusca(`${g.nome} (${g.codusuario})`)
    if (g.email?.trim()) setEmailDestino(g.email.trim())
    setGestorAberta(false)
  }

  async function expandirColaboradoresGusuario(): Promise<
    { unidade: string; codusuario: string }[]
  > {
    const users = await garantirCatalogoCompleto()
    const out: { unidade: string; codusuario: string }[] = []
    for (const k of selecionados) {
      const grupo = agruparUsuariosPorLogin(users).find(g => normLogin(g.codusuario) === k)
      const termo = grupo?.codusuario ?? k
      const resolvido = resolverCadastrosDoUsuario(users, termo)
      if (!resolvido.ok) continue
      for (const u of resolvido.cadastros) {
        const un = (u.unidade ?? '').trim()
        const cod = (u.codusuario ?? '').trim()
        if (!un || !cod) continue
        if (!out.some(x => x.unidade === un && normLogin(x.codusuario) === normLogin(cod))) {
          out.push({ unidade: un, codusuario: cod })
        }
      }
    }
    return out
  }

  async function garantirCatalogoCompleto() {
    if (unidade === 'todas' && catalogo.length > 0) return catalogo
    const full = await getAllUsuarios(undefined)
    setCatalogo(full)
    return full
  }

  function validarFormulario(): { setor: string; gestor: string } | null {
    const setor = nomeSetor.trim()
    const gestor = assinanteNome.trim()
    if (!setor) {
      toast.error('Informe o nome do setor ou área.')
      return null
    }
    if (!gestor) {
      toast.error('Informe quem assina (gestor da área).')
      return null
    }
    if (selecionados.size === 0) {
      toast.error('Selecione ao menos um colaborador.')
      return null
    }
    if (!limites) {
      toast.error('Mês de referência inválido.')
      return null
    }
    return { setor, gestor }
  }

  async function montarPdf(): Promise<{
    doc: ReturnType<typeof gerarPdfRelatorioMensalSetor>
    nomeArquivo: string
    colaboradores: ColaboradorPdf[]
  } | null> {
    const ok = validarFormulario()
    if (!ok || !limites) return null

    const users = await garantirCatalogoCompleto()
    const colaboradores: ColaboradorPdf[] = []

    for (const k of selecionados) {
      const grupo = agruparUsuariosPorLogin(users).find(g => normLogin(g.codusuario) === k)
      const termo = grupo?.codusuario ?? k
      const resolvido = resolverCadastrosDoUsuario(users, termo)
      if (!resolvido.ok) continue
      colaboradores.push({
        login: resolvido.login,
        nome: resolvido.nome,
        email: resolvido.cadastros.find(u => u.email)?.email ?? resolvido.cadastros[0]?.email ?? '',
        cadastros: resolvido.cadastros,
      })
    }

    colaboradores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    if (colaboradores.length === 0) {
      toast.error('Não foi possível montar os cadastros dos colaboradores selecionados.')
      return null
    }

    const doc = gerarPdfRelatorioMensalSetor({
      mesRef,
      periodoDe: limites.de,
      periodoAte: limites.ate,
      nomeSetor: ok.setor,
      assinanteNome: ok.gestor,
      assinanteLogin: assinanteLogin.trim() || undefined,
      assinanteCargo: assinanteCargo.trim() || undefined,
      colaboradores,
    })

    const nomeArquivo = `papersign-relatorio-mensal-${slugArquivo(ok.setor)}-${mesRef}.pdf`
    return { doc, nomeArquivo, colaboradores }
  }

  async function baixarPdf() {
    setLoadingPdf(true)
    try {
      const built = await montarPdf()
      if (!built) return
      salvarPdf(built.doc, built.nomeArquivo)
      toast.success(
        `PDF baixado: ${built.colaboradores.length} colaborador(es) · ${labelMesReferencia(mesRef)}.`
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingPdf(false)
    }
  }

  async function enviarPorEmail() {
    const email = emailDestino.trim()
    if (!email) {
      toast.error('Informe o e-mail de destino (ex.: do gestor que assina).')
      return
    }

    setLoadingEmail(true)
    try {
      const built = await montarPdf()
      if (!built) return

      const ok = validarFormulario()
      if (!ok) return

      await enviarRelatorioMensalEmail({
        email,
        emailCopia: emailCopia.trim() || undefined,
        nomeSetor: ok.setor,
        mesRef,
        assinanteNome: ok.gestor,
        qtdColaboradores: built.colaboradores.length,
        nomeArquivo: built.nomeArquivo,
        pdfBase64: pdfParaBase64(built.doc),
      })
      toast.success(`E-mail enviado para ${email}.`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingEmail(false)
    }
  }

  async function baixarEEnviar() {
    const email = emailDestino.trim()
    if (!email) {
      toast.error('Informe o e-mail de destino para enviar.')
      return
    }
    setLoadingPdf(true)
    setLoadingEmail(true)
    try {
      const built = await montarPdf()
      if (!built) return
      salvarPdf(built.doc, built.nomeArquivo)

      const ok = validarFormulario()
      if (!ok) return

      await enviarRelatorioMensalEmail({
        email,
        emailCopia: emailCopia.trim() || undefined,
        nomeSetor: ok.setor,
        mesRef,
        assinanteNome: ok.gestor,
        qtdColaboradores: built.colaboradores.length,
        nomeArquivo: built.nomeArquivo,
        pdfBase64: pdfParaBase64(built.doc),
      })
      toast.success(`PDF baixado e e-mail enviado para ${email}.`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingPdf(false)
      setLoadingEmail(false)
    }
  }

  const ocupado = loadingPdf || loadingEmail

  async function montarPayloadReferencia() {
    const ok = validarFormulario()
    if (!ok) return null
    const colaboradores = await expandirColaboradoresGusuario()
    if (colaboradores.length === 0) {
      toast.error('Nenhum cadastro em GUSUARIO para os colaboradores selecionados.')
      return null
    }
    const titulo = tituloRef.trim() || `${ok.setor} — ${mesRef}`
    const assCod = assinanteLogin.trim()
    const assUn = assinanteUnidade.trim()
    return {
      titulo,
      nomeSetor: ok.setor,
      assinanteNome: ok.gestor,
      assinanteUnidade: assCod && assUn ? assUn : undefined,
      assinanteCodusuario: assCod || undefined,
      assinanteCargo: assinanteCargo.trim() || undefined,
      emailDestino: emailDestino.trim(),
      emailCopia: emailCopia.trim() || undefined,
      colaboradores,
      envioAutomatico,
      diaEnvio: clampDiaEnvioAutomatico(diaEnvio),
      ativo: true,
    }
  }

  async function salvarReferencia() {
    const payload = await montarPayloadReferencia()
    if (!payload) return
    if (!payload.emailDestino) {
      toast.error('Informe o e-mail antes de salvar a referência.')
      return
    }
    try {
      if (refEditId) {
        await atualizarReferenciaRelatorioMensal(refEditId, payload)
      } else {
        const id = await criarReferenciaRelatorioMensal(payload)
        setRefEditId(id)
      }
      toast.success(
        refEditId ? 'Referência atualizada.' : 'Referência salva.',
        {
          description: 'Veja todos os modelos na aba Preferências de envio.',
          action: {
            label: 'Abrir preferências',
            onClick: () => router.replace('?tab=preferencias-envio', { scroll: false }),
          },
        }
      )
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const colunas = useMemo<ColumnDef<UsuarioAgrupadoPorLogin>[]>(
    () => [
      {
        id: 'sel',
        header: () => (
          <Checkbox
            checked={todosVisiveisSelecionados}
            onCheckedChange={v => toggleTodosVisiveis(v === true)}
            aria-label="Selecionar todos visíveis"
          />
        ),
        cell: ({ row }) => {
          const k = normLogin(row.original.codusuario)
          return (
            <Checkbox
              checked={selecionados.has(k)}
              onCheckedChange={v => toggleLogin(row.original.codusuario, v === true)}
              aria-label={`Selecionar ${row.original.nome}`}
            />
          )
        },
      },
      { accessorKey: 'codusuario', header: 'Login' },
      { accessorKey: 'nome', header: 'Nome' },
      {
        id: 'bases',
        header: 'Bases',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {basesAgrupadasLabel(row.original.bases)}
          </span>
        ),
      },
      { accessorKey: 'ativoLabel', header: 'Ativo' },
    ],
    [selecionados, todosVisiveisSelecionados]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Extrair relatório mensal (PDF)
        </CardTitle>
        <CardDescription>
          Monte o PDF com os acessos do setor, baixe no computador ou envie automaticamente por e-mail ao gestor
          (anexo). O envio usa o servidor de e-mail do PaperSign (modo teste de disparos, se ativo, redireciona para o
          e-mail de teste).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="mensalMes">Mês de referência</Label>
            <Input
              id="mensalMes"
              type="month"
              value={mesRef}
              onChange={e => setMesRef(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label htmlFor="mensalSetor">Nome do setor / área</Label>
            <Input
              id="mensalSetor"
              placeholder="Ex.: Controladoria, TI, Financeiro MS 306"
              value={nomeSetor}
              onChange={e => setNomeSetor(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Base (lista de seleção)</Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as bases</SelectItem>
                {UNIDADES_RELATORIO.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative flex flex-col gap-1" ref={gestorRef}>
            <Label htmlFor="mensalGestor">Quem assina (gestor da área)</Label>
            <Input
              id="mensalGestor"
              placeholder="Busque por nome ou login…"
              value={gestorBusca}
              onChange={e => {
                setGestorBusca(e.target.value)
                setAssinanteNome(e.target.value)
                setAssinanteLogin('')
                setAssinanteUnidade('')
                setGestorAberta(e.target.value.trim().length >= 2)
              }}
              onFocus={() => {
                if (gestorBusca.trim().length >= 2) setGestorAberta(true)
              }}
            />
            {gestorAberta && gestorBusca.trim().length >= 2 && (
              <ul className="absolute z-50 top-full mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                {sugestoesGestor.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</li>
                ) : (
                  sugestoesGestor.map(g => (
                    <li key={g.codusuario}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => selecionarGestor(g)}
                      >
                        <span className="font-medium">{g.nome}</span>
                        <span className="text-muted-foreground"> · {g.codusuario}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="mensalCargo">Cargo no PDF (opcional)</Label>
            <Input
              id="mensalCargo"
              value={assinanteCargo}
              onChange={e => setAssinanteCargo(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="mensalEmail">E-mail para envio do PDF</Label>
            <Input
              id="mensalEmail"
              type="email"
              placeholder="gestor@empresa.com.br"
              value={emailDestino}
              onChange={e => setEmailDestino(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Preenchido automaticamente ao escolher o gestor no cadastro.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="mensalEmailCopia">Cópia (opcional)</Label>
            <Input
              id="mensalEmailCopia"
              type="email"
              placeholder="rh@empresa.com.br"
              value={emailCopia}
              onChange={e => setEmailCopia(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1 flex-1 max-w-md">
            <Label htmlFor="mensalBusca">Filtrar colaboradores</Label>
            <Input
              id="mensalBusca"
              placeholder="Nome ou login…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            <p className="text-sm text-muted-foreground pt-1">
              {selecionados.size} selecionado(s) · {gruposVisiveis.length} na lista
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void baixarPdf()} disabled={ocupado || loading}>
              <Download className="mr-2 h-4 w-4" />
              {loadingPdf && !loadingEmail ? 'Gerando…' : 'Baixar PDF'}
            </Button>
            <Button variant="secondary" onClick={() => void enviarPorEmail()} disabled={ocupado || loading}>
              <Mail className="mr-2 h-4 w-4" />
              {loadingEmail && !loadingPdf ? 'Enviando…' : 'Enviar por e-mail'}
            </Button>
            <Button onClick={() => void baixarEEnviar()} disabled={ocupado || loading}>
              <FileText className="mr-2 h-4 w-4" />
              {loadingPdf && loadingEmail ? 'Processando…' : 'Baixar e enviar'}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Salvar referência e envio automático</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Guarde setor, gestor, e-mails e colaboradores. Os modelos aparecem na aba{' '}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => router.replace('?tab=preferencias-envio', { scroll: false })}
            >
              Preferências de envio
            </button>
            . Com envio automático ativo, a API envia todo mês no dia escolhido (8h, Brasília).
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label htmlFor="tituloRef">Nome da referência</Label>
              <Input
                id="tituloRef"
                placeholder="Ex.: TI — relatório mensal"
                value={tituloRef}
                onChange={e => setTituloRef(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="diaEnvio">Dia do envio automático (1–28)</Label>
              <Input
                id="diaEnvio"
                type="number"
                min={1}
                max={28}
                value={diaEnvio}
                onChange={e => setDiaEnvio(clampDiaEnvioAutomatico(Number(e.target.value)))}
                onBlur={() => setDiaEnvio(d => clampDiaEnvioAutomatico(d))}
              />
              <p className="text-xs text-muted-foreground">Máximo 28 (todos os meses do ano).</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="envioAuto"
              checked={envioAutomatico}
              onCheckedChange={v => setEnvioAutomatico(v === true)}
            />
            <Label htmlFor="envioAuto" className="font-normal">
              Enviar automaticamente todo mês (e-mail acima)
            </Label>
          </div>
          <Button type="button" variant="secondary" onClick={() => void salvarReferencia()}>
            <Bookmark className="mr-2 h-4 w-4" />
            {refEditId ? 'Atualizar referência' : 'Salvar referência'}
          </Button>
        </div>

        <DataTable columns={colunas} data={gruposVisiveis} loading={loading} />
      </CardContent>
    </Card>
  )
}
