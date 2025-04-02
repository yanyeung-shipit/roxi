import psutil
import logging
import datetime
from models import SystemMetrics, ProcessingQueue, TextChunk, VectorEmbedding, db

logger = logging.getLogger(__name__)

def get_system_metrics():
    """
    Get current system metrics (CPU, memory usage, chunks processed/pending)
    
    Returns:
        dict: Dictionary containing system metrics
    """
    try:
        # CPU and memory usage
        cpu_usage = psutil.cpu_percent(interval=0.1)
        memory_usage = psutil.virtual_memory().percent
        
        # Count processed and pending chunks
        chunks_processed = db.session.query(VectorEmbedding).count()
        
        # Calculate number of chunks without embeddings
        total_chunks = db.session.query(TextChunk).count()
        chunks_pending = total_chunks - chunks_processed
        
        return {
            'cpu_usage': cpu_usage,
            'memory_usage': memory_usage,
            'chunks_processed': chunks_processed,
            'chunks_pending': chunks_pending,
            'timestamp': datetime.datetime.utcnow()
        }
    
    except Exception as e:
        logger.error(f"Error getting system metrics: {str(e)}")
        return {
            'cpu_usage': 0,
            'memory_usage': 0,
            'chunks_processed': 0,
            'chunks_pending': 0,
            'timestamp': datetime.datetime.utcnow()
        }

def update_system_metrics():
    """
    Update system metrics in the database
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        metrics = get_system_metrics()
        
        system_metrics = SystemMetrics(
            cpu_usage=metrics['cpu_usage'],
            memory_usage=metrics['memory_usage'],
            chunks_processed=metrics['chunks_processed'],
            chunks_pending=metrics['chunks_pending'],
            timestamp=metrics['timestamp']
        )
        
        db.session.add(system_metrics)
        db.session.commit()
        
        # Clean up old metrics
        cleanup_old_metrics()
        
        return True
    
    except Exception as e:
        logger.error(f"Error updating system metrics: {str(e)}")
        return False

def cleanup_old_metrics():
    """Remove old system metrics to prevent database growth"""
    try:
        # Keep metrics from the last 7 days
        cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=7)
        
        # Delete old metrics
        deleted = db.session.query(SystemMetrics).filter(
            SystemMetrics.timestamp < cutoff_date
        ).delete()
        
        db.session.commit()
        
        if deleted:
            logger.info(f"Cleaned up {deleted} old system metrics")
        
        return True
    
    except Exception as e:
        logger.error(f"Error cleaning up old metrics: {str(e)}")
        db.session.rollback()
        return False