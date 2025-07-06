# The Pinocchio Check - System Operational Readiness Test
# This script checks if we have a working, deployable system or just scattered code

Write-Host "`n🤥 PINOCCHIO CHECK - IS THIS SYSTEM ACTUALLY OPERATIONAL?" -ForegroundColor Magenta
Write-Host "========================================================`n" -ForegroundColor Magenta

$lies = 0
$truths = 0
$noseLength = ""

# Check 1: Core Services Running
Write-Host "1. INFRASTRUCTURE CHECK:" -ForegroundColor Yellow
Write-Host "   Are all core services up and running?" -ForegroundColor Cyan

$runningServices = docker ps --format "{{.Names}}" 2>$null
$requiredServices = @("postgres", "redis", "emc2-core")
$runningCount = 0

foreach ($service in $requiredServices) {
    if ($runningServices -match $service) {
        Write-Host "   ✓ $service is running" -ForegroundColor Green
        $runningCount++
    } else {
        Write-Host "   🤥 $service is NOT running" -ForegroundColor Red
    }
}

if ($runningCount -eq $requiredServices.Count) {
    Write-Host "   ✓ All core services operational" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 Missing $(($requiredServices.Count - $runningCount)) critical services" -ForegroundColor Red
    $lies++
    $noseLength += "="
}

# Check 2: Service Communication
Write-Host "`n2. SERVICE COMMUNICATION TEST:" -ForegroundColor Yellow
Write-Host "   Can services communicate with each other?" -ForegroundColor Cyan

# Test database connectivity
$dbOk = $false
try {
    $dbTest = docker exec postgres pg_isready -U postgres 2>&1
    if ($dbTest -match "accepting connections") {
        Write-Host "   ✓ Database accepting connections" -ForegroundColor Green
        $dbOk = $true
    } else {
        Write-Host "   🤥 Database not accepting connections" -ForegroundColor Red
    }
} catch {
    Write-Host "   🤥 Cannot test database connectivity" -ForegroundColor Red
}

# Test API endpoint
$apiOk = $false
try {
    $apiTest = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✓ API endpoint responding" -ForegroundColor Green
    $apiOk = $true
} catch {
    Write-Host "   🤥 API endpoint not responding" -ForegroundColor Red
}

# Test Redis connectivity
$redisOk = $false
try {
    $redisTest = docker exec redis redis-cli ping 2>&1
    if ($redisTest -match "PONG") {
        Write-Host "   ✓ Redis responding to ping" -ForegroundColor Green
        $redisOk = $true
    } else {
        Write-Host "   🤥 Redis not responding" -ForegroundColor Red
    }
} catch {
    Write-Host "   🤥 Cannot test Redis connectivity" -ForegroundColor Red
}

if ($dbOk -and $apiOk -and $redisOk) {
    Write-Host "   ✓ All services can communicate" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 Service communication issues detected" -ForegroundColor Red
    $lies++
    $noseLength += "=="
}

# Check 3: End-to-End Workflow Test
Write-Host "`n3. END-TO-END WORKFLOW TEST:" -ForegroundColor Yellow
Write-Host "   Can we complete a basic workflow from start to finish?" -ForegroundColor Cyan

$workflowSteps = @()
$scenarioId = $null

