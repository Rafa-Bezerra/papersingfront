import { data } from '@/lib/data'
import {
  filterConfigNavItems,
  hasAnyConfigMenuAccess,
  mapConfigMenuFromApi,
  type ConfigMenuSession,
} from '@/lib/configuracoes-permissoes'
import { buildPapersignConfigNav } from '@/lib/papersign-config-nav'
import { moduloMenuVisivel, usuarioMenuDaSessao } from '@/lib/modulosMenuPermissao'
import type { RaphaelaAjudaArtigo } from '@/lib/raphaela-ajuda-permissoes'

/** Parte da tela que a Raphaela destaca. Se a tela não tiver aquela parte, o passo é pulado. */
export type AlvoGuia = 'menu' | 'titulo' | 'abas' | 'busca' | 'novo' | 'tabela' | 'acoes'

export type PassoGuia = {
  alvo: AlvoGuia
  titulo: string
  mensagem: string
}

export type GuiaModulo = {
  url: string
  titulo: string
  resumo: string
  perguntas: string[]
  palavrasChave: string
  textos: Partial<Record<AlvoGuia, string>>
}

/** Guia liberado para o usuário; `noConfig` = o item fica dentro de Configurações no menu. */
export type GuiaUsuario = GuiaModulo & { noConfig: boolean }

const G = (
  url: string,
  titulo: string,
  resumo: string,
  perguntas: string[],
  palavrasChave: string,
  textos: Partial<Record<AlvoGuia, string>> = {}
): GuiaModulo => ({ url, titulo, resumo, perguntas, palavrasChave, textos })

