# Aviso de deploy

**Atualizado em 12/11/2026 (Raphaela)**

Os módulos abaixo estão no código, mas **não vão entrar em produção agora**:

## Raphaela assistente (chat de dúvidas)

- Front: `src/components/RaphaelaAjuda.tsx`, `src/lib/raphaela-*.ts`, montado em `src/components/ClientLayout.tsx`.
- API: `RaphaelaAjudaController` / `RaphaelaAjudaStore` (repositório papersing).
- Ainda **não tem chave para desligar**: quem gerar o ZIP do front a partir da `master` leva a Raphaela junto.
  Antes de publicar outra correção, retirar `<RaphaelaAjuda />` do `ClientLayout.tsx` no pacote ou aguardar liberação.
- Tabelas `RAPHAELA_AJUDA` ainda não foram criadas no banco de produção.

## Frotas

- Continua fora do deploy: `FROTAS_FORA_DO_DEPLOY = true` em `src/lib/data.ts` (menu e rota `/frotas` ficam ocultos).
- Não alterar essa chave sem liberação.

Quando forem liberados, atualizar este arquivo.
