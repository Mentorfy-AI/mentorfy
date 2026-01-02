#!/usr/bin/env python3
"""
Document Processor for Graphiti Integration

Handles ingestion of uploaded documents into the Graphiti knowledge graph.
This script processes individual documents and creates episodes for knowledge storage.
"""

import sys
import os
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List
import tempfile
import mimetypes

from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType
from graphiti_core.utils.bulk_utils import RawEpisode
from dotenv import load_dotenv

# Enhanced text extraction imports
from mentorfy.utils.text_extraction import ImprovedTextExtractor, TextQualityValidator

# LangChain imports for enhanced document loading
try:
    from langchain_community.document_loaders import (
        UnstructuredPDFLoader,
        UnstructuredWordDocumentLoader,
        UnstructuredFileLoader,
        TextLoader
    )
    from langchain_core.documents import Document
    LANGCHAIN_AVAILABLE = True
except ImportError:
    print("⚠️  LangChain not available, using fallback text extraction", file=sys.stderr)
    LANGCHAIN_AVAILABLE = False

# Load environment variables
load_dotenv()

# Import Supabase client for database operations
try:
    from supabase import create_client, Client
except ImportError:
    print(
        "ERROR: supabase-py is required. Install with: pip install supabase",
        file=sys.stderr,
    )
    sys.exit(1)


