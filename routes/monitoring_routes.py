from flask import Blueprint, render_template, jsonify, request, Response, current_app
from datetime import datetime, timedelta
import sqlalchemy as sa
import os
import logging
import redis
import json
import tempfile

from app import db, app
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
    # Use raw SQL queries with error handling for more reliable counts in production
    try:
        # Count documents
        total_documents_result = db.session.execute(sa.text("SELECT COUNT(*) FROM document")).scalar()
        total_documents = total_documents_result if total_documents_result is not None else 0
        
        processed_documents_result = db.session.execute(sa.text("SELECT COUNT(*) FROM document WHERE processed = true")).scalar()
        processed_documents = processed_documents_result if processed_documents_result is not None else 0
        
        processing_percentage = (processed_documents / total_documents * 100) if total_documents > 0 else 0
        
        # Count chunks and embeddings
        total_chunks_result = db.session.execute(sa.text("SELECT COUNT(*) FROM text_chunk")).scalar()
        total_chunks = total_chunks_result if total_chunks_result is not None else 0
        
        total_embeddings_result = db.session.execute(sa.text("SELECT COUNT(*) FROM vector_embedding")).scalar()
        total_embeddings = total_embeddings_result if total_embeddings_result is not None else 0
        
        embeddings_percentage = (total_embeddings / total_chunks * 100) if total_chunks > 0 else 0
        
        # Log the counts for debugging
        logger = logging.getLogger(__name__)
        logger.info(f"Stats: docs={total_documents}, processed={processed_documents}, chunks={total_chunks}, embeddings={total_embeddings}")
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting system stats: {str(e)}")
        total_documents = Document.query.count()
        processed_documents = Document.query.filter_by(processed=True).count()
        processing_percentage = (processed_documents / total_documents * 100) if total_documents > 0 else 0
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
    
@monitoring_routes.route('/health-check')
def health_check():
    """
    API endpoint to check the health of the application
    Verifies database and Redis connectivity, file system access, etc.
    """
    status = {
        'success': True,
        'timestamp': datetime.utcnow().isoformat(),
        'components': {}
    }
    
    # Check database connectivity
    try:
        result = db.session.execute(sa.text("SELECT 1")).scalar()
        status['components']['database'] = {
            'status': 'ok' if result == 1 else 'error',
            'message': 'Database connection successful'
        }
    except Exception as e:
        status['success'] = False
        status['components']['database'] = {
            'status': 'error',
            'message': f"Database connection failed: {str(e)}"
        }
        
    # Check Redis connectivity
    try:
        redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url)
        test_key = f'roxi_health_check_{datetime.utcnow().timestamp()}'
        r.set(test_key, 'ok', ex=60)  # expires in 60s
        redis_value = r.get(test_key)
        status['components']['redis'] = {
            'status': 'ok' if redis_value == b'ok' else 'error',
            'message': f'Redis connection successful at {redis_url}',
            'url': redis_url
        }
    except Exception as e:
        status['success'] = False
        status['components']['redis'] = {
            'status': 'error',
            'message': f"Redis connection failed: {str(e)}",
            'url': os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
        }
        
    # Check file system access
    try:
        # Try to get upload folder from app config
        with app.app_context():
            upload_folder = current_app.config.get("UPLOAD_FOLDER")
            if not upload_folder:
                upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
        
        # Check if folder exists and is writable
        folder_exists = os.path.exists(upload_folder)
        if not folder_exists:
            try:
                os.makedirs(upload_folder, exist_ok=True)
                folder_exists = True
            except Exception as mkdir_err:
                status['components']['filesystem'] = {
                    'status': 'error',
                    'message': f"Cannot create upload folder: {str(mkdir_err)}",
                    'path': upload_folder
                }
                status['success'] = False
        
        if folder_exists:
            # Try to write a temporary file
            test_file_path = os.path.join(upload_folder, ".health_check_test")
            with open(test_file_path, 'w') as f:
                f.write("test")
            os.remove(test_file_path)
            status['components']['filesystem'] = {
                'status': 'ok',
                'message': 'File system access successful',
                'path': upload_folder
            }
    except Exception as e:
        status['success'] = False
        status['components']['filesystem'] = {
            'status': 'error',
            'message': f"File system access failed: {str(e)}",
            'path': upload_folder if 'upload_folder' in locals() else 'unknown'
        }
        
    # Check temp directory access
    try:
        temp_dir = tempfile.gettempdir()
        test_file_path = os.path.join(temp_dir, ".roxi_health_check_test")
        with open(test_file_path, 'w') as f:
            f.write("test")
        os.remove(test_file_path)
        status['components']['temp_directory'] = {
            'status': 'ok',
            'message': 'Temp directory access successful',
            'path': temp_dir
        }
    except Exception as e:
        status['success'] = False
        status['components']['temp_directory'] = {
            'status': 'error',
            'message': f"Temp directory access failed: {str(e)}",
            'path': tempfile.gettempdir() if 'tempfile' in globals() else 'unknown'
        }
        
    # Check system metrics
    try:
        import platform
        import psutil
        status['components']['system'] = {
            'status': 'ok',
            'message': 'System metrics available',
            'platform': platform.platform(),
            'python_version': platform.python_version(),
            'cpu_count': psutil.cpu_count(),
            'memory_percent': psutil.virtual_memory().percent
        }
    except Exception as e:
        status['components']['system'] = {
            'status': 'warning',
            'message': f"System metrics unavailable: {str(e)}"
        }
        
    return jsonify(status)

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