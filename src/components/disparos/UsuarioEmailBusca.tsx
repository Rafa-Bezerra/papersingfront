'use client'

import React, { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { buscarUsuariosDisparo, DisparoDestinatario } from '@/services/disparosService'
import { cn } from '@/lib/utils'

type Props = {
  onSelecionarEmail: (email: string) => void
  disabled?: boolean
}

export default function UsuarioEmailBusca({ onSelecionarEmail, disabled }: Props) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [usuarios, setUsuarios] = useState<DisparoDestinatario[]>([])
  const [carregando, setCarregando] = useState(false)
  const [selecionado, setSelecionado] = useState<DisparoDestinatario | null>(null)

  useEffect(() => {
    const q = termo.trim()
    if (q.length < 2) {
      setUsuarios([])
      return
    }

    const timer = window.setTimeout(async () => {
      setCarregando(true)
      try {
        const lista = await buscarUsuariosDisparo(q)
        setUsuarios(lista)
      } catch (err) {
        setUsuarios([])
        toast.error(err instanceof Error ? err.message : 'Falha ao buscar usuários.')
      } finally {
        setCarregando(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [termo])

  return (
    <div className="min-w-[220px] flex-1 max-w-md space-y-1">
      <Label>Buscar usuário cadastrado</Label>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-10 w-full justify-between font-normal"
          >
            <span className="truncate text-left">
              {selecionado
                ? `${selecionado.nome} (${selecionado.email})`
                : 'Nome, login ou e-mail…'}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Digite pelo menos 2 caracteres"
              value={termo}
              onValueChange={setTermo}
            />
            <CommandList>
              <CommandEmpty>
                {carregando
                  ? 'Buscando…'
                  : termo.trim().length < 2
                    ? 'Digite nome, login ou e-mail.'
                    : 'Nenhum usuário encontrado nesta unidade.'}
              </CommandEmpty>
              <CommandGroup>
                {usuarios.map((u) => (
                  <CommandItem
                    key={`${u.usuario}-${u.email}`}
                    value={`${u.usuario} ${u.nome} ${u.email}`}
                    onSelect={() => {
                      setSelecionado(u)
                      onSelecionarEmail(u.email)
                      setAberto(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selecionado?.usuario === u.usuario ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.usuario} · {u.email}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {carregando && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Buscando usuários…
        </p>
      )}
    </div>
  )
}
