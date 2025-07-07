# Test restore backup to a temp DB for verification
param(
  [string]$BackupFile
)
$TempDb = "temp_restore_$(Get-Random)"
docker exec mortgage_broker_db psql -U mortgage_user -c "CREATE DATABASE $TempDb;"
Get-Content $BackupFile | docker exec -i mortgage_broker_db psql -U mortgage_user $TempDb
Write-Host "Backup $BackupFile restored to $TempDb for verification."
