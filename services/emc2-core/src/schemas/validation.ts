/**
 * Request Validation Schemas
 * 
 * Comprehensive input validation for all API endpoints
 */

import { Type, Static } from '@sinclair/typebox';

// Common validation patterns
const patterns = {
  email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  phone: '^\\+?[1-9]\\d{1,14}$', // E.164 format
  zipCode: '^\\d{5}(-\\d{4})?$',
  url: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$',
  alphanumeric: '^[a-zA-Z0-9]+$',
  safeString: '^[a-zA-Z0-9\\s\\-_.]+$' // Letters, numbers, spaces, hyphens, underscores, dots
};

// Auth schemas
export const LoginSchema = Type.Object({
  email: Type.String({ 
    format: 'email',
    pattern: patterns.email,
    maxLength: 255,
    description: 'User email address'
  }),
  password: Type.String({ 
    minLength: 8,
    maxLength: 128,
    description: 'User password'
  }),
  twoFactorCode: Type.Optional(Type.String({
    pattern: '^\\d{6}$',
    description: 'Optional 2FA code'
  }))
});

export const RegisterSchema = Type.Object({
  email: Type.String({ 
    format: 'email',
    pattern: patterns.email,
    maxLength: 255
  }),
  password: Type.String({ 
    minLength: 12,
    maxLength: 128,
    description: 'Must meet password policy requirements'
  }),
  firstName: Type.String({ 
    minLength: 1,
    maxLength: 100,
    pattern: patterns.safeString
  }),
  lastName: Type.String({ 
    minLength: 1,
    maxLength: 100,
    pattern: patterns.safeString
  }),
  organization: Type.Optional(Type.String({
    maxLength: 255,
    pattern: patterns.safeString
  }))
});

export const PasswordResetRequestSchema = Type.Object({
  email: Type.String({ 
    format: 'email',
    pattern: patterns.email,
    maxLength: 255
  })
});

export const PasswordResetSchema = Type.Object({
  token: Type.String({
    minLength: 32,
    maxLength: 255
  }),
  newPassword: Type.String({ 
    minLength: 12,
    maxLength: 128
  })
});

export const RefreshTokenSchema = Type.Object({
  refreshToken: Type.String({
    minLength: 32,
    maxLength: 512
  })
});

// Scenario schemas
export const CreateScenarioSchema = Type.Object({
  clientId: Type.String({ 
    pattern: patterns.uuid,
    description: 'Client UUID'
  }),
  name: Type.String({ 
    minLength: 1,
    maxLength: 255,
    pattern: patterns.safeString
  }),
  description: Type.Optional(Type.String({ 
    maxLength: 1000
  })),
  purchasePrice: Type.Number({ 
    minimum: 0,
    maximum: 100000000,
    description: 'Purchase price in dollars'
  }),
  downPayment: Type.Number({ 
    minimum: 0,
    maximum: 100000000
  }),
  propertyType: Type.Union([
    Type.Literal('single-family'),
    Type.Literal('condo'),
    Type.Literal('townhouse'),
    Type.Literal('multi-family'),
    Type.Literal('commercial')
  ]),
  occupancyType: Type.Union([
    Type.Literal('primary'),
    Type.Literal('secondary'),
    Type.Literal('investment')
  ]),
  creditScore: Type.Integer({ 
    minimum: 300,
    maximum: 850
  }),
  annualIncome: Type.Number({ 
    minimum: 0,
    maximum: 100000000
  }),
  monthlyDebts: Type.Number({ 
    minimum: 0,
    maximum: 1000000
  }),
  customFields: Type.Optional(Type.Record(
    Type.String({ pattern: patterns.safeString }),
    Type.Any()
  ))
});

export const UpdateScenarioSchema = Type.Partial(CreateScenarioSchema);

