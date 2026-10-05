import { toast } from 'sonner'

/**
 * Recusa por regra de negócio (HTTP 400/409): a API já explica o motivo em português.
 * A tela mostra só a mensagem, como aviso, sem "Erro 400 ao ...".
 */
export class AvisoApi extends Error {}

export async function erroDaResposta(res: Response, contexto: string): Promise<Error> {
    const texto = (await res.text()).trim()
    if (res.status === 400 || res.status === 409) {
        let msg = texto
        try {
            const json = JSON.parse(texto)
            if (json && typeof json === 'object') msg = json.message || json.erro || json.title || texto
        } catch { /* texto simples */ }
        if (msg) return new AvisoApi(msg)
    }
    return new Error(`Erro ${res.status} ao ${contexto}: ${texto}`)
}

export function mostrarErro(err: unknown) {
    const msg = (err as Error)?.message ?? String(err)
    if (err instanceof AvisoApi) toast.warning(msg, { duration: 10_000 })
    else toast.error(msg)
}
