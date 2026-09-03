'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@radix-ui/react-label'
import {
    Dialog,
    DialogContent,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { RequisicaoDto, criarContrato, CriarContratoPayload, CriarContratoResult } from '@/services/requisicoesService'
import { TipoContrato } from '@/services/carrinhoService'

interface Props {
    requisicao: RequisicaoDto | null
    onOpenChange: (open: boolean) => void
    tiposContrato: TipoContrato[]
    onCriado: (idmov: number, resultado: CriarContratoResult) => void
}

/**
 * Dialog "Criar Contrato" compartilhado entre MovimentosPage e GeralPage — mesmos campos
 * e mesma regra de truncagem de OBSERVACAO (TCNT.OBSERVACAO no TOTVS é varchar(60)).
 */
export default function CriarContratoDialog({ requisicao, onOpenChange, tiposContrato, onCriado }: Props) {
    const [isCriandoContrato, setIsCriandoContrato] = useState(false)

    const formContrato = useForm<CriarContratoPayload>({
        defaultValues: {
            codtcn: '',
            periodo_de: '',
            periodo_ate: '',
            descricao: (requisicao?.requisicao.historico_movimento ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
            valor_contrato: requisicao?.requisicao.valor_total
        }
    })

    async function handleCriarContrato(data: CriarContratoPayload) {
        if (!requisicao) return
        const idmov = requisicao.requisicao.idmov
        setIsCriandoContrato(true)
        try {
            const resultado = await criarContrato(idmov, data)
            toast.success(resultado.message || "Contrato criado com sucesso.")
            onCriado(idmov, resultado)
            onOpenChange(false)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsCriandoContrato(false)
        }
    }

    if (!requisicao) return null

    return (
        <Dialog open={requisicao !== null} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-lg rounded-xl bg-background p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <DialogHeader>
                    <DialogTitle>Criar contrato — movimentação n° {requisicao.requisicao.idmov}</DialogTitle>
                </DialogHeader>
                <Form {...formContrato}>
                    <form onSubmit={formContrato.handleSubmit(handleCriarContrato)} className="grid gap-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Fornecedor</Label>
                            <p className="h-9 flex items-center text-sm">
                                {requisicao.requisicao.codigo_fornecedor} - {requisicao.requisicao.nome_fornecedor || '-'}
                            </p>
                        </div>

                        <FormField
                            control={formContrato.control}
                            name="descricao"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl>
                                        <Input maxLength={60} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={formContrato.control}
                                name="periodo_de"
                                rules={{ required: "Início da vigência obrigatório" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vigência - Início</FormLabel>
                                        <FormControl>
                                            <input
                                                type="date"
                                                className="border rounded-md h-9 px-3 w-full text-sm"
                                                value={field.value ?? ""}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={formContrato.control}
                                name="periodo_ate"
                                rules={{ required: "Fim da vigência obrigatório" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vigência - Fim</FormLabel>
                                        <FormControl>
                                            <input
                                                type="date"
                                                className="border rounded-md h-9 px-3 w-full text-sm"
                                                value={field.value ?? ""}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={formContrato.control}
                                name="codtcn"
                                rules={{ required: "Tipo de contrato obrigatório" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de contrato</FormLabel>
                                        <FormControl>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {tiposContrato.map(t => (
                                                        <SelectItem key={t.codtcn} value={t.codtcn}>
                                                            {t.codtcn} - {t.descricao}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={formContrato.control}
                                name="valor_contrato"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor do contrato</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isCriandoContrato}>
                                {isCriandoContrato ? 'Criando…' : 'Criar contrato'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
