# Backend – Módulo Frotas: Cadastro de placas

O **frontend** já tem a tela `/frotas` (menu **Frotas**, tela **Cadastro de placas**). Ela grava os veículos direto no TOTVS RM, no lugar dos scripts SQL manuais (`cadastro_placas_262.sql` / `cadastro_placas_153.sql`). Este documento descreve o que o **backend** precisa expor.

**Autenticação:** header `Authorization: Bearer <token>` (mesmo padrão do restante do app).

---

## 1. Permissão `FROTAS`

- Nova coluna em `GUSUARIO`: `FROTAS bit NOT NULL DEFAULT 0` (em todas as bases onde existe `GUSUARIO`).
- Devolver `frotas` no login e no `GET /api/Usuarios/{id}` (o front aceita `frotas` ou `FROTAS`).
- Aceitar `FROTAS` / `frotas` no `POST /api/Usuarios/editar/{id}` (o front envia os dois).
- **Regra de acesso dos endpoints abaixo:** `ADMIN = 1` **ou** `FROTAS = 1`. Caso contrário, `403`.
  O Financeiro **não** herda esse módulo.

## 2. Unidade → banco RM

Todos os endpoints recebem `unidade` (ex.: `WAY 262`). O backend escolhe a conexão:

| Unidade  | Banco RM          |
|----------|-------------------|
| WAY 112  | `Corpore_Way112`  |
| WAY 153  | `Corpore_Way153`  |
| WAY 262  | `Corpore_Way262`  |
| WAY 306  | `Corpore`         |
| WAY 364  | `Corpore_Way364`  |
| WAY CSC  | `Corpore_Holding` |

Estrutura das tabelas de veículos (OF*, TFAB, view CARROS) conferida e idêntica nos 6 bancos (262, 153, 112, 306, 364 e Corpore_Holding).

- Usuário que **não** é admin e **não** é da WAY CSC só pode gravar na **própria** unidade: se `unidade` for diferente da unidade do token, responder `403`.
- Parâmetros fixos (os mesmos dos scripts já validados): `CODCOLIGADA = 1`, `IDTIPOOBJ = 1` (FROTA). `STATUS` e `ESTADOCONSERVACAO` copiados do valor mais comum entre os veículos do tipo na base (na 262/153: `STATUS = '1'`, `ESTADOCONSERVACAO = 'N'`); `CODFILIAL` idem, contando também a filial vazia (na 262 os cadastros recentes, inclusive os dos scripts, ficam sem filial).
  Antes de ligar uma base nova, conferir se ela tem `OFTIPOOBJCOLIGADA (1, 1)` e `OFSTATUSEQP` com o status usado.

---

## 3. Endpoints

### GET `/api/Frotas/modelos?unidade=WAY 262`

Modelos do tipo FROTA com os submodelos.

```sql
SELECT m.CODMODELO, m.MODELO, f.NOME AS FABRICANTE, s.CODSUBMODELO, s.DESCRICAO
FROM dbo.OFMODELO m
LEFT JOIN dbo.TFAB f        ON f.CODCOLIGADA = m.CODCOLFAB AND f.CODFAB = m.CODFAB
LEFT JOIN dbo.OFSUBMODELO s ON s.IDTIPOOBJ = m.IDTIPOOBJ AND s.CODMODELO = m.CODMODELO
WHERE m.IDTIPOOBJ = @IDTIPOOBJ
ORDER BY m.MODELO, s.DESCRICAO;
```

Resposta:

```json
[
  { "codmodelo": 12, "modelo": "FIAT/STRADA ENDURANCE", "fabricante": "FIAT",
    "submodelos": [ { "codsubmodelo": 1, "descricao": "STRADA ENDURANCE CS FLEX" } ] }
]
```

### GET `/api/Frotas/placas?unidade=WAY 262&busca=UCQ`

Veículos já cadastrados (`busca` opcional: placa, frota ou modelo, `LIKE '%…%'`). Limitar a ~500 linhas.

```sql
SELECT TOP 500 o.IDOBJOF, o.IDOBJOF2, o.CODMODELO, m.MODELO, o.CODSUBMODELO, s.DESCRICAO,
       o.ANOMODELO, o.ANOFABR, o.STATUS, o.RECCREATEDBY, o.RECCREATEDON
FROM dbo.OFOBJOFICINA o
JOIN dbo.OFMODELO m    ON m.IDTIPOOBJ = o.IDTIPOOBJ AND m.CODMODELO = o.CODMODELO
JOIN dbo.OFSUBMODELO s ON s.IDTIPOOBJ = o.IDTIPOOBJ AND s.CODMODELO = o.CODMODELO AND s.CODSUBMODELO = o.CODSUBMODELO
WHERE o.CODCOLIGADA = @CODCOLIGADA AND o.IDTIPOOBJ = @IDTIPOOBJ
  AND (@BUSCA IS NULL OR o.IDOBJOF LIKE '%' + @BUSCA + '%' OR o.IDOBJOF2 LIKE '%' + @BUSCA + '%' OR m.MODELO LIKE '%' + @BUSCA + '%')
ORDER BY o.RECCREATEDON DESC, o.IDOBJOF;
```

Resposta: `[{ "placa", "frota", "codmodelo", "modelo", "codsubmodelo", "submodelo", "anomodelo", "anofabr", "status", "criado_por", "criado_em" }]`.

### POST `/api/Frotas/placas`

Cadastra uma lista de placas com o mesmo modelo/submodelo.