class DocumentProcessor:
    def __init__(self):
        # Initialize Supabase client
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required"
            )

        self.supabase: Client = create_client(supabase_url, supabase_key)

        # Initialize Graphiti client
        neo4j_uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
        neo4j_user = os.environ.get("NEO4J_USER", "neo4j")
        neo4j_password = os.environ.get("NEO4J_PASSWORD")

        if not neo4j_password:
            raise ValueError("NEO4J_PASSWORD environment variable is required")

        self.graphiti = Graphiti(
            neo4j_uri,
            neo4j_user,
            neo4j_password,
        )

    async def download_document(self, storage_path: str) -> str:
        """
        Download document from Supabase storage to temporary file

        Args:
            storage_path: Path to file in Supabase storage

        Returns:
            Path to downloaded temporary file
        """
        try:
            # Download file from storage
            response = self.supabase.storage.from_("documents").download(storage_path)

            # Create temporary file with correct extension for the file type
            # Determine appropriate suffix based on storage path extension
            file_extension = ""
            if storage_path.endswith('.pdf'):
                file_extension = ".pdf"
            elif storage_path.endswith('.docx') or storage_path.endswith('.gdoc'):
                file_extension = ".docx"
            elif storage_path.endswith('.doc'):
                file_extension = ".doc"
            elif storage_path.endswith('.txt'):
                file_extension = ".txt"
            else:
                file_extension = ".bin"  # fallback
                
            with tempfile.NamedTemporaryFile(
                mode="w+b", delete=False, suffix=file_extension
            ) as temp_file:
                if isinstance(response, bytes):
                    temp_file.write(response)
                else:
                    # Handle string response
                    temp_file.write(response.encode("utf-8"))
                return temp_file.name

        except Exception as e:
            raise Exception(
                f"Failed to download document from storage '{storage_path}': {str(e)}"
            )

    async def parse_document_content(self, file_path: str, document: dict) -> str:
        """
        Parse text content from document file using enhanced extraction methods

        Args:
            file_path: Path to local document file
            document: Document metadata including mime_type

        Returns:
            Parsed text content
        """
        try:
            mime_type = document.get('mime_type', '')
            file_name = document.get('title', Path(file_path).name)
            
            print(f"📖 Extracting text from {file_name} (type: {mime_type})")
            
            # Try LangChain loaders first if available
            if LANGCHAIN_AVAILABLE:
                langchain_text = await self._extract_with_langchain(file_path, mime_type)
                if langchain_text and langchain_text.strip():
                    print(f"✅ LangChain extraction successful ({len(langchain_text)} characters)")
                    
                    # Assess quality
                    quality = TextQualityValidator.assess_text_quality(langchain_text)
                    print(f"📊 Text quality: {quality['quality_rating']} ({quality['word_count']} words)")
                    
                    return langchain_text
            
            # Fallback to enhanced custom extractor
            print("🔄 Using enhanced custom text extractor")
            
            # For simple text files, use direct reading
            if mime_type == 'text/plain' or file_path.endswith('.txt'):
                with open(file_path, "r", encoding="utf-8") as file:
                    content = file.read().strip()
            else:
                # Use our enhanced extractor for other formats
                content = ImprovedTextExtractor.extract_text(file_path, mime_type)
            
            if not content or not content.strip():
                raise ValueError("Document is empty or no text could be extracted")

            # Assess quality for fallback extraction too
            quality = TextQualityValidator.assess_text_quality(content)
            print(f"📊 Fallback text quality: {quality['quality_rating']} ({quality['word_count']} words)")

            return content.strip()

        except Exception as e:
            raise Exception(f"Failed to parse document content: {str(e)}")
    
    async def _extract_with_langchain(self, file_path: str, mime_type: str) -> Optional[str]:
        """Extract text using LangChain document loaders"""
        try:
            documents = await self._load_with_langchain(file_path, mime_type)
            
            if documents:
                # Combine all document content
                combined_text = '\n\n'.join([doc.page_content for doc in documents if doc.page_content])
                return combined_text if combined_text.strip() else None
                
            return None
            
        except Exception as e:
            print(f"⚠️  LangChain extraction failed: {e}")
            return None
    
    async def _load_with_langchain(self, file_path: str, mime_type: str) -> List[Document]:
        """Load document using appropriate LangChain loader"""
        try:
            if mime_type == 'application/pdf':
                loader = UnstructuredPDFLoader(file_path, mode="elements")
                
            elif mime_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                             'application/msword']:
                loader = UnstructuredWordDocumentLoader(file_path, mode="elements")
                
            elif mime_type == 'text/plain':
                loader = TextLoader(file_path, encoding='utf-8')
                
            else:
                # Generic unstructured loader for other formats
                loader = UnstructuredFileLoader(file_path, mode="elements")
            
            # Load documents - run in thread since some loaders may block
            documents = await asyncio.to_thread(loader.load)
            
            # Filter out empty documents
            return [doc for doc in documents if doc.page_content.strip()]
            
        except Exception as e:
            print(f"⚠️  LangChain loader failed: {e}")
            return []

    def create_episode_from_document(
        self, document_id: str, content: str, user_id: str, title: Optional[str] = None
    ) -> RawEpisode:
        """
        Create a RawEpisode object from document content

        Args:
            document_id: Unique document identifier
            content: Text content of the document
            user_id: ID of the user who uploaded the document
            title: Optional document title

        Returns:
            RawEpisode object ready for Graphiti ingestion
        """
        episode_name = title or f"Document {document_id[:8]}"

        return RawEpisode(
            name=episode_name,
            content=content,
            source_description=f"Uploaded document by user {user_id}",
            source=EpisodeType.message,  # Using message type for text documents
            reference_time=datetime.now(timezone.utc),
        )

    async def get_folder_path(self, folder_id: Optional[str]) -> str:
        """
        Get full folder path like 'Parent/Child/Current'

        Args:
            folder_id: UUID of the folder

        Returns:
            Full path string, or "/" if folder_id is None
        """
        if not folder_id:
            return "/"

        try:
            # Build path by traversing up the folder hierarchy
            path_parts = []
            current_folder_id = folder_id
            max_depth = 10  # Prevent infinite loops
            depth = 0

            while current_folder_id and depth < max_depth:
                folder_result = (
                    self.supabase.table("folder")
                    .select("name, parent_folder_id")
                    .eq("id", current_folder_id)
                    .execute()
                )

                if folder_result.data and len(folder_result.data) > 0:
                    folder = folder_result.data[0]
                    path_parts.insert(0, folder["name"])
                    current_folder_id = folder["parent_folder_id"]
                else:
                    break

                depth += 1

            return "/".join(path_parts) if path_parts else "/"

        except Exception as e:
            print(f"Warning: Failed to get folder path: {e}", file=sys.stderr)
            return "/"

    async def ingest_document(
        self,
        document_id: str,
        storage_path: str,
        user_id: str,
        organization_id: Optional[str] = None,
        folder_id: Optional[str] = None
    ) -> dict:
        """
        Complete workflow to ingest a document into Graphiti

        Args:
            document_id: Unique document identifier
            storage_path: Path to document in Supabase storage
            user_id: ID of the user who uploaded the document
            organization_id: Organization ID for multi-tenant isolation (NEW)
            folder_id: Folder ID if document is in a folder (NEW)

        Returns:
            Result dictionary with success status and details
        """
        temp_file_path = None

        try:
            # Get document metadata from database with retry logic
            document = None
            max_retries = 3
            retry_delay = 2  # seconds

            for attempt in range(max_retries):
                try:
                    # Use .execute().data instead of .single().execute() to avoid the PGRST116 error
                    document_result = (
                        self.supabase.table("document")
                        .select("*")
                        .eq("id", document_id)
                        .execute()
                    )
                    if document_result.data and len(document_result.data) > 0:
                        document = document_result.data[
                            0
                        ]  # Get first (and should be only) result
                        print(f"Successfully found document: {document['title']}")
                        break
                    else:
                        if attempt < max_retries - 1:
                            print(
                                f"Document {document_id} not found, retrying in {retry_delay} seconds (attempt {attempt + 1}/{max_retries})"
                            )
                            await asyncio.sleep(retry_delay)
                        else:
                            raise Exception(
                                f"Document {document_id} not found in database after {max_retries} attempts"
                            )
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"Error fetching document, retrying: {e}")
                        await asyncio.sleep(retry_delay)
                    else:
                        raise

            if not document:
                raise Exception(f"Document {document_id} not found in database")

            # Update status to indexing (being processed into AI knowledge base)
            self.supabase.table("document").update({
                "processing_status": "indexing"
            }).eq("id", document_id).execute()

            # Download document content
            temp_file_path = await self.download_document(storage_path)

            # Parse content using enhanced extraction
            content = await self.parse_document_content(temp_file_path, document)

            # Get organization_id and folder_id from document if not provided
            if not organization_id:
                organization_id = document.get("organization_id")

            if not folder_id:
                folder_id = document.get("folder_id")

            # Get folder name and path
            folder_name = None
            folder_path = await self.get_folder_path(folder_id)

            if folder_id:
                try:
                    folder_result = (
                        self.supabase.table("folder")
                        .select("name")
                        .eq("id", folder_id)
                        .execute()
                    )
                    if folder_result.data:
                        folder_name = folder_result.data[0]["name"]
                except Exception as e:
                    print(f"Warning: Failed to get folder name: {e}", file=sys.stderr)

            # Create episode
            episode = self.create_episode_from_document(
                document_id, content, user_id, document.get("title")
            )

            # Add episode to Graphiti with organization isolation and folder metadata
            await self.graphiti.add_episode(
                name=episode.name,
                episode_body=episode.content,
                source=episode.source,
                reference_time=episode.reference_time,
                source_description=episode.source_description,
                group_id=organization_id,  # Organization-level isolation
                previous_episode_uuids=[],  # Skip context retrieval to prevent token overflow from large documents
                metadata={
                    "organization_id": organization_id,
                    "document_id": document_id,
                    "folder_id": folder_id,
                    "folder_name": folder_name,
                    "folder_path": folder_path,
                    "ingested_at": datetime.now(timezone.utc).isoformat()
                }
            )

            # Update document status to ready (available in AI chatbot)
            self.supabase.table("document").update(
                {
                    "processing_status": "ready",
                    "source_metadata": {
                        **document.get("source_metadata", {}),
                        "graphiti_ingested_at": datetime.now(timezone.utc).isoformat(),
                        "content_length": len(content),
                        "word_count": len(content.split()),
                    },
                }
            ).eq("id", document_id).execute()

            return {
                "success": True,
                "message": f"Document {document_id} successfully ingested into Graphiti",
                "word_count": len(content.split()),
                "content_length": len(content),
            }

        except Exception as e:
            # Update document status to failed
            try:
                self.supabase.table("document").update(
                    {
                        "processing_status": "failed",
                        "source_metadata": {
                            "error": str(e),
                            "failed_at": datetime.now(timezone.utc).isoformat(),
                        },
                    }
                ).eq("id", document_id).execute()
            except:
                pass  # Don't fail on metadata update error

            return {"success": False, "error": str(e)}

        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except:
                    pass  # Don't fail on cleanup error

    async def health_check(self) -> bool:
        """
        Check if all services are healthy and accessible

        Returns:
            True if healthy, False otherwise
        """
        try:
            # Test Supabase connection
            result = self.supabase.table("document").select("id").limit(1).execute()

            # Test Graphiti connection
            await self.graphiti.search("test", num_results=1)

            return True
        except Exception as e:
            print(f"Health check failed: {e}", file=sys.stderr)
            return False

    async def close(self):
        """Close all client connections"""
        try:
            if hasattr(self.graphiti, "driver") and self.graphiti.driver:
                if hasattr(self.graphiti.driver, "close"):
                    close_method = self.graphiti.driver.close
                    if asyncio.iscoroutinefunction(close_method):
                        await close_method()
                    else:
                        close_method()
        except Exception as e:
            print(f"Warning: Error closing Graphiti client: {e}", file=sys.stderr)


