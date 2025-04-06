import os
import re
import logging
import datetime
import random
import threading
import time
import queue
from app import db, app
from models import Document, TextChunk, VectorEmbedding, ProcessingQueue
from utils.pdf_processor import extract_text_from_pdf, chunk_text, clean_text
from utils.embeddings import generate_embeddings
from utils.doi_validator import extract_and_validate_doi, validate_doi_with_crossref
from utils.citation_generator import generate_apa_citation
# Import PubMed integration
from utils.pubmed_integration import (
    get_paper_details_by_doi,
    get_article_citation,
    doi_to_pmid,
    generate_tags_from_pubmed
)

# Set up logging
logger = logging.getLogger(__name__)

def match_to_predefined_tags(text_content, tag_candidates=None):
    """
    Match text content or candidate tags to the predefined list of valid tags.
    This ensures that only approved, standardized tags are used.
    
    Args:
        text_content (str): The text content to analyze for tag matches
        tag_candidates (list, optional): List of potential tag candidates to filter
        
    Returns:
        list: List of matched predefined tags
    """
    # Define dictionaries needed for tag generation and classification
    # Common rheumatology disease categories
    diseases = {
        "Rheumatoid Arthritis": ["rheumatoid arthritis", "ra ", "ra,", "ra.", "ra)", "ra-", "rheumatoid", "arthritis, rheumatoid"],
        "Polymyalgia Rheumatica": ["polymyalgia rheumatica", "pmr ", "pmr,", "pmr.", "pmr)"],
        "Systemic Lupus Erythematosus": ["systemic lupus", "sle ", "sle,", "sle.", "sle)", "lupus nephritis", "lupus erythematosus"],
        "Cutaneous lupus": ["discoid lupus", "lupus profundus", "lupus panniculitis", "tumid lupus", "urticarial lupus"],
        "Systemic Sclerosis": ["systemic sclerosis", "scleroderma", "ssc", "crest syndrome"],
        "Myositis": ["iim", "idiopathic inflammatory myopathy", "dermatomyositis", "polymyositis"],
        "Sjögren's": ["sjögren", "sjogren", "sicca syndrome", "sjögren's syndrome", "sjogren's disease", "sjögren's disease"],
        "Spondyloarthropathy": ["axial spondyloarthritis", "psoriatic arthritis", "reactive arthritis", "enteropathic arthritis"],
        "Axial Spondyloarthritis": ["ankylosing spondylitis", "non-radiographic axial spondyloarthritis", "axspa", "nr-axspa"],
        "Psoriatic Arthritis": ["psoriatic arthritis", "psa ", "psa,", "psa.", "psa)"],
        "Reactive Arthritis": ["rea", "post-infectious arthritis", "gonococcal arthritis", "reiter's syndrome", "reiter"],
        "Enteropathic Arthritis": ["ibd-arthritis", "ibd", "inflammatory bowel disease", "crohn's", "ulcerative colitis"],
        "Vasculitis": ["vasculitis", "anca", "giant cell arteritis", "takayasu", "polyarteritis"],
        "GCA": ["giant cell arteritis", "temporal arteritis"],
        "Takayasu": ["tak", "takayasu"],
        "Polyarteritis Nodosa": ["pan", "arteritis"],
        "GPA": ["granulomatosis with polyangiitis", "wegener's", "anca", "aav"],
        "MPA": ["microscopic polyangiitis", "anca", "aav"],
        "EGPA": ["eosinophilic granulomatosis and polyangiitis", "churg-strauss"],
        "Immune-Complex Vasculitis": ["immune-complex mediated vasculitis"],
        "IgA Vasculitis": ["iga vasculitis"],
        "Urticarial Vasculitis": ["urticarial vasculitis"],
        "Anti-GBM": ["anti-glomerular basement membrane disease", "anti-gbm disease", "goodpasture disease"],
        "Osteoarthritis": ["osteoarthritis", "oa ", "oa,", "oa.", "oa)", "degenerative joint disease"],
        "Cryo": ["cryoglobulinemic vasculitis", "mixed cryoglobulinemia syndrome", "cryoglobulinemia"],
        "Behcet's": ["behçet's"],
        "Gout": ["gout", "gouty arthritis"],
        "CPPD": ["calcium pyrophosphate deposition disease", "pseudogout", "crowned dens"],
        "PCNSV": ["primary cns vasculitis", "primary angiitis of the cns", "pacns"],
        "Still's Disease": ["adult-onset still's disease", "stills disease", "systemic jia", "aosd"],
        "Sarcoidosis": ["sarcoid"],
        "IgG4-RD": ["igg4-related disease", "mikulicz", "riedel's thyroiditis"],
        "Relapsing Polychondritis": ["rpc", "polychondritis", "vexas"],
        "Fibromyalgia": ["fibromyalgia", "fibromyalgia syndrome", "fms ", "fms,", "fms.", "fms)"],
        "ILD": ["interstitial lung disease", "ild ", "ild,", "ild.", "ild)", "pulmonary fibrosis", "ipf", "nsip", "uip", "fibrotic lung disease"]
    }
    
    # Document types
    document_types = {
        "Guideline": ["guideline", "guidelines", "recommendation", "consensus", "eular", "acr criteria", "practice guidelines"],
        "Clinical Trial": ["clinical trial", "phase iii", "phase 3", "randomized", "randomised", "rct ", "rct,", "rct.", "randomized controlled trial"],
        "Meta-Analysis": ["meta-analysis", "meta analysis", "systematic review"],
        "Cohort Study": ["cohort study", "longitudinal study", "observational study", "prospective studies", "retrospective studies"],
        "Case Report": ["case report", "case series"],
        "Review": ["review", "literature review", "primer"],
        "Cross-Sectional Study": ["cross-sectional study"],
        "Case-Control Study": ["case-control study"],
        "Registries": ["registries"],
        "Real-World Evidence": ["real-world evidence"],
        "Epidemiology": ["epidemiology"],
        "Incidence": ["incidence"],
        "Prevalence": ["prevalence"],
        "Disease Burden": ["disease burden"],
        "Risk Factors": ["risk factors"],
        "Comorbidity": ["comorbidity"],
        "Population Surveillance": ["population surveillance"],
        "Health Services Research": ["health services research"],
        "Outcomes Research": ["outcomes research"]
    }
    
    # Store all predefined tag keys
    all_tag_keys = list(diseases.keys()) + list(document_types.keys())
    
    # Initialize result tags and tag scores
    matched_tags = []
    tag_scores = {}
    
    # If tag candidates are provided, check if any match our predefined tags
    if tag_candidates and isinstance(tag_candidates, list):
        for candidate in tag_candidates:
            # Direct match (case insensitive)
            candidate_lower = candidate.lower()
            
            # Check for direct match with keys
            for tag in all_tag_keys:
                if tag.lower() == candidate_lower:
                    if tag not in matched_tags:
                        matched_tags.append(tag)
                        # High score for exact match
                        tag_scores[tag] = 100
                        break
            
            # If no direct match, check for partial matches
            if not any(tag.lower() == candidate_lower for tag in all_tag_keys):
                # Check disease categories
                for disease, keywords in diseases.items():
                    for keyword in keywords:
                        if keyword.lower() in candidate_lower:
                            if disease not in matched_tags:
                                matched_tags.append(disease)
                                # Score based on how much of the term matched
                                tag_scores[disease] = tag_scores.get(disease, 0) + 5
                            break
                
                # Check document types
                for doc_type, keywords in document_types.items():
                    for keyword in keywords:
                        if keyword.lower() in candidate_lower:
                            if doc_type not in matched_tags:
                                matched_tags.append(doc_type)
                                # Score based on how much of the term matched
                                tag_scores[doc_type] = tag_scores.get(doc_type, 0) + 5
                            break
    
    # If text content is provided, search for mentions of predefined tags
    if text_content and isinstance(text_content, str):
        text_lower = text_content.lower()
        
        # Search for disease terms
        for disease, keywords in diseases.items():
            # Initialize score for this disease
            current_score = 0
            
            for term in keywords:
                # Count occurrences of the term
                count = text_lower.count(term.lower())
                if count > 0:
                    # Add to the score
                    current_score += count * 2
            
            # Only add if mentioned significantly
            if current_score >= 5 and disease not in matched_tags:
                matched_tags.append(disease)
                tag_scores[disease] = current_score
        
        # Search for document type terms
        for doc_type, keywords in document_types.items():
            # Initialize score for this document type
            current_score = 0
            
            for term in keywords:
                # Count occurrences
                count = text_lower.count(term.lower())
                if count > 0:
                    # Add to the score
                    current_score += count * 2
            
            # Only add if mentioned significantly
            if current_score >= 5 and doc_type not in matched_tags:
                matched_tags.append(doc_type)
                tag_scores[doc_type] = current_score
    
    # Sort tags by score (most relevant first)
    sorted_tags = sorted(matched_tags, key=lambda tag: tag_scores.get(tag, 0), reverse=True)
    
    # Return the most relevant tags (limit to 6)
    return sorted_tags[:6]

