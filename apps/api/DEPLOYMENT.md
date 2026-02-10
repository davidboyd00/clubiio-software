# Clubio API - Deployment Guide

## Overview

This guide covers deploying the Clubio API to various environments.

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 15+
- Docker (optional, for containerized deployments)

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `openssl rand -base64 64` |

### Production Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_SECRET` | Session secret (min 32 chars) | `openssl rand -base64 48` |
| `CSRF_SECRET` | CSRF token secret | `openssl rand -base64 48` |
| `NODE_ENV` | Environment | `production` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `http://localhost:5173` |
| `SECRETS_PROVIDER` | Secrets source (env/aws/gcp) | `env` |

## Deployment Options

### 1. Direct Deployment (VPS/VM)

```bash
# Clone repository
git clone https://github.com/your-org/clubio.git
cd clubio

# Install dependencies
pnpm install --frozen-lockfile

# Generate Prisma client
cd apps/api
pnpm run db:generate

# Run migrations
npx prisma migrate deploy

# Build
pnpm run build

# Start with PM2
pm2 start dist/index.js --name clubio-api
```

### 2. Docker Deployment

```bash
# Build image
docker build -t clubio-api -f apps/api/Dockerfile .

# Run container
docker run -d \
  --name clubio-api \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  -e SESSION_SECRET="your-secret" \
  clubio-api
```

### 3. Docker Compose

```bash
cd apps/api
docker-compose up -d
```

### 4. Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### 5. Render

1. Connect your GitHub repository
2. Create a new Web Service
3. Set build command: `pnpm install && cd apps/api && pnpm run db:generate && pnpm run build`
4. Set start command: `cd apps/api && node dist/index.js`
5. Add environment variables

### 6. AWS ECS

```bash
# Build and push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -t clubio-api -f apps/api/Dockerfile .
docker tag clubio-api:latest $ECR_REGISTRY/clubio-api:latest
docker push $ECR_REGISTRY/clubio-api:latest

# Update ECS service
aws ecs update-service \
  --cluster clubio-cluster \
  --service clubio-api \
  --force-new-deployment
```

## CI/CD Pipeline

The deployment pipeline is defined in `.github/workflows/cd-deploy.yml`.

### Pipeline Stages

1. **CI Gate**: Tests, linting, TypeScript checks
2. **Build**: Create deployment artifacts
3. **Staging**: Deploy to staging environment
4. **Approval**: Manual approval for production
5. **Production**: Deploy to production
6. **Post-deployment**: Create release, notifications

### Trigger Deployment

```bash
# Automatic (push to main)
git push origin main

# Manual (GitHub Actions)
# Go to Actions > CD - Deploy > Run workflow
```

## Database Migrations

### Development

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migration
npx prisma migrate dev
```

### Production

```bash
# Apply pending migrations
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

## Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /api/health/ping` | Fast liveness check |
| `GET /api/health` | Full health status |

## Rollback

### Manual Rollback

1. Identify the last working version
2. Deploy that version using the deployment method
3. If database changes were made, restore from backup

### Automatic Rollback (CD Pipeline)

The CD pipeline includes automatic rollback on health check failure.

## Monitoring

### Logs

```bash
# Docker
docker logs -f clubio-api

# PM2
pm2 logs clubio-api

# Railway
railway logs
```

### Metrics

Configure your monitoring solution (Datadog, New Relic, etc.) with:

- Response times
- Error rates
- Database query times
- Memory/CPU usage

## Secrets Management

### AWS Secrets Manager

```bash
# Set environment
export SECRETS_PROVIDER=aws
export AWS_REGION=us-east-1
export AWS_SECRET_PREFIX=clubio/production/

# Create secret
aws secretsmanager create-secret \
  --name clubio/production/secrets \
  --secret-string '{
    "JWT_SECRET": "...",
    "DATABASE_URL": "...",
    "SESSION_SECRET": "...",
    "CSRF_SECRET": "..."
  }'
```

### Generate Secrets

```bash
# JWT Secret
openssl rand -base64 64

# Session Secret
openssl rand -base64 48

# CSRF Secret
openssl rand -base64 48
```

## Troubleshooting

### Common Issues

1. **Connection refused to database**
   - Check DATABASE_URL format
   - Verify network connectivity
   - Check firewall rules

2. **JWT errors**
   - Ensure JWT_SECRET is at least 32 characters
   - Check secret matches between services

3. **Prisma client errors**
   - Run `pnpm run db:generate` after schema changes
   - Ensure correct DATABASE_URL

### Support

For issues, create a ticket in the repository's issue tracker.
