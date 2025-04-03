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
from utils.pdf_processor import extract_text_from_pdf, chunk_text
from utils.embeddings import generate_embeddings
from utils.doi_validator import extract_and_validate_doi, validate_doi_with_crossref
from utils.citation_generator import generate_apa_citation

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
                doi = eular_doi_match.group(1)
                document.doi = doi
                logger.info(f"Extracted EULAR guideline DOI: {doi}")
        
        # Try standard DOI extraction if not already found
        if not doi:
            from utils.doi_validator import DOI_WITH_PREFIX_REGEX
            doi_match = re.search(DOI_WITH_PREFIX_REGEX, text_sample, re.IGNORECASE)
            if doi_match:
                doi = doi_match.group(1)
                document.doi = doi
        
        # If we have a DOI, try to validate with Crossref and get more metadata
        metadata = None
        if doi:
            metadata = validate_doi_with_crossref(doi)
        else:
            # Otherwise try the standard extraction method
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
                        document.title = title
                        # If it's an EULAR guideline, set journal to ARD if not already set
                        if not document.journal:
                            document.journal = "Annals of the Rheumatic Diseases"
                        break
                        
                # Fall back to standard title extraction if no EULAR pattern matched
                if not title_match and document.title and "_" in document.title:
                    title_match = re.search(r'(?:title|TITLE):?\s*([^\.]+?)(?:\n|\.)', text_sample)
                    
                if title_match and document.title and "_" in document.title:
                    document.title = title_match.group(1).strip()
            
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
            document.doi = metadata.get('DOI')
            
            # Get title
            title = metadata.get('title')
            if title and isinstance(title, list) and len(title) > 0:
                # Use the full title, now that we've changed to TEXT type
                document.title = title[0]
            
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
        list: Generated tags 
    """
    import re  # Explicitly import re to avoid LSP errors
    
    tags = []
    
    # STRATEGY 1: Use metadata from Crossref/PubMed if available
    if metadata:
        # Get keywords from Crossref (if available)
        if 'subject' in metadata and isinstance(metadata['subject'], list):
            # Crossref subjects are often in the form of keywords
            for subject in metadata['subject'][:5]:  # Limit to 5 subjects
                if isinstance(subject, str) and len(subject) < 50:  # Avoid extremely long subjects
                    tags.append(subject)
        
        # Some Crossref entries have explicit keywords
        if 'keyword' in metadata and isinstance(metadata['keyword'], list):
            for keyword in metadata['keyword'][:5]:  # Limit to 5 keywords
                if isinstance(keyword, str) and len(keyword) < 50:
                    tags.append(keyword)
    
    # STRATEGY 2: Look for explicit keyword sections in the text
    if not tags:
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
                    # To handle the pattern in "Keywords Rheumatoid vasculitis .Clinical features .Pathogenesis .Investigations .Treatment .Extra-articular manifestations"
                    # We need a different approach as the periods are adjacent to words
                    
                    # Check for the specific pattern of ".Word" (period immediately followed by uppercase letter)
                    if re.search(r'\.[A-Z]', keyword_text):
                        # This is the format from the rheumatoid vasculitis paper
                        # First, extract the first keyword before any period
                        first_match = re.match(r'^([^.]+)', keyword_text)
                        keywords = []
                        if first_match:
                            # Extract the first keyword, before any period
                            first_keyword = first_match.group(1).strip()
                            if first_keyword and len(first_keyword) > 2:  # Only add if it's meaningful
                                keywords.append(first_keyword)
                        
                        # Then extract all keywords that start with period + capital letter
                        # But treat each as a separate keyword (don't keep the period)
                        period_keywords = re.findall(r'\.([A-Z][^.]+)(?=\.|$)', keyword_text)
                        for kw in period_keywords:
                            kw = kw.strip()
                            if kw and len(kw) > 2:  # Only add if it's meaningful
                                keywords.append(kw)
                        
                        keyword_list = keywords
                    else:
                        # For other period formats, use our normalized approach
                        # First, normalize by replacing ". " (period+space) with " | " (space+pipe+space)
                        normalized = keyword_text.replace('. ', ' | ')
                        
                        # Then replace " ." (space+period) with " | " (space+pipe+space)
                        normalized = normalized.replace(' .', ' | ')
                        
                        # Then replace remaining periods with pipe (this would be format 3)
                        normalized = normalized.replace('.', ' | ')
                        
                        # Split by our normalized separator
                        keyword_list = [k.strip() for k in normalized.split('|') if k.strip()]
                else:
                    # If no recognized separators, it might be one keyword or space-separated
                    keyword_list = [keyword_text]
                
                # Add keywords found in the document
                for keyword in keyword_list[:5]:  # Limit to 5 keywords
                    if len(keyword) > 2 and len(keyword) < 50:  # Avoid very short or long keywords
                        tags.append(keyword)
                
                # If we found keywords, no need to try other patterns
                if tags:
                    break
    
    # STRATEGY 3: Extract important words from title
    if document and document.title and (len(tags) < 2):
        title = document.title
        
        # Skip common words that aren't helpful as tags
        common_words = {'the', 'a', 'an', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'to', 'and', 'or', 'from'}
        
        # Look for significant noun phrases in title (diseases, treatments, etc.)
        important_patterns = [
            # Disease patterns
            r"(rheumatoid arthritis|systemic lupus|psoriatic arthritis|ankylosing spondylitis|osteoarthritis|gout|systemic sclerosis|vasculitis|sjogren's syndrome|polymyalgia rheumatica|polymyositis|fibromyalgia|interstitial lung disease)",
            # Treatment patterns
            r"(dmards?|biologics?|jak inhibitors?|corticosteroids?|nsaids?|methotrexate|hydroxychloroquine|rituximab)",
            # Study type patterns
            r"(guidelines?|recommendations?|consensus|meta-analysis|systematic review|cohort study|case report|case series|clinical trial)"
        ]
        
        for pattern in important_patterns:
            matches = re.finditer(pattern, title.lower())
            for match in matches:
                tag = match.group(1)
                # Capitalize first letter of each word to make tags look nicer
                tag = ' '.join(word.capitalize() for word in tag.split())
                if tag not in tags:
                    tags.append(tag)
        
        # If we still need more tags, extract significant words from title
        if len(tags) < 2:
            # Split title into words and filter out common words
            title_words = [word.strip('.,;:()[]{}') for word in title.split()]
            title_words = [word for word in title_words if len(word) > 3 and word.lower() not in common_words]
            
            # Add up to 2 significant words from title
            for word in title_words[:2]:
                if word and word not in tags:
                    tags.append(word)
    
    # Define dictionaries needed for tag generation and classification
    # Common rheumatology disease categories
    diseases = {
        "Rheumatoid Arthritis": ["rheumatoid arthritis", "ra ", "ra,", "ra.", "ra)", "ra-", "seropositive arthritis"],
        "Systemic Lupus Erythematosus": ["systemic lupus", "sle ", "sle,", "sle.", "sle)", "lupus nephritis", "lupus erythematosus"],
        "Psoriatic Arthritis": ["psoriatic arthritis", "psa ", "psa,", "psa.", "psa)"],
        # Remove "as" abbreviation since it's a common preposition
        "Ankylosing Spondylitis": ["ankylosing spondylitis", "axial spondyloarthritis"],
        "Osteoarthritis": ["osteoarthritis", "oa ", "oa,", "oa.", "oa)", "degenerative joint disease"],
        "Gout": ["gout", "gouty arthritis", "crystal arthropathy", "uric acid"],
        "Systemic Sclerosis": ["systemic sclerosis", "scleroderma", "sclerosis"],
        "Vasculitis": ["vasculitis", "anca", "giant cell arteritis", "takayasu", "polyarteritis"],
        "Sjögren's Syndrome": ["sjögren", "sjogren", "sicca syndrome"],
        "Polymyalgia Rheumatica": ["polymyalgia rheumatica", "pmr ", "pmr,", "pmr.", "pmr)"],
        "Polymyositis": ["polymyositis", "dermatomyositis", "inflammatory myopathy", "myositis"],
        "Fibromyalgia": ["fibromyalgia", "fibromyalgia syndrome", "fms ", "fms,", "fms.", "fms)"],
        "ILD": ["interstitial lung disease", "ild ", "ild,", "ild.", "ild)", "pulmonary fibrosis"]
    }
    
    # Treatment categories
    treatments = {
        "DMARDs": ["disease-modifying", "dmard", "conventional synthetic", "csdmard"],
        "Biologics": ["biologic", "tnf inhibitor", "tnf-alpha", "bDMARD"],
        "JAK Inhibitors": ["jak inhibitor", "janus kinase", "tofacitinib", "baricitinib", "upadacitinib"],
        "Corticosteroids": ["corticosteroid", "glucocorticoid", "prednisone", "methylprednisolone"],
        "NSAIDs": ["nsaid", "non-steroidal", "non steroidal", "anti-inflammatory", "ibuprofen", "naproxen"],
        "Methotrexate": ["methotrexate", "mtx ", "mtx,", "mtx.", "mtx)"],
        "Hydroxychloroquine": ["hydroxychloroquine", "hcq ", "hcq,", "hcq.", "hcq)", "plaquenil"],
        "Rituximab": ["rituximab", "anti-cd20"],
        "Immunosuppressants": ["immunosuppressant", "immunosuppressive", "cyclophosphamide", "azathioprine", "mycophenolate"]
    }
    
    # Document types
    document_types = {
        "Guidelines": ["guideline", "recommendation", "consensus", "eular", "acr criteria"],
        "Clinical Trial": ["clinical trial", "phase iii", "phase 3", "randomized", "randomised", "rct ", "rct,", "rct."],
        "Meta-Analysis": ["meta-analysis", "meta analysis", "systematic review"],
        "Cohort Study": ["cohort study", "longitudinal study", "observational study"],
        "Case Report": ["case report", "case series"],
        "Review": ["review", "literature review"]
    }
    
    # Store category names for later use
    all_disease_keys = list(diseases.keys())
    all_treatment_keys = list(treatments.keys())
    all_document_type_keys = list(document_types.keys())
    all_domain_keys = all_disease_keys + all_treatment_keys + all_document_type_keys
    
    # STRATEGY 4: Content-based extraction using domain knowledge
    # If we still don't have enough tags, fall back to the specialized approach
    if len(tags) < 3:
        # Convert text to lowercase for case-insensitive matching
        text_lower = text.lower()
        
        # Find matches
        content_tags = []
        tag_scores = {}  # Track how relevant each tag is based on frequency
        
        # Check for disease terms with frequency analysis
        for disease, terms in diseases.items():
            # Initialize score for this disease
            tag_scores[disease] = 0
            
            for term in terms:
                # Count occurrences of the term
                count = text_lower.count(term)
                if count > 0:
                    # Add to the score for this disease
                    tag_scores[disease] += count
        
        # Check for treatment terms with frequency analysis
        for treatment, terms in treatments.items():
            # Initialize score for this treatment
            tag_scores[treatment] = 0
            
            for term in terms:
                # Count occurrences of the term
                count = text_lower.count(term)
                if count > 0:
                    # Add to the score for this treatment
                    tag_scores[treatment] += count
        
        # Check for document type terms with frequency analysis
        for doc_type, terms in document_types.items():
            # Initialize score for this document type
            tag_scores[doc_type] = 0
            
            for term in terms:
                # Count occurrences of the term
                count = text_lower.count(term)
                if count > 0:
                    # Add to the score for this document type
                    tag_scores[doc_type] += count
        
        # Filter out tags with low scores (mentioned only a few times)
        # and sort by score (most frequently mentioned first)
        significant_tags = []
        for tag, score in sorted(tag_scores.items(), key=lambda x: x[1], reverse=True):
            # Only include tags mentioned at least 5 times - increased threshold to avoid false positives
            # This helps filter out diseases mentioned only in passing
            if score >= 5:
                significant_tags.append(tag)
        
        # Add content-based tags that aren't already in our tags list
        for tag in significant_tags[:3]:  # Limit to top 3 most significant tags
            if tag not in tags:
                tags.append(tag)
    
    # Limit to 5 tags maximum
    if len(tags) > 5:
        # If we have explicitly detected keywords, prioritize them
        explicit_keywords = []
        domain_tags = []
        
        # Determine which tags came from explicit keywords vs. domain detection
        for tag in tags:
            if tag in all_domain_keys:
                domain_tags.append(tag)
            else:
                explicit_keywords.append(tag)
        
        # Prioritize explicit keywords, then domain-specific tags
        final_tags = explicit_keywords[:3]  # Take up to 3 explicit keywords
        remaining_slots = 5 - len(final_tags)
        
        if remaining_slots > 0:
            final_tags.extend(domain_tags[:remaining_slots])
        
        tags = final_tags[:5]
    
    # If no tags were found, add some general ones
    if not tags:
        tags = ["Rheumatology", "Research Paper"]
    
    return tags