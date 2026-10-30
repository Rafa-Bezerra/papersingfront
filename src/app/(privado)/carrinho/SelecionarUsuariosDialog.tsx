'use client'

import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Usuario } from '@/types/Usuario'

type Props = {
    titulo: string
    open: boolean
    onOpenChange: (open: boolean) => void
    usuarios: Usuario[]
    value: string[]
    onChange: (codusuarios: string[]) => void
}

/** Dialog de seleção múltipla de usuários (liberação de acesso / compliance do carrinho). */
export default function SelecionarUsuariosDialog({ titulo, open, onOpenChange, usuarios, value, onChange }: Props) {
    const [busca, setBusca] = useState('')

    const filtrados = useMemo(() => {
        const termo = busca.trim().toLowerCase()
        if (!termo) return usuarios
        return usuarios.filter(u =>
            (u.nome ?? '').toLowerCase().includes(termo) || u.codusuario.toLowerCase().includes(termo)
        )
    }, [usuarios, busca])

    function alternar(codusuario: string, marcado: boolean) {
        onChange(marcado ? [...value, codusuario] : value.filter(c => c !== codusuario))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{titulo}</DialogTitle>
                </DialogHeader>
                <Input placeholder="Buscar usuário..." value={busca} onChange={e => setBusca(e.target.value)} />
                <div className="max-h-80 overflow-y-auto grid gap-2">
                    {filtrados.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
                    )}
                    {filtrados.map(u => (
                        <label key={u.codusuario} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                                checked={value.includes(u.codusuario)}
                                onCheckedChange={checked => alternar(u.codusuario, checked === true)}
                            />
                            <span>{u.nome} <span className="text-muted-foreground">({u.codusuario})</span></span>
                        </label>
                    ))}
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{value.length} selecionado(s)</span>
                    <Button type="button" onClick={() => onOpenChange(false)}>Concluir</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
