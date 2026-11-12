'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { EyeOff, ExternalLink, Headset, LayoutGrid, MousePointerClick, PlayCircle, Send, X } from 'lucide-react'
import { API_BASE, apiFetch, GLPI_SUPPORT_URL, headers } from '@/utils/constants'
import {
  RAFAELA_AJUDA_BLOQUEADA_EVENT,
  RAFAELA_AJUDA_LIBERADA_EVENT,
  TOUR_RAPHAELA_ENCERRADO_EVENT,
} from '@/utils/pendenciaNavigation'
import {
  filtrarArtigosPorPermissao,
  lerUserDataAjuda,
  type RaphaelaAjudaArtigo,
} from '@/lib/raphaela-ajuda-permissoes'
import { buscarArtigosAjuda, ehCumprimento, formatarMensagemAjuda } from '@/lib/raphaela-ajuda-busca'
import {
  guiaComoArtigo,
  guiaDaRota,
  guiasDoUsuario,
  perguntasFixasDoUsuario,
  roteiroDoArtigo,
  type GuiaUsuario,
  type PassoRoteiro,
} from '@/lib/raphaela-guias'
import { iniciarGuiaNaTela, iniciarRoteiroNaTela, type FimGuia } from '@/lib/raphaela-guia-tela'

type ChatMsg =
  | { tipo: 'raphaela'; texto: string; artigo?: RaphaelaAjudaArtigo; glpi?: boolean }
  | { tipo: 'usuario'; texto: string }

type Pos = { x: number; y: number }

const CHAVE_TEASER_FECHADO = 'raphaela-ajuda-teaser-fechado'
const CHAVE_ESCONDIDA = 'raphaela-ajuda-escondida'
const CHAVE_POSICAO = 'raphaela-ajuda-posicao'
const MARGEM = 8

const RESPOSTA_NAO_SEI =
  'Ainda estou em desenvolvimento e esta pergunta não sei te responder no momento, abra um chamado no GLPI onde a equipe de T.I, poderá te orientar e assim aprendermos juntos.'

const PASSO_GLPI: PassoRoteiro = {
  seletor: '#tour-suporte',
  titulo: 'Abra um chamado no GLPI',
  mensagem: `${RESPOSTA_NAO_SEI}<br><br>**Para abrir o chamado, clique neste ícone de suporte (fone de ouvido).**`,
  lado: 'bottom',
}

function lerPosicaoSalva(): Pos | null {
  if (typeof window === 'undefined') return null
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_POSICAO) ?? 'null') as Pos | null
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null
  } catch {
    return null
  }
}

function limitarPosicao(p: Pos, tam: number, w: number, h: number): Pos {
  return {
    x: Math.min(Math.max(p.x, MARGEM), Math.max(MARGEM, w - tam - MARGEM)),
    y: Math.min(Math.max(p.y, MARGEM), Math.max(MARGEM, h - tam - MARGEM)),
  }
}

function renderLinhaComNegrito(linha: string) {
  const parts = linha.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return linha
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))
}

