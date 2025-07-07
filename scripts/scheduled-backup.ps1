# Windows Task Scheduler: Run this script daily for automated backups
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = "backup-$timestamp.sql"
docker exec mortgage_broker_db pg_dump -U mortgage_user mortgage_broker_pro > $backupFile
Write-Host "Automated backup saved to $backupFile"
