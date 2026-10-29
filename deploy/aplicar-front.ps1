#Requires -Version 5.1
# Aplica o ZIP do front em C:\inetpub\wwwroot\papersign.
# Limpa o site antes de copiar (evita _next antigo + HTML novo = chunk 404).
param(
    [string]$ZipPath = "C:\inetpub\wwwroot\papersign\papersignfront-dist.zip",
    [string]$TargetDir = "C:\inetpub\wwwroot\papersign"
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $ZipPath)) { throw "ZIP nao encontrado: $ZipPath" }
if (-not (Test-Path -LiteralPath $TargetDir)) { throw "Pasta do front nao encontrada: $TargetDir" }

$preserve = @(
    "web.config",
    "papersignfront-dist.zip",
    "aplicar-front.ps1",
    "aplicar-pacote.ps1",
    "_backup",
    "_staging_update"
)

function Stop-PapersignAppPool {
    try {
        Import-Module WebAdministration -ErrorAction Stop
        foreach ($pool in @("papersign", "DefaultAppPool")) {
            if (Get-WebAppPoolState -Name $pool -ErrorAction SilentlyContinue) {
                if ((Get-WebAppPoolState -Name $pool).Value -ne "Stopped") {
                    Stop-WebAppPool -Name $pool
                    Write-Host "App pool parado: $pool (libera _next para exclusao)"
                }
                return $pool
            }
        }
    } catch {
        Write-Warning "Nao foi possivel parar o app pool. Se Remove-Item falhar, rode iisreset antes do script."
    }
    return $null
}

function Start-PapersignAppPool([string]$poolName) {
    if (-not $poolName) { return }
    try {
        Import-Module WebAdministration -ErrorAction Stop
        Start-WebAppPool -Name $poolName
        Write-Host "App pool iniciado: $poolName"
    } catch {
        Write-Warning "Nao foi possivel iniciar o app pool. Rode iisreset manualmente."
    }
}

