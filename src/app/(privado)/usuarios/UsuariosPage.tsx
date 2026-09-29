'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { ColumnDef } from '@tanstack/react-table'
import { KeyIcon, Copy, ClipboardList, FileSpreadsheet, SearchIcon, ShieldOff, SquarePlus, Trash2, X, UserRound } from 'lucide-react'
import { toast } from 'sonner';

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AuditoriaUsuariosPanel from '@/components/AuditoriaUsuariosPanel'
import RelatorioPermissoesUsuariosPanel from '@/components/RelatorioPermissoesUsuariosPanel'
import UnificacaoUsuarioPanel from '@/components/UnificacaoUsuarioPanel'
import RemoverConfigLotePanel from '@/components/RemoverConfigLotePanel'
import { CONFIG_MENU_FORM_FIELDS } from '@/lib/configuracoes-permissoes'
import { empresaPermiteProjetos } from '@/utils/projetosModulo'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'

import { stripDiacritics } from '@/utils/functions'
import {
  isWayCscSession,
  syncSessionUserFromUsuario,
  USERDATA_UPDATED_EVENT,
} from '@/utils/sessionUser'
import {
  Usuario,
  getAll as getAllUsuarios,
  getElementById as getUsuarioById,
  createElement as createUsuario,
  updateElement as updateUsuario,
  deleteElement as deleteUsuario,
  resetPassword,
  copiarUsuario
} from '@/services/usuariosService'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

/** Rótulos empresa → unidade (listagem/filtro CSC). */
const BASES_LABEL: { empresa: string; unidade: string }[] = [
  { empresa: '48.851.242', unidade: 'WAY 112' },
  { empresa: '63.929.367', unidade: 'WAY 153' },
  { empresa: '58.492.120', unidade: 'WAY 262' },
  { empresa: '36.128.741', unidade: 'WAY 306' },
  { empresa: '64.017.857', unidade: 'WAY 364' },
  { empresa: '57.190.446', unidade: 'MIGRA BR' },
  { empresa: '57.582.342', unidade: 'WAY CSC' },
]

/** Destinos da cópia (inclui CSC: cria o login lá se ainda não existir). */
const BASES_COPIA = BASES_LABEL

function normalizeEmpresaForSelect(empresa: string, unidade?: string): string {
  const e = (empresa ?? '').trim()
  if (BASES_LABEL.some(b => b.empresa === e)) return e
  const byUnit = BASES_LABEL.find(b => b.unidade === (unidade ?? '').trim())?.empresa
  return byUnit ?? e
}

function PermissionCheckbox({
  checked,
  onChange,
}: {
  checked: boolean | undefined
  onChange: (v: boolean) => void
}) {
  return (
    <Checkbox
      checked={checked === true}
      onCheckedChange={v => onChange(v === true)}
    />
  )
}

