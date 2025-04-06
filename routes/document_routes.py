from flask import Blueprint, render_template, jsonify, request, send_from_directory, abort, Response
import sqlalchemy as sa
import os
import shutil
import datetime
import logging
from app import db
from models import Document, ProcessingQueue, TextChunk, VectorEmbedding, Collection
from utils.auth import requires_auth

# Create blueprint
document_routes = Blueprint('documents', __name__, url_prefix='/documents')

# Protect all document routes with authentication
@document_routes.before_request
def protect_all_document_routes():
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

@document_routes.route('/')
def document_browser():
    """Render the document browser page"""
    return render_template('document_browser.html')

@document_routes.route('/api/documents')
def list_documents():
    """
    API endpoint to list documents with pagination and filtering
    """
    try:
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Get filter parameters
        search = request.args.get('search', '')
        tag = request.args.get('tag', '')
        collection_id = request.args.get('collection_id')
        
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
                    Document.doi.ilike(search_term),
                    # Search by tag content - use a different approach without lambda function
                    sa.func.array_to_string(Document.tags, ' ').ilike(search_term)
                )
            )
            
        # Filter by collection if provided and the column exists
        if collection_id and hasattr(Document, 'collection_id'):
            try:
                collection_id = int(collection_id)
                query = query.filter(Document.collection_id == collection_id)
            except (ValueError, TypeError):
                # Invalid collection_id, ignore this filter
                pass
        
        # Order by upload date (newest first)
        query = query.order_by(Document.upload_date.desc())
        
        # Paginate results
        paginated = query.paginate(page=page, per_page=per_page)
        
        # Format the response
        documents = []
        for doc in paginated.items:
            # Prepare document data
            doc_data = {
                'id': doc.id,
                'title': doc.title or 'Untitled Document',
                'authors': doc.authors,
                'journal': doc.journal,
                'doi': doc.doi,
                'publication_date': doc.publication_date.isoformat() if doc.publication_date else None,
                'upload_date': doc.upload_date.isoformat(),
                'processed': doc.processed,
                'tags': doc.tags,
                'citation_apa': doc.citation_apa
            }
            
            # Add collection info if available
            if doc.collection_id is not None:
                collection = Collection.query.get(doc.collection_id)
                if collection:
                    doc_data['collection_id'] = doc.collection_id
                    doc_data['collection_name'] = collection.name
            
            documents.append(doc_data)
        
        return jsonify({
            'success': True,
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page,
            'per_page': per_page,
            'has_next': paginated.has_next,
            'has_prev': paginated.has_prev,
            'documents': documents
        })
    except Exception as e:
        import logging
        logging.exception(f"Error in list_documents: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to retrieve documents: {str(e)}"
        }), 500

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
    try:
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({
                'success': False,
                'error': f'Document with ID {document_id} not found'
            }), 404
        
        # Get processing status
        processing_status = None
        queue_entry = ProcessingQueue.query.filter_by(document_id=document_id).first()
        if queue_entry:
            processing_status = queue_entry.status
        
        # Get collection info if available
        collection_name = None
        if document.collection_id is not None:
            collection = Collection.query.get(document.collection_id)
            if collection:
                collection_name = collection.name
        
        # Format the response
        doc_data = {
            'success': True,
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
        
        # Add collection data
        doc_data['collection_id'] = document.collection_id
        doc_data['collection_name'] = collection_name
        
        return jsonify(doc_data)
    except Exception as e:
        import logging
        logging.exception(f"Error in get_document: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to retrieve document: {str(e)}"
        }), 500

# New document management endpoints