function Remove-TreeLiteral([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return }
    $lastErr = $null
    for ($try = 1; $try -le 4; $try++) {
        try {
            Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
            return
        } catch {
            $lastErr = $_
            Start-Sleep -Seconds 2
        }
    }
    $null = cmd /c "rmdir /s /q `"$path`""
    if (Test-Path -LiteralPath $path) {
        throw "Nao foi possivel apagar: $path. Pare o IIS (iisreset /stop), apague _next manualmente e rode de novo. Detalhe: $lastErr"
    }
}

function Test-IndexHtmlChunks([string]$targetDir, [string]$htmlRel, [string]$label) {
    $htmlPath = Join-Path $targetDir $htmlRel
    if (-not (Test-Path -LiteralPath $htmlPath)) {
        Write-Warning "$label : $htmlRel nao encontrado."
        return $true
    }
    $html = Get-Content -LiteralPath $htmlPath -Raw
    $matches = [regex]::Matches($html, '/_next/static/chunks/([^"?]+\.js)')
    $missing = @()
    foreach ($m in $matches) {
        $chunk = $m.Groups[1].Value
        $path = Join-Path $targetDir "_next\static\chunks\$chunk"
        if (-not (Test-Path -LiteralPath $path)) { $missing += $chunk }
    }
    if ($missing.Count -gt 0) {
        Write-Host "FALTA $label : $($missing.Count) chunk(s), ex.: $($missing[0])" -ForegroundColor Red
        return $false
    }
    Write-Host "OK: $label chunks ($($matches.Count) refs em $htmlRel)."
    return $true
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $TargetDir "_backup\$stamp"
$staging = Join-Path $env:TEMP "papersign-staging-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$webConfigPath = Join-Path $TargetDir "web.config"
if (Test-Path -LiteralPath $webConfigPath) {
    Copy-Item -LiteralPath $webConfigPath -Destination $backup -Force
}

Remove-TreeLiteral $staging
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Expand-Archive -LiteralPath $ZipPath -DestinationPath $staging -Force

if (-not (Test-Path -LiteralPath (Join-Path $staging "_next"))) {
    throw "ZIP invalido: pasta _next nao encontrada no pacote. Gere de novo com deploy\prepare-publish.ps1"
}

$stoppedPool = Stop-PapersignAppPool
Start-Sleep -Seconds 2

Write-Host "Limpando arquivos antigos do site (preservando web.config e ZIP)..."
Get-ChildItem -LiteralPath $TargetDir -Force | ForEach-Object {
    if ($preserve -contains $_.Name) { return }
    Remove-TreeLiteral $_.FullName
}

$keepWeb = Test-Path -LiteralPath $webConfigPath
# robocopy copia _next com (privado)/(publico) de forma mais confiavel que Copy-Item em lote
$null = robocopy $staging $TargetDir /E /R:3 /W:2 /XF "web.config" "papersignfront-dist.zip" /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -ge 8) {
    Start-PapersignAppPool $stoppedPool
    throw "robocopy falhou ao copiar do staging (codigo $LASTEXITCODE). Veja se o ZIP esta completo."
}
Remove-TreeLiteral $staging

# Verificacao pos-apply
$receitas = Join-Path $TargetDir "receitas\index.html"
if (-not (Test-Path -LiteralPath $receitas)) {
    Write-Warning "ATENCAO: receitas\index.html NAO existe em $TargetDir apos o apply."
} else {
    Write-Host "OK: receitas\index.html presente."
}

$chunkOk = $true
$chunkOk = (Test-IndexHtmlChunks $TargetDir "home\index.html" "home") -and $chunkOk
$chunkOk = (Test-IndexHtmlChunks $TargetDir "requisicoes\index.html" "requisicoes") -and $chunkOk
$chunkOk = (Test-IndexHtmlChunks $TargetDir "login\index.html" "login") -and $chunkOk
if (-not $chunkOk) {
    Start-PapersignAppPool $stoppedPool
    throw "Deploy incompleto: HTML novo sem todos os .js em _next (tela preta / 404). Rode iisreset /stop e aplique de novo."
}

$docusignDir = Join-Path $TargetDir "_next\static\chunks\app\(privado)\docusign"
$docusignChunks = Get-ChildItem -LiteralPath $docusignDir -Filter "page-*.js" -ErrorAction SilentlyContinue
$docusignOk = $false
foreach ($f in $docusignChunks) {
    $chunk = Get-Content -LiteralPath $f.FullName -Raw
    if ($chunk -match 'Informe o motivo' -and $chunk -match 'excluirDocumento') {
        $docusignOk = $true
        Write-Host "OK: chunk WaySign $($f.Name) contem exclusao com motivo (Documentos internos)."
        break
    }
}
if (-not $docusignOk) {
    Start-PapersignAppPool $stoppedPool
    throw "Deploy incompleto: chunk docusign/page-*.js sem modal de motivo. Gere o ZIP de novo no PC de build."
}

$docHtml = Join-Path $TargetDir "docusign\index.html"
if (Test-Path -LiteralPath $docHtml) {
    $dh = Get-Content -LiteralPath $docHtml -Raw
    if ($dh -match 'docusign/page-([a-f0-9]+)\.js') {
        Write-Host "OK: docusign/index.html referencia page-$($Matches[1]).js"
    }
}

Start-PapersignAppPool $stoppedPool

$bi = Join-Path $TargetDir "build-info.txt"
if (Test-Path -LiteralPath $bi) {
    Write-Host "Build aplicado: $((Get-Content -LiteralPath $bi -Raw).Trim())"
} else {
    Write-Warning "build-info.txt ausente apos apply."
}
Write-Host "Front atualizado em $TargetDir"
if ($keepWeb) {
    Write-Host "web.config do servidor preservado. Backup: $backup"
} else {
    Write-Host "Nenhum web.config previo. Backup: $backup"
}
