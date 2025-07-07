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
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
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
          const lines = csvContent.split('\n').filter((line: string) => line.trim().length > 0);
          
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

  // Simple HTML test page for file upload
  fastify.get('/lenders/upload-test', async (_request: FastifyRequest, reply: FastifyReply) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lender File Upload Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .upload-area {
            border: 2px dashed #ddd;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            margin-bottom: 20px;
            transition: border-color 0.3s;
        }
        .upload-area:hover {
            border-color: #007acc;
        }
        .upload-area.dragover {
            border-color: #007acc;
            background: #f0f8ff;
        }
        input[type="file"] {
            margin: 20px 0;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 100%;
        }
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background: #005999;
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .results {
            margin-top: 30px;
            padding: 20px;
            border-radius: 8px;
            display: none;
        }
        .success {
            background: #e8f5e8;
            border: 1px solid #4caf50;
        }
        .error {
            background: #ffe8e8;
            border: 1px solid #f44336;
        }
        .data-table {
            max-height: 300px;
            overflow: auto;
            border: 1px solid #ddd;
            margin-top: 15px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background: #f5f5f5;
            font-weight: bold;
        }
        .sample-files {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .sample-files h3 {
            margin-top: 0;
            color: #333;
        }
        .sample-files a {
            color: #007acc;
            text-decoration: none;
            margin-right: 15px;
        }
        .sample-files a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏦 Lender File Upload Test</h1>
        <p class="subtitle">Upload CSV files to test the lender import functionality</p>
        
        <div class="sample-files">
            <h3>📁 Test with Sample Data:</h3>
            <p>Create a CSV file with these headers and some data:</p>
            <code>Name,Legal Name,Contact Email,Contact Phone,Website,Profile Score,Tier</code>
            <br><br>
            <small>💡 Or create any CSV file with headers to test the parsing functionality</small>
        </div>

        <div class="upload-area" id="uploadArea">
            <div>
                <h3>📤 Drag & Drop CSV File Here</h3>
                <p>or click to browse files</p>
                <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" />
                <button id="uploadBtn" disabled>Upload & Parse</button>
            </div>
        </div>

        <div id="results" class="results">
            <div id="resultContent"></div>
        </div>
    </div>

    <script>
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadArea = document.getElementById('uploadArea');
        const results = document.getElementById('results');
        const resultContent = document.getElementById('resultContent');

        fileInput.addEventListener('change', function(e) {
            uploadBtn.disabled = !e.target.files.length;
        });

        // Drag and drop functionality
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                uploadBtn.disabled = false;
            }
        });

        uploadArea.addEventListener('click', function() {
            fileInput.click();
        });

        uploadBtn.addEventListener('click', async function() {
            const file = fileInput.files[0];
            if (!file) return;

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/v1/lenders/upload-preview', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                displayResults(result, response.ok);

            } catch (error) {
                displayResults({ 
                    success: false, 
                    error: 'Network error: ' + error.message 
                }, false);
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload & Parse';
            }
        });

        function displayResults(result, isSuccess) {
            results.style.display = 'block';
            results.className = 'results ' + (isSuccess && result.success ? 'success' : 'error');

            if (result.success) {
                resultContent.innerHTML = \`
                    <h3>✅ Upload Successful!</h3>
                    <p><strong>File:</strong> \${result.filename}</p>
                    <p><strong>Rows:</strong> \${result.rows}</p>
                    <p><strong>File Size:</strong> \${result.file_info.size} bytes</p>
                    <p><strong>Preview ID:</strong> \${result.preview_id}</p>
                    
                    <h4>📋 Columns Found:</h4>
                    <p>\${result.columns.join(', ')}</p>
                    
                    <h4>📊 Sample Data (first \${result.sample_data.length} rows):</h4>
                    <div class="data-table">
                        <table>
                            <thead>
                                <tr>
                                    \${result.columns.map(col => \`<th>\${col}</th>\`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                \${result.sample_data.map(row => 
                                    \`<tr>\${row.map(cell => \`<td>\${cell || ''}</td>\`).join('')}</tr>\`
                                ).join('')}
                            </tbody>
                        </table>
                    </div>
                \`;
            } else {
                resultContent.innerHTML = \`
                    <h3>❌ Upload Failed</h3>
                    <p><strong>Error:</strong> \${result.error}</p>
                    <p>Please check your file format and try again.</p>
                \`;
            }
        }
    </script>
</body>
</html>`;

    reply.type('text/html').send(html);
  });
}