async def main():
    """
    Main function for command-line usage

    Usage:
        python document_processor.py ingest <document_id> <storage_path> <user_id> [organization_id] [folder_id]
        python document_processor.py health
    """
    if len(sys.argv) < 2:
        print(
            json.dumps(
                {
                    "error": "Missing command. Use: ingest <document_id> <storage_path> <user_id> [organization_id] [folder_id] or health"
                }
            )
        )
        sys.exit(1)

    command = sys.argv[1]

    try:
        processor = DocumentProcessor()

        if command == "ingest":
            if len(sys.argv) < 5:
                print(
                    json.dumps(
                        {
                            "error": "Missing parameters. Use: ingest <document_id> <storage_path> <user_id> [organization_id] [folder_id]"
                        }
                    )
                )
                sys.exit(1)

            document_id = sys.argv[2]
            storage_path = sys.argv[3]
            user_id = sys.argv[4]
            organization_id = sys.argv[5] if len(sys.argv) > 5 else None
            folder_id = sys.argv[6] if len(sys.argv) > 6 else None

            result = await processor.ingest_document(
                document_id, storage_path, user_id, organization_id, folder_id
            )
            print(json.dumps(result))

            if not result["success"]:
                sys.exit(1)

        elif command == "health":
            healthy = await processor.health_check()
            print(json.dumps({"healthy": healthy}))

        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    finally:
        if "processor" in locals():
            await processor.close()


if __name__ == "__main__":
    asyncio.run(main())
