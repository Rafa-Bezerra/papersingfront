#Requires -Version 5.1
# Gera ZIP do export estatico Next.js (pasta papersign/) para o IIS.
# Sempre grava a API de producao no JS; ignora NEXT_PUBLIC_API_URL do .env.local.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host "Build Next.js (output: papersign/)..."
$env:NODE_ENV = "production"
$env:NEXT_PUBLIC_API_URL = "https://papersign.grupowaybrasil.com.br:5062"
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou." }

$dist = Join-Path $root "papersign"
if (-not (Test-Path $dist)) { throw "Pasta papersign/ nao foi gerada." }

$outDir = Join-Path $root "deploy"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zip = Join-Path $outDir "papersignfront-dist.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

Copy-Item (Join-Path $PSScriptRoot "aplicar-front.ps1") $dist -Force
Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zip -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "ZIP pronto: $zip ($sizeMb MB)"
Write-Host "Copie para: C:\inetpub\wwwroot\papersign\papersignfront-dist.zip"
