<#
.SYNOPSIS
    Runs tests for Mortgage Broker Pro services with coverage reporting
.DESCRIPTION
    This script runs Jest tests for specified services with comprehensive
    coverage reporting. It can run tests for individual services or all
    services, generate coverage reports, and optionally open them in a browser.
.PARAMETER Service
    The service to test (emc2-core, hermes, athena, janus, or all)
.PARAMETER Coverage
    Generate coverage report (default: true)
.PARAMETER Watch
    Run tests in watch mode
.PARAMETER UpdateSnapshots
    Update Jest snapshots
.PARAMETER OpenReport
    Open coverage report in browser after completion
.PARAMETER FailureThreshold
    Set custom coverage threshold (overrides jest.config.js)
.EXAMPLE
    .\run-tests.ps1 -Service emc2-core
    Runs tests for EMC² Core service with coverage
.EXAMPLE
    .\run-tests.ps1 -Service all -OpenReport
    Runs all tests and opens coverage report
#>
[CmdletBinding()]
param(
    [ValidateSet("emc2-core", "hermes", "athena", "janus", "all")]
    [string]$Service = "emc2-core",
    
    [switch]$Coverage = $true,
    
    [switch]$Watch,
    
    [switch]$UpdateSnapshots,
    
    [switch]$OpenReport,
    
    [int]$FailureThreshold = 0,
    
    [string]$TestPattern = ""
)

# Import common functions
. "$PSScriptRoot\Common-Functions.ps1"

# Script configuration
$script:StartTime = Get-Date
$script:Success = $true
$script:TestResults = @{}

# Service configurations
$script:Services = @{
    "emc2-core" = @{
        Path = "services/emc2-core"
        Name = "EMC² Core Service"
    }
    "hermes" = @{
        Path = "services/hermes-service"
        Name = "Hermes Data Service"
    }
    "athena" = @{
        Path = "services/athena-service"
        Name = "Athena Matching Engine"
    }
    "janus" = @{
        Path = "services/janus-service"
        Name = "Janus Pattern Recognition"
    }
}

function Test-ServiceSetup {
    param(
        [string]$ServicePath,
        [string]$ServiceName
    )
    
    Write-Log "Checking $ServiceName setup..." -Level Info
    
    # Check if path exists
    if (-not (Test-Path $ServicePath)) {
        Write-Log "$ServiceName path not found: $ServicePath" -Level Warning
        return $false
    }
    
    # Check for package.json
    if (-not (Test-Path "$ServicePath/package.json")) {
        Write-Log "$ServiceName missing package.json" -Level Warning
        return $false
    }
    
    # Check for test script in package.json
    $packageJson = Get-Content "$ServicePath/package.json" | ConvertFrom-Json
    if (-not $packageJson.scripts.test) {
        Write-Log "$ServiceName missing test script in package.json" -Level Warning
        return $false
    }
    
    # Check if node_modules exists
    if (-not (Test-Path "$ServicePath/node_modules")) {
        Write-Log "$ServiceName dependencies not installed" -Level Warning
        Write-Log "Installing dependencies for $ServiceName..." -Level Info
        
        Push-Location $ServicePath
        try {
            npm install --quiet
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed"
            }
        } finally {
            Pop-Location
        }
    }
    
    return $true
}

