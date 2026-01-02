"""
Neo4j Restore Script (Streaming JSONL)

Restores nodes and relationships from a JSONL backup file.
Memory-efficient: reads and processes one line at a time.

Usage:
    python python/scripts/restore_neo4j_jsonl.py neo4j-backup-2025-04-24-14-30-00.jsonl

WARNING:
    This will DELETE ALL EXISTING DATA in Neo4j before restoring!
"""

import json
import os
import sys
from pathlib import Path

from neo4j import GraphDatabase
from dotenv import load_dotenv

api_root = Path(__file__).parent.parent.parent
env_path = api_root / ".env.local"

if env_path.exists():
    load_dotenv(env_path)
else:
    raise FileNotFoundError(f".env.local not found at {env_path}")

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

if not NEO4J_URI:
    raise ValueError("NEO4J_URI not set in environment")
if not NEO4J_PASSWORD:
    raise ValueError("NEO4J_PASSWORD not set in environment")


def restore_neo4j(backup_file: str) -> None:
    backup_path = Path(backup_file)
    if not backup_path.exists():
        raise FileNotFoundError(f"Backup file not found: {backup_file}")

    print(f"Restore from: {backup_path.name}")
    print("WARNING: This will DELETE ALL EXISTING DATA in Neo4j!")
    response = input("Type 'yes' to continue: ")
    if response.lower() != "yes":
        print("Cancelled")
        return

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    driver.verify_connectivity()

    with driver.session() as session:
        # Delete all existing data
        result = session.run("MATCH (n) DETACH DELETE n RETURN count(n) as deleted")
        deleted = result.single()["deleted"]
        print(f"Deleted {deleted} existing nodes")

        # Create uuid index (keep it - it's useful)
        session.run("CREATE INDEX node_uuid_index IF NOT EXISTS FOR (n:Entity) ON (n.uuid)")

    node_count = 0
    rel_count = 0

    with driver.session() as session, open(backup_path, "r") as f:
        for line in f:
            record = json.loads(line)

            if "labels" in record:
                # It's a node
                labels = record.pop("labels")
                labels_str = ":".join(labels)
                session.run(f"CREATE (n:{labels_str}) SET n = $props", props=record)
                node_count += 1
            elif "start" in record and "end" in record:
                # It's a relationship
                rel_type = record.pop("type")
                start_uuid = record.pop("start")
                end_uuid = record.pop("end")
                session.run(
                    f"""
                    MATCH (a {{uuid: $start}})
                    MATCH (b {{uuid: $end}})
                    CREATE (a)-[r:{rel_type}]->(b)
                    SET r = $props
                    """,
                    start=start_uuid,
                    end=end_uuid,
                    props=record,
                )
                rel_count += 1

    driver.close()
    print(f"Restored {node_count} nodes, {rel_count} relationships")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python python/scripts/restore_neo4j_jsonl.py <backup.jsonl>")
        sys.exit(1)

    restore_neo4j(sys.argv[1])