export default function PageUsuarios() {
  const titulo = 'Usuários'
  const tituloUpdate = 'Editar usuários'
  const tituloInsert = 'Novo usuários'
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
  const [results, setResults] = useState<Usuario[]>([])
  const [resultById, setResultById] = useState<Usuario>()
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [updateMode, setUpdateMode] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [resetId, setResetId] = useState<number | null>(null)
  const [copiaUsuario, setCopiaUsuario] = useState<Usuario | null>(null)
  const [copiaEmpresas, setCopiaEmpresas] = useState<string[]>([])
  const [copiaLoading, setCopiaLoading] = useState(false)
  const [ehCsc, setEhCsc] = useState(false)
  const [filtroUnidade, setFiltroUnidade] = useState<string>('todas')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const loading = isPending

  useEffect(() => {
    const refreshCsc = () => setEhCsc(isWayCscSession())
    refreshCsc()
    window.addEventListener(USERDATA_UPDATED_EVENT, refreshCsc)
    return () => window.removeEventListener(USERDATA_UPDATED_EVENT, refreshCsc)
  }, [])

  const [aba, setAba] = useState(() => {
    const t = searchParams.get('tab')
    if (t === 'auditoria') return 'auditoria'
    if (t === 'relatorio') return 'relatorio'
    if (t === 'unificacao') return 'unificacao'
    if (t === 'remover-acesso' || t === 'config-lote' || t === 'remover-admin') return 'remover-acesso'
    return 'lista'
  })

  const form = useForm<Usuario>({
    defaultValues: {
      sequencial: 0,
      codusuario: '',
      nome: '',
      empresa: '',
      codperfil: '',
      diretoria: '',
      email: '',
      ativo: true,
      datacriacao: '',
      codsistema: '',
      admin: false,
      documentos: false,
      bordero: false,
      comunicados: false,
      rdv: false,
      ccusto: false,
      externo: false,
      restrito: false,
      administrativo: false,
      solicitante: false,
      pagamento_impostos: false,
      pagamento_rh: false,
      fiscal: false,
      gestao_pessoas: false,
      financeiro: false,
      docusign: false,
      projetos: false,
      contratos: false,
      financeiro_totvs: false,
      receitas: false,
      extrato_gestor: false,
      controle_medicao: false,
      config_alcadas: false,
      config_usuarios: false,
      config_bordero_aprovadores: false,
      config_restrito_aprovadores: false,
      config_fornecedores_restritos: false,
      config_impostos_aprovadores: false,
      config_financeiro_aprovadores: false,
      config_fiscal_aprovadores: false,
      config_rh_aprovadores: false,
      config_disparos: false,
      config_cadastro_externos: false,
      config_status_pedido: false,
      replicar_todas_unidades: false,
    }
  })

  const empresaSelecionada = form.watch('empresa')
  const unidadeDoFormulario =
    BASES_LABEL.find((b) => b.empresa === (empresaSelecionada ?? '').trim())?.unidade ?? ''

  function clearQuery() {
    setQuery('')
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearchClick()
    }
  }

  useEffect(() => {
    // on mount: run an initial search
    handleSearch(searchParams.get('q') ?? '')
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        const sp = new URLSearchParams(Array.from(searchParams.entries()))
        if (query) sp.set('q', query)
        else sp.delete('q')
        router.replace(`?${sp.toString()}`)
      })
      handleSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, filtroUnidade, ehCsc])

  async function handleSearch(q: string) {
    setError(null)
    try {
      const unidadeApi =
        ehCsc && filtroUnidade !== 'todas' ? filtroUnidade : undefined
      const dados = await getAllUsuarios(unidadeApi)
      const qNorm = stripDiacritics(q.toLowerCase().trim())
      const filtrados = qNorm
        ? dados.filter(
          p =>
          (
            stripDiacritics((p.nome ?? '').toLowerCase()).includes(qNorm) ||
            stripDiacritics((p.codusuario ?? '').toLowerCase()).includes(qNorm) ||
            stripDiacritics((p.empresa ?? '').toLowerCase()).includes(qNorm) ||
            stripDiacritics((p.unidade ?? '').toLowerCase()).includes(qNorm) ||
            String(p.sequencial ?? '').includes(qNorm)
          )
        )
        : dados;
      setResults(filtrados)
    } catch (err) {
      setError((err as Error).message)
      setResults([])
    } finally {
      setSearched(true)
    }
  }

  async function handleSearchClick() {
    startTransition(() => {
      const sp = new URLSearchParams(Array.from(searchParams.entries()))
      if (query) sp.set('q', query)
      else sp.delete('q')
      router.replace(`?${sp.toString()}`)
    })
    await handleSearch(query)
  }

  async function handleDeleteConfirmed() {
    if (!deleteId) return
    try {
      await deleteUsuario(deleteId)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success(`Registro excluído`)
      setDeleteId(null)
      await handleSearchClick()
    }
  }

  async function handleResetConfirmed() {
    if (!resetId) return
    try {
      await resetPassword(resetId)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success(`Senha resetada para '123456'`)
      setResetId(null)
      await handleSearchClick()
    }
  }

  const handleUpdate = useCallback(async (id: number) => {
    setError(null)
    setUpdateMode(true)
    try {
      const response = await getUsuarioById(id)

      setResultById(response)
      form.reset({
        sequencial: response.sequencial,
        codusuario: response.codusuario,
        nome: response.nome,
        empresa: normalizeEmpresaForSelect(response.empresa, response.unidade),
        codperfil: response.codperfil,
        diretoria: response.diretoria,
        email: response.email,
        ativo: response.ativo,
        datacriacao: response.datacriacao,
        codsistema: response.codsistema,
        admin: response.admin,
        documentos: response.documentos,
        bordero: response.bordero,
        comunicados: response.comunicados,
        rdv: response.rdv,
        ccusto: response.ccusto,
        externo: response.externo,
        restrito: response.restrito,
        administrativo: response.administrativo,
        solicitante: response.solicitante,
        pagamento_impostos: response.pagamento_impostos,
        pagamento_rh: response.pagamento_rh,
        fiscal: response.fiscal,
        gestao_pessoas: response.gestao_pessoas,
        financeiro: response.financeiro,
        docusign: response.docusign,
        projetos: response.projetos,
        contratos: response.contratos,
        financeiro_totvs: response.financeiro_totvs,
        receitas: response.receitas,
        extrato_gestor: response.extrato_gestor,
        controle_medicao: response.controle_medicao,
        config_alcadas: response.config_alcadas ?? false,
        config_usuarios: response.config_usuarios ?? false,
        config_bordero_aprovadores: response.config_bordero_aprovadores ?? false,
        config_restrito_aprovadores: response.config_restrito_aprovadores ?? false,
        config_fornecedores_restritos: response.config_fornecedores_restritos ?? false,
        config_impostos_aprovadores: response.config_impostos_aprovadores ?? false,
        config_financeiro_aprovadores: response.config_financeiro_aprovadores ?? false,
        config_fiscal_aprovadores: response.config_fiscal_aprovadores ?? false,
        config_rh_aprovadores: response.config_rh_aprovadores ?? false,
        config_disparos: response.config_disparos ?? false,
        config_cadastro_externos: response.config_cadastro_externos ?? false,
        config_status_pedido: response.config_status_pedido ?? false,
      })
      setIsModalOpen(true)
    } catch (err) {
      toast.error(`Erro ao carregar: ${(err as Error).message}`)
    }
  }, [form])

  function handleInsert() {
    form.reset({
      sequencial: 0,
      codusuario: '',
      nome: '',
      empresa: '',
      codperfil: '',
      diretoria: '',
      email: '',
      ativo: true,
      datacriacao: '',
      codsistema: '',
      admin: false,
      documentos: false,
      bordero: false,
      comunicados: false,
      rdv: false,
      ccusto: false,
      externo: false,
      administrativo: false,
      solicitante: false,
      pagamento_impostos: false,
      pagamento_rh: false,
      fiscal: false,
      gestao_pessoas: false,
      financeiro: false,
      docusign: false,
      projetos: false,
      contratos: false,
      financeiro_totvs: false,
      receitas: false,
      extrato_gestor: false,
      controle_medicao: false,
      config_alcadas: false,
      config_usuarios: false,
      config_bordero_aprovadores: false,
      config_restrito_aprovadores: false,
      config_fornecedores_restritos: false,
      config_impostos_aprovadores: false,
      config_financeiro_aprovadores: false,
      config_fiscal_aprovadores: false,
      config_rh_aprovadores: false,
      config_disparos: false,
      config_cadastro_externos: false,
      config_status_pedido: false,
      replicar_todas_unidades: false,
    })
    setUpdateMode(false)
    setIsModalOpen(true)
  }

  function abrirCopiaUsuario(usuario: Usuario) {
    setCopiaUsuario(usuario)
    setCopiaEmpresas([])
  }

  function toggleCopiaEmpresa(empresa: string, checked: boolean) {
    setCopiaEmpresas(prev =>
      checked ? [...prev, empresa] : prev.filter(e => e !== empresa)
    )
  }

  async function confirmarCopiaUsuario() {
    if (!copiaUsuario) return
    if (copiaEmpresas.length === 0) {
      toast.error('Selecione ao menos uma base de destino.')
      return
    }
    setCopiaLoading(true)
    try {
      const resultado = await copiarUsuario(copiaUsuario.sequencial, copiaEmpresas)
      const criados = resultado.resultados.filter(r => r.status === 'criado')
      const atualizados = resultado.resultados.filter(r => r.status === 'atualizado')
      const existentes = resultado.resultados.filter(r => r.status === 'ja_existe')
      const erros = resultado.resultados.filter(r => r.status === 'erro')
      let msg = `Cópia de ${resultado.nome}:`
      if (criados.length) msg += ` criado em ${criados.map(r => r.unidade).join(', ')}`
      if (atualizados.length) msg += ` — permissões atualizadas em ${atualizados.map(r => r.unidade).join(', ')}`
      if (existentes.length) msg += ` — origem/já ok: ${existentes.map(r => r.unidade).join(', ')}`
      if (erros.length) msg += ` — falhou em ${erros.map(r => r.unidade).join(', ')}`
      if (!criados.length && !atualizados.length && !erros.length) msg += ' nada a criar'
      if (erros.length) toast.warning(msg)
      else toast.success(msg)
      setCopiaUsuario(null)
      setCopiaEmpresas([])
      await handleSearchClick()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCopiaLoading(false)
    }
  }

  async function onSubmit(data: Usuario) {
    setError(null)
    try {
      if (data.sequencial && data.sequencial !== 0) {
        if (!data.empresa || data.empresa === '0') {
          toast.error('Selecione uma empresa válida antes de salvar.')
          return
        }
        await updateUsuario(data)
        const fresh = await getUsuarioById(data.sequencial)
        syncSessionUserFromUsuario(fresh)
        toast.success('Permissões salvas')
      } else {
        if (!data.replicar_todas_unidades && (!data.empresa || data.empresa === '0')) {
          toast.error('Selecione uma empresa antes de salvar.')
          return
        }

        if (!data.replicar_todas_unidades) {
          const duplicado = results.some(
            u =>
              u.codusuario.trim().toLowerCase() === data.codusuario.trim().toLowerCase() &&
              u.nome.trim().toLowerCase() === data.nome.trim().toLowerCase() &&
              u.empresa.trim().toLowerCase() === data.empresa.trim().toLowerCase()
          )
          if (duplicado) {
            toast.error('Já existe um usuário com essa matrícula, nome e unidade.')
            return
          }
        }

        const resultado = await createUsuario(data)
        if (data.replicar_todas_unidades && resultado?.resultados) {
          const criados = resultado.resultados.filter(r => r.status === 'criado')
          const existentes = resultado.resultados.filter(r => r.status === 'ja_existe')
          const erros = resultado.resultados.filter(r => r.status === 'erro')
          let msg = `Criado em ${criados.length}/${resultado.resultados.length} unidades`
          if (existentes.length) msg += ` — já existia em ${existentes.map(r => r.unidade).join(', ')}`
          if (erros.length) msg += ` — falhou em ${erros.map(r => r.unidade).join(', ')}`
          if (erros.length) {
            toast.warning(msg)
          } else {
            toast.success(msg)
          }
        } else {
          toast.success('Registro enviado')
        }
      }
      form.reset()
      setIsModalOpen(false)
      await handleSearchClick()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const colunas = useMemo<ColumnDef<Usuario>[]>(
    () => {
      const cols: ColumnDef<Usuario>[] = [
        { accessorKey: 'sequencial', header: 'SEQUENCIAL' },
        { accessorKey: 'codusuario', header: 'CODUSUARIO' },
        { accessorKey: 'nome', header: 'NOME' },
      ]
      if (ehCsc) {
        cols.push({
          id: 'unidade',
          header: 'BASE',
          accessorFn: row =>
            row.unidade ||
            BASES_LABEL.find(b => b.empresa === row.empresa)?.unidade ||
            row.empresa,
        })
      } else {
        cols.push({ accessorKey: 'empresa', header: 'EMPRESA' })
      }
      cols.push({
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUpdate(row.original.sequencial)}
            >
              Editar
            </Button>
            {ehCsc && (
              <Button
                size="sm"
                variant="outline"
                title="Cópia de usuário para outras bases"
                onClick={() => abrirCopiaUsuario(row.original)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setResetId(row.original.sequencial)}
            >
              <KeyIcon className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteId(row.original.sequencial)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ),
      })
      return cols
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ehCsc]
  )

  const conteudoLista = (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
          {ehCsc && (
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Base</Label>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {BASES_LABEL.map(b => (
                    <SelectItem key={b.unidade} value={b.unidade}>{b.unidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="relative flex-1 w-full min-w-[200px]">
            <Input
              placeholder="Pesquise por nome ou ID"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pr-10"
              aria-label="Campo de busca"
            />
            {query && (
              <button
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                onClick={clearQuery}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button onClick={handleSearchClick} className="flex items-center">
            <SearchIcon className="mr-1 h-4 w-4" />
            Buscar
          </Button>

          <Button onClick={handleInsert} className="flex items-center">
            <SquarePlus className="mr-1 h-4 w-4" />
            Novo
          </Button>

          {ehCsc && (
            <Button
              variant="outline"
              className="flex items-center"
              disabled={results.length === 0}
              title={results.length === 0 ? 'Busque um usuário e use o ícone Copiar na linha' : 'Escolha um usuário na lista e clique em Copiar'}
              onClick={() => {
                if (results.length === 1) abrirCopiaUsuario(results[0])
                else toast.message('Na lista, clique no ícone Copiar do usuário que deseja replicar.')
              }}
            >
              <Copy className="mr-1 h-4 w-4" />
              Cópia de usuário
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="flex flex-col">
          <DataTable columns={colunas} data={results} loading={loading} />
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">
              {updateMode
                ? `${tituloUpdate}: ${resultById?.sequencial}`
                : `${tituloInsert}`}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="codusuario"
                rules={{ required: 'Usuário é obrigatório' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>COD. USUÁRIO</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NOME</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="empresa"
                rules={{
                  validate: value => {
                    if (form.getValues('replicar_todas_unidades')) return true
                    return (!!value && value !== '0') || 'Selecione uma empresa'
                  }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EMPRESA</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={!updateMode && form.watch('replicar_todas_unidades')}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={'48.851.242'}>{'WAY 112'}</SelectItem>
                          <SelectItem value={'63.929.367'}>{'WAY 153'}</SelectItem>
                          <SelectItem value={'58.492.120'}>{'WAY 262'}</SelectItem>
                          <SelectItem value={'36.128.741'}>{'WAY 306'}</SelectItem>
                          <SelectItem value={'64.017.857'}>{'WAY 364'}</SelectItem>
                          <SelectItem value={'57.190.446'}>{'MIGRA BR'}</SelectItem>
                          <SelectItem value={'57.582.342'}>{'WAY CSC'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!updateMode && (
                <FormField
                  control={form.control}
                  name="replicar_todas_unidades"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">
                        Replicar criação para todas as unidades (WAY 112, 153, 262, 306, 364)
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="diretoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DIRETORIA</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EMAIL</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="admin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Documentos</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bordero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Borderô</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="comunicados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pagamentos</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rdv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RDV</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="restrito"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restrito</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pagamento_impostos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pag. Impostos</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pagamento_rh"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pag. RH</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fiscal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>P. Fiscal</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="externo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doc. Externo</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="administrativo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Administrativo</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="financeiro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Financeiro</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="docusign"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WaySign</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {empresaPermiteProjetos(form.watch("empresa")) && (
                  <FormField
                    control={form.control}
                    name="projetos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Projetos</FormLabel>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="receitas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receitas</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="extrato_gestor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Extrato gestor</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="controle_medicao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Controle medição</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contratos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contratos</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="financeiro_totvs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Financeiro TOTVS</FormLabel>
                      <FormControl>
                        <PermissionCheckbox
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-6 space-y-3">
                <p className="text-sm font-semibold text-foreground">Configurações (menu)</p>
                <p className="text-xs text-muted-foreground">
                  Cada item libera apenas a tela correspondente no menu Configurações (admin continua com acesso total).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CONFIG_MENU_FORM_FIELDS.map((item) => {
                    const hideStatusPedido =
                      item.name === 'config_status_pedido' &&
                      unidadeDoFormulario.trim().toUpperCase() !== 'WAY CSC'
                    return (
                    <FormField
                      key={item.name}
                      control={form.control}
                      name={item.name}
                      render={({ field }) => (
                        <FormItem className={hideStatusPedido ? 'hidden' : undefined}>
                          <FormLabel>{item.label}</FormLabel>
                          <FormControl>
                            <PermissionCheckbox
                              checked={Boolean(field.value)}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )
                  })}
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {error && (
        <p className="mb-4 text-center text-sm text-destructive">
          Erro: {error}
        </p>
      )}

      {!searched && (
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {searched && results.length === 0 && !loading && !error && (
        <p className="text-center text-sm text-muted-foreground">
          Nenhum registro encontrado.
        </p>
      )}

      {/* Cópia de usuário para outras bases */}
      <Dialog
        open={copiaUsuario !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCopiaUsuario(null)
            setCopiaEmpresas([])
          }
        }}
      >
        <DialogContent className="max-w-md overflow-y-auto max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">
              Cópia de usuário
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              Se o login ainda não existir na base de destino (incluindo WAY CSC), cria com as
              mesmas permissões. Se já existir, alinha as permissões com a origem. A senha atual
              é mantida.
            </DialogDescription>
          </DialogHeader>

          {copiaUsuario && (
            <div className="grid gap-4">
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Usuário:</span> {copiaUsuario.codusuario}</p>
                <p><span className="text-muted-foreground">Nome:</span> {copiaUsuario.nome}</p>
                <p>
                  <span className="text-muted-foreground">Base atual:</span>{' '}
                  {copiaUsuario.unidade
                    || BASES_LABEL.find(b => b.empresa === copiaUsuario.empresa)?.unidade
                    || copiaUsuario.empresa}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Bases de destino</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BASES_COPIA.filter(b =>
                    b.empresa !== copiaUsuario.empresa
                    && b.unidade !== (copiaUsuario.unidade || '')
                  ).map(base => (
                    <label
                      key={base.empresa}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={copiaEmpresas.includes(base.empresa)}
                        onCheckedChange={(v) => toggleCopiaEmpresa(base.empresa, v === true)}
                      />
                      {base.unidade}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={copiaLoading}
                  onClick={() => {
                    setCopiaUsuario(null)
                    setCopiaEmpresas([])
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={copiaLoading || copiaEmpresas.length === 0}
                  onClick={confirmarCopiaUsuario}
                >
                  {copiaLoading ? 'Copiando…' : 'Copiar permissões'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão (simples) */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold">
              Excluir usuário
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Tem certeza que deseja excluir o registro #{deleteId}?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirmed}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão (simples) */}
      {resetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold">
              Resetar a senha do usuário
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Tem certeza que deseja resetar a senha do registro #{resetId}?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleResetConfirmed}>
                Resetar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="p-6">
      {ehCsc ? (
        <Tabs
          value={aba}
          onValueChange={(v) => {
            setAba(v)
            const sp = new URLSearchParams(Array.from(searchParams.entries()))
            if (v === 'auditoria') sp.set('tab', 'auditoria')
            else if (v === 'relatorio') sp.set('tab', 'relatorio')
            else if (v === 'unificacao') sp.set('tab', 'unificacao')
            else if (v === 'remover-acesso') sp.set('tab', 'remover-acesso')
            else sp.delete('tab')
            const qs = sp.toString()
            router.replace(qs ? `?${qs}` : '?', { scroll: false })
          }}
          className="w-full"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="lista">Usuários</TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5">
              <ClipboardList className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="relatorio" className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              Relatório
            </TabsTrigger>
            <TabsTrigger value="unificacao" className="gap-1.5">
              <UserRound className="h-4 w-4" />
              Unificação
            </TabsTrigger>
            <TabsTrigger value="remover-acesso" className="gap-1.5">
              <ShieldOff className="h-4 w-4" />
              Remover acesso
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lista" className="mt-0">
            {conteudoLista}
          </TabsContent>
          <TabsContent value="auditoria" className="mt-0">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Auditoria de usuários</h2>
              <p className="text-sm text-muted-foreground">
                Quem criou, alterou, copiou ou unificou usuários (chapa → nominal).
              </p>
            </div>
            <AuditoriaUsuariosPanel compact />
          </TabsContent>
          <TabsContent value="relatorio" className="mt-0">
            <RelatorioPermissoesUsuariosPanel />
          </TabsContent>
          <TabsContent value="unificacao" className="mt-0">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Unificação de usuário</h2>
              <p className="text-sm text-muted-foreground">
                Migra login chapa para nominal em alçadas, RDV, assinaturas e demais referências (CSC).
              </p>
            </div>
            <UnificacaoUsuarioPanel />
          </TabsContent>
          <TabsContent value="remover-acesso" className="mt-0">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Remover acesso em lote</h2>
              <p className="text-sm text-muted-foreground">
                Retire acessos ao menu Configurações (Alçadas, Centros de custos, Usuários, etc.) — ou Admin — de uma ou
                várias pessoas/bases (CSC).
              </p>
            </div>
            <RemoverConfigLotePanel />
          </TabsContent>
        </Tabs>
      ) : (
        conteudoLista
      )}
    </div>
  )
}
