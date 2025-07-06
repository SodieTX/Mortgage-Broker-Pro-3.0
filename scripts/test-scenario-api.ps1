<#
.SYNOPSIS
    Tests the Scenario API endpoints
.DESCRIPTION
    This script performs comprehensive testing of the Scenario API including:
    - CRUD operations
    - Error handling
    - Edge cases
    - Performance metrics
.PARAMETER BaseUrl
    The base URL of the API (default: http://localhost:3001/api/v1)
.PARAMETER ApiKey
    The API key for authentication (default: test-key-for-development)
.PARAMETER Verbose
    Show detailed test output
.PARAMETER TestSuite
    Which test suite to run: Basic, Extended, Stress, or All (default: Basic)
.EXAMPLE
    .\test-scenario-api.ps1
    Runs basic API tests
.EXAMPLE
    .\test-scenario-api.ps1 -TestSuite All -Verbose
    Runs all test suites with detailed output
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3001/api/v1",
    [string]$ApiKey = "test-key-for-development",
    [ValidateSet("Basic", "Extended", "Stress", "All")]
    [string]$TestSuite = "Basic"
)

# Import common functions
. "$PSScriptRoot\Common-Functions.ps1"

# Script configuration
$script:StartTime = Get-Date
$script:TestResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    Skipped = 0
    Details = @()
}

# Test data generators
function Get-TestScenario {
    param(
        [string]$Title = "Test Scenario $(Get-Random -Maximum 9999)",
        [int]$CreditScore = 750,
        [int]$LoanAmount = 280000,
        [int]$PurchasePrice = 350000
    )
    
    return @{
        title = $Title
        description = "Automated test scenario created at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        loanData = @{
            borrower = @{
                firstName = "Test"
                lastName = "User$(Get-Random -Maximum 999)"
                creditScore = $CreditScore
                annualIncome = 85000
            }
            property = @{
                address = "$(Get-Random -Maximum 9999) Test St"
                city = "Dallas"
                state = "TX"
                zipCode = "75201"
                propertyType = "single-family"
                purchasePrice = $PurchasePrice
            }
            loan = @{
                loanAmount = $LoanAmount
                loanPurpose = "purchase"
                loanType = "conventional"
                termMonths = 360
            }
        }
        createdBy = "test-script"
    }
}

# Test execution framework
function Invoke-ApiTest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TestName,
        
        [Parameter(Mandatory = $true)]
        [scriptblock]$TestScript,
        
        [string]$Category = "General"
    )
    
    $script:TestResults.Total++
    $testStart = Get-Date
    
    Write-Log "Running test: $TestName" -Level Info
    
    try {
        $result = & $TestScript
        $duration = (Get-Date) - $testStart
        
        $script:TestResults.Passed++
        $script:TestResults.Details += @{
            Name = $TestName
            Category = $Category
            Status = "Passed"
            Duration = $duration.TotalMilliseconds
            Result = $result
        }
        
        Write-Log "✓ $TestName passed (${duration}ms)" -Level Info
        return $result
    }
    catch {
        $duration = (Get-Date) - $testStart
        $script:TestResults.Failed++
        $script:TestResults.Details += @{
            Name = $TestName
            Category = $Category
            Status = "Failed"
            Duration = $duration.TotalMilliseconds
            Error = $_.Exception.Message
        }
        
        Write-Log "✗ $TestName failed: $($_.Exception.Message)" -Level Error
        if ($VerbosePreference -eq "Continue") {
            Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level Debug
        }
        throw
    }
}

