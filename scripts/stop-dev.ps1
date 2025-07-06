<#
.SYNOPSIS
    Stops the Mortgage Broker Pro development environment
.DESCRIPTION
    This script gracefully stops all Docker services for the Mortgage Broker Pro
    development environment. It preserves data volumes by default.
.PARAMETER RemoveVolumes
    Remove data volumes (WARNING: This will delete all database data)
.PARAMETER Timeout
    Timeout in seconds for stopping services (default: 30)
.EXAMPLE
    .\stop-dev.ps1
    Stops all services while preserving data
.EXAMPLE
    .\stop-dev.ps1 -RemoveVolumes
    Stops all services and removes data volumes
#>
[CmdletBinding()]
param(
    [switch]$RemoveVolumes,
    [int]$Timeout = 30
)

# Import common functions
. "$PSScriptRoot\Common-Functions.ps1"

# Script configuration
$script:StartTime = Get-Date
$script:Success = $true

try {
    # Show banner
    Show-Banner -Title "Mortgage Broker Pro - Stop Development Environment" -Version "2.0.0"
    
    # Ensure we're in the project root
    Set-ProjectRoot
    
    # Check prerequisites
    Write-Log "Checking prerequisites..." -Level Info
    if (-not (Test-Prerequisites @("docker", "docker-compose"))) {
        throw "Required commands are not available"
    }
    
    # Check if services are running
    Write-Log "Checking service status..." -Level Info
    $runningContainers = docker-compose ps --services --filter "status=running" 2>$null
    
    if ([string]::IsNullOrWhiteSpace($runningContainers)) {
        Write-Log "No services are currently running" -Level Warning
    } else {
        Write-Log "Found running services: $($runningContainers -replace "`n", ", ")" -Level Info
        
        # Stop services
        Write-Log "Stopping Docker services (timeout: ${Timeout}s)..." -Level Info
        
        $stopArgs = @("down", "--timeout", $Timeout)
        if ($RemoveVolumes) {
            Write-Log "WARNING: Volume removal requested - all data will be deleted!" -Level Warning
            $confirmation = Read-Host "Are you sure you want to remove all data volumes? (yes/no)"
            if ($confirmation -ne "yes") {
                Write-Log "Volume removal cancelled" -Level Info
                $RemoveVolumes = $false
            } else {
                $stopArgs += "-v"
            }
        }
        
        Invoke-SafeCommand -ScriptBlock {
            docker-compose $stopArgs
            if ($LASTEXITCODE -ne 0) {
                throw "docker-compose down failed with exit code $LASTEXITCODE"
            }
        } -ErrorMessage "Failed to stop services" -RetryCount 1
        
        Write-Log "All services stopped successfully" -Level Info
    }
    
    # Clean up any orphaned containers
    Write-Log "Checking for orphaned containers..." -Level Debug
    $orphanedContainers = docker ps -a --filter "label=com.docker.compose.project=mortgage-broker-pro-30" --format "{{.ID}}"
    if ($orphanedContainers) {
        Write-Log "Removing orphaned containers..." -Level Info
        docker rm -f $orphanedContainers 2>$null
    }
    
    # Show disk usage if volumes were not removed
    if (-not $RemoveVolumes) {
        Write-Log "Checking Docker volume usage..." -Level Debug
        $volumes = docker volume ls --filter "label=com.docker.compose.project=mortgage-broker-pro-30" --format "{{.Name}}"
        if ($volumes) {
            $volumeCount = ($volumes | Measure-Object).Count
            Write-Log "Data preserved in $volumeCount volume(s)" -Level Info
            Write-Log "Tip: To remove all data, run: .\stop-dev.ps1 -RemoveVolumes" -Level Info
        }
    } else {
        Write-Log "All data volumes have been removed" -Level Info
    }
    
} catch {
    $script:Success = $false
    Write-Log "Error: $($_.Exception.Message)" -Level Error
    Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level Debug
    exit 1
} finally {
    # Show summary
    Show-Summary -StartTime $script:StartTime -Success $script:Success
}
