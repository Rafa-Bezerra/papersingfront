#Requires -Version 5.1
# Rode NO SERVIDOR IIS (PowerShell). Mostra se front/API foram aplicados.
param(
    [string]$FrontDir = "C:\inetpub\wwwroot\papersign",
    [string]$ApiDir = "C:\inetpub\wwwroot\papersignapi",
    [string]$FrontZip = "C:\inetpub\wwwroot\papersign\papersignfront-dist.zip",
    [string]$ApiZip = "C:\inetpub\wwwroot\papersignapi\papersingapi-update.zip"
)

Write-Host "=== PaperSign deploy check ===" -ForegroundColor Cyan
Write-Host "Front dir: $FrontDir"
Write-Host "API dir:   $ApiDir"
Write-Host ""

function Show-FileAge($path, $label) {
    if (Test-Path $path) {
        $i = Get-Item $path
        Write-Host "OK $label : $($i.FullName) ($([math]::Round($i.Length/1MB,2)) MB, $($i.LastWriteTime))"
    } else {
        Write-Host "FALTA $label : $path" -ForegroundColor Yellow
    }
}

Show-FileAge $FrontZip "ZIP front"
Show-FileAge $ApiZip "ZIP API"
Show-FileAge (Join-Path $FrontDir "build-info.txt") "build-info.txt (site)"
Show-FileAge (Join-Path $FrontDir "home\index.html") "home\index.html"
Show-FileAge (Join-Path $FrontDir "documentos\index.html") "documentos\index.html"

$docHtml = Join-Path $FrontDir "documentos\index.html"
if (Test-Path $docHtml) {
    $html = Get-Content $docHtml -Raw
    if ($html -match 'documentos/page-([a-f0-9]+)\.js') {
        $chunk = $Matches[1]
        $chunkPath = Join-Path $FrontDir "_next\static\chunks\app\(privado)\documentos\page-$chunk.js"
        if (Test-Path $chunkPath) {
            $js = Get-Content $chunkPath -Raw
            $tem = $js.Contains("excluirDocumento")
            if ($tem) {
                Write-Host "OK chunk documentos tem excluir/cancelar (page-$chunk.js)" -ForegroundColor Green
            } else {
                Write-Host "ANTIGO chunk documentos SEM excluirDocumento (page-$chunk.js)" -ForegroundColor Red
            }
        } else {
            Write-Host "FALTA chunk no disco: $chunkPath" -ForegroundColor Red
        }
    }
}

$apiDll = Join-Path $ApiDir "papersing.dll"
if (Test-Path $apiDll) {
    $dll = Get-Item $apiDll
    Write-Host "OK papersing.dll : $($dll.LastWriteTime)"
} else {
    Write-Host "FALTA papersing.dll em $ApiDir" -ForegroundColor Yellow
}

try {
    Import-Module WebAdministration -ErrorAction Stop
    Get-Website | Where-Object { $_.PhysicalPath -like "*papersign*" } | ForEach-Object {
        Write-Host "IIS site: $($_.Name) -> $($_.PhysicalPath) (bindings: $($_.bindings.Collection.bindingInformation -join '; '))"
    }
} catch {
    Write-Host "(WebAdministration indisponivel — confira caminho fisico no IIS Manager)"
}

Write-Host ""
Write-Host "Se build-info.txt FALTA mas o ZIP existe: rode como ADMIN:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$FrontDir\aplicar-front.ps1`""
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$ApiDir\aplicar-no-servidor.ps1`""
