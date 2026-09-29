'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { RefreshCw, ShieldOff, SearchIcon } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getAll as getAllUsuarios, removerConfigLote } from '@/services/usuariosService'
import type { Usuario } from '@/types/Usuario'
import { UNIDADES_RELATORIO } from '@/lib/usuarioPermissoesRelatorio'
import {
  PERMISSOES_LOTE_CAMPOS,
  type PermissaoLoteKey,
  usuarioTemPermissaoLote,
} from '@/lib/configuracoes-permissoes'
import { stripDiacritics } from '@/utils/functions'

type Linha = Usuario & { id: number }

export default function RemoverConfigLotePanel() {
  const [unidade, setUnidade] = useState<string>('todas')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [baseUsuarios, setBaseUsuarios] = useState<Linha[]>([])
  const [permsRemover, setPermsRemover] = useState<Set<PermissaoLoteKey>>(new Set())
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [confirmar, setConfirmar] = useState<'selecionados' | 'todos' | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const users = await getAllUsuarios(unidade === 'todas' ? undefined : unidade)
      setBaseUsuarios(users.map((u) => ({ ...u, id: u.sequencial })))
      setSelecionados(new Set())
    } catch (err) {
      toast.error((err as Error).message)
      setBaseUsuarios([])
      setSelecionados(new Set())
    } finally {
      setLoading(false)
    }
  }, [unidade])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const permissoesArray = useMemo(() => Array.from(permsRemover), [permsRemover])

  const linhas = useMemo(() => {
    if (permsRemover.size === 0) return []
    const q = stripDiacritics(busca.trim().toLowerCase())
    return baseUsuarios.filter((u) => {
      const temAlguma = permissoesArray.some((p) => usuarioTemPermissaoLote(u, p))
      if (!temAlguma) return false
      if (!q) return true
      const cod = stripDiacritics((u.codusuario ?? '').toLowerCase())
      const nome = stripDiacritics((u.nome ?? '').toLowerCase())
      return cod.includes(q) || nome.includes(q)
    })
  }, [baseUsuarios, busca, permsRemover, permissoesArray])

  const todosSelecionados =
    linhas.length > 0 && linhas.every((u) => selecionados.has(u.sequencial))

  function togglePermRemover(key: PermissaoLoteKey, checked: boolean) {
    setPermsRemover((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
    setSelecionados(new Set())
  }

  function toggleUm(seq: number, checked: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (checked) next.add(seq)
      else next.delete(seq)
      return next
    })
  }

  function toggleTodos(checked: boolean) {
    if (checked) setSelecionados(new Set(linhas.map((u) => u.sequencial)))
    else setSelecionados(new Set())
  }

  const labelsRemover = useMemo(
    () =>
      PERMISSOES_LOTE_CAMPOS.filter((f) => permsRemover.has(f.name))
        .map((f) => f.label)
        .join(', '),
    [permsRemover]
  )

  const colunas = useMemo<ColumnDef<Linha>[]>(
    () => [
      {
        id: 'sel',
        header: () => (
          <Checkbox
            checked={todosSelecionados}
            onCheckedChange={(v) => toggleTodos(v === true)}
            aria-label="Selecionar todos da lista"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selecionados.has(row.original.sequencial)}
            onCheckedChange={(v) => toggleUm(row.original.sequencial, v === true)}
            aria-label={`Selecionar ${row.original.codusuario}`}
          />
        ),
        size: 40,
      },
      { accessorKey: 'codusuario', header: 'Login' },
      { accessorKey: 'nome', header: 'Nome' },
      { accessorKey: 'unidade', header: 'Base' },
      {
        id: 'perms',
        header: 'Com acesso',
        cell: ({ row }) => {
          const tags = PERMISSOES_LOTE_CAMPOS.filter(
            (f) => permsRemover.has(f.name) && usuarioTemPermissaoLote(row.original, f.name)
          ).map((f) => f.label)
          return (
            <span className="text-xs text-muted-foreground line-clamp-2" title={tags.join(', ')}>
              {tags.join(' · ') || '—'}
            </span>
          )
        },
      },
    ],
    [selecionados, todosSelecionados, linhas, permsRemover]
  )

  async function executar(modo: 'selecionados' | 'todos') {
    if (permsRemover.size === 0) {
      toast.error('Marque ao menos um acesso a remover.')
      return
    }
    setAplicando(true)
    try {
      const payload =
        modo === 'todos'
          ? {
              todos: true,
              unidade: unidade === 'todas' ? undefined : unidade,
              busca: busca.trim() || undefined,
              permissoes: permissoesArray,
            }
          : { sequenciais: Array.from(selecionados), permissoes: permissoesArray }

      const res = await removerConfigLote(payload)
      toast.success(
        `Acesso removido em ${res.atualizados} cadastro(s).${res.ignorados ? ` ${res.ignorados} ignorado(s).` : ''}`
      )
      setConfirmar(null)
      setSelecionados(new Set())
      await carregar()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAplicando(false)
    }
  }

  const qtdSel = selecionados.size

  return (
    <div className="space-y-4">
      <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldOff className="h-4 w-4" />
            Remover acesso em lote
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Marque quais <strong>acessos</strong> deseja retirar (itens do menu Configurações e, se precisar,{' '}
            <strong>Admin</strong>). A lista mostra quem ainda tem esse acesso. Documentos, borderô e demais módulos do
            PaperSign não mudam. O Admin do seu próprio login não é removido aqui. Tudo vai para a auditoria.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Acessos a remover</CardTitle>
          <CardDescription>Marque um ou mais. A tabela lista quem ainda tem pelo menos um deles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PERMISSOES_LOTE_CAMPOS.map((item) => (
              <label
                key={item.name}
                className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={permsRemover.has(item.name)}
                  onCheckedChange={(v) => togglePermRemover(item.name, v === true)}
                  className="mt-0.5"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 min-w-[10rem]">
          <Label>Base</Label>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger>
              <SelectValue placeholder="Base" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as bases</SelectItem>
              {UNIDADES_RELATORIO.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex-1 min-w-[12rem]">
          <Label>Buscar login ou nome</Label>
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar lista…"
            />
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium">Cadastros no filtro</CardTitle>
            <CardDescription>
              {permsRemover.size === 0
                ? 'Marque os acessos a remover acima.'
                : loading
                  ? 'Carregando…'
                  : `${linhas.length} cadastro(s) · ${qtdSel} selecionado(s)`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={aplicando || qtdSel === 0 || permsRemover.size === 0}
              onClick={() => setConfirmar('selecionados')}
            >
              Remover acesso ({qtdSel})
            </Button>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={aplicando || linhas.length === 0 || permsRemover.size === 0}
              onClick={() => setConfirmar('todos')}
            >
              Remover acesso de todos ({linhas.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={colunas} data={linhas} />
        </CardContent>
      </Card>

      <AlertDialog open={confirmar !== null} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção de acesso</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {confirmar === 'todos'
                    ? `O acesso selecionado será removido em todos os ${linhas.length} cadastro(s) listados.`
                    : `O acesso selecionado será removido em ${qtdSel} cadastro(s).`}
                </p>
                <p>
                  <strong>Acessos:</strong> {labelsRemover || '—'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aplicando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={aplicando}
              onClick={(e) => {
                e.preventDefault()
                if (confirmar) void executar(confirmar)
              }}
            >
              {aplicando ? 'Aplicando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
