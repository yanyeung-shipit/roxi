document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const documentsList = document.getElementById('documentsList');
    const documentDetails = document.getElementById('documentDetails');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const filterTagSelect = document.getElementById('filterTagSelect');
    const collectionFilterSelect = document.getElementById('collectionFilter');
    const dateFilterSelect = document.getElementById('dateFilter');
    const actionButtons = document.getElementById('actionButtons');
    const multiSelectBtn = document.getElementById('multiSelectBtn');
    const batchMoveBtn = document.getElementById('batchMoveBtn');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    const confirmDeleteButton = document.getElementById('confirmDeleteButton');
    const confirmBatchDeleteButton = document.getElementById('confirmBatchDeleteButton');
    
    // Modals with null checks
    const editDocumentModal = document.getElementById('editDocumentModal') ? 
        new bootstrap.Modal(document.getElementById('editDocumentModal')) : null;
    const collectionModal = document.getElementById('collectionModal') ? 
        new bootstrap.Modal(document.getElementById('collectionModal')) : null;
    const manageCollectionsModal = document.getElementById('manageCollectionsModal') ?
        new bootstrap.Modal(document.getElementById('manageCollectionsModal')) : null;
    const deleteConfirmModal = document.getElementById('deleteConfirmModal') ?
        new bootstrap.Modal(document.getElementById('deleteConfirmModal')) : null;
    const batchMoveModal = document.getElementById('batchMoveModal') ?
        new bootstrap.Modal(document.getElementById('batchMoveModal')) : null;
    const batchDeleteModal = document.getElementById('batchDeleteModal') ?
        new bootstrap.Modal(document.getElementById('batchDeleteModal')) : null;
    
    // Modal elements
    const editDocumentId = document.getElementById('editDocumentId');
    const editDocumentTitle = document.getElementById('editDocumentTitle');
    const editDocumentAuthors = document.getElementById('editDocumentAuthors');
    const editDocumentDoi = document.getElementById('editDocumentDoi');
    const editDocumentDate = document.getElementById('editDocumentDate');
    const editDocumentJournal = document.getElementById('editDocumentJournal');
    const editDocumentTags = document.getElementById('editDocumentTags');
    const citationPreview = document.getElementById('citationPreview');
    
    const collectionId = document.getElementById('collectionId');
    const collectionName = document.getElementById('collectionName');
    const collectionDescription = document.getElementById('collectionDescription');
    const collectionParent = document.getElementById('collectionParent');
    const collectionModalTitle = document.getElementById('collectionModalTitle');
    const saveCollectionButton = document.getElementById('saveCollectionButton');
    const deleteCollectionButton = document.getElementById('deleteCollectionButton');
    
    const deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
    
    const batchMoveCollection = document.getElementById('batchMoveCollection');
    const batchMoveSaveButton = document.getElementById('batchMoveSaveButton');
    
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
    let isMultiSelectMode = false;
    let selectedDocuments = new Set();
    
    // Initial load
    if (documentsList) {
        loadDocuments();
    }
    if (collectionFilterSelect) {
        loadCollections();
    }
    
    // Handle search input
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            searchTerm = searchInput.value.trim();
            currentPage = 1;
            loadDocuments();
        }, 300));
    }
    
    // Handle clear search
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            if (searchInput) {
                searchInput.value = '';
                searchTerm = '';
                loadDocuments();
            }
        });
    }
    
    // Handle tag filter change
    if (filterTagSelect) {
        filterTagSelect.addEventListener('change', function() {
            activeTag = filterTagSelect.value === '' ? null : filterTagSelect.value;
            currentPage = 1;
            loadDocuments();
        });
    }
    
    // Handle collection filter change
    if (collectionFilterSelect) {
        collectionFilterSelect.addEventListener('change', function() {
            activeCollection = collectionFilterSelect.value;
            currentPage = 1;
            loadDocuments();
        });
    }
    
    // Handle date filter change
    if (dateFilterSelect) {
        dateFilterSelect.addEventListener('change', function() {
            currentPage = 1;
            loadDocuments();
        });
    }
    
    // Handle refresh button
    const refreshDocumentsBtn = document.getElementById('refreshDocumentsBtn');
    if (refreshDocumentsBtn) {
        refreshDocumentsBtn.addEventListener('click', function() {
            loadDocuments();
            loadCollections();
        });
    }
    
    // Handle multi-select toggle
    const toggleMultiSelectBtn = document.getElementById('toggleMultiSelectBtn');
    if (toggleMultiSelectBtn) {
        toggleMultiSelectBtn.addEventListener('click', function() {
            isMultiSelectMode = !isMultiSelectMode;
            toggleMultiSelectMode();
        });
    }
    
    // Handle batch move button
    if (batchMoveBtn) {
        batchMoveBtn.addEventListener('click', function() {
            if (selectedDocuments.size === 0) return;
            
            // Populate the batch move modal
            populateBatchMoveModal();
            if (batchMoveModal) {
                batchMoveModal.show();
            }
        });
    }
    
    // Handle batch delete button
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', function() {
            if (selectedDocuments.size === 0) return;
            
            // Set up batch delete modal
            if (document.getElementById("batchDeleteCount")) {
                document.getElementById("batchDeleteCount").textContent = selectedDocuments.size;
            }
            
            // Show batch delete modal
            if (batchDeleteModal) {
                batchDeleteModal.show();
            }
        });
    }
    
    // Handle confirm batch delete button
    if (confirmBatchDeleteButton) {
        confirmBatchDeleteButton.addEventListener('click', function() {
            batchDeleteDocuments();
            if (batchDeleteModal) {
                batchDeleteModal.hide();
            }
        });
    }
    
    // Handle batch move save
    if (batchMoveSaveButton && batchMoveCollection) {
        batchMoveSaveButton.addEventListener('click', function() {
            const collectionIdValue = batchMoveCollection.value;
            if (selectedDocuments.size === 0) return;
            
            const docIds = Array.from(selectedDocuments);
            
            // Send request to move documents
            fetch('/documents/api/documents/batch/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    document_ids: docIds,
                    collection_id: collectionIdValue === '' ? null : collectionIdValue
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Documents moved successfully', 'success');
                    if (batchMoveModal) {
                        batchMoveModal.hide();
                    }
                    
                    // Reset multi-select
                    isMultiSelectMode = false;
                    selectedDocuments.clear();
                    toggleMultiSelectMode();
                    
                    // Reload documents
                    loadDocuments();
                } else {
                    throw new Error(data.error || 'Failed to move documents');
                }
            })
            .catch(error => {
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Handle the new collection button
    const newCollectionButton = document.getElementById('newCollectionButton');
    if (newCollectionButton && collectionModal) {
        newCollectionButton.addEventListener('click', function() {
            // Clear the form for a new collection
            if (collectionId) collectionId.value = '';
            if (collectionName) collectionName.value = '';
            if (collectionDescription) collectionDescription.value = '';
            if (collectionParent) collectionParent.value = '';
            
            // Update modal title and buttons
            if (collectionModalTitle) {
                collectionModalTitle.textContent = 'Create New Collection';
            }
            if (deleteCollectionButton) {
                deleteCollectionButton.classList.add('d-none');
            }
            
            // Show the modal
            collectionModal.show();
        });
    }
    
    // Handle the manage collections button
    const manageCollectionsButton = document.getElementById('manageCollectionsButton');
    if (manageCollectionsButton && manageCollectionsModal) {
        manageCollectionsButton.addEventListener('click', function() {
            // Load collections data for the table
            loadCollectionsTable();
            
            // Show the modal
            manageCollectionsModal.show();
        });
    }
    
    // Handle collection form submission
    if (saveCollectionButton && collectionName) {
        saveCollectionButton.addEventListener('click', function() {
            const isEdit = collectionId && collectionId.value !== '';
            const url = isEdit 
                ? `/documents/api/collections/${collectionId.value}` 
                : '/documents/api/collections';
            const method = isEdit ? 'PUT' : 'POST';
            
            // Validate form
            if (!collectionName.value.trim()) {
                showAlert('Collection name is required', 'warning');
                return;
            }
            
            // Prepare data
            const data = {
                name: collectionName.value.trim(),
                description: collectionDescription ? collectionDescription.value.trim() : '',
                parent_id: collectionParent && collectionParent.value === '' ? null : (collectionParent ? collectionParent.value : null)
            };
            
            // Send request
            fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    showAlert(`Collection ${isEdit ? 'updated' : 'created'} successfully`, 'success');
                    
                    // Close modal
                    if (collectionModal) {
                        collectionModal.hide();
                    }
                    
                    // Reload collections
                    loadCollections();
                } else {
                    throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} collection`);
                }
            })
            .catch(error => {
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Handle collection deletion
    if (deleteCollectionButton && collectionId) {
        deleteCollectionButton.addEventListener('click', function() {
            if (!collectionId.value) return;
            
            // Set up confirmation modal
            deleteType = 'collection';
            deleteId = collectionId.value;
            if (deleteConfirmMessage) {
                deleteConfirmMessage.textContent = 'Are you sure you want to delete this collection? Documents will be moved to the root level.';
            }
            
            // Hide collection modal and show confirmation modal
            if (collectionModal) {
                collectionModal.hide();
            }
            if (deleteConfirmModal) {
                deleteConfirmModal.show();
            }
        });
    }
    
    // Handle delete confirmation
    if (confirmDeleteButton) {
        confirmDeleteButton.addEventListener('click', function() {
            if (deleteType === 'document' && deleteId) {
                deleteDocument(deleteId);
            } else if (deleteType === 'collection' && deleteId) {
                deleteCollection(deleteId);
            }
            
            // Close modal
            if (deleteConfirmModal) {
                deleteConfirmModal.hide();
            }
        });
    }
    
    // Handle document editing
    const editDocumentButton = document.getElementById('editDocumentButton');
    if (editDocumentButton && editDocumentModal) {
        editDocumentButton.addEventListener('click', function() {
            if (!currentDocumentId) return;
            
            // Find current document
            const doc = documents.find(d => d.id === currentDocumentId);
            if (!doc) return;
            
            // Populate form
            if (editDocumentId) editDocumentId.value = doc.id;
            if (editDocumentTitle) editDocumentTitle.value = doc.title || '';
            if (editDocumentAuthors) editDocumentAuthors.value = doc.authors || '';
            if (editDocumentJournal) editDocumentJournal.value = doc.journal || '';
            
            // Handle publication date (format as YYYY-MM-DD)
            const editDocumentPublicationDate = document.getElementById('editDocumentPublicationDate');
            if (editDocumentPublicationDate && doc.publication_date) {
                // If date is in ISO format, extract just the date part
                const datePart = doc.publication_date.split('T')[0];
                editDocumentPublicationDate.value = datePart;
            } else if (editDocumentPublicationDate) {
                editDocumentPublicationDate.value = '';
            }
            
            // DOI
            const editDocumentDOI = document.getElementById('editDocumentDOI');
            if (editDocumentDOI) editDocumentDOI.value = doc.doi || '';
            
            // Tags
            if (editDocumentTags) editDocumentTags.value = doc.tags ? doc.tags.join(', ') : '';
            
            // Collection
            const editDocumentCollection = document.getElementById('editDocumentCollection');
            if (editDocumentCollection) editDocumentCollection.value = doc.collection_id || '';
            
            // Update citation preview
            updateCitationPreview();
            
            // Show modal
            editDocumentModal.show();
        });
    }

    // Handle document view PDF (opens in new tab)
    document.addEventListener('click', function(e) {
        if (e.target.matches('.view-pdf-button') || e.target.closest('.view-pdf-button')) {
            const button = e.target.matches('.view-pdf-button') ? e.target : e.target.closest('.view-pdf-button');
            const documentId = button.dataset.id;
            if (documentId) {
                window.open(`/documents/view/${documentId}`, '_blank');
            }
        }
    });
    
    // Handle document form submission
    const saveDocumentButton = document.getElementById('saveDocumentButton');
    if (saveDocumentButton && editDocumentId) {
        saveDocumentButton.addEventListener('click', function() {
            const docId = editDocumentId.value;
            if (!docId) return;
            
            // Prepare data
            const data = {};
            if (editDocumentTitle) data.title = editDocumentTitle.value.trim();
            if (editDocumentAuthors) data.authors = editDocumentAuthors.value.trim();
            if (editDocumentJournal) data.journal = editDocumentJournal.value.trim();
            
            const editDocumentDOI = document.getElementById('editDocumentDOI');
            if (editDocumentDOI) data.doi = editDocumentDOI.value.trim();
            
            const editDocumentPublicationDate = document.getElementById('editDocumentPublicationDate');
            if (editDocumentPublicationDate) data.publication_date = editDocumentPublicationDate.value;
            
            // Handle tags (convert from comma-separated to array)
            if (editDocumentTags) {
                const tagsValue = editDocumentTags.value.trim();
                data.tags = tagsValue ? tagsValue.split(',').map(tag => tag.trim()) : [];
            }
            
            // Handle collection
            const editDocumentCollection = document.getElementById('editDocumentCollection');
            if (editDocumentCollection) {
                data.collection_id = editDocumentCollection.value === '' ? null : editDocumentCollection.value;
            }
            
            // Send request
            fetch(`/documents/api/documents/${docId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    showAlert('Document updated successfully', 'success');
                    
                    // Close modal and update UI
                    if (editDocumentModal) {
                        editDocumentModal.hide();
                    }
                    
                    // Reload documents and refresh details
                    loadDocuments();
                    if (currentDocumentId) {
                        loadDocumentDetails(currentDocumentId);
                    }
                } else {
                    throw new Error(data.error || 'Failed to update document');
                }
            })
            .catch(error => {
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Document citation preview
    const editDocumentPublicationDate = document.getElementById('editDocumentPublicationDate');
    const editDocumentDOI = document.getElementById('editDocumentDOI');
    const editDocumentCollection = document.getElementById('editDocumentCollection');
    function updateCitationPreview() {
        if (!citationPreview) return;
        
        // Basic check if we have enough data
        if (!editDocumentAuthors || !editDocumentTitle || !editDocumentPublicationDate || !editDocumentJournal) {
            citationPreview.textContent = 'Fill in more fields to see citation preview';
            return;
        }
        
        const authors = editDocumentAuthors.value.trim();
        const title = editDocumentTitle.value.trim();
        const date = editDocumentPublicationDate.value;
        const journal = editDocumentJournal.value.trim();
        const doi = editDocumentDOI ? editDocumentDOI.value.trim() : '';
        
        if (!authors || !title) {
            citationPreview.textContent = 'Fill in more fields to see citation preview';
            return;
        }
        
        // Create a simple APA-style citation
        try {
            // Parse authors (assuming "Last, F." format)
            let authorText = '';
            if (authors) {
                const authorList = authors.split(',');
                if (authorList.length === 1) {
                    authorText = authors;
                } else if (authorList.length === 2) {
                    authorText = `${authorList[0]} & ${authorList[1]}`;
                } else {
                    authorText = `${authorList[0]} et al.`;
                }
            }
            
            // Format year
            let yearText = '';
            if (date) {
                const dateObj = new Date(date);
                yearText = `(${dateObj.getFullYear()})`;
            }
            
            // Format title and journal
            let titleText = title ? `${title}` : '';
            let journalText = '';
            if (journal) {
                journalText = `<em>${journal}</em>`;
                if (doi) {
                    journalText += `. https://doi.org/${doi}`;
                }
            }
            
            // Combine all parts
            let citation = '';
            if (authorText) citation += authorText + ' ';
            if (yearText) citation += yearText + '. ';
            if (titleText) citation += titleText + '. ';
            if (journalText) citation += journalText;
            
            citationPreview.innerHTML = citation;
        } catch (e) {
            citationPreview.textContent = 'Error generating citation preview';
        }
    }
    
    // Update citation on input
    if (editDocumentTitle) editDocumentTitle.addEventListener('input', updateCitationPreview);
    if (editDocumentAuthors) editDocumentAuthors.addEventListener('input', updateCitationPreview);
    if (editDocumentJournal) editDocumentJournal.addEventListener('input', updateCitationPreview);
    if (editDocumentPublicationDate) editDocumentPublicationDate.addEventListener('input', updateCitationPreview);
    if (editDocumentDOI) editDocumentDOI.addEventListener('input', updateCitationPreview);
    
    // Handle document deletion
    const deleteDocumentButton = document.getElementById('deleteDocumentButton');
    if (deleteDocumentButton) {
        deleteDocumentButton.addEventListener('click', function() {
            if (!currentDocumentId) return;
            
            // Set up confirmation modal
            deleteType = 'document';
            deleteId = currentDocumentId;
            if (deleteConfirmMessage) {
                deleteConfirmMessage.textContent = 'Are you sure you want to delete this document? This action cannot be undone.';
            }
            
            // Show confirmation modal
            if (deleteConfirmModal) {
                deleteConfirmModal.show();
            }
        });
    }
    
    // Pagination event listeners
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('page-link')) {
            const pageNum = e.target.dataset.page;
            if (pageNum && pageNum !== currentPage) {
                currentPage = parseInt(pageNum);
                loadDocuments();
            }
        }
    });
    
    // Document selection event
    document.addEventListener('click', function(e) {
        if (e.target.matches('.document-item') || e.target.closest('.document-item')) {
            if (isMultiSelectMode) {
                // Handle multi-select
                const item = e.target.matches('.document-item') ? e.target : e.target.closest('.document-item');
                const docId = parseInt(item.dataset.id);
                
                if (selectedDocuments.has(docId)) {
                    selectedDocuments.delete(docId);
                    item.classList.remove('selected');
                } else {
                    selectedDocuments.add(docId);
                    item.classList.add('selected');
                }
                
                // Update UI based on selection
                updateMultiSelectUI();
            } else {
                // Handle single document selection
                const item = e.target.matches('.document-item') ? e.target : e.target.closest('.document-item');
                const docId = parseInt(item.dataset.id);
                
                // Update UI
                document.querySelectorAll('.document-item').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');
                
                // Load document details
                currentDocumentId = docId;
                loadDocumentDetails(docId);
                
                // Show action buttons
                if (actionButtons) {
                    actionButtons.classList.remove('d-none');
                }
            }
        }
    });
    
    // Collection click event (for managing collections)
    document.addEventListener('click', function(e) {
        if (e.target.matches('.collection-edit-btn') || e.target.closest('.collection-edit-btn')) {
            const button = e.target.matches('.collection-edit-btn') ? e.target : e.target.closest('.collection-edit-btn');
            const collectionItem = button.closest('tr');
            if (!collectionItem) return;
            
            const collectionData = {
                id: collectionItem.dataset.id,
                name: collectionItem.dataset.name,
                description: collectionItem.dataset.description,
                parent_id: collectionItem.dataset.parentId
            };
            
            // Populate form
            if (collectionId) collectionId.value = collectionData.id;
            if (collectionName) collectionName.value = collectionData.name;
            if (collectionDescription) collectionDescription.value = collectionData.description || '';
            if (collectionParent) collectionParent.value = collectionData.parent_id || '';
            
            // Update modal title and buttons
            if (collectionModalTitle) {
                collectionModalTitle.textContent = 'Edit Collection';
            }
            if (deleteCollectionButton) {
                deleteCollectionButton.classList.remove('d-none');
            }
            
            // Hide manage collections and show edit modal
            if (manageCollectionsModal) {
                manageCollectionsModal.hide();
            }
            if (collectionModal) {
                collectionModal.show();
            }
        }
    });
    
    // Helper functions
    /**
     * Loads documents from the API with filtering and pagination
     */
    function loadDocuments() {
        if (!documentsList) return;
        
        // Show loading indicator
        documentsList.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        // Build query string
        const params = new URLSearchParams();
        params.append('page', currentPage);
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        if (activeTag) {
            params.append('tag', activeTag);
        }
        
        if (activeCollection) {
            params.append('collection_id', activeCollection);
        }
        
        if (dateFilterSelect && dateFilterSelect.value) {
            params.append('date_filter', dateFilterSelect.value);
        }
        
        // Fetch documents
        fetch(`/documents/api/documents?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                documents = data.documents;
                totalPages = data.total_pages;
                renderDocuments();
                renderPagination();
                loadTags();
            })
            .catch(error => {
                documentsList.innerHTML = `<div class="alert alert-danger">Error loading documents: ${error.message}</div>`;
            });
    }
    
    /**
     * Renders documents in the document list
     */
    function renderDocuments() {
        if (!documentsList) return;
        
        if (documents.length === 0) {
            documentsList.innerHTML = `
                <div class="text-center p-5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <p class="text-muted">No documents found</p>
                    <p class="text-muted small">Upload documents to get started</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="list-group document-list">';
        
        documents.forEach(doc => {
            const docDate = doc.publication_date ? new Date(doc.publication_date) : new Date(doc.upload_date);
            const formattedDate = docDate.toLocaleDateString();
            const isSelected = selectedDocuments.has(doc.id);
            const isActive = doc.id === currentDocumentId;
            
            html += `
                <div class="list-group-item document-item ${isMultiSelectMode && isSelected ? 'selected' : ''} ${!isMultiSelectMode && isActive ? 'active' : ''}" 
                     data-id="${doc.id}">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-1 document-title">${doc.title || 'Untitled Document'}</h5>
                        <small>${formattedDate}</small>
                    </div>
                    ${doc.authors ? `<p class="mb-1 text-muted small">${doc.authors}</p>` : ''}
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <div class="document-tags">
                            ${doc.tags && doc.tags.length > 0 
                                ? doc.tags.map(tag => `<span class="badge rounded-pill bg-secondary me-1">${tag}</span>`).join('') 
                                : '<span class="text-muted small">No tags</span>'}
                        </div>
                        <div class="document-actions">
                            <button class="btn btn-sm btn-outline-primary view-pdf-button" data-id="${doc.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        documentsList.innerHTML = html;
    }
    
    /**
     * Renders pagination controls
     */
    function renderPagination() {
        const paginationElement = document.getElementById('documentsPagination');
        if (!paginationElement) return;
        
        if (totalPages <= 1) {
            paginationElement.innerHTML = '';
            return;
        }
        
        let html = '<ul class="pagination justify-content-center">';
        
        // Previous button
        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}" ${currentPage === 1 ? 'tabindex="-1" aria-disabled="true"' : ''}>
                    Previous
                </a>
            </li>
        `;
        
        // Page numbers
        const maxPages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(totalPages, startPage + maxPages - 1);
        
        if (endPage - startPage + 1 < maxPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Next button
        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'tabindex="-1" aria-disabled="true"' : ''}>
                    Next
                </a>
            </li>
        `;
        
        html += '</ul>';
        paginationElement.innerHTML = html;
    }
    
    /**
     * Loads tags for the filter dropdown
     */
    function loadTags() {
        if (!filterTagSelect) return;
        
        fetch('/documents/api/tags')
            .then(response => response.json())
            .then(data => {
                // Keep current selection
                const currentValue = filterTagSelect.value;
                
                // Build options
                let html = '<option value="">All Tags</option>';
                data.tags.forEach(tag => {
                    html += `<option value="${tag}" ${currentValue === tag ? 'selected' : ''}>${tag}</option>`;
                });
                
                filterTagSelect.innerHTML = html;
            })
            .catch(error => {
                console.error('Error loading tags:', error);
            });
    }
    
    /**
     * Loads collections for the dropdowns
     */
    function loadCollections() {
        if (!collectionFilterSelect) return;
        
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                collections = data.collections;
                
                // Keep current selection for filter
                const currentFilterValue = collectionFilterSelect.value;
                
                // Build filter options
                let filterHtml = '<option value="">All Collections</option>';
                collections.forEach(collection => {
                    const indent = '&nbsp;'.repeat(collection.level * 3);
                    filterHtml += `<option value="${collection.id}" ${currentFilterValue == collection.id ? 'selected' : ''}>${indent}${collection.name}</option>`;
                });
                
                collectionFilterSelect.innerHTML = filterHtml;
                
                // Update other collection dropdowns
                updateCollectionDropdowns();
            })
            .catch(error => {
                console.error('Error loading collections:', error);
            });
    }
    
    /**
     * Update all collection dropdowns with current data
     */
    function updateCollectionDropdowns() {
        // Edit document collection dropdown
        const editDocumentCollection = document.getElementById('editDocumentCollection');
        if (editDocumentCollection) {
            const currentValue = editDocumentCollection.value;
            
            let html = '<option value="">None</option>';
            collections.forEach(collection => {
                const indent = '&nbsp;'.repeat(collection.level * 3);
                html += `<option value="${collection.id}" ${currentValue == collection.id ? 'selected' : ''}>${indent}${collection.name}</option>`;
            });
            
            editDocumentCollection.innerHTML = html;
        }
        
        // Collection parent dropdown
        if (collectionParent) {
            const currentValue = collectionParent.value;
            const currentId = collectionId ? collectionId.value : null;
            
            let html = '<option value="">None (Root Level)</option>';
            collections.forEach(collection => {
                // Skip self (can't be parent of itself)
                if (currentId && collection.id.toString() === currentId.toString()) return;
                
                const indent = '&nbsp;'.repeat(collection.level * 3);
                html += `<option value="${collection.id}" ${currentValue == collection.id ? 'selected' : ''}>${indent}${collection.name}</option>`;
            });
            
            collectionParent.innerHTML = html;
        }
    }
    
    /**
     * Populate the batch move modal with collections
     */
    function populateBatchMoveModal() {
        if (!batchMoveCollection) return;
        
        let html = '<option value="">None (Root Level)</option>';
        collections.forEach(collection => {
            const indent = '&nbsp;'.repeat(collection.level * 3);
            html += `<option value="${collection.id}">${indent}${collection.name}</option>`;
        });
        
        batchMoveCollection.innerHTML = html;
        
        // Update count
        const batchMoveCount = document.getElementById('batchMoveCount');
        if (batchMoveCount) {
            batchMoveCount.textContent = selectedDocuments.size;
        }
    }
    
    /**
     * Load document details from the API
     */
    function loadDocumentDetails(documentId) {
        if (!documentDetails) return;
        
        // Show loading
        documentDetails.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        fetch(`/documents/api/documents/${documentId}`)
            .then(response => response.json())
            .then(data => {
                if (!data.document) {
                    throw new Error('Document not found');
                }
                
                renderDocumentDetails(data.document);
            })
            .catch(error => {
                documentDetails.innerHTML = `<div class="alert alert-danger">Error loading document details: ${error.message}</div>`;
            });
    }
    
    /**
     * Render document details in the details panel
     */
    function renderDocumentDetails(document) {
        if (!documentDetails) return;
        
        // Format dates
        let formattedUploadDate = 'Unknown';
        if (document.upload_date) {
            const uploadDate = new Date(document.upload_date);
            formattedUploadDate = uploadDate.toLocaleDateString() + ' ' + uploadDate.toLocaleTimeString();
        }
        
        let formattedPublicationDate = 'Unknown';
        if (document.publication_date) {
            const pubDate = new Date(document.publication_date);
            formattedPublicationDate = pubDate.toLocaleDateString();
        }
        
        // Generate details HTML
        let html = `
            <div class="document-details-content">
                <h3 class="mb-3">${document.title || 'Untitled Document'}</h3>
                
                <div class="mb-4">
                    <div class="mb-3">
                        <h6 class="text-muted">Authors</h6>
                        <p>${document.authors || 'Unknown'}</p>
                    </div>
                    
                    <div class="mb-3">
                        <h6 class="text-muted">Journal</h6>
                        <p>${document.journal || 'N/A'}</p>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <h6 class="text-muted">Publication Date</h6>
                            <p>${formattedPublicationDate}</p>
                        </div>
                        <div class="col-md-6">
                            <h6 class="text-muted">Upload Date</h6>
                            <p>${formattedUploadDate}</p>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <h6 class="text-muted">DOI</h6>
                        <p>${document.doi ? `<a href="https://doi.org/${document.doi}" target="_blank">${document.doi}</a>` : 'N/A'}</p>
                    </div>
                    
                    <div class="mb-3">
                        <h6 class="text-muted">Collection</h6>
                        <p>${document.collection_name || 'None'}</p>
                    </div>
                    
                    <div class="mb-3">
                        <h6 class="text-muted">Tags</h6>
                        <div>
                            ${document.tags && document.tags.length > 0 
                                ? document.tags.map(tag => `<span class="badge bg-secondary me-1 mb-1">${tag}</span>`).join('') 
                                : 'No tags'}
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <h6 class="text-muted">Citation</h6>
                        <p class="citation-text">${document.citation_apa || 'Citation not available'}</p>
                    </div>
                </div>
                
                <div class="mb-4">
                    <h5 class="mb-3">Document Preview</h5>
                    <div class="text-center">
                        <a href="/documents/view/${document.id}" class="btn btn-primary" target="_blank">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text me-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            View PDF
                        </a>
                    </div>
                </div>
                
                <div class="mb-4">
                    <h5 class="mb-3">Text Content Preview</h5>
                    <div class="text-content-preview">
                        ${document.full_text ? document.full_text.substring(0, 500) + '...' : 'No text content available'}
                    </div>
                </div>
            </div>
        `;
        
        documentDetails.innerHTML = html;
    }
    
    /**
     * Load collections table for management
     */
    function loadCollectionsTable() {
        const collectionsTableBody = document.getElementById('collectionsTableBody');
        if (!collectionsTableBody) return;
        
        // Show loading
        collectionsTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
        
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                if (!data.collections || data.collections.length === 0) {
                    collectionsTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No collections found</td></tr>';
                    return;
                }
                
                let html = '';
                data.collections.forEach(collection => {
                    const indent = '&nbsp;'.repeat(collection.level * 3);
                    
                    html += `
                        <tr data-id="${collection.id}" 
                            data-name="${collection.name}" 
                            data-description="${collection.description || ''}" 
                            data-parent-id="${collection.parent_id || ''}">
                            <td>${indent}${collection.name}</td>
                            <td>${collection.description || ''}</td>
                            <td>${collection.document_count}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary collection-edit-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                collectionsTableBody.innerHTML = html;
            })
            .catch(error => {
                collectionsTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error loading collections: ${error.message}</td></tr>`;
            });
    }
    
    /**
     * Delete a document
     */
    function deleteDocument(documentId) {
        fetch(`/documents/api/documents/${documentId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Document deleted successfully', 'success');
                
                // Reload documents
                loadDocuments();
                
                // Clear document details if this was the active document
                if (documentId === currentDocumentId) {
                    currentDocumentId = null;
                    if (documentDetails) {
                        documentDetails.innerHTML = `
                            <div class="text-center p-5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                <p class="text-muted">Select a document to view details</p>
                            </div>
                        `;
                    }
                    
                    // Hide action buttons
                    if (actionButtons) {
                        actionButtons.classList.add('d-none');
                    }
                }
            } else {
                throw new Error(data.error || 'Failed to delete document');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    /**
     * Batch deletes selected documents
     */
    function batchDeleteDocuments() {
        if (selectedDocuments.size === 0) return;
        
        const docIds = Array.from(selectedDocuments);
        
        fetch('/documents/api/documents/batch/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                document_ids: docIds
            })
        })
        .then(response => {
            // Always read the JSON, regardless of status code
            return response.json().then(data => {
                return { status: response.status, data };
            });
        })
        .then(result => {
            // Check if the operation was successful
            if (result.data.success) {
                showAlert(`${docIds.length} document(s) deleted successfully`, 'success');
                
                // Reset multi-select
                isMultiSelectMode = false;
                selectedDocuments.clear();
                toggleMultiSelectMode();
                
                // Reload documents
                loadDocuments();
                
                // Clear document details if current document was deleted
                if (docIds.includes(currentDocumentId)) {
                    currentDocumentId = null;
                    if (documentDetails) {
                        documentDetails.innerHTML = `
                            <div class="text-center p-5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                <p class="text-muted">Select a document to view details</p>
                            </div>
                        `;
                    }
                    
                    // Hide action buttons
                    if (actionButtons) {
                        actionButtons.classList.add('d-none');
                    }
                }
            } else {
                // Handle error from the server
                throw new Error(result.data.error || 'Failed to delete documents');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    /**
     * Delete a collection
     */
    function deleteCollection(collectionId) {
        fetch(`/documents/api/collections/${collectionId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Collection deleted successfully', 'success');
                
                // Reload collections
                loadCollections();
                
                // Reload documents if filtering by collection
                if (activeCollection === collectionId) {
                    activeCollection = '';
                    if (collectionFilterSelect) {
                        collectionFilterSelect.value = '';
                    }
                    loadDocuments();
                }
            } else {
                throw new Error(data.error || 'Failed to delete collection');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    /**
     * Toggle multi-select mode
     */
    function toggleMultiSelectMode() {
        const documentItems = document.querySelectorAll('.document-item');
        const multiSelectControls = document.getElementById('multiSelectControls');
        const toggleMultiSelectBtn = document.getElementById('toggleMultiSelectBtn');
        
        if (isMultiSelectMode) {
            // Enable multi-select mode
            documentItems.forEach(item => {
                item.classList.remove('active');
                if (selectedDocuments.has(parseInt(item.dataset.id))) {
                    item.classList.add('selected');
                }
            });
            
            if (multiSelectControls) {
                multiSelectControls.classList.remove('d-none');
            }
            
            if (toggleMultiSelectBtn) {
                toggleMultiSelectBtn.textContent = 'Cancel Selection';
                toggleMultiSelectBtn.classList.remove('btn-outline-primary');
                toggleMultiSelectBtn.classList.add('btn-outline-secondary');
            }
            
            // Hide document details and action buttons during multi-select
            if (documentDetails) {
                documentDetails.innerHTML = `
                    <div class="text-center p-5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-square mb-3"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        <p class="text-muted">Multi-select mode active</p>
                        <p class="text-muted small">Select documents for batch operations</p>
                    </div>
                `;
            }
            
            if (actionButtons) {
                actionButtons.classList.add('d-none');
            }
        } else {
            // Disable multi-select mode
            documentItems.forEach(item => {
                item.classList.remove('selected');
                if (parseInt(item.dataset.id) === currentDocumentId) {
                    item.classList.add('active');
                }
            });
            
            if (multiSelectControls) {
                multiSelectControls.classList.add('d-none');
            }
            
            if (toggleMultiSelectBtn) {
                toggleMultiSelectBtn.textContent = 'Select Multiple';
                toggleMultiSelectBtn.classList.remove('btn-outline-secondary');
                toggleMultiSelectBtn.classList.add('btn-outline-primary');
            }
            
            // Restore document details if a document is selected
            if (currentDocumentId) {
                loadDocumentDetails(currentDocumentId);
                if (actionButtons) {
                    actionButtons.classList.remove('d-none');
                }
            } else {
                if (documentDetails) {
                    documentDetails.innerHTML = `
                        <div class="text-center p-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <p class="text-muted">Select a document to view details</p>
                        </div>
                    `;
                }
            }
        }
        
        updateMultiSelectUI();
    }
    
    /**
     * Update multi-select UI based on selection state
     */
    function updateMultiSelectUI() {
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            selectedCount.textContent = selectedDocuments.size;
        }
        
        // Disable/enable batch action buttons based on selection
        if (batchMoveBtn) {
            batchMoveBtn.disabled = selectedDocuments.size === 0;
        }
        
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedDocuments.size === 0;
        }
    }
    
    /**
     * Show an alert message
     */
    function showAlert(message, type = 'info') {
        const alertsContainer = document.getElementById('alertsContainer');
        if (!alertsContainer) return;
        
        const id = 'alert-' + Date.now();
        const html = `
            <div id="${id}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        alertsContainer.innerHTML += html;
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            const alertElement = document.getElementById(id);
            if (alertElement) {
                const bsAlert = bootstrap.Alert.getOrCreateInstance(alertElement);
                bsAlert.close();
            }
        }, 5000);
    }
    
    /**
     * Debounce function to limit how often a function can be called
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
});