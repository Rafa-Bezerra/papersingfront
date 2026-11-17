import { Suspense } from 'react'
import MonitoramentoPage from './MonitoramentoPage'
import LoadingFallback from '@/components/LoadingFallback'

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MonitoramentoPage />
    </Suspense>
  )
}
