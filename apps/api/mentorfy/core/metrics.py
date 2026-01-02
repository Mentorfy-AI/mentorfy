"""
System metrics collection for monitoring dashboard
"""
import os
import redis
from rq import Queue, Worker
from neo4j import GraphDatabase
from datetime import datetime, timedelta
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def collect_metrics() -> Dict[str, Any]:
    """Collect comprehensive system metrics for monitoring"""
    metrics = {
        "timestamp": datetime.utcnow().isoformat(),
        "queue": {},
        "workers": {},
        "neo4j": {},
        "processing_rate": {},
        "system": {}
    }
    
    try:
        # Redis/Queue metrics
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        r = redis.from_url(redis_url)
        q = Queue("documents", connection=r)
        
        # Basic queue stats
        metrics["queue"] = {
            "pending": len(q),
            "started": q.started_job_registry.count,
            "finished": q.finished_job_registry.count,
            "failed": q.failed_job_registry.count,
            "deferred": q.deferred_job_registry.count,
            "scheduled": q.scheduled_job_registry.count
        }
        
        # Worker metrics
        workers = Worker.all(connection=r)
        active_workers = [w for w in workers if w.get_current_job()]
        idle_workers = [w for w in workers if not w.get_current_job()]
        
        metrics["workers"] = {
            "total": len(workers),
            "active": len(active_workers),
            "idle": len(idle_workers),
            "worker_names": [w.name for w in workers]
        }
        
        # Processing rate calculations
        try:
            # Get finished jobs from the last hour
            finished_registry = q.finished_job_registry
            finished_job_ids = finished_registry.get_job_ids()
            
            recent_jobs = []
            for job_id in finished_job_ids[-100:]:  # Check last 100 jobs
                try:
                    job = q.fetch_job(job_id)
                    if job and job.ended_at and job.ended_at > datetime.utcnow() - timedelta(hours=1):
                        recent_jobs.append(job)
                except:
                    continue
            
            # Calculate rates
            last_hour_count = len(recent_jobs)
            last_minute_jobs = [j for j in recent_jobs 
                              if j.ended_at > datetime.utcnow() - timedelta(minutes=1)]
            
            metrics["processing_rate"] = {
                "last_hour": last_hour_count,
                "last_minute": len(last_minute_jobs),
                "per_minute": round(last_hour_count / 60, 2),
                "per_hour": last_hour_count
            }
            
        except Exception as e:
            logger.warning(f"Could not calculate processing rates: {e}")
            metrics["processing_rate"] = {
                "last_hour": 0,
                "last_minute": 0,
                "per_minute": 0.0,
                "per_hour": 0
            }
        
        # Neo4j connection pool metrics
        try:
            neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
            neo4j_user = os.getenv("NEO4J_USER", "neo4j")
            neo4j_password = os.getenv("NEO4J_PASSWORD", "password")
            
            driver = GraphDatabase.driver(
                neo4j_uri,
                auth=(neo4j_user, neo4j_password),
                max_connection_pool_size=5  # Small pool just for metrics
            )
            
            # Test connection and get basic stats
            with driver.session() as session:
                # Test connectivity
                result = session.run("RETURN 1 as test")
                test_value = result.single()["test"]
                
                # Get database info
                db_info = session.run("CALL db.info()").single()
                
            # Get connection pool stats (approximation)
            metrics["neo4j"] = {
                "status": "connected" if test_value == 1 else "error",
                "database_name": db_info.get("name", "unknown") if db_info else "unknown",
                "pool_size": int(os.getenv("NEO4J_POOL_SIZE", 100)),
                "estimated_connections_in_use": len(active_workers),  # Rough estimate
                "max_connections": int(os.getenv("NEO4J_POOL_SIZE", 100))
            }
            
            driver.close()
            
        except Exception as e:
            logger.warning(f"Could not get Neo4j metrics: {e}")
            metrics["neo4j"] = {
                "status": "unavailable",
                "error": str(e)
            }
        
        # System-level metrics
        metrics["system"] = {
            "max_retries": int(os.getenv("MAX_RETRIES", 3)),
            "log_level": os.getenv("LOG_LEVEL", "INFO"),
            "environment": "development" if os.getenv("LOG_LEVEL") == "DEBUG" else "production"
        }
        
        # Calculate health scores
        queue_health = "healthy" if metrics["queue"]["failed"] < 5 else "degraded"
        worker_health = "healthy" if metrics["workers"]["active"] > 0 else "idle"
        neo4j_health = metrics["neo4j"]["status"]
        
        metrics["health"] = {
            "overall": "healthy" if all([
                queue_health == "healthy",
                neo4j_health == "connected",
                metrics["queue"]["pending"] < 100
            ]) else "degraded",
            "queue": queue_health,
            "workers": worker_health,
            "neo4j": neo4j_health
        }
        
    except Exception as e:
        logger.error(f"Error collecting metrics: {str(e)}")
        metrics["error"] = str(e)
    
    return metrics

def get_simple_stats() -> Dict[str, int]:
    """Get simplified stats for quick checks"""
    try:
        metrics = collect_metrics()
        return {
            "queue_pending": metrics["queue"].get("pending", 0),
            "queue_failed": metrics["queue"].get("failed", 0),
            "workers_active": metrics["workers"].get("active", 0),
            "workers_total": metrics["workers"].get("total", 0),
            "processing_rate": metrics["processing_rate"].get("per_minute", 0)
        }
    except Exception as e:
        logger.error(f"Error getting simple stats: {e}")
        return {
            "queue_pending": -1,
            "queue_failed": -1,
            "workers_active": -1,
            "workers_total": -1,
            "processing_rate": -1
        }