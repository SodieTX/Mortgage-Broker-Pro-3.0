# Mortgage Broker Pro - Enhanced Scripts & Testing

This directory contains enhanced PowerShell scripts and testing utilities for the Mortgage Broker Pro 3.0 project.

## Overview

All scripts have been enhanced with:
- ✅ Comprehensive error handling and retry logic
- ✅ Structured logging with multiple levels
- ✅ Parameter validation and help documentation
- ✅ Progress reporting for long operations
- ✅ Environment validation
- ✅ Consistent output formatting

## Common Functions Module

The `Common-Functions.ps1` module provides shared utilities for all scripts:

### Core Functions
- `Write-Log` - Structured logging with levels (Debug, Info, Warning, Error, Critical)
- `Test-Command` - Check if a command/executable is available
- `Test-Prerequisites` - Validate required commands are installed
- `Invoke-SafeCommand` - Execute commands with error handling and retry
- `Test-EnvironmentVariables` - Validate required environment variables
- `Test-Port` - Check if a port is available
- `Wait-ForService` - Wait for a service to become available
- `Show-Progress` - Display progress bars for long operations
- `Format-Json` - Pretty-print JSON output
- `Show-Banner` - Display consistent script headers
- `Show-Summary` - Display execution summaries

### Environment Variables
- `MBP_LOG_LEVEL` - Set logging level (Debug, Info, Warning, Error, Critical)
- `MBP_LOG_FILE` - Enable file logging to specified path
- `MBP_NO_COLOR` - Disable colored output

## Enhanced Scripts

### 1. stop-dev.ps1 (v2.0.0)
Enhanced development environment shutdown script.

**New Features:**
- Safe volume removal with confirmation
- Orphaned container cleanup
- Service status checking
- Configurable timeout
- Disk usage reporting

**Usage:**
```powershell
# Basic usage - preserves data
.\stop-dev.ps1

# Remove all data volumes (with confirmation)
.\stop-dev.ps1 -RemoveVolumes

# Custom timeout
.\stop-dev.ps1 -Timeout 60
```

### 2. test-scenario-api.ps1 (v2.0.0)
Comprehensive API testing framework.

**New Features:**
- Multiple test suites (Basic, Extended, Stress, All)
- Detailed test reporting with timing
- Validation testing for edge cases
- Stress testing with bulk operations
- JSON test result export
- Custom test patterns

**Usage:**
```powershell
# Run basic CRUD tests
.\test-scenario-api.ps1

# Run all test suites with verbose output
.\test-scenario-api.ps1 -TestSuite All -Verbose

# Run extended validation tests
.\test-scenario-api.ps1 -TestSuite Extended

# Test against different environment
.\test-scenario-api.ps1 -BaseUrl "http://staging-api:3001/api/v1" -ApiKey "staging-key"
```

**Test Suites:**
- **Basic**: CRUD operations (Create, Read, Update, Delete, List)
- **Extended**: Validation tests for edge cases and business rules
- **Stress**: Performance and bulk operation tests
- **All**: Runs all test suites

### 3. run-tests.ps1 (v1.0.0)
Jest test runner with coverage reporting.

**Features:**
- Run tests for individual services or all services
- Comprehensive coverage reporting (HTML, LCOV, JSON)
- Watch mode for development
- Snapshot updating
- Automatic dependency installation
- Coverage threshold enforcement
- Browser integration for reports

**Usage:**
```powershell
# Run tests for EMC² Core with coverage
.\run-tests.ps1 -Service emc2-core

# Run all service tests and open coverage reports
.\run-tests.ps1 -Service all -OpenReport

# Run tests in watch mode
.\run-tests.ps1 -Service emc2-core -Watch

# Run specific test patterns
.\run-tests.ps1 -Service emc2-core -TestPattern "ScenarioService"
```

## Test Infrastructure Enhancements

