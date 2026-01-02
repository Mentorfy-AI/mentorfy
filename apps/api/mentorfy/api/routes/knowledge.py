"""
Knowledge Graph Routes

This module contains all knowledge graph-related API endpoints:
- Knowledge graph search with organization filtering
- Full knowledge graph retrieval for visualization

These routes handle interactions with the Graphiti knowledge graph,
including semantic search and graph data export for 2D visualization.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Any

from fastapi import APIRouter, HTTPException
from graphiti_core import Graphiti
from graphiti_core.edges import EntityEdge

from mentorfy.api.schemas import SearchRequest, SearchResult
from mentorfy.db.neo4j import get_graphiti_client


# Set up logger
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api", tags=["knowledge"])

# Global Graphiti client (set by main app)
graphiti_client: Optional[Graphiti] = None


def set_graphiti_client(client: Graphiti):
    """Set the global Graphiti client for this router"""
    global graphiti_client
    graphiti_client = client


# Simple in-memory cache for knowledge graph (60 second TTL)
_graph_cache: Dict[str, tuple[Dict, datetime]] = {}
_cache_ttl = timedelta(seconds=60)


@router.post("/search", response_model=Dict[str, Any])
async def search_knowledge_graph(request: SearchRequest):
    """
    Search the Graphiti knowledge graph

    This endpoint replaces the subprocess call to graphiti_search_service.py
    """
    if not graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti service not available")

    try:
        logger.info(
            f"🔍 Searching knowledge graph: '{request.query}' (limit: {request.limit})"
        )

        # Perform semantic search on the knowledge graph with org filtering
        search_params = {"num_results": request.limit}
        if request.organization_id:
            search_params["group_ids"] = [request.organization_id]

        results: list[EntityEdge] = await graphiti_client.search(
            request.query, **search_params
        )

        # Transform results to API response format
        search_results = []
        for edge in results:
            search_results.append(
                SearchResult(
                    fact=edge.fact,
                    confidence=1.0,  # Graphiti doesn't provide confidence scores directly
                    source="knowledge_graph",
                ).dict()
            )

        return {
            "results": search_results,
            "query": request.query,
            "count": len(search_results),
        }

    except Exception as e:
        logger.error(f"❌ Error searching knowledge graph: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/orgs/{org_id}/knowledge-graph")
async def get_knowledge_graph(org_id: str):
    """
    Get knowledge graph data for 2D visualization

    Returns top 250 most connected nodes for the organization
    Cached for 60 seconds for faster subsequent loads
    """
    logger.info(f"Knowledge graph endpoint hit for org: {org_id}")

    # Check cache
    now = datetime.now(timezone.utc)
    if org_id in _graph_cache:
        data, timestamp = _graph_cache[org_id]
        if now - timestamp < _cache_ttl:
            logger.info(f"Returning cached knowledge graph for org {org_id}")
            return data

    try:
        graphiti_client = get_graphiti_client()
        driver = graphiti_client.client.driver

        # Fixed query: Properly collect nodes first, then find edges between them
        query = """
        MATCH (n)
        WHERE n.group_id = $org_id
        WITH n, COUNT { (n)-[]-() } as degree
        WHERE degree > 0
        ORDER BY degree DESC
        LIMIT 1000

        WITH collect(n) as selected_nodes
        UNWIND selected_nodes as n
        MATCH (n)-[r]->(m)
        WHERE m IN selected_nodes AND m.group_id = $org_id

        RETURN
            [node IN selected_nodes | {
                id: id(node),
                label: substring(COALESCE(node.name, node.content, 'Unknown'), 0, 30),
                type: CASE
                    WHEN labels(node)[0] = 'Entity' THEN 'entity'
                    ELSE 'episode'
                END
            }] as nodes,
            collect(DISTINCT {
                source: id(n),
                target: id(m),
                type: type(r)
            }) as edges
        """

        # Use async session from Graphiti's Neo4j driver
        async with driver.session() as session:
            result = await session.run(query, {"org_id": org_id})
            record = await result.single()

            if not record:
                logger.warning(f"No record returned from Neo4j for org_id: {org_id}")
                return {"nodes": [], "edges": []}

            nodes = record["nodes"]
            edges = record["edges"]

            logger.info(
                f"Knowledge graph for org {org_id}: {len(nodes)} nodes, {len(edges)} edges"
            )

            result_data = {"nodes": nodes, "edges": edges}

            # Store in cache
            _graph_cache[org_id] = (result_data, now)

            return result_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error fetching knowledge graph for org {org_id}: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch knowledge graph: {str(e)}"
        )
