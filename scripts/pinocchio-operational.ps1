# Pinocchio Check - Operational Readiness Test
# Checks if the system is actually stood up and working

Write-Host "`n==== PINOCCHIO OPERATIONAL READINESS CHECK ====" -ForegroundColor Magenta
Write-Host "Testing if this system is real or just pretend`n" -ForegroundColor Magenta

$score = 0
$total = 6

# Test 1: Docker Services Running
Write-Host "1. INFRASTRUCTURE:" -ForegroundColor Yellow
$services = docker ps --format "table {{.Names}}" 2>$null | Select-String "mortgage_broker_db|mortgage_broker_emc2" -Quiet
if ($services) {
    Write-Host "   PASS - Core services are running" -ForegroundColor Green
    $score++
} else {
    Write-Host "   FAIL - Core services not running" -ForegroundColor Red
}

# Test 2: Database Connectivity
Write-Host "`n2. DATABASE:" -ForegroundColor Yellow
$dbOk = $false
try {
    $dbTest = docker exec mortgage_broker_db pg_isready -U postgres 2>&1
    if ($dbTest -match "accepting") {
        Write-Host "   PASS - Database is accepting connections" -ForegroundColor Green
        $score++
        $dbOk = $true
    } else {
        Write-Host "   FAIL - Database not accepting connections" -ForegroundColor Red
    }
} catch {
    Write-Host "   FAIL - Cannot connect to database" -ForegroundColor Red
}

# Test 3: API Health
Write-Host "`n3. API HEALTH:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 3 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   PASS - API is responding" -ForegroundColor Green
        $score++
    } else {
        Write-Host "   FAIL - API returned error" -ForegroundColor Red
    }
} catch {
    Write-Host "   FAIL - API is not responding" -ForegroundColor Red
}

# Test 4: Basic Workflow
Write-Host "`n4. WORKFLOW TEST:" -ForegroundColor Yellow
try {
    $body = @{
        title = "Test $(Get-Date -Format 'HHmmss')"
        description = "Operational test"
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

    $headers = @{
        "x-api-key" = "test-key-for-development"
        "Content-Type" = "application/json"
    }

    $create = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios" -Method Post -Headers $headers -Body $body -TimeoutSec 5
    
    if ($create.id) {
        # Try to retrieve it
        $get = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios/$($create.id)" -Method Get -Headers $headers -TimeoutSec 5
        
        if ($get.id -eq $create.id) {
            Write-Host "   PASS - Can create and retrieve data" -ForegroundColor Green
            $score++
            
            # Cleanup
            try {
                Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios/$($create.id)" -Method Delete -Headers $headers -TimeoutSec 5 | Out-Null
            } catch {}
        } else {
            Write-Host "   FAIL - Data retrieval failed" -ForegroundColor Red
        }
    } else {
        Write-Host "   FAIL - Cannot create data" -ForegroundColor Red
    }
} catch {
    Write-Host "   FAIL - Workflow error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Build System
Write-Host "`n5. BUILD SYSTEM:" -ForegroundColor Yellow
$buildFiles = @(
    "docker-compose.yml",
    "services/emc2-core/package.json",
    "services/emc2-core/Dockerfile"
)
$buildOk = $true
foreach ($file in $buildFiles) {
    if (-not (Test-Path $file)) {
        $buildOk = $false
        break
    }
}
if ($buildOk) {
    Write-Host "   PASS - Build configuration exists" -ForegroundColor Green
    $score++
} else {
    Write-Host "   FAIL - Missing build files" -ForegroundColor Red
}

# Test 6: Code Quality
Write-Host "`n6. CODE STRUCTURE:" -ForegroundColor Yellow
$hasRoutes = Test-Path "services/emc2-core/src/routes"
$hasDatabase = Test-Path "database/migrations"
$hasServices = Test-Path "services/emc2-core/src/services"

if ($hasRoutes -and ($hasDatabase -or $hasServices)) {
    Write-Host "   PASS - Proper code structure exists" -ForegroundColor Green
    $score++
} else {
    Write-Host "   FAIL - Missing core code structure" -ForegroundColor Red
}

# Results
Write-Host "`n============================================" -ForegroundColor Magenta
$percent = [math]::Round(($score / $total) * 100)
Write-Host "OPERATIONAL SCORE: $score/$total ($percent%)" -ForegroundColor White

if ($percent -eq 100) {
    Write-Host "`nEXCELLENT! System is fully operational!" -ForegroundColor Green
    Write-Host "Ready for feature development and deployment." -ForegroundColor Green
} elseif ($percent -ge 67) {
    Write-Host "`nPARTIALLY OPERATIONAL - Fix the failures above" -ForegroundColor Yellow
    Write-Host "System can run but needs attention." -ForegroundColor Yellow
} else {
    Write-Host "`nNOT OPERATIONAL! Too many failures!" -ForegroundColor Red
    Write-Host "Fix infrastructure issues before proceeding." -ForegroundColor Red
}

Write-Host "`nReminder: A working system is better than perfect code!" -ForegroundColor Cyan
