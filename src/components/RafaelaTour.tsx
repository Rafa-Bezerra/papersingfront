'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { API_BASE, headers, apiFetch } from '@/utils/constants'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type TourPasso = {
  ordem: number
  seletorCss?: string | null
  titulo?: string | null
  mensagem: string
  rota?: string | null
  lado?: string | null
}

type TourPendente = {
  exibir: boolean
  versao?: string
  titulo?: string
  mensagemIntro?: string | null
  mensagemFim?: string | null
  rotaInicial?: string | null
  passos?: TourPasso[]
}

type Fase = 'idle' | 'intro' | 'auto-start' | 'passos' | 'fim'

function ladoDriver(lado?: string | null): 'left' | 'top' | 'right' | 'bottom' {
  const v = (lado || 'right').toLowerCase()
  if (v === 'left' || v === 'top' || v === 'bottom' || v === 'right') return v
  return 'right'
}

function lerUserData(): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem('userData')
    if (!raw) return null
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Mesma regra do menu: admin ou flag receitas. */
function usuarioPodeReceitas(): boolean {
  const u = lerUserData()
  return Boolean(u?.admin || u?.receitas)
}

/** Mesma regra do menu: admin, financeiro ou flag docusign. */
function usuarioPodePlugSign(): boolean {
  const u = lerUserData()
  return Boolean(u?.admin || u?.financeiro || u?.docusign)
}

/** Mesma regra do menu: admin, financeiro ou flag comunicados. */
function usuarioPodePagamentosCi(): boolean {
  const u = lerUserData()
  return Boolean(u?.admin || u?.financeiro || u?.comunicados)
}

/** Campos de FLAN no formulário: só quem tem financeiro_totvs. */
function usuarioPodeFinanceiroRm(): boolean {
  const u = lerUserData()
  return Boolean(u?.financeiro_totvs)
}

function passoEhReceitas(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  const rota = (passo.rota || '').trim().toLowerCase()
  if (sel.includes('receitas')) return true
  if (rota.includes('/receitas')) return true
  return false
}

function passoEhPlugSign(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  const rota = (passo.rota || '').trim().toLowerCase()
  if (sel.includes('plugsign') || sel.includes('docusign')) return true
  if (rota.includes('/docusign')) return true
  return false
}

function passoEhPagamentosCi(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  const rota = (passo.rota || '').trim().toLowerCase()
  if (sel.includes('pagamentos-ci') || sel.includes('tour-ci-')) return true
  if (rota.includes('/comunicados')) return true
  return false
}

function passoEhCiFinanceiroRm(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  return sel === '#tour-ci-financeiro-rm'
}

function passoEhGlpi(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  return sel.includes('suporte') || sel.includes('glpi')
}

function passoEhMenuGeral(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  return sel === '#tour-sidebar'
}

function listarModulosTour(): string[] {
  const mods: string[] = []
  if (usuarioPodeReceitas()) mods.push('Receitas')
  if (usuarioPodePagamentosCi()) mods.push('Pagamentos CI')
  if (usuarioPodePlugSign()) mods.push('PlugSign')
  return mods
}

