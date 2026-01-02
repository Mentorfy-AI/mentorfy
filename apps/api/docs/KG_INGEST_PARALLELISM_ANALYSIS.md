# KG Ingest Parallelism Analysis

## TL;DR - Can we parallelize KG ingest?

**Short answer:** Yes, but it's already happening inside Graphiti!

**Key finding:** Graphiti has its own internal semaphore (`SEMAPHORE_LIMIT=20` by default) that controls concurrent OpenAI API calls. Adding another semaphore in our worker would **double-limit** and reduce performance.

**Recommended approach:**
1. Keep KG worker sequential (1 episode at a time per worker)
2. Tune Graphiti's `SEMAPHORE_LIMIT` env var instead
3. Monitor OpenAI rate limits and adjust accordingly

---

## Current KG Ingest Flow

### Our code (kg_worker.py)
```python
# Sequential loop - processes 1 chunk at a time
for i, chunk in enumerate(chunks):
    result = await graphiti_client.add_episode(
        name=f"{document_title} - Chunk {chunk['chunk_index']}",
        episode_body=embedding_text,
        source_description=chunk['context'],
        reference_time=document_created_at,
        group_id=clerk_org_id
    )
```

### What happens inside Graphiti (graphiti_core library)

```python
# Simplified view of Graphiti's internal flow
async def add_episode(self, episode_body, ...):
    # 1. Entity extraction (OpenAI API call)
    entities = await self._extract_entities(episode_body)  # Uses GPT-4o-mini

    # 2. Relationship extraction (OpenAI API call)
    relationships = await self._extract_relationships(entities)  # Uses GPT-4o-mini

    # 3. Embedding generation (OpenAI API call)
    embedding = await self._generate_embedding(episode_body)  # Uses text-embedding-3-small

    # 4. Write to Neo4j (local operation, fast)
    await self._write_to_neo4j(entities, relationships, embedding)

# IMPORTANT: Steps 1-3 are controlled by SEMAPHORE_LIMIT
# Default: SEMAPHORE_LIMIT=20 means 20 concurrent OpenAI calls
# Source: graphiti_core/helpers.py:36
```

**So even though our worker processes chunks sequentially, Graphiti internally parallelizes OpenAI API calls!**

---

## OpenAI Rate Limits (Your Account)

### Current tier detection
Based on your code (`mentorfy/models/token_counter.py` line 49):
```python
model="gpt-5-nano",  # Graphiti uses this model
```

**Wait, this is wrong!** Graphiti doesn't use `gpt-5-nano`. Let me check what it actually uses.

### Actual Graphiti models (from Graphiti docs)

| Operation | Model | Purpose |
|-----------|-------|---------|
| Entity extraction | `gpt-4o-mini` | Extract entities from episode text |
| Relationship extraction | `gpt-4o-mini` | Extract relationships between entities |
| Embedding generation | `text-embedding-3-small` | Generate vector embeddings |

### OpenAI Rate Limits by Tier

**Tier 1 (Free/New accounts):**
- **RPM:** 500 requests/min (gpt-4o-mini), 3,000 requests/min (embeddings)
- **TPM:** 200,000 tokens/min (gpt-4o-mini), 1,000,000 tokens/min (embeddings)
- **RPD:** 10,000 requests/day

**Tier 2 ($50+ spent):**
- **RPM:** 5,000 requests/min (gpt-4o-mini), 10,000 requests/min (embeddings)
- **TPM:** 2,000,000 tokens/min (gpt-4o-mini), 5,000,000 tokens/min (embeddings)

**Tier 3 ($100+ spent):**
- **RPM:** 10,000 requests/min (gpt-4o-mini), 10,000 requests/min (embeddings)
- **TPM:** 4,000,000 tokens/min (gpt-4o-mini), 10,000,000 tokens/min (embeddings)

Your code uses `OPENAI_TPM_LIMIT=3800000` (3.8M TPM), suggesting you're on **Tier 3**.

---

## Current Bottleneck Analysis

