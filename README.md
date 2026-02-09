This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend – Módulos Gestão de Pessoas (3 módulos)

Foram implementados no frontend 3 novos módulos (Contratos Gestão de Pessoas, Pagamentos G. Pessoas, Pagamentos Impostos). **Para o programador do backend:** veja o arquivo **[docs/BACKEND_MODULOS_GESTAO_PESSOAS.md](docs/BACKEND_MODULOS_GESTAO_PESSOAS.md)** com a lista de endpoints, filtros e regras. **Os três módulos devem funcionar para todas as unidades** (ex.: WAY 112, 153, 262, 306, 364); a documentação e os comentários no código detalham como escopar listagens, aprovadores e o UPDATE em FLAN por unidade. Os arquivos em `src/services/`, `src/types/` e as páginas em `src/app/(privado)/gestao-pessoas`, `pagamentos-gestao-pessoas` e `pagamentos-impostos` contêm comentários detalhados.

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
