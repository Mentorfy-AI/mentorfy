# Graphiti Migration Guide

## Overview
This migration adds organization-level isolation to Graphiti episodes and folder metadata.

## Prerequisites
- Access to Neo4j Browser or Cypher Shell
- Organization UUID from Supabase

## Organization UUID
```
75e3e9e7-c942-46a8-a815-4261f087aa11
```

## Migration Steps

### 1. Verify Current State
```cypher
// Count episodes without group_id
MATCH (e:Episode)
WHERE e.group_id IS NULL
RETURN count(e) as episodes_to_migrate
```

### 2. Apply Migration
```cypher
// Update all existing episodes with organization group_id
MATCH (e:Episode)
WHERE e.group_id IS NULL
SET e.group_id = "75e3e9e7-c942-46a8-a815-4261f087aa11"
RETURN count(e) as updated_count
```

### 3. Verify Migration
```cypher
// Verify all episodes have group_id
MATCH (e:Episode)
WHERE e.group_id IS NOT NULL
RETURN count(e) as total_episodes
```

```cypher
// Check for any remaining null group_ids
MATCH (e:Episode)
WHERE e.group_id IS NULL
RETURN count(e) as remaining_nulls
// Should return 0
```

### 4. Verify Organization Isolation
```cypher
// All episodes should belong to the organization
MATCH (e:Episode)
WHERE e.group_id = "75e3e9e7-c942-46a8-a815-4261f087aa11"
RETURN count(e) as org_episodes
```

## Rollback (if needed)
```cypher
// Remove group_id from all episodes
MATCH (e:Episode)
WHERE e.group_id = "75e3e9e7-c942-46a8-a815-4261f087aa11"
REMOVE e.group_id
RETURN count(e) as rolled_back
```

## Post-Migration Testing
1. Upload a new document with folder assignment
2. Verify episode created with:
   - `group_id` = organization UUID
   - `metadata.organization_id` = organization UUID
   - `metadata.folder_id` = folder UUID (if assigned)
   - `metadata.folder_path` = folder path string

3. Test search filtering by organization:
```python
results = await graphiti_search_service.search(
    query="test query",
    organization_id="75e3e9e7-c942-46a8-a815-4261f087aa11",
    limit=5
)
```

## Notes
- This migration is safe to run multiple times (idempotent)
- Episodes without group_id will not appear in org-filtered searches
- New documents will automatically get the correct group_id