# Step 1: Create a test scenario
try {
    $testData = @{
        title = "E2E Test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        description = "End-to-end operational test"
        loanData = @{
            borrower = @{
                firstName = "Test"
                lastName = "User"
                creditScore = 700
                annualIncome = 100000
            }
            property = @{
                address = "123 Test St"
                city = "Austin"
                state = "TX"
                zipCode = "78701"
                purchasePrice = 400000
            }
            loan = @{
                loanAmount = 320000
                loanPurpose = "purchase"
                loanType = "conventional"
                termMonths = 360
            }
        }
    } | ConvertTo-Json -Depth 10

    $createResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios" `
        -Method Post `
        -Headers @{"x-api-key" = "test-key-for-development"; "Content-Type" = "application/json"} `
        -Body $testData `
        -TimeoutSec 5

    if ($createResponse.id) {
        Write-Host "   ✓ Step 1: Created scenario with ID: $($createResponse.id)" -ForegroundColor Green
        $workflowSteps += $true
        $scenarioId = $createResponse.id
    } else {
        Write-Host "   🤥 Step 1: Failed to create scenario" -ForegroundColor Red
        $workflowSteps += $false
    }
} catch {
    Write-Host "   🤥 Step 1: Error creating scenario - $($_.Exception.Message)" -ForegroundColor Red
    $workflowSteps += $false
}

# Step 2: Retrieve the scenario
if ($scenarioId) {
    try {
        $getResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios/$scenarioId" `
            -Method Get `
            -Headers @{"x-api-key" = "test-key-for-development"} `
            -TimeoutSec 5

        if ($getResponse.id -eq $scenarioId) {
            Write-Host "   ✓ Step 2: Retrieved scenario successfully" -ForegroundColor Green
            $workflowSteps += $true
        } else {
            Write-Host "   🤥 Step 2: Failed to retrieve scenario" -ForegroundColor Red
            $workflowSteps += $false
        }
    } catch {
        Write-Host "   🤥 Step 2: Error retrieving scenario" -ForegroundColor Red
        $workflowSteps += $false
    }

    # Cleanup
    try {
        Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios/$scenarioId" `
            -Method Delete `
            -Headers @{"x-api-key" = "test-key-for-development"} -ErrorAction SilentlyContinue | Out-Null
    } catch {
        # Ignore cleanup errors
    }
}

$successfulSteps = ($workflowSteps | Where-Object { $_ -eq $true }).Count
if ($successfulSteps -eq $workflowSteps.Count -and $workflowSteps.Count -gt 0) {
    Write-Host "   ✓ Complete workflow executed successfully" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 Workflow has broken steps" -ForegroundColor Red
    $lies++
    $noseLength += "==="
}

# Check 4: Monitoring and Observability
Write-Host "`n4. MONITORING AND OBSERVABILITY TEST:" -ForegroundColor Yellow
Write-Host "   Can we monitor and debug the system in production?" -ForegroundColor Cyan

$monitoringChecks = @{
    "Logging configured" = (Get-ChildItem -Path "services" -Recurse -Include "*.ts" -ErrorAction SilentlyContinue | Select-String -Pattern "winston|logger|console\.log" -List -ErrorAction SilentlyContinue).Count -gt 10
    "Health endpoints" = Test-Path "services/emc2-core/src/routes/health.ts"
    "Error tracking" = (Get-ChildItem -Path "services" -Recurse -Include "*.ts" -ErrorAction SilentlyContinue | Select-String -Pattern "try.*catch|error.*handler" -List -ErrorAction SilentlyContinue).Count -gt 5
    "Docker logs accessible" = (docker ps --format "{{.Names}}" 2>$null | Measure-Object).Count -gt 0
}

$monitoringReady = 0
foreach ($check in $monitoringChecks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "   ✓ $($check.Key)" -ForegroundColor Green
        $monitoringReady++
    } else {
        Write-Host "   🤥 $($check.Key) - NO" -ForegroundColor Red
    }
}

if ($monitoringReady -ge 3) {
    Write-Host "   ✓ System is observable" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 Flying blind - no proper monitoring" -ForegroundColor Red
    $lies++
    $noseLength += "===="
}

# Check 5: Scalability Test
Write-Host "`n5. SCALABILITY TEST:" -ForegroundColor Yellow
Write-Host "   Can the system handle concurrent load?" -ForegroundColor Cyan

# Simple concurrent request test
$concurrentSuccess = 0
$jobs = @()