@document_routes.route('/api/documents/<int:document_id>', methods=['PUT'])
def update_document(document_id):
    """
    Update document metadata including title, authors, journal, doi, publication date, and tags
    """
    try:
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({
                'success': False,
                'error': f'Document with ID {document_id} not found'
            }), 404
        
        data = request.get_json()
        metadata_changed = False
        
        # Update title if provided
        if 'title' in data:
            document.title = data['title']
            metadata_changed = True
        
        # Update authors if provided
        if 'authors' in data:
            document.authors = data['authors']
            metadata_changed = True
        
        # Update journal if provided
        if 'journal' in data:
            document.journal = data['journal']
            metadata_changed = True
        
        # Update DOI if provided
        if 'doi' in data:
            document.doi = data['doi']
            metadata_changed = True
        
        # Update publication date if provided
        if 'publication_date' in data and data['publication_date']:
            try:
                # Handle different date formats
                if 'T' in data['publication_date']:
                    # ISO format with time
                    document.publication_date = datetime.datetime.fromisoformat(data['publication_date'])
                else:
                    # Simple date format (YYYY-MM-DD)
                    document.publication_date = datetime.datetime.strptime(data['publication_date'], '%Y-%m-%d')
                metadata_changed = True
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid publication date format. Use YYYY-MM-DD.'
                }), 400
        
        # Update tags if provided
        if 'tags' in data:
            document.tags = data['tags']
        
        # Update collection if collection_id is provided
        if 'collection_id' in data:
            collection_id = data['collection_id']
            
            # Verify collection exists if not None
            if collection_id is not None:
                collection = Collection.query.get(collection_id)
                if not collection:
                    return jsonify({
                        'success': False,
                        'error': f'Collection with ID {collection_id} not found'
                    }), 404
            
            document.collection_id = collection_id
            
        # Re-generate citation if metadata was changed
        if metadata_changed:
            from utils.citation_generator import generate_apa_citation
            document.citation_apa = generate_apa_citation(document)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Document updated successfully',
            'document': {
                'id': document.id,
                'title': document.title,
                'authors': document.authors,
                'journal': document.journal,
                'doi': document.doi,
                'publication_date': document.publication_date.isoformat() if document.publication_date else None,
                'citation_apa': document.citation_apa,
                'tags': document.tags,
                'collection_id': document.collection_id
            }
        })
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error updating document: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to update document: {str(e)}"
        }), 500

@document_routes.route('/api/documents/<int:document_id>', methods=['DELETE'])
def delete_document(document_id):
    """
    Delete a document and all its associated data (chunks, embeddings, file)
    """
    try:
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({
                'success': False,
                'error': f'Document with ID {document_id} not found'
            }), 404
        
        # Get all chunk IDs for this document
        chunks = TextChunk.query.filter_by(document_id=document_id).all()
        chunk_ids = [chunk.id for chunk in chunks]
        
        # Delete vector embeddings for these chunks
        if chunk_ids:
            VectorEmbedding.query.filter(VectorEmbedding.chunk_id.in_(chunk_ids)).delete(synchronize_session=False)
        
        # Delete text chunks
        TextChunk.query.filter_by(document_id=document_id).delete()
        
        # Delete queue entry if exists
        ProcessingQueue.query.filter_by(document_id=document_id).delete()
        
        # Delete physical file if exists
        try:
            upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
            file_path = os.path.join(upload_folder, document.filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            # Log but continue with database deletion
            import logging
            logging.warning(f"Error deleting file for document {document_id}: {str(e)}")
        
        # Delete document record
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Document {document_id} and all associated data deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error deleting document: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to delete document: {str(e)}"
        }), 500
        
@document_routes.route('/api/documents/batch/move', methods=['POST'])
def batch_move_documents():
    """
    Move multiple documents to a different collection
    """
    try:
        data = request.get_json()
        
        if not data or 'document_ids' not in data or 'collection_id' not in data:
            return jsonify({
                'success': False,
                'error': 'document_ids list and collection_id are required'
            }), 400
            
        document_ids = data['document_ids']
        collection_id = data['collection_id']
        
        if not isinstance(document_ids, list) or len(document_ids) == 0:
            return jsonify({
                'success': False,
                'error': 'document_ids must be a non-empty list'
            }), 400
            
        # If collection_id is not None, verify the collection exists
        if collection_id is not None:
            collection = Collection.query.get(collection_id)
            if not collection:
                return jsonify({
                    'success': False,
                    'error': f'Collection with ID {collection_id} not found'
                }), 404
        
        # Get all documents
        documents = Document.query.filter(Document.id.in_(document_ids)).all()
        found_ids = [doc.id for doc in documents]
        
        # Check for documents that were not found
        not_found = list(set(document_ids) - set(found_ids))
        if not_found:
            return jsonify({
                'success': False,
                'error': f'Documents with IDs {not_found} not found'
            }), 404
        
        # Update each document's collection
        moved_count = 0
        for document in documents:
            document.collection_id = collection_id
            moved_count += 1
            
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully moved {moved_count} documents to collection ID {collection_id if collection_id else "None (Root)"}'
        })
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error batch moving documents: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to move documents: {str(e)}"
        }), 500

