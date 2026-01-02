"""
Neo4j Backup Script (Streaming JSONL)

Streams all nodes and relationships from Neo4j directly to a JSONL file.
Memory-efficient: writes each record as it's read, never holds full dataset.

Usage:
    python python/scripts/backup_neo4j.py

Output:
    neo4j-backup-YYYY-MM-DD-HH-MM-SS.jsonl

Format:
    One JSON object per line. Nodes have "labels", relationships have "start"/"end".
    Properties are spread at the top level (no wrapper).

    Nodes:    {"labels":["Person"],"uuid":"abc","name":"Alice",...}
    Rels:     {"type":"KNOWS","start":"abc","end":"def","since":2020,...}
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

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


def serialize_value(value: Any) -> Any:
    """Convert Neo4j types to JSON-serializable types"""
    if hasattr(value, 'iso_format'):
        return value.iso_format()
    if isinstance(value, (list, tuple)):
        return [serialize_value(v) for v in value]
    return value


def serialize_props(props: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize all properties in a dict"""
    return {k: serialize_value(v) for k, v in props.items()}


def backup_neo4j() -> None:
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    driver.verify_connectivity()

    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    filename = f"neo4j-backup-{timestamp}.jsonl"
    filepath = api_root / filename

    node_count = 0
    rel_count = 0

    with driver.session() as session, open(filepath, "w") as f:
        # Stream nodes
        nodes_result = session.run("MATCH (n) RETURN n")
        for record in nodes_result:
            node = record["n"]
            props = dict(node)

            if "uuid" not in props:
                raise ValueError(f"Node missing uuid: labels={list(node.labels)}, props={list(props.keys())}")

            line = {"labels": list(node.labels), **serialize_props(props)}
            f.write(json.dumps(line, separators=(',', ':')) + "\n")
            node_count += 1

        # Stream relationships
        rels_result = session.run("MATCH (a)-[r]->(b) RETURN r, a.uuid as start, b.uuid as end")
        for record in rels_result:
            rel = record["r"]
            start_uuid = record["start"]
            end_uuid = record["end"]

            if not start_uuid or not end_uuid:
                raise ValueError(f"Relationship missing node uuid: type={rel.type}")

            line = {"type": rel.type, "start": start_uuid, "end": end_uuid, **serialize_props(dict(rel))}
            f.write(json.dumps(line, separators=(',', ':')) + "\n")
            rel_count += 1

    driver.close()

    file_size_mb = filepath.stat().st_size / (1024 * 1024)
    print(f"{filename} - {node_count} nodes, {rel_count} rels, {file_size_mb:.2f} MB")


if __name__ == "__main__":
    backup_neo4j()
