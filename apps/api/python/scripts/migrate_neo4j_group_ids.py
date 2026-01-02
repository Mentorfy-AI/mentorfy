"""
Neo4j Group ID Migration Script

Updates all Neo4j nodes and relationships from dev Clerk org IDs to prod Clerk org IDs.
This is the DESTRUCTIVE part of the Clerk migration.

Usage:
    # Dry run (shows what would change, doesn't modify)
    python python/scripts/migrate_neo4j_group_ids.py --dry-run

    # Execute migration (DESTRUCTIVE)
    python python/scripts/migrate_neo4j_group_ids.py

Requirements:
    - neo4j>=5.0.0 (already in pyproject.toml)
    - python-dotenv (already in pyproject.toml)
    - org-mapping.json file in API root directory

WARNING:
    This script modifies Neo4j data in place. Make sure you have a backup!
    Run with --dry-run first to verify changes.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables from API root directory
api_root = Path(__file__).parent.parent.parent
env_path = api_root / ".env.local"

if env_path.exists():
    load_dotenv(env_path)
    print(f"✓ Loaded environment from: {env_path}\n")
else:
    print(f"⚠️  Warning: .env.local not found at {env_path}")
    print("   Attempting to load from current directory...\n")
    load_dotenv()

# Neo4j connection config
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://caboose.proxy.rlwy.net:32086")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")


def load_org_mapping() -> Dict[str, str]:
    """Load org ID mapping from JSON file"""
    mapping_path = api_root / "org-mapping.json"

    if not mapping_path.exists():
        print(f"❌ Error: org-mapping.json not found at {mapping_path}")
        print("\n   This file should contain the mapping of dev org IDs to prod org IDs.")
        print("   Example: {'org_dev_123': 'org_prod_456'}\n")
        sys.exit(1)

    with open(mapping_path, "r") as f:
        mapping = json.load(f)

    print(f"📂 Loaded org mapping from: {mapping_path}")
    print(f"   Found {len(mapping)} organizations to migrate\n")

    return mapping


def preview_changes(session, org_mapping: Dict[str, str]) -> Tuple[int, int]:
    """Show what would change without modifying data"""
    print("🔍 Previewing changes...\n")

    # Count nodes per org
    print("📊 Nodes by organization (BEFORE migration):")
    node_result = session.run("""
        MATCH (n)
        WHERE n.group_id IS NOT NULL
        RETURN n.group_id as org_id, count(n) as count
        ORDER BY count DESC
    """)

    total_nodes = 0
    nodes_to_migrate = 0

    for record in node_result:
        org_id = record["org_id"]
        count = record["count"]
        total_nodes += count

        if org_id in org_mapping:
            prod_id = org_mapping[org_id]
            print(f"   • {org_id} → {prod_id}: {count} nodes")
            nodes_to_migrate += count
        else:
            print(f"   ⚠️  {org_id}: {count} nodes (NO MAPPING - will not change)")

    print(f"\n   Total nodes with group_id: {total_nodes}")
    print(f"   Nodes to migrate: {nodes_to_migrate}\n")

    # Count relationships per org
    print("📊 Relationships by organization (BEFORE migration):")
    rel_result = session.run("""
        MATCH ()-[r]-()
        WHERE r.group_id IS NOT NULL
        RETURN r.group_id as org_id, count(r) as count
        ORDER BY count DESC
    """)

    total_rels = 0
    rels_to_migrate = 0

    for record in rel_result:
        org_id = record["org_id"]
        count = record["count"]
        total_rels += count

        if org_id in org_mapping:
            prod_id = org_mapping[org_id]
            print(f"   • {org_id} → {prod_id}: {count} relationships")
            rels_to_migrate += count
        else:
            print(f"   ⚠️  {org_id}: {count} relationships (NO MAPPING - will not change)")

    print(f"\n   Total relationships with group_id: {total_rels}")
    print(f"   Relationships to migrate: {rels_to_migrate}\n")

    return nodes_to_migrate, rels_to_migrate


def migrate_group_ids(dry_run: bool = False) -> None:
    """Main migration function"""
    if dry_run:
        print("🧪 DRY RUN MODE - No changes will be made\n")
    else:
        print("⚠️  MIGRATION MODE - Database will be modified!\n")

    if not NEO4J_PASSWORD:
        print("❌ Error: NEO4J_PASSWORD not found in environment variables")
        print("   Make sure .env.local is in the API directory root\n")
        sys.exit(1)

    # Load org mapping
    org_mapping = load_org_mapping()

    driver = None
    try:
        print("📡 Connecting to Neo4j...")
        print(f"   URI: {NEO4J_URI}\n")

        driver = GraphDatabase.driver(
            NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)
        )

        # Test connection
        driver.verify_connectivity()
        print("✅ Connected successfully\n")

        with driver.session() as session:
            # Step 1: Preview changes
            nodes_to_migrate, rels_to_migrate = preview_changes(session, org_mapping)

            if nodes_to_migrate == 0 and rels_to_migrate == 0:
                print("⚠️  No data to migrate! All nodes/relationships already have prod IDs or no mapping found.\n")
                return

            # Step 2: Confirm migration (unless dry run)
            if not dry_run:
                print("⚠️  You are about to MODIFY Neo4j data!")
                print(f"   • {nodes_to_migrate} nodes will be updated")
                print(f"   • {rels_to_migrate} relationships will be updated\n")
                response = input("   Type 'yes' to continue: ")
                if response.lower() != "yes":
                    print("\n❌ Migration cancelled\n")
                    return

            # Step 3: Migrate nodes
            if not dry_run:
                print("\n🔄 Migrating nodes...")

                updated_nodes = 0
                for dev_org_id, prod_org_id in org_mapping.items():
                    result = session.run(
                        """
                        MATCH (n)
                        WHERE n.group_id = $dev_org_id
                        SET n.group_id = $prod_org_id
                        RETURN count(n) as count
                        """,
                        dev_org_id=dev_org_id,
                        prod_org_id=prod_org_id,
                    )

                    count = result.single()["count"]
                    updated_nodes += count

                    if count > 0:
                        print(f"   ✓ Updated {count} nodes: {dev_org_id} → {prod_org_id}")

                print(f"\n   ✅ Total nodes updated: {updated_nodes}\n")

                # Step 4: Migrate relationships
                print("🔄 Migrating relationships...")

                updated_rels = 0
                for dev_org_id, prod_org_id in org_mapping.items():
                    result = session.run(
                        """
                        MATCH ()-[r]-()
                        WHERE r.group_id = $dev_org_id
                        SET r.group_id = $prod_org_id
                        RETURN count(r) as count
                        """,
                        dev_org_id=dev_org_id,
                        prod_org_id=prod_org_id,
                    )

                    count = result.single()["count"]
                    updated_rels += count

                    if count > 0:
                        print(f"   ✓ Updated {count} relationships: {dev_org_id} → {prod_org_id}")

                print(f"\n   ✅ Total relationships updated: {updated_rels}\n")

                # Step 5: Verify migration
                print("🔍 Verifying migration...\n")

                # Check for any remaining dev org IDs
                remaining_dev_nodes = session.run("""
                    MATCH (n)
                    WHERE n.group_id IS NOT NULL AND n.group_id STARTS WITH 'org_2'
                    RETURN DISTINCT n.group_id as org_id, 'DEV' as type
                """)

                dev_ids_found = list(remaining_dev_nodes)

                if dev_ids_found:
                    print("⚠️  Warning: Found remaining dev org IDs:")
                    for record in dev_ids_found:
                        print(f"   • {record['org_id']}")
                    print("\n   These were not in your mapping file and were not migrated.\n")
                else:
                    print("✅ No dev org IDs remaining - migration successful!\n")

                # Show final distribution
                print("📊 Final distribution by organization:")
                final_result = session.run("""
                    MATCH (n)
                    WHERE n.group_id IS NOT NULL
                    RETURN n.group_id as org_id, count(n) as count
                    ORDER BY count DESC
                """)

                for record in final_result:
                    org_id = record["org_id"]
                    count = record["count"]
                    prefix = "✅" if org_id.startswith("org_2") else "🔵"
                    print(f"   {prefix} {org_id}: {count} nodes")

                print("\n✅ Migration completed successfully!\n")

            else:
                print("\n🧪 DRY RUN COMPLETE - No changes made\n")
                print("   To execute migration, run without --dry-run flag\n")

    except Exception as e:
        print(f"\n❌ Migration failed: {e}\n")
        sys.exit(1)

    finally:
        if driver:
            driver.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate Neo4j group_id from dev to prod Clerk org IDs"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying data",
    )

    args = parser.parse_args()

    migrate_group_ids(dry_run=args.dry_run)
