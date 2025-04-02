import os
import uuid
import datetime
from flask import Blueprint, render_template, request, jsonify, current_app
from models import Document, ProcessingQueue, QueryHistory, TextChunk, VectorEmbedding, db
from utils.pdf_processor import save_uploaded_pdf
from utils.embeddings import search_similar_chunks
from utils.citation_generator import format_citation_for_response
from tasks import process_document

main_routes = Blueprint('main_routes', __name__)

@main_routes.route('/')
def index():
    """Render the main page of the application"""
    return render_template('index.html')

@main_routes.route('/upload', methods=['POST'])
def upload_documents():
    """
    Handle document uploads, save them, and queue for processing
    """
    if 'files[]' not in request.files:
        return jsonify({'success': False, 'error': 'No files uploaded'})
    
    files = request.files.getlist('files[]')
    
    if not files or len(files) == 0 or not files[0].filename:
        return jsonify({'success': False, 'error': 'No files selected'})
    
    if len(files) > 50:
        return jsonify({'success': False, 'error': 'Maximum 50 files allowed per upload'})
    
    # Validate file types
    errors = []
    success_count = 0
    
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            errors.append(f"{file.filename}: Not a PDF file")
            continue
        
        try:
            # Save PDF to a temporary location
            pdf_path = save_uploaded_pdf(file)
            
            # Create document entry
            document = Document(
                filename=pdf_path,
                upload_date=datetime.datetime.utcnow(),
                title=os.path.splitext(file.filename)[0],  # Use filename as initial title
                processed=False
            )
            db.session.add(document)
            db.session.flush()  # Get document ID without committing
            
            # Add to processing queue
            queue_entry = ProcessingQueue(
                document_id=document.id,
                status='pending'
            )
            db.session.add(queue_entry)
            db.session.commit()
            
            # Queue for processing in Celery
            process_document.delay(document.id)
            
            success_count += 1
            
        except Exception as e:
            db.session.rollback()
            errors.append(f"{file.filename}: {str(e)}")
    
    if success_count > 0:
        return jsonify({
            'success': True,
            'message': f'{success_count} document(s) uploaded and queued for processing',
            'errors': errors if errors else None
        })
    else:
        return jsonify({
            'success': False,
            'error': 'All uploads failed',
            'errors': errors
        })

@main_routes.route('/query', methods=['POST'])
def query():
    """
    Process a user query and return results with citations
    """
    data = request.json
    if not data or 'query' not in data:
        return jsonify({'success': False, 'error': 'No query provided'})
    
    query_text = data.get('query')
    conversation_id = data.get('conversation_id')
    
    # Generate a conversation ID if not provided
    if not conversation_id:
        conversation_id = str(uuid.uuid4())
    
    # Get similar text chunks
    similar_chunks = search_similar_chunks(query_text, top_k=5)
    
    if not similar_chunks:
        response = "I couldn't find relevant information in the uploaded documents. Please try a different query or upload more documents."
        # Save to query history
        query_history = QueryHistory(
            query_text=query_text,
            response=response,
            citations=None,
            conversation_id=conversation_id
        )
        db.session.add(query_history)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'response': response,
            'citations': [],
            'conversation_id': conversation_id
        })
    
    # Get the full text of the chunks and format response
    chunks_text = []
    citations = []
    
    for chunk_id, similarity in similar_chunks:
        chunk = TextChunk.query.get(chunk_id)
        if not chunk:
            continue
            
        document = Document.query.get(chunk.document_id)
        if not document:
            continue
            
        chunks_text.append(chunk.text)
        
        # Format citation
        citation = format_citation_for_response(
            document.citation_apa or f"{document.title or 'Unknown document'}",
            document.id,
            chunk_id
        )
        
        # Add document metadata
        citation['title'] = document.title
        citation['authors'] = document.authors
        citation['doi'] = document.doi
        citation['journal'] = document.journal
        
        # Add a snippet from the chunk
        snippet = chunk.text[:100] + '...' if len(chunk.text) > 100 else chunk.text
        citation['snippet'] = snippet
        
        citations.append(citation)
    
    # In a real implementation, this would use an LLM to generate a response based on the chunks
    # For simplicity, we'll just concatenate the chunks
    response = "Here's what I found in the documents:\n\n"
    response += "\n\n".join([f"- {text[:200]}..." for text in chunks_text])
    
    # Save to query history
    query_history = QueryHistory(
        query_text=query_text,
        response=response,
        citations=citations,
        conversation_id=conversation_id
    )
    db.session.add(query_history)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'response': response,
        'citations': citations,
        'conversation_id': conversation_id
    })

@main_routes.route('/conversation/<conversation_id>')
def get_conversation(conversation_id):
    """
    Get the history of a conversation
    """
    query_history = QueryHistory.query.filter_by(conversation_id=conversation_id).order_by(QueryHistory.timestamp).all()
    
    conversation = []
    for query in query_history:
        # Add user query
        conversation.append({
            'role': 'user',
            'content': query.query_text,
            'timestamp': query.timestamp.isoformat()
        })
        
        # Add assistant response
        conversation.append({
            'role': 'assistant',
            'content': query.response,
            'citations': query.citations,
            'timestamp': query.timestamp.isoformat()
        })
    
    return jsonify(conversation)