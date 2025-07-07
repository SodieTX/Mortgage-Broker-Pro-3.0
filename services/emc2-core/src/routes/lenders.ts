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
}