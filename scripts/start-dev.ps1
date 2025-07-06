# Mortgage Broker Pro - Development Startup Script
# This script starts the development environment with one command

Write-Host "Starting Mortgage Broker Pro Development Environment" -ForegroundColor Green
Write-Host ""

# Check if Docker is running
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "SUCCESS: .env file created. Please update it with your values if needed." -ForegroundColor Green
}

# Start services
Write-Host "Starting Docker services..." -ForegroundColor Cyan
docker-compose up -d

# Wait for database to be ready
Write-Host "Waiting for database to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    $result = docker-compose exec -T postgres pg_isready -U mortgage_user 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: Database is ready!" -ForegroundColor Green
        break
    }
    $attempt++
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
}
Write-Host ""

if ($attempt -eq $maxAttempts) {
    Write-Host "ERROR: Database failed to start. Check docker-compose logs." -ForegroundColor Red
    exit 1
}

# Show service URLs
Write-Host ""
Write-Host "Development environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor Cyan
Write-Host "   Database: postgresql://localhost:5432/mortgage_broker_pro"
Write-Host "   PgAdmin:  http://localhost:5050"
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "   View logs:       docker-compose logs -f"
Write-Host "   Stop services:   docker-compose down"
Write-Host "   Reset database:  docker-compose down -v"
Write-Host ""