logger = logging.getLogger(__name__)

# Global queue for document processing
document_queue = queue.Queue()
# Global flag to track if processor is running
processor_running = False
# Lock for thread safety
processor_lock = threading.Lock()

def process_document_job(document_id):
    """Add document to processing queue"""
    logger.info(f"Adding document {document_id} to processing queue")
    document_queue.put(document_id)
    
    # Start the background processor if not already running
    start_background_processor()
    return True

def start_background_processor():
    """Start the background document processor if not already running"""
    global processor_running
    
    with processor_lock:
        if not processor_running:
            logger.info("Starting background document processor")
            processor_thread = threading.Thread(target=background_processor)
            processor_thread.daemon = True
            processor_thread.start()
            processor_running = True

def background_processor():
    """Background thread to process documents from the queue"""
    global processor_running
    
    logger.info("Background processor started")
    
    try:
        while True:
            try:
                # Try to get a document ID from the queue with timeout
                # This allows the thread to check for any shutdown signals
                try:
                    document_id = document_queue.get(timeout=5)
                except queue.Empty:
                    # No documents in queue, check for pending ones in database
                    with app.app_context():
                        pending_queue = ProcessingQueue.query.filter_by(status='pending').all()
                        if pending_queue:
                            for entry in pending_queue:
                                document_queue.put(entry.document_id)
                            continue
                    # If no documents in queue or database, just continue the loop
                    continue
                
                logger.info(f"Processing document {document_id} from queue")
                
                # Process document with app context
                with app.app_context():
                    process_document(document_id)
                
                # Mark task as complete
                document_queue.task_done()
                
            except Exception as e:
                logger.exception(f"Error in background processor: {str(e)}")
                # Sleep briefly to avoid overwhelming the system in case of repeated errors
                time.sleep(1)
    
    finally:
        # Make sure to reset the running flag when the thread exits
        with processor_lock:
            processor_running = False
        logger.info("Background processor stopped")

