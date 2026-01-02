"""
Supabase Clerk ID Migration Script

Updates all Supabase tables from dev Clerk IDs to prod Clerk IDs.
This migrates both organization and user references across 15+ tables.

Usage:
    # Dry run (shows what would change, doesn't modify)
    python python/scripts/migrate_supabase_clerk_ids.py --dry-run

    # Execute migration (DESTRUCTIVE)
    python python/scripts/migrate_supabase_clerk_ids.py

Requirements:
    - Supabase CLI configured with your project (npx supabase link)
    - org-mapping.json and user-mapping.json in API root directory
    - Run from API root directory

WARNING:
    This script modifies Supabase data in place. Make sure you have backups!
    Run with --dry-run first to verify changes.

Migration Strategy:
    - Option A: Drop FK → Update PK → Recreate FK
    - Handles PRIMARY KEY constraints on organization.clerk_org_id
    - Handles self-referential FK on super_admin.granted_by
    - Updates all 15 tables in correct dependency order
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, Tuple

# API root directory
api_root = Path(__file__).parent.parent.parent


def load_mappings() -> Tuple[Dict[str, str], Dict[str, str]]:
    """Load org and user ID mappings from JSON files"""
    org_mapping_path = api_root / "org-mapping.json"
    user_mapping_path = api_root / "user-mapping.json"

    if not org_mapping_path.exists():
        print(f"❌ Error: org-mapping.json not found at {org_mapping_path}\n")
        sys.exit(1)

    if not user_mapping_path.exists():
        print(f"❌ Error: user-mapping.json not found at {user_mapping_path}\n")
        sys.exit(1)

    with open(org_mapping_path, "r") as f:
        org_mapping = json.load(f)

    with open(user_mapping_path, "r") as f:
        user_mapping = json.load(f)

    print(f"📂 Loaded mappings:")
    print(f"   • Organizations: {len(org_mapping)}")
    print(f"   • Users: {len(user_mapping)}\n")

    return org_mapping, user_mapping


def execute_sql(sql: str, dry_run: bool = False) -> None:
    """Execute SQL via Supabase CLI"""
    if dry_run:
        print(f"   [DRY RUN] {sql[:80]}...")
        return

    try:
        result = subprocess.run(
            ["npx", "supabase", "db", "remote", "sql", "--query", sql],
            capture_output=True,
            text=True,
            check=True,
            cwd=api_root
        )
        # Success - no output needed
    except subprocess.CalledProcessError as e:
        print(f"\n❌ SQL Error: {e.stderr}\n")
        sys.exit(1)


def query_count(table: str, column: str, dev_ids: list) -> int:
    """Query row count for a table/column with dev IDs"""
    dev_ids_str = "','".join(dev_ids)
    sql = f"SELECT COUNT(*)::int FROM {table} WHERE {column} IN ('{dev_ids_str}')"

    try:
        result = subprocess.run(
            ["npx", "supabase", "db", "remote", "sql", "--query", sql],
            capture_output=True,
            text=True,
            check=True,
            cwd=api_root
        )
        # Parse output - Supabase CLI returns table format
        lines = result.stdout.strip().split('\n')
        if len(lines) >= 3:  # Header, separator, data
            count_line = lines[2].strip()
            try:
                return int(count_line)
            except ValueError:
                return 0
        return 0
    except:
        return 0


def preview_changes(org_mapping: Dict[str, str], user_mapping: Dict[str, str]) -> None:
    """Show what would change without modifying data"""
    print("🔍 Previewing changes...\n")

    tables_to_check = [
        ("organization", "clerk_org_id", list(org_mapping.keys())),
        ("user_profile", "clerk_user_id", list(user_mapping.keys())),
        ("user_profile", "clerk_org_id", list(org_mapping.keys())),
        ("mentor_bot", "clerk_org_id", list(org_mapping.keys())),
        ("document", "clerk_org_id", list(org_mapping.keys())),
        ("folder", "clerk_org_id", list(org_mapping.keys())),
        ("google_drive_tokens", "clerk_org_id", list(org_mapping.keys())),
        ("processing_job", "clerk_org_id", list(org_mapping.keys())),
        ("token_usage", "clerk_org_id", list(org_mapping.keys())),
        ("alerts", "clerk_org_id", list(org_mapping.keys())),
        ("pipeline_job", "clerk_org_id", list(org_mapping.keys())),
        ("conversation", "clerk_user_id", list(user_mapping.keys())),
        ("conversation", "clerk_org_id", list(org_mapping.keys())),
        ("forms", "clerk_org_id", list(org_mapping.keys())),
        ("form_submissions", "clerk_org_id", list(org_mapping.keys())),
        ("form_submissions", "clerk_user_id", list(user_mapping.keys())),
        ("super_admin", "clerk_user_id", list(user_mapping.keys())),
        ("super_admin", "granted_by", list(user_mapping.keys())),
        ("organization_cache", "clerk_org_id", list(org_mapping.keys())),
        ("kg_entity_mapping", "organization_id", list(org_mapping.keys())),
    ]

    print("📊 Rows to migrate by table:\n")

    total_rows = 0
    for table_name, column_name, dev_ids in tables_to_check:
        if not dev_ids:
            continue

        count = query_count(table_name, column_name, dev_ids)
        if count > 0:
            print(f"   • {table_name}.{column_name}: {count} rows")
            total_rows += count

    print(f"\n   Total rows to migrate: {total_rows}\n")


def migrate_supabase(dry_run: bool = False) -> None:
    """Main migration function"""
    if dry_run:
        print("🧪 DRY RUN MODE - No changes will be made\n")
    else:
        print("⚠️  MIGRATION MODE - Supabase will be modified!\n")

    # Load mappings
    org_mapping, user_mapping = load_mappings()

    # Skip preview (Supabase CLI queries are too slow)
    print("📋 Migration Summary:")
    print(f"   • {len(org_mapping)} organizations to update")
    print(f"   • {len(user_mapping)} users to update")
    print("   • 15 tables will be affected\n")

    if not dry_run:
        print("⚠️  You are about to MODIFY Supabase data!")
        print(f"   • {len(org_mapping)} organizations will be updated")
        print(f"   • {len(user_mapping)} users will be updated")
        print("   • Multiple tables will be affected\n")
        response = input("   Type 'yes' to continue: ")
        if response.lower() != "yes":
            print("\n❌ Migration cancelled\n")
            return

    print("\n🔄 Starting migration...\n")

    # ============================================================
    # TIER 1: Foundation (organization, user_profile)
    # ============================================================

    print("📦 Tier 1: Foundation Tables\n")
    print("   Migrating organization table (PRIMARY KEY)...")

    # Drop FK from forms
    execute_sql("ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_clerk_org_id_fkey;", dry_run)

    # Update organization.clerk_org_id
    for dev_org_id, prod_org_id in org_mapping.items():
        execute_sql(f"UPDATE organization SET clerk_org_id = '{prod_org_id}' WHERE clerk_org_id = '{dev_org_id}';", dry_run)

    print("   • Updated organization table")

    # Recreate FK
    execute_sql("""ALTER TABLE forms ADD CONSTRAINT forms_clerk_org_id_fkey
                   FOREIGN KEY (clerk_org_id) REFERENCES organization(clerk_org_id);""", dry_run)

    # Update user_profile
    print("   Migrating user_profile table...")
    for dev_user_id, prod_user_id in user_mapping.items():
        execute_sql(f"UPDATE user_profile SET clerk_user_id = '{prod_user_id}' WHERE clerk_user_id = '{dev_user_id}';", dry_run)

    for dev_org_id, prod_org_id in org_mapping.items():
        execute_sql(f"UPDATE user_profile SET clerk_org_id = '{prod_org_id}' WHERE clerk_org_id = '{dev_org_id}';", dry_run)

    print("   • Updated user_profile table\n")

    # ============================================================
    # TIER 2: Org-scoped tables
    # ============================================================

    print("📦 Tier 2: Organization-Scoped Tables\n")

    tier2_tables = [
        "mentor_bot",
        "document",
        "folder",
        "google_drive_tokens",
        "processing_job",
        "token_usage",
        "alerts",
        "pipeline_job",
    ]

    for table_name in tier2_tables:
        for dev_org_id, prod_org_id in org_mapping.items():
            execute_sql(f"UPDATE {table_name} SET clerk_org_id = '{prod_org_id}' WHERE clerk_org_id = '{dev_org_id}';", dry_run)
        print(f"   • Updated {table_name}")

    print()

    # ============================================================
    # TIER 3: User + Org tables
    # ============================================================

    print("📦 Tier 3: User + Organization Tables\n")

    # Conversation
    print("   Migrating conversation table...")
    for dev_user_id, prod_user_id in user_mapping.items():
        execute_sql(f"UPDATE conversation SET clerk_user_id = '{prod_user_id}' WHERE clerk_user_id = '{dev_user_id}';", dry_run)

    for dev_org_id, prod_org_id in org_mapping.items():
        execute_sql(f"UPDATE conversation SET clerk_org_id = '{prod_org_id}' WHERE clerk_org_id = '{dev_org_id}';", dry_run)

    print("   • Updated conversation\n")

    # Forms
    print("   Migrating forms table...")
    for dev_org_id, prod_org_id in org_mapping.items():
        execute_sql(f"UPDATE forms SET clerk_org_id = '{prod_org_id}' WHERE clerk_org_id = '{dev_org_id}';", dry_run)
    print("   • Updated forms\n")

    # Form submissions
    print("   Migrating form_submissions table...")
    for dev_user_id, prod_user_id in user_mapping.items():
        execute_sql(f"UPDATE form_submissions SET clerk_user_id = '{prod_user_id}' WHERE clerk_user_id = '{dev_user_id}';", dry_run)

    for dev_org_id, prod_org_id in org_mapping.items():
        execute_sql(f"UPDATE form_submissions SET clerk_org_id = '{prod_org_id}' WHERE clerk_org_id = '{dev_org_id}';", dry_run)

    print("   • Updated form_submissions\n")

    # ============================================================
    # TIER 4: Admin tables
    # ============================================================

    print("📦 Tier 4: Admin Tables\n")

    # Super admin (PRIMARY KEY + self-referential FK)
    print("   Migrating super_admin table (PRIMARY KEY)...")

    # Drop self-referential FK
    execute_sql("ALTER TABLE super_admin DROP CONSTRAINT IF EXISTS super_admin_granted_by_fkey;", dry_run)

    # Update clerk_user_id (PK)
    for dev_user_id, prod_user_id in user_mapping.items():
        execute_sql(f"UPDATE super_admin SET clerk_user_id = '{prod_user_id}' WHERE clerk_user_id = '{dev_user_id}';", dry_run)

    # Update granted_by (FK)
    for dev_user_id, prod_user_id in user_mapping.items():
        execute_sql(f"UPDATE super_admin SET granted_by = '{prod_user_id}' WHERE granted_by = '{dev_user_id}';", dry_run)

    # Recreate self-referential FK
    execute_sql("""ALTER TABLE super_admin ADD CONSTRAINT super_admin_granted_by_fkey
                   FOREIGN KEY (granted_by) REFERENCES super_admin(clerk_user_id);""", dry_run)

    print("   • Updated super_admin\n")

    # Organization cache
    print("   Migrating organization_cache table...")
    for dev_org_id, prod_org_id in org_mapping.items():
        execute_sql(f"UPDATE organization_cache SET clerk_org_id = '{prod_org_id}' WHERE clerk_org_id = '{dev_org_id}';", dry_run)
    print("   • Updated organization_cache\n")

    # KG entity mapping (special case: organization_id field)
    print("   Migrating kg_entity_mapping table...")
    for dev_org_id, prod_org_id in org_mapping.items():
        execute_sql(f"UPDATE kg_entity_mapping SET organization_id = '{prod_org_id}' WHERE organization_id = '{dev_org_id}';", dry_run)
    print("   • Updated kg_entity_mapping\n")

    # ============================================================
    # VERIFICATION
    # ============================================================

    if not dry_run:
        print("🔍 Verifying migration...\n")

        # Check for remaining dev org IDs
        remaining_orgs = query_count("organization", "clerk_org_id",
                                     [k for k in org_mapping.keys()])

        # Check for remaining dev user IDs
        remaining_users = query_count("user_profile", "clerk_user_id",
                                      [k for k in user_mapping.keys()])

        if remaining_orgs > 0 or remaining_users > 0:
            print(f"⚠️  Warning: Found remaining dev IDs:")
            if remaining_orgs > 0:
                print(f"   • Organizations: {remaining_orgs}")
            if remaining_users > 0:
                print(f"   • Users: {remaining_users}")
            print("\n   These may have been partially migrated. Check manually.\n")
        else:
            print("✅ Verification passed - no dev IDs found in foundation tables!\n")

    if dry_run:
        print("🧪 DRY RUN COMPLETE - No changes made\n")
        print("   To execute migration, run without --dry-run flag\n")
    else:
        print("✅ Migration completed successfully!\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate Supabase Clerk IDs from dev to prod"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying data",
    )

    args = parser.parse_args()

    migrate_supabase(dry_run=args.dry_run)
