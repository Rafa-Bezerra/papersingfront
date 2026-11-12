# Aviso de deploy

**Atualizado em 12/11/2026 (Raphaela)**

Os módulos abaixo estão no código, mas **não vão entrar em produção agora**:

## Raphaela assistente (chat de dúvidas)

- Front: `src/components/RaphaelaAjuda.tsx`, `src/lib/raphaela-*.ts`, montado em `src/components/ClientLayout.tsx`.
- API: `RaphaelaAjudaController` / `RaphaelaAjudaStore` (repositório papersing).
- Desligada no build de produção: `RAPHAELA_FORA_DO_DEPLOY = true` em `src/lib/data.ts`.
  No `npm run dev` ela continua aparecendo para testes. Para liberar, trocar para `false`.
- Tabelas `RAPHAELA_AJUDA` ainda não foram criadas no banco de produção.

## Frotas

- Continua fora do deploy: `FROTAS_FORA_DO_DEPLOY = true` em `src/lib/data.ts` (menu e rota `/frotas` ficam ocultos).
- Não alterar essa chave sem liberação.

Quando forem liberados, atualizar este arquivo.