def process_document(document_id):
    """Process a document's content, extract metadata, and generate embeddings"""
    logger.info(f"Starting to process document: {document_id}")
    
    # Get the document and its queue entry
    document = Document.query.get(document_id)
    queue_entry = ProcessingQueue.query.filter_by(document_id=document_id).first()
    
    if not document or not queue_entry:
        logger.error(f"Document or queue entry not found for ID: {document_id}")
        return False
    
    try:
        # Update queue status to processing
        queue_entry.status = 'processing'
        queue_entry.started_at = datetime.datetime.utcnow()
        db.session.commit()
        
        # Get the file path
        upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
        file_path = os.path.join(upload_folder, document.filename)
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")
        
        # Extract text from the PDF
        text = extract_text_from_pdf(file_path)
        
        if not text:
            raise ValueError("Failed to extract text from PDF")
        
        # Store the full text in the document
        document.full_text = text
        
        # Try to extract raw doi from text
        import re
        doi = None
        # Look for DOI in first 1000 characters (usually contains citation info)
        text_sample = text[:1000]
        
        # Check if this is potentially a EULAR guideline document based on title or content
        is_eular_guideline = False
        if "EULAR" in text[:5000] or "European League Against Rheumatism" in text[:5000]:
            is_eular_guideline = True
            logger.info(f"Detected possible EULAR guideline document: {document_id}")
            
            # EULAR guidelines often have ARD journal DOIs with specific pattern
            eular_doi_match = re.search(r'(10\.\d{4}/ard-\d{4}-\d+)', text[:5000])
            if eular_doi_match:
                candidate_doi = eular_doi_match.group(1)
                # Check if this DOI already exists in another document
                existing_doc = Document.query.filter(Document.doi == candidate_doi, Document.id != document_id).first()
                if existing_doc:
                    logger.warning(f"DOI {candidate_doi} already exists in document {existing_doc.id} (filename: {existing_doc.filename})")
                    raise ValueError(f"Duplicate DOI detected: {candidate_doi}. Already exists in document ID {existing_doc.id}")
                else:
                    doi = candidate_doi
                    document.doi = doi
                    logger.info(f"Extracted EULAR guideline DOI: {doi}")
        
        # Try standard DOI extraction if not already found
        if not doi:
            from utils.doi_validator import DOI_WITH_PREFIX_REGEX
            doi_match = re.search(DOI_WITH_PREFIX_REGEX, text_sample, re.IGNORECASE)
            if doi_match:
                candidate_doi = doi_match.group(1)
                # Check if this DOI already exists in another document
                existing_doc = Document.query.filter(Document.doi == candidate_doi, Document.id != document_id).first()
                if existing_doc:
                    logger.warning(f"DOI {candidate_doi} already exists in document {existing_doc.id} (filename: {existing_doc.filename})")
                    raise ValueError(f"Duplicate DOI detected: {candidate_doi}. Already exists in document ID {existing_doc.id}")
                else:
                    doi = candidate_doi
                    document.doi = doi
        
        # If we have a DOI, try to validate with Crossref and PubMed
        metadata = None
        pubmed_data = None
        
        if doi:
            # First try PubMed (more medical/rheumatology focused)
            logger.info(f"Trying to fetch metadata from PubMed for DOI: {doi}")
            pubmed_data = get_paper_details_by_doi(doi)
            
            # Fallback to Crossref if PubMed doesn't have it
            if not pubmed_data:
                logger.info(f"PubMed data not found, falling back to Crossref for DOI: {doi}")
                metadata = validate_doi_with_crossref(doi)
        else:
            # No DOI yet, try the standard extraction method
            metadata = extract_and_validate_doi(text)
        
        # If we can't get metadata from CrossRef, try direct extraction from text
        if not metadata:
            logger.info(f"Couldn't get metadata from CrossRef for document {document_id}, trying direct extraction")
            
            # Try to extract title directly
            if document.title and "_" in document.title and not " " in document.title:
                # Looks like a filename, try to find a better title
                title_match = re.search(r'(?:title|TITLE):?\s*([^\.]+?)(?:\n|\.)', text_sample)
                
                # Special handling for EULAR documents (common in rheumatology)
                eular_patterns = [
                    # Standard EULAR recommendation pattern
                    r'EULAR recommendations for (?:the management of |the treatment of |)(.+?)(?:\n|\.|:)',
                    # Alternative patterns seen in EULAR papers
                    r'(?:20\d{2}|updated) EULAR recommendations for (.+?)(?:\n|\.|:)',
                    r'EULAR/ACR recommendations for (.+?)(?:\n|\.|:)',
                    r'EULAR points to consider (?:for|in) (.+?)(?:\n|\.|:)',
                    r'The (?:20\d{2}|updated) EULAR (?:recommendations|points to consider) (?:for|in) (.+?)(?:\n|\.|:)'
                ]
                
                for pattern in eular_patterns:
                    eular_match = re.search(pattern, text[:5000], re.IGNORECASE)
                    if eular_match:
                        title = f"EULAR recommendations for {eular_match.group(1).strip()}"
                        # Clean title to remove any <scp> tags
                        document.title = clean_text(title)
                        # If it's an EULAR guideline, set journal to ARD if not already set
                        if not document.journal:
                            document.journal = "Annals of the Rheumatic Diseases"
                        break
                        
                # Fall back to standard title extraction if no EULAR pattern matched
                if not title_match and document.title and "_" in document.title:
                    title_match = re.search(r'(?:title|TITLE):?\s*([^\.]+?)(?:\n|\.)', text_sample)
                    
                if title_match and document.title and "_" in document.title:
                    document.title = clean_text(title_match.group(1).strip())
            
            # Try to extract authors
            author_match = re.search(r'((?:[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-zA-Z]+(?:,|;|\s+and|\s+&)\s+)+(?:[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-zA-Z]+))', text_sample)
            if author_match and not document.authors:
                document.authors = author_match.group(1).strip()
            
            # Try to extract journal
            journal_match = re.search(r'(?:journal|JOURNAL):?\s*([^\.]+?)(?:\n|\.)', text_sample)
            if not journal_match:
                # Common journal abbreviations
                journal_match = re.search(r'(?:Ann(?:als)?\.?\s+(?:of\s+)?Rheum(?:atic)?\s+Dis(?:eases)?|Arthritis\s+Rheum(?:atology)?|J(?:ournal)?\s+Rheumatol(?:ogy)?)', text_sample)
            if journal_match and not document.journal:
                document.journal = journal_match.group(0).strip()
            
            # Try to extract year
            year_match = re.search(r'\((\d{4})\)', text_sample)
            if year_match and not document.publication_date:
                year = int(year_match.group(1))
                document.publication_date = datetime.datetime(year, 1, 1)
        
        # Update document metadata if DOI validation succeeded
        elif metadata:
            # Update document with metadata from Crossref or other source
            candidate_doi = metadata.get('DOI')
            if candidate_doi:
                # Check if this DOI already exists in another document
                existing_doc = Document.query.filter(Document.doi == candidate_doi, Document.id != document_id).first()
                if existing_doc:
                    logger.warning(f"DOI {candidate_doi} already exists in document {existing_doc.id} (filename: {existing_doc.filename})")
                    raise ValueError(f"Duplicate DOI detected: {candidate_doi}. Already exists in document ID {existing_doc.id}")
                else:
                    document.doi = candidate_doi
            
            # Get title
            title = metadata.get('title')
            if title and isinstance(title, list) and len(title) > 0:
                # Use the full title, now that we've changed to TEXT type
                document.title = clean_text(title[0])
            
            # Get authors
            authors = metadata.get('author', [])
            if authors:
                author_names = []
                for author in authors:
                    given = author.get('given', '')
                    family = author.get('family', '')
                    if given and family:
                        author_names.append(f"{family}, {given}")
                    elif family:
                        author_names.append(family)
                
                if author_names:
                    document.authors = '; '.join(author_names)
            
            # Get journal
            container = metadata.get('container-title')
            if container and isinstance(container, list) and len(container) > 0:
                document.journal = container[0]
            
            # Get publication date
            published_date = None
            if 'published' in metadata and 'date-parts' in metadata['published']:
                date_parts = metadata['published']['date-parts']
                if date_parts and isinstance(date_parts, list) and len(date_parts) > 0:
                    parts = date_parts[0]
                    if len(parts) >= 3:
                        # Year, month, day
                        published_date = datetime.datetime(parts[0], parts[1], parts[2])
                    elif len(parts) == 2:
                        # Year, month
                        published_date = datetime.datetime(parts[0], parts[1], 1)
                    elif len(parts) == 1:
                        # Just year
                        published_date = datetime.datetime(parts[0], 1, 1)
            
            if published_date:
                document.publication_date = published_date
        
        # Use PubMed data if available
        if pubmed_data:
            logger.info(f"Updating document with PubMed data for document {document_id}")
            
            # Update with PubMed metadata
            # PubMed titles are already cleaned in the pubmed_integration module
            document.title = pubmed_data.get('title') or document.title
            
            if pubmed_data.get('authors'):
                document.authors = ", ".join(pubmed_data['authors'])
                
            if pubmed_data.get('journal'):
                document.journal = pubmed_data['journal']
                
            if pubmed_data.get('publication_date'):
                try:
                    if 'T' in pubmed_data['publication_date']:
                        pub_date = datetime.datetime.fromisoformat(pubmed_data['publication_date'])
                    else:
                        pub_date = datetime.datetime.strptime(pubmed_data['publication_date'], '%Y-%m-%d')
                    document.publication_date = pub_date
                except (ValueError, TypeError):
                    logger.warning(f"Failed to parse PubMed date format: {pubmed_data['publication_date']}")
            
            # Generate APA citation from PubMed data
            pubmed_citation = get_article_citation(pubmed_data)
            if pubmed_citation:
                document.citation_apa = pubmed_citation
                logger.info(f"Using PubMed citation for document {document_id}")
            else:
                # Fallback to our own citation generator
                document.citation_apa = generate_apa_citation(document)
                
            # Get PMID to fetch MeSH terms
            pmid = None
            if document.doi:  # Check that DOI is not None
                pmid = doi_to_pmid(document.doi)
            if pmid:
                logger.info(f"Found PMID: {pmid} for document {document_id}")
                pubmed_tags = generate_tags_from_pubmed(pmid)
                
                if pubmed_tags:
                    document.tags = pubmed_tags
                    logger.info(f"Using PubMed tags for document {document_id}: {', '.join(pubmed_tags)}")
                else:
                    # Fallback to our own tag generator
                    document.tags = generate_tags_from_content(text, document=document, metadata=metadata)
            else:
                # Fallback to our own tag generator
                document.tags = generate_tags_from_content(text, document=document, metadata=metadata)
                
        else:
            # No PubMed data, use our standard approach
            # Generate APA citation
            document.citation_apa = generate_apa_citation(document)
            
            # Generate tags based on content, document metadata, and Crossref data
            document.tags = generate_tags_from_content(text, document=document, metadata=metadata)
        
        # Split text into chunks
        from utils.pdf_processor import chunk_text
        chunks = chunk_text(text)
        
        # Process each chunk
        for i, chunk_content in enumerate(chunks):
            # Create text chunk record
            chunk = TextChunk(
                document_id=document.id,
                text=chunk_content,
                chunk_index=i
            )
            db.session.add(chunk)
            db.session.flush()  # Get the chunk ID
            
            # Generate embeddings
            embedding = generate_embeddings(chunk_content)
            
            if embedding:
                # Create embedding record
                vector_embedding = VectorEmbedding(
                    chunk_id=chunk.id,
                    embedding=embedding
                )
                db.session.add(vector_embedding)
        
        # Mark document as processed
        document.processed = True
        
        # Update queue entry
        queue_entry.status = 'completed'
        queue_entry.completed_at = datetime.datetime.utcnow()
        
        # Commit all changes
        db.session.commit()
        
        logger.info(f"Successfully processed document: {document_id}")
        
        return True
    
    except Exception as e:
        # Log the error
        logger.exception(f"Error processing document {document_id}: {str(e)}")
        
        # Update queue entry
        queue_entry.status = 'failed'
        queue_entry.error_message = str(e)
        
        # Rollback and try to save the error
        db.session.rollback()
        try:
            db.session.add(queue_entry)
            db.session.commit()
        except:
            logger.exception("Failed to update queue entry with error status")
        
        return False

