# Folder System Deployment Guide

This guide walks through deploying the complete folder system to production.

## Pre-Deployment Checklist

- [ ] All code merged to main branch
- [ ] Database migrations tested in staging
- [ ] Graphiti migration script ready
- [ ] Environment variables configured
- [ ] Backup of production database created
- [ ] Backup of Neo4j database created

---

## Step 1: Database Migration

### 1.1 Backup Production Database

```bash
# Via Supabase CLI
supabase db dump > backup-$(date +%Y%m%d-%H%M%S).sql

# Or via pg_dump directly
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

### 1.2 Apply Schema Migration

**Option A: Via Supabase Dashboard**
1. Navigate to SQL Editor
2. Copy content from migration file
3. Execute SQL
4. Verify schema changes

**Option B: Via Supabase CLI**
```bash
supabase db push
```

### 1.3 Verify Schema Changes

```sql
-- Check folder table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'folder';

-- Check document.folder_id column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'document' AND column_name = 'folder_id';

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('folder', 'document');

-- Verify RLS policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'folder';
```

### 1.4 Test Database Access

```sql
-- As authenticated user (via Supabase client)
-- Should only return org folders
SELECT id, name, parent_folder_id
FROM folder
LIMIT 5;

-- Test folder creation
INSERT INTO folder (organization_id, name)
VALUES ('75e3e9e7-c942-46a8-a815-4261f087aa11', 'Test Deploy Folder')
RETURNING id, name;

-- Clean up test
DELETE FROM folder WHERE name = 'Test Deploy Folder';
```

---

## Step 2: Backend API Deployment

### 2.1 Update Python Backend (FastAPI)

**Deploy updated files:**
- `scripts/document_processor.py`
- `scripts/graphiti_search_service.py`
- Any new dependencies in `requirements.txt`

**If using Docker:**
```bash
# Build new image
docker build -t mentorfy-api:latest .

# Push to registry
docker push your-registry.com/mentorfy-api:latest

# Deploy to production
# (Railway, AWS, GCP, etc. specific commands)
```

**If using Railway:**
```bash
railway up
```

### 2.2 Update Environment Variables

Ensure backend has:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=xxx
OPENAI_API_KEY=sk-xxx
```

### 2.3 Test Backend Endpoints

```bash
# Test document upload with folder assignment
curl -X POST https://your-api.com/upload \
  -F "file=@test.pdf" \
  -F "organization_id=75e3e9e7-c942-46a8-a815-4261f087aa11" \
  -F "folder_id=xxx"

# Test search with org filtering
curl -X POST https://your-api.com/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "organization_id": "75e3e9e7-c942-46a8-a815-4261f087aa11"
  }'
```

---

## Step 3: Graphiti (Neo4j) Migration

### 3.1 Backup Neo4j Database

```bash
# If using Docker
docker exec neo4j neo4j-admin database dump neo4j --to-path=/backups

# If using Neo4j Desktop
# Use built-in backup feature: Manage → Dump
```

### 3.2 Apply Migration

**Connect to Neo4j Browser or Cypher Shell:**

```cypher
// 1. Check current state
MATCH (e:Episode)
WHERE e.group_id IS NULL
RETURN count(e) as episodes_without_group_id;

// 2. Apply migration (replace with your org UUID)
MATCH (e:Episode)
WHERE e.group_id IS NULL
SET e.group_id = "75e3e9e7-c942-46a8-a815-4261f087aa11"
RETURN count(e) as updated;

// 3. Verify all episodes have group_id
MATCH (e:Episode)
WHERE e.group_id IS NOT NULL
RETURN count(e) as total_episodes;

// 4. Verify no nulls remain
MATCH (e:Episode)
WHERE e.group_id IS NULL
RETURN count(e) as should_be_zero;
```

### 3.3 Test Graphiti Isolation

```cypher
// Verify episodes belong to organization
MATCH (e:Episode)
WHERE e.group_id = "75e3e9e7-c942-46a8-a815-4261f087aa11"
RETURN e.name, e.group_id, e.metadata
LIMIT 5;

// If you have multiple orgs, verify separation
MATCH (e:Episode)
RETURN e.group_id, count(e) as episode_count
GROUP BY e.group_id;
```

### 3.4 Test Document Ingestion with Folders