export default function RaphaelaAjuda() {
  const router = useRouter()
  const pathname = usePathname()
  const [liberado, setLiberado] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [teaser, setTeaser] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(CHAVE_TEASER_FECHADO) !== '1'
  )
  const [escondida, setEscondida] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(CHAVE_ESCONDIDA) === '1'
  )
  const [posArrastada, setPosArrastada] = useState<Pos | null>(lerPosicaoSalva)
  const [janela, setJanela] = useState({ w: 0, h: 0 })
  const [guiando, setGuiando] = useState(false)
  const [saudacao, setSaudacao] = useState(false)
  const [verModulos, setVerModulos] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [artigos, setArtigos] = useState<RaphaelaAjudaArtigo[]>([])
  const [input, setInput] = useState('')
  const [mensagens, setMensagens] = useState<ChatMsg[]>([
    {
      tipo: 'raphaela',
      texto:
        'Oi! Sou a Raphaela. Digite sua dúvida ou escolha um módulo abaixo: eu te mostro o passo a passo na tela.',
    },
  ])
  const raizRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const carregouRef = useRef(false)
  const guiandoRef = useRef(false)
  const pararGuiaRef = useRef<(() => void) | null>(null)
  const arrasteRef = useRef<{ id: number; x0: number; y0: number; px: number; py: number; moveu: boolean } | null>(null)
  const ignorarCliqueRef = useRef(false)

  const tam = janela.w > 0 && janela.w <= 640 ? 76 : 104
  const pos = useMemo(
    () =>
      limitarPosicao(
        posArrastada ?? { x: janela.w - tam - 16, y: janela.h - tam - 16 },
        tam,
        janela.w,
        janela.h
      ),
    [posArrastada, janela, tam]
  )

  const userData = useMemo(() => lerUserDataAjuda(), [aberto, liberado])

  const artigosVisiveis = useMemo(
    () => filtrarArtigosPorPermissao(artigos, userData),
    [artigos, userData]
  )

  const guias = useMemo(() => guiasDoUsuario(userData), [userData])

  const perguntasFixas = useMemo(() => perguntasFixasDoUsuario(guias, userData), [guias, userData])

  const artigosBusca = useMemo(
    () => [...perguntasFixas, ...artigosVisiveis, ...guias.map((g, i) => guiaComoArtigo(g, i))],
    [perguntasFixas, artigosVisiveis, guias]
  )

  const destaques = useMemo(
    () => [...perguntasFixas, ...artigosVisiveis.filter((a) => a.destaque)].slice(0, 6),
    [perguntasFixas, artigosVisiveis]
  )

  const guiaAtual = useMemo(() => guiaDaRota(guias, pathname), [guias, pathname])

  const fecharTeaser = useCallback(() => {
    setTeaser(false)
    try {
      sessionStorage.setItem(CHAVE_TEASER_FECHADO, '1')
    } catch {
      /* silencioso */
    }
  }, [])

  const pararGuia = useCallback(() => {
    pararGuiaRef.current?.()
    pararGuiaRef.current = null
  }, [])

  useEffect(() => {
    const onLiberar = () => setLiberado(true)
    const onBloquear = () => {
      pararGuia()
      setLiberado(false)
      setAberto(false)
      setSaudacao(false)
    }
    const onTourEncerrado = () => setSaudacao(true)
    window.addEventListener(RAFAELA_AJUDA_LIBERADA_EVENT, onLiberar)
    window.addEventListener(RAFAELA_AJUDA_BLOQUEADA_EVENT, onBloquear)
    window.addEventListener(TOUR_RAPHAELA_ENCERRADO_EVENT, onTourEncerrado)
    return () => {
      window.removeEventListener(RAFAELA_AJUDA_LIBERADA_EVENT, onLiberar)
      window.removeEventListener(RAFAELA_AJUDA_BLOQUEADA_EVENT, onBloquear)
      window.removeEventListener(TOUR_RAPHAELA_ENCERRADO_EVENT, onTourEncerrado)
    }
  }, [pararGuia])

  useEffect(() => () => pararGuiaRef.current?.(), [])

  useEffect(() => {
    guiandoRef.current = guiando
  }, [guiando])

  useEffect(() => {
    const medir = () => setJanela({ w: window.innerWidth, h: window.innerHeight })
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  // Clique fora do balão: fecha e fica só o ícone.
  useEffect(() => {
    if (!liberado || (!aberto && !teaser && !saudacao)) return
    const onPointerDown = (e: PointerEvent) => {
      if (guiandoRef.current) return
      const raiz = raizRef.current
      if (raiz && e.target instanceof Node && raiz.contains(e.target)) return
      setAberto(false)
      setSaudacao(false)
      fecharTeaser()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [liberado, aberto, teaser, saudacao, fecharTeaser])

  const carregarArtigos = useCallback(async () => {
    if (carregouRef.current) return
    setCarregando(true)
    try {
      const res = await apiFetch(`${API_BASE}/api/RaphaelaAjuda/artigos`, {
        headers: headers(),
      })
      if (!res.ok) return
      const data = (await res.json()) as { artigos?: RaphaelaAjudaArtigo[] }
      setArtigos(data.artigos ?? [])
      carregouRef.current = true
    } catch {
      /* silencioso */
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (aberto) void carregarArtigos()
  }, [aberto, carregarArtigos])

  useEffect(() => {
    if (!aberto || !listaRef.current) return
    listaRef.current.scrollTop = listaRef.current.scrollHeight
  }, [mensagens, aberto])

  const responderArtigo = useCallback((artigo: RaphaelaAjudaArtigo) => {
    setMensagens((prev) => [
      ...prev,
      { tipo: 'usuario', texto: artigo.titulo },
      { tipo: 'raphaela', texto: artigo.mensagem, artigo },
    ])
  }, [])

  const responderGuia = useCallback(
    (g: GuiaUsuario) => {
      setVerModulos(false)
      responderArtigo(guiaComoArtigo(g, guias.indexOf(g)))
    },
    [guias, responderArtigo]
  )

  const comecarGuia = useCallback(
    (
      nome: string,
      iniciar: (opts: { irPara: (href: string) => void; aoTerminar: (motivo: FimGuia) => void }) => () => void
    ) => {
      pararGuia()
      setAberto(false)
      fecharTeaser()
      setGuiando(true)
      pararGuiaRef.current = iniciar({
        irPara: (href) => router.push(href),
        aoTerminar: (motivo) => {
          pararGuiaRef.current = null
          setGuiando(false)
          if (motivo === 'fechou' || !nome) setSaudacao(true)
          if (motivo === 'concluiu' && nome) {
            setMensagens((prev) => [
              ...prev,
              {
                tipo: 'raphaela',
                texto: `Pronto! Esse foi o passo a passo de “${nome.replace(/[?.!]+$/, '')}”. Quer ver outro? Escolha abaixo ou digite sua dúvida.`,
              },
            ])
            setAberto(true)
          }
        },
      })
    },
    [fecharTeaser, pararGuia, router]
  )

  const iniciarGuia = useCallback(
    (g: GuiaUsuario) => comecarGuia(g.titulo, (opts) => iniciarGuiaNaTela(g, opts)),
    [comecarGuia]
  )

  const iniciarRoteiro = useCallback(
    (nome: string, roteiro: PassoRoteiro[]) => comecarGuia(nome, (opts) => iniciarRoteiroNaTela(roteiro, opts)),
    [comecarGuia]
  )

  const mostrarGlpi = useCallback(() => iniciarRoteiro('', [PASSO_GLPI]), [iniciarRoteiro])

  const roteiroAtual = useMemo(
    () => (guiaAtual ? roteiroDoArtigo(`guia:${guiaAtual.url}`, guiaAtual.url, userData) : null),
    [guiaAtual, userData]
  )

  const enviarPergunta = useCallback(() => {
    const q = input.trim()
    if (!q) return
    setInput('')
    setMensagens((prev) => [...prev, { tipo: 'usuario', texto: q }])

    const responder = (...novas: ChatMsg[]) => setMensagens((prev) => [...prev, ...novas])
    if (ehCumprimento(q)) {
      responder({
        tipo: 'raphaela',
        texto: /obrigad|valeu/i.test(q)
          ? 'De nada! Se surgir outra dúvida, é só me chamar.'
          : 'Oi! Me conta o que você quer fazer, por exemplo “criar documento externo”, “lançar RDV” ou “aprovar pendências”, ou escolha uma das dúvidas abaixo.',
      })
      return
    }

    let hits: ReturnType<typeof buscarArtigosAjuda> = []
    try {
      hits = buscarArtigosAjuda(artigosBusca, q, 3)
    } catch {
      hits = []
    }
    if (hits.length === 0) {
      responder({
        tipo: 'raphaela',
        texto: RESPOSTA_NAO_SEI,
        glpi: true,
      })
      window.setTimeout(mostrarGlpi, 600)
      return
    }
    if (hits.length === 1) {
      responder({ tipo: 'raphaela', texto: hits[0].artigo.mensagem, artigo: hits[0].artigo })
      return
    }
    responder(
      { tipo: 'raphaela', texto: 'Encontrei mais de um tema parecido. Veja qual se encaixa:' },
      ...hits.map((h) => ({ tipo: 'raphaela' as const, texto: h.artigo.mensagem, artigo: h.artigo }))
    )
  }, [input, artigosBusca, mostrarGlpi])

  const alternar = () => {
    fecharTeaser()
    setSaudacao(false)
    setAberto((v) => !v)
  }

  const esconder = () => {
    pararGuia()
    setAberto(false)
    setSaudacao(false)
    fecharTeaser()
    setEscondida(true)
    try {
      localStorage.setItem(CHAVE_ESCONDIDA, '1')
    } catch {
      /* silencioso */
    }
  }

  const mostrar = () => {
    setEscondida(false)
    try {
      localStorage.removeItem(CHAVE_ESCONDIDA)
    } catch {
      /* silencioso */
    }
  }

  const onAvatarPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    arrasteRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, moveu: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onAvatarPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const a = arrasteRef.current
    if (!a || a.id !== e.pointerId) return
    const dx = e.clientX - a.x0
    const dy = e.clientY - a.y0
    if (!a.moveu && Math.hypot(dx, dy) < 6) return
    a.moveu = true
    setPosArrastada(limitarPosicao({ x: a.px + dx, y: a.py + dy }, tam, janela.w, janela.h))
  }

  const onAvatarPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const a = arrasteRef.current
    arrasteRef.current = null
    if (!a || a.id !== e.pointerId || !a.moveu) return
    ignorarCliqueRef.current = true
    const final = limitarPosicao({ x: a.px + e.clientX - a.x0, y: a.py + e.clientY - a.y0 }, tam, janela.w, janela.h)
    setPosArrastada(final)
    try {
      localStorage.setItem(CHAVE_POSICAO, JSON.stringify(final))
    } catch {
      /* silencioso */
    }
  }

  const onAvatarClick = () => {
    if (ignorarCliqueRef.current) {
      ignorarCliqueRef.current = false
      return
    }
    alternar()
  }

  if (!liberado || janela.w === 0) return null

  if (escondida) {
    return (
      <button
        type="button"
        className="rafaela-ajuda-aba"
        onClick={mostrar}
        aria-label="Mostrar a Raphaela"
        title="Mostrar a Raphaela"
      >
        <Image src="/raphaela.jpg" alt="" width={36} height={36} className="rafaela-ajuda-aba-img" unoptimized />
        <style jsx global>{`
          .rafaela-ajuda-aba {
            position: fixed;
            right: 0;
            bottom: 5rem;
            z-index: 1000000000;
            display: flex;
            align-items: center;
            padding: 4px 6px 4px 4px;
            border: 0;
            border-radius: 999px 0 0 999px;
            background: #1d4ed8;
            box-shadow: 0 8px 20px rgba(29, 78, 216, 0.35);
            cursor: pointer;
            opacity: 0.85;
            transition: opacity 0.15s ease;
          }
          .rafaela-ajuda-aba:hover,
          .rafaela-ajuda-aba:focus-visible {
            opacity: 1;
          }
          .rafaela-ajuda-aba-img {
            width: 36px;
            height: 36px;
            border-radius: 999px;
            object-fit: cover;
          }
        `}</style>
      </button>
    )
  }

  const acima = pos.y + tam / 2 > janela.h / 2
  const direita = pos.x + tam / 2 > janela.w / 2
  const estiloBalao: CSSProperties = {
    [acima ? 'bottom' : 'top']: tam + 12,
    [direita ? 'right' : 'left']: 0,
    maxHeight: Math.max(220, acima ? pos.y - 20 : janela.h - pos.y - tam - 20),
    maxWidth: Math.min(janela.w - 2 * MARGEM, Math.max(240, direita ? pos.x + tam - MARGEM : janela.w - pos.x - MARGEM)),
    ['--rafaela-seta' as string]: `${tam / 2 - 8}px`,
  }
  const classeBalao = `rafaela-balloon ${acima ? 'acima' : 'abaixo'} ${direita ? 'direita' : 'esquerda'}`

  return (
    <div
      ref={raizRef}
      className="rafaela-ajuda-root"
      style={{ left: pos.x, top: pos.y, width: tam, height: tam }}
      aria-live="polite"
    >
      {aberto ? (
        <div className={`${classeBalao} rafaela-ajuda-balloon`} style={estiloBalao} role="dialog" aria-label="Pergunte à Raphaela">
          <div className="rafaela-balloon-kicker">Raphaela</div>
          <div className="rafaela-balloon-title">Como posso ajudar?</div>

          <div ref={listaRef} className="rafaela-balloon-text rafaela-ajuda-msgs">
            {mensagens.map((m, idx) => {
              const guiaMsg = m.tipo === 'raphaela' && m.artigo?.rota ? guiaDaRota(guias, m.artigo.rota) : null
              const roteiroMsg =
                m.tipo === 'raphaela' && m.artigo ? roteiroDoArtigo(m.artigo.slug, m.artigo.rota, userData) : null
              return (
                <div key={idx} className={m.tipo === 'usuario' ? 'rafaela-ajuda-bubble user' : 'rafaela-ajuda-bubble bot'}>
                  {m.tipo === 'raphaela' && m.artigo ? (
                    <>
                      <p className="rafaela-ajuda-artigo-titulo">{m.artigo.titulo}</p>
                      {roteiroMsg ? (
                        <>
                          {m.artigo.resumo && <p className="rafaela-ajuda-line">{m.artigo.resumo}</p>}
                          <p className="rafaela-ajuda-line">
                            Vou te mostrar na tela, parte por parte. Você pode voltar ou avançar a qualquer momento.
                          </p>
                          <ol className="rafaela-ajuda-roteiro">
                            {roteiroMsg.map((p) => (
                              <li key={p.seletor}>{p.titulo.replace(/^\d+\.\s*/, '')}</li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        formatarMensagemAjuda(m.texto).map((linha, i) => (
                          <p key={i} className="rafaela-ajuda-line">
                            {renderLinhaComNegrito(linha)}
                          </p>
                        ))
                      )}
                      <div className="rafaela-ajuda-acoes">
                        {roteiroMsg ? (
                          <button
                            type="button"
                            className="rafaela-btn primary sm"
                            onClick={() => iniciarRoteiro(m.artigo!.titulo, roteiroMsg)}
                          >
                            <MousePointerClick className="h-3.5 w-3.5" /> Começar passo a passo
                          </button>
                        ) : guiaMsg ? (
                          <button type="button" className="rafaela-btn primary sm" onClick={() => iniciarGuia(guiaMsg)}>
                            <MousePointerClick className="h-3.5 w-3.5" /> Me mostre na tela
                          </button>
                        ) : (
                          m.artigo.rota && (
                            <button
                              type="button"
                              className="rafaela-btn ghost sm"
                              onClick={() => router.push(m.artigo!.rota!)}
                            >
                              Ir para a tela
                            </button>
                          )
                        )}
                        {m.artigo.rotaAjuda && (
                          <Link href={m.artigo.rotaAjuda} className="rafaela-btn ghost sm">
                            Ajuda e vídeos
                          </Link>
                        )}
                        {m.artigo.videoUrl && (
                          <Link href={m.artigo.rotaAjuda ?? '/help'} className="rafaela-btn ghost sm">
                            <PlayCircle className="h-3.5 w-3.5" /> Vídeo
                          </Link>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="rafaela-ajuda-line whitespace-pre-wrap">{m.texto}</p>
                      {m.tipo === 'raphaela' && m.glpi && (
                        <div className="rafaela-ajuda-acoes">
                          <button type="button" className="rafaela-btn primary sm" onClick={mostrarGlpi}>
                            <MousePointerClick className="h-3.5 w-3.5" /> Me mostre onde fica
                          </button>
                          <a href={GLPI_SUPPORT_URL} target="_blank" rel="noreferrer" className="rafaela-btn ghost sm">
                            <Headset className="h-3.5 w-3.5" /> Abrir chamado no GLPI
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {carregando && <p className="rafaela-ajuda-loading">Carregando guias…</p>}
          </div>

          <div className="rafaela-ajuda-chips">
            {guiaAtual && (
              <button
                type="button"
                className="rafaela-btn primary sm"
                onClick={() => (roteiroAtual ? iniciarRoteiro(guiaAtual.titulo, roteiroAtual) : iniciarGuia(guiaAtual))}
              >
                <MousePointerClick className="h-3.5 w-3.5" /> Me mostre esta tela
              </button>
            )}
            {destaques.map((a) => (
              <button
                key={a.slug}
                type="button"
                className="rafaela-btn ghost sm"
                onClick={() => responderArtigo(a)}
              >
                {a.titulo.length > 42 ? `${a.titulo.slice(0, 40)}…` : a.titulo}
              </button>
            ))}
            {guias.length > 0 && (
              <button
                type="button"
                className="rafaela-btn ghost sm"
                aria-expanded={verModulos}
                onClick={() => setVerModulos((v) => !v)}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> {verModulos ? 'Ocultar módulos' : `Seus módulos (${guias.length})`}
              </button>
            )}
          </div>

          {verModulos && (
            <div className="rafaela-ajuda-modulos">
              {guias.map((g) => (
                <button key={g.url} type="button" className="rafaela-btn ghost sm" onClick={() => responderGuia(g)}>
                  {g.titulo}
                </button>
              ))}
            </div>
          )}

          <form
            className="rafaela-ajuda-form"
            onSubmit={(e) => {
              e.preventDefault()
              enviarPergunta()
            }}
          >
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex.: como aprovar RDV?"
              className="rafaela-ajuda-input"
              autoComplete="off"
            />
            <button type="submit" className="rafaela-ajuda-send" aria-label="Enviar">
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="rafaela-balloon-actions stack">
            <a href={GLPI_SUPPORT_URL} target="_blank" rel="noreferrer" className="rafaela-btn ghost sm">
              <Headset className="h-3.5 w-3.5" />
              Abrir GLPI
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <button type="button" className="rafaela-close" aria-label="Fechar" onClick={() => setAberto(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : saudacao && !guiando ? (
        <button
          type="button"
          className={`${classeBalao} rafaela-ajuda-teaser`}
          style={estiloBalao}
          onClick={() => {
            setSaudacao(false)
            fecharTeaser()
          }}
        >
          <div className="rafaela-balloon-kicker">Raphaela</div>
          <div className="rafaela-balloon-title">Olá, sou a Raphaela!</div>
          <div className="rafaela-balloon-text">
            <p>Sua assistente de dúvidas do PaperSign. Quando precisar, é só clicar em mim.</p>
          </div>
        </button>
      ) : (
        teaser &&
        !guiando && (
          <button type="button" className={`${classeBalao} rafaela-ajuda-teaser`} style={estiloBalao} onClick={alternar}>
            <div className="rafaela-balloon-kicker">Raphaela</div>
            <div className="rafaela-balloon-title">Dúvidas?</div>
            <div className="rafaela-balloon-text">
              <p>Toque aqui que eu te mostro o passo a passo no PaperSign.</p>
            </div>
          </button>
        )
      )}

      <button
        type="button"
        className={`rafaela-avatar border-0 p-0 ${guiando ? 'rafaela-apontando' : ''}`}
        style={{ width: tam, height: tam }}
        onPointerDown={onAvatarPointerDown}
        onPointerMove={onAvatarPointerMove}
        onPointerUp={onAvatarPointerUp}
        onPointerCancel={() => {
          arrasteRef.current = null
        }}
        onClick={onAvatarClick}
        aria-label="Abrir dúvidas (arraste para mover)"
        title="Clique para tirar dúvidas. Arraste para mudar de lugar."
      >
        <Image
          src="/raphaela.jpg"
          alt="Raphaela — ajuda PaperSign"
          width={112}
          height={112}
          className="rafaela-avatar-img"
          draggable={false}
          unoptimized
        />
      </button>
      <button type="button" className="rafaela-esconder" onClick={esconder} aria-label="Esconder a Raphaela" title="Esconder a Raphaela">
        <EyeOff className="h-3.5 w-3.5" />
      </button>

      <style jsx global>{`
        .rafaela-ajuda-root {
          position: fixed;
          z-index: 1000000000;
        }
        .rafaela-ajuda-balloon {
          width: min(380px, calc(100vw - 2rem));
        }
        .rafaela-ajuda-teaser {
          text-align: left;
          cursor: pointer;
          border: 0;
          font: inherit;
        }
        .rafaela-ajuda-teaser:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
        .rafaela-ajuda-msgs {
          flex: 1;
          min-height: 80px;
          max-height: 38vh;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-bottom: 0.35rem;
        }
        .rafaela-ajuda-bubble {
          border-radius: 12px;
          padding: 0.55rem 0.7rem;
          font-size: 0.84rem;
          line-height: 1.45;
          max-width: 95%;
        }
        .rafaela-ajuda-bubble.bot {
          align-self: flex-start;
          background: #eff6ff;
          color: #0f172a;
          border: 1px solid #bfdbfe;
        }
        .rafaela-ajuda-bubble.user {
          align-self: flex-end;
          background: #1d4ed8;
          color: #fff;
        }
        .rafaela-ajuda-line {
          margin: 0.2rem 0;
        }
        .rafaela-ajuda-artigo-titulo {
          font-weight: 700;
          color: #1e3a8a;
          margin: 0 0 0.35rem;
        }
        .rafaela-ajuda-roteiro {
          margin: 0.3rem 0 0;
          padding-left: 1.2rem;
          list-style: decimal;
          font-size: 0.8rem;
          color: #334155;
        }
        .rafaela-ajuda-roteiro li {
          margin: 0.1rem 0;
        }
        .rafaela-ajuda-acoes {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.5rem;
        }
        .rafaela-ajuda-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-bottom: 0.5rem;
        }
        .rafaela-ajuda-modulos {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          max-height: 132px;
          overflow-y: auto;
          margin-bottom: 0.5rem;
          padding: 0.4rem;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
        }
        .rafaela-ajuda-form {
          display: flex;
          gap: 0.35rem;
          margin-bottom: 0.35rem;
        }
        .rafaela-ajuda-input {
          flex: 1;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          padding: 0.45rem 0.85rem;
          font-size: 0.85rem;
          outline: none;
        }
        .rafaela-ajuda-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        .rafaela-ajuda-send {
          border: 0;
          border-radius: 999px;
          background: #1d4ed8;
          color: #fff;
          width: 2.25rem;
          height: 2.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .rafaela-ajuda-send:hover {
          background: #1e40af;
        }
        .rafaela-ajuda-loading {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0;
        }
        .rafaela-ajuda-root .rafaela-balloon {
          position: absolute;
          display: flex;
          flex-direction: column;
          width: min(340px, calc(100vw - 2rem));
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(10px);
          color: #0f172a;
          border: 1px solid rgba(191, 219, 254, 0.9);
          border-radius: 18px;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
          padding: 1rem 1.1rem 0.9rem;
        }
        .rafaela-ajuda-root .rafaela-balloon.rafaela-ajuda-balloon {
          width: min(380px, calc(100vw - 2rem));
        }
        .rafaela-ajuda-root .rafaela-balloon::after {
          content: '';
          position: absolute;
          width: 16px;
          height: 16px;
          background: rgba(255, 255, 255, 0.94);
          border-right: 1px solid rgba(191, 219, 254, 0.9);
          border-bottom: 1px solid rgba(191, 219, 254, 0.9);
        }
        .rafaela-ajuda-root .rafaela-balloon.acima::after {
          bottom: -8px;
          transform: rotate(45deg);
        }
        .rafaela-ajuda-root .rafaela-balloon.abaixo::after {
          top: -8px;
          transform: rotate(225deg);
        }
        .rafaela-ajuda-root .rafaela-balloon.direita::after {
          right: var(--rafaela-seta);
        }
        .rafaela-ajuda-root .rafaela-balloon.esquerda::after {
          left: var(--rafaela-seta);
        }
        .rafaela-ajuda-root .rafaela-balloon-kicker {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #2563eb;
          margin-bottom: 0.2rem;
        }
        .rafaela-ajuda-root .rafaela-balloon-title {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.45rem;
          padding-right: 1.4rem;
        }
        .rafaela-ajuda-root .rafaela-balloon-text {
          font-size: 0.92rem;
          line-height: 1.45;
          color: #1e293b;
          overflow-y: auto;
        }
        .rafaela-ajuda-root .rafaela-balloon-actions.stack {
          flex-direction: column;
          align-items: stretch;
        }
        .rafaela-ajuda-root .rafaela-balloon-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 0.45rem;
        }
        .rafaela-ajuda-root .rafaela-close {
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
        .rafaela-ajuda-root .rafaela-btn {
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
          text-decoration: none;
        }
        .rafaela-ajuda-root .rafaela-btn.sm {
          padding: 0.3rem 0.65rem;
          font-size: 0.75rem;
        }
        .rafaela-ajuda-root .rafaela-btn.ghost {
          background: #eff6ff;
          color: #1e3a8a;
          border-color: #bfdbfe;
        }
        .rafaela-ajuda-root .rafaela-btn.primary {
          background: #1d4ed8;
          color: #fff;
        }
        .rafaela-ajuda-root .rafaela-btn.primary:hover {
          background: #1e40af;
        }
        .rafaela-ajuda-root .rafaela-avatar {
          display: block;
          border-radius: 999px;
          overflow: hidden;
          box-shadow: 0 12px 28px rgba(29, 78, 216, 0.35);
          background: #000;
          cursor: grab;
          touch-action: none;
          user-select: none;
        }
        .rafaela-ajuda-root .rafaela-avatar:active {
          cursor: grabbing;
        }
        .rafaela-ajuda-root .rafaela-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          pointer-events: none;
        }
        .rafaela-ajuda-root .rafaela-apontando {
          animation: rafaela-ajuda-bounce 1.1s ease-in-out infinite;
        }
        @keyframes rafaela-ajuda-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .rafaela-ajuda-root .rafaela-esconder {
          position: absolute;
          top: -4px;
          left: -4px;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: #fff;
          color: #334155;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
          opacity: 0;
          transition: opacity 0.15s ease;
        }
        .rafaela-ajuda-root:hover .rafaela-esconder,
        .rafaela-ajuda-root .rafaela-esconder:focus-visible {
          opacity: 1;
        }
        @media (hover: none) {
          .rafaela-ajuda-root .rafaela-esconder {
            opacity: 1;
          }
        }
        @media (max-width: 640px) {
          .rafaela-ajuda-root .rafaela-balloon.rafaela-ajuda-balloon {
            position: fixed;
            left: 8px !important;
            right: 8px !important;
            top: auto !important;
            bottom: calc(8px + env(safe-area-inset-bottom)) !important;
            width: auto;
            max-width: none !important;
            max-height: calc(100dvh - 16px) !important;
            padding: 0.85rem 0.85rem 0.7rem;
          }
          .rafaela-ajuda-root .rafaela-balloon.rafaela-ajuda-balloon::after {
            display: none;
          }
          .rafaela-ajuda-msgs {
            max-height: none;
            min-height: 120px;
          }
          .rafaela-ajuda-chips {
            flex-wrap: nowrap;
            flex-shrink: 0;
            overflow-x: auto;
            padding-bottom: 2px;
          }
          .rafaela-ajuda-modulos,
          .rafaela-ajuda-form,
          .rafaela-ajuda-root .rafaela-balloon-actions {
            flex-shrink: 0;
          }
          .rafaela-ajuda-chips > * {
            flex: 0 0 auto;
          }
          .rafaela-ajuda-input {
            font-size: 16px;
          }
          .rafaela-ajuda-send {
            width: 2.6rem;
            height: 2.6rem;
          }
          .rafaela-ajuda-root .rafaela-btn.sm {
            padding: 0.45rem 0.8rem;
            font-size: 0.8rem;
          }
          .rafaela-ajuda-root .rafaela-close {
            padding: 0.45rem;
          }
        }
      `}</style>
    </div>
  )
}
