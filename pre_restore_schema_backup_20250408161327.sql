-- Database schema dump created at 2025-04-08 16:13:27.663609
-- Database: neondb?sslmode=require

-- Table: query_history

CREATE TABLE query_history (
	id SERIAL NOT NULL, 
	query_text TEXT NOT NULL, 
	response TEXT, 
	citations JSON, 
	timestamp TIMESTAMP WITHOUT TIME ZONE, 
	conversation_id VARCHAR(50), 
	CONSTRAINT query_history_pkey PRIMARY KEY (id)
)

;

-- Columns for query_history:
-- id INTEGER NOT NULL DEFAULT nextval('query_history_id_seq'::regclass)
-- query_text TEXT NOT NULL 
-- response TEXT NULL 
-- citations JSON NULL 
-- timestamp TIMESTAMP NULL 
-- conversation_id VARCHAR(50) NULL 
-- Primary Key: id


-- Table: system_metrics

CREATE TABLE system_metrics (
	id SERIAL NOT NULL, 
	timestamp TIMESTAMP WITHOUT TIME ZONE, 
	cpu_usage DOUBLE PRECISION, 
	memory_usage DOUBLE PRECISION, 
	chunks_processed INTEGER, 
	chunks_pending INTEGER, 
	CONSTRAINT system_metrics_pkey PRIMARY KEY (id)
)

;

-- Columns for system_metrics:
-- id INTEGER NOT NULL DEFAULT nextval('system_metrics_id_seq'::regclass)
-- timestamp TIMESTAMP NULL 
-- cpu_usage DOUBLE PRECISION NULL 
-- memory_usage DOUBLE PRECISION NULL 
-- chunks_processed INTEGER NULL 
-- chunks_pending INTEGER NULL 
-- Primary Key: id


-- Table: processing_queue

CREATE TABLE processing_queue (
	id SERIAL NOT NULL, 
	document_id INTEGER NOT NULL, 
	status VARCHAR(20), 
	queued_at TIMESTAMP WITHOUT TIME ZONE, 
	started_at TIMESTAMP WITHOUT TIME ZONE, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	error_message TEXT, 
	CONSTRAINT processing_queue_pkey PRIMARY KEY (id), 
	CONSTRAINT processing_queue_document_id_fkey FOREIGN KEY(document_id) REFERENCES document (id)
)

;

-- Columns for processing_queue:
-- id INTEGER NOT NULL DEFAULT nextval('processing_queue_id_seq'::regclass)
-- document_id INTEGER NOT NULL 
-- status VARCHAR(20) NULL 
-- queued_at TIMESTAMP NULL 
-- started_at TIMESTAMP NULL 
-- completed_at TIMESTAMP NULL 
-- error_message TEXT NULL 
-- Primary Key: id
-- Foreign Keys:
-- document_id -> document.id


-- Table: vector_embedding

CREATE TABLE vector_embedding (
	id SERIAL NOT NULL, 
	chunk_id INTEGER NOT NULL, 
	embedding DOUBLE PRECISION[], 
	CONSTRAINT vector_embedding_pkey PRIMARY KEY (id), 
	CONSTRAINT vector_embedding_chunk_id_fkey FOREIGN KEY(chunk_id) REFERENCES text_chunk (id)
)

;

-- Columns for vector_embedding:
-- id INTEGER NOT NULL DEFAULT nextval('vector_embedding_id_seq'::regclass)
-- chunk_id INTEGER NOT NULL 
-- embedding ARRAY NULL 
-- Primary Key: id
-- Foreign Keys:
-- chunk_id -> text_chunk.id


-- Table: collection

CREATE TABLE collection (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	parent_id INTEGER, 
	CONSTRAINT collection_pkey PRIMARY KEY (id), 
	CONSTRAINT collection_parent_id_fkey FOREIGN KEY(parent_id) REFERENCES collection (id)
)

;

-- Columns for collection:
-- id INTEGER NOT NULL DEFAULT nextval('collection_id_seq'::regclass)
-- name VARCHAR(100) NOT NULL 
-- description TEXT NULL 
-- created_at TIMESTAMP NULL 
-- parent_id INTEGER NULL 
-- Primary Key: id
-- Foreign Keys:
-- parent_id -> collection.id


-- Table: webpage

CREATE TABLE webpage (
	id SERIAL NOT NULL, 
	url VARCHAR(2048) NOT NULL, 
	title TEXT, 
	content TEXT, 
	crawl_date TIMESTAMP WITHOUT TIME ZONE, 
	last_updated TIMESTAMP WITHOUT TIME ZONE, 
	processed BOOLEAN, 
	collection_id INTEGER, 
	CONSTRAINT webpage_pkey PRIMARY KEY (id), 
	CONSTRAINT webpage_collection_id_fkey FOREIGN KEY(collection_id) REFERENCES collection (id), 
	CONSTRAINT webpage_url_key UNIQUE (url)
)

