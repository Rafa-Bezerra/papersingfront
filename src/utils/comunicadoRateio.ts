import { ComunicadoItemFinanceiro, ComunicadoItemFinanceiroFlat } from "@/types/Comunicado"

/** Achata itens+rateio (nested) em uma linha por conta contábil — shape esperado pela API. */
export function achatarItensFinanceiros(itens: ComunicadoItemFinanceiro[]): ComunicadoItemFinanceiroFlat[] {
    return (itens ?? []).flatMap((item, numeroItem) =>
        (item.rateio ?? []).map(linha => ({
            id: linha.id,
            setor: item.setor,
            ccusto: item.ccusto,
            codconta: linha.codconta,
            valor: linha.valor,
            codigo_natureza_financeira: linha.codigo_natureza_financeira,
            numero_item: numeroItem,
            valor_total_item: item.valor_total,
            percentual: linha.percentual,
        }))
    )
}

/** Agrupa linhas flat vindas da API (por numero_item) de volta em itens+rateio (nested). */
export function agruparItensFinanceiros(linhas: ComunicadoItemFinanceiroFlat[]): ComunicadoItemFinanceiro[] {
    const grupos = new Map<string, ComunicadoItemFinanceiroFlat[]>()
    let indiceSemGrupo = 0
    for (const linha of linhas ?? []) {
        const chave = linha.numero_item != null ? `n${linha.numero_item}` : `s${indiceSemGrupo++}`
        if (!grupos.has(chave)) grupos.set(chave, [])
        grupos.get(chave)!.push(linha)
    }
    return Array.from(grupos.values()).map(grupo => {
        const valorTotal = grupo[0].valor_total_item ?? grupo.reduce((acc, l) => acc + (l.valor ?? 0), 0)
        return {
            setor: grupo[0].setor ?? '',
            ccusto: grupo[0].ccusto ?? '',
            valor_total: valorTotal,
            rateio: grupo.map(l => ({
                id: l.id,
                codconta: l.codconta ?? '',
                modo: 'valor' as const,
                percentual: l.percentual ?? (valorTotal > 0 ? (l.valor / valorTotal) * 100 : 0),
                valor: l.valor ?? 0,
                codigo_natureza_financeira: l.codigo_natureza_financeira,
            })),
        }
    })
}
