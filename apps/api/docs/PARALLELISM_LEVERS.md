# Parallelism Levers in Phased Pipeline

This document explains the three independent levers you can adjust to control parallelism and throughput in the document processing pipeline.

## Executive Summary

The phased pipeline has **three independent parallelism levers**:

1. **RQ Worker Count** (process-level) - How many documents process simultaneously
2. **Asyncio Semaphore** (coroutine-level) - How many API calls per document execute concurrently
3. **Thread Pool** (thread-level) - How many blocking I/O operations run in parallel

**Current status:**
- ✅ Lever 1 configured for all phases (start.sh)
- ✅ Lever 2 configured for chunking only (Semaphore 10)
- ❌ Lever 2 NOT configured for extraction, ingest+extract, or KG ingest
- ❌ Lever 3 not used anywhere

---

## Lever 1: RQ Worker Count (Process-Level Parallelism)

### What it controls
Number of **OS processes** that pull jobs from Redis queues and execute them simultaneously.

### Current configuration
```bash
# start.sh
Extraction workers: 3
Ingest+Extract workers: 2
Chunking workers: 3
KG Ingest workers: 2
Total: 10 workers
```

### How to adjust
Edit `start.sh`:
```bash
# Increase extraction workers from 3 to 5
for i in $(seq 1 5); do
  rq worker extraction --url "$REDIS_URL" &
done
```

### Effect
- **3 workers:** 3 documents process simultaneously
- **6 workers:** 6 documents process simultaneously (2x throughput)

### Cost
- Each worker consumes ~200-300MB RAM
- Linear scaling: 2x workers = 2x RAM usage

### When to adjust
- **Increase** when queues are backing up (jobs waiting > 5 minutes)
- **Decrease** when workers are idle (queue empty, low utilization)

### Monitoring
```bash
# Check queue depth
rq info --url "$REDIS_URL"

# Look for:
# - Queue length (jobs waiting)
# - Active workers (currently processing)
# - Worker utilization (busy vs idle)
```

---

## Lever 2: Asyncio Semaphore (Coroutine-Level Parallelism)

### What it controls
Number of **concurrent async operations** (API calls, database queries) within a single job/document.

### Current configuration
| Phase | Semaphore | Status |
|-------|-----------|--------|
| Extraction | None | ❌ Sequential |
| Ingest+Extract | None | ❌ Sequential |
| Chunking | 10 | ✅ Parallel |
| KG Ingest | None | ❌ Sequential |

### How it works (chunking example)
```python
# chunking_service.py
class ContextualChunkingService:
    def __init__(self, max_concurrent_requests: int = 10):
        self.max_concurrent_requests = max_concurrent_requests

    async def _generate_contexts_concurrent(self, base_chunks):
        # Semaphore limits concurrent LLM API calls
        semaphore = asyncio.Semaphore(self.max_concurrent_requests)

        async def generate_with_limit(chunk):
            async with semaphore:
                return await self._generate_chunk_context(chunk)

        # Process all chunks concurrently (up to semaphore limit)
        contexts = await asyncio.gather(
            *[generate_with_limit(chunk) for chunk in base_chunks]
        )
        return contexts
```

### Effect on chunking (20 chunks per document)
- **Without semaphore (sequential):** 20 chunks × 3s = 60s
- **Semaphore(10):** ceil(20/10) × 3s = 6s (10x faster!)
- **Semaphore(20):** ceil(20/20) × 3s = 3s (20x faster, but rate limits!)

### How to adjust
```python
# When initializing chunking service
chunking_service = get_chunking_service(
    api_key=anthropic_api_key,
    max_concurrent_requests=15  # Increase from 10 to 15
)
```

### Cost
- **No RAM cost** (coroutines are lightweight)
- **API rate limits** become the constraint
- **API costs increase** if you hit rate limits and retry

### When to adjust
- **Increase** when API rate limits are not an issue
- **Decrease** when hitting rate limits (429 errors)
- Monitor API provider dashboards for rate limit usage

### Constraints by API provider
| Provider | Default Rate Limit | Recommended Semaphore |
|----------|-------------------|----------------------|
| Anthropic (Claude Haiku) | 50 requests/min | 10-15 |
| OpenAI (GPT-4) | 500 requests/min | 20-30 |
| Deepgram | 200 concurrent | N/A (external service) |
| Neo4j (Graphiti) | Connection pool | 5-10 |