const GUIAS: GuiaModulo[] = [
  G('/home', 'Início', 'Página inicial: um resumo do que aguarda você no PaperSign.',
    ['O que aparece no Início?'], 'inicio home pagina inicial resumo'),
  G('/pendencias', 'Pendências',
    'Caixa de pendências do gestor: tudo que aguarda sua aprovação ou assinatura, de todas as WAY, em um só lugar. Ao clicar em uma pendência, abre o modal para ver o PDF, assinar, aprovar ou recusar sem trocar de base.',
    ['Como ver o que está pendente?', 'Como aprovar ou assinar uma pendência?'],
    'pendencia pendencias aprovar assinar recusar caixa gestor modal',
    { busca: 'Digite aqui para encontrar uma pendência pelo nome, número ou unidade.' }),
  G('/solicitacoes', 'Solicitação de compra', 'Solicitações de compra: peça o que precisa comprar e acompanhe o andamento.',
    ['Como fazer uma solicitação de compra?', 'Como acompanhar minha solicitação?'], 'compra solicitacao solicitar pedido material'),
  G('/requisicoes', 'Recebimento de materiais', 'Recebimento de materiais: registre e acompanhe o recebimento do que foi comprado.',
    ['Como registrar o recebimento de materiais?'], 'recebimento material receber requisicao entrega'),
  G('/controle', 'Controle imobilizado', 'Controle imobilizado: acompanhe os registros de bens do imobilizado.',
    ['Como usar o Controle imobilizado?'], 'imobilizado patrimonio bem controle'),
  G('/ordens', 'Ordem de compra', 'Ordens de compra: consulte e acompanhe as ordens de compra.',
    ['Como consultar uma ordem de compra?'], 'ordem compra oc pedido'),
  G('/aquisicoes', 'Aquisição de serviços', 'Aquisição de serviços: solicite e acompanhe a contratação de serviços.',
    ['Como solicitar a aquisição de um serviço?'], 'aquisicao servico contratar contratacao'),
  G('/requisicoes-contrato', 'Requisições de contrato', 'Requisições de contrato: acompanhe as requisições ligadas a contratos.',
    ['Onde vejo as requisições de contrato?'], 'requisicao contrato'),
  G('/docusign', 'WaySign',
    'WaySign: documentos internos com aprovação em níveis e envio para assinatura pela PlugSign. A aba Documentos mostra o que está pendente; Meus documentos, o que já foi finalizado.',
    ['Como enviar um documento para aprovação?', 'Como enviar para assinatura (PlugSign)?', 'Onde ficam meus documentos finalizados?'],
    'waysign documento documentos assinatura assinar plugsign docusign aprovacao interna certificado',
    { novo: 'Clique em **Novo** para criar um documento para aprovação interna ou enviar para assinatura.' }),
  G('/projetos', 'Projetos', 'Projetos (WAY CSC): cadastro, aprovação e acompanhamento dos projetos, inclusive os que chegam do Cronograma.',
    ['Como cadastrar um projeto?', 'Como acompanhar a aprovação de um projeto?'], 'projeto projetos dsp cronograma csc'),
  G('/receitas', 'Receitas', 'Receitas: conferência das receitas da unidade.',
    ['Como conferir as receitas?'], 'receita receitas conferencia praca pedagio'),
  G('/extrato-gestor', 'Extrato gestor', 'Extrato gestor: consulta do extrato para acompanhamento do gestor.',
    ['Como consultar o Extrato gestor?'], 'extrato gestor lancamentos'),
  G('/controle-medicao', 'Controle medição', 'Controle medição: acompanhe as medições registradas.',
    ['Como usar o Controle de medição?'], 'medicao medicoes controle'),
  G('/contratos', 'Contratos', 'Contratos: consulta e acompanhamento dos contratos.',
    ['Como consultar um contrato?'], 'contrato contratos'),
  G('/frotas', 'Frotas', 'Frotas: veículos, condutores, manutenção, multas e sinistros.',
    ['Como usar o módulo Frotas?'], 'frota frotas veiculo placa condutor multa sinistro manutencao'),
  G('/comunicados', 'Pagamentos CI',
    'Pagamentos CI: cadastre a comunicação interna de pagamento. Ela segue para aprovação e, ao concluir, o financeiro pode ser gerado no RM.',
    ['Como cadastrar um Pagamento CI?', 'Quem aprova o Pagamento CI?'], 'ci comunicado comunicacao interna pagamento pagamentos',
    { novo: 'Clique em **Novo** para cadastrar um Pagamento CI.' }),
  G('/bordero', 'Borderô', 'Borderô: acompanhe e aprove os borderôs de pagamento.',
    ['Como aprovar um borderô?'], 'bordero borderos pagamento aprovar'),
  G('/carrinho', 'Carrinho', 'Carrinho de compras: monte os itens e envie o pedido.',
    ['Como usar o Carrinho de compras?'], 'carrinho compra compras itens produto'),
  G('/rdv', 'RDV', 'RDV (relatório de despesas de viagem): lance suas despesas e envie para aprovação.',
    ['Como lançar um RDV?', 'Como acompanhar meu RDV?'], 'rdv despesa despesas viagem reembolso'),
  G('/aprovacaordv', 'Aprovação RDV', 'Aprovação RDV: veja os relatórios de despesas que aguardam sua aprovação.',
    ['Como aprovar um RDV?'], 'aprovacao rdv aprovar despesa viagem'),
  G('/gestao-pessoas', 'Restritos', 'Restritos: documentos de Gestão de Pessoas com acesso restrito.',
    ['Como usar os documentos Restritos?'], 'restrito restritos gestao pessoas rh'),
  G('/pagamentos-rh', 'Pagamentos G. Pessoas', 'Pagamentos de Gestão de Pessoas: acompanhe e aprove os pagamentos de RH.',
    ['Como aprovar pagamentos de Gestão de Pessoas?'], 'pagamento rh gestao pessoas folha'),
  G('/pagamentos-impostos', 'Pagamentos Impostos', 'Pagamentos de impostos: acompanhe e aprove os pagamentos de impostos.',
    ['Como aprovar pagamentos de impostos?'], 'pagamento imposto impostos tributo'),
  G('/documentos-externos', 'Documentos Externos', 'Documentos externos: documentos enviados por pessoas de fora da empresa.',
    ['Como ver os documentos externos?'], 'documento externo externos terceiro'),
  G('/fiscal', 'Painel Fiscal', 'Painel fiscal: acompanhe os documentos fiscais e as aprovações.',
    ['Como usar o Painel Fiscal?'], 'fiscal nota notas painel'),
  G('/alcadas', 'Alçadas',
    'Alçadas: quem aprova em cada centro de custo, por nível e faixa de valor. A aba Por usuário mostra todas as alçadas de uma pessoa e permite remover em lote.',
    ['Como ver as alçadas de um usuário?', 'Como remover alçadas em lote?', 'Como comparar alçadas?'],
    'alcada alcadas aprovador nivel centro custo lote remover usuario'),
  G('/usuarios', 'Usuários', 'Usuários: cadastro de usuários e permissões de acesso aos módulos.',
    ['Como liberar um módulo para um usuário?'], 'usuario usuarios permissao acesso liberar'),
  G('/borderoaprovadores', 'Aprovadores Borderô', 'Aprovadores Borderô: quem aprova os borderôs.',
    ['Como cadastrar aprovador de borderô?'], 'aprovador bordero'),
  G('/restritoaprovadores', 'Aprovadores Restritos', 'Aprovadores Restritos: quem aprova os documentos restritos.',
    ['Como cadastrar aprovador de restritos?'], 'aprovador restrito'),
  G('/fornecedores-restritos', 'Fornecedores Restritos', 'Fornecedores Restritos: fornecedores com tratamento restrito.',
    ['Como cadastrar fornecedor restrito?'], 'fornecedor restrito'),
  G('/impostosaprovadores', 'Aprovadores Impostos', 'Aprovadores Impostos: quem aprova os pagamentos de impostos.',
    ['Como cadastrar aprovador de impostos?'], 'aprovador imposto impostos'),
  G('/financeiroaprovadores', 'Aprovadores Financeiro', 'Aprovadores Financeiro: quem aprova no financeiro.',
    ['Como cadastrar aprovador do financeiro?'], 'aprovador financeiro'),
  G('/fiscalaprovadores', 'Aprovadores Fiscal', 'Aprovadores Fiscal: quem aprova no fiscal.',
    ['Como cadastrar aprovador do fiscal?'], 'aprovador fiscal'),
  G('/rhaprovadores', 'Aprovadores RH', 'Aprovadores RH: quem aprova os pagamentos de Gestão de Pessoas.',
    ['Como cadastrar aprovador de RH?'], 'aprovador rh gestao pessoas'),
  G('/centros-custos', 'Centros de custos',
    'Centros de custo: colaboradores por centro de custo, com comparação e inclusão ou remoção em lote.',
    ['Como comparar centros de custo?', 'Como incluir colaborador em vários centros de custo?'],
    'centro custo centros ccusto colaborador lote comparar'),
  G('/disparos', 'Disparos', 'Disparos: envios automáticos de avisos do sistema.',
    ['Como usar os Disparos?'], 'disparo disparos email aviso envio'),
  G('/cadastro-externos', 'Cadastro de externos', 'Cadastro de externos: pessoas de fora da empresa que acessam o sistema.',
    ['Como cadastrar um usuário externo?'], 'externo externos cadastro terceiro'),
  G('/status-pedido', 'Status do pedido', 'Status do pedido: acompanhamento do status dos pedidos.',
    ['Como acompanhar o status de um pedido?'], 'status pedido'),
]

