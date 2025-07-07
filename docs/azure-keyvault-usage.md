# Using Azure Key Vault for Secrets

## Why?
Never store production secrets in `.env` files. Use Azure Key Vault for secure secret management.

## How to Use
1. Create a Key Vault in the Azure Portal.
2. Add secrets (e.g., `DATABASE_URL`, `JWT_SECRET`).
3. Use the Azure CLI or SDK to fetch secrets at runtime:

```
az keyvault secret show --vault-name <YourVaultName> --name <SecretName>
```

4. In production, configure your app to load secrets from Key Vault (see Azure App Service docs for Key Vault integration).

## Node.js Example: Fetching Secrets at Runtime

```js
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const vaultName = process.env.AZURE_KEY_VAULT_NAME;
const url = `https://${vaultName}.vault.azure.net`;
const credential = new DefaultAzureCredential();
const client = new SecretClient(url, credential);
async function getSecret(secretName) {
  const secret = await client.getSecret(secretName);
  return secret.value;
}
```

## Secret Rotation & Audit
- Rotate secrets regularly in Azure Portal.
- Use Key Vault access policies and enable logging/auditing.

## References
- [Azure Key Vault Quickstart](https://learn.microsoft.com/en-us/azure/key-vault/general/quick-create-portal)
- [App Service Key Vault Integration](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references)
