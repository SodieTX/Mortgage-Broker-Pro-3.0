/**
 * Task Queue Routes
 * 
 * API endpoints for managing background tasks and queues
 */

import { FastifyPluginAsync } from 'fastify';
import { FastifyReply, FastifyRequest } from 'fastify';
import { taskQueueService } from '../services/taskQueueService';

const taskRoutes: FastifyPluginAsync = async (fastify) => {

  // Queue a report generation task
  fastify.post('/api/tasks/reports/queue', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: ['scenario', 'dscr', 'comparison'] 
          },
          scenarioId: { type: 'string' },
          reportData: { type: 'object' },
          priority: { type: 'number', minimum: 0, maximum: 10, default: 0 }
        },
        required: ['type']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            message: { type: 'string' },
            estimatedTime: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { 
      type: 'scenario' | 'dscr' | 'comparison';
      scenarioId?: string;
      reportData?: any;
      priority?: number;
    } 
  }>, reply: FastifyReply) => {
    const { type, scenarioId, reportData, priority = 0 } = request.body;
    const userId = (request as any).user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      const taskData = {
        type,
        scenarioId,
        reportData,
        userId
      };

      const jobId = await taskQueueService.queueReportGeneration(taskData, priority);

      const estimatedTime = type === 'comparison' ? '2-3 minutes' : '1-2 minutes';

      return reply.send({
        jobId,
        message: `${type} report queued for generation`,
        estimatedTime
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to queue report generation' });
    }
  });

  // Queue a bulk calculation task
  fastify.post('/api/tasks/calculations/bulk', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: ['bulk-calculations', 'scenario-analysis', 'market-analysis'] 
          },
          data: { type: 'object' },
          priority: { type: 'number', minimum: 0, maximum: 10, default: 0 }
        },
        required: ['type', 'data']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { 
      type: 'bulk-calculations' | 'scenario-analysis' | 'market-analysis';
      data: any;
      priority?: number;
    } 
  }>, reply: FastifyReply) => {
    const { type, data, priority = 0 } = request.body;
    const userId = (request as any).user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      const calculationData = {
        type,
        data,
        userId
      };

      const jobId = await taskQueueService.queueCalculation(calculationData, priority);

      return reply.send({
        jobId,
        message: `${type} calculation queued for processing`
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to queue calculation' });
    }
  });

  // Queue a file processing task
  fastify.post('/api/tasks/files/process', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          operation: { 
            type: 'string', 
            enum: ['convert', 'validate', 'extract'] 
          },
          format: { type: 'string' },
          priority: { type: 'number', minimum: 0, maximum: 10, default: 0 }
        },
        required: ['filePath', 'operation']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { 
      filePath: string;
      operation: 'convert' | 'validate' | 'extract';
      format?: string;
      priority?: number;
    } 
  }>, reply: FastifyReply) => {
    const { filePath, operation, format, priority = 0 } = request.body;
    const userId = (request as any).user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      const fileData = {
        filePath,
        operation,
        format,
        userId
      };

      const jobId = await taskQueueService.queueFileProcessing(fileData, priority);

      return reply.send({
        jobId,
        message: `File ${operation} queued for processing`
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to queue file processing' });
    }
  });

  // Queue a data import task
  fastify.post('/api/tasks/import', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          type: { 
            type: 'string', 
            enum: ['borrowers', 'properties', 'rates'] 
          },
          format: { 
            type: 'string', 
            enum: ['csv', 'xlsx', 'json'] 
          },
          priority: { type: 'number', minimum: 0, maximum: 10, default: 0 }
        },
        required: ['filePath', 'type', 'format']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { 
      filePath: string;
      type: 'borrowers' | 'properties' | 'rates';
      format: 'csv' | 'xlsx' | 'json';
      priority?: number;
    } 
  }>, reply: FastifyReply) => {
    const { filePath, type, format, priority = 0 } = request.body;
    const userId = (request as any).user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      const importData = {
        filePath,
        type,
        format,
        userId
      };

      const jobId = await taskQueueService.queueDataImport(importData, priority);

      return reply.send({
        jobId,
        message: `${type} import queued for processing`
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to queue data import' });
    }
  });

  // Schedule cleanup task
  fastify.post('/api/tasks/cleanup/schedule', {
    onRequest: [fastify.authenticate, fastify.authorize('system', 'manage')],
    schema: {
      body: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: ['expired-sessions', 'old-reports', 'temp-files'] 
          },
          scheduleTime: { type: 'string', format: 'date-time' }
        },
        required: ['type']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            message: { type: 'string' },
            scheduledFor: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { 
      type: 'expired-sessions' | 'old-reports' | 'temp-files';
      scheduleTime?: string;
    } 
  }>, reply: FastifyReply) => {
    const { type, scheduleTime } = request.body;

    try {
      const scheduleDate = scheduleTime ? new Date(scheduleTime) : undefined;
      const jobId = await taskQueueService.scheduleCleanup(type, scheduleDate);

      return reply.send({
        jobId,
        message: `${type} cleanup task scheduled`,
        scheduledFor: scheduleDate ? scheduleDate.toISOString() : 'immediately'
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to schedule cleanup task' });
    }
  });

  // Get job status
  fastify.get('/api/tasks/status/:jobId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string' }
        },
        required: ['jobId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            progress: { type: 'number' },
            status: { type: 'string' },
            createdAt: { type: 'string' },
            processedOn: { type: ['string', 'null'] },
            finishedOn: { type: ['string', 'null'] },
            failedReason: { type: ['string', 'null'] },
            result: { type: ['object', 'null'] }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params;

    try {
      const jobStatus = await taskQueueService.getJobStatus(jobId);

      if (!jobStatus) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      // Determine status
      let status = 'unknown';
      if (jobStatus.finishedOn) {
        status = jobStatus.failedReason ? 'failed' : 'completed';
      } else if (jobStatus.processedOn) {
        status = 'processing';
      } else {
        status = 'waiting';
      }

      return reply.send({
        id: jobStatus.id,
        name: jobStatus.name,
        progress: jobStatus.progress || 0,
        status,
        createdAt: new Date(parseInt(jobStatus.id)).toISOString(),
        processedOn: jobStatus.processedOn ? new Date(jobStatus.processedOn).toISOString() : null,
        finishedOn: jobStatus.finishedOn ? new Date(jobStatus.finishedOn).toISOString() : null,
        failedReason: jobStatus.failedReason || null,
        result: jobStatus.returnvalue || null
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to get job status' });
    }
  });

  // Get queue statistics
  fastify.get('/api/tasks/stats', {
    onRequest: [fastify.authenticate, fastify.authorize('system', 'read')],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            tasks: {
              type: 'object',
              properties: {
                waiting: { type: 'number' },
                active: { type: 'number' },
                completed: { type: 'number' },
                failed: { type: 'number' },
                delayed: { type: 'number' }
              }
            },
            reports: {
              type: 'object',
              properties: {
                waiting: { type: 'number' },
                active: { type: 'number' },
                completed: { type: 'number' },
                failed: { type: 'number' },
                delayed: { type: 'number' }
              }
            },
            files: {
              type: 'object',
              properties: {
                waiting: { type: 'number' },
                active: { type: 'number' },
                completed: { type: 'number' },
                failed: { type: 'number' },
                delayed: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await taskQueueService.getQueueStats();
      return reply.send(stats);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to get queue statistics' });
    }
  });

  // Get user's recent jobs
  fastify.get('/api/tasks/my-jobs', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          status: { 
            type: 'string', 
            enum: ['waiting', 'processing', 'completed', 'failed'] 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  status: { type: 'string' },
                  progress: { type: 'number' },
                  createdAt: { type: 'string' },
                  finishedAt: { type: ['string', 'null'] }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: { 
      limit?: number;
      status?: string;
    } 
  }>, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    // const { limit = 20, status } = request.query; // TODO: implement job filtering

    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      // This is a simplified implementation
      // In production, you'd query a job tracking table in your database
      // that stores job metadata including userId
      // TODO: Use limit and status parameters for filtering

      return reply.send({
        jobs: [
          // Placeholder - implement actual job tracking
        ]
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to get user jobs' });
    }
  });
};

export default taskRoutes;