Upload a test document to verify:
```python
# In Python backend logs, verify episode created with:
# - group_id = organization UUID
# - metadata.organization_id = organization UUID
# - metadata.folder_id = folder UUID (if assigned)
# - metadata.folder_path = "Parent/Child" (if in folder)
```

---

## Step 4: Frontend Deployment

### 4.1 Build Frontend

```bash
# Install dependencies
pnpm install

# Build production bundle
pnpm run build

# Test build locally (optional)
pnpm start
```

### 4.2 Deploy to Vercel

```bash
# If using Vercel CLI
vercel --prod

# Or push to main branch (if auto-deploy configured)
git push origin main
```

### 4.3 Configure Environment Variables

In Vercel Dashboard, ensure these are set:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
BACKEND_API_URL=https://your-api.com
OPENAI_API_KEY=sk-xxx
GOOGLE_DRIVE_CLIENT_ID=xxx
GOOGLE_DRIVE_CLIENT_SECRET=xxx
```

### 4.4 Verify Deployment

1. Visit production URL
2. Log in
3. Navigate to `/knowledge`
4. Verify UI renders correctly
5. Check browser console for errors

---

## Step 5: Post-Deployment Verification

### 5.1 Smoke Tests

Run through critical paths:

1. **Create Folder**
   - [ ] Click "New Folder"
   - [ ] Enter name and submit
   - [ ] Folder appears in sidebar

2. **Create Nested Folder**
   - [ ] Right-click folder → "New Subfolder"
   - [ ] Verify nested appearance

3. **Upload Document to Folder**
   - [ ] Select folder
   - [ ] Upload document
   - [ ] Verify appears in folder

4. **Move Document via Drag & Drop**
   - [ ] Drag document to different folder
   - [ ] Verify move succeeds

5. **Bulk Operations**
   - [ ] Select multiple documents
   - [ ] Move to folder
   - [ ] Verify all moved

6. **Search**
   - [ ] Enter search query
   - [ ] Verify results filter correctly

### 5.2 Database Verification

```sql
-- Check folder creation
SELECT COUNT(*) as folder_count FROM folder;

-- Check document-folder associations
SELECT
  f.name as folder_name,
  COUNT(d.id) as document_count
FROM folder f
LEFT JOIN document d ON d.folder_id = f.id
GROUP BY f.id, f.name;

-- Check for orphaned documents
SELECT COUNT(*)
FROM document
WHERE folder_id IS NOT NULL
AND folder_id NOT IN (SELECT id FROM folder);
```

### 5.3 Graphiti Verification

```cypher
// Check recent episodes have group_id
MATCH (e:Episode)
WHERE e.metadata.ingested_at > datetime() - duration('PT1H')
RETURN e.name, e.group_id, e.metadata.folder_id
LIMIT 10;

// Verify search filtering works
// (Run search from frontend, verify only org episodes returned)
```

### 5.4 Performance Checks

Monitor these metrics:

- Folder list load time: < 300ms
- Document list load time: < 500ms
- Drag & drop response: < 200ms
- Bulk operations (50 docs): < 1s
- Search response: < 800ms

### 5.5 Multi-Tenancy Verification

If you have multiple organizations:

1. Log in as Org A user
2. Create folders and documents
3. Log in as Org B user
4. Verify cannot see Org A data
5. Create Org B folders
6. Verify isolation maintained

---

## Step 6: Monitoring & Alerts

### 6.1 Set Up Monitoring

**Frontend (Vercel):**
- Monitor build success/failures
- Track runtime errors via Vercel Analytics
- Set up error tracking (Sentry, LogRocket, etc.)

**Backend (Railway/your host):**
- Monitor API response times
- Track error rates
- Set up log aggregation

**Database (Supabase):**
- Monitor query performance
- Track connection pool usage
- Set up slow query alerts

**Neo4j:**
- Monitor query performance
- Track memory usage
- Set up backup schedule

### 6.2 Create Alerts

Set up alerts for:
- 5xx errors on API endpoints
- Database connection failures
- Slow queries (> 2s)
- High error rates (> 5%)
- Neo4j connection issues

---

## Step 7: Rollback Plan

If issues occur, rollback in reverse order:

### 7.1 Rollback Frontend
```bash
# Vercel: Revert to previous deployment
vercel rollback [deployment-url]

# Or redeploy previous commit
git revert HEAD
git push origin main
```

### 7.2 Rollback Backend
```bash
# Redeploy previous Docker image
docker pull your-registry.com/mentorfy-api:previous-tag
railway up