@document_routes.route('/api/documents/batch/delete', methods=['POST'])
def batch_delete_documents():
    """
    Delete multiple documents and all their associated data
    """
    try:
        data = request.get_json()
        
        if not data or 'document_ids' not in data:
            return jsonify({
                'success': False,
                'error': 'document_ids list is required'
            }), 400
            
        document_ids = data['document_ids']
        
        if not isinstance(document_ids, list) or len(document_ids) == 0:
            return jsonify({
                'success': False,
                'error': 'document_ids must be a non-empty list'
            }), 400
            
        # Get all documents
        documents = Document.query.filter(Document.id.in_(document_ids)).all()
        found_ids = [doc.id for doc in documents]
        
        # Check for documents that were not found
        not_found = list(set(document_ids) - set(found_ids))
        if not_found:
            return jsonify({
                'success': False,
                'error': f'Documents with IDs {not_found} not found'
            }), 200
            
        # For each document, delete chunks, embeddings, queue entries, and files
        deleted_count = 0
        for document in documents:
            # Get all chunk IDs for this document
            chunks = TextChunk.query.filter_by(document_id=document.id).all()
            chunk_ids = [chunk.id for chunk in chunks]
            
            # Delete vector embeddings for these chunks
            if chunk_ids:
                VectorEmbedding.query.filter(VectorEmbedding.chunk_id.in_(chunk_ids)).delete(synchronize_session=False)
            
            # Delete text chunks
            TextChunk.query.filter_by(document_id=document.id).delete()
            
            # Delete queue entry if exists
            ProcessingQueue.query.filter_by(document_id=document.id).delete()
            
            # Delete physical file if exists
            try:
                upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
                file_path = os.path.join(upload_folder, document.filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                # Log but continue with database deletion
                import logging
                logging.warning(f"Error deleting file for document {document.id}: {str(e)}")
            
            # Delete document record
            db.session.delete(document)
            deleted_count += 1
            
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully deleted {deleted_count} documents and associated data'
        })
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error batch deleting documents: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to delete documents: {str(e)}"
        }), 500

@document_routes.route('/api/collections', methods=['GET'])
def get_collections():
    """
    Get all collections with their hierarchical structure
    """
    try:
        # Get all collections
        collections = Collection.query.all()
        result = []
        
        # Process collections into a hierarchical structure
        collection_map = {}
        root_collections = []
        
        # First pass - create objects for each collection
        for collection in collections:
            # Count documents in this collection
            doc_count = Document.query.filter_by(collection_id=collection.id).count()
            
            # Count documents in all descendant collections
            total_doc_count = doc_count
            
            collection_obj = {
                'id': collection.id,
                'name': collection.name,
                'description': collection.description,
                'document_count': doc_count,
                'total_document_count': total_doc_count,  # Will update this later
                'parent_id': collection.parent_id,
                'children': [],
                'level': 0,  # Will be calculated in second pass
                'full_path': collection.full_path,
                'created_at': collection.created_at.isoformat() if hasattr(collection, 'created_at') else None
            }
            
            collection_map[collection.id] = collection_obj
            
            # If it's a root collection (no parent), add to root_collections
            if collection.parent_id is None:
                root_collections.append(collection_obj)
        
        # Second pass - build hierarchy and calculate levels
        for collection_id, collection_obj in collection_map.items():
            parent_id = collection_obj['parent_id']
            
            if parent_id is not None and parent_id in collection_map:
                parent = collection_map[parent_id]
                parent['children'].append(collection_obj)
                collection_obj['level'] = parent['level'] + 1
        
        # Third pass - calculate total document counts (includes descendant collections)
        def calculate_total_docs(collection_obj):
            total = collection_obj['document_count']
            for child in collection_obj['children']:
                child_total = calculate_total_docs(child)
                total += child_total
            collection_obj['total_document_count'] = total
            return total
        
        for root in root_collections:
            calculate_total_docs(root)
        
        # Return collections as a flat list with hierarchy information
        flat_list = list(collection_map.values())
        
        return jsonify({
            'success': True,
            'collections': flat_list
        })
    except Exception as e:
        import logging
        logging.exception(f"Error getting collections: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to retrieve collections: {str(e)}"
        }), 500

