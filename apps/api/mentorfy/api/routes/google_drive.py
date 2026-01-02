"""
Google Drive Integration Routes

This module contains all Google Drive-related API endpoints:
- OAuth 2.0 authentication flow
- Folder discovery (read-only scanning)
- Document import from Google Drive to Supabase

These routes handle the complete workflow of connecting a Google Drive account,
browsing folders, and importing selected documents into the Mentorfy system.
"""

import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from pydantic import BaseModel
from supabase import Client

from mentorfy.core.pipeline_helpers import enqueue_pipeline_job
from mentorfy.utils.file_utils import (
    get_processing_mode,
    validate_file_size,
    get_file_type_label,
)


# Set up logger
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/google-drive", tags=["google-drive"])

# Global Supabase client (set by main app)
supabase_client: Optional[Client] = None


def set_supabase_client(client: Client):
    """Set the global Supabase client for this router"""
    global supabase_client
    supabase_client = client


# Pydantic Models
class GoogleDriveDiscoveryRequest(BaseModel):
    folder_id: str
    user_id: str
    org_id: str


class GoogleDriveImportRequest(BaseModel):
    folder_id: str
    user_id: str
    org_id: str
    selected_file_ids: List[str]


class GoogleDriveTokenResponse(BaseModel):
    success: bool
    message: str
    auth_url: Optional[str] = None


# Helper Functions
async def discover_files_in_folder(
    drive_service, folder_id: str, folder_name: str = None, processed_folders=None
):
    """Recursively discover supported files in a Google Drive folder and build folder tree structure"""
    if processed_folders is None:
        processed_folders = set()

    # Prevent infinite loops
    if folder_id in processed_folders:
        return {
            "total_files": 0,
            "supported_files": [],
            "skipped_files": [],
            "folder_tree": {
                "google_drive_folder_id": folder_id,
                "name": folder_name or "Unknown Folder",
                "children": [],
                "files": [],
            },
        }

    processed_folders.add(folder_id)

    supported_mime_types = {
        # Documents
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # DOCX
        "application/msword",  # DOC
        "text/plain",  # TXT
        "application/vnd.google-apps.document",  # Google Docs
        # Subtitles
        "text/vtt",  # VTT (WebVTT subtitle format)
        "text/srt",  # SRT (SubRip subtitle format)
        "application/x-subrip",  # SRT (alternative MIME type)
        # Audio (transcription via Deepgram)
        "audio/mpeg",  # MP3
        "audio/mp4",  # M4A
        "audio/wav",  # WAV
        "audio/flac",  # FLAC
        "audio/ogg",  # OGG
        "audio/opus",  # OPUS
        # Video (audio extraction → transcription)
        "video/mp4",  # MP4
        "video/quicktime",  # MOV
        "video/x-msvideo",  # AVI
        "video/x-matroska",  # MKV
        "video/webm",  # WEBM
    }

    all_supported_files = []
    all_skipped_files = []
    total_count = 0
    folder_tree = {
        "google_drive_folder_id": folder_id,
        "name": folder_name or "Unknown Folder",
        "children": [],
        "files": [],
    }

    try:
        # Query for files in this folder
        query = f"'{folder_id}' in parents and trashed=false"
        results = (
            drive_service.files()
            .list(
                q=query,
                fields="files(id, name, mimeType, size, parents)",
                pageSize=1000,
            )
            .execute()
        )

        items = results.get("files", [])
        total_count = len(items)

        # Separate files and folders
        files = [
            item
            for item in items
            if item["mimeType"] != "application/vnd.google-apps.folder"
        ]
        folders = [
            item
            for item in items
            if item["mimeType"] == "application/vnd.google-apps.folder"
        ]

        # Process files - add to all_supported_files and folder_tree
        for file in files:
            # TODO(esorey): fix the SRT hack, GDrive isn't properly recognizing its MIME type
            if file["mimeType"] in supported_mime_types or file["name"].endswith(
                ".srt"
            ):
                all_supported_files.append(file)
                folder_tree["files"].append(
                    {
                        "id": file["id"],
                        "name": file["name"],
                        "mimeType": file["mimeType"],
                    }
                )
            else:
                all_skipped_files.append(file)

        # Recursively process subfolders
        for folder in folders:
            subfolder_result = await discover_files_in_folder(
                drive_service, folder["id"], folder["name"], processed_folders
            )
            all_supported_files.extend(subfolder_result["supported_files"])
            all_skipped_files.extend(subfolder_result["skipped_files"])
            total_count += subfolder_result["total_files"]

            # Add subfolder to tree structure
            folder_tree["children"].append(subfolder_result["folder_tree"])

        logger.info(
            f"📂 Folder {folder_id}: {len(all_supported_files)} supported files"
        )

    except Exception as e:
        logger.error(f"❌ Error accessing folder {folder_id}: {e}")
        raise

    return {
        "total_files": total_count,
        "supported_files": all_supported_files,
        "skipped_files": all_skipped_files,
        "folder_tree": folder_tree,
    }


