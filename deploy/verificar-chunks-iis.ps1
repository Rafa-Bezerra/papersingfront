#Requires -Version 5.1
# Diagnostico rapido no servidor: HTML vs arquivos em _next (evita tela preta / 404 em chunk).
param(
    [string]$TargetDir = "C:\inetpub\wwwroot\papersign",
    [string]$ZipPath = "C:\inetpub\wwwroot\papersign\papersignfront-dist.zip"
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

$nextDir = Join-Path $TargetDir "_next"
$nextCount = (Get-ChildItem -LiteralPath $nextDir -Recurse -File -ErrorAction SilentlyContinue).Count
if ($nextCount -eq 0) {
    Write-Host "FALHA: pasta _next vazia ou ausente no site ($nextCount arquivos). Rode aplicar-front.ps1." -ForegroundColor Red
} else {
    Write-Host "OK: $nextCount arquivo(s) em _next no disco." -ForegroundColor Green
}

if (Test-Path -LiteralPath $ZipPath) {
    $zipItem = Get-Item -LiteralPath $ZipPath
    Write-Host "ZIP: $($zipItem.FullName) ($([math]::Round($zipItem.Length/1MB, 2)) MB)"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $z = [IO.Compression.ZipFile]::OpenRead($zipItem.FullName)
    try {
        # No Windows o ZIP usa "\" em FullName; "_next/*" sempre da 0.
        $nextInZip = ($z.Entries | Where-Object { $_.FullName -like "_next\*" }).Count
        Write-Host "ZIP: $($z.Entries.Count) entrada(s), _next: $nextInZip"
        if ($zipItem.Length -lt 80MB -or $nextInZip -lt 50) {
            Write-Host "FALHA: ZIP pequeno ou sem _next — recopie papersignfront-dist.zip do PC de build." -ForegroundColor Red
        }
    } finally {
        $z.Dispose()
    }
} else {
    Write-Host "AVISO: ZIP nao encontrado em $ZipPath" -ForegroundColor Yellow
}

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
