import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { getDatabase } from '../db/connection';

const LenderSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  legal_name: Type.String({ minLength: 1 }),
  tax_id: Type.Optional(Type.String()),
  website_url: Type.Optional(Type.String({ format: 'uri' })),
  logo_url: Type.Optional(Type.String({ format: 'uri' })),
  contact_name: Type.String({ minLength: 1 }),
  contact_email: Type.String({ format: 'email' }),
  contact_phone: Type.Optional(Type.String()),
  profile_score: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  tier: Type.Optional(Type.Union([
    Type.Literal('PLATINUM'),
    Type.Literal('GOLD'),
    Type.Literal('SILVER'),
    Type.Literal('BRONZE')
  ])),
  api_enabled: Type.Optional(Type.Boolean()),
  api_endpoint: Type.Optional(Type.String({ format: 'uri' })),
  metadata: Type.Optional(Type.Object({}, { additionalProperties: true }))
});

export default async function lenderRoutes(fastify: FastifyInstance) {
  const db = await getDatabase();
  
  // Create a new lender (manual creation)
  fastify.post('/lenders', {
    schema: {
      body: LenderSchema,
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          lender_id: Type.String({ format: 'uuid' }),
          message: Type.String()
        }),
        400: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        }),
        500: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const lenderData = request.body as any;
      
      // Get the current user (assuming from JWT context)
      const currentUserId = (request as any).user?.id || '00000000-0000-0000-0000-000000000000';
      
      // Insert using the enhanced schema structure
      const result = await db.query(`
        INSERT INTO core.Lenders (
          name, legal_name, tax_id, website_url, logo_url, 
          contact_name, contact_email, contact_phone, 
          profile_score, tier, api_enabled, api_endpoint, 
          created_by, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING lender_id
      `, [
        lenderData.name,
        lenderData.legal_name,
        lenderData.tax_id || null,
        lenderData.website_url || null,
        lenderData.logo_url || null,
        lenderData.contact_name,
        lenderData.contact_email,
        lenderData.contact_phone || null,
        lenderData.profile_score || null,
        lenderData.tier || null,
        lenderData.api_enabled || false,
        lenderData.api_endpoint || null,
        currentUserId,
        JSON.stringify(lenderData.metadata || {})
      ]);
      
      reply.code(201).send({
        success: true,
        lender_id: result.rows[0].lender_id,
        message: 'Lender created successfully'
      });
      
    } catch (error: any) {
      fastify.log.error(error);
      
      // Handle database constraint violations
      if (error.code === '23505') { // Unique constraint violation
        return reply.code(400).send({
          success: false,
          error: 'Lender name or tax ID already exists'
        });
      }
      
      if (error.code === '23514') { // Check constraint violation
        return reply.code(400).send({
          success: false,
          error: 'Invalid data format (check email, phone, or URL format)'
        });
      }
      
      reply.code(500).send({
        success: false,
        error: 'Failed to create lender'
      });
    }
  });

  // Get all lenders (simple list for testing)
  fastify.get('/lenders', {
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          lenders: Type.Array(Type.Object({
            lender_id: Type.String({ format: 'uuid' }),
            name: Type.String(),
            contact_email: Type.String(),
            status: Type.String(),
            profile_score: Type.Union([Type.Number(), Type.Null()]),
            tier: Type.Union([Type.String(), Type.Null()]),
            created_at: Type.String()
          }))
        })
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await db.query(`
        SELECT 
          lender_id, name, contact_email, status, 
          profile_score, tier, created_at
        FROM core.Lenders 
        WHERE status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 50
      `);
      
      reply.send({
        success: true,
        lenders: result.rows
      });
      
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch lenders'
      });
    }
  });

  // File upload and preview endpoint
  fastify.post('/lenders/upload-preview', {
    schema: {
      consumes: ['multipart/form-data'],
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          filename: Type.String(),
          rows: Type.Number(),
          columns: Type.Array(Type.String()),
          sample_data: Type.Array(Type.Array(Type.String())),
          preview_id: Type.String(),
          file_info: Type.Object({
            size: Type.Number(),
            type: Type.String()
          })
        }),
        400: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        }),
        413: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_PREVIEW_ROWS = 100; // Only show first 100 rows in preview
    
    try {
      // Get the uploaded file
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Validate file size
      if (data.file.readableLength && data.file.readableLength > MAX_FILE_SIZE) {
        return reply.code(413).send({
          success: false,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        });
      }

      // Validate file type
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/csv' // .csv alternative
      ];

      const filename = data.filename;
      const mimetype = data.mimetype;
      
      fastify.log.info(`Received file: ${filename}, type: ${mimetype}`);

      if (!allowedMimeTypes.includes(mimetype) && !filename.endsWith('.csv') && !filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid file type. Please upload .xlsx, .xls, or .csv files only'
        });
      }

      // Read file data into buffer
      const chunks: any[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = (Buffer as any).concat(chunks);
      
      // Check actual file size after reading
      if (buffer.length > MAX_FILE_SIZE) {
        return reply.code(413).send({
          success: false,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        });
      }

      let parsedData: string[][] = [];
      let columns: string[] = [];

      try {
        if (filename.endsWith('.csv') || mimetype.includes('csv')) {
          // Parse CSV
          const csvContent = buffer.toString('utf-8');
          const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
          
          if (lines.length === 0) {
            return reply.code(400).send({
              success: false,
              error: 'CSV file is empty'
            });
          }

          // Parse CSV manually (basic implementation)
          parsedData = lines.map((line: string) => {
            const cells: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            cells.push(current.trim());
            return cells;
          });

          columns = parsedData[0] || [];
          parsedData = parsedData.slice(1); // Remove header row
          
        } else {
          // For Excel files, we'll implement a basic parser
          // This is a simplified approach - in production you'd use xlsx library
          return reply.code(400).send({
            success: false,
            error: 'Excel file parsing not yet implemented. Please use CSV files for now.'
          });
        }

        // Validate we have data
        if (parsedData.length === 0) {
          return reply.code(400).send({
            success: false,
            error: 'File contains no data rows'
          });
        }

        // Validate all rows have same number of columns
        const expectedColumns = columns.length;
        const invalidRows = parsedData.filter((row: string[]) => row.length !== expectedColumns);
        
        if (invalidRows.length > 0) {
          fastify.log.warn(`Found ${invalidRows.length} rows with inconsistent column count`);
        }

        // Generate preview ID for potential future use
        const previewId = 'preview_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Take only first MAX_PREVIEW_ROWS for preview
        const sampleData = parsedData.slice(0, MAX_PREVIEW_ROWS);

        reply.send({
          success: true,
          filename: filename,
          rows: parsedData.length,
          columns: columns,
          sample_data: sampleData,
          preview_id: previewId,
          file_info: {
            size: buffer.length,
            type: mimetype
          }
        });

      } catch (parseError) {
        fastify.log.error('File parsing error:', parseError);
        return reply.code(400).send({
          success: false,
          error: `Failed to parse file: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`
        });
      }

    } catch (error: any) {
      fastify.log.error('File upload error:', error);
      return reply.code(500).send({
        success: false,
        error: 'File upload failed'
      });
    }
  });
}