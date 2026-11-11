'use client'

import React, { useEffect, useState } from 'react'
import { ChevronsUpDown, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PopoverPortal } from '@radix-ui/react-popover'
import { UsuarioAncoraTriggerLabel } from '@/components/usuario/UsuarioSelecionadoChip'
import { getAll, Usuario } from '@/services/usuariosService'

type Props = {
  id?: string
  value: string
  onValueChange: (login: string) => void
  /** Unidade para carregar GUSUARIO (opcional). */
  unidadeFiltro?: string
  /** Nome por login/chapa (ex.: histórico com aliases). */
  resolverNome?: (login: string) => string
  className?: string
}

export function HistoricoUsuarioFiltroGusuario({
  id,
  value,
  onValueChange,
  unidadeFiltro,
  resolverNome,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(false)
  const [termoLivre, setTermoLivre] = useState('')

  useEffect(() => {
    setCarregando(true)
    getAll(unidadeFiltro?.trim() || undefined)
      .then((lista) => setUsuarios(lista.filter((u) => u.ativo !== false)))
      .catch(() => setUsuarios([]))
      .finally(() => setCarregando(false))
  }, [unidadeFiltro])

  const nomeSelecionado =
    resolverNome?.(value) ||
    usuarios.find((u) => u.codusuario.toLowerCase() === value.toLowerCase())?.nome ||
    ''

  return (
    <div className={className}>
      <div className="flex gap-1">
        <Popover modal open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              className="h-auto min-h-10 flex-1 justify-between py-2 font-normal"
            >
              <UsuarioAncoraTriggerLabel
                login={value}
                nome={nomeSelecionado}
                vazio={carregando ? 'Carregando usuários…' : 'Buscar por nome ou login'}
              />
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent className="w-[min(24rem,90vw)] p-0" align="start">
              <Command shouldFilter>
                <CommandInput
                  placeholder="Nome ou login…"
                  onValueChange={(v) => setTermoLivre(v)}
                />
                <CommandList>
                  <CommandEmpty>
                    {carregando ? 'Carregando…' : 'Nenhum usuário. Use a opção abaixo para filtrar por texto.'}
                  </CommandEmpty>
                  {termoLivre.trim().length >= 2 ? (
                    <CommandGroup heading="Texto livre">
                      <CommandItem
                        value={`filtrar ${termoLivre}`}
                        onSelect={() => {
                          onValueChange(termoLivre.trim())
                          setOpen(false)
                        }}
                      >
                        Filtrar histórico por &quot;{termoLivre.trim()}&quot;
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                  <CommandGroup heading="Usuários cadastrados">
                    {usuarios.map((u) => (
                      <CommandItem
                        key={u.codusuario}
                        value={`${u.codusuario} ${u.nome}`}
                        onSelect={() => {
                          onValueChange(u.codusuario)
                          setOpen(false)
                        }}
                      >
                        {u.codusuario} — {u.nome}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </PopoverPortal>
        </Popover>
        {value.trim() ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Limpar filtro de usuário"
            onClick={() => onValueChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
