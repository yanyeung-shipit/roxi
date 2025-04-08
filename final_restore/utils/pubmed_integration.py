"""
PubMed/PMC Integration Module

This module provides functionality to interact with PubMed and PubMed Central APIs
to retrieve metadata, citation information, and full-text content for scientific papers.

Uses the NCBI E-Utilities API:
- https://www.ncbi.nlm.nih.gov/books/NBK25500/

No API key is required for basic usage, but for production applications with
high request volumes, it's recommended to obtain a free API key from NCBI.
"""

import requests
import time
import xml.etree.ElementTree as ET
import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Union, Any

# Import the clean_text function
from utils.pdf_processor import clean_text

# Base URL for NCBI E-utilities
EUTILS_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

# API key (if provided)
API_KEY = None

def set_api_key(key: str) -> None:
    """
    Set the NCBI API key for higher request limits.
    With an API key, you can make up to 10 requests per second
    instead of the default 3 requests per second.
    
    Args:
        key (str): The NCBI API key
    """
    global API_KEY
    API_KEY = key

def _make_request(url: str, params: Dict[str, Any], max_retries: int = 2) -> Optional[requests.Response]:
    """
    Make a request to the NCBI E-utilities API with rate limiting, timeouts, and retry logic.
    
    Args:
        url (str): The API endpoint URL
        params (Dict): The query parameters
        max_retries (int): Maximum number of retries on failure
        
    Returns:
        Optional[requests.Response]: The API response or None if request failed
    """
    # Add API key if available
    if API_KEY:
        params['api_key'] = API_KEY
    
    # Adding tool and email parameters as recommended by NCBI
    params['tool'] = 'ROXI-Rheumatology'
    params['email'] = 'rheum.reviews@gmail.com'
    
    for attempt in range(max_retries + 1):
        try:
            # Add exponential backoff for retries
            if attempt > 0:
                delay = 2 ** attempt
                print(f"Retry attempt {attempt} for URL {url}, waiting {delay} seconds")
                time.sleep(delay)
                
            # Add timeouts to prevent hanging requests
            # Connect timeout of 5 seconds, read timeout of 15 seconds for better reliability
            response = requests.get(url, params=params, timeout=(5, 15))
            response.raise_for_status()
            
            # Honor rate limits - sleep for 0.33 seconds (3 requests per second)
            time.sleep(0.33)
            
            return response
            
        except requests.exceptions.Timeout:
            print(f"Timeout occurred while connecting to {url} - server may be busy")
            # Continue to next retry unless it's the last attempt
            if attempt == max_retries:
                return None
                
        except requests.exceptions.ConnectionError:
            print(f"Connection error occurred while connecting to {url} - network may be unavailable")
            # Continue to next retry unless it's the last attempt
            if attempt == max_retries:
                return None
                
        except requests.exceptions.HTTPError as e:
            print(f"HTTP error occurred while connecting to {url}: {e}")
            # If it's a 4xx client error, don't retry
            if 400 <= e.response.status_code < 500:
                return None
            # For 5xx server errors, retry unless it's the last attempt
            if attempt == max_retries:
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"Error making request to {url}: {e}")
            # Continue to next retry unless it's the last attempt
            if attempt == max_retries:
                return None
                
    # If we reach here, all retry attempts failed
    return None

def search_pubmed(query: str, retmax: int = 10) -> List[str]:
    """
    Search PubMed for articles matching a query.
    
    Args:
        query (str): The search query
        retmax (int): Maximum number of results to return
        
    Returns:
        List[str]: List of PubMed IDs (PMIDs)
    """
    # First, use esearch to find articles
    search_url = f"{EUTILS_BASE_URL}/esearch.fcgi"
    params = {
        'db': 'pubmed',
        'term': query,
        'retmode': 'json',
        'retmax': retmax
    }
    
    response = _make_request(search_url, params)
    if not response:
        return []
    
    try:
        data = response.json()
        pmids = data.get('esearchresult', {}).get('idlist', [])
        return pmids
    except (json.JSONDecodeError, KeyError):
        return []

