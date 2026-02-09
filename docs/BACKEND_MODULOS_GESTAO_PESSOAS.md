# Backend – Módulos Gestão de Pessoas (3 módulos)

Este documento descreve o que o **frontend** já implementou e o que o **backend** precisa expor para os três novos módulos do PaperSign.

---

## Requisito: todas as unidades

**Os três módulos devem funcionar para TODAS as unidades.**

- No frontend o usuário já possui `unidade` no login (ex.: WAY 112, WAY 153, WAY 262, WAY 306, WAY 364). O backend deve:
  - **Listagens (contratos, pagamentos):** retornar dados considerando **todas as unidades** (ou filtrar por unidade do usuário, conforme regra de negócio). Se o usuário só enxerga a própria unidade, filtrar por `unidade`; se enxerga todas, agregar/consultar todas.
  - **Aprovadores:** "GAF **da Unidade**", "Diretor **da Unidade**" são cargos por unidade. A lista de aprovadores (Gestão Pessoas e PG Impostos) deve ser **por unidade** ou permitir identificar a unidade em cada registro, para que a hierarquia seja aplicada corretamente em cada unidade.
  - **UPDATE pós-aprovação (FLAN.CAMPOALFAOP3):** aplicar na base/tabela **da unidade do lançamento** (ex.: Corpore_way262, Corpore_way112, etc.), e não apenas em uma base fixa. O backend deve identificar a unidade do item aprovado e executar o UPDATE na tabela correspondente àquela unidade.

Resumo: contratos, pagamentos e aprovadores precisam estar escopados ou identificados por unidade, e o UPDATE em FLAN deve ser feito na unidade correta.

---

## Visão geral

| Módulo | Rota frontend | Descrição |
|--------|----------------|-----------|
| **Contratos Gestão de Pessoas** | `/gestao-pessoas` | Contratos com `STATUS_RESTRICAO = 'RESTRITO'` (gestão de pessoas / GAFs). |
| **Pagamentos G. Pessoas** | `/pagamentos-gestao-pessoas` | Pagamentos de folha (EM ABERTO, tipo PAGAMENTO_RH). |
| **Pagamentos Impostos** | `/pagamentos-impostos` | Pagamentos de impostos (EM ABERTO, tipo Impostos – IRF, ISS, PIS, COFINS). |

**Base URL da API:** em desenvolvimento o front usa `http://localhost:5170` (ver `src/utils/constants.ts`).  
**Autenticação:** header `Authorization: Bearer <token>` (mesmo padrão do restante do app).

---

## 1. Contratos Gestão de Pessoas

- **GET** `/api/ContratosGestaoPessoas`  
  Retorna lista de contratos **para todas as unidades** (ou filtrada pela unidade do usuário, conforme regra). A view/tabela deve ter a coluna **STATUS_RESTRICAO**:
  - `NULL` = fluxo normal  
  - `'RESTRITO'` = contrato entra neste módulo  

  Campos esperados no JSON: `id`, `sao`, `valor_total`, `codigo_fornecedor`, `nome_fornecedor`, `status_restricao`, `status_movim`.

- **Aprovadores** (mesma lista usada em Contratos e em Pagamentos G. Pessoas). **Por unidade:** GAF da Unidade e Diretor da Unidade são por unidade; a lista deve ser por unidade ou conter identificador de unidade.
  - **GET** `/api/AprovadoresGestaoPessoas` → lista (considerar unidade do usuário ou todas as unidades)
  - **POST** `/api/AprovadoresGestaoPessoas` → body: `{ usuario, cargo, valor_inicial, valor_final, nivel }` (+ unidade se aplicável)
  - **PUT** `/api/AprovadoresGestaoPessoas/:id` → body: objeto completo
  - **DELETE** `/api/AprovadoresGestaoPessoas/:id`

  Hierarquia de aprovação: 1º GAF, 2º Fabrício, 3º Diretor Unidade, 4º Gomes, 5º Lopes (conforme alçadas por valor). Aplicar **por unidade** onde fizer sentido.

