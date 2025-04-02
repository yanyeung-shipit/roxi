from flask import Blueprint, render_template, request, jsonify
from sqlalchemy import func, or_
from models import Document, db

document_routes = Blueprint('document_routes', __name__)

@document_routes.route('/documents')
def document_browser():
    """Render the document browser page"""
    return render_template('document_browser.html')

@document_routes.route('/api/documents')
def list_documents():
    """
    API endpoint to list documents with pagination and filtering
    """
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    tag = request.args.get('tag', None)
    search = request.args.get('search', None)
    
    # Build query
    query = Document.query
    
    # Apply tag filter if provided
    if tag:
        query = query.filter(Document.tags.contains([tag]))
    
    # Apply search filter if provided
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(
            Document.title.ilike(search_term),
            Document.authors.ilike(search_term),
            Document.journal.ilike(search_term),
            Document.doi.ilike(search_term)
        ))
    
    # Order by upload date, newest first
    query = query.order_by(Document.upload_date.desc())
    
    # Paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Format data for response
    documents = []
    for doc in pagination.items:
        documents.append({
            'id': doc.id,
            'title': doc.title or 'Untitled Document',
            'authors': doc.authors,
            'journal': doc.journal,
            'doi': doc.doi,
            'publication_date': doc.publication_date.isoformat() if doc.publication_date else None,
            'upload_date': doc.upload_date.isoformat(),
            'processed': doc.processed,
            'tags': doc.tags or []
        })
    
    return jsonify({
        'documents': documents,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev,
        'next_page': pagination.next_num,
        'prev_page': pagination.prev_num
    })

@document_routes.route('/api/tags')
def get_tags():
    """
    API endpoint to get all unique tags across documents
    """
    # Query for unique tags
    query = db.session.query(func.unnest(Document.tags).label('tag')).distinct()
    tags = [tag[0] for tag in query.all() if tag[0]]
    
    return jsonify({
        'tags': sorted(tags)
    })

@document_routes.route('/api/documents/<int:document_id>')
def get_document(document_id):
    """
    API endpoint to get a single document by ID
    """
    document = Document.query.get_or_404(document_id)
    
    # Format document data
    doc_data = {
        'id': document.id,
        'title': document.title or 'Untitled Document',
        'authors': document.authors,
        'journal': document.journal,
        'doi': document.doi,
        'publication_date': document.publication_date.isoformat() if document.publication_date else None,
        'upload_date': document.upload_date.isoformat(),
        'processed': document.processed,
        'tags': document.tags or [],
        'citation_apa': document.citation_apa
    }
    
    return jsonify(doc_data)