/**
 * Initialize the document browser functionality
 */
function initDocumentBrowser() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const documentList = document.getElementById('documentList');
    const documentCount = document.getElementById('documentCount');
    const documentDetails = document.getElementById('documentDetails');
    const pagination = document.getElementById('pagination');
    const filterCollection = document.getElementById('filterCollection');
    const uploadCollection = document.getElementById('uploadCollection');
    const actionButtons = document.querySelector('.action-buttons');
    const editDocumentButton = document.getElementById('editDocumentButton');
    const deleteDocumentButton = document.getElementById('deleteDocumentButton');
    const viewPdfButton = document.getElementById('viewPdfButton');
    const refreshButton = document.getElementById('refreshButton');
    const totalDocuments = document.getElementById('totalDocuments');
    const processingQueue = document.getElementById('processingQueue');
    
    // Multi-select elements
    const batchMoveButton = document.getElementById('batchMoveButton');
    const batchDeleteButton = document.getElementById('batchDeleteButton');
    const moveDocumentsCount = document.getElementById('moveDocumentsCount');
    const deleteDocumentsCount = document.getElementById('deleteDocumentsCount');
    
    // OCR elements
    const ocrStatusSection = document.querySelector('.ocr-status-section');
    const textQualityInfo = document.getElementById('textQualityInfo');
    const ocrSection = document.getElementById('ocrSection');
    const ocrStatus = document.getElementById('ocrStatus');
    const ocrButtonContainer = document.getElementById('ocrButtonContainer');
    const requestOcrButton = document.getElementById('requestOcrButton');
    
    // Modals
    const editDocumentModal = new bootstrap.Modal(document.getElementById('editDocumentModal'));
    const createCollectionModal = new bootstrap.Modal(document.getElementById('createCollectionModal'));
    const editCollectionModal = new bootstrap.Modal(document.getElementById('editCollectionModal'));
    const moveDocumentsModal = new bootstrap.Modal(document.getElementById('moveDocumentsModal'));
    const deleteDocumentsModal = new bootstrap.Modal(document.getElementById('deleteDocumentsModal'));
    
    // State
    let currentPage = 1;
    let totalPages = 1;
    let activeCollection = '';
    let searchTerm = '';
    let documents = [];
    let collections = [];
    let selectedDocuments = [];
    let currentDocumentId = null;
    
    // Initialize event listeners
    
    // Search input on enter key
    if (searchInput) {
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                searchTerm = searchInput.value.trim();
                currentPage = 1;
                loadDocuments();
            }
        });
    }
    
    // Search button click
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            searchTerm = searchInput.value.trim();
            currentPage = 1;
            loadDocuments();
        });
    }
    
    // Collection filter change
    if (filterCollection) {
        filterCollection.addEventListener('change', function() {
            activeCollection = filterCollection.value;
            currentPage = 1;
            loadDocuments();
        });
    }
    
    // Edit document button
    if (editDocumentButton) {
        editDocumentButton.addEventListener('click', function() {
            if (currentDocumentId) {
                openEditModal(currentDocumentId);
            }
        });
    }
    
    // Delete document button
    if (deleteDocumentButton) {
        deleteDocumentButton.addEventListener('click', function() {
            if (currentDocumentId) {
                if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
                    deleteDocument(currentDocumentId);
                }
            }
        });
    }
    
    // View PDF button
    if (viewPdfButton) {
        viewPdfButton.addEventListener('click', function() {
            if (currentDocumentId) {
                window.open(`/documents/api/documents/${currentDocumentId}/pdf`, '_blank');
            }
        });
    }
    
    // Request OCR button
    if (requestOcrButton) {
        requestOcrButton.addEventListener('click', function() {
            if (currentDocumentId) {
                requestOcrProcessing(currentDocumentId);
            }
        });
    }
    
    // Initial data load
    loadDocuments();
    loadCollections();
    updateSystemStats();
    
    // Refresh button
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            loadDocuments();
            updateSystemStats();
            refreshButton.innerHTML = '<i class="fas fa-sync fa-spin"></i> Refresh';
            setTimeout(() => {
                refreshButton.innerHTML = '<i class="fas fa-sync"></i> Refresh';
            }, 1000);
        });
    }
    
    // Document selection for batch operations
    document.addEventListener('click', function(e) {
        const checkbox = e.target.closest('.document-checkbox');
        if (checkbox) {
            const documentId = checkbox.dataset.id;
            const isChecked = checkbox.checked;
            
            if (isChecked) {
                if (!selectedDocuments.includes(documentId)) {
                    selectedDocuments.push(documentId);
                }
            } else {
                selectedDocuments = selectedDocuments.filter(id => id !== documentId);
            }
            
            updateBatchButtons();
        }
    });
    
    // Batch move button
    if (batchMoveButton) {
        batchMoveButton.addEventListener('click', function() {
            if (selectedDocuments.length > 0) {
                moveDocumentsCount.textContent = selectedDocuments.length;
                populateCollectionDropdown('targetCollection');
                moveDocumentsModal.show();
            }
        });
    }
    
    // Batch delete button
    if (batchDeleteButton) {
        batchDeleteButton.addEventListener('click', function() {
            if (selectedDocuments.length > 0) {
                deleteDocumentsCount.textContent = selectedDocuments.length;
                deleteDocumentsModal.show();
            }
        });
    }
    
    // Confirm batch move
    const confirmMoveButton = document.getElementById('confirmMoveButton');
    if (confirmMoveButton) {
        confirmMoveButton.addEventListener('click', function() {
            const targetCollection = document.getElementById('targetCollection').value;
            batchMoveDocuments(selectedDocuments, targetCollection);
            moveDocumentsModal.hide();
        });
    }
    
    // Confirm batch delete
    const confirmBatchDeleteButton = document.getElementById('confirmBatchDeleteButton');
    if (confirmBatchDeleteButton) {
        confirmBatchDeleteButton.addEventListener('click', function() {
            batchDeleteDocuments(selectedDocuments);
            deleteDocumentsModal.hide();
        });
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
                documentCount.textContent = data.total;
                
                // Clear document list
                documentList.innerHTML = '';
                
                // Handle empty results
                if (documents.length === 0) {
                    documentList.innerHTML = `
                        <div class="text-center p-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search mb-3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <p class="text-muted">No documents found</p>
                            ${searchTerm ? `<p class="text-muted small">Try a different search term</p>` : ''}
                        </div>
                    `;
                    
                    // Hide pagination
                    pagination.innerHTML = '';
                    
                    return;
                }
                
                // Render documents
                renderDocuments(documents);
                
                // Render pagination
                renderPagination(currentPage, totalPages);
                
                // Clear document details if current document is no longer in the list
                if (currentDocumentId && !documents.some(doc => doc.id == currentDocumentId)) {
                    clearDocumentDetails();
                }
                
                // Update selected documents
                updateBatchButtons();
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                documentList.innerHTML = `
                    <div class="text-center p-5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-circle mb-3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <p class="text-danger">Error loading documents</p>
                        <p class="text-muted small">${error.message}</p>
                    </div>
                `;
            });
    }
    
    /**
     * Render documents in the list
     */
    function renderDocuments(documents) {
        documentList.innerHTML = '';
        
        documents.forEach(doc => {
            const isSelected = selectedDocuments.includes(doc.id.toString());
            
            // Create document card
            const card = document.createElement('div');
            card.className = `document-card ${isSelected ? 'selected-document' : ''}`;
            card.dataset.id = doc.id;
            
            // Format publication date
            let formattedDate = '';
            if (doc.publication_date) {
                const date = new Date(doc.publication_date);
                formattedDate = date.toLocaleDateString();
            }
            
            // Format tags
            let tagsHtml = '';
            if (doc.tags && doc.tags.length > 0) {
                tagsHtml = `
                    <div class="document-tags">
                        ${doc.tags.slice(0, 3).map(tag => `<span class="badge bg-secondary">${tag}</span>`).join(' ')}
                        ${doc.tags.length > 3 ? `<span class="badge bg-secondary">+${doc.tags.length - 3}</span>` : ''}
                    </div>
                `;
            }
            
            // Show processing status if not processed
            let processingStatus = '';
            if (!doc.processed) {
                processingStatus = `
                    <div class="processing-badge">
                        <span class="badge bg-warning text-dark">
                            <i class="fas fa-sync-alt fa-spin"></i> Processing
                        </span>
                    </div>
                `;
            }
            
            // Create card content
            card.innerHTML = `
                <div class="document-select">
                    <input type="checkbox" class="document-checkbox" data-id="${doc.id}" ${isSelected ? 'checked' : ''}>
                </div>
                <div class="document-content" onclick="showDocumentDetails(${doc.id})">
                    <div class="document-header">
                        <h5 class="document-title">${doc.title || 'Untitled Document'}</h5>
                        ${processingStatus}
                    </div>
                    <div class="document-authors">${doc.authors || ''}</div>
                    <div class="document-meta">
                        <span class="document-journal">${doc.journal || ''}</span>
                        ${formattedDate ? `<span class="document-date">${formattedDate}</span>` : ''}
                    </div>
                    ${tagsHtml}
                </div>
            `;
            
            documentList.appendChild(card);
        });
    }
    
    /**
     * Update the batch operation buttons based on selection
     */
    function updateBatchButtons() {
        if (batchMoveButton && batchDeleteButton) {
            if (selectedDocuments.length > 0) {
                batchMoveButton.classList.remove('disabled');
                batchDeleteButton.classList.remove('disabled');
            } else {
                batchMoveButton.classList.add('disabled');
                batchDeleteButton.classList.add('disabled');
            }
        }
    }
    
    /**
     * Render pagination controls
     */
    function renderPagination(currentPage, totalPages) {
        pagination.innerHTML = '';
        
        if (totalPages <= 1) {
            return;
        }
        
        // Create pagination list
        const paginationHtml = `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
            ${getPaginationItems(currentPage, totalPages)}
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;
        
        pagination.innerHTML = paginationHtml;
        
        // Add click event listeners to pagination links
        pagination.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page);
                if (page >= 1 && page <= totalPages) {
                    currentPage = page;
                    loadDocuments();
                }
            });
        });
    }
    
    /**
     * Generate pagination item HTML
     */
    function getPaginationItems(currentPage, totalPages) {
        let items = '';
        
        // Show max 5 page numbers, centered around current page
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // Adjust start if we're near the end
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            items += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        return items;
    }
    
    /**
     * Load collections for dropdown and tree view
     */
    function loadCollections() {
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load collections');
                }
                
                collections = data.collections;
                
                // Populate collection dropdowns
                populateCollectionDropdown('filterCollection');
                populateCollectionDropdown('uploadCollection');
                
                // Render collections tree
                renderCollectionsTree(collections);
            })
            .catch(error => {
                console.error('Error loading collections:', error);
            });
    }
    
    /**
     * Populate a collection dropdown
     */
    function populateCollectionDropdown(elementId) {
        const dropdown = document.getElementById(elementId);
        if (!dropdown) return;
        
        // Save current selection
        const currentValue = dropdown.value;
        
        // Clear dropdown
        dropdown.innerHTML = '<option value="">None</option>';
        
        // Add collections as options
        collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = collection.full_path || collection.name;
            dropdown.appendChild(option);
        });
        
        // Restore selection if it still exists
        if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
            dropdown.value = currentValue;
        }
    }
    
    /**
     * Render collections as a tree view
     */
    function renderCollectionsTree(collections) {
        const collectionsTree = document.getElementById('collectionsTree');
        if (!collectionsTree) return;
        
        // Build tree data structure
        const rootCollections = collections.filter(c => !c.parent_id);
        const childMap = {};
        
        collections.forEach(c => {
            if (c.parent_id) {
                if (!childMap[c.parent_id]) {
                    childMap[c.parent_id] = [];
                }
                childMap[c.parent_id].push(c);
            }
        });
        
        // Render tree
        collectionsTree.innerHTML = '';
        
        // Add root level
        const rootItem = document.createElement('div');
        rootItem.className = 'collection-item';
        rootItem.innerHTML = `
            <div class="collection-link ${!activeCollection ? 'active' : ''}" data-id="">
                <i class="fas fa-book mr-2"></i> All Documents
                <span class="collection-count badge bg-secondary ms-2">
                    ${collections.reduce((sum, c) => sum + c.document_count, 0)}
                </span>
            </div>
        `;
        collectionsTree.appendChild(rootItem);
        
        // Add each root collection
        rootCollections.forEach(collection => {
            const collectionNode = renderCollectionNode(collection, childMap, 0);
            collectionsTree.appendChild(collectionNode);
        });
        
        // Add event listeners to collection items
        collectionsTree.querySelectorAll('.collection-link').forEach(link => {
            link.addEventListener('click', function() {
                const id = this.dataset.id;
                activeCollection = id;
                
                // Update active state
                collectionsTree.querySelectorAll('.collection-link').forEach(l => {
                    l.classList.remove('active');
                });
                this.classList.add('active');
                
                // Update filter dropdown
                if (filterCollection) {
                    filterCollection.value = id;
                }
                
                // Reload documents
                currentPage = 1;
                loadDocuments();
            });
        });
        
        // Add collection management buttons
        collectionsTree.querySelectorAll('.collection-actions').forEach(actionsContainer => {
            const collectionId = actionsContainer.dataset.id;
            
            // Edit button
            actionsContainer.querySelector('.edit-collection').addEventListener('click', function(e) {
                e.stopPropagation();
                const collection = collections.find(c => c.id == collectionId);
                if (collection) {
                    openEditCollectionModal(collection);
                }
            });
        });
    }
    
    /**
     * Render a single collection node and its children
     */
    function renderCollectionNode(collection, childMap, level) {
        const hasChildren = childMap[collection.id] && childMap[collection.id].length > 0;
        
        const node = document.createElement('div');
        node.className = 'collection-item';
        node.style.paddingLeft = `${level * 16}px`;
        
        node.innerHTML = `
            <div class="collection-link ${activeCollection == collection.id ? 'active' : ''}" data-id="${collection.id}">
                <i class="fas fa-folder mr-2"></i> ${collection.name}
                <span class="collection-count badge bg-secondary ms-2">
                    ${collection.document_count || 0}
                </span>
                <div class="collection-actions" data-id="${collection.id}">
                    <button class="btn btn-sm btn-link edit-collection" title="Edit Collection">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Add children if any
        if (hasChildren) {
            const childContainer = document.createElement('div');
            childContainer.className = 'collection-children';
            
            childMap[collection.id].forEach(child => {
                const childNode = renderCollectionNode(child, childMap, level + 1);
                childContainer.appendChild(childNode);
            });
            
            node.appendChild(childContainer);
        }
        
        return node;
    }
    
    /**
     * Show document details
     */
    window.showDocumentDetails = function(documentId) {
        currentDocumentId = documentId;
        
        // Show loading state
        documentDetails.innerHTML = `
            <div class="text-center p-3">
                <div class="spinner-border spinner-border-sm text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading document details...</p>
            </div>
        `;
        
        // Show action buttons
        actionButtons.classList.remove('d-none');
        
        // Hide OCR section initially
        if (ocrStatusSection) {
            ocrStatusSection.classList.add('d-none');
        }
        
        // Fetch document details
        fetch(`/documents/api/documents/${documentId}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load document details');
                }
                
                const doc = data.document;
                
                // Format publication date
                let formattedDate = '';
                if (doc.publication_date) {
                    const date = new Date(doc.publication_date);
                    formattedDate = date.toLocaleDateString();
                }
                
                // Format upload date
                let formattedUploadDate = '';
                if (doc.upload_date) {
                    const date = new Date(doc.upload_date);
                    formattedUploadDate = date.toLocaleDateString();
                }
                
                // Format tags
                let tagsHtml = '';
                if (doc.tags && doc.tags.length > 0) {
                    tagsHtml = `
                        <div class="document-tags mb-3">
                            ${doc.tags.map(tag => `<span class="badge bg-secondary me-1 mb-1">${tag}</span>`).join('')}
                        </div>
                    `;
                }
                
                // Determine processing status
                let processingStatus = '';
                if (!doc.processed) {
                    processingStatus = `
                        <div class="alert alert-warning">
                            <i class="fas fa-sync-alt fa-spin mr-2"></i>
                            This document is still being processed. Some features may be limited until processing is complete.
                        </div>
                    `;
                }
                
                // Format collection
                let collectionPath = 'None';
                if (doc.collection) {
                    collectionPath = doc.collection.full_path || doc.collection.name;
                }
                
                // Render document details
                documentDetails.innerHTML = `
                    ${processingStatus}
                    <h4 class="mb-3">${doc.title || 'Untitled Document'}</h4>
                    
                    <div class="mb-3">
                        <strong>Authors:</strong>
                        <div class="document-field">${doc.authors || 'Unknown'}</div>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Journal:</strong>
                        <div class="document-field">${doc.journal || 'Unknown'}</div>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Publication Date:</strong>
                        <div class="document-field">${formattedDate || 'Unknown'}</div>
                    </div>
                    
                    <div class="mb-3">
                        <strong>DOI:</strong>
                        <div class="document-field">
                            ${doc.doi ? `<a href="https://doi.org/${doc.doi}" target="_blank">${doc.doi}</a>` : 'None'}
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Collection:</strong>
                        <div class="document-field">${collectionPath}</div>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Upload Date:</strong>
                        <div class="document-field">${formattedUploadDate || 'Unknown'}</div>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Tags:</strong>
                        ${tagsHtml || '<div class="document-field">None</div>'}
                    </div>
                    
                    <div class="mb-3">
                        <strong>Citation:</strong>
                        <div class="document-field citation">${doc.citation_apa || 'Citation not available'}</div>
                    </div>
                `;
                
                // Check for OCR needs and update the OCR section
                if (ocrStatusSection && ocrSection && textQualityInfo) {
                    updateOcrSection(doc);
                }
            })
            .catch(error => {
                console.error('Error loading document details:', error);
                documentDetails.innerHTML = `
                    <div class="text-center p-5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-circle mb-3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <p class="text-danger">Error loading document details</p>
                        <p class="text-muted small">${error.message}</p>
                    </div>
                `;
            });
    }
    
    /**
     * Update the OCR section based on document quality
     */
    function updateOcrSection(document) {
        ocrStatusSection.classList.remove('d-none');
        
        // Set text quality info
        let qualityBadge = '';
        let qualityMessage = '';
        
        switch (document.text_extraction_quality) {
            case 'normal':
                qualityBadge = '<span class="badge bg-success">Good</span>';
                qualityMessage = 'Text extraction quality is good. No OCR needed.';
                break;
            case 'low':
                qualityBadge = '<span class="badge bg-warning text-dark">Low</span>';
                qualityMessage = 'Text extraction quality is low. OCR processing may improve search results.';
                break;
            case 'ocr_needed':
                qualityBadge = '<span class="badge bg-danger">Poor</span>';
                qualityMessage = 'Text extraction quality is poor. OCR processing is recommended for better search results.';
                break;
            case 'ocr_processed':
                qualityBadge = '<span class="badge bg-info">OCR Processed</span>';
                qualityMessage = 'This document has been processed with OCR for improved text quality.';
                break;
            default:
                qualityBadge = '<span class="badge bg-secondary">Unknown</span>';
                qualityMessage = 'Text extraction quality could not be determined.';
        }
        
        textQualityInfo.innerHTML = `
            <div class="d-flex align-items-center mb-2">
                ${qualityBadge}
                <span class="ms-2">${qualityMessage}</span>
            </div>
        `;
        
        // Update OCR status and button section
        if (document.text_extraction_quality === 'normal') {
            // Good quality, hide OCR section
            ocrSection.classList.add('d-none');
        } else {
            // Show OCR section
            ocrSection.classList.remove('d-none');
            
            // Check OCR status
            if (document.ocr_status) {
                let statusHtml = '';
                let showButton = false;
                
                switch (document.ocr_status) {
                    case 'pending':
                        statusHtml = `
                            <div class="alert alert-info mb-2">
                                <i class="fas fa-clock me-2"></i>
                                OCR processing is queued and will start soon.
                            </div>
                        `;
                        showButton = false;
                        break;
                    case 'processing':
                        statusHtml = `
                            <div class="alert alert-info mb-2">
                                <i class="fas fa-sync fa-spin me-2"></i>
                                OCR processing is currently in progress.
                            </div>
                        `;
                        showButton = false;
                        break;
                    case 'completed':
                        statusHtml = `
                            <div class="alert alert-success mb-2">
                                <i class="fas fa-check-circle me-2"></i>
                                OCR processing completed successfully on
                                ${new Date(document.ocr_completed_at).toLocaleString()}.
                            </div>
                        `;
                        showButton = false;
                        break;
                    case 'failed':
                        statusHtml = `
                            <div class="alert alert-danger mb-2">
                                <i class="fas fa-exclamation-circle me-2"></i>
                                OCR processing failed: ${document.ocr_error || 'Unknown error'}.
                                You can try again.
                            </div>
                        `;
                        showButton = true;
                        break;
                    default:
                        statusHtml = '';
                        showButton = true;
                }
                
                ocrStatus.innerHTML = statusHtml;
                
                // Show/hide OCR button
                if (showButton) {
                    ocrButtonContainer.classList.remove('d-none');
                } else {
                    ocrButtonContainer.classList.add('d-none');
                }
            } else {
                // No OCR has been requested yet
                ocrStatus.innerHTML = `
                    <div class="alert alert-secondary mb-2">
                        <i class="fas fa-info-circle me-2"></i>
                        No OCR processing has been requested for this document.
                    </div>
                `;
                ocrButtonContainer.classList.remove('d-none');
            }
        }
    }
    
    /**
     * Request OCR processing for a document
     */
    function requestOcrProcessing(documentId) {
        // Show loading state
        ocrStatus.innerHTML = `
            <div class="alert alert-info mb-2">
                <i class="fas fa-sync fa-spin me-2"></i>
                Requesting OCR processing...
            </div>
        `;
        ocrButtonContainer.classList.add('d-none');
        
        // Send request to API
        fetch(`/documents/api/documents/${documentId}/ocr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success && !data.message) {
                throw new Error(data.error || 'Failed to request OCR processing');
            }
            
            // Show success message
            ocrStatus.innerHTML = `
                <div class="alert alert-info mb-2">
                    <i class="fas fa-clock me-2"></i>
                    OCR processing has been queued and will start soon.
                </div>
            `;
            
            // Hide button
            ocrButtonContainer.classList.add('d-none');
            
            // Refresh document details after a delay
            setTimeout(() => {
                showDocumentDetails(documentId);
            }, 2000);
        })
        .catch(error => {
            console.error('Error requesting OCR processing:', error);
            ocrStatus.innerHTML = `
                <div class="alert alert-danger mb-2">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error requesting OCR processing: ${error.message}
                </div>
            `;
            ocrButtonContainer.classList.remove('d-none');
        });
    }
    
    /**
     * Clear document details panel
     */
    function clearDocumentDetails() {
        currentDocumentId = null;
        documentDetails.innerHTML = `
            <div class="text-center p-5">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <p class="text-muted">Select a document to view details</p>
            </div>
        `;
        actionButtons.classList.add('d-none');
        if (ocrStatusSection) {
            ocrStatusSection.classList.add('d-none');
        }
    }
    
    /**
     * Open edit document modal
     */
    function openEditModal(documentId) {
        const document = documents.find(doc => doc.id == documentId);
        if (!document) return;
        
        // Populate form
        document.getElementById('editTitle').value = document.title || '';
        document.getElementById('editAuthors').value = document.authors || '';
        document.getElementById('editJournal').value = document.journal || '';
        document.getElementById('editDoi').value = document.doi || '';
        
        // Format publication date for input
        if (document.publication_date) {
            const date = new Date(document.publication_date);
            const formattedDate = date.toISOString().split('T')[0];
            document.getElementById('editPublicationDate').value = formattedDate;
        } else {
            document.getElementById('editPublicationDate').value = '';
        }
        
        // Populate tags
        populateTagInput(document.tags || []);
        
        // Populate collection dropdown
        populateCollectionDropdown('editCollection');
        if (document.collection_id) {
            document.getElementById('editCollection').value = document.collection_id;
        } else {
            document.getElementById('editCollection').value = '';
        }
        
        // Setup save handler
        const saveButton = document.getElementById('saveDocumentButton');
        saveButton.onclick = function() {
            saveDocumentChanges(documentId);
        };
        
        // Show modal
        editDocumentModal.show();
    }
    
    /**
     * Populate tag input with existing tags
     */
    function populateTagInput(tags) {
        const tagInput = document.getElementById('tagInput');
        const tagInputText = document.getElementById('tagInputText');
        
        // Remove all tags except the input field
        Array.from(tagInput.children).forEach(child => {
            if (!child.classList.contains('tag-input')) {
                tagInput.removeChild(child);
            }
        });
        
        // Add each tag as a span
        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            tagElement.innerHTML = `
                ${tag}
                <i class="fas fa-times tag-remove"></i>
            `;
            tagInput.insertBefore(tagElement, tagInputText);
            
            // Add remove event
            tagElement.querySelector('.tag-remove').addEventListener('click', function() {
                tagInput.removeChild(tagElement);
            });
        });
    }
    
    /**
     * Save document changes
     */
    function saveDocumentChanges(documentId) {
        // Collect data from form
        const title = document.getElementById('editTitle').value;
        const authors = document.getElementById('editAuthors').value;
        const journal = document.getElementById('editJournal').value;
        const doi = document.getElementById('editDoi').value;
        const publicationDate = document.getElementById('editPublicationDate').value;
        const collectionId = document.getElementById('editCollection').value;
        
        // Collect tags
        const tagElements = document.getElementById('tagInput').querySelectorAll('.tag');
        const tags = Array.from(tagElements).map(el => el.textContent.trim());
        
        // Show loading state on button
        const saveButton = document.getElementById('saveDocumentButton');
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveButton.disabled = true;
        
        // Send update to API
        fetch(`/documents/api/documents/${documentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                authors,
                journal,
                doi,
                publication_date: publicationDate,
                tags,
                collection_id: collectionId || null
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to update document');
            }
            
            // Show success message
            showAlert('Document updated successfully', 'success');
            
            // Hide modal
            editDocumentModal.hide();
            
            // Refresh document list and details
            loadDocuments();
            setTimeout(() => {
                showDocumentDetails(documentId);
            }, 500);
        })
        .catch(error => {
            console.error('Error updating document:', error);
            showAlert('Error updating document: ' + error.message, 'danger');
            
            // Reset button
            saveButton.innerHTML = 'Save Changes';
            saveButton.disabled = false;
        });
    }
    
    /**
     * Delete a document
     */
    function deleteDocument(documentId) {
        // Show loading state
        documentDetails.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Deleting document...</p>
            </div>
        `;
        
        // Hide action buttons
        actionButtons.classList.add('d-none');
        
        // Send delete request
        fetch(`/documents/api/documents/${documentId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete document');
            }
            
            // Show success message
            showAlert('Document deleted successfully', 'success');
            
            // Clear details and reload list
            clearDocumentDetails();
            loadDocuments();
        })
        .catch(error => {
            console.error('Error deleting document:', error);
            showAlert('Error deleting document: ' + error.message, 'danger');
            
            // Reload details
            showDocumentDetails(documentId);
        });
    }
    
    /**
     * Perform batch move operation
     */
    function batchMoveDocuments(documentIds, collectionId) {
        if (documentIds.length === 0) return;
        
        // Show loading state
        showAlert('Moving documents...', 'info');
        
        // Send request
        fetch('/documents/api/documents/batch/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document_ids: documentIds,
                collection_id: collectionId || null
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to move documents');
            }
            
            // Show success message
            showAlert(`Successfully moved ${documentIds.length} documents`, 'success');
            
            // Clear selection and reload documents
            selectedDocuments = [];
            updateBatchButtons();
            loadDocuments();
            
            // Clear details if we were viewing one of the moved documents
            if (currentDocumentId && documentIds.includes(currentDocumentId.toString())) {
                clearDocumentDetails();
            }
        })
        .catch(error => {
            console.error('Error moving documents:', error);
            showAlert('Error moving documents: ' + error.message, 'danger');
        });
    }
    
    /**
     * Perform batch delete operation
     */
    function batchDeleteDocuments(documentIds) {
        if (documentIds.length === 0) return;
        
        // Show loading state
        showAlert('Deleting documents...', 'info');
        
        // Send request
        fetch('/documents/api/documents/batch/delete', {
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
            
            // Clear selection and reload documents
            selectedDocuments = [];
            updateBatchButtons();
            loadDocuments();
            
            // Clear details if we were viewing one of the deleted documents
            if (currentDocumentId && documentIds.includes(currentDocumentId.toString())) {
                clearDocumentDetails();
            }
        })
        .catch(error => {
            console.error('Error deleting documents:', error);
            showAlert('Error deleting documents: ' + error.message, 'danger');
        });
    }
    
    /**
     * Open edit collection modal
     */
    function openEditCollectionModal(collection) {
        // Populate form
        document.getElementById('editCollectionId').value = collection.id;
        document.getElementById('editCollectionName').value = collection.name;
        document.getElementById('editCollectionDescription').value = collection.description || '';
        
        // Populate parent dropdown
        populateEditParentDropdown(collection.id, collection.parent_id);
        
        // Show modal
        editCollectionModal.show();
    }
    
    /**
     * Populate parent collection dropdown, excluding the current collection and its children
     */
    function populateEditParentDropdown(collectionId, parentId) {
        const dropdown = document.getElementById('editParentCollection');
        if (!dropdown) return;
        
        // Clear dropdown
        dropdown.innerHTML = '<option value="">None (Root Level)</option>';
        
        // Get all child collection IDs (to exclude them from possible parents)
        const childIds = getChildCollectionIds(collectionId);
        
        // Add valid parent options
        collections.forEach(collection => {
            if (collection.id != collectionId && !childIds.includes(collection.id)) {
                const option = document.createElement('option');
                option.value = collection.id;
                option.textContent = collection.full_path || collection.name;
                dropdown.appendChild(option);
            }
        });
        
        // Set current parent if one exists
        if (parentId) {
            dropdown.value = parentId;
        } else {
            dropdown.value = '';
        }
    }
    
    /**
     * Get all child collection IDs for a given collection
     */
    function getChildCollectionIds(collectionId) {
        const childIds = [];
        
        function addChildIds(id) {
            const children = collections.filter(c => c.parent_id == id);
            children.forEach(child => {
                childIds.push(child.id);
                addChildIds(child.id);
            });
        }
        
        addChildIds(collectionId);
        return childIds;
    }
    
    /**
     * Update system stats display
     */
    function updateSystemStats() {
        fetch('/monitoring/api/system-stats')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load system stats');
                }
                
                // Update document count
                if (totalDocuments) {
                    totalDocuments.textContent = data.document_count || 0;
                }
                
                // Update processing queue
                if (processingQueue) {
                    processingQueue.textContent = data.processing_queue || 0;
                }
            })
            .catch(error => {
                console.error('Error loading system stats:', error);
            });
    }
    
    /**
     * Show an alert message
     */
    function showAlert(message, type) {
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show fixed-top mx-auto mt-3`;
        alertElement.style.maxWidth = '500px';
        alertElement.style.zIndex = '9999';
        alertElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(alertElement);
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            alertElement.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(alertElement);
            }, 300);
        }, 3000);
    }
}

