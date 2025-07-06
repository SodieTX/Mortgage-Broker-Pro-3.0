# Test Database Connection
# Simple script to verify database is accessible

Write-Host "Testing database connection..." -ForegroundColor Yellow

# Test connection using docker exec
$result = docker exec mortgage_broker_db psql -U mortgage_user -d mortgage_broker_pro -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Database connection working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "PostgreSQL Version:" -ForegroundColor Cyan
    Write-Host $result
} else {
    Write-Host "ERROR: Could not connect to database" -ForegroundColor Red
    Write-Host $result
}

# Check our schema version
Write-Host ""
Write-Host "Checking schema version..." -ForegroundColor Yellow
$schemaCheck = docker exec mortgage_broker_db psql -U mortgage_user -d mortgage_broker_pro -t -c "SELECT version, description FROM schema_version ORDER BY id DESC LIMIT 1;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Current schema version:" -ForegroundColor Cyan
    Write-Host $schemaCheck
} else {
    Write-Host "Schema version table not found (this is normal on first run)" -ForegroundColor Yellow
}
