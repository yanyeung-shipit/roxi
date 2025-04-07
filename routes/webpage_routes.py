import os
import logging
from flask import Blueprint, render_template, request, jsonify
from werkzeug.utils import secure_filename

from app import db
from models import Webpage, WebpageProcessingQueue, Collection
from utils.webpage_processor import crawl_webpage, validate_url, process_webpage_job

logger = logging.getLogger(__name__)

# Create blueprint
webpage_routes = Blueprint('webpages', __name__)

@webpage_routes.route('/webpages')
def webpage_browser():
    """Render the webpage browser page"""
    return render_template('webpage_browser.html')

@webpage_routes.route('/api/webpages', methods=['GET'])
def list_webpages():
    """
    API endpoint to list webpages with pagination and filtering
    """
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 25, type=int)
    collection_id = request.args.get('collection_id', '')
    search_term = request.args.get('search', '')
    
    # Build query
    query = Webpage.query
    
    # Apply collection filter if provided
    if collection_id:
        try:
            collection_id = int(collection_id)
            query = query.filter(Webpage.collection_id == collection_id)
        except ValueError:
            # Invalid collection ID, ignore filter
            pass
    
    # Apply search filter if provided
    if search_term:
        search_pattern = f"%{search_term}%"
        query = query.filter(
            (Webpage.title.ilike(search_pattern)) | 
            (Webpage.url.ilike(search_pattern))
        )
    
    # Order by most recent first
    query = query.order_by(Webpage.crawl_date.desc())
    
    # Paginate results
    paginated = query.paginate(page=page, per_page=per_page)
    
    # Format results
    webpages = []
    for webpage in paginated.items:
        webpages.append({
            'id': webpage.id,
            'url': webpage.url,
            'title': webpage.title or 'Untitled Webpage',
            'crawl_date': webpage.crawl_date.isoformat() if webpage.crawl_date else None,
            'last_updated': webpage.last_updated.isoformat() if webpage.last_updated else None,
            'processed': webpage.processed,
            'collection_id': webpage.collection_id,
            'collection_name': webpage.collection.name if webpage.collection else None
        })
    
    # Get processing status of webpages
    processing_status = {}
    webpage_ids = [wp['id'] for wp in webpages]
    if webpage_ids:
        queue_entries = WebpageProcessingQueue.query.filter(
            WebpageProcessingQueue.webpage_id.in_(webpage_ids)
        ).all()
        
        for entry in queue_entries:
            processing_status[entry.webpage_id] = {
                'status': entry.status,
                'error': entry.error_message if entry.status == 'failed' else None
            }
    
    # Add processing status to webpages
    for webpage in webpages:
        webpage['processing_status'] = processing_status.get(
            webpage['id'], {'status': 'unknown', 'error': None}
        )
    
    return jsonify({
        'webpages': webpages,
        'total': paginated.total,
        'pages': paginated.pages,
        'page': page,
        'per_page': per_page
    })

@webpage_routes.route('/api/webpage/<int:webpage_id>', methods=['GET'])
def get_webpage(webpage_id):
    """
    API endpoint to get a single webpage by ID
    """
    webpage = Webpage.query.get(webpage_id)
    
    if not webpage:
        return jsonify({
            'success': False,
            'error': f'Webpage with ID {webpage_id} not found'
        }), 404
    
    # Get processing status
    queue_entry = WebpageProcessingQueue.query.filter_by(webpage_id=webpage_id).first()
    processing_status = {
        'status': queue_entry.status if queue_entry else 'unknown',
        'error': queue_entry.error_message if queue_entry and queue_entry.status == 'failed' else None
    }
    
    # Format response
    result = {
        'id': webpage.id,
        'url': webpage.url,
        'title': webpage.title or 'Untitled Webpage',
        'crawl_date': webpage.crawl_date.isoformat() if webpage.crawl_date else None,
        'last_updated': webpage.last_updated.isoformat() if webpage.last_updated else None,
        'processed': webpage.processed,
        'collection_id': webpage.collection_id,
        'collection_name': webpage.collection.name if webpage.collection else None,
        'processing_status': processing_status,
    }
    
    return jsonify({
        'success': True,
        'webpage': result
    })

