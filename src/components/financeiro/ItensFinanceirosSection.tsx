'use client'

// Bloco de "Rateio dos Itens" (item = setor + centro de custo + valor total, distribuído entre
// uma ou mais contas contábeis, cada linha já com seu próprio centro de custo) — extraído de
// ComunicadosPage.tsx para ser reaproveitado por qualquer formulário que precise do mesmo padrão
// de itens/rateio (Comunicados, e o diálogo "Criar Financeiro" de Pagamentos Impostos/RH).
import { useFieldArray, UseFormReturn, FieldValues } from 'react-hook-form'
import { ChevronsUpDown, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from '@/components/ui/command'
import { CentroDeCusto, ContaFinanceira } from '@/services/carrinhoService'
import { ComunicadoItemFinanceiro } from '@/types/Comunicado'

export type FormComItensFinanceiros = { itensFinanceiros: ComunicadoItemFinanceiro[] }

export function ItensFinanceirosSection<T extends FieldValues & FormComItensFinanceiros>({
    form,
    centrosDeCusto,
    contasFinanceiras,
    openCcustoIndex,
    setOpenCcustoIndex,
    openCcustoRateioIndex,
    setOpenCcustoRateioIndex,
    openCodcontaIndex,
    setOpenCodcontaIndex,
    mostrarNaturezaFinanceira,
    titulo = 'Rateio dos Itens',
}: {
    form: UseFormReturn<T>,
    centrosDeCusto: CentroDeCusto[],
    contasFinanceiras: ContaFinanceira[],
    openCcustoIndex: number | null,
    setOpenCcustoIndex: (v: number | null) => void,
    openCcustoRateioIndex: string | null,
    setOpenCcustoRateioIndex: (v: string | null) => void,
    openCodcontaIndex: string | null,
    setOpenCodcontaIndex: (v: string | null) => void,
    mostrarNaturezaFinanceira?: boolean,
    titulo?: string,
}) {
    const { control } = form;
    const { fields, append, remove } = useFieldArray({ control, name: 'itensFinanceiros' as never });

    return (
        <Card id="tour-ci-itens">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{titulo}</CardTitle>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({
                        setor: '', ccusto: '', valor_total: 0,
                        rateio: [{ ccusto: '', codconta: '', modo: 'valor', percentual: 100, valor: 0, codigo_natureza_financeira: '' }],
                    } as never)}
                >
                    + Adicionar item
                </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {fields.map((field, index) => (
                    <ItemFinanceiroFields
                        key={field.id}
                        itemIndex={index}
                        podeRemover={fields.length > 1}
                        onRemover={() => remove(index)}
                        form={form}
                        centrosDeCusto={centrosDeCusto}
                        contasFinanceiras={contasFinanceiras}
                        openCcustoIndex={openCcustoIndex}
                        setOpenCcustoIndex={setOpenCcustoIndex}
                        openCcustoRateioIndex={openCcustoRateioIndex}
                        setOpenCcustoRateioIndex={setOpenCcustoRateioIndex}
                        openCodcontaIndex={openCodcontaIndex}
                        setOpenCodcontaIndex={setOpenCodcontaIndex}
                        mostrarNaturezaFinanceira={mostrarNaturezaFinanceira}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

// Um item do rateio: setor + centro de custo + valor total, distribuído entre uma ou mais contas
// contábeis (cada linha em modo "valor" ou "percentual" — o campo não editado é sempre recalculado).
function ItemFinanceiroFields<T extends FieldValues & FormComItensFinanceiros>({
    itemIndex,
    podeRemover,
    onRemover,
    form,
    centrosDeCusto,
    contasFinanceiras,
    openCcustoIndex,
    setOpenCcustoIndex,
    openCcustoRateioIndex,
    setOpenCcustoRateioIndex,
    openCodcontaIndex,
    setOpenCodcontaIndex,
    mostrarNaturezaFinanceira,
}: {
    itemIndex: number,
    podeRemover: boolean,
    onRemover: () => void,
    form: UseFormReturn<T>,
    centrosDeCusto: CentroDeCusto[],
    contasFinanceiras: ContaFinanceira[],
    openCcustoIndex: number | null,
    setOpenCcustoIndex: (v: number | null) => void,
    openCcustoRateioIndex: string | null,
    setOpenCcustoRateioIndex: (v: string | null) => void,
    openCodcontaIndex: string | null,
    setOpenCodcontaIndex: (v: string | null) => void,
    mostrarNaturezaFinanceira?: boolean,
}) {
    const { control, setValue, getValues } = form;
    const { fields: rateioFields, append: appendRateio, remove: removeRateio } = useFieldArray({
        control, name: `itensFinanceiros.${itemIndex}.rateio` as never,
    });
    const item = form.watch(`itensFinanceiros.${itemIndex}` as never) as unknown as ComunicadoItemFinanceiro | undefined;
    const valorTotal = item?.valor_total ?? 0;
    const somaRateio = (item?.rateio ?? []).reduce((acc, r) => acc + (Number(r?.valor) || 0), 0);
    const restante = Math.round((valorTotal - somaRateio) * 100) / 100;

    function recalcularRateioPorValorTotal(novoTotal: number) {
        const linhas = getValues(`itensFinanceiros.${itemIndex}.rateio` as never) as ComunicadoItemFinanceiro['rateio'] ?? [];
        linhas.forEach((linha, ri) => {
            if (linha.modo === 'percentual') {
                const novoValor = Math.round((Number(linha.percentual) || 0) / 100 * novoTotal * 100) / 100;
                setValue(`itensFinanceiros.${itemIndex}.rateio.${ri}.valor` as never, novoValor as never);
            }
        });
    }

    function onChangeValorLinha(ri: number, novoValor: number) {
        setValue(`itensFinanceiros.${itemIndex}.rateio.${ri}.valor` as never, novoValor as never);
        const total = (getValues(`itensFinanceiros.${itemIndex}.valor_total` as never) as number) || 0;
        const novoPercentual = total > 0 ? Math.round((novoValor / total) * 100 * 100) / 100 : 0;
        setValue(`itensFinanceiros.${itemIndex}.rateio.${ri}.percentual` as never, novoPercentual as never);
    }

    function onChangePercentualLinha(ri: number, novoPercentual: number) {
        setValue(`itensFinanceiros.${itemIndex}.rateio.${ri}.percentual` as never, novoPercentual as never);
        const total = (getValues(`itensFinanceiros.${itemIndex}.valor_total` as never) as number) || 0;
        const novoValor = Math.round((novoPercentual / 100) * total * 100) / 100;
        setValue(`itensFinanceiros.${itemIndex}.rateio.${ri}.valor` as never, novoValor as never);
    }

    return (
        <div className="border rounded-md p-3 flex flex-col gap-3 relative">
            {podeRemover && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={onRemover}
                >
                    <X className="w-4 h-4" />
                </Button>
            )}
            <span className="text-sm font-medium text-muted-foreground">Item {itemIndex + 1}</span>

            {/* Setor */}
            <FormField
                control={control}
                name={`itensFinanceiros.${itemIndex}.setor` as never}
                render={({ field: f }) => (
                    <FormItem>
                        <FormLabel>Setor</FormLabel>
                        <FormControl>
                            <Input {...f} placeholder="Ex: Tecnologia da Informação" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Centro de Custo */}
            <FormField
                control={control}
                name={`itensFinanceiros.${itemIndex}.ccusto` as never}
                rules={{ required: 'Centro de custo obrigatório' }}
                render={({ field: f }) => (
                    <FormItem>
                        <FormLabel>Centro de Custo</FormLabel>
                        <FormControl>
                            <Popover open={openCcustoIndex === itemIndex} onOpenChange={open => setOpenCcustoIndex(open ? itemIndex : null)} modal={false}>
                                <PopoverTrigger asChild>
                                    <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpenCcustoIndex(itemIndex)}>
                                        {centrosDeCusto.find(c => c.ccusto === f.value)?.custo ?? 'Selecione'}
                                        <ChevronsUpDown className="opacity-50 size-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[600px] pointer-events-auto">
                                    <Command filter={(value, search) => {
                                        const label = centrosDeCusto.find(m => m.ccusto === value)?.custo || ''
                                        return (label.toLowerCase().includes(search.toLowerCase()) || value.toLowerCase().includes(search.toLowerCase())) ? 1 : 0
                                    }}>
                                        <CommandInput placeholder="Buscar centro..." />
                                        <CommandList>
                                            <CommandEmpty>Nenhum encontrado</CommandEmpty>
                                            <CommandGroup>
                                                {centrosDeCusto.map(c => (
                                                    <CommandItem key={c.ccusto} value={c.ccusto} onSelect={() => { f.onChange(c.ccusto); setOpenCcustoIndex(null) }}>
                                                        {c.ccusto} - {c.custo}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Valor Total do item */}
            <FormField
                control={control}
                name={`itensFinanceiros.${itemIndex}.valor_total` as never}
                rules={{ required: 'Valor total obrigatório' }}
                render={({ field: f }) => (
                    <FormItem>
                        <FormLabel>Valor Total do Item (R$)</FormLabel>
                        <FormControl>
                            <Input
                                type="number" step="0.01" min="0"
                                {...f}
                                onChange={e => {
                                    const novoTotal = parseFloat(e.target.value) || 0;
                                    f.onChange(novoTotal);
                                    recalcularRateioPorValorTotal(novoTotal);
                                }}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Rateio entre contas contábeis */}
            <div className="flex flex-col gap-3 border-t pt-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Rateio entre contas contábeis</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendRateio({
                            ccusto: (getValues(`itensFinanceiros.${itemIndex}.ccusto` as never) as string) || '',
                            codconta: '', modo: 'valor', percentual: 0, valor: 0, codigo_natureza_financeira: '',
                        } as never)}
                    >
                        + Adicionar conta
                    </Button>
                </div>

                {rateioFields.map((rateioField, ri) => {
                    const linha = item?.rateio?.[ri];
                    const modo = linha?.modo ?? 'valor';
                    const popoverKey = `${itemIndex}-${ri}`;
                    return (
                        <div key={rateioField.id} className="border rounded-md p-3 flex flex-col gap-3 relative">
                            {rateioFields.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-7 w-7"
                                    onClick={() => removeRateio(ri)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}

                            {/* Centro de Custo da linha (default: centro de custo do item) */}
                            <FormField
                                control={control}
                                name={`itensFinanceiros.${itemIndex}.rateio.${ri}.ccusto` as never}
                                rules={{ required: 'Centro de custo obrigatório' }}
                                render={({ field: f }) => (
                                    <FormItem>
                                        <FormLabel>Centro de Custo</FormLabel>
                                        <FormControl>
                                            <Popover open={openCcustoRateioIndex === popoverKey} onOpenChange={open => setOpenCcustoRateioIndex(open ? popoverKey : null)} modal={false}>
                                                <PopoverTrigger asChild>
                                                    <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpenCcustoRateioIndex(popoverKey)}>
                                                        {centrosDeCusto.find(c => c.ccusto === f.value)?.custo ?? 'Selecione'}
                                                        <ChevronsUpDown className="opacity-50 size-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 w-[600px] pointer-events-auto">
                                                    <Command filter={(value, search) => {
                                                        const label = centrosDeCusto.find(m => m.ccusto === value)?.custo || ''
                                                        return (label.toLowerCase().includes(search.toLowerCase()) || value.toLowerCase().includes(search.toLowerCase())) ? 1 : 0
                                                    }}>
                                                        <CommandInput placeholder="Buscar centro..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhum encontrado</CommandEmpty>
                                                            <CommandGroup>
                                                                {centrosDeCusto.map(c => (
                                                                    <CommandItem key={c.ccusto} value={c.ccusto} onSelect={() => { f.onChange(c.ccusto); setOpenCcustoRateioIndex(null) }}>
                                                                        {c.ccusto} - {c.custo}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Conta Contábil */}
                            <FormField
                                control={control}
                                name={`itensFinanceiros.${itemIndex}.rateio.${ri}.codconta` as never}
                                rules={{ required: 'Conta contábil obrigatória' }}
                                render={({ field: f }) => (
                                    <FormItem>
                                        <FormLabel>Conta Contábil</FormLabel>
                                        <FormControl>
                                            <Popover open={openCodcontaIndex === popoverKey} onOpenChange={open => setOpenCodcontaIndex(open ? popoverKey : null)} modal={false}>
                                                <PopoverTrigger asChild>
                                                    <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpenCodcontaIndex(popoverKey)}>
                                                        {contasFinanceiras.find(x => x.codconta === f.value)?.contabil ?? 'Selecione'}
                                                        <ChevronsUpDown className="opacity-50 size-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 w-[600px] pointer-events-auto">
                                                    <Command filter={(value, search) => {
                                                        const label = contasFinanceiras.find(m => m.codconta === value)?.contabil || contasFinanceiras.find(m => m.codconta === value)?.codconta || ''
                                                        return (label.toLowerCase().includes(search.toLowerCase()) || value.toLowerCase().includes(search.toLowerCase())) ? 1 : 0
                                                    }}>
                                                        <CommandInput placeholder="Buscar conta..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhum encontrado</CommandEmpty>
                                                            <CommandGroup>
                                                                {contasFinanceiras.map(x => (
                                                                    <CommandItem key={x.codconta} value={x.codconta} onSelect={() => {
                                                                        f.onChange(x.codconta);
                                                                        setValue(`itensFinanceiros.${itemIndex}.rateio.${ri}.codigo_natureza_financeira` as never, x.codconta as never);
                                                                        setOpenCodcontaIndex(null)
                                                                    }}>
                                                                        {x.codconta} - {x.contabil}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Toggle valor absoluto / percentual */}
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={modo === 'valor' ? 'default' : 'outline'}
                                    onClick={() => setValue(`itensFinanceiros.${itemIndex}.rateio.${ri}.modo` as never, 'valor' as never)}
                                >
                                    Valor (R$)
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={modo === 'percentual' ? 'default' : 'outline'}
                                    onClick={() => setValue(`itensFinanceiros.${itemIndex}.rateio.${ri}.modo` as never, 'percentual' as never)}
                                >
                                    Percentual (%)
                                </Button>
                            </div>

                            {modo === 'valor' ? (
                                <FormField
                                    control={control}
                                    name={`itensFinanceiros.${itemIndex}.rateio.${ri}.valor` as never}
                                    render={({ field: f }) => (
                                        <FormItem>
                                            <FormLabel>Valor (R$)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" min="0" {...f}
                                                    onChange={e => onChangeValorLinha(ri, parseFloat(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : (
                                <FormField
                                    control={control}
                                    name={`itensFinanceiros.${itemIndex}.rateio.${ri}.percentual` as never}
                                    render={({ field: f }) => (
                                        <FormItem>
                                            <FormLabel>Percentual (%)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" min="0" max="100" {...f}
                                                    onChange={e => onChangePercentualLinha(ri, parseFloat(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <span className="text-xs text-muted-foreground">
                                {modo === 'valor'
                                    ? `≈ ${(linha?.percentual ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% do valor total`
                                    : `≈ R$ ${(linha?.valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>

                            {/* Natureza Financeira — só quando quem opera detém a claim financeiro_totvs. */}
                            {mostrarNaturezaFinanceira && (
                                <FormField
                                    control={control}
                                    name={`itensFinanceiros.${itemIndex}.rateio.${ri}.codigo_natureza_financeira` as never}
                                    rules={{ required: 'Natureza Financeira obrigatória' }}
                                    render={({ field: f }) => (
                                        <FormItem>
                                            <FormLabel>Natureza Financeira (CODTBORCAMENTO)</FormLabel>
                                            <FormControl>
                                                <Input {...f} value={f.value ?? ''} placeholder="Ex: 1.01.001" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    );
                })}

                <span className={`text-sm font-medium ${Math.abs(restante) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                    Restante a ratear: R$ {restante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>
        </div>
    );
}
