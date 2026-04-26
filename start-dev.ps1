# CopyTrader Bullex - Script de Desenvolvimento
Write-Host ""
Write-Host "  ╔═══════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║    🐂 CopyTrader Bullex v1.0      ║" -ForegroundColor Green
Write-Host "  ╠═══════════════════════════════════╣" -ForegroundColor Green
Write-Host "  ║  Iniciando ambiente de dev...      ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Verificar se .env existe
if (-not (Test-Path "backend\.env")) {
    Write-Host "[!] Criando .env a partir do .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" "backend\.env"
}

Write-Host "[1/2] Iniciando Backend (porta 4000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PWD\backend'; Write-Host 'BACKEND' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 2

Write-Host "[2/2] Iniciando Frontend (porta 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PWD\frontend'; Write-Host 'FRONTEND' -ForegroundColor Blue; npm run dev"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ Ambiente iniciado!" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:  http://localhost:4000" -ForegroundColor White
Write-Host ""
Start-Process "http://localhost:5173"