@document_routes.route('/api/collections', methods=['POST'])
def create_collection():
    """
    Create a new collection with optional parent collection
    """
    try:
        data = request.get_json()
        
        if not data or 'name' not in data:
            return jsonify({
                'success': False,
                'error': 'Collection name is required'
            }), 400
        
        # Check if parent_id is provided and valid
        parent_id = data.get('parent_id')
        if parent_id is not None:
            parent = Collection.query.get(parent_id)
            if not parent:
                return jsonify({
                    'success': False,
                    'error': f'Parent collection with ID {parent_id} not found'
                }), 404
            
            # Check for circular references (can't be your own ancestor)
            current = parent
            while current:
                if current.parent_id == parent_id:
                    return jsonify({
                        'success': False,
                        'error': 'Circular reference detected in collection hierarchy'
                    }), 400
                current = current.parent
        
        # Create new collection
        collection = Collection(
            name=data['name'],
            description=data.get('description', ''),
            parent_id=parent_id
        )
        
        db.session.add(collection)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'collection': {
                'id': collection.id,
                'name': collection.name,
                'description': collection.description,
                'parent_id': collection.parent_id,
                'full_path': collection.full_path,
                'created_at': collection.created_at.isoformat() if hasattr(collection, 'created_at') else None,
                'document_count': 0
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error creating collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to create collection: {str(e)}"
        }), 500

@document_routes.route('/api/collections/<int:collection_id>', methods=['GET'])
def get_collection(collection_id):
    """
    Get a single collection by ID
    """
    try:
        collection = Collection.query.get(collection_id)
        
        if not collection:
            return jsonify({
                'success': False,
                'error': f'Collection with ID {collection_id} not found'
            }), 404
        
        # Count documents in this collection
        doc_count = Document.query.filter_by(collection_id=collection_id).count()
        
        return jsonify({
            'success': True,
            'collection': {
                'id': collection.id,
                'name': collection.name,
                'description': collection.description,
                'parent_id': collection.parent_id,
                'full_path': collection.full_path,
                'document_count': doc_count,
                'created_at': collection.created_at.isoformat() if hasattr(collection, 'created_at') else None
            }
        })
    except Exception as e:
        import logging
        logging.exception(f"Error getting collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to get collection: {str(e)}"
        }), 500

@document_routes.route('/api/collections/<int:collection_id>', methods=['PUT'])
def update_collection(collection_id):
    """
    Update a collection including its parent relationship
    """
    try:
        collection = Collection.query.get(collection_id)
        
        if not collection:
            return jsonify({
                'success': False,
                'error': f'Collection with ID {collection_id} not found'
            }), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'name' in data:
            collection.name = data['name']
        
        if 'description' in data:
            collection.description = data['description']
        
        # Update parent_id if provided
        if 'parent_id' in data:
            parent_id = data['parent_id']
            
            # Can't set yourself as your own parent
            if parent_id == collection_id:
                return jsonify({
                    'success': False,
                    'error': 'A collection cannot be its own parent'
                }), 400
                
            # Check if parent exists (if not None)
            if parent_id is not None:
                parent = Collection.query.get(parent_id)
                if not parent:
                    return jsonify({
                        'success': False,
                        'error': f'Parent collection with ID {parent_id} not found'
                    }), 404
                
                # Check if the new parent is not one of this collection's descendants
                descendants = []
                def get_descendants(coll_id):
                    children = Collection.query.filter_by(parent_id=coll_id).all()
                    for child in children:
                        descendants.append(child.id)
                        get_descendants(child.id)
                
                get_descendants(collection_id)
                if parent_id in descendants:
                    return jsonify({
                        'success': False,
                        'error': 'Cannot set a descendant collection as parent (circular reference)'
                    }), 400
            
            # Update parent_id
            collection.parent_id = parent_id
        
        db.session.commit()
        
        # Count documents in this collection
        doc_count = Document.query.filter_by(collection_id=collection_id).count()
        
        return jsonify({
            'success': True,
            'collection': {
                'id': collection.id,
                'name': collection.name,
                'description': collection.description,
                'parent_id': collection.parent_id,
                'full_path': collection.full_path,
                'document_count': doc_count,
                'created_at': collection.created_at.isoformat() if hasattr(collection, 'created_at') else None
            }
        })
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error updating collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to update collection: {str(e)}"
        }), 500

