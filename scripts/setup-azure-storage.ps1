# Azure Storage Setup Helper Script
# This script helps you configure Azure Storage for the Mortgage Broker Pro system

Write-Host "`n=== Azure Storage Setup for Mortgage Broker Pro ===" -ForegroundColor Cyan

# Check if .env.azure already exists
$envFile = ".env.azure"
if (Test-Path $envFile) {
    Write-Host "`n⚠️  Warning: $envFile already exists" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/n)"
    if ($overwrite -ne 'y') {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit
    }
}

Write-Host "`nPlease follow these steps in your Azure Portal:" -ForegroundColor Green
Write-Host "1. Go to https://portal.azure.com" -ForegroundColor White
Write-Host "2. Create a Storage Account (or use existing)" -ForegroundColor White
Write-Host "3. Go to 'Access keys' in the left menu" -ForegroundColor White
Write-Host "4. Copy the 'Connection string' from key1" -ForegroundColor White

Write-Host "`nPaste your Azure Storage connection string:" -ForegroundColor Yellow
Write-Host "(It should start with 'DefaultEndpointsProtocol=https;AccountName=...')" -ForegroundColor Gray
$connectionString = Read-Host "Connection string"

# Validate connection string format
if ($connectionString -notmatch "DefaultEndpointsProtocol=.*AccountName=.*AccountKey=.*") {
    Write-Host "`n❌ Invalid connection string format!" -ForegroundColor Red
    Write-Host "Make sure you copied the entire connection string from Azure Portal." -ForegroundColor Yellow
    exit
}

# Extract account name from connection string
$accountName = ""
if ($connectionString -match "AccountName=([^;]+)") {
    $accountName = $matches[1]
    Write-Host "`n✅ Storage Account: $accountName" -ForegroundColor Green
}

# Create .env.azure file
$envContent = @"
# Azure Storage Configuration
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Storage Account: $accountName
AZURE_STORAGE_CONNECTION_STRING=$connectionString

# Container names (these will be created automatically)
AZURE_CONTAINER_DOCUMENTS=loan-documents
AZURE_CONTAINER_IMAGES=property-images
AZURE_CONTAINER_REPORTS=generated-reports
AZURE_CONTAINER_TEMP=temp-uploads
"@

$envContent | Out-File -FilePath $envFile -Encoding utf8
Write-Host "`n✅ Created $envFile" -ForegroundColor Green

# Check if we need to update docker-compose
Write-Host "`nChecking docker-compose.yml..." -ForegroundColor Yellow
$dockerCompose = Get-Content "docker-compose.yml" -Raw
if ($dockerCompose -notmatch "env_file.*azure") {
    Write-Host "⚠️  You need to add the Azure env file to your docker-compose.yml" -ForegroundColor Yellow
    Write-Host "`nAdd this to your emc2-core service in docker-compose.yml:" -ForegroundColor White
    Write-Host "    env_file:" -ForegroundColor Gray
    Write-Host "      - .env.azure" -ForegroundColor Gray
}

# Update main .env file if needed
Write-Host "`nDo you want to add Azure settings to your main .env file? (y/n)" -ForegroundColor Yellow
$updateMainEnv = Read-Host
if ($updateMainEnv -eq 'y') {
    Add-Content -Path ".env" -Value "`n# Azure Storage"
    Add-Content -Path ".env" -Value "AZURE_STORAGE_CONNECTION_STRING=$connectionString"
    Write-Host "✅ Updated .env file" -ForegroundColor Green
}

# Provide next steps
Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Install Azure Storage package:" -ForegroundColor White
Write-Host "   cd services/emc2-core && npm install" -ForegroundColor Gray
Write-Host "`n2. Restart your services:" -ForegroundColor White
Write-Host "   docker-compose down && docker-compose up -d" -ForegroundColor Gray
Write-Host "`n3. Test document upload:" -ForegroundColor White
Write-Host "   Use the API endpoints to upload a test document" -ForegroundColor Gray

Write-Host "`n✅ Azure Storage setup complete!" -ForegroundColor Green
Write-Host "Check docs/azure-storage-setup.md for detailed usage instructions." -ForegroundColor Cyan
