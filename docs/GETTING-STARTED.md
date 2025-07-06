# Getting Started - Developer Guide

## Prerequisites

Before you begin, ensure you have the following installed:
- Docker Desktop
- Git
- A code editor (VS Code recommended)
- PowerShell 5.1 or higher (comes with Windows)

## First Time Setup

1. **Start Docker Desktop**
   - Make sure Docker Desktop is running before proceeding

2. **Clone the repository** (if you haven't already)
   ```powershell
   git clone https://github.com/SodieTX/Mortgage-Broker-Pro-3.0.git
   cd Mortgage-Broker-Pro-3.0
   ```

3. **Start the development environment**
   ```powershell
   .\scripts\start-dev.ps1
   ```
   This will:
   - Create your .env file (first time only)
   - Start the PostgreSQL database
   - Start PgAdmin for database management
   - Wait for everything to be ready

4. **Access the services**
   - Database: `postgresql://localhost:5432/mortgage_broker_pro`
   - PgAdmin: http://localhost:5050
     - Email: `admin@mortgage.local`
     - Password: `admin`

## Daily Development

### Starting your day
```powershell
.\scripts\start-dev.ps1
```

### Ending your day
```powershell
.\scripts\stop-dev.ps1
```

### Viewing logs
```powershell
docker-compose logs -f
```

### Connecting to the database
```powershell
docker-compose exec postgres psql -U mortgage_user mortgage_broker_pro
```

## Troubleshooting

### "Docker is not running"
- Start Docker Desktop and wait for it to fully initialize

### "Database failed to start"
- Check if port 5432 is already in use
- Run `docker-compose logs postgres` to see error details

### Reset everything
```powershell
docker-compose down -v  # This will delete all data!
.\scripts\start-dev.ps1
```

## Next Steps

Once your environment is running:
1. Review the [Solo Developer Principles](SOLO-DEVELOPER-PRINCIPLES.md)
2. Check the [Phase 0-1 Implementation Plan](PHASE-0-1-IMPLEMENTATION-PLAN.md)
3. Start with the EMC² Core Service setup

Remember: Keep it simple, keep it maintainable!
