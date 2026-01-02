"""
Neo4j Restore Script

Restores nodes and relationships from a backup JSON file.
Use this if migration fails and you need to rollback.

Usage:
    python python/scripts/restore_neo4j.py neo4j-backup-2025-04-24-14-30-00.json

Requirements:
    - neo4j>=5.0.0 (already in pyproject.toml)
    - python-dotenv (already in pyproject.toml)

WARNING:
    This will DELETE ALL EXISTING DATA in Neo4j before restoring!
    Make sure you have the correct backup file.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables from API root directory
# Script is in python/scripts/, .env.local is in API root (2 levels up)
api_root = Path(__file__).parent.parent.parent
env_path = api_root / ".env.local"

if env_path.exists():
    load_dotenv(env_path)
    print(f"✓ Loaded environment from: {env_path}\n")
else:
    print(f"⚠️  Warning: .env.local not found at {env_path}")
    print("   Attempting to load from current directory...\n")
    load_dotenv()  # Fallback to current directory

# Neo4j connection config from .env.local
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://caboose.proxy.rlwy.net:32086")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")


def restore_neo4j(backup_file: str) -> None:
    """Restore Neo4j from backup file"""
    print("🔄 Starting Neo4j restore...\n")

    # Validate backup file exists
    backup_path = Path(backup_file)
    if not backup_path.exists():
        print(f"❌ Error: Backup file not found: {backup_file}\n")
        return

    if not NEO4J_PASSWORD:
        print("❌ Error: NEO4J_PASSWORD not found in environment variables")
        print("   Make sure .env.local is in the API directory root\n")
        return

    # Load backup data
    print(f"📂 Loading backup file: {backup_path.name}")
    with open(backup_path, "r") as f:
        backup_data = json.load(f)

    print(f"   ✓ Backup timestamp: {backup_data['timestamp']}")
    print(f"   ✓ Total nodes: {backup_data['statistics']['total_nodes']}")
    print(
        f"   ✓ Total relationships: {backup_data['statistics']['total_relationships']}\n"
    )

    # Confirm destructive operation
    print("⚠️  WARNING: This will DELETE ALL EXISTING DATA in Neo4j!")
    response = input("   Type 'yes' to continue: ")
    if response.lower() != "yes":
        print("\n❌ Restore cancelled\n")
        return

    driver = None
    try:
        print("\n📡 Connecting to Neo4j...")
        print(f"   URI: {NEO4J_URI}\n")

        driver = GraphDatabase.driver(
            NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)
        )

        # Test connection
        driver.verify_connectivity()
        print("✅ Connected successfully\n")

        with driver.session() as session:
            # Step 1: Delete all existing data
            print("🗑️  Deleting all existing data...")
            result = session.run("""
                MATCH (n)
                DETACH DELETE n
                RETURN count(n) as deleted
            """)
            deleted_count = result.single()["deleted"]
            print(f"   ✓ Deleted {deleted_count} nodes and their relationships\n")

            # Step 2: Restore nodes
            print("📦 Restoring nodes...")
            nodes = backup_data["nodes"]

            # Create nodes without APOC (more compatible)
            batch_size = 1000
            for i in range(0, len(nodes), batch_size):
                batch = nodes[i : i + batch_size]

                # Build Cypher query dynamically for each batch
                for node in batch:
                    labels_str = ":".join(node["labels"])
                    session.run(
                        f"""
                        CREATE (n:{labels_str})
                        SET n = $properties
                        """,
                        properties=node["properties"],
                    )

                if (i + batch_size) % 5000 == 0:
                    print(f"   ✓ Restored {min(i + batch_size, len(nodes))} nodes...")

            print(f"   ✓ Restored all {len(nodes)} nodes\n")

            # Step 3: Restore relationships
            print("📦 Restoring relationships...")
            relationships = backup_data["relationships"]

            # Create index on uuid for faster relationship creation
            print("   ℹ️  Creating temporary index on uuid...")
            session.run("CREATE INDEX temp_uuid_index IF NOT EXISTS FOR (n) ON (n.uuid)")

            # Batch create relationships without APOC
            for i in range(0, len(relationships), batch_size):
                batch = relationships[i : i + batch_size]

                for rel in batch:
                    # Note: Field is now "startNodeUuid" not "startNode" (updated in backup script)
                    start_uuid = rel.get("startNodeUuid") or rel.get("startNode")  # Handle old backups
                    end_uuid = rel.get("endNodeUuid") or rel.get("endNode")  # Handle old backups

                    session.run(
                        f"""
                        MATCH (start {{uuid: $startUuid}})
                        MATCH (end {{uuid: $endUuid}})
                        CREATE (start)-[r:{rel['type']}]->(end)
                        SET r = $properties
                        """,
                        startUuid=start_uuid,
                        endUuid=end_uuid,
                        properties=rel["properties"],
                    )

                if (i + batch_size) % 5000 == 0:
                    print(
                        f"   ✓ Restored {min(i + batch_size, len(relationships))} relationships..."
                    )

            print(f"   ✓ Restored all {len(relationships)} relationships\n")

            # Step 4: Clean up temporary index
            print("   ℹ️  Dropping temporary index...")
            session.run("DROP INDEX temp_uuid_index IF EXISTS")

            # Step 5: Verify restore
            print("🔍 Verifying restore...")
            verify_result = session.run("""
                MATCH (n)
                OPTIONAL MATCH ()-[r]->()
                RETURN count(DISTINCT n) as nodes, count(DISTINCT r) as rels
            """)

            verify = verify_result.single()
            restored_nodes = verify["nodes"]
            restored_rels = verify["rels"]

            print(f"   ✓ Found {restored_nodes} nodes")
            print(f"   ✓ Found {restored_rels} relationships\n")

            if restored_nodes == len(nodes) and restored_rels == len(relationships):
                print("✅ Restore completed successfully!\n")
                print("📋 Restored counts match backup:")
                print(f"   • Nodes: {restored_nodes}")
                print(f"   • Relationships: {restored_rels}\n")
            else:
                print("⚠️  Warning: Restored counts don't match backup!")
                print(f"   • Expected nodes: {len(nodes)}, got: {restored_nodes}")
                print(
                    f"   • Expected relationships: {len(relationships)}, got: {restored_rels}\n"
                )

    except Exception as e:
        print(f"\n❌ Restore failed: {e}\n")

        if "Index already exists" in str(e):
            print("💡 Index already exists. This is usually fine - try running restore again.\n")

    finally:
        if driver:
            driver.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python python/scripts/restore_neo4j.py <backup-file.json>")
        print("\nExample:")
        print("  python python/scripts/restore_neo4j.py neo4j-backup-2025-04-24-14-30-00.json\n")
        sys.exit(1)

    backup_file = sys.argv[1]
    restore_neo4j(backup_file)
