import datetime
from app import db
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import ARRAY

class Document(db.Model):
    """Model for storing document information"""
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    title = db.Column(db.String(500))
    authors = db.Column(db.String(500))
    doi = db.Column(db.String(100), unique=True)
    publication_date = db.Column(db.DateTime)
    journal = db.Column(db.String(255))
    citation_apa = db.Column(db.Text)
    tags = db.Column(ARRAY(db.String(100)))
    upload_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    processed = db.Column(db.Boolean, default=False)
    full_text = db.Column(db.Text)
    
    def __repr__(self):
        return f"<Document id={self.id} title='{self.title or 'Untitled'}'>"

class TextChunk(db.Model):
    """Model for storing text chunks from documents"""
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    page_num = db.Column(db.Integer)
    chunk_index = db.Column(db.Integer)
    document = db.relationship('Document', backref=db.backref('chunks', lazy=True))
    
    def __repr__(self):
        return f"<TextChunk id={self.id} document_id={self.document_id} index={self.chunk_index}>"

class VectorEmbedding(db.Model):
    """Model for storing vector embeddings of text chunks"""
    id = db.Column(db.Integer, primary_key=True)
    chunk_id = db.Column(db.Integer, db.ForeignKey('text_chunk.id'), nullable=False)
    embedding = db.Column(db.ARRAY(db.Float))
    chunk = db.relationship('TextChunk', backref=db.backref('embedding', uselist=False))
    
    def __repr__(self):
        return f"<VectorEmbedding id={self.id} chunk_id={self.chunk_id}>"

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
        return f"<ProcessingQueue id={self.id} document_id={self.document_id} status={self.status}>"

class QueryHistory(db.Model):
    """Model for storing user query history"""
    id = db.Column(db.Integer, primary_key=True)
    query_text = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text)
    citations = db.Column(JSON)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    conversation_id = db.Column(db.String(50))
    
    def __repr__(self):
        return f"<QueryHistory id={self.id} conversation_id={self.conversation_id}>"

class SystemMetrics(db.Model):
    """Model for storing system performance metrics"""
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    cpu_usage = db.Column(db.Float)
    memory_usage = db.Column(db.Float)
    chunks_processed = db.Column(db.Integer)
    chunks_pending = db.Column(db.Integer)
    
    def __repr__(self):
        return f"<SystemMetrics id={self.id} timestamp={self.timestamp}>"