"""
Supermemory ID Migration Script

Updates all Supermemory documents to use prod Clerk user_ids and org_ids.
This migrates both the container tags and metadata fields.

Usage:
    # Dry run (shows what would change, doesn't modify)
    python python/scripts/migrate_supermemory_ids.py --dry-run

    # Execute migration (DESTRUCTIVE)
    python python/scripts/migrate_supermemory_ids.py

Requirements:
    - supermemory>=3.4.0 (already in pyproject.toml)
    - python-dotenv (already in pyproject.toml)
    - org-mapping.json and user-mapping.json in API root directory

Rate Limits:
    - Supermemory: 100 RPM (increased for this migration)
    - With 2.6k documents, will take ~26 minutes at 100/min

WARNING:
    This script modifies Supermemory data via API. Make sure you have mapping files!
    Run with --dry-run first to verify changes.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

from dotenv import load_dotenv

# Load environment variables from API root directory
api_root = Path(__file__).parent.parent.parent
env_path = api_root / ".env.local"

if env_path.exists():
    load_dotenv(env_path)
    print(f"✓ Loaded environment from: {env_path}\n")
else:
    print(f"⚠️  Warning: .env.local not found at {env_path}")
    load_dotenv()

SUPERMEMORY_API_KEY = os.getenv("SUPERMEMORY_API_KEY")
SUPERMEMORY_BASE_URL = "https://api.supermemory.ai/v3"


def load_mappings() -> tuple[Dict[str, str], Dict[str, str]]:
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


def list_all_documents() -> List[Dict[str, Any]]:
    """Fetch all documents from Supermemory using pagination"""
    import requests

    print("📥 Fetching documents from Supermemory...")

    headers = {
        "Authorization": f"Bearer {SUPERMEMORY_API_KEY}",
        "Content-Type": "application/json",
    }

    all_documents = []
    page = 1
    page_size = 100  # Max documents per request

    while True:
        response = requests.post(
            f"{SUPERMEMORY_BASE_URL}/documents/list",
            headers=headers,
            json={"page": page, "limit": page_size},
        )

        if response.status_code != 200:
            print(f"\n❌ Failed to fetch documents: {response.status_code}")
            print(f"   Response: {response.text}\n")
            sys.exit(1)

        data = response.json()
        documents = data.get("memories", [])

        if not documents:
            break

        all_documents.extend(documents)
        print(f"   ✓ Fetched page {page} ({len(documents)} documents)")

        # Check if there are more pages
        if len(documents) < page_size:
            break

        page += 1
        time.sleep(
            0.6
        )  # Rate limit: 100 RPM = ~1.67/sec, so 0.6s between requests is safe

    print(f"\n   📊 Total documents fetched: {len(all_documents)}\n")
    return all_documents


def analyze_documents(
    documents: List[Dict[str, Any]],
    org_mapping: Dict[str, str],
    user_mapping: Dict[str, str],
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Analyze which documents need migration and track errors/abnormalities"""
    print("🔍 Analyzing documents for migration...\n")

    docs_to_migrate = []
    anomalies = []

    for doc in documents:
        doc_id = doc.get("id")
        tags = doc.get("containerTags", [])
        metadata = doc.get("metadata", {})

        # Parse tags to extract org_id and user_id
        # Format: "org_34ffHs9V82vHg8QJUBOgAafpWHy-user_35hoNoALHx8RLBxNrpRG5uo6EWb"
        org_id_from_tag = None
        user_id_from_tag = None

        for tag in tags:
            if "-" in tag:
                parts = tag.split("-")
                if len(parts) == 2:
                    org_part = parts[0]
                    user_part = parts[1]
                    if org_part.startswith("org_"):
                        org_id_from_tag = org_part
                    if user_part.startswith("user_"):
                        user_id_from_tag = user_part

        # Check metadata
        org_id_from_meta = metadata.get("org_id")
        user_id_from_meta = metadata.get("user_id")

        # ANOMALY 1: No tags at all
        if not tags:
            anomalies.append(
                {
                    "id": doc_id,
                    "type": "no_tags",
                    "message": "Document has no tags",
                    "metadata": metadata,
                }
            )
            continue

        # ANOMALY 2: Tag doesn't match expected format
        if not org_id_from_tag or not user_id_from_tag:
            anomalies.append(
                {
                    "id": doc_id,
                    "type": "malformed_tag",
                    "message": f"Tag doesn't match org-user format: {tags[0] if tags else 'N/A'}",
                    "tag": tags[0] if tags else None,
                    "metadata": metadata,
                }
            )
            continue

        # ANOMALY 3: Metadata missing while tag has data
        if not org_id_from_meta or not user_id_from_meta:
            anomalies.append(
                {
                    "id": doc_id,
                    "type": "metadata_incomplete",
                    "message": f"Tag has org/user but metadata missing: org_id={org_id_from_meta}, user_id={user_id_from_meta}",
                    "tag": tags[0],
                    "org_from_tag": org_id_from_tag,
                    "user_from_tag": user_id_from_tag,
                    "org_from_meta": org_id_from_meta,
                    "user_from_meta": user_id_from_meta,
                }
            )
            # Continue with migration using tag data, but log the anomaly

        # ANOMALY 4: Tag and metadata mismatch
        elif (
            org_id_from_tag != org_id_from_meta or user_id_from_tag != user_id_from_meta
        ):
            anomalies.append(
                {
                    "id": doc_id,
                    "type": "tag_metadata_mismatch",
                    "message": "Tag and metadata have different org/user IDs",
                    "tag": tags[0],
                    "org_from_tag": org_id_from_tag,
                    "user_from_tag": user_id_from_tag,
                    "org_from_meta": org_id_from_meta,
                    "user_from_meta": user_id_from_meta,
                }
            )
            # Continue with migration using tag as source of truth, but log the anomaly

        # Use tag as source of truth
        org_id = org_id_from_tag
        user_id = user_id_from_tag

        # Check if both IDs exist in mappings
        org_in_mapping = org_id in org_mapping if org_id else False
        user_in_mapping = user_id in user_mapping if user_id else False

        # ANOMALY 5: Org mapped but user not
        if org_in_mapping and not user_in_mapping:
            anomalies.append(
                {
                    "id": doc_id,
                    "type": "org_mapped_user_not",
                    "message": f"Org {org_id} is in mapping, but user {user_id} is not",
                    "org_id": org_id,
                    "user_id": user_id,
                    "tag": tags[0],
                }
            )
            continue  # Skip this document

        # ANOMALY 6: User mapped but org not
        if not org_in_mapping and user_in_mapping:
            anomalies.append(
                {
                    "id": doc_id,
                    "type": "user_mapped_org_not",
                    "message": f"User {user_id} is in mapping, but org {org_id} is not",
                    "org_id": org_id,
                    "user_id": user_id,
                    "tag": tags[0],
                }
            )
            continue  # Skip this document

        # SKIP (not anomaly): Neither in mapping - likely already migrated or different instance
        if not org_in_mapping and not user_in_mapping:
            # Silently skip - these are either:
            # 1. Already migrated (have prod IDs)
            # 2. From a different Clerk instance
            continue

        # MIGRATION CANDIDATE: Both org and user are in mapping
        if org_in_mapping and user_in_mapping:
            new_org_id = org_mapping[org_id]
            new_user_id = user_mapping[user_id]

            new_tag = f"{new_org_id}-{new_user_id}"

            new_metadata = metadata.copy()
            new_metadata["org_id"] = new_org_id
            new_metadata["user_id"] = new_user_id

            docs_to_migrate.append(
                {
                    "id": doc_id,
                    "old_tag": tags[0],
                    "new_tag": new_tag,
                    "old_metadata": metadata,
                    "new_metadata": new_metadata,
                    "old_org_id": org_id,
                    "new_org_id": new_org_id,
                    "old_user_id": user_id,
                    "new_user_id": new_user_id,
                }
            )

    print(f"📊 Analysis Results:")
    print(f"   • Total documents: {len(documents)}")
    print(f"   • Documents to migrate: {len(docs_to_migrate)}")
    print(f"   • Anomalies detected: {len(anomalies)}\n")

    if anomalies:
        # Group anomalies by type
        by_type: Dict[str, List[Dict]] = {}
        for anomaly in anomalies:
            anomaly_type = anomaly["type"]
            if anomaly_type not in by_type:
                by_type[anomaly_type] = []
            by_type[anomaly_type].append(anomaly)

        print("⚠️  Anomalies Found:\n")
        for anomaly_type, items in by_type.items():
            print(f"   {anomaly_type}: {len(items)} documents")
            # Show first 3 examples of each type
            for i, item in enumerate(items[:3]):
                print(f"      • Doc {item['id']}: {item['message']}")
            if len(items) > 3:
                print(f"      ... and {len(items) - 3} more\n")
            else:
                print()

        # Save full anomaly report to file
        anomaly_file = api_root / "supermemory-migration-anomalies.json"
        with open(anomaly_file, "w") as f:
            json.dump(anomalies, f, indent=2)
        print(f"   📄 Full anomaly report saved to: {anomaly_file}\n")

    return docs_to_migrate, anomalies