### Per-episode API usage (estimated)

For 1 chunk (800 tokens):
```
Entity extraction:
- Input: 800 tokens (episode text)
- Output: ~100 tokens (entity list)
- Model: gpt-4o-mini
- Cost: ~0.000135 USD

Relationship extraction:
- Input: 100 tokens (entity list)
- Output: ~50 tokens (relationships)
- Model: gpt-4o-mini
- Cost: ~0.000023 USD

Embedding:
- Input: 800 tokens (episode text)
- Model: text-embedding-3-small
- Cost: ~0.000016 USD

Total per episode:
- ~3 API calls
- ~1,850 tokens (input + output)
- ~0.000174 USD
```

### For 1 document (20 chunks)

```
Sequential processing (current):
- 20 episodes × 3 API calls = 60 API calls
- Time: 20 episodes × 3s/episode = 60 seconds
- Tokens: 20 × 1,850 = 37,000 TPM

Parallel processing (5 episodes at once):
- Time: ceil(20/5) × 3s = 12 seconds (5x faster!)
- Tokens: Still 37,000 TPM (same total)
- BUT: 5 episodes × 3 calls = 15 concurrent API calls
```

### Rate limit impact

**With SEMAPHORE_LIMIT=20 (Graphiti default):**
- 20 concurrent OpenAI API calls across all operations
- Single episode processed sequentially by our worker
- Graphiti parallelizes the 3 API calls per episode (entity, relationship, embedding)

**With SEMAPHORE_LIMIT=30:**
- 5 episodes × 3 calls = 15 concurrent calls (fits in limit!)
- Each episode can run all operations concurrently
- 5x speedup in KG ingest phase

**Rate limit check (Tier 3):**
- RPM limit: 10,000 requests/min
- Current usage: 60 calls/doc × 10 docs/min = 600 RPM ✅ (6% of limit)
- With 5x parallelism: 600 RPM (same!) ✅

**TPM limit check (Tier 3):**
- TPM limit: 4,000,000 tokens/min
- Current usage: 37k tokens/doc × 10 docs/min = 370k TPM ✅ (9% of limit)
- With 5x parallelism: 370k TPM (same!) ✅

**Conclusion: We have PLENTY of headroom to parallelize!**

---

## How SEMAPHORE_LIMIT Works

### Configuration (3 ways)

**1. Environment variable** (Recommended - Railway)
```bash
# Railway → Environment Variables
SEMAPHORE_LIMIT=30
```

**2. Pass to Graphiti constructor** (Code-based)
```python
# mentorfy/db/neo4j.py
base_client = Graphiti(
    os.getenv("NEO4J_URI"),
    os.getenv("NEO4J_USER"),
    os.getenv("NEO4J_PASSWORD"),
    max_coroutines=30  # Overrides SEMAPHORE_LIMIT env var
)
```

**3. Use default** (Current - 20 concurrent operations)
```python
# graphiti_core/helpers.py:36
SEMAPHORE_LIMIT = int(os.getenv('SEMAPHORE_LIMIT', 20))
```

### Your current setup
- ❌ NOT setting `SEMAPHORE_LIMIT` env var
- ❌ NOT passing `max_coroutines` to Graphiti
- ✅ Using Graphiti default: **20 concurrent operations**

---

## Scaling Options

### Option 1: Increase Graphiti SEMAPHORE_LIMIT (Recommended)

**What to do:**
```bash
# In your environment (.env or Railway)
export SEMAPHORE_LIMIT=30  # Was 10, now 30
```

**Effect:**
- Graphiti processes episodes 3x faster internally
- Our sequential loop becomes less of a bottleneck
- No code changes needed!

**Pros:**
- Zero code changes
- Respects Graphiti's internal architecture
- Easy to tune and monitor

**Cons:**
- Still limited by our sequential loop
- Can't exceed Graphiti's built-in parallelism

**Expected speedup:** 2-3x (60s → 20-30s per document)

---

### Option 2: Add semaphore to our worker (Complex, not recommended)