---

## Lever 3: Thread Pool (Thread-Level Parallelism)

### What it controls
Number of **threads** for blocking I/O operations (file downloads, CPU-heavy tasks).

### Current configuration
**Not implemented** - all I/O is async or sequential.

### When to use
- Blocking file I/O that can't be made async
- CPU-intensive operations (PDF parsing, image processing)
- External libraries that don't support asyncio

### Example implementation
```python
from concurrent.futures import ThreadPoolExecutor
import asyncio

executor = ThreadPoolExecutor(max_workers=3)

async def extract_task(...):
    # Download file in thread pool (if blocking)
    file_data = await asyncio.get_event_loop().run_in_executor(
        executor,
        blocking_download_function,
        url
    )
```

### Cost
- Each thread consumes ~8MB RAM (stack space)
- OS thread scheduling overhead
- Complexity (mixing threads + asyncio)

### When to adjust
- **Add** when you have blocking I/O that can't be made async
- **Increase** when thread pool is bottleneck (threads all busy)
- **Avoid** if async alternatives exist

---

## Current Throughput Analysis

### Per-phase throughput (current configuration)

| Phase | Workers (L1) | Semaphore (L2) | Avg Time | Throughput |
|-------|--------------|----------------|----------|------------|
| Extraction | 3 | None | 90s | 0.033 docs/sec |
| Ingest+Extract | 2 | None | 120s | 0.017 docs/sec |
| Chunking | 3 | 10 | 9s | 0.33 docs/sec |
| KG Ingest | 2 | None | 60s | 0.033 docs/sec |

**Observations:**
- Chunking is **10x faster** due to Semaphore(10)
- Extraction and KG Ingest are bottlenecks
- Chunking could handle 10x more load

### Bottleneck identification

**Steady state (10 docs/hour upload rate):**
- Upload rate: 0.0028 docs/sec
- All phases can handle this easily ✅

**Burst (100 docs uploaded in 10 seconds):**
- Burst rate: 10 docs/sec
- Extraction queue drain time: 100 / 0.033 = 3000s = 50 minutes ⚠️
- Users don't care (background processing)

**User-perceived latency (1 doc, empty queue):**
- Extraction: 90s
- Chunking: 9s
- KG Ingest: 60s
- **Total:** 159s = 2.6 minutes ✅

---

## Optimization Strategies

### Strategy 1: Just increase workers (Lever 1) - Simple, costly
```bash
# start.sh
Extraction: 6 workers (was 3) → 2x throughput
Ingest+Extract: 4 workers (was 2) → 2x throughput
Chunking: 3 workers (same) → already fast
KG Ingest: 4 workers (was 2) → 2x throughput
Total: 17 workers (was 10)
```

**Effect:** ~2x throughput across the board
**Cost:** 70% more RAM (~3GB → 5GB)
**Effort:** Change 4 numbers in start.sh
**When to use:** Quick fix for sustained high load

### Strategy 2: Add semaphore to bottleneck phases (Lever 2) - Efficient, complex
```python
# kg_worker.py - Add Semaphore(5) for parallel episode creation
# extraction_worker.py - Could parallelize file operations (low ROI)
```

**Effect:** 3-5x throughput for KG phase only
**Cost:** Higher API usage, potential rate limits
**Effort:** 20-50 lines of code per worker
**When to use:** Optimize specific bottleneck without RAM cost

### Strategy 3: Rebalance workers based on measured load (Lever 1) - Smart
```bash
# Measure actual queue depths over 1 week, then adjust:
Extraction: 5 workers (high variance in processing time)
Ingest+Extract: 2 workers (low volume)
Chunking: 2 workers (fast due to semaphore)
KG Ingest: 1 worker (will add semaphore to speed up)
Total: 10 workers (same total, better distribution)
```

**Effect:** Better resource utilization
**Cost:** None (same worker count)
**Effort:** 1 week of monitoring + config change
**When to use:** Production optimization after measuring real usage

---

## Railway Resource Allocation

### Current resource needs (estimated)

