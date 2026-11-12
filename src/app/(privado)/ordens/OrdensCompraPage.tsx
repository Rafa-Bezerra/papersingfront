'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MovimentosPage from '../components/MovimentosPage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ABA_CONTRATO = 'contrato'

/** Mesmo critério do menu (AppSidebar): admin ou direito "Módulo Contratos" na sessão. */
function temModuloContratos(): boolean {
  try {
    const raw = sessionStorage.getItem('userData')
    if (!raw) return false
    const user = JSON.parse(raw)
    return Boolean(user.admin || user.modulo_contratos)
  } catch {
    return false
  }
}

export default function OrdensCompraPage({ tipos_movimento }: { tipos_movimento: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [podeContratos, setPodeContratos] = useState(false)
  const aba = podeContratos && searchParams.get('aba') === ABA_CONTRATO ? ABA_CONTRATO : 'ordens'

  useEffect(() => {
    setPodeContratos(temModuloContratos())
  }, [])

  function trocarAba(valor: string) {
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    if (valor === ABA_CONTRATO) sp.set('aba', ABA_CONTRATO)
    else sp.delete('aba')
    const qs = sp.toString()
    router.replace(qs ? `/ordens?${qs}` : '/ordens')
  }

  if (!podeContratos) {
    return <MovimentosPage titulo="Ordens de compra" tipos_movimento={tipos_movimento} />
  }

  return (
    <Tabs value={aba} onValueChange={trocarAba}>
      <div className="px-3 pt-3 sm:px-6 sm:pt-6">
        <TabsList>
          <TabsTrigger value="ordens">Ordens de compra</TabsTrigger>
          <TabsTrigger value={ABA_CONTRATO}>Requisições de contrato</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="ordens">
        <MovimentosPage titulo="Ordens de compra" tipos_movimento={tipos_movimento} />
      </TabsContent>
      <TabsContent value={ABA_CONTRATO}>
        <MovimentosPage titulo="Requisições de contrato" tipos_movimento={tipos_movimento} somenteContrato />
      </TabsContent>
    </Tabs>
  )
}
