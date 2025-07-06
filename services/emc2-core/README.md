# EMC² Core Service

Enterprise-grade mortgage workflow orchestration service with advanced calculations, background processing, and comprehensive security features.

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd emc2-core
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start development environment
docker-compose up -d  # Start PostgreSQL and Redis
npm run dev          # Start service in development mode
```

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **Docker**: v20.0.0 or higher (for PostgreSQL and Redis)
- **PostgreSQL**: v15.x (via Docker or local installation)
- **Redis**: v7.x (via Docker or local installation)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EMC² Core     │────│   PostgreSQL    │    │     Redis       │
│   (Fastify)     │    │   (Database)    │    │   (Cache/Queue) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ├── Authentication & RBAC
         ├── Mortgage Calculations  
         ├── PDF Report Generation
         ├── Email Services
         ├── Background Task Queues
         └── Document Management
```

## 🔧 Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://mortgage_user:secure_password@localhost:5432/mortgage_broker_pro

# Security
JWT_SECRET=your-production-jwt-secret-min-32-chars
NODE_ENV=production

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Email (Choose one provider)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
```

### Optional Configuration

- **Azure Key Vault**: For enterprise secret management
- **SendGrid/Mailgun/AWS SES**: For production email delivery
- **Monitoring**: Prometheus metrics endpoint

## 🚀 Deployment

### Production Deployment

```bash
# Build application
npm run build

# Start production server
npm start

# Or with PM2
npm install -g pm2
pm2 start dist/index.js --name emc2-core
```

### Docker Deployment

```bash
# Build production image
docker build -t emc2-core:latest .

# Run with environment
docker run -d \
  --name emc2-core \
  -p 3001:3001 \
  --env-file .env.production \
  emc2-core:latest
```

### Health Monitoring

- **Health Check**: `GET /health`
- **Metrics**: `GET /metrics` (if Prometheus enabled)
- **Status**: `GET /` (service info)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --testNamePattern="Calculation"

# Integration tests
npm run test:integration
```

## 📊 Features

### Core Services

- **Mortgage Calculations**: DSCR, affordability, investment metrics
- **Report Generation**: PDF reports with professional formatting
- **Background Processing**: Async task queues for heavy operations
- **Authentication**: JWT with RBAC and 2FA support
- **Email System**: Multi-provider with templates and tracking

### Security Features

- **Encryption**: AES-256-GCM for sensitive data
- **Rate Limiting**: Per-endpoint and global limits
- **CORS Protection**: Configurable origin policies
- **Session Management**: Secure session lifecycle
- **Audit Logging**: Comprehensive audit trail

### API Endpoints

#### Public Endpoints
- `GET /health` - Health check
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/register` - User registration

#### Protected Endpoints
- `POST /api/v1/scenarios` - Create mortgage scenario
- `POST /api/v1/calculations/dscr` - DSCR calculation
- `POST /api/tasks/reports/queue` - Queue report generation
- `GET /api/tasks/status/:jobId` - Check job status

## 🔍 Monitoring & Operations

### Logging

```bash
# View structured logs
tail -f logs/app.log | jq '.'

# Filter by level
tail -f logs/app.log | jq 'select(.level >= 40)'

# Monitor specific service
tail -f logs/app.log | jq 'select(.service == "emc2-core")'
```

### Queue Management

```bash
# Check queue status
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/tasks/stats

# Monitor job progress
curl http://localhost:3001/api/tasks/status/$JOB_ID
```

### Database Operations

```bash
# Connect to database
docker exec -it mortgage_broker_db psql -U mortgage_user -d mortgage_broker_pro

# Run migrations
npm run migrate

# Backup database
docker exec mortgage_broker_db pg_dump -U mortgage_user mortgage_broker_pro > backup.sql
```

## 🛠️ Development

### Development Environment

```bash
# Start development stack
docker-compose -f docker-compose.dev.yml up -d

# Run in development mode with hot reload
npm run dev

# Run linting
npm run lint

# Run type checking
npm run type-check
```

### Code Organization

```
src/
├── config/          # Configuration management
├── db/              # Database connections
├── middleware/      # Custom middleware
├── routes/          # API route handlers
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── templates/       # Email templates
```

## 📚 API Documentation

### Authentication Flow

1. **Register**: `POST /api/v1/auth/register`
2. **Login**: `POST /api/v1/auth/login` → Returns JWT token
3. **Use Token**: Include `Authorization: Bearer <token>` in requests
4. **Refresh**: `POST /api/v1/auth/refresh` → Get new token

### Sample Requests

#### Create Mortgage Scenario
```bash
curl -X POST http://localhost:3001/api/v1/scenarios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "First Time Buyer Analysis",
    "loanData": {
      "borrower": {
        "firstName": "John",
        "lastName": "Doe",
        "annualIncome": 85000,
        "creditScore": 750
      },
      "property": {
        "purchasePrice": 450000,
        "propertyType": "single-family",
        "address": "123 Main St, Anytown, USA"
      },
      "loan": {
        "loanAmount": 360000,
        "loanPurpose": "purchase",
        "termMonths": 360
      }
    }
  }'
```

## 🔐 Security Best Practices

### Production Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (min 32 characters)
- [ ] Enable Redis authentication
- [ ] Configure PostgreSQL SSL
- [ ] Set up proper CORS origins
- [ ] Enable rate limiting
- [ ] Configure log retention
- [ ] Set up monitoring alerts
- [ ] Regular security updates

### Environment Security

```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Redis password
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## 🆘 Troubleshooting

### Common Issues

**Service won't start**
```bash
# Check logs
docker logs mortgage_broker_emc2_core

# Verify dependencies
docker ps | grep mortgage
```

**Database connection failed**
```bash
# Test database connection
docker exec mortgage_broker_db pg_isready -U mortgage_user

# Check database logs
docker logs mortgage_broker_db
```

**Redis connection failed**
```bash
# Test Redis connection
docker exec redis-mortgage-broker redis-cli ping

# Check Redis logs
docker logs redis-mortgage-broker
```

### Support

For technical support and questions:
- **Documentation**: Check `/docs` directory
- **Issues**: Create GitHub issue with logs
- **Security**: Contact security team directly

## 📄 License

Private/Commercial License - Mortgage Broker Pro

---

## 🏆 Production Ready Checklist

- [x] Comprehensive test coverage (29 tests)
- [x] Production Docker configuration
- [x] Database migrations and schema
- [x] Security hardening (JWT, RBAC, encryption)
- [x] Background job processing
- [x] Health checks and monitoring
- [x] Structured logging
- [x] Error handling and graceful degradation
- [x] Documentation and operational guides
- [x] Configuration management

**Status: Production Ready ✅**
