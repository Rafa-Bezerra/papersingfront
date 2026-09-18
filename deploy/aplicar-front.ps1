#Requires -Version 5.1
# Aplica o ZIP do front em C:\inetpub\wwwroot\papersign.
# Limpa o site antes de copiar (evita _next antigo + HTML novo = chunk 404).
param(
    [string]$ZipPath = "C:\inetpub\wwwroot\papersign\papersignfront-dist.zip",
    [string]$TargetDir = "C:\inetpub\wwwroot\papersign"
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path $ZipPath)) { throw "ZIP nao encontrado: $ZipPath" }
if (-not (Test-Path $TargetDir)) { throw "Pasta do front nao encontrada: $TargetDir" }

$preserve = @(
    "web.config",
    "papersignfront-dist.zip",
    "aplicar-front.ps1",
    "aplicar-pacote.ps1",
    "_backup",
    "_staging_update"
)

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $TargetDir "_backup\$stamp"
$staging = Join-Path $TargetDir "_staging_update"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
if (Test-Path (Join-Path $TargetDir "web.config")) {
    Copy-Item (Join-Path $TargetDir "web.config") $backup -Force
}

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $staging -Force

if (-not (Test-Path (Join-Path $staging "_next"))) {
    throw "ZIP invalido: pasta _next nao encontrada no pacote. Gere de novo com deploy\prepare-publish.ps1"
}

Write-Host "Limpando arquivos antigos do site (preservando web.config e ZIP)..."
Get-ChildItem $TargetDir -Force | ForEach-Object {
    if ($preserve -contains $_.Name) { return }
    Remove-Item $_.FullName -Recurse -Force
}

$keepWeb = Test-Path (Join-Path $TargetDir "web.config")
Get-ChildItem $staging -Force | ForEach-Object {
    if ($_.Name -in @("_backup", "_staging_update", "papersignfront-dist.zip")) { return }
    if ($_.Name -eq "web.config") { return }
    $dest = Join-Path $TargetDir $_.Name
    Copy-Item $_.FullName $dest -Recurse -Force
}
Remove-Item $staging -Recurse -Force

# Verificacao pos-apply
$receitas = Join-Path $TargetDir "receitas\index.html"
if (-not (Test-Path $receitas)) {
    Write-Warning "ATENCAO: receitas\index.html NAO existe em $TargetDir apos o apply."
} else {
    Write-Host "OK: receitas\index.html presente."
}

$homeHtml = Join-Path $TargetDir "home\index.html"
if (Test-Path $homeHtml) {
    $html = Get-Content $homeHtml -Raw
    $matches = [regex]::Matches($html, '/_next/static/chunks/([^"?]+\.js)')
    $missing = @()
    foreach ($m in $matches) {
        $chunk = $m.Groups[1].Value
        $path = Join-Path $TargetDir "_next\static\chunks\$chunk"
        if (-not (Test-Path $path)) { $missing += $chunk }
    }
    if ($missing.Count -gt 0) {
        throw "Deploy incompleto: chunks ausentes em _next: $($missing -join ', ')"
    }
    Write-Host "OK: chunks do home/index.html presentes ($($matches.Count) referencias)."
} else {
    Write-Warning "home\index.html nao encontrado para verificacao de chunks."
}

try {
    Import-Module WebAdministration -ErrorAction Stop
    foreach ($pool in @("papersign", "DefaultAppPool")) {
        if (Get-WebAppPoolState -Name $pool -ErrorAction SilentlyContinue) {
            Restart-WebAppPool -Name $pool
            Write-Host "App pool reiniciado: $pool"
            break
        }
    }
} catch {
    Write-Warning "Nao foi possivel reiniciar o app pool automaticamente. Reinicie o IIS manualmente se necessario."
}

Write-Host "Front atualizado em $TargetDir"
if ($keepWeb) {
    Write-Host "web.config do servidor preservado. Backup: $backup"
} else {
    Write-Host "Nenhum web.config previo. Backup: $backup"
}
