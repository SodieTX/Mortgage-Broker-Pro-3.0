# The Pinocchio Check - No Lies, No BS, Just Truth
# This script brutally checks if we're building a REAL app or just playing pretend

Write-Host "`n🤥 PINOCCHIO CHECK - IS THIS A REAL APP OR JUST WOOD?" -ForegroundColor Magenta
Write-Host "=====================================================`n" -ForegroundColor Magenta

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
        -TimeoutSec 5

    if ($response.id) {
        Write-Host "   ✓ YES - Real data goes in, real ID comes out: $($response.id)" -ForegroundColor Green
        $truths++
        
        # Clean up
        Invoke-RestMethod -Uri "http://localhost:3001/api/v1/scenarios/$($response.id)" `
            -Method Delete `
            -Headers @{"x-api-key" = "test-key-for-development"} | Out-Null
    }
} catch {
    Write-Host "   🤥 NO - It's all pretend. Error: $($_.Exception.Message)" -ForegroundColor Red
    $lies++
    $noseLength += "="
}

# Check 2: Is there actual business logic or just CRUD?
Write-Host "`n2. BUSINESS LOGIC TEST:" -ForegroundColor Yellow
Write-Host "   Does the app DO anything besides store and retrieve?" -ForegroundColor Cyan

$businessLogicFiles = Get-ChildItem -Path "services" -Recurse -Include "*.ts" | 
    Select-String -Pattern "calculate|validate|transform|evaluate|score|match" -List

if ($businessLogicFiles.Count -gt 5) {
    Write-Host "   ✓ Found $($businessLogicFiles.Count) files with real logic" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 Just a glorified database wrapper" -ForegroundColor Red
    $lies++
    $noseLength += "=="
}

# Check 3: Would you bet your mortgage on this code?
Write-Host "`n3. PRODUCTION REALITY CHECK:" -ForegroundColor Yellow
Write-Host "   Is this code production-ready or still a toy?" -ForegroundColor Cyan

$productionChecks = @{
    "Error handling" = (Get-ChildItem -Path "services" -Recurse -Include "*.ts" | Select-String -Pattern "try.*catch" -List).Count -gt 10
    "Logging" = (Get-ChildItem -Path "services" -Recurse -Include "*.ts" | Select-String -Pattern "logger\." -List).Count -gt 5
    "Validation" = Test-Path "services/emc2-core/src/utils/validation.ts"
    "Authentication" = Test-Path "services/emc2-core/src/middleware/auth.ts"
    "Tests exist" = (Get-ChildItem -Path "services" -Recurse -Include "*.test.ts").Count -gt 0
}

$prodReady = 0
foreach ($check in $productionChecks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "   ✓ $($check.Key): YES" -ForegroundColor Green
        $prodReady++
    } else {
        Write-Host "   🤥 $($check.Key): NO" -ForegroundColor Red
    }
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

# Check for domain-specific functionality
$domainFeatures = @{
    "Loan calculations" = (Select-String -Path "services/**/*.ts" -Pattern "loan.*amount|interest|payment" -List -ErrorAction SilentlyContinue).Count
    "Credit checks" = (Select-String -Path "services/**/*.ts" -Pattern "credit.*score|creditScore" -List -ErrorAction SilentlyContinue).Count
    "Property validation" = (Select-String -Path "services/**/*.ts" -Pattern "property|address|zipCode" -List -ErrorAction SilentlyContinue).Count
    "Lender matching" = (Select-String -Path "database/**/*.sql" -Pattern "lender|match|evaluate" -List -ErrorAction SilentlyContinue).Count
}

$realFeatures = 0
foreach ($feature in $domainFeatures.GetEnumerator()) {
    if ($feature.Value -gt 0) {
        Write-Host "   ✓ $($feature.Key): Found" -ForegroundColor Green
        $realFeatures++
    }
}

if ($realFeatures -ge 3) {
    Write-Host "   This is solving REAL mortgage problems" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 This could be any generic CRUD app" -ForegroundColor Red
    $lies++
    $noseLength += "===="
}

# Check 5: Are we making progress or just shuffling files?
Write-Host "`n5. PROGRESS CHECK:" -ForegroundColor Yellow
Write-Host "   What have we ACTUALLY built in the last commits?" -ForegroundColor Cyan

$recentCommits = git log --oneline -10 2>&1
$meaningfulCommits = $recentCommits | Select-String -Pattern "feature|implement|add.*functionality|fix.*bug|improve" -AllMatches

if ($meaningfulCommits.Count -ge 5) {
    Write-Host "   ✓ Recent commits show real progress" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 Just moving files around" -ForegroundColor Red
    $lies++
    $noseLength += "====="
}

# Check 6: The money test
Write-Host "`n6. THE MONEY TEST:" -ForegroundColor Yellow
Write-Host "   Would a mortgage broker pay $100/month for this TODAY?" -ForegroundColor Cyan

$valueFeatures = @(
    (Test-Path "services/emc2-core/src/routes/scenarios.ts"),  # Can create scenarios
    ((docker ps --format "{{.Names}}" | Select-String "emc2").Count -gt 0),  # Service running
    ($truths -gt $lies)  # More truth than lies
)

$hasValue = ($valueFeatures | Where-Object { $_ -eq $true }).Count

if ($hasValue -ge 2) {
    Write-Host "   ✓ There's something here worth paying for" -ForegroundColor Green
    $truths++
} else {
    Write-Host "   🤥 Not yet - still in toy territory" -ForegroundColor Red
    $lies++
    $noseLength += "======"
}

# FINAL VERDICT
Write-Host "`n" + ("=" * 60) -ForegroundColor Magenta
Write-Host "THE VERDICT:" -ForegroundColor Magenta
Write-Host "Truths: $truths | Lies: $lies" -ForegroundColor White

if ($noseLength.Length -gt 0) {
    Write-Host "`nYour nose is this long: 👃$noseLength>" -ForegroundColor Red
}

if ($lies -eq 0) {
    Write-Host "`n🎉 CONGRATULATIONS! You're building a REAL app!" -ForegroundColor Green
    Write-Host "Keep going - you're on the path to independence!" -ForegroundColor Green
} elseif ($truths -gt $lies) {
    Write-Host "`n⚠️  You're mostly honest, but watch out for the lies" -ForegroundColor Yellow
    Write-Host "Focus on features that mortgage brokers will PAY for" -ForegroundColor Yellow
} else {
    Write-Host "`n🤥 PINOCCHIO ALERT! Too much pretending, not enough building!" -ForegroundColor Red
    Write-Host "`nSTOP and ask yourself:" -ForegroundColor Red
    Write-Host "- What problem am I solving TODAY?" -ForegroundColor Red
    Write-Host "- What feature would make a broker reach for their wallet?" -ForegroundColor Red
    Write-Host "- Am I building or just playing with code?" -ForegroundColor Red
}

Write-Host "`n💡 NEXT REAL STEPS:" -ForegroundColor Cyan
if ($lies -gt 0) {
    Write-Host "1. Build ONE feature a broker would actually use" -ForegroundColor White
    Write-Host "2. Test it with fake broker scenarios" -ForegroundColor White
    Write-Host "3. Make it fast enough for 100 concurrent users" -ForegroundColor White
    Write-Host "4. Add the UI that makes it sellable" -ForegroundColor White
}

Write-Host "`nRemember: Every line of code should move you closer to charging money!" -ForegroundColor Magenta
