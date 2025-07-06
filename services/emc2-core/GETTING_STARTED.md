# Getting Started with EMC2-Core

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (required)
- Redis 6+ (optional but recommended)
- Git

## Quick Start

### 1. Clone and Install

```bash
cd services/emc2-core
npm install
```

### 2. Environment Setup

```bash
# Copy the development environment file
cp .env.development .env

# Or for production
cp .env.example .env
# Then edit .env with your production values
```

### 3. Database Setup

#### Option A: Local PostgreSQL

```bash
# Install PostgreSQL if not already installed
# Windows: Download from https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql

# Start PostgreSQL service
# Windows: Use pgAdmin or Services
# Mac/Linux: brew services start postgresql

# Create database and schema
npm run db:setup
```

#### Option B: Docker PostgreSQL

```bash
# Run PostgreSQL in Docker
docker run -d \
  --name mortgage-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mortgage_broker_dev \
  -p 5432:5432 \
  postgres:14

# Wait a few seconds for it to start
sleep 5

# Run database setup
npm run db:setup
```

### 4. Redis Setup (Optional)

#### Option A: Local Redis

```bash
# Windows: Download from https://github.com/microsoftarchive/redis/releases
# Mac: brew install redis
# Linux: sudo apt-get install redis-server

# Start Redis
# Windows: redis-server.exe
# Mac/Linux: redis-server
```

#### Option B: Docker Redis

```bash
docker run -d \
  --name mortgage-redis \
  -p 6379:6379 \
  redis:7
```

### 5. Verify Setup

```bash
# Check all dependencies
npm run check

# Expected output:
# ✅ Environment
# ✅ Database
# ✅ Redis (or ⚠️ if optional)
# ✅ SMTP
```

### 6. Run Tests

```bash
# Run all tests
npm test

# All 29 tests should pass
```

### 7. Start Development Server

```bash
# Start with auto-reload
npm run dev

# Server will start on http://localhost:3001
```

### 8. Verify Health

```bash
# In another terminal
curl http://localhost:3001/health

# Expected response:
{
  "status": "ok",
  "timestamp": "...",
  "uptime": ...,
  "environment": "development",
  "version": "0.0.1"
}
```

## Development Workflow

### Making Changes

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Check types: `npm run type-check`
5. Lint code: `npm run lint`
6. Commit and push

### Available Commands

```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run start        # Start production server
npm run test         # Run tests
npm run check        # Check dependencies
npm run db:setup     # Setup database
npm run lint         # Lint code
npm run type-check   # Check TypeScript types
```

## Configuration

### Email Service

The development configuration uses Ethereal Email (test service).
Emails won't actually be sent but can be viewed at https://ethereal.email

For production, configure one of:
- SMTP (Gmail, Outlook, etc.)
- SendGrid
- Mailgun  
- AWS SES

See `.env.example` for detailed instructions.

### Database

Default development database:
- Host: localhost
- Port: 5432
- Database: mortgage_broker_dev
- User: postgres
- Password: postgres

### Redis

Optional but provides:
- Better session management
- Rate limiting
- Email queue processing
- Performance improvements

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready

# Check you can connect
psql -U postgres -h localhost

# Reset and recreate database
dropdb mortgage_broker_dev
npm run db:setup
```

### Port Already in Use

```bash
# Find process using port 3001
# Windows
netstat -ano | findstr :3001

# Mac/Linux
lsof -i :3001

# Kill the process or change PORT in .env
```

### Email Service Hanging

This should be fixed now, but if it happens:
1. Check the email service wrapper is being used
2. Verify no direct imports of emailService
3. Run the email test: `npx ts-node src/test-email-init.ts`

### Redis Connection Errors

Redis is optional. To disable warnings:
1. The app will work without Redis
2. You'll see warnings but they're safe to ignore
3. Some features like rate limiting won't work

## Next Steps

1. Review the API documentation
2. Set up your IDE (VS Code recommended)
3. Explore the codebase structure
4. Join the development chat
5. Pick an issue to work on

## Production Deployment

See `DEPLOYMENT.md` for production deployment instructions.