def generate_tags_from_content(text, document=None, metadata=None):
    """
    Generate tags from document content using a multi-strategy approach
    
    Priority order:
    1. Metadata from Crossref/PubMed (if available)
    2. Explicit keywords listed in the paper
    3. Important words in title
    4. Content-based keyword extraction
    
    Args:
        text (str): The full text of the document
        document (Document, optional): The document object with metadata
        metadata (dict, optional): Metadata from Crossref/PubMed
        
    Returns:
        list: Generated tags that match our predefined tag list
    """
    import re  # Explicitly import re to avoid LSP errors
    
    # Initialize list to store tag candidates before filtering
    tag_candidates = []
    
    # STRATEGY 1: Use metadata from Crossref/PubMed if available
    if metadata:
        # Get keywords from Crossref (if available)
        if 'subject' in metadata and isinstance(metadata['subject'], list):
            # Crossref subjects are often in the form of keywords
            for subject in metadata['subject']:
                if isinstance(subject, str) and len(subject) < 50:  # Avoid extremely long subjects
                    tag_candidates.append(subject)
        
        # Some Crossref entries have explicit keywords
        if 'keyword' in metadata and isinstance(metadata['keyword'], list):
            for keyword in metadata['keyword']:
                if isinstance(keyword, str) and len(keyword) < 50:
                    tag_candidates.append(keyword)
    
    # STRATEGY 2: Look for explicit keyword sections in the text
    # Common patterns for keyword sections
    keyword_patterns = [
        # Standard format with space after period
        r'(?:key[\s-]*words?|KEYWORDS?)[\s:]+([^\n;]{5,200}?)(?:\n\n|\.\s|\.$)',
        # Format with periods directly followed by next keyword (common in some journals)
        r'(?:key[\s-]*words?|KEYWORDS?)[\s:]+([^\n;]{5,200}?)(?:\n\n|\n)',
        # Additional pattern for keywords with period separator (like "word1.word2.word3")
        r'(?:key[\s-]*words?|KEYWORDS?)[\s:]+([A-Za-z0-9\s\-.]{5,200}?)(?:\n\n|\n)',
        # MeSH terms format
        r'(?:MeSH terms?|index terms?|subject headings?)[\s:]+([^\n;]{5,200}?)(?:\n\n|\.\s|\.$)'
    ]
    
    for pattern in keyword_patterns:
        keyword_match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if keyword_match:
            keyword_text = keyword_match.group(1).strip()
            # Keywords are usually separated by commas, semicolons, or periods
            if ',' in keyword_text:
                keyword_list = [k.strip() for k in keyword_text.split(',')]
            elif ';' in keyword_text:
                keyword_list = [k.strip() for k in keyword_text.split(';')]
            elif '.' in keyword_text and keyword_text.count('.') > 1:
                # To handle period-separated keywords which need special processing
                if re.search(r'\.[A-Z]', keyword_text):
                    # Handle the format from the rheumatoid vasculitis paper
                    # First, extract the first keyword before any period
                    first_match = re.match(r'^([^.]+)', keyword_text)
                    keywords = []
                    if first_match:
                        # Extract the first keyword, before any period
                        first_keyword = first_match.group(1).strip()
                        if first_keyword and len(first_keyword) > 2:
                            keywords.append(first_keyword)
                    
                    # Then extract all keywords that start with period + capital letter
                    period_keywords = re.findall(r'\.([A-Z][^.]+)(?=\.|$)', keyword_text)
                    for kw in period_keywords:
                        kw = kw.strip()
                        if kw and len(kw) > 2:
                            keywords.append(kw)
                    
                    keyword_list = keywords
                else:
                    # For other period formats, normalize first
                    normalized = keyword_text.replace('. ', ' | ').replace(' .', ' | ').replace('.', ' | ')
                    keyword_list = [k.strip() for k in normalized.split('|') if k.strip()]
            else:
                # If no recognized separators, it might be one keyword or space-separated
                keyword_list = [keyword_text]
            
            # Add keywords found in the document
            for keyword in keyword_list:
                if len(keyword) > 2 and len(keyword) < 50:  # Avoid very short or long keywords
                    tag_candidates.append(keyword)
            
            # If we found keywords, no need to try other patterns
            if tag_candidates:
                break
    
    # STRATEGY 3: Extract important terms from title
    if document and document.title:
        title = document.title.lower()
        # Add the entire title as a candidate
        tag_candidates.append(document.title)
        
        # Add common disease and document type patterns
        important_patterns = [
            # Disease patterns
            r"(rheumatoid arthritis|systemic lupus|psoriatic arthritis|ankylosing spondylitis|osteoarthritis|gout|systemic sclerosis|vasculitis|sjogren's syndrome|polymyalgia rheumatica|polymyositis|fibromyalgia|interstitial lung disease|myositis)",
            # Study type patterns
            r"(guidelines?|recommendations?|consensus|meta-analysis|systematic review|cohort study|case report|case series|clinical trial|cross-sectional study|case-control study)"
        ]
        
        for pattern in important_patterns:
            matches = re.finditer(pattern, title)
            for match in matches:
                tag = match.group(1)
                # Capitalize first letter of each word to make tags look nicer
                tag = ' '.join(word.capitalize() for word in tag.split())
                tag_candidates.append(tag)
    
    # STRATEGY 4: Include specific sections of the document text for matching
    # First 200 chars often contain the abstract which has key terms
    if text and len(text) > 200:
        tag_candidates.append(text[:200])
    
    # Also include any paragraphs that mention "conclusion" as they often contain key concepts
    conclusion_match = re.search(r'(?:Conclusion|Summary)s?[:\s]+([^\.]+\.){1,3}', text, re.IGNORECASE)
    if conclusion_match:
        tag_candidates.append(conclusion_match.group(0))
    
    # Now use our helper function to match against predefined tags
    # This ensures we only use standardized tags from our dictionaries
    matched_tags = match_to_predefined_tags(text_content=text, tag_candidates=tag_candidates)
    
    # If no predefined tags were matched, use some general fallback tags
    if not matched_tags:
        matched_tags = ["Rheumatology", "Research Paper"]
    
    # The match_to_predefined_tags function already:
    # 1. Matches text against our standard disease/document type dictionaries
    # 2. Scores and sorts tags by relevance
    # 3. Limits to 6 tags maximum
    
    return matched_tags