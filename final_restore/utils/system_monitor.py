import logging
import psutil
from datetime import datetime, timedelta

from app import db
from models import SystemMetrics, TextChunk, VectorEmbedding, ProcessingQueue

logger = logging.getLogger(__name__)

def get_system_metrics():
    """
    Get current system metrics (CPU, memory usage, chunks processed/pending)
    
    Returns:
        dict: Dictionary containing system metrics
    """
    try:
        # Get CPU and memory usage
        cpu_usage = psutil.cpu_percent(interval=0.5)
        memory_usage = psutil.virtual_memory().percent
        
        # Get chunk processing stats
        chunks_processed = VectorEmbedding.query.count()
        chunks_pending = TextChunk.query.count() - chunks_processed
        
        return {
            'cpu_usage': cpu_usage,
            'memory_usage': memory_usage,
            'chunks_processed': chunks_processed,
            'chunks_pending': chunks_pending,
            'timestamp': datetime.utcnow()
        }
    except Exception as e:
        logger.exception(f"Error getting system metrics: {str(e)}")
        return {
            'cpu_usage': 0.0,
            'memory_usage': 0.0,
            'chunks_processed': 0,
            'chunks_pending': 0,
            'timestamp': datetime.utcnow()
        }

def update_system_metrics():
    """
    Update system metrics in the database
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Get current metrics
        metrics = get_system_metrics()
        
        # Create new metrics record
        db_metrics = SystemMetrics(
            cpu_usage=metrics['cpu_usage'],
            memory_usage=metrics['memory_usage'],
            chunks_processed=metrics['chunks_processed'],
            chunks_pending=metrics['chunks_pending'],
            timestamp=metrics['timestamp']
        )
        
        # Add to database and commit
        db.session.add(db_metrics)
        db.session.commit()
        
        # Clean up old metrics (keep only last 24 hours)
        cleanup_old_metrics()
        
        return True
    except Exception as e:
        logger.exception(f"Error updating system metrics: {str(e)}")
        db.session.rollback()
        return False

def cleanup_old_metrics():
    """Remove old system metrics to prevent database growth"""
    try:
        # Keep only the last 24 hours of metrics
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        
        # Delete old metrics
        result = SystemMetrics.query.filter(SystemMetrics.timestamp < cutoff_time).delete()
        db.session.commit()
        
        if result > 0:
            logger.info(f"Cleaned up {result} old system metrics records")
            
    except Exception as e:
        logger.exception(f"Error cleaning up old metrics: {str(e)}")
        db.session.rollback()