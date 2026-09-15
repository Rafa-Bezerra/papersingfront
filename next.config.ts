import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // `output: "export"` só no build — em dev o middleware de chunks fica mais estável.
  ...(isProd ? { output: "export" as const } : {}),
  // Em build, pasta `papersign` (deploy). Em dev, `.next` no projeto.
  distDir: isProd ? "papersign" : ".next",
  trailingSlash: true,
  // OneDrive/antivírus: evita cache webpack em disco (EBUSY / chunks 404).
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
