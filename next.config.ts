import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Em dev, usar `.next` evita EBUSY (arquivo bloqueado) com OneDrive/antivírus em `papersign/`.
  // Em build (`NODE_ENV=production`), manter `papersign` para o fluxo de export estático existente.
  distDir: process.env.NODE_ENV === "production" ? "papersign" : ".next",
  trailingSlash: true,
};

module.exports = nextConfig;
