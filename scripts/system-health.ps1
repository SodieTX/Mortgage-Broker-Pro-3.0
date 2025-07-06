# Comprehensive Health Check Script
# Run this anytime to check system integrity

Write-Host "MORTGAGE BROKER PRO - SYSTEM HEALTH CHECK" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0

# 1. Check Docker
Write-Host "1. Docker Status:" -ForegroundColor Yellow
$dockerRunning = $true
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Docker is running" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Docker is not running" -ForegroundColor Red
        $errors++
        $dockerRunning = $false
    }
} catch {
    Write-Host "   [ERROR] Docker is not installed" -ForegroundColor Red
    $errors++
    $dockerRunning = $false
}

# 2. Check Services
if ($dockerRunning) {
    Write-Host "`n2. Service Health:" -ForegroundColor Yellow
    
    # Database
    $dbStatus = docker exec mortgage_broker_db pg_isready -U mortgage_user 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Database is healthy" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Database is not responding" -ForegroundColor Red
        $errors++
    }
    
    # EMC2 Core
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   [OK] EMC2 Core service is healthy" -ForegroundColor Green
    } catch {
        Write-Host "   [ERROR] EMC2 Core service is not responding" -ForegroundColor Red
        $errors++
    }
    
    # PgAdmin
    $pgadminStatus = docker ps --filter "name=pgadmin" --format "table {{.Status}}" | Select-String -Pattern "Up|Restarting"
    if ($pgadminStatus -match "Up") {
        Write-Host "   [OK] PgAdmin is running" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] PgAdmin is having issues" -ForegroundColor Yellow
        $warnings++
    }
}

# 3. Check API Authentication
Write-Host "`n3. API Security:" -ForegroundColor Yellow
try {
    # Test without auth (should fail)
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios" -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   [ERROR] API is not properly secured!" -ForegroundColor Red
    $errors++
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   [OK] API requires authentication" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] API check failed" -ForegroundColor Yellow
        $warnings++
    }
}

# 4. Check Database Schema
Write-Host "`n4. Database Schema:" -ForegroundColor Yellow
if ($dockerRunning) {
    $schemaCheck = docker exec mortgage_broker_db psql -U mortgage_user -d mortgage_broker_pro -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'core';" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $tableCount = [int]($schemaCheck.Trim())
        if ($tableCount -ge 2) {
            Write-Host "   [OK] Core schema has $tableCount tables" -ForegroundColor Green
        } else {
            Write-Host "   [WARN] Core schema only has $tableCount tables" -ForegroundColor Yellow
            $warnings++
        }
    }
}

# 5. Check Git Status
Write-Host "`n5. Version Control:" -ForegroundColor Yellow
$gitStatus = git status --porcelain 2>&1
if ($LASTEXITCODE -eq 0) {
    if ($gitStatus) {
        $uncommitted = ($gitStatus -split "`n" | Where-Object { $_ -ne "" }).Count
        Write-Host "   [WARN] $uncommitted uncommitted changes" -ForegroundColor Yellow
        $warnings++
    } else {
        Write-Host "   [OK] All changes committed" -ForegroundColor Green
    }
}

# Summary
Write-Host "`n" + ("=" * 50) -ForegroundColor Cyan
Write-Host "SUMMARY:" -ForegroundColor Cyan
Write-Host "Errors:   $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host "Warnings: $warnings" -ForegroundColor $(if ($warnings -gt 0) { "Yellow" } else { "Green" })

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "`nSystem is HEALTHY! All checks passed." -ForegroundColor Green
} elseif ($errors -eq 0) {
    Write-Host "`nSystem is OPERATIONAL with minor issues." -ForegroundColor Yellow
} else {
    Write-Host "`nSystem has CRITICAL ISSUES that need attention." -ForegroundColor Red
}