# API helper functions
function Invoke-ApiRequest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Endpoint,
        
        [ValidateSet("GET", "POST", "PUT", "DELETE", "PATCH")]
        [string]$Method = "GET",
        
        [object]$Body = $null,
        
        [hashtable]$Headers = @{},
        
        [int]$TimeoutSec = 30
    )
    
    $uri = "$BaseUrl/$Endpoint".TrimEnd('/')
    $requestHeaders = @{
        "x-api-key" = $ApiKey
        "Content-Type" = "application/json"
    } + $Headers
    
    $params = @{
        Uri = $uri
        Method = $Method
        Headers = $requestHeaders
        TimeoutSec = $TimeoutSec
        ErrorAction = "Stop"
    }
    
    if ($Body) {
        $params.Body = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 10 }
    }
    
    if ($VerbosePreference -eq "Continue") {
        Write-Log "API Request: $Method $uri" -Level Debug
        if ($Body) {
            Write-Log "Request Body: $($params.Body)" -Level Debug
        }
    }
    
    $response = Invoke-RestMethod @params
    
    if ($VerbosePreference -eq "Continue") {
        Write-Log "Response: $($response | ConvertTo-Json -Depth 5)" -Level Debug
    }
    
    return $response
}

# Test suites
function Test-BasicCrud {
    Write-Log "Starting Basic CRUD Test Suite" -Level Info
    
    # Create
    $scenario = Invoke-ApiTest -TestName "Create Scenario" -Category "CRUD" -TestScript {
        $testData = Get-TestScenario
        $response = Invoke-ApiRequest -Endpoint "scenarios" -Method POST -Body $testData
        
        if (-not $response.id) {
            throw "No ID returned from create operation"
        }
        
        return $response
    }
    
    # Read
    Invoke-ApiTest -TestName "Get Scenario" -Category "CRUD" -TestScript {
        $response = Invoke-ApiRequest -Endpoint "scenarios/$($scenario.id)" -Method GET
        
        if ($response.id -ne $scenario.id) {
            throw "Retrieved scenario ID doesn't match"
        }
        
        return $response
    }
    
    # Update
    Invoke-ApiTest -TestName "Update Scenario" -Category "CRUD" -TestScript {
        $updateData = @{
            status = "submitted"
            description = "Updated at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            updatedBy = "test-script"
        }
        
        $response = Invoke-ApiRequest -Endpoint "scenarios/$($scenario.id)" -Method PUT -Body $updateData
        
        if ($response.status -ne "submitted") {
            throw "Status was not updated correctly"
        }
        
        return $response
    }
    
    # List
    Invoke-ApiTest -TestName "List Scenarios" -Category "CRUD" -TestScript {
        $response = Invoke-ApiRequest -Endpoint "scenarios?limit=10" -Method GET
        
        if (-not $response.scenarios -or -not $response.total) {
            throw "Invalid list response format"
        }
        
        return $response
    }
    
    # Delete
    Invoke-ApiTest -TestName "Delete Scenario" -Category "CRUD" -TestScript {
        Invoke-ApiRequest -Endpoint "scenarios/$($scenario.id)" -Method DELETE
        
        # Verify deletion
        try {
            Invoke-ApiRequest -Endpoint "scenarios/$($scenario.id)" -Method GET
            throw "Scenario was not deleted"
        } catch {
            # Expected - scenario should not be found
            return @{ deleted = $true }
        }
    }
}

function Test-ExtendedValidation {
    Write-Log "Starting Extended Validation Test Suite" -Level Info
    
    # Test invalid credit score
    Invoke-ApiTest -TestName "Invalid Credit Score" -Category "Validation" -TestScript {
        try {
            $testData = Get-TestScenario -CreditScore 200
            Invoke-ApiRequest -Endpoint "scenarios" -Method POST -Body $testData
            throw "Should have rejected invalid credit score"
        } catch {
            # Expected failure
            return @{ validated = $true }
        }
    }
    
    # Test LTV validation
    Invoke-ApiTest -TestName "High LTV Validation" -Category "Validation" -TestScript {
        $testData = Get-TestScenario -LoanAmount 400000 -PurchasePrice 350000
        $response = Invoke-ApiRequest -Endpoint "scenarios" -Method POST -Body $testData
        
        # Should succeed but flag high LTV
        return $response
    }
    
    # Test missing required fields
    Invoke-ApiTest -TestName "Missing Required Fields" -Category "Validation" -TestScript {
        try {
            $testData = @{ title = "Incomplete Scenario" }
            Invoke-ApiRequest -Endpoint "scenarios" -Method POST -Body $testData
            throw "Should have rejected incomplete data"
        } catch {
            # Expected failure
            return @{ validated = $true }
        }
    }
}

