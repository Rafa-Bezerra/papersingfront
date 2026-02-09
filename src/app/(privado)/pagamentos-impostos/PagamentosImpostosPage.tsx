'use client'

/**
 * TELA: Pagamentos Impostos (/pagamentos-impostos)
 * - Pagamentos da contabilidade fiscal: IRF, ISS, PIS, COFINS etc (solicitados via CI).
 * - Backend deve filtrar: EM ABERTO + TIPO_DOCUMENTO = tipo Impostos. Fonte: Vw_LAN_FINANCEIRO_262.
 * - Modal "Aprovador PG Impostos": lista separada (AprovadoresPgImpostos), não usa AprovadoresGestaoPessoas.
 * - Hierarquia: 1º Gerson Martiusi, 2º GAF, 3º Diretor Unidade, 4º Gomes, 5º Lopes. Alçadas por valor.
 * - Após aprovação: UPDATE FLAN.CAMPOALFAOP3. Relatório: Autorização de Pagamento Financeiro.
 * BACKEND: GET /api/PagamentosImpostos + GET/POST/PUT/DELETE /api/AprovadoresPgImpostos.
 * Ver: src/services/pagamentosService.ts, types/LancamentoPagamento.ts
 */

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { SquarePlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PopoverPortal } from '@radix-ui/react-popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { ChevronsUpDown } from 'lucide-react'
import { stripDiacritics } from '@/utils/functions'
import type { LancamentoPagamento } from '@/types/LancamentoPagamento'
import type { AprovadorGestaoPessoas } from '@/types/AprovadorGestaoPessoas'
import {
  getPagamentosImpostos,
  getAprovadoresPgImpostos,
  createAprovadorPgImpostos,
  updateAprovadorPgImpostos,
  deleteAprovadorPgImpostos,
} from '@/services/pagamentosService'
import { getAll as getAllUsuarios } from '@/services/usuariosService'
import type { Usuario } from '@/services/usuariosService'

