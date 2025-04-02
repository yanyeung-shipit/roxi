from flask import Blueprint, render_template, jsonify, request
import sqlalchemy as sa
from app import db
from models import Document, ProcessingQueue

# Create blueprint
document_routes = Blueprint('documents', __name__, url_prefix='/documents')

@document_routes.route('/')
def document_browser():
    """Render the document browser page"""
    return render_template('document_browser.html')

@document_routes.route('/api/documents')
def list_documents():
    """
    API endpoint to list documents with pagination and filtering
    """
    # Get pagination parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    # Get filter parameters
    search = request.args.get('search', '')
    tag = request.args.get('tag', '')
    
    # Build the query
    query = Document.query
    
    # Apply filters if provided
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            sa.or_(
                Document.title.ilike(search_term),
                Document.authors.ilike(search_term),
                Document.journal.ilike(search_term),
                Document.doi.ilike(search_term)
            )
        )
    
    if tag:
        query = query.filter(Document.tags.contains([tag]))
    
    # Order by upload date (newest first)
    query = query.order_by(Document.upload_date.desc())
    
    # Paginate results
    paginated = query.paginate(page=page, per_page=per_page)
    
    # Format the response
    documents = []
    for doc in paginated.items:
        documents.append({
            'id': doc.id,
            'title': doc.title or 'Untitled Document',
            'authors': doc.authors,
            'journal': doc.journal,
            'doi': doc.doi,
            'publication_date': doc.publication_date.isoformat() if doc.publication_date else None,
            'upload_date': doc.upload_date.isoformat(),
            'processed': doc.processed,
            'tags': doc.tags
        })
    
    return jsonify({
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page,
        'per_page': per_page,
        'has_next': paginated.has_next,
        'has_prev': paginated.has_prev,
        'documents': documents
    })

@document_routes.route('/api/tags')
def get_tags():
    """
    API endpoint to get all unique tags across documents
    """
    # This is a more complex query for Postgres to get all unique tags
    # We're unnesting the tags array and then selecting distinct values
    try:
        from sqlalchemy.sql.expression import func
        
        # Execute raw SQL for this complex operation
        result = db.session.execute(
            sa.text("""
                SELECT DISTINCT unnest(tags) as tag
                FROM document
                WHERE tags IS NOT NULL
                ORDER BY tag
            """)
        )
        
        tags = [row[0] for row in result]
        
        return jsonify({
            'success': True,
            'tags': tags
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@document_routes.route('/api/documents/<int:document_id>')
def get_document(document_id):
    """
    API endpoint to get a single document by ID
    """
    document = Document.query.get_or_404(document_id)
    
    # Get processing status
    processing_status = None
    queue_entry = ProcessingQueue.query.filter_by(document_id=document_id).first()
    if queue_entry:
        processing_status = queue_entry.status
    
    # Format the response
    doc_data = {
        'id': document.id,
        'title': document.title or 'Untitled Document',
        'authors': document.authors,
        'journal': document.journal,
        'doi': document.doi,
        'publication_date': document.publication_date.isoformat() if document.publication_date else None,
        'upload_date': document.upload_date.isoformat(),
        'processed': document.processed,
        'tags': document.tags,
        'citation_apa': document.citation_apa,
        'processing_status': processing_status
    }
    
    return jsonify(doc_data)