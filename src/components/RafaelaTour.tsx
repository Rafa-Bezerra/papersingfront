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

/** Mesma regra do menu/ClientLayout: admin, financeiro ou flag docusign. */
function usuarioPodePlugSign(): boolean {
  try {
    const raw = sessionStorage.getItem('userData')
    if (!raw) return false
    const u = JSON.parse(raw)
    return Boolean(u?.admin || u?.financeiro || u?.docusign)
  } catch {
    return false
  }
}

function passoEhPlugSign(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  const rota = (passo.rota || '').trim().toLowerCase()
  if (sel.includes('plugsign') || sel.includes('docusign')) return true
  if (rota.includes('/docusign')) return true
  return false
}

function filtrarPassosPorPermissao(passos: TourPasso[]): TourPasso[] {
  const podePlug = usuarioPodePlugSign()
  return passos.filter((p) => {
    if (!p.seletorCss || !p.seletorCss.trim()) return false
    if (!podePlug && passoEhPlugSign(p)) return false
    return true
  })
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

async function esperarSeletor(seletor: string, timeoutMs = 10000): Promise<Element | null> {
  const inicio = Date.now()
  while (Date.now() - inicio < timeoutMs) {
    const el = document.querySelector(seletor)
    if (el) return el
    await new Promise((r) => setTimeout(r, 120))
  }
  return document.querySelector(seletor)
}

async function prepararPasso(
  passo: TourPasso,
  routerPush: (href: string) => void
): Promise<void> {
  const seletor = (passo.seletorCss || '').trim()
  if (!seletor) return

  const rota = (passo.rota || '').trim()
  if (rota) {
    const atual = normalizarPath(window.location.pathname)
    const dest = normalizarPath(rota)
    if (atual !== dest) {
      routerPush(comBarraFinal(rota))
    }
  }

  const el = await esperarSeletor(seletor)
  if (el instanceof HTMLElement) {
    // Ativa abas do PlugSign (Radix TabsTrigger) antes do highlight
    if (seletor.startsWith('#tour-plugsign-') && seletor !== '#tour-plugsign-guias') {
      el.click()
      await new Promise((r) => setTimeout(r, 180))
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }
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

  const irParaEscolha = useCallback(() => {
    finalizandoRef.current = true
    driverRef.current?.destroy()
    driverRef.current = null
    setAnimApontar(false)
    setFase('fim')
  }, [])

  const iniciarPassos = useCallback(() => {
    if (!tour?.passos?.length) {
      setFase('fim')
      return
    }

    const passos = filtrarPassosPorPermissao([...tour.passos]).sort(
      (a, b) => a.ordem - b.ordem
    )

    passosRef.current = passos

    const steps: DriveStep[] = passos.map((p) => ({
      element: p.seletorCss!.trim(),
      popover: {
        title: p.titulo || tour.titulo || 'Novidade',
        description: p.mensagem.replace(/\n/g, '<br/>'),
        side: ladoDriver(p.lado),
        align: 'start',
      },
    }))

    if (steps.length === 0) {
      setFase('fim')
      return
    }

    setFase('passos')
    setAnimApontar(true)
    finalizandoRef.current = false

    const d = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 10,
      allowClose: true,
      nextBtnText: 'Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      progressText: '{{current}} de {{total}}',
      steps,
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
        setAnimApontar(false)
      },
      onNextClick: (_el, _step, { driver: drv }) => {
        void (async () => {
          if (drv.isLastStep()) {
            finalizandoRef.current = true
            drv.destroy()
            setFase('fim')
            setAnimApontar(false)
            return
          }
          const next = passosRef.current[(drv.getActiveIndex() ?? 0) + 1]
          if (next) await prepararPasso(next, (href) => router.push(href))
          drv.moveNext()
        })()
      },
      onPrevClick: (_el, _step, { driver: drv }) => {
        void (async () => {
          const idx = drv.getActiveIndex() ?? 0
          if (idx <= 0) return
          const prev = passosRef.current[idx - 1]
          if (prev) await prepararPasso(prev, (href) => router.push(href))
          drv.movePrevious()
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
      ? tour.mensagemIntro ||
        'Olá, sou a Raphaela!\n\nNosso sistema teve uma atualização.\n\nVou te mostrar o PlugSign, as guias de cada aba e o suporte para abertura de chamado.'
      : fase === 'fim'
        ? (tour.mensagemFim ||
            'Pronto! Essas foram as novidades.\n\nSe precisar de ajuda, use o ícone de Suporte (GLPI) ou fale com a equipe de TI.\n\nBom trabalho!') +
          '\n\nComo deseja continuar?'
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
                  <button type="button" className="rafaela-btn ghost" onClick={irParaEscolha}>
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
              onClick={irParaEscolha}
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
              <button type="button" className="rafaela-btn ghost sm" onClick={irParaEscolha}>
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
          z-index: 10050;
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
