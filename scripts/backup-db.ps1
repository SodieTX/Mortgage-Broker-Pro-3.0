# Backup Postgres database to a timestamped file
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = "backup-$timestamp.sql"
docker exec mortgage_broker_db pg_dump -U mortgage_user mortgage_broker_pro > $backupFile
Write-Host "Database backup saved to $backupFile"