async def build_folder_hierarchy_in_db(
    supabase, org_id: str, folder_tree: dict, parent_folder_id: str = None
):
    """
    Recursively create folder records in database from Google Drive folder tree.

    Returns mapping of google_drive_folder_id -> app_folder_id
    """
    drive_to_app_map = {}

    try:
        # Check if this folder already exists (idempotent import)
        existing = (
            supabase.table("folder")
            .select("id")
            .eq("google_drive_folder_id", folder_tree["google_drive_folder_id"])
            .eq("clerk_org_id", org_id)
            .execute()
        )

        if existing.data:
            # Reuse existing folder
            app_folder_id = existing.data[0]["id"]
            logger.info(
                f"✓ Reusing existing folder: {folder_tree['name']} ({app_folder_id})"
            )
        else:
            # Create new folder
            folder_data = {
                "clerk_org_id": org_id,
                "name": folder_tree["name"],
                "parent_folder_id": parent_folder_id,
                "google_drive_folder_id": folder_tree["google_drive_folder_id"],
                "description": f"Imported from Google Drive",
            }

            result = supabase.table("folder").insert(folder_data).execute()

            if not result.data:
                logger.error(f"Failed to create folder: {folder_tree['name']}")
                raise ValueError(f"Failed to create folder: {folder_tree['name']}")

            app_folder_id = result.data[0]["id"]
            logger.info(f"✅ Created folder: {folder_tree['name']} ({app_folder_id})")

        # Map Google Drive folder ID to app folder ID
        drive_to_app_map[folder_tree["google_drive_folder_id"]] = app_folder_id

        # Recursively create subfolders
        for subfolder_tree in folder_tree.get("children", []):
            subfolder_map = await build_folder_hierarchy_in_db(
                supabase, org_id, subfolder_tree, app_folder_id
            )
            drive_to_app_map.update(subfolder_map)

    except Exception as e:
        logger.error(f"❌ Error building folder hierarchy: {e}")
        raise

    return drive_to_app_map


async def create_document_record(
    supabase, org_id: str, file_info: dict, folder_id: str = None
):
    """Create a document record in Supabase for a Google Drive file"""

    def get_file_extension(mime_type: str, filename: str) -> str:
        if Path(filename).suffix:
            return Path(filename).suffix

        mime_to_ext = {
            "application/pdf": ".pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "application/msword": ".doc",
            "text/plain": ".txt",
            "application/vnd.google-apps.document": ".docx",
        }
        return mime_to_ext.get(mime_type, "")

    def get_file_type(mime_type: str, filename: str) -> str:
        # First try MIME type mapping
        mime_to_type = {
            "application/pdf": "pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
            "application/msword": "doc",
            "text/plain": "txt",
            "application/vnd.google-apps.document": "gdoc",
        }

        file_type = mime_to_type.get(mime_type)
        if file_type:
            return file_type

        # Fallback: check file extension if MIME type is unknown
        # (Google Drive returns application/octet-stream for SRT/VTT files)
        ext = Path(filename).suffix.lower()
        ext_to_type = {
            ".pdf": "pdf",
            ".docx": "docx",
            ".doc": "doc",
            ".txt": "txt",
            ".srt": "srt",
            ".vtt": "vtt",
        }

        return ext_to_type.get(ext, "unknown")

    # Generate filename with proper extension
    file_ext = get_file_extension(file_info["mimeType"], file_info["name"])
    filename = (
        file_info["name"]
        if file_info["name"].endswith(file_ext)
        else f"{file_info['name']}{file_ext}"
    )

    # Create document record
    doc_data = {
        "clerk_org_id": org_id,
        "title": filename,
        "description": "Imported from Google Drive folder",
        "source_type": "google_drive",
        "storage_path": "",  # Will be updated after we have document ID
        "file_type": get_file_type(file_info["mimeType"], file_info["name"]),
        "file_size": int(file_info.get("size", 0)) if file_info.get("size") else None,
        "processing_status": "pending_upload",
        "folder_id": folder_id,  # Link to folder if provided
        "source_metadata": {
            "source": {
                "google_drive_file_id": file_info["id"],
                "original_name": file_info["name"],
                "mime_type": file_info["mimeType"],
            },
            "processing": {},
        },
    }

    # Insert document
    result = supabase.table("document").insert(doc_data).execute()

    if not result.data:
        raise ValueError("Failed to create document record")

    document = result.data[0]

    # Update storage path with document ID
    clean_filename = re.sub(r"[^a-zA-Z0-9.-]", "_", filename)
    storage_path = f"{org_id}/{document['id']}-{clean_filename}"

    (
        supabase.table("document")
        .update({"storage_path": storage_path})
        .eq("id", document["id"])
        .execute()
    )

    document["storage_path"] = storage_path
    document["google_drive_file_id"] = file_info["id"]

    return document


