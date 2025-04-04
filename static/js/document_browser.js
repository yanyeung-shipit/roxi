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
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search mb-3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <p class="text-muted">No documents found</p>
                            <p class="text-muted small">Try adjusting your search or filters</p>
                        </div>
                    `;
                } else {
                    // Render documents
                    renderDocuments(documents);
                    
                    // Update pagination
                    renderPagination(totalPages, currentPage);
                }
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                documentList.innerHTML = `
                    <div class="alert alert-danger m-3" role="alert">
                        <h4 class="alert-heading">Error loading documents</h4>
                        <p>${error.message}</p>
                    </div>
                `;
            });
    }
    
    /**
     * Render the list of documents with appropriate display based on mode
     */
    function renderDocuments(documents) {
        // Clear document list
        documentList.innerHTML = '';
        
        // Render each document as a card
        documents.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'document-card';
            card.dataset.id = doc.id;
            
            // If in multi-select mode, add checkbox
            if (multiSelectMode) {
                const isSelected = selectedDocuments.includes(doc.id.toString());
                if (isSelected) {
                    card.classList.add('selected-document');
                }
                
                card.innerHTML = `
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="document-header d-flex justify-content-between align-items-start">
                                <div class="form-check">
                                    <input class="form-check-input document-checkbox" type="checkbox" value="" id="doc-check-${doc.id}" ${isSelected ? 'checked' : ''}>
                                    <label class="form-check-label" for="doc-check-${doc.id}">
                                        <h5 class="card-title text-truncate" title="${doc.title || 'Untitled document'}">${doc.title || 'Untitled document'}</h5>
                                    </label>
                                </div>
                            </div>
                            <p class="card-text text-truncate" title="${doc.authors || 'Unknown author'}">${doc.authors || 'Unknown author'}</p>
                            <p class="card-text text-muted small">${doc.journal || ''} ${doc.publication_date ? new Date(doc.publication_date).getFullYear() : ''}</p>
                            <div class="d-flex mt-2 tag-container">
                                ${(doc.tags || []).slice(0, 3).map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('')}
                                ${(doc.tags || []).length > 3 ? `<span class="badge bg-light text-dark">+${(doc.tags || []).length - 3} more</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                
                // Add event listeners for checkbox
                const checkbox = card.querySelector('.document-checkbox');
                checkbox.addEventListener('change', function() {
                    toggleDocumentSelection(doc.id, this.checked);
                });
                
                // Make the entire card clickable for selecting
                card.addEventListener('click', function(e) {
                    // Don't toggle if clicking on the checkbox itself (it will handle its own change)
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                        toggleDocumentSelection(doc.id, checkbox.checked);
                    }
                });
            } else {
                // Regular card without checkbox
                card.innerHTML = `
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-truncate" title="${doc.title || 'Untitled document'}">${doc.title || 'Untitled document'}</h5>
                            <p class="card-text text-truncate" title="${doc.authors || 'Unknown author'}">${doc.authors || 'Unknown author'}</p>
                            <p class="card-text text-muted small">${doc.journal || ''} ${doc.publication_date ? new Date(doc.publication_date).getFullYear() : ''}</p>
                            <div class="d-flex mt-2 tag-container">
                                ${(doc.tags || []).slice(0, 3).map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('')}
                                ${(doc.tags || []).length > 3 ? `<span class="badge bg-light text-dark">+${(doc.tags || []).length - 3} more</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                
                // Make card clickable to view details
                card.addEventListener('click', function() {
                    showDocumentDetails(doc.id);
                });
            }
            
            documentList.appendChild(card);
        });
    }
    
    /**
     * Render pagination controls
     */
    function renderPagination(totalPages, currentPage) {
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        pagination.innerHTML = `
            <nav aria-label="Page navigation">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                            <span aria-hidden="true">&laquo;</span>
                        </a>
                    </li>
                    ${generatePageItems(totalPages, currentPage)}
                    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                            <span aria-hidden="true">&raquo;</span>
                        </a>
                    </li>
                </ul>
            </nav>
        `;
        
        // Add event listeners to pagination links
        pagination.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page);
                if (page !== currentPage && page >= 1 && page <= totalPages) {
                    currentPage = page;
                    loadDocuments();
                }
            });
        });
    }
    
    /**
     * Generate the page number items for pagination
     */
    function generatePageItems(totalPages, currentPage) {
        let items = '';
        const maxVisiblePages = 5;
        
        // If total pages is small, show all pages
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                items += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `;
            }
        } else {
            // Show a subset of pages with ellipsis
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            // Adjust start page if end page is at max
            if (endPage === totalPages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            // First page
            if (startPage > 1) {
                items += `
                    <li class="page-item">
                        <a class="page-link" href="#" data-page="1">1</a>
                    </li>
                `;
                
                // Ellipsis if needed
                if (startPage > 2) {
                    items += `
                        <li class="page-item disabled">
                            <a class="page-link" href="#">...</a>
                        </li>
                    `;
                }
            }
            
            // Visible pages
            for (let i = startPage; i <= endPage; i++) {
                items += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `;
            }
            
            // Last page
            if (endPage < totalPages) {
                // Ellipsis if needed
                if (endPage < totalPages - 1) {
                    items += `
                        <li class="page-item disabled">
                            <a class="page-link" href="#">...</a>
                        </li>
                    `;
                }
                
                items += `
                    <li class="page-item">
                        <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
                    </li>
                `;
            }
        }
        
        return items;
    }
    
    /**
     * Load collections and populate the filter dropdown
     */
    function loadCollections() {
        fetch('/api/collections')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load collections');
                }
                
                collections = data.collections;
                
                // Populate collection filter dropdown if it exists
                if (collectionFilter) {
                    populateCollectionFilter();
                }
                
                // Populate upload collection dropdown if it exists
                if (uploadCollection) {
                    populateUploadCollection();
                }
            })
            .catch(error => {
                console.error('Error loading collections:', error);
            });
    }
    
    /**
     * Populate the collection filter dropdown with hierarchical options
     */
    function populateCollectionFilter() {
        collectionFilter.innerHTML = `
            <option value="">All Documents</option>
            ${collections.filter(c => !c.parent_id).map(collection => generateCollectionOption(collection, collections, 0)).join('')}
        `;
        
        // Add change event listener
        collectionFilter.addEventListener('change', function() {
            activeCollection = this.value;
            currentPage = 1;
            loadDocuments();
        });
    }
    
    /**
     * Populate the upload collection dropdown with hierarchical options
     */
    function populateUploadCollection() {
        uploadCollection.innerHTML = `
            <option value="">No Collection (Root)</option>
            ${collections.filter(c => !c.parent_id).map(collection => generateCollectionOption(collection, collections, 0)).join('')}
        `;
    }
    
    /**
     * Recursively generate collection options for dropdown with proper indentation
     */
    function generateCollectionOption(collection, allCollections, level) {
        const indent = '&nbsp;'.repeat(level * 4);
        const prefix = level > 0 ? `${indent}└ ` : '';
        
        let options = `<option value="${collection.id}">${prefix}${collection.name} (${collection.document_count || 0})</option>`;
        
        // Get child collections
        const children = allCollections.filter(c => c.parent_id === collection.id);
        
        // Add child options recursively
        if (children.length > 0) {
            options += children.map(child => generateCollectionOption(child, allCollections, level + 1)).join('');
        }
        
        return options;
    }
    
    /**
     * Populate a collection dropdown with hierarchical options for document edit modal
     */
    function populateCollectionsDropdown(dropdown) {
        dropdown.innerHTML = `
            <option value="">No Collection (Root)</option>
            ${collections.filter(c => !c.parent_id).map(collection => generateCollectionOption(collection, collections, 0)).join('')}
        `;
    }
    
    /**
     * Populate a collection dropdown with hierarchical options for batch move modal
     */
    const batchMoveCollection = document.getElementById('batchMoveCollection');
    const batchMoveCount = document.getElementById('batchMoveCount');
    const confirmBatchMoveButton = document.getElementById('confirmBatchMoveButton');
    
    /**
     * Show and populate the collection management modal
     */
    if (manageCollectionsButton) {
        manageCollectionsButton.addEventListener('click', function() {
            loadCollectionsTable();
            manageCollectionsModal.show();
        });
    }
    
    /**
     * Load and populate the collections table in the management modal
     */
    function loadCollectionsTable() {
        // Clear table body
        collectionsTableBody.innerHTML = '';
        
        // If no collections, show empty message
        if (collections.length === 0) {
            collectionsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center p-4">
                        <p class="text-muted">No collections found</p>
                        <button class="btn btn-outline-primary btn-sm" data-bs-dismiss="modal" data-bs-toggle="modal" data-bs-target="#collectionModal">Create Collection</button>
                    </td>
                </tr>
            `;
            return;
        }
        
        // First add root level collections
        const rootCollections = collections.filter(c => !c.parent_id);
        
        // Render each collection in table
        rootCollections.forEach(collection => {
            renderCollectionRow(collection, 0);
        });
        
        // Add click handlers for edit buttons
        collectionsTableBody.querySelectorAll('.edit-collection-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const collection = collections.find(c => c.id.toString() === id);
                
                if (collection) {
                    showCollectionEditModal(collection);
                }
            });
        });
        
        // Add click handlers for delete buttons
        collectionsTableBody.querySelectorAll('.delete-collection-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const collection = collections.find(c => c.id.toString() === id);
                
                if (collection) {
                    confirmDeleteCollection(collection);
                }
            });
        });
    }
    
    /**
     * Render a collection row in the table with proper indentation
     */
    function renderCollectionRow(collection, level) {
        const indent = level > 0 ? `<span class="ms-${level*3}">└ </span>` : '';
        
        // Create and append row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                ${indent}${collection.name}
            </td>
            <td>${collection.document_count || 0}</td>
            <td>${collections.find(c => c.id === collection.parent_id)?.name || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-collection-btn" data-id="${collection.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-collection-btn" data-id="${collection.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        collectionsTableBody.appendChild(row);
        
        // Get and render child collections
        const children = collections.filter(c => c.parent_id === collection.id);
        if (children.length > 0) {
            children.forEach(child => {
                renderCollectionRow(child, level + 1);
            });
        }
    }
    
    /**
     * Add new collection button handler
     */
    if (addCollectionBtn) {
        addCollectionBtn.addEventListener('click', function() {
            // Reset form
            collectionId.value = '';
            collectionName.value = '';
            collectionDescription.value = '';
            populateParentCollectionDropdown();
            
            // Update modal title
            collectionModalTitle.textContent = 'Add New Collection';
            
            // Hide delete button
            deleteCollectionButton.classList.add('d-none');
            
            // Show modal
            collectionModal.show();
        });
    }
    
    /**
     * Populate parent collection dropdown for the collection edit modal
     */
    function populateParentCollectionDropdown(selectedId = null) {
        // Clear dropdown
        collectionParent.innerHTML = '<option value="">None (Root level)</option>';
        
        // If no collection ID provided, show all collections as potential parents
        if (!selectedId) {
            collections.forEach(collection => {
                collectionParent.innerHTML += `<option value="${collection.id}">${collection.name}</option>`;
            });
            return;
        }
        
        // If editing an existing collection, don't allow it to be its own parent or child of its children
        const currentCollection = collections.find(c => c.id.toString() === selectedId.toString());
        if (!currentCollection) return;
        
        // Function to get all descendant collection IDs recursively
        function getDescendantIds(parentId) {
            const descendants = [];
            const children = collections.filter(c => c.parent_id === parentId);
            
            children.forEach(child => {
                descendants.push(child.id);
                descendants.push(...getDescendantIds(child.id));
            });
            
            return descendants;
        }
        
        // Get all descendants to exclude
        const excludeIds = [parseInt(selectedId), ...getDescendantIds(parseInt(selectedId))];
        
        // Add eligible parent options
        collections.forEach(collection => {
            if (!excludeIds.includes(collection.id)) {
                const selected = currentCollection.parent_id === collection.id ? 'selected' : '';
                collectionParent.innerHTML += `<option value="${collection.id}" ${selected}>${collection.name}</option>`;
            }
        });
    }
    
    /**
     * Show the collection edit modal with collection data
     */
    function showCollectionEditModal(collection) {
        // Populate form
        collectionId.value = collection.id;
        collectionName.value = collection.name;
        collectionDescription.value = collection.description || '';
        
        // Populate parent dropdown with proper exclusions
        populateParentCollectionDropdown(collection.id);
        
        // Update modal title
        collectionModalTitle.textContent = 'Edit Collection';
        
        // Show delete button
        deleteCollectionButton.classList.remove('d-none');
        
        // Show modal
        collectionModal.show();
    }
    
    /**
     * Save collection button handler
     */
    if (saveCollectionButton) {
        saveCollectionButton.addEventListener('click', function() {
            // Validate form
            if (!collectionName.value.trim()) {
                showAlert('Collection name is required', 'danger');
                return;
            }
            
            // Get form data
            const data = {
                name: collectionName.value.trim(),
                description: collectionDescription.value.trim(),
                parent_id: collectionParent.value ? parseInt(collectionParent.value) : null
            };
            
            // Create or update collection
            const endpoint = collectionId.value 
                ? `/api/collections/${collectionId.value}` 
                : '/api/collections';
                
            const method = collectionId.value ? 'PUT' : 'POST';
            
            fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (!result.success) {
                    throw new Error(result.error || 'Failed to save collection');
                }
                
                // Show success message
                showAlert(`Collection ${collectionId.value ? 'updated' : 'created'} successfully`, 'success');
                
                // Refresh collections list
                loadCollections();
                
                // Hide modal
                collectionModal.hide();
                
                // If managing collections modal is visible, refresh the table
                if (manageCollectionsModal._element.classList.contains('show')) {
                    loadCollectionsTable();
                }
            })
            .catch(error => {
                console.error('Error saving collection:', error);
                showAlert('Error saving collection: ' + error.message, 'danger');
            });
        });
    }
    
    /**
     * Collection delete button handler
     */
    if (deleteCollectionButton) {
        deleteCollectionButton.addEventListener('click', function() {
            const id = collectionId.value;
            const name = collectionName.value;
            
            if (id) {
                confirmDeleteCollection({id, name});
                collectionModal.hide();
            }
        });
    }
    
    /**
     * Confirm delete modal for collections
     */
    function confirmDeleteCollection(collection) {
        // Set delete type and ID
        deleteType = 'collection';
        deleteId = collection.id;
        
        // Update confirm message
        deleteConfirmMessage.innerHTML = `
            Are you sure you want to delete the collection <strong>${collection.name}</strong>?
            <br><br>
            <span class="text-warning">
                <i class="fas fa-exclamation-triangle"></i> 
                Any documents in this collection will be moved to the root level (no collection).
            </span>
        `;
        
        // Show modal
        deleteConfirmModal.show();
    }
    
    /**
     * Show document details in the sidebar
     */
    function showDocumentDetails(documentId) {
        // Exit multi-select mode if active
        if (multiSelectMode) {
            toggleMultiSelectBtn.classList.remove('active');
            multiSelectActions.classList.add('d-none');
            multiSelectMode = false;
            selectedDocuments = [];
            renderDocuments(documents);
        }
        
        // If action buttons container exists, make it visible
        if (actionButtons) {
            actionButtons.classList.remove('d-none');
        }
        
        // Highlight selected document
        documentList.querySelectorAll('.document-card').forEach(card => {
            if (card.dataset.id.toString() === documentId.toString()) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
        
        // Show loading state
        documentDetails.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading document details...</p>
            </div>
        `;
        
        // Store current document ID
        currentDocumentId = documentId;
        
        // Enable edit and delete buttons if they exist
        if (editDocumentButton) {
            editDocumentButton.disabled = false;
            editDocumentButton.addEventListener('click', function() {
                showEditDocumentModal(documentId);
            });
        }
        
        if (deleteDocumentButton) {
            deleteDocumentButton.disabled = false;
            deleteDocumentButton.addEventListener('click', function() {
                confirmDeleteDocument(documentId);
            });
        }
        
        // Fetch document details
        fetch(`/api/documents/${documentId}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load document details');
                }
                
                const doc = data.document;
                
                // Format publication date
                let formattedDate = '';
                if (doc.publication_date) {
                    formattedDate = new Date(doc.publication_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
                
                // Format collection
                let collection = '';
                if (doc.collection_id) {
                    const collectionObj = collections.find(c => c.id === doc.collection_id);
                    collection = collectionObj ? `<a href="#" class="collection-link" data-id="${collectionObj.id}">${collectionObj.name}</a>` : '';
                }
                
                // Build HTML for document details
                let html = `
                    <div class="document-details-content">
                        <h2 class="mb-4">${doc.title || 'Untitled document'}</h2>
                        
                        <div class="mb-4">
                            <h5>Authors</h5>
                            <p>${doc.authors || 'Unknown'}</p>
                        </div>
                        
                        <div class="mb-4">
                            <h5>Journal</h5>
                            <p>${doc.journal || 'N/A'}</p>
                        </div>
                        
                        <div class="mb-4">
                            <div class="d-flex justify-content-between">
                                <h5>Publication Date</h5>
                            </div>
                            <p>${formattedDate || 'N/A'}</p>
                        </div>
                        
                        <div class="mb-4">
                            <h5>DOI</h5>
                            <p>${doc.doi ? `<a href="https://doi.org/${doc.doi}" target="_blank">${doc.doi}</a>` : 'N/A'}</p>
                        </div>
                        
                        <div class="mb-4">
                            <h5>Collection</h5>
                            <p>${collection || 'None'}</p>
                        </div>
                        
                        <div class="mb-4">
                            <h5>Tags</h5>
                            <div class="tag-container">
                                ${(doc.tags || []).length > 0 
                                    ? (doc.tags || []).map(tag => `<span class="badge bg-secondary me-1 mb-1">${tag}</span>`).join('') 
                                    : '<p class="text-muted">No tags</p>'
                                }
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <h5>Citation</h5>
                            <p class="citation">${doc.citation_apa || 'N/A'}</p>
                        </div>
                        
                        <div class="mb-4">
                            <div class="d-flex justify-content-between">
                                <h5>Text Extraction</h5>
                                <div>
                                    <span id="documentOcrStatusBadge" class="badge d-none"></span>
                                </div>
                            </div>
                            <p class="text-extraction-quality">
                                ${getQualityBadge(doc.text_extraction_quality)}
                                <span class="ms-2 quality-description">${getQualityDescription(doc.text_extraction_quality)}</span>
                            </p>
                            <div id="documentOcrControls" class="mt-3 d-none">
                                <div id="documentOcrError" class="alert alert-danger d-none" role="alert"></div>
                                <div id="documentOcrSuccess" class="alert alert-success d-none" role="alert">
                                    OCR processing completed successfully! The document text has been updated.
                                </div>
                                <div id="documentOcrProgress" class="d-none">
                                    <div class="progress mb-2">
                                        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
                                    </div>
                                    <p class="text-muted small">OCR processing may take a minute or two depending on the document size...</p>
                                </div>
                                <button id="documentApplyOcrButton" class="btn btn-sm btn-outline-primary">
                                    <i class="fas fa-magic"></i> Apply OCR Processing
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <h5>Actions</h5>
                            <div class="btn-group" role="group" aria-label="Document actions">
                                <button id="viewPdfButton" class="btn btn-outline-primary btn-sm">
                                    <i class="fas fa-file-pdf"></i> View PDF
                                </button>
                                <button id="copyLinkButton" class="btn btn-outline-secondary btn-sm" data-document-id="${doc.id}">
                                    <i class="fas fa-link"></i> Copy Link
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                // Update document details
                documentDetails.innerHTML = html;
                
                // Add event listener to view PDF button
                const viewPdfBtn = documentDetails.querySelector('#viewPdfButton');
                if (viewPdfBtn) {
                    viewPdfBtn.addEventListener('click', function() {
                        window.open(`/documents/${documentId}/pdf`, '_blank');
                    });
                }
                
                // Add event listener to copy link button
                const copyLinkBtn = documentDetails.querySelector('#copyLinkButton');
                if (copyLinkBtn) {
                    copyLinkBtn.addEventListener('click', function() {
                        const url = `${window.location.origin}/documents/${documentId}`;
                        navigator.clipboard.writeText(url).then(() => {
                            // Temporarily change button text
                            const originalHtml = copyLinkBtn.innerHTML;
                            copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                            setTimeout(() => {
                                copyLinkBtn.innerHTML = originalHtml;
                            }, 2000);
                        });
                    });
                }
                
                // Check text extraction quality and show OCR controls if needed
                checkDocumentTextQuality(doc);
            })
            .catch(error => {
                console.error('Error loading document details:', error);
                documentDetails.innerHTML = `
                    <div class="alert alert-danger m-3" role="alert">
                        <h4 class="alert-heading">Error loading document details</h4>
                        <p>${error.message}</p>
                    </div>
                `;
            });
    }
    
    /**
     * Format text extraction quality as a badge
     */
    function getQualityBadge(quality) {
        if (quality === 'good') {
            return '<span class="badge bg-success">Good</span>';
        } else if (quality === 'limited') {
            return '<span class="badge bg-warning text-dark">Limited</span>';
        } else if (quality === 'none') {
            return '<span class="badge bg-danger">None</span>';
        } else {
            return '<span class="badge bg-secondary">Unknown</span>';
        }
    }
    
    /**
     * Get description text for text extraction quality
     */
    function getQualityDescription(quality) {
        if (quality === 'good') {
            return 'Text was successfully extracted from this PDF.';
        } else if (quality === 'limited') {
            return 'Limited text could be extracted from this PDF. Consider using OCR to improve results.';
        } else if (quality === 'none') {
            return 'No text could be extracted from this PDF. OCR processing is recommended.';
        } else {
            return 'Text extraction quality has not been assessed for this document.';
        }
    }
    
    /**
     * Check document text extraction quality and show OCR controls if needed
     */
    function checkDocumentTextQuality(document) {
        const ocrControls = document.getElementById('documentOcrControls');
        const ocrStatusBadge = document.getElementById('documentOcrStatusBadge');
        
        // Only show OCR controls for documents with limited or no text
        if (document.text_extraction_quality === 'limited' || document.text_extraction_quality === 'none') {
            ocrControls.classList.remove('d-none');
            
            // Check if OCR has been requested
            if (document.ocr_status) {
                ocrStatusBadge.classList.remove('d-none');
                
                // Show appropriate status
                if (document.ocr_status === 'pending') {
                    ocrStatusBadge.textContent = 'OCR: Pending';
                    ocrStatusBadge.className = 'badge bg-secondary';
                } else if (document.ocr_status === 'processing') {
                    ocrStatusBadge.textContent = 'OCR: Processing';
                    ocrStatusBadge.className = 'badge bg-info';
                    // Start polling for status updates
                    pollOcrStatus(document.id, 'document');
                } else if (document.ocr_status === 'completed') {
                    ocrStatusBadge.textContent = 'OCR: Completed';
                    ocrStatusBadge.className = 'badge bg-success';
                } else if (document.ocr_status === 'failed') {
                    ocrStatusBadge.textContent = 'OCR: Failed';
                    ocrStatusBadge.className = 'badge bg-danger';
                    
                    // Show error message if available
                    if (document.ocr_error) {
                        const ocrError = document.getElementById('documentOcrError');
                        ocrError.textContent = document.ocr_error;
                        ocrError.classList.remove('d-none');
                    }
                }
            }
            
            // Add event listener to OCR button
            const applyOcrButton = document.getElementById('documentApplyOcrButton');
            const ocrProgress = document.getElementById('documentOcrProgress');
            const ocrError = document.getElementById('documentOcrError');
            const ocrSuccess = document.getElementById('documentOcrSuccess');
            
            applyOcrButton.addEventListener('click', function() {
                // Show progress and hide error/success messages
                ocrProgress.classList.remove('d-none');
                ocrError.classList.add('d-none');
                ocrSuccess.classList.add('d-none');
                
                // Disable button during processing
                applyOcrButton.disabled = true;
                
                // Make API request to start OCR processing
                fetch(`/api/documents/${document.id}/ocr`, {
                    method: 'POST'
                })
                .then(response => {
                    // Check if response is OK (HTTP status between 200-299)
                    if (!response.ok) {
                        return response.json().then(errData => {
                            throw new Error(errData.error || `Error: ${response.status}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    // Success - OCR request accepted
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to request OCR processing');
                    }
                    
                    // If immediately complete
                    if (data.ocr_status === 'completed') {
                        ocrProgress.classList.add('d-none');
                        applyOcrButton.disabled = false;
                        ocrSuccess.classList.remove('d-none');
                        ocrStatusBadge.textContent = 'OCR: Completed';
                        ocrStatusBadge.classList.remove('d-none');
                    } 
                    // If background processing, start polling
                    else if (data.ocr_status === 'processing') {
                        ocrStatusBadge.textContent = 'OCR: Processing';
                        ocrStatusBadge.classList.remove('d-none');
                        // Start polling for status updates
                        pollOcrStatus(document.id, 'document');
                    }
                })
                .catch(error => {
                    console.error('Error requesting OCR processing:', error);
                    ocrError.textContent = error.message || 'An error occurred during OCR processing';
                    ocrError.classList.remove('d-none');
                    ocrProgress.classList.add('d-none');
                    applyOcrButton.disabled = false;
                });
            });
        }
    }
    
    /**
     * Show the edit document modal
     */
    function showEditDocumentModal(documentId) {
        // Find document in cache
        const document = documents.find(doc => doc.id.toString() === documentId.toString());
        
        if (!document) {
            // If not in cache, fetch it
            fetch(`/api/documents/${documentId}`)
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to load document details');
                    }
                    
                    populateEditForm(data.document);
                })
                .catch(error => {
                    console.error('Error loading document details:', error);
                    showAlert('Error loading document details: ' + error.message, 'danger');
                });
        } else {
            // Use cached document data
            populateEditForm(document);
        }
    }
    
    /**
     * Populate the edit document form
     */
    function populateEditForm(document) {
        // Populate form fields
        editDocumentId.value = document.id;
        editDocumentTitle.value = document.title || '';
        editDocumentAuthors.value = document.authors || '';
        editDocumentJournal.value = document.journal || '';
        editDocumentDOI.value = document.doi || '';
        
        // Format date for input field (YYYY-MM-DD)
        if (document.publication_date) {
            const date = new Date(document.publication_date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            editDocumentPublicationDate.value = `${year}-${month}-${day}`;
        } else {
            editDocumentPublicationDate.value = '';
        }
        
        // Format tags for Bootstrap Tags input
        if (document.tags && document.tags.length > 0) {
            editDocumentTags.value = document.tags.join(', ');
        } else {
            editDocumentTags.value = '';
        }
        
        // Initialize tags input if not already done
        if (!window.tagsInput) {
            window.tagsInput = new bootstrap.Popover(editDocumentTags, {
                html: true,
                content: 'Enter comma-separated tags',
                trigger: 'focus'
            });
        }
        
        // Populate collections dropdown
        populateCollectionsDropdown(editDocumentCollection);
        
        // Set selected collection
        if (document.collection_id) {
            editDocumentCollection.value = document.collection_id;
        } else {
            editDocumentCollection.value = '';
        }
        
        // Update citation preview
        citationPreview.textContent = document.citation_apa || 'Citation will be updated after saving changes';
        
        // Check text extraction quality and show OCR controls if needed
        const qualityEl = document.getElementById('textQualityBadge');
        if (qualityEl) {
            qualityEl.innerHTML = getQualityBadge(document.text_extraction_quality);
            qualityEl.nextElementSibling.textContent = getQualityDescription(document.text_extraction_quality);
            
            // Show OCR controls if needed
            const modalOcrControls = document.getElementById('modalOcrControls');
            if (modalOcrControls) {
                if (document.text_extraction_quality === 'limited' || document.text_extraction_quality === 'none') {
                    modalOcrControls.classList.remove('d-none');
                    
                    // Setup OCR status badge
                    const ocrStatusBadge = document.getElementById('ocrStatusBadge');
                    const ocrProgress = document.getElementById('ocrProgress');
                    const ocrError = document.getElementById('ocrError');
                    const ocrSuccess = document.getElementById('ocrSuccess');
                    const applyOcrButton = document.getElementById('applyOcrButton');
                    
                    // Reset state
                    ocrProgress.classList.add('d-none');
                    ocrError.classList.add('d-none');
                    ocrSuccess.classList.add('d-none');
                    applyOcrButton.disabled = false;
                    
                    // Check current OCR status
                    if (document.ocr_status) {
                        ocrStatusBadge.classList.remove('d-none');
                        
                        if (document.ocr_status === 'pending') {
                            ocrStatusBadge.textContent = 'OCR: Pending';
                            ocrStatusBadge.className = 'badge bg-secondary';
                        } else if (document.ocr_status === 'processing') {
                            ocrStatusBadge.textContent = 'OCR: Processing';
                            ocrStatusBadge.className = 'badge bg-info';
                            // Start polling for status updates
                            pollOcrStatus(document.id, 'modal');
                        } else if (document.ocr_status === 'completed') {
                            ocrStatusBadge.textContent = 'OCR: Completed';
                            ocrStatusBadge.className = 'badge bg-success';
                        } else if (document.ocr_status === 'failed') {
                            ocrStatusBadge.textContent = 'OCR: Failed';
                            ocrStatusBadge.className = 'badge bg-danger';
                            
                            // Show error message if available
                            if (document.ocr_error) {
                                ocrError.textContent = document.ocr_error;
                                ocrError.classList.remove('d-none');
                            }
                        }
                    } else {
                        ocrStatusBadge.classList.add('d-none');
                    }
                    
                    // Add click handler for OCR button
                    applyOcrButton.onclick = function() {
                        requestOcrProcessing(document.id, 'modal');
                    };
                } else {
                    modalOcrControls.classList.add('d-none');
                }
            }
        }
        
        // Show modal
        editDocumentModal.show();
    }
    
    /**
     * Handle save document button
     */
    if (saveDocumentButton) {
        saveDocumentButton.addEventListener('click', function() {
            // Get form data
            const id = editDocumentId.value;
            const title = editDocumentTitle.value.trim();
            const authors = editDocumentAuthors.value.trim();
            const journal = editDocumentJournal.value.trim();
            const doi = editDocumentDOI.value.trim();
            const publicationDate = editDocumentPublicationDate.value;
            
            // Get tags - split by comma and trim whitespace
            let tags = [];
            if (editDocumentTags.value.trim()) {
                tags = editDocumentTags.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            }
            
            // Get collection ID
            const collectionId = editDocumentCollection.value || null;
            
            // Prepare data for API
            const data = {
                title: title,
                authors: authors,
                journal: journal,
                doi: doi,
                publication_date: publicationDate || null,
                tags: tags,
                collection_id: collectionId
            };
            
            // Call API to update document
            fetch(`/api/documents/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (!result.success) {
                    throw new Error(result.error || 'Failed to update document');
                }
                
                // Show success message
                showAlert('Document updated successfully', 'success');
                
                // Hide modal
                editDocumentModal.hide();
                
                // Reload documents to refresh the list
                loadDocuments();
                
                // Reload document details if currently viewing
                if (currentDocumentId === id) {
                    showDocumentDetails(id);
                }
            })
            .catch(error => {
                console.error('Error updating document:', error);
                showAlert('Error updating document: ' + error.message, 'danger');
            });
        });
    }
    
    /**
     * Confirm delete document
     */
    function confirmDeleteDocument(documentId) {
        // Set delete type and ID
        deleteType = 'document';
        deleteId = documentId;
        
        // Find document in local array
        const document = documents.find(doc => doc.id.toString() === documentId.toString());
        const title = document ? document.title : 'this document';
        
        // Update confirm message
        deleteConfirmMessage.innerHTML = `
            Are you sure you want to delete <strong>${title}</strong>?
            <br><br>
            <span class="text-danger">
                <i class="fas fa-exclamation-triangle"></i> 
                This action cannot be undone. The document and all its associated data will be permanently deleted.
            </span>
        `;
        
        // Show modal
        deleteConfirmModal.show();
    }
    
    /**
     * Handle confirm delete button
     */
    if (confirmDeleteButton) {
        confirmDeleteButton.addEventListener('click', function() {
            if (deleteType === 'document' && deleteId) {
                // Show loading state in document details
                documentDetails.innerHTML = `
                    <div class="text-center p-5">
                        <div class="spinner-border text-secondary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3 text-muted">Deleting document...</p>
                    </div>
                `;
                
                // Call API to delete document
                fetch(`/api/documents/${deleteId}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(result => {
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to delete document');
                    }
                    
                    // Show success message
                    showAlert('Document deleted successfully', 'success');
                    
                    // Hide modal
                    deleteConfirmModal.hide();
                    
                    // Reload documents to refresh the list
                    loadDocuments();
                    
                    // Clear document details
                    documentDetails.innerHTML = `
                        <div class="text-center p-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <p class="text-muted">Select a document to view details</p>
                        </div>
                    `;
                    
                    // Disable edit and delete buttons
                    if (editDocumentButton) {
                        editDocumentButton.disabled = true;
                    }
                    if (deleteDocumentButton) {
                        deleteDocumentButton.disabled = true;
                    }
                })
                .catch(error => {
                    console.error('Error deleting document:', error);
                    showAlert('Error deleting document: ' + error.message, 'danger');
                    
                    // Restore document details
                    showDocumentDetails(deleteId);
                });
            } else if (deleteType === 'collection' && deleteId) {
                // Call API to delete collection
                fetch(`/api/collections/${deleteId}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(result => {
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to delete collection');
                    }
                    
                    // Show success message
                    showAlert('Collection deleted successfully', 'success');
                    
                    // Hide modal
                    deleteConfirmModal.hide();
                    
                    // Reload collections
                    loadCollections();
                    
                    // If managing collections modal is visible, refresh the table
                    if (manageCollectionsModal._element.classList.contains('show')) {
                        loadCollectionsTable();
                    } else {
                        // If on main document browser, reload documents
                        loadDocuments();
                    }
                })
                .catch(error => {
                    console.error('Error deleting collection:', error);
                    showAlert('Error deleting collection: ' + error.message, 'danger');
                });
            }
        });
    }
    
    /**
     * Helper function to show alerts
     */
    function showAlert(message, type = 'info') {
        const alertsContainer = document.getElementById('alertsContainer');
        if (!alertsContainer) return;
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        alertsContainer.appendChild(alert);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => {
                alertsContainer.removeChild(alert);
            }, 150);
        }, 5000);
    }
    
    /**
     * Debounce function for search input
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Request OCR processing for a document
     */
    function requestOcrProcessing(documentId, source = 'document') {
        // Get the relevant UI elements based on source
        const ocrStatusBadge = document.getElementById(source === 'document' ? 'documentOcrStatusBadge' : 'ocrStatusBadge');
        const ocrError = document.getElementById(source === 'document' ? 'documentOcrError' : 'ocrError');
        const ocrSuccess = document.getElementById(source === 'document' ? 'documentOcrSuccess' : 'ocrSuccess');
        const ocrProgress = document.getElementById(source === 'document' ? 'documentOcrProgress' : 'ocrProgress');
        const applyOcrButton = document.getElementById(source === 'document' ? 'documentApplyOcrButton' : 'applyOcrButton');
        
        // Show progress and hide error/success messages
        ocrProgress.classList.remove('d-none');
        ocrError.classList.add('d-none');
        ocrSuccess.classList.add('d-none');
        
        // Disable button during processing
        applyOcrButton.disabled = true;
        
        // Make API request to start OCR processing
        fetch(`/api/documents/${documentId}/ocr`, {
            method: 'POST'
        })
        .then(response => {
            // Check if response is OK (HTTP status between 200-299)
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `Error: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Success - OCR request accepted
            if (!data.success) {
                throw new Error(data.error || 'Failed to request OCR processing');
            }
            
            // If immediately complete
            if (data.ocr_status === 'completed') {
                ocrProgress.classList.add('d-none');
                ocrSuccess.classList.remove('d-none');
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
            ocrError.textContent = error.message || 'An error occurred during OCR processing';
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
                .then(response => {
                    // Check if response is OK (HTTP status between 200-299)
                    if (!response.ok) {
                        return response.json().then(errData => {
                            throw new Error(errData.error || `Error: ${response.status}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to check OCR status');
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
                    ocrError.textContent = error.message || 'An error occurred while checking OCR status';
                    ocrError.classList.remove('d-none');
                    ocrProgress.classList.add('d-none');
                    applyOcrButton.disabled = false;
                });
        }, 3000); // Check every 3 seconds
    }
}

// Initialize document browser when DOM is loaded
document.addEventListener('DOMContentLoaded', initDocumentBrowser);