export const ScenarioQuerySchema = Type.Object({
  clientId: Type.Optional(Type.String({ pattern: patterns.uuid })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  sortBy: Type.Optional(Type.Union([
    Type.Literal('createdAt'),
    Type.Literal('updatedAt'),
    Type.Literal('name'),
    Type.Literal('purchasePrice')
  ])),
  sortOrder: Type.Optional(Type.Union([
    Type.Literal('asc'),
    Type.Literal('desc')
  ]))
});

// Calculation schemas
export const CalculationRequestSchema = Type.Object({
  scenarioId: Type.String({ pattern: patterns.uuid }),
  loanAmount: Type.Number({ minimum: 0, maximum: 100000000 }),
  interestRate: Type.Number({ minimum: 0, maximum: 100 }),
  loanTermMonths: Type.Integer({ minimum: 1, maximum: 600 }),
  propertyTax: Type.Optional(Type.Number({ minimum: 0, maximum: 1000000 })),
  homeInsurance: Type.Optional(Type.Number({ minimum: 0, maximum: 100000 })),
  hoaFees: Type.Optional(Type.Number({ minimum: 0, maximum: 10000 })),
  pmiRate: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
  additionalPrincipal: Type.Optional(Type.Number({ minimum: 0, maximum: 100000 })),
  startDate: Type.Optional(Type.String({ format: 'date' }))
});

// Document schemas
export const DocumentUploadSchema = Type.Object({
  category: Type.Union([
    Type.Literal('income'),
    Type.Literal('assets'),
    Type.Literal('credit'),
    Type.Literal('property'),
    Type.Literal('other')
  ]),
  description: Type.Optional(Type.String({ 
    maxLength: 500,
    pattern: patterns.safeString
  })),
  tags: Type.Optional(Type.Array(
    Type.String({ 
      maxLength: 50,
      pattern: patterns.safeString
    }),
    { maxItems: 10 }
  ))
});

// Report schemas
export const ReportRequestSchema = Type.Object({
  type: Type.Union([
    Type.Literal('loan-comparison'),
    Type.Literal('amortization'),
    Type.Literal('client-summary'),
    Type.Literal('scenario-analysis')
  ]),
  format: Type.Union([
    Type.Literal('pdf'),
    Type.Literal('excel'),
    Type.Literal('json')
  ]),
  scenarioIds: Type.Array(
    Type.String({ pattern: patterns.uuid }),
    { minItems: 1, maxItems: 10 }
  ),
  includeCharts: Type.Optional(Type.Boolean({ default: true })),
  includeDetails: Type.Optional(Type.Boolean({ default: true }))
});

// Email schemas
export const EmailRequestSchema = Type.Object({
  to: Type.Array(
    Type.String({ 
      format: 'email',
      pattern: patterns.email
    }),
    { minItems: 1, maxItems: 50 }
  ),
  cc: Type.Optional(Type.Array(
    Type.String({ 
      format: 'email',
      pattern: patterns.email
    }),
    { maxItems: 20 }
  )),
  bcc: Type.Optional(Type.Array(
    Type.String({ 
      format: 'email',
      pattern: patterns.email
    }),
    { maxItems: 20 }
  )),
  subject: Type.String({ 
    minLength: 1,
    maxLength: 200,
    pattern: patterns.safeString
  }),
  templateId: Type.Optional(Type.String({ pattern: patterns.uuid })),
  variables: Type.Optional(Type.Record(
    Type.String({ pattern: patterns.safeString }),
    Type.Any()
  )),
  attachments: Type.Optional(Type.Array(
    Type.Object({
      filename: Type.String({ 
        maxLength: 255,
        pattern: patterns.safeString
      }),
      content: Type.String({ maxLength: 10485760 }), // 10MB base64
      contentType: Type.String({ maxLength: 100 })
    }),
    { maxItems: 10 }
  ))
});

// User management schemas
export const UpdateUserSchema = Type.Object({
  firstName: Type.Optional(Type.String({ 
    minLength: 1,
    maxLength: 100,
    pattern: patterns.safeString
  })),
  lastName: Type.Optional(Type.String({ 
    minLength: 1,
    maxLength: 100,
    pattern: patterns.safeString
  })),
  phone: Type.Optional(Type.String({ 
    pattern: patterns.phone
  })),
  organization: Type.Optional(Type.String({
    maxLength: 255,
    pattern: patterns.safeString
  })),
  preferences: Type.Optional(Type.Record(
    Type.String({ pattern: patterns.safeString }),
    Type.Any()
  ))
});

export const ChangePasswordSchema = Type.Object({
  currentPassword: Type.String({ 
    minLength: 8,
    maxLength: 128
  }),
  newPassword: Type.String({ 
    minLength: 12,
    maxLength: 128
  })
});

// API Key schemas
export const CreateApiKeySchema = Type.Object({
  name: Type.String({ 
    minLength: 1,
    maxLength: 100,
    pattern: patterns.safeString
  }),
  permissions: Type.Array(
    Type.String({ 
      pattern: '^[a-z]+:[a-z]+$' // format: resource:action
    }),
    { minItems: 1, maxItems: 100 }
  ),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' }))
});

// Search schemas
export const SearchSchema = Type.Object({
  query: Type.String({ 
    minLength: 1,
    maxLength: 255
  }),
  filters: Type.Optional(Type.Object({
    type: Type.Optional(Type.Array(Type.String({ maxLength: 50 }))),
    dateRange: Type.Optional(Type.Object({
      start: Type.String({ format: 'date' }),
      end: Type.String({ format: 'date' })
    })),
    tags: Type.Optional(Type.Array(
      Type.String({ 
        maxLength: 50,
        pattern: patterns.safeString
      })
    ))
  })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 }))
});

// Type exports
export type LoginRequest = Static<typeof LoginSchema>;
export type RegisterRequest = Static<typeof RegisterSchema>;
export type CreateScenarioRequest = Static<typeof CreateScenarioSchema>;
export type UpdateScenarioRequest = Static<typeof UpdateScenarioSchema>;
export type CalculationRequest = Static<typeof CalculationRequestSchema>;
export type DocumentUploadRequest = Static<typeof DocumentUploadSchema>;
export type ReportRequest = Static<typeof ReportRequestSchema>;
export type EmailRequest = Static<typeof EmailRequestSchema>;
export type UpdateUserRequest = Static<typeof UpdateUserSchema>;
export type ChangePasswordRequest = Static<typeof ChangePasswordSchema>;
export type CreateApiKeyRequest = Static<typeof CreateApiKeySchema>;
export type SearchRequest = Static<typeof SearchSchema>;

// Validation helper
export function createValidationError(errors: any[]): { 
  statusCode: number; 
  error: string; 
  message: string; 
  validation: any[] 
} {
  return {
    statusCode: 400,
    error: 'Bad Request',
    message: 'Validation failed',
    validation: errors.map(err => ({
      field: err.instancePath.replace('/', ''),
      message: err.message,
      constraint: err.params
    }))
  };
}
