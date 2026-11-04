'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingFallback from '@/components/LoadingFallback';

// Endereço antigo: a gestão agora é uma aba do módulo Frotas.
export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/frotas/?aba=gestao');
  }, [router]);
  return <LoadingFallback />;
}