### Jest Configuration (services/emc2-core/jest.config.js)
Enhanced with:
- Multiple coverage reporters (text, HTML, LCOV, JSON, Clover)
- Per-directory coverage thresholds
- Custom test setup with global utilities
- Module path mapping
- Comprehensive exclusion patterns

### Test Setup (services/emc2-core/src/__tests__/setup.ts)
Provides:
- Environment configuration for tests
- Logger mocking to reduce noise
- Global error handlers
- Custom Jest matchers:
  - `toBeValidUUID()` - Validate UUID format
  - `toBeWithinRange(min, max)` - Validate numeric ranges

## Best Practices

### Error Handling
All scripts follow consistent error handling patterns:
```powershell
try {
    # Main logic
    Invoke-SafeCommand -ScriptBlock {
        # Potentially failing operation
    } -ErrorMessage "Descriptive error" -RetryCount 3
} catch {
    Write-Log "Operation failed: $($_.Exception.Message)" -Level Error
    exit 1
} finally {
    Show-Summary -StartTime $startTime -Success $success
}
```

### Logging
Use appropriate log levels:
```powershell
Write-Log "Starting process..." -Level Info
Write-Log "Detailed information" -Level Debug
Write-Log "Potential issue detected" -Level Warning
Write-Log "Operation failed" -Level Error
Write-Log "System failure" -Level Critical
```

### Parameter Validation
All scripts include parameter validation:
```powershell
[CmdletBinding()]
param(
    [ValidateSet("Option1", "Option2")]
    [string]$Parameter = "Default",
    
    [ValidateRange(1, 100)]
    [int]$Number = 10
)
```

## Script Development Guidelines

When creating new scripts:

1. **Always import Common-Functions.ps1**
   ```powershell
   . "$PSScriptRoot\Common-Functions.ps1"
   ```

2. **Use structured error handling**
   ```powershell
   $script:StartTime = Get-Date
   $script:Success = $true
   
   try {
       # Your code here
   } catch {
       $script:Success = $false
       Write-Log "Error: $($_.Exception.Message)" -Level Error
   } finally {
       Show-Summary -StartTime $script:StartTime -Success $script:Success
   }
   ```

3. **Add comprehensive help**
   ```powershell
   <#
   .SYNOPSIS
       Brief description
   .DESCRIPTION
       Detailed description
   .PARAMETER Name
       Parameter description
   .EXAMPLE
       Usage example
   #>
   ```

4. **Validate prerequisites**
   ```powershell
   if (-not (Test-Prerequisites @("required", "commands"))) {
       throw "Prerequisites not met"
   }
   ```

5. **Use consistent naming**
   - Scripts: `verb-noun.ps1` (lowercase)
   - Functions: `Verb-Noun` (PascalCase)
   - Variables: `$camelCase` or `$script:camelCase`

## Troubleshooting

### Common Issues

1. **Scripts fail with "command not found"**
   - Ensure Docker and Node.js are installed
   - Run scripts from project root or use `Set-ProjectRoot`

2. **Permission errors**
   - Run PowerShell as Administrator if needed
   - Check execution policy: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

3. **Test coverage not generating**
   - Ensure Jest is properly configured
   - Check that node_modules are installed
   - Verify jest.config.js exists

### Debug Mode
Enable debug logging:
```powershell
$env:MBP_LOG_LEVEL = "Debug"
.\script-name.ps1
```

Enable file logging:
```powershell
$env:MBP_LOG_FILE = "script-output.log"
.\script-name.ps1
```

## Contributing

When adding new scripts or enhancing existing ones:

1. Use the Common-Functions module
2. Follow the established patterns
3. Add comprehensive error handling
4. Include parameter validation
5. Document with inline help
6. Test thoroughly with different scenarios
7. Update this README

## Future Enhancements

Planned improvements:
- [ ] Script test suite for PowerShell scripts
- [ ] Automated script documentation generation
- [ ] Performance benchmarking utilities
- [ ] Database backup/restore scripts
- [ ] Deployment automation scripts
- [ ] Service health monitoring dashboard

---

*Last Updated: January 2025*