@webpage_routes.route('/api/webpages', methods=['POST'])
def add_webpage():
    """
    API endpoint to add a new webpage for processing
    """
    data = request.json
    
    if not data or 'url' not in data:
        return jsonify({
            'success': False,
            'error': 'URL is required'
        }), 400
    
    url = data.get('url', '').strip()
    collection_id = data.get('collection_id')
    
    if not url:
        return jsonify({
            'success': False,
            'error': 'URL is required'
        }), 400
    
    # Validate collection ID if provided
    if collection_id:
        try:
            collection_id = int(collection_id)
            collection = Collection.query.get(collection_id)
            if not collection:
                collection_id = None
        except (ValueError, TypeError):
            collection_id = None
    
    # Crawl the webpage
    success, message, webpage_id = crawl_webpage(url, collection_id)
    
    if success:
        return jsonify({
            'success': True,
            'message': message,
            'webpage_id': webpage_id
        })
    else:
        return jsonify({
            'success': False,
            'error': message,
            'webpage_id': webpage_id
        }), 400

@webpage_routes.route('/api/webpage/<int:webpage_id>', methods=['DELETE'])
def delete_webpage(webpage_id):
    """
    API endpoint to delete a webpage
    """
    webpage = Webpage.query.get(webpage_id)
    
    if not webpage:
        return jsonify({
            'success': False,
            'error': f'Webpage with ID {webpage_id} not found'
        }), 404
    
    try:
        # Delete queue entry if exists
        queue_entry = WebpageProcessingQueue.query.filter_by(webpage_id=webpage_id).first()
        if queue_entry:
            db.session.delete(queue_entry)
        
        # Delete any chunks and their embeddings
        from models import TextChunk, VectorEmbedding
        chunks = TextChunk.query.filter_by(webpage_id=webpage_id).all()
        for chunk in chunks:
            # Delete embedding if exists
            embedding = VectorEmbedding.query.filter_by(chunk_id=chunk.id).first()
            if embedding:
                db.session.delete(embedding)
            
            # Delete the chunk
            db.session.delete(chunk)
        
        # Delete the webpage
        db.session.delete(webpage)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Webpage {webpage_id} deleted successfully'
        })
    
    except Exception as e:
        logger.exception(f"Error deleting webpage {webpage_id}: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'Error deleting webpage: {str(e)}'
        }), 500

@webpage_routes.route('/api/webpage/<int:webpage_id>/reprocess', methods=['POST'])
def reprocess_webpage(webpage_id):
    """
    API endpoint to reprocess a webpage
    """
    webpage = Webpage.query.get(webpage_id)
    
    if not webpage:
        return jsonify({
            'success': False,
            'error': f'Webpage with ID {webpage_id} not found'
        }), 404
    
    try:
        # Check if there's an existing queue entry
        queue_entry = WebpageProcessingQueue.query.filter_by(webpage_id=webpage_id).first()
        
        if queue_entry and queue_entry.status in ('pending', 'processing'):
            return jsonify({
                'success': False,
                'error': f'Webpage is already being processed (status: {queue_entry.status})'
            }), 400
        
        # Update or create queue entry
        if queue_entry:
            queue_entry.status = 'pending'
            queue_entry.started_at = None
            queue_entry.completed_at = None
            queue_entry.error_message = None
        else:
            queue_entry = WebpageProcessingQueue(webpage_id=webpage_id)
            db.session.add(queue_entry)
        
        # Reset processed flag on webpage
        webpage.processed = False
        
        db.session.commit()
        
        # Start processing
        process_webpage_job(webpage_id)
        
        return jsonify({
            'success': True,
            'message': f'Webpage {webpage_id} queued for reprocessing'
        })
    
    except Exception as e:
        logger.exception(f"Error reprocessing webpage {webpage_id}: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'Error reprocessing webpage: {str(e)}'
        }), 500

@webpage_routes.route('/api/collections', methods=['GET'])
def get_webpage_collections():
    """
    API endpoint to get all collections for the webpage browser
    This endpoint exists separately from the document collections endpoint
    to maintain separation between documents and webpages
    """
    try:
        # Get all collections
        collections = Collection.query.all()
        
        # Format for response
        collection_list = []
        for collection in collections:
            collection_list.append({
                'id': collection.id,
                'name': collection.name,
                'description': collection.description,
                'parent_id': collection.parent_id
            })
        
        return jsonify({
            'success': True,
            'collections': collection_list
        })
    
    except Exception as e:
        logger.exception(f"Error fetching webpage collections: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error fetching collections: {str(e)}'
        }), 500

