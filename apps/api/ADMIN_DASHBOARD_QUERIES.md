# Admin Dashboard Queries (80/20 High Value)

## 1. Pipeline Health Overview

```sql
-- Current state of all pipelines
SELECT
    current_phase,
    status,
    COUNT(*) as count
FROM pipeline_job
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY current_phase, status
ORDER BY current_phase, status;

-- Result: Quick view of what's processing/stuck/failed
```

## 2. Failed Jobs (Action Required)

```sql
-- Recent failures with details
SELECT
    pj.document_id,
    pj.metadata->>'source_name' as file_name,
    pj.metadata->>'source_platform' as platform,
    pj.metadata->>'clerk_org_id' as org_id,
    pp.phase as failed_phase,
    pp.error_type,
    pp.error_message,
    pp.retry_count,
    pp.completed_at as failed_at
FROM pipeline_job pj
JOIN pipeline_phase pp ON pp.pipeline_job_id = pj.id
WHERE pj.status = 'failed'
  AND pj.created_at > NOW() - INTERVAL '7 days'
ORDER BY pp.completed_at DESC
LIMIT 50;
```

## 3. Stuck Jobs (Need Intervention)

```sql
-- Jobs processing > 30 minutes
SELECT
    pj.document_id,
    pj.current_phase,
    pj.metadata->>'source_name' as file_name,
    pp.started_at,
    EXTRACT(EPOCH FROM (NOW() - pp.started_at))/60 as minutes_stuck
FROM pipeline_job pj
JOIN pipeline_phase pp ON pp.pipeline_job_id = pj.id
WHERE pj.status = 'processing'
  AND pp.status = 'processing'
  AND pp.started_at < NOW() - INTERVAL '30 minutes'
ORDER BY pp.started_at;
```

## 4. Throughput by Phase

```sql
-- Jobs completed per hour, by phase (last 24h)
SELECT
    phase,
    DATE_TRUNC('hour', completed_at) as hour,
    COUNT(*) as completed
FROM pipeline_phase
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '24 hours'
GROUP BY phase, hour
ORDER BY hour DESC, phase;
```

## 5. Average Duration by Phase

```sql
-- Performance metrics
SELECT
    phase,
    COUNT(*) as completed_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))) as avg_seconds,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at)))) as median_seconds,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at)))) as p95_seconds
FROM pipeline_phase
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '7 days'
GROUP BY phase
ORDER BY phase;
```

## 6. Cost by Organization

```sql
-- Total costs per org (last 30 days)
SELECT
    metadata->>'clerk_org_id' as org_id,
    COUNT(DISTINCT document_id) as documents_processed,
    ROUND(SUM((metadata->>'total_cost_usd')::float), 2) as total_cost_usd
FROM pipeline_job
WHERE created_at > NOW() - INTERVAL '30 days'
  AND status = 'completed'
GROUP BY org_id
ORDER BY total_cost_usd DESC;
```

## 7. Failure Rate by Platform

```sql
-- Which source platforms are failing most?
SELECT
    pj.metadata->>'source_platform' as platform,
    COUNT(*) as total_attempts,
    SUM(CASE WHEN pj.status = 'failed' THEN 1 ELSE 0 END) as failures,
    ROUND(100.0 * SUM(CASE WHEN pj.status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 1) as failure_rate_pct
FROM pipeline_job pj
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY platform
ORDER BY failure_rate_pct DESC;
```

## 8. Queue Backlog (Redis)

```bash
# Run via CLI or Python
redis-cli LLEN rq:queue:extraction
redis-cli LLEN rq:queue:chunking
redis-cli LLEN rq:queue:kg_ingest
redis-cli LLEN rq:queue:failed
```

```python
# Python wrapper for API endpoint
def get_queue_stats():
    redis = get_redis_connection()
    return {
        "extraction": redis.llen("rq:queue:extraction"),
        "chunking": redis.llen("rq:queue:chunking"),
        "kg_ingest": redis.llen("rq:queue:kg_ingest"),
        "failed": redis.llen("rq:queue:failed"),
    }
```

## 9. Recent Completions

```sql
-- Successfully processed documents (last 100)
SELECT
    pj.document_id,
    pj.metadata->>'source_name' as file_name,
    pj.metadata->>'clerk_org_id' as org_id,
    pj.completed_at,
    EXTRACT(EPOCH FROM (pj.completed_at - pj.started_at))/60 as total_minutes
FROM pipeline_job pj
WHERE pj.status = 'completed'
ORDER BY pj.completed_at DESC
LIMIT 100;
```

## 10. Retry Analysis

```sql
-- How many retries are succeeding?
SELECT
    phase,
    retry_count,
    COUNT(*) as attempts,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successes,
    ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate_pct
FROM pipeline_phase
WHERE created_at > NOW() - INTERVAL '7 days'
  AND retry_count > 0
GROUP BY phase, retry_count
ORDER BY phase, retry_count;
```

## API Endpoint Structure

```python
# GET /api/admin/pipeline-dashboard
{
    "overview": {
        "processing": 12,
        "completed_today": 145,
        "failed_today": 3
    },
    "queue_lengths": {
        "extraction": 5,
        "chunking": 12,
        "kg_ingest": 3
    },
    "stuck_jobs": [...],  # Query 3
    "recent_failures": [...],  # Query 2
    "phase_performance": [...],  # Query 5
}
```
