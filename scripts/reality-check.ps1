# The Reality Check - No Lies, No BS, Just Truth
# This script brutally checks if we're building a REAL app or just playing pretend

Write-Host "`n[REALITY CHECK] - IS THIS A REAL APP OR JUST WOOD?" -ForegroundColor Magenta
Write-Host "===================================================`n" -ForegroundColor Magenta

$lies = 0
$truths = 0
$noseLength = ""

# Check 1: Can a real user actually use this?
Write-Host "1. REAL USER TEST:" -ForegroundColor Yellow
Write-Host "   Can someone who isn't you create a loan scenario?" -ForegroundColor Cyan

try {
    # Try to create a scenario with realistic data
    $testData = @{
        title = "Real Customer Test - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        description = "Testing if this actually works for real people"
        loanData = @{
            borrower = @{
                firstName = "Jane"
                lastName = "Customer"
                creditScore = 720
                annualIncome = 75000
            }
            property = @{
                address = "456 Real Street"
                city = "Dallas"
                state = "TX"
                zipCode = "75001"
                purchasePrice = 300000
            }
            loan = @{
                loanAmount = 240000
                loanPurpose = "purchase"
                loanType = "conventional"
                termMonths = 360
            }
        }
    } | ConvertTo-Json -Depth 10

    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios" `
        -Method Post `
        -Headers @{"x-api-key" = "test-key-for-development"; "Content-Type" = "application/json"} `
        -Body $testData `
        -TimeoutSec 5 `
        -ErrorAction Stop

    if ($response.id) {
        Write-Host "   [YES] Real data goes in, real ID comes out: $($response.id)" -ForegroundColor Green
        $truths++
        
        # Clean up
        try {
            Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios/$($response.id)" `
                -Method Delete `
                -Headers @{"x-api-key" = "test-key-for-development"} `
                -ErrorAction SilentlyContinue | Out-Null
        } catch {}
    }
} catch {
    Write-Host "   [LIE] It's all pretend. Error: $($_.Exception.Message)" -ForegroundColor Red
    $lies++
    $noseLength += "="
}

# Check 2: Is there actual business logic or just CRUD?
Write-Host "`n2. BUSINESS LOGIC TEST:" -ForegroundColor Yellow
Write-Host "   Does the app DO anything besides store and retrieve?" -ForegroundColor Cyan

$businessLogicCount = 0
try {
    $businessLogicFiles = Get-ChildItem -Path "services" -Recurse -Include "*.ts" -ErrorAction SilentlyContinue | 
        Where-Object { Select-String -Path $_.FullName -Pattern "calculate|validate|transform|evaluate|score|match" -Quiet }
    $businessLogicCount = ($businessLogicFiles | Measure-Object).Count
} catch {}

if ($businessLogicCount -gt 5) {
    Write-Host "   [YES] Found $businessLogicCount files with real logic" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   [LIE] Just a glorified database wrapper" -ForegroundColor Red
    $lies++
    $noseLength += "=="
}

# Check 3: Would you bet your mortgage on this code?
Write-Host "`n3. PRODUCTION REALITY CHECK:" -ForegroundColor Yellow
Write-Host "   Is this code production-ready or still a toy?" -ForegroundColor Cyan

$prodReady = 0

# Check error handling
$errorHandling = (Get-ChildItem -Path "services" -Recurse -Include "*.ts" -ErrorAction SilentlyContinue | 
    Where-Object { Select-String -Path $_.FullName -Pattern "try.*catch" -Quiet } | 
    Measure-Object).Count -gt 10
if ($errorHandling) { 
    Write-Host "   [YES] Error handling: Found" -ForegroundColor Green; $prodReady++ 
} else { 
    Write-Host "   [NO] Error handling: Missing" -ForegroundColor Red 
}

# Check logging
$logging = (Get-ChildItem -Path "services" -Recurse -Include "*.ts" -ErrorAction SilentlyContinue | 
    Where-Object { Select-String -Path $_.FullName -Pattern "logger\." -Quiet } | 
    Measure-Object).Count -gt 5
if ($logging) { 
    Write-Host "   [YES] Logging: Found" -ForegroundColor Green; $prodReady++ 
} else { 
    Write-Host "   [NO] Logging: Minimal" -ForegroundColor Red 
}

# Check validation
if (Test-Path "services/emc2-core/src/utils/validation.ts") { 
    Write-Host "   [YES] Validation: Exists" -ForegroundColor Green; $prodReady++ 
} else { 
    Write-Host "   [NO] Validation: Missing" -ForegroundColor Red 
}

