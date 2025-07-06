# Helper script to sync npm dependencies when package.json changes
# This is needed because we're not mounting node_modules from host

Write-Host "🔄 Syncing npm dependencies in EMC2 Core container..." -ForegroundColor Cyan

# Check if container is running
$containerRunning = docker ps --format "{{.Names}}" | Select-String "mortgage_broker_emc2_core"

if (-not $containerRunning) {
    Write-Host "❌ Container 'mortgage_broker_emc2_core' is not running!" -ForegroundColor Red
    Write-Host "Run 'docker-compose up -d emc2-core' first." -ForegroundColor Yellow
    exit 1
}

# Run npm install inside the container
Write-Host "📦 Running npm install inside container..." -ForegroundColor Yellow
docker exec mortgage_broker_emc2_core npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies synced successfully!" -ForegroundColor Green
    Write-Host "🔄 Restarting nodemon..." -ForegroundColor Yellow
    
    # Touch a file to trigger nodemon restart
    docker exec mortgage_broker_emc2_core touch /app/src/index.ts
    
    Write-Host "✅ Done! The service should restart automatically." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to sync dependencies!" -ForegroundColor Red
    Write-Host "Check the container logs: docker logs mortgage_broker_emc2_core" -ForegroundColor Yellow
}