/**
 * Initialize file upload functionality
 */
function initFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const uploadArea = document.querySelector('.upload-area');
    const uploadButton = document.getElementById('uploadButton');
    const uploadProgress = document.querySelector('.upload-progress');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadCount = document.getElementById('uploadCount');
    const uploadSuccessMessage = document.getElementById('uploadSuccessMessage');
    const uploadErrorMessage = document.getElementById('uploadErrorMessage');
    
    if (!fileInput || !uploadForm) return;
    
    // Handle drag and drop events
    if (uploadArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            uploadArea.classList.add('highlight');
        }
        
        function unhighlight() {
            uploadArea.classList.remove('highlight');
        }
        
        uploadArea.addEventListener('drop', handleDrop, false);
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            fileInput.files = files;
            
            // Trigger upload if files were dropped
            if (files.length > 0) {
                uploadForm.dispatchEvent(new Event('submit'));
            }
        }
    }
    
    // Handle file upload form submission
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const files = fileInput.files;
        
        if (files.length === 0) {
            showAlert('Please select at least one PDF file to upload.', 'warning');
            return;
        }
        
        if (files.length > 50) {
            showAlert('You can upload a maximum of 50 files at once.', 'warning');
            return;
        }
        
        // Check file types
        for (let i = 0; i < files.length; i++) {
            if (!files[i].type.includes('pdf')) {
                showAlert('Only PDF files are supported.', 'warning');
                return;
            }
        }
        
        // Create FormData object
        const formData = new FormData();
        
        // Add collection ID if selected
        const collectionId = document.getElementById('uploadCollection').value;
        if (collectionId) {
            formData.append('collection_id', collectionId);
        }
        
        // Add all files
        for (let i = 0; i < files.length; i++) {
            formData.append('files[]', files[i]);
        }
        
        // Reset messages
        uploadSuccessMessage.classList.add('d-none');
        uploadErrorMessage.classList.add('d-none');
        
        // Show progress UI
        uploadButton.disabled = true;
        uploadProgress.classList.remove('d-none');
        uploadProgressBar.style.width = '0%';
        uploadProgressBar.setAttribute('aria-valuenow', 0);
        uploadCount.textContent = `0/${files.length}`;
        uploadStatus.textContent = 'Preparing to upload...';
        
        // Send upload request with progress tracking
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload');
        
        xhr.upload.addEventListener('progress', function(event) {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                uploadProgressBar.style.width = percentComplete + '%';
                uploadProgressBar.setAttribute('aria-valuenow', percentComplete);
                uploadStatus.textContent = 'Uploading...';
            }
        });
        
        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    
                    if (response.success) {
                        // Show success message
                        uploadSuccessMessage.classList.remove('d-none');
                        uploadStatus.textContent = 'Upload completed successfully!';
                        uploadProgressBar.classList.remove('bg-primary');
                        uploadProgressBar.classList.add('bg-success');
                        
                        // Update document count in UI
                        updateSystemStats();
                        
                        // Reload documents
                        loadDocuments();
                        
                        // Reset form after a delay
                        setTimeout(() => {
                            resetUploadForm();
                        }, 3000);
                    } else {
                        // Show error message
                        uploadErrorMessage.textContent = response.error || 'Error uploading documents.';
                        uploadErrorMessage.classList.remove('d-none');
                        uploadStatus.textContent = 'Upload failed.';
                        uploadProgressBar.classList.remove('bg-primary');
                        uploadProgressBar.classList.add('bg-danger');
                        
                        // Reset form after a delay
                        setTimeout(() => {
                            resetUploadForm();
                        }, 3000);
                    }
                } catch (error) {
                    console.error('Error parsing upload response:', error);
                    uploadErrorMessage.textContent = 'Error processing server response.';
                    uploadErrorMessage.classList.remove('d-none');
                    uploadStatus.textContent = 'Upload failed.';
                    uploadProgressBar.classList.remove('bg-primary');
                    uploadProgressBar.classList.add('bg-danger');
                    
                    // Reset form after a delay
                    setTimeout(() => {
                        resetUploadForm();
                    }, 3000);
                }
            } else {
                // Show error message
                uploadErrorMessage.textContent = 'Server error: ' + xhr.status;
                uploadErrorMessage.classList.remove('d-none');
                uploadStatus.textContent = 'Upload failed.';
                uploadProgressBar.classList.remove('bg-primary');
                uploadProgressBar.classList.add('bg-danger');
                
                // Reset form after a delay
                setTimeout(() => {
                    resetUploadForm();
                }, 3000);
            }
        });
        
        xhr.addEventListener('error', function() {
            console.error('Upload error:', xhr.statusText);
            uploadErrorMessage.textContent = 'Network error during upload.';
            uploadErrorMessage.classList.remove('d-none');
            uploadStatus.textContent = 'Upload failed.';
            uploadProgressBar.classList.remove('bg-primary');
            uploadProgressBar.classList.add('bg-danger');
            
            // Reset form after a delay
            setTimeout(() => {
                resetUploadForm();
            }, 3000);
        });
        
        xhr.send(formData);
    });
    
    /**
     * Reset the upload form to its initial state
     */
    function resetUploadForm() {
        uploadButton.disabled = false;
        uploadProgress.classList.add('d-none');
        uploadProgressBar.style.width = '0%';
        uploadProgressBar.setAttribute('aria-valuenow', 0);
        uploadProgressBar.classList.remove('bg-danger', 'bg-success');
        uploadProgressBar.classList.add('bg-primary');
        fileInput.value = '';
    }
    
    /**
     * Update system stats display
     */
    function updateSystemStats() {
        // This function should be defined in the document browser initialization
        if (typeof window.updateSystemStats === 'function') {
            window.updateSystemStats();
        } else {
            fetch('/monitoring/api/system-stats')
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to load system stats');
                    }
                    
                    // Update document count and processing queue if elements exist
                    const totalDocuments = document.getElementById('totalDocuments');
                    const processingQueue = document.getElementById('processingQueue');
                    
                    if (totalDocuments) {
                        totalDocuments.textContent = data.document_count || 0;
                    }
                    
                    if (processingQueue) {
                        processingQueue.textContent = data.processing_queue || 0;
                    }
                })
                .catch(error => {
                    console.error('Error updating system stats:', error);
                });
        }
    }
    
    /**
     * Show an alert message
     */
    function showAlert(message, type) {
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show fixed-top mx-auto mt-3`;
        alertElement.style.maxWidth = '500px';
        alertElement.style.zIndex = '9999';
        alertElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(alertElement);
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            alertElement.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(alertElement);
            }, 300);
        }, 3000);
    }
}