```json
{
  "unidade": "WAY 262",
  "placas": [ { "placa": "UCQ3C99" }, { "placa": "UCQ3C87", "frota": "F012" } ],
  "codmodelo": 12,                       // OU "novo_modelo": { "marca": "FIAT", "modelo": "FIAT/STRADA ENDURANCE" }
  "codsubmodelo": 1,                     // OU "novo_submodelo": "STRADA ENDURANCE CS FLEX"
  "anomodelo": 2026,                     // opcional
  "anofabr": 2025                        // opcional
}
```

Validações no backend (o front já valida, mas repetir):

- Placa normalizada (maiúscula, sem hífen/espaço) e no padrão `^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$`.
- `novo_modelo.modelo` até 30 caracteres (`OFMODELO.MODELO`), `novo_submodelo` até 25 (`OFSUBMODELO.DESCRICAO`), `frota` até 60 (`IDOBJOF2`).
- `codmodelo`/`codsubmodelo` precisam existir com `IDTIPOOBJ = @IDTIPOOBJ`.

Tudo **numa transação** (`SET XACT_ABORT ON`), com a mesma lógica do script validado:

1. **Modelo novo:** se já existir `OFMODELO` com `UPPER(LTRIM(RTRIM(MODELO))) = @MODELO` no tipo, reaproveitar. Senão:
   - fabricante: procurar em `TFAB` (coligada = `CODCOLFAB` mais usado em `OFMODELO`) por nome `LIKE '%MARCA%'`; se não houver, criar `TFAB (CODCOLIGADA, CODFAB = marca até 15 caracteres, NOME = marca)`;
   - `CODMODELO = MAX(CODMODELO) + 1` (com `UPDLOCK, HOLDLOCK` para evitar código duplicado em gravações simultâneas);
   - `INSERT dbo.OFMODELO (CODMODELO, CODCOLFAB, CODFAB, MODELO, IDTIPOOBJ, RECCREATEDBY, RECCREATEDON)`.
2. **Submodelo novo:** reaproveitar pela descrição dentro do modelo; senão `CODSUBMODELO = MAX(CODSUBMODELO) + 1` do modelo e `INSERT dbo.OFSUBMODELO (IDTIPOOBJ, CODMODELO, CODSUBMODELO, DESCRICAO, RECCREATEDBY, RECCREATEDON)`.
3. **Veículos:** para cada placa que ainda **não** existe em `OFOBJOFICINA (CODCOLIGADA, IDOBJOF)`:

   ```sql
   INSERT INTO dbo.OFOBJOFICINA (
       CODCOLIGADA, IDOBJOF, IDOBJOF2, IDTIPOOBJ, CODMODELO, CODSUBMODELO, STATUS,
       ANOFABR, ANOMODELO, BLOCKED, BLOCKCHAPA, DATACRIACAO, ESTADOCONSERVACAO,
       CODFILIAL, FLAGTRANSFERIDO,
       USAINDICADORUSO1, USAINDICADORUSO2, USAINDICADORUSO3, USAINDICADORUSO4, USAINDICADORUSO5,
       RECCREATEDBY, RECCREATEDON)
   VALUES (@CODCOLIGADA, @PLACA,
       COALESCE(@FROTA, CASE WHEN @OBRIGAFROTA = 1 THEN @PLACA END),  -- OFTIPOOBJ.OBRIGAIDOBJOF2
       @IDTIPOOBJ, @CODMODELO, @CODSUBMODELO, @STATUS,
       @ANOFABR, @ANOMODELO, 0, '0000', GETDATE(), @ESTADO,
       @CODFILIAL, 0,
       @USA1, @USA2, @USA3, @USA4, @USA5,          -- OFTIPOOBJ.USAINDICADORUSO1..5
       @USUARIO, GETDATE());

   INSERT INTO dbo.OFOBJOFICINACOMPL (CODCOLIGADA, IDOBJOF, RECCREATEDBY, RECCREATEDON)
   SELECT @CODCOLIGADA, @PLACA, @USUARIO, GETDATE()
   WHERE NOT EXISTS (SELECT 1 FROM dbo.OFOBJOFICINACOMPL WHERE CODCOLIGADA = @CODCOLIGADA AND IDOBJOF = @PLACA);
   ```

   - `@USUARIO` = `CODUSUARIO` do usuário logado como está na `GUSUARIO` (até 50 caracteres), para auditoria (a lista mostra "Cadastrado por"). Vale também para `RECMODIFIEDBY` na alteração e na desativação.
   - Placa que já existe → `ja_existe` (não altera nada). Placa que existe só com hífen/espaço (`REPLACE(REPLACE(IDOBJOF,'-',''),' ','') = @PLACA`) também → `ja_existe`, com `mensagem` informando o formato encontrado.
   - Erro numa placa → `erro` com `mensagem`; as demais seguem (usar `SAVE TRANSACTION` por placa) ou abortar tudo, a critério do backend.

Resposta:

```json
{
  "unidade": "WAY 262",
  "codmodelo": 12, "codsubmodelo": 1,
  "modelo_criado": false, "submodelo_criado": false,
  "resultados": [
    { "placa": "UCQ3C99", "status": "criado" },
    { "placa": "UCQ3C87", "status": "ja_existe", "mensagem": "Já cadastrada em 28/10/2026 por SCRIPT_PLACAS_262" }
  ]
}
```

Erros gerais (`400`/`403`/`500`): corpo `{ "message": "..." }` (o front mostra `message`).