export function normalizarRota(rota?: string | null): string {
  if (!rota) return '/'
  return rota.split('?')[0].replace(/\/+$/, '') || '/'
}

/** Guias dos módulos que o usuário vê no menu (mesma regra do menu lateral e do bloco Configurações). */
export function guiasDoUsuario(u: Record<string, unknown> | null): GuiaUsuario[] {
  if (!u) return []
  const um = usuarioMenuDaSessao(u)
  const sessaoConfig: ConfigMenuSession = { admin: um.admin, unidade: um.unidade, ...mapConfigMenuFromApi(u) }
  const urlsConfig = new Set(
    hasAnyConfigMenuAccess(sessaoConfig)
      ? filterConfigNavItems(buildPapersignConfigNav(um.unidade), sessaoConfig).map((i) => i.url)
      : []
  )
  const urlsModulos = new Set(
    data.navMain
      .flatMap((s) => s.items)
      .map((i) => i.url)
      .filter((url) => !urlsConfig.has(url) && moduloMenuVisivel(url, um))
  )
  return GUIAS.filter((g) => urlsModulos.has(g.url) || urlsConfig.has(g.url)).map((g) => ({
    ...g,
    noConfig: urlsConfig.has(g.url),
  }))
}

export function guiaDaRota(guias: GuiaUsuario[], rota?: string | null): GuiaUsuario | null {
  const r = normalizarRota(rota)
  return guias.find((g) => g.url === r || r.startsWith(`${g.url}/`)) ?? null
}

export function passosDoGuia(g: GuiaUsuario): PassoGuia[] {
  const t = g.textos
  return [
    {
      alvo: 'menu',
      titulo: `Onde fica: ${g.titulo}`,
      mensagem:
        t.menu ??
        (g.noConfig
          ? `No menu lateral, abra **Configurações** e clique em **${g.titulo}**.`
          : `No menu lateral, clique em **${g.titulo}**.`),
    },
    { alvo: 'titulo', titulo: g.titulo, mensagem: t.titulo ?? g.resumo },
    { alvo: 'abas', titulo: 'Abas', mensagem: t.abas ?? 'Use as abas para trocar de visão dentro desta tela.' },
    { alvo: 'busca', titulo: 'Busca', mensagem: t.busca ?? 'Digite aqui para encontrar um registro rapidamente.' },
    { alvo: 'novo', titulo: 'Criar novo', mensagem: t.novo ?? 'Este botão abre o formulário para criar um novo registro.' },
    {
      alvo: 'tabela',
      titulo: 'Lista',
      mensagem: t.tabela ?? 'Aqui ficam os registros. Use os botões de cada linha para ver detalhes e agir.',
    },
    {
      alvo: 'acoes',
      titulo: 'Ações da linha',
      mensagem:
        t.acoes ??
        'Na última coluna ficam as ações de cada registro (ver, editar, aprovar, imprimir…), conforme a sua permissão.',
    },
  ]
}

