import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface StorageFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  container: string;
  metadata?: Record<string, string>;
}

export class StorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private containers: Map<string, ContainerClient> = new Map();
  private initialized = false;

  // Container names for different document types
  public static readonly CONTAINERS = {
    LOAN_DOCUMENTS: 'loan-documents',
    PROPERTY_IMAGES: 'property-images',
    GENERATED_REPORTS: 'generated-reports',
    TEMP_UPLOADS: 'temp-uploads'
  };

  constructor() {
    // Lazy initialization - don't fail if Azure is not configured yet
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required');
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    await this.initializeContainers();
    this.initialized = true;
  }

  private async initializeContainers(): Promise<void> {
    if (!this.blobServiceClient) {
      throw new Error('BlobServiceClient not initialized');
    }
    
    try {
      // Create containers if they don't exist
      for (const containerName of Object.values(StorageService.CONTAINERS)) {
        const containerClient = this.blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists({
          access: 'blob' // Allow public read access to blobs
        });
        this.containers.set(containerName, containerClient);
        logger.info(`Container initialized: ${containerName}`);
      }
    } catch (error) {
      logger.error('Failed to initialize storage containers', error);
      throw error;
    }
  }

  /**
   * Upload a file to Azure Blob Storage
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    container: string = StorageService.CONTAINERS.TEMP_UPLOADS,
    metadata?: Record<string, string>
  ): Promise<StorageFile> {
    await this.ensureInitialized();
    
    try {
      const containerClient = this.containers.get(container);
      if (!containerClient) {
        throw new Error(`Container ${container} not initialized`);
      }

      // Generate unique filename
      const extension = originalName.split('.').pop() || '';
      const filename = `${uuidv4()}${extension ? `.${extension}` : ''}`;
      
      // Get blob client
      const blockBlobClient = containerClient.getBlockBlobClient(filename);

      // Upload file
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: mimeType
        },
        metadata: {
          originalName,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });

      logger.info(`File uploaded: ${filename} to ${container}`);

      return {
        filename,
        originalName,
        mimeType,
        size: buffer.length,
        url: blockBlobClient.url,
        container
      };
    } catch (error) {
      logger.error('Failed to upload file', error);
      throw error;
    }
  }

  /**
   * Download a file from Azure Blob Storage
   */
  async downloadFile(filename: string, container: string): Promise<Buffer> {
    await this.ensureInitialized();
    
    try {
      const containerClient = this.containers.get(container);
      if (!containerClient) {
        throw new Error(`Container ${container} not initialized`);
      }

      const blobClient = containerClient.getBlobClient(filename);
      const downloadResponse = await blobClient.download();
      
      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody!) {
        chunks.push(Buffer.from(chunk));
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      logger.error(`Failed to download file: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Delete a file from Azure Blob Storage
   */
  async deleteFile(filename: string, container: string): Promise<void> {
    try {
      const containerClient = this.containers.get(container);
      if (!containerClient) {
        throw new Error(`Container ${container} not initialized`);
      }

      const blobClient = containerClient.getBlobClient(filename);
      await blobClient.deleteIfExists();
      
      logger.info(`File deleted: ${filename} from ${container}`);
    } catch (error) {
      logger.error(`Failed to delete file: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Move a file between containers
   */
  async moveFile(
    filename: string,
    fromContainer: string,
    toContainer: string,
    newMetadata?: Record<string, string>
  ): Promise<StorageFile> {
    try {
      const fromContainerClient = this.containers.get(fromContainer);
      const toContainerClient = this.containers.get(toContainer);
      
      if (!fromContainerClient || !toContainerClient) {
        throw new Error('Invalid container');
      }

      const sourceBlobClient = fromContainerClient.getBlobClient(filename);
      const destBlobClient = toContainerClient.getBlobClient(filename);

      // Copy the blob
      const copyResponse = await destBlobClient.beginCopyFromURL(sourceBlobClient.url);
      await copyResponse.pollUntilDone();

      // Update metadata if provided
      if (newMetadata) {
        await destBlobClient.setMetadata(newMetadata);
      }

      // Delete original
      await sourceBlobClient.deleteIfExists();

      // Get properties for return
      const properties = await destBlobClient.getProperties();

      logger.info(`File moved: ${filename} from ${fromContainer} to ${toContainer}`);

      return {
        filename,
        originalName: properties.metadata?.originalName || filename,
        mimeType: properties.contentType || 'application/octet-stream',
        size: properties.contentLength || 0,
        url: destBlobClient.url,
        container: toContainer,
        metadata: properties.metadata
      };
    } catch (error) {
      logger.error(`Failed to move file: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Generate a SAS URL for temporary access
   */
  async generateSasUrl(
    filename: string,
    container: string,
    _expiresInMinutes: number = 60
  ): Promise<string> {
    try {
      const containerClient = this.containers.get(container);
      if (!containerClient) {
        throw new Error(`Container ${container} not initialized`);
      }

      // For now, return the blob URL
      // In production, implement proper SAS token generation
      const blobClient = containerClient.getBlobClient(filename);
      return blobClient.url;
    } catch (error) {
      logger.error(`Failed to generate SAS URL for: ${filename}`, error);
      throw error;
    }
  }

  /**
   * List files in a container with optional prefix
   */
  async listFiles(container: string, prefix?: string): Promise<StorageFile[]> {
    try {
      const containerClient = this.containers.get(container);
      if (!containerClient) {
        throw new Error(`Container ${container} not initialized`);
      }

      const files: StorageFile[] = [];
      
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        files.push({
          filename: blob.name,
          originalName: blob.metadata?.originalName || blob.name,
          mimeType: blob.properties.contentType || 'application/octet-stream',
          size: blob.properties.contentLength || 0,
          url: containerClient.getBlobClient(blob.name).url,
          container,
          metadata: blob.metadata
        });
      }

      return files;
    } catch (error) {
      logger.error(`Failed to list files in container: ${container}`, error);
      throw error;
    }
  }
}

// Create a lazy-loaded storage service
class LazyStorageService {
  private instance: StorageService | null = null;
  private initError: Error | null = null;
  
  private getService(): StorageService {
    if (this.initError) {
      throw this.initError;
    }
    
    if (!this.instance) {
      try {
        this.instance = new StorageService();
      } catch (error) {
        this.initError = error as Error;
        throw error;
      }
    }
    
    return this.instance;
  }
  
  async uploadFile(...args: Parameters<StorageService['uploadFile']>): ReturnType<StorageService['uploadFile']> {
    return this.getService().uploadFile(...args);
  }
  
  async downloadFile(...args: Parameters<StorageService['downloadFile']>): ReturnType<StorageService['downloadFile']> {
    return this.getService().downloadFile(...args);
  }
  
  async deleteFile(...args: Parameters<StorageService['deleteFile']>): ReturnType<StorageService['deleteFile']> {
    return this.getService().deleteFile(...args);
  }
  
  async moveFile(...args: Parameters<StorageService['moveFile']>): ReturnType<StorageService['moveFile']> {
    return this.getService().moveFile(...args);
  }
  
  async generateSasUrl(...args: Parameters<StorageService['generateSasUrl']>): ReturnType<StorageService['generateSasUrl']> {
    return this.getService().generateSasUrl(...args);
  }
  
  async listFiles(...args: Parameters<StorageService['listFiles']>): ReturnType<StorageService['listFiles']> {
    return this.getService().listFiles(...args);
  }
}

// Export singleton instance
export const storageService = new LazyStorageService();
