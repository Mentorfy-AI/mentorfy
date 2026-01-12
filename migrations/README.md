# Database Migrations

## Running Migrations

Run migrations in the Supabase SQL Editor or via CLI:

```bash
# Via Supabase CLI (if linked)
supabase db push

# Or manually in Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Paste migration contents
# 3. Run
```

## Migration Log

| File | Description | Status |
|------|-------------|--------|
| `001_add_flow_step_answers_columns.sql` | Add flow_id, current_step_id, answers columns for state management refactor | Pending |
| `002_fix_rafael_ai_flow_id.sql` | Fix rafael-ai flow_id to rafael-tats | Pending |
| `003_create_webhook_queue.sql` | Create webhook_queue table for durable webhook delivery | Pending |
| `004_setup_webhook_cron.sql` | Set up pg_cron job for webhook queue processing | Pending |
| `005_add_webhook_failure_alerting.sql` | Add function and index for failure counting | Pending |
| `006_webhook_queue_rls.sql` | Enable RLS on webhook_queue table | Pending |

## Rollback

The `context` column is preserved. To rollback:
1. Application code can read from `context` instead of `answers`
2. Drop new columns if needed (data loss for new fields)