@webpage_routes.route('/api/collections', methods=['POST'])
def create_webpage_collection():
    """
    API endpoint to create a new collection for webpages
    """
    data = request.json
    
    if not data or 'name' not in data:
        return jsonify({
            'success': False,
            'error': 'Collection name is required'
        }), 400
    
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    parent_id = data.get('parent_id')
    
    if not name:
        return jsonify({
            'success': False,
            'error': 'Collection name is required'
        }), 400
    
    try:
        # Validate parent collection if provided
        if parent_id:
            try:
                parent_id = int(parent_id)
                parent = Collection.query.get(parent_id)
                if not parent:
                    return jsonify({
                        'success': False,
                        'error': f'Parent collection with ID {parent_id} not found'
                    }), 404
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Invalid parent collection ID'
                }), 400
        
        # Create new collection
        collection = Collection(name=name, description=description, parent_id=parent_id)
        db.session.add(collection)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Collection "{name}" created successfully',
            'collection': {
                'id': collection.id,
                'name': collection.name,
                'description': collection.description,
                'parent_id': collection.parent_id
            }
        })
    
    except Exception as e:
        logger.exception(f"Error creating collection: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'Error creating collection: {str(e)}'
        }), 500

@webpage_routes.route('/api/webpages/batch-move', methods=['POST'])
def batch_move_webpages():
    """
    Move multiple webpages to a different collection
    """
    data = request.json
    
    if not data or 'webpage_ids' not in data:
        return jsonify({
            'success': False,
            'error': 'Webpage IDs are required'
        }), 400
    
    webpage_ids = data.get('webpage_ids', [])
    collection_id = data.get('collection_id')
    
    if not webpage_ids:
        return jsonify({
            'success': False,
            'error': 'At least one webpage ID is required'
        }), 400
    
    try:
        # Validate collection if provided
        if collection_id:
            try:
                collection_id = int(collection_id)
                collection = Collection.query.get(collection_id)
                if not collection:
                    return jsonify({
                        'success': False,
                        'error': f'Collection with ID {collection_id} not found'
                    }), 404
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Invalid collection ID'
                }), 400
        
        # Update webpages
        updated_count = 0
        for webpage_id in webpage_ids:
            try:
                webpage_id = int(webpage_id)
                webpage = Webpage.query.get(webpage_id)
                if webpage:
                    webpage.collection_id = collection_id
                    updated_count += 1
            except (ValueError, TypeError):
                # Skip invalid IDs
                continue
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Updated {updated_count} webpages successfully',
            'updated_count': updated_count
        })
    
    except Exception as e:
        logger.exception(f"Error batch moving webpages: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'Error batch moving webpages: {str(e)}'
        }), 500

@webpage_routes.route('/api/webpage/<int:webpage_id>/collection', methods=['PUT'])
def update_webpage_collection(webpage_id):
    """
    API endpoint to update a webpage's collection
    """
    webpage = Webpage.query.get(webpage_id)
    
    if not webpage:
        return jsonify({
            'success': False,
            'error': f'Webpage with ID {webpage_id} not found'
        }), 404
    
    data = request.json
    if not data:
        return jsonify({
            'success': False,
            'error': 'Request body is required'
        }), 400
    
    collection_id = data.get('collection_id')
    
    try:
        # Validate collection if provided
        if collection_id:
            try:
                collection_id = int(collection_id)
                collection = Collection.query.get(collection_id)
                if not collection:
                    return jsonify({
                        'success': False,
                        'error': f'Collection with ID {collection_id} not found'
                    }), 404
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Invalid collection ID'
                }), 400
        
        # Update the webpage
        webpage.collection_id = collection_id
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Webpage {webpage_id} updated successfully'
        })
    
    except Exception as e:
        logger.exception(f"Error updating webpage {webpage_id}: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'Error updating webpage: {str(e)}'
        }), 500