/**
 * Initialize the document browser functionality
 */
function initDocumentBrowser() {
    const searchInput = document.getElementById('searchInput');
    const tagFilters = document.getElementById('tagFilters');
    const documentList = document.getElementById('documentList');
    const documentCount = document.getElementById('documentCount');
    const documentDetails = document.getElementById('documentDetails');
    const pagination = document.getElementById('pagination');
    
    // State
    let currentPage = 1;
    let totalPages = 1;
    let activeTag = null;
    let searchTerm = '';
    let documents = [];
    
    // Initial load
    loadDocuments();
    loadTags();
    
    // Handle search input
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            searchTerm = searchInput.value.trim();
            currentPage = 1;
            loadDocuments();
        }, 300));
    }
    
    /**
     * Load documents with current filters and pagination
     */
    function loadDocuments() {
        // Show loading state
        documentList.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading documents...</p>
            </div>
        `;
        
        // Build query parameters
        let params = new URLSearchParams();
        params.append('page', currentPage);
        params.append('per_page', 10);
        
        if (activeTag) {
            params.append('tag', activeTag);
        }
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        // Fetch documents
        fetch(`/api/documents?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                // Store data
                documents = data.documents;
                totalPages = data.pages;
                currentPage = data.current_page;
                
                // Update count badge
                documentCount.textContent = `${data.total} documents`;
                
                // Clear document list
                documentList.innerHTML = '';
                
                // Handle empty results
                if (documents.length === 0) {
                    documentList.innerHTML = `
                        <div class="text-center p-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <p class="text-muted">No documents found</p>
                            <a href="#uploadForm" class="btn btn-outline-primary mt-3">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-upload me-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload Documents
                            </a>
                        </div>
                    `;
                    
                    // Clear document details
                    documentDetails.innerHTML = `
                        <div class="text-center p-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <p class="text-muted">No documents found</p>
                        </div>
                    `;
                    
                    // Hide pagination
                    pagination.innerHTML = '';
                    
                    return;
                }
                
                // Render documents
                renderDocuments(documents);
                
                // Render pagination
                renderPagination();
                
                // Select first document by default
                if (documents.length > 0) {
                    showDocumentDetails(documents[0].id);
                }
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                documentList.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error loading documents.</strong> Please try again.
                    </div>
                `;
            });
    }
    
    /**
     * Render documents in the document list
     */
    function renderDocuments(documents) {
        // Clear document list
        documentList.innerHTML = '';
        
        // Create document cards
        documents.forEach(doc => {
            const tags = doc.tags ? doc.tags.slice(0, 5).map(tag => 
                `<span class="badge bg-secondary tag-badge">${escapeHtml(tag)}</span>`
            ).join('') : '';
            
            const statusIcon = doc.processed ? 
                '<span class="document-status-processed"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>' : 
                '<span class="document-status-pending"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-clock"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>';
            
            const card = document.createElement('div');
            card.className = 'card document-card mb-3';
            card.dataset.id = doc.id;
            card.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <h5 class="card-title">${escapeHtml(doc.title)}</h5>
                        ${statusIcon}
                    </div>
                    <h6 class="card-subtitle mb-2 text-muted">${escapeHtml(doc.authors || 'Unknown Authors')}</h6>
                    <p class="card-text small text-muted">
                        ${doc.journal ? `${escapeHtml(doc.journal)} - ` : ''}
                        ${formatDate(doc.publication_date || doc.upload_date)}
                    </p>
                    <div class="mt-2">
                        ${tags}
                    </div>
                </div>
            `;
            
            // Add click handler
            card.addEventListener('click', () => {
                // Remove active class from all cards
                document.querySelectorAll('.document-card').forEach(card => {
                    card.classList.remove('border-primary');
                });
                
                // Add active class to clicked card
                card.classList.add('border-primary');
                
                // Show document details
                showDocumentDetails(doc.id);
            });
            
            documentList.appendChild(card);
        });
    }
    
    /**
     * Load all available tags
     */
    function loadTags() {
        fetch('/api/tags')
            .then(response => response.json())
            .then(data => {
                renderTags(data.tags);
            })
            .catch(error => {
                console.error('Error loading tags:', error);
                tagFilters.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error loading tags.</strong> Please try again.
                    </div>
                `;
            });
    }
    
    /**
     * Render tag filters
     */
    function renderTags(tags) {
        // Clear tag filters
        tagFilters.innerHTML = '';
        
        // Handle empty tags
        if (tags.length === 0) {
            tagFilters.innerHTML = `
                <p class="text-muted">No tags available</p>
            `;
            return;
        }
        
        // Create "All" tag
        const allTag = document.createElement('span');
        allTag.className = 'badge bg-primary tag-badge active';
        allTag.textContent = 'All';
        allTag.addEventListener('click', () => {
            activeTag = null;
            updateActiveTag(null);
            currentPage = 1;
            loadDocuments();
        });
        tagFilters.appendChild(allTag);
        
        // Create tag badges
        tags.forEach(tag => {
            const badge = document.createElement('span');
            badge.className = 'badge bg-secondary tag-badge';
            badge.textContent = tag;
            badge.addEventListener('click', () => {
                activeTag = tag;
                updateActiveTag(tag);
                currentPage = 1;
                loadDocuments();
            });
            tagFilters.appendChild(badge);
        });
    }
    
    /**
     * Update the active tag in the UI
     */
    function updateActiveTag(activeTag) {
        // Remove active class from all tags
        document.querySelectorAll('.tag-badge').forEach(tag => {
            tag.classList.remove('active');
            tag.classList.remove('bg-primary');
            tag.classList.add('bg-secondary');
        });
        
        // Add active class to clicked tag or "All" if null
        if (activeTag === null) {
            const allTag = tagFilters.querySelector('.tag-badge');
            if (allTag) {
                allTag.classList.add('active');
                allTag.classList.add('bg-primary');
                allTag.classList.remove('bg-secondary');
            }
        } else {
            const tags = Array.from(tagFilters.querySelectorAll('.tag-badge'));
            const tag = tags.find(tag => tag.textContent === activeTag);
            if (tag) {
                tag.classList.add('active');
                tag.classList.add('bg-primary');
                tag.classList.remove('bg-secondary');
            }
        }
    }
    
    /**
     * Show document details
     */
    function showDocumentDetails(documentId) {
        // Show loading state
        documentDetails.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading document details...</p>
            </div>
        `;
        
        // Fetch document details
        fetch(`/api/documents/${documentId}`)
            .then(response => response.json())
            .then(doc => {
                // Format tags
                const tags = doc.tags ? doc.tags.map(tag => 
                    `<span class="badge bg-secondary tag-badge me-1">${escapeHtml(tag)}</span>`
                ).join('') : 'No tags';
                
                // Format status
                const status = doc.processed ? 
                    '<span class="badge bg-success">Processed</span>' : 
                    '<span class="badge bg-warning">Processing</span>';
                
                // Format document details
                documentDetails.innerHTML = `
                    <h5 class="mb-3">${escapeHtml(doc.title)}</h5>
                    
                    <dl class="metadata-list">
                        <dt>Authors</dt>
                        <dd>${escapeHtml(doc.authors || 'Unknown')}</dd>
                        
                        <dt>Journal</dt>
                        <dd>${escapeHtml(doc.journal || 'N/A')}</dd>
                        
                        <dt>Publication Date</dt>
                        <dd>${formatDate(doc.publication_date) || 'Unknown'}</dd>
                        
                        <dt>DOI</dt>
                        <dd>${doc.doi ? `<a href="https://doi.org/${doc.doi}" target="_blank">${doc.doi}</a>` : 'N/A'}</dd>
                        
                        <dt>Upload Date</dt>
                        <dd>${formatDate(doc.upload_date)}</dd>
                        
                        <dt>Status</dt>
                        <dd>${status}</dd>
                        
                        <dt>Tags</dt>
                        <dd class="mb-3">${tags}</dd>
                    </dl>
                    
                    ${doc.citation_apa ? `
                        <h6 class="mt-4 mb-2">Citation</h6>
                        <div class="citation-box small">
                            ${escapeHtml(doc.citation_apa)}
                        </div>
                    ` : ''}
                `;
            })
            .catch(error => {
                console.error('Error loading document details:', error);
                documentDetails.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error loading document details.</strong> Please try again.
                    </div>
                `;
            });
    }
    
    /**
     * Render pagination controls
     */
    function renderPagination() {
        // Clear pagination
        pagination.innerHTML = '';
        
        // Skip if only one page
        if (totalPages <= 1) {
            return;
        }
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `
            <a class="page-link" href="#" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        `;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                loadDocuments();
            }
        });
        pagination.appendChild(prevLi);
        
        // Page buttons
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // Ensure we show at least 5 pages if available
        if (endPage - startPage < 4 && totalPages > 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageLi.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = i;
                loadDocuments();
            });
            pagination.appendChild(pageLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `
            <a class="page-link" href="#" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        `;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                loadDocuments();
            }
        });
        pagination.appendChild(nextLi);
    }
    
    /**
     * Format a date string
     */
    function formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Unknown date';
        }
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    /**
     * Debounce function for input events
     */
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
}