function Run-ServiceTests {
    param(
        [string]$ServiceKey,
        [hashtable]$ServiceConfig
    )
    
    $servicePath = $ServiceConfig.Path
    $serviceName = $ServiceConfig.Name
    
    Write-Log "" -Level Info
    Write-Log "Testing $serviceName" -Level Info
    Write-Log ("=" * 50) -Level Info
    
    # Verify service setup
    if (-not (Test-ServiceSetup -ServicePath $servicePath -ServiceName $serviceName)) {
        Write-Log "Skipping $serviceName due to setup issues" -Level Warning
        $script:TestResults[$ServiceKey] = @{
            Status = "Skipped"
            Reason = "Setup incomplete"
        }
        return
    }
    
    Push-Location $servicePath
    try {
        # Build Jest command
        $jestArgs = @()
        
        if ($Coverage) {
            $jestArgs += "--coverage"
            $jestArgs += "--coverageReporters=text"
            $jestArgs += "--coverageReporters=lcov"
            $jestArgs += "--coverageReporters=html"
        }
        
        if ($Watch) {
            $jestArgs += "--watch"
        }
        
        if ($UpdateSnapshots) {
            $jestArgs += "--updateSnapshot"
        }
        
        if ($TestPattern) {
            $jestArgs += "--testNamePattern=`"$TestPattern`""
        }
        
        if ($FailureThreshold -gt 0) {
            $jestArgs += "--maxWorkers=$FailureThreshold"
        }
        
        # Add colors for better output
        $jestArgs += "--colors"
        
        Write-Log "Running: npm test -- $($jestArgs -join ' ')" -Level Debug
        
        # Run tests
        $testOutput = ""
        $testProcess = Start-Process -FilePath "npm" -ArgumentList (@("test", "--") + $jestArgs) -PassThru -NoNewWindow -Wait
        
        if ($testProcess.ExitCode -eq 0) {
            Write-Log "$serviceName tests passed!" -Level Info
            $script:TestResults[$ServiceKey] = @{
                Status = "Passed"
                ExitCode = 0
            }
            
            # Check coverage if enabled
            if ($Coverage -and (Test-Path "coverage/lcov-report/index.html")) {
                $coverageSummary = Get-Content "coverage/coverage-summary.json" -ErrorAction SilentlyContinue | ConvertFrom-Json
                if ($coverageSummary) {
                    $total = $coverageSummary.total
                    Write-Log "Coverage Summary:" -Level Info
                    Write-Log "  Lines: $([math]::Round($total.lines.pct, 2))%" -Level Info
                    Write-Log "  Statements: $([math]::Round($total.statements.pct, 2))%" -Level Info
                    Write-Log "  Functions: $([math]::Round($total.functions.pct, 2))%" -Level Info
                    Write-Log "  Branches: $([math]::Round($total.branches.pct, 2))%" -Level Info
                    
                    $script:TestResults[$ServiceKey].Coverage = @{
                        Lines = $total.lines.pct
                        Statements = $total.statements.pct
                        Functions = $total.functions.pct
                        Branches = $total.branches.pct
                    }
                }
            }
        } else {
            Write-Log "$serviceName tests failed!" -Level Error
            $script:TestResults[$ServiceKey] = @{
                Status = "Failed"
                ExitCode = $testProcess.ExitCode
            }
            $script:Success = $false
        }
        
    } catch {
        Write-Log "Error running tests for $serviceName : $($_.Exception.Message)" -Level Error
        $script:TestResults[$ServiceKey] = @{
            Status = "Error"
            Error = $_.Exception.Message
        }
        $script:Success = $false
    } finally {
        Pop-Location
    }
}

function Show-TestReport {
    Write-Log "" -Level Info
    Write-Log "Test Results Summary" -Level Info
    Write-Log ("=" * 60) -Level Info
    
    $passed = 0
    $failed = 0
    $skipped = 0
    
    foreach ($service in $script:TestResults.GetEnumerator()) {
        $status = $service.Value.Status
        $color = switch ($status) {
            "Passed" { "Green"; $passed++ }
            "Failed" { "Red"; $failed++ }
            "Skipped" { "Yellow"; $skipped++ }
            "Error" { "Red"; $failed++ }
        }
        
        Write-Host "$($service.Key): $status" -ForegroundColor $color[0]
        
        if ($service.Value.Coverage) {
            $cov = $service.Value.Coverage
            Write-Host "  Coverage - Lines: $([math]::Round($cov.Lines, 1))% | Statements: $([math]::Round($cov.Statements, 1))% | Functions: $([math]::Round($cov.Functions, 1))% | Branches: $([math]::Round($cov.Branches, 1))%" -ForegroundColor Gray
        }
        
        if ($service.Value.Reason) {
            Write-Host "  Reason: $($service.Value.Reason)" -ForegroundColor Gray
        }
        
        if ($service.Value.Error) {
            Write-Host "  Error: $($service.Value.Error)" -ForegroundColor Gray
        }
    }
    
    Write-Log "" -Level Info
    Write-Log "Total: $($script:TestResults.Count) | Passed: $passed | Failed: $failed | Skipped: $skipped" -Level Info
    
    # Save results to file
    $resultsFile = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $script:TestResults | ConvertTo-Json -Depth 10 | Out-File $resultsFile
    Write-Log "Results saved to: $resultsFile" -Level Info
}

# Main execution
try {
    Show-Banner -Title "Mortgage Broker Pro - Test Runner" -Version "1.0.0"
    
    # Ensure we're in the project root
    Set-ProjectRoot
    
    # Check prerequisites
    Write-Log "Checking prerequisites..." -Level Info
    if (-not (Test-Prerequisites @("node", "npm"))) {
        throw "Required commands are not available"
    }
    
    # Determine which services to test
    $servicesToTest = if ($Service -eq "all") {
        $script:Services.Keys
    } else {
        @($Service)
    }
    
    # Run tests for each service
    foreach ($serviceKey in $servicesToTest) {
        if ($script:Services.ContainsKey($serviceKey)) {
            Run-ServiceTests -ServiceKey $serviceKey -ServiceConfig $script:Services[$serviceKey]
        } else {
            Write-Log "Unknown service: $serviceKey" -Level Warning
        }
    }
    
    # Show summary report
    Show-TestReport
    
    # Open coverage report if requested
    if ($OpenReport -and $Coverage) {
        $coverageReports = @()
        foreach ($serviceKey in $servicesToTest) {
            $reportPath = Join-Path $script:Services[$serviceKey].Path "coverage/lcov-report/index.html"
            if (Test-Path $reportPath) {
                $coverageReports += $reportPath
            }
        }
        
        if ($coverageReports.Count -gt 0) {
            Write-Log "Opening coverage report(s)..." -Level Info
            foreach ($report in $coverageReports) {
                Start-Process $report
            }
        } else {
            Write-Log "No coverage reports found to open" -Level Warning
        }
    }
    
} catch {
    $script:Success = $false
    Write-Log "Test runner failed: $($_.Exception.Message)" -Level Error
    Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level Debug
    exit 1
} finally {
    Show-Summary -StartTime $script:StartTime -Success $script:Success
    
    # Exit with appropriate code
    exit $(if ($script:Success) { 0 } else { 1 })
}
