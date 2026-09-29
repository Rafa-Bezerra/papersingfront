export type PapersignConfigNavItem = {
  title: string
  url: string
}

export function buildPapersignConfigNav(unidade: string): PapersignConfigNavItem[] {
  const items: PapersignConfigNavItem[] = [
    { title: 'Alçadas', url: '/alcadas' },
    { title: 'Usuários', url: '/usuarios' },
    { title: 'Aprovadores Borderô', url: '/borderoaprovadores' },
    { title: 'Aprovadores Restritos', url: '/restritoaprovadores' },
    { title: 'Fornecedores Restritos', url: '/fornecedores-restritos' },
    { title: 'Aprovadores Impostos', url: '/impostosaprovadores' },
    { title: 'Aprovadores Financeiro', url: '/financeiroaprovadores' },
    { title: 'Aprovadores Fiscal', url: '/fiscalaprovadores' },
    { title: 'Aprovadores RH', url: '/rhaprovadores' },
    { title: 'Centros de custos', url: '/centros-custos' },
    { title: 'Disparos', url: '/disparos' },
    { title: 'Cadastro de externos', url: '/cadastro-externos' },
  ]
  if (unidade.trim().toUpperCase() === 'WAY CSC') {
    items.push({ title: 'Status do pedido', url: '/status-pedido' })
  }
  return items
}
