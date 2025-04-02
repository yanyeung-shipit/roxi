from flask import Blueprint, render_template, jsonify
from models import Document, ProcessingQueue, SystemMetrics, TextChunk, VectorEmbedding, db
from sqlalchemy import func
import datetime

monitoring_routes = Blueprint('monitoring_routes', __name__)

@monitoring_routes.route('/monitoring')
def monitoring_dashboard():
    """Render the monitoring dashboard page"""
    return render_template('monitoring.html')

@monitoring_routes.route('/monitoring/current')
def get_current_metrics():
    """
    API endpoint to get current system metrics
    """
    # Get the most recent system metrics
    metrics = SystemMetrics.query.order_by(SystemMetrics.timestamp.desc()).first()
    
    if not metrics:
        return jsonify({
            'cpu_usage': 0,
            'memory_usage': 0,
            'chunks_processed': 0,
            'chunks_pending': 0,
            'timestamp': datetime.datetime.utcnow().isoformat()
        })
    
    return jsonify({
        'cpu_usage': metrics.cpu_usage,
        'memory_usage': metrics.memory_usage,
        'chunks_processed': metrics.chunks_processed,
        'chunks_pending': metrics.chunks_pending,
        'timestamp': metrics.timestamp.isoformat()
    })

@monitoring_routes.route('/monitoring/history')
def get_metrics_history():
    """
    API endpoint to get historical system metrics
    """
    # Get metrics from the last 24 hours
    since = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    metrics = SystemMetrics.query.filter(SystemMetrics.timestamp >= since).order_by(SystemMetrics.timestamp).all()
    
    history = []
    for metric in metrics:
        history.append({
            'cpu_usage': metric.cpu_usage,
            'memory_usage': metric.memory_usage,
            'chunks_processed': metric.chunks_processed,
            'chunks_pending': metric.chunks_pending,
            'timestamp': metric.timestamp.isoformat()
        })
    
    return jsonify(history)

@monitoring_routes.route('/monitoring/queue')
def get_processing_queue():
    """
    API endpoint to get current processing queue status
    """
    # Count documents in different states
    pending = ProcessingQueue.query.filter_by(status='pending').count()
    processing = ProcessingQueue.query.filter_by(status='processing').count()
    completed = ProcessingQueue.query.filter_by(status='completed').count()
    failed = ProcessingQueue.query.filter_by(status='failed').count()
    
    # Get the most recent queue entries
    recent_queue = ProcessingQueue.query.order_by(ProcessingQueue.queued_at.desc()).limit(10).all()
    
    queue_entries = []
    for entry in recent_queue:
        document = Document.query.get(entry.document_id)
        title = document.title if document else 'Unknown Document'
        
        queue_entries.append({
            'id': entry.id,
            'document_id': entry.document_id,
            'document_title': title,
            'status': entry.status,
            'queued_at': entry.queued_at.isoformat(),
            'started_at': entry.started_at.isoformat() if entry.started_at else None,
            'completed_at': entry.completed_at.isoformat() if entry.completed_at else None,
            'error_message': entry.error_message
        })
    
    return jsonify({
        'pending': pending,
        'processing': processing,
        'completed': completed,
        'failed': failed,
        'total': pending + processing + completed + failed,
        'recent_queue': queue_entries
    })

@monitoring_routes.route('/monitoring/stats')
def get_system_stats():
    """
    API endpoint to get overall system statistics
    """
    # Count total documents
    total_documents = Document.query.count()
    processed_documents = Document.query.filter_by(processed=True).count()
    
    # Count chunks and embeddings
    total_chunks = TextChunk.query.count()
    total_embeddings = VectorEmbedding.query.count()
    
    # Avg processing time for completed documents
    avg_processing_time = db.session.query(
        func.avg(ProcessingQueue.completed_at - ProcessingQueue.started_at)
    ).filter(
        ProcessingQueue.status == 'completed',
        ProcessingQueue.started_at != None,
        ProcessingQueue.completed_at != None
    ).scalar()
    
    # Convert timedelta to seconds if not None
    avg_time_seconds = None
    if avg_processing_time:
        avg_time_seconds = avg_processing_time.total_seconds()
    
    return jsonify({
        'total_documents': total_documents,
        'processed_documents': processed_documents,
        'processing_percentage': round((processed_documents / total_documents) * 100, 1) if total_documents > 0 else 0,
        'total_chunks': total_chunks,
        'total_embeddings': total_embeddings,
        'embeddings_percentage': round((total_embeddings / total_chunks) * 100, 1) if total_chunks > 0 else 0,
        'avg_processing_time_seconds': avg_time_seconds
    })