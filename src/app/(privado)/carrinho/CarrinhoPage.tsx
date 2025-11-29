'use client'

import React, {
    useEffect,
    useState,
} from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Loader2, Trash2 } from "lucide-react";
import { Carrinho, CentroDeCusto, ContaFinanceira, createElement, getAllCentrosDeCusto, getAllContasFinanceiras, getAllProdutos, ItemCarrinho, Produto } from '@/services/carrinhoService';
import { Label } from '@radix-ui/react-label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Page() {
    const titulo = 'Carrinho de Compras'
    const [isLoading, setIsLoading] = useState(false)
    const [centrosDeCusto, setCentrosDeCusto] = useState<CentroDeCusto[]>([])
    const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carrinho, setCarrinho] = useState<Carrinho>({ descricao: '', tipo_movimento: '', itens: [] })
    const [produtosSubmit, setProdutosSubmit] = useState<ItemCarrinho[]>([])
    const [error, setError] = useState<string | null>(null)

    const [form_centroCusto, setFormCentroCusto] = useState('')
    const [form_codconta, setFormCodconta] = useState('')
    const [form_produto, setFormProduto] = useState('')
    const [form_qtd, setFormQtd] = useState('')
    const [form_item_desc, setFormItemDesc] = useState('')


    useEffect(() => {
        buscaCentrosDeCusto();
    }, [])

    async function buscaCentrosDeCusto() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllCentrosDeCusto()
            setCentrosDeCusto(dados)
            setContasFinanceiras([])
            setProdutos([])
        } catch (err) {
            setError((err as Error).message)
            setCentrosDeCusto([])
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSelectedCentroDeCusto(data: string) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllContasFinanceiras(data);
            setContasFinanceiras(dados)
            setProdutos([])
        } catch (err) {
            setError((err as Error).message)
            setContasFinanceiras([])
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSelectedContaFinanceira(data: string) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllProdutos(data);
            setProdutos(dados)
        } catch (err) {
            setError((err as Error).message)
            setProdutos([])
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSubmit() {
        setIsLoading(true)
        setError(null)
        carrinho.itens = produtosSubmit
        try {
            await createElement(carrinho)
            toast.success('Carrinho enviado com sucesso!')
            window.location.reload()
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    function adicionarItem() {
        const item = produtos.find(p => p.idprd.toString() === form_produto)
        if (!item) return
        const novo: ItemCarrinho = {
            idprd: item.idprd,
            produto: item.produto,
            codconta: form_codconta,
            descricao: form_item_desc,
            ccusto: form_centroCusto,
            quantidade: Number(form_qtd)
        }
        setProdutosSubmit(prev => [...prev, novo])
        setFormProduto('')
        setFormQtd('')
        setFormItemDesc('')
    }

    function removerItem(index: number) {
        setProdutosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="p-6">
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>Tipo de movimento</Label>
                        <Select onValueChange={v => setCarrinho({ ...carrinho, tipo_movimento: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem key={1} value={"1.1.01"}>{"1.1.01 - Requisição de compra"}</SelectItem>
                                <SelectItem key={2} value={"1.1.02"}>{"1.1.02 - Requisições administrativas"}</SelectItem>
                                <SelectItem key={3} value={"1.1.04"}>{"1.1.04 - Requisição de sistemas - Terceiros"}</SelectItem>
                                <SelectItem key={4} value={"1.1.05"}>{"1.1.05 - Requisição manutenção"}</SelectItem>
                                <SelectItem key={5} value={"1.1.10"}>{"1.1.10 - Requisição de adiantamento"}</SelectItem>
                                <SelectItem key={6} value={"1.1.11"}>{"1.1.11 - Requisição de RDV"}</SelectItem>
                                <SelectItem key={7} value={"1.1.12"}>{"1.1.12 - Requisição de estoque"}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Descrição do Carrinho</Label>
                        <Input
                            value={carrinho.descricao}
                            onChange={e => setCarrinho({ ...carrinho, descricao: e.target.value })}
                        />
                    </div>


                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Centro de Custo</Label>
                            <Select onValueChange={v => { setFormCentroCusto(v); handleSelectedCentroDeCusto(v); }}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {centrosDeCusto.map((x, i) => (
                                        <SelectItem key={i} value={x.ccusto}>{x.ccusto + " - " + x.custo}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <div>
                            <Label>Conta Financeira</Label>
                            <Select onValueChange={v => { setFormCodconta(v); handleSelectedContaFinanceira(v); }}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {contasFinanceiras.map((x, i) => (
                                        <SelectItem key={i} value={x.codconta}>{x.codconta + " - " + x.contabil}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <div>
                            <Label>Produto</Label>
                            <Select onValueChange={setFormProduto}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {produtos.map((x) => (
                                        <SelectItem key={x.idprd} value={x.idprd.toString()}>{x.idprd + " - " + x.produto}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Qtd</Label>
                            <Input type="number" value={form_qtd} onChange={e => setFormQtd(e.target.value)} />
                        </div>
                        <div>
                            <Label>Descrição</Label>
                            <Input value={form_item_desc} onChange={e => setFormItemDesc(e.target.value)} />
                        </div>
                    </div>

                    <Button onClick={adicionarItem}>Adicionar Item</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Itens Adicionados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {produtosSubmit.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                            <span>{item.quantidade}x - {item.produto} - {item.descricao}</span>
                            <Button variant="destructive" size="icon" onClick={() => removerItem(i)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                    <Button onClick={handleSubmit}>Enviar carrinho</Button>
                </CardContent>
            </Card>

            {/* Loading */}
            <Dialog open={isLoading} onOpenChange={setIsLoading}>
                <DialogContent
                    showCloseButton={false}
                    className="flex flex-col items-center justify-center gap-4 border-none shadow-none bg-transparent max-w-[200px]"
                >
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center"></DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center rounded-2xl p-6 shadow-lg">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                        <p className="text-sm text-gray-600 mt-2">Carregando</p>
                    </div>
                </DialogContent>
            </Dialog>

            {
                error && (
                    <p className="mb-4 text-center text-sm text-destructive">
                        Erro: {error}
                    </p>
                )
            }
        </div >
    )
}