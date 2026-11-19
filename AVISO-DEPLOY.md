# Aviso de deploy

**Atualizado em 19/11/2026 (Raphaela + tour desativados em produção)**

## Raphaela assistente e tour guiado

- **Desativados em produção** (`RAPHAELA_FORA_DO_DEPLOY = true` em `src/lib/data.ts`).
- No `npm run dev` continuam disponíveis para teste.
- Front: `RaphaelaAjuda` + `RafaelaTour` em `ClientLayout.tsx` (só montam se a flag permitir).
- API/banco do help (`RaphaelaAjuda*`) podem ficar; não aparecem na UI de produção.

## Frotas

- **Liberado em produção** (`FROTAS_FORA_DO_DEPLOY = false`, `FROTAS_SO_ADMIN = false`).
- Quem vê e usa: **Admin** ou usuário com permissão **Frotas** (`GUSUARIO.FROTAS = 1`). Financeiro não herda.
- Deploy do front: `prepare-publish.ps1` **sem** `-SemFrotas` e `aplicar-front.ps1` **sem** `-SemFrotas`.
- No SistAprovacao: `docs/ALTER_GUSUARIO_FROTAS.sql` (coluna de permissão) + scripts em `docs/frotas/` conforme as abas usadas.
