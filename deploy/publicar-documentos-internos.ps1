#Requires -Version 5.1
# Gera ZIP de API + front COM as alteracoes locais (excluir/cancelar/historico).
# Rode no PC de build, a partir de papersingfront-master\deploy\
$ErrorActionPreference = "Stop"
$frontRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apiRoot = (Resolve-Path (Join-Path $frontRoot "..\papersing-master")).Path

Write-Host "=== Publicar documentos internos (API + front) ===" -ForegroundColor Cyan

$apiService = Join-Path $apiRoot "papersing\Services\DocumentosInternosAcaoService.cs"
$frontPanel = Join-Path $frontRoot "src\components\WaySignDocumentosInternosAcoesPanel.tsx"
if (-not (Test-Path $apiService)) { throw "Falta API: $apiService" }
if (-not (Test-Path $frontPanel)) { throw "Falta front: $frontPanel" }

Write-Host "Build API..."
Set-Location $apiRoot
& powershell -ExecutionPolicy Bypass -File (Join-Path $apiRoot "empacotar.ps1")
if ($LASTEXITCODE -ne 0) { throw "empacotar.ps1 falhou" }

Write-Host "Build front..."
Set-Location $frontRoot
& powershell -ExecutionPolicy Bypass -File (Join-Path $frontRoot "deploy\prepare-publish.ps1")
if ($LASTEXITCODE -ne 0) { throw "prepare-publish.ps1 falhou" }

$apiZip = Join-Path $apiRoot "deploy-out\papersingapi-update.zip"
$frontZip = Join-Path $frontRoot "deploy\papersignfront-dist.zip"
Write-Host ""
Write-Host "Pronto." -ForegroundColor Green
Write-Host "  API:   $apiZip"
Write-Host "  Front: $frontZip"
Write-Host ""
Write-Host "Servidor IIS (admin):" -ForegroundColor Yellow
Write-Host "  copy ZIPs -> inetpub\papersignapi e inetpub\papersign"
Write-Host "  aplicar-no-servidor.ps1"
Write-Host "  aplicar-front.ps1"