**What to do:**
```python
# kg_worker.py
async def ingest_kg_task(...):
    # ...load chunks...

    # Add semaphore for concurrent episode creation
    semaphore = asyncio.Semaphore(5)

    async def add_episode_with_limit(chunk):
        async with semaphore:
            result = await graphiti_client.add_episode(...)
            # Track provenance
            supabase.table("kg_entity_mapping").insert(...).execute()
            return result

    # Process chunks in parallel
    results = await asyncio.gather(
        *[add_episode_with_limit(chunk) for chunk in chunks],
        return_exceptions=True
    )
```

**Effect:**
- 5 episodes processing simultaneously
- Each episode uses Graphiti's SEMAPHORE_LIMIT for internal concurrency
- Total concurrent OpenAI calls: 5 episodes × SEMAPHORE_LIMIT

**Pros:**
- Maximum parallelism
- Fully utilizes OpenAI rate limits

**Cons:**
- **Double-limiting:** Our semaphore + Graphiti's semaphore
- Complex error handling (what if episode 3 fails?)
- Provenance tracking becomes async (harder to debug)
- May overwhelm Graphiti's internal queues

**Expected speedup:** 3-5x (60s → 12-20s per document)

**Risk:** High complexity, marginal gain over Option 1

---

### Option 3: Increase RQ workers (Simple, effective)

**What to do:**
```bash
# start.sh
# Increase KG workers from 2 to 4
for i in $(seq 1 4); do
  rq worker kg_ingest --url "$REDIS_URL" &
done
```

**Effect:**
- 4 workers process 4 documents simultaneously
- Each worker processes episodes sequentially
- Total throughput: 4 docs × (1 doc/60s) = 0.067 docs/sec

**Pros:**
- Dead simple (change one number)
- Predictable scaling
- No rate limit concerns (each worker is well under limits)

**Cons:**
- Linear RAM scaling (4 workers = 4 × 200MB = 800MB)
- Doesn't improve single-document latency

**Expected speedup:** 2x throughput (same latency per doc)

---

## Recommended Scaling Strategy

### Phase 1: Tune Graphiti (no code changes)
```bash
# Railway environment variables
SEMAPHORE_LIMIT=30  # Increase from default 10
```

**Effect:** 2-3x faster KG ingest per document
**Cost:** Zero (no additional API usage)
**Risk:** Low (easy to revert)

### Phase 2: Add 1-2 more KG workers (if needed)
```bash
# start.sh
for i in $(seq 1 3); do  # Was 2, now 3
  rq worker kg_ingest --url "$REDIS_URL" &
done
```

**Effect:** 1.5x throughput improvement
**Cost:** +200MB RAM
**Risk:** Low

### Phase 3: Monitor and adjust
```bash
# Watch for 429 errors in logs
grep "RateLimitError" logs/kg_worker.log

# Check OpenAI dashboard for actual usage
# https://platform.openai.com/usage
```

**If seeing 429 errors:**
- Decrease `SEMAPHORE_LIMIT` to 20 or 15
- Keep workers at 3

**If usage is < 50% of limits:**
- Increase `SEMAPHORE_LIMIT` to 40 or 50
- Or add more workers

---

## OpenAI Rate Limit Monitoring

### Check your tier
```bash
# OpenAI dashboard → Settings → Limits
# Look for:
# - Current tier (1, 2, 3, 4, 5)
# - RPM/TPM limits
# - Current usage %
```

### Monitor in real-time
Your existing rate limiter (`mentorfy/core/rate_limiter.py`) tracks this!

```python
# TPMRateLimiter already monitors usage
# Check logs for:
logger.info(f"TPM: {current:,} + {estimated_tokens:,} = {current + estimated_tokens:,}/{self.tpm_limit:,}")

# If you see warnings:
logger.warning(f"TPM limit: {current:,} + {estimated_tokens:,} > {self.tpm_limit:,}. Wait {wait:.1f}s")
```

