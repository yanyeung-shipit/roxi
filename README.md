# ROXI - Rheumatology Optimized eXpert Intelligence

ROXI is an intelligent scientific document processing platform leveraging Retrieval-Augmented Generation (RAG) for comprehensive rheumatology journal analysis and research insights.

## Features

- Advanced PDF document processing with intelligent metadata extraction
- Webpage crawling and content extraction capabilities
- Smart tag generation for rheumatology research
- Hierarchical collection organization for documents and webpages
- API integration with PubMed for enhanced metadata
- Automatic citation generation in APA format
- Vector search for intelligent query processing
- Interactive conversation interface
- Clean, minimalist search interface
- Tag-based document categorization with rheumatology-specific taxonomies
- Multi-select operations for document management

## Technology Stack

- Flask web framework
- PostgreSQL database with SQLAlchemy
- PDF processing with PyPDF2
- Vector embeddings for document chunks
- DOI validation and metadata enrichment
- Background processing system for document handling

## Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL
- Required Python packages listed in pyproject.toml

### Installation

1. Clone the repository
2. Install dependencies with pip
3. Set up PostgreSQL database
4. Run the application with `python main.py`

### Environment Variables

The following environment variables are required:

- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: For enhanced query analysis (optional)

## Usage

1. Upload PDF documents through the document browser interface
2. Add webpages through the webpage browser interface
3. Organize documents and webpages into collections as needed
4. Ask research questions through the main query interface
5. View document details, edit metadata, and manage tags

## Recent Updates

- Added webpage crawling and content extraction
- Fixed database constraint issue for text chunks from webpages
- Improved document browser interface with bold document titles
- Author name truncation for better readability
- Enhanced tag generation specific to rheumatology domain
- Collection management with hierarchical structure
- Multi-select functionality for bulk document operations
- Integration with PubMed for enhanced metadata

## License

MIT License

## Acknowledgments

- PubMed Central for access to research metadata
- DOI.org for DOI validation services
