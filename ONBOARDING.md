# Developer Onboarding

Welcome to Mortgage Broker Pro 3.0!

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Azure CLI (for cloud deployment)
- PostgreSQL client (e.g., psql)

## Getting Started
1. Clone the repo and copy `.env.example` to `.env` in each service.
2. Run `docker-compose up -d` to start the database.
3. Run `npm install` in each service directory.
4. Run tests with `npm test`.
5. Start services with `npm run dev`.

## Code Style
- Use Prettier (`npm run format`) and ESLint (`npm run lint`).
- All code should be TypeScript.

## CI/CD
- All pushes to `main` are built and deployed to Azure automatically.

## Secrets
- Use Azure Key Vault for production secrets (see `docs/azure-keyvault-setup.md`).

## Database
- See `scripts/backup-db.ps1` and `scripts/restore-db.ps1` for backup/restore.

## Health Checks
- All services expose `/health` and `/v1/health` endpoints.

## Monitoring
- See `docs/monitoring/observability-patterns.md` for logging and alerting setup.

## Architecture Diagram
![Architecture](docs/architecture-diagram.png)

## First Day Checklist
- [ ] Clone the repo
- [ ] Copy `.env.example` to `.env` in each service
- [ ] Run `docker-compose up -d`
- [ ] Run `npm install` in each service
- [ ] Run tests with `npm test`
- [ ] Start services with `npm run dev`

## FAQ / Common Gotchas
- If a service won’t start, check your `.env` and database connection.
- Use `npm run lint` and `npm run format` before pushing code.
- For Azure deploy issues, check GitHub Actions logs and Azure Portal.
