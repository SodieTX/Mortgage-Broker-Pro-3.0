# Test Scenario API
Write-Host "Testing Scenario API..." -ForegroundColor Yellow
Write-Host ""

$baseUrl = "http://localhost:3001/api/v1"

# Test 1: Create a scenario
Write-Host "Test 1: Creating a scenario" -ForegroundColor Cyan
$createData = @{
    title = "First Test Scenario"
    description = "This is a test scenario created via API"
    loanData = @{
        borrower = @{
            firstName = "John"
            lastName = "Smith"
            creditScore = 750
            annualIncome = 85000
        }
        property = @{
            address = "123 Main St"
            city = "Dallas"
            state = "TX"
            zipCode = "75201"
            propertyType = "single-family"
            purchasePrice = 350000
        }
        loan = @{
            loanAmount = 280000
            loanPurpose = "purchase"
            loanType = "conventional"
            termMonths = 360
        }
    }
    createdBy = "test-script"
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/scenarios" -Method Post -Body $createData -ContentType "application/json"
    Write-Host "SUCCESS: Scenario created" -ForegroundColor Green
    $scenarioId = $response.id
    Write-Host "Scenario ID: $scenarioId"
    $response | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "ERROR: Failed to create scenario" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host ""

# Test 2: Get the created scenario
Write-Host "Test 2: Getting the created scenario" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/scenarios/$scenarioId" -Method Get
    Write-Host "SUCCESS: Retrieved scenario" -ForegroundColor Green
    Write-Host "Title: $($response.title)"
    Write-Host "Status: $($response.status)"
} catch {
    Write-Host "ERROR: Failed to get scenario" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""

# Test 3: Update the scenario
Write-Host "Test 3: Updating the scenario" -ForegroundColor Cyan
$updateData = @{
    status = "submitted"
    description = "Updated description"
    updatedBy = "test-script"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/scenarios/$scenarioId" -Method Put -Body $updateData -ContentType "application/json"
    Write-Host "SUCCESS: Scenario updated" -ForegroundColor Green
    Write-Host "New status: $($response.status)"
} catch {
    Write-Host "ERROR: Failed to update scenario" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""

# Test 4: List scenarios
Write-Host "Test 4: Listing scenarios" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/scenarios?limit=10" -Method Get
    Write-Host "SUCCESS: Retrieved scenario list" -ForegroundColor Green
    Write-Host "Total scenarios: $($response.total)"
    Write-Host "Retrieved: $($response.scenarios.Count)"
} catch {
    Write-Host "ERROR: Failed to list scenarios" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""

# Test 5: Delete the scenario
Write-Host "Test 5: Deleting the scenario" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$baseUrl/scenarios/$scenarioId" -Method Delete
    Write-Host "SUCCESS: Scenario deleted" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to delete scenario" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "API tests completed!" -ForegroundColor Green
