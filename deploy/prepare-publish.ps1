#Requires -Version 5.1
# Gera ZIP do export estatico Next.js (pasta papersign/) para o IIS.
# Sempre grava a API de producao no JS; ignora NEXT_PUBLIC_API_URL do .env.local.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host "Build Next.js (output: papersign/)..."
$env:NODE_ENV = "production"
$env:NEXT_PUBLIC_API_URL = "https://papersign.grupowaybrasil.com.br:5062"
$env:BUILD_ID = "ps-" + (Get-Date -Format "yyyyMMdd-HHmmss")
Write-Host "BUILD_ID=$($env:BUILD_ID)"
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou." }

$dist = Join-Path $root "papersign"
if (-not (Test-Path $dist)) { throw "Pasta papersign/ nao foi gerada." }

# Nao embutir web.config no ZIP: no IIS isso pode gerar 500 se o modulo
# URL Rewrite nao existir ou se houver conflito de mimeMap.
# O aplicar-front.ps1 ja preserva o web.config do servidor.

# Sanity: rotas criticas do export
foreach ($must in @("index.html", "home\index.html", "receitas\index.html", "login\index.html")) {
    $p = Join-Path $dist $must
    if (-not (Test-Path $p)) { throw "Export incompleto: falta $must" }
}

$outDir = Join-Path $root "deploy"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zip = Join-Path $outDir "papersignfront-dist.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

# Remove web.config gerado no export (se houver) para nao ir no ZIP
$exportWeb = Join-Path $dist "web.config"
if (Test-Path $exportWeb) { Remove-Item $exportWeb -Force }

$buildStamp = "papersign-front " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$buildInfo = Join-Path $dist "build-info.txt"
Set-Content -Path $buildInfo -Value $buildStamp
foreach ($htmlRel in @("home\index.html", "login\index.html", "docusign\index.html")) {
    $htmlPath = Join-Path $dist $htmlRel
    if (-not (Test-Path $htmlPath)) { continue }
    $html = Get-Content $htmlPath -Raw
    $html = $html -replace "<!-- papersign-build:[^>]*-->\s*", ""
    if ($html -match "<head>") {
        $html = $html -replace '<meta name="papersign-no-cache"\s*/>\s*', ""
        $html = $html -replace "<head>", "<head><!-- papersign-build: $buildStamp --><meta name=`"papersign-no-cache`" http-equiv=`"Cache-Control`" content=`"no-cache, no-store, must-revalidate`" />"
        Set-Content -Path $htmlPath -Value $html -NoNewline
    }
}

$docChunks = Get-ChildItem -Path (Join-Path $dist "_next\static\chunks\app\(privado)\documentos") -Filter "page-*.js" -ErrorAction SilentlyContinue
$docOk = $false
foreach ($f in $docChunks) {
    if ((Get-Content $f.FullName -Raw) -match 'excluirDocumento') { $docOk = $true; break }
}
if (-not $docOk) { throw "Build sem excluir/cancelar documentos: chunk documentos/page-*.js nao contem excluirDocumento." }

$docusignChunks = Get-ChildItem -Path (Join-Path $dist "_next\static\chunks\app\(privado)\docusign") -Filter "page-*.js" -ErrorAction SilentlyContinue
$docusignOk = $false
foreach ($f in $docusignChunks) {
    $chunk = Get-Content $f.FullName -Raw
    # Nomes de funcao somem no minify; strings de UI e export excluirDocumento permanecem.
    if ($chunk -match 'Informe o motivo' -and $chunk -match 'excluirDocumento') { $docusignOk = $true; break }
}
if (-not $docusignOk) { throw "Build sem fix DOCINTERNO: chunk docusign/page-*.js sem modal de motivo (Informe o motivo + excluirDocumento)." }

Copy-Item (Join-Path $PSScriptRoot "aplicar-front.ps1") $dist -Force
Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zip -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "ZIP pronto: $zip ($sizeMb MB)"
Write-Host "Contem receitas/: $(Test-Path (Join-Path $dist 'receitas\index.html'))"
Write-Host "Copie para: C:\inetpub\wwwroot\papersign\papersignfront-dist.zip"
Write-Host "Apos apply, confira: https://papersign.grupowaybrasil.com.br:5063/build-info.txt"
