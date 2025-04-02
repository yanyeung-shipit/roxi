import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSON

from app import db

class Collection(db.Model):
    """Model for organizing documents into collections (folders) with nesting support"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    parent_id = db.Column(db.Integer, db.ForeignKey('collection.id'), nullable=True)
    
    # Relationships
    documents = db.relationship('Document', backref='collection', lazy=True)
    children = db.relationship('Collection', 
                              backref=db.backref('parent', remote_side=[id]),
                              lazy='dynamic')
    
    def __repr__(self):
        return f"<Collection {self.name}>"
    
    @property
    def full_path(self):
        """Get the full path of collection names, starting from the root"""
        path = [self.name]
        current = self.parent
        
        while current:
            path.insert(0, current.name)
            current = current.parent
            
        return " / ".join(path)

class Document(db.Model):
    """Model for storing document information"""
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    title = db.Column(db.Text)
    authors = db.Column(db.Text)  # Changed to Text to handle long author lists
    doi = db.Column(db.String(100), unique=True)
    publication_date = db.Column(db.DateTime)
    journal = db.Column(db.Text)
    citation_apa = db.Column(db.Text)
    tags = db.Column(ARRAY(db.String(100)))
    upload_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    processed = db.Column(db.Boolean, default=False)
    full_text = db.Column(db.Text)
    # Added collection_id foreign key
    collection_id = db.Column(db.Integer, db.ForeignKey('collection.id'), nullable=True)
    
    def __repr__(self):
        return f"<Document {self.id}: {self.title}>"


class TextChunk(db.Model):
    """Model for storing text chunks from documents"""
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    page_num = db.Column(db.Integer)
    chunk_index = db.Column(db.Integer)
    document = db.relationship('Document', backref=db.backref('chunks', lazy=True))
    
    def __repr__(self):
        return f"<TextChunk {self.id}: Document {self.document_id}, Page {self.page_num}>"


class VectorEmbedding(db.Model):
    """Model for storing vector embeddings of text chunks"""
    id = db.Column(db.Integer, primary_key=True)
    chunk_id = db.Column(db.Integer, db.ForeignKey('text_chunk.id'), nullable=False)
    embedding = db.Column(db.ARRAY(db.Float))
    chunk = db.relationship('TextChunk', backref=db.backref('embedding', uselist=False))
    
    def __repr__(self):
        return f"<VectorEmbedding {self.id}: Chunk {self.chunk_id}>"


class ProcessingQueue(db.Model):
    """Model for tracking document processing queue"""
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, processing, completed, failed
    document = db.relationship('Document', backref=db.backref('queue_entry', uselist=False))
    queued_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    
    def __repr__(self):
        return f"<ProcessingQueue {self.id}: Document {self.document_id}, Status {self.status}>"


class QueryHistory(db.Model):
    """Model for storing user query history"""
    id = db.Column(db.Integer, primary_key=True)
    query_text = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text)
    citations = db.Column(JSON)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    conversation_id = db.Column(db.String(50))
    
    def __repr__(self):
        return f"<QueryHistory {self.id}: {self.query_text[:30]}...>"


class SystemMetrics(db.Model):
    """Model for storing system performance metrics"""
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    cpu_usage = db.Column(db.Float)
    memory_usage = db.Column(db.Float)
    chunks_processed = db.Column(db.Integer)
    chunks_pending = db.Column(db.Integer)
    
    def __repr__(self):
        return f"<SystemMetrics {self.id}: {self.timestamp}>"