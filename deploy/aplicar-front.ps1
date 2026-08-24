#Requires -Version 5.1
# Aplica o ZIP do front em C:\inetpub\wwwroot\papersign. Preserva web.config se ja existir.
param(
    [string]$ZipPath = "C:\inetpub\wwwroot\papersign\papersignfront-dist.zip",
    [string]$TargetDir = "C:\inetpub\wwwroot\papersign"
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path $ZipPath)) { throw "ZIP nao encontrado: $ZipPath" }
if (-not (Test-Path $TargetDir)) { throw "Pasta do front nao encontrada: $TargetDir" }

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

$keepWeb = Test-Path (Join-Path $TargetDir "web.config")
Get-ChildItem $staging -Force | ForEach-Object {
    if ($_.Name -in @("_backup", "_staging_update", "papersignfront-dist.zip")) { return }
    if ($_.Name -eq "web.config" -and $keepWeb) { return }
    $dest = Join-Path $TargetDir $_.Name
    if ($_.PSIsContainer) {
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
        Copy-Item $_.FullName $dest -Recurse -Force
    } else {
        Copy-Item $_.FullName $dest -Force
    }
}
Remove-Item $staging -Recurse -Force
Write-Host "Front atualizado em $TargetDir"
Write-Host "web.config do servidor foi preservado (se existia). Backup: $backup"