@document_routes.route('/api/collections/<int:collection_id>', methods=['DELETE'])
def delete_collection(collection_id):
    """
    Delete a collection (but not its documents or child collections)
    """
    try:
        collection = Collection.query.get(collection_id)
        
        if not collection:
            return jsonify({
                'success': False,
                'error': f'Collection with ID {collection_id} not found'
            }), 404
        
        # Check if this collection has child collections
        child_collections = Collection.query.filter_by(parent_id=collection_id).count()
        if child_collections > 0:
            # Get child collection data for the error message
            children = Collection.query.filter_by(parent_id=collection_id).all()
            child_names = [c.name for c in children]
            
            return jsonify({
                'success': False,
                'error': f'Cannot delete collection with child collections. Move or delete these collections first: {", ".join(child_names)}'
            }), 400
        
        # Set collection_id to NULL for all documents in this collection
        Document.query.filter_by(collection_id=collection_id).update({Document.collection_id: None})
        
        # Delete the collection
        db.session.delete(collection)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Collection {collection_id} deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error deleting collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to delete collection: {str(e)}"
        }), 500

@document_routes.route('/api/documents/<int:document_id>/tags', methods=['PUT'])
def update_document_tags(document_id):
    """
    Update the tags for a document
    """
    try:
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({
                'success': False,
                'error': f'Document with ID {document_id} not found'
            }), 404
        
        data = request.get_json()
        
        if 'tags' not in data:
            return jsonify({
                'success': False,
                'error': 'Tags array is required'
            }), 400
        
        # Update tags
        document.tags = data['tags']
        db.session.commit()
        
        return jsonify({
            'success': True,
            'document_id': document.id,
            'tags': document.tags
        })
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error updating document tags: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to update document tags: {str(e)}"
        }), 500

@document_routes.route('/api/documents/<int:document_id>/collection', methods=['PUT'])
def update_document_collection(document_id):
    """
    Move a document to a different collection
    """
    try:
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({
                'success': False,
                'error': f'Document with ID {document_id} not found'
            }), 404
        
        if not hasattr(document, 'collection_id'):
            return jsonify({
                'success': False,
                'error': 'Document model does not support collections yet'
            }), 400
        
        data = request.get_json()
        
        if 'collection_id' not in data:
            return jsonify({
                'success': False,
                'error': 'collection_id is required'
            }), 400
        
        collection_id = data['collection_id']
        
        # If collection_id is not None, verify the collection exists
        if collection_id is not None:
            collection = Collection.query.get(collection_id)
            if not collection:
                return jsonify({
                    'success': False,
                    'error': f'Collection with ID {collection_id} not found'
                }), 404
        
        # Update document's collection
        document.collection_id = collection_id
        db.session.commit()
        
        # Get collection name for response
        collection_name = None
        if collection_id is not None:
            collection = Collection.query.get(collection_id)
            collection_name = collection.name if collection else None
        
        return jsonify({
            'success': True,
            'document_id': document.id,
            'collection_id': document.collection_id,
            'collection_name': collection_name
        })
    except Exception as e:
        db.session.rollback()
        import logging
        logging.exception(f"Error updating document collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to update document collection: {str(e)}"
        }), 500

@document_routes.route('view/<int:document_id>', methods=['GET'])
def view_document_pdf(document_id):
    """
    Serve the PDF file of a document for viewing
    """
    import logging  # Import at the beginning of the function to avoid UnboundLocalError
    
    try:
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({
                'success': False,
                'error': f'Document with ID {document_id} not found'
            }), 404
        
        # Check if file exists
        upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
        
        # Ensure the file exists
        if not document.filename or not os.path.exists(os.path.join(upload_folder, document.filename)):
            return jsonify({
                'success': False,
                'error': 'PDF file not found'
            }), 404
        
        # Log the file path for debugging
        logging.info(f"Sending PDF file: {os.path.join(upload_folder, document.filename)}")
        
        # Send the file
        return send_from_directory(upload_folder, document.filename, as_attachment=False)
    except Exception as e:
        logging.exception(f"Error viewing PDF: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to retrieve PDF: {str(e)}"
        }), 500

# Document text quality endpoint has been removed as OCR functionality is no longer needed