**Per worker type:**
```
Extraction worker:     CPU: 50%   RAM: 200MB (temp files)
Ingest+Extract worker: CPU: 40%   RAM: 300MB (in-memory files!)
Chunking worker:       CPU: 20%   RAM: 150MB (text processing)
KG worker:             CPU: 60%   RAM: 200MB (graph operations)
```

**Total (10 workers):**
```
CPU = (3 × 50%) + (2 × 40%) + (3 × 20%) + (2 × 60%)
    = 150% + 80% + 60% + 120%
    = 410% = ~5 vCPUs

RAM = (3 × 200MB) + (2 × 300MB) + (3 × 150MB) + (2 × 200MB)
    = 600MB + 600MB + 450MB + 400MB
    = 2050MB = ~2.5GB
```

**Add overhead:**
- FastAPI server: 1 vCPU, 512MB
- RQ Scheduler: 0.5 vCPU, 256MB
- OS overhead: 20%

**Recommended Railway config:**
- vCPUs: **8** (allows headroom for spikes)
- RAM: **4-6GB** (ingest_extract needs 300MB per worker!)
- Storage: **10GB SSD** (temp files + logs)

### Scaling guidelines

| Worker Count | vCPUs | RAM | Monthly Cost (estimated) |
|--------------|-------|-----|-------------------------|
| 10 workers | 8 | 4GB | $30-40 |
| 15 workers | 12 | 6GB | $50-60 |
| 20 workers | 16 | 8GB | $70-80 |

---

## Monitoring and Tuning

### Key metrics to track

**Queue metrics (Redis):**
```bash
rq info --url "$REDIS_URL"

# Watch for:
# - Queue length > 100: Consider adding workers
# - Queue length > 1000: Emergency - add workers immediately
# - Failed jobs > 10%: Investigate errors, not a scaling issue
```

**Worker utilization:**
```bash
# Railway dashboard or docker stats
# Look for:
# - CPU usage consistently > 80%: Need more vCPUs
# - RAM usage > 90%: Need more RAM
# - Workers idle > 50% of time: Reduce worker count
```

**API rate limits:**
```bash
# Check provider dashboards:
# - Anthropic: https://console.anthropic.com/settings/limits
# - OpenAI: https://platform.openai.com/account/rate-limits
# - Look for: 429 errors, throttling warnings
```

### When to adjust each lever

| Symptom | Root Cause | Lever to Adjust | Action |
|---------|------------|-----------------|--------|
| Queue backing up | Insufficient workers | Lever 1 | Increase worker count |
| Workers idle | Too many workers | Lever 1 | Decrease worker count |
| Job slow, many API calls | Sequential processing | Lever 2 | Add semaphore |
| 429 rate limit errors | Too much concurrency | Lever 2 | Decrease semaphore |
| High CPU, blocking I/O | Blocking operations | Lever 3 | Add thread pool |
| Out of memory | Too many workers | Lever 1 | Decrease or upgrade RAM |

---

## Future Optimizations (Not Implemented)

### 1. Dynamic worker scaling
- Monitor queue depth
- Auto-scale workers up/down
- Requires Kubernetes or Railway auto-scaling

### 2. Priority queues
- Separate queues for urgent vs background jobs
- High-priority docs jump the queue
- Requires custom queue management

### 3. Batch processing
- Group small documents together
- Process 10 docs in 1 job
- Reduces queue overhead

### 4. Caching
- Cache transcription results
- Cache chunk contexts for similar documents
- Requires cache invalidation strategy

---

## Quick Reference

### Check queue status
```bash
rq info --url "$REDIS_URL"
```

### Increase workers (Lever 1)
```bash
# Edit start.sh, change loop count:
for i in $(seq 1 5); do  # was 3, now 5
  rq worker extraction --url "$REDIS_URL" &
done
```

### Increase semaphore (Lever 2)
```python
# Find service initialization, increase max_concurrent_requests:
service = Service(max_concurrent_requests=20)  # was 10
```

### Monitor Railway resources
```bash
# Railway dashboard → Metrics tab
# Watch: CPU %, Memory %, Active workers
```

### Emergency scale-up
```bash
# If queues are exploding:
# 1. Edit start.sh, double all worker counts
# 2. Redeploy to Railway
# 3. Monitor queue drain
# 4. Scale back down after burst clears
```
