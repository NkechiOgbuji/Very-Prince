# Staging Environment Setup

This document explains how the staging environment is configured and deployed for the Very-Princess project.

## Overview

The staging environment runs on Stellar Testnet and provides a live preview environment for testing new features before they are deployed to production.

## Architecture

- **Frontend**: Deployed to Vercel at `https://very-princess-staging.vercel.app`
- **Backend**: Deployed as Docker container on staging server
- **Database**: PostgreSQL test database
- **Cache**: Redis instance
- **Network**: Stellar Testnet

## Deployment Pipeline

### Automatic Deployment

The staging environment is automatically deployed when:

1. Code is pushed to the `develop` or `staging` branches
2. Pull requests are created targeting `develop` or `staging` branches

### Deployment Process

1. **Tests**: All tests and linting must pass
2. **Frontend**: Built and deployed to Vercel
3. **Backend**: Docker image built and pushed to GitHub Container Registry
4. **Infrastructure**: Staging server pulls latest Docker image and restarts services

## Configuration

### Environment Variables

The staging environment uses the following configuration:

- `NODE_ENV=staging`
- `STELLAR_NETWORK=testnet`
- `RPC_URL=https://soroban-testnet.stellar.org`
- `HORIZON_URL=https://horizon-testnet.stellar.org`
- `FRONTEND_URL=https://very-princess-staging.vercel.app`

### Required Secrets

The following GitHub secrets must be configured:

- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `STAGING_HOST`: Staging server hostname
- `STAGING_USER`: SSH username for staging server
- `STAGING_SSH_KEY`: SSH private key for staging server
- `STAGING_BACKEND_URL`: Backend URL for frontend configuration

## Local Development

To run the staging environment locally:

```bash
# Start staging infrastructure
npm run staging:deploy:infra

# Build for staging
npm run staging:build

# Stop staging infrastructure
npm run staging:stop
```

## Monitoring

- **Frontend**: Available at `https://very-princess-staging.vercel.app`
- **Backend**: Health check at `https://your-staging-server.com/health`
- **Database**: PostgreSQL logs available in Docker container
- **Redis**: Connection status monitored via application logs

## Security Considerations

1. **Access Control**: Staging environment is protected by basic HTTP auth
2. **Network**: Uses Stellar Testnet (no real funds)
3. **Data**: Staging database is isolated from production
4. **API Rate Limits**: Configured to prevent abuse

## Troubleshooting

### Common Issues

1. **Deployment Fails**: Check GitHub Actions logs for specific error
2. **Frontend Not Loading**: Verify Vercel deployment status
3. **Backend Not Responding**: Check Docker container logs on staging server
4. **Database Connection Issues**: Verify PostgreSQL container is running

### Debug Commands

```bash
# Check Docker containers
docker-compose -f docker-compose.staging.yml ps

# View backend logs
docker-compose -f docker-compose.staging.yml logs backend

# Restart services
docker-compose -f docker-compose.staging.yml restart
```

## Manual Deployment

If automatic deployment fails, you can deploy manually:

```bash
# Build and push Docker image
docker build -f packages/backend/Dockerfile -t ghcr.io/your-org/very-princess:staging .
docker push ghcr.io/your-org/very-princess:staging

# Deploy to staging server
ssh user@staging-server
cd /opt/very-princess
docker-compose -f docker-compose.staging.yml pull
docker-compose -f docker-compose.staging.yml up -d
```

## Rollback

To rollback to a previous version:

1. Identify the previous deployment in GitHub Actions
2. Re-run the failed deployment with the previous commit SHA
3. Or manually deploy a previous Docker image tag

## Data Management

- **Database**: Automatically backed up daily
- **Logs**: Retained for 30 days
- **Cache**: Redis data is ephemeral and can be cleared safely

## Performance Monitoring

- **Response Times**: Monitored via health checks
- **Error Rates**: Tracked in application logs
- **Resource Usage**: Monitored on staging server
- **Database Performance**: PostgreSQL query stats available