function juntarListaPt(itens: string[]): string {
  if (itens.length === 0) return ''
  if (itens.length === 1) return itens[0]
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

/**
 * Regras do tour:
 * - sem Receitas, sem Pagamentos CI e sem PlugSign → só GLPI
 * - cada módulo liberado entra no tour + GLPI
 * - passo de financeiro RM no formulário da CI só com financeiro_totvs
 * Menu lateral só entra quando há pelo menos um módulo.
 */
function filtrarPassosPorPermissao(passos: TourPasso[]): TourPasso[] {
  const podePlug = usuarioPodePlugSign()
  const podeReceitas = usuarioPodeReceitas()
  const podeCi = usuarioPodePagamentosCi()
  const podeFinRm = usuarioPodeFinanceiroRm()
  const temAlgumModulo = podePlug || podeReceitas || podeCi

  return passos.filter((p) => {
    if (!p.seletorCss || !p.seletorCss.trim()) return false

    if (passoEhGlpi(p)) return true
    if (passoEhMenuGeral(p)) return temAlgumModulo
    if (passoEhReceitas(p)) return podeReceitas
    if (passoEhCiFinanceiroRm(p)) return podeCi && podeFinRm
    if (passoEhPagamentosCi(p)) return podeCi
    if (passoEhPlugSign(p)) return podePlug

    return temAlgumModulo
  })
}

function mensagemIntroPorPerfil(): string {
  const mods = listarModulosTour()
  if (mods.length === 0) {
    return 'Olá, sou a Raphaela!\n\nNosso sistema teve uma atualização.\n\nVou te mostrar o ícone de Suporte, para abrir chamado no GLPI quando precisar de ajuda.'
  }
  return `Olá, sou a Raphaela!\n\nNosso sistema teve uma atualização.\n\nVou te mostrar ${juntarListaPt(mods)} e o suporte para abertura de chamado.`
}

function mensagemFimPorPerfil(): string {
  const mods = listarModulosTour()
  if (mods.length === 0) {
    return 'Pronto!\n\nSe precisar de ajuda, use o ícone de Suporte (GLPI) ou fale com a equipe de TI.\n\nBom trabalho!'
  }
  let extras = ''
  if (usuarioPodeReceitas()) {
    extras +=
      '\n\nReceitas aparece só para administrador ou quem tem a permissão Receitas em Usuários.'
  }
  if (usuarioPodePagamentosCi()) {
    extras +=
      '\n\nEm Pagamentos CI, ao concluir a aprovação o financeiro pode ser gerado automaticamente no RM.'
  }
  return `Pronto! Essas foram as novidades.${extras}\n\nSe precisar de ajuda, use o ícone de Suporte (GLPI) ou fale com a equipe de TI.\n\nBom trabalho!`
}

function normalizarPath(rota?: string | null): string {
  if (!rota) return '/'
  const path = rota.split('?')[0].replace(/\/$/, '') || '/'
  return path
}

function comBarraFinal(rota: string): string {
  const [path, qs] = rota.split('?')
  const base = path.endsWith('/') ? path : `${path}/`
  return qs ? `${base}?${qs}` : base
}

async function esperarSeletor(seletor: string, timeoutMs = 5000): Promise<Element | null> {
  const inicio = Date.now()
  while (Date.now() - inicio < timeoutMs) {
    const el = document.querySelector(seletor)
    if (el) return el
    await new Promise((r) => setTimeout(r, 100))
  }
  return document.querySelector(seletor)
}

async function ativarAbaReceitasSePreciso(seletor: string): Promise<void> {
  // Ações só existem com a aba da unidade aberta.
  if (seletor === '#tour-receitas-acoes' || seletor === '#tour-receitas-abas') {
    const aba = document.querySelector('#tour-receitas-unidade')
    if (aba instanceof HTMLElement) {
      aba.click()
      await new Promise((r) => setTimeout(r, 350))
    }
  }
}

const SELETORES_FORM_CI = new Set([
  '#tour-ci-form',
  '#tour-ci-corpo',
  '#tour-ci-aprovadores',
  '#tour-ci-itens',
  '#tour-ci-financeiro-rm',
  '#tour-ci-anexos',
  '#tour-ci-salvar',
])

function fecharFormCiSeAberto(): void {
  if (!document.querySelector('#tour-ci-form')) return
  const closeBtn = document.querySelector(
    '[data-radix-dialog-content]#tour-ci-form button[data-radix-dialog-close], #tour-ci-form button.absolute'
  )
  if (closeBtn instanceof HTMLElement) {
    closeBtn.click()
    return
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

async function ativarFormCiSePreciso(seletor: string): Promise<void> {
  if (!SELETORES_FORM_CI.has(seletor)) {
    if (!seletor.startsWith('#tour-ci-') || seletor === '#tour-ci-titulo' || seletor === '#tour-ci-novo') {
      fecharFormCiSeAberto()
    }
    return
  }

  if (document.querySelector('#tour-ci-form')) return

  const btn = document.querySelector('#tour-ci-novo')
  if (btn instanceof HTMLElement) {
    btn.click()
    await esperarSeletor('#tour-ci-form', 4000)
    await new Promise((r) => setTimeout(r, 300))
  }
}

function limparPopoversDriverExtras(): void {
  const pops = Array.from(document.querySelectorAll('.driver-popover'))
  // Driver às vezes deixa o balão anterior na tela ao trocar de passo/rota.
  if (pops.length > 1) {
    pops.slice(0, -1).forEach((el) => el.remove())
  }
}

async function prepararPasso(
  passo: TourPasso,
  routerPush: (href: string) => void
): Promise<boolean> {
  const seletor = (passo.seletorCss || '').trim()
  if (!seletor) return false

  const rota = (passo.rota || '').trim()
  if (rota) {
    const atual = normalizarPath(window.location.pathname)
    const dest = normalizarPath(rota)
    if (atual !== dest) {
      routerPush(comBarraFinal(rota))
      await new Promise((r) => setTimeout(r, 700))
    }
  }

  await ativarAbaReceitasSePreciso(seletor)
  await ativarFormCiSePreciso(seletor)

  let el = await esperarSeletor(seletor)
  if (!el && seletor === '#tour-receitas-acoes') {
    // Fallback: destaca as abas se as ações ainda não montaram.
    el = await esperarSeletor('#tour-receitas-abas', 2000)
  }

  if (el instanceof HTMLElement) {
    if (
      (seletor.startsWith('#tour-plugsign-') && seletor !== '#tour-plugsign-guias') ||
      seletor === '#tour-receitas-consulta' ||
      seletor === '#tour-receitas-unidade'
    ) {
      el.click()
      await new Promise((r) => setTimeout(r, 300))
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
    return true
  }

  return false
}

export default function RafaelaTour() {
  const router = useRouter()
  const pathname = usePathname()
  const [tour, setTour] = useState<TourPendente | null>(null)
  const [fase, setFase] = useState<Fase>('idle')
  const [aberto, setAberto] = useState(false)
  const [animApontar, setAnimApontar] = useState(false)
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const finalizandoRef = useRef(false)
  const passosRef = useRef<TourPasso[]>([])
  const tentouBuscarRef = useRef(false)
  const navLockRef = useRef(false)

  const marcarVisualizado = useCallback(async (versao: string) => {
    try {
      await apiFetch(`${API_BASE}/api/TourAssistente/visualizado`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ versao }),
      })
    } catch {
      /* silencioso */
    }
  }, [])

  const fecharTudo = useCallback(
    async (marcar: boolean) => {
      driverRef.current?.destroy()
      driverRef.current = null
      setAberto(false)
      setFase('idle')
      setAnimApontar(false)
      if (marcar && tour?.versao) {
        await marcarVisualizado(tour.versao)
      }
      setTour(null)
    },
    [marcarVisualizado, tour?.versao]
  )

  /** Encerra os destaques e vai para a tela final (Entendido / ver de novo). */
  const irParaFinal = useCallback(() => {
    finalizandoRef.current = true
    try {
      driverRef.current?.destroy()
    } catch {
      /* silencioso */
    }
    driverRef.current = null
    setAnimApontar(false)
    // Fecha formulário da CI se o tour tiver aberto no meio do passo a passo.
    try {
      if (document.querySelector('#tour-ci-form')) {
        const closeBtn = document.querySelector(
          '#tour-ci-form button[data-radix-dialog-close], #tour-ci-form > button'
        )
        if (closeBtn instanceof HTMLElement) closeBtn.click()
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      }
    } catch {
      /* silencioso */
    }
    setFase('fim')
  }, [])

  const iniciarPassos = useCallback(() => {
    if (!tour?.passos?.length) {
      setFase('fim')
      return
    }

    // Evita dois drivers ao mesmo tempo (auto-start + clique em Próximo).
    if (driverRef.current) {
      finalizandoRef.current = true
      try {
        driverRef.current.destroy()
      } catch {
        /* silencioso */
      }
      driverRef.current = null
      document.querySelectorAll('.driver-popover').forEach((el) => el.remove())
      finalizandoRef.current = false
    }

    const passos = filtrarPassosPorPermissao([...tour.passos]).sort(
      (a, b) => a.ordem - b.ordem
    )

    passosRef.current = passos
    navLockRef.current = false

    const steps: DriveStep[] = passos.map((p) => {
      const sel = p.seletorCss!.trim()
      return {
        element: () =>
          (document.querySelector(sel) as Element) ||
          (document.querySelector('#tour-receitas-abas') as Element) ||
          document.body,
        popover: {
          title: p.titulo || tour.titulo || 'Novidade',
          description: p.mensagem.replace(/\n/g, '<br/>'),
          side: ladoDriver(p.lado),
          align: 'start',
        },
      }
    })

    if (steps.length === 0) {
      setFase('fim')
      return
    }

    setFase('passos')
    setAnimApontar(true)
    finalizandoRef.current = false

    const d = driver({
      showProgress: true,
      animate: false,
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 10,
      allowClose: true,
      smoothScroll: false,
      nextBtnText: 'Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      progressText: '{{current}} de {{total}}',
      steps,
      onHighlightStarted: () => {
        limparPopoversDriverExtras()
      },
      onHighlighted: () => {
        limparPopoversDriverExtras()
        try {
          d.refresh()
        } catch {
          /* silencioso */
        }
      },
      onDestroyStarted: () => {
        if (finalizandoRef.current) {
          d.destroy()
          return
        }
        d.destroy()
        setAnimApontar(false)
        setFase('fim')
      },
      onDestroyed: () => {
        driverRef.current = null
        navLockRef.current = false
        setAnimApontar(false)
        document.querySelectorAll('.driver-popover').forEach((el) => el.remove())
      },
      onNextClick: (_el, _step, { driver: drv }) => {
        void (async () => {
          if (navLockRef.current) return
          navLockRef.current = true
          try {
            if (drv.isLastStep()) {
              finalizandoRef.current = true
              drv.destroy()
              setFase('fim')
              setAnimApontar(false)
              return
            }
            const next = passosRef.current[(drv.getActiveIndex() ?? 0) + 1]
            if (next) await prepararPasso(next, (href) => router.push(href))
            limparPopoversDriverExtras()
            drv.moveNext()
            requestAnimationFrame(() => {
              limparPopoversDriverExtras()
              try {
                drv.refresh()
              } catch {
                /* silencioso */
              }
            })
          } finally {
            navLockRef.current = false
          }
        })()
      },
      onPrevClick: (_el, _step, { driver: drv }) => {
        void (async () => {
          if (navLockRef.current) return
          navLockRef.current = true
          try {
            const idx = drv.getActiveIndex() ?? 0
            if (idx <= 0) return
            const prev = passosRef.current[idx - 1]
            if (prev) await prepararPasso(prev, (href) => router.push(href))
            limparPopoversDriverExtras()
            drv.movePrevious()
            requestAnimationFrame(() => {
              limparPopoversDriverExtras()
              try {
                drv.refresh()
              } catch {
                /* silencioso */
              }
            })
          } finally {
            navLockRef.current = false
          }
        })()
      },
      onCloseClick: (_el, _step, { driver: drv }) => {
        finalizandoRef.current = true
        drv.destroy()
        setFase('fim')
        setAnimApontar(false)
      },
    })

    driverRef.current = d
    void (async () => {
      try {
        await prepararPasso(passos[0], (href) => router.push(href))
        d.drive()
        requestAnimationFrame(() => limparPopoversDriverExtras())
      } catch {
        setFase('fim')
        setAnimApontar(false)
      }
    })()
  }, [router, tour])

  useEffect(() => {
    const token = sessionStorage.getItem('authToken')
    if (!token) {
      tentouBuscarRef.current = false
      return
    }
    if (tentouBuscarRef.current) return
    tentouBuscarRef.current = true

    ;(async () => {
      try {
        const res = await apiFetch(`${API_BASE}/api/TourAssistente/pendente`, {
          headers: headers(),
        })
        if (!res.ok) {
          tentouBuscarRef.current = false
          return
        }
        const data = (await res.json()) as TourPendente
        if (!data?.exibir || !data.versao) return

        setTour(data)
        setAberto(true)
        setFase('intro')

        // Tempo para ler "Olá, sou a Raphaela..." antes de ir ao menu
        window.setTimeout(() => {
          setFase((f) => (f === 'intro' ? 'auto-start' : f))
        }, 4500)
      } catch {
        tentouBuscarRef.current = false
      }
    })()
  }, [pathname])

  useEffect(() => {
    if (fase !== 'auto-start' || !tour) return
    iniciarPassos()
  }, [fase, tour, iniciarPassos])

  if (!aberto || !tour || fase === 'idle') return null

  const tituloTour =
    (tour.titulo || 'Novos recursos do sistema')
      .replace(/\s*v(ers[aã]o)?\s*\d+(\.\d+)*/gi, '')
      .trim() || 'Novos recursos do sistema'

  const balãoTexto =
    fase === 'intro' || fase === 'auto-start'
      ? mensagemIntroPorPerfil()
      : fase === 'fim'
        ? mensagemFimPorPerfil() + '\n\nComo deseja continuar?'
        : 'Siga os destaques na tela. Use Próximo e Anterior no guia.'

  return (
    <div className="rafaela-tour-root" aria-live="polite">
      <div className={`rafaela-tour-panel ${animApontar ? 'rafaela-apontando' : ''}`}>
        {fase !== 'passos' && (
          <div className="rafaela-balloon">
            <div className="rafaela-balloon-kicker">Raphaela</div>
            <div className="rafaela-balloon-title">{tituloTour}</div>
            <div className="rafaela-balloon-text">
              {balãoTexto.split('\n').map((linha, i) => (
                <p key={i}>{linha || '\u00A0'}</p>
              ))}
            </div>
            <div className={`rafaela-balloon-actions ${fase === 'fim' ? 'stack' : ''}`}>
              {(fase === 'intro' || fase === 'auto-start') && (
                <>
                  <button type="button" className="rafaela-btn ghost" onClick={irParaFinal}>
                    Agora não
                  </button>
                  <button type="button" className="rafaela-btn primary" onClick={iniciarPassos}>
                    Próximo <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              {fase === 'fim' && (
                <>
                  <button
                    type="button"
                    className="rafaela-btn primary full"
                    onClick={() => fecharTudo(true)}
                  >
                    Entendido! Não preciso ver novamente
                  </button>
                  <button
                    type="button"
                    className="rafaela-btn ghost full"
                    onClick={() => fecharTudo(false)}
                  >
                    Quero ver novamente
                  </button>
                  <p className="rafaela-hint">
                    “Não preciso ver novamente” só volta em uma nova atualização.
                    “Quero ver novamente” mostra o tour no próximo login.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              className="rafaela-close"
              aria-label="Fechar"
              onClick={irParaFinal}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="rafaela-avatar-wrap">
          <div className="rafaela-avatar">
            <Image
              src="/raphaela.jpg"
              alt="Raphaela — assistente PaperSign"
              width={112}
              height={112}
              className="rafaela-avatar-img"
              priority
              unoptimized
            />
          </div>
          {fase === 'passos' && (
            <div className="rafaela-mini-actions">
              <button type="button" className="rafaela-btn ghost sm" onClick={irParaFinal}>
                <ChevronLeft className="h-3.5 w-3.5" /> Pular
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .rafaela-tour-root {
          position: fixed;
          right: 1rem;
          bottom: 1rem;
          /* Acima do overlay/popover do driver.js (1e9) para o Pular sempre receber clique */
          z-index: 1000000001;
          pointer-events: none;
        }
        .rafaela-tour-panel {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.75rem;
          pointer-events: auto;
        }
        .rafaela-apontando {
          animation: rafaela-bounce 1.1s ease-in-out infinite;
        }
        @keyframes rafaela-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .rafaela-balloon {
          position: relative;
          width: min(340px, calc(100vw - 2rem));
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(10px);
          color: #0f172a;
          border: 1px solid rgba(191, 219, 254, 0.9);
          border-radius: 18px;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
          padding: 1rem 1.1rem 0.9rem;
        }
        .rafaela-balloon::after {
          content: '';
          position: absolute;
          right: 2.4rem;
          bottom: -8px;
          width: 16px;
          height: 16px;
          background: rgba(255, 255, 255, 0.94);
          border-right: 1px solid rgba(191, 219, 254, 0.9);
          border-bottom: 1px solid rgba(191, 219, 254, 0.9);
          transform: rotate(45deg);
        }
        .rafaela-balloon-kicker {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #2563eb;
          margin-bottom: 0.2rem;
        }
        .rafaela-balloon-title {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.45rem;
          padding-right: 1.4rem;
        }
        .rafaela-balloon-text {
          font-size: 0.92rem;
          line-height: 1.45;
          color: #1e293b;
        }
        .rafaela-balloon-text p {
          margin: 0 0 0.35rem;
        }
        .rafaela-balloon-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 0.85rem;
        }
        .rafaela-balloon-actions.stack {
          flex-direction: column;
          align-items: stretch;
        }
        .rafaela-hint {
          margin: 0.15rem 0 0;
          font-size: 0.72rem;
          line-height: 1.35;
          color: #64748b;
        }
        .rafaela-btn.full {
          width: 100%;
          justify-content: center;
          border-radius: 12px;
          white-space: normal;
          text-align: center;
          line-height: 1.25;
          padding: 0.65rem 0.85rem;
        }
        .rafaela-close {
          position: absolute;
          top: 0.55rem;
          right: 0.55rem;
          border: 0;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          border-radius: 999px;
          padding: 0.2rem;
        }
        .rafaela-close:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .rafaela-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.45rem 0.9rem;
          cursor: pointer;
          transition: 0.15s ease;
        }
        .rafaela-btn.sm {
          padding: 0.3rem 0.65rem;
          font-size: 0.75rem;
        }
        .rafaela-btn.primary {
          background: #1d4ed8;
          color: #fff;
        }
        .rafaela-btn.primary:hover {
          background: #1e40af;
        }
        .rafaela-btn.ghost {
          background: #eff6ff;
          color: #1e3a8a;
          border-color: #bfdbfe;
        }
        .rafaela-btn.ghost:hover {
          background: #dbeafe;
        }
        .rafaela-avatar-wrap {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.4rem;
        }
        .rafaela-avatar {
          width: 104px;
          height: 104px;
          border-radius: 999px;
          overflow: hidden;
          border: 0;
          box-shadow: 0 12px 28px rgba(29, 78, 216, 0.35);
          background: #000;
        }
        .rafaela-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
        }
        .rafaela-mini-actions {
          pointer-events: auto;
        }
        /* Driver.js — visual corporativo */
        .driver-popover {
          background: #fff !important;
          color: #0f172a !important;
          border: 1px solid #bfdbfe !important;
          border-radius: 14px !important;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.2) !important;
        }
        .driver-popover-title {
          color: #1d4ed8 !important;
          font-weight: 700 !important;
        }
        .driver-popover-next-btn,
        .driver-popover-done-btn {
          background: #1d4ed8 !important;
          color: #fff !important;
          border: 0 !important;
          text-shadow: none !important;
        }
        .driver-popover-prev-btn {
          background: #eff6ff !important;
          color: #1e3a8a !important;
          border: 1px solid #bfdbfe !important;
          text-shadow: none !important;
        }
        @media (max-width: 640px) {
          .rafaela-tour-root {
            right: 0.6rem;
            bottom: 0.6rem;
          }
          .rafaela-avatar {
            width: 76px;
            height: 76px;
          }
        }
      `}</style>
    </div>
  )
}
