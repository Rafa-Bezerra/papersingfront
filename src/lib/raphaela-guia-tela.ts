import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { prepararPasso } from '@/components/RafaelaTour'
import {
  normalizarRota,
  passosDoGuia,
  type AlvoGuia,
  type GuiaUsuario,
  type LadoGuia,
  type PassoRoteiro,
} from '@/lib/raphaela-guias'

function visivel(el: Element | null | undefined): el is HTMLElement {
  return el instanceof HTMLElement && el.getClientRects().length > 0
}

function primeiroVisivel(seletor: string, raiz: ParentNode): HTMLElement | null {
  for (const el of Array.from(raiz.querySelectorAll(seletor))) {
    if (visivel(el)) return el
  }
  return null
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SELETOR_BUSCA =
  'input[type="search"], input[placeholder*="esquis" i], input[placeholder*="usca" i], input[placeholder*="usque" i], input[placeholder*="iltr" i]'

const TEXTO_BOTAO_NOVO = /^(\+\s*)?(novo|nova|adicionar|incluir|criar|cadastrar)\b/i

function acharAlvo(alvo: AlvoGuia, url: string): HTMLElement | null {
  const tela = document.querySelector('main') ?? document.body
  switch (alvo) {
    case 'menu':
      return primeiroVisivel(`[data-menu-url="${url}"]`, document)
    case 'titulo':
      return primeiroVisivel('h1, h2', tela)
    case 'abas':
      return primeiroVisivel('[role="tablist"]', tela)
    case 'busca':
      return primeiroVisivel(SELETOR_BUSCA, tela)
    case 'novo':
      return (
        (Array.from(tela.querySelectorAll('button, a')).find(
          (el) => visivel(el) && TEXTO_BOTAO_NOVO.test((el.textContent ?? '').trim())
        ) as HTMLElement | undefined) ?? null
      )
    case 'tabela':
      return primeiroVisivel('table, [role="table"]', tela)
    case 'acoes': {
      const celula = primeiroVisivel('table tbody tr td:last-child', tela)
      return celula?.querySelector('button, a') ? celula : null
    }
  }
}

async function esperarAlvo(alvo: AlvoGuia, url: string, timeoutMs: number): Promise<HTMLElement | null> {
  const inicio = Date.now()
  for (;;) {
    const el = acharAlvo(alvo, url)
    if (el || Date.now() - inicio >= timeoutMs) return el
    await esperar(150)
  }
}

async function esperarSeletor(seletor: string, timeoutMs: number): Promise<HTMLElement | null> {
  const inicio = Date.now()
  for (;;) {
    const el = primeiroVisivel(seletor, document)
    if (el || Date.now() - inicio >= timeoutMs) return el
    await esperar(120)
  }
}

/** Item dentro de Configurações só existe no DOM com o bloco aberto. */
async function abrirConfiguracoesSePreciso(url: string): Promise<void> {
  if (acharAlvo('menu', url)) return
  const botao = Array.from(document.querySelectorAll('button[aria-expanded="false"]')).find((b) =>
    (b.textContent ?? '').includes('Configurações')
  )
  if (botao instanceof HTMLElement) {
    botao.click()
    await esperar(350)
  }
}

/** Fecha menu Novo e formulários abertos pelo guia (Esc, como o tour faz com o formulário da CI). */
async function fecharAbertosPeloGuia(): Promise<void> {
  for (const seletor of ['#tour-plugsign-novo-interno', '#tour-doc-form', '#tour-docext-form']) {
    if (!document.querySelector(seletor)) continue
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    const inicio = Date.now()
    while (document.querySelector(seletor) && Date.now() - inicio < 1500) await esperar(100)
  }
}

/** Radix DropdownMenu abre no pointerdown; .click() sozinho não abre. */
async function abrirMenuNovoWaySign(): Promise<void> {
  if (document.querySelector('#tour-plugsign-novo-interno')) return
  await fecharAbertosPeloGuia()
  const botao = await esperarSeletor('#tour-plugsign-solicitacao', 8000)
  if (!botao) return
  botao.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' })
  )
  await esperarSeletor('#tour-plugsign-novo-interno', 1500)
}

async function abrirFormDocumento(): Promise<void> {
  if (document.querySelector('#tour-doc-form')) return
  await abrirMenuNovoWaySign()
  const item = document.querySelector('#tour-plugsign-novo-interno')
  if (item instanceof HTMLElement) item.click()
  await esperarSeletor('#tour-doc-form', 3000)
  await esperar(250)
}

async function abrirFormDocExterno(): Promise<void> {
  if (document.querySelector('#tour-docext-form')) return
  const botao = await esperarSeletor('#tour-docext-novo', 8000)
  if (!botao) return
  botao.click()
  await esperarSeletor('#tour-docext-form', 3000)
  await esperar(250)
}

