"""
Pydantic schemas for API request/response models
"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel


# Document Processing Schemas
class DocumentProcessRequest(BaseModel):
    document_id: str
    google_drive_file_id: str
    storage_path: str
    user_id: str


class QueueDocumentRequest(BaseModel):
    document_id: str
    google_drive_file_id: Optional[str] = None
    storage_path: str
    user_id: str
    organization_id: str
    file_name: str
    file_type: str


class BatchProcessRequest(BaseModel):
    documents: List[QueueDocumentRequest]


class ProcessingStatus(BaseModel):
    document_id: str
    status: str
    message: Optional[str] = None


class DocumentDeleteRequest(BaseModel):
    document_id: str
    organization_id: str


class DocumentDeleteResponse(BaseModel):
    success: bool
    document_id: str
    message: str


class BatchDeleteRequest(BaseModel):
    document_ids: List[str]
    organization_id: str


class BatchDeleteResponse(BaseModel):
    success: bool
    deleted_count: int = 0
    errors: Optional[List[str]] = None


# Job Queue Schemas
class JobResponse(BaseModel):
    job_id: str
    document_id: str
    status: str


class JobStatus(BaseModel):
    job_id: str
    status: str
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: int = 0


# Search Schemas
class SearchRequest(BaseModel):
    query: str
    organization_id: Optional[str] = None  # Organization ID for filtering
    limit: int = 5


class SearchResult(BaseModel):
    fact: str
    confidence: float = 1.0
    source: str = "knowledge_graph"


# Chat Schemas
class ChatRequest(BaseModel):
    message: str
    conversation_id: str
    bot_id: Optional[str] = None
    user_id: Optional[str] = None
    file_id: Optional[str] = None  # Anthropic file ID for document attachments (DEPRECATED: use file_attachments)
    file_type: Optional[str] = None  # MIME type for file (DEPRECATED: use file_attachments)
    file_base64: Optional[str] = None  # Base64-encoded image data (DEPRECATED: use file_attachments)
    file_attachments: Optional[List[Dict[str, Any]]] = None  # Array of file attachments: [{ "type": "image", "base64": "...", "media_type": "..." } | { "type": "document", "file_id": "..." }]
    previous_messages: Optional[List[dict]] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: Optional[str] = None
    sources: Optional[List[str]] = None
    error: Optional[str] = None


# Agent Console Schemas
class AgentConsoleRequest(BaseModel):
    """Request schema for agent console streaming endpoint"""
    message: str
    conversation_id: Optional[str] = None
    bot_id: str
    previous_messages: Optional[List[dict]] = None
    override_system_prompt: Optional[str] = (
        None  # Allow custom system prompt for testing
    )
    override_model: Optional[str] = None  # Allow custom model for testing


# Bot Configuration Schemas
class SystemPromptUpdate(BaseModel):
    system_prompt: str


# Health Check Schema
class HealthResponse(BaseModel):
    status: str