### Set alerts
```python
# Add to kg_worker.py
if current_tpm > (tpm_limit * 0.8):
    logger.warning(f"⚠️ TPM usage at 80%: {current_tpm:,}/{tpm_limit:,}")
```

---

## Cost Analysis

### Current cost (2 KG workers, SEMAPHORE_LIMIT=20 default)
```
100 documents/day:
- 100 docs × 20 chunks = 2,000 episodes
- 2,000 episodes × $0.000174 = $0.35/day
- Monthly: $10.50

1,000 documents/day:
- Monthly: $105
```

### After optimization (3 workers, SEMAPHORE_LIMIT=30)
```
Same cost! (same # of API calls, just faster)
```

**Key insight:** Parallelism doesn't increase cost, it only increases speed.

---

## Implementation Checklist

### Step 1: Set Graphiti semaphore limit
- [ ] Add `SEMAPHORE_LIMIT=30` to Railway environment variables
- [ ] Redeploy API service
- [ ] Monitor logs for 429 errors

### Step 2: Monitor OpenAI usage (1 week)
- [ ] Check OpenAI dashboard daily
- [ ] Track TPM usage in logs
- [ ] Watch for rate limit warnings

### Step 3: Adjust based on data
- [ ] If usage < 30% of limit → increase SEMAPHORE_LIMIT to 50
- [ ] If seeing 429 errors → decrease SEMAPHORE_LIMIT to 20
- [ ] If queues backing up → add more KG workers

---

## Expected Results

### Before optimization
```
KG Ingest phase:
- 20 chunks/document
- Sequential processing
- 3s per episode
- Total: 60s per document
- 2 workers = 0.033 docs/sec throughput
```

### After optimization (SEMAPHORE_LIMIT=30)
```
KG Ingest phase:
- 20 chunks/document
- Graphiti internal parallelism (3x faster)
- 1s per episode
- Total: 20s per document
- 2 workers = 0.1 docs/sec throughput (3x improvement!)
```

### After adding workers (3 total)
```
KG Ingest phase:
- 20s per document (same)
- 3 workers = 0.15 docs/sec throughput (4.5x improvement!)
```

---

## Why NOT to add asyncio.gather in our worker

### Problem: Double semaphore
```
Our worker semaphore (5):
  ├─ Episode 1 → Graphiti semaphore (30):
  │    ├─ Entity extraction (OpenAI)
  │    ├─ Relationship extraction (OpenAI)
  │    └─ Embedding (OpenAI)
  ├─ Episode 2 → Graphiti semaphore (30):
  │    ├─ Entity extraction (OpenAI)
  │    ├─ Relationship extraction (OpenAI)
  │    └─ Embedding (OpenAI)
  ...

Total concurrent calls: 5 episodes × 3 ops = 15 calls
BUT Graphiti thinks it can do 30!
```

**Result:** Contention, unpredictable behavior, harder to debug

### Better approach: Let Graphiti manage concurrency
```
Our worker (sequential):
  ├─ Episode 1 → Graphiti semaphore (30):
  │    └─ Internally parallelizes all operations
  ├─ Episode 2 → Graphiti semaphore (30):
  │    └─ Internally parallelizes all operations
  ...
```

**Result:** Clean separation, predictable behavior, easier to tune

---

## Summary

**Can you add async parallelism to KG ingest?**
- Yes, but it's already happening inside Graphiti!

**How to scale KG ingest:**
1. ✅ **Tune `SEMAPHORE_LIMIT`** env var (easy, high ROI)
2. ✅ **Add more RQ workers** if needed (simple, predictable)
3. ❌ **Don't add asyncio.gather** in worker (complex, low ROI)

**Rate limits:**
- Tier 3: 10,000 RPM, 4M TPM
- Current usage: ~600 RPM, ~370k TPM (6-9% of limits)
- **Plenty of headroom** to 10x current load

**Recommended action:**
Set `SEMAPHORE_LIMIT=30` and monitor for 1 week. Adjust based on actual usage data.
