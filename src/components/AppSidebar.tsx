// components/AppSidebar.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@/components/ui/sidebar'
import { NavSection } from '@/lib/data'
import { Button } from '@/components/ui/button'
import {
  Home,
  Users,
  Settings,
  ShoppingCart,
  Package,
  FileText,
  Briefcase,
  MoreHorizontal,
  User,
  ChevronLeft,
  ChevronRight,
  Search,
  Truck
} from 'lucide-react'
import { JSX } from 'react/jsx-runtime'
import { useIsMobile } from '@/hooks/use-mobile'

interface AppSidebarProps {
  navMain: NavSection[]
  isMobileOpen?: boolean
  onMobileToggle?: () => void
  isCollapsed?: boolean
  onCollapseToggle?: () => void
}

export default function AppSidebar({ navMain, isMobileOpen: externalMobileOpen, onMobileToggle, isCollapsed: externalCollapsed, onCollapseToggle }: AppSidebarProps) {
  const path = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [lastMobileClickTime, setLastMobileClickTime] = useState(0)
  const [lastCollapseClickTime, setLastCollapseClickTime] = useState(0)
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userAdmin, setUserAdmin] = useState(false)
  const [userDocumentos, setUserDocumentos] = useState(false)
  const [userBordero, setUserBordero] = useState(false)
  const [userComunicados, setUserComunicados] = useState(false)
  const [userCentrosCustos, setUserCentrosCustos] = useState(false)
  const [userRestrito, setUserRestrito] = useState(false)
  const [userAdministrativo, setUserAdministrativo] = useState(false)
  // const [userSolicitante, setUserSolicitante] = useState(false)
  const isMobileDevice = useIsMobile()
  // Usa o estado externo se fornecido, senão usa o interno
  const mobileOpen = externalMobileOpen !== undefined ? externalMobileOpen : isMobileOpen
  const toggleMobile = onMobileToggle || (() => setIsMobileOpen(!isMobileOpen))
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : isCollapsed
  const toggleCollapse = onCollapseToggle || (() => {
    setIsCollapsed(!isCollapsed)
  })

  useEffect(() => {
    const storedUser = sessionStorage.getItem("userData");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserName(user.nome);
        setUserEmail(user.email);
        setUserAdmin(user.admin);
        setUserDocumentos(user.documentos);
        setUserRestrito(user.restrito);
        setUserBordero(user.bordero);
        setUserComunicados(user.comunicados);
        setUserCentrosCustos(user.ccusto);
        setUserAdministrativo(user.administrativo);
        // setUserSolicitante(user.solicitante);
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      }
    }
  }, []);

  // Função para lidar com cliques duplos
  const handleMobileToggle = () => {
    if (!isMobileDevice) return
    const now = Date.now()
    if (now - lastMobileClickTime < 300) { // 300ms de debounce
      return
    }
    setLastMobileClickTime(now)
    toggleMobile()
  }

  const handleCollapseToggle = () => {
    const now = Date.now()
    if (now - lastCollapseClickTime < 300) { // 300ms de debounce
      return
    }
    setLastCollapseClickTime(now)
    toggleCollapse()
  }

  // Mapeamento de ícones para os itens do menu
  const iconMap: Record<string, JSX.Element> = {
    Inicio: <Home className="w-5 h-5" />,
    'Solicitação de compra': <ShoppingCart className="w-5 h-5" />,
    'Recebimento de materiais': <Package className="w-5 h-5" />,
    'Controle imobilizado': <Settings className="w-5 h-5" />,
    'Ordem de compra': <FileText className="w-5 h-5" />,
    'Aquisição de serviços': <Briefcase className="w-5 h-5" />,
    'Outras movimentações': <MoreHorizontal className="w-5 h-5" />,
    'Documentos': <FileText className="w-5 h-5" />,
    'Pagamentos CI': <FileText className="w-5 h-5" />,
    'Borderô': <FileText className="w-5 h-5" />,
    'Carrinho': <ShoppingCart className="w-5 h-5" />,
    'RDV': <Truck className="w-5 h-5" />,
    'Aprovação RDV': <Truck className="w-5 h-5" />,
    // Ícones dos 3 módulos novos (Gestão de Pessoas / Pagamentos G. Pessoas / Pagamentos Impostos)
    'Gestão de Pessoas': <User className="w-5 h-5" />,
    'Pagamentos G. Pessoas': <FileText className="w-5 h-5" />,
    'Pagamentos Impostos': <FileText className="w-5 h-5" />,
    'Aprovadores Borderô': <Users className="w-5 h-5" />,
    'Alçadas': <Users className="w-5 h-5" />,
    'Centros de custos': <Settings className="w-5 h-5" />,
    'Usuários': <User className="w-5 h-5" />,
    Configurações: <Settings className="w-5 h-5" />,
  }

  const configItems = [
    { title: 'Alçadas', url: '/alcadas' },
    { title: 'Usuários', url: '/usuarios' },
    { title: 'Aprovadores Borderô', url: '/borderoaprovadores' },
    { title: 'Aprovadores Restritos', url: '/restritoaprovadores' },
    { title: 'Aprovadores Impostos', url: '/impostosaprovadores' },
    { title: 'Aprovadores RH', url: '/rhaprovadores' },
    { title: 'Centros de custos', url: '/centros-custos' },
  ]

  return (
    <>
      {/* Overlay para mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={toggleMobile}
        />
      )}

      {/* Container do sidebar com botão de toggle */}
      <div className={`relative h-full ${mobileOpen ? 'block' : 'hidden'} lg:block`}>
        {/* Sidebar para mobile e desktop */}
        <div className={`sidebar-container relative transition-all duration-300 ease-in-out flex-shrink-0 h-full ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
          } border-r bg-card ${mobileOpen ? 'fixed left-0 top-0 z-50 w-64' : ''}`}>
          <div className={`h-full flex flex-col transition-all duration-300 ${collapsed ? 'px-1 py-4' : 'px-4 py-4'
            }`}>
            {/* Botão de toggle para desktop - posicionado dentro do sidebar */}
            <div className={`flex mb-2 transition-all duration-300 ${collapsed ? 'justify-center' : 'justify-end'
              }`}>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg transition-all duration-300 items-center justify-center"
                onClick={handleCollapseToggle}
                title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Logo/Header */}
            <div className={`mb-6 ${collapsed ? 'flex justify-center' : ''}`}>
              {!collapsed ? (
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">P</span>
                  </div>
                  <span className="font-semibold text-lg text-foreground">PaperSign</span>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">P</span>
                  </div>
                </div>
              )}
            </div>

            {/* Barra de pesquisa */}
            {!collapsed && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Menu de navegação */}
            <SidebarGroup>
              <SidebarMenu className="space-y-1">
                {navMain.map(section => (
                  <div key={section.title}>

                    {!collapsed && (
                      <div className="px-3 py-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {section.title}
                        </h3>
                      </div>
                    )}

                    {section.items.map(item => {
                      if (configItems.some(c => c.url === item.url)) return null
                      if (!userAdmin) {
                        if (!userAdministrativo) {
                          if (item.url === "/documentos" && !userDocumentos) return null;
                        }
                        if (item.url === "/bordero" && !userBordero) return null;
                        if (item.url === "/comunicados" && !userComunicados) return null;
                        if (item.url === "/centros-custos" && !userCentrosCustos) return null;
                        if (item.url === "/gestao-pessoas" && !userRestrito) return null;
                        if ([
                            "/alcadas", 
                            "/usuarios", 
                            "/borderoaprovadores", 
                            "/rdvaprovadores",
                            '/restritoaprovadores',
                            '/impostosaprovadores',
                            '/pagamentos-impostos',
                            '/pagamentos-rh',
                            '/rhaprovadores'
                          ].includes(item.url)) return null;
                      }
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={path === item.url || path.startsWith(item.url + '/')}
                            className={`w-full transition-all duration-200 ${collapsed ? 'justify-center px-2 py-2.5 rounded-md' : 'justify-start px-3'
                              } ${path === item.url || path.startsWith(item.url + '/')
                                ? 'bg-slate-100 dark:bg-slate-700 shadow-md font-semibold border border-slate-200 dark:border-slate-600'
                                : 'hover:bg-primary/10 text-foreground hover:shadow-sm hover:text-primary'
                              }`}
                            title={collapsed ? item.title : undefined}
                          >
                            <Link href={item.url} onClick={handleMobileToggle}>
                              <div className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'
                                }`}>
                                <span className={`flex-shrink-0 transition-colors duration-200 ${path === item.url || path.startsWith(item.url + '/')
                                  ? 'text-slate-800 dark:text-white'
                                  : 'text-foreground'
                                  }`}>
                                  {iconMap[item.title] ?? <span className="w-5 h-5" />}
                                </span>

                                {!collapsed && (
                                  <span className={`truncate text-sm ${path === item.url || path.startsWith(item.url + '/')
                                    ? 'text-slate-800 dark:text-white font-semibold'
                                    : 'text-foreground font-medium'
                                    }`}>
                                    {item.title}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </div>
                ))}
                {userAdmin && (
                  <SidebarMenuItem>
                    <details className="group">
                      <summary
                        className={`w-full list-none cursor-pointer transition-all duration-200 ${collapsed
                            ? 'flex justify-center px-2 py-2.5 rounded-md'
                            : 'flex items-center justify-between px-3 py-2'
                          } hover:bg-primary/10`}
                      >
                        <div className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'}`}>
                          <span className="flex-shrink-0">
                            {iconMap['Configurações']}
                          </span>

                          {!collapsed && (
                            <span className="text-sm font-medium text-foreground">
                              Configurações
                            </span>
                          )}
                        </div>

                        {!collapsed && (
                          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                        )}
                      </summary>

                      {!collapsed && (
                        <div className="mt-1 space-y-1">
                          {configItems.map(item => (
                            <SidebarMenuButton
                              key={item.url}
                              asChild
                              isActive={path === item.url || path.startsWith(item.url + '/')}
                              className={`ml-6 justify-start text-sm transition-colors ${path === item.url || path.startsWith(item.url + '/')
                                  ? 'bg-slate-100 dark:bg-slate-700 font-semibold'
                                  : 'hover:bg-primary/10'
                                }`}
                            >
                              <Link href={item.url} onClick={handleMobileToggle}>
                                {item.title}
                              </Link>
                            </SidebarMenuButton>
                          ))}
                        </div>
                      )}
                    </details>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroup>


            {/* Área inferior com informações do usuário */}
            {!collapsed && (
              <div className="mt-auto pt-4 border-t border-border">
                <div className="px-3 py-2">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        Olá, {userName.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {userEmail.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {collapsed && (
              <div className="mt-auto pt-4 border-t border-border">
                <div className="flex justify-center">
                  <div
                    className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors duration-200 cursor-pointer"
                    title="Usuário Logado"
                  >
                    <User className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
