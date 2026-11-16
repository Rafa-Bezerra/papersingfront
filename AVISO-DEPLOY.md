# Aviso de deploy

**Atualizado em 16/11/2026 (Raphaela + Frotas liberados)**

## Raphaela assistente (chat de dúvidas)

- **Liberada em produção** (`RAPHAELA_FORA_DO_DEPLOY = false` em `src/lib/data.ts`).
- Front: `src/components/RaphaelaAjuda.tsx`, `src/lib/raphaela-*.ts`, montado em `src/components/ClientLayout.tsx`.
- API: `RaphaelaAjudaController` / `RaphaelaAjudaStore` (repositório papersing).
- No banco: rodar `docs/CREATE_TABLE_RAPHAELA_AJUDA.sql` e depois `docs/SEED_RAPHAELA_AJUDA_v1.sql` (com `@Aplicar = 1`) no SistAprovacao.

## Frotas

- **Liberado em produção** (`FROTAS_FORA_DO_DEPLOY = false`, `FROTAS_SO_ADMIN = false`).
- Quem vê e usa: **Admin** ou usuário com permissão **Frotas** (`GUSUARIO.FROTAS = 1`). Financeiro não herda.
- Deploy do front: `prepare-publish.ps1` **sem** `-SemFrotas` e `aplicar-front.ps1` **sem** `-SemFrotas`.
- No SistAprovacao: `docs/ALTER_GUSUARIO_FROTAS.sql` (coluna de permissão) + scripts em `docs/frotas/` conforme as abas usadas.