def get_paper_details_by_pmid(pmid: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed information about a paper using its PubMed ID (PMID).
    
    Args:
        pmid (str): The PubMed ID
        
    Returns:
        Optional[Dict]: Dictionary containing paper details or None if not found
    """
    # Use esummary to get article details
    summary_url = f"{EUTILS_BASE_URL}/esummary.fcgi"
    params = {
        'db': 'pubmed',
        'id': pmid,
        'retmode': 'json'
    }
    
    response = _make_request(summary_url, params)
    if not response:
        return None
    
    try:
        data = response.json()
        result = data.get('result', {})
        if pmid not in result:
            return None
        
        article_data = result[pmid]
        
        # Extract and format author list
        authors = []
        for author in article_data.get('authors', []):
            if author.get('authtype', '') == 'Author':
                authors.append(f"{author.get('name', '')}")
        
        # Format publication date
        pub_date = None
        if 'pubdate' in article_data:
            try:
                # Handle various date formats
                date_str = article_data['pubdate']
                
                # Try common formats
                date_formats = [
                    '%Y %b %d', '%Y %b', '%Y', '%Y-%m-%d', 
                    '%Y/%m/%d', '%Y %B %d', '%Y %B'
                ]
                
                for fmt in date_formats:
                    try:
                        pub_date = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue
            except Exception:
                pub_date = None
        
        # Extract DOI from article ID list
        doi = None
        for article_id in article_data.get('articleids', []):
            if article_id.get('idtype', '') == 'doi':
                doi = article_id.get('value', '')
                break
        
        # Get MeSH terms (keywords)
        mesh_terms = []
        for term in article_data.get('meshheadinglist', []):
            mesh_terms.append(term)
        
        # Clean the title to remove <scp> tags and other formatting artifacts
        title = clean_text(article_data.get('title', ''))
        
        return {
            'pmid': pmid,
            'title': title,
            'authors': authors,
            'journal': article_data.get('fulljournalname', ''),
            'publication_date': pub_date.isoformat() if pub_date else None,
            'doi': doi,
            'abstract': article_data.get('abstract', ''),
            'keywords': mesh_terms,
            'source': 'pubmed'
        }
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error parsing PubMed response for PMID {pmid}: {e}")
        return None

def get_paper_details_by_doi(doi: str, max_retries: int = 5) -> Optional[Dict[str, Any]]:
    """
    Get paper details by searching for a DOI in PubMed, with retry logic.
    
    Args:
        doi (str): The DOI of the paper
        max_retries (int): Maximum number of retries on failure
        
    Returns:
        Optional[Dict]: Dictionary containing paper details or None if not found
    """
    if not doi:
        print("Warning: Empty DOI provided to get_paper_details_by_doi")
        return None
        
    # Clean the DOI
    doi = doi.strip().lower()
    if doi.startswith('doi:'):
        doi = doi[4:].strip()
    elif doi.startswith('https://doi.org/'):
        doi = doi[16:].strip()
        
    # Retry loop
    for attempt in range(max_retries + 1):
        try:
            # Add exponential backoff delay for retries
            if attempt > 0:
                delay = 2 ** attempt
                print(f"Retry attempt {attempt} for DOI {doi}, waiting {delay} seconds")
                time.sleep(delay)
            
            # Search for the DOI in PubMed
            search_url = f"{EUTILS_BASE_URL}/esearch.fcgi"
            params = {
                'db': 'pubmed',
                'term': f"{doi}[DOI]",
                'retmode': 'json',
                'retmax': 1
            }
            
            response = _make_request(search_url, params)
            if not response:
                continue  # Try again
            
            data = response.json()
            pmids = data.get('esearchresult', {}).get('idlist', [])
            
            if not pmids:
                print(f"DOI {doi} not found in PubMed")
                return None
                
            # Get details using the first PMID found
            pmid = pmids[0]
            paper_details = get_paper_details_by_pmid(pmid)
            
            # Successfully got the details
            if paper_details:
                return paper_details
                
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error processing DOI {doi} on attempt {attempt+1}: {e}")
            # Continue to next retry attempt
        except Exception as e:
            print(f"Unexpected error processing DOI {doi}: {e}")
            return None
    
    # If we reach here, all retry attempts failed
    print(f"Failed to get paper details for DOI {doi} after {max_retries+1} attempts")
    return None

def get_article_citation(paper_details: Dict[str, Any]) -> str:
    """
    Generate an APA citation from paper details retrieved from PubMed.
    
    Args:
        paper_details (Dict): The paper details from PubMed
        
    Returns:
        str: APA-formatted citation
    """
    try:
        # Extract needed fields
        authors = paper_details.get('authors', [])
        title = paper_details.get('title', '')
        journal = paper_details.get('journal', '')
        pub_date = paper_details.get('publication_date')
        doi = paper_details.get('doi', '')
        
        # Clean up title (remove trailing period)
        title = title.rstrip('.')
        
        # Extract year from pub_date
        year = None
        if pub_date:
            try:
                if 'T' in pub_date:
                    year = datetime.fromisoformat(pub_date).year
                else:
                    year = datetime.strptime(pub_date, '%Y-%m-%d').year
            except (ValueError, TypeError):
                year = None
                
        # If we couldn't extract year from pub_date, look for it in raw data
        if not year and 'pubdate' in paper_details:
            year_match = re.search(r'\b(19|20)\d{2}\b', paper_details['pubdate'])
            if year_match:
                year = year_match.group(0)
        
        # Format authors according to APA style
        formatted_authors = ''
        if authors:
            if len(authors) == 1:
                formatted_authors = authors[0]
            elif len(authors) <= 7:
                formatted_authors = ', '.join(authors[:-1]) + ', & ' + authors[-1]
            else:
                # More than 7 authors: first 6, then et al.
                formatted_authors = ', '.join(authors[:6]) + ', et al.'
        
        # Build citation
        citation = ''
        if formatted_authors:
            citation += formatted_authors
        
        if year:
            citation += f" ({year})."
        else:
            citation += " (n.d.)."
            
        if title:
            citation += f" {title}."
            
        if journal:
            citation += f" {journal}"
            # Add volume, issue, pages if available
            if 'volume' in paper_details:
                citation += f", {paper_details['volume']}"
                
            if 'issue' in paper_details:
                citation += f"({paper_details['issue']})"
                
            if 'pages' in paper_details:
                citation += f", {paper_details['pages']}"
                
            citation += "."
            
        if doi:
            citation += f" https://doi.org/{doi}"
            
        return citation
    except Exception as e:
        print(f"Error generating citation: {e}")
        return ""

def get_mesh_terms_for_rheumatology(pmid: str) -> List[str]:
    """
    Get rheumatology-relevant MeSH terms for a PubMed article.
    Filters for terms related to rheumatology conditions and concepts.
    
    Args:
        pmid (str): The PubMed ID
        
    Returns:
        List[str]: List of relevant MeSH terms
    """
    # Use EFetch to get full MeSH term data in XML format
    fetch_url = f"{EUTILS_BASE_URL}/efetch.fcgi"
    params = {
        'db': 'pubmed',
        'id': pmid,
        'retmode': 'xml'
    }
    
    response = _make_request(fetch_url, params)
    if not response:
        return []
    
    try:
        # Parse XML response
        root = ET.fromstring(response.text)
        
        # Find all MeSH headings
        mesh_terms = []
        for mesh_heading in root.findall('.//MeshHeading'):
            descriptor = mesh_heading.find('./DescriptorName')
            if descriptor is not None:
                term = descriptor.text
                # Check if it's a major topic
                is_major = descriptor.get('MajorTopicYN') == 'Y'
                
                # Get qualifiers (subheadings)
                qualifiers = []
                for qualifier in mesh_heading.findall('./QualifierName'):
                    qualifiers.append(qualifier.text)
                    
                mesh_terms.append({
                    'term': term,
                    'is_major': is_major,
                    'qualifiers': qualifiers
                })
        
        # Filter for rheumatology-relevant terms
        rheumatology_terms = []
        
        # List of rheumatology-relevant MeSH terms to check
        rheum_relevant_terms = [
            'Rheumatic Diseases', 'Rheumatoid Arthritis', 'Arthritis, Rheumatoid',
            'Lupus Erythematosus, Systemic', 'Spondylarthritis', 'Spondylarthropathies',
            'Spondylitis, Ankylosing', 'Psoriatic Arthritis', 'Arthritis, Psoriatic',
            'Sjögren\'s Syndrome', 'Scleroderma, Systemic', 'Polymyositis',
            'Dermatomyositis', 'Vasculitis', 'Gout', 'Osteoarthritis',
            'Polymyalgia Rheumatica', 'Fibromyalgia', 'Raynaud Disease',
            'Behçet Syndrome', 'Giant Cell Arteritis', 'Antiphospholipid Syndrome',
            'Mixed Connective Tissue Disease', 'Autoimmune Diseases', 'Interstitial Lung Disease',
            'ILD', 'Lung Diseases, Interstitial'
        ]
        
        # Extract relevant terms
        for mesh_item in mesh_terms:
            term = mesh_item['term']
            term_lower = term.lower()
            
            # Direct match with rheumatology terms (case-insensitive)
            for rheum_term in rheum_relevant_terms:
                if term_lower == rheum_term.lower():
                    # Use the standardized format from our list
                    rheumatology_terms.append(rheum_term)
                    break
            else:  # This else belongs to the for loop - it runs if no break occurs
                # Check for rheumatology-related qualifiers
                if any(qual in ['immunology', 'pathology', 'diagnosis', 'therapy'] 
                     for qual in mesh_item['qualifiers']):
                    rheumatology_terms.append(term)
                
        return list(set(rheumatology_terms))  # Remove duplicates
                
    except Exception as e:
        print(f"Error extracting MeSH terms for PMID {pmid}: {e}")
        return []

def generate_tags_from_pubmed(pmid: str) -> List[str]:
    """
    Generate document tags using PubMed MeSH terms and other metadata.
    Ensures that tags are matched against our predefined list of allowed tags.
    
    Args:
        pmid (str): The PubMed ID
        
    Returns:
        List[str]: Generated tags that match our predefined tag list
    """
    # Import our tag matching function from document_processor
    from utils.document_processor import match_to_predefined_tags
    
    # Get paper details first
    paper_details = get_paper_details_by_pmid(pmid)
    if not paper_details:
        return []
    
    # Get rheumatology-specific MeSH terms
    rheum_terms = get_mesh_terms_for_rheumatology(pmid)
    
    # Extract title and abstract for text analysis
    title = paper_details.get('title', '')
    abstract = paper_details.get('abstract', '')
    
    # Create tag candidates list from MeSH terms
    tag_candidates = rheum_terms.copy()
    
    # Add title and abstract as candidates
    if title:
        tag_candidates.append(title)
    if abstract:
        tag_candidates.append(abstract)
    
    # Add individual MeSH keywords from the paper if available
    if 'keywords' in paper_details and isinstance(paper_details['keywords'], list):
        for keyword in paper_details['keywords']:
            if isinstance(keyword, str):
                tag_candidates.append(keyword)
    
    # Use our standardized tag matching function to match against predefined tags
    matched_tags = match_to_predefined_tags(
        text_content=f"{title} {abstract}",
        tag_candidates=tag_candidates
    )
    
    # The match_to_predefined_tags function already:
    # 1. Matches text against our standard disease/document type dictionaries
    # 2. Scores and sorts tags by relevance
    # 3. Limits to 6 tags maximum
    
    return matched_tags

def doi_to_pmid(doi: str, max_retries: int = 3) -> Optional[str]:
    """
    Convert a DOI to a PubMed ID (PMID) by searching PubMed, with retry logic.
    
    Args:
        doi (str): The DOI to look up
        max_retries (int): Maximum number of retries on failure
        
    Returns:
        Optional[str]: The corresponding PMID or None if not found
    """
    if not doi:
        print("Warning: Empty DOI provided to doi_to_pmid")
        return None
        
    # Clean the DOI
    doi = doi.strip().lower()
    if doi.startswith('doi:'):
        doi = doi[4:].strip()
    elif doi.startswith('https://doi.org/'):
        doi = doi[16:].strip()
    
    # Retry loop    
    for attempt in range(max_retries + 1):
        try:
            # Add exponential backoff delay for retries
            if attempt > 0:
                delay = 2 ** attempt
                print(f"Retry attempt {attempt} for DOI lookup {doi}, waiting {delay} seconds")
                time.sleep(delay)
                
            # Search for the DOI in PubMed
            search_url = f"{EUTILS_BASE_URL}/esearch.fcgi"
            params = {
                'db': 'pubmed',
                'term': f"{doi}[DOI]",
                'retmode': 'json',
                'retmax': 1
            }
            
            response = _make_request(search_url, params)
            if not response:
                continue  # Try again
            
            data = response.json()
            pmids = data.get('esearchresult', {}).get('idlist', [])
            
            if not pmids:
                print(f"DOI {doi} not found in PubMed (no PMID match)")
                return None
                
            # Successfully got the PMID
            pmid = pmids[0]
            print(f"Successfully found PMID {pmid} for DOI {doi}")
            return pmid
            
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error processing DOI {doi} on attempt {attempt+1}: {e}")
            # Continue to next retry attempt
        except Exception as e:
            print(f"Unexpected error looking up PMID for DOI {doi}: {e}")
            return None
    
    # If we reach here, all retry attempts failed
    print(f"Failed to get PMID for DOI {doi} after {max_retries+1} attempts")
    return None

def pmid_to_pmc_id(pmid: str) -> Optional[str]:
    """
    Convert a PubMed ID (PMID) to a PubMed Central ID (PMCID)
    to check if full text is available in PMC.
    
    Args:
        pmid (str): The PubMed ID
        
    Returns:
        Optional[str]: The corresponding PMCID or None if not available
    """
    # Use ELink to check for PMC links
    elink_url = f"{EUTILS_BASE_URL}/elink.fcgi"
    params = {
        'dbfrom': 'pubmed',
        'db': 'pmc',
        'id': pmid,
        'retmode': 'json'
    }
    
    response = _make_request(elink_url, params)
    if not response:
        return None
    
    try:
        data = response.json()
        link_sets = data.get('linksets', [])
        
        if not link_sets or not link_sets[0].get('linksetdbs'):
            return None
            
        pmc_links = [db for db in link_sets[0].get('linksetdbs', []) 
                     if db.get('linkname') == 'pubmed_pmc']
        
        if not pmc_links or not pmc_links[0].get('links'):
            return None
            
        # Return the first PMC ID
        return str(pmc_links[0]['links'][0])
    except (json.JSONDecodeError, KeyError, IndexError):
        return None

def get_full_text_from_pmc(pmcid: str) -> Optional[str]:
    """
    Get the full text of an article from PubMed Central if available.
    
    Args:
        pmcid (str): The PubMed Central ID (with or without the "PMC" prefix)
        
    Returns:
        Optional[str]: The full text content or None if not available
    """
    # Add PMC prefix if not present
    if not pmcid.startswith('PMC'):
        pmcid = f"PMC{pmcid}"
        
    # Use EFetch to get the full text in XML format
    fetch_url = f"{EUTILS_BASE_URL}/efetch.fcgi"
    params = {
        'db': 'pmc',
        'id': pmcid,
        'retmode': 'xml'
    }
    
    response = _make_request(fetch_url, params)
    if not response:
        return None
    
    try:
        # Parse XML response
        root = ET.fromstring(response.text)
        
        # Extract all paragraphs from the article
        paragraphs = []
        for p in root.findall('.//p'):
            # Get all text content from the paragraph, including nested elements
            text = ''.join(p.itertext()).strip()
            if text:
                paragraphs.append(text)
                
        return '\n\n'.join(paragraphs)
    except Exception as e:
        print(f"Error extracting full text for PMCID {pmcid}: {e}")
        return None