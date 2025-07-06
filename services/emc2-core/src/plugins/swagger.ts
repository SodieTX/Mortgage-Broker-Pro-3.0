/**
 * OpenAPI Documentation Plugin
 * 
 * World-class API documentation with Swagger/OpenAPI
 */

import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export async function setupSwagger(fastify: FastifyInstance) {
  // Register Swagger documentation
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Mortgage Broker Pro API',
        description: `
# EMC² Core Service API

Production-ready API for mortgage calculations, scenario management, and workflow orchestration.

## Features

- 🔐 **JWT Authentication** with refresh tokens
- 📊 **Real-time Calculations** for mortgage scenarios
- 📧 **Email Service** with multiple providers
- 🔍 **Distributed Tracing** with OpenTelemetry
- 📈 **Metrics Collection** with Prometheus
- 🏥 **Health Checks** with dependency monitoring

## Authentication

Most endpoints require authentication. Use the \`/auth/login\` endpoint to obtain access and refresh tokens.

Include the access token in the Authorization header:
\`\`\`
Authorization: Bearer <your-access-token>
\`\`\`

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Authentication endpoints: 5 requests per minute
- General endpoints: 100 requests per minute
- Bulk operations: 10 requests per minute

## Correlation IDs

All requests can include a correlation ID for distributed tracing:
\`\`\`
X-Correlation-ID: <your-correlation-id>
\`\`\`

If not provided, one will be generated automatically.

## Error Handling

All errors follow a consistent format:
\`\`\`json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Detailed error message",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
\`\`\`

## Versioning

This API uses URL versioning. Current version: v1
Future versions will be available at \`/v2/\`, \`/v3/\`, etc.
        `,
        version: process.env.npm_package_version || '0.0.1',
        contact: {
          name: 'API Support',
          email: 'api@mortgagebrokerpro.com',
          url: 'https://mortgagebrokerpro.com/support'
        },
        license: {
          name: 'Proprietary',
          url: 'https://mortgagebrokerpro.com/license'
        }
      },
      servers: [
        {
          url: process.env.APP_URL || 'http://localhost:3001',
          description: 'Current environment'
        },
        {
          url: 'http://localhost:3001',
          description: 'Local development'
        },
        {
          url: 'https://api.mortgagebrokerpro.com',
          description: 'Production'
        }
      ],
      tags: [
        {
          name: 'auth',
          description: 'Authentication and authorization endpoints'
        },
        {
          name: 'health',
          description: 'Health check and monitoring endpoints'
        },
        {
          name: 'scenarios',
          description: 'Mortgage scenario management'
        },
        {
          name: 'calculations',
          description: 'Mortgage calculations and analytics'
        },
        {
          name: 'reports',
          description: 'Report generation and management'
        },
        {
          name: 'email',
          description: 'Email service management'
        },
        {
          name: 'admin',
          description: 'Administrative endpoints'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT authentication token'
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'API key for machine-to-machine communication'
          }
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
              correlationId: { type: 'string', format: 'uuid' }
            },
            required: ['statusCode', 'error', 'message']
          },
          HealthCheckResult: {
            type: 'object',
            properties: {
              status: { 
                type: 'string', 
                enum: ['healthy', 'degraded', 'unhealthy'],
                description: 'Overall health status'
              },
              timestamp: { 
                type: 'string', 
                format: 'date-time',
                description: 'Check timestamp'
              },
              uptime: { 
                type: 'number',
                description: 'Service uptime in seconds'
              },
              version: { type: 'string' },
              environment: { type: 'string' },
              checks: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    status: { 
                      type: 'string', 
                      enum: ['up', 'down', 'degraded'] 
                    },
                    latency: { 
                      type: 'number',
                      description: 'Check latency in milliseconds'
                    },
                    message: { type: 'string' },
                    metadata: { type: 'object' }
                  }
                }
              }
            }
          },
          User: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              role: { 
                type: 'string', 
                enum: ['admin', 'broker', 'viewer'] 
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          LoginRequest: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { 
                type: 'string', 
                format: 'email',
                example: 'user@example.com'
              },
              password: { 
                type: 'string', 
                minLength: 8,
                example: 'SecurePass123!'
              }
            }
          },
          LoginResponse: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              sessionId: { type: 'string', format: 'uuid' },
              expiresIn: { type: 'number' }
            }
          },
          Scenario: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              description: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  purchasePrice: { type: 'number' },
                  downPayment: { type: 'number' },
                  interestRate: { type: 'number' },
                  loanTerm: { type: 'number' },
                  propertyType: { 
                    type: 'string',
                    enum: ['single_family', 'condo', 'townhouse', 'multi_family']
                  },
                  occupancy: {
                    type: 'string',
                    enum: ['primary', 'secondary', 'investment']
                  }
                }
              },
              calculations: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          CalculationResult: {
            type: 'object',
            properties: {
              monthlyPayment: { type: 'number' },
              totalPayment: { type: 'number' },
              totalInterest: { type: 'number' },
              loanToValue: { type: 'number' },
              debtToIncome: { type: 'number' },
              affordability: {
                type: 'object',
                properties: {
                  canAfford: { type: 'boolean' },
                  maxLoan: { type: 'number' },
                  recommendedDownPayment: { type: 'number' }
                }
              },
              amortizationSchedule: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    month: { type: 'number' },
                    payment: { type: 'number' },
                    principal: { type: 'number' },
                    interest: { type: 'number' },
                    balance: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        responses: {
          UnauthorizedError: {
            description: 'Access token is missing or invalid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          NotFoundError: {
            description: 'The requested resource was not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          ValidationError: {
            description: 'Request validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          RateLimitError: {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Error' },
                    {
                      type: 'object',
                      properties: {
                        retryAfter: { 
                          type: 'number',
                          description: 'Seconds until rate limit resets'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      security: [
        { bearerAuth: [] }
      ]
    }
  });

  // Register Swagger UI
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch']
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) { next() },
      preHandler: function (_request, _reply, next) { next() }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, _reply) => {
      // Create a copy to avoid modifying readonly object
      const modifiedSpec = {
        ...swaggerObject,
        servers: [
          {
            url: `${request.protocol}://${request.hostname}`,
            description: 'Current server'
          },
          ...(swaggerObject.servers || [])
        ]
      };
      return modifiedSpec;
    },
    transformSpecificationClone: true
  });
}
