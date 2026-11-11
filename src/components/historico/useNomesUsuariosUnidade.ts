'use client'

import { useEffect, useMemo, useState } from 'react'

import { UsuarioLoginNome } from '@/components/usuario/UsuarioSelecionadoChip'
import { getAll, Usuario } from '@/services/usuariosService'

function mapaNomesComAliases(lista: Usuario[]): UsuarioLoginNome[] {
  const porLogin = new Map<string, string>()
  const porEmail = new Map<string, string>()

  for (const u of lista) {
    const cod = u.codusuario.trim().toLowerCase()
    const nome = (u.nome ?? '').trim()
    if (nome) porLogin.set(cod, nome)
    const email = (u.email ?? '').trim().toLowerCase()
    if (email && nome) porEmail.set(email, nome)
  }

  for (const u of lista) {
    const cod = u.codusuario.trim().toLowerCase()
    if (porLogin.has(cod)) continue
    const email = (u.email ?? '').trim().toLowerCase()
    const nomeEmail = email ? porEmail.get(email) : ''
    if (nomeEmail) porLogin.set(cod, nomeEmail)
  }

  return lista.map((u) => ({
    codusuario: u.codusuario,
    nome: porLogin.get(u.codusuario.trim().toLowerCase()) ?? u.nome ?? '',
  }))
}

/** Mapa login/chapa → nome (GUSUARIO da unidade, com chapa × login pelo e-mail) para exibir histórico. */
export function useNomesUsuariosUnidade(unidade?: string) {
  const [usuarios, setUsuarios] = useState<UsuarioLoginNome[]>([])

  useEffect(() => {
    let ativo = true
    getAll(unidade?.trim() || undefined)
      .then((lista) => {
        if (!ativo) return
        setUsuarios(mapaNomesComAliases(lista))
      })
      .catch(() => {
        if (ativo) setUsuarios([])
      })
    return () => {
      ativo = false
    }
  }, [unidade])

  const resolverNome = useMemo(() => {
    const porLogin = new Map<string, string>()
    for (const u of usuarios) {
      const cod = u.codusuario.trim().toLowerCase()
      const nome = (u.nome ?? '').trim()
      if (cod && nome) porLogin.set(cod, nome)
    }
    return (login: string, nomeApi?: string) => {
      const daApi = (nomeApi ?? '').trim()
      if (daApi) return daApi
      return porLogin.get(login.trim().toLowerCase()) ?? ''
    }
  }, [usuarios])

  return { resolverNome, usuarios }
}