;

-- Columns for webpage:
-- id INTEGER NOT NULL DEFAULT nextval('webpage_id_seq'::regclass)
-- url VARCHAR(2048) NOT NULL 
-- title TEXT NULL 
-- content TEXT NULL 
-- crawl_date TIMESTAMP NULL 
-- last_updated TIMESTAMP NULL 
-- processed BOOLEAN NULL 
-- collection_id INTEGER NULL 
-- Primary Key: id
-- Foreign Keys:
-- collection_id -> collection.id
-- Indexes:
-- webpage_url_key: UNIQUE (url)


-- Table: document

CREATE TABLE document (
	id SERIAL NOT NULL, 
	filename VARCHAR(255) NOT NULL, 
	title TEXT, 
	authors TEXT, 
	doi VARCHAR(100), 
	publication_date TIMESTAMP WITHOUT TIME ZONE, 
	journal TEXT, 
	citation_apa TEXT, 
	tags VARCHAR(100)[], 
	upload_date TIMESTAMP WITHOUT TIME ZONE, 
	processed BOOLEAN, 
	full_text TEXT, 
	collection_id INTEGER, 
	text_extraction_quality VARCHAR(20) DEFAULT 'normal'::character varying, 
	ocr_status VARCHAR(20), 
	ocr_requested_at TIMESTAMP WITHOUT TIME ZONE, 
	ocr_completed_at TIMESTAMP WITHOUT TIME ZONE, 
	ocr_error TEXT, 
	CONSTRAINT document_pkey PRIMARY KEY (id), 
	CONSTRAINT document_doi_key UNIQUE (doi)
)

;

-- Columns for document:
-- id INTEGER NOT NULL DEFAULT nextval('document_id_seq'::regclass)
-- filename VARCHAR(255) NOT NULL 
-- title TEXT NULL 
-- authors TEXT NULL 
-- doi VARCHAR(100) NULL 
-- publication_date TIMESTAMP NULL 
-- journal TEXT NULL 
-- citation_apa TEXT NULL 
-- tags ARRAY NULL 
-- upload_date TIMESTAMP NULL 
-- processed BOOLEAN NULL 
-- full_text TEXT NULL 
-- collection_id INTEGER NULL 
-- text_extraction_quality VARCHAR(20) NULL DEFAULT 'normal'::character varying
-- ocr_status VARCHAR(20) NULL 
-- ocr_requested_at TIMESTAMP NULL 
-- ocr_completed_at TIMESTAMP NULL 
-- ocr_error TEXT NULL 
-- Primary Key: id
-- Indexes:
-- document_doi_key: UNIQUE (doi)


-- Table: webpage_processing_queue

CREATE TABLE webpage_processing_queue (
	id SERIAL NOT NULL, 
	webpage_id INTEGER NOT NULL, 
	status VARCHAR(20), 
	queued_at TIMESTAMP WITHOUT TIME ZONE, 
	started_at TIMESTAMP WITHOUT TIME ZONE, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	error_message TEXT, 
	CONSTRAINT webpage_processing_queue_pkey PRIMARY KEY (id), 
	CONSTRAINT webpage_processing_queue_webpage_id_fkey FOREIGN KEY(webpage_id) REFERENCES webpage (id)
)

;

-- Columns for webpage_processing_queue:
-- id INTEGER NOT NULL DEFAULT nextval('webpage_processing_queue_id_seq'::regclass)
-- webpage_id INTEGER NOT NULL 
-- status VARCHAR(20) NULL 
-- queued_at TIMESTAMP NULL 
-- started_at TIMESTAMP NULL 
-- completed_at TIMESTAMP NULL 
-- error_message TEXT NULL 
-- Primary Key: id
-- Foreign Keys:
-- webpage_id -> webpage.id


-- Table: text_chunk

CREATE TABLE text_chunk (
	id SERIAL NOT NULL, 
	document_id INTEGER, 
	text TEXT NOT NULL, 
	page_num INTEGER, 
	chunk_index INTEGER, 
	webpage_id INTEGER, 
	CONSTRAINT text_chunk_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_webpage_id FOREIGN KEY(webpage_id) REFERENCES webpage (id), 
	CONSTRAINT text_chunk_document_id_fkey FOREIGN KEY(document_id) REFERENCES document (id)
)

;

-- Columns for text_chunk:
-- id INTEGER NOT NULL DEFAULT nextval('text_chunk_id_seq'::regclass)
-- document_id INTEGER NULL 
-- text TEXT NOT NULL 
-- page_num INTEGER NULL 
-- chunk_index INTEGER NULL 
-- webpage_id INTEGER NULL 
-- Primary Key: id
-- Foreign Keys:
-- webpage_id -> webpage.id
-- document_id -> document.id


