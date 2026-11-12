# Frotas: manutenção com notas, lotação e comparativos

Este arquivo explica o que já foi feito e o que falta terminar. Leia antes de mexer no código.

## Objetivo

A GMUD do Frotas foi aprovada. Esta fase troca a planilha "CONTROLE DE NFS E PEDIDOS" por telas dentro da aba Manutenção do Frotas, com comparativos por tipo de serviço, por fornecedor e por região, juntando as unidades WAY 262 e WAY 153.

## Regras de negócio (definidas pela Rapha, não mudar)

1. **O fornecedor sempre vem do cadastro do RM (FCFO).** Grave o nome exatamente como está no RM, mesmo que tenha erro de digitação. Use NOMEFANTASIA e, se estiver vazio, NOME, mais o CNPJ (CGCCFO) e o CODCFO. É assim que o SeletorFornecedorRm do Frotas já funciona.
   - Na importação da planilha, o nome digitado só serve para achar o fornecedor no RM. Quando não houver correspondência, a nota fica PENDENTE, sem fornecedor, e o nome da planilha vai para OBSERVACAO.
2. **A região é a unidade mais a lotação da placa.**
   - Na 262, a região é "SAU n".
   - Na 153, a região é "BSO n".
   - Sede, ANTT, engenharia, operação e coordenação ficam em "Sede e apoio".
   - A lotação tem vigência (início e fim). Cada lançamento guarda a região da época em que foi feito.
3. **Despesas ficam fora do comparativo de manutenção** (abastecimento, locação, telemetria, documentação, pedágio). Elas aparecem só quando o filtro "Grupo" estiver em Despesa ou Tudo.
4. Quem está na unidade WAY CSC vê as duas unidades juntas. As outras unidades veem só a própria.

## Padrões do projeto

- **API:** ASP.NET Core, SQL escrito à mão com SqlCommand, sem ORM. O controller é a classe parcial `FrotasController`.
- **Bancos:**
  - As tabelas do Frotas ficam no **SistAprovacao**. Nunca crie tabelas nos bancos Corpore_*.
  - O RM de cada unidade é acessado com `TentarConexaoRm(unidade, out conn, out erro)`.
- **Exclusão:** é sempre lógica, com os campos EXCLUIDO, USUARIO_EXCLUSAO, DATA_EXCLUSAO e MOTIVO_EXCLUSAO.
- **Histórico:** registre com `HistoricoSemFalharAsync`. Em FROTAS_HISTORICO, TIPO_ACAO é VARCHAR(20).
- **Scripts SQL:**
  - Todo script começa com a trava `IF DB_NAME() <> 'SistAprovacao' ... SET NOEXEC ON`.
  - Todo script pode rodar mais de uma vez sem erro.
  - Os scripts de importação usam `@APLICAR = 0` para simular, com ROLLBACK no final.
- **Front:**
  - Next.js 15 e React 19, com componentes shadcn (Tabs, Select, Dialog, DataTable e outros) e toasts do sonner.
  - Os PDFs são gerados com BotaoPdf e RelatorioFrotaPdf, de `../comum`.
- **Arquivos:** UTF-8 sem BOM, com quebra de linha **CRLF**. Mantenha CRLF ao editar.

## O que foi feito

### Scripts (papersing-master/docs/frotas), rodar nesta ordem no SistAprovacao

1. `CREATE_FROTAS_NOTAS.sql`: cria a tabela FROTAS_NOTAS (NF, tipo PRODUTO ou SERVICO, pedido, datas, valor, fornecedor do RM, status, origem TELA ou PLANILHA, anexo).
2. `CREATE_FROTAS_VEICULO_LOTACAO.sql`: cria a lotação da placa com vigência. Cada placa só pode ter uma lotação aberta, com FIM_VIGENCIA nulo.
3. `ALTER_FROTAS_MANUTENCOES_NOTA_REGIAO.sql`: acrescenta ID_NOTA, FORNECEDOR_CODCFO, CODCCUSTO, DESC_CCUSTO e REGIAO em FROTAS_MANUTENCOES, com a FK e os índices.
4. `IMPORTAR_FROTAS_LOTACAO_PLANILHA.sql`: carrega a lotação de 181 placas a partir da planilha. Rode primeiro com `@APLICAR = 0` e só depois com `1`.

Os arquivos `planilha/importar-notas-WAY-262.json` (1.848 notas) e `importar-notas-WAY-153.json` (1.343 notas) são importados pela tela, não por SQL.

### API (papersing-master/papersing/Controllers)

`FrotasController.Notas.cs` é um arquivo novo com estes endpoints:

| Endpoint | O que faz |
|---|---|
| `GET notas?unidade&de&ate` | Lista as notas com os itens (os lançamentos em FROTAS_MANUTENCOES). |
| `POST notas` e `PUT notas/{id}` | Recebem multipart, com os itens num JSON no campo `itens` e o anexo opcional. O fornecedor é buscado pelo CODCFO no RM. A soma dos itens tem que bater com o valor da nota. NF repetida para o mesmo fornecedor e tipo devolve 409. Grava em transação e tira a região de cada item da lotação vigente ("Sem lotação" se a placa não tiver). |
| `PUT notas/{id}/status` | Muda o status. PENDENTE e CANCELADA exigem motivo. Uma nota sem fornecedor não sai de PENDENTE. |
| `DELETE notas/{id}` e `GET notas/{id}/arquivo` | Exclusão lógica da nota e dos itens; download do anexo. |
| `POST notas/importar` | Recebe `{unidade, aplicar, notas, depara}`. Casa os fornecedores com o FCFO (resultados EXATO, PROVAVEL, AMBIGUO ou NAO_ENCONTRADO) e confere as placas no RM. Pula as linhas já importadas (pelo campo ORIGEM_LINHA). Com `aplicar=false`, só simula. |
| `GET lotacoes?unidade` e `PUT lotacoes` | Lista a lotação. O PUT encerra a lotação atual e abre uma nova. |
| `GET manutencoes/comparativo?unidades=..&de&ate` | Devolve os itens e a quantidade de placas por região. Não inclui notas canceladas nem excluídas. |

`FrotasController.ManutencaoMultas.cs` também foi alterado:
- Novas classificações de manutenção e de despesa, com o conjunto `ClassificacoesDespesa`.
- A listagem devolve id_nota, numero_nf e regiao.
- Um item que pertence a uma nota só pode ser editado ou excluído pela nota.

A API foi compilada num projeto de teste (net8) e compilou sem erro e sem aviso.

### Front (papersingfront-master/src)

- `services/frotasService.ts`: tipos e funções de notas, importação, lotação e comparativo. As classificações agora têm grupo (MANUTENCAO ou DESPESA).
- `app/(privado)/frotas/ManutencaoPage.tsx`: virou um contêiner com as sub-abas Notas, Lançamentos, Comparativos e Lotação. A tela antiga agora é `LancamentosManutencao`.
- `app/(privado)/frotas/manutencao/`:
  - `NotasManutencao.tsx`: indicadores, tabela com troca de status, formulário da nota com itens e rateio, e importação da planilha com o de-para de fornecedores.
  - `ComparativosManutencao.tsx`: três visões (por serviço, por fornecedor e por região ou centro de custo), com custo por veículo e por mês e PDF de cada visão.
  - `LotacaoPlacas.tsx`: placas do RM com a lotação de cada uma, filtro "sem lotação" e janela para definir a lotação.
  - `comumManutencao.tsx`: funções compartilhadas e o SeletorFornecedorRm.
- `DashboardPage.tsx`: tira as despesas da conta de manutenção.

O TypeScript passou sem erro nos arquivos do Frotas. A checagem usou só parte do projeto, então rode `npm run build` completo.

## O que falta terminar

1. **Compilar o projeto real:** rode `dotnet build` na API e `npm run build` (ou `npx tsc --noEmit`) no front. Corrija o que aparecer.
2. **Rodar os 4 scripts** num SistAprovacao de teste, na ordem acima. Rode o de lotação simulando primeiro.
3. **Testar a importação das notas:**
   - Abra Notas > Importar planilha e escolha o JSON da 262. Simule primeiro e confira o de-para de fornecedores.
   - Depois aplique e repita o processo com a 153.
   - Confira na simulação: quantas notas ficaram PENDENTE por falta de fornecedor, e quantas placas não foram achadas no RM.
4. **Testar o fluxo na tela:**
   - Crie uma nota com 2 itens e use o rateio.
   - Mude o status para pendente e confira que o motivo é exigido.
   - Exclua a nota e confira que os itens somem de Lançamentos.
   - Mude a lotação de uma placa e confira que um lançamento antigo mantém a região antiga.
5. **Conferir o comparativo com a planilha:** compare um mês da 262 com a soma da planilha original.
6. **Ajustes visuais:** revise a largura das colunas, a tela de celular e o modo escuro nas 4 sub-abas.
7. **Permissões:** confirme que só a WAY CSC consegue ver as duas unidades no comparativo, e que a chave de implantação `FROTAS_SO_ADMIN` continua valendo.
8. Commit e deploy ficam com a Rapha. O deploy é feito com APLICAR-NO-SERVIDOR-IIS.ps1.

## Pontos de atenção

- Os fornecedores da planilha têm 351 grafias diferentes. Os casos AMBIGUO e PROVAVEL precisam de revisão na tela antes de aplicar a importação.
- Só 885 das 3.254 linhas da planilha têm classificação, placa e valor juntos. As outras viram nota sem itens e aparecem no indicador "Sem itens".
- `POST notas/importar` carrega o FCFO inteiro e as placas do RM a cada chamada. Isso basta para importar uma vez, mas não use esse endpoint em rotina.
- Um lançamento avulso, sem nota, continua possível em Lançamentos e também recebe a região pela lotação.
