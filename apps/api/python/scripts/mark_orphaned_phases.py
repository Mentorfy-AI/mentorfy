"""
Mark Orphaned Pipeline Phases

Detects and marks pipeline phases that are stuck in 'processing' status beyond their
expected_completion_at timestamp. These are jobs that were started but never completed
or retried, likely due to worker crashes, Redis queue issues, or other failures.

NOTE: This Python script is for MANUAL cleanup operations only.
      The ACTUAL automated cleanup runs as a Supabase pg_cron job that executes
      the SQL function mark_orphaned_pipeline_phases() every 5 minutes.

      To view/modify the production cron job:
      - Query: select * from cron.job where jobname = 'cleanup-orphaned-phases';
      - Function definition: \df mark_orphaned_pipeline_phases
      - Execution history: select * from cron.job_run_details where jobid =
                          (select jobid from cron.job where jobname = 'cleanup-orphaned-phases');

Usage:
    python python/scripts/mark_orphaned_phases.py [--dry-run]

Options:
    --dry-run    Show what would be marked as orphaned without making changes (default: dry-run)
"""

import os
import sys
import argparse
from datetime import datetime, timezone
from dotenv import load_dotenv

# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, project_root)

# Load .env.local from project root
load_dotenv(os.path.join(project_root, ".env.local"))

from mentorfy.utils.storage import get_supabase_client


def mark_orphaned_phases(dry_run: bool = True):
    """
    Find and mark pipeline phases that are orphaned (stuck in processing past timeout).

    Args:
        dry_run: If True, only print what would be marked without making changes
    """
    supabase = get_supabase_client()
    now = datetime.now(timezone.utc).isoformat()

    # Find orphaned phases (processing past expected_completion_at)
    orphaned_result = (
        supabase.table("pipeline_phase")
        .select("id, pipeline_job_id, phase, started_at, expected_completion_at")
        .eq("status", "processing")
        .lt("expected_completion_at", now)
        .execute()
    )

    orphaned_phases = orphaned_result.data

    if not orphaned_phases:
        print(f"✅ No orphaned phases found (checked at {now})")
        return

    print(f"⚠️  Found {len(orphaned_phases)} orphaned phase(s):")
    print()

    for phase in orphaned_phases:
        phase_age = datetime.now(timezone.utc) - datetime.fromisoformat(
            phase["started_at"].replace("Z", "+00:00")
        )
        print(f"  Phase ID: {phase['id']}")
        print(f"  Job ID: {phase['pipeline_job_id']}")
        print(f"  Phase: {phase['phase']}")
        print(f"  Started: {phase['started_at']}")
        print(f"  Expected completion: {phase['expected_completion_at']}")
        print(f"  Age: {phase_age}")
        print()

        if not dry_run:
            # Mark phase as failed
            supabase.table("pipeline_phase").update(
                {
                    "status": "failed",
                    "error_message": f"Phase timeout - no activity for {phase_age}. Marked as orphaned by automated cleanup.",
                    "error_type": "TimeoutError",
                    "completed_at": now,
                }
            ).eq("id", phase["id"]).execute()

            # Mark pipeline_job as failed
            supabase.table("pipeline_job").update(
                {
                    "status": "failed",
                    "completed_at": now,
                    "metadata": supabase.rpc(
                        "jsonb_set",
                        {
                            "target": supabase.raw("metadata"),
                            "path": "{orphaned}",
                            "new_value": "true",
                        },
                    ),
                }
            ).eq("id", phase["pipeline_job_id"]).execute()

            print(
                f"  ❌ Marked phase {phase['id']} and job {phase['pipeline_job_id']} as failed"
            )
            print()

    if dry_run:
        print(
            f"🔍 DRY RUN: Would mark {len(orphaned_phases)} phase(s) as failed (use without --dry-run to apply)"
        )
    else:
        print(f"✅ Marked {len(orphaned_phases)} orphaned phase(s) as failed")


def main():
    parser = argparse.ArgumentParser(
        description="Mark orphaned pipeline phases as failed"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be marked without making changes",
    )

    args = parser.parse_args()

    # Determine actual mode: default to dry_run=True unless --dry-run flag explicitly passes False
    # Since --dry-run is action="store_true", args.dry_run will be True if flag is present, False if not
    # But function defaults to dry_run=True, so we need to pass False if no flag
    is_dry_run = args.dry_run if args.dry_run else True  # Default to dry run

    print("=" * 70)
    print("Orphaned Phase Cleanup")
    print("=" * 70)
    if is_dry_run:
        print("🔍 MODE: DRY RUN (no changes will be made)")
    else:
        print("⚠️  MODE: LIVE (will mark orphaned phases as failed)")
    print()

    mark_orphaned_phases(dry_run=is_dry_run)


if __name__ == "__main__":
    main()
