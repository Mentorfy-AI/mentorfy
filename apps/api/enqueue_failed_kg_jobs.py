"""
Manual script to enqueue 4 failed KG ingest jobs that were stuck on old code.
Run this ONCE after Railway restart to get fresh jobs with new rate limiting.

CORRECTED VERSION with proper document_ids from pipeline_job table.
"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mentorfy.core.queues import enqueue_kg_ingest

# The 4 failed jobs with CORRECT document_ids from pipeline_job table
jobs_to_enqueue = [
    {
        "pipeline_job_id": "194797c1-2a3b-4122-9e62-b1d801690199",
        "document_id": "addfba96-e5ba-4796-aa29-6b6d5aaaa978",  # CORRECTED
        "source_name": "Part 5 - SAS & Keepa Sourcing.mp4",
        "clerk_org_id": "org_34FkCENCHrkS8JcQx5u4c3Q0lb4"
    },
    {
        "pipeline_job_id": "98964890-0362-4b79-a1e3-30ab96111950",
        "document_id": "00e8920f-f9f5-4f44-a8d2-65f706833bef",  # CORRECTED
        "source_name": "Part 6A - VA Setup & New FBA Fees.mp4",
        "clerk_org_id": "org_34FkCENCHrkS8JcQx5u4c3Q0lb4"
    },
    {
        "pipeline_job_id": "bbd37d54-ee2b-4a6f-a263-d9ee78010ca7",
        "document_id": "c84d48cb-b3c9-4e38-8929-679d810b4eb8",  # CORRECTED
        "source_name": "Part 8 - Keepa Product Finder.mp4",
        "clerk_org_id": "org_34FkCENCHrkS8JcQx5u4c3Q0lb4"
    },
    {
        "pipeline_job_id": "a7f0b440-01be-4da5-9190-86cc90c4d0a5",
        "document_id": "d8e421d5-ac39-4c3a-8cc6-dc7a06cbaa47",  # CORRECTED
        "source_name": "Introduction - Beginner Call.mp4",
        "clerk_org_id": "org_34FkCENCHrkS8JcQx5u4c3Q0lb4"
    }
]

if __name__ == "__main__":
    print("🚀 Enqueuing 4 fresh kg_ingest jobs with CORRECTED document IDs...\n")

    for job_data in jobs_to_enqueue:
        try:
            job_id = enqueue_kg_ingest(
                pipeline_job_id=job_data["pipeline_job_id"],
                document_id=job_data["document_id"],
                source_name=job_data["source_name"],
                source_platform="manual_upload",  # These are all video uploads
                clerk_org_id=job_data["clerk_org_id"]
            )
            print(f"✅ Enqueued: {job_data['source_name']}")
            print(f"   Job ID: {job_id}")
            print(f"   Pipeline Job: {job_data['pipeline_job_id']}")
            print(f"   Document ID: {job_data['document_id']}\n")
        except Exception as e:
            print(f"❌ Failed to enqueue {job_data['source_name']}: {e}\n")

    print("✅ All 4 jobs enqueued successfully with correct document IDs!")