export type LadoGuia = 'left' | 'right' | 'top' | 'bottom'

/** Abre a parte da tela que só existe depois de um clique (menu Novo e formulário do WaySign). */
export type AcaoGuia = 'abrirNovoWaySign' | 'abrirFormDocumento' | 'abrirFormDocExterno'

/** Passo de um roteiro: mesmas âncoras (#tour-*) e mesma preparação de abas/formulários do tour assistido. */
export type PassoRoteiro = {
  seletor: string
  rota?: string
  titulo: string
  mensagem: string
  lado?: LadoGuia
  acao?: AcaoGuia
  so?: (u: Record<string, unknown>) => boolean
}

const podeWaySignPlugSign = (u: Record<string, unknown>) => Boolean(u.admin || u.financeiro || u.docusign)
const podeFinanceiroRm = (u: Record<string, unknown>) => Boolean(u.financeiro_totvs)

const MENU_WAYSIGN: PassoRoteiro = {
  seletor: '#tour-menu-plugsign',
  titulo: 'WaySign no menu',
  mensagem:
    'Documentos para aprovação e assinaturas ficam dentro do **WaySign**. Vamos abrir e ver cada parte.',
  lado: 'right',
}

const ROTEIROS: Record<string, PassoRoteiro[]> = {
  'doc-fluxo': [
    MENU_WAYSIGN,
    {
      seletor: '#tour-plugsign-documentos',
      rota: '/docusign',
      titulo: 'Aba Documentos',
      mensagem:
        'É a tela do dia a dia: aqui fica tudo o que ainda está pendente. É daqui que você cria o documento e acompanha o andamento.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-plugsign-solicitacao',
      rota: '/docusign',
      titulo: 'Botão Novo',
      mensagem: 'Para criar o documento, clique em **Novo**. Vou abrir para você ver as opções.',
      lado: 'left',
    },
    {
      seletor: '#tour-plugsign-novo-interno',
      rota: '/docusign',
      titulo: 'Aprovação interna (em níveis)',
      mensagem:
        'Escolha esta opção: o documento passa pelos aprovadores do PaperSign, em ordem, assinando aqui dentro. Em seguida abro o formulário.',
      lado: 'left',
      acao: 'abrirNovoWaySign',
    },
    {
      seletor: '#tour-doc-anexos',
      rota: '/docusign',
      titulo: '1. Anexos',
      mensagem:
        'Escolha o PDF, escreva a **descrição do anexo** e marque **Documento principal** no arquivo que será assinado. Clique em **Anexar documento**; repita para cada arquivo.',
      lado: 'left',
      acao: 'abrirFormDocumento',
    },
    {
      seletor: '#tour-doc-descricao',
      rota: '/docusign',
      titulo: '2. Descrição',
      mensagem: 'O nome do documento, que os aprovadores veem na lista e nas pendências (até 100 caracteres).',
      lado: 'left',
      acao: 'abrirFormDocumento',
    },
    {
      seletor: '#tour-doc-aprovadores',
      rota: '/docusign',
      titulo: '3. Aprovadores',
      mensagem:
        'Clique em **+ Adicionar aprovador**, escolha o usuário e a **ordem**. A ordem 1 aprova primeiro; a próxima só recebe depois. Quem tem a mesma ordem forma um nível: todos precisam aprovar para seguir.',
      lado: 'left',
      acao: 'abrirFormDocumento',
    },
    {
      seletor: '#tour-doc-salvar',
      rota: '/docusign',
      titulo: '4. Salvar',
      mensagem:
        'Confira tudo e clique em **Salvar**. O documento entra no fluxo e o primeiro nível passa a ver nas **Pendências**.',
      lado: 'top',
      acao: 'abrirFormDocumento',
    },
    {
      seletor: '#tour-plugsign-lista',
      rota: '/docusign',
      titulo: 'Acompanhar na lista',
      mensagem:
        'O documento aparece aqui como **Pendente**. Na linha: **Aprovações** mostra quem aprova e em que nível; **Documento**, **Imprimir** e **Anexos** abrem os arquivos; **Aprovar** e **Reprovar** aparecem quando é a sua vez.',
      lado: 'top',
    },
    {
      seletor: '#tour-plugsign-meus',
      rota: '/docusign',
      titulo: 'Aba Meus documentos',
      mensagem:
        'Quando o fluxo termina (concluído, recusado ou cancelado), o documento sai de Documentos e fica aqui, sem limite de data.',
      lado: 'bottom',
    },
  ],
  'waysign-assinatura': [
    MENU_WAYSIGN,
    {
      seletor: '#tour-plugsign-solicitacao',
      rota: '/docusign',
      titulo: 'Botão Novo',
      mensagem: 'O documento externo também começa no botão **Novo**. Vou abrir para você ver as opções.',
      lado: 'left',
      so: podeWaySignPlugSign,
    },
    {
      seletor: '#tour-plugsign-novo-externo',
      rota: '/docusign',
      titulo: 'Enviar para assinatura (PlugSign)',
      mensagem:
        'Escolha esta opção para quem é **de fora da empresa**: fornecedores, parceiros e quem assina pelo link do e-mail. Em seguida abro o formulário.',
      lado: 'left',
      acao: 'abrirNovoWaySign',
      so: podeWaySignPlugSign,
    },
    {
      seletor: '#tour-plugsign-solicitacao-docs',
      rota: '/docusign',
      titulo: '1. O documento',
      mensagem:
        'Dê um nome (opcional) e anexe um ou mais PDFs. Com vários PDFs, a PlugSign manda um e-mail só e a pessoa assina todos de uma vez.',
      lado: 'bottom',
      so: podeWaySignPlugSign,
    },
    {
      seletor: '#tour-plugsign-solicitacao-dest',
      rota: '/docusign',
      titulo: '2. Destinatários',
      mensagem:
        'Quem vai assinar, na ordem 1, 2, 3... Digite o nome para buscar. Para cada pessoa, escolha como assina e, se quiser, marque no PDF onde vai a assinatura. Se a pessoa não aparecer, cadastre em **Clientes e parceiros**.',
      lado: 'top',
      so: podeWaySignPlugSign,
    },
    {
      seletor: '#tour-plugsign-solicitacao-opcoes',
      rota: '/docusign',
      titulo: '3. Opções do envio',
      mensagem:
        'Regras extras: exigir certificado digital, observadores (recebem cópia), validade, autenticação em dois fatores e pedir CPF, data de nascimento ou selfie.',
      lado: 'top',
      so: podeWaySignPlugSign,
    },
    {
      seletor: '#tour-plugsign-solicitacao-enviar',
      rota: '/docusign',
      titulo: '4. Enviar solicitação',
      mensagem:
        'Confira e clique aqui. A PlugSign manda o e-mail aos destinatários; quando todos assinam, o PDF assinado volta para o PaperSign.',
      lado: 'left',
      so: podeWaySignPlugSign,
    },
    {
      seletor: '#tour-plugsign-lista',
      rota: '/docusign',
      titulo: 'Na lista de documentos',
      mensagem:
        'O documento enviado aparece com origem **Externos (WaySign)**. Na linha: **Assinar**, **Detalhes** (signatários e histórico), **Lembrete** (reenvia o e-mail a quem falta assinar) e, depois de assinado, **Documento**, **Baixar** e **Imprimir**.',
      lado: 'top',
      so: podeWaySignPlugSign,
    },
    {
      seletor: '#tour-plugsign-minhas',
      rota: '/docusign',
      titulo: 'Aba Solicitações',
      mensagem: 'Acompanhe o andamento aqui: **Enviadas**, **Recebidas** e **Histórico**, com Detalhes e Lembrete.',
      lado: 'bottom',
      so: podeWaySignPlugSign,
    },
  ],
  'doc-externo': [
    {
      seletor: '[data-menu-url="/documentos-externos"]',
      titulo: 'Documentos Externos no menu',
      mensagem:
        'Documento externo é o que uma pessoa **de fora da empresa** assina e aprova primeiro; depois seguem os aprovadores internos. Vamos abrir e criar um.',
      lado: 'right',
    },
    {
      seletor: '#tour-docext-topo',
      rota: '/documentos-externos',
      titulo: 'Documentos Externos',
      mensagem:
        'Use **Data de/até**, **Status** e a busca para achar um documento. No status, **EXT.** é a etapa do externo e **INT.** é a etapa dos aprovadores internos.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-docext-novo',
      rota: '/documentos-externos',
      titulo: 'Botão Novo',
      mensagem: 'Clique em **Novo** para criar o documento. Vou abrir o formulário e mostrar cada parte.',
      lado: 'left',
    },
    {
      seletor: '#tour-docext-arquivo',
      rota: '/documentos-externos',
      titulo: '1. Arquivo (PDF)',
      mensagem: 'Escolha o PDF que o externo vai assinar.',
      lado: 'left',
      acao: 'abrirFormDocExterno',
    },
    {
      seletor: '#tour-docext-assunto',
      rota: '/documentos-externos',
      titulo: '2. Assunto',
      mensagem: 'O nome do documento, que aparece na lista e nas pendências.',
      lado: 'left',
      acao: 'abrirFormDocExterno',
    },
    {
      seletor: '#tour-docext-externo',
      rota: '/documentos-externos',
      titulo: '3. Externo',
      mensagem:
        'Escolha a pessoa de fora da empresa que vai assinar e aprovar primeiro. Se ela não aparecer, precisa ser cadastrada em **Configurações → Cadastro de externos**.',
      lado: 'left',
      acao: 'abrirFormDocExterno',
    },
    {
      seletor: '#tour-docext-aprovadores',
      rota: '/documentos-externos',
      titulo: '4. Aprovadores internos',
      mensagem:
        'Clique em **+ Adicionar aprovador**, escolha o usuário e o **nível**. Só depois que o externo assina e aprova, o nível 1 assina e aprova; em seguida o nível 2, e assim por diante.',
      lado: 'left',
      acao: 'abrirFormDocExterno',
    },
    {
      seletor: '#tour-docext-salvar',
      rota: '/documentos-externos',
      titulo: '5. Salvar',
      mensagem:
        'Clique em **Salvar**. O documento fica como **EXT. Aguardando aprovação** até o externo assinar e aprovar.',
      lado: 'top',
      acao: 'abrirFormDocExterno',
    },
    {
      seletor: '#tour-docext-lista',
      rota: '/documentos-externos',
      titulo: 'Acompanhar',
      mensagem:
        'Acompanhe aqui a situação de cada documento. Quando chega a sua vez, aparecem as ações para assinar e aprovar ou reprovar.',
      lado: 'top',
    },
  ],
  'rdv-criar': [
    {
      seletor: '[data-menu-url="/rdv"]',
      titulo: 'RDV no menu',
      mensagem: 'O reembolso de despesas de viagem fica aqui. Vamos abrir e criar um RDV, parte por parte.',
      lado: 'right',
    },
    {
      seletor: '#tour-rdv-lista',
      rota: '/rdv',
      titulo: 'Últimas requisições',
      mensagem:
        'Seus RDVs já lançados aparecem aqui, com a situação de cada um. Use as datas e o filtro **Situação** e clique em **Buscar**. Para criar um novo, é só preencher o formulário logo abaixo.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-rdv-fornecedor',
      rota: '/rdv',
      titulo: '1. Fornecedor',
      mensagem:
        'Escolha o fornecedor do RDV (normalmente o seu cadastro). O usuário ligado a ele entra automaticamente como primeiro aprovador.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-rdv-dados',
      rota: '/rdv',
      titulo: '2. Dados da viagem',
      mensagem:
        'Preencha **Descrição**, **Período de**, **Período até**, **Origem** e **Destino**. Todos são obrigatórios e o período final não pode ser antes do inicial.',
      lado: 'top',
    },
    {
      seletor: '#tour-rdv-anexos',
      rota: '/rdv',
      titulo: '3. Comprovantes',
      mensagem:
        'Escolha o arquivo do comprovante, escreva a descrição e clique em **Anexar documento**. Repita para cada comprovante.',
      lado: 'top',
    },
    {
      seletor: '#tour-rdv-itens',
      rota: '/rdv',
      titulo: '4. Itens da despesa',
      mensagem:
        'Para cada despesa, informe **Centro de Custo**, **Conta Financeira**, **Produto**, descrição, quantidade e valor, e clique em **Adicionar Item**. Os itens adicionados aparecem logo abaixo.',
      lado: 'top',
    },
    {
      seletor: '#tour-rdv-aprovadores',
      rota: '/rdv',
      titulo: '5. Aprovadores',
      mensagem: 'Selecione o usuário e clique em **Adicionar Aprovador** para cada pessoa que precisa aprovar.',
      lado: 'top',
    },
    {
      seletor: '#tour-rdv-enviar',
      rota: '/rdv',
      titulo: '6. Enviar',
      mensagem:
        'Confira tudo e clique aqui para enviar o RDV para aprovação. Depois acompanhe a situação na lista do topo.',
      lado: 'top',
    },
  ],
  'geral-pendencias': [
    {
      seletor: '#tour-menu-pendencias',
      titulo: 'Pendências no menu',
      mensagem: 'Tudo o que aguarda sua aprovação ou assinatura, em todas as WAY, fica aqui.',
      lado: 'right',
    },
    {
      seletor: '#tour-pendencias-titulo',
      rota: '/pendencias',
      titulo: 'Caixa de Pendências',
      mensagem:
        'Aqui você vê o total consolidado: movimentos, documentos, RDV, fiscal, projetos e WaySign juntos, sem trocar de base.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-pendencias-filtros',
      rota: '/pendencias',
      titulo: 'Filtro por base',
      mensagem: 'Clique em uma base (153, 262, CSC…) para ver só as pendências daquela unidade.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-pendencias-busca',
      rota: '/pendencias',
      titulo: 'Busca e tipo',
      mensagem: 'Busque por título ou referência. Os chips por tipo (Movimento, Documento, RDV…) refinam a lista.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-pendencias-lista',
      rota: '/pendencias',
      titulo: 'Aprovar no modal',
      mensagem:
        'Clique em qualquer linha para abrir o modal: veja o PDF e assine, aprove ou recuse ali mesmo. O PaperSign usa a unidade da pendência automaticamente.',
      lado: 'top',
    },
  ],
  'geral-suporte-glpi': [
    {
      seletor: '#tour-suporte',
      titulo: 'Suporte (GLPI)',
      mensagem:
        'Clique neste ícone para abrir um chamado no GLPI. Descreva o problema, a tela e o horário; a equipe de TI retorna pelo chamado.',
      lado: 'bottom',
    },
  ],
  'ci-pagamento': [
    {
      seletor: '#tour-menu-pagamentos-ci',
      titulo: 'Pagamentos CI no menu',
      mensagem: 'As C.I. de pagamento ficam aqui. Você vê as que criou e as que estão na sua vez de aprovar.',
      lado: 'right',
    },
    {
      seletor: '#tour-ci-titulo',
      rota: '/comunicados',
      titulo: 'Tela Pagamentos CI',
      mensagem: 'Aqui você consulta, filtra e acompanha as C.I., e vê se o financeiro já foi gerado no RM.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-ci-novo',
      rota: '/comunicados',
      titulo: 'Criar uma C.I.',
      mensagem: 'Clique em **Novo**. Vou abrir o formulário e mostrar cada parte.',
      lado: 'left',
    },
    {
      seletor: '#tour-ci-corpo',
      rota: '/comunicados',
      titulo: '1. Corpo do documento',
      mensagem: 'Digite o texto da C.I. Esse conteúdo vira o PDF e também vai para o histórico do financeiro no RM.',
      lado: 'left',
    },
    {
      seletor: '#tour-ci-aprovadores',
      rota: '/comunicados',
      titulo: '2. Aprovadores',
      mensagem:
        'A C.I. vai para o Gerente ADM Financeiro e o Diretor da Unidade; conforme o valor, segue também para o Diretor Holding e/ou o Diretor Presidente.',
      lado: 'left',
    },
    {
      seletor: '#tour-ci-itens',
      rota: '/comunicados',
      titulo: '3. Rateio e valores',
      mensagem: 'Informe centro de custo, contas e valores. Esses dados são usados no financeiro do RM.',
      lado: 'left',
    },
    {
      seletor: '#tour-ci-financeiro-rm',
      rota: '/comunicados',
      titulo: '4. Dados do financeiro (RM)',
      mensagem:
        'Preencha fornecedor, tipo de documento, datas e número. Ao final das aprovações, o PaperSign cria o lançamento no RM.',
      lado: 'left',
      so: podeFinanceiroRm,
    },
    {
      seletor: '#tour-ci-anexos',
      rota: '/comunicados',
      titulo: 'Anexos',
      mensagem: 'Opcional: anexe PDFs de apoio, como nota ou comprovante.',
      lado: 'left',
    },
    {
      seletor: '#tour-ci-salvar',
      rota: '/comunicados',
      titulo: 'Salvar',
      mensagem: 'Clique em **Salvar** para enviar a C.I. Depois acompanhe as aprovações na lista.',
      lado: 'top',
    },
  ],
  'alcadas-comparar': [
    {
      seletor: '#tour-menu-alcadas',
      titulo: 'Alçadas no menu',
      mensagem: 'Gestão de aprovadores por centro de custo. Fica em **Configurações → Alçadas**.',
      lado: 'right',
    },
    {
      seletor: '#tour-alcadas-abas',
      rota: '/alcadas',
      titulo: 'Abas de Alçadas',
      mensagem:
        '**Centros de custo** e **Por usuário** são o dia a dia; a aba **Comparação** confronta um aprovador âncora com outros logins nos CCs.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-alcadas-comparacao',
      rota: '/alcadas',
      titulo: 'Comparação',
      mensagem:
        'Escolha o aprovador âncora e os logins, marque os CCs e exporte a planilha. A consulta usa sempre a unidade em que você está logado.',
      lado: 'top',
    },
  ],
  'cc-comparar': [
    {
      seletor: '#tour-menu-centros-custos',
      titulo: 'Centros de custo no menu',
      mensagem: 'Vínculos de usuário × CC, comparação e cadastro. Fica em **Configurações → Centros de custos**.',
      lado: 'right',
    },
    {
      seletor: '#tour-cc-abas',
      rota: '/centros-custos',
      titulo: 'Abas de Centros de custo',
      mensagem:
        '**Vínculos** e **Cadastro** mantêm o cadastro; **Comparação usuários** e **Contas por CC** ajudam a conferir vínculos.',
      lado: 'bottom',
    },
    {
      seletor: '#tour-cc-comparacao',
      rota: '/centros-custos',
      titulo: 'Comparação usuários',
      mensagem:
        'Marque CCs na grade e use **Incluir** ou **Remover em lote** para alinhar colaboradores. Na exportação, nomes e chapas vão para a planilha.',
      lado: 'top',
    },
  ],
}

