'use client'

import React, { useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowRight, Check, ChevronsUpDown, RefreshCw, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { PopoverPortal } from '@radix-ui/react-popover'
import {
  aplicarUnificacaoUsuario,
  buscarUsuariosUnificacao,
  previewUnificacaoUsuario,
  type UnificacaoLinha,
  type UnificacaoPreview,
  type UnificacaoUsuarioItem,
} from '@/services/unificacaoUsuarioService'

function UsuarioCombobox({
  label,
  placeholder,
  value,
  selected,
  options,
  loading,
  onSearch,
  onSelect,
}: {
  label: string
  placeholder: string
  value: string
  selected: UnificacaoUsuarioItem | null
  options: UnificacaoUsuarioItem[]
  loading: boolean
  onSearch: (q: string) => void
  onSelect: (u: UnificacaoUsuarioItem) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selected
              ? `${selected.codusuario} — ${selected.nome}`
              : value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar por login ou nome..."
                onValueChange={onSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {loading ? 'Buscando...' : 'Nenhum usuário encontrado.'}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((u) => (
                    <CommandItem
                      key={u.codusuario}
                      value={u.codusuario}
                      onSelect={() => {
                        onSelect(u)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          selected?.codusuario === u.codusuario ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <span className="font-medium">{u.codusuario}</span>
                      <span className="ml-2 text-muted-foreground truncate">{u.nome}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </div>
  )
}

/** Painel CSC: unifica login chapa → nominal em alçadas, RDV, assinaturas e demais referências. */
export default function UnificacaoUsuarioPanel() {
  const [chapa, setChapa] = useState('')
  const [nominal, setNominal] = useState('')
  const [chapaSel, setChapaSel] = useState<UnificacaoUsuarioItem | null>(null)
  const [nominalSel, setNominalSel] = useState<UnificacaoUsuarioItem | null>(null)
  const [optsChapa, setOptsChapa] = useState<UnificacaoUsuarioItem[]>([])
  const [optsNominal, setOptsNominal] = useState<UnificacaoUsuarioItem[]>([])
  const [loadingChapa, setLoadingChapa] = useState(false)
  const [loadingNominal, setLoadingNominal] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingAplicar, setLoadingAplicar] = useState(false)
  const [preview, setPreview] = useState<UnificacaoPreview | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function buscarChapa(q: string) {
    setLoadingChapa(true)
    try {
      setOptsChapa(await buscarUsuariosUnificacao(q))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingChapa(false)
    }
  }

  async function buscarNominal(q: string) {
    setLoadingNominal(true)
    try {
      setOptsNominal(await buscarUsuariosUnificacao(q))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingNominal(false)
    }
  }

  async function handlePreview() {
    if (!chapa.trim() || !nominal.trim()) {
      toast.error('Informe a chapa e o login nominal.')
      return
    }
    setLoadingPreview(true)
    try {
      const data = await previewUnificacaoUsuario(chapa, nominal)
      setPreview(data)
      if (!data.pode_aplicar) toast.warning('Nenhum registro encontrado para unificar.')
    } catch (err) {
      toast.error((err as Error).message)
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleAplicar() {
    setLoadingAplicar(true)
    try {
      const res = await aplicarUnificacaoUsuario(chapa, nominal)
      toast.success(
        `Unificação concluída: ${res.total_atualizado} referência(s) atualizada(s). Registro salvo na aba Auditoria.`
      )
      setConfirmOpen(false)
      setPreview(null)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingAplicar(false)
    }
  }

  const colunas = useMemo<ColumnDef<UnificacaoLinha>[]>(
    () => [
      { accessorKey: 'tabela', header: 'Tabela' },
      { accessorKey: 'coluna', header: 'Coluna' },
      {
        accessorKey: 'quantidade',
        header: 'Registros',
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.quantidade}</Badge>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserRound className="h-5 w-5" />
            Unificação de usuário (chapa → nominal)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Migra o login chapa (ex.: <code className="text-xs">1-00248</code>) para o login nominal
            (ex.: <code className="text-xs">wendel.sousa</code>) em alçadas, RDV, assinaturas,
            comunicados internos e todas as demais tabelas do SistAprovacao que referenciam o usuário.
          </p>

          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <div className="space-y-2">
              <UsuarioCombobox
                label="Usuário chapa (origem)"
                placeholder="Buscar na lista..."
                value={chapa}
                selected={chapaSel}
                options={optsChapa}
                loading={loadingChapa}
                onSearch={buscarChapa}
                onSelect={(u) => {
                  setChapaSel(u)
                  setChapa(u.codusuario)
                  setPreview(null)
                }}
              />
              <Input
                value={chapa}
                onChange={(e) => {
                  setChapa(e.target.value)
                  setChapaSel(null)
                  setPreview(null)
                }}
                placeholder="Ou digite a chapa (ex.: 1-00248)"
              />
            </div>
            <div className="hidden md:flex items-center justify-center pb-2 text-muted-foreground">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <UsuarioCombobox
                label="Usuário nominal (destino)"
                placeholder="Buscar na lista..."
                value={nominal}
                selected={nominalSel}
                options={optsNominal}
                loading={loadingNominal}
                onSearch={buscarNominal}
                onSelect={(u) => {
                  setNominalSel(u)
                  setNominal(u.codusuario)
                  setPreview(null)
                }}
              />
              <Input
                value={nominal}
                onChange={(e) => {
                  setNominal(e.target.value)
                  setNominalSel(null)
                  setPreview(null)
                }}
                placeholder="Ou digite o login (ex.: wendel.sousa)"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handlePreview}
              disabled={loadingPreview || !chapa.trim() || !nominal.trim()}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loadingPreview ? 'animate-spin' : ''}`} />
              Simular
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!preview?.pode_aplicar || loadingPreview}
            >
              Aplicar unificação
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <>
          {preview.avisos.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardContent className="pt-4 space-y-1">
                {preview.avisos.map((a) => (
                  <p key={a} className="text-sm text-amber-900 dark:text-amber-100">{a}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {preview.gusuarios.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">GUSUARIO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {preview.gusuarios.map((g) => (
                  <div
                    key={g.sequencial}
                    className="flex flex-wrap items-center gap-2 text-sm border-b border-border/50 pb-2 last:border-0"
                  >
                    <Badge variant={g.eh_chapa ? 'destructive' : 'default'}>
                      {g.eh_chapa ? 'Chapa' : g.eh_nominal ? 'Nominal' : '—'}
                    </Badge>
                    <span className="font-medium">{g.codusuario}</span>
                    <span className="text-muted-foreground">{g.nome}</span>
                    <span className="text-muted-foreground">({g.unidade})</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Referências a atualizar ({preview.total_referencias} registro
                {preview.total_referencias === 1 ? '' : 's'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preview.linhas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma referência nas tabelas do sistema (somente GUSUARIO, se houver).
                </p>
              ) : (
                <DataTable columns={colunas} data={preview.linhas} />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar unificação</DialogTitle>
            <DialogDescription>
              Esta operação é irreversível. Todos os registros com login{' '}
              <strong>{chapa}</strong> passarão a <strong>{nominal}</strong> no SistAprovacao.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={loadingAplicar}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleAplicar} disabled={loadingAplicar}>
              {loadingAplicar ? 'Aplicando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
