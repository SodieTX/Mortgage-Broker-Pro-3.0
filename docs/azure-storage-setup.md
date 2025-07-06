# Azure Storage Setup Guide

This guide will help you set up Azure Blob Storage for document management in the Mortgage Broker Pro system.

## 1. Create Storage Account

1. Log into [Azure Portal](https://portal.azure.com)
2. Click "Create a resource" → "Storage" → "Storage account"
3. Configure:
   - **Resource group**: Create new or use existing
   - **Storage account name**: `mortgagebrokerpro` (must be globally unique)
   - **Region**: Choose closest to your users
   - **Performance**: Standard
   - **Redundancy**: LRS (for development) or GRS (for production)
   - **Access tier**: Hot

4. Review + Create

## 2. Get Connection String

1. Go to your Storage Account
2. Navigate to "Access keys" in the left menu
3. Copy the "Connection string" from key1
4. Save it securely - you'll need this for the `.env` file

## 3. Create Containers

The application will automatically create these containers, but you can create them manually:

1. In your Storage Account, go to "Containers"
2. Create the following containers:
   - `loan-documents` - For loan applications, contracts, etc.
   - `property-images` - For property photos
   - `generated-reports` - For system-generated PDFs
   - `temp-uploads` - For temporary file processing

3. Set Access level:
   - For development: "Blob (anonymous read access for blobs only)"
   - For production: "Private (no anonymous access)" with SAS tokens

## 4. Configure Application

1. Copy `.env.azure.example` to `.env.azure`:
   ```bash
   cp .env.azure.example .env.azure
   ```

2. Edit `.env.azure` and add your connection string:
   ```
   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
   ```

3. Add to your main `.env` file or merge the configurations

## 5. Test the Connection

Run this test script to verify your setup:

```typescript
// test-azure-storage.ts
import { BlobServiceClient } from '@azure/storage-blob';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

async function test() {
  try {
    const containerClient = blobServiceClient.getContainerClient('test-container');
    await containerClient.createIfNotExists();
    console.log('✅ Azure Storage connection successful!');
    await containerClient.delete();
  } catch (error) {
    console.error('❌ Azure Storage connection failed:', error);
  }
}

test();
```

## 6. Security Best Practices

### Development
- Use connection strings with full access
- Enable CORS for your local development URL
- Use public blob access for easier testing

### Production
- Use Managed Identity instead of connection strings
- Implement SAS tokens for client uploads
- Set up Azure CDN for serving files
- Enable soft delete and versioning
- Configure lifecycle management for old files
- Set up Azure Monitor alerts

## 7. Cost Optimization

- **Storage**: ~$0.02/GB/month for hot tier
- **Operations**: ~$0.0004 per 10,000 operations
- **Bandwidth**: First 5GB/month free, then ~$0.087/GB

Tips to reduce costs:
- Move old files to cool/archive tier
- Set up lifecycle policies
- Use CDN for frequently accessed files
- Delete temporary files regularly

## 8. CORS Configuration (for browser uploads)

In Azure Portal:
1. Go to your Storage Account
2. Navigate to "Resource sharing (CORS)"
3. Add rule for Blob service:
   - Allowed origins: `http://localhost:3000` (dev) or your domain
   - Allowed methods: GET, POST, PUT, DELETE, OPTIONS
   - Allowed headers: *
   - Exposed headers: *
   - Max age: 3600

## Usage in Application

```typescript
// Upload a document
const file = await storageService.uploadFile(
  buffer,
  'loan-application.pdf',
  'application/pdf',
  StorageService.CONTAINERS.LOAN_DOCUMENTS,
  { scenarioId: '123', documentType: 'loan_application' }
);

// List documents for a scenario
const documents = await storageService.listFiles(
  StorageService.CONTAINERS.LOAN_DOCUMENTS,
  'scenario-123'
);

// Download a document
const buffer = await storageService.downloadFile(
  'document-id',
  StorageService.CONTAINERS.LOAN_DOCUMENTS
);
```

## Troubleshooting

1. **Connection refused**: Check firewall rules in Azure
2. **403 Forbidden**: Verify connection string and container access level
3. **404 Not Found**: Ensure container exists
4. **CORS errors**: Configure CORS in Azure Portal

## Next Steps

1. Implement document metadata in database
2. Add virus scanning for uploads
3. Implement document preview generation
4. Set up automated backups
5. Add document versioning
