# Sobe o Next limpo (mata portas 3000/3001, apaga .next, sobe um unico dev).
# Uso: powershell -ExecutionPolicy Bypass -File .\dev-limpo.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

foreach ($port in 3000, 3001) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object {
            if ($_.OwningProcess -gt 0) {
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
}

Start-Sleep -Seconds 1

if (Test-Path .next) {
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path .next | Out-Null
attrib +P -U .next 2>$null

Write-Host "Iniciando Next em http://localhost:3000 ..."
npm run dev