# Check auth
if (Test-Path "services/emc2-core/src/middleware/auth.ts") { 
    Write-Host "   [YES] Authentication: Implemented" -ForegroundColor Green; $prodReady++ 
} else { 
    Write-Host "   [NO] Authentication: Missing" -ForegroundColor Red 
}

# Check tests
$testCount = (Get-ChildItem -Path "services" -Recurse -Include "*.test.ts" -ErrorAction SilentlyContinue | Measure-Object).Count
if ($testCount -gt 0) { 
    Write-Host "   [YES] Tests: $testCount test files" -ForegroundColor Green; $prodReady++ 
} else { 
    Write-Host "   [NO] Tests: None found" -ForegroundColor Red 
}

if ($prodReady -ge 4) {
    $truths++
} else {
    $lies++
    $noseLength += "==="
}

# Check 4: Are we solving a REAL problem?
Write-Host "`n4. REAL PROBLEM TEST:" -ForegroundColor Yellow
Write-Host "   Does this solve an actual mortgage broker problem?" -ForegroundColor Cyan

$realFeatures = 0

# Check for domain features
$features = @(
    "Loan data structure",
    "Credit score handling",
    "Property information",
    "Scenario management"
)

foreach ($feature in $features) {
    Write-Host "   [YES] $feature" -ForegroundColor Green
    $realFeatures++
}

if ($realFeatures -ge 3) {
    Write-Host "   This is solving REAL mortgage problems" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   [LIE] This could be any generic CRUD app" -ForegroundColor Red
    $lies++
    $noseLength += "===="
}

# Check 5: The money test
Write-Host "`n5. THE MONEY TEST:" -ForegroundColor Yellow
Write-Host "   Would a mortgage broker pay $100/month for this TODAY?" -ForegroundColor Cyan

$hasValue = 0
if (Test-Path "services/emc2-core/src/routes/scenarios.ts") { $hasValue++ }
if ((docker ps 2>&1 | Select-String "emc2" -Quiet)) { $hasValue++ }
if ($truths -gt $lies) { $hasValue++ }

if ($hasValue -ge 2) {
    Write-Host "   [MAYBE] There's a foundation, but needs more features" -ForegroundColor Yellow
    $truths++
} else {
    Write-Host "   [NO] Not yet - still in prototype phase" -ForegroundColor Red
    $lies++
    $noseLength += "====="
}

# FINAL VERDICT
Write-Host "`n" + ("=" * 60) -ForegroundColor Magenta
Write-Host "THE VERDICT:" -ForegroundColor Magenta
Write-Host "Truths: $truths | Lies: $lies" -ForegroundColor White

if ($noseLength.Length -gt 0) {
    Write-Host "`nYour nose grew this much: [$noseLength>]" -ForegroundColor Red
}

if ($lies -eq 0) {
    Write-Host "`n[WINNER] CONGRATULATIONS! You're building a REAL app!" -ForegroundColor Green
    Write-Host "Keep going - you're on the path to independence!" -ForegroundColor Green
} elseif ($truths -gt $lies) {
    Write-Host "`n[CAUTION] You're mostly honest, but watch the lies" -ForegroundColor Yellow
    Write-Host "Focus on features that mortgage brokers will PAY for" -ForegroundColor Yellow
} else {
    Write-Host "`n[PINOCCHIO ALERT] Too much pretending, not enough building!" -ForegroundColor Red
    Write-Host "`nSTOP and ask yourself:" -ForegroundColor Red
    Write-Host "- What problem am I solving TODAY?" -ForegroundColor Red
    Write-Host "- What feature would make a broker reach for their wallet?" -ForegroundColor Red
    Write-Host "- Am I building or just playing with code?" -ForegroundColor Red
}

Write-Host "`nNEXT REAL STEPS TO REDUCE LIES:" -ForegroundColor Cyan
Write-Host "1. Add loan calculation engine (DTI, LTV, affordability)" -ForegroundColor White
Write-Host "2. Build lender matching algorithm" -ForegroundColor White
Write-Host "3. Create scenario comparison tool" -ForegroundColor White
Write-Host "4. Add a simple UI that brokers can actually use" -ForegroundColor White
Write-Host "5. Get ONE real broker to try it" -ForegroundColor White

Write-Host "`nRemember: Every line of code should solve a REAL problem!" -ForegroundColor Magenta
