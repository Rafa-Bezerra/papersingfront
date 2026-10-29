#Requires -Version 5.1
# Sobe API (5170) + front (3000) DESTE repo para testar excluir/cancelar/historico.
$ErrorActionPreference = "Stop"
$frontRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apiRoot = Join-Path $frontRoot "..\papersing-master"
if (Test-Path $apiRoot) { $apiRoot = (Resolve-Path $apiRoot).Path } else { throw "Nao achei papersing-master em: $apiRoot" }
$apiProj = Join-Path $apiRoot "papersing"

foreach ($f in @(
    (Join-Path $apiProj "Services\DocumentosInternosAcaoService.cs"),
    (Join-Path $frontRoot "src\components\WaySignDocumentosInternosAcoesPanel.tsx")
)) {
    if (-not (Test-Path $f)) { throw "Arquivo obrigatorio ausente: $f" }
}

Write-Host "Parando processos antigos nas portas 5170 e 3000..."
foreach ($port in 5170, 3000) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { if ($_.OwningProcess -gt 0) { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
}
Start-Sleep -Seconds 2

Write-Host "Iniciando API em http://localhost:5170 ..."
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$apiProj'; dotnet run --launch-profile http"
) -WindowStyle Normal

Start-Sleep -Seconds 8
try {
    $code = try { (Invoke-WebRequest "http://localhost:5170/api/Documentos/acoes-historico" -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
    if ($code -eq 404) {
        Write-Host 'ERRO: API na 5170 respondeu 404 em acoes-historico - projeto errado ou build velho.' -ForegroundColor Red
    } elseif ($code -eq 401) {
        Write-Host 'OK: API local com rota acoes-historico - HTTP 401 sem token.' -ForegroundColor Green
    } else {
        Write-Host "API acoes-historico: HTTP $code"
    }
} catch {
    Write-Host "API ainda subindo; confira a janela do dotnet run." -ForegroundColor Yellow
}

Write-Host "Iniciando front em http://localhost:3000 ..."
if (Test-Path (Join-Path $frontRoot ".next")) {
    Remove-Item (Join-Path $frontRoot ".next") -Recurse -Force -ErrorAction SilentlyContinue
}
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$frontRoot'; npm run dev"
) -WindowStyle Normal

Write-Host ""
Write-Host "Abra: http://localhost:3000/login" -ForegroundColor Cyan
Write-Host 'Depois: /documentos ou /docusign - aba Motivos doc. internos se admin'
