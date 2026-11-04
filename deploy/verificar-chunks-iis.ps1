#Requires -Version 5.1
# Diagnostico rapido no servidor: HTML vs arquivos em _next (evita "a.q is not a function" = chunk misturado).
param(
    [string]$TargetDir = "C:\inetpub\wwwroot\papersign"
)

$ErrorActionPreference = "Stop"
function Test-Html([string]$rel, [string]$label) {
    $htmlPath = Join-Path $TargetDir $rel
    if (-not (Test-Path -LiteralPath $htmlPath)) {
        Write-Host "SKIP $label : $rel nao existe" -ForegroundColor Yellow
        return
    }
    $html = Get-Content -LiteralPath $htmlPath -Raw
    $refs = [regex]::Matches($html, '/_next/static/chunks/([^"?]+\.js)')
    $missing = @()
    foreach ($m in $refs) {
        $chunk = $m.Groups[1].Value
        $path = Join-Path $TargetDir ("_next\static\chunks\" + ($chunk -replace '/', '\'))
        if (-not (Test-Path -LiteralPath $path)) { $missing += $chunk }
    }
    if ($missing.Count -gt 0) {
        Write-Host "FALHA $label : $($missing.Count) chunk(s) faltando, ex.: $($missing[0])" -ForegroundColor Red
    } else {
        Write-Host "OK $label ($($refs.Count) refs em $rel)" -ForegroundColor Green
    }
    if ($html -match 'frotas/page-([a-f0-9]+)\.js') {
        Write-Host "  -> frotas page-$($Matches[1]).js"
    }
}

Write-Host "Pasta: $TargetDir"
$bi = Join-Path $TargetDir "build-info.txt"
if (Test-Path $bi) { Write-Host "build-info: $((Get-Content $bi -Raw).Trim())" }

Test-Html "home\index.html" "home"
Test-Html "frotas\index.html" "frotas"
Test-Html "login\index.html" "login"

# Chunks citados no console (build antigo) — se existirem com HTML novo, ha mistura.
foreach ($legacy in @("8154-3296905a9c725e3a.js", "3071-39851aa0a2d41959.js")) {
    $p = Join-Path $TargetDir "_next\static\chunks\$legacy"
    if (Test-Path $p) {
        Write-Host "AVISO: chunk legado ainda no disco: $legacy (pode ser cache do navegador ou deploy parcial)" -ForegroundColor Yellow
    }
}

Write-Host "`nSe FALHA: pare IIS (iisreset /stop), rode aplicar-front.ps1 de novo, iisreset /start."
Write-Host "No PC: Ctrl+Shift+R ou aba anonima apos apply."
