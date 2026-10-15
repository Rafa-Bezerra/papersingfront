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

/** Mesma regra do menu e da rota /docusign: o item Documentos saiu do menu e fica dentro do WaySign. */
function usuarioPodeDocumentosWaySign(): boolean {
  const u = lerUserData()
  return Boolean(u?.admin || u?.financeiro || u?.docusign || u?.documentos)
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

/** Partes do WaySign que quem só tem a permissão Documentos também enxerga. */
const SELETORES_WAYSIGN_DOCUMENTOS = new Set([
  '#tour-menu-plugsign',
  '#tour-plugsign-guias',
  '#tour-plugsign-documentos',
  '#tour-plugsign-doc-painel',
  '#tour-plugsign-doc-titulo',
  '#tour-plugsign-doc-acoes',
  '#tour-plugsign-cert',
  '#tour-plugsign-solicitacao',
  '#tour-plugsign-meus',
  '#tour-plugsign-meus-origem',
  '#tour-plugsign-solicitante',
  '#tour-plugsign-filtros',
  '#tour-plugsign-busca',
  '#tour-plugsign-lista',
  '#tour-plugsign-paginacao',
])

function passoEhWaySignDocumentos(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  return SELETORES_WAYSIGN_DOCUMENTOS.has(sel)
}

/** Abas Lotes e Administração: só Admin (mesma regra do DocusignPage). */
function passoEhWaySignAdmin(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  return sel === '#tour-plugsign-lotes' || sel === '#tour-plugsign-admin'
}

/** Tour que percorre o WaySign inteiro, parte por parte (tem o passo da lista de documentos). */
function tourEhWaySignCompleto(tour: TourPendente | null): boolean {
  return Boolean(
    tour?.passos?.some((p) => (p.seletorCss || '').trim().toLowerCase() === '#tour-plugsign-lista')
  )
}

/** Versão do tour que explica a saída do item Documentos do menu (tem o passo da aba Meus documentos). */
function tourEhDocumentosNoWaySign(tour: TourPendente | null): boolean {
  return Boolean(
    tour?.passos?.some((p) => (p.seletorCss || '').trim().toLowerCase() === '#tour-plugsign-meus')
  )
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

function passoEhPendencias(passo: TourPasso): boolean {
  const sel = (passo.seletorCss || '').trim().toLowerCase()
  const rota = (passo.rota || '').trim().toLowerCase()
  if (sel.includes('pendencias') || sel.includes('tour-pendencias')) return true
  if (rota.includes('/pendencias')) return true
  return false
}

const NOME_MODULO_ASSINATURA = 'WaySign'

/** Nome do módulo no menu/tour (WaySign). Mantém PlugSign só como provedor externo de assinatura. */
function normalizarTextoTour(texto: string): string {
  if (!texto) return texto
  return texto
    .replace(/Módulo PlugSign/g, `Módulo ${NOME_MODULO_ASSINATURA}`)
    .replace(/módulo PlugSign/g, `módulo ${NOME_MODULO_ASSINATURA}`)
    .replace(/Guias do PlugSign/g, `Guias do ${NOME_MODULO_ASSINATURA}`)
    .replace(/No PlugSign, as pessoas assinam/g, `No ${NOME_MODULO_ASSINATURA}, as pessoas assinam`)
    .replace(/projetos, PlugSign de todas/g, `projetos, ${NOME_MODULO_ASSINATURA} de todas`)
    .replace(/projetos, PlugSign e/g, `projetos, ${NOME_MODULO_ASSINATURA} e`)
    .replace(/, PlugSign\)/g, `, ${NOME_MODULO_ASSINATURA})`)
    .replace(/documento, PlugSign, etc/g, `documento, ${NOME_MODULO_ASSINATURA}, etc`)
    .replace(/PlugSign e demais tipos/g, `${NOME_MODULO_ASSINATURA} e demais tipos`)
}

function listarModulosTour(): string[] {
  const mods: string[] = ['Pendências do gestor']
  if (usuarioPodeReceitas()) mods.push('Receitas')
  if (usuarioPodePagamentosCi()) mods.push('Pagamentos CI')
  if (usuarioPodeDocumentosWaySign()) mods.push(NOME_MODULO_ASSINATURA)
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
 * - sem Receitas, sem Pagamentos CI e sem WaySign → só GLPI
 * - cada módulo liberado entra no tour + GLPI
 * - passo de financeiro RM no formulário da CI só com financeiro_totvs
 * Menu lateral só entra quando há pelo menos um módulo.
 */
function filtrarPassosPorPermissao(passos: TourPasso[]): TourPasso[] {
  const podePlug = usuarioPodePlugSign()
  const podeDocWaySign = usuarioPodeDocumentosWaySign()
  const podeReceitas = usuarioPodeReceitas()
  const podeCi = usuarioPodePagamentosCi()
  const podeFinRm = usuarioPodeFinanceiroRm()
  const temAlgumModulo = true

  return passos.filter((p) => {
    if (!p.seletorCss || !p.seletorCss.trim()) return false

    if (passoEhGlpi(p)) return true
    if (passoEhPendencias(p)) return true
    if (passoEhMenuGeral(p)) return temAlgumModulo
    if (passoEhReceitas(p)) return podeReceitas
    if (passoEhCiFinanceiroRm(p)) return podeCi && podeFinRm
    if (passoEhPagamentosCi(p)) return podeCi
    if (passoEhWaySignAdmin(p)) return Boolean(lerUserData()?.admin)
    if (passoEhWaySignDocumentos(p)) return podeDocWaySign
    if (passoEhPlugSign(p)) return podePlug

    return temAlgumModulo
  })
}

function mensagemIntroWaySignCompleto(): string {
  if (!usuarioPodeDocumentosWaySign()) {
    return `Olá, sou a Raphaela!\n\nO ${NOME_MODULO_ASSINATURA} reúne os documentos internos (aprovação em níveis) e as assinaturas pela PlugSign.\n\nNo seu perfil ele não está liberado, então nada muda no seu dia a dia. Vou te mostrar onde pedir a liberação, se precisar.`
  }
  if (!usuarioPodePlugSign()) {
    return `Olá, sou a Raphaela!\n\nVou te mostrar o ${NOME_MODULO_ASSINATURA} parte por parte: onde ficam os documentos pendentes e os finalizados, como buscar e filtrar, como criar um documento para aprovação e o que cada botão da lista faz.\n\nVocê pode voltar ou avançar a qualquer momento.`
  }
  return `Olá, sou a Raphaela!\n\nVou te mostrar o ${NOME_MODULO_ASSINATURA} parte por parte: as abas, os botões do topo, a busca e os filtros, como criar um documento ou enviar para assinatura, o que cada coluna e ação da lista faz, e as abas de acompanhamento (Solicitações, Clientes e parceiros, Templates e relatórios).\n\nVocê pode voltar ou avançar a qualquer momento.`
}

function mensagemFimWaySignCompleto(): string {
  if (!usuarioPodeDocumentosWaySign()) {
    return `Pronto!\n\nSe precisar de acesso ao ${NOME_MODULO_ASSINATURA}, abra um chamado no Suporte (GLPI) ou fale com a equipe de TI.\n\nBom trabalho!`
  }
  let texto =
    `Pronto! Recapitulando:\n\n• Documentos: o que está pendente. Meus documentos: o que já foi finalizado.\n• Novo → Aprovação interna: documento com aprovadores em níveis.\n• Busca, Solicitante e Filtros (Status, Origem e Visão) refinam a lista.\n• Na linha do documento: Assinar, Documento, Imprimir, Anexos, Aprovações e Aprovar/Reprovar.`
  if (usuarioPodePlugSign()) {
    texto +=
      '\n• Novo → Enviar para assinatura (PlugSign): para quem é de fora da empresa.\n• Solicitações: Enviadas, Recebidas e Histórico, com Detalhes e Lembrete.\n• Clientes e parceiros, Templates, Painel, Relatório e Mensagens completam o acompanhamento.'
  }
  return `${texto}\n\nSe precisar de ajuda, use o ícone de Suporte (GLPI) ou fale com a equipe de TI.\n\nBom trabalho!`
}

function mensagemIntroDocumentosNoWaySign(): string {
  if (!usuarioPodeDocumentosWaySign()) {
    return `Olá, sou a Raphaela!\n\nMudamos um lugar no sistema: o item Documentos saiu do menu lateral e agora fica dentro do ${NOME_MODULO_ASSINATURA}.\n\nNo seu perfil esses módulos não estão liberados, então nada muda no seu dia a dia. Se precisar acessar documentos, vou te mostrar onde pedir a liberação.`
  }
  return `Olá, sou a Raphaela!\n\nMudamos um lugar no sistema: o item Documentos saiu do menu lateral.\n\nAgora os documentos ficam dentro do ${NOME_MODULO_ASSINATURA}. Nada foi perdido: seus documentos, aprovadores e assinaturas continuam os mesmos — só mudou o caminho.\n\nVou te mostrar, passo a passo, onde encontrar cada coisa.`
}

function mensagemFimDocumentosNoWaySign(): string {
  if (!usuarioPodeDocumentosWaySign()) {
    return `Pronto!\n\nSe precisar de acesso a Documentos ou ao ${NOME_MODULO_ASSINATURA}, abra um chamado no Suporte (GLPI) ou fale com a equipe de TI.\n\nBom trabalho!`
  }
  let texto =
    `Pronto! Recapitulando:\n\n• Menu ${NOME_MODULO_ASSINATURA} → aba Documentos: o que está pendente (era o antigo menu Documentos).\n• Botão Novo → Aprovação interna: cria um documento para aprovação em níveis, como antes.\n• Aba Meus documentos: os já finalizados (concluídos, recusados ou cancelados).\n• Links e pendências antigos de Documentos continuam funcionando.`
  if (usuarioPodePlugSign()) {
    texto +=
      '\n• Solicitações e Clientes e parceiros: envio para assinatura pela PlugSign, como antes.'
  }
  return `${texto}\n\nSe precisar de ajuda, use o ícone de Suporte (GLPI) ou fale com a equipe de TI.\n\nBom trabalho!`
}

function mensagemIntroPorPerfil(): string {
  const mods = listarModulosTour()
  const outros = mods.filter((m) => m !== 'Pendências do gestor')
  if (outros.length === 0) {
    return 'Olá, sou a Raphaela!\n\nNosso sistema teve uma atualização.\n\nVou te mostrar a nova Caixa de Pendências do gestor: todas as WAY em um só lugar, com assinatura e aprovação direto no modal — sem trocar de base.\n\nTambém mostro o suporte para abertura de chamado no GLPI.'
  }
  return `Olá, sou a Raphaela!\n\nNosso sistema teve uma atualização.\n\nVou te mostrar ${juntarListaPt(mods)} e o suporte para abertura de chamado.\n\nDestaque nas pendências: você assina, aprova ou recusa no modal, em qualquer WAY, sem trocar de base.`
}

function mensagemFimPorPerfil(): string {
  const mods = listarModulosTour()
  if (mods.length <= 1) {
    return 'Pronto!\n\nNa Caixa de Pendências você vê tudo que aguarda sua aprovação ou assinatura em qualquer WAY. Ao clicar, abre o modal: visualize o PDF, assine, aprove ou recuse na mesma tela — o PaperSign usa a base da pendência e você não precisa trocar de unidade.\n\nSe precisar de ajuda, use o ícone de Suporte (GLPI) ou fale com a equipe de TI.\n\nBom trabalho!'
  }
  let extras =
    `\n\nNa Caixa de Pendências, movimentos, documentos, RDV, fiscal, projetos e ${NOME_MODULO_ASSINATURA} de todas as WAY aparecem juntos. No modal você assina, aprova ou recusa sem trocar de base — o sistema abre na unidade certa automaticamente.`
  if (usuarioPodeReceitas()) {
    extras +=
      '\n\nReceitas aparece só para administrador ou quem tem a permissão Receitas em Usuários.'
  }
  if (usuarioPodePagamentosCi()) {
    extras +=
      '\n\nEm Pagamentos CI, ao concluir a aprovação o financeiro pode ser gerado automaticamente no RM.'
  }
  if (usuarioPodePlugSign()) {
    extras +=
      `\n\nNo ${NOME_MODULO_ASSINATURA}, as pessoas assinam pela PlugSign, mas todo o processo (envio, andamento e PDF) fica no PaperSign.`
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
      clicarAbaRadix(aba)
      await new Promise((r) => setTimeout(r, 350))
    }
  }
}

/** Radix Tabs muda no mousedown (não no click). .click() sozinho não troca a aba. */
function clicarAbaRadix(el: HTMLElement): void {
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    button: 0,
    view: window,
  }
  el.dispatchEvent(new MouseEvent('mousedown', opts))
  el.dispatchEvent(new MouseEvent('mouseup', opts))
  el.dispatchEvent(new MouseEvent('click', opts))
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

/** Abas que o tour destaca pelo próprio botão da aba (seletor → valor da aba no DocusignPage). */
const ABAS_WAYSIGN_PROPRIAS: Record<string, string> = {
  '#tour-plugsign-templates': 'templates',
  '#tour-plugsign-painel': 'painel',
  '#tour-plugsign-relatorio': 'relatorio',
  '#tour-plugsign-mensagens': 'mensagens',
  '#tour-plugsign-lotes': 'lotes',
  '#tour-plugsign-admin': 'admin',
}

/**
 * Valor da aba WaySign para cada seletor interno do tour (T-WS3a: Documentos / Solicitações / Clientes e parceiros).
 * "solicitar" abre o formulário "Solicitar assinatura" (modal dentro de Documentos).
 */
function abaPlugSignPorSeletor(seletor: string): string | null {
  if (!seletor.startsWith('#tour-plugsign-')) return null
  if (
    seletor === '#tour-plugsign-documentos' ||
    seletor === '#tour-plugsign-doc-painel' ||
    seletor === '#tour-plugsign-doc-titulo' ||
    seletor === '#tour-plugsign-doc-acoes' ||
    seletor === '#tour-plugsign-cert' ||
    seletor === '#tour-plugsign-solicitacao' ||
    seletor === '#tour-plugsign-waysign-link' ||
    seletor === '#tour-plugsign-alertas' ||
    seletor === '#tour-plugsign-solicitante' ||
    seletor === '#tour-plugsign-filtros' ||
    seletor === '#tour-plugsign-busca' ||
    seletor === '#tour-plugsign-lista' ||
    seletor === '#tour-plugsign-paginacao'
  ) {
    return 'documentos'
  }
  if (seletor === '#tour-plugsign-meus' || seletor === '#tour-plugsign-meus-origem') {
    return 'meus'
  }
  if (seletor.startsWith('#tour-plugsign-solicitacao-')) {
    return 'solicitar'
  }
  // As datas só aparecem em Solicitações (Documentos e Meus documentos não têm limite de data).
  if (
    seletor === '#tour-plugsign-minhas' ||
    seletor === '#tour-plugsign-minhas-painel' ||
    seletor === '#tour-plugsign-datas'
  ) {
    return 'solicitacoes'
  }
  if (seletor === '#tour-plugsign-fornecedor' || seletor === '#tour-plugsign-fornecedor-painel') {
    return 'clientes'
  }
  const abaPropria = ABAS_WAYSIGN_PROPRIAS[seletor]
  if (abaPropria) return abaPropria
  return null
}

function fecharSolicitarSeAberto(): void {
  if (!document.querySelector('#tour-plugsign-solicitacao-form')) return
  window.dispatchEvent(new CustomEvent('tour-plugsign-aba', { detail: 'documentos' }))
}

/** Abre a aba correta do PlugSign (como o Novo da CI abre o formulário). */
async function ativarAbaPlugSignSePreciso(seletor: string): Promise<void> {
  const valorAba = abaPlugSignPorSeletor(seletor)
  if (!valorAba) return

  const triggerId =
    valorAba === 'documentos' || valorAba === 'solicitar'
      ? '#tour-plugsign-documentos'
      : valorAba === 'meus'
        ? '#tour-plugsign-meus'
        : valorAba === 'solicitacoes'
          ? '#tour-plugsign-minhas'
          : valorAba === 'clientes'
            ? '#tour-plugsign-fornecedor'
            : `#tour-plugsign-${valorAba}`

  // Alvo na tela e aba dele ativa: nada a trocar. O cabeçalho é o mesmo em Documentos, Meus documentos e Solicitações.
  // O formulário "Solicitar assinatura" é um modal: fora dos passos dele, precisa fechar.
  const formSolicitarAberto =
    valorAba !== 'solicitar' && Boolean(document.querySelector('#tour-plugsign-solicitacao-form'))
  if (document.querySelector(seletor) && !formSolicitarAberto) {
    const trigger = document.querySelector(triggerId)
    if (valorAba === 'solicitar' || trigger?.getAttribute('data-state') !== 'inactive') return
  }

  // 1) Evento dedicado (Tabs controlado no React — mais confiável).
  window.dispatchEvent(
    new CustomEvent('tour-plugsign-aba', { detail: valorAba })
  )

  // 2) Fallback: mousedown no TabsTrigger (Radix não troca só com .click()).
  const tab = document.querySelector(triggerId)
  if (tab instanceof HTMLElement) {
    clicarAbaRadix(tab)
  }

  if (formSolicitarAberto) {
    const inicio = Date.now()
    while (document.querySelector('#tour-plugsign-solicitacao-form') && Date.now() - inicio < 1500) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  // Espera o conteúdo da aba montar (igual ao form da CI).
  if (seletor !== triggerId) {
    await esperarSeletor(seletor, 4000)
  } else {
    await new Promise((r) => setTimeout(r, 350))
  }
  await new Promise((r) => setTimeout(r, 200))
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
  await ativarAbaPlugSignSePreciso(seletor)

  let el = await esperarSeletor(seletor)
  if (!el && seletor === '#tour-receitas-acoes') {
    // Fallback: destaca as abas se as ações ainda não montaram.
    el = await esperarSeletor('#tour-receitas-abas', 2000)
  }
  if (!el && seletor === '#tour-pendencias-lista') {
    el = await esperarSeletor('#tour-pendencias-titulo', 2000)
  }
  if (!el && seletor.startsWith('#tour-pendencias-')) {
    el = await esperarSeletor('#tour-pendencias-titulo', 2000)
  }

  if (el instanceof HTMLElement) {
    if (seletor === '#tour-receitas-consulta' || seletor === '#tour-receitas-unidade') {
      clicarAbaRadix(el)
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
  const [liberadoAposPendencias, setLiberadoAposPendencias] = useState(false)
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const finalizandoRef = useRef(false)
  const passosRef = useRef<TourPasso[]>([])
  const tentouBuscarRef = useRef(false)
  const navLockRef = useRef(false)
  const introTimerRef = useRef<number | null>(null)
  const tourIniciadoRef = useRef(false)

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
        element: () => {
          const alvo = document.querySelector(sel) as Element | null
          if (alvo) return alvo
          // Evita cair no body nos passos do PlugSign (popover flutuando sem destaque).
          if (sel.startsWith('#tour-plugsign-')) {
            const guias = document.querySelector('#tour-plugsign-guias')
            if (guias) return guias
          }
          return (
            (document.querySelector('#tour-receitas-abas') as Element) ||
            document.body
          )
        },
        popover: {
          title: normalizarTextoTour(p.titulo || tour.titulo || 'Novidade'),
          description: normalizarTextoTour(p.mensagem).replace(/\n/g, '<br/>'),
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
            // Refresh depois do React montar a aba (PlugSign / Receitas).
            window.setTimeout(() => {
              limparPopoversDriverExtras()
              try {
                drv.refresh()
              } catch {
                /* silencioso */
              }
            }, 80)
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
            window.setTimeout(() => {
              limparPopoversDriverExtras()
              try {
                drv.refresh()
              } catch {
                /* silencioso */
              }
            }, 80)
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
    const liberar = () => setLiberadoAposPendencias(true)
    window.addEventListener('papersign-pendencias-modal-resolvido', liberar)
    return () => {
      window.removeEventListener('papersign-pendencias-modal-resolvido', liberar)
    }
  }, [])

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
      } catch {
        tentouBuscarRef.current = false
      }
    })()
  }, [pathname])

  useEffect(() => {
    if (!tour?.exibir || !liberadoAposPendencias || tourIniciadoRef.current) return

    tourIniciadoRef.current = true
    setAberto(true)
    setFase('intro')

    if (introTimerRef.current) window.clearTimeout(introTimerRef.current)
    introTimerRef.current = window.setTimeout(() => {
      setFase((f) => (f === 'intro' ? 'auto-start' : f))
    }, 4500)

    return () => {
      if (introTimerRef.current) {
        window.clearTimeout(introTimerRef.current)
        introTimerRef.current = null
      }
    }
  }, [tour, liberadoAposPendencias])

  useEffect(() => {
    if (fase !== 'auto-start' || !tour) return
    iniciarPassos()
  }, [fase, tour, iniciarPassos])

  useEffect(() => {
    if (fase === 'fim') fecharSolicitarSeAberto()
  }, [fase])

  if (!aberto || !tour || fase === 'idle') return null

  const tituloTour =
    (tour.titulo || 'Novos recursos do sistema')
      .replace(/\s*v(ers[aã]o)?\s*\d+(\.\d+)*/gi, '')
      .trim() || 'Novos recursos do sistema'

  const waySignCompleto = tourEhWaySignCompleto(tour)
  const docsNoWaySign = tourEhDocumentosNoWaySign(tour)
  const balãoTexto =
    fase === 'intro' || fase === 'auto-start'
      ? waySignCompleto
        ? mensagemIntroWaySignCompleto()
        : docsNoWaySign ? mensagemIntroDocumentosNoWaySign() : mensagemIntroPorPerfil()
      : fase === 'fim'
        ? (waySignCompleto
          ? mensagemFimWaySignCompleto()
          : docsNoWaySign ? mensagemFimDocumentosNoWaySign() : mensagemFimPorPerfil()) + '\n\nComo deseja continuar?'
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
