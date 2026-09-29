'use client'

import React, { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { LucideIcon, SquarePlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import UsuarioEmailBusca from '@/components/disparos/UsuarioEmailBusca'

export type EmailNotificacaoRow = {
  id: number
  email: string
}

type Props = {
  title: string
  icon: LucideIcon
  description: string
  unidadeAtual: string
  emails: EmailNotificacaoRow[]
  loading: boolean
  novoEmail: string
  onNovoEmailChange: (value: string) => void
  onSalvar: () => void
  onExcluir: (id: number) => void
  salvando: boolean
  excluindoId: number | null
  inputId: string
  emptyMessage?: string
  listaVaziaHint?: string
}

export default function EmailsNotificacaoPanel({
  title,
  icon: Icon,
  description,
  unidadeAtual,
  emails,
  loading,
  novoEmail,
  onNovoEmailChange,
  onSalvar,
  onExcluir,
  salvando,
  excluindoId,
  inputId,
  emptyMessage = 'Nenhum e-mail cadastrado para esta unidade.',
  listaVaziaHint = 'Nenhum destinatário cadastrado — nenhuma notificação será enviada.',
}: Props) {
  const columns = useMemo<ColumnDef<EmailNotificacaoRow>[]>(() => [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'email', header: 'E-mail' },
    {
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="destructive"
          disabled={excluindoId === row.original.id}
          onClick={() => onExcluir(row.original.id)}
        >
          {excluindoId === row.original.id ? 'Excluindo…' : 'Excluir'}
        </Button>
      ),
    },
  ], [excluindoId, onExcluir])

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="rounded-md border p-4 space-y-3">
          <p className="text-sm">
            Unidade atual:{' '}
            <span className="font-medium">{unidadeAtual || '—'}</span>
            {' · '}
            {emails.length === 0
              ? listaVaziaHint
              : `${emails.length} destinatário(s) cadastrado(s).`}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <UsuarioEmailBusca
              disabled={salvando}
              onSelecionarEmail={onNovoEmailChange}
            />
            <div className="min-w-[220px] flex-1 max-w-sm space-y-1">
              <Label htmlFor={inputId}>E-mail do destinatário</Label>
              <Input
                id={inputId}
                type="email"
                value={novoEmail}
                onChange={(e) => onNovoEmailChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onSalvar()
                  }
                }}
                placeholder="email@grupowaybrasil.com.br"
              />
            </div>
            <Button type="button" onClick={onSalvar} disabled={salvando}>
              <SquarePlus className="mr-1 h-4 w-4" />
              {salvando ? 'Salvando…' : 'Novo'}
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={emails}
          loading={loading}
          hidePagination
          globalFilterAccessorKey={['email']}
          searchPlaceholder="Filtrar e-mail…"
          emptyMessage={emptyMessage}
        />
      </CardContent>
    </Card>
  )
}
