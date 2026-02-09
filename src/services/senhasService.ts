import { API_BASE, headers } from "@/utils/constants";
import { AlterarSenha } from "@/types/Senha";

export async function updateSenha(
    payload: AlterarSenha
) {
    const res = await fetch(`${API_BASE}/api/Usuarios/alterar_senha`, { method: "POST", headers: headers(), body: JSON.stringify(payload) })
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao atualizar senha: ${msg}`);
    }
}

export type { AlterarSenha }