/** "Me mostre esta tela" nessas telas usa o roteiro detalhado em vez do guia genérico. */
const ROTEIRO_DA_TELA: Record<string, string> = {
  '/docusign': 'doc-fluxo',
  '/documentos-externos': 'doc-externo',
  '/rdv': 'rdv-criar',
  '/pendencias': 'geral-pendencias',
  '/comunicados': 'ci-pagamento',
  '/alcadas': 'alcadas-comparar',
  '/centros-custos': 'cc-comparar',
}

/** Dúvidas fixas do chat → roteiro. */
const ROTEIRO_DA_PERGUNTA: Record<string, string> = {
  'pergunta:doc-interno': 'doc-fluxo',
  'pergunta:doc-externo': 'waysign-assinatura',
}

/** Roteiro passo a passo da pergunta (pelo slug) ou da tela; null se não houver. */
export function roteiroDoArtigo(
  slug: string,
  rota: string | null | undefined,
  u: Record<string, unknown> | null
): PassoRoteiro[] | null {
  const passos =
    ROTEIROS[slug] ??
    ROTEIROS[ROTEIRO_DA_PERGUNTA[slug] ?? ''] ??
    ROTEIROS[ROTEIRO_DA_TELA[normalizarRota(rota)] ?? '']
  if (!passos) return null
  const liberados = passos.filter((p) => !p.so || (u != null && p.so(u)))
  return liberados.length > 1 || passos.length === 1 ? liberados : null
}