# Or revert Git commit
git revert HEAD
git push origin main
```

### 7.3 Rollback Graphiti Migration
```cypher
// Remove group_id from episodes
MATCH (e:Episode)
WHERE e.group_id = "75e3e9e7-c942-46a8-a815-4261f087aa11"
REMOVE e.group_id
RETURN count(e);
```

### 7.4 Rollback Database Migration
```sql
-- Drop folder_id column from document
ALTER TABLE document DROP COLUMN folder_id;

-- Drop folder table (WARNING: deletes all folders)
DROP TABLE folder CASCADE;
```

### 7.5 Restore from Backup (Last Resort)
```bash
# Restore Supabase database
psql -h db.xxx.supabase.co -U postgres -d postgres < backup.sql

# Restore Neo4j
docker exec neo4j neo4j-admin database load neo4j --from-path=/backups
```

---

## Step 8: User Communication

### 8.1 Pre-Deployment Notice

Send to users 24h before:
```
Subject: New Feature: Folder Organization

We're excited to announce a new folder system for organizing your documents!

Scheduled Maintenance: [Date] at [Time] (estimated 30 minutes)

New Features:
- Create folders to organize documents
- Drag & drop documents between folders
- Nested folder support
- Bulk move operations

Your existing documents will remain unchanged and accessible.
```

### 8.2 Post-Deployment Announcement

After successful deployment:
```
Subject: Folder Organization Now Live!

The new folder system is now available!

Key Features:
✅ Create unlimited folders and subfolders
✅ Drag & drop to organize
✅ Bulk move multiple documents
✅ Search within folders

Get Started: Visit the Knowledge Base to create your first folder.

Tutorial: [Link to guide]
Support: [Link to help docs]
```

### 8.3 Known Issues (if any)

Be transparent about limitations:
```
Known Limitations:
- Folders cannot be deleted if they contain documents
- Keyboard shortcuts require English keyboard layout
- Maximum folder nesting: 10 levels (recommended)
```

---

## Step 9: Documentation Updates

Update the following docs:

- [ ] User guide with folder features
- [ ] API documentation (folder endpoints)
- [ ] Database schema documentation
- [ ] Onboarding tutorial (add folder creation)
- [ ] FAQ (common folder questions)
- [ ] Changelog with release notes

---

## Step 10: Post-Launch Monitoring (First 7 Days)

### Day 1-3: Intensive Monitoring
- Check error logs every 4 hours
- Monitor user adoption metrics
- Respond to support tickets within 1 hour
- Watch for performance issues

### Day 4-7: Normal Monitoring
- Daily log review
- Weekly performance report
- Track feature usage metrics
- Collect user feedback

### Metrics to Track

**Adoption:**
- % of users who created folders
- Average folders per user
- Documents moved to folders

**Performance:**
- API response times (p50, p95, p99)
- Database query performance
- Error rates by endpoint

**User Behavior:**
- Most common folder structures
- Average folder nesting depth
- Bulk operation usage

---

## Success Criteria

Deployment is successful if:

- ✅ All smoke tests pass
- ✅ Zero data loss or corruption
- ✅ < 0.1% error rate in first 24 hours
- ✅ Performance within acceptable ranges
- ✅ Multi-tenancy isolation verified
- ✅ No critical bugs reported
- ✅ User adoption > 20% in first week

---

## Support Escalation

If issues arise:

1. **Minor UI Bugs**: Create GitHub issue, fix in next sprint
2. **Performance Issues**: Scale infrastructure, optimize queries
3. **Data Corruption**: Immediate rollback, restore from backup
4. **Security Issues**: Immediate fix, deploy hotfix within 4 hours
5. **Outage**: Rollback immediately, investigate offline

---

## Contacts

- **Engineering Lead**: [Name] - [Email]
- **DevOps**: [Name] - [Email]
- **Product Manager**: [Name] - [Email]
- **Support Team**: [Email]

---

## Appendix A: Migration SQL (Full)

See separate migration file in `supabase/migrations/`

## Appendix B: Cypher Migration (Full)

See `GRAPHITI_MIGRATION.md`

## Appendix C: Environment Variables Reference

See `.env.production.template`

## Appendix D: API Endpoint Reference

See `API_DOCUMENTATION.md`
