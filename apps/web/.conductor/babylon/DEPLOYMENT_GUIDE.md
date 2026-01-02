# Mentorfy MVP - Production Deployment Guide

## Overview

This guide covers deploying the Mentorfy MVP to production using Docker containers.

## Architecture

- **Frontend**: Next.js deployed to Vercel
- **Backend**: FastAPI + Workers in Docker containers on AWS EC2
- **Services**: Redis, Neo4j, and workers running in Docker Compose

## Prerequisites

1. AWS EC2 instance (t3.medium or larger recommended)
2. Docker and Docker Compose installed
3. Domain name configured (optional)
4. Supabase project set up
5. OpenAI API key

## Deployment Steps

### 1. Server Setup

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-server-ip

# Install Docker and Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Logout and login again for group changes
exit
ssh -i your-key.pem ubuntu@your-server-ip
```

### 2. Code Deployment

```bash
# Clone the repository
git clone https://github.com/your-username/mentorfy-mvp.git
cd mentorfy-mvp

# Copy environment template
cp .env.production.template .env.production

# Edit production environment variables
nano .env.production
```

### 3. Environment Configuration

Update `.env.production` with your production values:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key

# Neo4j Configuration (set a secure password)
NEO4J_PASSWORD=your_secure_password

# Internal API Key (generate a secure key)
INTERNAL_API_KEY=your_secure_internal_key
```

### 4. Build and Deploy

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Check service health
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs fastapi
```

### 5. Initialize Services

```bash
# Initialize Neo4j indexes (run once)
docker exec mentorfy-mvp_fastapi_1 python scripts/init_neo4j_indexes.py

# Initialize Graphiti schema (run once)
docker exec mentorfy-mvp_fastapi_1 python scripts/init_graphiti_schema.py
```

### 6. Frontend Deployment (Vercel)

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
3. Deploy

## Configuration Details

### Worker Count Optimization

The production configuration uses 2 workers to prevent OpenAI API rate limit clustering:

```yaml
environment:
  - WORKER_COUNT=2  # Optimized for rate limit prevention
```

### Memory Configuration

- **Redis**: 2GB max memory with LRU eviction
- **Neo4j**: 2-4GB heap size depending on usage
- **FastAPI**: Restart policy for high availability

### Monitoring

Optional Redis Commander is available for queue monitoring:

```bash
# Enable monitoring tools
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Access Redis Commander at http://your-server:8081
```

### Health Checks

All services include health checks:
- FastAPI: `http://localhost:8000/health`
- Redis: `redis-cli ping`
- Neo4j: `neo4j status`

## Maintenance

### Viewing Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs

# Specific service
docker-compose -f docker-compose.prod.yml logs fastapi
docker-compose -f docker-compose.prod.yml logs redis
docker-compose -f docker-compose.prod.yml logs neo4j
```

### Updating Code

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart FastAPI service
docker-compose -f docker-compose.prod.yml build fastapi
docker-compose -f docker-compose.prod.yml up -d fastapi
```

### Backup

```bash
# Backup Neo4j data
docker exec mentorfy-mvp_neo4j_1 neo4j-admin backup --backup-dir=/tmp/backup
docker cp mentorfy-mvp_neo4j_1:/tmp/backup ./backup-$(date +%Y%m%d)

# Backup Redis (if needed)
docker exec mentorfy-mvp_redis_1 redis-cli BGSAVE
```

### Scaling

To increase processing capacity:

```bash
# Edit docker-compose.prod.yml
environment:
  - WORKER_COUNT=4  # Increase workers (monitor rate limits)

# Restart services
docker-compose -f docker-compose.prod.yml up -d fastapi
```

## Security Considerations

1. **Firewall**: Only expose necessary ports (80, 443, 22)
2. **SSL**: Use HTTPS in production with Let's Encrypt
3. **Environment Variables**: Never commit `.env.production` to git
4. **Database**: Use strong passwords for Neo4j
5. **API Keys**: Rotate keys regularly

## Troubleshooting

### Common Issues

1. **Services won't start**: Check Docker logs and ensure environment variables are set
2. **Rate limits**: Reduce WORKER_COUNT if hitting OpenAI limits
3. **Memory issues**: Monitor with `docker stats` and adjust container limits
4. **Neo4j connection**: Ensure Neo4j is fully started before FastAPI

### Debug Commands

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check resource usage
docker stats

# Test health endpoints
curl http://localhost:8000/health

# Check queue status
curl http://localhost:8000/api/queue/stats
```

## Support

For deployment issues:
1. Check logs first: `docker-compose logs`
2. Verify environment variables are set correctly
3. Ensure all required ports are open
4. Check service health endpoints

## Next Steps

After successful deployment:
1. Test full upload → process → chat flow
2. Monitor system performance and adjust resources
3. Set up automated backups
4. Configure monitoring and alerting
5. Plan for scaling based on usage