/** Dúvidas que aparecem sempre no chat (sem depender do banco), se o usuário vê a tela. */
const PERGUNTAS_FIXAS: (Pick<RaphaelaAjudaArtigo, 'slug' | 'titulo' | 'resumo' | 'palavrasChave' | 'rota'> & {
  so?: (u: Record<string, unknown>) => boolean
})[] = [
  {
    slug: 'pergunta:doc-interno',
    titulo: 'Como criar um documento interno?',
    resumo:
      'Documento interno: aprovação em níveis pelos aprovadores do PaperSign, feita no WaySign (Novo → Aprovação interna).',
    palavrasChave: 'documento interno internos aprovação interna níveis waysign criar enviar novo',
    rota: '/docusign',
  },
  {
    slug: 'pergunta:doc-externo',
    titulo: 'Como criar um documento externo?',
    resumo:
      'Documento externo: enviado pelo WaySign (Novo → Enviar para assinatura) para fornecedores, parceiros e quem assina pelo link do e-mail, pela PlugSign.',
    palavrasChave:
      'documento externo externos fora da empresa fornecedor parceiro assinatura plugsign waysign link e-mail criar enviar novo',
    rota: '/docusign',
    so: podeWaySignPlugSign,
  },
]

export function perguntasFixasDoUsuario(
  guias: GuiaUsuario[],
  u: Record<string, unknown> | null
): RaphaelaAjudaArtigo[] {
  return PERGUNTAS_FIXAS.filter(
    (p) => guias.some((g) => g.url === p.rota) && (!p.so || (u != null && p.so(u)))
  ).map((p, i) => ({
    slug: p.slug,
    titulo: p.titulo,
    resumo: p.resumo,
    palavrasChave: p.palavrasChave,
    rota: p.rota,
    id: -(900 + i),
    mensagem: p.resumo ?? '',
    rotaAjuda: null,
    videoUrl: null,
    permissao: null,
    ordem: 900 + i,
    destaque: true,
  }))
}

/** Guia no formato de artigo, para entrar na busca do chat junto com os artigos do banco. */
export function guiaComoArtigo(g: GuiaUsuario, indice: number): RaphaelaAjudaArtigo {
  return {
    id: -(indice + 1),
    slug: `guia:${g.url}`,
    titulo: g.perguntas[0] ?? `Como usar ${g.titulo}?`,
    resumo: g.resumo,
    mensagem: `${g.resumo}\nToque em **Me mostre na tela** que eu te guio passo a passo.`,
    palavrasChave: `${g.titulo} ${g.palavrasChave} ${g.perguntas.join(' ')}`,
    rota: g.url,
    rotaAjuda: null,
    videoUrl: null,
    permissao: null,
    ordem: 1000 + indice,
    destaque: false,
  }
}
