import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { storageService, StorageService } from '../services/storage.service';
import { logger } from '../utils/logger';

// Document types enum
export enum DocumentType {
  LOAN_APPLICATION = 'loan_application',
  TAX_RETURN = 'tax_return',
  BANK_STATEMENT = 'bank_statement',
  PAY_STUB = 'pay_stub',
  ID_VERIFICATION = 'id_verification',
  PROPERTY_PHOTO = 'property_photo',
  PURCHASE_CONTRACT = 'purchase_contract',
  OTHER = 'other'
}

// Validation schemas
const uploadDocumentSchema = z.object({
  scenarioId: z.string().uuid(),
  documentType: z.nativeEnum(DocumentType),
  description: z.string().optional()
});

const listDocumentsSchema = z.object({
  scenarioId: z.string().uuid()
});

// Allowed MIME types for document uploads
const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

export async function documentRoutes(fastify: FastifyInstance) {

  // Upload document for a scenario
  fastify.post('/scenarios/:scenarioId/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Handle multipart form data
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Validate MIME type
      if (!allowedMimeTypes.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Invalid file type. Allowed types: PDF, JPEG, PNG, GIF, Word, Excel' });
      }

      // Parse request params
      const { scenarioId } = request.params as { scenarioId: string };
      const fields: any = {};
      for (const key in data.fields) {
        const field = data.fields[key] as any;
        fields[key] = field.value;
      }

      // Validate input
      const validatedData = uploadDocumentSchema.parse({
        scenarioId,
        ...fields
      });

      // Read file buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const mimeType = data.mimetype;
      const originalName = data.filename;

      // Determine container based on document type
      let container = StorageService.CONTAINERS.LOAN_DOCUMENTS;
      if (validatedData.documentType === DocumentType.PROPERTY_PHOTO) {
        container = StorageService.CONTAINERS.PROPERTY_IMAGES;
      }

      // Upload to Azure
      const uploadedFile = await storageService.uploadFile(
        buffer,
        originalName,
        mimeType,
        container,
        {
          scenarioId: validatedData.scenarioId,
          documentType: validatedData.documentType,
          description: validatedData.description || ''
        }
      );

      // TODO: Save document metadata to database
      // For now, just return the uploaded file info

      logger.info(`Document uploaded for scenario ${scenarioId}: ${uploadedFile.filename}`);

      return reply.send({
        success: true,
        document: {
          id: uploadedFile.filename,
          scenarioId: validatedData.scenarioId,
          documentType: validatedData.documentType,
          filename: uploadedFile.originalName,
          size: uploadedFile.size,
          mimeType: uploadedFile.mimeType,
          url: uploadedFile.url,
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Document upload failed', error);
      
      // Check if it's an Azure configuration error
      if (error.message?.includes('AZURE_STORAGE_CONNECTION_STRING')) {
        return reply.code(503).send({ 
          error: 'Document storage service not configured. Please set up Azure Storage.',
          details: 'AZURE_STORAGE_CONNECTION_STRING environment variable is required'
        });
      }
      
      return reply.code(500).send({ error: 'Failed to upload document' });
    }
  });

  // List documents for a scenario
  fastify.get('/scenarios/:scenarioId/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scenarioId } = request.params as { scenarioId: string };
      
      // Validate
      listDocumentsSchema.parse({ scenarioId });

      // List files from both containers that belong to this scenario
      const loanDocs = await storageService.listFiles(
        StorageService.CONTAINERS.LOAN_DOCUMENTS,
        scenarioId
      );
      
      const propertyImages = await storageService.listFiles(
        StorageService.CONTAINERS.PROPERTY_IMAGES,
        scenarioId
      );

      // Combine and format results
      const allDocuments = [...loanDocs, ...propertyImages].map(doc => ({
        id: doc.filename,
        scenarioId: doc.metadata?.scenarioId || scenarioId,
        documentType: doc.metadata?.documentType || DocumentType.OTHER,
        filename: doc.originalName,
        size: doc.size,
        mimeType: doc.mimeType,
        url: doc.url,
        uploadedAt: doc.metadata?.uploadedAt || null
      }));

      return reply.send({
        success: true,
        documents: allDocuments
      });
    } catch (error: any) {
      logger.error('Failed to list documents', error);
      
      // Check if it's an Azure configuration error
      if (error.message?.includes('AZURE_STORAGE_CONNECTION_STRING')) {
        return reply.code(503).send({ 
          error: 'Document storage service not configured. Please set up Azure Storage.',
          details: 'AZURE_STORAGE_CONNECTION_STRING environment variable is required'
        });
      }
      
      return reply.code(500).send({ error: 'Failed to list documents' });
    }
  });

  // Download a specific document
  fastify.get('/documents/:documentId/download', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { documentId } = request.params as { documentId: string };
      
      // Try to find the document in different containers
      // In production, you'd look this up in the database
      let buffer: Buffer | null = null;
      let container: string | null = null;
      
      for (const containerName of Object.values(StorageService.CONTAINERS)) {
        try {
          buffer = await storageService.downloadFile(documentId, containerName);
          container = containerName;
          break;
        } catch (error) {
          // Continue to next container
        }
      }

      if (!buffer || !container) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      // Get file info to set proper headers
      const files = await storageService.listFiles(container, documentId);
      const fileInfo = files.find(f => f.filename === documentId);

      if (fileInfo) {
        reply.header('Content-Type', fileInfo.mimeType);
        reply.header('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`);
      }

      return reply.send(buffer);
    } catch (error) {
      logger.error('Failed to download document', error);
      return reply.code(500).send({ error: 'Failed to download document' });
    }
  });

  // Delete a document
  fastify.delete('/documents/:documentId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { documentId } = request.params as { documentId: string };
      
      // Try to delete from different containers
      let deleted = false;
      
      for (const containerName of Object.values(StorageService.CONTAINERS)) {
        try {
          await storageService.deleteFile(documentId, containerName);
          deleted = true;
          break;
        } catch (error) {
          // Continue to next container
        }
      }

      if (!deleted) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      logger.info(`Document deleted: ${documentId}`);

      return reply.send({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete document', error);
      return reply.code(500).send({ error: 'Failed to delete document' });
    }
  });
}
