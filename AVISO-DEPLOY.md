# Aviso de deploy

**Atualizado em 16/11/2026 (Raphaela liberada)**

## Raphaela assistente (chat de dúvidas)

- **Liberada em produção** (`RAPHAELA_FORA_DO_DEPLOY = false` em `src/lib/data.ts`).
- Front: `src/components/RaphaelaAjuda.tsx`, `src/lib/raphaela-*.ts`, montado em `src/components/ClientLayout.tsx`.
- API: `RaphaelaAjudaController` / `RaphaelaAjudaStore` (repositório papersing).
- No banco: rodar `docs/CREATE_TABLE_RAPHAELA_AJUDA.sql` e depois `docs/SEED_RAPHAELA_AJUDA_v1.sql` (com `@Aplicar = 1`) no SistAprovacao. Sem a tabela, o chat abre, mas a FAQ do SQL fica vazia.

## Frotas

- Continua fora do deploy: `FROTAS_FORA_DO_DEPLOY = true` em `src/lib/data.ts` (menu e rota `/frotas` ficam ocultos).
- Deploy do front: `prepare-publish.ps1 -SemFrotas` e `aplicar-front.ps1 -SemFrotas`.
- Não alterar essa chave sem liberação.
