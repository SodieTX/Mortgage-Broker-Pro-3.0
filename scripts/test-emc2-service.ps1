# Test EMC2 Core Service
Write-Host "Testing EMC2 Core Service..." -ForegroundColor Yellow
Write-Host ""

# Test root endpoint
Write-Host "Testing root endpoint:" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/" -Method Get
    Write-Host "SUCCESS: Service is running" -ForegroundColor Green
    $response | ConvertTo-Json | Write-Host
} catch {
    Write-Host "ERROR: Could not reach service at http://localhost:3001/" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""

# Test health endpoint
Write-Host "Testing health endpoint:" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get
    Write-Host "SUCCESS: Health check passed" -ForegroundColor Green
    $response | ConvertTo-Json | Write-Host
} catch {
    Write-Host "ERROR: Health check failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""

# Test detailed health endpoint
Write-Host "Testing detailed health endpoint:" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health/detailed" -Method Get
    Write-Host "SUCCESS: Detailed health check passed" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "ERROR: Detailed health check failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
