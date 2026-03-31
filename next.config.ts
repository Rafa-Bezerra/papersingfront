import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "papersign",
  trailingSlash: true,
};

module.exports = nextConfig;