# Route Handlers
@router.get("/auth")
async def google_drive_auth(
    code: Optional[str] = None,
    state: Optional[str] = None,
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
):
    """
    Handle Google Drive OAuth 2.0 flow (both phases).

    Phase 1 (no code): Redirects user to Google OAuth consent
    Phase 2 (with code): Exchanges authorization code for tokens and stores in DB
    """
    logger.info("=" * 80)
    logger.info("🚀 GOOGLE DRIVE AUTH ENDPOINT CALLED")
    logger.info(
        f"📋 Parameters: code={'present' if code else 'None'}, state={'present' if state else 'None'}"
    )
    logger.info("=" * 80)

    if not supabase_client:
        logger.error("❌ Supabase client not available")
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

        if not client_id or not client_secret or not redirect_uri:
            missing = []
            if not client_id:
                missing.append("GOOGLE_CLIENT_ID")
            if not client_secret:
                missing.append("GOOGLE_CLIENT_SECRET")
            if not redirect_uri:
                missing.append("GOOGLE_REDIRECT_URI")
            error_msg = f"Missing environment variables: {', '.join(missing)}"
            logger.error(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)

        # Step 3: Create OAuth flow
        logger.info("🔧 Creating OAuth Flow object...")
        try:
            client_config = {
                "installed": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uris": [redirect_uri],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            }
            logger.info(f"  Client config structure: {list(client_config.keys())}")
            logger.info(f"  Redirect URI: {redirect_uri}")
            logger.info(f"  Scopes: ['https://www.googleapis.com/auth/drive.readonly']")

            flow = Flow.from_client_config(
                client_config,
                scopes=["https://www.googleapis.com/auth/drive.readonly"],
                redirect_uri=redirect_uri,
            )
            logger.info("✅ OAuth Flow created successfully")
            logger.info(f"  Flow object type: {type(flow)}")
            logger.info(f"  Flow redirect_uri: {flow.redirect_uri}")
        except Exception as e:
            logger.error(
                f"❌ Failed to create OAuth Flow: {type(e).__name__}: {str(e)}"
            )
            logger.error(f"  Full error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500, detail=f"Failed to create OAuth flow: {str(e)}"
            )

        if not code:
            # Phase 1: Generate authorization URL and redirect
            logger.info("🔐 Step 4: Phase 1 - Generating authorization URL...")
            try:
                logger.info("  Calling flow.authorization_url()...")
                auth_url, state = flow.authorization_url(
                    access_type="offline",
                    prompt="consent",  # Force consent to get refresh token
                )
                logger.info(f"✅ Authorization URL generated successfully")
                logger.info(f"  Auth URL: {auth_url[:100]}...")
                logger.info(f"  State: {state[:20] if state else 'None'}...")
                logger.info("=" * 80)
                return {"auth_url": auth_url, "state": state}
            except Exception as e:
                logger.error(
                    f"❌ Failed to generate authorization URL: {type(e).__name__}: {str(e)}"
                )
                logger.error(f"  Full error: {e}", exc_info=True)
                raise HTTPException(
                    status_code=500, detail=f"Failed to generate auth URL: {str(e)}"
                )
        else:
            # Phase 2: Exchange code for tokens
            logger.info("🔄 Step 4: Phase 2 - Processing OAuth callback...")
            logger.info(f"  Authorization code length: {len(code) if code else 0}")
            logger.info(f"  State parameter: {'present' if state else 'None'}")
            logger.info(f"  User ID: {user_id or 'NOT PROVIDED'}")
            logger.info(f"  Org ID: {org_id or 'NOT PROVIDED'}")

            try:
                # Validate user_id and org_id are provided
                if not user_id or not org_id:
                    error_msg = "Missing user_id or org_id in callback"
                    logger.error(f"❌ {error_msg}")
                    raise HTTPException(status_code=400, detail=error_msg)

                # Exchange authorization code for tokens
                logger.info("  Calling flow.fetch_token()...")
                flow.fetch_token(code=code)
                logger.info("✅ Token exchange successful")

                credentials = flow.credentials
                logger.info(f"  Credentials type: {type(credentials)}")
                logger.info(f"  Has access token: {bool(credentials.token)}")
                logger.info(f"  Has refresh token: {bool(credentials.refresh_token)}")

                # Step 5: Store tokens in database
                logger.info("💾 Step 5: Storing tokens in database...")
                token_data = {
                    "user_id": user_id,
                    "clerk_org_id": org_id,
                    "access_token": credentials.token,
                    "refresh_token": credentials.refresh_token or None,
                    "token_type": "Bearer",
                    "expiry_date": (
                        credentials.expiry.isoformat() if credentials.expiry else None
                    ),
                    "scope": (
                        " ".join(credentials.scopes) if credentials.scopes else None
                    ),
                }

                logger.info(
                    f"  Token data to store: user_id={user_id}, org_id={org_id}"
                )
                logger.info(f"    Has refresh_token: {bool(credentials.refresh_token)}")
                logger.info(f"    Expiry: {credentials.expiry}")

                result = (
                    supabase_client.table("google_drive_tokens")
                    .upsert(token_data, on_conflict="user_id,clerk_org_id")
                    .execute()
                )

                logger.info(f"✅ Tokens stored successfully in database")
                logger.info(f"  Result: {result.data if result.data else 'upserted'}")

                response = {
                    "success": True,
                    "message": "OAuth successful. Tokens stored securely.",
                }
                logger.info("=" * 80)
                return response

            except HTTPException:
                raise
            except Exception as e:
                logger.error(
                    f"❌ Failed to exchange authorization code: {type(e).__name__}: {str(e)}"
                )
                logger.error(f"  Full error: {e}", exc_info=True)
                logger.info("=" * 80)
                raise HTTPException(
                    status_code=400, detail=f"OAuth token exchange failed: {str(e)}"
                )

    except HTTPException:
        logger.info("⚠️ Re-raising HTTPException")
        raise
    except Exception as e:
        logger.error(
            f"❌ UNCAUGHT EXCEPTION in Google Drive auth: {type(e).__name__}: {str(e)}"
        )
        logger.error(f"  Full traceback:", exc_info=True)
        logger.info("=" * 80)
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.post("/discover")
async def google_drive_discover(request: GoogleDriveDiscoveryRequest):
    """
    Discover files and folders in a Google Drive folder (read-only, no mutations).

    This endpoint:
    1. Checks if user has valid Google Drive tokens
    2. If no tokens: returns auth URL for frontend to use
    3. If tokens exist: scans folder and returns tree structure WITHOUT creating any database records

    Returns folder tree structure for user selection.
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        logger.info(
            f"📥 Google Drive discovery requested for folder: {request.folder_id}"
        )

        # Check if user has stored Google Drive tokens
        token_result = (
            supabase_client.table("google_drive_tokens")
            .select("*")
            .eq("user_id", request.user_id)
            .eq("clerk_org_id", request.org_id)
            .execute()
        )

        if not token_result.data:
            # No tokens stored - user needs to authenticate
            logger.info("⚠️ No Google Drive tokens found. Requesting authentication...")
            auth_url = f"{os.getenv('NEXTJS_URL', 'http://localhost:3000')}/api/google-drive/auth"
            return {
                "error": "AUTHENTICATION_REQUIRED",
                "message": "Google Drive authentication required",
                "auth_url": auth_url,
            }

        token_data = token_result.data[0]

        # Initialize Google Drive client with stored tokens
        credentials = Credentials(
            token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        )

        drive_service = build("drive", "v3", credentials=credentials)

        # Get root folder name first
        try:
            root_folder_info = (
                drive_service.files()
                .get(fileId=request.folder_id, fields="id, name")
                .execute()
            )
            root_folder_name = root_folder_info.get("name", "Imported Folder")
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch root folder name: {e}")
            root_folder_name = "Imported Folder"

        # Discover files in folder and get folder tree
        logger.info(
            f"🔍 Discovering files in folder {request.folder_id} ({root_folder_name})"
        )
        discovery_result = await discover_files_in_folder(
            drive_service, request.folder_id, root_folder_name
        )

        if not discovery_result["supported_files"]:
            return {
                "error": "NO_FILES_FOUND",
                "message": "No supported files found in the folder",
                "total_files": discovery_result["total_files"],
            }

        logger.info(f"📂 Found {len(discovery_result['supported_files'])} files")
        folder_tree = discovery_result["folder_tree"]

        return {
            "success": True,
            "message": "Folder structure discovered",
            "folders": {"structure": folder_tree},
        }

    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e)
        logger.error(f"❌ Google Drive discovery error: {e}", exc_info=True)

        # Check if this is a credential refresh error
        if "unauthorized_client" in error_str or "RefreshError" in str(type(e)):
            logger.warning(
                "⚠️ Google Drive credentials have expired and cannot be auto-refreshed"
            )
            auth_url = f"{os.getenv('NEXTJS_URL', 'http://localhost:3000')}/api/google-drive/auth"
            return {
                "error": "CREDENTIAL_REFRESH_FAILED",
                "message": "Google Drive credentials have expired. Please refresh your authorization.",
                "auth_url": auth_url,
            }

        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")


@router.post("/import")
async def google_drive_import(request: GoogleDriveImportRequest):
    """
    Import selected documents from a Google Drive folder.

    This endpoint:
    1. Checks if user has valid Google Drive tokens
    2. Discovers files in folder
    3. Filters to only selected files
    4. Creates folder structure in database
    5. Creates document records
    6. Queues documents for processing

    Note: Use /api/google-drive/discover first to get folder structure and let user select files.
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        logger.info(f"📥 Google Drive import requested for folder: {request.folder_id}")

        # Check if user has stored Google Drive tokens
        token_result = (
            supabase_client.table("google_drive_tokens")
            .select("*")
            .eq("user_id", request.user_id)
            .eq("clerk_org_id", request.org_id)
            .execute()
        )

        if not token_result.data:
            # No tokens stored - user needs to authenticate
            logger.info("⚠️ No Google Drive tokens found. Requesting authentication...")
            auth_url = f"{os.getenv('NEXTJS_URL', 'http://localhost:3000')}/api/google-drive/auth"
            return {
                "error": "AUTHENTICATION_REQUIRED",
                "message": "Google Drive authentication required",
                "auth_url": auth_url,
            }

        token_data = token_result.data[0]

        credentials = Credentials(
            token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        )

        drive_service = build("drive", "v3", credentials=credentials)

        # Get root folder name first
        try:
            root_folder_info = (
                drive_service.files()
                .get(fileId=request.folder_id, fields="id, name")
                .execute()
            )
            root_folder_name = root_folder_info.get("name", "Imported Folder")
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch root folder name: {e}")
            root_folder_name = "Imported Folder"

        # Discover files in folder and get folder tree
        logger.info(
            f"🔍 Discovering files in folder {request.folder_id} ({root_folder_name})"
        )
        discovery_result = await discover_files_in_folder(
            drive_service, request.folder_id, root_folder_name
        )

        if not discovery_result["supported_files"]:
            return {
                "error": "NO_FILES_FOUND",
                "message": "No supported files found in the folder",
                "total_files": discovery_result["total_files"],
            }

        logger.info(f"📂 Found {len(discovery_result['supported_files'])} files")

        folder_tree = discovery_result["folder_tree"]

        # Filter files by selection first
        files_to_import = discovery_result["supported_files"]
        selected_ids_set = set(request.selected_file_ids)
        files_to_import = [f for f in files_to_import if f["id"] in selected_ids_set]
        logger.info(
            f"📋 Filtering to {len(files_to_import)} selected files out of {len(discovery_result['supported_files'])}"
        )

        # Get set of parent folder IDs from selected files
        selected_parent_folder_ids = set()
        for file_info in files_to_import:
            if file_info.get("parents"):
                selected_parent_folder_ids.add(file_info["parents"][0])

        # Filter folder tree to only include folders that contain selected files (directly or in descendants)
        def filter_folder_tree(tree: dict, selected_parents: set) -> dict | None:
            """Recursively filter folder tree to only include branches with selected files"""
            # Check if this folder is a parent of any selected file
            has_selected_files = tree["google_drive_folder_id"] in selected_parents

            # Filter children
            filtered_children = []
            for child in tree.get("children", []):
                filtered_child = filter_folder_tree(child, selected_parents)
                if filtered_child:
                    filtered_children.append(filtered_child)
                    has_selected_files = True

            # Return this folder only if it has selected files or descendants with selected files
            if has_selected_files:
                return {**tree, "children": filtered_children}
            return None

        filtered_folder_tree = filter_folder_tree(
            folder_tree, selected_parent_folder_ids
        )

        # Build folder hierarchy in database
        logger.info("📁 Creating folder structure...")

        try:
            if filtered_folder_tree:
                drive_to_app_map = await build_folder_hierarchy_in_db(
                    supabase_client, request.org_id, filtered_folder_tree
                )
                logger.info(f"✅ Created {len(drive_to_app_map)} folders")
            else:
                drive_to_app_map = {}
                logger.info("ℹ️ No folders needed for selected files")
        except Exception as e:
            logger.error(f"❌ Failed to build folder hierarchy: {e}")
            return {
                "error": "FOLDER_CREATION_FAILED",
                "message": f"Failed to create folder structure: {str(e)}",
                "success": False,
            }

        # Process and create document records
        documents = []
        skipped_files = []
        for file_info in files_to_import:
            try:
                # Check if this file is already imported in this org
                existing = (
                    supabase_client.table("document")
                    .select("id, source_metadata, updated_at")
                    .eq("clerk_org_id", request.org_id)
                    .eq("source_type", "google_drive")
                    .filter(
                        "source_metadata->>google_drive_file_id", "eq", file_info["id"]
                    )
                    .execute()
                )

                if existing.data:
                    doc_record = existing.data[0]
                    source_metadata = doc_record.get("source_metadata", {})
                    source_info = source_metadata.get("source", {})
                    last_ingested = source_info.get("ingested_at")

                    # Check if file was modified in Google Drive after last ingest
                    file_modified_time = file_info.get("modifiedTime")
                    if last_ingested and file_modified_time:
                        try:
                            last_ingest_dt = datetime.fromisoformat(
                                last_ingested.replace("Z", "+00:00")
                            )
                            file_modified_dt = datetime.fromisoformat(
                                file_modified_time.replace("Z", "+00:00")
                            )

                            if file_modified_dt <= last_ingest_dt:
                                logger.info(
                                    f"⏭️ Skipping {file_info['name']} - already imported and unchanged (ID: {file_info['id']})"
                                )
                                continue
                            else:
                                logger.info(
                                    f"🔄 File {file_info['name']} was modified since last import - will re-process (ID: {file_info['id']})"
                                )
                                # Delete the old document to reimport fresh
                                supabase_client.table("document").delete().eq(
                                    "id", doc_record["id"]
                                ).execute()
                        except Exception as e:
                            logger.warning(
                                f"Could not compare timestamps for {file_info['name']}: {e}"
                            )
                    else:
                        logger.info(
                            f"⏭️ Skipping {file_info['name']} - already imported (ID: {file_info['id']})"
                        )
                        continue

                # Determine which app folder this file belongs to
                # Get parent folder from file_info
                file_parent_drive_id = (
                    file_info.get("parents", [None])[0]
                    if file_info.get("parents")
                    else None
                )
                folder_id = (
                    drive_to_app_map.get(file_parent_drive_id)
                    if file_parent_drive_id
                    else None
                )

                # Determine processing mode based on file type
                mime_type = file_info.get("mimeType", "")
                processing_mode = get_processing_mode(mime_type)

                # Validate file size
                file_size = int(file_info.get("size", 0)) if file_info.get("size") else 0
                is_valid_size, size_error = validate_file_size(file_size, mime_type)

                if not is_valid_size:
                    logger.warning(f"⚠️ Skipping {file_info['name']} - {size_error}")
                    skipped_files.append({
                        "name": file_info["name"],
                        "reason": "File too large",
                        "error": size_error
                    })
                    continue

                # AUDIO/VIDEO PATH: Skip storage, queue for direct transcription
                if processing_mode == "direct_transcription":
                    logger.info(f"🎵 Audio/video file detected: {file_info['name']} - skipping storage upload")

                    try:
                        # Create document record WITHOUT downloading/uploading
                        doc = await create_document_record(
                            supabase_client, request.org_id, file_info, folder_id
                        )

                        # Update metadata to indicate direct transcription mode
                        supabase_client.table("document").update({
                            "storage_path": None,  # No storage needed
                            "source_metadata": {
                                **doc.get("source_metadata", {}),
                                "processing_mode": "direct_transcription",
                                "google_drive_file_id": file_info["id"],
                                "mime_type": mime_type,
                                "can_redownload": True,
                            }
                        }).eq("id", doc["id"]).execute()

                        documents.append(doc)
                        logger.info(f"✅ Queued audio/video (no storage): {file_info['name']}")

                    except Exception as e:
                        logger.error(f"❌ Failed to queue audio/video {file_info['name']}: {e}")
                        skipped_files.append({
                            "name": file_info["name"],
                            "reason": "Failed to create document record",
                            "error": str(e)[:200]
                        })
                        continue

                # DOCUMENT PATH: Download, upload to storage, queue for standard processing
                else:
                    # CRITICAL FIX: Download and upload to storage FIRST, before creating document record
                    # This prevents orphaned document records when storage upload fails (e.g., 413 errors)
                    try:
                        logger.info(
                            f"📥 Downloading {file_info['name']} from Google Drive..."
                        )

                        # Check if it's a Google Workspace file that needs export
                        if mime_type == "application/vnd.google-apps.document":
                            # Export Google Docs as .docx
                            logger.info(
                                f"📄 Exporting Google Doc: {file_info['name']} as .docx"
                            )
                            drive_request = drive_service.files().export_media(
                                fileId=file_info["id"],
                                mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            )
                            file_content = drive_request.execute()
                            # Update mime type for storage
                            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        else:
                            # Regular file download
                            file_content = (
                                drive_service.files()
                                .get_media(fileId=file_info["id"])
                                .execute()
                            )

                        # Create temporary document record to get storage path
                        doc = await create_document_record(
                            supabase_client, request.org_id, file_info, folder_id
                        )

                        logger.info(
                            f"☁️ Uploading {file_info['name']} to Supabase storage..."
                        )
                        upload_result = supabase_client.storage.from_("documents").upload(
                            doc["storage_path"],
                            file_content,
                            file_options={"content-type": mime_type},
                        )

                        # Check if upload succeeded - Supabase storage returns error in response
                        if hasattr(upload_result, 'error') and upload_result.error:
                            raise Exception(f"Storage upload failed: {upload_result.error}")

                        logger.info(
                            f"✅ Successfully uploaded {file_info['name']} to storage"
                        )

                        # Only add to documents list if BOTH record creation AND storage upload succeeded
                        documents.append(doc)
                        logger.info(f"✅ Created document record: {file_info['name']}")

                    except Exception as e:
                        error_msg = str(e)
                        logger.error(
                            f"❌ Failed to process {file_info['name']}: {error_msg}"
                        )

                        # CRITICAL: Clean up document record if it was created but storage upload failed
                        if 'doc' in locals():
                            try:
                                logger.warning(f"🗑️ Rolling back document record for {file_info['name']}...")
                                supabase_client.table("document").delete().eq(
                                    "id", doc["id"]
                                ).execute()
                                logger.info(f"✅ Rolled back document record for {file_info['name']}")
                            except Exception as cleanup_error:
                                logger.error(f"❌ Failed to clean up document record: {cleanup_error}")

                        # Track failed file for user feedback
                        skipped_files.append({
                            "name": file_info["name"],
                            "reason": "Storage upload failed" if "Storage upload failed" in error_msg or "413" in error_msg else "Processing error",
                            "error": error_msg[:200]  # Truncate long errors
                        })
                        continue

            except Exception as e:
                logger.error(f"❌ Failed to create document {file_info['name']}: {e}")
                skipped_files.append({
                    "name": file_info["name"],
                    "reason": "Document creation failed",
                    "error": str(e)[:200]
                })
                continue

        # Queue documents for processing
        if documents:
            try:
                # Queue documents using new pipeline router (supports both old and new pipelines)
                job_responses = []
                for doc in documents:
                    # Get Google Drive file ID from source_metadata
                    source_metadata = doc.get("source_metadata", {})
                    google_drive_file_id = source_metadata.get("source", {}).get("google_drive_file_id")

                    # Determine processing mode
                    processing_mode = source_metadata.get("processing_mode", "standard_document")

                    # Route based on processing mode
                    if processing_mode == "direct_transcription":
                        # Audio/video: No storage, use source_location
                        result = enqueue_pipeline_job(
                            document_id=doc["id"],
                            source_platform="google_drive",
                            clerk_org_id=request.org_id,
                            source_name=doc["title"],
                            file_type=doc["file_type"],
                            source_location=f"gdrive://{google_drive_file_id}",
                            store_raw=False,  # Don't store raw by default for audio/video
                            user_id=request.user_id,  # For legacy pipeline
                        )
                    else:
                        # Standard document: Already in storage
                        result = enqueue_pipeline_job(
                            document_id=doc["id"],
                            source_platform="google_drive",
                            clerk_org_id=request.org_id,
                            source_name=doc["title"],
                            file_type=doc["file_type"],
                            source_location=f"gdrive://{google_drive_file_id}",
                            store_raw=False,  # Raw already stored during Google Drive import - don't store twice
                            user_id=request.user_id,  # For legacy pipeline
                            storage_path=doc["storage_path"],  # For legacy pipeline
                        )

                    job_responses.append({
                        "job_id": result["job_id"],
                        "document_id": doc["id"],
                        "pipeline_job_id": result.get("pipeline_job_id")
                    })

                logger.info(f"📥 Queued {len(documents)} documents for processing")

                response_data = {
                    "success": True,
                    "message": f"Successfully imported {len(documents)} documents in {len(drive_to_app_map)} folders",
                    "documents": [
                        {"id": doc["id"], "title": doc["title"]} for doc in documents
                    ],
                    "folders": {
                        "count": len(drive_to_app_map),
                        "structure": folder_tree,  # Include folder tree for frontend display
                    },
                    "jobs": job_responses,
                }

                # Include skipped files if any
                if skipped_files:
                    response_data["skipped_files"] = skipped_files
                    response_data["warning"] = f"{len(skipped_files)} file(s) could not be imported"
                    logger.warning(f"⚠️ {len(skipped_files)} files were skipped during import")

                return response_data
            except Exception as e:
                logger.error(f"❌ Failed to queue documents: {e}")
                return {
                    "success": False,
                    "message": "Documents created but queuing failed",
                    "error": str(e),
                    "documents": [
                        {"id": doc["id"], "title": doc["title"]} for doc in documents
                    ],
                }
        else:
            return {
                "success": False,
                "message": "No documents could be created",
                "error": "Document creation failed for all files",
            }

    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e)
        logger.error(f"❌ Google Drive import error: {e}", exc_info=True)

        # Check if this is a credential refresh error
        if "unauthorized_client" in error_str or "RefreshError" in str(type(e)):
            logger.warning(
                "⚠️ Google Drive credentials have expired and cannot be auto-refreshed"
            )
            auth_url = f"{os.getenv('NEXTJS_URL', 'http://localhost:3000')}/api/google-drive/auth"
            return {
                "error": "CREDENTIAL_REFRESH_FAILED",
                "message": "Google Drive credentials have expired. Please refresh your authorization.",
                "auth_url": auth_url,
            }

        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