Write-Host "   Testing 5 concurrent health checks..." -ForegroundColor Cyan
for ($i = 1; $i -le 5; $i++) {
    $jobs += Start-Job -ScriptBlock {
        try {
            Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 2 -ErrorAction Stop | Out-Null
            return $true
        } catch {
            return $false
        }
    }
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job -Force

$concurrentSuccess = ($results | Where-Object { $_ -eq $true }).Count

if ($concurrentSuccess -eq 5) {
    Write-Host "   ✓ All 5 concurrent requests succeeded" -ForegroundColor Green
    $truths++
} elseif ($concurrentSuccess -ge 3) {
    Write-Host "   ⚠ $concurrentSuccess/5 concurrent requests succeeded" -ForegroundColor Yellow
    $truths++
} else {
    Write-Host "   🤥 Only $concurrentSuccess/5 concurrent requests succeeded" -ForegroundColor Red
    $lies++
    $noseLength += "====="
}

# Check 6: Deployment Readiness
Write-Host "`n6. DEPLOYMENT READINESS TEST:" -ForegroundColor Yellow
Write-Host "   Is the system ready to deploy?" -ForegroundColor Cyan

$deploymentChecks = @{
    "Docker Compose exists" = Test-Path "docker-compose.yml"
    "Environment config" = (Test-Path ".env") -or (Test-Path ".env.example")
    "Build scripts" = Test-Path "package.json"
    "Database migrations" = (Get-ChildItem -Path "database/migrations" -Filter "*.sql" -ErrorAction SilentlyContinue).Count -gt 0
    "Documentation" = Test-Path "README.md"
}

$deployReady = 0
foreach ($check in $deploymentChecks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "   ✓ $($check.Key)" -ForegroundColor Green
        $deployReady++
    } else {
        Write-Host "   🤥 $($check.Key) - MISSING" -ForegroundColor Red
    }
}

if ($deployReady -ge 4) {
    Write-Host "   ✓ System is deployment ready" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 Not ready for deployment" -ForegroundColor Red
    $lies++
    $noseLength += "======"
}

# FINAL VERDICT
Write-Host "`n" + ("=" * 60) -ForegroundColor Magenta
Write-Host "OPERATIONAL READINESS VERDICT:" -ForegroundColor Magenta
Write-Host "Operational: $truths | Not Ready: $lies" -ForegroundColor White

if ($noseLength.Length -gt 0) {
    Write-Host "`nSystem gaps detected: 👃$noseLength>" -ForegroundColor Red
}

$percentReady = [math]::Round(($truths / 6) * 100)
Write-Host "`nSYSTEM READINESS: $percentReady%" -ForegroundColor White

if ($lies -eq 0) {
    Write-Host "`n🎉 EXCELLENT! Your system is fully operational!" -ForegroundColor Green
    Write-Host "All core components are working and communicating properly." -ForegroundColor Green
} elseif ($truths -gt $lies) {
    Write-Host "`n⚠️  PARTIALLY OPERATIONAL - Some components need attention" -ForegroundColor Yellow
    Write-Host "The system can run but has gaps that need fixing." -ForegroundColor Yellow
} else {
    Write-Host "`n🤥 NOT OPERATIONAL! Too many broken components!" -ForegroundColor Red
    Write-Host "`nCRITICAL ISSUES:" -ForegroundColor Red
    Write-Host "- Core services not running or not communicating" -ForegroundColor Red
    Write-Host "- Basic workflows are broken" -ForegroundColor Red
    Write-Host "- System cannot handle production load" -ForegroundColor Red
}

Write-Host "`n💡 PRIORITY FIXES:" -ForegroundColor Cyan

if (-not $runningServices -or $runningCount -lt $requiredServices.Count) {
    Write-Host "1. 🔥 Get all services running: docker-compose up -d" -ForegroundColor White
}

if (-not $dbOk -or -not $apiOk -or -not $redisOk) {
    Write-Host "2. 🔄 Fix service communication issues" -ForegroundColor White
}

if ($workflowSteps.Count -eq 0 -or $successfulSteps -lt $workflowSteps.Count) {
    Write-Host "3. 🔧 Repair broken workflow steps" -ForegroundColor White
}

if ($monitoringReady -lt 3) {
    Write-Host "4. 📊 Add proper logging and monitoring" -ForegroundColor White
}

if ($concurrentSuccess -lt 3) {
    Write-Host "5. ⚡ Fix performance/concurrency issues" -ForegroundColor White
}

if ($deployReady -lt 4) {
    Write-Host "6. 📦 Complete deployment configuration" -ForegroundColor White
}

Write-Host "`nGOAL: Get this system to 100% operational before adding new features!" -ForegroundColor Magenta
