/**
 * Report Routes
 * 
 * API endpoints for generating PDF reports
 */

import { FastifyPluginAsync } from 'fastify';
import { ReportService } from '../services/reportService';
import { FastifyReply, FastifyRequest } from 'fastify';
import { getDatabase } from '../db/connection';
import { ScenarioService } from '../services/scenarioService';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: string };
    user: { id: string; email: string; role: string };
  }
}

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const reportService = new ReportService();
  const db = await getDatabase();
  const scenarioService = new ScenarioService(db);

  // Generate scenario report
  fastify.post('/api/reports/scenario/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            pdf: { type: 'string' },
            filename: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    try {
      // Get scenario from database
      const scenario = await scenarioService.getScenario(id);

      if (!scenario) {
        return reply.code(404).send({ error: 'Scenario not found' });
      }

      // Note: In a production system, you would check ownership here
      // For now, any authenticated user can generate reports for any scenario

      // Generate report
      const pdfBuffer = await reportService.generateScenarioReport(scenario as any);
      
      // Send as base64
      const base64 = pdfBuffer.toString('base64');
      return reply.send({ pdf: base64, filename: `scenario-${scenario.id}.pdf` });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate report' });
    }
  });

  // Generate DSCR analysis report
  fastify.post('/api/reports/dscr', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          property: {
            type: 'object',
            properties: {
              monthlyRent: { type: 'number' },
              vacancyRate: { type: 'number' },
              propertyTaxes: { type: 'number' },
              insurance: { type: 'number' },
              hoaFees: { type: 'number' },
              maintenance: { type: 'number' },
              management: { type: 'number' },
              otherExpenses: { type: 'number' }
            },
            required: ['monthlyRent']
          },
          loanAmount: { type: 'number' },
          interestRate: { type: 'number' },
          termMonths: { type: 'number' },
          purchasePrice: { type: 'number' }
        },
        required: ['property', 'loanAmount', 'interestRate', 'termMonths']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            pdf: { type: 'string' },
            filename: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { property, loanAmount, interestRate, termMonths, purchasePrice } = request.body;
    
    try {
      // Generate report
      const pdfBuffer = await reportService.generateDSCRReport(
        property,
        loanAmount,
        interestRate,
        termMonths,
        purchasePrice
      );
      
      // Send as base64
      const base64 = pdfBuffer.toString('base64');
      const filename = `dscr-analysis-${Date.now()}.pdf`;
      
      return reply.send({ pdf: base64, filename });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate report' });
    }
  });

  // Generate loan comparison report
  fastify.post('/api/reports/comparison', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          scenarios: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                loanAmount: { type: 'number' },
                interestRate: { type: 'number' },
                termMonths: { type: 'number' },
                monthlyPayment: { type: 'number' },
                totalInterest: { type: 'number' },
                ltv: { type: 'number' },
                dti: { type: 'number' }
              }
            },
            minItems: 2
          }
        },
        required: ['scenarios']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            pdf: { type: 'string' },
            filename: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { scenarios: any[] } }>, reply: FastifyReply) => {
    const { scenarios } = request.body;
    
    try {
      // Generate report
      const pdfBuffer = await reportService.generateLoanComparisonReport(scenarios);
      
      // Send as base64
      const base64 = pdfBuffer.toString('base64');
      const filename = `loan-comparison-${Date.now()}.pdf`;
      
      return reply.send({ pdf: base64, filename });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate report' });
    }
  });

  // Download report endpoint (returns actual PDF file)
  fastify.post('/api/reports/download', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          pdf: { type: 'string', description: 'Base64 encoded PDF' },
          filename: { type: 'string' }
        },
        required: ['pdf', 'filename']
      }
    }
  }, async (request: FastifyRequest<{ Body: { pdf: string; filename: string } }>, reply: FastifyReply) => {
    const { pdf, filename } = request.body;
    
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(pdf, 'base64');
      
      // Set headers for file download
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', buffer.length.toString());
      
      return reply.send(buffer);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to download report' });
    }
  });
};

export default reportRoutes;
