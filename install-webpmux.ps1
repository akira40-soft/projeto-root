# Script para instalar libwebp (webpmux) no Windows
# Execute como Administrador: powershell -ExecutionPolicy Bypass -File install-webpmux.ps1

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Instalador de libwebp (webpmux) para Windows" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Verificar se já está instalado
try {
    $null = & webpmux -version 2>&1
    Write-Host "✅ webpmux já está instalado!" -ForegroundColor Green
    Write-Host ""
    & webpmux -version
    exit 0
} catch {
    Write-Host "⚠️  webpmux não encontrado. Instalando..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Baixando libwebp..." -ForegroundColor Cyan

# URL do libwebp para Windows
$libwebpUrl = "https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.3.2-windows-x64.zip"
$downloadPath = "$env:TEMP\libwebp.zip"
$extractPath = "$env:TEMP\libwebp"

try {
    # Baixar
    Invoke-WebRequest -Uri $libwebpUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "✅ Download concluído!" -ForegroundColor Green
    
    # Extrair
    Write-Host "Extraindo arquivos..." -ForegroundColor Cyan
    Expand-Archive -Path $downloadPath -DestinationPath $extractPath -Force
    
    # Encontrar pasta bin
    $binPath = Get-ChildItem -Path $extractPath -Recurse -Directory -Filter "bin" | Select-Object -First 1
    
    if ($binPath) {
        # Copiar executáveis para System32
        $systemPath = "$env:SystemRoot\System32"
        
        Write-Host "Copiando executáveis para $systemPath..." -ForegroundColor Cyan
        
        Copy-Item "$($binPath.FullName)\*.exe" -Destination $systemPath -Force
        
        Write-Host "✅ Instalação concluída!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Testando instalação..." -ForegroundColor Cyan
        & webpmux -version
        
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host "  ✅ webpmux instalado com sucesso!" -ForegroundColor Green
        Write-Host "  Agora você pode criar stickers com metadados!" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
        
    } else {
        throw "Pasta bin não encontrada no arquivo extraído"
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Erro durante instalação: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "INSTALAÇÃO MANUAL:" -ForegroundColor Yellow
    Write-Host "1. Baixe: https://developers.google.com/speed/webp/download" -ForegroundColor Yellow
    Write-Host "2. Extraia o arquivo ZIP" -ForegroundColor Yellow
    Write-Host "3. Copie os arquivos .exe da pasta 'bin' para C:\Windows\System32" -ForegroundColor Yellow
    Write-Host ""
    exit 1
} finally {
    # Limpar arquivos temporários
    if (Test-Path $downloadPath) {
        Remove-Item $downloadPath -Force
    }
    if (Test-Path $extractPath) {
        Remove-Item $extractPath -Recurse -Force
    }
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")