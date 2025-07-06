# Test Calculations API

Write-Host "Testing Mortgage Broker Pro Calculations API" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Test 1: Simple Payment Calculation
Write-Host "`nTest 1: Simple Payment Calculation" -ForegroundColor Yellow
$paymentBody = @{
    principal = 400000
    annualRate = 6.5
    termMonths = 360
} | ConvertTo-Json

$paymentResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/calculations/payment" `
    -Method POST `
    -Body $paymentBody `
    -ContentType "application/json"

Write-Host "Monthly Payment: `$$($paymentResponse.data.monthlyPayment)"
Write-Host "Total Interest: `$$($paymentResponse.data.totalInterest)"

# Test 2: DSCR Calculation
Write-Host "`nTest 2: DSCR Calculation for Investment Property" -ForegroundColor Yellow
$dscrBody = @{
    property = @{
        monthlyRent = 4500
        vacancyRate = 0.05
        propertyTaxes = 6000
        insurance = 1800
        hoaFees = 200
        maintenance = 150
        managementRate = 0.08
    }
    loanAmount = 400000
    interestRate = 6.5
    termMonths = 360
    purchasePrice = 500000
    closingCosts = 10000
} | ConvertTo-Json -Depth 3

$dscrResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/calculations/dscr" `
    -Method POST `
    -Body $dscrBody `
    -ContentType "application/json"

Write-Host "DSCR: $($dscrResponse.data.dscr.dscr)"
Write-Host "Loan Approved: $($dscrResponse.data.dscr.loanApproved)"
Write-Host "Net Operating Income: `$$($dscrResponse.data.dscr.netOperatingIncome)"
Write-Host "Annual Cash Flow: `$$($dscrResponse.data.dscr.cashFlow)"
Write-Host "Cap Rate: $($dscrResponse.data.investment.capRate)%"
Write-Host "Cash-on-Cash Return: $($dscrResponse.data.investment.cashOnCashReturn)%"

# Test 3: Quick Qualification
Write-Host "`nTest 3: Quick Pre-Qualification" -ForegroundColor Yellow
$qualifyBody = @{
    annualIncome = 120000
    creditScore = 720
    downPaymentPercent = 20
} | ConvertTo-Json

$qualifyResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/calculations/quick-qualify" `
    -Method POST `
    -Body $qualifyBody `
    -ContentType "application/json"

Write-Host "Likely Approved: $($qualifyResponse.data.likelyApproved)"
Write-Host "Max Purchase Price: `$$($qualifyResponse.data.estimatedMaxPurchase)"
Write-Host "Recommended Programs: $($qualifyResponse.data.recommendedPrograms -join ', ')"

# Test 4: Loan Metrics
Write-Host "`nTest 4: Comprehensive Loan Metrics" -ForegroundColor Yellow
$metricsBody = @{
    loanAmount = 350000
    propertyValue = 450000
    borrowerIncome = 95000
    existingMonthlyDebt = 500
    interestRate = 6.75
    termMonths = 360
} | ConvertTo-Json

$metricsResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/calculations/loan-metrics" `
    -Method POST `
    -Body $metricsBody `
    -ContentType "application/json"

Write-Host "LTV: $($metricsResponse.data.loanToValue)%"
Write-Host "DTI: $($metricsResponse.data.debtToIncome)%"
Write-Host "Affordability Score: $($metricsResponse.data.affordabilityScore)"
Write-Host "Max Loan Amount: `$$($metricsResponse.data.maxLoanAmount)"
if ($metricsResponse.data.recommendations) {
    Write-Host "Recommendations:"
    $metricsResponse.data.recommendations | ForEach-Object { Write-Host "  - $_" }
}

# Test 5: DSCR Stress Test
Write-Host "`nTest 5: DSCR Stress Test" -ForegroundColor Yellow
$stressTestBody = @{
    property = @{
        monthlyRent = 3500
        vacancyRate = 0.05
        propertyTaxes = 5500
        insurance = 1600
        maintenance = 150
        managementRate = 0.08
    }
    loanAmount = 350000
    interestRate = 6.5
    termMonths = 360
    scenarios = @{
        rentDecrease = 10
        vacancyIncrease = 5
        expenseIncrease = 15
        rateIncrease = 1
    }
} | ConvertTo-Json -Depth 3

$stressResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/calculations/dscr-stress-test" `
    -Method POST `
    -Body $stressTestBody `
    -ContentType "application/json"

Write-Host "Baseline DSCR: $($stressResponse.data.baseline.dscr)"
Write-Host "Stressed DSCR: $($stressResponse.data.stressed.dscr)"
Write-Host "Risk Level: $($stressResponse.data.riskAssessment.level)"
Write-Host "Max Safe Rent Decrease: $($stressResponse.data.riskAssessment.maxSafeRentDecrease)"
Write-Host "Stress Test Passed: $($stressResponse.data.riskAssessment.stressTestPassed)"

Write-Host "`nAll tests completed!" -ForegroundColor Green