export default function PagamentosImpostosPage() {
  const titulo = 'Pagamentos Impostos'
  const [results, setResults] = useState<LancamentoPagamento[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isModalAprovadoresOpen, setIsModalAprovadoresOpen] = useState(false)
  const [aprovadores, setAprovadores] = useState<AprovadorGestaoPessoas[]>([])
  const [aprovadorQuery, setAprovadorQuery] = useState('')
  const [isFormAprovadorOpen, setIsFormAprovadorOpen] = useState(false)
  const [editAprovador, setEditAprovador] = useState<AprovadorGestaoPessoas | null>(null)
  const [deleteAprovadorId, setDeleteAprovadorId] = useState<number | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const carregouUsuarios = useRef(false)

  const form = useForm<AprovadorGestaoPessoas & { id?: number }>({
    defaultValues: {
      id: 0,
      usuario: '',
      cargo: '',
      valor_inicial: 0,
      valor_final: 0,
      nivel: 1,
    },
  })

  const loading = isPending

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setError(null)
    try {
      const dados = await getPagamentosImpostos()
      setResults(dados)
    } catch (err) {
      setError((err as Error).message)
      setResults([])
    } finally {
      setSearched(true)
    }
  }

  async function openModalAprovadores() {
    setError(null)
    try {
      const dados = await getAprovadoresPgImpostos()
      setAprovadores(dados)
      setIsModalAprovadoresOpen(true)
    } catch (err) {
      setError((err as Error).message)
      setAprovadores([])
      toast.error((err as Error).message)
    }
  }

  async function loadUsuarios() {
    if (carregouUsuarios.current) return
    try {
      const d = await getAllUsuarios()
      setUsuarios(d)
      carregouUsuarios.current = true
    } catch {
      setUsuarios([])
    }
  }

  function handleNovoAprovador() {
    form.reset({
      id: 0,
      usuario: '',
      cargo: '',
      valor_inicial: 0,
      valor_final: 0,
      nivel: 1,
    })
    setEditAprovador(null)
    loadUsuarios()
    setIsFormAprovadorOpen(true)
  }

  function handleEditarAprovador(ap: AprovadorGestaoPessoas) {
    form.reset({
      id: ap.id,
      usuario: ap.usuario,
      cargo: ap.cargo,
      valor_inicial: ap.valor_inicial,
      valor_final: ap.valor_final,
      nivel: ap.nivel,
    })
    setEditAprovador(ap)
    loadUsuarios()
    setIsFormAprovadorOpen(true)
  }

  async function submitAprovador(
    data: AprovadorGestaoPessoas & { id?: number }
  ) {
    setError(null)
    try {
      if (data.id && data.id !== 0) {
        await updateAprovadorPgImpostos(data.id, data)
      } else {
        await createAprovadorPgImpostos(data)
      }
      toast.success('Registro salvo')
      form.reset()
      setIsFormAprovadorOpen(false)
      const list = await getAprovadoresPgImpostos()
      setAprovadores(list)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleExcluirAprovador() {
    if (deleteAprovadorId == null) return
    try {
      await deleteAprovadorPgImpostos(deleteAprovadorId)
      toast.success('Aprovador excluído')
      setDeleteAprovadorId(null)
      const list = await getAprovadoresPgImpostos()
      setAprovadores(list)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const aprovadoresFiltrados = useMemo(() => {
    const q = stripDiacritics(aprovadorQuery.toLowerCase().trim())
    if (!q) return aprovadores
    return aprovadores.filter(
      (a) =>
        stripDiacritics((a.usuario ?? '').toLowerCase()).includes(q) ||
        stripDiacritics((a.cargo ?? '').toLowerCase()).includes(q) ||
        String(a.id).includes(q)
    )
  }, [aprovadores, aprovadorQuery])

  const colunas = useMemo<ColumnDef<LancamentoPagamento>[]>(
    () => [
      { accessorKey: 'lancamento', header: 'Lançamento' },
      { accessorKey: 'data_vencimento', header: 'Data vencimento' },
      { accessorKey: 'data_prev_baixa', header: 'Data prev. baixa' },
      {
        accessorKey: 'tributos',
        header: 'Tributos',
        cell: ({ row }) =>
          row.original.tributos != null
            ? Number(row.original.tributos).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })
            : '-',
      },
      {
        accessorKey: 'multas',
        header: 'Multas',
        cell: ({ row }) =>
          row.original.multas != null
            ? Number(row.original.multas).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })
            : '-',
      },
      { accessorKey: 'tipo_documento', header: 'Tipo documento' },
      { accessorKey: 'status_lancamento', header: 'Status lançamento' },
      { accessorKey: 'wf_status', header: 'WF Status' },
      {
        accessorKey: 'valor_original',
        header: 'Valor original',
        cell: ({ row }) =>
          row.original.valor_original != null
            ? Number(row.original.valor_original).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })
            : '-',
      },
      {
        accessorKey: 'valor_liquido',
        header: 'Valor líquido',
        cell: ({ row }) =>
          row.original.valor_liquido != null
            ? Number(row.original.valor_liquido).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })
            : '-',
      },
    ],
    []
  )

  const colunasAprovadores = useMemo<ColumnDef<AprovadorGestaoPessoas>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'usuario', header: 'Usuário' },
      { accessorKey: 'cargo', header: 'Cargo' },
      {
        accessorKey: 'valor_inicial',
        header: 'Valor inicial',
        cell: ({ row }) =>
          Number(row.original.valor_inicial).toLocaleString('pt-BR'),
      },
      {
        accessorKey: 'valor_final',
        header: 'Valor final',
        cell: ({ row }) =>
          Number(row.original.valor_final).toLocaleString('pt-BR'),
      },
      { accessorKey: 'nivel', header: 'Nível' },
      {
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditarAprovador(row.original)}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteAprovadorId(row.original.id)}
            >
              Excluir
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="p-6">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
          <Button onClick={openModalAprovadores} variant="outline" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Aprovador PG Impostos
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pagamentos de impostos (EM ABERTO, tipo Impostos – IRF, ISS, PIS, COFINS). Hierarquia: Gerson Martiusi → GAF → Diretor Unidade → Gomes → Lopes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DataTable columns={colunas} data={results} loading={loading} />
        </CardContent>
      </Card>

      {/* Modal Aprovador PG Impostos */}
      <Dialog open={isModalAprovadoresOpen} onOpenChange={setIsModalAprovadoresOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Aprovador PG Impostos</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                placeholder="Pesquisar..."
                value={aprovadorQuery}
                onChange={(e) => setAprovadorQuery(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleNovoAprovador} className="flex items-center gap-1">
                <SquarePlus className="h-4 w-4" />
                Novo aprovador
              </Button>
            </div>
            <DataTable
              columns={colunasAprovadores}
              data={aprovadoresFiltrados}
              loading={false}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Novo/Editar Aprovador */}
      <Dialog open={isFormAprovadorOpen} onOpenChange={setIsFormAprovadorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editAprovador ? 'Editar aprovador' : 'Novo aprovador'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(submitAprovador)}
              className="grid gap-4"
            >
              <FormField
                control={form.control}
                name="usuario"
                rules={{ required: 'Usuário obrigatório' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuário</FormLabel>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {usuarios.find((u) => u.codusuario === field.value)?.nome ??
                              'Selecione o usuário'}
                            <ChevronsUpDown className="opacity-50 size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverPortal>
                          <PopoverContent className="w-[250px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar usuário..." />
                              <CommandList>
                                <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {usuarios.map((u) => (
                                    <CommandItem
                                      key={u.codusuario}
                                      value={u.codusuario}
                                      onSelect={() => field.onChange(u.codusuario)}
                                    >
                                      {u.nome}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </PopoverPortal>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Cargo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valor_inicial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor inicial</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valor_final"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor final</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nivel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit">Salvar</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormAprovadorOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteAprovadorId !== null}
        onOpenChange={(open) => !open && setDeleteAprovadorId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir aprovador?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteAprovadorId(null)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluirAprovador}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {error && (
        <p className="mt-4 text-center text-sm text-destructive">Erro: {error}</p>
      )}

      {searched && results.length === 0 && !loading && !error && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Nenhum pagamento em aberto (Impostos). Configure o backend para a API PagamentosImpostos.
        </p>
      )}
    </div>
  )
}
