from flask import Blueprint, render_template, jsonify, request, Response
from datetime import datetime, timedelta
import sqlalchemy as sa
import os

from app import db
from models import SystemMetrics, ProcessingQueue, Document, TextChunk, VectorEmbedding
from utils.embeddings import regenerate_all_embeddings

# Create blueprint
monitoring_routes = Blueprint('monitoring', __name__, url_prefix='/monitoring')

# Protect all monitoring routes with authentication
@monitoring_routes.before_request
def protect_all_monitoring_routes():
    """Apply authentication to all routes in this blueprint"""
    # Skip the check for OPTIONS requests (CORS preflight)
    if request.method == 'OPTIONS':
        return None
        
    # Get authentication credentials from environment variables
    admin_user = os.environ.get("ADMIN_USER", "admin")
    admin_pass = os.environ.get("ADMIN_PASS", "roxi_admin")
    
    # Check if authentication is provided and valid
    auth = request.authorization
    if not auth or auth.username != admin_user or auth.password != admin_pass:
        return Response(
            'Authentication required to access this area',
            401,
            {'WWW-Authenticate': 'Basic realm="ROXI Admin Area"'}
        )

@monitoring_routes.route('/')
def monitoring_dashboard():
    """Render the monitoring dashboard page"""
    return render_template('monitoring.html')

@monitoring_routes.route('/current')
def get_current_metrics():
    """
    API endpoint to get current system metrics
    """
    # Get the most recent system metrics
    metrics = SystemMetrics.query.order_by(SystemMetrics.timestamp.desc()).first()
    
    if not metrics:
        return jsonify({
            'cpu_usage': 0.0,
            'memory_usage': 0.0,
            'chunks_processed': 0,
            'chunks_pending': 0,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    return jsonify({
        'cpu_usage': metrics.cpu_usage,
        'memory_usage': metrics.memory_usage,
        'chunks_processed': metrics.chunks_processed,
        'chunks_pending': metrics.chunks_pending,
        'timestamp': metrics.timestamp.isoformat()
    })

@monitoring_routes.route('/history')
def get_metrics_history():
    """
    API endpoint to get historical system metrics
    """
    # Get metrics from the last 24 hours, with a cap on the number of records
    cutoff_time = datetime.utcnow() - timedelta(hours=24)
    metrics = SystemMetrics.query.filter(SystemMetrics.timestamp >= cutoff_time).order_by(SystemMetrics.timestamp).all()
    
    # Limit to at most 100 data points
    if len(metrics) > 100:
        step = len(metrics) // 100
        metrics = metrics[::step]
    
    results = []
    for metric in metrics:
        results.append({
            'cpu_usage': metric.cpu_usage,
            'memory_usage': metric.memory_usage,
            'chunks_processed': metric.chunks_processed,
            'chunks_pending': metric.chunks_pending,
            'timestamp': metric.timestamp.isoformat()
        })
    
    return jsonify(results)

@monitoring_routes.route('/queue')
def get_processing_queue():
    """
    API endpoint to get current processing queue status
    """
    # Count by status
    stats = db.session.execute(
        sa.select(
            ProcessingQueue.status,
            sa.func.count().label('count')
        ).group_by(ProcessingQueue.status)
    ).all()
    
    # Prepare stats
    total = 0
    pending = 0
    processing = 0
    completed = 0
    failed = 0
    
    for status, count in stats:
        total += count
        if status == 'pending':
            pending = count
        elif status == 'processing':
            processing = count
        elif status == 'completed':
            completed = count
        elif status == 'failed':
            failed = count
    
    # Get recent entries (10 most recent)
    recent_entries = []
    queue_entries = ProcessingQueue.query.order_by(ProcessingQueue.queued_at.desc()).limit(10).all()
    
    for entry in queue_entries:
        document = Document.query.get(entry.document_id)
        if document:
            recent_entries.append({
                'id': entry.id,
                'document_id': entry.document_id,
                'document_title': document.title or 'Untitled Document',
                'status': entry.status,
                'queued_at': entry.queued_at.isoformat() if entry.queued_at else None,
                'started_at': entry.started_at.isoformat() if entry.started_at else None,
                'completed_at': entry.completed_at.isoformat() if entry.completed_at else None,
                'error_message': entry.error_message
            })
    
    return jsonify({
        'total': total,
        'pending': pending,
        'processing': processing,
        'completed': completed,
        'failed': failed,
        'recent_queue': recent_entries
    })

@monitoring_routes.route('/stats')
def get_system_stats():
    """
    API endpoint to get overall system statistics
    """
    # Count documents
    total_documents = Document.query.count()
    processed_documents = Document.query.filter_by(processed=True).count()
    processing_percentage = (processed_documents / total_documents * 100) if total_documents > 0 else 0
    
    # Count chunks and embeddings
    total_chunks = TextChunk.query.count()
    total_embeddings = VectorEmbedding.query.count()
    embeddings_percentage = (total_embeddings / total_chunks * 100) if total_chunks > 0 else 0
    
    # Calculate average processing time
    avg_processing_time = None
    if processed_documents > 0:
        completed_queue_entries = ProcessingQueue.query.filter_by(status='completed').all()
        if completed_queue_entries:
            total_time = 0
            count = 0
            for entry in completed_queue_entries:
                if entry.started_at and entry.completed_at:
                    processing_time = (entry.completed_at - entry.started_at).total_seconds()
                    total_time += processing_time
                    count += 1
            
            if count > 0:
                avg_processing_time = total_time / count
    
    return jsonify({
        'total_documents': total_documents,
        'processed_documents': processed_documents,
        'processing_percentage': round(processing_percentage, 1),
        'total_chunks': total_chunks,
        'total_embeddings': total_embeddings,
        'embeddings_percentage': round(embeddings_percentage, 1),
        'avg_processing_time_seconds': avg_processing_time
    })
    
@monitoring_routes.route('/regenerate-embeddings', methods=['POST'])
def regenerate_embeddings():
    """
    Admin endpoint to regenerate all embeddings using the improved algorithm
    
    This will:
    1. Delete all existing embeddings
    2. Regenerate embeddings for all text chunks using the improved algorithm
    3. Return statistics about the process
    """
    try:
        # Regenerate embeddings
        results = regenerate_all_embeddings()
        
        return jsonify({
            'success': True,
            'message': f"Successfully regenerated {results.get('success', 0)} embeddings",
            'results': results
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500