def migrate_document(doc_update: Dict[str, Any], dry_run: bool) -> bool:
    """Migrate a single document"""
    import requests

    if dry_run:
        return True

    headers = {
        "Authorization": f"Bearer {SUPERMEMORY_API_KEY}",
        "Content-Type": "application/json",
    }

    doc_id = doc_update["id"]
    new_tag = doc_update["new_tag"]
    new_metadata = doc_update["new_metadata"]

    # PATCH /v3/documents/{id}
    response = requests.patch(
        f"{SUPERMEMORY_BASE_URL}/documents/{doc_id}",
        headers=headers,
        json={
            "containerTags": [new_tag],
            "metadata": new_metadata,
        },
    )

    if response.status_code == 200:
        return True
    else:
        print(f"\n⚠️  Failed to update document {doc_id}: {response.status_code}")
        print(f"   Response: {response.text}")
        return False


def migrate_supermemory(dry_run: bool = False) -> None:
    """Main migration function"""
    if dry_run:
        print("🧪 DRY RUN MODE - No changes will be made\n")
    else:
        print("⚠️  MIGRATION MODE - Supermemory will be modified!\n")

    if not SUPERMEMORY_API_KEY:
        print("❌ Error: SUPERMEMORY_API_KEY not found in environment variables\n")
        sys.exit(1)

    # Load mappings
    org_mapping, user_mapping = load_mappings()

    # Fetch all documents
    documents = list_all_documents()

    if not documents:
        print("⚠️  No documents found in Supermemory!\n")
        return

    # Analyze documents
    docs_to_migrate, anomalies = analyze_documents(documents, org_mapping, user_mapping)

    if anomalies:
        # Count blocking anomalies (ones that prevent migration)
        blocking_types = {"org_mapped_user_not", "user_mapped_org_not"}
        blocking_anomalies = [a for a in anomalies if a["type"] in blocking_types]

        if blocking_anomalies:
            print(
                f"⚠️  Found {len(blocking_anomalies)} BLOCKING anomalies that will prevent migration.\n"
            )
            print("   These documents will be SKIPPED.\n")
            response = input("   Continue with migration anyway? (yes/no): ")
            if response.lower() != "yes":
                print("\n❌ Migration cancelled\n")
                return

    if not docs_to_migrate:
        print("✅ No documents need migration!\n")
        return

    # Show preview
    print("\n📋 Sample migrations (first 5):")
    for i, doc in enumerate(docs_to_migrate[:5]):
        print(f"\n   Document {i+1}:")
        print(f"   • ID: {doc['id']}")
        print(f"   • Tag: {doc['old_tag']} → {doc['new_tag']}")
        print(f"   • Org: {doc['old_org_id']} → {doc['new_org_id']}")
        print(f"   • User: {doc['old_user_id']} → {doc['new_user_id']}")

    if len(docs_to_migrate) > 5:
        print(f"\n   ... and {len(docs_to_migrate) - 5} more documents\n")

    # Confirm migration
    if not dry_run:
        print(
            f"\n⚠️  You are about to update {len(docs_to_migrate)} documents in Supermemory!"
        )
        print(
            f"   Estimated time: {len(docs_to_migrate) / 100:.1f} minutes (100 RPM rate limit)\n"
        )
        response = input("   Type 'yes' to continue: ")
        if response.lower() != "yes":
            print("\n❌ Migration cancelled\n")
            return

    # Migrate documents
    print("\n🔄 Migrating documents...\n")

    successful = 0
    failed = 0

    for i, doc_update in enumerate(docs_to_migrate):
        if migrate_document(doc_update, dry_run):
            successful += 1
        else:
            failed += 1

        # Progress update every 50 documents
        if (i + 1) % 50 == 0:
            elapsed_min = (i + 1) / 100
            remaining_min = (len(docs_to_migrate) - i - 1) / 100
            print(
                f"   ✓ Progress: {i+1}/{len(docs_to_migrate)} ({elapsed_min:.1f}m elapsed, ~{remaining_min:.1f}m remaining)"
            )

        # Rate limiting: 100 RPM = 0.6s between requests
        if not dry_run:
            time.sleep(0.6)

    print(f"\n📊 Migration Results:")
    print(f"   ✅ Successful: {successful}")
    if failed > 0:
        print(f"   ❌ Failed: {failed}")
    if anomalies:
        print(f"   ⚠️  Anomalies detected: {len(anomalies)}")
    print()

    if dry_run:
        print("🧪 DRY RUN COMPLETE - No changes made\n")
        print("   To execute migration, run without --dry-run flag\n")
    else:
        print("✅ Migration completed!\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate Supermemory user_ids and org_ids from dev to prod Clerk"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying data",
    )

    args = parser.parse_args()

    migrate_supermemory(dry_run=args.dry_run)
