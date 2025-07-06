# Common-Functions.ps1
# Shared functions and utilities for Mortgage Broker Pro scripts
# This module provides consistent logging, error handling, and validation

#Requires -Version 5.1

# Script configuration
$Script:LogLevel = if ($env:MBP_LOG_LEVEL) { $env:MBP_LOG_LEVEL } else { "Info" }
$Script:LogFile = if ($env:MBP_LOG_FILE) { $env:MBP_LOG_FILE } else { $null }
$Script:NoColor = if ($env:MBP_NO_COLOR) { $true } else { $false }

# Log levels
$Script:LogLevels = @{
    "Debug" = 0
    "Info" = 1
    "Warning" = 2
    "Error" = 3
    "Critical" = 4
}

<#
.SYNOPSIS
    Writes a formatted log message to console and optionally to file
.PARAMETER Message
    The message to log
.PARAMETER Level
    The log level (Debug, Info, Warning, Error, Critical)
.PARAMETER NoNewline
    Suppress the newline at the end of the message
#>
function Write-Log {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string]$Message,
        
        [Parameter(Position = 1)]
        [ValidateSet("Debug", "Info", "Warning", "Error", "Critical")]
        [string]$Level = "Info",
        
        [switch]$NoNewline
    )
    
    # Check if we should log this level
    if ($Script:LogLevels[$Level] -lt $Script:LogLevels[$Script:LogLevel]) {
        return
    }
    
    # Prepare timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    # Prepare color and prefix
    $color = switch ($Level) {
        "Debug" { "DarkGray"; "🔍" }
        "Info" { "Cyan"; "ℹ️" }
        "Warning" { "Yellow"; "⚠️" }
        "Error" { "Red"; "❌" }
        "Critical" { "DarkRed"; "🚨" }
    }
    
    $prefix = $color[1]
    $consoleColor = $color[0]
    
    # Console output
    if (-not $Script:NoColor) {
        $params = @{
            Object = "$prefix [$timestamp] $Message"
            ForegroundColor = $consoleColor
            NoNewline = $NoNewline
        }
        Write-Host @params
    } else {
        $params = @{
            Object = "[$Level] [$timestamp] $Message"
            NoNewline = $NoNewline
        }
        Write-Host @params
    }
    
    # File output
    if ($Script:LogFile) {
        $fileMessage = "[$Level] [$timestamp] $Message"
        if (-not $NoNewline) { $fileMessage += "`n" }
        Add-Content -Path $Script:LogFile -Value $fileMessage -NoNewline
    }
}

<#
.SYNOPSIS
    Tests if a command or executable is available
.PARAMETER Command
    The command to test
#>
function Test-Command {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command
    )
    
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

<#
.SYNOPSIS
    Validates that required commands are available
.PARAMETER Commands
    Array of commands to validate
#>
function Test-Prerequisites {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Commands
    )
    
    $missing = @()
    foreach ($cmd in $Commands) {
        if (-not (Test-Command $cmd)) {
            $missing += $cmd
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Log "Missing required commands: $($missing -join ', ')" -Level Error
        return $false
    }
    
    return $true
}

<#
.SYNOPSIS
    Executes a command with error handling and optional retry
.PARAMETER ScriptBlock
    The command to execute
.PARAMETER ErrorMessage
    Custom error message to display on failure
.PARAMETER RetryCount
    Number of times to retry on failure
.PARAMETER RetryDelay
    Seconds to wait between retries
#>
function Invoke-SafeCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock,
        
        [string]$ErrorMessage = "Command failed",
        
        [int]$RetryCount = 0,
        
        [int]$RetryDelay = 2
    )
    
    $attempt = 0
    $success = $false
    $lastError = $null
    
    while ($attempt -le $RetryCount -and -not $success) {
        try {
            if ($attempt -gt 0) {
                Write-Log "Retry attempt $attempt of $RetryCount..." -Level Warning
                Start-Sleep -Seconds $RetryDelay
            }
            
            $result = & $ScriptBlock
            $success = $true
            return $result
        }
        catch {
            $lastError = $_
            $attempt++
            
            if ($attempt -gt $RetryCount) {
                Write-Log "$ErrorMessage : $($lastError.Exception.Message)" -Level Error
                Write-Log "Stack Trace: $($lastError.ScriptStackTrace)" -Level Debug
                throw $lastError
            }
        }
    }
}

<#
.SYNOPSIS
    Validates that required environment variables are set
