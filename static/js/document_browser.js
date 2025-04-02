document.addEventListener('DOMContentLoaded', function() {
    // Initialize the document browser
    initDocumentBrowser();
});

/**
 * Initialize the document browser functionality
 */
function initDocumentBrowser() {
    const documentList = document.getElementById('document-list');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const tagContainer = document.getElementById('tag-container');
    const paginationContainer = document.getElementById('pagination-container');
    
    if (!documentList) return;
    
    // Current search and pagination state
    let currentState = {
        page: 1,
        per_page: 10,
        search: '',
        tag: '',
        total: 0,
        pages: 0
    };
    
    // Load tags for filtering
    loadTags();
    
    // Load initial documents
    loadDocuments();
    
    // Handle search button click
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', function() {
            currentState.search = searchInput.value.trim();
            currentState.page = 1; // Reset to first page on new search
            loadDocuments();
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                currentState.search = searchInput.value.trim();
                currentState.page = 1; // Reset to first page on new search
                loadDocuments();
            }
        });
    }
    
    /**
     * Load documents with current filters and pagination
     */
    function loadDocuments() {
        // Show loading state
        documentList.innerHTML = '<div class="text-center py-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        // Build query string
        const params = new URLSearchParams({
            page: currentState.page,
            per_page: currentState.per_page
        });
        
        if (currentState.search) {
            params.append('search', currentState.search);
        }
        
        if (currentState.tag) {
            params.append('tag', currentState.tag);
        }
        
        // Fetch documents
        fetch(`/documents/list?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    documentList.innerHTML = `<div class="alert alert-danger" role="alert">${data.error}</div>`;
                    return;
                }
                
                // Update pagination state
                currentState.total = data.pagination.total;
                currentState.pages = data.pagination.pages;
                
                // Render documents
                renderDocuments(data.documents);
                
                // Update pagination
                renderPagination();
            })
            .catch(error => {
                console.error('Error:', error);
                documentList.innerHTML = '<div class="alert alert-danger" role="alert">Error loading documents. Please try again later.</div>';
            });
    }
    
    /**
     * Render documents in the document list
     */
    function renderDocuments(documents) {
        if (!documents || documents.length === 0) {
            documentList.innerHTML = '<div class="alert alert-info" role="alert">No documents found. Try a different search or upload some documents.</div>';
            return;
        }
        
        // Clear the list
        documentList.innerHTML = '';
        
        // Create a card for each document
        documents.forEach(doc => {
            const docCard = document.createElement('div');
            docCard.className = 'card mb-3';
            
            // Format publication date if available
            let pubDate = 'Unknown date';
            if (doc.publication_date) {
                const date = new Date(doc.publication_date);
                pubDate = date.toLocaleDateString();
            }
            
            // Create tag badges
            const tagBadges = doc.tags && doc.tags.length > 0
                ? doc.tags.map(tag => `<span class="badge bg-secondary me-1 tag-badge" data-tag="${tag}">${tag}</span>`).join('')
                : '<span class="text-muted">No tags</span>';
            
            // Check document processing status
            const statusBadge = doc.processed
                ? '<span class="badge bg-success">Processed</span>'
                : '<span class="badge bg-warning text-dark">Processing</span>';
            
            docCard.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <h5 class="card-title">${doc.title}</h5>
                        ${statusBadge}
                    </div>
                    <h6 class="card-subtitle mb-2 text-muted">${doc.authors || 'Unknown authors'}</h6>
                    <p class="card-text">
                        ${doc.journal ? `<strong>Journal:</strong> ${doc.journal}<br>` : ''}
                        <strong>Publication Date:</strong> ${pubDate}<br>
                        ${doc.doi ? `<strong>DOI:</strong> <a href="https://doi.org/${doc.doi}" target="_blank">${doc.doi}</a>` : ''}
                    </p>
                    <div class="card-text mb-2">
                        <strong>Tags:</strong> ${tagBadges}
                    </div>
                    <div class="card-text small text-muted">
                        <strong>Citation:</strong><br>
                        ${doc.citation || 'Citation not available'}
                    </div>
                </div>
            `;
            
            // Add event listeners to tag badges
            docCard.querySelectorAll('.tag-badge').forEach(badge => {
                badge.addEventListener('click', function() {
                    const tag = this.getAttribute('data-tag');
                    currentState.tag = tag;
                    currentState.page = 1; // Reset to first page
                    
                    // Update UI to show active tag
                    updateActiveTag(tag);
                    
                    // Load documents with new tag filter
                    loadDocuments();
                });
            });
            
            documentList.appendChild(docCard);
        });
    }
    
    /**
     * Load all available tags
     */
    function loadTags() {
        if (!tagContainer) return;
        
        // Show loading state
        tagContainer.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading tags...</span></div></div>';
        
        // Fetch tags
        fetch('/documents/tags')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    tagContainer.innerHTML = '';
                    return;
                }
                
                // Render tags
                renderTags(data.tags);
            })
            .catch(error => {
                console.error('Error:', error);
                tagContainer.innerHTML = '';
            });
    }
    
    /**
     * Render tag filters
     */
    function renderTags(tags) {
        if (!tags || tags.length === 0) {
            tagContainer.innerHTML = '';
            return;
        }
        
        // Clear the container
        tagContainer.innerHTML = '<h5 class="mb-2">Filter by Tag</h5>';
        
        // Add "All" option
        const allTag = document.createElement('span');
        allTag.className = 'badge bg-primary me-1 mb-1 tag-filter active-tag';
        allTag.setAttribute('data-tag', '');
        allTag.textContent = 'All';
        allTag.addEventListener('click', function() {
            currentState.tag = '';
            currentState.page = 1;
            updateActiveTag('');
            loadDocuments();
        });
        tagContainer.appendChild(allTag);
        
        // Add tag options (limited to top 20)
        tags.slice(0, 20).forEach(tagData => {
            const tag = document.createElement('span');
            tag.className = 'badge bg-secondary me-1 mb-1 tag-filter';
            tag.setAttribute('data-tag', tagData.tag);
            tag.textContent = `${tagData.tag} (${tagData.count})`;
            tag.addEventListener('click', function() {
                currentState.tag = tagData.tag;
                currentState.page = 1;
                updateActiveTag(tagData.tag);
                loadDocuments();
            });
            tagContainer.appendChild(tag);
        });
    }
    
    /**
     * Update the active tag in the UI
     */
    function updateActiveTag(activeTag) {
        if (!tagContainer) return;
        
        // Remove active class from all tag filters
        tagContainer.querySelectorAll('.tag-filter').forEach(tag => {
            tag.classList.remove('active-tag', 'bg-primary');
            tag.classList.add('bg-secondary');
        });
        
        // Add active class to the selected tag filter
        const tagElement = tagContainer.querySelector(`.tag-filter[data-tag="${activeTag}"]`) || 
                          tagContainer.querySelector('.tag-filter[data-tag=""]');
        
        if (tagElement) {
            tagElement.classList.add('active-tag', 'bg-primary');
            tagElement.classList.remove('bg-secondary');
        }
    }
    
    /**
     * Render pagination controls
     */
    function renderPagination() {
        if (!paginationContainer) return;
        
        if (currentState.pages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        // Create pagination
        let paginationHTML = '<ul class="pagination justify-content-center">';
        
        // Previous button
        paginationHTML += `
            <li class="page-item ${currentState.page === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentState.page - 1}" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;
        
        // Page numbers
        const startPage = Math.max(1, currentState.page - 2);
        const endPage = Math.min(currentState.pages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === currentState.page ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Next button
        paginationHTML += `
            <li class="page-item ${currentState.page === currentState.pages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentState.page + 1}" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;
        
        paginationHTML += '</ul>';
        
        paginationContainer.innerHTML = paginationHTML;
        
        // Add event listeners to pagination links
        paginationContainer.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.getAttribute('data-page'));
                if (page >= 1 && page <= currentState.pages) {
                    currentState.page = page;
                    loadDocuments();
                    
                    // Scroll to top of the document list
                    documentList.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }
}
