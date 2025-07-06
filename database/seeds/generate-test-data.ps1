# Generate Test Data Script
# This script generates randomized test data for development environments
# Usage: .\generate-test-data.ps1 -Count 100 -OutputFile additional-test-data.sql

param(
    [int]$Count = 50,
    [string]$OutputFile = "generated-test-data.sql",
    [switch]$IncludeBorrowers = $true,
    [switch]$IncludeProperties = $true,
    [switch]$IncludeScenarios = $true
)

# Helper functions
function New-Guid {
    [guid]::NewGuid().ToString()
}

function Get-RandomFromArray {
    param([array]$Array)
    $Array[(Get-Random -Maximum $Array.Count)]
}

function Get-RandomNumber {
    param([int]$Min, [int]$Max)
    Get-Random -Minimum $Min -Maximum $Max
}

function Get-RandomDecimal {
    param([decimal]$Min, [decimal]$Max, [int]$Decimals = 2)
    $random = Get-Random -Minimum ([int]($Min * [Math]::Pow(10, $Decimals))) -Maximum ([int]($Max * [Math]::Pow(10, $Decimals)))
    [Math]::Round($random / [Math]::Pow(10, $Decimals), $Decimals)
}

# Data arrays
$EntityTypes = @('LLC', 'Corporation', 'Trust', 'Individual', 'Partnership')
$PropertyTypes = @('SFR', 'MF', 'Condo', 'Townhome', 'Office', 'Retail', 'Industrial')
$States = @('TX', 'FL', 'CA', 'AZ', 'NV', 'GA', 'NC', 'SC', 'TN', 'OH', 'CO', 'UT', 'OR', 'WA')
$Cities = @{
    'TX' = @('Dallas', 'Houston', 'Austin', 'San Antonio', 'Fort Worth', 'Plano', 'Arlington')
    'FL' = @('Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'West Palm Beach')
    'CA' = @('Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland')
    'AZ' = @('Phoenix', 'Tucson', 'Scottsdale', 'Mesa', 'Chandler', 'Tempe')
    'NV' = @('Las Vegas', 'Henderson', 'Reno', 'North Las Vegas')
    'GA' = @('Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Alpharetta')
    'NC' = @('Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem')
    'SC' = @('Charleston', 'Columbia', 'Greenville', 'Mount Pleasant')
    'TN' = @('Nashville', 'Memphis', 'Knoxville', 'Chattanooga')
    'OH' = @('Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron')
    'CO' = @('Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder')
    'UT' = @('Salt Lake City', 'West Valley City', 'Provo', 'Sandy')
    'OR' = @('Portland', 'Eugene', 'Salem', 'Gresham', 'Hillsboro')
    'WA' = @('Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue')
}

$StreetNames = @('Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm', 'Washington', 'Park', 'First', 'Second', 
                  'Third', 'Fourth', 'Fifth', 'Market', 'Broadway', 'Madison', 'Jefferson', 'Lincoln',
                  'Jackson', 'Franklin', 'Highland', 'Church', 'River', 'Lake', 'Hill', 'Forest')
$StreetTypes = @('St', 'Ave', 'Blvd', 'Rd', 'Ln', 'Dr', 'Ct', 'Way', 'Pl', 'Circle')

$CompanyPrefixes = @('Premier', 'Apex', 'Summit', 'Elite', 'Prime', 'Quantum', 'Pinnacle', 'Vanguard', 
                     'Strategic', 'Innovative', 'Dynamic', 'Global', 'United', 'American', 'National')
$CompanySuffixes = @('Holdings', 'Investments', 'Properties', 'Real Estate', 'Capital', 'Group', 
                     'Partners', 'Ventures', 'Development', 'Management', 'Solutions', 'Enterprises')

$FirstNames = @('John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary',
                'William', 'Jennifer', 'Richard', 'Linda', 'Joseph', 'Patricia', 'Thomas', 'Barbara',
                'Charles', 'Elizabeth', 'Christopher', 'Susan', 'Daniel', 'Jessica', 'Matthew', 'Karen')
$LastNames = @('Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 
               'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
               'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White')

$UserIds = @('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 
             'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001')

$ScenarioStatuses = @('Draft', 'Matching', 'Shopped', 'Offers_In', 'Presented', 'Won', 'Lost')

# Output header
$output = @"
-- Generated Test Data
-- Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- Count: $Count records per type

"@

# Generate Borrowers
if ($IncludeBorrowers) {
    $output += "-- Generated Borrowers`n"
    $output += "INSERT INTO borrower (borrower_id, display_name, entity_type, country_code, created_by) VALUES`n"
    
    $borrowerValues = @()
    $borrowerIds = @()
    
    for ($i = 0; $i -lt $Count; $i++) {
        $borrowerId = New-Guid
        $borrowerIds += $borrowerId
        
        $entityType = Get-RandomFromArray $EntityTypes
        
        if ($entityType -eq 'Individual') {
            $firstName = Get-RandomFromArray $FirstNames
            $lastName = Get-RandomFromArray $LastNames
            $displayName = "$firstName $lastName"
        } else {
            $prefix = Get-RandomFromArray $CompanyPrefixes
            $suffix = Get-RandomFromArray $CompanySuffixes
            $displayName = "$prefix $suffix $entityType"
        }
        
        $createdBy = Get-RandomFromArray $UserIds
        
        $borrowerValues += "  ('$borrowerId', '$displayName', '$entityType', 'US', '$createdBy')"
    }
    
    $output += ($borrowerValues -join ",`n") + "`nON CONFLICT (borrower_id) DO NOTHING;`n`n"
}

# Generate Properties
if ($IncludeProperties) {
    $output += "-- Generated Properties`n"
    $output += "INSERT INTO property (property_id, address_line1, city, state_code, postal_code, property_type, created_by) VALUES`n"
    
    $propertyValues = @()
    $propertyIds = @()
    
    for ($i = 0; $i -lt $Count; $i++) {
        $propertyId = New-Guid
        $propertyIds += $propertyId
        
        $streetNumber = Get-RandomNumber -Min 100 -Max 9999
        $streetName = Get-RandomFromArray $StreetNames
        $streetType = Get-RandomFromArray $StreetTypes
        $address = "$streetNumber $streetName $streetType"
        
        $state = Get-RandomFromArray $States
        $city = Get-RandomFromArray $Cities[$state]
        $zipCode = Get-RandomNumber -Min 10000 -Max 99999
        
        $propertyType = Get-RandomFromArray $PropertyTypes
        $createdBy = Get-RandomFromArray $UserIds
        
        $propertyValues += "  ('$propertyId', '$address', '$city', '$state', '$zipCode', '$propertyType', '$createdBy')"
    }
    
    $output += ($propertyValues -join ",`n") + "`nON CONFLICT (property_id) DO NOTHING;`n`n"
}

# Generate Scenarios
if ($IncludeScenarios -and $borrowerIds.Count -gt 0 -and $propertyIds.Count -gt 0) {
    $output += "-- Generated Scenarios`n"
    $output += "INSERT INTO scenarios (scenario_id, status, created_by, confidence_score, notes) VALUES`n"
    
    $scenarioValues = @()
    $scenarioIds = @()
    
    $scenarioCount = [Math]::Min($Count, [Math]::Min($borrowerIds.Count, $propertyIds.Count))
    
    for ($i = 0; $i -lt $scenarioCount; $i++) {
        $scenarioId = New-Guid
        $scenarioIds += $scenarioId
        
        $status = Get-RandomFromArray $ScenarioStatuses
        $createdBy = Get-RandomFromArray $UserIds
        $confidenceScore = Get-RandomDecimal -Min 50 -Max 99 -Decimals 1
        
        $notes = @(
            "Generated test scenario #$($i + 1)",
            "Test data for development",
            "Random scenario for testing",
            "Demo data - do not use in production"
        ) | Get-Random
        
        $scenarioValues += "  ('$scenarioId', '$status', '$createdBy', $confidenceScore, '$notes')"
    }
    
    $output += ($scenarioValues -join ",`n") + "`nON CONFLICT (scenario_id) DO NOTHING;`n`n"
    
    # Link scenarios to borrowers
    $output += "-- Link Scenarios to Borrowers`n"
    $output += "INSERT INTO scenarioborrower (scenario_id, borrower_id, role) VALUES`n"
    
    $linkValues = @()
    for ($i = 0; $i -lt $scenarioIds.Count; $i++) {
        $linkValues += "  ('$($scenarioIds[$i])', '$($borrowerIds[$i])', 'Borrower')"
    }
    
    $output += ($linkValues -join ",`n") + "`nON CONFLICT (scenario_id, borrower_id) DO NOTHING;`n`n"
    
    # Link scenarios to properties
    $output += "-- Link Scenarios to Properties`n"
    $output += "INSERT INTO scenarioproperty (scenario_id, property_id) VALUES`n"
    
    $linkValues = @()
    for ($i = 0; $i -lt $scenarioIds.Count; $i++) {
        $linkValues += "  ('$($scenarioIds[$i])', '$($propertyIds[$i])')"
    }
    
    $output += ($linkValues -join ",`n") + "`nON CONFLICT (scenario_id, property_id) DO NOTHING;`n`n"
}

# Save to file
$output | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host "Generated test data saved to: $OutputFile" -ForegroundColor Green
Write-Host "Records generated:" -ForegroundColor Yellow
if ($IncludeBorrowers) { Write-Host "  - Borrowers: $Count" }
if ($IncludeProperties) { Write-Host "  - Properties: $Count" }
if ($IncludeScenarios) { Write-Host "  - Scenarios: $scenarioCount" }