---

## 2. Pagamentos G. Pessoas

- **GET** `/api/PagamentosGestaoPessoas`  
  Lista de lançamentos de pagamento de **folha** (salários, férias, 13º, rescisões, FGTS, INSS, IRRF folha, etc) **de todas as unidades** (ou da unidade do usuário, conforme regra).  
  **Filtros obrigatórios no backend:**
  - `STATUS_LANCAMENTO` ou `WF_STATUS` = **EM ABERTO**
  - `TIPO_DOCUMENTO` = **PAGAMENTO_RH**

  Hierarquia: 1º Fabrício Leme, 2º GAF Unidade, 3º Diretor Unidade, 4º Gomes, 5º Lopes (por unidade onde aplicável).

- Aprovadores: usar os mesmos endpoints **AprovadoresGestaoPessoas** (acima).

**Pós-aprovação (backend):**  
Executar o UPDATE na **unidade do lançamento** (cada unidade pode ter sua base, ex.: Corpore_way112, Corpore_way262, etc.):  
`UPDATE Corpore_<unidade> SET FLAN.CAMPOALFAOP3 = 'F' WHERE IDLAN = (id da aprovação)`  
Legenda: **F** = Aprovado, **A** = Em andamento (após 1ª assinatura), **C** = Cancelado/Reprovado.

**Relatório:** gerar "Autorização de Pagamento Financeiro" para assinaturas (FINANCEIRO, CONTROLADORIA, DIRETORIA).

---

## 3. Pagamentos Impostos

- **GET** `/api/PagamentosImpostos`  
  Lista de pagamentos de **impostos** (contabilidade fiscal) **de todas as unidades** (ou da unidade do usuário).  
  **Filtros obrigatórios no backend:**
  - Status = **EM ABERTO**
  - `TIPO_DOCUMENTO` = tipo Impostos (ex.: IRF, ISS, PIS, COFINS)

  Fonte sugerida: view por unidade (ex.: **Vw_LAN_FINANCEIRO_262** e equivalente para cada unidade).  
  Hierarquia: 1º Gerson Martiusi, 2º GAF, 3º Diretor Unidade, 4º Gomes, 5º Lopes (por unidade onde aplicável).

- **Aprovadores PG Impostos** (lista **separada** da Gestão Pessoas):
  - **GET** `/api/AprovadoresPgImpostos`
  - **POST** `/api/AprovadoresPgImpostos` → body: `{ usuario, cargo, valor_inicial, valor_final, nivel }`
  - **PUT** `/api/AprovadoresPgImpostos/:id`
  - **DELETE** `/api/AprovadoresPgImpostos/:id`

**Pós-aprovação e relatório:** mesma regra do módulo Pagamentos G. Pessoas: UPDATE `FLAN.CAMPOALFAOP3` **na base da unidade do lançamento** e relatório de Autorização de Pagamento Financeiro.

---

## Onde está cada coisa no frontend

- **Menu:** `src/lib/data.ts` (itens) e `src/components/AppSidebar.tsx` (ícones).
- **Tipos:** `src/types/ContratoGestaoPessoas.ts`, `LancamentoPagamento.ts`, `AprovadorGestaoPessoas.ts`.
- **Chamadas à API:**  
  - `src/services/gestaoPessoasService.ts` (Contratos + Aprovadores Gestão Pessoas)  
  - `src/services/pagamentosService.ts` (Pagamentos G. Pessoas, Pagamentos Impostos, Aprovadores PG Impostos)
- **Telas:**  
  - `src/app/(privado)/gestao-pessoas/GestaoPessoasPage.tsx`  
  - `src/app/(privado)/pagamentos-gestao-pessoas/PagamentosGestaoPessoasPage.tsx`  
  - `src/app/(privado)/pagamentos-impostos/PagamentosImpostosPage.tsx`  

Em cada arquivo de **service** e **type** há comentários detalhados para o backend. Use esses comentários como especificação ao implementar os endpoints.