function negrito(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/** Com modal do Radix aberto o body fica com pointer-events: none e o balão do driver herda. */
function garantirEstilo(): void {
  if (document.getElementById('raphaela-guia-estilo')) return
  const s = document.createElement('style')
  s.id = 'raphaela-guia-estilo'
  s.textContent =
    '.driver-popover.raphaela-guia-popover{pointer-events:auto;max-width:min(320px,calc(100vw - 24px))}' +
    '.raphaela-guia-progresso{margin-top:8px;font-size:12px;color:#64748b}'
  document.head.appendChild(s)
}

export type FimGuia = 'concluiu' | 'fechou'

type OpcoesGuia = { irPara: (href: string) => void; aoTerminar: (motivo: FimGuia) => void }

type PassoTela = {
  titulo: string
  mensagem: string
  lado: LadoGuia
  preparar: () => Promise<HTMLElement | null>
}

function executarGuia(passos: PassoTela[], opts: OpcoesGuia, mostrarProgresso: boolean): () => void {
  garantirEstilo()
  let atual = -1
  let terminou = false
  let ocupado = false

  const terminar = (motivo: FimGuia) => {
    if (terminou) return
    terminou = true
    try {
      d.destroy()
    } catch {
      /* silencioso */
    }
    opts.aoTerminar(motivo)
  }

  const d = driver({
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    stageRadius: 10,
    allowClose: true,
    smoothScroll: true,
    popoverClass: 'raphaela-guia-popover',
    onDestroyed: () => {
      if (!terminou) {
        terminou = true
        opts.aoTerminar('fechou')
      }
    },
  })

  const mostrar = async (inicio: number, direcao: 1 | -1) => {
    if (ocupado || terminou) return
    ocupado = true
    try {
      for (let i = inicio; i >= 0 && i < passos.length; i += direcao) {
        const passo = passos[i]
        const el = await passo.preparar()
        if (terminou) return
        if (!el) continue

        const ultimo = i === passos.length - 1
        atual = i
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        const progresso = mostrarProgresso && passos.length > 1
          ? `<div class="raphaela-guia-progresso">${i + 1} de ${passos.length}</div>`
          : ''
        d.highlight({
          element: el,
          popover: {
            title: passo.titulo,
            description: negrito(passo.mensagem) + progresso,
            side: passo.lado,
            align: 'start',
            showButtons: passos.length > 1 ? ['previous', 'next', 'close'] : ['next', 'close'],
            disableButtons: i === 0 ? ['previous'] : [],
            prevBtnText: 'Anterior',
            nextBtnText: ultimo ? 'Concluir' : 'Próximo',
            onNextClick: () => void mostrar(atual + 1, 1),
            onPrevClick: () => void mostrar(atual - 1, -1),
            onCloseClick: () => terminar('fechou'),
          },
        })
        return
      }
      if (direcao === 1) terminar('concluiu')
    } finally {
      ocupado = false
    }
  }

  void mostrar(0, 1)
  return () => terminar('fechou')
}

/**
 * Passo a passo genérico (driver.js): aponta o item no menu, abre a tela e destaca título, abas, busca,
 * botão Novo e lista. Passos cujo alvo não existe naquela tela são pulados.
 * Retorna uma função que encerra o guia.
 */
export function iniciarGuiaNaTela(guia: GuiaUsuario, opts: OpcoesGuia): () => void {
  const passos: PassoTela[] = passosDoGuia(guia).map((p) => ({
    titulo: p.titulo,
    mensagem: p.mensagem,
    lado: p.alvo === 'menu' ? 'right' : 'bottom',
    preparar: async () => {
      let navegou = false
      if (p.alvo === 'menu') {
        await abrirConfiguracoesSePreciso(guia.url)
      } else if (normalizarRota(window.location.pathname) !== guia.url) {
        opts.irPara(`${guia.url}/`)
        navegou = true
      }
      return esperarAlvo(p.alvo, guia.url, navegou ? 8000 : 1200)
    },
  }))
  return executarGuia(passos, opts, false)
}

/** Roteiro de uma pergunta: cada parte da tela explicada, como no tour assistido. */
export function iniciarRoteiroNaTela(roteiro: PassoRoteiro[], opts: OpcoesGuia): () => void {
  const passos: PassoTela[] = roteiro.map((p) => ({
    titulo: p.titulo,
    mensagem: p.mensagem,
    lado: p.lado ?? 'bottom',
    preparar: async () => {
      if (p.rota && normalizarRota(window.location.pathname) !== normalizarRota(p.rota)) {
        opts.irPara(`${normalizarRota(p.rota)}/`)
        await esperar(700)
      }
      if (p.acao === 'abrirFormDocumento') {
        await abrirFormDocumento()
      } else if (p.acao === 'abrirNovoWaySign') {
        await abrirMenuNovoWaySign()
      } else if (p.acao === 'abrirFormDocExterno') {
        await abrirFormDocExterno()
      } else {
        await fecharAbertosPeloGuia()
        await prepararPasso(
          { ordem: 0, seletorCss: p.seletor, titulo: p.titulo, mensagem: p.mensagem, rota: p.rota ?? null, lado: p.lado ?? null },
          opts.irPara
        )
      }
      return esperarSeletor(p.seletor, 1500)
    },
  }))
  return executarGuia(passos, opts, true)
}