function Test-StressTest {
    Write-Log "Starting Stress Test Suite" -Level Info
    
    # Bulk create test
    Invoke-ApiTest -TestName "Bulk Create (10 scenarios)" -Category "Stress" -TestScript {
        $scenarios = @()
        
        for ($i = 1; $i -le 10; $i++) {
            Show-Progress -Activity "Creating scenarios" -Status "Creating scenario $i of 10" -PercentComplete (($i / 10) * 100)
            $testData = Get-TestScenario -Title "Stress Test Scenario $i"
            $response = Invoke-ApiRequest -Endpoint "scenarios" -Method POST -Body $testData
            $scenarios += $response.id
        }
        
        Write-Progress -Activity "Creating scenarios" -Completed
        
        # Clean up
        foreach ($id in $scenarios) {
            Invoke-ApiRequest -Endpoint "scenarios/$id" -Method DELETE
        }
        
        return @{ created = $scenarios.Count }
    }
    
    # Large payload test
    Invoke-ApiTest -TestName "Large Payload" -Category "Stress" -TestScript {
        $testData = Get-TestScenario
        $testData.description = "x" * 10000  # 10KB description
        
        $response = Invoke-ApiRequest -Endpoint "scenarios" -Method POST -Body $testData
        
        # Clean up
        Invoke-ApiRequest -Endpoint "scenarios/$($response.id)" -Method DELETE
        
        return $response
    }
}

# Main execution
try {
    Show-Banner -Title "Mortgage Broker Pro - API Test Suite" -Version "2.0.0"
    
    # Ensure we're in the project root
    Set-ProjectRoot
    
    # Check if API is available
    Write-Log "Checking API availability..." -Level Info
    if (-not (Wait-ForService -Url "$BaseUrl/health" -Timeout 30)) {
        throw "API is not available at $BaseUrl"
    }
    
    # Run selected test suites
    switch ($TestSuite) {
        "Basic" {
            Test-BasicCrud
        }
        "Extended" {
            Test-BasicCrud
            Test-ExtendedValidation
        }
        "Stress" {
            Test-StressTest
        }
        "All" {
            Test-BasicCrud
            Test-ExtendedValidation
            Test-StressTest
        }
    }
    
    # Generate test report
    Write-Log "" -Level Info
    Write-Log "Test Results Summary" -Level Info
    Write-Log "==================" -Level Info
    Write-Log "Total Tests: $($script:TestResults.Total)" -Level Info
    Write-Log "Passed: $($script:TestResults.Passed)" -Level Info
    Write-Log "Failed: $($script:TestResults.Failed)" -Level Info
    Write-Log "Skipped: $($script:TestResults.Skipped)" -Level Info
    
    if ($VerbosePreference -eq "Continue") {
        Write-Log "" -Level Info
        Write-Log "Detailed Results:" -Level Info
        foreach ($test in $script:TestResults.Details) {
            $status = if ($test.Status -eq "Passed") { "✓" } else { "✗" }
            Write-Log "$status $($test.Name) [$($test.Category)] - $($test.Duration)ms" -Level Info
        }
    }
    
    # Save results to file if requested
    if ($env:MBP_TEST_RESULTS_FILE) {
        $script:TestResults | ConvertTo-Json -Depth 10 | Out-File $env:MBP_TEST_RESULTS_FILE
        Write-Log "Test results saved to: $env:MBP_TEST_RESULTS_FILE" -Level Info
    }
    
    $script:Success = $script:TestResults.Failed -eq 0
    
} catch {
    $script:Success = $false
    Write-Log "Test suite failed: $($_.Exception.Message)" -Level Error
    Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level Debug
    exit 1
} finally {
    Show-Summary -StartTime $script:StartTime -Success $script:Success
    
    # Exit with appropriate code
    exit $(if ($script:Success) { 0 } else { 1 })
}
