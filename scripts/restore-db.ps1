# Restore Postgres database from a backup file
param(
  [string]$BackupFile
)
if (-not (Test-Path $BackupFile)) {
  Write-Host "Backup file not found: $BackupFile"
  exit 1
}
Get-Content $BackupFile | docker exec -i mortgage_broker_db psql -U mortgage_user mortgage_broker_pro
Write-Host "Database restored from $BackupFile"