.PARAMETER Variables
    Hashtable of variable names and descriptions
#>
function Test-EnvironmentVariables {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Variables
    )
    
    $missing = @()
    foreach ($var in $Variables.GetEnumerator()) {
        $value = [Environment]::GetEnvironmentVariable($var.Key)
        if ([string]::IsNullOrEmpty($value)) {
            $missing += "$($var.Key) - $($var.Value)"
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Log "Missing required environment variables:" -Level Error
        foreach ($m in $missing) {
            Write-Log "  $m" -Level Error
        }
        return $false
    }
    
    return $true
}

<#
.SYNOPSIS
    Tests if a port is available for binding
.PARAMETER Port
    The port number to test
#>
function Test-Port {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )
    
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
}

<#
.SYNOPSIS
    Waits for a service to be available
.PARAMETER Url
    The URL to test
.PARAMETER Timeout
    Maximum seconds to wait
.PARAMETER Interval
    Seconds between checks
#>
function Wait-ForService {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        
        [int]$Timeout = 30,
        
        [int]$Interval = 2
    )
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    Write-Log "Waiting for service at $Url..." -Level Info
    
    while ($stopwatch.Elapsed.TotalSeconds -lt $Timeout) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 2 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Log "Service is available!" -Level Info
                return $true
            }
        }
        catch {
            # Service not ready yet
        }
        
        Start-Sleep -Seconds $Interval
    }
    
    Write-Log "Service did not become available within $Timeout seconds" -Level Error
    return $false
}

<#
.SYNOPSIS
    Creates a progress bar for long-running operations
.PARAMETER Activity
    The activity description
.PARAMETER Status
    The current status
.PARAMETER PercentComplete
    The percentage complete (0-100)
#>
function Show-Progress {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Activity,
        
        [Parameter(Mandatory = $true)]
        [string]$Status,
        
        [Parameter(Mandatory = $true)]
        [ValidateRange(0, 100)]
        [int]$PercentComplete
    )
    
    Write-Progress -Activity $Activity -Status $Status -PercentComplete $PercentComplete
}

<#
.SYNOPSIS
    Formats JSON output for display
.PARAMETER InputObject
    The object to format
.PARAMETER Depth
    The depth of JSON conversion
#>
function Format-Json {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [object]$InputObject,
        
        [int]$Depth = 5
    )
    
    Process {
        $InputObject | ConvertTo-Json -Depth $Depth | ConvertFrom-Json | Format-List
    }
}

<#
.SYNOPSIS
    Gets the script's directory path
#>
function Get-ScriptDirectory {
    if ($PSScriptRoot) {
        return $PSScriptRoot
    } elseif ($MyInvocation.MyCommand.Path) {
        return Split-Path $MyInvocation.MyCommand.Path -Parent
    } else {
        return Get-Location
    }
}

<#
.SYNOPSIS
    Ensures we're in the project root directory
#>
function Set-ProjectRoot {
    [CmdletBinding()]
    param()
    
    $scriptDir = Get-ScriptDirectory
    $projectRoot = Split-Path $scriptDir -Parent
    
    if ((Get-Location).Path -ne $projectRoot) {
        Write-Log "Changing to project root: $projectRoot" -Level Debug
        Set-Location $projectRoot
    }
}

<#
.SYNOPSIS
    Shows a banner for script startup
.PARAMETER Title
    The title to display
.PARAMETER Version
    Optional version number
#>
function Show-Banner {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,
        
        [string]$Version = "1.0.0"
    )
    
    $width = 60
    $line = "=" * $width
    
    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor White
    Write-Host "  Version: $Version" -ForegroundColor Gray
    Write-Host "  Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host $line -ForegroundColor Cyan
    Write-Host ""
}

<#
.SYNOPSIS
    Shows script completion summary
.PARAMETER StartTime
    The script start time
.PARAMETER Success
    Whether the script completed successfully
#>
function Show-Summary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [datetime]$StartTime,
        
        [bool]$Success = $true
    )
    
    $duration = (Get-Date) - $StartTime
    $status = if ($Success) { "✅ SUCCESS" } else { "❌ FAILED" }
    $color = if ($Success) { "Green" } else { "Red" }
    
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor $color
    Write-Host "  $status" -ForegroundColor $color
    Write-Host "  Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Gray
    Write-Host ("=" * 60) -ForegroundColor $color
    Write-Host ""
}

# Export all functions
Export-ModuleMember -Function *
