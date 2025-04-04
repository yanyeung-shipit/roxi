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
    const collectionFilter = document.getElementById('collectionFilter');
    const uploadCollection = document.getElementById('uploadCollection');
    const actionButtons = document.querySelector('.action-buttons');
    const newCollectionButton = document.getElementById('newCollectionButton');
    const editDocumentButton = document.getElementById('editDocumentButton');
    const deleteDocumentButton = document.getElementById('deleteDocumentButton');
    
    // Modals
    const editDocumentModal = new bootstrap.Modal(document.getElementById('editDocumentModal'));
    const collectionModal = new bootstrap.Modal(document.getElementById('collectionModal'));
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    
    // Modal elements
    const editDocumentId = document.getElementById('editDocumentId');
    const editDocumentTitle = document.getElementById('editDocumentTitle');
    const editDocumentTags = document.getElementById('editDocumentTags');
    const editDocumentCollection = document.getElementById('editDocumentCollection');
    const saveDocumentButton = document.getElementById('saveDocumentButton');
    
    const collectionId = document.getElementById('collectionId');
    const collectionName = document.getElementById('collectionName');
    const collectionDescription = document.getElementById('collectionDescription');
    const collectionParent = document.getElementById('collectionParent');
    const collectionModalTitle = document.getElementById('collectionModalTitle');
    const saveCollectionButton = document.getElementById('saveCollectionButton');
    const deleteCollectionButton = document.getElementById('deleteCollectionButton');
    
    const deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
    const confirmDeleteButton = document.getElementById('confirmDeleteButton');
    
    // State
    let currentPage = 1;
    let totalPages = 1;
    let activeTag = null;
    let activeCollection = '';
    let searchTerm = '';
    let documents = [];
    let collections = [];
    let currentDocumentId = null;
    let deleteType = null; // 'document' or 'collection'
    let deleteId = null;
    
    // Initial load
    loadDocuments();
    loadTags();
    loadCollections();
    
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
        
        if (activeCollection) {
            params.append('collection_id', activeCollection);
        }
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        // Fetch documents
        fetch(`/documents/api/documents?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load documents');
                }
                
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
            
            // Show collection badge if available
            const collectionBadge = doc.collection 
                ? `<span class="badge bg-primary collection-badge me-2"><i class="fas fa-folder me-1"></i>${escapeHtml(doc.collection.name)}</span>` 
                : '';
            
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
                    <div class="d-flex flex-wrap mt-2 align-items-center">
                        ${collectionBadge}
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
        fetch('/documents/api/tags')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load tags');
                }
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
        // Store current document ID
        currentDocumentId = documentId;
        
        // Show loading state
        documentDetails.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading document details...</p>
            </div>
        `;
        
        // Hide action buttons while loading
        if (actionButtons) {
            actionButtons.classList.add('d-none');
        }
        
        // Fetch document details
        fetch(`/documents/api/documents/${documentId}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load document details');
                }
                
                const doc = data;
                // Format tags
                const tags = doc.tags ? doc.tags.map(tag => 
                    `<span class="badge bg-secondary tag-badge me-1">${escapeHtml(tag)}</span>`
                ).join('') : 'No tags';
                
                // Format status
                const status = doc.processed ? 
                    '<span class="badge bg-success">Processed</span>' : 
                    '<span class="badge bg-warning">Processing</span>';
                
                // Get collection info
                const collectionName = doc.collection ? 
                    `<a href="#" class="collection-link" data-collection-id="${doc.collection.id}">${escapeHtml(doc.collection.name)}</a> 
                    <a href="#" class="collection-edit-link ms-2" data-collection-id="${doc.collection.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </a>` : 
                    'None';
                
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
                        
                        <dt>Collection</dt>
                        <dd>${collectionName}</dd>
                        
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
                
                // Show action buttons
                if (actionButtons) {
                    actionButtons.classList.remove('d-none');
                }
                
                // Add click handlers for collection links
                const collectionLinks = documentDetails.querySelectorAll('.collection-link');
                collectionLinks.forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const collectionId = link.dataset.collectionId;
                        // Update collection filter
                        if (collectionFilter) {
                            collectionFilter.value = collectionId;
                            // Trigger change event
                            const event = new Event('change');
                            collectionFilter.dispatchEvent(event);
                        }
                    });
                });
                
                // Add click handlers for collection edit links
                const collectionEditLinks = documentDetails.querySelectorAll('.collection-edit-link');
                collectionEditLinks.forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const id = link.dataset.collectionId;
                        
                        // Get collection data
                        fetch(`/documents/api/collections/${id}`)
                            .then(response => response.json())
                            .then(data => {
                                if (!data.success) {
                                    throw new Error(data.error || 'Failed to load collection data');
                                }
                                
                                // Update form fields
                                collectionId.value = data.collection.id;
                                collectionName.value = data.collection.name;
                                collectionDescription.value = data.collection.description || '';
                                collectionParent.value = data.collection.parent_id || '';
                                
                                // Update modal title
                                collectionModalTitle.textContent = 'Edit Collection';
                                
                                // Show delete button for existing collections
                                deleteCollectionButton.classList.remove('d-none');
                                
                                // Show modal
                                collectionModal.show();
                            })
                            .catch(error => {
                                console.error('Error loading collection data:', error);
                                showAlert('Error loading collection data. Please try again.', 'danger');
                            });
                    });
                });
            })
            .catch(error => {
                console.error('Error loading document details:', error);
                documentDetails.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error loading document details.</strong> Please try again.
                    </div>
                `;
                
                // Hide action buttons
                if (actionButtons) {
                    actionButtons.classList.add('d-none');
                }
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
    
    /**
     * Load collections
     */
    function loadCollections() {
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load collections');
                }
                
                collections = data.collections;
                
                // Sort collections by parent_id (null first), then by level, then by name
                collections.sort((a, b) => {
                    // First sort by level
                    if (a.level !== b.level) return a.level - b.level;
                    
                    // Then by name for collections at the same level
                    return a.name.localeCompare(b.name);
                });
                
                // Update collection filters
                if (collectionFilter) {
                    // Save current value
                    const currentValue = collectionFilter.value;
                    
                    // Clear options except first one (All Collections)
                    while (collectionFilter.options.length > 1) {
                        collectionFilter.remove(1);
                    }
                    
                    // Add collection options with indentation for hierarchy
                    collections.forEach(collection => {
                        const option = document.createElement('option');
                        option.value = collection.id;
                        
                        // Add proper indentation based on level
                        const indentation = '\u00A0\u00A0\u00A0\u00A0'.repeat(collection.level);
                        const prefix = collection.level > 0 ? `${indentation}↳ ` : '';
                        
                        // Show document count
                        const docCount = collection.total_document_count > 0 ? 
                            ` (${collection.total_document_count})` : '';
                        
                        option.textContent = `${prefix}${collection.name}${docCount}`;
                        collectionFilter.appendChild(option);
                    });
                    
                    // Restore selected value if still exists
                    if (currentValue) {
                        collectionFilter.value = currentValue;
                    }
                }
                
                // Update upload collection dropdown
                if (uploadCollection) {
                    // Save current value
                    const currentValue = uploadCollection.value;
                    
                    // Clear options except first one (None)
                    while (uploadCollection.options.length > 1) {
                        uploadCollection.remove(1);
                    }
                    
                    // Add collection options with indentation for hierarchy
                    collections.forEach(collection => {
                        const option = document.createElement('option');
                        option.value = collection.id;
                        
                        // Add proper indentation based on level
                        const indentation = '\u00A0\u00A0\u00A0\u00A0'.repeat(collection.level);
                        const prefix = collection.level > 0 ? `${indentation}↳ ` : '';
                        
                        option.textContent = `${prefix}${collection.name}`;
                        uploadCollection.appendChild(option);
                    });
                    
                    // Restore selected value if still exists
                    if (currentValue) {
                        uploadCollection.value = currentValue;
                    }
                }
                
                // Update edit document collection dropdown
                if (editDocumentCollection) {
                    // Save current value
                    const currentValue = editDocumentCollection.value;
                    
                    // Clear options except first one (None)
                    while (editDocumentCollection.options.length > 1) {
                        editDocumentCollection.remove(1);
                    }
                    
                    // Add collection options with indentation for hierarchy
                    collections.forEach(collection => {
                        const option = document.createElement('option');
                        option.value = collection.id;
                        
                        // Add proper indentation based on level
                        const indentation = '\u00A0\u00A0\u00A0\u00A0'.repeat(collection.level);
                        const prefix = collection.level > 0 ? `${indentation}↳ ` : '';
                        
                        option.textContent = `${prefix}${collection.name}`;
                        editDocumentCollection.appendChild(option);
                    });
                    
                    // Restore selected value if still exists
                    if (currentValue) {
                        editDocumentCollection.value = currentValue;
                    }
                }
                
                // Update collection parent dropdown
                if (collectionParent) {
                    // Save current value
                    const currentValue = collectionParent.value;
                    
                    // Clear options except first one (None/Root)
                    while (collectionParent.options.length > 1) {
                        collectionParent.remove(1);
                    }
                    
                    // Add collection options with indentation for hierarchy
                    collections.forEach(collection => {
                        // Skip the current collection if editing (can't be its own parent)
                        if (collectionId.value && collection.id.toString() === collectionId.value) {
                            return;
                        }
                        
                        // Skip this collection's descendants if editing (avoid circular references)
                        if (collectionId.value && collectionIsDescendantOf(collection.id, parseInt(collectionId.value))) {
                            return;
                        }
                        
                        const option = document.createElement('option');
                        option.value = collection.id;
                        
                        // Add proper indentation based on level
                        const indentation = '\u00A0\u00A0\u00A0\u00A0'.repeat(collection.level);
                        const prefix = collection.level > 0 ? `${indentation}↳ ` : '';
                        
                        option.textContent = `${prefix}${collection.name}`;
                        collectionParent.appendChild(option);
                    });
                    
                    // Restore selected value if still exists
                    if (currentValue) {
                        collectionParent.value = currentValue;
                    }
                }
                
                // Sort collections for other operations
                collections.sort((a, b) => a.name.localeCompare(b.name));
            })
            .catch(error => {
                console.error('Error loading collections:', error);
                // Show error toast
                showAlert('Error loading collections. Please try again.', 'danger');
            });
    }
    
    /**
     * Check if a collection is a descendant of another collection
     * @param {number} collectionId - The ID of the collection to check
     * @param {number} potentialAncestorId - The ID of the potential ancestor
     * @returns {boolean} - True if collectionId is a descendant of potentialAncestorId
     */
    function collectionIsDescendantOf(collectionId, potentialAncestorId) {
        const collection = collections.find(c => c.id === collectionId);
        if (!collection) return false;
        
        // If this collection has the potential ancestor as parent, it's a descendant
        if (collection.parent_id === potentialAncestorId) return true;
        
        // If this collection has no parent, it's not a descendant
        if (!collection.parent_id) return false;
        
        // Recursively check if this collection's parent is a descendant
        return collectionIsDescendantOf(collection.parent_id, potentialAncestorId);
    }
    
    // Initial collections load
    loadCollections();
    
    // Add event listeners for collection filter
    if (collectionFilter) {
        collectionFilter.addEventListener('change', () => {
            activeCollection = collectionFilter.value;
            currentPage = 1;
            loadDocuments();
        });
    }
    
    // Add event listeners for modals and buttons
    
    // New Collection button
    if (newCollectionButton) {
        newCollectionButton.addEventListener('click', () => {
            // Reset form
            collectionId.value = '';
            collectionName.value = '';
            collectionDescription.value = '';
            collectionModalTitle.textContent = 'New Collection';
            // Hide delete button for new collections
            deleteCollectionButton.classList.add('d-none');
            // Show modal
            collectionModal.show();
        });
    }
    
    // Edit document button
    if (editDocumentButton) {
        editDocumentButton.addEventListener('click', () => {
            // Get current document data
            if (!currentDocumentId) {
                showAlert('No document selected.', 'warning');
                return;
            }
            
            fetch(`/documents/api/documents/${currentDocumentId}`)
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to load document data');
                    }
                    
                    // Fill form
                    editDocumentId.value = data.id;
                    editDocumentTitle.value = data.title || '';
                    editDocumentTags.value = data.tags ? data.tags.join(', ') : '';
                    editDocumentCollection.value = data.collection ? data.collection.id : '';
                    
                    // Show modal
                    editDocumentModal.show();
                })
                .catch(error => {
                    console.error('Error loading document data:', error);
                    showAlert('Error loading document data. Please try again.', 'danger');
                });
        });
    }
    
    // Delete document button
    if (deleteDocumentButton) {
        deleteDocumentButton.addEventListener('click', () => {
            if (!currentDocumentId) {
                showAlert('No document selected.', 'warning');
                return;
            }
            
            // Setup confirmation modal
            deleteType = 'document';
            deleteId = currentDocumentId;
            deleteConfirmMessage.textContent = 'Are you sure you want to delete this document? This will permanently remove the document, all its content chunks, and the associated PDF file. This action cannot be undone.';
            
            // Show confirmation modal
            deleteConfirmModal.show();
        });
    }
    
    // Save document button
    if (saveDocumentButton) {
        saveDocumentButton.addEventListener('click', () => {
            const docId = editDocumentId.value;
            const title = editDocumentTitle.value.trim();
            const tags = editDocumentTags.value.trim()
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            const collectionId = editDocumentCollection.value;
            
            if (!title) {
                showAlert('Please enter a title.', 'warning');
                return;
            }
            
            // Prepare data
            const data = {
                title: title,
                tags: tags
            };
            
            if (collectionId) {
                data.collection_id = parseInt(collectionId);
            }
            
            // Update document
            fetch(`/documents/api/documents/${docId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to update document');
                    }
                    
                    // Close modal
                    editDocumentModal.hide();
                    
                    // Reload document list
                    loadDocuments();
                    
                    // Reload document details
                    showDocumentDetails(docId);
                    
                    // Show success toast
                    showAlert('Document updated successfully.', 'success');
                })
                .catch(error => {
                    console.error('Error updating document:', error);
                    showAlert('Error updating document. Please try again.', 'danger');
                });
        });
    }
    
    // Save collection button
    if (saveCollectionButton) {
        saveCollectionButton.addEventListener('click', () => {
            const id = collectionId.value;
            const name = collectionName.value.trim();
            const description = collectionDescription.value.trim();
            const parentId = collectionParent.value;
            
            if (!name) {
                showAlert('Please enter a collection name.', 'warning');
                return;
            }
            
            // Prepare data
            const data = {
                name: name,
                description: description
            };
            
            // Add parent_id if selected
            if (parentId) {
                data.parent_id = parseInt(parentId);
            } else {
                data.parent_id = null;
            }
            
            // Create or update collection
            const url = id ? `/documents/api/collections/${id}` : '/documents/api/collections';
            const method = id ? 'PUT' : 'POST';
            
            fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to save collection');
                    }
                    
                    // Close modal
                    collectionModal.hide();
                    
                    // Reload collections
                    loadCollections();
                    
                    // Show success toast
                    showAlert(`Collection ${id ? 'updated' : 'created'} successfully.`, 'success');
                })
                .catch(error => {
                    console.error('Error saving collection:', error);
                    showAlert('Error saving collection. Please try again.', 'danger');
                });
        });
    }
    
    // Delete collection button
    if (deleteCollectionButton) {
        deleteCollectionButton.addEventListener('click', () => {
            const id = collectionId.value;
            
            if (!id) {
                showAlert('No collection selected.', 'warning');
                return;
            }
            
            // Setup confirmation modal
            deleteType = 'collection';
            deleteId = id;
            deleteConfirmMessage.textContent = 'Are you sure you want to delete this collection? Documents in this collection will not be deleted, but they will no longer be associated with any collection. This action cannot be undone.';
            
            // Hide collection modal
            collectionModal.hide();
            
            // Show confirmation modal
            deleteConfirmModal.show();
        });
    }
    
    // Delete confirmation button
    if (confirmDeleteButton) {
        confirmDeleteButton.addEventListener('click', () => {
            if (!deleteType || !deleteId) {
                showAlert('Invalid delete request.', 'warning');
                deleteConfirmModal.hide();
                return;
            }
            
            let url = '';
            let successMessage = '';
            
            if (deleteType === 'document') {
                url = `/documents/api/documents/${deleteId}`;
                successMessage = 'Document deleted successfully.';
            } else if (deleteType === 'collection') {
                url = `/documents/api/collections/${deleteId}`;
                successMessage = 'Collection deleted successfully.';
            }
            
            fetch(url, {
                method: 'DELETE'
            })
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to delete item');
                    }
                    
                    // Close modal
                    deleteConfirmModal.hide();
                    
                    if (deleteType === 'document') {
                        // Reload document list
                        loadDocuments();
                        
                        // Clear document details
                        documentDetails.innerHTML = `
                            <div class="text-center p-5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                <p class="text-muted">Document deleted</p>
                            </div>
                        `;
                        
                        // Hide action buttons
                        if (actionButtons) {
                            actionButtons.classList.add('d-none');
                        }
                        
                        // Reset current document ID
                        currentDocumentId = null;
                    } else if (deleteType === 'collection') {
                        // Reload collections
                        loadCollections();
                        
                        // Reload documents if we were filtered by the deleted collection
                        if (activeCollection === deleteId.toString()) {
                            activeCollection = '';
                            if (collectionFilter) {
                                collectionFilter.value = '';
                            }
                            loadDocuments();
                        }
                    }
                    
                    // Show success toast
                    showAlert(successMessage, 'success');
                    
                    // Reset delete state
                    deleteType = null;
                    deleteId = null;
                })
                .catch(error => {
                    console.error('Error deleting item:', error);
                    showAlert('Error deleting item. Please try again.', 'danger');
                    deleteConfirmModal.hide();
                });
        });
    }
}

// Initialize document browser when DOM is loaded
document.addEventListener('DOMContentLoaded', initDocumentBrowser);
// Initialize document browser when DOM is loaded
document.addEventListener('DOMContentLoaded', initDocumentBrowser);
