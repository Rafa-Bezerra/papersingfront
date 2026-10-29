'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { getVinculos, VinculosCarrinho } from '@/services/carrinhoService'

interface Props {
    idmov: number | null
    onOpenChange: (open: boolean) => void
}

/**
 * Dialog somente leitura com os usuários de "Liberação de acesso" e "Compliance" vinculados
 * à movimentação pelo /carrinho. Compartilhado entre MovimentosPage e GeralPage.
 */
export default function VinculosMovimentoDialog({ idmov, onOpenChange }: Props) {
    const [vinculos, setVinculos] = useState<VinculosCarrinho | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (idmov == null) return
        let cancelado = false
        setVinculos(null)
        setIsLoading(true)
        getVinculos(idmov)
            .then(dados => { if (!cancelado) setVinculos(dados) })
            .catch(e => {
                if (cancelado) return
                toast.error(e instanceof Error ? e.message : 'Erro ao buscar vínculos.')
                onOpenChange(false)
            })
            .finally(() => { if (!cancelado) setIsLoading(false) })
        return () => { cancelado = true }
    }, [idmov])

    const secoes = [
        { titulo: 'Liberação de acesso', usuarios: vinculos?.liberacao_acesso ?? [] },
        { titulo: 'Avaliação de compliance', usuarios: vinculos?.compliance ?? [] },
    ]

    return (
        <Dialog open={idmov != null} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-center">{`Vínculos movimentação n° ${idmov ?? ''}`}</DialogTitle>
                </DialogHeader>
                {isLoading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {secoes.map(({ titulo, usuarios }) => (
                            <div key={titulo}>
                                <h3 className="mb-1 text-sm font-semibold">{titulo}</h3>
                                {usuarios.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Nenhum usuário vinculado.</p>
                                ) : (
                                    <ul className="list-disc pl-5 text-sm">
                                        {usuarios.map(u => <li key={u}>{u}</li>)}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
