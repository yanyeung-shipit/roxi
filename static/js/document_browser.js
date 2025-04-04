/**
 * Initialize the document browser functionality
 */
function initDocumentBrowser() {
    const searchInput = document.getElementById('searchInput');
    const documentList = document.getElementById('documentList');
    const documentCount = document.getElementById('documentCount');
    const documentDetails = document.getElementById('documentDetails');
    const pagination = document.getElementById('pagination');
    const collectionFilter = document.getElementById('collectionFilter');
    const uploadCollection = document.getElementById('uploadCollection');
    const actionButtons = document.querySelector('.action-buttons');
    const newCollectionButton = document.getElementById('newCollectionButton');
    const manageCollectionsButton = document.getElementById('manageCollectionsButton');
    const editDocumentButton = document.getElementById('editDocumentButton');
    const deleteDocumentButton = document.getElementById('deleteDocumentButton');
    const refreshDocumentsBtn = document.getElementById('refreshDocumentsBtn');
    
    // Multi-select elements
    const toggleMultiSelectBtn = document.getElementById('toggleMultiSelectBtn');
    const multiSelectActions = document.getElementById('multiSelectActions');
    const selectedCount = document.getElementById('selectedCount');
    const batchMoveBtn = document.getElementById('batchMoveBtn');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    
    // Modals
    const editDocumentModal = new bootstrap.Modal(document.getElementById('editDocumentModal'));
    const collectionModal = new bootstrap.Modal(document.getElementById('collectionModal'));
    const manageCollectionsModal = new bootstrap.Modal(document.getElementById('manageCollectionsModal'));
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const batchMoveModal = new bootstrap.Modal(document.getElementById('batchMoveModal'));
    const batchDeleteModal = new bootstrap.Modal(document.getElementById('batchDeleteModal'));
    
    // Modal elements
    const editDocumentId = document.getElementById('editDocumentId');
    const editDocumentTitle = document.getElementById('editDocumentTitle');
    const editDocumentAuthors = document.getElementById('editDocumentAuthors');
    const editDocumentJournal = document.getElementById('editDocumentJournal');
    const editDocumentDOI = document.getElementById('editDocumentDOI');
    const editDocumentPublicationDate = document.getElementById('editDocumentPublicationDate');
    const editDocumentTags = document.getElementById('editDocumentTags');
    const editDocumentCollection = document.getElementById('editDocumentCollection');
    const citationPreview = document.getElementById('citationPreview');
    const collectionsTableBody = document.getElementById('collectionsTableBody');
    const addCollectionBtn = document.getElementById('addCollectionBtn');
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
    const viewPdfButton = document.getElementById('viewPdfButton');
    
    // Document details OCR elements - initialized on demand in checkDocumentTextQuality()
    
    // Modal OCR elements - initialized on demand in checkDocumentTextQuality()
    const batchDeleteCount = document.getElementById('batchDeleteCount');
    const confirmBatchDeleteButton = document.getElementById('confirmBatchDeleteButton');
    
    // Multi-select state
    let multiSelectMode = false;
    let selectedDocuments = [];
    
    // State
    let currentPage = 1;
    let totalPages = 1;
    let activeCollection = '';
    let searchTerm = '';
    let documents = [];
    let collections = [];
    let currentDocumentId = null;
    let deleteType = null; // 'document' or 'collection'
    let deleteId = null;
    
    // Add event listener for refresh button
    if (refreshDocumentsBtn) {
        refreshDocumentsBtn.addEventListener('click', function() {
            // Add spinning animation to refresh button when clicked
            refreshDocumentsBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
            refreshDocumentsBtn.disabled = true;
            
            // Reload documents
            loadDocuments();
            
            // Reset button after a short delay
            setTimeout(() => {
                refreshDocumentsBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                refreshDocumentsBtn.disabled = false;
            }, 1000);
        });
    }
    
    // Toggle multi-select mode
    if (toggleMultiSelectBtn) {
        toggleMultiSelectBtn.addEventListener('click', () => {
            multiSelectMode = !multiSelectMode;
            
            // Update UI based on mode
            if (multiSelectMode) {
                // Enter multi-select mode
                toggleMultiSelectBtn.classList.add('active');
                multiSelectActions.classList.remove('d-none');
                // Hide single document action buttons
                if (actionButtons) {
                    actionButtons.classList.add('d-none');
                }
                // Clear details panel
                documentDetails.innerHTML = `
                    <div class="text-center p-5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-square mb-3"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        <p class="text-muted">Multi-select mode active</p>
                        <p class="text-muted small">Select documents to perform batch operations</p>
                    </div>
                `;
            } else {
                // Exit multi-select mode
                toggleMultiSelectBtn.classList.remove('active');
                multiSelectActions.classList.add('d-none');
                // Clear selection
                selectedDocuments = [];
                updateSelectedCount();
            }
            
            // Re-render document list to update checkboxes
            renderDocuments(documents);
        });
    }
    
    // Batch move button handler
    if (batchMoveBtn) {
        batchMoveBtn.addEventListener('click', () => {
            // Update counter in modal
            batchMoveCount.textContent = selectedDocuments.length;
            
            // Populate collections dropdown if not already done
            if (batchMoveCollection.children.length <= 1) {
                populateCollectionsDropdown(batchMoveCollection);
            }
            
            // Show modal
            batchMoveModal.show();
        });
    }
    
    // Batch delete button handler
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', () => {
            // Update counter in modal
            batchDeleteCount.textContent = selectedDocuments.length;
            
            // Show modal
            batchDeleteModal.show();
        });
    }
    
    // Confirm batch move handler
    if (confirmBatchMoveButton) {
        confirmBatchMoveButton.addEventListener('click', () => {
            // Get selected collection ID
            const collectionId = batchMoveCollection.value;
            
            // Perform batch move
            performBatchMove(selectedDocuments, collectionId);
            
            // Hide modal
            batchMoveModal.hide();
        });
    }
    
    // Confirm batch delete handler
    if (confirmBatchDeleteButton) {
        confirmBatchDeleteButton.addEventListener('click', () => {
            // Perform batch delete
            performBatchDelete(selectedDocuments);
            
            // Hide modal
            batchDeleteModal.hide();
        });
    }
    
    /**
     * Toggle document selection in multi-select mode
     */
    function toggleDocumentSelection(documentId, selected) {
        documentId = documentId.toString();
        
        if (selected) {
            // Add to selection if not already there
            if (!selectedDocuments.includes(documentId)) {
                selectedDocuments.push(documentId);
            }
        } else {
            // Remove from selection
            selectedDocuments = selectedDocuments.filter(id => id !== documentId);
        }
        
        // Update UI based on selection
        updateSelectedCount();
        
        // Add or remove selected class from card
        const card = documentList.querySelector(`.document-card[data-id="${documentId}"]`);
        if (card) {
            if (selected) {
                card.classList.add('selected-document');
            } else {
                card.classList.remove('selected-document');
            }
        }
    }
    
    /**
     * Update the selected document count and button states
     */
    function updateSelectedCount() {
        if (selectedCount) {
            selectedCount.textContent = `${selectedDocuments.length} selected`;
        }
        
        // Enable/disable batch action buttons based on selection
        if (batchMoveBtn) {
            batchMoveBtn.disabled = selectedDocuments.length === 0;
        }
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedDocuments.length === 0;
        }
    }
    
    /**
     * Perform batch move operation
     */
    function performBatchMove(documentIds, collectionId) {
        if (documentIds.length === 0) return;
        
        // Show loading state
        documentList.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Moving documents...</p>
            </div>
        `;
        
        // Call API to move documents
        fetch('/api/documents/batch/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document_ids: documentIds,
                collection_id: collectionId === '' ? null : collectionId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to move documents');
            }
            
            // Show success message
            showAlert(`Successfully moved ${documentIds.length} documents`, 'success');
            
            // Reload documents and exit multi-select mode
            multiSelectMode = false;
            selectedDocuments = [];
            toggleMultiSelectBtn.classList.remove('active');
            multiSelectActions.classList.add('d-none');
            loadDocuments();
        })
        .catch(error => {
            console.error('Error moving documents:', error);
            showAlert('Error moving documents: ' + error.message, 'danger');
            
            // Reload documents to restore state
            loadDocuments();
        });
    }
    
    /**
     * Perform batch delete operation
     */
    function performBatchDelete(documentIds) {
        if (documentIds.length === 0) return;
        
        // Show loading state
        documentList.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Deleting documents...</p>
            </div>
        `;
        
        // Call API to delete documents
        fetch('/api/documents/batch/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document_ids: documentIds
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete documents');
            }
            
            // Show success message
            showAlert(`Successfully deleted ${documentIds.length} documents`, 'success');
            
            // Reload documents and exit multi-select mode
            multiSelectMode = false;
            selectedDocuments = [];
            toggleMultiSelectBtn.classList.remove('active');
            multiSelectActions.classList.add('d-none');
            loadDocuments();
        })
        .catch(error => {
            console.error('Error deleting documents:', error);
            showAlert('Error deleting documents: ' + error.message, 'danger');
            
            // Reload documents to restore state
            loadDocuments();
        });
    }
    
    // Initial load
    loadDocuments();
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
        
        if (activeCollection) {
            params.append('collection_id', activeCollection);
        }
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        // Fetch documents
        fetch(`/api/documents?${params.toString()}`)
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
                `<span class="badge bg-secondary tag-badge" style="font-size: 0.75rem;">${escapeHtml(tag)}</span>`
            ).join('') : '';
            
            const statusIcon = doc.processed ? 
                '<span class="document-status-processed"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>' : 
                '<span class="document-status-pending"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-clock"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>';
            
            // Show collection badge if available
            let collectionBadge = '';
            if (doc.collection_id && doc.collection_name) {
                collectionBadge = `<span class="badge bg-primary collection-badge me-2" style="font-size: 0.75rem;"><i class="fas fa-folder me-1"></i>${escapeHtml(doc.collection_name)}</span>`;
            }
            
            // Check if this document is selected in multi-select mode
            const isSelected = selectedDocuments.includes(doc.id.toString());
            const multiSelectClass = isSelected ? 'selected-document' : '';
            
            const card = document.createElement('div');
            card.className = `card document-card ${multiSelectClass}`;
            card.dataset.id = doc.id;
            
            // Add checkbox for multi-select mode
            const checkboxHtml = multiSelectMode ? 
                `<div class="document-checkbox">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" ${isSelected ? 'checked' : ''}>
                    </div>
                </div>` : '';
            
            card.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="d-flex align-items-start">
                            ${checkboxHtml}
                            <div>
                                <h6 class="card-title mb-0 text-truncate" style="max-width: 400px; font-size: 0.95rem;">${escapeHtml(doc.title)}</h6>
                                <div class="d-flex mt-1">
                                    <small class="text-muted text-truncate me-2" style="max-width: 250px; font-size: 0.8rem;">${escapeHtml(doc.authors || 'Unknown Authors')}</small>
                                    <small class="text-muted" style="font-size: 0.8rem;">${formatDate(doc.publication_date || doc.upload_date)}</small>
                                </div>
                            </div>
                        </div>
                        ${statusIcon}
                    </div>
                    <div class="d-flex flex-wrap mt-1 align-items-center" style="font-size: 0.8rem;">
                        ${collectionBadge}
                        ${tags}
                    </div>
                </div>
            `;
            
            // Add click handlers
            if (multiSelectMode) {
                // In multi-select mode, clicking the card toggles selection
                card.addEventListener('click', (e) => {
                    const checkbox = card.querySelector('input[type="checkbox"]');
                    
                    // Skip if the click was directly on the checkbox (it will handle its own state)
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                        toggleDocumentSelection(doc.id, checkbox.checked);
                    }
                });
                
                // Add specific handler for the checkbox to avoid double toggling
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent the card click handler from firing
                        toggleDocumentSelection(doc.id, checkbox.checked);
                    });
                }
            } else {
                // In normal mode, clicking the card shows document details
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
            }
            
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
        fetch(`/api/documents/${documentId}`)
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
                
                // Check document text quality and OCR status
                checkDocumentTextQuality(documentId);
                
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
                        fetch(`/api/collections/${id}`)
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
    
    /**
     * Populate a collections dropdown with all available collections
     * @param {HTMLSelectElement} dropdown - The dropdown to populate
     */
    function populateCollectionsDropdown(dropdown) {
        // Clear existing options (except the first one which is usually "Select a collection" or "None")
        const firstOption = dropdown.options[0];
        dropdown.innerHTML = '';
        dropdown.appendChild(firstOption);
        
        // Add root option (no collection)
        const rootOption = document.createElement('option');
        rootOption.value = '';
        rootOption.textContent = '-- No Collection --';
        dropdown.appendChild(rootOption);
        
        // Add options for all collections
        collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            
            // Add indentation to show hierarchy
            let prefix = '';
            let parent = collection;
            let depth = 0;
            
            // Check for parent and add indentation
            while (parent.parent_id && depth < 5) {
                prefix += '— ';
                parent = collections.find(c => c.id === parent.parent_id);
                depth++;
            }
            
            option.textContent = prefix + collection.name;
            dropdown.appendChild(option);
        });
    }
    
    /**
     * Populate the collections table for the manage collections modal
     */
    function populateCollectionsTable() {
        if (!collectionsTableBody) return;
        
        // Show loading state
        collectionsTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <div class="spinner-border spinner-border-sm text-secondary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">Loading collections...</span>
                </td>
            </tr>
        `;
        
        // Get the latest collections data
        fetch('/api/collections')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load collections');
                }
                
                // Clear the table body
                collectionsTableBody.innerHTML = '';
                
                if (data.collections.length === 0) {
                    collectionsTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center">
                                <p class="text-muted my-3">No collections found</p>
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                // Add each collection to the table
                data.collections.forEach(collection => {
                    const row = document.createElement('tr');
                    
                    // Indentation based on level
                    const indentation = collection.level > 0 
                        ? `<span class="ms-${collection.level * 3}"></span>` 
                        : '';
                    const levelPrefix = collection.level > 0 ? '↳ ' : '';
                    
                    row.innerHTML = `
                        <td>${indentation}${levelPrefix}${escapeHtml(collection.name)}</td>
                        <td>${escapeHtml(collection.full_path)}</td>
                        <td>${collection.total_document_count}</td>
                        <td>
                            <div class="btn-group btn-group-sm" role="group">
                                <button type="button" class="btn btn-outline-secondary edit-collection-btn" data-id="${collection.id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button type="button" class="btn btn-outline-danger delete-collection-btn" data-id="${collection.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </td>
                    `;
                    
                    collectionsTableBody.appendChild(row);
                });
                
                // Add event listeners to the edit/delete buttons
                collectionsTableBody.querySelectorAll('.edit-collection-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.id;
                        
                        // Hide manage collections modal
                        manageCollectionsModal.hide();
                        
                        // Load collection data
                        fetch(`/api/collections/${id}`)
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
                
                collectionsTableBody.querySelectorAll('.delete-collection-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.id;
                        
                        // Hide manage collections modal
                        manageCollectionsModal.hide();
                        
                        // Setup confirmation modal
                        deleteType = 'collection';
                        deleteId = id;
                        deleteConfirmMessage.textContent = 'Are you sure you want to delete this collection? Documents in this collection will not be deleted, but they will no longer be associated with any collection. This action cannot be undone.';
                        
                        // Show confirmation modal
                        deleteConfirmModal.show();
                    });
                });
            })
            .catch(error => {
                console.error('Error loading collections:', error);
                collectionsTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center">
                            <div class="alert alert-danger">
                                <strong>Error loading collections.</strong> Please try again.
                            </div>
                        </td>
                    </tr>
                `;
            });
    }
    
    /**
     * Load collections
     */
    function loadCollections() {
        fetch('/api/collections')
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
                        const optionExists = Array.from(collectionParent.options).some(opt => opt.value === currentValue);
                        collectionParent.value = optionExists ? currentValue : "";
                    }
                }
            })
            .catch(error => {
                console.error('Error loading collections:', error);
                // Show error toast
                showAlert('Error loading collections. Please try again.', 'danger');
            });
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
    // Manage Collections Button
    if (manageCollectionsButton) {
        manageCollectionsButton.addEventListener('click', () => {
            // Populate the collections table
            populateCollectionsTable();
            // Show the modal
            manageCollectionsModal.show();
        });
    }
    
    // Add Collection button in manage collections modal
    if (addCollectionBtn) {
        addCollectionBtn.addEventListener('click', () => {
            // Hide manage collections modal
            manageCollectionsModal.hide();
            
            // Reset form and show new collection modal
            collectionId.value = '';
            collectionName.value = '';
            collectionDescription.value = '';
            collectionParent.value = '';
            
            // Update modal title
            collectionModalTitle.textContent = 'New Collection';
            
            // Hide delete button for new collections
            deleteCollectionButton.classList.add('d-none');
            
            // Show modal
            collectionModal.show();
        });
    }
    
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
            
            fetch(`/api/documents/${currentDocumentId}`)
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to load document data');
                    }
                    
                    // Fill form
                    editDocumentId.value = data.id;
                    editDocumentTitle.value = data.title || '';
                    editDocumentAuthors.value = data.authors || '';
                    editDocumentJournal.value = data.journal || '';
                    editDocumentDOI.value = data.doi || '';
                    editDocumentTags.value = data.tags ? data.tags.join(', ') : '';
                    editDocumentCollection.value = data.collection ? data.collection.id : '';
                    
                    // Format publication date for date input (YYYY-MM-DD)
                    if (data.publication_date) {
                        const date = new Date(data.publication_date);
                        const formattedDate = date.toISOString().split('T')[0];
                        editDocumentPublicationDate.value = formattedDate;
                    } else {
                        editDocumentPublicationDate.value = '';
                    }
                    
                    // Show current citation in preview
                    if (data.citation_apa) {
                        citationPreview.textContent = data.citation_apa;
                    } else {
                        citationPreview.textContent = 'Citation will be generated automatically after saving';
                    }
                    
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
    // Handle View PDF button click
    if (viewPdfButton) {
        viewPdfButton.addEventListener('click', () => {
            const docId = editDocumentId.value;
            if (docId) {
                // Open PDF in a new tab/window
                window.open(`/api/documents/${docId}/pdf`, '_blank');
            }
        });
    }

    if (saveDocumentButton) {
        saveDocumentButton.addEventListener('click', () => {
            const docId = editDocumentId.value;
            const title = editDocumentTitle.value.trim();
            const authors = editDocumentAuthors.value.trim();
            const journal = editDocumentJournal.value.trim();
            const doi = editDocumentDOI.value.trim();
            const publicationDate = editDocumentPublicationDate.value;
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
                authors: authors,
                journal: journal,
                doi: doi,
                tags: tags
            };
            
            // Add publication date if provided
            if (publicationDate) {
                data.publication_date = publicationDate;
            }
            
            if (collectionId) {
                data.collection_id = parseInt(collectionId);
            }
            
            // Update document
            fetch(`/api/documents/${docId}`, {
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
            const url = id ? `/api/collections/${id}` : '/api/collections';
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
                url = `/api/documents/${deleteId}`;
                successMessage = 'Document deleted successfully.';
            } else if (deleteType === 'collection') {
                url = `/api/collections/${deleteId}`;
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

/**
 * Check document text quality and update OCR section
 */
function checkDocumentTextQuality(documentId) {
        // Get OCR UI elements for document panel
        const documentOcrSection = document.getElementById('documentOcrSection');
        const documentOcrStatusBadge = document.getElementById('documentOcrStatusBadge');
        const documentTextQualityBadge = document.getElementById('documentTextQualityBadge');
        const documentOcrError = document.getElementById('documentOcrError');
        const documentOcrSuccess = document.getElementById('documentOcrSuccess');
        const documentOcrProgress = document.getElementById('documentOcrProgress');
        const documentApplyOcrButton = document.getElementById('documentApplyOcrButton');
        
        // Get OCR UI elements for modal
        const modalOcrSection = document.getElementById('ocrSection');
        const modalOcrStatusBadge = document.getElementById('ocrStatusBadge');
        const modalTextQualityBadge = document.getElementById('textQualityBadge');
        const modalOcrError = document.getElementById('ocrError');
        const modalOcrSuccess = document.getElementById('ocrSuccess');
        const modalOcrProgress = document.getElementById('ocrProgress');
        const modalApplyOcrButton = document.getElementById('applyOcrButton');
        
        // Reset document OCR UI elements
        if (documentOcrSection) {
            documentOcrSection.classList.add('d-none');
            documentOcrStatusBadge.classList.add('d-none');
            documentOcrError.classList.add('d-none');
            documentOcrSuccess.classList.add('d-none');
            documentOcrProgress.classList.add('d-none');
        }
        
        // Reset modal OCR UI elements
        if (modalOcrSection) {
            modalOcrSection.classList.add('d-none');
            modalOcrStatusBadge.classList.add('d-none');
            modalOcrError.classList.add('d-none');
            modalOcrSuccess.classList.add('d-none');
            modalOcrProgress.classList.add('d-none');
        }
        
        // Fetch text quality info
        fetch(`/api/documents/${documentId}/text-quality`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to get text quality information');
                }
                
                // Update UI based on text quality
                const quality = data.text_extraction_quality;
                const capitalizedQuality = quality.charAt(0).toUpperCase() + quality.slice(1);
                
                // Update document badges
                if (documentTextQualityBadge) {
                    documentTextQualityBadge.textContent = capitalizedQuality;
                }
                
                // Update modal badges
                if (modalTextQualityBadge) {
                    modalTextQualityBadge.textContent = capitalizedQuality;
                }
                
                // Get OCR status
                const ocrStatus = data.ocr_status;
                
                // Only show OCR section if text quality is limited or none
                if (quality === 'limited' || quality === 'none') {
                    // Update document panel
                    if (documentOcrSection) {
                        documentOcrSection.classList.remove('d-none');
                        
                        // Update OCR status badge if available
                        if (ocrStatus) {
                            documentOcrStatusBadge.textContent = `OCR: ${ocrStatus.charAt(0).toUpperCase() + ocrStatus.slice(1)}`;
                            documentOcrStatusBadge.classList.remove('d-none');
                            
                            // Disable button if OCR is in progress
                            documentApplyOcrButton.disabled = (ocrStatus === 'processing');
                            
                            // Show success message if OCR is completed
                            if (ocrStatus === 'completed') {
                                documentOcrSuccess.classList.remove('d-none');
                            }
                            
                            // Show error message if OCR failed
                            if (ocrStatus === 'failed' && data.ocr_error) {
                                documentOcrError.textContent = data.ocr_error;
                                documentOcrError.classList.remove('d-none');
                            }
                        }
                        
                        // Set up document OCR button event handler (only once)
                        if (!documentApplyOcrButton.hasOcrEventListener) {
                            documentApplyOcrButton.addEventListener('click', () => requestOcrProcessing(documentId, 'document'));
                            documentApplyOcrButton.hasOcrEventListener = true;
                        }
                    }
                    
                    // Update modal
                    if (modalOcrSection) {
                        modalOcrSection.classList.remove('d-none');
                        
                        // Update OCR status badge if available
                        if (ocrStatus) {
                            modalOcrStatusBadge.textContent = `OCR: ${ocrStatus.charAt(0).toUpperCase() + ocrStatus.slice(1)}`;
                            modalOcrStatusBadge.classList.remove('d-none');
                            
                            // Disable button if OCR is in progress
                            modalApplyOcrButton.disabled = (ocrStatus === 'processing');
                            
                            // Show success message if OCR is completed
                            if (ocrStatus === 'completed') {
                                modalOcrSuccess.classList.remove('d-none');
                            }
                            
                            // Show error message if OCR failed
                            if (ocrStatus === 'failed' && data.ocr_error) {
                                modalOcrError.textContent = data.ocr_error;
                                modalOcrError.classList.remove('d-none');
                            }
                        }
                        
                        // Set up modal OCR button event handler (only once)
                        if (!modalApplyOcrButton.hasOcrEventListener) {
                            modalApplyOcrButton.addEventListener('click', () => requestOcrProcessing(documentId, 'modal'));
                            modalApplyOcrButton.hasOcrEventListener = true;
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error checking document text quality:', error);
                // Don't show an alert since this is a secondary feature
            });
    }
    
    /**
     * Request OCR processing for a document
     * @param {number} documentId - The document ID
     * @param {string} source - Either 'document' or 'modal' to identify which UI to update
     */
    function requestOcrProcessing(documentId, source = 'document') {
        // Get the relevant UI elements based on source
        const ocrStatusBadge = document.getElementById(source === 'document' ? 'documentOcrStatusBadge' : 'ocrStatusBadge');
        const ocrError = document.getElementById(source === 'document' ? 'documentOcrError' : 'ocrError');
        const ocrSuccess = document.getElementById(source === 'document' ? 'documentOcrSuccess' : 'ocrSuccess');
        const ocrProgress = document.getElementById(source === 'document' ? 'documentOcrProgress' : 'ocrProgress');
        const applyOcrButton = document.getElementById(source === 'document' ? 'documentApplyOcrButton' : 'applyOcrButton');
        
        // Update UI to show processing state
        applyOcrButton.disabled = true;
        ocrProgress.classList.remove('d-none');
        ocrError.classList.add('d-none');
        ocrSuccess.classList.add('d-none');
        
        // Call API to start OCR processing
        fetch(`/api/documents/${documentId}/ocr`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to start OCR processing');
            }
            
            // If immediate processing, show result
            if (data.ocr_status === 'completed') {
                ocrSuccess.classList.remove('d-none');
                ocrProgress.classList.add('d-none');
                applyOcrButton.disabled = false;
                ocrStatusBadge.textContent = 'OCR: Completed';
                ocrStatusBadge.classList.remove('d-none');
            } 
            // If background processing, start polling
            else if (data.ocr_status === 'processing') {
                ocrStatusBadge.textContent = 'OCR: Processing';
                ocrStatusBadge.classList.remove('d-none');
                // Start polling for status updates
                pollOcrStatus(documentId, source);
            }
        })
        .catch(error => {
            console.error('Error requesting OCR processing:', error);
            ocrError.textContent = error.message;
            ocrError.classList.remove('d-none');
            ocrProgress.classList.add('d-none');
            applyOcrButton.disabled = false;
        });
    }
    
    /**
     * Poll OCR status until complete or failed
     * @param {number} documentId - The document ID
     * @param {string} source - Either 'document' or 'modal' to identify which UI to update
     */
    function pollOcrStatus(documentId, source = 'document') {
        // Get the relevant UI elements based on source
        const ocrStatusBadge = document.getElementById(source === 'document' ? 'documentOcrStatusBadge' : 'ocrStatusBadge');
        const ocrError = document.getElementById(source === 'document' ? 'documentOcrError' : 'ocrError');
        const ocrSuccess = document.getElementById(source === 'document' ? 'documentOcrSuccess' : 'ocrSuccess');
        const ocrProgress = document.getElementById(source === 'document' ? 'documentOcrProgress' : 'ocrProgress');
        const applyOcrButton = document.getElementById(source === 'document' ? 'documentApplyOcrButton' : 'applyOcrButton');
        
        const statusCheck = setInterval(() => {
            fetch(`/api/documents/${documentId}/ocr/status`)
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to get OCR status');
                    }
                    
                    const status = data.ocr_status;
                    
                    // Update status badge
                    ocrStatusBadge.textContent = `OCR: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
                    
                    // Process is complete or failed
                    if (status === 'completed' || status === 'failed') {
                        clearInterval(statusCheck);
                        ocrProgress.classList.add('d-none');
                        applyOcrButton.disabled = false;
                        
                        if (status === 'completed') {
                            ocrSuccess.classList.remove('d-none');
                            // Reload document details to show updated text
                            showDocumentDetails(documentId);
                        } else if (status === 'failed') {
                            ocrError.textContent = data.ocr_error || 'OCR processing failed';
                            ocrError.classList.remove('d-none');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error checking OCR status:', error);
                    clearInterval(statusCheck);
                    ocrError.textContent = error.message;
                    ocrError.classList.remove('d-none');
                    ocrProgress.classList.add('d-none');
                    applyOcrButton.disabled = false;
                });
        }, 3000); // Check every 3 seconds
    }

// Initialize document browser when DOM is loaded
document.addEventListener('DOMContentLoaded', initDocumentBrowser);
