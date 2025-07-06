# Mortgage Broker Pro - Development Stop Script
# This script stops the development environment cleanly

Write-Host "🛑 Stopping Mortgage Broker Pro Development Environment" -ForegroundColor Yellow
Write-Host ""

# Stop services
Write-Host "🐳 Stopping Docker services..." -ForegroundColor Cyan
docker-compose down

Write-Host ""
Write-Host "✅ Development environment stopped." -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tip: To remove database data, run: docker-compose down -v" -ForegroundColor Yellow
