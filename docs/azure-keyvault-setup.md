# Azure Key Vault Setup Guide

This guide will help you set up Azure Key Vault for secure secrets management in production.

## 1. Create Key Vault

### Using Azure Portal

1. Log into [Azure Portal](https://portal.azure.com)
2. Click "Create a resource" → Search for "Key Vault"
3. Configure:
   - **Resource group**: Same as your app
   - **Key vault name**: `mbp-keyvault-prod` (must be globally unique)
   - **Region**: Same as your app
   - **Pricing tier**: Standard
   - **Access configuration**: Azure role-based access control (recommended)

### Using Azure CLI

```bash
# Create resource group (if needed)
az group create --name mortgage-broker-rg --location eastus

# Create Key Vault
az keyvault create \
  --name mbp-keyvault-prod \
  --resource-group mortgage-broker-rg \
  --location eastus \
  --enable-rbac-authorization true
```

## 2. Configure Access

### For Development (Service Principal)

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "mbp-keyvault-sp" \
  --role "Key Vault Secrets User" \
  --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.KeyVault/vaults/{vault-name}

# Output will include:
# - appId (Client ID)
# - password (Client Secret)  
# - tenant (Tenant ID)
```

### For Production (Managed Identity)

```bash
# Enable system-assigned managed identity on your App Service/Container
az webapp identity assign --name your-app-name --resource-group your-rg

# Grant access to Key Vault
az keyvault set-policy \
  --name mbp-keyvault-prod \
  --object-id <managed-identity-object-id> \
  --secret-permissions get list
```

## 3. Migrate Secrets to Key Vault

### Using the Config CLI

```bash
# First, migrate your .env files to config
npm run config migrate

# Generate an encryption key for local storage
npm run config generate-key

# Set individual secrets in Key Vault
npm run config set database.password
npm run config set jwt.secret
npm run config set azure.storage.connectionString
```

### Using Azure CLI

```bash
# Set secrets directly
az keyvault secret set \
  --vault-name mbp-keyvault-prod \
  --name "database-password" \
  --value "your-secure-password"

az keyvault secret set \
  --vault-name mbp-keyvault-prod \
  --name "jwt-secret" \
  --value "your-jwt-secret-min-32-chars"
```

## 4. Configure Your Application

### Environment Variables

```bash
# For production with managed identity
AZURE_KEY_VAULT_URL=https://mbp-keyvault-prod.vault.azure.net/
NODE_ENV=production

# For development with service principal
AZURE_KEY_VAULT_URL=https://mbp-keyvault-prod.vault.azure.net/
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
```

### Application Configuration

```typescript
// In your startup code
import { initializeConfig } from './config/config.service';

const configService = initializeConfig({
  environment: process.env.NODE_ENV as any,
  useKeyVault: true,
  keyVaultUrl: process.env.AZURE_KEY_VAULT_URL,
});

// Use configuration
const dbPassword = await configService.getRequired('database.password');
```

## 5. Secret Rotation

### Manual Rotation

```bash
# Update secret in Key Vault
az keyvault secret set \
  --vault-name mbp-keyvault-prod \
  --name "database-password" \
  --value "new-secure-password"

# Your app will pick up the new value after cache expires (5 minutes)
```

### Automated Rotation

Set up Azure Functions or Logic Apps to:
1. Generate new secrets periodically
2. Update both Key Vault and your database/services
3. Send notifications on rotation

## 6. Monitoring and Alerts

### Enable Diagnostic Logs

```bash
az monitor diagnostic-settings create \
  --name keyvault-logs \
  --resource /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.KeyVault/vaults/{vault} \
  --logs '[{"category": "AuditEvent", "enabled": true}]' \
  --workspace {log-analytics-workspace-id}
```

### Set Up Alerts

Create alerts for:
- Failed authentication attempts
- Unauthorized access attempts
- Secret expiration
- High request volume

## 7. Best Practices

### Development
- Use local encrypted config files
- Never commit secrets to git
- Use separate Key Vaults for dev/staging/prod

### Production
- Enable soft delete and purge protection
- Use managed identities (no credentials in code)
- Implement secret rotation
- Monitor access logs
- Use Azure Private Endpoints for network isolation

### Naming Conventions

Use consistent naming for secrets:
- `database-password` → `database.password`
- `jwt-secret` → `jwt.secret`
- `email-api-key` → `email.apiKey`

The config service automatically converts between formats.

## 8. Disaster Recovery

### Backup Secrets

```bash
# Backup all secrets
az keyvault secret list --vault-name mbp-keyvault-prod --query "[].id" -o tsv | \
while read id; do
  name=$(basename $id)
  az keyvault secret show --id $id --query "value" -o tsv > backup/$name.secret
done
```

### Cross-Region Replication

Consider creating a secondary Key Vault in another region for disaster recovery.

## 9. Cost Considerations

- **Key Vault**: ~$0.03/10,000 operations
- **Secrets**: No charge for storage
- **Certificates**: $3/renewal

Most applications stay well within free tier limits.

## 10. Troubleshooting

### Common Issues

1. **403 Forbidden**: Check RBAC permissions
2. **Network timeout**: Check firewall rules
3. **Secret not found**: Verify secret name format
4. **Slow performance**: Implement caching

### Debug Mode

```typescript
// Enable detailed logging
const configService = initializeConfig({
  debug: true,
  // ... other options
});
```
